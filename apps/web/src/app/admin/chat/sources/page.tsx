/**
 * CHA-112 / CHA-113 — Sources : liste + actions ingestion.
 */
import { AdminShell } from '@/components/admin/AdminShell';
import { ChatAdminNav } from '@/components/admin/chat/ChatAdminNav';
import { adminQueries } from '@/lib/chat/admin/queries';
import { isChatEnabled } from '@/lib/chat/feature-flag';
import { requireAdmin } from '@/lib/auth/require-admin';

export const dynamic = 'force-dynamic';

export default async function SourcesPage() {
  const session = await requireAdmin('/admin/chat/sources');
  const enabled = isChatEnabled();
  const sources = enabled ? await adminQueries.listSources().catch(() => []) : [];

  return (
    <AdminShell adminEmail={session.email} active="chat">
      <ChatAdminNav active="sources" />
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Sources</h1>
        <a
          href="/admin/chat/sources/new"
          className="rounded-md bg-stone-900 px-3 py-1.5 text-sm text-white"
        >
          Nouvelle source
        </a>
      </header>

      <p className="mb-4 text-sm text-stone-600">
        Base de connaissance utilisée pour le RAG. L'ingestion crée des chunks
        embedded dans pgvector.
      </p>

      <div className="overflow-x-auto rounded-md border border-stone-200 bg-white">
        <table className="min-w-full divide-y divide-stone-200 text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase text-stone-500">
            <tr>
              <th className="px-3 py-2">Label</th>
              <th className="px-3 py-2">Kind</th>
              <th className="px-3 py-2">Lang</th>
              <th className="px-3 py-2">Audience</th>
              <th className="px-3 py-2">Chunks</th>
              <th className="px-3 py-2">MAJ</th>
              <th className="px-3 py-2">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {sources.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-stone-500">
                  Aucune source. Ajoutez un premier markdown ou URL.
                </td>
              </tr>
            ) : (
              sources.map((s) => (
                <tr key={s.id}>
                  <td className="px-3 py-2 font-medium">{s.label}</td>
                  <td className="px-3 py-2">{s.kind}</td>
                  <td className="px-3 py-2 uppercase">{s.language}</td>
                  <td className="px-3 py-2">{s.audience}</td>
                  <td className="px-3 py-2 tabular-nums">{s.chunkCount}</td>
                  <td className="px-3 py-2 text-xs text-stone-500">
                    {s.lastIngestedAt
                      ? s.lastIngestedAt.toISOString().slice(0, 10)
                      : '—'}
                  </td>
                  <td className="px-3 py-2">
                    {s.enabled ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                        on
                      </span>
                    ) : (
                      <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs">
                        off
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
