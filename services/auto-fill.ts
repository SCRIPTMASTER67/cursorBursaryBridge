import 'server-only';
import JSZip from 'jszip';
import type { AutoFillConfidence, AutoFillFieldStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { storage } from '@/lib/storage';
import { audit } from '@/services/audit';
import { fillTarget } from '@/lib/pdf/fill';
import type { MappedField, MappingStatus } from '@/lib/pdf/map';
import { runPipeline } from '@/lib/pdf/pipeline';

/**
 * The auto-fill workflow.
 *
 * Every function here takes the student profile that owns the job and scopes
 * its query by it. There is no unscoped read: a student can only ever reach
 * their own uploads, and an id belonging to someone else is indistinguishable
 * from one that does not exist.
 *
 * Filled PDFs are never stored. They are produced on demand from the original
 * upload and the field values as they stand, so a value the student edited and
 * the file they download can never disagree.
 */

export const MAX_TARGET_FORMS = 15;

// --- creating a job ----------------------------------------------------

export async function createJob(input: {
  studentProfileId: string;
  userId: string;
  fileName: string;
  bytes: Buffer;
}) {
  const stored = await storage().put({
    prefix: `auto-fill/${input.studentProfileId}/source`,
    fileName: input.fileName,
    contentType: 'application/pdf',
    body: input.bytes,
  });

  const job = await prisma.autoFillJob.create({
    data: {
      studentProfileId: input.studentProfileId,
      sourceFileName: input.fileName.slice(0, 200),
      sourceStorageKey: stored.key,
      sourceSizeBytes: stored.sizeBytes,
    },
    select: { id: true, status: true, sourceFileName: true, createdAt: true },
  });

  await audit({
    userId: input.userId,
    action: 'autofill.job.created',
    entityType: 'AutoFillJob',
    entityId: job.id,
  });

  return job;
}

export async function addTargetForms(input: {
  jobId: string;
  studentProfileId: string;
  files: { fileName: string; bytes: Buffer }[];
}) {
  const job = await prisma.autoFillJob.findFirst({
    where: { id: input.jobId, studentProfileId: input.studentProfileId },
    select: { id: true, status: true, _count: { select: { targetForms: true } } },
  });
  if (!job) return { ok: false as const, reason: 'NOT_FOUND' as const };
  if (job.status === 'PROCESSING') {
    return { ok: false as const, reason: 'BUSY' as const };
  }
  if (job._count.targetForms + input.files.length > MAX_TARGET_FORMS) {
    return { ok: false as const, reason: 'TOO_MANY' as const };
  }

  const created = [];
  for (const file of input.files) {
    const stored = await storage().put({
      prefix: `auto-fill/${input.studentProfileId}/targets`,
      fileName: file.fileName,
      contentType: 'application/pdf',
      body: file.bytes,
    });
    created.push(
      await prisma.autoFillTargetForm.create({
        data: {
          jobId: job.id,
          originalFileName: file.fileName.slice(0, 200),
          originalStorageKey: stored.key,
          sizeBytes: stored.sizeBytes,
        },
        select: { id: true, originalFileName: true, sizeBytes: true, status: true },
      }),
    );
  }

  return { ok: true as const, targetForms: created };
}

// --- processing --------------------------------------------------------

const STATUS: Record<MappingStatus, AutoFillFieldStatus> = {
  FILLED: 'FILLED',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  MISSING: 'MISSING',
  AMBIGUOUS: 'AMBIGUOUS',
  SIGNATURE: 'SIGNATURE',
  MANUAL: 'MANUAL',
};

/**
 * Run the engine over a job and record what it decided.
 *
 * A target form that cannot be processed is marked FAILED with its reason and
 * the rest of the batch carries on: a student who uploaded eight forms should
 * get the seven that worked.
 */
export async function processJob(input: {
  jobId: string;
  studentProfileId: string;
  userId: string;
}) {
  const job = await prisma.autoFillJob.findFirst({
    where: { id: input.jobId, studentProfileId: input.studentProfileId },
    select: {
      id: true,
      status: true,
      sourceFileName: true,
      sourceStorageKey: true,
      targetForms: {
        select: { id: true, originalFileName: true, originalStorageKey: true },
        orderBy: { originalFileName: 'asc' },
      },
    },
  });
  if (!job) return { ok: false as const, reason: 'NOT_FOUND' as const };
  if (job.status === 'PROCESSING') return { ok: false as const, reason: 'BUSY' as const };
  if (job.targetForms.length === 0) return { ok: false as const, reason: 'NO_TARGETS' as const };

  const source = await storage().get(job.sourceStorageKey);
  if (!source) return { ok: false as const, reason: 'SOURCE_MISSING' as const };

  await prisma.$transaction([
    prisma.autoFillJob.update({
      where: { id: job.id },
      data: { status: 'PROCESSING', startedAt: new Date(), failureReason: null },
    }),
    prisma.autoFillTargetForm.updateMany({
      where: { jobId: job.id },
      data: { status: 'PROCESSING', failureReason: null },
    }),
  ]);

  // Load every target up front so a missing object is reported as that form's
  // own failure rather than bringing the run down.
  const loaded: { id: string; documentName: string; bytes: Uint8Array }[] = [];
  const unreadable: { id: string; reason: string }[] = [];
  for (const target of job.targetForms) {
    const object = await storage().get(target.originalStorageKey);
    if (!object) {
      unreadable.push({ id: target.id, reason: 'This upload is no longer available.' });
      continue;
    }
    loaded.push({
      id: target.id,
      documentName: target.originalFileName,
      bytes: new Uint8Array(object.body),
    });
  }

  const result = await runPipeline(
    { documentName: job.sourceFileName, bytes: new Uint8Array(source.body) },
    loaded,
  );

  if (!result.ok) {
    await prisma.$transaction([
      prisma.autoFillJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          failureReason: result.reason,
          sourcePageCount: result.sourceAnalysis?.pageCount ?? null,
          completedAt: new Date(),
        },
      }),
      prisma.autoFillTargetForm.updateMany({
        where: { jobId: job.id },
        data: {
          status: 'FAILED',
          failureReason: 'Your completed form could not be read, so this form was not attempted.',
        },
      }),
    ]);
    await audit({
      userId: input.userId,
      action: 'autofill.job.failed',
      entityType: 'AutoFillJob',
      entityId: job.id,
      metadata: { reason: result.reason },
    });
    return { ok: true as const, jobStatus: 'FAILED' as const, reason: result.reason };
  }

  // Replace any previous run's output before writing this one.
  await prisma.$transaction([
    prisma.autoFillExtractedValue.deleteMany({ where: { jobId: job.id } }),
    prisma.autoFillField.deleteMany({ where: { targetForm: { jobId: job.id } } }),
  ]);

  await prisma.autoFillExtractedValue.createMany({
    data: Object.values(result.profile.values)
      .filter((value): value is NonNullable<typeof value> => Boolean(value))
      .map((value) => ({
        jobId: job.id,
        canonicalKey: value.key,
        kind: value.kind,
        value: value.value,
        raw: value.raw,
        confidence: value.confidence as AutoFillConfidence,
        sourcePage: value.provenance.page,
        sourceFieldLabel: value.provenance.fieldLabel,
        method: value.provenance.method,
      })),
  });

  for (const outcome of result.results) {
    if (!outcome.ok) {
      await prisma.autoFillTargetForm.update({
        where: { id: outcome.id },
        data: {
          status: 'FAILED',
          failureReason: outcome.reason,
          pageCount: outcome.analysis?.pageCount ?? null,
          processedAt: new Date(),
        },
      });
      continue;
    }

    await prisma.autoFillTargetForm.update({
      where: { id: outcome.id },
      data: {
        status: 'COMPLETED',
        failureReason: null,
        pageCount: outcome.analysis.pageCount,
        fieldsTotal: outcome.summary.total,
        fieldsFilled: outcome.summary.filled,
        fieldsOutstanding: outcome.summary.outstanding,
        processedAt: new Date(),
        fields: { create: outcome.fields.map((field) => toFieldRow(field)) },
      },
    });
  }

  for (const failure of unreadable) {
    await prisma.autoFillTargetForm.update({
      where: { id: failure.id },
      data: { status: 'FAILED', failureReason: failure.reason, processedAt: new Date() },
    });
  }

  await prisma.autoFillJob.update({
    where: { id: job.id },
    data: {
      status: 'COMPLETED',
      matcher: result.matcher,
      sourcePageCount: result.sourceAnalysis.pageCount,
      completedAt: new Date(),
    },
  });

  await audit({
    userId: input.userId,
    action: 'autofill.job.processed',
    entityType: 'AutoFillJob',
    entityId: job.id,
    metadata: {
      matcher: result.matcher,
      targets: result.overall.targetsTotal,
      failed: result.overall.targetsFailed,
      fieldsFilled: result.overall.fieldsFilled,
      fieldsTotal: result.overall.fieldsTotal,
    },
  });

  return { ok: true as const, jobStatus: 'COMPLETED' as const, overall: result.overall };
}

