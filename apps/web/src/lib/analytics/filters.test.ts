import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AnalyticsFiltersSchema,
  DEFAULT_FILTERS,
  FILTERS_STORAGE_KEY,
  filtersToSearchParams,
  parseFiltersFromSearchParams,
  readStoredFilters,
  resolveRange,
  writeStoredFilters,
} from './filters';

describe('AnalyticsFiltersSchema', () => {
  it('accepte input vide → defaults Mobile/Today/All', () => {
    expect(AnalyticsFiltersSchema.parse({})).toEqual(DEFAULT_FILTERS);
  });

  it('valide period 7d / 30d / 90d / all', () => {
    expect(AnalyticsFiltersSchema.parse({ period: '7d' }).period).toBe('7d');
    expect(AnalyticsFiltersSchema.parse({ period: '30d' }).period).toBe('30d');
    expect(AnalyticsFiltersSchema.parse({ period: '90d' }).period).toBe('90d');
    expect(AnalyticsFiltersSchema.parse({ period: 'all' }).period).toBe('all');
  });

  it('refuse period inconnue', () => {
    expect(() => AnalyticsFiltersSchema.parse({ period: '15d' })).toThrow();
  });

  it('valide custom range complet', () => {
    const r = AnalyticsFiltersSchema.parse({
      period: 'custom',
      from: '2026-04-01',
      to: '2026-05-01',
    });
    expect(r.period).toBe('custom');
    expect(r.from).toBe('2026-04-01');
  });

  it('refuse custom sans from/to', () => {
    expect(() => AnalyticsFiltersSchema.parse({ period: 'custom' })).toThrow(/requires/);
    expect(() => AnalyticsFiltersSchema.parse({ period: 'custom', from: '2026-01-01' })).toThrow();
  });

  it('refuse custom range from >= to', () => {
    expect(() =>
      AnalyticsFiltersSchema.parse({ period: 'custom', from: '2026-05-01', to: '2026-04-01' }),
    ).toThrow(/before/);

    expect(() =>
      AnalyticsFiltersSchema.parse({ period: 'custom', from: '2026-05-01', to: '2026-05-01' }),
    ).toThrow(/before/);
  });

  it('refuse custom range > 366 jours', () => {
    expect(() =>
      AnalyticsFiltersSchema.parse({
        period: 'custom',
        from: '2024-01-01',
        to: '2026-05-01',
      }),
    ).toThrow(/range too large/);
  });

  it('valide chaque device autorisé', () => {
    for (const d of ['mobile', 'tablet', 'desktop', 'all'] as const) {
      expect(AnalyticsFiltersSchema.parse({ device: d }).device).toBe(d);
    }
  });

  it('valide traffic = bucket connu ou all', () => {
    expect(AnalyticsFiltersSchema.parse({ traffic: 'google' }).traffic).toBe('google');
    expect(AnalyticsFiltersSchema.parse({ traffic: 'meta' }).traffic).toBe('meta');
    expect(AnalyticsFiltersSchema.parse({ traffic: 'all' }).traffic).toBe('all');
    expect(() => AnalyticsFiltersSchema.parse({ traffic: 'mystery' })).toThrow();
  });
});

describe('parseFiltersFromSearchParams', () => {
  it('lit les query params standards', () => {
    const url = new URL('https://x.com?period=7d&device=desktop&traffic=google');
    const r = parseFiltersFromSearchParams(url.searchParams);
    expect(r).toMatchObject({ period: '7d', device: 'desktop', traffic: 'google' });
  });

  it('absence → defaults', () => {
    const r = parseFiltersFromSearchParams(new URLSearchParams());
    expect(r).toEqual(DEFAULT_FILTERS);
  });

  it('valeur invalide → fallback default complet', () => {
    const r = parseFiltersFromSearchParams(new URLSearchParams('period=15d'));
    expect(r).toEqual(DEFAULT_FILTERS);
  });

  it('F-FLT-01 — une clé invalide est ignorée, les clés valides sont conservées', () => {
    const r = parseFiltersFromSearchParams(
      new URLSearchParams('period=foo&device=desktop&traffic=meta'),
    );
    expect(r.device).toBe('desktop'); // valides conservés
    expect(r.traffic).toBe('meta');
    expect(r.period).toBe(DEFAULT_FILTERS.period); // invalide → défaut, sans tout jeter
  });

  it('accepte un Record (pour Next.js searchParams)', () => {
    const r = parseFiltersFromSearchParams({ period: '30d', device: 'tablet', traffic: 'meta' });
    expect(r).toMatchObject({ period: '30d', device: 'tablet', traffic: 'meta' });
  });
});

