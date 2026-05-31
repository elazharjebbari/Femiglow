import { describe, expect, it } from 'vitest';
import {
  formatBucket,
  formatCurrency,
  formatDelta,
  formatDuration,
  formatNumber,
  formatPercent,
  suggestGranularity,
} from './format';

describe('formatNumber', () => {
  it('formate avec espace insécable', () => {
    expect(formatNumber(12340)).toBe('12\u202f340');
    expect(formatNumber(1_234_567)).toBe('1\u202f234\u202f567');
  });

  it('zéro reste "0"', () => {
    expect(formatNumber(0)).toBe('0');
  });

  it('null/undefined/NaN → "—"', () => {
    expect(formatNumber(null)).toBe('—');
    expect(formatNumber(undefined)).toBe('—');
    expect(formatNumber(Number.NaN)).toBe('—');
  });
});

describe('formatPercent', () => {
  it('arrondit à 1 décimale par défaut', () => {
    expect(formatPercent(0.12345)).toBe('12,3\u202f%');
  });

  it('zéro = "0 %"', () => {
    expect(formatPercent(0)).toBe('0\u202f%');
  });

  it('null → "—"', () => {
    expect(formatPercent(null)).toBe('—');
  });

  it('configurable fractionDigits', () => {
    expect(formatPercent(0.12345, 2)).toBe('12,35\u202f%');
    expect(formatPercent(0.12345, 0)).toBe('12\u202f%');
  });
});

describe('formatDuration', () => {
  it.each([
    [0, '0s'],
    [45, '45s'],
    [60, '1m 0s'],
    [125, '2m 5s'],
    [3600, '1h 0m'],
    [3725, '1h 2m'],
    [7200, '2h 0m'],
  ])('%d s → %s', (s, expected) => {
    expect(formatDuration(s)).toBe(expected);
  });

  it('valeurs négatives → 0s', () => {
    expect(formatDuration(-10)).toBe('0s');
  });

  it('null → "—"', () => {
    expect(formatDuration(null)).toBe('—');
  });
});

describe('formatCurrency', () => {
  it('MAD : pas de décimales', () => {
    expect(formatCurrency(32000, 'MAD')).toMatch(/320[\s\u202f\u00a0]?MAD/);
  });

  it('EUR : 2 décimales', () => {
    expect(formatCurrency(1990, 'EUR')).toMatch(/19,90[\s\u202f\u00a0]?€/);
  });

  it('null → "—"', () => {
    expect(formatCurrency(null)).toBe('—');
  });
});

describe('formatDelta', () => {
  it('positif → flèche montante', () => {
    const r = formatDelta(0.124);
    expect(r.direction).toBe('up');
    expect(r.label).toContain('↑');
    expect(r.label).toContain('12,4');
  });

  it('négatif → flèche descendante', () => {
    const r = formatDelta(-0.05);
    expect(r.direction).toBe('down');
    expect(r.label).toContain('↓');
  });

  it('quasi zéro → flat', () => {
    const r = formatDelta(0);
    expect(r.direction).toBe('flat');
    expect(r.label).toContain('→');
  });

  it('null → flat avec em-dash', () => {
    expect(formatDelta(null)).toEqual({ label: '—', direction: 'flat' });
  });
});

describe('formatBucket', () => {
  const d = new Date('2026-05-06T14:30:00Z');

  it('hour granularity', () => {
    const out = formatBucket(d, 'hour');
    expect(out).toMatch(/\d{1,2}h\d{2}/);
  });

  it('day granularity', () => {
    const out = formatBucket(d, 'day');
    expect(out).toMatch(/06[\s\u202f]?mai/i);
  });

  it('week granularity', () => {
    const out = formatBucket(d, 'week');
    expect(out).toMatch(/^S\d{1,2}$/);
  });

  it('F-FMT-01 — heure ancrée sur le fuseau Maroc (pas le TZ du client)', () => {
    // 23:30 UTC = 00:30 à Casablanca (+01).
    expect(formatBucket('2026-05-06T23:30:00Z', 'hour')).toBe('00h30');
  });

  it('F-FMT-02 — semaine ISO correcte aux bords d’année', () => {
    // midi UTC pour rester sur la même date civile quel que soit le TZ du process.
    expect(formatBucket('2026-01-01T12:00:00Z', 'week')).toBe('S1'); // jeudi → S1 2026
    expect(formatBucket('2025-12-29T12:00:00Z', 'week')).toBe('S1'); // lundi même semaine ISO
    expect(formatBucket('2025-12-28T12:00:00Z', 'week')).toBe('S52'); // dimanche → S52 2025
  });

  it('input invalid → ""', () => {
    expect(formatBucket('not a date', 'day')).toBe('');
  });
});

describe('suggestGranularity', () => {
  it('< 2 jours → hour', () => {
    expect(suggestGranularity(86_400_000)).toBe('hour');
    expect(suggestGranularity(2 * 86_400_000)).toBe('hour');
  });

  it('2–60 jours → day', () => {
    expect(suggestGranularity(7 * 86_400_000)).toBe('day');
    expect(suggestGranularity(30 * 86_400_000)).toBe('day');
  });

  it('> 60 jours → week', () => {
    expect(suggestGranularity(90 * 86_400_000)).toBe('week');
    expect(suggestGranularity(365 * 86_400_000)).toBe('week');
  });
});
