'use client';

import { useMemo } from 'react';
import { Plus, Trash } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Field } from '@/components/ui/field';
import { MAX_STUDY_PREFERENCES } from '@/lib/validation/student';
import type { CatalogInstitution, CatalogProgramme } from '@/services/catalog';
import { cn } from '@/lib/utils';

export type DraftPreference = { programmeId: string | null; institutionId: string | null };

/**
 * The study-preference editor.
 *
 * A preference is a course PAIRED WITH the institution it would be studied at —
 * never two independent lists — because the matching engine scores both halves
 * of the same pair. Up to six may be added, and the pair must be unique.
 */
export function StudyPreferenceEditor({
  preferences,
  onChange,
  catalog,
  errors = {},
}: {
  preferences: DraftPreference[];
  onChange: (preferences: DraftPreference[]) => void;
  catalog: { institutions: CatalogInstitution[]; programmes: CatalogProgramme[] };
  errors?: Record<string, string>;
}) {
  const institutionItems = useMemo(
    () =>
      catalog.institutions.map((institution) => ({
        value: institution.id,
        label: institution.name,
        sublabel: institution.city,
      })),
    [catalog.institutions],
  );

  const programmeItems = useMemo(
    () => catalog.programmes.map((programme) => ({ value: programme.id, label: programme.name })),
    [catalog.programmes],
  );

  function update(index: number, patch: Partial<DraftPreference>) {
    onChange(preferences.map((preference, i) => (i === index ? { ...preference, ...patch } : preference)));
  }

  function remove(index: number) {
    onChange(preferences.filter((_, i) => i !== index));
  }

  function add() {
    if (preferences.length >= MAX_STUDY_PREFERENCES) return;
    onChange([...preferences, { programmeId: null, institutionId: null }]);
  }

  /** Flag a pair the student has already chosen. */
  function isDuplicate(index: number): boolean {
    const current = preferences[index];
    if (!current.programmeId || !current.institutionId) return false;
    return preferences.some(
      (other, i) =>
        i < index &&
        other.programmeId === current.programmeId &&
        other.institutionId === current.institutionId,
    );
  }

  const atMax = preferences.length >= MAX_STUDY_PREFERENCES;

  return (
    <div className="space-y-3">
      {preferences.map((preference, index) => {
        const duplicate = isDuplicate(index);
        return (
          <div
            key={index}
            className={cn(
              'rounded-card border bg-white p-4',
              duplicate ? 'border-danger-100 bg-danger-50/40' : 'border-line',
            )}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[13px] font-semibold text-ink">Preference {index + 1}</p>
              {preferences.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(index)}
                  aria-label={`Remove preference ${index + 1}`}
                  className="rounded-md p-1 text-ink-300 transition-colors hover:bg-danger-50 hover:text-danger-600"
                >
                  <Trash className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="space-y-3">
              <Field label="Course / Programme" error={errors[`preferences.${index}.programmeId`]}>
                <Combobox
                  items={programmeItems}
                  value={preference.programmeId}
                  onChange={(value) => update(index, { programmeId: value })}
                  placeholder="Search courses"
                  ariaLabel={`Course for preference ${index + 1}`}
                  invalid={Boolean(errors[`preferences.${index}.programmeId`])}
                />
              </Field>

              <Field label="Institution" error={errors[`preferences.${index}.institutionId`]}>
                <Combobox
                  items={institutionItems}
                  value={preference.institutionId}
                  onChange={(value) => update(index, { institutionId: value })}
                  placeholder="Search institutions"
                  ariaLabel={`Institution for preference ${index + 1}`}
                  invalid={Boolean(errors[`preferences.${index}.institutionId`])}
                />
              </Field>
            </div>

            {duplicate && (
              <p role="alert" className="mt-2.5 text-[13px] font-medium text-danger-600">
                You’ve already added this course and institution combination.
              </p>
            )}
          </div>
        );
      })}

      <Button
        type="button"
        variant="outline"
        fullWidth
        onClick={add}
        disabled={atMax}
        leadingIcon={<Plus className="h-4 w-4" />}
        className="border-dashed"
      >
        Add another preference
      </Button>

      <p className="text-center text-xs text-ink-400">
        {atMax
          ? `You’ve reached the maximum of ${MAX_STUDY_PREFERENCES} preferences`
          : `You can add up to ${MAX_STUDY_PREFERENCES} preferences`}
      </p>
    </div>
  );
}
