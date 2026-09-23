'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { CareerInterest, InstitutionType, Province, QualificationLevel } from '@prisma/client';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { MultiCombobox } from '@/components/ui/combobox';
import { Select } from '@/components/ui/select';
import { Table as TableWrap, Td, Th, Tr } from '@/components/ui/table-exports';
import { useToast } from '@/components/ui/toast';
import { Building, Edit, GraduationCap, Plus, Search } from '@/components/icons';
import {
  careerInterestLabels,
  institutionTypeLabels,
  provinceLabels,
  qualificationLabels,
} from '@/lib/labels';

/**
 * Managing the catalogue every other part of the application reads from.
 *
 * Two things this is careful about.
 *
 * Nothing is deleted. An institution or course a student has chosen, or a
 * funder has written an eligibility rule against, is retired instead — the
 * record of what they chose stays intact and stops being offered to anyone new.
 *
 * A course carries the institutions that offer it. They are not two unrelated
 * lists: "Computer Science" means something different at each university that
 * teaches it, and a student choosing a pair nobody offers is choosing
 * something that does not exist.
 */

export type InstitutionRow = {
  id: string;
  name: string;
  shortName: string | null;
  type: InstitutionType;
  province: Province;
  city: string;
  website: string | null;
  code: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  inUse: number;
  offeredProgrammes: number;
};

export type CourseRow = {
  id: string;
  name: string;
  field: CareerInterest;
  qualificationLevels: QualificationLevel[];
  code: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  inUse: number;
  institutions: { id: string; name: string; shortName: string | null }[];
};

const INSTITUTION_TYPES: InstitutionType[] = [
  'UNIVERSITY',
  'UNIVERSITY_OF_TECHNOLOGY',
  'TVET_COLLEGE',
  'PRIVATE_INSTITUTION',
  'OTHER',
];

const QUALIFICATIONS: QualificationLevel[] = [
  'CERTIFICATE',
  'DIPLOMA',
  'ADVANCED_DIPLOMA',
  'BACHELORS',
  'HONOURS',
  'MASTERS',
  'DOCTORAL',
  'OTHER',
];

type Tab = 'institutions' | 'courses';

export function CatalogueManager({
  institutions,
  courses,
  provinces,
  fields,
}: {
  institutions: InstitutionRow[];
  courses: CourseRow[];
  provinces: Province[];
  fields: CareerInterest[];
}) {
  const [tab, setTab] = useState<Tab>('institutions');

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Catalogue sections">
        <TabButton
          active={tab === 'institutions'}
          onClick={() => setTab('institutions')}
          icon={<Building className="h-4 w-4" />}
          label="Institutions"
          count={institutions.length}
        />
        <TabButton
          active={tab === 'courses'}
          onClick={() => setTab('courses')}
          icon={<GraduationCap className="h-4 w-4" />}
          label="Courses"
          count={courses.length}
        />
      </div>

      {tab === 'institutions' ? (
        <InstitutionsPanel rows={institutions} provinces={provinces} />
      ) : (
        <CoursesPanel rows={courses} institutions={institutions} fields={fields} />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        'inline-flex items-center gap-2 rounded-btn px-3.5 py-2 text-[13px] font-semibold ring-1 transition-colors ' +
        (active
          ? 'bg-brand-600 text-white ring-brand-600'
          : 'bg-white text-ink-600 ring-line hover:bg-surface-subtle')
      }
    >
      {icon}
      {label}
      <span className={active ? 'text-white/80' : 'text-ink-400'}>{count}</span>
    </button>
  );
}

// --- institutions -----------------------------------------------------------

