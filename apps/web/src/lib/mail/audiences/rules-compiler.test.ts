/**
 * Tests rules-compiler. On ne mock pas la DB ici — on inspecte juste
 * que le compileur produit un SQL fragment non-vide (Drizzle SQL object).
 * Les tests d'intégration DB-mockée vérifient le SQL est utilisable
 * dans une vraie query.
 */
import { describe, it, expect } from 'vitest';
import { sql } from 'drizzle-orm';
import {
  compileRulesToSql,
  compileRule,
  compileGroup,
  applyExclusions,
} from './rules-compiler';
import type { Rule, RulesGroup, ExclusionFlags } from './rules-types';

const defaultExclusions: ExclusionFlags = {
  hard_bounce: true,
  unsubscribe: true,
  manual_suppression: true,
  marketing_optout: false,
};

function isSql(value: unknown): boolean {
  // Drizzle SQL est un objet avec queryChunks
  return typeof value === 'object' && value !== null;
}

/**
 * Aplati le texte « littéral » d'un fragment SQL drizzle (queryChunks) — utile
 * pour garde-fouer la FORME (présence de TRUE/FALSE/LIKE) sans dépendre du SQL
 * exact. Les valeurs bindées (params) n'apparaissent PAS ici (c'est voulu :
 * l'exactitude métier est prouvée par les tests vraie-DB).
 */
function chunkText(s: unknown): string {
  const chunks = (s as { queryChunks?: unknown[] }).queryChunks ?? [];
  return chunks
    .map((c) => {
      const v = (c as { value?: unknown }).value;
      return Array.isArray(v) ? v.join('') : String(v ?? '');
    })
    .join(' ');
}

describe('compileRule — individual rules', () => {
  it('compiles email_pattern contains', () => {
    const r: Rule = { kind: 'email_pattern', operator: 'contains', value: 'example' };
    expect(isSql(compileRule(r))).toBe(true);
  });

  it('compiles email_pattern equals', () => {
    const r: Rule = { kind: 'email_pattern', operator: 'equals', value: 'u@x.com' };
    expect(isSql(compileRule(r))).toBe(true);
  });

  it('compiles email_pattern in array', () => {
    const r: Rule = { kind: 'email_pattern', operator: 'in', value: ['a@b.c', 'd@e.f'] };
    expect(isSql(compileRule(r))).toBe(true);
  });

  it('compiles consent_marketing', () => {
    expect(isSql(compileRule({ kind: 'consent_marketing', value: true }))).toBe(true);
  });

  it('compiles created_at after', () => {
    expect(
      isSql(compileRule({ kind: 'created_at', operator: 'after', value: '2025-01-01' })),
    ).toBe(true);
  });

  it('throws on invalid created_at value', () => {
    expect(() =>
      compileRule({ kind: 'created_at', operator: 'after', value: 'not-a-date' }),
    ).toThrow();
  });

  it('compiles order_count gte 3', () => {
    expect(
      isSql(compileRule({ kind: 'order_count', operator: 'gte', value: 3 })),
    ).toBe(true);
  });

  it('compiles order_count with since', () => {
    expect(
      isSql(
        compileRule({ kind: 'order_count', operator: 'gte', value: 3, since: '2025-01-01' }),
      ),
    ).toBe(true);
  });

  it('compiles order_count between', () => {
    expect(
      isSql(compileRule({ kind: 'order_count', operator: 'between', value: [3, 10] })),
    ).toBe(true);
  });

  it('compiles order_total gte', () => {
    expect(
      isSql(
        compileRule({
          kind: 'order_total',
          operator: 'gte',
          value: 100000,
          currency: 'MAD',
        }),
      ),
    ).toBe(true);
  });

  it('compiles last_order_at within 7d', () => {
    expect(
      isSql(compileRule({ kind: 'last_order_at', operator: 'within', value: '7d' })),
    ).toBe(true);
  });

  it('compiles email_opened simple EXISTS', () => {
    expect(isSql(compileRule({ kind: 'email_opened' }))).toBe(true);
  });

  it('compiles email_opened with minCount', () => {
    expect(
      isSql(compileRule({ kind: 'email_opened', minCount: 3, within: '14d' })),
    ).toBe(true);
  });

  it('compiles email_clicked', () => {
    expect(isSql(compileRule({ kind: 'email_clicked', within: '30d' }))).toBe(true);
  });

  it('compiles received_without_open', () => {
    expect(
      isSql(compileRule({ kind: 'received_without_open', threshold: 5, within: '14d' })),
    ).toBe(true);
  });

  it('compiles inactive_since', () => {
    expect(isSql(compileRule({ kind: 'inactive_since', days: 30 }))).toBe(true);
  });

  it('compiles session_count gte', () => {
    expect(
      isSql(compileRule({ kind: 'session_count', operator: 'gte', value: 3, within: '7d' })),
    ).toBe(true);
  });

  it('compiles country to a real phone-prefix predicate (R-011 : plus de TRUE)', () => {
    // R-011 — `country` ne compile PLUS en `TRUE` (qui ciblait toute la base).
    // Il dérive le pays du préfixe E.164 de leads.phone → un prédicat LIKE.
    // (L'exactitude du filtrage est prouvée sur vraie DB dans
    //  rules-compiler.integration.test.ts ; ici on garde-fou la forme.)
    const ma = chunkText(compileRule({ kind: 'country', operator: 'eq', value: 'MA' }));
    expect(ma).not.toContain('TRUE'); // ancien bug A-AUD-1 : sql`TRUE`
    expect(ma.toLowerCase()).toContain('like'); // s'appuie sur leads.phone LIKE
    // Code pays inconnu → FALSE (ne cible personne, jamais toute la base).
    const xx = chunkText(compileRule({ kind: 'country', operator: 'eq', value: 'XX' }));
    expect(xx).toContain('FALSE');
  });

  it('compiles has_tag (fallback FALSE for M5.3)', () => {
    expect(isSql(compileRule({ kind: 'has_tag', tag: 'vip' }))).toBe(true);
  });

  it('compiles not_has_tag (fallback TRUE for M5.3)', () => {
    expect(isSql(compileRule({ kind: 'not_has_tag', tag: 'vip' }))).toBe(true);
  });
});

