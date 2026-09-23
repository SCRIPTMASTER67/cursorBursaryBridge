import type { Metadata } from 'next';
import { PageBody, PageHeader } from '@/components/layout/app-shell';
import { CatalogueManager } from '@/components/admin/catalogue-manager';
import { Card, CardBody } from '@/components/ui/card';
import { InfoCircle } from '@/components/icons';
import { requireAdmin } from '@/lib/auth/guards';
import { listInstitutions, listProgrammes } from '@/services/catalogue';
import { careerInterestLabels, provinceLabels } from '@/lib/labels';
import type { CareerInterest, Province } from '@prisma/client';

export const metadata: Metadata = { title: 'Catalogue · Bursary-Bridge admin' };
export const dynamic = 'force-dynamic';

/**
 * The single catalogue the whole application reads from.
 *
 * Study preferences, funder eligibility rules, corporate programme creation
 * and the matching engine all resolve through these rows. There is no second
 * hard-coded list anywhere: adding a course here makes it available in every
 * one of those places.
 */
export default async function AdminCataloguePage() {
  await requireAdmin();

  // The whole catalogue is loaded and filtered in the browser: it is a few
  // dozen rows, and instant filtering is worth more here than pagination.
  const [institutions, courses] = await Promise.all([
    listInstitutions({ status: 'ALL', pageSize: 1000 }),
    listProgrammes({ status: 'ALL', pageSize: 1000 }),
  ]);

  const provinces = [...new Set(institutions.rows.map((i) => i.province))].sort((a, b) =>
    provinceLabels[a].localeCompare(provinceLabels[b]),
  ) as Province[];
  const fields = [...new Set(courses.rows.map((c) => c.field))].sort((a, b) =>
    careerInterestLabels[a].localeCompare(careerInterestLabels[b]),
  ) as CareerInterest[];

  const allProvinces = (
    provinces.length > 0 ? provinces : (Object.keys(provinceLabels) as Province[])
  ).slice();
  const allFields = (
    fields.length > 0 ? fields : (Object.keys(careerInterestLabels) as CareerInterest[])
  ).slice();

  return (
    <PageBody>
      <PageHeader
        title="Catalogue"
        description="The institutions and courses students choose between, funders write eligibility rules against, and the matching engine compares. One list, used everywhere."
      />

      <Card className="mb-5">
        <CardBody className="flex gap-3">
          <InfoCircle className="h-[18px] w-[18px] shrink-0 text-ink-400" />
          <div className="text-[13px] text-ink-600">
            <p className="font-semibold text-ink">Entries are retired, never deleted</p>
            <p className="mt-1">
              A student who chose an institution, and a funder who wrote a rule against a course,
              both point at these rows. Retiring one stops it being offered for new choices and
              leaves every existing record intact.
            </p>
          </div>
        </CardBody>
      </Card>

      <CatalogueManager
        provinces={allProvinces}
        fields={allFields}
        institutions={institutions.rows.map((row) => ({
          id: row.id,
          name: row.name,
          shortName: row.shortName,
          type: row.type,
          province: row.province,
          city: row.city,
          website: row.website,
          code: row.code,
          status: row.status,
          inUse:
            row._count.studyPreferences +
            row._count.currentStudents +
            row._count.supportedInProgram,
          offeredProgrammes: row._count.offeredProgrammes,
        }))}
        courses={courses.rows.map((row) => ({
          id: row.id,
          name: row.name,
          field: row.field,
          qualificationLevels: row.qualificationLevels,
          code: row.code,
          status: row.status,
          inUse:
            row._count.studyPreferences +
            row._count.currentStudents +
            row._count.supportedInProgram,
          institutions: row.offeredAt.map((link) => ({
            id: link.institution.id,
            name: link.institution.name,
            shortName: link.institution.shortName,
          })),
        }))}
      />
    </PageBody>
  );
}
