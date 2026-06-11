/** Tests calcul incrémentalité — CPN-12 (pur). */
import { describe, expect, it } from 'vitest';
import { computeCouponStats, type PhaseBucketCount } from './stats';

const counts = (o: Partial<Record<string, number>>): PhaseBucketCount[] =>
  Object.entries(o).map(([k, count]) => {
    const [phase, bucket] = k.split(':');
    return { phase, bucket, count: count ?? 0 } as PhaseBucketCount;
  });

describe('CPN-12 computeCouponStats', () => {
  it('U001 uplift absolu et relatif corrects', () => {
    const s = computeCouponStats(
      counts({
        'exposed:treatment': 1000,
        'exposed:holdout': 1000,
        'converted:treatment': 120,
        'converted:holdout': 100,
      }),
    );
    expect(s.conversionRate.treatment).toBeCloseTo(0.12);
    expect(s.conversionRate.holdout).toBeCloseTo(0.1);
    expect(s.upliftAbsolute).toBeCloseTo(0.02);
    expect(s.upliftRelative).toBeCloseTo(0.2);
    expect(s.noControl).toBe(false);
  });

  it('U002 holdout=0 exposé → noControl, uplift null', () => {
    const s = computeCouponStats(counts({ 'exposed:treatment': 500, 'converted:treatment': 60 }));
    expect(s.noControl).toBe(true);
    expect(s.upliftAbsolute).toBeNull();
  });

  it('U003 0 donnée → pas de NaN, taux null', () => {
    const s = computeCouponStats([]);
    expect(s.conversionRate.treatment).toBeNull();
    expect(s.upliftAbsolute).toBeNull();
    expect(Number.isNaN(s.upliftRelative as number)).toBe(false);
  });

  it('U004 petit échantillon → lowSample true', () => {
    const s = computeCouponStats(counts({ 'exposed:treatment': 10, 'exposed:holdout': 5 }));
    expect(s.lowSample).toBe(true);
  });

  it('U005 uplift négatif non masqué', () => {
    const s = computeCouponStats(
      counts({
        'exposed:treatment': 1000,
        'exposed:holdout': 1000,
        'converted:treatment': 80,
        'converted:holdout': 100,
      }),
    );
    expect(s.upliftAbsolute).toBeLessThan(0);
  });
});
