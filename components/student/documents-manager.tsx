'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import type { DocumentType } from '@prisma/client';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/modal';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { Eye, FileText, Trash, Upload } from '@/components/icons';
import { documentTypeLabels, toOptions } from '@/lib/labels';
import { formatDate } from '@/lib/utils';

type DocumentRow = {
  id: string;
  type: DocumentType;
  fileName: string;
  sizeBytes: number;
  uploadedAt: string;
  url: string;
};

const MAX_BYTES = 5 * 1024 * 1024;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Upload, review and remove supporting documents. */
export function DocumentsManager({ documents }: { documents: DocumentRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const [type, setType] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DocumentRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!type) return setError('Choose what kind of document this is.');
    if (!file) return setError('Choose a file to upload.');
    if (file.size > MAX_BYTES) return setError('Files must be 5 MB or smaller.');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    setUploading(true);
    try {
      const response = await fetch('/api/documents/upload', { method: 'POST', body: formData });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setError(payload.error ?? 'We could not upload that file. Please try again.');
        return;
      }

      toast.push('success', 'Document uploaded.');
      setFile(null);
      setType('');
      if (fileInput.current) fileInput.current.value = '';
      router.refresh();
    } catch {
      setError('We could not reach Bursary-Bridge. Check your connection and try again.');
    } finally {
      setUploading(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/documents/${pendingDelete.id}`, { method: 'DELETE' });
      if (response.ok) {
        toast.push('success', 'Document removed.');
        router.refresh();
      } else {
        toast.push('error', 'We could not remove that document.');
      }
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start [&>*]:min-w-0">
      <Card>
        <CardHeader title="Your documents" description={`${documents.length} uploaded`} />
        {documents.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-5 w-5" />}
            title="No documents yet"
            description="Upload an ID, academic record or proof of income so they're ready when a funder asks."
          />
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {documents.map((document) => (
              <li key={document.id} className="flex items-center gap-4 px-5 py-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-50 text-brand-600">
                  <FileText className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-ink">{documentTypeLabels[document.type]}</p>
                  <p className="mt-0.5 truncate text-xs text-ink-400">
                    {document.fileName}
                    <span className="mx-1.5">·</span>
                    {formatSize(document.sizeBytes)}
                    <span className="mx-1.5">·</span>
                    {formatDate(document.uploadedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <a
                    href={document.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`View ${document.fileName}`}
                    className="rounded-md p-2 text-ink-400 transition-colors hover:bg-surface-subtle hover:text-ink"
                  >
                    <Eye className="h-4 w-4" />
                  </a>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(document)}
                    aria-label={`Remove ${document.fileName}`}
                    className="rounded-md p-2 text-ink-400 transition-colors hover:bg-danger-50 hover:text-danger-600"
                  >
                    <Trash className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="text-[15px] font-semibold text-ink">Upload a document</h2>
        <p className="mt-1.5 text-[13px] leading-6 text-ink-400">
          PDF, JPG, PNG or WebP, up to 5 MB.
        </p>

        <form onSubmit={upload} className="mt-4 space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}

          <Field label="Document type" required>
            <Select
              options={toOptions(documentTypeLabels)}
              placeholder="What is this document?"
              value={type}
              onChange={(event) => setType(event.target.value)}
            />
          </Field>

          <Field label="File" required>
            <input
              ref={fileInput}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setError(null);
              }}
              className="block w-full cursor-pointer rounded-field border border-line bg-white text-sm text-ink-600
                         file:mr-3 file:cursor-pointer file:rounded-l-field file:border-0 file:bg-surface-subtle
                         file:px-4 file:py-2.5 file:text-[13px] file:font-semibold file:text-ink-700
                         hover:file:bg-line"
            />
          </Field>

          <Button
            type="submit"
            fullWidth
            loading={uploading}
            leadingIcon={<Upload className="h-4 w-4" />}
          >
            Upload document
          </Button>
        </form>

        <p className="mt-5 border-t border-line pt-4 text-xs leading-5 text-ink-400">
          Your documents are private. They are only shared with a funder when you attach them to an
          application to that funder.
        </p>
      </Card>

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        tone="danger"
        title="Remove this document?"
        message={`"${pendingDelete?.fileName ?? ''}" will be permanently deleted. Applications you've already submitted keep the copy you attached.`}
        confirmLabel="Remove document"
      />
    </div>
  );
}
