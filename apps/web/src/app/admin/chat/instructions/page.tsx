/**
 * CHA-109 / CHA-110 / CHA-111 — Instructions (liste + édition + activation).
 */
import { AdminShell } from '@/components/admin/AdminShell';
import { ChatAdminNav } from '@/components/admin/chat/ChatAdminNav';
import { instructionRepo } from '@/lib/chat/repos/instruction';
import { isChatEnabled } from '@/lib/chat/feature-flag';
import { requireAdmin } from '@/lib/auth/require-admin';

export const dynamic = 'force-dynamic';

export default async function ChatInstructionsPage({
  searchParams,
}: {
  searchParams?: { ok?: string; err?: string };
}) {
  const session = await requireAdmin('/admin/chat/instructions');
  const enabled = isChatEnabled();
  const versions = enabled
    ? await instructionRepo.listByScope('default').catch(() => [])
    : [];

  const flash = (() => {
    const ok = searchParams?.ok;
    const err = searchParams?.err;
    if (ok === 'seed-noop')
      return {
        kind: 'ok' as const,
        msg: "Version par défaut (v2) déjà active — rien à faire.",
      };
    if (ok === 'seeded')
      return {
        kind: 'ok' as const,
        msg: 'Nouvelle version par défaut (v2) créée et activée.',
      };
    if (ok === 'seed-activated')
      return {
        kind: 'ok' as const,
        msg: 'Version par défaut (v2) réactivée.',
      };
    if (err) return { kind: 'err' as const, msg: `Erreur : ${err}` };
    return null;
  })();

  return (
    <AdminShell adminEmail={session.email} active="chat">
      <ChatAdminNav active="instructions" />
      {flash && (
        <div
          role="status"
          className={`mb-4 rounded-md border px-3 py-2 text-sm ${
            flash.kind === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {flash.msg}
        </div>
      )}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Instructions système</h1>
        <div className="flex gap-2">
          <form action="/api/admin/chat/seed-defaults" method="POST">
            <button
              type="submit"
              className="rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-800 hover:bg-stone-100"
              title="Crée et active l'instruction par défaut FR/AR/Darija si absente. Idempotent."
            >
              ⚙ Seed par défaut
            </button>
          </form>
          <a
            href="/admin/chat/instructions/new"
            className="rounded-md bg-stone-900 px-3 py-1.5 text-sm text-white"
          >
            Nouvelle version
          </a>
        </div>
      </header>
      <p className="mb-4 text-sm text-stone-600">
        Versions du prompt système — immuable, activable. Une seule version
        active par scope à la fois.
      </p>

      <ul className="divide-y divide-stone-200 rounded-md border border-stone-200 bg-white">
        {versions.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-stone-500">
            Aucune instruction. Cliquer <strong>« Seed par défaut »</strong> pour
            créer la voix FemiGlow (FR · AR · Darija).
          </li>
        )}
        {versions.map((v) => (
          <li key={v.id} className="flex items-start justify-between gap-4 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                <a
                  href={`/admin/chat/instructions/${v.id}`}
                  className="hover:underline"
                >
                  v{v.version}
                </a>
                {v.enabled && (
                  <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                    active
                  </span>
                )}
              </p>
              <p className="mt-1 line-clamp-2 max-w-xl text-xs text-stone-500">
                {v.body}
              </p>
              <p className="mt-1 text-xs text-stone-400">
                {v.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                {v.notes ? ` — ${v.notes}` : ''}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <a
                href={`/admin/chat/instructions/${v.id}`}
                className="rounded-md border border-stone-300 px-3 py-1 text-xs text-stone-700 hover:bg-stone-100"
              >
                Modifier
              </a>
              {!v.enabled && (
                <form
                  method="post"
                  action={`/api/admin/chat/instructions/${v.id}`}
                >
                  <input type="hidden" name="_action" value="activate" />
                  <button
                    type="submit"
                    className="rounded-md border border-stone-300 px-3 py-1 text-xs hover:bg-stone-100"
                  >
                    Activer
                  </button>
                </form>
              )}
            </div>
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
