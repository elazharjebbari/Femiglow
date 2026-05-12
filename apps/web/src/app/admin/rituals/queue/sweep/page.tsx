import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import {
  getAdminRitualById,
  getRitualNeighbors,
  listAdminRituals,
} from '@/lib/db/queries/rituals-admin';
import { parseAdminFilters } from '@/lib/admin/admin-filters';
import { RitualSweepView } from '@/components/admin/rituals/RitualSweepView';

export const dynamic = 'force-dynamic';

export default async function AdminRitualsSweepPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const session = await requireAdmin('/admin/rituals/queue/sweep');
  const filters = parseAdminFilters(searchParams);

  // Premier rituel PENDING (avec filtres si fournis).
  const idRaw = searchParams.id;
  const targetId = typeof idRaw === 'string' && idRaw.length > 0 ? idRaw : null;

  let ritual = targetId ? await getAdminRitualById(targetId) : null;
  if (!ritual || ritual.status !== 'PENDING') {
    const list = await listAdminRituals({
      status: 'PENDING',
      flags: filters.flags,
      sources: filters.sources,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      authorQuery: filters.authorQuery,
      search: filters.search,
      verified: filters.verified,
      page: 1,
      pageSize: 1,
    });
    ritual = list.rows[0] ?? null;
  }

  if (!ritual) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50 p-6">
        <div className="max-w-md rounded border border-stone-200 bg-white p-8 text-center">
          <h1 className="font-serif text-2xl text-stone-900">File vide</h1>
          <p className="mt-2 text-sm text-stone-600">
            Aucun rituel en attente pour ce filtre. Bonne nouvelle.
          </p>
          <p className="mt-6">
            <Link
              href="/admin/rituals/queue"
              className="inline-block border border-stone-900 bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
            >
              Retour à la liste
            </Link>
          </p>
        </div>
      </main>
    );
  }

  const neighbors = await getRitualNeighbors(ritual.id, ['PENDING']);

  return (
    <RitualSweepView
      adminEmail={session.email}
      ritual={ritual}
      previousId={neighbors.previousId}
      nextId={neighbors.nextId}
      position={neighbors.position}
      total={neighbors.total}
    />
  );
}
