/**
 * InsightsView — page principale Analytics Insights.
 * cf. docs/analytics-insights/13-wizard-design.md §3
 *
 * 5 sous-onglets, filtres globaux dans l'URL, indicateur de refresh.
 */
'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { ExportPngButton } from './ExportPngButton';
import {
  formatDateLong,
  formatNumber,
  formatPercent,
  formatRelativeTime,
} from '@/lib/analytics/insights/format';
import type {
  ComponentDetailResponse,
  ComponentsResponse,
  DeadComponentRow,
  FunnelResponse,
  InsightsRefreshStatus,
  OverviewResponse,
  PageDetailResponse,
  PagesResponse,
  SectionsResponse,
} from '@/lib/analytics/insights/contracts';
import { InsightsDrawer } from './InsightsDrawer';
import { useInsightsFetch, useInsightsFilters, serializeFilters } from './useInsights';
import {
  ActivityHeatmap,
  ComponentsTable,
  EventsTimeSeries,
  FunnelSankey,
  KpiCard,
  PagesTable,
  SectionsBarChart,
  TopEventsTable,
} from './InsightsCharts';

const TABS = [
  { id: 'overview', label: "Vue d'ensemble" },
  { id: 'pages', label: 'Pages' },
  { id: 'components', label: 'Composants' },
  { id: 'sections', label: 'Sections' },
  { id: 'funnel', label: 'Funnel' },
] as const;
type TabId = (typeof TABS)[number]['id'];

export function InsightsView() {
  const { filters, set, reset } = useInsightsFilters();
  const [tab, setTab] = useState<TabId>('overview');
  const tabsId = useId().replace(/[^a-zA-Z0-9-]/g, '');

  return (
    <div className="flex flex-col gap-6" data-testid="insights-view">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Analytics Insights</h1>
          <p className="text-sm text-stone-500">
            Lecture approfondie des événements, pages, composants, sections et funnel.
          </p>
        </div>
        <RefreshIndicator />
      </header>

      <FiltersBar filters={filters} onChange={set} onReset={reset} />

      <div role="tablist" aria-label="Sous-onglets Insights" className="flex gap-1 border-b border-stone-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            id={`${tabsId}-${t.id}`}
            aria-selected={tab === t.id}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'border-stone-900 text-stone-900'
                : 'border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <section aria-labelledby={`${tabsId}-${tab}`} className="min-h-[400px]">
        {tab === 'overview' && <OverviewPanel />}
        {tab === 'pages' && <PagesPanel />}
        {tab === 'components' && <ComponentsPanel />}
        {tab === 'sections' && <SectionsPanel />}
        {tab === 'funnel' && <FunnelPanel />}
      </section>
    </div>
  );
}

/* ═══ FILTERS ════════════════════════════════════════════════════ */

const WINDOW_OPTIONS: { value: import('@/lib/analytics/insights/contracts').InsightsWindow; label: string }[] = [
  { value: 'today', label: "Aujourd'hui" },
  { value: 'yesterday', label: 'Hier' },
  { value: '7d', label: '7 derniers jours' },
  { value: '30d', label: '30 derniers jours' },
  { value: '90d', label: '90 derniers jours' },
  { value: 'all', label: "Tout l'historique" },
  { value: 'custom', label: 'Personnalisé…' },
];

