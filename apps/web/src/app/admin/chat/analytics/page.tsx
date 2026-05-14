/**
 * CHAT-055 — Dashboard Business (panels B1 North Star, B2 Funnel, B3 Intents).
 *
 * Pourquoi
 * ────────
 * Selma (PO) et Yasmine (content) veulent voir d'un coup d'oeil l'efficacité
 * du chat sur le revenu : combien de visiteurs ouvrent, qui pose une question,
 * qui devient lead, qui convertit. Et quels intents drivent la majorité du
 * trafic, pour prioriser le travail FAQ / canned pairs / RAG.
 *
 * On reste sur des composants HTML/CSS purs : ni recharts ni tremor pour
 * cette itération (cf. plan-action — V5 = ship, V6 = polish UI charts).
 */
import { AdminShell } from '@/components/admin/AdminShell';
import { ChatAdminNav } from '@/components/admin/chat/ChatAdminNav';
import { adminQueries, type KpiWindow } from '@/lib/chat/admin/queries';
import { isChatEnabled } from '@/lib/chat/feature-flag';
import { buildFunnel, buildIntentShares } from '@/lib/chat/services/analytics-funnel';
import { requireAdmin } from '@/lib/auth/require-admin';

export const dynamic = 'force-dynamic';

const WINDOWS: KpiWindow[] = ['today', 'yesterday', '7d', '30d', '90d', 'all'];
const INTENT_TOP_N = 10;
const TABS = ['business', 'editorial'] as const;
type Tab = (typeof TABS)[number];

