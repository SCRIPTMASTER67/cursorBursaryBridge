import 'server-only';
import type { ApplicationStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { EligibilityService, type EligibilityOutcome } from '@/lib/matching';
import { toMatchableProgramme, toMatchableStudent } from '@/lib/matching/adapters';

export type ApplicantFilters = {
  search?: string;
  programmeId?: string;
  status?: ApplicationStatus;
  eligibility?: EligibilityOutcome;
  institutionId?: string;
  courseId?: string;
  minMatchScore?: number;
  page?: number;
  pageSize?: number;
};

export type ApplicantRow = {
  id: string;
  studentName: string;
  studentEmail: string;
  institution: string | null;
  programme: string | null;
  qualification: string | null;
  academicAverage: number | null;
  matchScore: number | null;
  eligibilityOutcome: EligibilityOutcome | null;
  status: ApplicationStatus;
  submittedAt: Date | null;
  programmeName: string;
  shortlisted: boolean;
};

export const DEFAULT_PAGE_SIZE = 25;

/**
 * Applicants for one organisation, paged in PostgreSQL.
 *
 * The organisationId filter is not optional — it is the boundary that stops a
 * funder reading applications submitted to anyone else. Paging happens in the
 * database so a programme with thousands of applicants never loads whole.
 */
export async function getApplicants(
  organisationId: string,
  filters: ApplicantFilters = {},
): Promise<{ rows: ApplicantRow[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, filters.pageSize ?? DEFAULT_PAGE_SIZE);

  const where: Prisma.ApplicationWhereInput = {
    organisationId,
    status: filters.status ?? { not: 'DRAFT' },
  };

  if (filters.programmeId) where.fundingProgrammeId = filters.programmeId;
  if (typeof filters.minMatchScore === 'number') where.matchScore = { gte: filters.minMatchScore };

  if (filters.eligibility) where.eligibilityOutcome = filters.eligibility;

  const studentWhere: Prisma.StudentProfileWhereInput = {};
  if (filters.institutionId) studentWhere.currentInstitutionId = filters.institutionId;
  if (filters.courseId) studentWhere.currentProgrammeId = filters.courseId;
  if (filters.search) {
    studentWhere.user = {
      OR: [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ],
    };
  }
  if (Object.keys(studentWhere).length > 0) where.studentProfile = studentWhere;

  const [total, applications] = await Promise.all([
    prisma.application.count({ where }),
    prisma.application.findMany({
      where,
      include: {
        fundingProgramme: { select: { name: true } },
        shortlist: { select: { id: true } },
        studentProfile: {
          select: {
            academicAverage: true,
            qualificationLevel: true,
            user: { select: { firstName: true, lastName: true, email: true } },
            currentInstitution: { select: { name: true, shortName: true } },
            currentProgramme: { select: { name: true } },
          },
        },
      },
      orderBy: [{ matchScore: 'desc' }, { submittedAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const rows: ApplicantRow[] = applications.map((application) => ({
    id: application.id,
    studentName: `${application.studentProfile.user.firstName} ${application.studentProfile.user.lastName}`,
    studentEmail: application.studentProfile.user.email,
    institution:
      application.studentProfile.currentInstitution?.name ??
      application.studentProfile.currentInstitution?.shortName ??
      null,
    programme: application.studentProfile.currentProgramme?.name ?? null,
    qualification: application.studentProfile.qualificationLevel,
    academicAverage: application.studentProfile.academicAverage,
    matchScore: application.matchScore,
    eligibilityOutcome: application.eligibilityOutcome,
    status: application.status,
    submittedAt: application.submittedAt,
    programmeName: application.fundingProgramme.name,
    shortlisted: application.shortlist !== null,
  }));

  return { rows, total, page, pageSize };
}

/** Status tallies for the tab bar above the applicant table. */
export async function getApplicantCounts(organisationId: string, programmeId?: string) {
  const base: Prisma.ApplicationWhereInput = {
    organisationId,
    ...(programmeId ? { fundingProgrammeId: programmeId } : {}),
  };

  const grouped = await prisma.application.groupBy({
    by: ['status'],
    where: { ...base, status: { not: 'DRAFT' } },
    _count: { _all: true },
  });

  const byStatus = Object.fromEntries(grouped.map((row) => [row.status, row._count._all]));
  const total = grouped.reduce((sum, row) => sum + row._count._all, 0);

  const eligible = await prisma.application.count({
    where: { ...base, status: { not: 'DRAFT' }, eligibilityOutcome: 'ELIGIBLE' },
  });

  return {
    total,
    eligible,
    inReview: (byStatus.UNDER_REVIEW ?? 0) + (byStatus.DOCUMENTS_REQUIRED ?? 0),
    shortlisted: byStatus.SHORTLISTED ?? 0,
    selected: byStatus.APPROVED ?? 0,
    rejected: byStatus.UNSUCCESSFUL ?? 0,
    submitted: byStatus.SUBMITTED ?? 0,
  };
}

/**
 * One applicant, with eligibility recomputed live against the programme's
 * current rules — so a reviewer sees today's assessment, not a stale snapshot.
 */
export async function getApplicantDetail(organisationId: string, applicationId: string) {
  const application = await prisma.application.findFirst({
    // organisationId in the WHERE is the access check.
    where: { id: applicationId, organisationId },
    include: {
      fundingProgramme: {
        include: {
          eligibility: true,
          questions: { orderBy: { order: 'asc' } },
          supportedInstitutions: { select: { institutionId: true } },
          supportedProgrammes: { select: { programmeId: true } },
        },
      },
      shortlist: true,
      documents: { include: { document: true } },
      studentProfile: {
        include: {
          user: { select: { firstName: true, lastName: true, email: true, mobile: true } },
          currentInstitution: { select: { name: true } },
          currentProgramme: { select: { name: true } },
          studyPreferences: {
            include: {
              programme: { select: { id: true, name: true } },
              institution: { select: { id: true, name: true } },
            },
            orderBy: { preferenceNumber: 'asc' },
          },
        },
      },
    },
  });

  if (!application) return null;

  const eligibility = EligibilityService.evaluate(
    toMatchableStudent({
      ...application.studentProfile,
      studyPreferences: application.studentProfile.studyPreferences.map((p) => ({
        preferenceNumber: p.preferenceNumber,
        programmeId: p.programmeId,
        institutionId: p.institutionId,
      })),
    }),
    toMatchableProgramme({
      id: application.fundingProgramme.id,
      supportedProgrammes: application.fundingProgramme.supportedProgrammes,
      supportedInstitutions: application.fundingProgramme.supportedInstitutions,
      eligibility: application.fundingProgramme.eligibility,
    }),
  );

  return { application, eligibility };
}

/** Neighbouring applicants, powering the Previous / Next controls. */
export async function getApplicantNeighbours(
  organisationId: string,
  applicationId: string,
  fundingProgrammeId: string,
): Promise<{ previousId: string | null; nextId: string | null }> {
  const ids = await prisma.application.findMany({
    where: { organisationId, fundingProgrammeId, status: { not: 'DRAFT' } },
    select: { id: true },
    orderBy: [{ matchScore: 'desc' }, { submittedAt: 'desc' }],
  });

  const index = ids.findIndex((row) => row.id === applicationId);
  if (index === -1) return { previousId: null, nextId: null };

  return {
    previousId: index > 0 ? ids[index - 1].id : null,
    nextId: index < ids.length - 1 ? ids[index + 1].id : null,
  };
}
