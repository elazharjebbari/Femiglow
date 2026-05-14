/**
 * Types Zod pour RulesGroup et Rule (M5.3.0).
 *
 * Schema versioning : champ `version` (default 1) sur le RulesGroup racine.
 * Toute nouvelle grammaire incrémente la version + supporte les anciennes
 * 6 mois minimum (migration auto au save).
 *
 * Cf. docs/emailing/admin-evolution/02-backend/03-rules-compiler.md
 *    docs/emailing/admin-evolution/00-architecture/05-adr.md ADR-004
 */
import { z } from 'zod';

// ── Operators ────────────────────────────────────────────────────────────

const NumericOp = z.enum(['gte', 'lte', 'eq', 'gt', 'lt', 'between']);
const DateOp = z.enum(['before', 'after', 'between', 'within']);
const StringOp = z.enum(['contains', 'starts', 'ends', 'equals', 'in']);

// ── Critères individuels (Rule) ──────────────────────────────────────────

// Identité
const EmailPatternRule = z.object({
  kind: z.literal('email_pattern'),
  operator: StringOp,
  value: z.union([z.string(), z.array(z.string())]),
});

const CountryRule = z.object({
  kind: z.literal('country'),
  operator: z.enum(['eq', 'in']),
  value: z.union([z.string(), z.array(z.string())]),
});

const ConsentMarketingRule = z.object({
  kind: z.literal('consent_marketing'),
  value: z.boolean(),
});

const CreatedAtRule = z.object({
  kind: z.literal('created_at'),
  operator: DateOp,
  value: z.union([z.string(), z.tuple([z.string(), z.string()])]),
});

// Commerce
const OrderCountRule = z.object({
  kind: z.literal('order_count'),
  operator: NumericOp,
  value: z.union([z.number().int().min(0), z.tuple([z.number().int(), z.number().int()])]),
  since: z.string().optional(),
  until: z.string().optional(),
});

const OrderTotalRule = z.object({
  kind: z.literal('order_total'),
  operator: NumericOp,
  value: z.union([z.number().int().min(0), z.tuple([z.number().int(), z.number().int()])]),
  currency: z.literal('MAD').optional(),
  since: z.string().optional(),
});

const HasOrderedProductRule = z.object({
  kind: z.literal('has_ordered_product'),
  productId: z.string().min(1),
  since: z.string().optional(),
});

const LastOrderAtRule = z.object({
  kind: z.literal('last_order_at'),
  operator: DateOp,
  value: z.string(),
});

// Engagement email
const EmailOpenedRule = z.object({
  kind: z.literal('email_opened'),
  templateSlug: z.string().optional(),
  within: z.string().optional(),
  minCount: z.number().int().min(1).optional(),
});

const EmailClickedRule = z.object({
  kind: z.literal('email_clicked'),
  urlPattern: z.string().optional(),
  within: z.string().optional(),
  minCount: z.number().int().min(1).optional(),
});

const ReceivedWithoutOpenRule = z.object({
  kind: z.literal('received_without_open'),
  threshold: z.number().int().min(1),
  within: z.string(),
});

// Activité
const InactiveSinceRule = z.object({
  kind: z.literal('inactive_since'),
  days: z.number().int().min(0).max(3650),
});

const SessionCountRule = z.object({
  kind: z.literal('session_count'),
  operator: NumericOp,
  value: z.number().int().min(0),
  within: z.string().optional(),
});

// Tags
const HasTagRule = z.object({
  kind: z.literal('has_tag'),
  tag: z.string().min(1).max(80),
});

const NotHasTagRule = z.object({
  kind: z.literal('not_has_tag'),
  tag: z.string().min(1).max(80),
});

// ── Discriminated union ──────────────────────────────────────────────────

export const RuleSchema = z.discriminatedUnion('kind', [
  EmailPatternRule,
  CountryRule,
  ConsentMarketingRule,
  CreatedAtRule,
  OrderCountRule,
  OrderTotalRule,
  HasOrderedProductRule,
  LastOrderAtRule,
  EmailOpenedRule,
  EmailClickedRule,
  ReceivedWithoutOpenRule,
  InactiveSinceRule,
  SessionCountRule,
  HasTagRule,
  NotHasTagRule,
]);

export type Rule = z.infer<typeof RuleSchema>;
export type RuleKind = Rule['kind'];

// ── RulesGroup (AND / OR, récursif) ──────────────────────────────────────

export type RulesGroup = {
  kind: 'all' | 'any';
  conditions: Array<Rule | RulesGroup>;
};

// Zod recursive schema avec z.lazy
export const RulesGroupSchema: z.ZodType<RulesGroup> = z.lazy(() =>
  z.object({
    kind: z.enum(['all', 'any']),
    conditions: z.array(z.union([RuleSchema, RulesGroupSchema])).max(50),
  }),
);

// ── Exclusion flags ──────────────────────────────────────────────────────

export const ExclusionFlagsSchema = z.object({
  hard_bounce: z.boolean().default(true),
  unsubscribe: z.boolean().default(true),
  manual_suppression: z.boolean().default(true),
  marketing_optout: z.boolean().default(false),
});

export type ExclusionFlags = z.infer<typeof ExclusionFlagsSchema>;

// ── Profondeur max (sécurité anti-DoS sur compileur récursif) ────────────

const MAX_DEPTH = 4;

export function validateDepth(group: RulesGroup, depth: number = 0): void {
  if (depth >= MAX_DEPTH) {
    throw new Error(`RulesGroup max depth ${MAX_DEPTH} exceeded`);
  }
  for (const cond of group.conditions) {
    if ('conditions' in cond && Array.isArray(cond.conditions)) {
      validateDepth(cond as RulesGroup, depth + 1);
    }
  }
}
