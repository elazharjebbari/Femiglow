/**
 * Pure filter/search/URL helpers for the Library v2.
 *
 * Découpés hors composant React pour rester 100% testables sans render :
 * - `applyFilters(items, filters)` : combinator (status + platform + pillar
 *   + date range + search)
 * - `searchMatches(item, query)` : ciblé caption + alt média + variantLabel
 * - `filtersToSearchParams(filters)` / `filtersFromSearchParams(...)` :
 *   sérialisation URL (shareable links).
 *
 * Aucune dépendance Next/React ici.
 */

import type {
  ContentPillar,
  ContentPlatform,
  ContentStatus,
} from '@/lib/content-studio/types';
import { CONTENT_PILLARS, CONTENT_PLATFORMS, CONTENT_STATUSES } from '@/lib/content-studio/types';
import type { LibraryFilterState, LibraryItem } from './types';
import { EMPTY_FILTERS } from './types';

const STATUS_SET = new Set<string>(CONTENT_STATUSES);
const PILLAR_SET = new Set<string>(CONTENT_PILLARS);
const PLATFORM_SET = new Set<string>(CONTENT_PLATFORMS);

/** Returns true if the item's caption, variantLabel or media alt text
 * loosely matches the search query (case-insensitive). Empty query
 * matches everything. */
export function searchMatches(item: LibraryItem, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    item.caption,
    item.variantLabel,
    item.thumbnail.alt,
  ]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();
  return haystack.includes(q);
}

/** Returns true if the item passes all filters (used as the combinator
 * for status × platform × pillar × date range × search). */
export function itemPassesFilters(item: LibraryItem, filters: LibraryFilterState): boolean {
  if (filters.statuses.length > 0 && !filters.statuses.includes(item.status)) {
    return false;
  }
  if (filters.platform !== 'all' && item.platform !== filters.platform) {
    return false;
  }
  if (filters.pillar !== 'all' && item.pillar !== filters.pillar) {
    return false;
  }
  if (filters.dateFrom) {
    const from = Date.parse(filters.dateFrom);
    if (!Number.isNaN(from)) {
      const sort = Date.parse(item.sortAt);
      if (!Number.isNaN(sort) && sort < from) return false;
    }
  }
  if (filters.dateTo) {
    // include the whole day → +1d - 1ms
    const toRaw = Date.parse(filters.dateTo);
    if (!Number.isNaN(toRaw)) {
      const to = toRaw + 24 * 60 * 60 * 1000 - 1;
      const sort = Date.parse(item.sortAt);
      if (!Number.isNaN(sort) && sort > to) return false;
    }
  }
  if (!searchMatches(item, filters.search)) {
    return false;
  }
  return true;
}

export function applyFilters(items: LibraryItem[], filters: LibraryFilterState): LibraryItem[] {
  return items.filter((item) => itemPassesFilters(item, filters));
}

// --- URL sync ----------------------------------------------------------

export function filtersFromSearchParams(params: URLSearchParams): LibraryFilterState {
  const statusesRaw = (params.get('status') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const statuses = statusesRaw.filter((s): s is ContentStatus => STATUS_SET.has(s));
  const platformRaw = params.get('platform');
  const platform: LibraryFilterState['platform'] =
    platformRaw && PLATFORM_SET.has(platformRaw) ? (platformRaw as ContentPlatform) : 'all';
  const pillarRaw = params.get('pillar');
  const pillar: LibraryFilterState['pillar'] =
    pillarRaw && PILLAR_SET.has(pillarRaw) ? (pillarRaw as ContentPillar) : 'all';
  const dateFrom = params.get('from');
  const dateTo = params.get('to');
  const search = params.get('q') ?? '';
  return {
    statuses,
    platform,
    pillar,
    dateFrom: dateFrom && dateFrom.length > 0 ? dateFrom : null,
    dateTo: dateTo && dateTo.length > 0 ? dateTo : null,
    search,
  };
}

export function filtersToSearchParams(filters: LibraryFilterState): URLSearchParams {
  const next = new URLSearchParams();
  if (filters.statuses.length > 0) next.set('status', filters.statuses.join(','));
  if (filters.platform !== 'all') next.set('platform', filters.platform);
  if (filters.pillar !== 'all') next.set('pillar', filters.pillar);
  if (filters.dateFrom) next.set('from', filters.dateFrom);
  if (filters.dateTo) next.set('to', filters.dateTo);
  if (filters.search.trim()) next.set('q', filters.search.trim());
  return next;
}

export function filtersAreEmpty(filters: LibraryFilterState): boolean {
  return (
    filters.statuses.length === 0 &&
    filters.platform === 'all' &&
    filters.pillar === 'all' &&
    !filters.dateFrom &&
    !filters.dateTo &&
    !filters.search.trim()
  );
}

export function resetFilters(): LibraryFilterState {
  return { ...EMPTY_FILTERS };
}
