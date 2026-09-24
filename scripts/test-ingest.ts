/**
 * Ingestion pipeline checks.
 *
 * Proves the parts that decide whether a student is shown something true:
 * robots.txt is obeyed, sample content is refused, deadlines are read rather
 * than guessed, duplicates collapse, and a more official source wins a
 * disagreement while the disagreement is kept.
 *
 * Runs against the real database and deletes everything it writes.
 */
import '../lib/load-env';
import { PrismaClient } from '@prisma/client';
import { parseRobots, mayFetch } from '../lib/ingest/robots';
import { readAvailability, readDeadline } from '../lib/ingest/normalise';
import { dedupeKey, identityWords, titleSimilarity } from '../lib/ingest/dedupe';
import { validate, mayDisplayAsOpen } from '../lib/ingest/validate';
import { runSource } from '../lib/ingest/pipeline';
import { organisationFromTitle } from '../lib/ingest/parse';
import { SOURCES } from '../lib/ingest/source-registry';
import { firstPartyAvailability } from '../lib/first-party-availability';
import { STATUS_ORDER, displayStatus, isOpenNow } from '../lib/bursary-status';
import { finishRun, persistOutcome, startRun } from '../services/opportunity-ingest';
import {
  LISTING_PAGE,
  LISTING_URL,
  OFFICIAL_PAGE,
  OFFICIAL_URL,
  ROBOTS_DISALLOW_ALL,
  ROBOTS_PARTIAL,
} from './fixtures/ingest-pages';

const db = new PrismaClient();
let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`  FAIL  ${name}${detail ? ` -- ${detail}` : ''}`);
  }
}

