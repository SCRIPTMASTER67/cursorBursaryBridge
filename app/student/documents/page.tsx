import type { Metadata } from 'next';
import { PageBody, PageHeader } from '@/components/layout/app-shell';
import { DocumentsManager } from '@/components/student/documents-manager';
import { requireOnboardedStudent } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';

export const metadata: Metadata = { title: 'Documents' };

export default async function DocumentsPage() {
  const { studentProfileId } = await requireOnboardedStudent();

  const documents = await prisma.document.findMany({
    where: { studentProfileId },
    select: { id: true, type: true, fileName: true, sizeBytes: true, uploadedAt: true, storageKey: true },
    orderBy: { uploadedAt: 'desc' },
  });

  return (
    <PageBody>
      <PageHeader
        title="Documents"
        description="Upload the documents funders commonly ask for, once. You'll attach them to applications as they're needed — nothing here is required to register."
      />
      <DocumentsManager
        documents={documents.map((document) => ({
          id: document.id,
          type: document.type,
          fileName: document.fileName,
          sizeBytes: document.sizeBytes,
          uploadedAt: document.uploadedAt.toISOString(),
          url: `/api/documents/file/${encodeURIComponent(document.storageKey)}`,
        }))}
      />
    </PageBody>
  );
}
