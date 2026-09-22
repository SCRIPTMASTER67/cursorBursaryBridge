'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Download, ExternalLink, FileText, Sparkles, X } from '@/components/icons';
import { formatDate } from '@/lib/utils';

/**
 * The official application form, and the offer that follows it.
 *
 * Two things this is careful about.
 *
 * First, whose form it is. The panel says the funder's name on the button and
 * again underneath, because a student who downloads a form from inside
 * Bursary-Bridge must not come away thinking Bursary-Bridge wrote it.
 *
 * Second, Auto-Fill is offered, never imposed. The suggestion appears after a
 * download, it can be dismissed, and downloading the form never routes through
 * it. A student who just wants the PDF gets the PDF.
 */

export type FormRow = {
  id: string;
  name: string;
  fileType: string;
  sizeBytes: number | null;
  providedBy: string;
  /** True when Bursary-Bridge holds a copy; false when it only links to it. */
  mirrored: boolean;
  fileUrl: string;
  sourceUrl: string;
  lastVerifiedAt: string | null;
};

export function ApplicationFormPanel({
  forms,
  applicationUrl,
  closed,
}: {
  forms: FormRow[];
  applicationUrl: string | null;
  closed: boolean;
}) {
  const [downloaded, setDownloaded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (forms.length === 0) {
    return (
      <Card>
        <CardHeader
          title="Application form"
          description="No official application form has been recorded for this opportunity."
        />
        <CardBody>
          <p className="text-sm text-ink-600">
            {applicationUrl
              ? 'This funder takes applications through their own website rather than a downloadable form.'
              : 'Check the source for how to apply. We do not host a form we have not been given.'}
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Application form"
        description="Published by the funder. Bursary-Bridge did not write it and does not process it."
      />
      <CardBody className="grid gap-4">
        {forms.map((form) => (
          <div key={form.id} className="rounded-field border border-line bg-surface-muted p-4">
            <div className="flex items-start gap-3">
              <FileText className="mt-0.5 h-[18px] w-[18px] shrink-0 text-ink-400" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{form.name}</p>
                <p className="mt-0.5 text-[13px] text-ink-600">
                  Official application form provided by {form.providedBy}
                </p>
                <p className="mt-0.5 text-2xs text-ink-400">
                  {form.fileType.toUpperCase()}
                  {form.sizeBytes ? ` · ${(form.sizeBytes / 1024).toFixed(0)} KB` : ''}
                  {form.lastVerifiedAt ? ` · checked ${formatDate(form.lastVerifiedAt)}` : ''}
                </p>
              </div>
              <Badge tone={form.mirrored ? 'neutral' : 'info'}>
                {form.mirrored ? 'Stored copy' : 'On the funder’s site'}
              </Badge>
            </div>

            {/* The suggestion follows a download rather than pre-empting it, so a
                student who only wants the PDF is never routed through a feature
                they did not ask for. */}
            <div className="mt-3.5 flex flex-wrap gap-2" onClick={() => setDownloaded(true)}>
              {form.mirrored ? (
                <ButtonLink
                  href={`/api/student/bursaries/forms/${form.id}/download`}
                  size="sm"
                  leadingIcon={<Download className="h-4 w-4" />}
                >
                  Download application form
                </ButtonLink>
              ) : (
                <ButtonLink
                  href={form.fileUrl}
                  external
                  size="sm"
                  leadingIcon={<Download className="h-4 w-4" />}
                >
                  Get the form from {form.providedBy}
                </ButtonLink>
              )}
              <ButtonLink
                href={form.sourceUrl}
                external
                variant="outline"
                size="sm"
                trailingIcon={<ExternalLink className="h-4 w-4" />}
              >
                Where this came from
              </ButtonLink>
            </div>
          </div>
        ))}

        {closed && (
          <p className="text-[13px] text-ink-500">
            Applications are closed for this cycle. The form is still here so you can see what is
            asked for and be ready next time.
          </p>
        )}

        {/* Offered after the download, dismissable, and never in the way of it. */}
        {downloaded && !dismissed && (
          <div className="rounded-field border border-brand-100 bg-brand-50 p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-[18px] w-[18px] shrink-0 text-brand-600" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">Want to save time?</p>
                <p className="mt-1 text-[13px] text-ink-700">
                  If you have already completed a bursary form, Auto-Fill can copy what the forms
                  have in common into this one. You check every field before you download it, and it
                  never fills in anything it is unsure about.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <ButtonLink
                    href="/student/auto-fill"
                    size="sm"
                    leadingIcon={<Sparkles className="h-4 w-4" />}
                  >
                    Use Auto-Fill
                  </ButtonLink>
                  <Button variant="ghost" size="sm" onClick={() => setDismissed(true)}>
                    No thanks
                  </Button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                aria-label="Dismiss the Auto-Fill suggestion"
                className="shrink-0 rounded-md p-1 text-ink-400 hover:bg-white hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        <p className="text-2xs text-ink-400">
          Bursary-Bridge links to or stores the form exactly as the funder published it.{' '}
          <Link
            href={forms[0].sourceUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="underline"
          >
            Check the source
          </Link>{' '}
          if you think it has changed.
        </p>
      </CardBody>
    </Card>
  );
}
