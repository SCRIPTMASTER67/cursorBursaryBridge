import 'server-only';
import type { EducationStage, Prisma, ResultKind, SubjectLevel } from '@prisma/client';
import { prisma } from '@/lib/db';
import { canonicalise, isUsableName, tidyName } from '@/lib/catalogue';

/**
 * A student's subject and module results.
 *
 * These are not stored and forgotten: the matching engine reads them, so a
 * bursary that asks for Mathematics at 70% can be checked against the mark the
 * student actually has. That is why subjects resolve through a shared
 * catalogue — a requirement written against "Mathematics" has to find a result
 * recorded against the same row, not a different spelling of it.
 *
 * A student may still enter a subject that is not in the catalogue. It is
 * stored, marked custom, and never silently merged with an existing entry.
 */

/** What the student's education stage means for this screen. */
export function levelForStage(stage: EducationStage | null): SubjectLevel {
  switch (stage) {
    case 'GRADE_10':
    case 'GRADE_11':
    case 'MATRIC':
      return 'SCHOOL';
    case 'UNIVERSITY_FIRST_YEAR':
    case 'UNIVERSITY_CURRENT':
    case 'TVET_COLLEGE':
    case 'POSTGRADUATE':
      return 'TERTIARY';
    default:
      return 'SCHOOL';
  }
}

/** What to call the things on this screen, in the student's own context. */
export function vocabularyForStage(stage: EducationStage | null): {
  singular: string;
  plural: string;
  heading: string;
} {
  switch (stage) {
    case 'UNIVERSITY_FIRST_YEAR':
    case 'UNIVERSITY_CURRENT':
      return { singular: 'module', plural: 'modules', heading: 'My modules' };
    case 'POSTGRADUATE':
      return { singular: 'module', plural: 'modules and courses', heading: 'My modules' };
    case 'TVET_COLLEGE':
      return { singular: 'subject', plural: 'subjects and modules', heading: 'My subjects' };
    default:
      return { singular: 'subject', plural: 'subjects', heading: 'My high school results' };
  }
}

export type ResultInput = {
  /** An existing catalogue entry. */
  subjectId?: string;
  /** Or a name the student typed, which becomes a custom entry. */
  subjectName?: string;
  percentage?: number | null;
  grade?: string | null;
  year: number;
  term?: string | null;
  kind?: ResultKind;
  level: SubjectLevel;
};

export type ResultOutcome<T> = { ok: true; value: T } | { ok: false; reason: string };

/**
 * Find or create the subject a result is recorded against.
 *
 * An existing catalogue entry is reused whenever the canonical name matches,
 * so a student typing "maths" lands on the same row as one who picked
 * "Mathematics" from the list — which is what lets a funder's requirement find
 * either of them.
 */
async function resolveSubject(
  input: ResultInput,
): Promise<ResultOutcome<{ id: string; name: string }>> {
  if (input.subjectId) {
    const existing = await prisma.subjectCatalogue.findUnique({
      where: { id: input.subjectId },
      select: { id: true, name: true },
    });
    if (!existing) return { ok: false, reason: 'That subject is no longer available.' };
    return { ok: true, value: existing };
  }

  const name = tidyName(input.subjectName ?? '');
  if (!isUsableName(name)) return { ok: false, reason: 'Enter the subject name.' };

  const canonicalName = canonicalise(name);
  const existing = await prisma.subjectCatalogue.findUnique({
    where: { canonicalName },
    select: { id: true, name: true },
  });
  if (existing) return { ok: true, value: existing };

  const created = await prisma.subjectCatalogue.create({
    data: { name, canonicalName, level: input.level, custom: true },
    select: { id: true, name: true },
  });
  return { ok: true, value: created };
}

function validate(input: ResultInput): string | null {
  const year = Number(input.year);
  if (!Number.isInteger(year) || year < 1990 || year > new Date().getFullYear() + 6) {
    return 'Enter a valid year.';
  }
  if (input.percentage !== null && input.percentage !== undefined) {
    const value = Number(input.percentage);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      return 'A result must be between 0 and 100.';
    }
  }
  if (input.grade && input.grade.trim().length > 10) return 'Keep the grade short.';
  return null;
}