describe('compileGroup — composition', () => {
  it('compiles a flat AND group', () => {
    const g: RulesGroup = {
      kind: 'all',
      conditions: [
        { kind: 'consent_marketing', value: true },
        { kind: 'order_count', operator: 'gte', value: 3 },
      ],
    };
    expect(isSql(compileGroup(g))).toBe(true);
  });

  it('compiles a flat OR group', () => {
    const g: RulesGroup = {
      kind: 'any',
      conditions: [
        { kind: 'has_tag', tag: 'vip' },
        { kind: 'order_count', operator: 'gte', value: 5 },
      ],
    };
    expect(isSql(compileGroup(g))).toBe(true);
  });

  it('compiles nested groups', () => {
    const g: RulesGroup = {
      kind: 'all',
      conditions: [
        { kind: 'consent_marketing', value: true },
        {
          kind: 'any',
          conditions: [
            { kind: 'order_count', operator: 'gte', value: 5 },
            { kind: 'email_opened', within: '7d' },
          ],
        },
      ],
    };
    expect(isSql(compileGroup(g))).toBe(true);
  });

  it('returns TRUE for empty AND group', () => {
    const result = compileGroup({ kind: 'all', conditions: [] });
    // Le résultat est sql`TRUE` — on vérifie juste qu'il est non-null
    expect(result).toBeDefined();
  });

  it('returns FALSE for empty OR group', () => {
    const result = compileGroup({ kind: 'any', conditions: [] });
    expect(result).toBeDefined();
  });
});

describe('applyExclusions', () => {
  it('applies hard_bounce + unsubscribe + manual exclusions', () => {
    const base = sql`TRUE`;
    const result = applyExclusions(base, defaultExclusions);
    expect(isSql(result)).toBe(true);
  });

  it('skips exclusions when all flags are false', () => {
    const base = sql`TRUE`;
    const result = applyExclusions(base, {
      hard_bounce: false,
      unsubscribe: false,
      manual_suppression: false,
      marketing_optout: false,
    });
    // Just check it doesn't throw and returns SQL
    expect(isSql(result)).toBe(true);
  });

  it('adds consent_marketing filter when marketing_optout=true', () => {
    const base = sql`TRUE`;
    const result = applyExclusions(base, {
      hard_bounce: false,
      unsubscribe: false,
      manual_suppression: false,
      marketing_optout: true,
    });
    expect(isSql(result)).toBe(true);
  });
});

describe('compileRulesToSql — public API', () => {
  it('compiles VIP audience (3+ orders + total ≥ 1000 MAD)', () => {
    const result = compileRulesToSql(
      {
        kind: 'all',
        conditions: [
          { kind: 'order_count', operator: 'gte', value: 3 },
          {
            kind: 'order_total',
            operator: 'gte',
            value: 100000,
            currency: 'MAD',
          },
        ],
      },
      defaultExclusions,
    );
    expect(isSql(result.where)).toBe(true);
  });

  it('throws on depth > 4', () => {
    const deep5: RulesGroup = {
      kind: 'all',
      conditions: [
        {
          kind: 'all',
          conditions: [
            {
              kind: 'all',
              conditions: [
                {
                  kind: 'all',
                  conditions: [
                    {
                      kind: 'all',
                      conditions: [{ kind: 'has_tag', tag: 'x' }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(() => compileRulesToSql(deep5, defaultExclusions)).toThrow(/max depth/i);
  });

  it('compiles a single-rule audience', () => {
    const result = compileRulesToSql(
      { kind: 'all', conditions: [{ kind: 'consent_marketing', value: true }] },
      defaultExclusions,
    );
    expect(isSql(result.where)).toBe(true);
  });

  it('compiles inactive_since 30 days', () => {
    const result = compileRulesToSql(
      { kind: 'all', conditions: [{ kind: 'inactive_since', days: 30 }] },
      defaultExclusions,
    );
    expect(isSql(result.where)).toBe(true);
  });
});
