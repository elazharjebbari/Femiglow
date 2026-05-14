/**
 * /admin/emails/audiences — Liste des audiences (M5.3.9).
 */
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { listAudiencesWithSnapshotCount } from '@/lib/mail/audiences/queries';

export const dynamic = 'force-dynamic';

export default async function AudiencesListPage() {
  const session = await requireAdmin('/admin/emails/audiences');
  const audiences = await listAudiencesWithSnapshotCount();

  return (
    <AdminShell adminEmail={session.email} active="emails">
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            Audiences
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            Définis des audiences ciblables par règles (commerce, engagement,
            activité…). Utilisables ensuite dans les campagnes et automations.
          </p>
        </div>
        <Link
          href="/admin/emails/audiences/new"
          className="rounded bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
        >
          + Nouvelle audience
        </Link>
      </header>

      {audiences.length === 0 ? (
        <div className="rounded-md border border-dashed border-stone-300 bg-stone-50 p-12 text-center">
          <div className="mb-2 text-3xl">🎯</div>
          <h3 className="text-base font-medium text-stone-900">Aucune audience définie</h3>
          <p className="mt-1 text-sm text-stone-500">
            Crée ta première audience pour cibler des contacts.
          </p>
          <Link
            href="/admin/emails/audiences/new"
            className="mt-4 inline-block rounded bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
          >
            + Nouvelle audience
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-stone-200 bg-stone-50/50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-stone-500">
                  Nom
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-stone-500">
                  Slug
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-stone-500 w-32">
                  Évaluation
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-stone-500 w-24">
                  Snapshots
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-stone-500 w-36">
                  Créée par
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {audiences.map((a) => (
                <tr key={a.id} className="hover:bg-stone-50">
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/emails/audiences/${a.id}`}
                      className="font-medium text-stone-900 hover:underline"
                    >
                      🎯 {a.name}
                    </Link>
                    {a.description && (
                      <div className="text-xs text-stone-500">{a.description}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-stone-700">{a.slug}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${
                        a.evaluationMode === 'dynamic'
                          ? 'bg-sky-50 text-sky-700'
                          : 'bg-stone-100 text-stone-700'
                      }`}
                    >
                      {a.evaluationMode}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-stone-700">
                    {a.snapshotCount}
                  </td>
                  <td className="px-3 py-2 text-xs text-stone-500">{a.createdBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