export async function addResult(studentProfileId: string, input: ResultInput) {
  const problem = validate(input);
  if (problem) return { ok: false as const, reason: problem };

  const subject = await resolveSubject(input);
  if (!subject.ok) return subject;

  const clash = await prisma.studentSubjectResult.findUnique({
    where: {
      studentProfileId_subjectId_year: {
        studentProfileId,
        subjectId: subject.value.id,
        year: Number(input.year),
      },
    },
    select: { id: true },
  });
  if (clash) {
    return {
      ok: false as const,
      reason: `You already have a ${subject.value.name} result for ${input.year}. Edit it instead of adding it twice.`,
    };
  }

  const last = await prisma.studentSubjectResult.findFirst({
    where: { studentProfileId },
    orderBy: { position: 'desc' },
    select: { position: true },
  });

  const created = await prisma.studentSubjectResult.create({
    data: {
      studentProfileId,
      subjectId: subject.value.id,
      percentage: input.percentage ?? null,
      grade: input.grade?.trim() || null,
      year: Number(input.year),
      term: input.term?.trim() || null,
      kind: input.kind ?? 'LATEST',
      level: input.level,
      position: (last?.position ?? -1) + 1,
    },
    select: { id: true },
  });

  return { ok: true as const, value: created };
}

export async function updateResult(
  studentProfileId: string,
  resultId: string,
  input: Partial<ResultInput> & { year: number; level: SubjectLevel },
) {
  const owned = await prisma.studentSubjectResult.findFirst({
    where: { id: resultId, studentProfileId },
    select: { id: true, subjectId: true },
  });
  if (!owned) return { ok: false as const, reason: 'That result was not found.' };

  const problem = validate(input as ResultInput);
  if (problem) return { ok: false as const, reason: problem };

  let subjectId = owned.subjectId;
  if (input.subjectId || input.subjectName) {
    const subject = await resolveSubject(input as ResultInput);
    if (!subject.ok) return subject;
    subjectId = subject.value.id;
  }

  const clash = await prisma.studentSubjectResult.findFirst({
    where: { studentProfileId, subjectId, year: Number(input.year), id: { not: resultId } },
    select: { id: true },
  });
  if (clash) {
    return { ok: false as const, reason: 'You already have a result for that subject and year.' };
  }

  const updated = await prisma.studentSubjectResult.update({
    where: { id: resultId },
    data: {
      subjectId,
      percentage: input.percentage ?? null,
      grade: input.grade?.trim() || null,
      year: Number(input.year),
      term: input.term?.trim() || null,
      kind: input.kind ?? 'LATEST',
      level: input.level,
    },
    select: { id: true },
  });
  return { ok: true as const, value: updated };
}

export async function deleteResult(studentProfileId: string, resultId: string) {
  const { count } = await prisma.studentSubjectResult.deleteMany({
    where: { id: resultId, studentProfileId },
  });
  return count > 0
    ? { ok: true as const, value: { id: resultId } }
    : { ok: false as const, reason: 'That result was not found.' };
}

/** Save the student's own ordering. */
export async function reorderResults(studentProfileId: string, orderedIds: string[]) {
  const owned = await prisma.studentSubjectResult.findMany({
    where: { studentProfileId },
    select: { id: true },
  });
  const ownedIds = new Set(owned.map((r) => r.id));
  if (orderedIds.some((id) => !ownedIds.has(id))) {
    return { ok: false as const, reason: 'That ordering refers to a result that is not yours.' };
  }

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.studentSubjectResult.update({ where: { id }, data: { position: index } }),
    ),
  );
  return { ok: true as const, value: { count: orderedIds.length } };
}

export async function listResults(studentProfileId: string) {
  return prisma.studentSubjectResult.findMany({
    where: { studentProfileId },
    orderBy: [{ position: 'asc' }, { year: 'desc' }],
    select: {
      id: true,
      percentage: true,
      grade: true,
      year: true,
      term: true,
      kind: true,
      level: true,
      position: true,
      subject: { select: { id: true, name: true, custom: true, level: true } },
    },
  });
}

/** The catalogue a student picks from, for their stage. */
export async function subjectOptions(level: SubjectLevel) {
  return prisma.subjectCatalogue.findMany({
    where: { status: 'ACTIVE', level },
    orderBy: [{ custom: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, custom: true },
  });
}

/**
 * Which bursaries in the directory name a subject the student has recorded.
 *
 * Shown on the results screen so entering a mark visibly does something,
 * rather than disappearing into a form nobody sees the effect of.
 */
export async function requirementsTouchingResults(studentProfileId: string) {
  const results = await prisma.studentSubjectResult.findMany({
    where: { studentProfileId },
    select: { subjectId: true },
  });
  if (results.length === 0) return [];

  return prisma.eligibilitySubjectRequirement.findMany({
    where: {
      subjectId: { in: results.map((r) => r.subjectId) },
      eligibilityRule: { fundingProgramme: { status: { in: ['PUBLISHED', 'CLOSED'] } } },
    },
    select: {
      minimumPercentage: true,
      subject: { select: { id: true, name: true } },
      eligibilityRule: {
        select: {
          fundingProgramme: {
            select: { id: true, slug: true, name: true, organisation: { select: { name: true } } },
          },
        },
      },
    },
    take: 50,
  });
}
