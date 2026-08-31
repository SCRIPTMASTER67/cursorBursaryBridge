/** The ordered student onboarding journey (reference screens 3–9). */
export const studentSteps = [
  { key: 'education', label: 'Education Journey', href: '/onboarding/student/education' },
  { key: 'preferences', label: 'Study Preferences', href: '/onboarding/student/preferences' },
  { key: 'academic', label: 'Academic Profile', href: '/onboarding/student/academic' },
  { key: 'funding', label: 'Funding Needs', href: '/onboarding/student/funding' },
  { key: 'financial', label: 'Financial Profile', href: '/onboarding/student/financial' },
  { key: 'location', label: 'Location & Interests', href: '/onboarding/student/location' },
  { key: 'review', label: 'Review Profile', href: '/onboarding/student/review' },
] as const;

export type StudentStepKey = (typeof studentSteps)[number]['key'];

export function studentStepIndex(key: StudentStepKey): number {
  return studentSteps.findIndex((step) => step.key === key) + 1;
}

export function nextStudentStep(key: StudentStepKey): (typeof studentSteps)[number] | null {
  const index = studentSteps.findIndex((step) => step.key === key);
  return studentSteps[index + 1] ?? null;
}

export function previousStudentStep(key: StudentStepKey): (typeof studentSteps)[number] | null {
  const index = studentSteps.findIndex((step) => step.key === key);
  return index > 0 ? studentSteps[index - 1] : null;
}

/** The ordered corporate onboarding journey (reference screens 2–5 + review). */
export const corporateSteps = [
  { key: 'details', label: 'Organisation Details', href: '/onboarding/organisation/details' },
  { key: 'role', label: 'Your Role', href: '/onboarding/organisation/role' },
  { key: 'funding', label: 'Funding Programmes', href: '/onboarding/organisation/funding' },
  { key: 'process', label: 'Current Process', href: '/onboarding/organisation/process' },
  { key: 'review', label: 'Review', href: '/onboarding/organisation/review' },
] as const;

export type CorporateStepKey = (typeof corporateSteps)[number]['key'];

export function corporateStepIndex(key: CorporateStepKey): number {
  return corporateSteps.findIndex((step) => step.key === key) + 1;
}

export function nextCorporateStep(key: CorporateStepKey): (typeof corporateSteps)[number] | null {
  const index = corporateSteps.findIndex((step) => step.key === key);
  return corporateSteps[index + 1] ?? null;
}

export function previousCorporateStep(key: CorporateStepKey): (typeof corporateSteps)[number] | null {
  const index = corporateSteps.findIndex((step) => step.key === key);
  return index > 0 ? corporateSteps[index - 1] : null;
}
