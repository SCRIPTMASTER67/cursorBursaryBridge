import { PageBody } from '@/components/layout/app-shell';
import { Card } from '@/components/ui';
import { requireAdmin } from '@/lib/auth/guards';
import { isCatalogueEntryInUse, listCourses, listInstitutions } from '@/services/admin-catalogue';

export const metadata = { title: 'Catalogue · Bursary-Bridge admin' };

/**
 * Shared reference data.
 *
 * Study Preferences and Eligibility Rules both point at these rows, so the
 * usage counts matter: an entry in use cannot be deleted, because the foreign
 * keys from StudyPreference are declared `onDelete: Restrict`.
 */
export default async function AdminCataloguePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const [institutions, courses] = await Promise.all([
    listInstitutions(params.q),
    listCourses(params.q),
  ]);

  return (
    <PageBody>
      <div className="space-y-6">
        <header>
          <h1 className="text-ink-900 text-[26px] font-semibold">Catalogue</h1>
          <p className="mt-1 text-[14px] text-ink-500">
            The institutions and courses that students choose between and that funders base their
            eligibility rules on. An entry already in use cannot be removed.
          </p>
        </header>

        <Card className="p-4">
          <form className="flex flex-wrap items-end gap-3" method="get">
            <div className="min-w-0 flex-1">
              <label className="block text-[13px] font-medium text-ink-700" htmlFor="q">
                Search both lists
              </label>
              <input
                id="q"
                name="q"
                defaultValue={params.q ?? ''}
                placeholder="Institution, city or course"
                className="mt-1.5 w-full rounded-field border border-line px-3 py-2 text-[14px]"
              />
            </div>
            <button
              type="submit"
              className="bg-primary-600 rounded-field px-4 py-2 text-[14px] font-medium text-white"
            >
              Search
            </button>
          </form>
        </Card>

        <Card className="p-0">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-ink-900 text-[15px] font-semibold">
              Institutions ({institutions.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[14px]">
              <thead>
                <tr className="border-b border-line text-[12px] uppercase tracking-[0.04em] text-ink-400">
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Province</th>
                  <th className="px-4 py-3 font-semibold">City</th>
                  <th className="px-4 py-3 text-right font-semibold">In use</th>
                </tr>
              </thead>
              <tbody>
                {institutions.map((row) => {
                  const inUse = isCatalogueEntryInUse(row._count);
                  return (
                    <tr key={row.id} className="border-b border-line/60 last:border-0">
                      <td className="text-ink-800 px-4 py-3">
                        {row.name}
                        {row.shortName ? (
                          <span className="text-ink-400"> ({row.shortName})</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-ink-600">{row.type}</td>
                      <td className="px-4 py-3 text-ink-600">{row.province}</td>
                      <td className="px-4 py-3 text-ink-600">{row.city}</td>
                      <td className="px-4 py-3 text-right text-ink-600">
                        {inUse
                          ? `${row._count.studyPreferences + row._count.currentStudents + row._count.supportedInProgram} reference(s)`
                          : 'unused'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-0">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-ink-900 text-[15px] font-semibold">Courses ({courses.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[14px]">
              <thead>
                <tr className="border-b border-line text-[12px] uppercase tracking-[0.04em] text-ink-400">
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Field</th>
                  <th className="px-4 py-3 font-semibold">Levels</th>
                  <th className="px-4 py-3 text-right font-semibold">In use</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((row) => {
                  const inUse = isCatalogueEntryInUse(row._count);
                  return (
                    <tr key={row.id} className="border-b border-line/60 last:border-0">
                      <td className="text-ink-800 px-4 py-3">{row.name}</td>
                      <td className="px-4 py-3 text-ink-600">{row.field}</td>
                      <td className="px-4 py-3 text-ink-600">{row.qualificationLevels.length}</td>
                      <td className="px-4 py-3 text-right text-ink-600">
                        {inUse
                          ? `${row._count.studyPreferences + row._count.currentStudents + row._count.supportedInProgram} reference(s)`
                          : 'unused'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </PageBody>
  );
}