function FiltersBar({
  filters,
  onChange,
  onReset,
}: {
  filters: import('@/lib/analytics/insights/contracts').InsightsFilters;
  onChange: (patch: Partial<import('@/lib/analytics/insights/contracts').InsightsFilters>) => void;
  onReset: () => void;
}) {
  const isCustomized =
    filters.window !== '7d' ||
    filters.env !== 'all' ||
    filters.device !== 'all' ||
    filters.locale !== 'all' ||
    filters.trafficSource !== 'all';
  return (
    <div
      role="group"
      aria-label="Filtres globaux"
      className="flex flex-wrap items-center gap-3 rounded-md border border-stone-200 bg-white p-3"
    >
      <FilterSelect
        label="Période"
        value={filters.window}
        options={WINDOW_OPTIONS}
        onChange={(v) => onChange({ window: v as never })}
      />
      {filters.window === 'custom' && (
        <CustomRangeInputs
          from={filters.customFrom}
          to={filters.customTo}
          onChange={(patch) => onChange(patch)}
        />
      )}
      <FilterSelect
        label="Env"
        value={filters.env}
        options={[
          { value: 'all', label: 'Tous' },
          { value: 'production', label: 'Production' },
          { value: 'preview', label: 'Preview' },
          { value: 'dev', label: 'Dev' },
        ]}
        onChange={(v) => onChange({ env: v as never })}
      />
      <FilterSelect
        label="Device"
        value={filters.device}
        options={[
          { value: 'all', label: 'Tous' },
          { value: 'mobile', label: 'Mobile' },
          { value: 'desktop', label: 'Desktop' },
          { value: 'tablet', label: 'Tablet' },
        ]}
        onChange={(v) => onChange({ device: v as never })}
      />
      {isCustomized && (
        <button
          type="button"
          onClick={onReset}
          className="ml-auto text-xs font-medium text-stone-600 underline hover:text-stone-900"
          data-testid="filters-reset"
        >
          Réinitialiser
        </button>
      )}
    </div>
  );
}