function toFieldRow(field: MappedField): Prisma.AutoFillFieldCreateWithoutTargetFormInput {
  return {
    fieldName: field.targetFieldName,
    label: field.targetLabel,
    kind: field.kind,
    page: field.page,
    status: STATUS[field.status],
    value: field.value,
    canonicalKey: field.canonicalKey,
    confidence: (field.confidence as AutoFillConfidence | null) ?? null,
    reason: field.reason,
    options: field.options ?? [],
    sourceDocumentName: field.provenance?.documentName ?? null,
    sourcePage: field.provenance?.page ?? null,
    sourceFieldLabel: field.provenance?.fieldLabel ?? null,
    rectX: field.rect?.x ?? null,
    rectY: field.rect?.y ?? null,
    rectWidth: field.rect?.width ?? null,
    rectHeight: field.rect?.height ?? null,
  };
}

// --- reading -----------------------------------------------------------

/** Everything the results and review screens need, scoped to the owner. */
export async function getJob(jobId: string, studentProfileId: string) {
  return prisma.autoFillJob.findFirst({
    where: { id: jobId, studentProfileId },
    select: {
      id: true,
      status: true,
      sourceFileName: true,
      sourcePageCount: true,
      failureReason: true,
      matcher: true,
      createdAt: true,
      startedAt: true,
      completedAt: true,
      extractedValues: {
        select: {
          canonicalKey: true,
          value: true,
          raw: true,
          confidence: true,
          sourcePage: true,
          sourceFieldLabel: true,
          method: true,
        },
        orderBy: { canonicalKey: 'asc' },
      },
      targetForms: {
        orderBy: { originalFileName: 'asc' },
        select: {
          id: true,
          status: true,
          originalFileName: true,
          pageCount: true,
          failureReason: true,
          fieldsTotal: true,
          fieldsFilled: true,
          fieldsOutstanding: true,
          processedAt: true,
        },
      },
    },
  });
}

