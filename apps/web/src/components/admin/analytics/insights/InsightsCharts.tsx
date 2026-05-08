/**
 * Charts SVG custom Insights : KpiCard, EventsTimeSeries, ActivityHeatmap,
 * FunnelSankey, SectionsBarChart, TopTable.
 *
 * cf. docs/analytics-insights/06-visualisations.md +
 *     docs/analytics-insights/13-wizard-design.md §9
 */
'use client';

import { forwardRef, useMemo, useState } from 'react';
import {
  formatDuration,
  formatNumber,
  formatPercent,
  formatVariation,
} from '@/lib/analytics/insights/format';
import type {
  ComponentRow,
  FunnelStage,
  InsightsHeatmapCell,
  InsightsTimeseriesPoint,
  PageRow,
  SectionRow,
  TopEventRow,
} from '@/lib/analytics/insights/contracts';

const SAUGE = '#A8C4A6';
const ENCRE = '#2C2A28';
const CHAMPAGNE = '#C8A876';
const ROSE = '#E2B6B2';
const HEAT_MIN = '#F0F4ED';
const HEAT_MAX = '#5A7A58';

/* ─── KpiCard ─────────────────────────────────────────────────────── */

export interface KpiCardProps {
  label: string;
  value: string;
  variation?: number | null;
  invertVariation?: boolean;
}

export function KpiCard({ label, value, variation, invertVariation }: KpiCardProps) {
  let signal: 'positive' | 'negative' | 'neutral' = 'neutral';
  if (variation != null && Number.isFinite(variation)) {
    const positive = variation > 0;
    const desired = invertVariation ? !positive : positive;
    if (variation === 0) signal = 'neutral';
    else signal = desired ? 'positive' : 'negative';
  }
  return (
    <div className="rounded-md border border-stone-200 bg-white p-4 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-stone-900">{value}</div>
      {variation != null && (
        <div
          className={`mt-1 text-xs font-medium tabular-nums ${
            signal === 'positive'
              ? 'text-emerald-700'
              : signal === 'negative'
              ? 'text-red-700'
              : 'text-stone-500'
          }`}
        >
          {signal === 'positive' ? '↗' : signal === 'negative' ? '↘' : '→'} {formatVariation(variation)}
        </div>
      )}
    </div>
  );
}

/* ─── EventsTimeSeries ────────────────────────────────────────────── */

