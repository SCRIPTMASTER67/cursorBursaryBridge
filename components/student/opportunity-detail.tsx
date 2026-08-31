'use client';

import { useState } from 'react';
import type { ApplicationStatus } from '@prisma/client';
import { MatchExplanation } from '@/components/student/match-explanation';
import { ApplicationStatusBadge, Badge, MatchBadge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs } from '@/components/ui/tabs';
import { Calendar, Check, FileText, GraduationCap, MapPin, Users, Wallet } from '@/components/icons';
import {
  citizenshipLabels,
  documentTypeLabels,
  fundingCoverageLabels,
  fundingTypeLabels,
  incomeBandLabels,
  industryLabels,
  provinceLabels,
  qualificationLabels,
} from '@/lib/labels';
import type { MatchResult } from '@/lib/matching';
import { deadlineLabel, formatDate } from '@/lib/utils';
import type { ProgrammeWithRelations } from '@/services/matching';

/**
 * The full opportunity page: what the programme funds, exactly who is eligible,
 * what documents are needed, and why this student does or does not match.
 */
export function OpportunityDetail({
  programme,
  match,
  application,
}: {
  programme: ProgrammeWithRelations;
  match: MatchResult;
  application: { id: string; status: ApplicationStatus } | null;
}) {
  const [tab, setTab] = useState('overview');
  const eligibility = programme.eligibility;

  const courses = programme.supportedProgrammes.map((p) => p.programme.name);
  const institutions = programme.supportedInstitutions.map((i) => i.institution.name);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr] lg:items-start">
      <div className="space-y-5">
        <Card className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge tone="neutral">{fundingTypeLabels[programme.fundingType]}</Badge>
                {application && <ApplicationStatusBadge status={application.status} />}
              </div>
              <h1 className="text-[22px] font-bold leading-tight tracking-[-0.02em] text-ink">
                {programme.name}
              </h1>
              <p className="mt-1.5 text-[13px] font-medium text-ink-500">{programme.organisation.name}</p>
            </div>
            <MatchBadge score={match.matchScore} classification={match.classification} />
          </div>

          <dl className="mt-5 grid gap-4 border-t border-line pt-5 sm:grid-cols-3">
            <Fact
              icon={<Calendar className="h-4 w-4" />}
              label="Closes"
              value={formatDate(programme.closingDate)}
              hint={deadlineLabel(programme.closingDate)}
            />
            <Fact
              icon={<Wallet className="h-4 w-4" />}
              label="Funding"
              value={programme.coverage.length >= 5 ? 'Full funding' : 'Partial funding'}
              hint={`${programme.coverage.length} items covered`}
            />
            <Fact
              icon={<GraduationCap className="h-4 w-4" />}
              label="Study Level"
              value={
                eligibility && eligibility.qualificationLevels.length > 0
                  ? qualificationLabels[eligibility.qualificationLevels[0]]
                  : 'All levels'
              }
              hint={
                eligibility && eligibility.qualificationLevels.length > 1
                  ? `+${eligibility.qualificationLevels.length - 1} more`
                  : undefined
              }
            />
          </dl>
        </Card>

        <Card>
          <Tabs
            className="px-6 pt-4"
            active={tab}
            onChange={setTab}
            tabs={[
              { key: 'overview', label: 'Overview' },
              { key: 'eligibility', label: 'Eligibility' },
              { key: 'covered', label: 'What’s Covered' },
              { key: 'apply', label: 'How to Apply' },
            ]}
          />

          <div className="px-6 py-5">
            {tab === 'overview' && (
              <section className="space-y-5">
                <div>
                  <h2 className="text-[15px] font-semibold text-ink">About this bursary</h2>
                  <p className="mt-2 whitespace-pre-line text-[13px] leading-6 text-ink-500">
                    {programme.fullDescription}
                  </p>
                </div>

                <div>
                  <h3 className="text-[13px] font-semibold text-ink">Supported courses</h3>
                  <p className="mt-1.5 text-[13px] leading-6 text-ink-500">
                    {courses.length === 0 ? 'Open to all courses and programmes.' : courses.join(', ')}
                  </p>
                </div>

                <div>
                  <h3 className="text-[13px] font-semibold text-ink">Supported institutions</h3>
                  <p className="mt-1.5 text-[13px] leading-6 text-ink-500">
                    {institutions.length === 0
                      ? 'Open to students at any recognised institution.'
                      : institutions.join(', ')}
                  </p>
                </div>
              </section>
            )}

            {tab === 'eligibility' && (
              <section className="space-y-4">
                <h2 className="text-[15px] font-semibold text-ink">Eligibility requirements</h2>
                <dl className="divide-y divide-line">
                  <Requirement
                    label="Academic requirement"
                    value={
                      eligibility?.minAcademicAverage
                        ? `Minimum average of ${eligibility.minAcademicAverage}%`
                        : 'No minimum average'
                    }
                  />
                  <Requirement
                    label="Qualification level"
                    value={
                      eligibility && eligibility.qualificationLevels.length > 0
                        ? eligibility.qualificationLevels.map((q) => qualificationLabels[q]).join(', ')
                        : 'All qualification levels'
                    }
                  />
                  <Requirement
                    label="Year of study"
                    value={
                      eligibility && eligibility.yearsOfStudy.length > 0
                        ? eligibility.yearsOfStudy.map((y) => `Year ${y}`).join(', ')
                        : 'Any year of study'
                    }
                  />
                  <Requirement
                    label="Citizenship"
                    value={
                      eligibility && eligibility.citizenship.length > 0
                        ? eligibility.citizenship.map((c) => citizenshipLabels[c]).join(', ')
                        : 'No citizenship requirement'
                    }
                  />
                  <Requirement
                    label="Financial requirement"
                    value={
                      eligibility?.maxHouseholdIncome
                        ? `Household income up to ${incomeBandLabels[eligibility.maxHouseholdIncome]}`
                        : eligibility?.requiresFinancialNeed
                          ? 'Demonstrated financial need'
                          : 'No financial requirement'
                    }
                  />
                  <Requirement
                    label="Geographic requirement"
                    value={
                      eligibility && eligibility.provinces.length > 0
                        ? eligibility.provinces.map((p) => provinceLabels[p]).join(', ')
                        : 'Open to all provinces'
                    }
                  />
                  {eligibility?.otherRequirements && (
                    <Requirement label="Other requirements" value={eligibility.otherRequirements} />
                  )}
                </dl>
              </section>
            )}

            {tab === 'covered' && (
              <section>
                <h2 className="text-[15px] font-semibold text-ink">What it covers</h2>
                <ul className="mt-3 space-y-2.5">
                  {programme.coverage.map((coverage) => (
                    <li key={coverage} className="flex items-center gap-2.5 text-[13px] text-ink-600">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success-50 text-success-600">
                        <Check className="h-3.5 w-3.5" strokeWidth={2.8} />
                      </span>
                      {fundingCoverageLabels[coverage]}
                    </li>
                  ))}
                </ul>
                {programme.intakeTarget && (
                  <p className="mt-5 flex items-center gap-2 text-[13px] text-ink-400">
                    <Users className="h-4 w-4" />
                    Approximately {programme.intakeTarget} awards available this intake.
                  </p>
                )}
              </section>
            )}

            {tab === 'apply' && (
              <section className="space-y-5">
                <div>
                  <h2 className="text-[15px] font-semibold text-ink">How to apply</h2>
                  <ol className="mt-3 space-y-3">
                    {[
                      'Review the eligibility requirements above.',
                      'Start your application — your Bursary-Bridge profile fills in most of it automatically.',
                      'Answer any questions specific to this programme.',
                      'Attach the required documents and submit before the closing date.',
                    ].map((stepText, index) => (
                      <li key={stepText} className="flex gap-3 text-[13px] leading-6 text-ink-500">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[11px] font-bold text-brand-600">
                          {index + 1}
                        </span>
                        {stepText}
                      </li>
                    ))}
                  </ol>
                </div>

                {eligibility && eligibility.requiredDocuments.length > 0 && (
                  <div>
                    <h3 className="text-[13px] font-semibold text-ink">Required documents</h3>
                    <ul className="mt-2.5 space-y-2">
                      {eligibility.requiredDocuments.map((document) => (
                        <li key={document} className="flex items-center gap-2.5 text-[13px] text-ink-600">
                          <FileText className="h-4 w-4 shrink-0 text-ink-300" />
                          {documentTypeLabels[document]}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}
          </div>
        </Card>
      </div>

      {/* --------------------------------------------------------- Sidebar */}
      <div className="space-y-5 lg:sticky lg:top-6">
        <MatchExplanation match={match} />

        <Card className="p-5">
          {application && application.status !== 'DRAFT' ? (
            <>
              <p className="text-[13px] leading-6 text-ink-500">
                You’ve already applied to this opportunity.
              </p>
              <ButtonLink
                href={`/student/applications/${application.id}`}
                fullWidth
                size="lg"
                variant="outline"
                className="mt-4"
              >
                View my application
              </ButtonLink>
            </>
          ) : (
            <>
              <p className="text-[13px] leading-6 text-ink-500">
                Your profile is reused automatically — you’ll only be asked for what this programme
                needs in addition.
              </p>
              <ButtonLink
                href={`/student/opportunities/${programme.id}/apply`}
                fullWidth
                size="lg"
                className="mt-4"
              >
                {application?.status === 'DRAFT' ? 'Continue Application' : 'Apply Now'}
              </ButtonLink>
            </>
          )}
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-ink-400">
            <Calendar className="h-3.5 w-3.5" />
            {deadlineLabel(programme.closingDate)}
          </p>
        </Card>

        <Card className="p-5">
          <h3 className="text-[13px] font-semibold text-ink">About the funder</h3>
          <p className="mt-1.5 text-[13px] font-medium text-ink-600">{programme.organisation.name}</p>
          <p className="mt-1 text-[13px] text-ink-400">{industryLabels[programme.organisation.industry]}</p>
          <p className="mt-3 flex items-center gap-2 text-[13px] text-ink-400">
            <MapPin className="h-4 w-4" />
            South Africa
          </p>
        </Card>
      </div>
    </div>
  );
}

function Fact({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-ink-300">{icon}</span>
      <div className="min-w-0">
        <dt className="text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-400">{label}</dt>
        <dd className="mt-0.5 truncate text-[13px] font-semibold text-ink">{value}</dd>
        {hint && <p className="text-xs text-ink-400">{hint}</p>}
      </div>
    </div>
  );
}

function Requirement({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-4">
      <dt className="w-52 shrink-0 text-[13px] font-medium text-ink-700">{label}</dt>
      <dd className="text-[13px] leading-6 text-ink-500">{value}</dd>
    </div>
  );
}
