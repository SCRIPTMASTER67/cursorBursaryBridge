'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type {
  Citizenship,
  DocumentType,
  FundingCoverage,
  FundingType,
  IncomeBand,
  Province,
  QualificationLevel,
  QuestionType,
} from '@prisma/client';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckboxGroup } from '@/components/ui/checkbox-group';
import { MultiCombobox } from '@/components/ui/combobox';
import { Field } from '@/components/ui/field';
import { Input, PercentInput } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { VerticalSteps } from '@/components/ui/progress';
import { Plus, Trash } from '@/components/icons';
import { useFormSubmit } from '@/hooks/use-form-submit';
import {
  citizenshipLabels,
  documentTypeLabels,
  fundingCoverageLabels,
  fundingTypeLabels,
  incomeBandLabels,
  provinceLabels,
  qualificationLabels,
  toOptions,
} from '@/lib/labels';
import type { CatalogInstitution, CatalogProgramme } from '@/services/catalog';

type QuestionDraft = {
  label: string;
  helpText: string;
  type: QuestionType;
  required: boolean;
  options: string[];
};

export type ProgrammeDraft = {
  details: {
    name: string;
    shortDescription: string;
    fullDescription: string;
    fundingType: FundingType | '';
    coverage: FundingCoverage[];
    openDate: string;
    closingDate: string;
    intakeTarget: string;
  };
  eligibility: {
    institutionIds: string[];
    programmeIds: string[];
    qualificationLevels: QualificationLevel[];
    minAcademicAverage: string;
    yearsOfStudy: number[];
    citizenship: Citizenship[];
    maxHouseholdIncome: IncomeBand | '';
    requiresFinancialNeed: boolean;
    provinces: Province[];
    otherRequirements: string;
    requiredDocuments: DocumentType[];
  };
  questions: QuestionDraft[];
};

export const emptyDraft: ProgrammeDraft = {
  details: {
    name: '',
    shortDescription: '',
    fullDescription: '',
    fundingType: '',
    coverage: [],
    openDate: new Date().toISOString().slice(0, 10),
    closingDate: '',
    intakeTarget: '',
  },
  eligibility: {
    institutionIds: [],
    programmeIds: [],
    qualificationLevels: [],
    minAcademicAverage: '',
    yearsOfStudy: [],
    citizenship: [],
    maxHouseholdIncome: '',
    requiresFinancialNeed: false,
    provinces: [],
    otherRequirements: '',
    requiredDocuments: [],
  },
  questions: [],
};

const builderSteps = [
  { key: 'details', label: 'Programme Details' },
  { key: 'eligibility', label: 'Eligibility Criteria' },
  { key: 'funding', label: 'Funding & Benefits' },
  { key: 'questions', label: 'Documents & Questions' },
  { key: 'review', label: 'Review & Publish' },
];

/**
 * The funding-programme builder.
 *
 * Eligibility is captured as structured rules rather than prose, because those
 * same fields are what EligibilityService and MatchingService evaluate — what a
 * funder configures here is exactly what students are scored against.
 */