export const EventsTimeSeries = forwardRef<SVGSVGElement, { data: InsightsTimeseriesPoint[] }>(
  function EventsTimeSeries({ data }, ref) {
  const width = 800;
  const height = 240;
  const margin = { top: 16, right: 16, bottom: 28, left: 48 };

  const yMax = useMemo(() => {
    let m = 0;
    for (const p of data) m = Math.max(m, p.events, p.sessions, p.conversions);
    return m;
  }, [data]);

  if (data.length === 0) return <EmptyChart label="Évolution sur la fenêtre" />;

  const xScale = (i: number) =>
    margin.left +
    (i / Math.max(1, data.length - 1)) * (width - margin.left - margin.right);
  const yScale = (v: number) =>
    height - margin.bottom - (v / Math.max(1, yMax)) * (height - margin.top - margin.bottom);

  const buildPath = (values: number[]) =>
    values
      .map((v, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(v)}`)
      .join(' ');

  return (
    <svg
      ref={ref}
      role="img"
      aria-label="Évolution des événements par jour"
      viewBox={`0 0 ${width} ${height}`}
      className="block w-full"
    >
      <title>Évolution des événements par jour</title>
      {/* Axes */}
      <line
        x1={margin.left}
        y1={height - margin.bottom}
        x2={width - margin.right}
        y2={height - margin.bottom}
        stroke="#D6D3CA"
      />
      <line
        x1={margin.left}
        y1={margin.top}
        x2={margin.left}
        y2={height - margin.bottom}
        stroke="#D6D3CA"
      />
      {/* Lignes */}
      <path d={buildPath(data.map((d) => d.events))} fill="none" stroke={ENCRE} strokeWidth={1.5} />
      <path
        d={buildPath(data.map((d) => d.sessions))}
        fill="none"
        stroke={SAUGE}
        strokeWidth={1.5}
      />
      <path
        d={buildPath(data.map((d) => d.conversions))}
        fill="none"
        stroke={CHAMPAGNE}
        strokeWidth={1.5}
      />
      {/* Labels X (par 7 jours) */}
      {data.map((p, i) =>
        i % 7 === 0 ? (
          <text
            key={p.date}
            x={xScale(i)}
            y={height - 8}
            fontSize={10}
            textAnchor="middle"
            fill="#6B6863"
          >
            {p.date.slice(5)}
          </text>
        ) : null,
      )}
    </svg>
  );
});

/* ─── ActivityHeatmap ─────────────────────────────────────────────── */

export const ActivityHeatmap = forwardRef<SVGSVGElement, { cells: InsightsHeatmapCell[] }>(
  function ActivityHeatmap({ cells }, ref) {
  const max = useMemo(() => Math.max(1, ...cells.map((c) => c.count)), [cells]);
  const dayLabels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  if (cells.length === 0) return <EmptyChart label="Activité horaire" />;

  return (
    <svg
      ref={ref}
      role="img"
      aria-label="Heatmap horaire (heures × jours)"
      viewBox="0 0 480 200"
      className="block w-full"
    >
      <title>Heatmap horaire</title>
      {dayLabels.map((label, dow) => (
        <text key={label} x={4} y={26 + dow * 24} fontSize={10} fill="#6B6863">
          {label}
        </text>
      ))}
      {[...Array(7)].map((_, dow) =>
        [...Array(24)].map((_, h) => {
          const c = cells.find((x) => x.dayOfWeek === dow && x.hour === h);
          const ratio = c ? c.count / max : 0;
          const fill = mixColor(HEAT_MIN, HEAT_MAX, Math.max(0.05, ratio));
          return (
            <rect
              key={`${dow}-${h}`}
              x={36 + h * 18}
              y={20 + dow * 24}
              width={16}
              height={22}
              fill={fill}
            >
              <title>
                {dayLabels[dow]} {h} h · {c?.count ?? 0} events
              </title>
            </rect>
          );
        }),
      )}
    </svg>
  );
});

/* ─── FunnelSankey (simplifié) ────────────────────────────────────── */

export const FunnelSankey = forwardRef<SVGSVGElement, { stages: FunnelStage[] }>(
  function FunnelSankey({ stages }, ref) {
  const max = useMemo(() => Math.max(1, ...stages.map((s) => s.count)), [stages]);
  if (stages.length === 0) return <EmptyChart label="Tunnel de conversion" />;

  return (
    <svg
      ref={ref}
      role="img"
      aria-label="Tunnel de conversion"
      viewBox={`0 0 800 ${stages.length * 60 + 40}`}
      className="block w-full"
    >
      <title>Tunnel de conversion</title>
      {stages.map((s, i) => {
        const w = (s.count / max) * 600;
        const y = 30 + i * 60;
        return (
          <g key={s.name}>
            <text x={20} y={y - 4} fontSize={11} fill="#6B6863">
              {s.name}
            </text>
            <rect x={20} y={y} width={Math.max(2, w)} height={36} fill={CHAMPAGNE} rx={4} />
            <text x={28 + Math.max(2, w)} y={y + 22} fontSize={12} fill="#2C2A28">
              {formatNumber(s.count)}
              {s.conversionFromPrev !== null
                ? ` (${formatPercent(s.conversionFromPrev, 1)})`
                : ''}
            </text>
          </g>
        );
      })}
    </svg>
  );
});

/* ─── SectionsBarChart ────────────────────────────────────────────── */

export function SectionsBarChart({ rows }: { rows: SectionRow[] }) {
  const max = useMemo(() => Math.max(1, ...rows.map((r) => r.avgDwellSeconds)), [rows]);
  if (rows.length === 0) return <EmptyChart label="Sections par durée" />;
  return (
    <ul className="flex flex-col gap-2" data-testid="sections-bars">
      {rows.slice(0, 12).map((r) => {
        const w = (r.avgDwellSeconds / max) * 100;
        return (
          <li key={`${r.pageRoute}|${r.sectionId}`} className="flex items-center gap-3">
            <div className="w-48 truncate text-xs text-stone-700" title={`${r.sectionId} · ${r.pageRoute}`}>
              {r.sectionId}
            </div>
            <div className="relative h-6 flex-1 rounded bg-stone-100">
              <div
                className="absolute inset-y-0 left-0 rounded"
                style={{ width: `${w}%`, backgroundColor: SAUGE }}
                aria-hidden
              />
            </div>
            <div className="w-20 text-right text-xs tabular-nums text-stone-600">
              {formatDuration(r.avgDwellSeconds)}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ─── TopEventsTable ─────────────────────────────────────────────── */

export function TopEventsTable({ rows }: { rows: TopEventRow[] }) {
  if (rows.length === 0) return <EmptyChart label="Top events" />;
  return (
    <table className="w-full text-sm" data-testid="top-events-table">
      <thead>
        <tr className="border-b border-stone-200 text-[11px] uppercase tracking-wider text-stone-500">
          <th className="py-2 text-left font-semibold">Event</th>
          <th className="py-2 text-right font-semibold">Volume</th>
          <th className="py-2 text-right font-semibold">Part</th>
          <th className="py-2 text-right font-semibold">Conversions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.eventName} className="border-b border-stone-100 last:border-0">
            <td className="py-2 font-mono text-xs">{r.eventName}</td>
            <td className="py-2 text-right tabular-nums">{formatNumber(r.count)}</td>
            <td className="py-2 text-right tabular-nums">{formatPercent(r.share, 1)}</td>
            <td className="py-2 text-right tabular-nums">
              {r.conversionCount > 0 ? formatNumber(r.conversionCount) : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ─── PagesTable ─────────────────────────────────────────────────── */

const TABLE_PAGE_SIZE = 100;

export function PagesTable({
  rows,
  onRowClick,
}: {
  rows: PageRow[];
  onRowClick?: (row: PageRow) => void;
}) {
  const [shown, setShown] = useState(TABLE_PAGE_SIZE);
  if (rows.length === 0) return <EmptyChart label="Top pages" />;
  const visible = rows.slice(0, shown);
  return (
    <div>
      <table className="w-full text-sm" data-testid="pages-table">
        <thead>
          <tr className="border-b border-stone-200 text-[11px] uppercase tracking-wider text-stone-500">
            <th className="py-2 text-left font-semibold">Route</th>
            <th className="py-2 text-right font-semibold">Visites</th>
            <th className="py-2 text-right font-semibold">Sessions</th>
            <th className="py-2 text-right font-semibold">Engmt</th>
            <th className="py-2 text-right font-semibold">Conv.</th>
            <th className="py-2 text-right font-semibold">Bounce</th>
            <th className="py-2 text-right font-semibold">Durée</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((r) => {
            const engagement = r.pageViews > 0 ? r.scroll75 / r.pageViews : 0;
            return (
              <tr
                key={r.pageRoute}
                className={`border-b border-stone-100 last:border-0 ${
                  onRowClick ? 'cursor-pointer hover:bg-stone-50' : ''
                }`}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
              >
                <td className="py-2 font-mono text-xs">{r.pageRoute}</td>
                <td className="py-2 text-right tabular-nums">{formatNumber(r.pageViews)}</td>
                <td className="py-2 text-right tabular-nums">{formatNumber(r.sessions)}</td>
                <td className="py-2 text-right tabular-nums">{formatPercent(engagement, 0)}</td>
                <td className="py-2 text-right tabular-nums">{formatNumber(r.conversions)}</td>
                <td className="py-2 text-right tabular-nums">{formatPercent(r.bounceRate, 0)}</td>
                <td className="py-2 text-right tabular-nums">{formatDuration(r.avgTimeSeconds)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length > shown && (
        <button
          type="button"
          onClick={() => setShown((s) => s + TABLE_PAGE_SIZE)}
          className="mt-3 text-xs font-medium text-stone-600 underline hover:text-stone-900"
          data-testid="pages-show-more"
        >
          Voir {Math.min(TABLE_PAGE_SIZE, rows.length - shown)} de plus
          <span className="ml-1 text-stone-400">({shown} / {rows.length})</span>
        </button>
      )}
    </div>
  );
}

/* ─── ComponentsTable ────────────────────────────────────────────── */

export function ComponentsTable({
  rows,
  onRowClick,
}: {
  rows: ComponentRow[];
  onRowClick?: (row: ComponentRow) => void;
}) {
  const [shown, setShown] = useState(TABLE_PAGE_SIZE);
  if (rows.length === 0) return <EmptyChart label="Top composants" />;
  const visible = rows.slice(0, shown);
  return (
    <div>
    <table className="w-full text-sm" data-testid="components-table">
      <thead>
        <tr className="border-b border-stone-200 text-[11px] uppercase tracking-wider text-stone-500">
          <th className="py-2 text-left font-semibold">Composant</th>
          <th className="py-2 text-left font-semibold">Page</th>
          <th className="py-2 text-right font-semibold">Total</th>
          <th className="py-2 text-left font-semibold">Top event</th>
          <th className="py-2 text-right font-semibold">Conv.</th>
        </tr>
      </thead>
      <tbody>
        {visible.map((r) => (
          <tr
            key={r.componentId}
            className={`border-b border-stone-100 last:border-0 ${
              onRowClick ? 'cursor-pointer hover:bg-stone-50' : ''
            }`}
            onClick={onRowClick ? () => onRowClick(r) : undefined}
          >
            <td className="py-2">
              <span className="font-mono text-xs">{r.componentId}</span>
              {r.componentName && (
                <span className="ml-2 text-xs text-stone-500">{r.componentName}</span>
              )}
            </td>
            <td className="py-2 font-mono text-xs text-stone-600">{r.pageRoute ?? '—'}</td>
            <td className="py-2 text-right tabular-nums">{formatNumber(r.total)}</td>
            <td className="py-2 font-mono text-xs">{r.topEvent}</td>
            <td className="py-2 text-right tabular-nums">
              {r.conversionCount > 0 ? formatNumber(r.conversionCount) : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    {rows.length > shown && (
      <button
        type="button"
        onClick={() => setShown((s) => s + TABLE_PAGE_SIZE)}
        className="mt-3 text-xs font-medium text-stone-600 underline hover:text-stone-900"
        data-testid="components-show-more"
      >
        Voir {Math.min(TABLE_PAGE_SIZE, rows.length - shown)} de plus
        <span className="ml-1 text-stone-400">({shown} / {rows.length})</span>
      </button>
    )}
    </div>
  );
}

/* ─── EmptyChart ─────────────────────────────────────────────────── */

function EmptyChart({ label }: { label: string }) {
  return (
    <div
      role="status"
      className="flex h-40 items-center justify-center rounded border border-dashed border-stone-200 text-sm text-stone-500"
    >
      <span>
        Aucune donnée — <em>{label}</em>
      </span>
    </div>
  );
}

/* ─── helpers ────────────────────────────────────────────────────── */

function mixColor(hex1: string, hex2: string, t: number): string {
  const a = hexToRgb(hex1);
  const b = hexToRgb(hex2);
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const blue = Math.round(a.b + (b.b - a.b) * t);
  return `rgb(${r}, ${g}, ${blue})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = hex.replace('#', '');
  const v = parseInt(m, 16);
  return { r: (v >> 16) & 0xff, g: (v >> 8) & 0xff, b: v & 0xff };
}
