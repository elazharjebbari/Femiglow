import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { listAdminRituals } from '@/lib/db/queries/rituals-admin';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'En attente',
  APPROVED: 'Publié',
  REJECTED: 'Rejeté',
  HIDDEN: 'Masqué',
};

export default async function AdminRitualsQueuePage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const session = await requireAdmin('/admin/rituals/queue');
  const pageRaw = Number(searchParams.page ?? 1);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const showAllRaw = searchParams.status;
  const status =
    typeof showAllRaw === 'string' && showAllRaw === 'all' ? 'all' : 'PENDING';

  const result = await listAdminRituals({
    status: status === 'all' ? 'all' : 'PENDING',
    page,
    pageSize: 20,
  });

  return (
    <AdminShell adminEmail={session.email} active="rituals">
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            Rituels partagés — modération
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            {result.pendingCount} en attente · {result.total} total
          </p>
        </div>
        <nav className="flex gap-2 text-sm">
          <Link
            href="?status=PENDING"
            className={`border px-3 py-1 ${status === 'PENDING' ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 hover:bg-stone-100'}`}
          >
            En attente
          </Link>
          <Link
            href="?status=all"
            className={`border px-3 py-1 ${status === 'all' ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 hover:bg-stone-100'}`}
          >
            Tous
          </Link>
        </nav>
      </header>

      {result.rows.length === 0 ? (
        <div className="rounded border border-stone-200 bg-white p-12 text-center text-sm text-stone-600">
          {status === 'PENDING' ? 'Aucun rituel en attente.' : 'Aucun rituel enregistré.'}
        </div>
      ) : (
        <ul className="space-y-3" role="list">
          {result.rows.map((r) => {
            const flags = r.autoFlags;
            const hasFaceFlag = flags.includes('face_detected');
            return (
              <li
                key={r.id}
                className="border border-stone-200 bg-white p-4"
                data-testid="admin-ritual-row"
              >
                {hasFaceFlag && (
                  <span className="mb-2 inline-block bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                    PRIORITÉ — Visage détecté
                  </span>
                )}
                {flags.length > 0 && !hasFaceFlag && (
                  <span className="mb-2 inline-block bg-stone-100 px-2 py-0.5 text-xs text-stone-700">
                    {flags.length} signal(aux) auto
                  </span>
                )}
                <p className="font-serif text-base italic text-stone-900">
                  « {r.body.slice(0, 140)}
                  {r.body.length > 140 ? '…' : ''} »
                </p>
                <p className="mt-2 text-xs text-stone-600">
                  — {r.authorFirstName ?? 'Une initiée'}
                  {r.authorCity ? `, ${r.authorCity}` : ''} · {STATUS_LABEL[r.status]} ·{' '}
                  source {r.source} ·{' '}
                  {new Intl.DateTimeFormat('fr-FR', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  }).format(r.createdAt)}
                </p>
                <p className="mt-2">
                  <Link
                    href={`/admin/rituals/${r.id}`}
                    className="text-sm font-medium text-stone-900 underline"
                  >
                    Voir détail →
                  </Link>
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </AdminShell>
  );
}