/** A single target form with its fields, for the review screen. */
export async function getTargetForm(targetFormId: string, studentProfileId: string) {
  return prisma.autoFillTargetForm.findFirst({
    where: { id: targetFormId, job: { studentProfileId } },
    select: {
      id: true,
      status: true,
      originalFileName: true,
      pageCount: true,
      failureReason: true,
      fieldsTotal: true,
      fieldsFilled: true,
      fieldsOutstanding: true,
      job: { select: { id: true, sourceFileName: true, status: true } },
      fields: {
        orderBy: [{ page: 'asc' }, { label: 'asc' }],
        select: {
          id: true,
          fieldName: true,
          label: true,
          kind: true,
          page: true,
          status: true,
          value: true,
          canonicalKey: true,
          confidence: true,
          reason: true,
          options: true,
          sourceDocumentName: true,
          sourcePage: true,
          sourceFieldLabel: true,
          rectX: true,
          rectY: true,
          rectWidth: true,
          rectHeight: true,
          editedByStudent: true,
          _count: { select: { edits: true } },
        },
      },
    },
  });
}

export async function listJobs(studentProfileId: string) {
  return prisma.autoFillJob.findMany({
    where: { studentProfileId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      status: true,
      sourceFileName: true,
      createdAt: true,
      completedAt: true,
      _count: { select: { targetForms: true } },
    },
  });
}

// --- editing -----------------------------------------------------------

/**
 * Change one field's value.
 *
 * The student always has the final say: a value they type is accepted as
 * written and marked as theirs, and clearing a field is a valid edit. Every
 * change is kept so a submitted form can be explained afterwards.
 */
export async function editField(input: {
  fieldId: string;
  studentProfileId: string;
  userId: string;
  value: string | null;
}) {
  const field = await prisma.autoFillField.findFirst({
    where: { id: input.fieldId, targetForm: { job: { studentProfileId: input.studentProfileId } } },
    select: {
      id: true,
      value: true,
      status: true,
      kind: true,
      options: true,
      targetFormId: true,
    },
  });
  if (!field) return { ok: false as const, reason: 'NOT_FOUND' as const };

  const next = input.value === null || input.value.trim() === '' ? null : input.value.trim();

  // A choice field can only hold a choice this form actually offers.
  if (next !== null && field.options.length > 0 && !field.options.includes(next)) {
    return { ok: false as const, reason: 'INVALID_OPTION' as const, options: field.options };
  }

  const status: AutoFillFieldStatus = next === null ? 'MISSING' : 'FILLED';
  const reason = next === null ? 'You cleared this field.' : 'You entered this value yourself.';

  const updated = await prisma.$transaction(async (tx) => {
    await tx.autoFillFieldEdit.create({
      data: { fieldId: field.id, previousValue: field.value, newValue: next },
    });
    const row = await tx.autoFillField.update({
      where: { id: field.id },
      data: { value: next, status, reason, editedByStudent: true, confidence: null },
      select: { id: true, value: true, status: true, reason: true, editedByStudent: true },
    });
    await recountForm(tx, field.targetFormId);
    return row;
  });

  await audit({
    userId: input.userId,
    action: 'autofill.field.edited',
    entityType: 'AutoFillField',
    entityId: field.id,
    // The value itself is not recorded: an audit row is not a place to copy a
    // student's ID number to.
    metadata: { hadValue: field.value !== null, hasValue: next !== null },
  });

  return { ok: true as const, field: updated };
}

