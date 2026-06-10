/**
 * Cartes KPI du dashboard emailing (`/admin/emails`) — présentationnel pur.
 *
 * F03 (P2.1) : cartes FENÊTRÉES (24h/7j/30j) branchées sur la machine
 * tri-état `deliveredState` (DASH-02/TRV-04 — fini le « 0 » ambigu), tendances
 * polarisées vs période précédente (DASH-06), sparklines décoratives, et
 * propagation `&window=` sur chaque drill-down (DASH-01). Le bandeau
 * « livraison silencieuse » recalcule son libellé sur la fenêtre COURANTE.
 */
import Link from 'next/link';
import type { OutboxKpiWindow } from '@/lib/admin/emails/queries';
import {
  deliveredState,
  dlqTone,
  failedTone,
  fmt,
  isDeliverySilent,
  pct,
  pendingTone,
  trendLabel,
  windowLabel,
  DELIVERED_SILENT_DIAGNOSE_HREF,
  PERIOD_LABEL,
  type DashboardWindow,
  type KpiTone,
} from '@/app/admin/emails/kpi-format';
import { Sparkline } from './Sparkline';

/**
 * Deep-links cockpit par population (UX-DASH-001). Le cockpit transactionnel
 * `deserializeFilters` lit `?status=…` (liste séparée par des virgules) →
 * chaque carte KPI renvoie l'opérateur vers la liste filtrée correspondante,
 * en ≤ 2 clics (« problème visible → action »).
 */
const COCKPIT = '/admin/emails/transactional';
/** Page de debug events filtrée sur les events email (delivered entrants). */
const HREF_EVENTS_EMAIL = '/admin/emails/events?source=email';

export type KpiCardsProps = {
  kpi: OutboxKpiWindow;
  window: DashboardWindow;
  /** Dernier event delivered reçu (summary) — pilote le tri-état E2/E3. */
  webhookLastSuccessAt: string | null;
  /** Comparaison vs période précédente (summary) — absent ⇒ tendances '—'. */
  comparison?: { deliveredPct: number; failedPct: number };
  /** 12 buckets summary (sparklines décoratives). */
  sparkline?: { delivered: number; failed: number }[];
  /** Horodatage iso du relevé serveur (sous-texte de la carte En attente). */
  generatedAt: string;
};

export function KpiCards({
  kpi,
  window,
  webhookLastSuccessAt,
  comparison,
  sparkline,
  generatedAt,
}: KpiCardsProps) {
  const wq = `&window=${window}`;
  const hrefSent = `${COCKPIT}?status=sent,delivered${wq}`;
  const hrefFailed = `${COCKPIT}?status=failed,bounced_soft,bounced_permanent${wq}`;
  const hrefDlq = `${COCKPIT}?status=dlq${wq}`;
  const hrefPending = `${COCKPIT}?status=pending${wq}`;

  const wl = windowLabel(window);
  const deliverySilent = isDeliverySilent(kpi.sent, kpi.delivered);
  const ds = deliveredState({
    sent: kpi.sent,
    delivered: kpi.delivered,
    webhookLastSuccessAt,
  });
  const deliveredTrend = trendLabel(comparison?.deliveredPct, PERIOD_LABEL[window], 'good');
  const failedTrend = trendLabel(comparison?.failedPct, PERIOD_LABEL[window], 'bad');
  const pendingAgeSec = Math.max(
    0,
    Math.round((Date.now() - new Date(generatedAt).getTime()) / 1000),
  );

  return (
    <>
      {deliverySilent ? (
        <div
          role="alert"
          data-testid="delivery-silent-banner"
          className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700"
        >
          <strong className="font-semibold">Livraison silencieuse</strong> :{' '}
          {fmt(kpi.sent)} email(s) envoyé(s) sur {wl} mais aucune livraison
          confirmée — le webhook Stalwart est probablement muet.{' '}
          <Link
            href={HREF_EVENTS_EMAIL}
            className="font-medium underline underline-offset-2"
          >
            Vérifier les events delivered →
          </Link>
        </div>
      ) : null}

      <section className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Kpi
          testId="kpi-card-sent"
          label={`Envoyés (${wl})`}
          value={fmt(kpi.sent)}
          sub={`sur ${fmt(kpi.total)} tentatives`}
          href={hrefSent}
          ariaLabel={`Voir les ${fmt(kpi.sent)} envoyés (${wl})`}
        />
        <Kpi
          testId="kpi-card-delivered"
          label="Livrés"
          value={ds.value}
          sub={ds.sub}
          tone={ds.tone}
          trend={deliveredTrend}
          spark={sparkline?.map((b) => b.delivered)}
          href={hrefSent}
          ariaLabel={`Voir les ${fmt(kpi.delivered)} livrés (${wl})`}
          extraLink={
            ds.state === 'silent'
              ? { label: 'Diagnostiquer →', href: `${DELIVERED_SILENT_DIAGNOSE_HREF}${wq}` }
              : undefined
          }
        />
        <Kpi
          testId="kpi-card-failed"
          label="Échecs"
          value={fmt(kpi.failed)}
          sub={pct(kpi.failed, kpi.total)}
          tone={failedTone(kpi.failed)}
          trend={failedTrend}
          spark={sparkline?.map((b) => b.failed)}
          href={hrefFailed}
          ariaLabel={`Voir les ${fmt(kpi.failed)} échecs`}
        />
        <Kpi
          testId="kpi-card-dlq"
          label="DLQ"
          value={fmt(kpi.dlq)}
          sub="abandonnés (max attempts)"
          tone={dlqTone(kpi.dlq)}
          href={hrefDlq}
          ariaLabel={`Voir les ${fmt(kpi.dlq)} messages en DLQ`}
        />
        <Kpi
          testId="kpi-card-pending"
          label="En attente"
          value={fmt(kpi.pendingNow)}
          sub={`relevé il y a ${pendingAgeSec} s · drain 60 s`}
          tone={pendingTone(kpi.pendingNow)}
          href={hrefPending}
          ariaLabel={`Voir les ${fmt(kpi.pendingNow)} messages en attente`}
        />
        <Kpi
          testId="kpi-card-total"
          label="Total tentatives"
          value={fmt(kpi.total)}
          sub={wl}
        />
      </section>
    </>
  );
}

