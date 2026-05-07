import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { listMedia, thumbsByMediaId } from '@/lib/db/queries/media';
import { mediaListFiltersSchema } from '@/lib/schemas/admin/media';
import { MediaFilters } from '@/components/admin/media/MediaFilters';
import { MediaLibraryGrid } from '@/components/admin/media/MediaLibraryGrid';

export const dynamic = 'force-dynamic';

export default async function AdminMediaPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const session = await requireAdmin('/admin/media');
  const parsed = mediaListFiltersSchema.safeParse(searchParams);
  const filters = parsed.success ? parsed.data : mediaListFiltersSchema.parse({});
  const { rows, total } = await listMedia({
    q: filters.q,
    kind: filters.kind,
    status: filters.status,
    isHero: filters.isHero,
    unused: filters.unused,
    sort: filters.sort,
    limit: 60,
  });

  const thumbs = await thumbsByMediaId(rows.map((m) => m.id));
  const rowsWithThumbs = rows.map((m) => ({ ...m, thumbUrl: thumbs.get(m.id) }));

  return (
    <AdminShell adminEmail={session.email} active="media">
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Médias</h1>
          <p className="mt-1 text-sm text-stone-600">
            {total} média{total === 1 ? '' : 's'}.
          </p>
        </div>
        <nav aria-label="Actions médias" className="flex gap-2">
          <Link
            href="/admin/media/upload"
            className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
          >
            Importer
          </Link>
          <Link
            href="/admin/media/duplicates"
            className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            Doublons
          </Link>
          <Link
            href="/admin/media/settings"
            className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            Réglages
          </Link>
        </nav>
      </header>
      <MediaFilters filters={filters} />
      <MediaLibraryGrid
        rows={rowsWithThumbs}
        emptyLabel="Aucun média ne correspond aux filtres."
      />
    </AdminShell>
  );
}
