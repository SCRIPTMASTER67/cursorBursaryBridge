import 'server-only';
import type { IngestionRunStatus, Prisma, SourceType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { slugify } from '@/lib/utils';
import { outranks } from '@/lib/ingest/source-registry';
import { titleSimilarity, NEAR_DUPLICATE_THRESHOLD } from '@/lib/ingest/dedupe';
import type { Candidate, SourceOutcome } from '@/lib/ingest/pipeline';

/**
 * Writing what a run found.
 *
 * Three rules shape everything here:
 *
 *   An opportunity with no source is never written.
 *   The same programme seen on three sites is one row with three sources.
 *   When sources disagree, the official one wins and the disagreement is kept.
 */

export async function startRun(trigger: string) {
  return prisma.ingestionRun.create({
    data: { trigger, status: 'RUNNING' },
    select: { id: true, startedAt: true },
  });
}

export async function logEvent(
  runId: string,
  level: 'INFO' | 'WARN' | 'ERROR',
  message: string,
  source?: { name?: string; url?: string },
) {
  await prisma.ingestionEvent.create({
    data: {
      runId,
      level,
      message: message.slice(0, 1000),
      sourceName: source?.name ?? null,
      sourceUrl: source?.url ?? null,
    },
  });
}

export async function finishRun(
  runId: string,
  status: IngestionRunStatus,
  totals: {
    sourcesAttempted: number;
    sourcesSucceeded: number;
    sourcesBlocked: number;
    sourcesFailed: number;
    opportunitiesFound: number;
    opportunitiesCreated: number;
    opportunitiesUpdated: number;
    duplicatesMerged: number;
    rejected: number;
    notes?: string;
  },
) {
  await prisma.ingestionRun.update({
    where: { id: runId },
    data: { ...totals, status, finishedAt: new Date() },
  });
}

export type PersistTotals = {
  created: number;
  updated: number;
  merged: number;
};

/** Write one source's candidates. Returns what changed. */
export async function persistOutcome(
  runId: string,
  outcome: SourceOutcome,
): Promise<PersistTotals> {
  const totals: PersistTotals = { created: 0, updated: 0, merged: 0 };

  for (const candidate of outcome.candidates) {
    try {
      const result = await persistCandidate(runId, candidate);
      totals[result] += 1;
    } catch (error) {
      await logEvent(
        runId,
        'ERROR',
        `Could not store "${candidate.value.title}": ${error instanceof Error ? error.message : String(error)}`,
        { name: outcome.source.name, url: candidate.value.sourceUrl },
      );
    }
  }

  for (const rejection of outcome.rejections) {
    await logEvent(runId, 'WARN', `Rejected "${rejection.title}": ${rejection.reason}`, {
      name: outcome.source.name,
      url: rejection.sourceUrl,
    });
  }

  return totals;
}

async function persistCandidate(
  runId: string,
  candidate: Candidate,
): Promise<'created' | 'updated' | 'merged'> {
  const existing = await prisma.fundingProgramme.findUnique({
    where: { dedupeKey: candidate.dedupeKey },
    select: { id: true, name: true, sourceType: true, closingDate: true, sourceUrl: true },
  });

  if (existing) {
    const seenBefore = await prisma.opportunitySource.findUnique({
      where: {
        fundingProgrammeId_url: {
          fundingProgrammeId: existing.id,
          url: candidate.value.sourceUrl,
        },
      },
      select: { id: true },
    });

    // Reconcile BEFORE the source is recorded. recordSource promotes a more
    // official source to primary, which would leave reconcile comparing the
    // candidate against itself and finding a tie where there is a winner.
    await reconcile(runId, existing.id, candidate);
    await recordSource(existing.id, candidate);
    return seenBefore ? 'updated' : 'merged';
  }

  const nearDuplicate = await findNearDuplicate(candidate);
  if (nearDuplicate) {
    // Close but not identical. Attaching the source is safe; overwriting the
    // record is not, so a person is told instead.
    await recordSource(nearDuplicate.id, candidate);
    await logEvent(
      runId,
      'WARN',
      `"${candidate.value.title}" looks like "${nearDuplicate.name}" but the keys differ. The source was attached; the two were not merged.`,
      { url: candidate.value.sourceUrl },
    );
    return 'merged';
  }

  const organisation = await upsertOrganisation(candidate);
  const created = await prisma.fundingProgramme.create({
    data: {
      organisationId: organisation.id,
      name: candidate.value.title.slice(0, 200),
      slug: await uniqueSlug(candidate.value.title),
      shortDescription: (candidate.value.description ?? 'See the source for full details.').slice(
        0,
        300,
      ),
      fullDescription: candidate.value.description ?? 'See the source for full details.',
      fundingType: 'BURSARY',
      coverage: [],
      openDate: candidate.openDate,
      closingDate: candidate.closingDate,
      deadlineKind: candidate.deadlineKind,
      deadlineNote: candidate.deadlineNote,
      // Externally-discovered opportunities are published to the directory but
      // are never applied to through Bursary-Bridge, so the applications
      // workflow is untouched by them.
      status: 'PUBLISHED',
      origin: 'EXTERNAL',
      availability: candidate.availability,
      sourceUrl: candidate.value.sourceUrl,
      sourceName: candidate.value.sourceName,
      sourceType: candidate.value.sourceType,
      officialSource: candidate.value.official,
      applicationUrl: candidate.value.applicationUrl,
      verificationStatus: 'VERIFIED',
      lastVerifiedAt: new Date(),
      lastCheckedAt: new Date(),
      dedupeKey: candidate.dedupeKey,
    },
    select: { id: true },
  });

  await recordSource(created.id, candidate);
  for (const warning of candidate.warnings) {
    await logEvent(runId, 'INFO', `"${candidate.value.title}": ${warning}`, {
      url: candidate.value.sourceUrl,
    });
  }
  return 'created';
}

/** Attach a source, and promote it to primary if it outranks the current one. */
async function recordSource(fundingProgrammeId: string, candidate: Candidate) {
  const now = new Date();
  await prisma.opportunitySource.upsert({
    where: {
      fundingProgrammeId_url: { fundingProgrammeId, url: candidate.value.sourceUrl },
    },
    create: {
      fundingProgrammeId,
      url: candidate.value.sourceUrl,
      name: candidate.value.sourceName,
      type: candidate.value.sourceType,
      official: candidate.value.official,
      contentHash: candidate.value.contentHash,
      lastCheckedAt: now,
      lastVerifiedAt: now,
    },
    update: {
      contentHash: candidate.value.contentHash,
      lastCheckedAt: now,
      lastVerifiedAt: now,
    },
  });

  const programme = await prisma.fundingProgramme.findUnique({
    where: { id: fundingProgrammeId },
    select: { sourceType: true },
  });
  const current: SourceType = programme?.sourceType ?? 'OTHER';

  if (outranks(candidate.value.sourceType, current)) {
    await prisma.$transaction([
      prisma.opportunitySource.updateMany({
        where: { fundingProgrammeId },
        data: { isPrimary: false },
      }),
      prisma.opportunitySource.update({
        where: {
          fundingProgrammeId_url: { fundingProgrammeId, url: candidate.value.sourceUrl },
        },
        data: { isPrimary: true },
      }),
      prisma.fundingProgramme.update({
        where: { id: fundingProgrammeId },
        data: {
          sourceUrl: candidate.value.sourceUrl,
          sourceName: candidate.value.sourceName,
          sourceType: candidate.value.sourceType,
          officialSource: candidate.value.official,
        },
      }),
    ]);
  }
}

/**
 * Bring a new reading together with what is already stored.
 *
 * A more authoritative source overwrites a less authoritative one and the
 * disagreement is recorded. Two sources of equal standing that disagree are
 * not silently resolved: the record is marked CONFLICTED for a person to look
 * at, because picking one at random is how a student misses a deadline.
 */
async function reconcile(runId: string, fundingProgrammeId: string, candidate: Candidate) {
  const current = await prisma.fundingProgramme.findUniqueOrThrow({
    where: { id: fundingProgrammeId },
    select: {
      closingDate: true,
      deadlineKind: true,
      sourceType: true,
      sourceUrl: true,
      officialSource: true,
      availability: true,
      applicationUrl: true,
    },
  });

  const now = new Date();
  const data: Prisma.FundingProgrammeUpdateInput = {
    lastCheckedAt: now,
    lastVerifiedAt: now,
    verificationStatus: 'VERIFIED',
  };

  const sameDeadline =
    current.closingDate?.getTime() === candidate.closingDate?.getTime() &&
    current.deadlineKind === candidate.deadlineKind;

  // A stored record with no recorded source type ranks lowest, so a candidate
  // that names its source always outranks it.
  const currentType: SourceType = current.sourceType ?? 'OTHER';

  const candidateIsBetter = outranks(candidate.value.sourceType, currentType);
  const currentIsBetter = outranks(currentType, candidate.value.sourceType);

  if (!sameDeadline) {
    const storedReading = {
      value: describe(current.closingDate, current.deadlineKind),
      url: current.sourceUrl,
    };
    const newReading = {
      value: describe(candidate.closingDate, candidate.deadlineKind),
      url: candidate.value.sourceUrl,
    };
    // The "official" side of the record is whichever source outranks the
    // other, so the row reads the same way regardless of arrival order.
    const winner = candidateIsBetter ? newReading : currentIsBetter ? storedReading : null;
    const loser = candidateIsBetter ? storedReading : newReading;

    await prisma.sourceConflict.create({
      data: {
        fundingProgrammeId,
        field: 'closingDate',
        officialValue: winner?.value ?? null,
        officialSourceUrl: winner?.url ?? null,
        otherValue: loser.value,
        otherSourceUrl: loser.url ?? candidate.value.sourceUrl,
        resolution: candidateIsBetter
          ? 'Taken from the more authoritative source.'
          : currentIsBetter
            ? 'Kept: the stored value comes from a more authoritative source.'
            : 'Unresolved: the sources are of equal standing. Marked for review.',
        resolvedAt: candidateIsBetter || currentIsBetter ? now : null,
      },
    });

    if (candidateIsBetter) {
      data.closingDate = candidate.closingDate;
      data.deadlineKind = candidate.deadlineKind;
      data.deadlineNote = candidate.deadlineNote;
      data.availability = candidate.availability;
    } else if (!currentIsBetter) {
      data.verificationStatus = 'CONFLICTED';
      await logEvent(
        runId,
        'WARN',
        'Sources disagree on the closing date and neither is more official. Marked for review.',
        { url: candidate.value.sourceUrl },
      );
    }
  } else if (current.availability !== candidate.availability) {
    data.availability = candidate.availability;
  }

  // The funder's own application link is better than a listing site's, so a
  // more official source replaces it. A less official one only fills a gap.
  if (candidate.value.applicationUrl && (candidateIsBetter || !current.applicationUrl)) {
    data.applicationUrl = candidate.value.applicationUrl;
  }

  await prisma.fundingProgramme.update({ where: { id: fundingProgrammeId }, data });
}

function describe(date: Date | null, kind: string): string {
  if (date) return date.toISOString().slice(0, 10);
  return kind.toLowerCase().replace('_', ' ');
}

/**
 * An organisation named by a source but with no account here.
 *
 * It is recorded as EXTERNAL so nothing mistakes it for a registered funder,
 * and it carries the page that named it.
 */
async function upsertOrganisation(candidate: Candidate) {
  const name = candidate.value.organisationName.slice(0, 120);
  const existing = await prisma.organisation.findUnique({ where: { name }, select: { id: true } });
  if (existing) return existing;

  return prisma.organisation.create({
    data: {
      name,
      type: 'OTHER',
      industry: 'OTHER',
      origin: 'EXTERNAL',
      sourceUrl: candidate.value.sourceUrl,
      description: null,
    },
    select: { id: true },
  });
}

/** Find a stored opportunity that is probably the same thing under another name. */
async function findNearDuplicate(candidate: Candidate) {
  const organisation = await prisma.organisation.findUnique({
    where: { name: candidate.value.organisationName.slice(0, 120) },
    select: { id: true },
  });
  if (!organisation) return null;

  const siblings = await prisma.fundingProgramme.findMany({
    where: { organisationId: organisation.id, origin: 'EXTERNAL' },
    select: { id: true, name: true, closingDate: true },
    take: 50,
  });

  for (const sibling of siblings) {
    const sameCycle =
      sibling.closingDate?.getUTCFullYear() === candidate.closingDate?.getUTCFullYear();
    if (!sameCycle) continue;
    if (titleSimilarity(sibling.name, candidate.value.title) >= NEAR_DUPLICATE_THRESHOLD) {
      return sibling;
    }
  }
  return null;
}

async function uniqueSlug(title: string): Promise<string> {
  const base = slugify(title).slice(0, 80) || 'opportunity';
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const clash = await prisma.fundingProgramme.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!clash) return candidate;
  }
  return `${base}-${Date.now()}`;
}
