/**
 * CHA-118 / CHA-119 — Themes : liste + édition + salutations.
 */
import { AdminShell } from '@/components/admin/AdminShell';
import { ChatAdminNav } from '@/components/admin/chat/ChatAdminNav';
import { adminQueries } from '@/lib/chat/admin/queries';
import { isChatEnabled } from '@/lib/chat/feature-flag';
import { requireAdmin } from '@/lib/auth/require-admin';

export const dynamic = 'force-dynamic';

export default async function ThemesPage() {
  const session = await requireAdmin('/admin/chat/themes');
  const enabled = isChatEnabled();
  const themes = enabled ? await adminQueries.listThemes().catch(() => []) : [];

  return (
    <AdminShell adminEmail={session.email} active="chat">
      <ChatAdminNav active="themes" />
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Thèmes UX</h1>
          <p className="text-sm text-stone-600">
            Tokens CSS, layout, motion (humanize), salutations contextuelles.
          </p>
        </div>
        <form action="/api/admin/chat/seed-defaults" method="POST">
          <button
            type="submit"
            className="rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-800 hover:bg-stone-100"
            title="Crée le thème par défaut FemiGlow si absent. Idempotent."
          >
            ⚙ Seed par défaut
          </button>
        </form>
      </header>

      <ul className="space-y-3">
        {themes.length === 0 && (
          <li className="rounded-md border border-stone-200 bg-white px-4 py-6 text-center text-sm text-stone-500">
            Aucun thème. Cliquer <strong>« Seed par défaut »</strong> pour créer
            le thème FemiGlow (tokens CSS + salutations FR/AR/Darija).
          </li>
        )}
        {themes.map((t) => (
          <li
            key={t.id}
            className="flex items-start justify-between gap-4 rounded-md border border-stone-200 bg-white p-4"
          >
            <div className="flex-1">
              <p className="font-medium">
                {t.name}
                {t.isDefault && (
                  <span className="ml-2 rounded-full bg-stone-900 px-2 py-0.5 text-xs text-white">
                    default
                  </span>
                )}
              </p>
              <p className="mt-1 text-xs text-stone-500">
                Tokens : {Object.keys(t.tokens).length} ·{' '}
                {t.pageSalutations?.length ?? 0} salutations contextuelles
              </p>
              <pre className="mt-2 overflow-x-auto rounded bg-stone-50 px-3 py-2 text-xs">
{JSON.stringify(t.tokens, null, 2)}
              </pre>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                t.enabled
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-stone-200 text-stone-600'
              }`}
            >
              {t.enabled ? 'on' : 'off'}
            </span>
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
