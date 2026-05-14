/**
 * /admin/emails/audiences/[id] — Detail d'une audience (M5.3.9).
 *
 * Affiche les rules, exclusions, snapshots, créateur. Boutons :
 * - Snapshot maintenant
 * - Supprimer (soft delete)
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import {
  getAudienceById,
  listSnapshotsForAudience,
} from '@/lib/mail/audiences/queries';
import { AudienceDetailActions } from '@/components/admin/emails/audiences/AudienceDetailActions';

export const dynamic = 'force-dynamic';

function formatDate(d: Date | null): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-stone-100 text-stone-700',
  running: 'bg-sky-50 text-sky-700',
  done: 'bg-emerald-50 text-emerald-700',
  errored: 'bg-red-50 text-red-700',
};

export default async function AudienceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await requireAdmin(`/admin/emails/audiences/${params.id}`);
  const audience = await getAudienceById(params.id);
  if (!audience) notFound();

  const snapshots = await listSnapshotsForAudience(params.id, 20);

  return (
    <AdminShell adminEmail={session.email} active="emails">
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <Link
            href="/admin/emails/audiences"
            className="text-sm text-stone-500 underline-offset-2 hover:underline"
          >
            ← Audiences
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">
            🎯 {audience.name}
          </h1>
          <p className="mt-1 text-xs font-mono text-stone-500">{audience.slug}</p>
        </div>
        <AudienceDetailActions audienceId={audience.id} />
      </header>

      {audience.description && (
        <p className="mb-6 text-sm text-stone-700">{audience.description}</p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Critères */}
        <section className="rounded-md border border-stone-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-medium text-stone-700">Critères</h2>
          <pre className="overflow-x-auto rounded bg-stone-50 p-3 text-xs text-stone-800">
            {JSON.stringify(audience.rules, null, 2)}
          </pre>
        </section>

        {/* Exclusions */}
        <section className="rounded-md border border-stone-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-medium text-stone-700">Exclusions automatiques</h2>
          <ul className="space-y-1 text-sm">
            {Object.entries(audience.exclusionFlags as Record<string, boolean>).map(
              ([key, val]) => (
                <li key={key} className="flex items-center gap-2">
                  <span className={val ? 'text-emerald-700' : 'text-stone-400'}>
                    {val ? '✓' : '○'}
                  </span>
                  <span className={val ? 'text-stone-800' : 'text-stone-400'}>{key}</span>
                </li>
              ),
            )}
          </ul>
        </section>
      </div>

      {/* Snapshots */}
      <section className="mt-6 rounded-md border border-stone-200 bg-white">
        <header className="border-b border-stone-200 px-4 py-3">
          <h2 className="text-sm font-medium text-stone-700">
            Snapshots ({snapshots.length})
          </h2>
        </header>
        {snapshots.length === 0 ? (
          <div className="p-6 text-center text-sm text-stone-500">
            Aucun snapshot. Crée-en un pour figer la liste.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-stone-50/50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-stone-500">
                  Date
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-stone-500">
                  Taille
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-stone-500">
                  Status
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-stone-500">
                  Purge le
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {snapshots.map((s) => (
                <tr key={s.id}>
                  <td className="px-3 py-2 font-mono text-xs text-stone-600">
                    {formatDate(s.createdAt)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{s.size}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${
                        STATUS_COLORS[s.status] ?? 'bg-stone-100'
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-stone-500">
                    {formatDate(s.purgeableAfter)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <footer className="mt-8 text-xs text-stone-400">
        Créée par {audience.createdBy} le {formatDate(audience.createdAt)} ·{' '}
        Mode {audience.evaluationMode}
      </footer>
    </AdminShell>
  );
}
