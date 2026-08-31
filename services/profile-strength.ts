import type { StudentProfile, StudyPreference } from '@prisma/client';

/**
 * Progressive profile completion.
 *
 * A student sees opportunities immediately; this model quantifies what is still
 * missing and what each remaining section is worth, which drives the
 * "Improve your matches" prompts on the dashboard and profile pages.
 */
export type StrengthSection = {
  key: string;
  label: string;
  weight: number;
  complete: boolean;
  href: string;
};

type ProfileForStrength = Pick<
  StudentProfile,
  | 'educationStage'
  | 'qualificationLevel'
  | 'studyStatus'
  | 'academicAverage'
  | 'academicAverageUnknown'
  | 'resultTypes'
  | 'achievements'
  | 'fundingNeeds'
  | 'fundingSituation'
  | 'householdIncome'
  | 'citizenship'
  | 'dateOfBirth'
  | 'province'
  | 'city'
  | 'careerInterests'
> & { studyPreferences: Pick<StudyPreference, 'id'>[]; documentCount?: number };

export function profileSections(profile: ProfileForStrength): StrengthSection[] {
  return [
    {
      key: 'education',
      label: 'Education journey',
      weight: 15,
      complete: Boolean(profile.educationStage && profile.studyStatus),
      href: '/student/profile#education',
    },
    {
      key: 'preferences',
      label: 'Study preferences',
      weight: 20,
      complete: profile.studyPreferences.length > 0,
      href: '/student/profile#preferences',
    },
    {
      key: 'academic',
      label: 'Academic results',
      weight: 15,
      complete: profile.academicAverage !== null || profile.resultTypes.length > 0,
      href: '/student/profile#academic',
    },
    {
      key: 'achievements',
      label: 'Achievements',
      weight: 5,
      complete: profile.achievements.length > 0,
      href: '/student/profile#academic',
    },
    {
      key: 'funding',
      label: 'Funding needs',
      weight: 15,
      complete: profile.fundingNeeds.length > 0 && profile.fundingSituation !== null,
      href: '/student/profile#funding',
    },
    {
      key: 'financial',
      label: 'Financial profile',
      weight: 15,
      complete: profile.householdIncome !== null,
      href: '/student/profile#financial',
    },
    {
      key: 'eligibility',
      label: 'Personal eligibility',
      weight: 5,
      complete: Boolean(profile.citizenship && profile.dateOfBirth),
      href: '/student/profile#eligibility',
    },
    {
      key: 'location',
      label: 'Location & interests',
      weight: 5,
      complete: Boolean(profile.province && profile.city) && profile.careerInterests.length > 0,
      href: '/student/profile#location',
    },
    {
      key: 'documents',
      label: 'Supporting documents',
      weight: 5,
      complete: (profile.documentCount ?? 0) > 0,
      href: '/student/documents',
    },
  ];
}

export function calculateProfileStrength(profile: ProfileForStrength): number {
  const sections = profileSections(profile);
  const earned = sections.filter((s) => s.complete).reduce((sum, s) => sum + s.weight, 0);
  const total = sections.reduce((sum, s) => sum + s.weight, 0);
  return Math.round((earned / total) * 100);
}

/** The highest-value incomplete sections, used for the improvement prompts. */
export function improvementPrompts(profile: ProfileForStrength, limit = 4): StrengthSection[] {
  return profileSections(profile)
    .filter((s) => !s.complete)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit);
}
