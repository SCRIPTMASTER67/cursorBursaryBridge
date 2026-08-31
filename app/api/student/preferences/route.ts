import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { apiError, apiOk, apiStudent, zodFields } from '@/lib/auth/api';
import { MAX_STUDY_PREFERENCES, studyPreferencesSchema } from '@/lib/validation/student';
import { advanceOnboarding, refreshProfileStrength } from '@/services/student-profile';
import { studentSteps } from '@/lib/onboarding-steps';
import { audit } from '@/services/audit';

/** A student's own study preferences, ordered by preference number. */
export async function GET() {
  const auth = await apiStudent();
  if (!auth.ok) return auth.response;

  const preferences = await prisma.studyPreference.findMany({
    where: { studentProfileId: auth.studentProfileId },
    include: {
      programme: { select: { id: true, name: true } },
      institution: { select: { id: true, name: true, shortName: true } },
    },
    orderBy: { preferenceNumber: 'asc' },
  });

  return apiOk({ preferences, max: MAX_STUDY_PREFERENCES });
}

/**
 * Replace the whole preference list in one transaction.
 *
 * Rewriting the set (rather than patching individual rows) keeps
 * preferenceNumber contiguous after a removal or reorder, which the unique
 * constraint on [studentProfileId, preferenceNumber] depends on.
 */
export async function PUT(request: NextRequest) {
  const auth = await apiStudent();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body) return apiError('Invalid request.');

  const parsed = studyPreferencesSchema.safeParse(body);
  if (!parsed.success) {
    const fields = zodFields(parsed.error);
    return apiError(fields.preferences ?? 'Please check your study preferences.', 422, fields);
  }

  const { preferences } = parsed.data;

  // The six-preference cap is a business rule, so it is enforced here rather
  // than trusted from the browser.
  if (preferences.length > MAX_STUDY_PREFERENCES) {
    return apiError(`You can add up to ${MAX_STUDY_PREFERENCES} study preferences.`, 422);
  }

  // Every id must exist in the standardised catalogue.
  const [programmeCount, institutionCount] = await Promise.all([
    prisma.programme.count({ where: { id: { in: preferences.map((p) => p.programmeId) } } }),
    prisma.institution.count({ where: { id: { in: preferences.map((p) => p.institutionId) } } }),
  ]);
  const uniqueProgrammes = new Set(preferences.map((p) => p.programmeId)).size;
  const uniqueInstitutions = new Set(preferences.map((p) => p.institutionId)).size;
  if (programmeCount !== uniqueProgrammes || institutionCount !== uniqueInstitutions) {
    return apiError('One of the selected courses or institutions is no longer available.', 422);
  }

  await prisma.$transaction([
    prisma.studyPreference.deleteMany({ where: { studentProfileId: auth.studentProfileId } }),
    prisma.studyPreference.createMany({
      data: preferences.map((preference, index) => ({
        studentProfileId: auth.studentProfileId,
        preferenceNumber: index + 1,
        programmeId: preference.programmeId,
        institutionId: preference.institutionId,
      })),
    }),
  ]);

  const stepOrder = studentSteps.map((step) => step.key);
  await advanceOnboarding(auth.studentProfileId, 'preferences', 'academic', stepOrder);
  const profileStrength = await refreshProfileStrength(auth.studentProfileId);

  await audit({
    userId: auth.user.id,
    action: 'student.preferences_updated',
    entityType: 'StudentProfile',
    entityId: auth.studentProfileId,
    metadata: { count: preferences.length },
  });

  return apiOk({ ok: true, profileStrength, redirectTo: '/onboarding/student/academic' });
}
