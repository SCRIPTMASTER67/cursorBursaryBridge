import type { Metadata } from 'next';
import Link from 'next/link';
import { PageBody, PageHeader } from '@/components/layout/app-shell';
import { SummarySections } from '@/components/student/summary-sections';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress';
import { Check, Sparkles } from '@/components/icons';
import { requireOnboardedStudent } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { buildStudentSummary } from '@/services/student-summary';
import { profileSections } from '@/services/profile-strength';

export const metadata: Metadata = { title: 'My Profile' };

/**
 * The student's profile.
 *
 * Progressive completion is front and centre: what is done, what is missing,
 * and exactly how much each remaining section is worth.
 */
export default async function StudentProfilePage() {
  const { studentProfileId } = await requireOnboardedStudent();

  const [profile, sections] = await Promise.all([
    prisma.studentProfile.findUniqueOrThrow({
      where: { id: studentProfileId },
      select: {
        profileStrength: true,
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
    }),
    buildStudentSummary(studentProfileId),
  ]);

  const strengthSections = profileSections({
    ...profile,
    documentCount: profile._count.documents,
  });
  const complete = strengthSections.filter((s) => s.complete);
  const incomplete = strengthSections.filter((s) => !s.complete);

  return (
    <PageBody>
      <PageHeader
        title="My Profile"
        description="Create it once, and every application reuses it. Keep it current for the most accurate matches."
        actions={
          <ButtonLink href="/onboarding/student/preferences" variant="outline">
            Edit study preferences
          </ButtonLink>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr] lg:items-start [&>*]:min-w-0">
        <SummarySections sections={sections} />

        <div className="space-y-5 lg:sticky lg:top-6">
          <Card className="p-5">
            <h2 className="text-[15px] font-semibold text-ink">Profile strength</h2>
            <ProgressBar
              value={profile.profileStrength}
              showLabel
              label="Complete"
              tone={profile.profileStrength >= 80 ? 'success' : 'brand'}
              className="mt-4"
            />

            {incomplete.length > 0 ? (
              <>
                <p className="mt-5 text-[13px] font-semibold text-ink">Improve your matches</p>
                <ul className="mt-2.5 space-y-1">
                  {incomplete.map((section) => (
                    <li key={section.key}>
                      <Link
                        href={section.href}
                        className="flex items-center justify-between gap-3 rounded-btn px-2.5 py-2 text-[13px] text-ink-600 transition-colors hover:bg-surface-subtle"
                      >
                        <span className="truncate">{section.label}</span>
                        <span className="shrink-0 font-semibold text-success-600">+{section.weight}%</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-4 flex items-center gap-2 text-[13px] text-success-600">
                <Sparkles className="h-4 w-4" />
                Your profile is complete.
              </p>
            )}

            {complete.length > 0 && (
              <>
                <p className="mt-5 text-[13px] font-semibold text-ink">Completed</p>
                <ul className="mt-2.5 space-y-1.5">
                  {complete.map((section) => (
                    <li key={section.key} className="flex items-center gap-2 px-2.5 text-[13px] text-ink-400">
                      <Check className="h-3.5 w-3.5 shrink-0 text-success-600" strokeWidth={2.6} />
                      {section.label}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          <Card className="bg-brand-50/60 p-5">
            <h2 className="text-[15px] font-semibold text-ink">Why we ask</h2>
            <p className="mt-1.5 text-[13px] leading-6 text-ink-500">
              Funders set rules about courses, institutions, results, income and location. The more of
              your profile we hold, the more accurately we can tell you what you qualify for — and the
              fewer questions you face at application time.
            </p>
          </Card>
        </div>
      </div>
    </PageBody>
  );
}