const TREND_CLS: Record<KpiTone, string> = {
  emerald: 'text-emerald-700',
  rose: 'text-rose-700',
  amber: 'text-amber-700',
  neutral: 'text-stone-500',
};

export function Kpi({
  label,
  value,
  sub,
  tone = 'neutral',
  testId,
  href,
  ariaLabel,
  trend,
  spark,
  extraLink,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: KpiTone;
  testId?: string;
  /** Cible de drill-down (UX-DASH-001). Si absent, la carte est inerte (Total). */
  href?: string;
  /** Libellé accessible chiffré du lien (ex. « Voir les 42 échecs »). */
  ariaLabel?: string;
  /** Tendance vs période précédente (F03, DASH-06). */
  trend?: { text: string; tone: KpiTone };
  /** Points de sparkline décorative (12 buckets). */
  spark?: number[];
  /** Lien d'action secondaire (ex. « Diagnostiquer » de l'état silent). */
  extraLink?: { label: string; href: string };
}) {
  const toneClass =
    tone === 'amber'
      ? 'text-amber-700'
      : tone === 'rose'
        ? 'text-rose-700'
        : tone === 'emerald'
          ? 'text-emerald-700'
          : 'text-stone-900';
  const card = (
    <div className="rounded-lg border border-stone-200 bg-white p-3" data-testid={testId}>
      <p className="text-xs uppercase tracking-wider text-stone-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-stone-500">{sub}</p> : null}
      {trend ? (
        <p className={`mt-0.5 text-xs ${TREND_CLS[trend.tone]}`} data-testid="kpi-trend">
          {trend.text}
        </p>
      ) : null}
      {spark && spark.length >= 2 ? <Sparkline points={spark} className="mt-1 text-stone-400" /> : null}
    </div>
  );
  const linked = !href ? (
    card
  ) : (
    <Link
      href={href}
      aria-label={ariaLabel}
      className="block rounded-lg transition hover:ring-2 hover:ring-stone-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-500"
    >
      {card}
    </Link>
  );
  if (!extraLink) return linked;
  return (
    <div>
      {linked}
      <Link
        href={extraLink.href}
        className="mt-1 inline-block text-xs font-medium text-rose-700 underline underline-offset-2"
      >
        {extraLink.label}
      </Link>
    </div>
  );
}

// TRV-07 / F01-U-059 : plus AUCUNE map locale de statuts ici — le rendu
// canonique vit dans common/StatusBadge (STATUS_META unique). Ce re-export
// préserve les imports existants (`import { StatusBadge } from './KpiCards'`).
export { StatusBadge } from './common/StatusBadge';
