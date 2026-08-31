import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { apiError, apiOk, apiStudent, zodFields } from '@/lib/auth/api';
import {
  academicSchema,
  educationSchema,
  financialSchema,
  fundingSchema,
  locationSchema,
} from '@/lib/validation/student';
import { studentSteps, type StudentStepKey } from '@/lib/onboarding-steps';
import { advanceOnboarding, refreshProfileStrength } from '@/services/student-profile';
import { audit } from '@/services/audit';

const stepOrder = studentSteps.map((step) => step.key);

/**
 * A single endpoint for every onboarding step.
 *
 * Each step names itself in the payload; the matching Zod schema is the
 * authority on what that step may write, so the client cannot set a field
 * belonging to another step.
 */
export async function POST(request: NextRequest) {
  const auth = await apiStudent();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as { step?: string; data?: unknown } | null;
  if (!body?.step || !body.data) return apiError('Invalid request.');

  const step = body.step as StudentStepKey;
  const { studentProfileId } = auth;

  switch (step) {
    case 'education': {
      const parsed = educationSchema.safeParse(body.data);
      if (!parsed.success) return apiError('Please check the highlighted fields.', 422, zodFields(parsed.error));
      const d = parsed.data;
      const isSchoolLearner = d.educationStage === 'GRADE_10' || d.educationStage === 'GRADE_11';
      const isEnrolled = d.studyStatus === 'CURRENTLY_ENROLLED';

      await prisma.studentProfile.update({
        where: { id: studentProfileId },
        data: {
          educationStage: d.educationStage,
          qualificationLevel: isSchoolLearner ? null : (d.qualificationLevel ?? null),
          studyStatus: d.studyStatus,
          currentInstitutionId: isEnrolled ? (d.currentInstitutionId ?? null) : null,
          currentProgrammeId: isEnrolled ? (d.currentProgrammeId ?? null) : null,
          yearOfStudy: isEnrolled ? (d.yearOfStudy ?? null) : null,
        },
      });
      break;
    }

    case 'academic': {
      const parsed = academicSchema.safeParse(body.data);
      if (!parsed.success) return apiError('Please check the highlighted fields.', 422, zodFields(parsed.error));
      const d = parsed.data;
      await prisma.studentProfile.update({
        where: { id: studentProfileId },
        data: {
          academicAverage: d.academicAverageUnknown ? null : (d.academicAverage ?? null),
          academicAverageUnknown: d.academicAverageUnknown,
          resultTypes: d.resultTypes,
          achievements: d.achievements,
        },
      });
      break;
    }

    case 'funding': {
      const parsed = fundingSchema.safeParse(body.data);
      if (!parsed.success) return apiError('Please check the highlighted fields.', 422, zodFields(parsed.error));
      await prisma.studentProfile.update({
        where: { id: studentProfileId },
        data: { fundingNeeds: parsed.data.fundingNeeds, fundingSituation: parsed.data.fundingSituation },
      });
      break;
    }

    case 'financial': {
      const parsed = financialSchema.safeParse(body.data);
      if (!parsed.success) return apiError('Please check the highlighted fields.', 422, zodFields(parsed.error));
      const d = parsed.data;
      await prisma.studentProfile.update({
        where: { id: studentProfileId },
        data: {
          householdIncome: d.householdIncome,
          bursaryStatus: d.bursaryStatus,
          dateOfBirth: d.dateOfBirth ? new Date(d.dateOfBirth) : null,
          citizenship: d.citizenship ?? null,
          firstGeneration: d.firstGeneration ?? null,
          disability: d.disability ?? null,
          orphanVulnerable: d.orphanVulnerable ?? null,
        },
      });
      break;
    }

    case 'location': {
      const parsed = locationSchema.safeParse(body.data);
      if (!parsed.success) return apiError('Please check the highlighted fields.', 422, zodFields(parsed.error));
      const d = parsed.data;
      await prisma.studentProfile.update({
        where: { id: studentProfileId },
        data: {
          province: d.province,
          city: d.city,
          studyLocationPreference: d.studyLocationPreference,
          careerInterests: d.careerInterests,
        },
      });
      break;
    }

    case 'review': {
      // Finishing the review marks onboarding complete and unlocks the app.
      const profile = await prisma.studentProfile.findUnique({
        where: { id: studentProfileId },
        select: { educationStage: true, studyPreferences: { select: { id: true } } },
      });
      if (!profile?.educationStage) {
        return apiError('Complete your education journey before finishing.', 422);
      }
      if (profile.studyPreferences.length === 0) {
        return apiError('Add at least one study preference before finishing.', 422);
      }
      await prisma.studentProfile.update({
        where: { id: studentProfileId },
        data: { onboardingCompletedAt: new Date(), onboardingStep: 'review' },
      });
      await refreshProfileStrength(studentProfileId);
      await audit({
        userId: auth.user.id,
        action: 'student.onboarding_completed',
        entityType: 'StudentProfile',
        entityId: studentProfileId,
      });
      return apiOk({ ok: true, redirectTo: '/student/dashboard' });
    }

    default:
      return apiError('Unknown onboarding step.');
  }

  const nextIndex = stepOrder.indexOf(step) + 1;
  const next = stepOrder[nextIndex] ?? null;
  await advanceOnboarding(studentProfileId, step, next, stepOrder);
  const profileStrength = await refreshProfileStrength(studentProfileId);

  return apiOk({
    ok: true,
    profileStrength,
    redirectTo: next ? `/onboarding/student/${next}` : '/student/dashboard',
  });
}
