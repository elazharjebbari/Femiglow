/**
 * Contrats Zod du module Analytics Insights.
 * cf. docs/analytics-insights/03-backend.md §2
 *
 * Toutes les routes API consomment ces schémas (safeParse côté serveur)
 * et exposent les types TypeScript correspondants côté client.
 */
import { z } from 'zod';

export const INSIGHTS_WINDOW_KEYS = [
  'today',
  'yesterday',
  '7d',
  '30d',
  '90d',
  'custom',
  'all',
] as const;

export type InsightsWindow = (typeof INSIGHTS_WINDOW_KEYS)[number];

export const INSIGHTS_ENVS = ['production', 'stage', 'preview', 'dev', 'all'] as const;
export const INSIGHTS_DEVICES = ['mobile', 'desktop', 'tablet', 'unknown', 'all'] as const;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format attendu : YYYY-MM-DD');

export const insightsFiltersSchema = z
  .object({
    window: z.enum(INSIGHTS_WINDOW_KEYS).default('7d'),
    customFrom: isoDate.optional(),
    customTo: isoDate.optional(),
    env: z.enum(INSIGHTS_ENVS).default('all'),
    device: z.enum(INSIGHTS_DEVICES).default('all'),
    locale: z.string().max(20).default('all'),
    trafficSource: z.string().max(80).default('all'),
  })
  .superRefine((data, ctx) => {
    if (data.window === 'custom') {
      if (!data.customFrom || !data.customTo) {
        ctx.addIssue({
          code: 'custom',
          path: ['window'],
          message: 'window=custom nécessite customFrom et customTo',
        });
        return;
      }
      const from = new Date(data.customFrom).getTime();
      const to = new Date(data.customTo).getTime();
      if (Number.isNaN(from) || Number.isNaN(to)) {
        ctx.addIssue({ code: 'custom', path: ['customFrom'], message: 'date invalide' });
        return;
      }
      if (from > to) {
        ctx.addIssue({
          code: 'custom',
          path: ['customFrom'],
          message: 'customFrom doit être avant customTo',
        });
        return;
      }
      const days = (to - from) / 86_400_000;
      if (days > 365) {
        ctx.addIssue({
          code: 'custom',
          path: ['customTo'],
          message: 'Période > 365 jours non supportée',
        });
      }
    }
  });

export type InsightsFilters = z.infer<typeof insightsFiltersSchema>;

export const DEFAULT_INSIGHTS_FILTERS: InsightsFilters = {
  window: '7d',
  env: 'all',
  device: 'all',
  locale: 'all',
  trafficSource: 'all',
};

/* ─────────────────────────────────────────────────────────────────
 * Réponses
 * ───────────────────────────────────────────────────────────────── */

export interface InsightsKpis {
  totalEvents: number;
  uniqueSessions: number;
  pageViews: number;
  conversions: number;
  avgEventsPerSession: number;
  bounceRate: number;
}

export interface InsightsTimeseriesPoint {
  date: string; // YYYY-MM-DD
  events: number;
  sessions: number;
  conversions: number;
}

export interface InsightsHeatmapCell {
  hour: number; // 0..23
  dayOfWeek: number; // 0=Lun..6=Dim
  count: number;
}

export interface OverviewResponse {
  kpis: InsightsKpis;
  variations: Partial<Record<keyof InsightsKpis, number>>;
  timeseries: InsightsTimeseriesPoint[];
  heatmap: InsightsHeatmapCell[];
  topEvents: TopEventRow[];
  refreshedAt: string | null;
  firstRun: boolean;
}

export interface TopEventRow {
  eventName: string;
  eventCategory: string;
  count: number;
  share: number; // 0..1
  conversionCount: number;
  isConversion: boolean;
}

export interface PageRow {
  pageRoute: string;
  pageViews: number;
  sessions: number;
  visitors: number;
  scroll75: number;
  conversions: number;
  bounceCount: number;
  bounceRate: number;
  avgTimeSeconds: number;
}

export interface PagesResponse {
  pages: PageRow[];
  totalRows: number;
}

export interface PageDetailResponse {
  pageRoute: string;
  pageViews: number;
  sessions: number;
  events: { eventName: string; count: number; share: number }[];
  components: { componentId: string; componentName: string | null; count: number }[];
  daily: InsightsTimeseriesPoint[];
}

export interface ComponentRow {
  componentId: string;
  componentName: string | null;
  pageRoute: string | null;
  total: number;
  topEvent: string;
  conversionCount: number;
}

export interface ComponentsResponse {
  components: ComponentRow[];
  totalRows: number;
}

export interface DeadComponentRow {
  componentId: string;
  componentName: string | null;
  category: string | null;
}

export interface DeadComponentsResponse {
  components: DeadComponentRow[];
}

export interface ComponentDetailResponse {
  componentId: string;
  componentName: string | null;
  total: number;
  events: { eventName: string; count: number; share: number }[];
  pages: { pageRoute: string; count: number }[];
  daily: { date: string; count: number }[];
}

export interface SectionRow {
  sectionId: string;
  pageRoute: string;
  views: number;
  avgDwellSeconds: number;
  uniqueSessions: number;
}

export interface SectionsResponse {
  sections: SectionRow[];
  totalRows: number;
}

export interface FunnelStage {
  name: string;
  count: number;
  conversionFromPrev: number | null; // ratio 0..1
}

export interface FunnelDropoff {
  fromStage: string;
  toStage: string;
  lost: number;
  percent: number; // négatif
}

export interface FunnelResponse {
  stages: FunnelStage[];
  dropoffs: FunnelDropoff[];
  totalRevenueCents: number;
  uniquePurchasers: number;
}

export interface InsightsRefreshStatus {
  lastRun: {
    id: string;
    trigger: 'cron' | 'manual';
    status: 'running' | 'success' | 'failed' | 'skipped';
    startedAt: string;
    finishedAt: string | null;
    durationsMs: Record<string, number>;
    counts: Record<string, number>;
    errorCode: string | null;
    errorMessage: string | null;
    triggeredBy: string | null;
  } | null;
  lockHeld: boolean;
  enabled: boolean;
  intervalMinutes: number;
}

export interface InsightsRefreshResult {
  ok: boolean;
  runId: string | null;
  durationsMs: Record<string, number>;
  counts: Record<string, number>;
  skipped?: boolean;
  reason?: string;
}

export const insightsSettingsPatchSchema = z.object({
  enabled: z.boolean().optional(),
  intervalMinutes: z
    .number()
    .int()
    .refine((v) => [5, 10, 15, 30, 60].includes(v), {
      message: 'intervalMinutes doit être 5, 10, 15, 30 ou 60',
    })
    .optional(),
});

export type InsightsSettingsPatch = z.infer<typeof insightsSettingsPatchSchema>;

export const INSIGHTS_EXPORT_VIEWS = [
  'overview',
  'events',
  'pages',
  'components',
  'dead_components',
  'sections',
  'funnel',
] as const;
export type InsightsExportView = (typeof INSIGHTS_EXPORT_VIEWS)[number];
