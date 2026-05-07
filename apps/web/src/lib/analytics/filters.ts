/**
 * Filtres analytics — schéma Zod + helpers de parsing URL/localStorage.
 * cf. docs/analytics/02-data-model.md §3.4 et docs/analytics/05-onglets-specs.md
 *
 * Les filtres sont la lingua franca de tout l'admin analytics : URL params,
 * localStorage et endpoints API partagent ce contrat.
 */
import { z } from 'zod';

import { TRAFFIC_BUCKETS } from './attribution';

export const ANALYTICS_PERIODS = [
  'today',
  'yesterday',
  '7d',
  '30d',
  '90d',
  'all',
  'custom',
] as const;

export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];

export const ANALYTICS_DEVICES = ['mobile', 'tablet', 'desktop', 'all'] as const;
export type AnalyticsDevice = (typeof ANALYTICS_DEVICES)[number];

const TRAFFIC_VALUES = ['all', ...TRAFFIC_BUCKETS] as const;
export type AnalyticsTraffic = (typeof TRAFFIC_VALUES)[number];

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}(T.*Z?)?$/, 'date ISO attendue (YYYY-MM-DD ou ISO complet)');

const MAX_RANGE_DAYS = 366;
const MS_PER_DAY = 86_400_000;

export const AnalyticsFiltersSchema = z
  .object({
    period: z.enum(ANALYTICS_PERIODS).default('today'),
    device: z.enum(ANALYTICS_DEVICES).default('mobile'),
    traffic: z.enum(TRAFFIC_VALUES).default('all'),
    from: isoDate.optional(),
    to: isoDate.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.period === 'custom') {
      if (!data.from || !data.to) {
        ctx.addIssue({
          code: 'custom',
          path: ['period'],
          message: 'period=custom requires `from` and `to`',
        });
        return;
      }
      const from = new Date(data.from).getTime();
      const to = new Date(data.to).getTime();
      if (Number.isNaN(from) || Number.isNaN(to)) {
        ctx.addIssue({ code: 'custom', path: ['from'], message: 'invalid date' });
        return;
      }
      if (from >= to) {
        ctx.addIssue({
          code: 'custom',
          path: ['from'],
          message: '`from` must be strictly before `to`',
        });
        return;
      }
      if (to - from > MAX_RANGE_DAYS * MS_PER_DAY) {
        ctx.addIssue({
          code: 'custom',
          path: ['to'],
          message: `range too large (max ${MAX_RANGE_DAYS} days)`,
        });
      }
    }
  });

export type AnalyticsFilters = z.infer<typeof AnalyticsFiltersSchema>;

export const DEFAULT_FILTERS: AnalyticsFilters = {
  period: 'today',
  device: 'mobile',
  traffic: 'all',
};

/* ─────────────────────────────────────────────────────────────────────
 * URL helpers
 * ───────────────────────────────────────────────────────────────────── */

export function parseFiltersFromSearchParams(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
): AnalyticsFilters {
  const get = (k: string): string | undefined => {
    if (params instanceof URLSearchParams) return params.get(k) ?? undefined;
    const v = (params as Record<string, string | string[] | undefined>)[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const raw = {
    period: get('period'),
    device: get('device'),
    traffic: get('traffic'),
    from: get('from'),
    to: get('to'),
  };

  // Filtre les undefined avant parse (Zod default seulement si key absente).
  const cleaned = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== undefined));

  const parsed = AnalyticsFiltersSchema.safeParse(cleaned);
  if (!parsed.success) {
    return DEFAULT_FILTERS;
  }
  return parsed.data;
}

export function filtersToSearchParams(filters: AnalyticsFilters): URLSearchParams {
  const out = new URLSearchParams();
  if (filters.period !== DEFAULT_FILTERS.period) out.set('period', filters.period);
  if (filters.device !== DEFAULT_FILTERS.device) out.set('device', filters.device);
  if (filters.traffic !== DEFAULT_FILTERS.traffic) out.set('traffic', filters.traffic);
  if (filters.period === 'custom') {
    if (filters.from) out.set('from', filters.from);
    if (filters.to) out.set('to', filters.to);
  }
  return out;
}

/* ─────────────────────────────────────────────────────────────────────
 * Range resolution — convertit period → { from, to } absolus
 * ───────────────────────────────────────────────────────────────────── */

export interface ResolvedRange {
  from: Date;
  to: Date;
  /** Période précédente comparable (même durée), pour le calcul du delta. */
  comparisonFrom: Date;
  comparisonTo: Date;
}

export function resolveRange(filters: AnalyticsFilters, now: Date = new Date()): ResolvedRange {
  const todayStart = startOfDay(now);
  const tomorrowStart = new Date(todayStart.getTime() + MS_PER_DAY);

  switch (filters.period) {
    case 'today':
      return withComparison(todayStart, tomorrowStart);
    case 'yesterday': {
      const yStart = new Date(todayStart.getTime() - MS_PER_DAY);
      return withComparison(yStart, todayStart);
    }
    case '7d':
      return withComparison(addDays(todayStart, -6), tomorrowStart);
    case '30d':
      return withComparison(addDays(todayStart, -29), tomorrowStart);
    case '90d':
      return withComparison(addDays(todayStart, -89), tomorrowStart);
    case 'all':
      // "Tout" : on borne à 365 jours pour rester perf, comparison = la
      // période juste avant (les 365j précédents).
      return withComparison(addDays(todayStart, -364), tomorrowStart);
    case 'custom': {
      const from = filters.from ? new Date(filters.from) : todayStart;
      const to = filters.to ? new Date(filters.to) : tomorrowStart;
      return withComparison(from, to);
    }
  }
}

function withComparison(from: Date, to: Date): ResolvedRange {
  const span = to.getTime() - from.getTime();
  return {
    from,
    to,
    comparisonFrom: new Date(from.getTime() - span),
    comparisonTo: from,
  };
}

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * MS_PER_DAY);
}

/* ─────────────────────────────────────────────────────────────────────
 * localStorage helpers (client only)
 * ───────────────────────────────────────────────────────────────────── */

export const FILTERS_STORAGE_KEY = 'fg_analytics_filters';
const STORAGE_TTL_MS = 30 * MS_PER_DAY;

interface StoredFilters {
  filters: AnalyticsFilters;
  savedAt: number;
}

export function readStoredFilters(now: number = Date.now()): AnalyticsFilters | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(FILTERS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredFilters>;
    if (!parsed.filters || typeof parsed.savedAt !== 'number') return null;
    if (now - parsed.savedAt > STORAGE_TTL_MS) return null;
    const validated = AnalyticsFiltersSchema.safeParse(parsed.filters);
    return validated.success ? validated.data : null;
  } catch {
    return null;
  }
}

export function writeStoredFilters(filters: AnalyticsFilters, now: number = Date.now()): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: StoredFilters = { filters, savedAt: now };
    window.localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // localStorage indisponible (mode privé Safari) — silently ignore.
  }
}
