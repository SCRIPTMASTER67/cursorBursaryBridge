import 'server-only';
import type {
  CareerInterest,
  InstitutionType,
  Prisma,
  Province,
  QualificationLevel,
} from '@prisma/client';
import { prisma } from '@/lib/db';
import { canonicalise, isUsableName, tidyName } from '@/lib/catalogue';

/**
 * The catalogue every other part of the application reads from.
 *
 * Study preferences, funder eligibility, corporate programme creation and
 * matching all resolve through here, so there is exactly one row per real
 * institution and per real course. Nothing keeps its own list.
 *
 * Entries are retired, never deleted. A student's chosen institution and a
 * funder's eligibility rule both point at these rows; removing one would break
 * records that describe something that really happened.
 */

export type CatalogueResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string; existingId?: string };

// --- institutions -----------------------------------------------------------

export type InstitutionInput = {
  name: string;
  shortName?: string | null;
  type: InstitutionType;
  province: Province;
  city: string;
  website?: string | null;
  code?: string | null;
};

export async function createInstitution(input: InstitutionInput) {
  const name = tidyName(input.name);
  if (!isUsableName(name)) {
    return { ok: false as const, reason: 'Enter the institution’s full name.' };
  }

  const canonicalName = canonicalise(name);
  const clash = await prisma.institution.findUnique({
    where: { canonicalName },
    select: { id: true, name: true, status: true },
  });
  if (clash) {
    // The same institution under a different spelling. Point at the existing
    // row rather than creating a second one nobody can tell apart.
    return {
      ok: false as const,
      reason:
        clash.status === 'INACTIVE'
          ? `“${clash.name}” already exists but is inactive. Reactivate it instead of adding a duplicate.`
          : `“${clash.name}” is already in the catalogue.`,
      existingId: clash.id,
    };
  }

  const created = await prisma.institution.create({
    data: {
      name,
      canonicalName,
      shortName: input.shortName?.trim() || null,
      type: input.type,
      province: input.province,
      city: tidyName(input.city),
      website: input.website?.trim() || null,
      code: input.code?.trim() || null,
    },
    select: { id: true, name: true },
  });
  return { ok: true as const, value: created };
}

export async function updateInstitution(id: string, input: Partial<InstitutionInput>) {
  const data: Prisma.InstitutionUpdateInput = {};

  if (input.name !== undefined) {
    const name = tidyName(input.name);
    if (!isUsableName(name))
      return { ok: false as const, reason: 'Enter the institution’s full name.' };
    const canonicalName = canonicalise(name);
    const clash = await prisma.institution.findFirst({
      where: { canonicalName, id: { not: id } },
      select: { id: true, name: true },
    });
    if (clash) {
      return {
        ok: false as const,
        reason: `“${clash.name}” already uses that name.`,
        existingId: clash.id,
      };
    }
    data.name = name;
    data.canonicalName = canonicalName;
  }
  if (input.shortName !== undefined) data.shortName = input.shortName?.trim() || null;
  if (input.type !== undefined) data.type = input.type;
  if (input.province !== undefined) data.province = input.province;
  if (input.city !== undefined) data.city = tidyName(input.city);
  if (input.website !== undefined) data.website = input.website?.trim() || null;
  if (input.code !== undefined) data.code = input.code?.trim() || null;

  const updated = await prisma.institution.update({
    where: { id },
    data,
    select: { id: true, name: true },
  });
  return { ok: true as const, value: updated };
}

/**
 * Retire or restore an institution.
 *
 * Deactivating is not deleting: existing study preferences, eligibility rules
 * and applications keep working. It only stops the institution being offered
 * for new choices.
 */
export async function setInstitutionStatus(id: string, status: 'ACTIVE' | 'INACTIVE') {
  const institution = await prisma.institution.update({
    where: { id },
    data: { status },
    select: {
      id: true,
      name: true,
      status: true,
      _count: {
        select: { studyPreferences: true, currentStudents: true, supportedInProgram: true },
      },
    },
  });
  return { ok: true as const, value: institution };
}

// --- courses ----------------------------------------------------------------

export type ProgrammeInput = {
  name: string;
  field: CareerInterest;
  qualificationLevels: QualificationLevel[];
  code?: string | null;
  /** Institutions that actually offer it. */
  institutionIds?: string[];
};

export async function createProgramme(input: ProgrammeInput) {
  const name = tidyName(input.name);
  if (!isUsableName(name)) return { ok: false as const, reason: 'Enter the course name.' };
  if (input.qualificationLevels.length === 0) {
    return { ok: false as const, reason: 'Choose at least one qualification level.' };
  }

  const canonicalName = canonicalise(name);
  const clash = await prisma.programme.findUnique({
    where: { canonicalName },
    select: { id: true, name: true, status: true },
  });
  if (clash) {
    return {
      ok: false as const,
      reason:
        clash.status === 'INACTIVE'
          ? `“${clash.name}” already exists but is inactive. Reactivate it instead of adding a duplicate.`
          : `“${clash.name}” is already in the catalogue.`,
      existingId: clash.id,
    };
  }

  const created = await prisma.programme.create({
    data: {
      name,
      canonicalName,
      field: input.field,
      qualificationLevels: input.qualificationLevels,
      code: input.code?.trim() || null,
      offeredAt: {
        create: (input.institutionIds ?? []).map((institutionId) => ({ institutionId })),
      },
    },
    select: { id: true, name: true },
  });
  return { ok: true as const, value: created };
}

