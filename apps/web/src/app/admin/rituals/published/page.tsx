import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { RitualsAdminTable } from '@/components/admin/rituals/RitualsAdminTable';
import { RitualsAdminFilters } from '@/components/admin/rituals/RitualsAdminFilters';
import { listAdminRituals } from '@/lib/db/queries/rituals-admin';
import { parseAdminFilters } from '@/lib/admin/admin-filters';

export const dynamic = 'force-dynamic';

export default async function AdminRitualsPublishedPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const session = await requireAdmin('/admin/rituals/published');
  const pageRaw = Number(searchParams.page ?? 1);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  const filters = parseAdminFilters(searchParams);
  const result = await listAdminRituals({
    status: 'APPROVED',
    flags: filters.flags,
    sources: filters.sources,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    authorQuery: filters.authorQuery,
    verified: filters.verified,
    page,
    pageSize: 25,
  });

  return (
    <AdminShell adminEmail={session.email} active="rituals">
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            Rituels — Publiés
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            {result.total} publié{result.total === 1 ? '' : 's'}
          </p>
        </div>
        <nav className="flex gap-2 text-sm">
          <Link href="/admin/rituals/queue" className="border border-stone-300 px-3 py-1 hover:bg-stone-100">
            En attente
          </Link>
          <Link href="/admin/rituals/published" className="border border-stone-900 bg-stone-900 px-3 py-1 text-white">
            Publiés
          </Link>
          <Link href="/admin/rituals/archived" className="border border-stone-300 px-3 py-1 hover:bg-stone-100">
            Archivés
          </Link>
          <Link href="/admin/rituals/insights" className="border border-stone-300 px-3 py-1 hover:bg-stone-100">
            Insights
          </Link>
          <Link href="/admin/rituals/import" className="border border-stone-300 px-3 py-1 hover:bg-stone-100">
            Importer
          </Link>
        </nav>
      </header>

      <RitualsAdminFilters />

      <RitualsAdminTable
        rows={result.rows}
        totalAll={result.total}
        surface="published"
      />
    </AdminShell>
  );
}
