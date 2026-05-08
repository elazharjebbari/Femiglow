/**
 * Résolution de fenêtre temporelle pour Analytics Insights.
 * cf. docs/analytics-insights/08-filtres-exports.md §2
 *
 * Toutes les bornes sont calées sur des frontières "jour calendaire" UTC.
 * `to` est exclusif (convention < to). `from` est inclusif (>= from).
 *
 * La fenêtre `all` est bornée à 365 jours pour la performance des requêtes.
 */
import type { InsightsFilters } from './contracts';

const MS_PER_DAY = 86_400_000;

export interface InsightsRange {
  from: Date;
  to: Date;
  /** Période précédente comparable (même durée). Pour calcul de variation. */
  comparisonFrom: Date;
  comparisonTo: Date;
}

export function resolveInsightsRange(
  filters: InsightsFilters,
  now: Date = new Date(),
): InsightsRange {
  const todayStart = startOfUtcDay(now);
  const tomorrowStart = addDays(todayStart, 1);

  switch (filters.window) {
    case 'today':
      return withComparison(todayStart, tomorrowStart);
    case 'yesterday': {
      const y = addDays(todayStart, -1);
      return withComparison(y, todayStart);
    }
    case '7d':
      return withComparison(addDays(todayStart, -6), tomorrowStart);
    case '30d':
      return withComparison(addDays(todayStart, -29), tomorrowStart);
    case '90d':
      return withComparison(addDays(todayStart, -89), tomorrowStart);
    case 'all':
      return withComparison(addDays(todayStart, -364), tomorrowStart);
    case 'custom': {
      if (!filters.customFrom || !filters.customTo) {
        throw new Error('customFrom et customTo requis pour window=custom');
      }
      const from = startOfUtcDay(new Date(`${filters.customFrom}T00:00:00.000Z`));
      const to = addDays(startOfUtcDay(new Date(`${filters.customTo}T00:00:00.000Z`)), 1);
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
        throw new Error('Dates personnalisées invalides');
      }
      if (from > to) {
        throw new Error('customFrom doit précéder customTo');
      }
      const days = (to.getTime() - from.getTime()) / MS_PER_DAY;
      if (days > 365) {
        throw new Error('Fenêtre > 365 jours non supportée');
      }
      return withComparison(from, to);
    }
  }
}

function withComparison(from: Date, to: Date): InsightsRange {
  const span = to.getTime() - from.getTime();
  return {
    from,
    to,
    comparisonFrom: new Date(from.getTime() - span),
    comparisonTo: from,
  };
}

export function startOfUtcDay(d: Date): Date {
  const c = new Date(d);
  c.setUTCHours(0, 0, 0, 0);
  return c;
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * MS_PER_DAY);
}

export function toIsoDate(d: Date): string {
  // YYYY-MM-DD UTC
  return d.toISOString().slice(0, 10);
}

export function* iterateDays(from: Date, to: Date): Generator<string> {
  let cursor = startOfUtcDay(from);
  const end = startOfUtcDay(to);
  while (cursor < end) {
    yield toIsoDate(cursor);
    cursor = addDays(cursor, 1);
  }
}

export function listDays(from: Date, to: Date): string[] {
  return Array.from(iterateDays(from, to));
}
