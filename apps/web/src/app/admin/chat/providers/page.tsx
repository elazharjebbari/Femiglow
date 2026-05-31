/**
 * CHA-115 / CHA-116 / CHA-117 — Providers : liste + état + politique.
 */
import { AdminShell } from '@/components/admin/AdminShell';
import { ChatAdminNav } from '@/components/admin/chat/ChatAdminNav';
import { adminQueries } from '@/lib/chat/admin/queries';
import { isChatEnabled } from '@/lib/chat/feature-flag';
import { maskSecret } from '@/lib/chat/secrets';
import { requireAdmin } from '@/lib/auth/require-admin';
import { DeleteProviderButton } from './DeleteProviderButton';

export const dynamic = 'force-dynamic';

const FLASH_MESSAGES: Record<string, string> = {
  deleted: 'Provider supprimé.',
};

export default async function ProvidersPage({
  searchParams,
}: {
  searchParams: { ok?: string };
}) {
  const session = await requireAdmin('/admin/chat/providers');
  const enabled = isChatEnabled();
  const providers = enabled ? await adminQueries.listProviders().catch(() => []) : [];
  const flash = searchParams.ok ? FLASH_MESSAGES[searchParams.ok] : null;

  return (
    <AdminShell adminEmail={session.email} active="chat">
      <ChatAdminNav active="providers" />
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Providers</h1>
          <p className="text-sm text-stone-600">
            Politique de fallback : priorité ascendante (1 = premier essayé).
          </p>
        </div>
        <a
          href="/admin/chat/providers/new"
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          + Nouveau provider
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

      <div className="overflow-x-auto rounded-md border border-stone-200 bg-white">
        <table className="min-w-full divide-y divide-stone-200 text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase text-stone-500">
            <tr>
              <th className="px-3 py-2">Label</th>
              <th className="px-3 py-2">Kind</th>
              <th className="px-3 py-2">Rôle</th>
              <th className="px-3 py-2">Priorité</th>
              <th className="px-3 py-2">Modèle</th>
              <th className="px-3 py-2">Clé</th>
              <th className="px-3 py-2">Quota mens.</th>
              <th className="px-3 py-2">Consommé</th>
              <th className="px-3 py-2">Statut</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {providers.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-stone-500">
                  Aucun provider configuré.
                </td>
              </tr>
            ) : (
              providers.map((p) => (
                <tr key={p.id}>
                  <td className="px-3 py-2 font-medium">{p.label}</td>
                  <td className="px-3 py-2">{p.kind}</td>
                  <td className="px-3 py-2">{p.role}</td>
                  <td className="px-3 py-2 tabular-nums">{p.priority}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {p.role === 'embedding' ? p.embeddingModel : p.chatModel}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {p.apiKeyEncrypted
                      ? maskSecret('•'.repeat(40))
                      : p.kind === 'ollama'
                        ? '—'
                        : 'manquante'}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-xs">
                    {p.quotaMonthlyEur ?? '—'} €
                  </td>
                  <td className="px-3 py-2 tabular-nums text-xs">
                    {Number(p.consumedMonthEur).toFixed(4)} €
                  </td>
                  <td className="px-3 py-2">
                    {p.enabled ? (
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
                    <DeleteProviderButton id={p.id} label={p.label} />
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
