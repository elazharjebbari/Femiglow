import { describe, it, expect } from 'vitest';
import {
  applyFilters,
  filtersAreEmpty,
  filtersFromSearchParams,
  filtersToSearchParams,
  itemPassesFilters,
  resetFilters,
  searchMatches,
} from './filters';
import type { LibraryFilterState, LibraryItem } from './types';
import { EMPTY_FILTERS } from './types';

function makeItem(overrides: Partial<LibraryItem> = {}): LibraryItem {
  return {
    id: 'cp_1',
    draftId: 'cd_1',
    postId: 'cp_1',
    caption: 'Rituel du soir, sérum hydratant',
    variantLabel: 'Variante A',
    platform: 'instagram',
    format: 'post',
    pillar: 'rituel',
    status: 'approved',
    scheduledAt: null,
    publishedAt: null,
    sortAt: '2026-05-15T10:00:00.000Z',
    thumbnail: { url: null, kind: null, alt: '' },
    ...overrides,
  };
}

describe('library/filters', () => {
  describe('itemPassesFilters — combinator', () => {
    it('combines status + platform + date range (all match → pass)', () => {
      const item = makeItem({
        status: 'scheduled',
        platform: 'instagram',
        sortAt: '2026-05-15T10:00:00.000Z',
      });
      const filters: LibraryFilterState = {
        ...EMPTY_FILTERS,
        statuses: ['scheduled', 'approved'],
        platform: 'instagram',
        dateFrom: '2026-05-10',
        dateTo: '2026-05-20',
      };
      expect(itemPassesFilters(item, filters)).toBe(true);
    });

    it('combines status + platform + date range (status mismatch → fail)', () => {
      const item = makeItem({ status: 'rejected', platform: 'instagram' });
      const filters: LibraryFilterState = {
        ...EMPTY_FILTERS,
        statuses: ['approved'],
        platform: 'instagram',
      };
      expect(itemPassesFilters(item, filters)).toBe(false);
    });

    it('combines status + platform + date range (platform mismatch → fail)', () => {
      const item = makeItem({ status: 'approved', platform: 'facebook' });
      const filters: LibraryFilterState = {
        ...EMPTY_FILTERS,
        statuses: ['approved'],
        platform: 'instagram',
      };
      expect(itemPassesFilters(item, filters)).toBe(false);
    });

    it('combines status + platform + date range (out-of-range → fail)', () => {
      const item = makeItem({
        status: 'approved',
        platform: 'instagram',
        sortAt: '2026-04-30T10:00:00.000Z',
      });
      const filters: LibraryFilterState = {
        ...EMPTY_FILTERS,
        statuses: ['approved'],
        platform: 'instagram',
        dateFrom: '2026-05-10',
        dateTo: '2026-05-20',
      };
      expect(itemPassesFilters(item, filters)).toBe(false);
    });

    it('empty filters keeps all items', () => {
      const items = [
        makeItem({ id: '1', status: 'approved' }),
        makeItem({ id: '2', status: 'rejected' }),
        makeItem({ id: '3', status: 'scheduled' }),
      ];
      expect(applyFilters(items, EMPTY_FILTERS)).toHaveLength(3);
    });

    it('multi-status (multiselect) matches any', () => {
      const items = [
        makeItem({ id: '1', status: 'approved' }),
        makeItem({ id: '2', status: 'needs_review' }),
        makeItem({ id: '3', status: 'rejected' }),
      ];
      const filters: LibraryFilterState = {
        ...EMPTY_FILTERS,
        statuses: ['approved', 'needs_review'],
      };
      const out = applyFilters(items, filters);
      expect(out.map((i) => i.id).sort()).toEqual(['1', '2']);
    });

    it('pillar filter restricts to a single pillar', () => {
      const items = [
        makeItem({ id: '1', pillar: 'rituel' }),
        makeItem({ id: '2', pillar: 'produit' }),
        makeItem({ id: '3', pillar: 'rituel' }),
      ];
      const filters: LibraryFilterState = { ...EMPTY_FILTERS, pillar: 'rituel' };
      expect(applyFilters(items, filters).map((i) => i.id)).toEqual(['1', '3']);
    });

    it('date range includes the upper-bound day (until 23:59:59.999)', () => {
      const item = makeItem({ sortAt: '2026-05-20T23:30:00.000Z' });
      const filters: LibraryFilterState = {
        ...EMPTY_FILTERS,
        dateFrom: '2026-05-10',
        dateTo: '2026-05-20',
      };
      expect(itemPassesFilters(item, filters)).toBe(true);
    });
  });

  describe('searchMatches — alt OR caption OR variantLabel', () => {
    it('matches when query is in caption', () => {
      const item = makeItem({ caption: 'Rituel du matin avec le sérum éclat' });
      expect(searchMatches(item, 'éclat')).toBe(true);
    });

    it('matches when query is in media alt', () => {
      const item = makeItem({
        caption: 'Hello',
        thumbnail: { url: '/x.jpg', kind: 'image', alt: 'Portrait au lever du soleil' },
      });
      expect(searchMatches(item, 'soleil')).toBe(true);
    });

    it('matches when query is in variantLabel', () => {
      const item = makeItem({ variantLabel: 'Variante Story Saison' });
      expect(searchMatches(item, 'saison')).toBe(true);
    });

    it('is case-insensitive', () => {
      const item = makeItem({ caption: 'Rituel HydraSerum' });
      expect(searchMatches(item, 'hydraserum')).toBe(true);
    });

    it('empty query matches everything', () => {
      const item = makeItem({ caption: '' });
      expect(searchMatches(item, '')).toBe(true);
      expect(searchMatches(item, '   ')).toBe(true);
    });

    it('returns false when nothing matches', () => {
      const item = makeItem({ caption: 'Hello', variantLabel: 'A' });
      expect(searchMatches(item, 'nope')).toBe(false);
    });
  });

  describe('filtersToSearchParams ↔ filtersFromSearchParams', () => {
    it('roundtrips a populated filter state', () => {
      const filters: LibraryFilterState = {
        statuses: ['scheduled', 'approved'],
        platform: 'instagram',
        pillar: 'rituel',
        dateFrom: '2026-05-01',
        dateTo: '2026-05-31',
        search: 'hydratation',
      };
      const params = filtersToSearchParams(filters);
      const parsed = filtersFromSearchParams(params);
      expect(parsed).toEqual(filters);
    });

    it('omits "all" and empty fields from the URL', () => {
      const params = filtersToSearchParams(EMPTY_FILTERS);
      expect(params.toString()).toBe('');
    });

    it('rejects unknown statuses / platforms / pillars defensively', () => {
      const params = new URLSearchParams(
        'status=approved,not_a_status&platform=tiktok&pillar=alien',
      );
      const parsed = filtersFromSearchParams(params);
      expect(parsed.statuses).toEqual(['approved']);
      expect(parsed.platform).toBe('all');
      expect(parsed.pillar).toBe('all');
    });

    it('produces a stable, sharable query string', () => {
      const filters: LibraryFilterState = {
        ...EMPTY_FILTERS,
        statuses: ['approved', 'scheduled'],
        platform: 'instagram',
      };
      const params = filtersToSearchParams(filters);
      // Order is defined by the set order in `filtersToSearchParams`.
      expect(params.get('status')).toBe('approved,scheduled');
      expect(params.get('platform')).toBe('instagram');
    });
  });

  describe('filtersAreEmpty / resetFilters', () => {
    it('detects empty filters', () => {
      expect(filtersAreEmpty(EMPTY_FILTERS)).toBe(true);
      expect(filtersAreEmpty({ ...EMPTY_FILTERS, search: 'x' })).toBe(false);
      expect(filtersAreEmpty({ ...EMPTY_FILTERS, statuses: ['approved'] })).toBe(false);
    });

    it('resetFilters returns a fresh copy', () => {
      const a = resetFilters();
      const b = resetFilters();
      expect(a).toEqual(b);
      expect(a).not.toBe(EMPTY_FILTERS);
    });
  });
});
