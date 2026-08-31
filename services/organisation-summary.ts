import 'server-only';
import { prisma } from '@/lib/db';
import {
  applicationVolumeLabels,
  corporateRoleLabels,
  industryLabels,
  offersFundingLabels,
  organisationSizeLabels,
  organisationTypeLabels,
  processChallengeLabels,
  processMethodLabels,
  programmeTypeOfferedLabels,
} from '@/lib/labels';
import type { SummarySection } from '@/services/student-summary';

/**
 * Review-screen summary of an organisation profile. Shared by the corporate
 * onboarding review step and the Organisation page.
 */
export async function buildOrganisationSummary(
  organisationId: string,
  corporateProfileId: string,
): Promise<SummarySection[]> {
  const [organisation, profile] = await Promise.all([
    prisma.organisation.findUnique({ where: { id: organisationId } }),
    prisma.corporateProfile.findUnique({
      where: { id: corporateProfileId },
      include: { user: { select: { firstName: true, lastName: true, email: true, mobile: true } } },
    }),
  ]);

  if (!organisation || !profile) return [];

  const dash = '—';
  const list = (values: string[]) => (values.length ? values.join(', ') : dash);

  return [
    {
      key: 'contact',
      title: 'Your details',
      editHref: '/corporate/settings',
      rows: [
        { label: 'Name', value: `${profile.user.firstName} ${profile.user.lastName}` },
        { label: 'Work email', value: profile.user.email },
        { label: 'Mobile', value: profile.user.mobile ?? dash },
      ],
    },
    {
      key: 'organisation',
      title: 'Organisation',
      editHref: '/onboarding/organisation/details',
      rows: [
        { label: 'Organisation name', value: organisation.name },
        { label: 'Type', value: organisationTypeLabels[organisation.type] },
        { label: 'Industry', value: industryLabels[organisation.industry] },
        { label: 'Website', value: organisation.website ?? dash },
        { label: 'Country', value: organisation.country },
      ],
    },
    {
      key: 'role',
      title: 'Your role',
      editHref: '/onboarding/organisation/role',
      rows: [
        { label: 'Role', value: profile.role ? corporateRoleLabels[profile.role] : dash },
        {
          label: 'Organisation size',
          value: profile.organisationSize ? organisationSizeLabels[profile.organisationSize] : dash,
        },
        { label: 'Department', value: profile.department ?? dash },
      ],
    },
    {
      key: 'funding',
      title: 'Funding programmes',
      editHref: '/onboarding/organisation/funding',
      rows: [
        {
          label: 'Currently offers funding',
          value: organisation.offersFunding ? offersFundingLabels[organisation.offersFunding] : dash,
        },
        {
          label: 'Programme types',
          value: list(organisation.programmeTypes.map((t) => programmeTypeOfferedLabels[t])),
        },
        {
          label: 'Annual applications',
          value: organisation.applicationVolume
            ? applicationVolumeLabels[organisation.applicationVolume]
            : dash,
        },
      ],
    },
    {
      key: 'process',
      title: 'Current process',
      editHref: '/onboarding/organisation/process',
      rows: [
        {
          label: 'Manages applications with',
          value: list(organisation.processMethods.map((m) => processMethodLabels[m])),
        },
        {
          label: 'Biggest challenges',
          value: list(organisation.challenges.map((c) => processChallengeLabels[c])),
        },
      ],
    },
  ];
}
