/**
 * CHA-105 / CHA-106 — Liste des conversations + recherche plein texte.
 */
import Link from 'next/link';

import { AdminShell } from '@/components/admin/AdminShell';
import { ChatAdminNav } from '@/components/admin/chat/ChatAdminNav';
import { adminQueries } from '@/lib/chat/admin/queries';
import { isChatEnabled } from '@/lib/chat/feature-flag';
import { requireAdmin } from '@/lib/auth/require-admin';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams?: { q?: string; lang?: string; status?: string };
}

export default async function ChatConversationsPage({ searchParams }: PageProps) {
  const session = await requireAdmin('/admin/chat/conversations');
  const enabled = isChatEnabled();

  const q = searchParams?.q?.trim() ?? '';
  const lang = searchParams?.lang?.trim() ?? '';
  const status = searchParams?.status?.trim() ?? '';

  let rows: Awaited<ReturnType<typeof adminQueries.listConversations>> = [];
  let queryError: string | null = null;
  if (enabled) {
    try {
      rows = await adminQueries.listConversations({
        q: q || undefined,
        language: lang || undefined,
        status: (status as 'open' | 'idle' | 'archived' | 'purged' | '') || undefined,
        limit: 100,
      });
    } catch (err) {
      queryError = (err as Error).message;
    }
  }

  return (
    <AdminShell adminEmail={session.email} active="chat">
      <ChatAdminNav active="conversations" />
      <header className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Conversations</h1>
      </header>

      <form className="mb-4 flex flex-wrap gap-2 text-sm" method="get">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Rechercher dans les messages…"
          className="flex-1 min-w-[220px] rounded-md border border-stone-300 px-3 py-1.5"
        />
        <select
          name="lang"
          defaultValue={lang}
          className="rounded-md border border-stone-300 px-2 py-1.5"
        >
          <option value="">Toutes langues</option>
          <option value="fr">FR</option>
          <option value="ar">AR</option>
          <option value="ar-MA">Darija</option>
        </select>
        <select
          name="status"
          defaultValue={status}
          className="rounded-md border border-stone-300 px-2 py-1.5"
        >
          <option value="">Tous statuts</option>
          <option value="open">Open</option>
          <option value="idle">Idle</option>
          <option value="archived">Archived</option>
          <option value="purged">Purged</option>
        </select>
        <button
          type="submit"
          className="rounded-md bg-stone-900 px-3 py-1.5 text-white"
        >
          Filtrer
        </button>
      </form>

      {queryError && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {queryError}
        </div>
      )}

      <div className="overflow-x-auto rounded-md border border-stone-200 bg-white">
        <table className="min-w-full divide-y divide-stone-200 text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase text-stone-500">
            <tr>
              <th className="px-3 py-2">Session</th>
              <th className="px-3 py-2">Page</th>
              <th className="px-3 py-2">Lang</th>
              <th className="px-3 py-2">Statut</th>
              <th className="px-3 py-2">Ouverte</th>
              <th className="px-3 py-2">Conversion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-stone-500">
                  Aucune conversation trouvée.
                </td>
              </tr>
            ) : (
              rows.map((s) => (
                <tr key={s.id} className="hover:bg-stone-50">
                  <td className="px-3 py-2 font-mono text-xs">
                    <Link
                      href={`/admin/chat/conversations/${s.id}`}
                      className="text-stone-900 underline-offset-2 hover:underline"
                    >
                      {s.id}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-stone-600">{s.page ?? '—'}</td>
                  <td className="px-3 py-2 uppercase">{s.language}</td>
                  <td className="px-3 py-2">{s.status}</td>
                  <td className="px-3 py-2 text-stone-500">
                    {s.openedAt.toISOString().slice(0, 16).replace('T', ' ')}
                  </td>
                  <td className="px-3 py-2">
                    {s.convertedAt ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                        ✓
                      </span>
                    ) : (
                      <span className="text-stone-400">—</span>
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
