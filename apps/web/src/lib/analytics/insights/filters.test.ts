import { describe, expect, it } from 'vitest';
import { resolveInsightsRange, toIsoDate, listDays, addDays, startOfUtcDay } from './filters';
import { DEFAULT_INSIGHTS_FILTERS, insightsFiltersSchema } from './contracts';

const NOW = new Date('2026-05-08T10:30:00.000Z');

describe('resolveInsightsRange', () => {
  it('today renvoie [today00:00, tomorrow00:00)', () => {
    const r = resolveInsightsRange({ ...DEFAULT_INSIGHTS_FILTERS, window: 'today' }, NOW);
    expect(toIsoDate(r.from)).toBe('2026-05-08');
    expect(toIsoDate(r.to)).toBe('2026-05-09');
  });

  it('yesterday renvoie [yesterday00:00, today00:00)', () => {
    const r = resolveInsightsRange({ ...DEFAULT_INSIGHTS_FILTERS, window: 'yesterday' }, NOW);
    expect(toIsoDate(r.from)).toBe('2026-05-07');
    expect(toIsoDate(r.to)).toBe('2026-05-08');
  });

  it('7d renvoie 7 jours glissants', () => {
    const r = resolveInsightsRange({ ...DEFAULT_INSIGHTS_FILTERS, window: '7d' }, NOW);
    expect(toIsoDate(r.from)).toBe('2026-05-02');
    expect(toIsoDate(r.to)).toBe('2026-05-09');
  });

  it('30d renvoie 30 jours glissants', () => {
    const r = resolveInsightsRange({ ...DEFAULT_INSIGHTS_FILTERS, window: '30d' }, NOW);
    expect(toIsoDate(r.from)).toBe('2026-04-09');
    expect(toIsoDate(r.to)).toBe('2026-05-09');
  });

  it('90d renvoie 90 jours', () => {
    const r = resolveInsightsRange({ ...DEFAULT_INSIGHTS_FILTERS, window: '90d' }, NOW);
    expect(toIsoDate(r.from)).toBe('2026-02-08');
  });

  it('all borne à 365 jours', () => {
    const r = resolveInsightsRange({ ...DEFAULT_INSIGHTS_FILTERS, window: 'all' }, NOW);
    const days = (r.to.getTime() - r.from.getTime()) / 86_400_000;
    expect(days).toBe(365);
  });

  it('custom range valide', () => {
    const r = resolveInsightsRange(
      {
        ...DEFAULT_INSIGHTS_FILTERS,
        window: 'custom',
        customFrom: '2026-01-01',
        customTo: '2026-01-31',
      },
      NOW,
    );
    expect(toIsoDate(r.from)).toBe('2026-01-01');
    expect(toIsoDate(r.to)).toBe('2026-02-01');
  });

  it('custom sans bornes throw', () => {
    expect(() =>
      resolveInsightsRange({ ...DEFAULT_INSIGHTS_FILTERS, window: 'custom' }, NOW),
    ).toThrow(/customFrom/);
  });

  it('custom inversé throw', () => {
    expect(() =>
      resolveInsightsRange(
        {
          ...DEFAULT_INSIGHTS_FILTERS,
          window: 'custom',
          customFrom: '2026-12-31',
          customTo: '2026-01-01',
        },
        NOW,
      ),
    ).toThrow(/customFrom doit précéder/);
  });

  it('custom > 365j throw', () => {
    expect(() =>
      resolveInsightsRange(
        {
          ...DEFAULT_INSIGHTS_FILTERS,
          window: 'custom',
          customFrom: '2024-01-01',
          customTo: '2026-12-31',
        },
        NOW,
      ),
    ).toThrow(/365/);
  });

  it('comparison périodes ont la même durée', () => {
    const r = resolveInsightsRange({ ...DEFAULT_INSIGHTS_FILTERS, window: '7d' }, NOW);
    const span = r.to.getTime() - r.from.getTime();
    const compSpan = r.comparisonTo.getTime() - r.comparisonFrom.getTime();
    expect(span).toBe(compSpan);
  });

  it('comparison se termine où la période actuelle commence', () => {
    const r = resolveInsightsRange({ ...DEFAULT_INSIGHTS_FILTERS, window: '7d' }, NOW);
    expect(r.comparisonTo.getTime()).toBe(r.from.getTime());
  });
});

describe('helpers', () => {
  it('startOfUtcDay coupe les heures', () => {
    const d = startOfUtcDay(new Date('2026-05-08T15:30:00.000Z'));
    expect(d.toISOString()).toBe('2026-05-08T00:00:00.000Z');
  });

  it('addDays gère les transitions de mois', () => {
    expect(toIsoDate(addDays(new Date('2026-01-31T00:00:00Z'), 1))).toBe('2026-02-01');
  });

  it('listDays énumère les jours inclus', () => {
    const days = listDays(new Date('2026-05-01T00:00:00Z'), new Date('2026-05-04T00:00:00Z'));
    expect(days).toEqual(['2026-05-01', '2026-05-02', '2026-05-03']);
  });
});

