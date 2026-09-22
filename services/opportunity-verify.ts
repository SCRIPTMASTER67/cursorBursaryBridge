import 'server-only';
import { prisma } from '@/lib/db';
import { FRESHNESS_DAYS } from '@/lib/ingest/validate';
import { politeFetch } from '@/lib/ingest/http';
import { parseListing } from '@/lib/ingest/parse';
import { readAvailability, readDeadline } from '@/lib/ingest/normalise';
import { sourceById } from '@/lib/ingest/source-registry';
import { logEvent } from '@/services/opportunity-ingest';

/**
 * Keeping the directory honest between ingestion runs.
 *
 * Two mechanisms, deliberately separated by what they can prove:
 *
 * Dates can only ever prove that an opportunity is NOT open — a closing date
 * that has passed, an opening date that has not arrived. They can never prove
 * that applications are open, because a funder can close early. So the local
 * pass only ever closes things, and never opens one.
 *
 * Openness is a claim about right now, so it needs a source check behind it.
 * An opportunity that has not been confirmed inside the freshness window is
 * marked STALE and the interface stops advertising it as open.
 */

export type LocalSweepResult = {
  closedByDeadline: number;
  markedUpcoming: number;
  markedStale: number;
  scanned: number;
};

/**
 * The pass that needs no network.
 *
 * Safe to run on a schedule regardless of whether the sources are reachable,
 * and the only thing standing between a student and a bursary that closed
 * yesterday when ingestion is down.
 */
export async function sweepLocalStatus(now = new Date()): Promise<LocalSweepResult> {
  const stale = new Date(now.getTime() - FRESHNESS_DAYS * 86_400_000);

  // A closing date that has passed closes the opportunity. This is the only
  // status change dates alone are allowed to make.
  const closed = await prisma.fundingProgramme.updateMany({
    where: {
      closingDate: { not: null, lt: now },
      deadlineKind: 'FIXED',
      availability: { in: ['OPEN', 'UPCOMING', 'UNKNOWN'] },
    },
    data: { availability: 'CLOSED' },
  });

  // An opening date that has not arrived means applications are not open yet.
  const upcoming = await prisma.fundingProgramme.updateMany({
    where: {
      openDate: { not: null, gt: now },
      availability: { in: ['OPEN', 'UNKNOWN'] },
    },
    data: { availability: 'UPCOMING' },
  });

  // Anything not confirmed recently stops counting as verified. Nothing is
  // deleted and nothing is hidden — it is simply no longer advertised as open.
  const marked = await prisma.fundingProgramme.updateMany({
    where: {
      origin: 'EXTERNAL',
      verificationStatus: 'VERIFIED',
      OR: [{ lastVerifiedAt: null }, { lastVerifiedAt: { lt: stale } }],
    },
    data: { verificationStatus: 'STALE' },
  });

  const scanned = await prisma.fundingProgramme.count();

  return {
    closedByDeadline: closed.count,
    markedUpcoming: upcoming.count,
    markedStale: marked.count,
    scanned,
  };
}

export type RecheckResult = {
  checked: number;
  confirmed: number;
  changed: number;
  gone: number;
  unreachable: number;
};

/**
 * Re-read the sources behind opportunities that most need it.
 *
 * Open ones first, because those are the ones a student will act on, then the
 * stale ones. A source that no longer carries the opportunity marks it
 * SOURCE_GONE rather than deleting it: a closed bursary is still worth seeing.
 */
export async function recheckFromSources(
  options: { limit?: number; runId?: string; now?: Date } = {},
): Promise<RecheckResult> {
  const now = options.now ?? new Date();
  const limit = options.limit ?? 40;

  const due = await prisma.fundingProgramme.findMany({
    where: { origin: 'EXTERNAL', sourceUrl: { not: null } },
    orderBy: [{ availability: 'asc' }, { lastCheckedAt: 'asc' }],
    take: limit,
    select: {
      id: true,
      name: true,
      sourceUrl: true,
      sourceName: true,
      sourceType: true,
      officialSource: true,
      closingDate: true,
      deadlineKind: true,
      availability: true,
    },
  });

  const result: RecheckResult = { checked: 0, confirmed: 0, changed: 0, gone: 0, unreachable: 0 };

  for (const programme of due) {
    if (!programme.sourceUrl) continue;
    result.checked += 1;

    const fetched = await politeFetch(programme.sourceUrl);
    if (!fetched.ok) {
      await prisma.fundingProgramme.update({
        where: { id: programme.id },
        data: { lastCheckedAt: now },
      });

      // A 404 is the source saying the opportunity is no longer there. A
      // network failure says nothing about the opportunity at all.
      if (fetched.kind === 'http' && /404/.test(fetched.reason)) {
        result.gone += 1;
        await prisma.fundingProgramme.update({
          where: { id: programme.id },
          data: { verificationStatus: 'SOURCE_GONE', availability: 'UNKNOWN' },
        });
        if (options.runId) {
          await logEvent(options.runId, 'WARN', `Source no longer carries "${programme.name}".`, {
            url: programme.sourceUrl,
          });
        }
      } else {
        result.unreachable += 1;
      }
      continue;
    }

    const source = sourceById('zabursaries');
    const parsed = parseListing(fetched.body, fetched.url, {
      ...(source ?? {
        id: 'unknown',
        name: programme.sourceName ?? 'Source',
        adapter: 'listing-generic' as const,
        enabled: true,
        homepage: fetched.url,
        listingUrls: [],
        note: '',
      }),
      name: programme.sourceName ?? 'Source',
      type: programme.sourceType ?? 'OTHER',
      official: programme.officialSource,
    });

    const first = parsed.opportunities[0];
    if (!first) {
      result.unreachable += 1;
      await prisma.fundingProgramme.update({
        where: { id: programme.id },
        data: { lastCheckedAt: now },
      });
      continue;
    }

    const closing = readDeadline(first.closingDateText);
    const opening = readDeadline(first.openDateText);
    const availability = readAvailability({
      statusText: first.statusText,
      openDate: opening.date,
      closingDate: closing.date,
      deadlineKind: closing.kind,
      now,
    });

    const changed =
      availability.availability !== programme.availability ||
      closing.date?.getTime() !== programme.closingDate?.getTime();

    await prisma.fundingProgramme.update({
      where: { id: programme.id },
      data: {
        availability: availability.availability,
        closingDate: closing.date,
        deadlineKind: closing.kind,
        deadlineNote: closing.note,
        verificationStatus: 'VERIFIED',
        lastVerifiedAt: now,
        lastCheckedAt: now,
      },
    });

    if (changed) {
      result.changed += 1;
      if (options.runId) {
        await logEvent(
          options.runId,
          'INFO',
          `"${programme.name}" changed: now ${availability.availability}. ${availability.because}`,
          { url: programme.sourceUrl },
        );
      }
    } else {
      result.confirmed += 1;
    }
  }

  return result;
}
