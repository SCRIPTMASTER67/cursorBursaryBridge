'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { LetterStatus } from '@prisma/client';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/modal';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { Check, Download, Refresh, Share, Spinner, Trash } from '@/components/icons';
import { QUESTIONS } from '@/lib/letters/questions';
import type { LetterAnswers, LetterGap } from '@/lib/letters/types';

/**
 * Editing a letter.
 *
 * The student's own text is the source of truth once they have touched it, so
 * regenerating — which throws that away — asks first. Everything else saves
 * what is in the box, exactly as typed.
 */

export function LetterEditor({
  letter,
  gaps,
}: {
  letter: {
    id: string;
    title: string;
    content: string;
    status: LetterStatus;
    opportunityName: string;
    organisationName: string;
    editedByStudent: boolean;
    answers: LetterAnswers;
    generator: string | null;
    opportunityHref: string | null;
  };
  gaps: LetterGap[];
}) {
  const router = useRouter();
  const toast = useToast();

  const [title, setTitle] = useState(letter.title);
  const [content, setContent] = useState(letter.content);
  const [answers, setAnswers] = useState<LetterAnswers>(letter.answers);
  const [status, setStatus] = useState<LetterStatus>(letter.status);
  const [busy, setBusy] = useState<null | 'save' | 'regenerate' | 'ready' | 'delete'>(null);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = content !== letter.content || title !== letter.title;
  const words = content.trim().split(/\s+/).filter(Boolean).length;

  async function patch(body: Record<string, unknown>, kind: 'save' | 'regenerate' | 'ready') {
    setBusy(kind);
    setError(null);
    try {
      const response = await fetch(`/api/student/letters/${letter.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? 'That did not save. Try again.');
        return null;
      }
      return data;
    } catch {
      setError('That did not save. Check your connection and try again.');
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    const data = await patch({ action: 'SAVE', content, title }, 'save');
    if (!data) return;
    toast.push('success', 'Letter saved.');
    router.refresh();
  }

  async function regenerate() {
    setConfirmRegenerate(false);
    const data = await patch({ action: 'REGENERATE', answers }, 'regenerate');
    if (!data) return;
    setContent(data.letter.content);
    setStatus(data.letter.status);
    toast.push('success', 'Rewritten from your answers.');
    router.refresh();
  }

  async function markReady() {
    const next = status === 'READY' ? 'DRAFT' : 'READY';
    const data = await patch({ action: 'SAVE', content, title, status: next }, 'ready');
    if (!data) return;
    setStatus(next);
    toast.push('success', next === 'READY' ? 'Marked as ready to send.' : 'Moved back to draft.');
    router.refresh();
  }

  async function remove() {
    setBusy('delete');
    try {
      const response = await fetch(`/api/student/letters/${letter.id}`, { method: 'DELETE' });
      if (!response.ok) {
        setError('That letter could not be deleted.');
        return;
      }
      toast.push('success', 'Letter deleted.');
      router.push('/student/letters');
      router.refresh();
    } finally {
      setBusy(null);
      setConfirmDelete(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      toast.push('success', 'Letter copied to your clipboard.');
    } catch {
      toast.push('error', 'Your browser would not let us copy. Select the text and copy it.');
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.8fr_1fr] lg:items-start [&>*]:min-w-0">
      <div className="space-y-5">
        {error && (
          <Alert tone="danger" title="That did not work">
            {error}
          </Alert>
        )}

        <Card>
          <CardHeader
            title="Your letter"
            description="Edit it freely. What is in this box is what gets downloaded."
          />
          <CardBody className="space-y-4">
            <Field
              label="Title"
              description="For your own reference. It is not part of the letter."
            >
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={200}
              />
            </Field>

            <Field label="Letter">
              <Textarea
                rows={26}
                value={content}
                maxLength={20000}
                onChange={(event) => setContent(event.target.value)}
                className="font-serif text-[14px] leading-7"
              />
            </Field>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[13px] text-ink-400">
                {words} words{dirty ? ' · unsaved changes' : ''}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={copy}>
                  <Share className="h-4 w-4" />
                  Copy
                </Button>
                <ButtonLink href={`/api/student/letters/${letter.id}/pdf`} variant="outline">
                  <Download className="h-4 w-4" />
                  Download PDF
                </ButtonLink>
                <Button onClick={save} disabled={busy !== null || !dirty}>
                  {busy === 'save' ? <Spinner className="h-4 w-4" /> : null}
                  Save
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* --------------------------------------------------------- Sidebar */}
      <div className="space-y-5">
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-400">
                Written for
              </p>
              <p className="mt-1 text-[14px] font-semibold text-ink">{letter.opportunityName}</p>
              <p className="text-[13px] text-ink-500">{letter.organisationName}</p>
            </div>
            <Badge tone={status === 'READY' ? 'success' : 'neutral'}>
              {status === 'READY' ? 'Ready' : 'Draft'}
            </Badge>
          </div>

          {letter.opportunityHref && (
            <ButtonLink href={letter.opportunityHref} variant="outline" fullWidth className="mt-4">
              View this bursary
            </ButtonLink>
          )}

          <Button
            variant={status === 'READY' ? 'ghost' : 'secondary'}
            fullWidth
            className="mt-2.5"
            onClick={markReady}
            disabled={busy !== null}
          >
            {busy === 'ready' ? <Spinner className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            {status === 'READY' ? 'Move back to draft' : 'Mark as ready to send'}
          </Button>
        </Card>

        <Card>
          <CardHeader
            title="Your answers"
            description="Change what you said and rewrite the draft from it."
          />
          <CardBody className="space-y-4">
            {QUESTIONS.map((question) => (
              <Field key={question.key} label={question.label} optional>
                <Textarea
                  rows={2}
                  maxLength={2000}
                  value={answers[question.key] ?? ''}
                  onChange={(event) =>
                    setAnswers((current) => ({ ...current, [question.key]: event.target.value }))
                  }
                />
              </Field>
            ))}

            <Button
              variant="outline"
              fullWidth
              disabled={busy !== null}
              onClick={() => (letter.editedByStudent ? setConfirmRegenerate(true) : regenerate())}
            >
              {busy === 'regenerate' ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <Refresh className="h-4 w-4" />
              )}
              Rewrite from my answers
            </Button>
          </CardBody>
        </Card>

        {gaps.length > 0 && (
          <Alert tone="info" title="This letter could say more">
            <ul className="mt-1 space-y-1.5">
              {gaps.map((gap) => (
                <li key={`${gap.key}-${gap.question}`}>
                  <span className="font-medium">{gap.question}</span> — {gap.because}
                </li>
              ))}
            </ul>
          </Alert>
        )}

        <Card className="p-5">
          <p className="text-[13px] leading-6 text-ink-500">
            This draft was assembled from your profile and the answers you gave — nothing in it was
            invented. Read it before you send it, and change anything that does not sound like you.
          </p>
        </Card>

        <Button
          variant="ghost"
          fullWidth
          onClick={() => setConfirmDelete(true)}
          disabled={busy !== null}
          className="text-danger-600 hover:bg-danger-50"
        >
          <Trash className="h-4 w-4" />
          Delete this letter
        </Button>
      </div>

      <ConfirmDialog
        open={confirmRegenerate}
        title="Replace your edits?"
        message="You have edited this letter yourself. Rewriting it from your answers will replace everything in the box, and your edits cannot be recovered."
        confirmLabel="Replace it"
        tone="danger"
        onConfirm={regenerate}
        onClose={() => setConfirmRegenerate(false)}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this letter?"
        message="The letter and the answers behind it are removed. This cannot be undone."
        confirmLabel="Delete"
        tone="danger"
        onConfirm={remove}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  );
}
