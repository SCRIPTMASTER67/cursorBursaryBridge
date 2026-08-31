'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { SaveAndExit, StepShell } from '@/components/onboarding/step-shell';
import { StudyPreferenceEditor, type DraftPreference } from '@/components/student/study-preference-editor';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useFormSubmit } from '@/hooks/use-form-submit';
import { studentSteps } from '@/lib/onboarding-steps';
import type { CatalogInstitution, CatalogProgramme } from '@/services/catalog';

const stepLabels = studentSteps.map((s) => s.label);

/** Step 2 — Study Preferences. */
export function PreferencesForm({
  initial,
  catalog,
}: {
  initial: { preferenceNumber: number; programmeId: string; institutionId: string }[];
  catalog: { institutions: CatalogInstitution[]; programmes: CatalogProgramme[] };
}) {
  const router = useRouter();
  const { submitting, error, fieldErrors, submit } = useFormSubmit<{ redirectTo: string }>();

  const [preferences, setPreferences] = useState<DraftPreference[]>(
    initial.length > 0
      ? initial.map((p) => ({ programmeId: p.programmeId, institutionId: p.institutionId }))
      : [{ programmeId: null, institutionId: null }],
  );

  const complete = preferences.filter((p) => p.programmeId && p.institutionId);
  const hasIncomplete = preferences.some((p) => !p.programmeId || !p.institutionId);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    await submit(
      '/api/student/preferences',
      { preferences: complete },
      {
        method: 'PUT',
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
        step={2}
        totalSteps={studentSteps.length}
        stepLabels={stepLabels}
        backHref="/onboarding/student/education"
        title="What would you like to study?"
        description="Add up to 6 course and institution combinations you’re considering. Each course is paired with the institution you’d study it at, so we can match you accurately."
        footer={
          <>
            <Button type="submit" fullWidth size="lg" loading={submitting} disabled={complete.length === 0}>
              Continue
            </Button>
            <SaveAndExit />
          </>
        }
      >
        {error && <Alert tone="danger" className="mb-5">{error}</Alert>}

        {hasIncomplete && complete.length > 0 && (
          <Alert tone="info" className="mb-5">
            Preferences missing a course or an institution won’t be saved.
          </Alert>
        )}

        <StudyPreferenceEditor
          preferences={preferences}
          onChange={setPreferences}
          catalog={catalog}
          errors={fieldErrors}
        />
      </StepShell>
    </form>
  );
}
