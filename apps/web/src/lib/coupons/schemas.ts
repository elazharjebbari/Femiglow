/**
 * Schémas Zod du domaine coupons — réutilisés par les routes admin, le seed
 * et la validation des payloads d'éligibilité.
 *
 * Règles métier encodées :
 *  - `mode='code'` → `code` requis (non vide) ; `mode='auto'` → `code` interdit.
 *  - `valueKind='percent'` → `0 < valueAmount <= 100`.
 *  - `valueKind='fixed_amount'` → `valueAmount > 0` (cohérence centimes).
 *  - `endsAt` (si présent) > `startsAt` (si présent).
 *  - `holdoutPct` ∈ [0,100].
 *
 * cf. docs/coupons-qa-2026-06-02/{01,10}-*.
 */
import { z } from 'zod';

export const couponTypeSchema = z.enum([
  'welcome_auto',
  'rescue',
  'email_unlock',
  'manual_code',
  'post_purchase',
]);
export const couponModeSchema = z.enum(['auto', 'code']);
export const couponStatusSchema = z.enum(['draft', 'active', 'paused', 'archived']);
export const couponValueKindSchema = z.enum(['fixed_amount', 'percent']);
export const couponTargetSchema = z.enum(['product_price', 'shipping', 'future_credit']);
export const couponUsageScopeSchema = z.enum(['unlimited', 'once_per_visitor', 'global_cap']);

export const couponEligibilitySchema = z
  .object({
    trafficSources: z.array(z.string().min(1)).optional(),
    visitorType: z.enum(['first', 'returning']).optional(),
    devices: z.array(z.enum(['mobile', 'desktop'])).optional(),
  })
  .strict();

const isoDate = z
  .union([z.string().datetime(), z.date()])
  .transform((v) => (v instanceof Date ? v : new Date(v)));

export const couponInputSchema = z
  .object({
    label: z.string().min(1, 'Libellé requis.'),
    code: z.string().trim().min(1).max(64).nullable().optional(),
    type: couponTypeSchema,
    mode: couponModeSchema,
    status: couponStatusSchema.default('draft'),
    valueKind: couponValueKindSchema,
    valueAmount: z.number().int().positive(),
    target: couponTargetSchema.default('product_price'),
    currency: z.string().length(3).default('MAD'),
    eligibility: couponEligibilitySchema.default({}),
    startsAt: isoDate.nullable().optional(),
    endsAt: isoDate.nullable().optional(),
    stackable: z.boolean().default(false),
    usageScope: couponUsageScopeSchema.default('unlimited'),
    usageCap: z.number().int().positive().nullable().optional(),
    holdoutPct: z.number().int().min(0).max(100).default(0),
    priority: z.number().int().default(0),
  })
  .superRefine((v, ctx) => {
    if (v.mode === 'code' && (!v.code || !v.code.trim())) {
      ctx.addIssue({ code: 'custom', path: ['code'], message: 'Code requis en mode code.' });
    }
    if (v.mode === 'auto' && v.code) {
      ctx.addIssue({ code: 'custom', path: ['code'], message: 'Pas de code en mode auto.' });
    }
    if (v.valueKind === 'percent' && v.valueAmount > 100) {
      ctx.addIssue({ code: 'custom', path: ['valueAmount'], message: 'Pourcentage ≤ 100.' });
    }
    if (v.startsAt && v.endsAt && v.endsAt.getTime() <= v.startsAt.getTime()) {
      ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'Fin doit être après début.' });
    }
  });

export type CouponInput = z.infer<typeof couponInputSchema>;

/** PATCH : tous les champs optionnels (mêmes règles via re-validation en route). */
export const couponPatchSchema = z
  .object({
    label: z.string().min(1).optional(),
    code: z.string().trim().min(1).max(64).nullable().optional(),
    status: couponStatusSchema.optional(),
    valueKind: couponValueKindSchema.optional(),
    valueAmount: z.number().int().positive().optional(),
    target: couponTargetSchema.optional(),
    eligibility: couponEligibilitySchema.optional(),
    startsAt: isoDate.nullable().optional(),
    endsAt: isoDate.nullable().optional(),
    stackable: z.boolean().optional(),
    usageScope: couponUsageScopeSchema.optional(),
    usageCap: z.number().int().positive().nullable().optional(),
    holdoutPct: z.number().int().min(0).max(100).optional(),
    priority: z.number().int().optional(),
  })
  .strict();

export type CouponPatch = z.infer<typeof couponPatchSchema>;

export const couponStatusActionSchema = z.object({ status: couponStatusSchema });
