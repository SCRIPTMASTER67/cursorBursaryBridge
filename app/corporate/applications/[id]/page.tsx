import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageBody } from '@/components/layout/app-shell';
import { ApplicantProfile } from '@/components/corporate/applicant-profile';
import { requireCorporate } from '@/lib/auth/guards';
import { getApplicantDetail, getApplicantNeighbours } from '@/services/applicants';
import { requestsForApplication } from '@/services/information-requests';
import { applicantView } from '@/lib/applicant-view';

export const metadata: Metadata = { title: 'Applicant' };

export default async function ApplicantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { organisationId } = await requireCorporate();

  // Returns null for an application belonging to another organisation.
  const result = await getApplicantDetail(organisationId, id);
  if (!result) notFound();

  const { application, eligibility } = result;
  // One shape whether this applicant has an account here or was imported.
  const person = applicantView(application);
  const [neighbours, informationRequests] = await Promise.all([
    getApplicantNeighbours(organisationId, application.id, application.fundingProgrammeId),
    requestsForApplication(application.id),
  ]);

  return (
    <PageBody>
      <ApplicantProfile
        informationRequests={informationRequests.map((request) => ({
          id: request.id,
          message: request.message,
          deadline: request.deadline?.toISOString() ?? null,
          status: request.status,
          createdAt: request.createdAt.toISOString(),
          items: request.items.map((item) => ({
            id: item.id,
            label: item.label,
            document: item.document
              ? { fileName: item.document.fileName, storageKey: item.document.storageKey }
              : null,
          })),
        }))}
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
          firstName: person.firstName,
          lastName: person.lastName,
          email: person.email ?? '',
          mobile: person.mobile,
          province: person.province,
          city: person.city,
          institution: person.institution,
          programme: person.programme,
          qualificationLevel: person.qualificationLevel,
          yearOfStudy: person.yearOfStudy,
          academicAverage: person.academicAverage,
          achievements: person.achievements,
          householdIncome: person.householdIncome,
          citizenship: person.citizenship,
          firstGeneration: person.firstGeneration,
          fundingNeeds: person.fundingNeeds,
          fundingSituation: person.fundingSituation,
          studyPreferences: person.studyPreferences,
          external: person.external,
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
