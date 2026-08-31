import 'server-only';
import { prisma } from '@/lib/db';
import { calculateProfileStrength } from '@/services/profile-strength';

/**
 * Recompute and persist the student's profile strength.
 *
 * Called after every profile mutation so the dashboard, the improvement
 * prompts and the stored value can never disagree.
 */
export async function refreshProfileStrength(studentProfileId: string): Promise<number> {
  const profile = await prisma.studentProfile.findUnique({
    where: { id: studentProfileId },
    select: {
      educationStage: true,
      qualificationLevel: true,
      studyStatus: true,
      academicAverage: true,
      academicAverageUnknown: true,
      resultTypes: true,
      achievements: true,
      fundingNeeds: true,
      fundingSituation: true,
      householdIncome: true,
      citizenship: true,
      dateOfBirth: true,
      province: true,
      city: true,
      careerInterests: true,
      studyPreferences: { select: { id: true } },
      _count: { select: { documents: true } },
    },
  });
  if (!profile) return 0;

  const strength = calculateProfileStrength({
    ...profile,
    documentCount: profile._count.documents,
  });

  await prisma.studentProfile.update({
    where: { id: studentProfileId },
    data: { profileStrength: strength },
  });

  return strength;
}

/**
 * Advance the stored onboarding cursor, but never backwards — a student who
 * returns to edit step 2 should not lose their place at step 5.
 */
export async function advanceOnboarding(
  studentProfileId: string,
  completedStep: string,
  nextStep: string | null,
  stepOrder: readonly string[],
): Promise<void> {
  const profile = await prisma.studentProfile.findUnique({
    where: { id: studentProfileId },
    select: { onboardingStep: true, onboardingCompletedAt: true },
  });
  if (!profile) return;

  if (profile.onboardingCompletedAt) return;

  const currentIndex = stepOrder.indexOf(profile.onboardingStep);
  const nextIndex = nextStep ? stepOrder.indexOf(nextStep) : stepOrder.length;

  if (nextIndex > currentIndex) {
    await prisma.studentProfile.update({
      where: { id: studentProfileId },
      data: { onboardingStep: nextStep ?? completedStep },
    });
  }
}