export function ProgrammeBuilder({
  catalog,
  initial = emptyDraft,
  programmeId,
  mode = 'create',
}: {
  catalog: { institutions: CatalogInstitution[]; programmes: CatalogProgramme[] };
  initial?: ProgrammeDraft;
  programmeId?: string;
  mode?: 'create' | 'edit';
}) {
  const router = useRouter();
  const { submitting, error, fieldErrors, submit } = useFormSubmit<{ redirectTo: string }>();

  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<ProgrammeDraft>(initial);

  function setDetails<K extends keyof ProgrammeDraft['details']>(
    key: K,
    value: ProgrammeDraft['details'][K],
  ) {
    setDraft((current) => ({ ...current, details: { ...current.details, [key]: value } }));
  }

  function setEligibility<K extends keyof ProgrammeDraft['eligibility']>(
    key: K,
    value: ProgrammeDraft['eligibility'][K],
  ) {
    setDraft((current) => ({ ...current, eligibility: { ...current.eligibility, [key]: value } }));
  }

  function payload(publish: boolean) {
    return {
      details: {
        ...draft.details,
        intakeTarget: draft.details.intakeTarget ? Number(draft.details.intakeTarget) : null,
      },
      eligibility: {
        ...draft.eligibility,
        minAcademicAverage: draft.eligibility.minAcademicAverage
          ? Number(draft.eligibility.minAcademicAverage)
          : null,
        maxHouseholdIncome: draft.eligibility.maxHouseholdIncome || null,
      },
      questions: draft.questions.map((question) => ({
        ...question,
        options: question.type === 'SINGLE_SELECT' || question.type === 'MULTI_SELECT' ? question.options : [],
      })),
      publish,
    };
  }

  async function save(publish: boolean) {
    await submit(
      mode === 'edit' && programmeId
        ? `/api/corporate/programmes/${programmeId}`
        : '/api/corporate/programmes',
      payload(publish),
      {
        method: mode === 'edit' ? 'PUT' : 'POST',
        onSuccess: (data) => {
          router.push(data.redirectTo);
          router.refresh();
        },
      },
    );
  }

  const institutionItems = catalog.institutions.map((i) => ({
    value: i.id,
    label: i.name,
    sublabel: i.city,
  }));
  const programmeItems = catalog.programmes.map((p) => ({ value: p.id, label: p.name }));

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr] lg:items-start">
      <Card className="p-3 lg:sticky lg:top-6">
        <VerticalSteps steps={builderSteps} current={step} />
      </Card>

      <div>
        {error && <Alert tone="danger" className="mb-5">{error}</Alert>}

        {/* ------------------------------------------------ 1. Details */}
        {step === 1 && (
          <Card>
            <CardHeader
              title="Programme details"
              description="Set up your funding programme. Students see this information on the opportunity page."
            />
            <div className="space-y-5 px-6 pb-6">
              <Field label="Programme name" error={fieldErrors['details.name']} required>
                <Input
                  value={draft.details.name}
                  onChange={(event) => setDetails('name', event.target.value)}
                  placeholder="e.g. 2026 Engineering Bursary"
                />
              </Field>

              <Field
                label="Programme description"
                description="A one-line summary shown on opportunity cards."
                error={fieldErrors['details.shortDescription']}
                required
              >
                <Textarea
                  rows={2}
                  maxLength={280}
                  value={draft.details.shortDescription}
                  onChange={(event) => setDetails('shortDescription', event.target.value)}
                  placeholder="Supporting talented engineering students pursuing accredited degrees."
                />
              </Field>

              <Field
                label="Full description"
                description="The detail students read before applying."
                error={fieldErrors['details.fullDescription']}
                required
              >
                <Textarea
                  rows={6}
                  value={draft.details.fullDescription}
                  onChange={(event) => setDetails('fullDescription', event.target.value)}
                />
              </Field>

              <Field label="Programme type" error={fieldErrors['details.fundingType']} required>
                <Select
                  options={toOptions(fundingTypeLabels)}
                  placeholder="Select a programme type"
                  value={draft.details.fundingType}
                  onChange={(event) => setDetails('fundingType', event.target.value as FundingType)}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Application open date" error={fieldErrors['details.openDate']} required>
                  <Input
                    type="date"
                    value={draft.details.openDate}
                    onChange={(event) => setDetails('openDate', event.target.value)}
                  />
                </Field>
                <Field label="Application closing date" error={fieldErrors['details.closingDate']} required>
                  <Input
                    type="date"
                    value={draft.details.closingDate}
                    onChange={(event) => setDetails('closingDate', event.target.value)}
                  />
                </Field>
              </div>

              <Field
                label="Approximate number of awards"
                description="Shown to students as an indication of how many awards are available."
                optional
              >
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={draft.details.intakeTarget}
                  onChange={(event) => setDetails('intakeTarget', event.target.value)}
                  className="sm:max-w-[180px]"
                />
              </Field>
            </div>
          </Card>
        )}

        {/* -------------------------------------------- 2. Eligibility */}
        {step === 2 && (
          <Card>
            <CardHeader
              title="Eligibility criteria"
              description="These rules decide who matches your programme and who appears as eligible in your applicant list. Leave a field empty to place no restriction on it."
            />
            <div className="space-y-5 px-6 pb-6">
              <Field
                label="Supported institutions"
                description="Leave empty to accept students from any institution."
              >
                <MultiCombobox
                  items={institutionItems}
                  values={draft.eligibility.institutionIds}
                  onChange={(values) => setEligibility('institutionIds', values)}
                  placeholder="Search and add institutions"
                  ariaLabel="Supported institutions"
                />
              </Field>

              <Field
                label="Supported courses / programmes"
                description="Leave empty to accept any course."
              >
                <MultiCombobox
                  items={programmeItems}
                  values={draft.eligibility.programmeIds}
                  onChange={(values) => setEligibility('programmeIds', values)}
                  placeholder="Search and add courses"
                  ariaLabel="Supported courses"
                />
              </Field>

              <fieldset>
                <legend className="mb-3 text-[13px] font-medium text-ink-700">Qualification level</legend>
                <CheckboxGroup
                  options={toOptions(qualificationLabels)}
                  values={draft.eligibility.qualificationLevels}
                  onChange={(values) => setEligibility('qualificationLevels', values)}
                  columns={2}
                />
              </fieldset>

              <Field
                label="Minimum academic average"
                description="Applicants below this average are marked as not eligible."
                error={fieldErrors['eligibility.minAcademicAverage']}
                optional
              >
                <PercentInput
                  value={draft.eligibility.minAcademicAverage}
                  onChange={(event) => setEligibility('minAcademicAverage', event.target.value)}
                  placeholder="65"
                  className="sm:max-w-[140px]"
                />
              </Field>

              <fieldset>
                <legend className="mb-3 text-[13px] font-medium text-ink-700">Year of study</legend>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5, 6].map((year) => {
                    const selected = draft.eligibility.yearsOfStudy.includes(year);
                    return (
                      <button
                        key={year}
                        type="button"
                        aria-pressed={selected}
                        onClick={() =>
                          setEligibility(
                            'yearsOfStudy',
                            selected
                              ? draft.eligibility.yearsOfStudy.filter((y) => y !== year)
                              : [...draft.eligibility.yearsOfStudy, year].sort(),
                          )
                        }
                        className={`h-9 rounded-btn border px-4 text-[13px] font-medium transition-colors ${
                          selected
                            ? 'border-brand-300 bg-brand-50 text-brand-700'
                            : 'border-line bg-white text-ink-600 hover:border-line-strong'
                        }`}
                      >
                        Year {year}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-3 text-[13px] font-medium text-ink-700">
                  Citizenship / residency requirement
                </legend>
                <CheckboxGroup
                  options={toOptions(citizenshipLabels).filter((o) => o.value !== 'PREFER_NOT_TO_SAY')}
                  values={draft.eligibility.citizenship}
                  onChange={(values) => setEligibility('citizenship', values)}
                  columns={2}
                />
              </fieldset>

              <div className="space-y-3 border-t border-line pt-5">
                <Field label="Maximum household income" optional>
                  <Select
                    options={[
                      { value: '', label: 'No income limit' },
                      ...toOptions(incomeBandLabels).filter(
                        (o) => o.value !== 'DONT_KNOW' && o.value !== 'PREFER_NOT_TO_SAY',
                      ),
                    ]}
                    value={draft.eligibility.maxHouseholdIncome}
                    onChange={(event) =>
                      setEligibility('maxHouseholdIncome', event.target.value as IncomeBand | '')
                    }
                  />
                </Field>
                <Checkbox
                  checked={draft.eligibility.requiresFinancialNeed}
                  onChange={(event) => setEligibility('requiresFinancialNeed', event.target.checked)}
                  label="Applicants must demonstrate financial need"
                />
              </div>

              <fieldset className="border-t border-line pt-5">
                <legend className="mb-1 text-[13px] font-medium text-ink-700">
                  Geographic requirement
                </legend>
                <p className="mb-3 text-[13px] text-ink-400">
                  Leave empty to accept students from every province.
                </p>
                <CheckboxGroup
                  options={toOptions(provinceLabels)}
                  values={draft.eligibility.provinces}
                  onChange={(values) => setEligibility('provinces', values)}
                  columns={2}
                />
              </fieldset>

              <Field label="Other requirements" optional className="border-t border-line pt-5">
                <Textarea
                  rows={3}
                  value={draft.eligibility.otherRequirements}
                  onChange={(event) => setEligibility('otherRequirements', event.target.value)}
                  placeholder="Anything else applicants should know about eligibility."
                />
              </Field>
            </div>
          </Card>
        )}

        {/* ----------------------------------------------- 3. Funding */}
        {step === 3 && (
          <Card>
            <CardHeader
              title="Funding & benefits"
              description="What does this programme pay for? Students filter opportunities by exactly these items."
            />
            <div className="space-y-5 px-6 pb-6">
              <fieldset>
                <legend className="mb-3 text-[13px] font-medium text-ink-700">Funding provided</legend>
                <CheckboxGroup
                  options={toOptions(fundingCoverageLabels)}
                  values={draft.details.coverage}
                  onChange={(values) => setDetails('coverage', values)}
                  columns={2}
                />
                {fieldErrors['details.coverage'] && (
                  <p role="alert" className="mt-2 text-[13px] font-medium text-danger-600">
                    {fieldErrors['details.coverage']}
                  </p>
                )}
              </fieldset>
            </div>
          </Card>
        )}

        {/* -------------------------------- 4. Documents & questions */}
        {step === 4 && (
          <div className="space-y-5">
            <Card>
              <CardHeader
                title="Required documents"
                description="Students are shown these on the opportunity page and prompted to attach them when applying."
              />
              <div className="px-6 pb-6">
                <CheckboxGroup
                  options={toOptions(documentTypeLabels)}
                  values={draft.eligibility.requiredDocuments}
                  onChange={(values) => setEligibility('requiredDocuments', values)}
                  columns={2}
                />
              </div>
            </Card>

            <Card>
              <CardHeader
                title="Programme questions"
                description="Ask only what your profile data cannot already answer — students should never retype what Bursary-Bridge already holds."
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    leadingIcon={<Plus className="h-3.5 w-3.5" />}
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        questions: [
                          ...current.questions,
                          { label: '', helpText: '', type: 'LONG_TEXT', required: false, options: [] },
                        ],
                      }))
                    }
                  >
                    Add question
                  </Button>
                }
              />
              <div className="space-y-4 px-6 pb-6">
                {draft.questions.length === 0 ? (
                  <p className="rounded-field bg-surface-muted px-4 py-6 text-center text-[13px] text-ink-400">
                    No additional questions. Applicants will be assessed on their profile alone.
                  </p>
                ) : (
                  draft.questions.map((question, index) => (
                    <QuestionEditor
                      key={index}
                      question={question}
                      index={index}
                      onChange={(updated) =>
                        setDraft((current) => ({
                          ...current,
                          questions: current.questions.map((q, i) => (i === index ? updated : q)),
                        }))
                      }
                      onRemove={() =>
                        setDraft((current) => ({
                          ...current,
                          questions: current.questions.filter((_, i) => i !== index),
                        }))
                      }
                    />
                  ))
                )}
              </div>
            </Card>
          </div>
        )}

        {/* ------------------------------------------------ 5. Review */}
        {step === 5 && (
          <Card>
            <CardHeader
              title="Review & publish"
              description="Publishing makes this programme visible to matching students immediately."
            />
            <div className="space-y-4 px-6 pb-6">
              <ReviewRow label="Programme name" value={draft.details.name || 'Not set'} />
              <ReviewRow
                label="Type"
                value={draft.details.fundingType ? fundingTypeLabels[draft.details.fundingType] : 'Not set'}
              />
              <ReviewRow
                label="Applications"
                value={
                  draft.details.openDate && draft.details.closingDate
                    ? `${draft.details.openDate} to ${draft.details.closingDate}`
                    : 'Not set'
                }
              />
              <ReviewRow
                label="Covers"
                value={
                  draft.details.coverage.length > 0
                    ? draft.details.coverage.map((c) => fundingCoverageLabels[c]).join(', ')
                    : 'Not set'
                }
              />
              <ReviewRow
                label="Supported institutions"
                value={
                  draft.eligibility.institutionIds.length > 0
                    ? `${draft.eligibility.institutionIds.length} selected`
                    : 'All institutions'
                }
              />
              <ReviewRow
                label="Supported courses"
                value={
                  draft.eligibility.programmeIds.length > 0
                    ? `${draft.eligibility.programmeIds.length} selected`
                    : 'All courses'
                }
              />
              <ReviewRow
                label="Minimum average"
                value={
                  draft.eligibility.minAcademicAverage
                    ? `${draft.eligibility.minAcademicAverage}%`
                    : 'No minimum'
                }
              />
              <ReviewRow
                label="Required documents"
                value={
                  draft.eligibility.requiredDocuments.length > 0
                    ? draft.eligibility.requiredDocuments.map((d) => documentTypeLabels[d]).join(', ')
                    : 'None'
                }
              />
              <ReviewRow
                label="Programme questions"
                value={draft.questions.length === 0 ? 'None' : `${draft.questions.length} question(s)`}
              />
            </div>
          </Card>
        )}

        {/* ----------------------------------------------- Actions */}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={submitting}>
                Back
              </Button>
            )}
            <Button variant="ghost" onClick={() => save(false)} loading={submitting}>
              Save as Draft
            </Button>
          </div>

          {step < builderSteps.length ? (
            <Button size="lg" onClick={() => setStep((s) => s + 1)}>
              Save &amp; Continue
            </Button>
          ) : (
            <Button size="lg" onClick={() => save(true)} loading={submitting}>
              Publish Programme
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-line pb-3 last:border-0 sm:flex-row sm:gap-4">
      <dt className="w-52 shrink-0 text-[13px] text-ink-400">{label}</dt>
      <dd className="text-[13px] text-ink-700">{value}</dd>
    </div>
  );
}

