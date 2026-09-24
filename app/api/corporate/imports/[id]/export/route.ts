import { NextResponse, type NextRequest } from 'next/server';
import { apiCorporate, apiError } from '@/lib/auth/api';
import { batchFiles, getBatch } from '@/services/application-import';
import { CANONICAL_LABELS } from '@/lib/pdf/profile';

/** RFC 4180: quote every cell, and double any quote inside it. */
function cell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

const COLUMNS = [
  'firstName',
  'lastName',
  'idNumber',
  'email',
  'mobile',
  'institution',
  'programme',
  'qualificationLevel',
  'yearOfStudy',
  'academicAverage',
  'householdIncome',
] as const;

/**
 * The batch as a spreadsheet.
 *
 * Exports what was extracted, not a summary of it: one row per file, the
 * status, the scores, and every mapped field. A reviewer who wants to work
 * through seven hundred applications in Excel can, and the file name they
 * uploaded is on each row so any of them can be traced back to its document.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiCorporate();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const batch = await getBatch(id, auth.organisationId);
  if (!batch) return apiError('That import was not found.', 404);

  const files = await batchFiles(id, auth.organisationId, 'ALL');

  const header = [
    'File name',
    'Status',
    'Match score',
    'Eligibility',
    'Documents found',
    'Documents required',
    'Identity match',
    'Duplicate of',
    'Failure reason',
    ...COLUMNS.map((key) => CANONICAL_LABELS[key]),
  ];

  const rows = files.map((file) => {
    const values = new Map(
      file.fields.map((field) => [field.canonicalKey, field.correctedValue ?? field.value]),
    );
    return [
      file.fileName,
      file.status,
      file.matchScore ?? '',
      file.eligibilityOutcome ?? '',
      file.documentsFound,
      file.documentsRequired,
      file.identity,
      file.duplicateOfFile?.fileName ?? '',
      file.failureReason ?? '',
      ...COLUMNS.map((key) => values.get(key) ?? ''),
    ];
  });

  const csv = [header, ...rows].map((row) => row.map(cell).join(',')).join('\r\n');
  const name = `${batch.reference.replace(/[^A-Za-z0-9#]+/g, '-')}-applications.csv`;

  return new NextResponse(`﻿${csv}`, {
    headers: {
      // The BOM is what makes Excel open a UTF-8 CSV without mangling accents.
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
