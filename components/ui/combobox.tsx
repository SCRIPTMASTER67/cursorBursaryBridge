'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, X } from '@/components/icons';
import { cn } from '@/lib/utils';
import { controlBorder, controlBorderError } from './field';

export type ComboboxItem = { value: string; label: string; sublabel?: string };

/**
 * Searchable single-select backed by the standardised catalogue.
 *
 * Implements the ARIA combobox pattern: the trigger owns the listbox, options
 * are reachable with the arrow keys, and Enter/Escape behave as expected.
 */
export function Combobox({
  items,
  value,
  onChange,
  placeholder = 'Search and select…',
  emptyMessage = 'No matches found',
  invalid,
  disabled,
  className,
  name,
  ariaLabel,
}: {
  items: ComboboxItem[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  emptyMessage?: string;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
  name?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const selected = useMemo(() => items.find((item) => item.value === value) ?? null, [items, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 60);
    return items
      .filter(
        (item) =>
          item.label.toLowerCase().includes(q) || item.sublabel?.toLowerCase().includes(q),
      )
      .slice(0, 60);
  }, [items, query]);

  // Close when focus or a click leaves the component.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else setQuery('');
  }, [open]);

  useEffect(() => setActiveIndex(0), [query]);

  function commit(item: ComboboxItem) {
    onChange(item.value);
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) return setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter') {
      if (!open) return;
      event.preventDefault();
      const item = filtered[activeIndex];
      if (item) commit(item);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {name && <input type="hidden" name={name} value={value ?? ''} />}

      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        className={cn(
          'flex h-11 w-full items-center justify-between gap-2 rounded-field border bg-white px-3.5 text-left text-sm transition-colors',
          invalid ? controlBorderError : controlBorder,
          disabled && 'cursor-not-allowed bg-surface-subtle text-ink-300',
        )}
      >
        <span className={cn('truncate', selected ? 'text-ink' : 'text-ink-300')}>
          {selected?.label ?? placeholder}
        </span>
        <span className="flex items-center gap-1">
          {selected && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Clear selection"
              onClick={(event) => {
                event.stopPropagation();
                onChange(null);
              }}
              className="rounded p-0.5 text-ink-300 hover:bg-surface-subtle hover:text-ink-600"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown className="h-4 w-4 shrink-0 text-ink-400" />
        </span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1.5 w-full rounded-field border border-line bg-white shadow-float">
          <div className="border-b border-line p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
              <input
                ref={inputRef}
                type="text"
                role="combobox"
                aria-expanded="true"
                aria-controls={listboxId}
                aria-autocomplete="list"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Type to search…"
                className="h-9 w-full rounded-md border-0 bg-surface-subtle pl-8 pr-2 text-sm text-ink
                           placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-brand-600"
              />
            </div>
          </div>

          <ul id={listboxId} role="listbox" className="max-h-64 overflow-y-auto p-1.5">
            {filtered.length === 0 && (
              <li className="px-3 py-6 text-center text-[13px] text-ink-400">{emptyMessage}</li>
            )}
            {filtered.map((item, index) => {
              const isSelected = item.value === value;
              return (
                <li key={item.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => commit(item)}
                    className={cn(
                      'flex w-full flex-col items-start rounded-md px-3 py-2 text-left transition-colors',
                      index === activeIndex && 'bg-surface-subtle',
                      isSelected && 'bg-brand-50',
                    )}
                  >
                    <span className={cn('text-[13px]', isSelected ? 'font-semibold text-brand-700' : 'text-ink')}>
                      {item.label}
                    </span>
                    {item.sublabel && <span className="text-xs text-ink-400">{item.sublabel}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Multi-select variant used by funders to pick supported institutions and
 * courses when defining eligibility.
 */
export function MultiCombobox({
  items,
  values,
  onChange,
  placeholder = 'Search and select…',
  emptyMessage = 'No matches found',
  className,
  ariaLabel,
  max,
}: {
  items: ComboboxItem[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
  ariaLabel?: string;
  max?: number;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const selectedItems = useMemo(
    () => values.map((v) => items.find((i) => i.value === v)).filter(Boolean) as ComboboxItem[],
    [items, values],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? items.filter((i) => i.label.toLowerCase().includes(q) || i.sublabel?.toLowerCase().includes(q))
      : items;
    return base.slice(0, 60);
  }, [items, query]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  function toggle(value: string) {
    if (values.includes(value)) {
      onChange(values.filter((v) => v !== value));
    } else {
      if (max && values.length >= max) return;
      onChange([...values, value]);
    }
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div
        className={cn(
          'flex min-h-[44px] w-full flex-wrap items-center gap-1.5 rounded-field border bg-white px-2.5 py-2',
          controlBorder,
        )}
      >
        {selectedItems.map((item) => (
          <span
            key={item.value}
            className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700"
          >
            {item.label}
            <button
              type="button"
              onClick={() => toggle(item.value)}
              aria-label={`Remove ${item.label}`}
              className="rounded text-brand-400 hover:text-brand-700"
            >
              <X className="h-3 w-3" strokeWidth={2.4} />
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={ariaLabel}
          className="flex-1 py-0.5 text-left text-sm text-ink-300 hover:text-ink-400"
        >
          {selectedItems.length === 0 ? placeholder : 'Add another…'}
        </button>
      </div>

      {open && (
        <div className="absolute z-30 mt-1.5 w-full rounded-field border border-line bg-white shadow-float">
          <div className="border-b border-line p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Type to search…"
                className="h-9 w-full rounded-md border-0 bg-surface-subtle pl-8 pr-2 text-sm
                           placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-brand-600"
              />
            </div>
          </div>
          <ul id={listboxId} role="listbox" aria-multiselectable className="max-h-64 overflow-y-auto p-1.5">
            {filtered.length === 0 && (
              <li className="px-3 py-6 text-center text-[13px] text-ink-400">{emptyMessage}</li>
            )}
            {filtered.map((item) => {
              const isSelected = values.includes(item.value);
              const blocked = Boolean(max) && !isSelected && values.length >= max!;
              return (
                <li key={item.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={blocked}
                    onClick={() => toggle(item.value)}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-[13px] transition-colors hover:bg-surface-subtle',
                      isSelected && 'bg-brand-50 font-semibold text-brand-700',
                      blocked && 'cursor-not-allowed opacity-40',
                    )}
                  >
                    <span className="truncate">{item.label}</span>
                    {isSelected && <span className="text-brand-600">✓</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
