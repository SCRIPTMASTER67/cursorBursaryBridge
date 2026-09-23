'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ResultKind, SubjectLevel } from '@prisma/client';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { ConfirmDialog } from '@/components/ui/modal';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { ChevronDown, ChevronUp, Plus, Trash, Award } from '@/components/icons';
import { cn } from '@/lib/utils';

/**
 * Subject and module results.
 *
 * Built like Study Preferences: rows the student adds one at a time, reorders,
 * edits and removes, with no fixed number of them.
 *
 * Two things this is careful about. A result may be entered without a mark —
 * knowing you take Mathematics but not yet what you got is a real state, and
 * storing it as a zero would tell a funder something false. And the subject
 * comes from a shared list wherever possible, because a bursary requiring
 * "Mathematics" has to find a result recorded against the same entry; a
 * student may still type their own, and it is kept and marked as theirs.
 */

export type ResultRow = {
  id: string;
  percentage: number | null;
  grade: string | null;
  year: number;
  term: string | null;
  kind: ResultKind;
  level: SubjectLevel;
  subject: { id: string; name: string; custom: boolean };
};

export type SubjectOption = { id: string; name: string; custom: boolean };

export type Vocabulary = { singular: string; plural: string; heading: string };

const KINDS: { value: ResultKind; label: string }[] = [
  { value: 'LATEST', label: 'Latest available' },
  { value: 'CURRENT', label: 'Current result' },
  { value: 'FINAL', label: 'Final result' },
  { value: 'PREDICTED', label: 'Predicted result' },
];

