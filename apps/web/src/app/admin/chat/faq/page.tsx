/**
 * CHA-303 — Console FAQ : liste paginée + actions inline (toggle, edit,
 * delete). Cascade L3 du chat — chaque entrée porte son `threshold`
 * (cosine similarity vs `question_embedding`).
 */
import { AdminShell } from '@/components/admin/AdminShell';
import { ChatAdminNav } from '@/components/admin/chat/ChatAdminNav';
import { faqRepo } from '@/lib/chat/repos/faq';
import { isChatEnabled } from '@/lib/chat/feature-flag';
import { requireAdmin } from '@/lib/auth/require-admin';

export const dynamic = 'force-dynamic';

const FLASH_MESSAGES: Record<string, string> = {
  created: 'FAQ créée.',
  updated: 'FAQ mise à jour.',
  deleted: 'FAQ supprimée.',
  enabled: 'FAQ activée.',
  disabled: 'FAQ désactivée.',
};

export default async function FaqAdminPage({
  searchParams,
}: {
  searchParams: { ok?: string; lang?: string };
}) {
  const session = await requireAdmin('/admin/chat/faq');
  const enabled = isChatEnabled();
  const rows = enabled ? await faqRepo.listAll().catch(() => []) : [];
  const flash = searchParams.ok ? FLASH_MESSAGES[searchParams.ok] : null;

  const langFilter = searchParams.lang;
  const filtered = langFilter
    ? rows.filter((r) => r.language === langFilter)
    : rows;

  const counts = {
    total: rows.length,
    enabled: rows.filter((r) => r.enabled).length,
    fr: rows.filter((r) => r.language === 'fr').length,
    ar: rows.filter((r) => r.language === 'ar').length,
    arMa: rows.filter((r) => r.language === 'ar-MA').length,
  };

  return (
    <AdminShell adminEmail={session.email} active="chat">
      <ChatAdminNav active="faq" />
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">FAQ</h1>
          <p className="text-sm text-stone-600">
            Cascade L3 — réponse scriptée si la similarité cosine ≥ seuil par
            entrée. Sinon fallback RAG + LLM.
          </p>
        </div>
        <a
          href="/admin/chat/faq/new"
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          + Nouvelle FAQ
        </a>
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
        <LangFilter active={langFilter} count={counts.fr} lang="fr" />
        <LangFilter active={langFilter} count={counts.ar} lang="ar" />
        <LangFilter active={langFilter} count={counts.arMa} lang="ar-MA" />
        {langFilter ? (
          <a href="/admin/chat/faq" className="text-stone-500 underline">
            tout afficher
          </a>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-md border border-stone-200 bg-white">
        <table className="min-w-full divide-y divide-stone-200 text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase text-stone-500">
            <tr>
              <th className="px-3 py-2">Key</th>
              <th className="px-3 py-2">Lang</th>
              <th className="px-3 py-2">Question</th>
              <th className="px-3 py-2">Seuil</th>
              <th className="px-3 py-2">Audience</th>
              <th className="px-3 py-2">Statut</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-stone-500">
                  {enabled
                    ? "Aucune FAQ. Cliquer « Nouvelle FAQ » ou lancer le seeder `seed-chat-faq`."
                    : 'Chat désactivé — feature flag off.'}
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2 font-mono text-xs">{r.key}</td>
                  <td className="px-3 py-2 uppercase text-xs">{r.language}</td>
                  <td className="max-w-md px-3 py-2 text-stone-700">
                    <p className="line-clamp-2">{r.questionCanonical}</p>
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {Number(r.threshold).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-xs">{r.audience}</td>
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
                        action={`/api/admin/chat/faq/${r.id}`}
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
                      <a
                        href={`/admin/chat/faq/${r.id}`}
                        className="rounded-md border border-stone-300 px-2 py-1 text-xs hover:bg-stone-100"
                      >
                        Modifier
                      </a>
                      <form
                        method="post"
                        action={`/api/admin/chat/faq/${r.id}`}
                        className="inline"
                      >
                        <input type="hidden" name="_action" value="delete" />
                        <button
                          type="submit"
                          className="rounded-md border border-rose-200 bg-white px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"
                          aria-label={`Supprimer la FAQ ${r.key}`}
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

function LangFilter({
  active,
  count,
  lang,
}: {
  active?: string;
  count: number;
  lang: string;
}) {
  const isActive = active === lang;
  return (
    <a
      href={`/admin/chat/faq?lang=${encodeURIComponent(lang)}`}
      className={`rounded-full px-2 py-1 ${
        isActive ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
      }`}
    >
      {lang} · {count}
    </a>
  );
}
