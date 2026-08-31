import type { Metadata } from 'next';
import { requireCorporateOnboarding } from '@/lib/auth/corporate-onboarding';
import { buildOrganisationSummary } from '@/services/organisation-summary';
import { OrganisationReviewPanel } from './review-panel';

export const metadata: Metadata = { title: 'Review your organisation' };

export default async function OrganisationReviewPage() {
  const { organisationId, corporateProfileId } = await requireCorporateOnboarding();
  const sections = await buildOrganisationSummary(organisationId, corporateProfileId);
  return <OrganisationReviewPanel sections={sections} />;
}
