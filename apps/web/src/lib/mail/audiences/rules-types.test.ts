/**
 * Tests Zod schemas RulesGroup + Rule.
 */
import { describe, it, expect } from 'vitest';
import {
  RuleSchema,
  RulesGroupSchema,
  ExclusionFlagsSchema,
  validateDepth,
  type RulesGroup,
} from './rules-types';

describe('RuleSchema (discriminated union)', () => {
  it('accepts email_pattern contains', () => {
    expect(
      RuleSchema.safeParse({ kind: 'email_pattern', operator: 'contains', value: 'example' }).success,
    ).toBe(true);
  });

  it('accepts order_count gte 3', () => {
    expect(
      RuleSchema.safeParse({ kind: 'order_count', operator: 'gte', value: 3 }).success,
    ).toBe(true);
  });

  it('accepts order_count with since', () => {
    expect(
      RuleSchema.safeParse({
        kind: 'order_count',
        operator: 'gte',
        value: 3,
        since: '2025-01-01',
      }).success,
    ).toBe(true);
  });

  it('accepts order_total with currency MAD', () => {
    expect(
      RuleSchema.safeParse({
        kind: 'order_total',
        operator: 'gte',
        value: 100000,
        currency: 'MAD',
      }).success,
    ).toBe(true);
  });

  it('rejects unknown kind', () => {
    expect(
      RuleSchema.safeParse({ kind: 'foobar', value: 1 }).success,
    ).toBe(false);
  });

  it('rejects negative order_count', () => {
    expect(
      RuleSchema.safeParse({ kind: 'order_count', operator: 'gte', value: -1 }).success,
    ).toBe(false);
  });

  it('accepts has_tag', () => {
    expect(RuleSchema.safeParse({ kind: 'has_tag', tag: 'vip' }).success).toBe(true);
  });

  it('rejects has_tag with empty tag', () => {
    expect(RuleSchema.safeParse({ kind: 'has_tag', tag: '' }).success).toBe(false);
  });

  it('accepts inactive_since with days', () => {
    expect(RuleSchema.safeParse({ kind: 'inactive_since', days: 30 }).success).toBe(true);
  });

  it('rejects inactive_since with negative days', () => {
    expect(RuleSchema.safeParse({ kind: 'inactive_since', days: -1 }).success).toBe(false);
  });

  it('accepts email_opened with templateSlug', () => {
    expect(
      RuleSchema.safeParse({ kind: 'email_opened', templateSlug: 'welcome', within: '7d' }).success,
    ).toBe(true);
  });
});

describe('RulesGroupSchema (recursive)', () => {
  it('accepts a simple AND group', () => {
    const g: RulesGroup = {
      kind: 'all',
      conditions: [
        { kind: 'order_count', operator: 'gte', value: 3 },
        { kind: 'consent_marketing', value: true },
      ],
    };
    expect(RulesGroupSchema.safeParse(g).success).toBe(true);
  });

  it('accepts a simple OR group', () => {
    const g: RulesGroup = {
      kind: 'any',
      conditions: [
        { kind: 'has_tag', tag: 'vip' },
        { kind: 'has_tag', tag: 'super_vip' },
      ],
    };
    expect(RulesGroupSchema.safeParse(g).success).toBe(true);
  });

  it('accepts nested groups', () => {
    const g: RulesGroup = {
      kind: 'all',
      conditions: [
        { kind: 'consent_marketing', value: true },
        {
          kind: 'any',
          conditions: [
            { kind: 'has_tag', tag: 'vip' },
            { kind: 'order_count', operator: 'gte', value: 5 },
          ],
        },
      ],
    };
    expect(RulesGroupSchema.safeParse(g).success).toBe(true);
  });

  it('accepts empty conditions array', () => {
    expect(RulesGroupSchema.safeParse({ kind: 'all', conditions: [] }).success).toBe(true);
  });

  it('rejects > 50 conditions in one group', () => {
    const conds = Array.from({ length: 51 }, () => ({
      kind: 'has_tag' as const,
      tag: 'tag',
    }));
    expect(
      RulesGroupSchema.safeParse({ kind: 'all', conditions: conds }).success,
    ).toBe(false);
  });

  it('rejects unknown kind in conditions', () => {
    expect(
      RulesGroupSchema.safeParse({
        kind: 'all',
        conditions: [{ kind: 'unknown', value: 1 }],
      }).success,
    ).toBe(false);
  });
});

describe('validateDepth', () => {
  it('accepts depth 1 (flat)', () => {
    expect(() =>
      validateDepth({
        kind: 'all',
        conditions: [{ kind: 'has_tag', tag: 'a' }],
      }),
    ).not.toThrow();
  });

  it('accepts depth 4 (max allowed)', () => {
    const deep4: RulesGroup = {
      kind: 'all',
      conditions: [
        {
          kind: 'any',
          conditions: [
            {
              kind: 'all',
              conditions: [
                {
                  kind: 'any',
                  conditions: [{ kind: 'has_tag', tag: 'a' }],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(() => validateDepth(deep4)).not.toThrow();
  });

  it('rejects depth 5+ (DoS protection)', () => {
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
                      conditions: [{ kind: 'has_tag', tag: 'a' }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(() => validateDepth(deep5)).toThrow(/max depth/i);
  });
});

describe('ExclusionFlagsSchema', () => {
  it('parses with all defaults', () => {
    const r = ExclusionFlagsSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.hard_bounce).toBe(true);
      expect(r.data.unsubscribe).toBe(true);
      expect(r.data.manual_suppression).toBe(true);
      expect(r.data.marketing_optout).toBe(false);
    }
  });

  it('allows overrides', () => {
    const r = ExclusionFlagsSchema.safeParse({ marketing_optout: true });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.marketing_optout).toBe(true);
  });
});