export function ResultsManager({
  initial,
  subjects,
  level,
  vocabulary,
  matchedRequirements,
}: {
  initial: ResultRow[];
  subjects: SubjectOption[];
  level: SubjectLevel;
  vocabulary: Vocabulary;
  matchedRequirements: {
    subjectName: string;
    minimumPercentage: number;
    programmeName: string;
    organisationName: string;
    slug: string;
  }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [rows, setRows] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ResultRow | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const response = await fetch('/api/student/results', { cache: 'no-store' });
    if (response.ok) {
      const payload = (await response.json()) as { results: ResultRow[] };
      setRows(payload.results);
    }
    // The matching engine reads these, so the rest of the page re-renders too.
    router.refresh();
  }

  async function move(index: number, direction: -1 | 1) {
    const next = [...rows];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setRows(next);
    await fetch('/api/student/results', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: next.map((r) => r.id) }),
    });
  }

  async function remove() {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/student/results/${pendingDelete.id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        toast.push('success', `${pendingDelete.subject.name} removed.`);
        setPendingDelete(null);
        await refresh();
      } else {
        toast.push('error', 'Could not remove that result.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader
          title={vocabulary.heading}
          description={`Add each ${vocabulary.singular} and the result you achieved. Bursaries that ask for a specific ${vocabulary.singular} result are checked against these.`}
          action={
            !adding && (
              <Button
                size="sm"
                onClick={() => setAdding(true)}
                leadingIcon={<Plus className="h-4 w-4" />}
              >
                Add {vocabulary.singular}
              </Button>
            )
          }
        />
        <CardBody className={rows.length === 0 && !adding ? '' : 'p-0'}>
          {adding && (
            <div className="border-b border-line p-4">
              <ResultForm
                subjects={subjects}
                level={level}
                vocabulary={vocabulary}
                onCancel={() => setAdding(false)}
                onSaved={async () => {
                  setAdding(false);
                  await refresh();
                  toast.push('success', `${vocabulary.singular} added.`);
                }}
              />
            </div>
          )}

          {rows.length === 0 && !adding ? (
            <EmptyState
              icon={<Award className="h-5 w-5" />}
              title={`No ${vocabulary.plural} yet`}
              description={`Add your ${vocabulary.plural} and results so we can check them against bursaries that require specific marks.`}
              action={
                <Button onClick={() => setAdding(true)} leadingIcon={<Plus className="h-4 w-4" />}>
                  Add your first {vocabulary.singular}
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              {rows.map((row, index) => (
                <li key={row.id}>
                  {editing === row.id ? (
                    <div className="p-4">
                      <ResultForm
                        row={row}
                        subjects={subjects}
                        level={level}
                        vocabulary={vocabulary}
                        onCancel={() => setEditing(null)}
                        onSaved={async () => {
                          setEditing(null);
                          await refresh();
                          toast.push('success', 'Result updated.');
                        }}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 px-5 py-3.5">
                      <div className="flex shrink-0 flex-col">
                        <button
                          type="button"
                          onClick={() => move(index, -1)}
                          disabled={index === 0}
                          aria-label={`Move ${row.subject.name} up`}
                          className="rounded p-0.5 text-ink-400 hover:bg-surface-subtle disabled:opacity-30"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => move(index, 1)}
                          disabled={index === rows.length - 1}
                          aria-label={`Move ${row.subject.name} down`}
                          className="rounded p-0.5 text-ink-400 hover:bg-surface-subtle disabled:opacity-30"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink">
                          {row.subject.name}
                          {row.subject.custom && (
                            <Badge tone="neutral" className="ml-2">
                              Your own
                            </Badge>
                          )}
                        </p>
                        <p className="text-[13px] text-ink-500">
                          {row.year}
                          {row.term ? ` · ${row.term}` : ''} ·{' '}
                          {KINDS.find((k) => k.value === row.kind)?.label ?? row.kind}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        {row.percentage !== null ? (
                          <span className="text-[15px] font-semibold tabular-nums text-ink">
                            {row.percentage}%
                          </span>
                        ) : row.grade ? (
                          <span className="text-[15px] font-semibold text-ink">{row.grade}</span>
                        ) : (
                          // Not a zero. The student has the subject but not the mark.
                          <span className="text-[13px] italic text-ink-400">No result yet</span>
                        )}
                      </div>

                      <div className="flex shrink-0 gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setEditing(row.id)}>
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setPendingDelete(row)}>
                          <Trash className="h-4 w-4" />
                          <span className="sr-only">Remove {row.subject.name}</span>
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* Entering a result has to visibly do something, or it is a form nobody
          sees the point of filling in. */}
      {matchedRequirements.length > 0 && (
        <Card>
          <CardHeader
            title="Bursaries that check these results"
            description="These opportunities name a subject you have entered."
          />
          <CardBody className="p-0">
            <ul className="divide-y divide-line">
              {matchedRequirements.map((requirement, index) => {
                const row = rows.find((r) => r.subject.name === requirement.subjectName);
                const mark = row?.percentage ?? null;
                const meets = mark !== null && mark >= requirement.minimumPercentage;
                return (
                  <li key={index} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <a
                        href={`/student/bursaries/${requirement.slug}`}
                        className="text-sm font-medium text-ink hover:text-brand-600"
                      >
                        {requirement.programmeName}
                      </a>
                      <p className="text-[13px] text-ink-500">{requirement.organisationName}</p>
                    </div>
                    <p className={cn('text-[13px]', meets ? 'text-success-600' : 'text-ink-600')}>
                      {requirement.subjectName} ≥ {requirement.minimumPercentage}%
                      {mark !== null && (
                        <span className="ml-1.5 font-semibold">
                          {meets ? `— yours is ${mark}%` : `— yours is ${mark}%`}
                        </span>
                      )}
                    </p>
                    <Badge tone={mark === null ? 'neutral' : meets ? 'success' : 'warning'}>
                      {mark === null ? 'Add your result' : meets ? 'Met' : 'Not met'}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={remove}
        loading={busy}
        title={`Remove ${pendingDelete?.subject.name ?? ''}?`}
        message="This result will no longer be used when we check bursary requirements."
        confirmLabel="Remove"
      />
    </div>
  );
}

function ResultForm({
  row,
  subjects,
  level,
  vocabulary,
  onCancel,
  onSaved,
}: {
  row?: ResultRow;
  subjects: SubjectOption[];
  level: SubjectLevel;
  vocabulary: Vocabulary;
  onCancel: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const thisYear = new Date().getFullYear();
  const [subjectId, setSubjectId] = useState(row?.subject.id ?? '');
  const [customName, setCustomName] = useState(row?.subject.custom ? row.subject.name : '');
  const [useCustom, setUseCustom] = useState(Boolean(row?.subject.custom));
  const [percentage, setPercentage] = useState(row?.percentage?.toString() ?? '');
  const [grade, setGrade] = useState(row?.grade ?? '');
  const [year, setYear] = useState(String(row?.year ?? thisYear));
  const [term, setTerm] = useState(row?.term ?? '');
  const [kind, setKind] = useState<ResultKind>(row?.kind ?? 'LATEST');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const body = {
        ...(useCustom ? { subjectName: customName } : { subjectId }),
        // An empty box means "no mark yet", not zero.
        percentage: percentage.trim() === '' ? null : Number(percentage),
        grade: grade.trim() || undefined,
        year: Number(year),
        term: term.trim() || undefined,
        kind,
        level,
      };
      const response = await fetch(
        row ? `/api/student/results/${row.id}` : '/api/student/results',
        {
          method: row ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        fields?: Record<string, string>;
      };
      if (!response.ok) {
        setError(payload.fields?.subjectName ?? payload.error ?? 'Could not save that result.');
        return;
      }
      await onSaved();
    } catch {
      setError('Could not reach Bursary-Bridge. Check your connection.');
    } finally {
      setBusy(false);
    }
  }

  const ready =
    (useCustom ? customName.trim().length >= 2 : Boolean(subjectId)) && year.length === 4;

  return (
    <div className="grid gap-3.5">
      {error && <Alert tone="danger">{error}</Alert>}

      <Field label={vocabulary.singular === 'module' ? 'Module' : 'Subject'} required>
        {useCustom ? (
          <div className="grid gap-1.5">
            <Input
              value={customName}
              onChange={(event) => setCustomName(event.target.value)}
              placeholder={
                vocabulary.singular === 'module' ? 'e.g. Distributed Systems' : 'e.g. Mathematics'
              }
              autoFocus
            />
            {subjects.length > 0 && (
              <button
                type="button"
                onClick={() => setUseCustom(false)}
                className="self-start text-[13px] font-medium text-brand-600"
              >
                Choose from the list instead
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-1.5">
            <Combobox
              items={subjects.map((s) => ({ value: s.id, label: s.name }))}
              value={subjectId}
              onChange={(value) => setSubjectId(value ?? '')}
              placeholder={`Search ${vocabulary.plural}`}
              ariaLabel={`Choose a ${vocabulary.singular}`}
            />
            <button
              type="button"
              onClick={() => setUseCustom(true)}
              className="self-start text-[13px] font-medium text-brand-600"
            >
              My {vocabulary.singular} is not listed
            </button>
          </div>
        )}
      </Field>

      <div className="grid gap-3.5 sm:grid-cols-3">
        <Field label="Result (%)" optional hint="Leave empty if you do not have it yet">
          <Input
            type="number"
            min={0}
            max={100}
            value={percentage}
            onChange={(event) => setPercentage(event.target.value)}
            placeholder="78"
          />
        </Field>
        <Field label="Grade or symbol" optional>
          <Input value={grade} onChange={(event) => setGrade(event.target.value)} placeholder="B" />
        </Field>
        <Field label="Year" required>
          <Input
            type="number"
            min={1990}
            max={thisYear + 6}
            value={year}
            onChange={(event) => setYear(event.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2">
        {level === 'TERTIARY' && (
          <Field label="Semester or term" optional>
            <Input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Semester 1"
            />
          </Field>
        )}
        <Field label="Result type" optional>
          <Select
            value={kind}
            onChange={(event) => setKind(event.target.value as ResultKind)}
            options={KINDS.map((k) => ({ value: k.value, label: k.label }))}
          />
        </Field>
      </div>

      <div className="flex gap-2">
        <Button onClick={save} loading={busy} disabled={!ready}>
          {row ? 'Save changes' : `Add ${vocabulary.singular}`}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
