/**
 * Parse les query params d'une URL en InsightsFilters validés.
 */
import { HttpError } from '@/lib/errors/http-error';
import {
  DEFAULT_INSIGHTS_FILTERS,
  insightsFiltersSchema,
  type InsightsFilters,
} from './contracts';

export function parseInsightsFiltersFromUrl(url: URL): InsightsFilters {
  const raw: Record<string, string> = {};
  for (const k of ['window', 'customFrom', 'customTo', 'env', 'device', 'locale', 'trafficSource']) {
    const v = url.searchParams.get(k);
    if (v) raw[k] = v;
  }
  const parsed = insightsFiltersSchema.safeParse(raw);
  if (!parsed.success) {
    throw new HttpError('invalid_input', 'Filtres invalides', parsed.error.issues);
  }
  return { ...DEFAULT_INSIGHTS_FILTERS, ...parsed.data };
}
