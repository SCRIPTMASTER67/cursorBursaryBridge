'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { SaveAndExit, StepShell } from '@/components/onboarding/step-shell';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { useFormSubmit } from '@/hooks/use-form-submit';
import type { CatalogInstitution, CatalogProgramme } from '@/services/catalog';
import { educationStageLabels, qualificationLabels, schoolStages, studyStatusLabels, toOptions } from '@/lib/labels';
import { studentSteps } from '@/lib/onboarding-steps';
import type { EducationStage, QualificationLevel, StudyStatus } from '@prisma/client';

type Initial = {
  educationStage: EducationStage | null;
  qualificationLevel: QualificationLevel | null;
  studyStatus: StudyStatus | null;
  currentInstitutionId: string | null;
  currentProgrammeId: string | null;
  yearOfStudy: number | null;
};

const stepLabels = studentSteps.map((s) => s.label);

/**
 * Step 1 — Education Journey.
 *
 * The form is conditional by design: school learners are never asked about a
 * tertiary qualification, and the "where are you studying" block only appears
 * for students who are already enrolled.
 */
export function EducationForm({
  initial,
  catalog,
}: {
  initial: Initial;
  catalog: { institutions: CatalogInstitution[]; programmes: CatalogProgramme[] };
}) {
  const router = useRouter();
  const { submitting, error, fieldErrors, submit, clearFieldError } = useFormSubmit<{ redirectTo: string }>();

  const [values, setValues] = useState({
    educationStage: initial.educationStage ?? '',
    qualificationLevel: initial.qualificationLevel ?? '',
    studyStatus: initial.studyStatus ?? '',
    currentInstitutionId: initial.currentInstitutionId,
    currentProgrammeId: initial.currentProgrammeId,
    yearOfStudy: initial.yearOfStudy ? String(initial.yearOfStudy) : '',
  });

  const isSchoolLearner = schoolStages.includes(values.educationStage as EducationStage);
  const isEnrolled = values.studyStatus === 'CURRENTLY_ENROLLED';

  const institutionItems = useMemo(
    () =>
      catalog.institutions.map((institution) => ({
        value: institution.id,
        label: institution.name,
        sublabel: `${institution.city}`,
      })),
    [catalog.institutions],
  );

  const programmeItems = useMemo(
    () => catalog.programmes.map((programme) => ({ value: programme.id, label: programme.name })),
    [catalog.programmes],
  );

  function update<K extends keyof typeof values>(field: K, value: (typeof values)[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    clearFieldError(field as string);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    await submit(
      '/api/student/onboarding',
      {
        step: 'education',
        data: {
          educationStage: values.educationStage || undefined,
          qualificationLevel: isSchoolLearner ? null : values.qualificationLevel || null,
          studyStatus: values.studyStatus || undefined,
          currentInstitutionId: isEnrolled ? values.currentInstitutionId : null,
          currentProgrammeId: isEnrolled ? values.currentProgrammeId : null,
          yearOfStudy: isEnrolled && values.yearOfStudy ? Number(values.yearOfStudy) : null,
        },
      },
      {
        onSuccess: (data) => {
          router.push(data.redirectTo);
          router.refresh();
        },
      },
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <StepShell
        step={1}
        totalSteps={studentSteps.length}
        stepLabels={stepLabels}
        backHref="/verify"
        title="Tell us about your education"
        description="This helps us find opportunities relevant to where you are in your education journey."
        footer={
          <>
            <Button type="submit" fullWidth size="lg" loading={submitting}>
              Continue
            </Button>
            <SaveAndExit />
          </>
        }
      >
        {error && <Alert tone="danger" className="mb-5">{error}</Alert>}

        <div className="space-y-5">
          <Field label="What is your current education stage?" error={fieldErrors.educationStage} required>
            <Select
              options={toOptions(educationStageLabels)}
              placeholder="Select your education stage"
              value={values.educationStage}
              onChange={(event) => update('educationStage', event.target.value as EducationStage)}
              required
            />
          </Field>

          {values.educationStage && !isSchoolLearner && (
            <Field
              label="What is your qualification level you plan to study?"
              error={fieldErrors.qualificationLevel}
              required
            >
              <Select
                options={toOptions(qualificationLabels)}
                placeholder="Select a qualification level"
                value={values.qualificationLevel}
                onChange={(event) => update('qualificationLevel', event.target.value as QualificationLevel)}
              />
            </Field>
          )}

          <Field label="What is your study status?" error={fieldErrors.studyStatus} required>
            <Select
              options={toOptions(studyStatusLabels)}
              placeholder="Select your study status"
              value={values.studyStatus}
              onChange={(event) => update('studyStatus', event.target.value as StudyStatus)}
              required
            />
          </Field>

          {isEnrolled && (
            <div className="space-y-5 rounded-card border border-line bg-surface-muted p-4">
              <p className="text-[13px] font-semibold text-ink">Your current registration</p>

              <Field label="Current institution" error={fieldErrors.currentInstitutionId} required>
                <Combobox
                  items={institutionItems}
                  value={values.currentInstitutionId}
                  onChange={(value) => update('currentInstitutionId', value)}
                  placeholder="Search institutions"
                  ariaLabel="Current institution"
                  invalid={Boolean(fieldErrors.currentInstitutionId)}
                />
              </Field>

              <Field label="Current programme" error={fieldErrors.currentProgrammeId} required>
                <Combobox
                  items={programmeItems}
                  value={values.currentProgrammeId}
                  onChange={(value) => update('currentProgrammeId', value)}
                  placeholder="Search courses and programmes"
                  ariaLabel="Current programme"
                  invalid={Boolean(fieldErrors.currentProgrammeId)}
                />
              </Field>

              <Field label="Year of study" error={fieldErrors.yearOfStudy} required>
                <Select
                  options={[1, 2, 3, 4, 5, 6].map((year) => ({
                    value: String(year),
                    label: `${year}${year === 1 ? 'st' : year === 2 ? 'nd' : year === 3 ? 'rd' : 'th'} Year`,
                  }))}
                  placeholder="Select your year of study"
                  value={values.yearOfStudy}
                  onChange={(event) => update('yearOfStudy', event.target.value)}
                />
              </Field>
            </div>
          )}
        </div>
      </StepShell>
    </form>
  );
}