export default async function ChatAnalyticsPage({
  searchParams,
}: {
  searchParams?: { w?: string; tab?: string };
}) {
  const session = await requireAdmin('/admin/chat/analytics');
  const enabled = isChatEnabled();
  const w = (WINDOWS.find((x) => x === searchParams?.w) ?? '30d') as KpiWindow;
  const tab: Tab = (TABS.find((t) => t === searchParams?.tab) ?? 'business') as Tab;

  // On ne charge que le dataset utile à l'onglet pour éviter d'engorger
  // la page avec des queries non rendues. Le tab Business est le défaut.
  const business =
    enabled && tab === 'business'
      ? await adminQueries.businessFunnel(w).catch(() => null)
      : null;
  const funnel = business ? buildFunnel(business.counts) : null;
  const intents = business ? buildIntentShares(business.intentCounts) : [];

  const editorial =
    enabled && tab === 'editorial'
      ? await adminQueries.editorialOverview().catch(() => null)
      : null;

  return (
    <AdminShell adminEmail={session.email} active="chat">
      <ChatAdminNav active="analytics" />
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            Analytics — {tab === 'business' ? 'Business' : 'Editorial'}
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            {tab === 'business'
              ? "Funnel, North Star et distribution d'intents sur la fenêtre choisie."
              : 'Matériel à publier (canned pairs) et FAQ à rafraîchir.'}
          </p>
        </div>
        {tab === 'business' && (
          <nav aria-label="Fenêtre temporelle" className="flex gap-1 text-sm">
            {WINDOWS.map((window) => (
              <a
                key={window}
                href={`?tab=business&w=${window}`}
                className={`rounded-md px-3 py-1 ${
                  w === window ? 'bg-stone-900 text-white' : 'border border-stone-300'
                }`}
              >
                {window}
              </a>
            ))}
          </nav>
        )}
      </header>

      <nav
        aria-label="Onglets analytics"
        className="mb-4 inline-flex rounded-md border border-stone-200 bg-white p-0.5 text-sm"
      >
        {TABS.map((t) => (
          <a
            key={t}
            href={`?tab=${t}${t === 'business' ? `&w=${w}` : ''}`}
            className={`rounded-md px-3 py-1 ${
              tab === t ? 'bg-stone-900 text-white' : 'text-stone-700 hover:bg-stone-100'
            }`}
            aria-current={tab === t ? 'page' : undefined}
          >
            {t === 'business' ? 'Business' : 'Editorial'}
          </a>
        ))}
      </nav>

      {tab === 'business' ? (
        !business ? (
          <p className="text-sm text-stone-500">
            Analytics indisponibles {enabled ? '— vérifier la base.' : '— chat désactivé.'}
          </p>
        ) : (
          <>
            {/* B1 — North Star */}
            <section
              className="mb-6 grid gap-3 sm:grid-cols-3"
              aria-label="B1 North Star"
            >
              <BigCard
                label="Conversion rate"
                value={formatPct(funnel?.conversionRate ?? 0)}
                sub={`${business.counts.conversions} conv. / ${business.counts.sessions} sessions`}
              />
              <BigCard
                label="Lead rate"
                value={formatPct(
                  business.counts.sessions > 0
                    ? business.counts.leadsSubmitted / business.counts.sessions
                    : 0,
                )}
                sub={`${business.counts.leadsSubmitted} leads soumis`}
              />
              <BigCard
                label="Lead-to-order"
                value={formatPct(
                  business.counts.leadsSubmitted > 0
                    ? business.counts.conversions / business.counts.leadsSubmitted
                    : 0,
                )}
                sub={`${business.counts.conversions} sur ${business.counts.leadsSubmitted}`}
              />
            </section>

            {/* B2 — Funnel principal */}
            <section
              className="mb-6 overflow-x-auto rounded-md border border-stone-200 bg-white"
              aria-label="B2 Funnel principal"
            >
              <header className="border-b border-stone-200 px-4 py-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
                  Funnel principal
                </h2>
              </header>
              <table className="min-w-full divide-y divide-stone-200 text-sm">
                <thead className="bg-stone-50 text-left text-xs uppercase text-stone-500">
                  <tr>
                    <th className="px-3 py-2">Étape</th>
                    <th className="px-3 py-2 text-right">Visiteurs</th>
                    <th className="px-3 py-2 text-right">% du précédent</th>
                    <th className="px-3 py-2 text-right">% des sessions</th>
                    <th className="px-3 py-2">Volume</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {funnel?.steps.map((step) => (
                    <tr key={step.key}>
                      <td className="px-3 py-2 font-medium text-stone-900">{step.label}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {step.value.toLocaleString('fr-FR')}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-stone-600">
                        {step.fromPrev == null ? '—' : formatPct(step.fromPrev)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-stone-600">
                        {formatPct(step.fromBase)}
                      </td>
                      <td className="px-3 py-2">
                        <BarBlock ratio={step.fromBase} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {/* B3 — Intents distribution */}
            <section
              className="overflow-x-auto rounded-md border border-stone-200 bg-white"
              aria-label="B3 Intents distribution"
            >
              <header className="border-b border-stone-200 px-4 py-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
                  Intents capturés (top {INTENT_TOP_N})
                </h2>
              </header>
              {intents.length === 0 ? (
                <p className="px-4 py-6 text-sm text-stone-500">
                  Aucun lead capturé sur cette fenêtre.
                </p>
              ) : (
                <table className="min-w-full divide-y divide-stone-200 text-sm">
                  <thead className="bg-stone-50 text-left text-xs uppercase text-stone-500">
                    <tr>
                      <th className="px-3 py-2">Intent</th>
                      <th className="px-3 py-2 text-right">Leads</th>
                      <th className="px-3 py-2 text-right">Part</th>
                      <th className="px-3 py-2">Volume</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {intents.slice(0, INTENT_TOP_N).map((row) => (
                      <tr key={row.intent}>
                        <td className="px-3 py-2 font-mono text-xs text-stone-700">
                          {row.intent}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.count}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-stone-600">
                          {formatPct(row.share)}
                        </td>
                        <td className="px-3 py-2">
                          <BarBlock ratio={row.share} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </>
        )
      ) : !editorial ? (
        <p className="text-sm text-stone-500">
          Editorial indisponible {enabled ? '— vérifier la base.' : '— chat désactivé.'}
        </p>
      ) : (
        <EditorialPanels
          reviewCannedPairs={editorial.reviewCannedPairs}
          staleFaqEntries={editorial.staleFaqEntries}
          staleAfter={editorial.staleAfter}
        />
      )}
    </AdminShell>
  );
}

function EditorialPanels({
  reviewCannedPairs,
  staleFaqEntries,
  staleAfter,
}: {
  reviewCannedPairs: import('@/lib/chat/db/schema').ChatCannedPairRow[];
  staleFaqEntries: import('@/lib/chat/db/schema').ChatFaqEntryRow[];
  staleAfter: Date;
}) {
  return (
    <>
      <section
        className="mb-6 overflow-x-auto rounded-md border border-stone-200 bg-white"
        aria-label="E1 Suggestions à publier"
      >
        <header className="flex items-center justify-between border-b border-stone-200 px-4 py-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            E1 — Canned pairs à publier ({reviewCannedPairs.length})
          </h2>
          <a
            href="/admin/chat/suggestions"
            className="text-xs text-stone-700 underline-offset-2 hover:underline"
          >
            Aller à la gestion →
          </a>
        </header>
        {reviewCannedPairs.length === 0 ? (
          <p className="px-4 py-6 text-sm text-stone-500">
            Rien en review ni en draft. Tout est publié.
          </p>
        ) : (
          <table className="min-w-full divide-y divide-stone-200 text-sm">
            <thead className="bg-stone-50 text-left text-xs uppercase text-stone-500">
              <tr>
                <th className="px-3 py-2">Key</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Page pattern</th>
                <th className="px-3 py-2">Audience</th>
                <th className="px-3 py-2">Modifiée</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {reviewCannedPairs.map((p) => (
                <tr key={p.id} className="hover:bg-stone-50">
                  <td className="px-3 py-2 font-mono text-xs">{p.key}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      {p.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-stone-600">{p.pagePattern}</td>
                  <td className="px-3 py-2 text-xs text-stone-600">{p.audience}</td>
                  <td className="px-3 py-2 text-xs text-stone-500">
                    {p.updatedAt.toISOString().slice(0, 10)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <a
                      href={`/admin/chat/suggestions/${p.id}`}
                      className="text-xs text-stone-700 underline-offset-2 hover:underline"
                    >
                      Ouvrir
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section
        className="overflow-x-auto rounded-md border border-stone-200 bg-white"
        aria-label="E2 FAQ à rafraîchir"
      >
        <header className="flex items-center justify-between border-b border-stone-200 px-4 py-2">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              E2 — FAQ entries à rafraîchir ({staleFaqEntries.length})
            </h2>
            <p className="text-xs text-stone-500">
              Entries activées, non mises à jour depuis le {staleAfter.toISOString().slice(0, 10)}.
            </p>
          </div>
          <a
            href="/admin/chat/faq"
            className="text-xs text-stone-700 underline-offset-2 hover:underline"
          >
            Aller à la gestion →
          </a>
        </header>
        {staleFaqEntries.length === 0 ? (
          <p className="px-4 py-6 text-sm text-stone-500">
            Aucune FAQ activée n'est obsolète. Bon travail Yasmine.
          </p>
        ) : (
          <table className="min-w-full divide-y divide-stone-200 text-sm">
            <thead className="bg-stone-50 text-left text-xs uppercase text-stone-500">
              <tr>
                <th className="px-3 py-2">Key</th>
                <th className="px-3 py-2">Langue</th>
                <th className="px-3 py-2">Question</th>
                <th className="px-3 py-2">Dernière maj</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {staleFaqEntries.map((f) => (
                <tr key={f.id} className="hover:bg-stone-50">
                  <td className="px-3 py-2 font-mono text-xs">{f.key}</td>
                  <td className="px-3 py-2 text-xs">{f.language}</td>
                  <td className="px-3 py-2 text-xs text-stone-700">
                    {f.questionCanonical.length > 80
                      ? `${f.questionCanonical.slice(0, 80)}…`
                      : f.questionCanonical}
                  </td>
                  <td className="px-3 py-2 text-xs text-stone-500">
                    {f.updatedAt.toISOString().slice(0, 10)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <a
                      href={`/admin/chat/faq/${f.id}`}
                      className="text-xs text-stone-700 underline-offset-2 hover:underline"
                    >
                      Ouvrir
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

function formatPct(ratio: number): string {
  if (!Number.isFinite(ratio)) return '0 %';
  const v = ratio * 100;
  return `${v < 10 ? v.toFixed(2) : v.toFixed(1)} %`;
}

function BigCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border border-stone-200 bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-stone-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-stone-900">{value}</p>
      {sub && <p className="text-xs text-stone-500">{sub}</p>}
    </div>
  );
}

/**
 * Mini barre proportionnelle au ratio (0..1). Pas d'animation pour rester
 * compatible reduced-motion. Min-width 4px pour rester visible si ratio
 * <1% (sinon une barre invisible donne l'impression d'un bug).
 */
function BarBlock({ ratio }: { ratio: number }) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <div className="h-2 w-32 overflow-hidden rounded-full bg-stone-100" role="presentation">
      <div
        className="h-full rounded-full bg-stone-900"
        style={{ width: pct > 0 ? `max(4px, ${pct}%)` : '0' }}
      />
    </div>
  );
}
