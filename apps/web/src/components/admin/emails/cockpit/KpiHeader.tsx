'use client';

/**
 * KpiHeader — 4 cartes de KPI temps réel pour le cockpit transactional (M5.1.5).
 *
 * Affiche delivered / queued / failed / hardBounced sur une fenêtre choisie
 * (1h / 24h / 7d). Chaque carte montre :
 *  - le chiffre principal (tabular-nums pour stabilité)
 *  - une mini sparkline (12 buckets, SVG inline)
 *  - une tendance vs J-1 (↑/↓/→)
 *  - une bordure d'alerte si le seuil failed/hard est dépassé
 *
 * Le composant est *présentationnel* : les data + auto-refresh sont gérés par
 * `useSummary` (ci-dessous) ou par le parent via props.
 *
 * Cf. docs/emailing/admin-evolution/04-ui-ux/01-wizard-spec-master.md §1.2
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

export type SparklineBucket = { delivered: number; failed: number };

export type SummaryDto = {
  window: '1h' | '24h' | '7d';
  delivered: number;
  queued: number;
  failed: number;
  hardBounced: number;
  sparkline: SparklineBucket[];
  comparison?: { deliveredPct: number; failedPct: number };
};

export type KpiHeaderProps = {
  data: SummaryDto | null;
  isLoading?: boolean;
  isRefreshing?: boolean;
  error?: Error | null;
  onRefresh?: () => void;
  /** Click sur une carte → filtre auto par statut. */
  onKpiClick?: (kind: 'delivered' | 'queued' | 'failed' | 'hardBounced') => void;
  /** Seuil failed pour déclencher le mode alerte (default 5 sur 1h). */
  failedAlertThreshold?: number;
};

// ── Sparkline SVG inline ────────────────────────────────────────────────

type SparklineProps = {
  values: number[];
  /** 'delivered' = sage, 'failed' = red */
  variant: 'delivered' | 'failed';
};

