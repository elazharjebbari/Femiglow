/**
 * Tests filters-parser — couverture exhaustive de la grammaire Cmd-K.
 *
 * Cf. docs/emailing/admin-evolution/11-tests/01-jest-unit/filters-parser.test.spec.md
 */
import { describe, it, expect } from 'vitest';
import {
  parseFilters,
  serializeFilters,
  deserializeFilters,
  OUTBOX_STATUSES,
  type ParsedFilter,
} from './filters-parser';

// Référence temporelle fixe pour les tests dépendants des dates relatives.
const NOW = new Date('2026-05-14T22:00:00.000Z');

describe('parseFilters — single tokens', () => {
  describe('status', () => {
    it('parses a single status', () => {
      const r = parseFilters('status:failed', NOW);
      expect(r.errors).toEqual([]);
      expect(r.filters).toEqual([{ key: 'status', value: ['failed'], raw: 'status:failed' }]);
    });

    it('parses multiple statuses (comma-separated)', () => {
      const r = parseFilters('status:failed,bounced_soft', NOW);
      expect(r.filters).toEqual([
        { key: 'status', value: ['failed', 'bounced_soft'], raw: 'status:failed,bounced_soft' },
      ]);
    });

    it('rejects an unknown status', () => {
      const r = parseFilters('status:foobar', NOW);
      expect(r.filters).toHaveLength(0);
      expect(r.errors).toHaveLength(1);
      expect(r.errors[0]!.message).toMatch(/inconnu/i);
    });

    it('handles case-insensitive status', () => {
      const r = parseFilters('status:FAILED', NOW);
      expect(r.filters).toEqual([{ key: 'status', value: ['failed'], raw: 'status:FAILED' }]);
    });

    it('rejects empty status value', () => {
      const r = parseFilters('status:', NOW);
      expect(r.errors).toHaveLength(1);
    });

    it('covers all defined OUTBOX_STATUSES', () => {
      for (const s of OUTBOX_STATUSES) {
        const r = parseFilters(`status:${s}`, NOW);
        expect(r.errors, `${s} should be valid`).toEqual([]);
        expect(r.filters).toHaveLength(1);
      }
    });
  });

  describe('to / template / source', () => {
    it('parses simple to:email', () => {
      const r = parseFilters('to:user@x.y', NOW);
      expect(r.filters).toEqual([{ key: 'to', value: 'user@x.y', raw: 'to:user@x.y' }]);
    });

    it('parses to:glob with wildcard', () => {
      const r = parseFilters('to:*@bad.tld', NOW);
      expect(r.filters).toEqual([{ key: 'to', value: '*@bad.tld', raw: 'to:*@bad.tld' }]);
    });

    it('parses quoted value with space', () => {
      const r = parseFilters('to:"a b@c.d"', NOW);
      expect(r.filters).toEqual([{ key: 'to', value: 'a b@c.d', raw: 'to:"a b@c.d"' }]);
    });

    it('parses template:cart-*', () => {
      const r = parseFilters('template:cart-*', NOW);
      expect(r.filters).toEqual([{ key: 'template', value: 'cart-*', raw: 'template:cart-*' }]);
    });

    it('keeps casing on template value', () => {
      const r = parseFilters('template:Welcome-V2', NOW);
      expect(r.filters[0]!.value).toBe('Welcome-V2');
    });

    it('parses source:api.contact', () => {
      const r = parseFilters('source:api.contact', NOW);
      expect(r.filters).toEqual([{ key: 'source', value: 'api.contact', raw: 'source:api.contact' }]);
    });
  });

  describe('after / before', () => {
    it('parses ISO date', () => {
      const r = parseFilters('after:2026-05-01', NOW);
      expect(r.errors).toEqual([]);
      const f = r.filters[0]! as Extract<ParsedFilter, { key: 'after' }>;
      expect(f.key).toBe('after');
      expect(f.value.toISOString().startsWith('2026-05-01')).toBe(true);
    });

    it('parses today keyword', () => {
      const r = parseFilters('after:today', NOW);
      const f = r.filters[0]! as Extract<ParsedFilter, { key: 'after' }>;
      // Midnight UTC of 2026-05-14 — but JS Date uses local TZ. On accepte la
      // bonne année/mois/jour, ne pas faire d'assertion stricte sur l'heure.
      expect(f.value.getUTCFullYear()).toBe(2026);
      expect(f.value.getUTCMonth()).toBe(4); // mai
    });

    it('parses yesterday keyword', () => {
      const r = parseFilters('after:yesterday', NOW);
      const f = r.filters[0]! as Extract<ParsedFilter, { key: 'after' }>;
      // Should be 24h before NOW (or earlier with the floor to 00:00)
      const diff = NOW.getTime() - f.value.getTime();
      expect(diff).toBeGreaterThanOrEqual(0);
      expect(diff).toBeLessThan(2 * 86_400_000);
    });

    it('parses relative -7d offset', () => {
      const r = parseFilters('after:-7d', NOW);
      const f = r.filters[0]! as Extract<ParsedFilter, { key: 'after' }>;
      const expected = new Date(NOW.getTime() - 7 * 86_400_000);
      expect(f.value.toISOString()).toBe(expected.toISOString());
    });

    it('parses -1h offset', () => {
      const r = parseFilters('after:-1h', NOW);
      const f = r.filters[0]! as Extract<ParsedFilter, { key: 'after' }>;
      expect(f.value.toISOString()).toBe(new Date(NOW.getTime() - 3_600_000).toISOString());
    });

    it('rejects invalid date', () => {
      const r = parseFilters('after:notadate', NOW);
      expect(r.errors).toHaveLength(1);
      expect(r.errors[0]!.message).toMatch(/invalide/i);
    });

    it('parses before:DATE same way as after', () => {
      const r = parseFilters('before:-30m', NOW);
      const f = r.filters[0]! as Extract<ParsedFilter, { key: 'before' }>;
      expect(f.value.toISOString()).toBe(new Date(NOW.getTime() - 1_800_000).toISOString());
    });
  });

  describe('attempts', () => {
    it('parses attempts:>3', () => {
      const r = parseFilters('attempts:>3', NOW);
      expect(r.filters).toEqual([{ key: 'attempts', operator: '>', value: 3, raw: 'attempts:>3' }]);
    });

    it('parses attempts:<=2', () => {
      const r = parseFilters('attempts:<=2', NOW);
      expect(r.filters).toEqual([{ key: 'attempts', operator: '<=', value: 2, raw: 'attempts:<=2' }]);
    });

    it('parses attempts:0 (defaults to =)', () => {
      const r = parseFilters('attempts:0', NOW);
      expect(r.filters).toEqual([{ key: 'attempts', operator: '=', value: 0, raw: 'attempts:0' }]);
    });

    it('rejects attempts:abc', () => {
      const r = parseFilters('attempts:abc', NOW);
      expect(r.errors).toHaveLength(1);
    });

    it('rejects negative attempts', () => {
      const r = parseFilters('attempts:-3', NOW);
      expect(r.errors).toHaveLength(1);
    });
  });

  describe('has', () => {
    it('parses has:error', () => {
      const r = parseFilters('has:error', NOW);
      expect(r.filters).toEqual([{ key: 'has', value: 'error', raw: 'has:error' }]);
    });

    it('rejects has:other', () => {
      const r = parseFilters('has:bounce', NOW);
      expect(r.errors).toHaveLength(1);
    });
  });
});

