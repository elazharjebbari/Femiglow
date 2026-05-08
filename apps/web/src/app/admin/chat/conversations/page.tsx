/**
 * CHA-105 / CHA-106 — Liste des conversations + recherche plein texte.
 *
 * CHA-225 — Ajout filtre "converti" (yes / no) + voyant visuel pour les
 * sessions converties (highlight de la ligne + pastille verte).
 */
import Link from 'next/link';

import { AdminShell } from '@/components/admin/AdminShell';
import { ChatAdminNav } from '@/components/admin/chat/ChatAdminNav';
import { adminQueries } from '@/lib/chat/admin/queries';
import { isChatEnabled } from '@/lib/chat/feature-flag';
import { requireAdmin } from '@/lib/auth/require-admin';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams?: { q?: string; lang?: string; status?: string; converted?: string };
}

export default async function ChatConversationsPage({ searchParams }: PageProps) {
  const session = await requireAdmin('/admin/chat/conversations');
  const enabled = isChatEnabled();

  const q = searchParams?.q?.trim() ?? '';
  const lang = searchParams?.lang?.trim() ?? '';
  const status = searchParams?.status?.trim() ?? '';
  const convertedRaw = searchParams?.converted?.trim() ?? '';
  const converted: 'yes' | 'no' | undefined =
    convertedRaw === 'yes' || convertedRaw === 'no' ? convertedRaw : undefined;

  let rows: Awaited<ReturnType<typeof adminQueries.listConversations>> = [];
  let convertedIds = new Set<string>();
  let queryError: string | null = null;
  if (enabled) {
    try {
      rows = await adminQueries.listConversations({
        q: q || undefined,
        language: lang || undefined,
        status: (status as 'open' | 'idle' | 'archived' | 'purged' | '') || undefined,
        converted,
        limit: 100,
      });
      // On (re)calcule l'ensemble des convertis pour marquer les lignes
      // côté UI, indépendamment du filtre. Coût : 2 SELECT id seulement.
      const ids = await adminQueries.convertedSessionIds();
      convertedIds = new Set(ids);
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
        <select
          name="converted"
          defaultValue={converted ?? ''}
          className="rounded-md border border-stone-300 px-2 py-1.5"
          aria-label="Filtre converti"
        >
          <option value="">Convertis & non convertis</option>
          <option value="yes">Convertis uniquement</option>
          <option value="no">Non convertis uniquement</option>
        </select>
        <button
          type="submit"
          className="rounded-md bg-stone-900 px-3 py-1.5 text-white"
        >
          Filtrer
        </button>
        <Link
          href="/admin/chat/conversations"
          className="rounded-md border border-stone-300 px-3 py-1.5 text-stone-700 hover:bg-stone-100"
        >
          Réinitialiser
        </Link>
      </form>

      <p className="mb-3 text-xs text-stone-500" aria-live="polite">
        {rows.length} conversation{rows.length === 1 ? '' : 's'} ·{' '}
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden /> converties :{' '}
          {rows.filter((s) => convertedIds.has(s.id)).length}
        </span>
      </p>

      {queryError && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {queryError}
        </div>
      )}

      <div className="overflow-x-auto rounded-md border border-stone-200 bg-white">
        <table className="min-w-full divide-y divide-stone-200 text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase text-stone-500">
            <tr>
              <th className="w-2 px-2 py-2" aria-label="Voyant conversion" />
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
                <td colSpan={7} className="px-3 py-6 text-center text-stone-500">
                  Aucune conversation trouvée.
                </td>
              </tr>
            ) : (
              rows.map((s) => {
                const isConverted = convertedIds.has(s.id);
                return (
                  <tr
                    key={s.id}
                    className={
                      isConverted
                        ? 'bg-emerald-50/70 hover:bg-emerald-50'
                        : 'hover:bg-stone-50'
                    }
                  >
                    <td
                      className={`w-2 px-2 py-2 ${isConverted ? 'bg-emerald-500' : 'bg-transparent'}`}
                      aria-hidden
                      title={isConverted ? 'Conversation convertie' : undefined}
                    />
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
                      {isConverted ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                          <span
                            className="h-1.5 w-1.5 rounded-full bg-emerald-500"
                            aria-hidden
                          />
                          Convertie
                        </span>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
