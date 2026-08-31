import 'server-only';
import { prisma } from '@/lib/db';
import {
  achievementLabels,
  bursaryStatusLabels,
  careerInterestLabels,
  citizenshipLabels,
  educationStageLabels,
  fundingNeedLabels,
  fundingSituationLabels,
  incomeBandLabels,
  provinceLabels,
  qualificationLabels,
  resultTypeLabels,
  studyLocationLabels,
  studyStatusLabels,
  triStateLabels,
} from '@/lib/labels';
import { formatDate } from '@/lib/utils';

export type SummarySection = {
  key: string;
  title: string;
  editHref: string;
  rows: { label: string; value: string }[];
};

/**
 * Builds the review/summary view of a student profile.
 *
 * Used by both the onboarding review step and the profile page, so the two can
 * never show different wording for the same stored value.
 */
export async function buildStudentSummary(studentProfileId: string): Promise<SummarySection[]> {
  const profile = await prisma.studentProfile.findUnique({
    where: { id: studentProfileId },
    include: {
      user: { select: { firstName: true, lastName: true, email: true, mobile: true } },
      currentInstitution: { select: { name: true } },
      currentProgramme: { select: { name: true } },
      studyPreferences: {
        include: {
          programme: { select: { name: true } },
          institution: { select: { name: true } },
        },
        orderBy: { preferenceNumber: 'asc' },
      },
    },
  });

  if (!profile) return [];

  const dash = '—';
  const list = (values: string[]) => (values.length ? values.join(', ') : dash);

  const sections: SummarySection[] = [
    {
      key: 'personal',
      title: 'Personal',
      editHref: '/student/settings',
      rows: [
        { label: 'Name', value: `${profile.user.firstName} ${profile.user.lastName}` },
        { label: 'Email', value: profile.user.email },
        { label: 'Mobile', value: profile.user.mobile ?? dash },
      ],
    },
    {
      key: 'education',
      title: 'Education',
      editHref: '/onboarding/student/education',
      rows: [
        {
          label: 'Education stage',
          value: profile.educationStage ? educationStageLabels[profile.educationStage] : dash,
        },
        {
          label: 'Qualification level',
          value: profile.qualificationLevel ? qualificationLabels[profile.qualificationLevel] : dash,
        },
        {
          label: 'Study status',
          value: profile.studyStatus ? studyStatusLabels[profile.studyStatus] : dash,
        },
        ...(profile.currentInstitution
          ? [{ label: 'Current institution', value: profile.currentInstitution.name }]
          : []),
        ...(profile.currentProgramme
          ? [{ label: 'Current programme', value: profile.currentProgramme.name }]
          : []),
        ...(profile.yearOfStudy ? [{ label: 'Year of study', value: `Year ${profile.yearOfStudy}` }] : []),
      ],
    },
    {
      key: 'preferences',
      title: 'Study Preferences',
      editHref: '/onboarding/student/preferences',
      rows:
        profile.studyPreferences.length > 0
          ? profile.studyPreferences.map((preference) => ({
              label: `Preference ${preference.preferenceNumber}`,
              value: `${preference.programme.name} · ${preference.institution.name}`,
            }))
          : [{ label: 'Preferences', value: 'No preferences added yet' }],
    },
    {
      key: 'academic',
      title: 'Academic',
      editHref: '/onboarding/student/academic',
      rows: [
        {
          label: 'Latest average',
          value: profile.academicAverage !== null ? `${profile.academicAverage}%` : 'Not provided',
        },
        { label: 'Results available', value: list(profile.resultTypes.map((r) => resultTypeLabels[r])) },
        { label: 'Achievements', value: list(profile.achievements.map((a) => achievementLabels[a])) },
      ],
    },
    {
      key: 'funding',
      title: 'Funding Needs',
      editHref: '/onboarding/student/funding',
      rows: [
        { label: 'Needs funding for', value: list(profile.fundingNeeds.map((n) => fundingNeedLabels[n])) },
        {
          label: 'Current situation',
          value: profile.fundingSituation ? fundingSituationLabels[profile.fundingSituation] : dash,
        },
      ],
    },
    {
      key: 'financial',
      title: 'Financial',
      editHref: '/onboarding/student/financial',
      rows: [
        {
          label: 'Household income',
          value: profile.householdIncome ? incomeBandLabels[profile.householdIncome] : dash,
        },
        {
          label: 'Receiving a bursary',
          value: profile.bursaryStatus ? bursaryStatusLabels[profile.bursaryStatus] : dash,
        },
      ],
    },
    {
      key: 'eligibility',
      title: 'Eligibility',
      editHref: '/onboarding/student/financial',
      rows: [
        { label: 'Date of birth', value: profile.dateOfBirth ? formatDate(profile.dateOfBirth) : dash },
        { label: 'Citizenship', value: profile.citizenship ? citizenshipLabels[profile.citizenship] : dash },
        {
          label: 'First-generation student',
          value: profile.firstGeneration ? triStateLabels[profile.firstGeneration] : dash,
        },
        { label: 'Disability', value: profile.disability ? triStateLabels[profile.disability] : dash },
      ],
    },
    {
      key: 'location',
      title: 'Location & Interests',
      editHref: '/onboarding/student/location',
      rows: [
        {
          label: 'Location',
          value:
            profile.province && profile.city
              ? `${profile.city}, ${provinceLabels[profile.province]}`
              : dash,
        },
        {
          label: 'Study location',
          value: profile.studyLocationPreference
            ? studyLocationLabels[profile.studyLocationPreference]
            : dash,
        },
        {
          label: 'Career interests',
          value: list(profile.careerInterests.map((c) => careerInterestLabels[c])),
        },
      ],
    },
  ];

  return sections;
}