function InstitutionsPanel({ rows, provinces }: { rows: InstitutionRow[]; provinces: Province[] }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [province, setProvince] = useState('');
  const [editing, setEditing] = useState<InstitutionRow | 'NEW' | null>(null);

  const filtered = useMemo(
    () =>
      rows.filter((row) => {
        if (status !== 'ALL' && row.status !== status) return false;
        if (province && row.province !== province) return false;
        if (search.trim()) {
          const term = search.trim().toLowerCase();
          return (
            row.name.toLowerCase().includes(term) ||
            (row.shortName ?? '').toLowerCase().includes(term) ||
            row.city.toLowerCase().includes(term) ||
            (row.code ?? '').toLowerCase().includes(term)
          );
        }
        return true;
      }),
    [rows, search, status, province],
  );

  return (
    <Card>
      <CardBody className="p-0">
        <Toolbar
          search={search}
          onSearch={setSearch}
          placeholder="Search institutions by name, city or code"
          status={status}
          onStatus={setStatus}
          extra={
            <Select
              aria-label="Province"
              value={province}
              onChange={(event) => setProvince(event.target.value)}
              options={[
                { value: '', label: 'Any province' },
                ...provinces.map((value) => ({ value, label: provinceLabels[value] })),
              ]}
            />
          }
          onAdd={() => setEditing('NEW')}
          addLabel="Add institution"
        />

        {filtered.length === 0 ? (
          <EmptyState
            icon={<Building className="h-5 w-5" />}
            title="No institutions match"
            description="Change the filters, or add one."
          />
        ) : (
          <TableWrap>
            <thead>
              <Tr>
                <Th>Institution</Th>
                <Th>Type</Th>
                <Th>Location</Th>
                <Th>In use</Th>
                <Th>Status</Th>
                <Th />
              </Tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <Tr key={row.id}>
                  <Td>
                    <span className="font-medium text-ink">{row.name}</span>
                    {row.shortName && (
                      <span className="ml-1.5 text-ink-400">({row.shortName})</span>
                    )}
                    {row.code && <div className="text-2xs text-ink-400">Code {row.code}</div>}
                  </Td>
                  <Td className="text-[13px] text-ink-600">{institutionTypeLabels[row.type]}</Td>
                  <Td className="text-[13px] text-ink-600">
                    {row.city}
                    <div className="text-2xs text-ink-400">{provinceLabels[row.province]}</div>
                  </Td>
                  <Td className="text-[13px] tabular-nums text-ink-600">
                    {row.inUse === 0 ? (
                      <span className="text-ink-400">—</span>
                    ) : (
                      `${row.inUse} record${row.inUse === 1 ? '' : 's'}`
                    )}
                    {row.offeredProgrammes > 0 && (
                      <div className="text-2xs text-ink-400">{row.offeredProgrammes} courses</div>
                    )}
                  </Td>
                  <Td>
                    <Badge tone={row.status === 'ACTIVE' ? 'success' : 'neutral'}>
                      {row.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-1.5">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(row)}>
                        <Edit className="h-4 w-4" />
                        <span className="sr-only">Edit {row.name}</span>
                      </Button>
                      <StatusButton
                        endpoint="institutions"
                        id={row.id}
                        status={row.status}
                        name={row.name}
                        inUse={row.inUse}
                      />
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </CardBody>

      {editing && (
        <InstitutionDialog
          row={editing === 'NEW' ? null : editing}
          provinces={provinces}
          onClose={() => setEditing(null)}
        />
      )}
    </Card>
  );
}

function InstitutionDialog({
  row,
  provinces,
  onClose,
}: {
  row: InstitutionRow | null;
  provinces: Province[];
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState({
    name: row?.name ?? '',
    shortName: row?.shortName ?? '',
    type: row?.type ?? ('UNIVERSITY' as InstitutionType),
    province: row?.province ?? provinces[0] ?? 'GAUTENG',
    city: row?.city ?? '',
    website: row?.website ?? '',
    code: row?.code ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/catalogue/institutions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          row ? { action: 'UPDATE', id: row.id, data: values } : { action: 'CREATE', data: values },
        ),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        fields?: Record<string, string>;
      };
      if (!response.ok) {
        setError(payload.fields?.['data.name'] ?? payload.error ?? 'Could not save.');
        return;
      }
      toast.push('success', row ? 'Institution updated.' : 'Institution added.');
      onClose();
      router.refresh();
    } catch {
      setError('Could not reach Bursary-Bridge. Check your connection.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={row ? 'Edit institution' : 'Add institution'}
      description="Used by student study preferences, funder eligibility rules and matching."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy} disabled={values.name.trim().length < 2}>
            {row ? 'Save changes' : 'Add institution'}
          </Button>
        </>
      }
    >
      {error && (
        <Alert tone="danger" className="mb-3">
          {error}
        </Alert>
      )}
      <div className="grid gap-3.5">
        <Field label="Institution name" required>
          <Input
            value={values.name}
            onChange={(event) => setValues({ ...values, name: event.target.value })}
            placeholder="University of Pretoria"
          />
        </Field>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Short name" optional>
            <Input
              value={values.shortName}
              onChange={(event) => setValues({ ...values, shortName: event.target.value })}
              placeholder="UP"
            />
          </Field>
          <Field label="Institution code" optional>
            <Input
              value={values.code}
              onChange={(event) => setValues({ ...values, code: event.target.value })}
            />
          </Field>
        </div>
        <Field label="Type" required>
          <Select
            value={values.type}
            onChange={(event) =>
              setValues({ ...values, type: event.target.value as InstitutionType })
            }
            options={INSTITUTION_TYPES.map((value) => ({
              value,
              label: institutionTypeLabels[value],
            }))}
          />
        </Field>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Province" required>
            <Select
              value={values.province}
              onChange={(event) =>
                setValues({ ...values, province: event.target.value as Province })
              }
              options={provinces.map((value) => ({ value, label: provinceLabels[value] }))}
            />
          </Field>
          <Field label="City or town" required>
            <Input
              value={values.city}
              onChange={(event) => setValues({ ...values, city: event.target.value })}
            />
          </Field>
        </div>
        <Field label="Website" optional>
          <Input
            value={values.website}
            onChange={(event) => setValues({ ...values, website: event.target.value })}
            placeholder="https://www.up.ac.za"
          />
        </Field>
      </div>
    </Modal>
  );
}

// --- courses ----------------------------------------------------------------

function CoursesPanel({
  rows,
  institutions,
  fields,
}: {
  rows: CourseRow[];
  institutions: InstitutionRow[];
  fields: CareerInterest[];
}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [field, setField] = useState('');
  const [editing, setEditing] = useState<CourseRow | 'NEW' | null>(null);

  const filtered = useMemo(
    () =>
      rows.filter((row) => {
        if (status !== 'ALL' && row.status !== status) return false;
        if (field && row.field !== field) return false;
        if (search.trim()) {
          const term = search.trim().toLowerCase();
          return (
            row.name.toLowerCase().includes(term) ||
            (row.code ?? '').toLowerCase().includes(term) ||
            row.institutions.some((i) => i.name.toLowerCase().includes(term))
          );
        }
        return true;
      }),
    [rows, search, status, field],
  );

  return (
    <Card>
      <CardBody className="p-0">
        <Toolbar
          search={search}
          onSearch={setSearch}
          placeholder="Search courses by name, code or institution"
          status={status}
          onStatus={setStatus}
          extra={
            <Select
              aria-label="Field of study"
              value={field}
              onChange={(event) => setField(event.target.value)}
              options={[
                { value: '', label: 'Any field' },
                ...fields.map((value) => ({ value, label: careerInterestLabels[value] })),
              ]}
            />
          }
          onAdd={() => setEditing('NEW')}
          addLabel="Add course"
        />

        {filtered.length === 0 ? (
          <EmptyState
            icon={<GraduationCap className="h-5 w-5" />}
            title="No courses match"
            description="Change the filters, or add one."
          />
        ) : (
          <TableWrap>
            <thead>
              <Tr>
                <Th>Course</Th>
                <Th>Field</Th>
                <Th>Offered at</Th>
                <Th>In use</Th>
                <Th>Status</Th>
                <Th />
              </Tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <Tr key={row.id}>
                  <Td>
                    <span className="font-medium text-ink">{row.name}</span>
                    <div className="text-2xs text-ink-400">
                      {row.qualificationLevels.map((q) => qualificationLabels[q]).join(', ')}
                      {row.code ? ` · ${row.code}` : ''}
                    </div>
                  </Td>
                  <Td className="text-[13px] text-ink-600">{careerInterestLabels[row.field]}</Td>
                  <Td className="text-[13px] text-ink-600">
                    {row.institutions.length === 0 ? (
                      <span className="text-ink-400">Not linked yet</span>
                    ) : (
                      <>
                        {row.institutions
                          .slice(0, 2)
                          .map((i) => i.shortName ?? i.name)
                          .join(', ')}
                        {row.institutions.length > 2 && ` +${row.institutions.length - 2}`}
                      </>
                    )}
                  </Td>
                  <Td className="text-[13px] tabular-nums text-ink-600">
                    {row.inUse === 0 ? (
                      <span className="text-ink-400">—</span>
                    ) : (
                      `${row.inUse} record${row.inUse === 1 ? '' : 's'}`
                    )}
                  </Td>
                  <Td>
                    <Badge tone={row.status === 'ACTIVE' ? 'success' : 'neutral'}>
                      {row.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-1.5">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(row)}>
                        <Edit className="h-4 w-4" />
                        <span className="sr-only">Edit {row.name}</span>
                      </Button>
                      <StatusButton
                        endpoint="courses"
                        id={row.id}
                        status={row.status}
                        name={row.name}
                        inUse={row.inUse}
                      />
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </CardBody>

      {editing && (
        <CourseDialog
          row={editing === 'NEW' ? null : editing}
          institutions={institutions}
          fields={fields}
          onClose={() => setEditing(null)}
        />
      )}
    </Card>
  );
}

function CourseDialog({
  row,
  institutions,
  fields,
  onClose,
}: {
  row: CourseRow | null;
  institutions: InstitutionRow[];
  fields: CareerInterest[];
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState({
    name: row?.name ?? '',
    field: row?.field ?? fields[0] ?? 'TECHNOLOGY',
    qualificationLevels: row?.qualificationLevels ?? (['BACHELORS'] as QualificationLevel[]),
    code: row?.code ?? '',
    institutionIds: row?.institutions.map((i) => i.id) ?? [],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleLevel(level: QualificationLevel) {
    setValues((current) => ({
      ...current,
      qualificationLevels: current.qualificationLevels.includes(level)
        ? current.qualificationLevels.filter((l) => l !== level)
        : [...current.qualificationLevels, level],
    }));
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/catalogue/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          row ? { action: 'UPDATE', id: row.id, data: values } : { action: 'CREATE', data: values },
        ),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        fields?: Record<string, string>;
      };
      if (!response.ok) {
        setError(payload.fields?.['data.name'] ?? payload.error ?? 'Could not save.');
        return;
      }
      toast.push('success', row ? 'Course updated.' : 'Course added.');
      onClose();
      router.refresh();
    } catch {
      setError('Could not reach Bursary-Bridge. Check your connection.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={row ? 'Edit course' : 'Add course'}
      description="Students choose these in Study Preferences, and funders base eligibility on them."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={save}
            loading={busy}
            disabled={values.name.trim().length < 2 || values.qualificationLevels.length === 0}
          >
            {row ? 'Save changes' : 'Add course'}
          </Button>
        </>
      }
    >
      {error && (
        <Alert tone="danger" className="mb-3">
          {error}
        </Alert>
      )}
      <div className="grid gap-3.5">
        <Field label="Course name" required>
          <Input
            value={values.name}
            onChange={(event) => setValues({ ...values, name: event.target.value })}
            placeholder="Computer Science"
          />
        </Field>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Field of study" required>
            <Select
              value={values.field}
              onChange={(event) =>
                setValues({ ...values, field: event.target.value as CareerInterest })
              }
              options={fields.map((value) => ({ value, label: careerInterestLabels[value] }))}
            />
          </Field>
          <Field label="Course code" optional>
            <Input
              value={values.code}
              onChange={(event) => setValues({ ...values, code: event.target.value })}
            />
          </Field>
        </div>

        <Field label="Qualification levels" required>
          <div className="flex flex-wrap gap-1.5">
            {QUALIFICATIONS.map((level) => {
              const on = values.qualificationLevels.includes(level);
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => toggleLevel(level)}
                  aria-pressed={on}
                  className={
                    'rounded-btn px-3 py-1.5 text-[13px] font-medium ring-1 transition-colors ' +
                    (on
                      ? 'bg-brand-600 text-white ring-brand-600'
                      : 'bg-white text-ink-600 ring-line hover:bg-surface-subtle')
                  }
                >
                  {qualificationLabels[level]}
                </button>
              );
            })}
          </div>
        </Field>

        {/* A course and an institution are not independent lists. Linking them
            is what lets a study preference offer pairs that actually exist. */}
        <Field
          label="Offered at"
          optional
          hint="Leave empty if you do not know yet — students can still choose this course anywhere."
        >
          <MultiCombobox
            ariaLabel="Institutions offering this course"
            items={institutions
              .filter((i) => i.status === 'ACTIVE')
              .map((i) => ({ value: i.id, label: i.name, sublabel: i.city }))}
            values={values.institutionIds}
            onChange={(institutionIds) => setValues({ ...values, institutionIds })}
            placeholder="Search institutions"
          />
        </Field>
      </div>
    </Modal>
  );
}

// --- shared -----------------------------------------------------------------

function Toolbar({
  search,
  onSearch,
  placeholder,
  status,
  onStatus,
  extra,
  onAdd,
  addLabel,
}: {
  search: string;
  onSearch: (value: string) => void;
  placeholder: string;
  status: 'ALL' | 'ACTIVE' | 'INACTIVE';
  onStatus: (value: 'ALL' | 'ACTIVE' | 'INACTIVE') => void;
  extra?: React.ReactNode;
  onAdd: () => void;
  addLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
      <div className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <Input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="pl-9"
        />
      </div>
      <Select
        aria-label="Status"
        value={status}
        onChange={(event) => onStatus(event.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
        options={[
          { value: 'ACTIVE', label: 'Active' },
          { value: 'INACTIVE', label: 'Inactive' },
          { value: 'ALL', label: 'All' },
        ]}
      />
      {extra}
      <Button onClick={onAdd} leadingIcon={<Plus className="h-4 w-4" />}>
        {addLabel}
      </Button>
    </div>
  );
}

/**
 * Retire or restore an entry.
 *
 * Deactivating something in use is allowed and is the point: it stops being
 * offered for new choices while every record that already references it keeps
 * working. The count is shown so the decision is informed.
 */
function StatusButton({
  endpoint,
  id,
  status,
  name,
  inUse,
}: {
  endpoint: 'institutions' | 'courses';
  id: string;
  status: 'ACTIVE' | 'INACTIVE';
  name: string;
  inUse: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const next = status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

  async function apply() {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/catalogue/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SET_STATUS', id, data: { status: next } }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        toast.push('error', payload.error ?? 'Could not change the status.');
        return;
      }
      toast.push(
        'success',
        next === 'INACTIVE'
          ? `${name} retired.${inUse > 0 ? ` ${inUse} existing record${inUse === 1 ? '' : 's'} kept.` : ''}`
          : `${name} is active again.`,
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={apply} loading={busy}>
      {status === 'ACTIVE' ? 'Retire' : 'Restore'}
    </Button>
  );
}
