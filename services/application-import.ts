import 'server-only';
import type { DocumentType, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { storage } from '@/lib/storage';
import { canonicalise } from '@/lib/catalogue';
import { expandUpload, type BundleEntry } from '@/lib/import/bundle';
import { compareApplicants, resolveIdentity, type IdentitySignals } from '@/lib/import/identity';
import { projectApplicant, reviewReasons, type CatalogueIndex } from '@/lib/import/applicant';
import { readSourceForm } from '@/lib/pdf/source';
import { EligibilityService, MatchingService } from '@/lib/matching';
import { toMatchableExternalApplicant, toMatchableProgramme } from '@/lib/matching/adapters';
import { audit } from '@/services/audit';

/**
 * Importing applications an organisation received elsewhere.
 *
 * The work is genuinely done: each PDF is opened, its fields are read, the
 * applicant is looked for among existing students, duplicates are checked
 * against the rest of the batch and against what the programme already holds,
 * the match is scored against that programme's own criteria, and the
 * supporting documents are counted. The progress a reviewer watches is the
 * count of files that have actually been through all of that.
 *
 * Nothing here decides anything irreversible. Extraction produces a batch to
 * review; the applications themselves are created only when a person confirms
 * the import. Duplicates are flagged, never dropped. Files that could not be
 * read are kept with the reason, because an application a funder never sees
 * because our parser failed is the worst outcome this feature can have.
 */

/** Batches are processed a few files at a time, so one upload cannot monopolise the machine. */
const CONCURRENCY = 4;

async function catalogueIndex(): Promise<CatalogueIndex> {
  const [institutions, programmes] = await Promise.all([
    prisma.institution.findMany({ select: { id: true, canonicalName: true } }),
    prisma.programme.findMany({ select: { id: true, canonicalName: true } }),
  ]);
  return {
    institutions: new Map(institutions.map((row) => [row.canonicalName, row.id])),
    programmes: new Map(programmes.map((row) => [row.canonicalName, row.id])),
  };
}

/** The next batch reference for this organisation: Batch #1, #2, … */
async function nextReference(organisationId: string): Promise<string> {
  const count = await prisma.applicationImportBatch.count({ where: { organisationId } });
  return `Batch #${count + 1}`;
}

export type CreateBatchInput = {
  organisationId: string;
  fundingProgrammeId: string;
  userId: string;
  uploads: { fileName: string; bytes: Uint8Array }[];
};

/**
 * Take an upload and record everything in it, before reading anything.
 *
 * Storing first means a batch survives a crash halfway through extraction: the
 * files are on disk and the rows exist, so processing can be retried without
 * asking the organisation to upload 750 applications again.
 */
export async function createBatch(input: CreateBatchInput) {
  const programme = await prisma.fundingProgramme.findFirst({
    where: { id: input.fundingProgrammeId, organisationId: input.organisationId },
    select: { id: true, name: true },
  });
  if (!programme) {
    return { ok: false as const, reason: 'That programme was not found for your organisation.' };
  }

  const bundle = await expandUpload(input.uploads);
  if (bundle.entries.length === 0 && bundle.rejected.length === 0) {
    return { ok: false as const, reason: 'No files were uploaded.' };
  }

  const batch = await prisma.applicationImportBatch.create({
    data: {
      organisationId: input.organisationId,
      fundingProgrammeId: programme.id,
      createdById: input.userId,
      reference: await nextReference(input.organisationId),
      status: 'EXTRACTING',
      totalFiles: bundle.entries.length + bundle.rejected.length,
      failedCount: bundle.rejected.length,
      processedFiles: bundle.rejected.length,
      startedAt: new Date(),
    },
    select: { id: true, reference: true },
  });

  const store = storage();

  // Everything that could not even be opened is recorded as a failed file
  // rather than dropped, so the reviewer's totals add up to what they sent.
  for (const rejected of bundle.rejected) {
    await prisma.applicationImportFile.create({
      data: {
        batchId: batch.id,
        fileName: rejected.fileName,
        storageKey: `rejected/${batch.id}/${crypto.randomUUID()}`,
        sizeBytes: 0,
        contentType: 'application/octet-stream',
        status: 'FAILED',
        failureReason: rejected.reason,
        processedAt: new Date(),
      },
    });
  }

  for (const entry of bundle.entries) {
    const stored = await store.put({
      prefix: `imports/${input.organisationId}/${batch.id}`,
      fileName: entry.fileName,
      contentType: 'application/pdf',
      body: Buffer.from(entry.bytes),
    });

    await prisma.applicationImportFile.create({
      data: {
        batchId: batch.id,
        fileName: entry.fileName,
        storageKey: stored.key,
        sizeBytes: stored.sizeBytes,
        contentType: 'application/pdf',
        status: 'PENDING',
        // Supporting documents travel with the form as extracted fields would,
        // so the count survives even before an application row exists.
        fields: {
          create: entry.documents.map((document, index) => ({
            canonicalKey: `supportingDocument:${index}`,
            value: document.type,
            raw: document.fileName,
            confidence: 'HIGH',
            kind: 'text',
            sourceFieldLabel: document.fileName,
            method: 'file-name',
          })),
        },
      },
    });
  }

  await audit({
    userId: input.userId,
    action: 'import.batch_created',
    entityType: 'ApplicationImportBatch',
    entityId: batch.id,
    metadata: {
      programme: programme.name,
      files: bundle.entries.length,
      rejected: bundle.rejected.length,
    },
  });

  return { ok: true as const, batchId: batch.id, reference: batch.reference };
}

type ProgrammeContext = Awaited<ReturnType<typeof loadProgramme>>;

async function loadProgramme(fundingProgrammeId: string) {
  return prisma.fundingProgramme.findUniqueOrThrow({
    where: { id: fundingProgrammeId },
    include: {
      eligibility: {
        include: { subjectRequirements: { include: { subject: { select: { name: true } } } } },
      },
      supportedInstitutions: { select: { institutionId: true } },
      supportedProgrammes: { select: { programmeId: true } },
      criterionWeights: true,
    },
  });
}

/** Read one file, score it, and decide what the reviewer should see. */
async function processFile(
  fileId: string,
  programme: ProgrammeContext,
  catalogue: CatalogueIndex,
  organisationId: string,
) {
  const file = await prisma.applicationImportFile.findUniqueOrThrow({
    where: { id: fileId },
    include: { fields: true },
  });

  await prisma.applicationImportFile.update({
    where: { id: fileId },
    data: { status: 'PROCESSING' },
  });

  const object = await storage().get(file.storageKey);
  if (!object) {
    await prisma.applicationImportFile.update({
      where: { id: fileId },
      data: {
        status: 'FAILED',
        failureReason: 'The uploaded file could no longer be read from storage.',
        processedAt: new Date(),
      },
    });
    return;
  }

  const read = await readSourceForm(new Uint8Array(object.body), file.fileName);
  if (!read.ok) {
    // The reason comes from the reader and is written for a person: password
    // protected, a scan, a damaged file. Kept, never discarded.
    await prisma.applicationImportFile.update({
      where: { id: fileId },
      data: {
        status: 'FAILED',
        failureReason: read.reason,
        pageCount: read.analysis?.pageCount ?? null,
        processedAt: new Date(),
      },
    });
    return;
  }

  const applicant = projectApplicant(read.profile, catalogue);
  const signals: IdentitySignals = {
    idNumber: applicant.idNumber,
    email: applicant.email,
    fullName: applicant.fullName || null,
    dateOfBirth: applicant.dateOfBirth?.toISOString().slice(0, 10) ?? null,
    mobile: applicant.mobile,
  };

  // --- who is this? -------------------------------------------------------
  const identity = await resolveIdentity(signals, {
    // A student profile does not hold an identity number, so there is nothing
    // here to match one against. Returning nothing is the honest answer;
    // falling through to a name comparison would not be.
    byIdNumber: async () => [],
    byEmail: async (email) => {
      const students = await prisma.studentProfile.findMany({
        where: { user: { email } },
        select: { id: true },
      });
      return students.map((student) => student.id);
    },
  });

  // --- score it against this programme ------------------------------------
  const matchable = toMatchableExternalApplicant({
    programmeId: applicant.programmeId,
    institutionId: applicant.institutionId,
    qualificationLevel: applicant.qualificationLevel,
    academicAverage: applicant.academicAverage,
    province: applicant.province,
    householdIncome: applicant.householdIncome,
    citizenship: applicant.citizenship,
    yearOfStudy: applicant.yearOfStudy,
  });
  const matchableProgramme = toMatchableProgramme({
    id: programme.id,
    supportedProgrammes: programme.supportedProgrammes,
    supportedInstitutions: programme.supportedInstitutions,
    eligibility: programme.eligibility,
  });

  const weights = Object.fromEntries(
    programme.criterionWeights.map((row) => [row.criterion, row.weight]),
  );
  const match = MatchingService.score(matchable, matchableProgramme, { weights });
  const eligibility = EligibilityService.evaluate(matchable, matchableProgramme);

  // --- what did they send with it? ----------------------------------------
  const required = programme.eligibility?.requiredDocuments ?? [];
  const supplied = new Set(
    file.fields
      .filter((field) => field.canonicalKey.startsWith('supportingDocument:'))
      .map((field) => field.value as DocumentType),
  );
  const documentsFound = required.filter((type) => supplied.has(type)).length;

  // --- persist -------------------------------------------------------------
  const reasons = reviewReasons(applicant, read.profile);
  // Duplicates are decided in a second pass, once every file has been read.
  // Deciding here would be a race: two copies processed in the same batch of
  // four would each look at the other before either had been recorded, and
  // both would come through clean.
  const status = reasons.length > 0 ? ('NEEDS_REVIEW' as const) : ('READY' as const);

  await prisma.$transaction(async (tx) => {
    // The extracted values, one row each, with the confidence and the label
    // they were read from. Replaced wholesale on a retry so a second run
    // cannot leave a stale field behind.
    await tx.importExtractedField.deleteMany({
      where: { fileId, canonicalKey: { not: { startsWith: 'supportingDocument:' } } },
    });

    for (const [key, value] of Object.entries(read.profile.values)) {
      if (!value) continue;
      await tx.importExtractedField.create({
        data: {
          fileId,
          canonicalKey: key,
          value: value.value,
          raw: value.raw,
          confidence: value.confidence,
          kind: value.kind,
          sourceFieldLabel: value.provenance.fieldLabel,
          sourcePage: value.provenance.page,
          method: value.provenance.method,
        },
      });
    }

    await tx.applicationImportFile.update({
      where: { id: fileId },
      data: {
        status,
        failureReason: reasons.length > 0 ? reasons.join(' ') : null,
        pageCount: read.analysis.pageCount,
        method: read.profile.values
          ? (Object.values(read.profile.values)[0]?.provenance.method ?? null)
          : null,
        identity: identity.resolution === 'AMBIGUOUS' ? 'AMBIGUOUS' : identity.resolution,
        matchedStudentProfileId:
          identity.resolution === 'ID_NUMBER' || identity.resolution === 'EMAIL'
            ? identity.studentProfileId
            : null,
        matchScore: eligibility.outcome === 'NOT_ELIGIBLE' ? null : match.matchScore,
        eligibilityOutcome: eligibility.outcome,
        matchReasons: match.criteria as unknown as Prisma.InputJsonValue,
        documentsFound,
        documentsRequired: required.length,
        processedAt: new Date(),
      },
    });
  });
}

/**
 * Flag duplicates, once every file in the batch has been read.
 *
 * A single ordered pass, so the outcome does not depend on which files
 * happened to be processed together: the first copy of an applicant stays
 * clean and later ones are flagged against it, which is what a reviewer
 * expects to see. Nothing is deleted or merged — the flag is a question put to
 * a person, because merging two applicants who are not the same person puts
 * one student's marks and another's income on one record in front of somebody
 * deciding who to fund.
 */
async function detectDuplicates(batchId: string, fundingProgrammeId: string) {
  const files = await prisma.applicationImportFile.findMany({
    where: { batchId, status: { in: ['READY', 'NEEDS_REVIEW'] } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      fields: { select: { canonicalKey: true, value: true, correctedValue: true } },
    },
  });

  // What the programme already holds, so re-importing a batch does not double
  // a funder's applicant count.
  const existing = await prisma.application.findMany({
    where: { fundingProgrammeId },
    select: {
      id: true,
      externalApplicant: {
        select: { idNumber: true, email: true, fullName: true, dateOfBirth: true, mobile: true },
      },
      studentProfile: {
        select: {
          dateOfBirth: true,
          user: { select: { email: true, firstName: true, lastName: true, mobile: true } },
        },
      },
    },
  });

  const held = existing.map((application) => ({
    id: application.id,
    signals: application.externalApplicant
      ? {
          idNumber: application.externalApplicant.idNumber,
          email: application.externalApplicant.email,
          fullName: application.externalApplicant.fullName,
          dateOfBirth:
            application.externalApplicant.dateOfBirth?.toISOString().slice(0, 10) ?? null,
          mobile: application.externalApplicant.mobile,
        }
      : {
          idNumber: null,
          email: application.studentProfile?.user.email ?? null,
          fullName: application.studentProfile
            ? `${application.studentProfile.user.firstName} ${application.studentProfile.user.lastName}`
            : null,
          dateOfBirth: application.studentProfile?.dateOfBirth?.toISOString().slice(0, 10) ?? null,
          mobile: application.studentProfile?.user.mobile ?? null,
        },
  }));

  const seen: { id: string; signals: IdentitySignals }[] = [];

  for (const file of files) {
    const signals = signalsFromFields(file.fields);

    let flagged: { fileId?: string; applicationId?: string; reason: string } | null = null;

    for (const earlier of seen) {
      const verdict = compareApplicants(signals, earlier.signals);
      if (verdict.duplicate) {
        flagged = { fileId: earlier.id, reason: `Another file in this batch: ${verdict.reason}` };
        break;
      }
    }

    if (!flagged) {
      for (const application of held) {
        const verdict = compareApplicants(signals, application.signals);
        if (verdict.duplicate) {
          flagged = {
            applicationId: application.id,
            reason: `An application already held for this programme: ${verdict.reason}`,
          };
          break;
        }
      }
    }

    if (flagged) {
      await prisma.applicationImportFile.update({
        where: { id: file.id },
        data: {
          status: 'DUPLICATE',
          duplicateOfFileId: flagged.fileId ?? null,
          duplicateOfApplicationId: flagged.applicationId ?? null,
          duplicateReason: flagged.reason,
        },
      });
      continue;
    }

    seen.push({ id: file.id, signals });
  }
}

function signalsFromFields(
  fields: { canonicalKey: string; value: string; correctedValue?: string | null }[],
): IdentitySignals {
  // A reviewer's correction is the better identifier, where one was made.
  const map = new Map(
    fields.map((field) => [field.canonicalKey, field.correctedValue ?? field.value]),
  );
  const first = map.get('firstName');
  const last = map.get('lastName');
  return {
    idNumber: map.get('idNumber') ?? null,
    email: map.get('email') ?? null,
    fullName: first && last ? `${first} ${last}` : (map.get('fullName') ?? null),
    dateOfBirth: map.get('dateOfBirth') ?? null,
    mobile: map.get('mobile') ?? null,
  };
}

/**
 * Work through a batch's pending files.
 *
 * Safe to call again: it picks up whatever is still PENDING, so a reviewer who
 * closed the tab, or a process that died halfway, loses nothing. The counters
 * on the batch are recomputed from the files themselves rather than
 * incremented, so they cannot drift away from the truth.
 */
export async function processBatch(batchId: string) {
  const batch = await prisma.applicationImportBatch.findUnique({
    where: { id: batchId },
    select: { id: true, fundingProgrammeId: true, organisationId: true, status: true },
  });
  if (!batch) return { ok: false as const, reason: 'That import was not found.' };

  const [programme, catalogue] = await Promise.all([
    loadProgramme(batch.fundingProgrammeId),
    catalogueIndex(),
  ]);

  await prisma.applicationImportBatch.update({
    where: { id: batchId },
    data: { status: 'EXTRACTING' },
  });

  for (;;) {
    const pending = await prisma.applicationImportFile.findMany({
      where: { batchId, status: 'PENDING' },
      select: { id: true },
      take: CONCURRENCY,
    });
    if (pending.length === 0) break;

    await Promise.all(
      pending.map(async (file) => {
        try {
          await processFile(file.id, programme, catalogue, batch.organisationId);
        } catch (error) {
          // One unreadable file must never take the batch down with it.
          console.error('[import] file failed', file.id, error);
          await prisma.applicationImportFile.update({
            where: { id: file.id },
            data: {
              status: 'FAILED',
              failureReason: 'This file could not be processed. Try it again on its own.',
              processedAt: new Date(),
            },
          });
        }
      }),
    );

    await refreshCounts(batchId);
  }

  // Every file has now been read, so duplicates can be decided deterministically.
  await detectDuplicates(batchId, batch.fundingProgrammeId);

  await refreshCounts(batchId);
  await prisma.applicationImportBatch.update({
    where: { id: batchId },
    data: { status: 'READY_FOR_REVIEW' },
  });

  return { ok: true as const };
}

/** Counters, recomputed from the files rather than tracked alongside them. */
export async function refreshCounts(batchId: string) {
  const grouped = await prisma.applicationImportFile.groupBy({
    by: ['status'],
    where: { batchId },
    _count: { _all: true },
  });

  const count = (status: string) => grouped.find((row) => row.status === status)?._count._all ?? 0;

  const processed =
    count('READY') +
    count('NEEDS_REVIEW') +
    count('FAILED') +
    count('DUPLICATE') +
    count('IMPORTED') +
    count('DISCARDED');

  await prisma.applicationImportBatch.update({
    where: { id: batchId },
    data: {
      processedFiles: processed,
      readyCount: count('READY'),
      reviewCount: count('NEEDS_REVIEW'),
      failedCount: count('FAILED'),
      duplicateCount: count('DUPLICATE'),
      importedCount: count('IMPORTED'),
    },
  });
}

// ---------------------------------------------------------------------------
// Reading a batch
// ---------------------------------------------------------------------------

export async function getBatch(batchId: string, organisationId: string) {
  return prisma.applicationImportBatch.findFirst({
    // organisationId in the WHERE is the access check: one organisation can
    // never read another's uploaded applications.
    where: { id: batchId, organisationId },
    include: {
      fundingProgramme: { select: { id: true, name: true } },
      createdBy: { select: { firstName: true, lastName: true } },
    },
  });
}

export type ReviewFilter = 'ALL' | 'READY' | 'NEEDS_REVIEW' | 'DUPLICATE' | 'FAILED';

export async function batchFiles(
  batchId: string,
  organisationId: string,
  filter: ReviewFilter = 'ALL',
) {
  const batch = await prisma.applicationImportBatch.findFirst({
    where: { id: batchId, organisationId },
    select: { id: true },
  });
  if (!batch) return [];

  return prisma.applicationImportFile.findMany({
    where: {
      batchId,
      ...(filter === 'ALL' ? {} : { status: filter }),
    },
    orderBy: [{ status: 'asc' }, { fileName: 'asc' }],
    include: {
      fields: { orderBy: { canonicalKey: 'asc' } },
      duplicateOfFile: { select: { id: true, fileName: true } },
    },
  });
}

/** Batch history for the organisation (§21). */
export async function listBatches(organisationId: string) {
  return prisma.applicationImportBatch.findMany({
    where: { organisationId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      fundingProgramme: { select: { id: true, name: true } },
      createdBy: { select: { firstName: true, lastName: true } },
    },
  });
}

// ---------------------------------------------------------------------------
// Confirming the import
// ---------------------------------------------------------------------------

/** A reviewer's decision about one file, before anything is created. */
export type FileDecision = {
  fileId: string;
  action: 'IMPORT' | 'DISCARD';
};

/**
 * Turn reviewed files into applications.
 *
 * Only now does anything become an applicant record. Each file is created
 * inside its own transaction, so one bad row cannot roll back seven hundred
 * good ones, and each is marked IMPORTED with the application it produced so
 * confirming twice cannot create the same applicant twice.
 *
 * Where the extractor identified an existing Bursary-Bridge student, the
 * application is attached to that profile. Where it did not, an external
 * applicant is created. A duplicate the reviewer chose to import anyway is
 * imported: they looked at it and decided, which is exactly the authority this
 * step is meant to defer to.
 */
export async function confirmImport(
  batchId: string,
  organisationId: string,
  userId: string,
  decisions: FileDecision[],
) {
  const batch = await prisma.applicationImportBatch.findFirst({
    where: { id: batchId, organisationId },
    select: { id: true, fundingProgrammeId: true, organisationId: true },
  });
  if (!batch) return { ok: false as const, reason: 'That import was not found.' };

  await prisma.applicationImportBatch.update({
    where: { id: batchId },
    data: { status: 'IMPORTING' },
  });

  const decided = new Map(decisions.map((decision) => [decision.fileId, decision.action]));
  const files = await prisma.applicationImportFile.findMany({
    where: { batchId, status: { in: ['READY', 'NEEDS_REVIEW', 'DUPLICATE'] } },
    include: { fields: true },
  });

  const catalogue = await catalogueIndex();
  let imported = 0;
  let discarded = 0;
  const problems: { fileName: string; reason: string }[] = [];

  for (const file of files) {
    const action = decided.get(file.id) ?? (file.status === 'READY' ? 'IMPORT' : 'DISCARD');

    if (action === 'DISCARD') {
      await prisma.applicationImportFile.update({
        where: { id: file.id },
        data: { status: 'DISCARDED' },
      });
      discarded += 1;
      continue;
    }

    try {
      const applicationId = await createApplicationFrom(file, batch, catalogue);
      await prisma.applicationImportFile.update({
        where: { id: file.id },
        data: { status: 'IMPORTED', applicationId },
      });
      imported += 1;
    } catch (error) {
      console.error('[import] could not create application', file.id, error);
      problems.push({
        fileName: file.fileName,
        reason: 'This application could not be created. It has been left for review.',
      });
    }
  }

  await refreshCounts(batchId);
  await prisma.applicationImportBatch.update({
    where: { id: batchId },
    data: { status: 'COMPLETED', completedAt: new Date() },
  });

  await audit({
    userId,
    action: 'import.batch_confirmed',
    entityType: 'ApplicationImportBatch',
    entityId: batchId,
    metadata: { imported, discarded, problems: problems.length },
  });

  return { ok: true as const, imported, discarded, problems };
}

type FileWithFields = Prisma.ApplicationImportFileGetPayload<{ include: { fields: true } }>;

async function createApplicationFrom(
  file: FileWithFields,
  batch: { id: string; fundingProgrammeId: string; organisationId: string },
  catalogue: CatalogueIndex,
): Promise<string> {
  // Rebuild the applicant from the stored fields, preferring a reviewer's
  // correction over the extracted value wherever one was made.
  const values: Record<
    string,
    { value: string; raw: string; confidence: 'HIGH' | 'MEDIUM' | 'LOW'; kind: string }
  > = {};
  for (const field of file.fields) {
    if (field.canonicalKey.startsWith('supportingDocument:')) continue;
    values[field.canonicalKey] = {
      value: field.correctedValue ?? field.value,
      raw: field.raw,
      confidence: field.confidence,
      kind: field.kind,
    };
  }

  const applicant = projectApplicant(
    {
      values: Object.fromEntries(
        Object.entries(values).map(([key, entry]) => [
          key,
          {
            key: key as never,
            kind: entry.kind as never,
            value: entry.value,
            raw: entry.raw,
            confidence: entry.confidence,
            provenance: {
              documentName: file.fileName,
              page: null,
              fieldLabel: '',
              method: 'acroform' as const,
            },
          },
        ]),
      ) as never,
      unmapped: [],
    },
    catalogue,
  );

  return prisma.$transaction(async (tx) => {
    let studentProfileId: string | null = file.matchedStudentProfileId;
    let externalApplicantId: string | null = null;

    if (studentProfileId) {
      // A student can only hold one application per programme. If they already
      // applied here themselves, the imported copy attaches as an external
      // applicant instead of colliding with their own submission.
      const existing = await tx.application.findFirst({
        where: { studentProfileId, fundingProgrammeId: batch.fundingProgrammeId },
        select: { id: true },
      });
      if (existing) studentProfileId = null;
    }

    if (!studentProfileId) {
      const created = await tx.externalApplicant.create({
        data: {
          organisationId: batch.organisationId,
          fullName: applicant.fullName || file.fileName.replace(/\.pdf$/i, ''),
          firstName: applicant.firstName,
          lastName: applicant.lastName,
          email: applicant.email,
          mobile: applicant.mobile,
          idNumber: applicant.idNumber,
          dateOfBirth: applicant.dateOfBirth,
          citizenship: applicant.citizenship,
          province: applicant.province,
          city: applicant.city,
          institutionName: applicant.institutionName,
          institutionId: applicant.institutionId,
          programmeName: applicant.programmeName,
          programmeId: applicant.programmeId,
          qualificationLevel: applicant.qualificationLevel,
          yearOfStudy: applicant.yearOfStudy,
          academicAverage: applicant.academicAverage,
          householdIncome: applicant.householdIncome,
        },
        select: { id: true },
      });
      externalApplicantId = created.id;
    }

    const application = await tx.application.create({
      data: {
        studentProfileId,
        externalApplicantId,
        fundingProgrammeId: batch.fundingProgrammeId,
        organisationId: batch.organisationId,
        source: 'EXTERNAL',
        // Imported applications enter the pipeline as submitted work awaiting
        // a reviewer, which is what they are — not drafts, and not reviewed.
        status: 'SUBMITTED',
        submittedAt: file.createdAt,
        lastStatusChangeAt: new Date(),
        matchScore: file.matchScore,
        matchReasons: file.matchReasons ?? undefined,
        eligibilityOutcome: file.eligibilityOutcome,
      },
      select: { id: true },
    });

    return application.id;
  });
}
