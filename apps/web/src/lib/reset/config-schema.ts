/**
 * Validation Zod du ResetConfig (côté API et CLI).
 * Cf. docs/reset-feature/12-config-schema.json
 */
import { z } from 'zod';
import type { ResetConfig } from './types';
import { ALWAYS_PRESERVED } from './types';

const PRESERVABLE = [
  'admin_users',
  'audit_events',
  'orders',
  'order_items',
  'leads',
  'lead_events',
  'chat_lead',
  'ritual_testimonials',
  'ritual_testimonial_photos',
  'ritual_audit_log',
] as const;

const DOMAINS = ['commerce', 'content', 'tracking', 'chat', 'system'] as const;

const BASE = z.object({
  mode: z.enum(['soft', 'medium', 'hard', 'custom']),
  domains: z.array(z.enum(DOMAINS)).min(1).optional(),
  preserve: z.array(z.enum(PRESERVABLE)).default([
    'admin_users',
    'audit_events',
    'orders',
    'order_items',
    'leads',
    'lead_events',
    'chat_lead',
    'ritual_testimonials',
  ]),
  wipeMedia: z.boolean().default(false),
  wipeNextCache: z.boolean().default(false),
  withBackup: z.boolean().default(true),
  keepBackups: z.number().int().min(0).max(30).default(5),
  dryRun: z.boolean().default(false),
  confirm: z.enum(['RESET', 'HARD RESET']),
  nonInteractive: z.boolean().optional(),
  actorId: z.string().regex(/^[a-z]+_[a-z0-9]+$/i).nullable(),
});

export const resetConfigSchema = BASE.superRefine((cfg, ctx) => {
  if (cfg.mode === 'custom' && (!cfg.domains || cfg.domains.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'custom mode requires at least one domain',
      path: ['domains'],
    });
  }
  if (cfg.mode === 'hard' && cfg.confirm !== 'HARD RESET') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'hard mode requires confirm = "HARD RESET"',
      path: ['confirm'],
    });
  }
  if (cfg.mode !== 'hard' && cfg.confirm !== 'RESET') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${cfg.mode} mode requires confirm = "RESET"`,
      path: ['confirm'],
    });
  }
  if (cfg.mode === 'hard' && !cfg.withBackup) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'hard mode requires withBackup=true',
      path: ['withBackup'],
    });
  }
}).transform((cfg): ResetConfig => {
  // Force certains champs en hard pour cohérence
  const out: ResetConfig = { ...cfg };
  if (cfg.mode === 'hard') {
    out.wipeMedia = true;
    out.wipeNextCache = true;
    out.withBackup = true;
  }
  // Toujours préserver admin_users + audit_events
  const preserved = new Set(out.preserve);
  for (const t of ALWAYS_PRESERVED) preserved.add(t);
  out.preserve = Array.from(preserved);
  return out;
});

export type ParsedResetConfig = z.infer<typeof resetConfigSchema>;

export function parseResetConfig(input: unknown): ResetConfig {
  return resetConfigSchema.parse(input);
}

export function safeParseResetConfig(input: unknown):
  | { ok: true; config: ResetConfig }
  | { ok: false; errors: z.ZodIssue[] } {
  const parsed = resetConfigSchema.safeParse(input);
  if (parsed.success) return { ok: true, config: parsed.data };
  return { ok: false, errors: parsed.error.issues };
}