async function recountForm(tx: Prisma.TransactionClient, targetFormId: string) {
  const counts = await tx.autoFillField.groupBy({
    by: ['status'],
    where: { targetFormId },
    _count: { _all: true },
  });
  const by = (status: AutoFillFieldStatus) =>
    counts.find((c) => c.status === status)?._count._all ?? 0;
  const total = counts.reduce((n, c) => n + c._count._all, 0);
  const filled = by('FILLED');
  await tx.autoFillTargetForm.update({
    where: { id: targetFormId },
    data: { fieldsTotal: total, fieldsFilled: filled, fieldsOutstanding: total - filled },
  });
}

// --- downloading -------------------------------------------------------

/**
 * Produce the filled PDF for one target form.
 *
 * Built fresh from the original upload every time, so it always reflects the
 * current values — including anything the student changed a moment ago.
 */
export async function renderFilledForm(targetFormId: string, studentProfileId: string) {
  const form = await prisma.autoFillTargetForm.findFirst({
    where: { id: targetFormId, job: { studentProfileId } },
    select: {
      id: true,
      status: true,
      originalFileName: true,
      originalStorageKey: true,
      fields: {
        select: {
          fieldName: true,
          label: true,
          kind: true,
          page: true,
          status: true,
          value: true,
          canonicalKey: true,
          confidence: true,
          reason: true,
          options: true,
          rectX: true,
          rectY: true,
          rectWidth: true,
          rectHeight: true,
        },
      },
    },
  });
  if (!form) return { ok: false as const, reason: 'NOT_FOUND' as const };
  if (form.status !== 'COMPLETED') return { ok: false as const, reason: 'NOT_READY' as const };

  const original = await storage().get(form.originalStorageKey);
  if (!original) return { ok: false as const, reason: 'SOURCE_MISSING' as const };

  const mapped: MappedField[] = form.fields.map((field) => ({
    targetFieldName: field.fieldName,
    targetLabel: field.label,
    kind: field.kind as MappedField['kind'],
    page: field.page,
    rect:
      field.rectX !== null &&
      field.rectY !== null &&
      field.rectWidth !== null &&
      field.rectHeight !== null
        ? { x: field.rectX, y: field.rectY, width: field.rectWidth, height: field.rectHeight }
        : null,
    options: field.options.length > 0 ? field.options : undefined,
    status: field.status as MappedField['status'],
    value: field.value,
    canonicalKey: field.canonicalKey as MappedField['canonicalKey'],
    confidence: field.confidence as MappedField['confidence'],
    reason: field.reason,
    provenance: null,
  }));

  const filled = await fillTarget(new Uint8Array(original.body), mapped);
  return {
    ok: true as const,
    bytes: filled.bytes,
    fileName: downloadName(form.originalFileName),
  };
}

/** All of a job's completed forms in one archive. Forms that failed are left out. */
export async function renderJobArchive(jobId: string, studentProfileId: string) {
  const job = await prisma.autoFillJob.findFirst({
    where: { id: jobId, studentProfileId },
    select: {
      id: true,
      targetForms: {
        where: { status: 'COMPLETED' },
        select: { id: true },
        orderBy: { originalFileName: 'asc' },
      },
    },
  });
  if (!job) return { ok: false as const, reason: 'NOT_FOUND' as const };
  if (job.targetForms.length === 0) return { ok: false as const, reason: 'NOTHING_READY' as const };

  const zip = new JSZip();
  const failures: string[] = [];
  for (const form of job.targetForms) {
    const rendered = await renderFilledForm(form.id, studentProfileId);
    if (!rendered.ok) {
      failures.push(form.id);
      continue;
    }
    zip.file(rendered.fileName, rendered.bytes);
  }
  if (failures.length === job.targetForms.length) {
    return { ok: false as const, reason: 'NOTHING_READY' as const };
  }

  const bytes = await zip.generateAsync({ type: 'uint8array' });
  return { ok: true as const, bytes, fileName: 'bursary-forms.zip' };
}

/** "sizani.pdf" becomes "sizani-filled.pdf", with anything awkward removed. */
function downloadName(original: string): string {
  const safe =
    original
      .replace(/[^A-Za-z0-9._ -]/g, '')
      .replace(/\s+/g, ' ')
      .trim() || 'form.pdf';
  return safe.toLowerCase().endsWith('.pdf')
    ? `${safe.slice(0, -4)}-filled.pdf`
    : `${safe}-filled.pdf`;
}
