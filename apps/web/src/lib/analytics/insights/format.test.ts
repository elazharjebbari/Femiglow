import { describe, expect, it } from 'vitest';
import {
  formatNumber,
  formatPercent,
  formatVariation,
  formatDuration,
  formatDateLong,
  formatDateShort,
  formatRelativeTime,
  formatCurrency,
  formatDecimal,
} from './format';

const NBSP = ' ';

describe('formatNumber', () => {
  it('formate avec séparateurs français', () => {
    expect(formatNumber(12_437)).toBe(`12${NBSP}437`);
  });
  it('renvoie — pour null', () => {
    expect(formatNumber(null)).toBe('—');
    expect(formatNumber(undefined)).toBe('—');
  });
  it('renvoie — pour NaN', () => {
    expect(formatNumber(Number.NaN)).toBe('—');
  });
  it('zéro', () => {
    expect(formatNumber(0)).toBe('0');
  });
});

describe('formatDecimal', () => {
  it('1 décimale virgule', () => {
    expect(formatDecimal(3.87)).toBe('3,9');
  });
});

describe('formatPercent', () => {
  it('formate avec espace insécable', () => {
    expect(formatPercent(0.142)).toBe(`14,2${NBSP}%`);
  });
  it('digits=0', () => {
    expect(formatPercent(0.5, 0)).toBe(`50${NBSP}%`);
  });
  it('null', () => {
    expect(formatPercent(null)).toBe('—');
  });
});

describe('formatVariation', () => {
  it('positif avec +', () => {
    expect(formatVariation(0.142)).toBe(`+14,2${NBSP}%`);
  });
  it('négatif sans +', () => {
    expect(formatVariation(-0.05)).toBe(`-5${NBSP}%`);
  });
  it('zéro avec ±', () => {
    expect(formatVariation(0)).toBe(`±0${NBSP}%`);
  });
  it('null —', () => {
    expect(formatVariation(null)).toBe('—');
  });
});

describe('formatDuration', () => {
  it('< 60s', () => {
    expect(formatDuration(42)).toBe(`42${NBSP}s`);
  });
  it('1 minute pile', () => {
    expect(formatDuration(60)).toBe(`1${NBSP}m`);
  });
  it('m + s', () => {
    expect(formatDuration(272)).toBe(`4${NBSP}m${NBSP}32${NBSP}s`);
  });
  it('1h pile', () => {
    expect(formatDuration(3600)).toBe(`1${NBSP}h`);
  });
  it('h + m', () => {
    expect(formatDuration(5040)).toBe(`1${NBSP}h${NBSP}24${NBSP}m`);
  });
  it('null —', () => {
    expect(formatDuration(null)).toBe('—');
  });
  it('zéro', () => {
    expect(formatDuration(0)).toBe(`0${NBSP}s`);
  });
});

describe('formatCurrency', () => {
  it('cents → MAD', () => {
    expect(formatCurrency(124_320_00)).toBe(`124${NBSP}320${NBSP}MAD`);
  });
});

describe('formatDateLong', () => {
  it('2026-05-08 → 08 mai 2026', () => {
    expect(formatDateLong('2026-05-08T00:00:00.000Z')).toBe('08 mai 2026');
  });
});

describe('formatDateShort', () => {
  it('2026-05-08 → 08/05', () => {
    expect(formatDateShort('2026-05-08T00:00:00.000Z')).toBe('08/05');
  });
});

describe('formatRelativeTime', () => {
  const now = new Date('2026-05-08T12:00:00.000Z');
  it("à l'instant", () => {
    expect(formatRelativeTime(new Date('2026-05-08T11:59:58.000Z'), now)).toBe("à l'instant");
  });
  it('il y a 7 min', () => {
    expect(formatRelativeTime(new Date('2026-05-08T11:53:00.000Z'), now)).toBe(
      `il y a 7${NBSP}min`,
    );
  });
  it('il y a 2 h', () => {
    expect(formatRelativeTime(new Date('2026-05-08T10:00:00.000Z'), now)).toBe(`il y a 2${NBSP}h`);
  });
  it('il y a 3 j', () => {
    expect(formatRelativeTime(new Date('2026-05-05T12:00:00.000Z'), now)).toBe(`il y a 3${NBSP}j`);
  });
  it('null', () => {
    expect(formatRelativeTime(null)).toBe('—');
  });
  it('date invalide', () => {
    expect(formatRelativeTime(new Date('invalid'))).toBe('—');
  });
  it('string ISO acceptée', () => {
    expect(formatRelativeTime('2026-05-08T11:59:58.000Z', now)).toBe("à l'instant");
  });
});

describe('format — edge cases volumes', () => {
  it("1 million d'events", () => {
    expect(formatNumber(1_000_000)).toBe(`1${NBSP}000${NBSP}000`);
  });
  it('Number.MAX_SAFE_INTEGER', () => {
    const r = formatNumber(Number.MAX_SAFE_INTEGER);
    expect(r).not.toBe('—');
    expect(r.length).toBeGreaterThan(10);
  });
  it('nombres négatifs', () => {
    expect(formatNumber(-42)).toContain('42');
  });
  it('formatPercent > 100%', () => {
    const r = formatPercent(2.5);
    expect(r).toContain('250');
  });
  it('formatPercent < 0%', () => {
    const r = formatPercent(-0.05);
    expect(r).toContain('-5');
  });
  it('formatVariation extrême +500%', () => {
    expect(formatVariation(5)).toBe(`+500${NBSP}%`);
  });
  it('formatDuration 24h', () => {
    expect(formatDuration(86_400)).toBe(`24${NBSP}h`);
  });
  it('formatDuration durée négative ramenée à 0', () => {
    expect(formatDuration(-100)).toBe(`0${NBSP}s`);
  });
  it('formatCurrency 0 cents', () => {
    expect(formatCurrency(0)).toContain('0');
  });
  it('formatCurrency devise alternative', () => {
    expect(formatCurrency(1000_00, 'EUR')).toContain('EUR');
  });
});

describe('format — property-style (100 valeurs)', () => {
  it('formatNumber est total sur entiers > 0', () => {
    for (let i = 0; i < 100; i++) {
      const v = Math.floor(Math.random() * 1_000_000);
      const s = formatNumber(v);
      expect(s).not.toBe('—');
      // Doit contenir au moins un chiffre
      expect(/\d/.test(s)).toBe(true);
    }
  });

  it('formatPercent ∈ [0,1] → fini par "%"', () => {
    for (let i = 0; i < 100; i++) {
      const v = Math.random();
      expect(formatPercent(v)).toMatch(/%$/);
    }
  });

  it('formatDuration produit un format reconnu', () => {
    for (let i = 0; i < 50; i++) {
      const sec = Math.floor(Math.random() * 100_000);
      const r = formatDuration(sec);
      expect(r).toMatch(/^\d+\xa0[shm]/);
    }
  });
});
