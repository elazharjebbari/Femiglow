/**
 * CHA-300 — Console Suggestions (canned-pair) : liste + actions inline
 * (toggle, publish, edit, delete). Cascade L2 du chat — chaque suggestion
 * est servie page-aware via `pagePattern`.
 */
import { AdminShell } from '@/components/admin/AdminShell';
import { ChatAdminNav } from '@/components/admin/chat/ChatAdminNav';
import { cannedPairRepo } from '@/lib/chat/repos/canned-pair';
import { isChatEnabled } from '@/lib/chat/feature-flag';
import { requireAdmin } from '@/lib/auth/require-admin';

export const dynamic = 'force-dynamic';

const FLASH_MESSAGES: Record<string, string> = {
  created: 'Suggestion créée.',
  updated: 'Suggestion mise à jour.',
  deleted: 'Suggestion supprimée.',
  enabled: 'Suggestion activée.',
  disabled: 'Suggestion désactivée.',
  published: 'Suggestion publiée.',
  seeded: 'Pastilles par défaut importées (UPSERT depuis CSV + versioning).',
};

export default async function SuggestionsAdminPage({
  searchParams,
}: {
  searchParams: { ok?: string; status?: string };
}) {
  const session = await requireAdmin('/admin/chat/suggestions');
  const enabled = isChatEnabled();
  const rows = enabled ? await cannedPairRepo.listAll().catch(() => []) : [];
  const flash = searchParams.ok ? FLASH_MESSAGES[searchParams.ok] : null;

  const statusFilter = searchParams.status;
  const filtered = statusFilter
    ? rows.filter((r) => r.status === statusFilter)
    : rows;

  const counts = {
    total: rows.length,
    enabled: rows.filter((r) => r.enabled).length,
    draft: rows.filter((r) => r.status === 'draft').length,
    review: rows.filter((r) => r.status === 'review').length,
    published: rows.filter((r) => r.status === 'published').length,
    archived: rows.filter((r) => r.status === 'archived').length,
  };

  return (
    <AdminShell adminEmail={session.email} active="chat">
      <ChatAdminNav active="suggestions" />
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Suggestions</h1>
          <p className="text-sm text-stone-600">
            Cascade L2 — SuggestionPills page-aware. Le visiteur clique une
            pill, le chat renvoie la réponse scriptée associée dans sa langue.
          </p>
        </div>
        <div className="flex gap-2">
          <form action="/api/admin/chat/suggestions/seed-defaults" method="POST">
            <button
              type="submit"
              className="rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-800 hover:bg-stone-100"
              title="Importe les pastilles par défaut depuis le CSV livré avec le projet. Idempotent (UPSERT par key avec versioning)."
            >
              ⚙ Seed par défaut
            </button>
          </form>
          <a
            href="/admin/chat/suggestions/new"
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            + Nouvelle suggestion
          </a>
        </div>
      </header>

      {flash ? (
        <div
          role="status"
          className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
        >
          {flash}
        </div>
      ) : null}

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-stone-600">
        <span className="rounded-full bg-stone-100 px-2 py-1">
          {counts.total} entrées · {counts.enabled} actives
        </span>
        <StatusFilter active={statusFilter} count={counts.draft} status="draft" />
        <StatusFilter active={statusFilter} count={counts.review} status="review" />
        <StatusFilter
          active={statusFilter}
          count={counts.published}
          status="published"
        />
        <StatusFilter
          active={statusFilter}
          count={counts.archived}
          status="archived"
        />
        {statusFilter ? (
          <a href="/admin/chat/suggestions" className="text-stone-500 underline">
            tout afficher
          </a>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-md border border-stone-200 bg-white">
        <table className="min-w-full divide-y divide-stone-200 text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase text-stone-500">
            <tr>
              <th className="px-3 py-2">Key</th>
              <th className="px-3 py-2">Page</th>
              <th className="px-3 py-2">Label FR</th>
              <th className="px-3 py-2">Audience</th>
              <th className="px-3 py-2">Ordre</th>
              <th className="px-3 py-2">Statut</th>
              <th className="px-3 py-2">On</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-stone-500">
                  {enabled
                    ? 'Aucune suggestion. Cliquer « Nouvelle suggestion » pour commencer.'
                    : 'Chat désactivé — feature flag off.'}
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2 font-mono text-xs">{r.key}</td>
                  <td className="px-3 py-2 font-mono text-xs text-stone-600">
                    {r.pagePattern}
                  </td>
                  <td className="max-w-xs px-3 py-2 text-stone-700">
                    <p className="line-clamp-1">{r.labelFr}</p>
                  </td>
                  <td className="px-3 py-2 text-xs">{r.audience}</td>
                  <td className="px-3 py-2 tabular-nums text-xs">{r.order}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-3 py-2">
                    {r.enabled ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                        on
                      </span>
                    ) : (
                      <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs text-stone-600">
                        off
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center gap-2">
                      <form
                        method="post"
                        action={`/api/admin/chat/suggestions/${r.id}`}
                        className="inline"
                      >
                        <input type="hidden" name="_action" value="toggle" />
                        <button
                          type="submit"
                          className="rounded-md border border-stone-300 px-2 py-1 text-xs hover:bg-stone-100"
                          aria-label={r.enabled ? 'Désactiver' : 'Activer'}
                        >
                          {r.enabled ? 'Désactiver' : 'Activer'}
                        </button>
                      </form>
                      {r.status !== 'published' ? (
                        <form
                          method="post"
                          action={`/api/admin/chat/suggestions/${r.id}`}
                          className="inline"
                        >
                          <input type="hidden" name="_action" value="publish" />
                          <button
                            type="submit"
                            className="rounded-md border border-emerald-200 bg-white px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50"
                            aria-label={`Publier la suggestion ${r.key}`}
                          >
                            Publier
                          </button>
                        </form>
                      ) : null}
                      <a
                        href={`/admin/chat/suggestions/${r.id}`}
                        className="rounded-md border border-stone-300 px-2 py-1 text-xs hover:bg-stone-100"
                      >
                        Modifier
                      </a>
                      <form
                        method="post"
                        action={`/api/admin/chat/suggestions/${r.id}`}
                        className="inline"
                      >
                        <input type="hidden" name="_action" value="delete" />
                        <button
                          type="submit"
                          className="rounded-md border border-rose-200 bg-white px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"
                          aria-label={`Supprimer la suggestion ${r.key}`}
                        >
                          Supprimer
                        </button>
                      </form>
                    </div>
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

function StatusFilter({
  active,
  count,
  status,
}: {
  active?: string;
  count: number;
  status: string;
}) {
  const isActive = active === status;
  return (
    <a
      href={`/admin/chat/suggestions?status=${encodeURIComponent(status)}`}
      className={`rounded-full px-2 py-1 ${
        isActive
          ? 'bg-stone-900 text-white'
          : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
      }`}
    >
      {status} · {count}
    </a>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-stone-200 text-stone-700',
    review: 'bg-amber-100 text-amber-700',
    published: 'bg-emerald-100 text-emerald-700',
    archived: 'bg-stone-300 text-stone-600',
  };
  const cls = styles[status] ?? 'bg-stone-100 text-stone-600';
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${cls}`}>{status}</span>
  );
}