describe('parseFilters — combinations', () => {
  it('combines multiple filters with AND (space)', () => {
    const r = parseFilters('status:failed template:cart-* after:-7d', NOW);
    expect(r.errors).toEqual([]);
    expect(r.filters).toHaveLength(3);
    expect(r.filters.map((f) => f.key)).toEqual(['status', 'template', 'after']);
  });

  it('handles multiple spaces between filters', () => {
    const r = parseFilters('status:failed    template:cart-*', NOW);
    expect(r.filters).toHaveLength(2);
  });

  it('returns errors for some + valid for others', () => {
    const r = parseFilters('status:failed status:unknown to:user@x.y', NOW);
    expect(r.filters).toHaveLength(2); // status valid + to valid
    expect(r.errors).toHaveLength(1);  // status:unknown
  });
});

describe('parseFilters — freetext fallback', () => {
  it('falls back to freetext when no key:value pattern', () => {
    const r = parseFilters('user@example.com', NOW);
    expect(r.filters).toEqual([]);
    expect(r.freetext).toBe('user@example.com');
  });

  it('falls back to freetext for unknown key', () => {
    const r = parseFilters('color:red', NOW);
    expect(r.freetext).toBe('color:red');
    expect(r.filters).toEqual([]);
    expect(r.errors).toEqual([]);
  });

  it('mixes filters + freetext', () => {
    const r = parseFilters('status:failed user@x.y', NOW);
    expect(r.filters).toHaveLength(1);
    expect(r.freetext).toBe('user@x.y');
  });

  it('handles empty input', () => {
    const r = parseFilters('', NOW);
    expect(r.filters).toEqual([]);
    expect(r.freetext).toBeUndefined();
    expect(r.errors).toEqual([]);
  });

  it('handles whitespace-only input', () => {
    const r = parseFilters('   ', NOW);
    expect(r.filters).toEqual([]);
  });
});

