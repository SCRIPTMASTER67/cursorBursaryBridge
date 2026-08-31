'use client';

import { useRouter } from 'next/navigation';
import { StepShell } from '@/components/onboarding/step-shell';
import { SummarySections } from '@/components/student/summary-sections';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useFormSubmit } from '@/hooks/use-form-submit';
import { corporateSteps } from '@/lib/onboarding-steps';
import type { SummarySection } from '@/services/student-summary';

const stepLabels = corporateSteps.map((s) => s.label);

/** Corporate step 5 — Review, then create the organisation. */
export function OrganisationReviewPanel({ sections }: { sections: SummarySection[] }) {
  const router = useRouter();
  const { submitting, error, submit } = useFormSubmit<{ redirectTo: string }>();

  async function finish() {
    await submit(
      '/api/corporate/onboarding',
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
      step={5}
      totalSteps={corporateSteps.length}
      stepLabels={stepLabels}
      backHref="/onboarding/organisation/process"
      title="Review your organisation"
      description="Check everything is correct. You can change any of it later from your Organisation page."
      wide
      footer={
        <Button fullWidth size="lg" loading={submitting} onClick={finish}>
          Create Organisation
        </Button>
      }
    >
      {error && <Alert tone="danger" className="mb-5">{error}</Alert>}
      <SummarySections sections={sections} />
    </StepShell>
  );
}