export async function updateProgramme(id: string, input: Partial<ProgrammeInput>) {
  const data: Prisma.ProgrammeUpdateInput = {};

  if (input.name !== undefined) {
    const name = tidyName(input.name);
    if (!isUsableName(name)) return { ok: false as const, reason: 'Enter the course name.' };
    const canonicalName = canonicalise(name);
    const clash = await prisma.programme.findFirst({
      where: { canonicalName, id: { not: id } },
      select: { id: true, name: true },
    });
    if (clash) {
      return {
        ok: false as const,
        reason: `“${clash.name}” already uses that name.`,
        existingId: clash.id,
      };
    }
    data.name = name;
    data.canonicalName = canonicalName;
  }
  if (input.field !== undefined) data.field = input.field;
  if (input.qualificationLevels !== undefined) {
    if (input.qualificationLevels.length === 0) {
      return { ok: false as const, reason: 'Choose at least one qualification level.' };
    }
    data.qualificationLevels = input.qualificationLevels;
  }
  if (input.code !== undefined) data.code = input.code?.trim() || null;

  await prisma.programme.update({ where: { id }, data });

  // Where a course is offered is replaced wholesale when it is supplied, so
  // removing an institution from the list actually removes the link.
  if (input.institutionIds) {
    await prisma.$transaction([
      prisma.programmeInstitution.deleteMany({ where: { programmeId: id } }),
      prisma.programmeInstitution.createMany({
        data: input.institutionIds.map((institutionId) => ({ programmeId: id, institutionId })),
        skipDuplicates: true,
      }),
    ]);
  }

  const updated = await prisma.programme.findUniqueOrThrow({
    where: { id },
    select: { id: true, name: true },
  });
  return { ok: true as const, value: updated };
}

export async function setProgrammeStatus(id: string, status: 'ACTIVE' | 'INACTIVE') {
  const programme = await prisma.programme.update({
    where: { id },
    data: { status },
    select: {
      id: true,
      name: true,
      status: true,
      _count: {
        select: { studyPreferences: true, currentStudents: true, supportedInProgram: true },
      },
    },
  });
  return { ok: true as const, value: programme };
}

// --- reading ----------------------------------------------------------------

export type CatalogueFilters = {
  search?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'ALL';
  type?: InstitutionType;
  province?: Province;
  field?: CareerInterest;
  institutionId?: string;
  page?: number;
  pageSize?: number;
};

function statusWhere(status: CatalogueFilters['status']) {
  return status && status !== 'ALL' ? { status } : {};
}

export async function listInstitutions(filters: CatalogueFilters = {}) {
  const pageSize = filters.pageSize ?? 25;
  const page = Math.max(1, filters.page ?? 1);

  const where: Prisma.InstitutionWhereInput = {
    ...statusWhere(filters.status),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.province ? { province: filters.province } : {}),
    ...(filters.search?.trim()
      ? {
          OR: [
            { name: { contains: filters.search.trim(), mode: 'insensitive' } },
            { shortName: { contains: filters.search.trim(), mode: 'insensitive' } },
            { city: { contains: filters.search.trim(), mode: 'insensitive' } },
            { code: { contains: filters.search.trim(), mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.institution.findMany({
      where,
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        shortName: true,
        type: true,
        province: true,
        city: true,
        website: true,
        code: true,
        status: true,
        updatedAt: true,
        _count: {
          select: {
            studyPreferences: true,
            currentStudents: true,
            offeredProgrammes: true,
            supportedInProgram: true,
          },
        },
      },
    }),
    prisma.institution.count({ where }),
  ]);

  return { rows, total, page, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function listProgrammes(filters: CatalogueFilters = {}) {
  const pageSize = filters.pageSize ?? 25;
  const page = Math.max(1, filters.page ?? 1);

  const where: Prisma.ProgrammeWhereInput = {
    ...statusWhere(filters.status),
    ...(filters.field ? { field: filters.field } : {}),
    ...(filters.institutionId
      ? { offeredAt: { some: { institutionId: filters.institutionId } } }
      : {}),
    ...(filters.search?.trim()
      ? {
          OR: [
            { name: { contains: filters.search.trim(), mode: 'insensitive' } },
            { code: { contains: filters.search.trim(), mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.programme.findMany({
      where,
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        field: true,
        qualificationLevels: true,
        code: true,
        status: true,
        updatedAt: true,
        offeredAt: {
          select: { institution: { select: { id: true, name: true, shortName: true } } },
          orderBy: { institution: { name: 'asc' } },
        },
        _count: {
          select: { studyPreferences: true, currentStudents: true, supportedInProgram: true },
        },
      },
    }),
    prisma.programme.count({ where }),
  ]);

  return { rows, total, page, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

/**
 * The options students and funders choose from.
 *
 * Only active entries: a retired institution stays attached to the records
 * that already reference it, but is not offered for anything new.
 */
export async function activeInstitutionOptions() {
  return prisma.institution.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, shortName: true, province: true, type: true },
  });
}

export async function activeProgrammeOptions() {
  return prisma.programme.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, field: true, qualificationLevels: true },
  });
}

/**
 * Courses offered at one institution.
 *
 * Used to narrow a study preference to pairs that actually exist. When no
 * links have been recorded for an institution yet, every active course is
 * returned: an incomplete catalogue must not stop a student choosing.
 */
export async function programmesAtInstitution(institutionId: string) {
  const linked = await prisma.programmeInstitution.findMany({
    where: { institutionId, programme: { status: 'ACTIVE' } },
    select: {
      programme: { select: { id: true, name: true, field: true, qualificationLevels: true } },
    },
    orderBy: { programme: { name: 'asc' } },
  });
  if (linked.length > 0) return linked.map((row) => row.programme);
  return activeProgrammeOptions();
}