function CustomRangeInputs({
  from,
  to,
  onChange,
}: {
  from: string | undefined;
  to: string | undefined;
  onChange: (patch: Partial<import('@/lib/analytics/insights/contracts').InsightsFilters>) => void;
}) {
  const fromId = useId().replace(/[^a-zA-Z0-9-]/g, '');
  const toId = useId().replace(/[^a-zA-Z0-9-]/g, '');
  const isValid =
    !from || !to || (new Date(from).getTime() <= new Date(to).getTime() && to.length === 10);
  return (
    <div className="flex items-center gap-2 text-xs text-stone-700">
      <label htmlFor={fromId} className="flex items-center gap-1">
        <span>Du</span>
        <input
          id={fromId}
          type="date"
          value={from ?? ''}
          onChange={(e) => onChange({ customFrom: e.target.value || undefined })}
          className="rounded border border-stone-200 bg-white px-2 py-1 text-xs"
          data-testid="filter-custom-from"
        />
      </label>
      <label htmlFor={toId} className="flex items-center gap-1">
        <span>au</span>
        <input
          id={toId}
          type="date"
          value={to ?? ''}
          onChange={(e) => onChange({ customTo: e.target.value || undefined })}
          className="rounded border border-stone-200 bg-white px-2 py-1 text-xs"
          data-testid="filter-custom-to"
        />
      </label>
      {!isValid && (
        <span className="text-xs text-red-700" role="alert">
          Plage invalide
        </span>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const id = useId().replace(/[^a-zA-Z0-9-]/g, '');
  return (
    <label className="flex items-center gap-2 text-xs text-stone-700" htmlFor={id}>
      <span>{label}</span>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-stone-200 bg-white px-2 py-1 text-xs"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/* ═══ REFRESH INDICATOR ═══════════════════════════════════════════ */

function RefreshIndicator() {
  const { data, refresh, loading } = useInsightsFetch<InsightsRefreshStatus>(
    '/api/admin/analytics/insights/refresh',
  );
  const [triggering, setTriggering] = useState(false);

  const status = data?.lastRun?.status ?? 'idle';
  const lastFinished = data?.lastRun?.finishedAt ?? null;

  async function trigger() {
    setTriggering(true);
    try {
      const res = await fetch('/api/admin/analytics/insights/refresh', {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) await refresh();
    } finally {
      setTriggering(false);
    }
  }

  return (
    <div
      className="flex items-center gap-3 rounded-md border border-stone-200 bg-white px-3 py-2 text-sm"
      role="status"
      aria-live="polite"
      data-testid="refresh-indicator"
    >
      <span
        aria-hidden
        className={`h-2 w-2 rounded-full ${
          status === 'success'
            ? 'bg-emerald-600'
            : status === 'failed'
            ? 'bg-red-600'
            : status === 'running'
            ? 'bg-sky-500 animate-pulse'
            : 'bg-stone-300'
        }`}
      />
      <span className="text-stone-700">
        {data?.enabled === false
          ? 'Auto désactivé'
          : status === 'running'
          ? 'Calcul en cours…'
          : lastFinished
          ? `Mis à jour ${formatRelativeTime(lastFinished)}`
          : 'Aucun refresh'}
      </span>
      <button
        type="button"
        onClick={trigger}
        disabled={triggering || loading}
        className="ml-2 rounded bg-stone-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
        data-testid="refresh-trigger"
      >
        {triggering ? 'Calcul…' : 'Refresh'}
      </button>
    </div>
  );
}

/* ═══ PANELS ═════════════════════════════════════════════════════ */

function useFiltersUrl(): string {
  const { filters } = useInsightsFilters();
  return useMemo(() => serializeFilters(filters), [filters]);
}

function OverviewPanel() {
  const qs = useFiltersUrl();
  const { data, loading, error } = useInsightsFetch<OverviewResponse>(
    `/api/admin/analytics/insights/overview${qs ? `?${qs}` : ''}`,
  );
  const tsRef = useRef<SVGSVGElement>(null);
  const heatRef = useRef<SVGSVGElement>(null);
  if (loading && !data) return <SkeletonGrid />;
  if (error) return <ErrorBlock message={error.message} />;
  if (!data) return null;

  return (
    <div className="flex flex-col gap-6" data-testid="overview-panel">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          label="Total events"
          value={formatNumber(data.kpis.totalEvents)}
          variation={data.variations.totalEvents ?? null}
        />
        <KpiCard
          label="Sessions uniques"
          value={formatNumber(data.kpis.uniqueSessions)}
          variation={data.variations.uniqueSessions ?? null}
        />
        <KpiCard
          label="Visites de page"
          value={formatNumber(data.kpis.pageViews)}
          variation={data.variations.pageViews ?? null}
        />
        <KpiCard
          label="Conversions"
          value={formatNumber(data.kpis.conversions)}
          variation={data.variations.conversions ?? null}
        />
        <KpiCard
          label="Events / session"
          value={data.kpis.avgEventsPerSession.toFixed(1).replace('.', ',')}
          variation={data.variations.avgEventsPerSession ?? null}
        />
        <KpiCard
          label="Taux de rebond"
          value={formatPercent(data.kpis.bounceRate, 1)}
          variation={data.variations.bounceRate ?? null}
          invertVariation
        />
      </div>
      <Card
        title="Évolution sur la fenêtre"
        action={<ExportPngButton svgRef={tsRef} filename="insights-timeseries.png" />}
      >
        <EventsTimeSeries ref={tsRef} data={data.timeseries} />
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Activité (heures × jours)"
          action={<ExportPngButton svgRef={heatRef} filename="insights-heatmap.png" />}
        >
          <ActivityHeatmap ref={heatRef} cells={data.heatmap} />
        </Card>
        <Card title="Top events">
          <TopEventsTable rows={data.topEvents} />
        </Card>
      </div>
      <p className="text-xs text-stone-500">
        Dernière mise à jour : {data.refreshedAt ? formatDateLong(data.refreshedAt) : '—'}
      </p>
    </div>
  );
}

function PagesPanel() {
  const qs = useFiltersUrl();
  const { data, loading, error } = useInsightsFetch<PagesResponse>(
    `/api/admin/analytics/insights/pages${qs ? `?${qs}` : ''}`,
  );
  const [drillRoute, setDrillRoute] = useState<string | null>(null);

  if (loading && !data) return <SkeletonGrid />;
  if (error) return <ErrorBlock message={error.message} />;
  if (!data) return null;

  return (
    <>
      <Card
        title={`Top pages (${data.totalRows})`}
        action={<ExportCsvButton view="pages" qs={qs} />}
      >
        <PagesTable rows={data.pages} onRowClick={(r) => setDrillRoute(r.pageRoute)} />
      </Card>
      {drillRoute && (
        <PageDetailDrawer route={drillRoute} qs={qs} onClose={() => setDrillRoute(null)} />
      )}
    </>
  );
}

function PageDetailDrawer({
  route,
  qs,
  onClose,
}: {
  route: string;
  qs: string;
  onClose: () => void;
}) {
  const url = `/api/admin/analytics/insights/pages/${encodeURIComponent(route)}${qs ? `?${qs}` : ''}`;
  const { data, loading, error } = useInsightsFetch<PageDetailResponse>(url);
  return (
    <InsightsDrawer
      open
      onClose={onClose}
      kicker="Page"
      title={route}
      subtitle={data ? `${formatNumber(data.pageViews)} visites · ${formatNumber(data.sessions)} sessions` : undefined}
    >
      {loading && <SkeletonGrid />}
      {error && <ErrorBlock message={error.message} />}
      {data && (
        <div className="flex flex-col gap-5">
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
              Top events
            </h3>
            <ul className="text-sm">
              {data.events.length === 0 && <li className="text-stone-500">Aucun event</li>}
              {data.events.slice(0, 10).map((e) => (
                <li
                  key={e.eventName}
                  className="flex items-center justify-between border-b border-stone-100 py-2 last:border-0"
                >
                  <span className="font-mono text-xs">{e.eventName}</span>
                  <span className="text-xs tabular-nums text-stone-700">
                    {formatNumber(e.count)} · {formatPercent(e.share, 0)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          {data.components.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
                Composants déclencheurs
              </h3>
              <ul className="text-sm">
                {data.components.slice(0, 10).map((c) => (
                  <li
                    key={c.componentId}
                    className="flex items-center justify-between border-b border-stone-100 py-2 last:border-0"
                  >
                    <span className="font-mono text-xs">{c.componentId}</span>
                    <span className="text-xs tabular-nums text-stone-700">
                      {formatNumber(c.count)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </InsightsDrawer>
  );
}

interface ComponentsPanelData extends ComponentsResponse {
  dead: DeadComponentRow[];
}

function ComponentsPanel() {
  const qs = useFiltersUrl();
  const { data, loading, error } = useInsightsFetch<ComponentsPanelData>(
    `/api/admin/analytics/insights/components${qs ? `?${qs}` : ''}`,
  );
  const [drillId, setDrillId] = useState<string | null>(null);

  if (loading && !data) return <SkeletonGrid />;
  if (error) return <ErrorBlock message={error.message} />;
  if (!data) return null;

  return (
    <div className="flex flex-col gap-4" data-testid="components-panel">
      <Card
        title={`Top composants (${data.totalRows})`}
        action={<ExportCsvButton view="components" qs={qs} />}
      >
        <ComponentsTable
          rows={data.components}
          onRowClick={(r) => setDrillId(r.componentId)}
        />
      </Card>
      {data.dead.length > 0 && (
        <Card title={`Composants silencieux (${data.dead.length})`}>
          <ul className="text-sm text-stone-700">
            {data.dead.map((c) => (
              <li key={c.componentId} className="border-b border-stone-100 py-2 last:border-0">
                <span className="font-mono text-xs">{c.componentId}</span>
                {c.componentName && <span className="ml-2 text-stone-500">{c.componentName}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {drillId && (
        <ComponentDetailDrawer
          componentId={drillId}
          qs={qs}
          onClose={() => setDrillId(null)}
        />
      )}
    </div>
  );
}

function ComponentDetailDrawer({
  componentId,
  qs,
  onClose,
}: {
  componentId: string;
  qs: string;
  onClose: () => void;
}) {
  const url = `/api/admin/analytics/insights/components/${encodeURIComponent(componentId)}${qs ? `?${qs}` : ''}`;
  const { data, loading, error } = useInsightsFetch<ComponentDetailResponse>(url);
  return (
    <InsightsDrawer
      open
      onClose={onClose}
      kicker="Composant"
      title={componentId}
      subtitle={data ? `${formatNumber(data.total)} déclenchements${data.componentName ? ` · ${data.componentName}` : ''}` : undefined}
    >
      {loading && <SkeletonGrid />}
      {error && <ErrorBlock message={error.message} />}
      {data && (
        <div className="flex flex-col gap-5">
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
              Events déclenchés
            </h3>
            <ul className="text-sm">
              {data.events.slice(0, 10).map((e) => (
                <li
                  key={e.eventName}
                  className="flex items-center justify-between border-b border-stone-100 py-2 last:border-0"
                >
                  <span className="font-mono text-xs">{e.eventName}</span>
                  <span className="text-xs tabular-nums text-stone-700">
                    {formatNumber(e.count)} · {formatPercent(e.share, 0)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          {data.pages.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
                Pages où le composant est actif
              </h3>
              <ul className="text-sm">
                {data.pages.slice(0, 10).map((p) => (
                  <li
                    key={p.pageRoute}
                    className="flex items-center justify-between border-b border-stone-100 py-2 last:border-0"
                  >
                    <span className="font-mono text-xs">{p.pageRoute}</span>
                    <span className="text-xs tabular-nums text-stone-700">
                      {formatNumber(p.count)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </InsightsDrawer>
  );
}

function SectionsPanel() {
  const qs = useFiltersUrl();
  const { data, loading, error } = useInsightsFetch<SectionsResponse>(
    `/api/admin/analytics/insights/sections${qs ? `?${qs}` : ''}`,
  );
  if (loading && !data) return <SkeletonGrid />;
  if (error) return <ErrorBlock message={error.message} />;
  if (!data) return null;
  return (
    <Card
      title={`Top sections par durée (${data.totalRows})`}
      action={<ExportCsvButton view="sections" qs={qs} />}
    >
      <SectionsBarChart rows={data.sections} />
    </Card>
  );
}

function FunnelPanel() {
  const qs = useFiltersUrl();
  const { data, loading, error } = useInsightsFetch<FunnelResponse>(
    `/api/admin/analytics/insights/funnel${qs ? `?${qs}` : ''}`,
  );
  const sankeyRef = useRef<SVGSVGElement>(null);
  if (loading && !data) return <SkeletonGrid />;
  if (error) return <ErrorBlock message={error.message} />;
  if (!data) return null;
  return (
    <div className="flex flex-col gap-4" data-testid="funnel-panel">
      <Card
        title="Tunnel de conversion"
        action={
          <div className="flex gap-3">
            <ExportPngButton svgRef={sankeyRef} filename="insights-funnel.png" />
            <ExportCsvButton view="funnel" qs={qs} />
          </div>
        }
      >
        <FunnelSankey ref={sankeyRef} stages={data.stages} />
      </Card>
      <Card title="Drop-offs détaillés">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-[11px] uppercase tracking-wider text-stone-500">
              <th className="py-2 text-left">Étape</th>
              <th className="py-2 text-right">Volume</th>
              <th className="py-2 text-right">Drop-off</th>
              <th className="py-2 text-right">Conv. inter-étape</th>
            </tr>
          </thead>
          <tbody>
            {data.stages.map((s, idx) => {
              const drop = idx === 0 ? null : data.dropoffs[idx - 1];
              return (
                <tr key={s.name} className="border-b border-stone-100 last:border-0">
                  <td className="py-2 font-mono text-xs">{s.name}</td>
                  <td className="py-2 text-right tabular-nums">{formatNumber(s.count)}</td>
                  <td className="py-2 text-right tabular-nums">
                    {drop ? `${formatNumber(drop.lost)} (${formatPercent(drop.percent, 0)})` : '—'}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {s.conversionFromPrev !== null ? formatPercent(s.conversionFromPrev, 1) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ═══ utilities ════════════════════════════════════════════════ */

function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-stone-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-stone-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function ExportCsvButton({ view, qs }: { view: string; qs: string }) {
  return (
    <a
      href={`/api/admin/analytics/insights/export?view=${view}${qs ? `&${qs}` : ''}`}
      className="text-xs font-medium text-stone-600 underline hover:text-stone-900"
      data-testid={`export-${view}`}
      download
    >
      Exporter CSV
    </a>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6" aria-busy="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-28 animate-pulse rounded-md border border-stone-200 bg-stone-50" />
      ))}
    </div>
  );
}

function ErrorBlock({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      Impossible de charger ces données — {message}
    </div>
  );
}
