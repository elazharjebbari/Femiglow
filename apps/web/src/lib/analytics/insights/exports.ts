/**
 * Génération de CSV par vue pour Analytics Insights.
 * cf. docs/analytics-insights/08-filtres-exports.md
 *
 * - BOM UTF-8 préfixé pour Excel/Numbers compatibility
 * - 100k lignes max par export
 * - Filtres respectés
 */
import { HttpError } from '@/lib/errors/http-error';
import type { InsightsFilters, InsightsExportView } from './contracts';
import {
  getComponentsTop,
  getDeadComponents,
  getFunnel,
  getOverview,
  getPagesTop,
  getSectionsTop,
} from './services';

const BOM = '﻿';
const MAX_ROWS = 100_000;

export interface CsvExport {
  filename: string;
  content: string;
  rowCount: number;
}

export async function exportCsv(
  view: InsightsExportView,
  filters: InsightsFilters,
  now: Date = new Date(),
): Promise<CsvExport> {
  const dateLabel = now.toISOString().slice(0, 10);
  switch (view) {
    case 'overview':
      return exportOverview(filters, dateLabel);
    case 'events': {
      const data = await getOverview(filters, now);
      const rows = data.topEvents.map((e) => ({
        event_name: e.eventName,
        event_category: e.eventCategory,
        count: e.count,
        share: e.share.toFixed(4),
        conversion_count: e.conversionCount,
        is_conversion: e.isConversion ? 'true' : 'false',
      }));
      return makeCsv(`insights-events-${dateLabel}`, rows);
    }
    case 'pages': {
      const data = await getPagesTop(filters, MAX_ROWS, now);
      const rows = data.pages.map((p) => ({
        page_route: p.pageRoute,
        page_views: p.pageViews,
        sessions: p.sessions,
        visitors: p.visitors,
        scroll_75: p.scroll75,
        conversions: p.conversions,
        bounce_count: p.bounceCount,
        bounce_rate: p.bounceRate.toFixed(4),
        avg_time_seconds: p.avgTimeSeconds,
      }));
      return makeCsv(`insights-pages-${dateLabel}`, rows);
    }
    case 'components': {
      const data = await getComponentsTop(filters, MAX_ROWS, now);
      const rows = data.components.map((c) => ({
        component_id: c.componentId,
        component_name: c.componentName ?? '',
        page_route: c.pageRoute ?? '',
        total: c.total,
        top_event: c.topEvent,
        conversion_count: c.conversionCount,
      }));
      return makeCsv(`insights-components-${dateLabel}`, rows);
    }
    case 'dead_components': {
      const data = await getDeadComponents(filters, now);
      const rows = data.components.map((c) => ({
        component_id: c.componentId,
        component_name: c.componentName ?? '',
        category: c.category ?? '',
      }));
      return makeCsv(`insights-dead-components-${dateLabel}`, rows);
    }
    case 'sections': {
      const data = await getSectionsTop(filters, MAX_ROWS, now);
      const rows = data.sections.map((s) => ({
        section_id: s.sectionId,
        page_route: s.pageRoute,
        views: s.views,
        avg_dwell_seconds: s.avgDwellSeconds,
        unique_sessions: s.uniqueSessions,
      }));
      return makeCsv(`insights-sections-${dateLabel}`, rows);
    }
    case 'funnel': {
      const data = await getFunnel(filters, now);
      const rows = data.stages.map((s, i) => ({
        position: i + 1,
        stage: s.name,
        count: s.count,
        conversion_from_prev:
          s.conversionFromPrev !== null ? s.conversionFromPrev.toFixed(4) : '',
        dropoff_lost: data.dropoffs[i - 1]?.lost ?? '',
        dropoff_percent: data.dropoffs[i - 1]?.percent.toFixed(4) ?? '',
      }));
      return makeCsv(`insights-funnel-${dateLabel}`, rows);
    }
  }
}

async function exportOverview(filters: InsightsFilters, dateLabel: string): Promise<CsvExport> {
  const data = await getOverview(filters);
  const rows = data.timeseries.map((p) => ({
    date: p.date,
    events: p.events,
    sessions: p.sessions,
    conversions: p.conversions,
  }));
  return makeCsv(`insights-overview-${dateLabel}`, rows);
}

function makeCsv(filenameBase: string, rows: Record<string, string | number>[]): CsvExport {
  if (rows.length > MAX_ROWS) {
    throw new HttpError(
      'invalid_input',
      `Export trop volumineux (${rows.length} lignes, max ${MAX_ROWS})`,
    );
  }
  if (rows.length === 0) {
    return {
      filename: `${filenameBase}.csv`,
      content: BOM,
      rowCount: 0,
    };
  }
  const headers = Object.keys(rows[0]!);
  const escape = (v: string | number | undefined): string => {
    if (v === undefined) return '';
    const s = String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines: string[] = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(','));
  }
  return {
    filename: `${filenameBase}.csv`,
    content: BOM + lines.join('\n'),
    rowCount: rows.length,
  };
}
