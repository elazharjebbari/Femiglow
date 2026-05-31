import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { RitualsAdminTable } from '@/components/admin/rituals/RitualsAdminTable';
import { RitualsAdminFilters } from '@/components/admin/rituals/RitualsAdminFilters';
import { RitualsAdminSearch } from '@/components/admin/rituals/RitualsAdminSearch';
import { listAdminRituals } from '@/lib/db/queries/rituals-admin';
import { parseAdminFilters } from '@/lib/admin/admin-filters';

export const dynamic = 'force-dynamic';

export default async function AdminRitualsArchivedPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const session = await requireAdmin('/admin/rituals/archived');
  const pageRaw = Number(searchParams.page ?? 1);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  // On charge HIDDEN ; pour REJECTED, l'admin peut basculer via filtre futur.
  const statusFilter =
    typeof searchParams.status === 'string' && searchParams.status === 'REJECTED'
      ? 'REJECTED'
      : 'HIDDEN';

  const filters = parseAdminFilters(searchParams);
  const result = await listAdminRituals({
    status: statusFilter,
    flags: filters.flags,
    sources: filters.sources,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    authorQuery: filters.authorQuery,
    search: filters.search,
    verified: filters.verified,
    page,
    pageSize: 25,
  });

  return (
    <AdminShell adminEmail={session.email} active="rituals">
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            Rituels — Archivés
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            {result.total} {statusFilter === 'HIDDEN' ? 'masqué' : 'rejeté'}
            {result.total === 1 ? '' : 's'}
          </p>
        </div>
        <nav className="flex gap-2 text-sm">
          <Link href="/admin/rituals/queue" className="border border-stone-300 px-3 py-1 hover:bg-stone-100">
            En attente
          </Link>
          <Link href="/admin/rituals/published" className="border border-stone-300 px-3 py-1 hover:bg-stone-100">
            Publiés
          </Link>
          <Link href="/admin/rituals/archived" className="border border-stone-900 bg-stone-900 px-3 py-1 text-white">
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

      <nav aria-label="Filtre status" className="mb-4 flex gap-2 text-xs">
        <Link
          href="/admin/rituals/archived"
          className={`border px-2 py-1 ${
            statusFilter === 'HIDDEN'
              ? 'border-stone-900 bg-stone-900 text-white'
              : 'border-stone-300 hover:bg-stone-100'
          }`}
        >
          Masqués
        </Link>
        <Link
          href="/admin/rituals/archived?status=REJECTED"
          className={`border px-2 py-1 ${
            statusFilter === 'REJECTED'
              ? 'border-stone-900 bg-stone-900 text-white'
              : 'border-stone-300 hover:bg-stone-100'
          }`}
        >
          Rejetés
        </Link>
      </nav>

      <RitualsAdminSearch />
      <RitualsAdminFilters preserveParams={{ status: statusFilter }} />

      <RitualsAdminTable
        rows={result.rows}
        totalAll={result.total}
        surface="archived"
      />
    </AdminShell>
  );
}