describe('filtersToSearchParams', () => {
  it('omet les valeurs par défaut', () => {
    const out = filtersToSearchParams(DEFAULT_FILTERS);
    expect(out.toString()).toBe('');
  });

  it('encode les valeurs non-default', () => {
    const out = filtersToSearchParams({ period: '7d', device: 'desktop', traffic: 'google' });
    expect(out.get('period')).toBe('7d');
    expect(out.get('device')).toBe('desktop');
    expect(out.get('traffic')).toBe('google');
  });

  it('inclut from/to pour custom uniquement', () => {
    const out = filtersToSearchParams({
      period: 'custom',
      device: 'mobile',
      traffic: 'all',
      from: '2026-04-01',
      to: '2026-05-01',
    });
    expect(out.get('from')).toBe('2026-04-01');
    expect(out.get('to')).toBe('2026-05-01');
  });
});

describe('resolveRange', () => {
  const now = new Date('2026-05-06T12:34:00Z');

  it('today → minuit heure Maroc (Africa/Casablanca), fenêtre 24h', () => {
    // AF-04 : bornes ancrées sur le fuseau Maroc (+01), pas sur le TZ du process.
    // now = 12:34 UTC = 13:34 Casablanca → début de journée Maroc = 00:00 +01.
    const r = resolveRange({ ...DEFAULT_FILTERS, period: 'today' }, now);
    expect(r.from.toISOString()).toBe('2026-05-05T23:00:00.000Z');
    expect(r.to.getTime() - r.from.getTime()).toBe(86_400_000);
  });

  it('yesterday → veille (heure Maroc)', () => {
    const r = resolveRange({ ...DEFAULT_FILTERS, period: 'yesterday' }, now);
    expect(r.to.getTime() - r.from.getTime()).toBe(86_400_000);
    expect(r.to.toISOString()).toBe('2026-05-05T23:00:00.000Z'); // début d'aujourd'hui Maroc
    expect(r.from.toISOString()).toBe('2026-05-04T23:00:00.000Z');
  });

  it('AF-04 — un achat de 00:30 heure Maroc est rattaché à « aujourd’hui »', () => {
    // 00:30 Casablanca le 2026-05-06 = 2026-05-05T23:30:00Z (la veille en UTC).
    const nowMaroc0030 = new Date('2026-05-05T23:30:00Z');
    const r = resolveRange({ ...DEFAULT_FILTERS, period: 'today' }, nowMaroc0030);
    const achat = new Date('2026-05-05T23:30:00Z').getTime();
    expect(r.from.getTime()).toBeLessThanOrEqual(achat); // dans la fenêtre « today »
    expect(r.to.getTime()).toBeGreaterThan(achat);
    expect(r.from.toISOString()).toBe('2026-05-05T23:00:00.000Z');
  });

  it('7d → 7 jours glissants', () => {
    const r = resolveRange({ ...DEFAULT_FILTERS, period: '7d' }, now);
    expect(r.to.getTime() - r.from.getTime()).toBe(7 * 86_400_000);
  });

  it('30d → 30 jours glissants', () => {
    const r = resolveRange({ ...DEFAULT_FILTERS, period: '30d' }, now);
    expect(r.to.getTime() - r.from.getTime()).toBe(30 * 86_400_000);
  });

  it('comparisonFrom = même durée juste avant', () => {
    const r = resolveRange({ ...DEFAULT_FILTERS, period: '7d' }, now);
    expect(r.comparisonTo.getTime()).toBe(r.from.getTime());
    const span = r.to.getTime() - r.from.getTime();
    expect(r.from.getTime() - r.comparisonFrom.getTime()).toBe(span);
  });

  it('custom range respecte from/to', () => {
    const r = resolveRange(
      { period: 'custom', device: 'mobile', traffic: 'all', from: '2026-04-01', to: '2026-04-15' },
      now,
    );
    expect(r.from.toISOString().startsWith('2026-04-01')).toBe(true);
    expect(r.to.toISOString().startsWith('2026-04-15')).toBe(true);
  });
});

describe('localStorage helpers', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('write puis read = même valeur', () => {
    const filters = { period: '7d' as const, device: 'desktop' as const, traffic: 'google' as const };
    writeStoredFilters(filters, 1_700_000_000_000);
    expect(readStoredFilters(1_700_000_000_000)).toEqual(filters);
  });

  it('lecture vide → null', () => {
    expect(readStoredFilters()).toBeNull();
  });

  it('TTL 30 jours expiré → null', () => {
    writeStoredFilters({ period: '7d', device: 'mobile', traffic: 'all' }, 1_700_000_000_000);
    const expired = 1_700_000_000_000 + 31 * 86_400_000;
    expect(readStoredFilters(expired)).toBeNull();
  });

  it('payload corrompu → null', () => {
    window.localStorage.setItem(FILTERS_STORAGE_KEY, '{not json');
    expect(readStoredFilters()).toBeNull();
    window.localStorage.setItem(FILTERS_STORAGE_KEY, '{}');
    expect(readStoredFilters()).toBeNull();
  });

  it('payload validé schéma → null si invalid', () => {
    window.localStorage.setItem(
      FILTERS_STORAGE_KEY,
      JSON.stringify({ filters: { period: 'invalid' }, savedAt: Date.now() }),
    );
    expect(readStoredFilters()).toBeNull();
  });
});
