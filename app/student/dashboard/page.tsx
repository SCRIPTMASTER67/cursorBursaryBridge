import type { Metadata } from 'next';
import Link from 'next/link';
import { PageBody } from '@/components/layout/app-shell';
import { OpportunityCard } from '@/components/student/opportunity-card';
import { ApplicationStatusBadge, Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardHeader, StatCard } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ProgressBar } from '@/components/ui/progress';
import { ArrowRight, Bookmark, Calendar, Clock, Sparkles, TrendingUp } from '@/components/icons';
import { requireOnboardedStudent } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { deadlineLabel, formatDate, greeting } from '@/lib/utils';
import { getRankedOpportunities } from '@/services/matching';
import { improvementPrompts } from '@/services/profile-strength';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function StudentDashboardPage() {
  const { user, studentProfileId } = await requireOnboardedStudent();

  const [profile, applications, opportunities] = await Promise.all([
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
    prisma.application.findMany({
      where: { studentProfileId },
      include: {
        fundingProgramme: {
          select: { id: true, name: true, closingDate: true, organisation: { select: { name: true } } },
        },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    getRankedOpportunities(studentProfileId),
  ]);

  const appliedProgrammeIds = new Set(applications.map((a) => a.fundingProgrammeId));
  const activeApplications = applications.filter((a) => a.status !== 'DRAFT');

  // "Upcoming" means an open programme the student has matched with that
  // closes within the next 30 days.
  const upcomingDeadlines = opportunities
    .filter((entry) => {
      const days = Math.ceil(
        (new Date(entry.programme.closingDate).getTime() - Date.now()) / 86_400_000,
      );
      return days >= 0 && days <= 30;
    })
    .slice(0, 4);

  const prompts = improvementPrompts({
    ...profile,
    documentCount: profile._count.documents,
  });

  const topMatches = opportunities.filter((o) => !appliedProgrammeIds.has(o.programme.id)).slice(0, 3);

  return (
    <PageBody>
      <div className="mb-6">
        <h1 className="text-[22px] font-bold tracking-[-0.02em] text-ink">
          {greeting()}, {user.firstName}!
        </h1>
        <p className="mt-1.5 text-[13px] text-ink-400">Here are your funding matches today.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard value={opportunities.length} label="Matches" sublabel="Opportunities for you" />
        <StatCard
          value={activeApplications.length}
          label="Applications"
          sublabel="Submitted or in review"
          accent="info"
        />
        <StatCard
          value={upcomingDeadlines.length}
          label="Deadlines"
          sublabel="Closing within 30 days"
          accent="warning"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          {/* --------------------------------------------------- Top matches */}
          <section>
            <div className="mb-3.5 flex items-end justify-between">
              <div>
                <h2 className="text-[15px] font-semibold text-ink">Top matches for you</h2>
                <p className="mt-0.5 text-[13px] text-ink-400">
                  Ranked by how well each programme fits your profile.
                </p>
              </div>
              <Link
                href="/student/opportunities"
                className="shrink-0 text-[13px] font-semibold text-brand-600 hover:text-brand-700"
              >
                View all
              </Link>
            </div>

            {topMatches.length === 0 ? (
              <Card>
                <EmptyState
                  icon={<Bookmark className="h-5 w-5" />}
                  title="No new matches right now"
                  description="Add more study preferences or complete your profile to widen the opportunities we can match you with."
                  action={<ButtonLink href="/student/profile">Update my profile</ButtonLink>}
                />
              </Card>
            ) : (
              <div className="space-y-4">
                {topMatches.map((entry) => (
                  <OpportunityCard
                    key={entry.programme.id}
                    programme={entry.programme}
                    match={entry.match}
                  />
                ))}
              </div>
            )}
          </section>

          {/* ---------------------------------------------- Active applications */}
          <Card>
            <CardHeader
              title="Your applications"
              description="Track where each application stands."
              action={
                <Link
                  href="/student/applications"
                  className="text-[13px] font-semibold text-brand-600 hover:text-brand-700"
                >
                  View all
                </Link>
              }
            />
            {applications.length === 0 ? (
              <EmptyState
                title="You haven’t applied yet"
                description="When you apply to an opportunity, you’ll be able to track its progress here."
                action={<ButtonLink href="/student/opportunities">Browse opportunities</ButtonLink>}
              />
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {applications.slice(0, 4).map((application) => (
                  <li key={application.id}>
                    <Link
                      href={`/student/applications/${application.id}`}
                      className="flex items-center justify-between gap-4 px-6 py-3.5 transition-colors hover:bg-surface-subtle"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-ink">
                          {application.fundingProgramme.name}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-ink-400">
                          {application.fundingProgramme.organisation.name}
                          <span className="mx-1.5">·</span>
                          {application.submittedAt
                            ? `Submitted ${formatDate(application.submittedAt)}`
                            : 'Draft saved'}
                        </p>
                      </div>
                      <ApplicationStatusBadge status={application.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* ------------------------------------------------------- Side column */}
        <div className="space-y-6">
          {/* Profile strength */}
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-[18px] w-[18px] text-brand-600" />
              <h2 className="text-[15px] font-semibold text-ink">Profile strength</h2>
            </div>
            <ProgressBar
              value={profile.profileStrength}
              showLabel
              label="Complete"
              tone={profile.profileStrength >= 80 ? 'success' : 'brand'}
              className="mt-4"
            />

            {prompts.length > 0 ? (
              <>
                <p className="mt-5 text-[13px] font-semibold text-ink">Improve your matches</p>
                <ul className="mt-2.5 space-y-1.5">
                  {prompts.map((prompt) => (
                    <li key={prompt.key}>
                      <Link
                        href={prompt.href}
                        className="flex items-center justify-between gap-3 rounded-btn px-2.5 py-2 text-[13px] text-ink-600 transition-colors hover:bg-surface-subtle"
                      >
                        <span className="truncate">{prompt.label}</span>
                        <span className="shrink-0 font-semibold text-success-600">+{prompt.weight}%</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-4 flex items-center gap-2 text-[13px] text-success-600">
                <Sparkles className="h-4 w-4" />
                Your profile is complete. Nice work!
              </p>
            )}
          </Card>

          {/* Upcoming deadlines */}
          <Card>
            <CardHeader title="Upcoming deadlines" />
            {upcomingDeadlines.length === 0 ? (
              <EmptyState
                icon={<Calendar className="h-5 w-5" />}
                title="Nothing closing soon"
                description="We’ll let you know when a matched opportunity is about to close."
                className="py-10"
              />
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {upcomingDeadlines.map((entry) => (
                  <li key={entry.programme.id}>
                    <Link
                      href={`/student/opportunities/${entry.programme.id}`}
                      className="flex items-start justify-between gap-3 px-6 py-3.5 transition-colors hover:bg-surface-subtle"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-ink">{entry.programme.name}</p>
                        <p className="mt-0.5 text-xs text-ink-400">{formatDate(entry.programme.closingDate)}</p>
                      </div>
                      <Badge tone="warning" icon={<Clock className="h-3 w-3" />}>
                        {deadlineLabel(entry.programme.closingDate)}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="bg-brand-50/60 p-5">
            <h2 className="text-[15px] font-semibold text-ink">Make your profile count</h2>
            <p className="mt-1.5 text-[13px] leading-6 text-ink-500">
              The more complete your profile, the more accurately we can match you — and the fewer
              questions funders need to ask.
            </p>
            <Link
              href="/student/profile"
              className="mt-3.5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-600 hover:text-brand-700"
            >
              Go to Profile
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Card>
        </div>
      </div>
    </PageBody>
  );
}