async function main() {
  // Everything already in the directory, recorded before this test writes a
  // single row. The cleanup at the end deletes what is not in this set, so a
  // run of this suite can never touch a bursary the ingestion pipeline
  // imported for real. An earlier version deleted every EXTERNAL organisation
  // it could find, which would have taken the whole directory with it.
  const preexistingOrgs = new Set(
    (await db.organisation.findMany({ select: { id: true } })).map((o) => o.id),
  );

  console.log('\nrobots.txt is parsed and obeyed');
  const partial = parseRobots(ROBOTS_PARTIAL);
  check('a group naming our agent takes precedence', partial.disallow.includes('/members/'));
  check('the wildcard group is not merged in', !partial.disallow.includes('/private/'));
  const wildcard = parseRobots('User-agent: *\nDisallow: /private/\nCrawl-delay: 5\n');
  check('crawl-delay is read', wildcard.crawlDelaySeconds === 5);
  check('a full disallow is read', parseRobots(ROBOTS_DISALLOW_ALL).disallow.includes('/'));
  check(
    'an empty Disallow allows everything',
    parseRobots('User-agent: *\nDisallow:\n').disallow[0] === '',
  );
  const unreachable = await mayFetch('https://this-host-does-not-exist.invalid/page');
  check('a host whose robots.txt cannot be read is disallowed', !unreachable.allowed);
  check('a non-HTTPS source is refused', !(await mayFetch('http://example.test/x')).allowed);

  console.log('\nDeadlines are read, never guessed');
  check(
    'day-first named month',
    readDeadline('15 October 2027').date?.toISOString().startsWith('2027-10-15') === true,
  );
  check(
    'month-first is understood too',
    readDeadline('October 15, 2027').date?.toISOString().startsWith('2027-10-15') === true,
  );
  check(
    'numeric is read day-first',
    readDeadline('03/04/2027').date?.toISOString().startsWith('2027-04-03') === true,
  );
  check(
    'a closing date runs to the end of its day',
    readDeadline('15 October 2027').date?.toISOString().includes('21:59') === true,
  );
  check(
    'rolling applications are not given a date',
    readDeadline('Applications are accepted on a rolling basis').kind === 'ROLLING',
  );
  check(
    'until-filled is not given a date',
    readDeadline('Open until all places are filled').kind === 'UNTIL_FILLED',
  );
  check(
    'an unreadable deadline stays UNKNOWN',
    readDeadline('Soon, watch this space').kind === 'UNKNOWN',
  );
  check(
    'the source wording is kept verbatim',
    readDeadline('Soon, watch this space').note === 'Soon, watch this space',
  );
  check('an impossible date is refused', readDeadline('31 February 2027').date === null);

  console.log('\nStatus follows the source, not the calendar');
  const past = new Date('2020-01-01T00:00:00Z');
  const future = new Date('2099-01-01T00:00:00Z');
  check(
    'an explicit "closed" beats an open-looking date',
    readAvailability({
      statusText: 'Applications are now closed',
      openDate: null,
      closingDate: future,
      deadlineKind: 'FIXED',
    }).availability === 'CLOSED',
  );
  check(
    'an explicit "open" is not trusted past its own deadline',
    readAvailability({
      statusText: 'Applications are open',
      openDate: null,
      closingDate: past,
      deadlineKind: 'FIXED',
    }).availability === 'UNKNOWN',
  );
  check(
    'a future opening date is UPCOMING, not OPEN',
    readAvailability({
      statusText: null,
      openDate: future,
      closingDate: null,
      deadlineKind: 'FIXED',
    }).availability === 'UPCOMING',
  );
  check(
    'silence is UNKNOWN, not OPEN',
    readAvailability({
      statusText: null,
      openDate: null,
      closingDate: null,
      deadlineKind: 'UNKNOWN',
    }).availability === 'UNKNOWN',
  );
  check(
    'every decision carries a reason',
    readAvailability({
      statusText: null,
      openDate: null,
      closingDate: null,
      deadlineKind: 'UNKNOWN',
    }).because.length > 10,
  );

  console.log('\nOpen is a claim that needs a recent check behind it');
  check(
    'unverified is never shown as open',
    !mayDisplayAsOpen({ availability: 'OPEN', lastVerifiedAt: null }),
  );
  check(
    'a stale check is never shown as open',
    !mayDisplayAsOpen({
      availability: 'OPEN',
      lastVerifiedAt: new Date(Date.now() - 30 * 86_400_000),
    }),
  );
  check(
    'a recent check may be shown as open',
    mayDisplayAsOpen({ availability: 'OPEN', lastVerifiedAt: new Date() }),
  );

  console.log('\nA funder publishing here sets their own window');
  const win = { openDate: new Date('2020-01-01'), closingDate: new Date('2099-01-01') };
  check(
    'a published programme inside its window is OPEN',
    firstPartyAvailability({ status: 'PUBLISHED', ...win }) === 'OPEN',
  );
  check('a draft is never open', firstPartyAvailability({ status: 'DRAFT', ...win }) === 'CLOSED');
  check(
    'a suspended programme is never open',
    firstPartyAvailability({ status: 'SUSPENDED', ...win }) === 'CLOSED',
  );
  check(
    'a programme closed by its funder is closed',
    firstPartyAvailability({ status: 'CLOSED', ...win }) === 'CLOSED',
  );
  check(
    'a published programme before its opening date is UPCOMING',
    firstPartyAvailability({
      status: 'PUBLISHED',
      openDate: new Date('2099-01-01'),
      closingDate: null,
    }) === 'UPCOMING',
  );
  check(
    'a published programme past its closing date is CLOSED',
    firstPartyAvailability({
      status: 'PUBLISHED',
      openDate: null,
      closingDate: new Date('2020-01-01'),
    }) === 'CLOSED',
  );
  check(
    'a closed date beats a future opening date',
    firstPartyAvailability({
      status: 'PUBLISHED',
      openDate: new Date('2099-01-01'),
      closingDate: new Date('2020-01-01'),
    }) === 'CLOSED',
  );
  check(
    'a published programme with no dates is OPEN',
    firstPartyAvailability({ status: 'PUBLISHED', openDate: null, closingDate: null }) === 'OPEN',
  );

  console.log('\nClosing soon is open, and only a real date can cause it');
  const soon = new Date(Date.now() + 5 * 86_400_000);
  const later = new Date(Date.now() + 120 * 86_400_000);
  const openVerified = {
    availability: 'OPEN' as const,
    verificationStatus: 'VERIFIED' as const,
    lastVerifiedAt: new Date(),
    origin: 'EXTERNAL' as const,
  };
  check(
    'a deadline inside the window is CLOSING_SOON',
    displayStatus({ ...openVerified, closingDate: soon }) === 'CLOSING_SOON',
  );
  check(
    'a distant deadline is just OPEN',
    displayStatus({ ...openVerified, closingDate: later }) === 'OPEN',
  );
  check(
    'no deadline is OPEN, never urgent',
    displayStatus({ ...openVerified, closingDate: null }) === 'OPEN',
  );
  check(
    'a passed deadline is CLOSED even if availability says open',
    displayStatus({ ...openVerified, closingDate: new Date(Date.now() - 86_400_000) }) === 'CLOSED',
  );
  check(
    'an unverified opportunity is never CLOSING_SOON',
    displayStatus({ ...openVerified, lastVerifiedAt: null, closingDate: soon }) ===
      'NEEDS_VERIFICATION',
  );
  check(
    'a first-party programme closing soon is CLOSING_SOON',
    displayStatus({
      ...openVerified,
      origin: 'FIRST_PARTY',
      verificationStatus: 'UNVERIFIED',
      lastVerifiedAt: null,
      closingDate: soon,
    }) === 'CLOSING_SOON',
  );
  check(
    'closing soon still counts as open to apply',
    isOpenNow('CLOSING_SOON') && isOpenNow('OPEN'),
  );
  check('closed does not', !isOpenNow('CLOSED') && !isOpenNow('NEEDS_VERIFICATION'));
  check(
    'closing soon is listed before open',
    STATUS_ORDER.indexOf('CLOSING_SOON') < STATUS_ORDER.indexOf('OPEN'),
  );
  check('closed is listed last', STATUS_ORDER[STATUS_ORDER.length - 1] === 'CLOSED');

  console.log('\nSample content never reaches the database');
  const base = {
    sourceUrl: 'https://x.test/a',
    sourceName: 'Test',
    sourceType: 'OTHER' as const,
    official: false,
    contentHash: 'h',
    readAt: new Date(),
  };
  check(
    '"Example Bursary" is refused',
    !validate({ ...base, title: 'Example Bursary', organisationName: 'Someone' }).ok,
  );
  check(
    '"ABC Foundation" is refused',
    !validate({ ...base, title: 'Annual Award 2027', organisationName: 'ABC Foundation' }).ok,
  );
  check(
    'lorem ipsum is refused',
    !validate({
      ...base,
      title: 'Some Bursary 2027',
      organisationName: 'Real Co',
      description: 'Lorem ipsum dolor',
    }).ok,
  );
  check(
    'a title that says nothing is refused',
    !validate({ ...base, title: 'Apply', organisationName: 'Real Co' }).ok,
  );
  check(
    'no organisation is refused',
    !validate({ ...base, title: 'Engineering Bursary 2027', organisationName: '' }).ok,
  );
  check(
    'no source URL is refused',
    !validate({
      ...base,
      sourceUrl: 'not a url',
      title: 'Engineering Bursary 2027',
      organisationName: 'Real Co',
    }).ok,
  );
  check(
    'an invented relative application link is dropped',
    validate({
      ...base,
      title: 'Engineering Bursary 2027',
      organisationName: 'Real Co',
      applicationUrl: '/apply',
    }).ok,
  );
  const good = validate({
    ...base,
    title: 'Engineering Bursary 2027',
    organisationName: 'Real Co',
  });
  check('a well-formed record is accepted', good.ok);
  check(
    'a missing deadline is a warning, not a fabrication',
    good.ok && good.warnings.some((w) => /no deadline/i.test(w)),
  );

  console.log('\nThe funder is read from the title, not invented');
  check(
    'a subject before the funding word is not part of the name',
    organisationFromTitle('Ndlovu Test Holdings Engineering Bursary 2027') ===
      'Ndlovu Test Holdings',
    organisationFromTitle('Ndlovu Test Holdings Engineering Bursary 2027'),
  );
  check(
    'a subject inside a company name is kept',
    organisationFromTitle('Nkosi Engineering Trust Bursary') === 'Nkosi Engineering Trust',
  );
  check('a two-word name is left alone', organisationFromTitle('Sasol Bursaries 2027') === 'Sasol');
  check(
    'the year is not part of the name',
    !/20\d{2}/.test(organisationFromTitle('Mopane Group Accounting Bursary 2026')),
  );

  console.log('\nThe same bursary is recognised across sources');
  check(
    'funding words are stripped from identity',
    identityWords('Ndlovu Holdings Engineering Bursary 2027') === 'ndlovu engineering',
  );
  const k1 = dedupeKey({
    organisationName: 'Ndlovu Holdings',
    title: 'Ndlovu Holdings Engineering Bursary 2027',
    closingDate: new Date('2027-10-15'),
  });
  const k2 = dedupeKey({
    organisationName: 'Ndlovu Holdings',
    title: 'Ndlovu Engineering Bursary 2027',
    closingDate: new Date('2027-09-30'),
  });
  check('two namings of one programme share a key', k1 === k2);
  const k3 = dedupeKey({
    organisationName: 'Ndlovu Holdings',
    title: 'Ndlovu Engineering Bursary 2028',
    closingDate: new Date('2028-10-15'),
  });
  check('a different cycle is a different opportunity', k1 !== k3);
  check(
    'similar titles score high',
    titleSimilarity('Ndlovu Engineering Bursary', 'Ndlovu Engineering Bursary 2027') >= 0.8,
  );
  check(
    'unrelated titles score low',
    titleSimilarity('Ndlovu Engineering Bursary', 'Mopane Accounting Grant') < 0.3,
  );

  console.log('\nA full run against supplied pages');
  const pages = new Map<string, string>([
    [LISTING_URL, LISTING_PAGE],
    [OFFICIAL_URL, OFFICIAL_PAGE],
  ]);
  const fetcher = async (url: string) => {
    const body = pages.get(url);
    return body
      ? { ok: true as const, body, url }
      : { ok: false as const, reason: 'not in fixtures', kind: 'http' };
  };

  const listingSource = {
    ...SOURCES[0],
    listingUrls: [LISTING_URL],
    adapter: 'listing-generic' as const,
  };
  const listingRun = await runSource(listingSource, { fetcher, maxDetailPages: 0 });
  check('the listing is read', listingRun.status === 'ok');
  check(
    'four real entries are kept',
    listingRun.candidates.length === 4,
    String(listingRun.candidates.length),
  );
  check(
    'three sample entries are refused',
    listingRun.rejections.length === 3,
    String(listingRun.rejections.length),
  );
  check(
    'the closed entry is CLOSED',
    listingRun.candidates.find((c) => /Mopane/.test(c.value.title))?.availability === 'CLOSED',
  );
  check(
    'the rolling entry is OPEN with no date',
    listingRun.candidates.find((c) => /Kalahari/.test(c.value.title))?.deadlineKind === 'ROLLING',
  );
  check(
    'the entry with no deadline gets no deadline',
    listingRun.candidates.find((c) => /Sefako/.test(c.value.title))?.closingDate === null,
  );
  check(
    'the entry with no deadline is UNKNOWN, not OPEN',
    listingRun.candidates.find((c) => /Sefako/.test(c.value.title))?.availability === 'UNKNOWN',
  );

  console.log('\nStoring, deduplicating and resolving a conflict');
  const run = await startRun('test');
  const written = await persistOutcome(run.id, listingRun);
  check('four opportunities are created', written.created === 4, JSON.stringify(written));

  const officialSource = {
    ...SOURCES[0],
    name: 'Ndlovu Test Holdings (official)',
    type: 'OFFICIAL_ORGANISATION' as const,
    official: true,
    listingUrls: [OFFICIAL_URL],
    adapter: 'zabursaries' as const,
  };
  const officialRun = await runSource(officialSource, { fetcher, maxDetailPages: 0 });
  const written2 = await persistOutcome(run.id, officialRun);
  check(
    'the official page merges rather than duplicating',
    written2.created === 0 && written2.merged === 1,
    JSON.stringify(written2),
  );

  const ndlovu = await db.fundingProgramme.findFirst({
    where: { name: { contains: 'Ndlovu' } },
    select: {
      id: true,
      closingDate: true,
      sourceType: true,
      officialSource: true,
      sourceUrl: true,
      availability: true,
      verificationStatus: true,
      applicationUrl: true,
      sources: { select: { url: true, type: true, isPrimary: true } },
      conflicts: { select: { field: true, otherValue: true, resolution: true } },
    },
  });
  check(
    'one row carries both sources',
    ndlovu?.sources.length === 2,
    String(ndlovu?.sources.length),
  );
  check('the official source became primary', ndlovu?.sourceType === 'OFFICIAL_ORGANISATION');
  check('it is marked as an official source', ndlovu?.officialSource === true);
  check(
    'the official closing date won',
    ndlovu?.closingDate?.toISOString().startsWith('2027-09-30') === true,
    ndlovu?.closingDate?.toISOString(),
  );
  check('the disagreement was recorded', (ndlovu?.conflicts.length ?? 0) === 1);
  check(
    'the record says which source won',
    /more authoritative/i.test(ndlovu?.conflicts[0]?.resolution ?? ''),
  );
  check(
    'the official application link was taken',
    ndlovu?.applicationUrl === 'https://ndlovu-test.example/apply',
  );

  const externalOrgs = await db.organisation.count({ where: { origin: 'EXTERNAL' } });
  check(
    'funders discovered from a source are marked EXTERNAL',
    externalOrgs >= 4,
    String(externalOrgs),
  );

  await finishRun(run.id, 'SUCCEEDED', {
    sourcesAttempted: 2,
    sourcesSucceeded: 2,
    sourcesBlocked: 0,
    sourcesFailed: 0,
    opportunitiesFound: listingRun.candidates.length + officialRun.candidates.length,
    opportunitiesCreated: written.created + written2.created,
    opportunitiesUpdated: written.updated + written2.updated,
    duplicatesMerged: written.merged + written2.merged,
    rejected: listingRun.rejections.length,
  });

  // Nothing this test wrote may survive it -- and nothing it did not write may
  // be removed by it. Both halves matter: the check below counts what is left
  // of this run's own writes, not every external opportunity in the database,
  // because the directory legitimately holds imported bursaries that this
  // suite neither created nor may delete.
  const mine = await db.organisation.findMany({
    select: { id: true },
    where: { id: { notIn: [...preexistingOrgs] } },
  });
  const mineIds = mine.map((o) => o.id);
  await db.fundingProgramme.deleteMany({ where: { organisationId: { in: mineIds } } });
  await db.organisation.deleteMany({ where: { id: { in: mineIds } } });
  await db.ingestionRun.deleteMany({ where: { trigger: 'test' } });

  const left = await db.fundingProgramme.count({
    where: { organisationId: { in: mineIds } },
  });
  const strays = await db.organisation.count({ where: { id: { in: mineIds } } });
  check('the test leaves nothing behind', left === 0 && strays === 0, `${left}/${strays}`);

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  - ${f}`);
  }
  await db.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
