'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Radio } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

export type ChoiceOption<T extends string> = { value: T; label: string; description?: string };

/**
 * Multi-select checkbox list with an optional cap, and support for exclusive
 * options such as "None" that clear every other choice when picked.
 */
export function CheckboxGroup<T extends string>({
  options,
  values,
  onChange,
  max,
  exclusive = [],
  columns = 1,
  className,
  name,
}: {
  options: ChoiceOption<T>[];
  values: T[];
  onChange: (values: T[]) => void;
  max?: number;
  exclusive?: T[];
  columns?: 1 | 2;
  className?: string;
  name?: string;
}) {
  function toggle(value: T) {
    const isExclusive = exclusive.includes(value);

    if (values.includes(value)) {
      onChange(values.filter((v) => v !== value));
      return;
    }

    if (isExclusive) {
      onChange([value]);
      return;
    }

    const withoutExclusives = values.filter((v) => !exclusive.includes(v));
    if (max && withoutExclusives.length >= max) return;
    onChange([...withoutExclusives, value]);
  }

  const selectable = values.filter((v) => !exclusive.includes(v)).length;

  return (
    <div className={cn('grid gap-2.5', columns === 2 && 'sm:grid-cols-2', className)}>
      {options.map((option) => {
        const checked = values.includes(option.value);
        const blocked =
          Boolean(max) && !checked && !exclusive.includes(option.value) && selectable >= max!;
        return (
          <Checkbox
            key={option.value}
            name={name}
            value={option.value}
            checked={checked}
            disabled={blocked}
            onChange={() => toggle(option.value)}
            label={option.label}
            description={option.description}
          />
        );
      })}
    </div>
  );
}

/** Single-select radio list. */
export function RadioGroup<T extends string>({
  options,
  value,
  onChange,
  name,
  columns = 1,
  className,
  legend,
}: {
  options: ChoiceOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  name: string;
  columns?: 1 | 2;
  className?: string;
  legend?: string;
}) {
  return (
    <fieldset className={className}>
      {legend && <legend className="sr-only">{legend}</legend>}
      <div className={cn('grid gap-2.5', columns === 2 && 'sm:grid-cols-2')}>
        {options.map((option) => (
          <Radio
            key={option.value}
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            label={option.label}
            description={option.description}
          />
        ))}
      </div>
    </fieldset>
  );
}
