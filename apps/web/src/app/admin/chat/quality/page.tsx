/**
 * CHA-230 Phase 3.4 — Dashboard "Qualité de la classification d'intent".
 *
 * Page Server Component qui rend des agrégats SQL :
 *   - distribution par intent_tag (top par volume)
 *   - distribution par méthode (regex vs llm vs llm-fixed vs manual)
 *   - distribution par niveau de confiance
 *   - taille du golden-set
 *
 * Choix d'implémentation : pas de graphes lourds (Recharts) — on
 * affiche des tables avec des barres horizontales en pure CSS pour
 * rester léger côté bundle. C'est suffisant pour un dashboard interne.
 *
 * cf. docs/chat-assistant/20-langchain-robustness-plan.md §2.7.4
 */
import Link from 'next/link';

import { AdminShell } from '@/components/admin/AdminShell';
import { ChatAdminNav } from '@/components/admin/chat/ChatAdminNav';
import {
  adminQueries,
  type KpiWindow,
} from '@/lib/chat/admin/queries';
import { isChatEnabled } from '@/lib/chat/feature-flag';
import { requireAdmin } from '@/lib/auth/require-admin';

export const dynamic = 'force-dynamic';

const WINDOWS: Array<{ value: KpiWindow; label: string }> = [
  { value: 'today', label: "Aujourd'hui" },
  { value: '7d', label: '7 jours' },
  { value: '30d', label: '30 jours' },
  { value: '90d', label: '90 jours' },
  { value: 'all', label: 'Tout' },
];

function isWindow(v: string | undefined): v is KpiWindow {
  return (
    v === 'today' ||
    v === 'yesterday' ||
    v === '7d' ||
    v === '30d' ||
    v === '90d' ||
    v === 'all'
  );
}

export default async function ChatQualityPage({
  searchParams,
}: {
  searchParams?: { window?: string };
}) {
  const session = await requireAdmin('/admin/chat/quality');
  if (!isChatEnabled()) {
    return (
      <AdminShell adminEmail={session.email} active="chat">
        <ChatAdminNav active="quality" />
        <p className="text-sm text-stone-500">Chat désactivé.</p>
      </AdminShell>
    );
  }

  const window = isWindow(searchParams?.window) ? searchParams!.window : '7d';
  const kpis = await adminQueries.qualityKpis(window).catch(() => ({
    byIntent: [],
    byMethod: [],
    byConfidence: [],
    goldenTotal: 0,
  }));

  const totalIntent = kpis.byIntent.reduce((sum, r) => sum + r.count, 0);
  const totalMethod = kpis.byMethod.reduce((sum, r) => sum + r.count, 0);
  const totalConf = kpis.byConfidence.reduce((sum, r) => sum + r.count, 0);

  // Calcul d'un "score qualité" approximatif : part regex + llm
  // (versus llm-fixed = OutputFixingParser appelé). Élevé = LLM
  // produit du JSON valide tout seul.
  const llmFixed = kpis.byMethod.find((m) => m.method === 'llm-fixed')?.count ?? 0;
  const llm = kpis.byMethod.find((m) => m.method === 'llm')?.count ?? 0;
  const regex = kpis.byMethod.find((m) => m.method === 'regex')?.count ?? 0;
  const llmTotal = llm + llmFixed;
  const llmFixedRate =
    llmTotal > 0 ? Math.round((llmFixed / llmTotal) * 1000) / 10 : 0;
  const regexRate =
    totalMethod > 0 ? Math.round((regex / totalMethod) * 1000) / 10 : 0;

  return (
    <AdminShell adminEmail={session.email} active="chat">
      <ChatAdminNav active="quality" />
      <header className="mb-4">
        <h1 className="text-2xl font-semibold">Qualité — classification d'intent</h1>
        <p className="text-sm text-stone-600">
          Distribution des intents user et des méthodes de classification.
        </p>
      </header>

      {/* ----- Window picker --------------------------------------------- */}
      <nav
        aria-label="Fenêtre de temps"
        className="mb-4 flex flex-wrap gap-2 text-xs"
      >
        {WINDOWS.map((w) => {
          const active = w.value === window;
          return (
            <Link
              key={w.value}
              href={`/admin/chat/quality?window=${w.value}`}
              className={`rounded-full px-3 py-1 ${
                active
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              {w.label}
            </Link>
          );
        })}
      </nav>

      {/* ----- KPI cards -------------------------------------------------- */}
      <section className="mb-6 grid gap-3 sm:grid-cols-4">
        <KpiCard label="Messages classifiés" value={totalIntent.toLocaleString('fr-FR')} />
        <KpiCard
          label="Part regex (rapide)"
          value={`${regexRate}%`}
          hint={`${regex} / ${totalMethod} messages`}
        />
        <KpiCard
          label="Taux de correction LLM"
          value={`${llmFixedRate}%`}
          hint={`${llmFixed} / ${llmTotal} appels LLM`}
          tone={llmFixedRate > 10 ? 'warn' : 'ok'}
        />
        <KpiCard label="Golden-set total" value={kpis.goldenTotal.toLocaleString('fr-FR')} />
      </section>

      {/* ----- Distributions --------------------------------------------- */}
      <div className="grid gap-4 lg:grid-cols-3">
        <DistributionCard
          title="Par intent"
          rows={kpis.byIntent.map((r) => ({ label: r.intent, count: r.count }))}
          total={totalIntent}
        />
        <DistributionCard
          title="Par méthode"
          rows={kpis.byMethod.map((r) => ({ label: r.method, count: r.count }))}
          total={totalMethod}
        />
        <DistributionCard
          title="Par confiance"
          rows={kpis.byConfidence.map((r) => ({ label: r.confidence, count: r.count }))}
          total={totalConf}
        />
      </div>

      <p className="mt-4 text-[11px] text-stone-500">
        <Link
          href="/admin/chat/intent-curator"
          className="underline-offset-2 hover:underline"
        >
          → Curator : tagger les messages comme golden-set
        </Link>
      </p>
    </AdminShell>
  );
}

function KpiCard({
  label,
  value,
  hint,
  tone = 'ok',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'ok' | 'warn';
}) {
  return (
    <div className="rounded-md border border-stone-200 bg-white p-3">
      <p className="text-[11px] uppercase tracking-wide text-stone-500">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          tone === 'warn' ? 'text-amber-700' : 'text-stone-900'
        }`}
      >
        {value}
      </p>
      {hint && <p className="text-[11px] text-stone-500">{hint}</p>}
    </div>
  );
}

function DistributionCard({
  title,
  rows,
  total,
}: {
  title: string;
  rows: Array<{ label: string; count: number }>;
  total: number;
}) {
  return (
    <div className="rounded-md border border-stone-200 bg-white p-3">
      <p className="mb-2 text-sm font-semibold text-stone-900">{title}</p>
      {rows.length === 0 ? (
        <p className="text-xs text-stone-500">Aucune donnée.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => {
            const pct = total > 0 ? (r.count / total) * 100 : 0;
            return (
              <li key={r.label}>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-mono text-stone-700">{r.label}</span>
                  <span className="tabular-nums text-stone-500">
                    {r.count} · {pct.toFixed(1)}%
                  </span>
                </div>
                <div
                  className="mt-0.5 h-1.5 rounded-full bg-stone-100"
                  role="progressbar"
                  aria-valuenow={Math.round(pct)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${r.label} ${pct.toFixed(1)}%`}
                >
                  <div
                    className="h-1.5 rounded-full bg-stone-900"
                    style={{ width: `${Math.min(100, pct).toFixed(2)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
