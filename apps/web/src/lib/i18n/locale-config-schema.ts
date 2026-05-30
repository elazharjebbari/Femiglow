/**
 * Locale Switcher V2 — schéma & défauts de la config (lot L4).
 *
 * Config admin-éditable (section `i18n_locale_config` dans `app_config`,
 * ADR-009). Validation Zod stricte ; en cas d'échec, on retombe sur les
 * **valeurs par défaut** (INV-12) — jamais d'écran cassé.
 *
 * @see docs/locale-switcher-v2/03-data/config-schema.yaml
 * @see docs/locale-switcher-v2/CONTRACT.md §3, INV-12
 */
import { z } from 'zod';

import { LOCALES, type Locale } from '@/i18n.config';

const localeCodeSchema = z.enum(LOCALES as unknown as [Locale, ...Locale[]]);
const surfaceSchema = z.object({
  variant: z.enum(['dropdown', 'pills', 'segmented']),
});

export const localeEntrySchema = z.object({
  code: localeCodeSchema,
  enabled: z.boolean(),
  endonym: z.string().min(1), // jamais vide
  direction: z.enum(['ltr', 'rtl']).optional(),
  order: z.number().int().nonnegative(),
});

export const localeConfigSchema = z
  .object({
    locales: z.array(localeEntrySchema).min(1),
    defaultLocale: localeCodeSchema,
    nudge: z.object({
      enabled: z.boolean(),
      maxImpressionsPerVisitor: z.number().int().min(0).max(10),
    }),
    surfaces: z.object({
      header: surfaceSchema,
      drawer: surfaceSchema,
      footer: surfaceSchema,
    }),
    transition: z.object({
      durationMs: z.number().int().min(0).max(2000),
      easing: z.string().min(1),
    }),
  })
  .superRefine((cfg, ctx) => {
    const codes = cfg.locales.map((l) => l.code);
    // codes uniques
    if (new Set(codes).size !== codes.length) {
      ctx.addIssue({ code: 'custom', message: 'locale codes must be unique' });
    }
    // la locale par défaut existe ET est activée
    const def = cfg.locales.find((l) => l.code === cfg.defaultLocale);
    if (!def) {
      ctx.addIssue({ code: 'custom', message: 'defaultLocale absent de locales' });
    } else if (!def.enabled) {
      ctx.addIssue({ code: 'custom', message: 'defaultLocale doit être activée' });
    }
    // au moins une locale activée
    if (!cfg.locales.some((l) => l.enabled)) {
      ctx.addIssue({ code: 'custom', message: 'au moins une locale activée' });
    }
    // ar est toujours RTL
    const ar = cfg.locales.find((l) => l.code === 'ar');
    if (ar && ar.direction && ar.direction !== 'rtl') {
      ctx.addIssue({ code: 'custom', message: 'ar doit être rtl' });
    }
  });

export type LocaleConfig = z.infer<typeof localeConfigSchema>;

/** Config par défaut (fr/ar/en activées, endonymes, nudge off). */
export const DEFAULT_LOCALE_CONFIG: LocaleConfig = {
  locales: [
    { code: 'fr', enabled: true, endonym: 'Français', direction: 'ltr', order: 1 },
    { code: 'ar', enabled: true, endonym: 'العربية', direction: 'rtl', order: 2 },
    { code: 'en', enabled: true, endonym: 'English', direction: 'ltr', order: 3 },
  ],
  defaultLocale: 'fr',
  nudge: { enabled: false, maxImpressionsPerVisitor: 1 },
  surfaces: {
    header: { variant: 'dropdown' },
    drawer: { variant: 'pills' },
    footer: { variant: 'pills' },
  },
  transition: { durationMs: 280, easing: 'cubic-bezier(0.22,1,0.36,1)' },
};

/**
 * Valide un payload inconnu ; **retombe sur les défauts** si invalide
 * (INV-12). Ne jette jamais.
 */
export function safeParseLocaleConfig(input: unknown): LocaleConfig {
  const parsed = localeConfigSchema.safeParse(input);
  return parsed.success ? parsed.data : DEFAULT_LOCALE_CONFIG;
}