describe('insightsFiltersSchema', () => {
  it('parse valide les defaults', () => {
    const r = insightsFiltersSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.window).toBe('7d');
      expect(r.data.env).toBe('all');
    }
  });

  it('refuse window invalide', () => {
    const r = insightsFiltersSchema.safeParse({ window: 'forever' });
    expect(r.success).toBe(false);
  });

  it('refuse custom sans bornes', () => {
    const r = insightsFiltersSchema.safeParse({ window: 'custom' });
    expect(r.success).toBe(false);
  });

  it('refuse custom > 365j', () => {
    const r = insightsFiltersSchema.safeParse({
      window: 'custom',
      customFrom: '2024-01-01',
      customTo: '2026-12-31',
    });
    expect(r.success).toBe(false);
  });

  it('refuse customFrom > customTo', () => {
    const r = insightsFiltersSchema.safeParse({
      window: 'custom',
      customFrom: '2026-12-01',
      customTo: '2026-01-01',
    });
    expect(r.success).toBe(false);
  });

  it('accepte custom range valide', () => {
    const r = insightsFiltersSchema.safeParse({
      window: 'custom',
      customFrom: '2026-01-01',
      customTo: '2026-03-31',
    });
    expect(r.success).toBe(true);
  });
});

describe('resolveInsightsRange — edge cases dates', () => {
  it('transition DST (mars 2026)', () => {
    const dstNow = new Date('2026-03-30T10:00:00.000Z');
    const r = resolveInsightsRange({ ...DEFAULT_INSIGHTS_FILTERS, window: '7d' }, dstNow);
    const span = (r.to.getTime() - r.from.getTime()) / 86_400_000;
    expect(span).toBe(7);
  });

  it('année bissextile (29 février 2024)', () => {
    const leap = new Date('2024-02-29T10:00:00.000Z');
    const r = resolveInsightsRange({ ...DEFAULT_INSIGHTS_FILTERS, window: 'today' }, leap);
    expect(toIsoDate(r.from)).toBe('2024-02-29');
  });

  it('frontière fin d\'année', () => {
    const newYearEve = new Date('2025-12-31T23:59:59.999Z');
    const r = resolveInsightsRange({ ...DEFAULT_INSIGHTS_FILTERS, window: 'today' }, newYearEve);
    expect(toIsoDate(r.from)).toBe('2025-12-31');
    expect(toIsoDate(r.to)).toBe('2026-01-01');
  });

  it('custom range exact 365 jours', () => {
    const r = resolveInsightsRange(
      {
        ...DEFAULT_INSIGHTS_FILTERS,
        window: 'custom',
        customFrom: '2026-01-01',
        customTo: '2026-12-31',
      },
      new Date(),
    );
    const span = (r.to.getTime() - r.from.getTime()) / 86_400_000;
    expect(span).toBe(365);
  });

  it('custom range 366 jours rejeté (> 365)', () => {
    expect(() =>
      resolveInsightsRange(
        {
          ...DEFAULT_INSIGHTS_FILTERS,
          window: 'custom',
          customFrom: '2024-01-01',
          customTo: '2025-01-01',
        },
        new Date(),
      ),
    ).toThrow();
  });

  it('comparison ne déborde pas en arrière du passé lointain', () => {
    const r = resolveInsightsRange({ ...DEFAULT_INSIGHTS_FILTERS, window: 'all' }, NOW);
    expect(r.comparisonFrom.getTime()).toBeLessThan(r.from.getTime());
    expect(r.comparisonTo.getTime()).toBe(r.from.getTime());
  });

  it('iterateDays énumère le bon nombre de jours pour 30d', () => {
    const r = resolveInsightsRange({ ...DEFAULT_INSIGHTS_FILTERS, window: '30d' }, NOW);
    const days = listDays(r.from, r.to);
    expect(days.length).toBe(30);
    expect(days[0]).toBe('2026-04-09');
    expect(days[days.length - 1]).toBe('2026-05-08');
  });

  it('listDays sur range identique = []', () => {
    const d = new Date('2026-05-08T00:00:00Z');
    expect(listDays(d, d)).toEqual([]);
  });
});

describe('insightsFiltersSchema — property-style', () => {
  it('100 random window values valides parsent', () => {
    const windows = ['today', 'yesterday', '7d', '30d', '90d', 'all'] as const;
    for (let i = 0; i < 100; i++) {
      const w = windows[i % windows.length];
      const r = insightsFiltersSchema.safeParse({ window: w });
      expect(r.success).toBe(true);
    }
  });

  it('locale > 20 chars rejeté', () => {
    const r = insightsFiltersSchema.safeParse({
      locale: 'fr-MA-too-long-locale-string-here',
    });
    expect(r.success).toBe(false);
  });

  it('trafficSource > 80 chars rejeté', () => {
    const r = insightsFiltersSchema.safeParse({
      trafficSource: 'a'.repeat(81),
    });
    expect(r.success).toBe(false);
  });
});