describe('parseFilters — escape characters', () => {
  it('respects escaped colon in value', () => {
    const r = parseFilters('template:welcome\\:v2', NOW);
    expect(r.filters[0]!.value).toBe('welcome:v2');
  });

  it('preserves quoted strings with colons', () => {
    const r = parseFilters('to:"user:foo@x.y"', NOW);
    expect(r.filters[0]!.value).toBe('user:foo@x.y');
  });
});

describe('serializeFilters + deserializeFilters', () => {
  it('round-trips a status filter', () => {
    const parsed = parseFilters('status:failed,bounced_soft', NOW);
    const serialized = serializeFilters(parsed.filters);
    expect(serialized.get('status')).toBe('failed,bounced_soft');

    const re = deserializeFilters(serialized, NOW);
    expect(re.filters[0]).toEqual(parsed.filters[0]);
  });

  it('round-trips a date filter', () => {
    const parsed = parseFilters('after:2026-05-01', NOW);
    const serialized = serializeFilters(parsed.filters);
    const re = deserializeFilters(serialized, NOW);
    expect((re.filters[0]! as { value: Date }).value.toISOString()).toBe(
      (parsed.filters[0]! as { value: Date }).value.toISOString(),
    );
  });

  it('round-trips attempts with operator', () => {
    const parsed = parseFilters('attempts:>=3', NOW);
    const serialized = serializeFilters(parsed.filters);
    expect(serialized.get('attempts')).toBe('>=3');
    const re = deserializeFilters(serialized, NOW);
    expect(re.filters[0]).toEqual(parsed.filters[0]);
  });

  it('ignores unknown URL params on deserialize', () => {
    const params = new URLSearchParams({ utm_source: 'foo', status: 'failed' });
    const re = deserializeFilters(params, NOW);
    expect(re.filters).toHaveLength(1);
  });
});

describe('parseFilters — security / robustness', () => {
  it('does not crash on SQL-injection-looking input', () => {
    const r = parseFilters("to:'); DROP TABLE leads; --", NOW);
    // C'est traité comme une string de filter `to:` — sera escapé downstream.
    expect(r.filters).toHaveLength(1);
    expect(r.errors).toEqual([]);
  });

  it('does not crash on very long input', () => {
    const long = 'status:failed '.repeat(500).trim();
    const r = parseFilters(long, NOW);
    expect(r.filters.length).toBeGreaterThan(0);
  });

  it('performance: parse < 5ms for typical input', () => {
    const input = 'status:failed,bounced_soft template:cart-* after:-7d attempts:>3';
    const start = performance.now();
    for (let i = 0; i < 100; i += 1) parseFilters(input, NOW);
    const elapsed = (performance.now() - start) / 100;
    expect(elapsed).toBeLessThan(5);
  });
});
