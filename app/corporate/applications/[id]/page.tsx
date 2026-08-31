import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageBody } from '@/components/layout/app-shell';
import { ApplicantProfile } from '@/components/corporate/applicant-profile';
import { requireCorporate } from '@/lib/auth/guards';
import { getApplicantDetail, getApplicantNeighbours } from '@/services/applicants';

export const metadata: Metadata = { title: 'Applicant' };

export default async function ApplicantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { organisationId } = await requireCorporate();

  // Returns null for an application belonging to another organisation.
  const result = await getApplicantDetail(organisationId, id);
  if (!result) notFound();

  const { application, eligibility } = result;
  const neighbours = await getApplicantNeighbours(
    organisationId,
    application.id,
    application.fundingProgrammeId,
  );

  return (
    <PageBody>
      <ApplicantProfile
        application={{
          id: application.id,
          status: application.status,
          matchScore: application.matchScore,
          matchClassification: application.matchClassification,
          submittedAt: application.submittedAt?.toISOString() ?? null,
          reviewNotes: application.reviewNotes,
          answers: (application.answers as Record<string, string | string[]> | null) ?? {},
          programmeName: application.fundingProgramme.name,
          questions: application.fundingProgramme.questions.map((question) => ({
            id: question.id,
            label: question.label,
          })),
          requiredDocuments: application.fundingProgramme.eligibility?.requiredDocuments ?? [],
        }}
        student={{
          firstName: application.studentProfile.user.firstName,
          lastName: application.studentProfile.user.lastName,
          email: application.studentProfile.user.email,
          mobile: application.studentProfile.user.mobile,
          province: application.studentProfile.province,
          city: application.studentProfile.city,
          institution: application.studentProfile.currentInstitution?.name ?? null,
          programme: application.studentProfile.currentProgramme?.name ?? null,
          qualificationLevel: application.studentProfile.qualificationLevel,
          yearOfStudy: application.studentProfile.yearOfStudy,
          academicAverage: application.studentProfile.academicAverage,
          achievements: application.studentProfile.achievements,
          householdIncome: application.studentProfile.householdIncome,
          citizenship: application.studentProfile.citizenship,
          firstGeneration: application.studentProfile.firstGeneration,
          fundingNeeds: application.studentProfile.fundingNeeds,
          fundingSituation: application.studentProfile.fundingSituation,
          studyPreferences: application.studentProfile.studyPreferences.map((preference) => ({
            preferenceNumber: preference.preferenceNumber,
            programme: preference.programme.name,
            institution: preference.institution.name,
          })),
        }}
        documents={application.documents.map((link) => ({
          id: link.documentId,
          type: link.document.type,
          fileName: link.document.fileName,
          url: `/api/documents/file/${encodeURIComponent(link.document.storageKey)}`,
        }))}
        eligibility={eligibility}
        neighbours={neighbours}
      />
    </PageBody>
  );
}