function QuestionEditor({
  question,
  index,
  onChange,
  onRemove,
}: {
  question: QuestionDraft;
  index: number;
  onChange: (question: QuestionDraft) => void;
  onRemove: () => void;
}) {
  const needsOptions = question.type === 'SINGLE_SELECT' || question.type === 'MULTI_SELECT';

  return (
    <div className="rounded-card border border-line p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[13px] font-semibold text-ink">Question {index + 1}</p>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove question ${index + 1}`}
          className="rounded-md p-1 text-ink-300 transition-colors hover:bg-danger-50 hover:text-danger-600"
        >
          <Trash className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3">
        <Field label="Question">
          <Input
            value={question.label}
            onChange={(event) => onChange({ ...question, label: event.target.value })}
            placeholder="e.g. Why are you interested in this field?"
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Answer type">
            <Select
              options={[
                { value: 'SHORT_TEXT', label: 'Short text' },
                { value: 'LONG_TEXT', label: 'Long text' },
                { value: 'SINGLE_SELECT', label: 'Choose one' },
                { value: 'MULTI_SELECT', label: 'Choose several' },
                { value: 'NUMBER', label: 'Number' },
                { value: 'DATE', label: 'Date' },
                { value: 'YES_NO', label: 'Yes / No' },
              ]}
              value={question.type}
              onChange={(event) => onChange({ ...question, type: event.target.value as QuestionType })}
            />
          </Field>
          <Field label="Help text" optional>
            <Input
              value={question.helpText}
              onChange={(event) => onChange({ ...question, helpText: event.target.value })}
              placeholder="Guidance for the applicant"
            />
          </Field>
        </div>

        {needsOptions && (
          <Field label="Options" description="One per line.">
            <Textarea
              rows={3}
              value={question.options.join('\n')}
              onChange={(event) =>
                onChange({
                  ...question,
                  options: event.target.value.split('\n').map((o) => o.trim()).filter(Boolean),
                })
              }
              placeholder={'Solar\nWind\nBattery storage'}
            />
          </Field>
        )}

        <Checkbox
          checked={question.required}
          onChange={(event) => onChange({ ...question, required: event.target.checked })}
          label="This question is required"
        />
      </div>
    </div>
  );
}
