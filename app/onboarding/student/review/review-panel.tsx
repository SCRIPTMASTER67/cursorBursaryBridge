'use client';

import { useRouter } from 'next/navigation';
import { StepShell } from '@/components/onboarding/step-shell';
import { SummarySections } from '@/components/student/summary-sections';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useFormSubmit } from '@/hooks/use-form-submit';
import { studentSteps } from '@/lib/onboarding-steps';
import type { SummarySection } from '@/services/student-summary';

const stepLabels = studentSteps.map((s) => s.label);

/** Step 7 — Review, then unlock the dashboard. */
export function ReviewPanel({ sections }: { sections: SummarySection[] }) {
  const router = useRouter();
  const { submitting, error, submit } = useFormSubmit<{ redirectTo: string }>();

  async function finish() {
    await submit(
      '/api/student/onboarding',
      { step: 'review', data: { confirm: true } },
      {
        onSuccess: (data) => {
          router.push(data.redirectTo);
          router.refresh();
        },
      },
    );
  }

  return (
    <StepShell
      step={7}
      totalSteps={studentSteps.length}
      stepLabels={stepLabels}
      backHref="/onboarding/student/location"
      title="Review your profile"
      description="Please review your information before we find opportunities for you. You can change anything later from your profile."
      wide
      footer={
        <Button fullWidth size="lg" loading={submitting} onClick={finish}>
          Find My Matches
        </Button>
      }
    >
      {error && <Alert tone="danger" className="mb-5">{error}</Alert>}
      <SummarySections sections={sections} />
    </StepShell>
  );
}