function Sparkline({ values, variant }: SparklineProps) {
  if (values.length === 0) return null;
  const width = 80;
  const height = 16;
  const max = Math.max(...values, 1);
  const step = width / (values.length - 1 || 1);

  const path = values
    .map((v, i) => {
      const x = i * step;
      const y = height - (v / max) * height;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const stroke = variant === 'delivered' ? '#4F6D52' : '#DC2626';
  return (
    <svg
      role="img"
      aria-label={`${variant} sparkline last 12 buckets`}
      width={width}
      height={height}
      className="block"
    >
      <path d={path} fill="none" stroke={stroke} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Trend indicator ─────────────────────────────────────────────────────

/**
 * Indicateur de tendance avec sémantique de couleur correcte (F-015).
 *
 * `higherIsBad` = true pour les métriques d'ÉCHEC (Échecs, Hard bounces) : une
 * HAUSSE (pct > 0) est mauvaise → ROUGE ↑ ; une BAISSE (pct < 0) est bonne →
 * VERT ↓. Pour les métriques positives (Délivrés), c'est l'inverse (défaut).
 *
 * Bug audit corrigé : avant, tout pct > 0 s'affichait en emerald, donc une
 * hausse d'échecs apparaissait en vert ↑ — faux signal rassurant.
 */
function Trend({ pct, higherIsBad = false }: { pct: number | undefined; higherIsBad?: boolean }) {
  if (pct === undefined) return <span className="text-stone-400">—</span>;
  if (pct === 0)
    return (
      <span className="text-stone-400" aria-label="stable">
        →
      </span>
    );
  // `isGood` détermine la couleur selon la polarité de la métrique.
  const isGood = higherIsBad ? pct < 0 : pct > 0;
  const colorClass = isGood ? 'text-emerald-600' : 'text-red-600';
  if (pct > 0)
    return (
      <span className={colorClass} aria-label={`${pct}% increase`} data-trend={isGood ? 'good' : 'bad'}>
        ↑ {pct}%
      </span>
    );
  return (
    <span
      className={colorClass}
      aria-label={`${Math.abs(pct)}% decrease`}
      data-trend={isGood ? 'good' : 'bad'}
    >
      ↓ {Math.abs(pct)}%
    </span>
  );
}

// ── Carte KPI ───────────────────────────────────────────────────────────

type KpiCardProps = {
  label: string;
  value: number;
  sparklineValues: number[];
  sparklineVariant: 'delivered' | 'failed';
  pct?: number;
  /** Métrique d'échec : une hausse est mauvaise (couleur de tendance inversée). */
  higherIsBad?: boolean;
  alert?: boolean;
  onClick?: () => void;
  testId?: string;
};

function KpiCard({
  label,
  value,
  sparklineValues,
  sparklineVariant,
  pct,
  higherIsBad,
  alert,
  onClick,
  testId,
}: KpiCardProps) {
  const borderClass = alert
    ? 'border-red-300 bg-red-50/40'
    : 'border-stone-200 bg-white hover:bg-stone-50';
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={`w-full rounded-lg border ${borderClass} px-4 py-3 text-left transition-colors`}
    >
      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-wider text-stone-500">{label}</span>
        {alert && (
          <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
            ⚠ attention
          </span>
        )}
      </div>
      <div className="mt-2 text-3xl font-semibold tabular-nums text-stone-900">{value.toLocaleString('fr-FR')}</div>
      <div className="mt-1 flex items-center justify-between text-xs">
        <Sparkline values={sparklineValues} variant={sparklineVariant} />
        <Trend pct={pct} higherIsBad={higherIsBad} />
      </div>
    </button>
  );
}

// ── KpiHeader main ──────────────────────────────────────────────────────

export function KpiHeader({
  data,
  isLoading,
  isRefreshing,
  error,
  onRefresh,
  onKpiClick,
  failedAlertThreshold = 5,
}: KpiHeaderProps) {
  if (error) {
    return (
      <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-700">
        Impossible de charger les KPI : {error.message}
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="ml-2 underline underline-offset-2 hover:text-red-900"
          >
            Réessayer
          </button>
        )}
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="kpi-header-skeleton">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg border border-stone-200 bg-stone-50" />
        ))}
      </div>
    );
  }

  const isAlert = data.failed >= failedAlertThreshold || data.hardBounced > 0;

  const deliveredSpark = data.sparkline.map((b) => b.delivered);
  const failedSpark = data.sparkline.map((b) => b.failed);

  return (
    <section aria-label="Activité emailing temps réel" data-testid="kpi-header">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-stone-500">
          Activité — last {data.window}
        </p>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-900"
            aria-label="Rafraîchir les KPI"
          >
            <span className={isRefreshing ? 'animate-spin' : ''}>↻</span> rafraîchir
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Délivrés"
          value={data.delivered}
          sparklineValues={deliveredSpark}
          sparklineVariant="delivered"
          pct={data.comparison?.deliveredPct}
          onClick={onKpiClick ? () => onKpiClick('delivered') : undefined}
          testId="kpi-delivered"
        />
        <KpiCard
          label="En file"
          value={data.queued}
          // F-015 : pas de sparkline trompeuse. Le DTO summary n'expose AUCUNE
          // série « queued » ; afficher la courbe `delivered` ici laissait croire
          // à une tendance de la file qui n'existe pas. On n'affiche donc rien.
          sparklineValues={[]}
          sparklineVariant="delivered"
          onClick={onKpiClick ? () => onKpiClick('queued') : undefined}
          testId="kpi-queued"
        />
        <KpiCard
          label="Échecs"
          value={data.failed}
          sparklineValues={failedSpark}
          sparklineVariant="failed"
          pct={data.comparison?.failedPct}
          higherIsBad
          alert={data.failed >= failedAlertThreshold}
          onClick={onKpiClick ? () => onKpiClick('failed') : undefined}
          testId="kpi-failed"
        />
        <KpiCard
          label="Hard bounces"
          value={data.hardBounced}
          sparklineValues={failedSpark}
          sparklineVariant="failed"
          higherIsBad
          alert={data.hardBounced > 0}
          onClick={onKpiClick ? () => onKpiClick('hardBounced') : undefined}
          testId="kpi-hard-bounced"
        />
      </div>
    </section>
  );
}

// ── Hook useSummary : fetch + auto-refresh ──────────────────────────────

export type UseSummaryOptions = {
  window?: '1h' | '24h' | '7d';
  /** ms entre refresh auto (default 5000). 0 = pas d'auto-refresh. */
  refreshIntervalMs?: number;
  /** Override fetch implementation (utile pour les tests). */
  fetchImpl?: typeof fetch;
};

export function useSummary({
  window: w = '1h',
  refreshIntervalMs = 5_000,
  fetchImpl = fetch,
}: UseSummaryOptions = {}) {
  const [data, setData] = useState<SummaryDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchOnce = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetchImpl(`/api/admin/emails/transactional/summary?window=${w}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as SummaryDto;
      setData(body);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  }, [w, fetchImpl]);

  useEffect(() => {
    void fetchOnce();
    if (refreshIntervalMs > 0) {
      const id = setInterval(fetchOnce, refreshIntervalMs);
      return () => clearInterval(id);
    }
    return undefined;
  }, [fetchOnce, refreshIntervalMs]);

  return useMemo(() => ({ data, isLoading, isRefreshing, error, refresh: fetchOnce }), [
    data,
    isLoading,
    isRefreshing,
    error,
    fetchOnce,
  ]);
}
