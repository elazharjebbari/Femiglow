/**
 * CHA-104 — Vue d'ensemble du chat (cartes KPIs + toggle runtime).
 */
import { AdminShell } from '@/components/admin/AdminShell';
import { ChatAdminNav } from '@/components/admin/chat/ChatAdminNav';
import { adminQueries } from '@/lib/chat/admin/queries';
import { isChatEnabled } from '@/lib/chat/feature-flag';
import { isChatActive } from '@/lib/chat/runtime-setting';
import { requireAdmin } from '@/lib/auth/require-admin';

export const dynamic = 'force-dynamic';

export default async function ChatOverviewPage() {
  const session = await requireAdmin('/admin/chat');
  const envEnabled = isChatEnabled();
  const active = envEnabled ? await isChatActive() : false;

  let kpis: Awaited<ReturnType<typeof adminQueries.overviewKpis>> | null = null;
  let queryError: string | null = null;
  let providerCount = 0;
  if (envEnabled) {
    try {
      kpis = await adminQueries.overviewKpis('7d');
      const providers = await adminQueries.listProviders();
      providerCount = providers.filter((p) => p.enabled).length;
    } catch (err) {
      queryError = (err as Error).message;
    }
  }

  return (
    <AdminShell adminEmail={session.email} active="chat">
      <ChatAdminNav active="overview" />
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          Chat — vue d'ensemble
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          Indicateurs clés des 7 derniers jours.
        </p>
      </header>

      {!envEnabled && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Chat désactivé — définir <code>CHAT_ENABLED=true</code> et configurer
          au moins un provider pour activer le module.
        </div>
      )}

      {envEnabled && (
        <section className="mb-6 rounded-md border border-stone-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium uppercase tracking-wide text-stone-500">
                Statut du module
              </h2>
              <p className="mt-1 text-sm text-stone-700">
                {active ? (
                  <>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      Actif — widget visiteur monté, /api/chat/* ouvert.
                    </span>
                  </>
                ) : (
                  <>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-stone-400" />
                      Suspendu — toggle DB désactivé. Réactivable ci-dessous.
                    </span>
                  </>
                )}
              </p>
              {providerCount === 0 && (
                <p className="mt-2 text-xs text-amber-700">
                  Aucun provider actif. Ajouter une clé API depuis{' '}
                  <a
                    href="/admin/chat/providers/new"
                    className="underline hover:no-underline"
                  >
                    /admin/chat/providers/new
                  </a>
                  .
                </p>
              )}
            </div>
            <form
              action="/api/admin/chat/settings/toggle"
              method="POST"
              className="flex items-center gap-2"
            >
              <input type="hidden" name="enabled" value={active ? 'false' : 'true'} />
              <button
                type="submit"
                className={`rounded-md px-4 py-2 text-sm font-medium ${
                  active
                    ? 'bg-stone-200 text-stone-900 hover:bg-stone-300'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
              >
                {active ? 'Suspendre' : 'Activer'}
              </button>
            </form>
          </div>
        </section>
      )}

      {queryError && (
        <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          Erreur de requête : {queryError}
        </div>
      )}

      {kpis && (
        <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Sessions" value={kpis.sessions} />
          <Kpi label="Messages user" value={kpis.messagesUser} />
          <Kpi label="Messages agent" value={kpis.messagesAgent} />
          <Kpi label="Conversions" value={kpis.conversions} />
          <Kpi label="Feedback positif" value={kpis.feedbackPos} accent="emerald" />
          <Kpi label="Feedback négatif" value={kpis.feedbackNeg} accent="rose" />
          <Kpi
            label="Coût total"
            value={`${kpis.totalCostEur.toFixed(4)} €`}
          />
          <Kpi
            label="Latence P50 / P95"
            value={
              kpis.latencyP50 != null && kpis.latencyP95 != null
                ? `${Math.round(kpis.latencyP50)} / ${Math.round(kpis.latencyP95)} ms`
                : '—'
            }
          />
        </section>
      )}
    </AdminShell>
  );
}

function Kpi({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: 'emerald' | 'rose';
}) {
  const accentClass =
    accent === 'emerald'
      ? 'text-emerald-700'
      : accent === 'rose'
        ? 'text-rose-700'
        : 'text-stone-900';
  return (
    <div className="rounded-md border border-stone-200 bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-stone-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${accentClass}`}>{value}</p>
    </div>
  );
}
