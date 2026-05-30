/**
 * Moteur de suggestion — schéma & défauts de la config (lot L10).
 *
 * Section `i18n_suggestion_engine` dans `app_config` (ADR-009). Validation
 * Zod **stricte** ; en cas d'échec, on retombe sur les défauts **et on
 * force `engineEnabled=false`** (INV-13 / §7.5) — jamais d'affichage par
 * erreur. La forme reste **compatible** avec `EngineConfig` consommé par
 * `evaluateSuggestionPolicy` (L9), enrichie de `deferTtlMs` (TTL du
 * defer-to-breakpoint, INV-17) et d'une `surface` par profil (perle/toast).
 *
 * Le périmètre admin complet (CRUD profils, vue d'audit, V-codes 422) est
 * livré en L11 ; ici on couvre le strict nécessaire au runtime + le
 * fail-safe.
 *
 * @see docs/locale-switcher-v2/10-suggestion-engine/02-config/engine-config-schema.yaml
 * @see docs/locale-switcher-v2/CONTRACT.md §7, INV-13/14/16/17
 */
import { z } from 'zod';

/** Clés de signaux autorisées dans une condition (cf. `Signals`, L9). */
const SIGNAL_KEYS = [
  'servedLocale',
  'guessedLocale',
  'confidence',
  'inCheckout',
  'formFocused',
  'isDeepReading',
  'modalOpen',
  'videoPlaying',
  'dwellMs',
  'scrollVelocity',
  'atBreakpoint',
  'hoverSwitcher',
  'exitIntent',
  'cooldownActive',
  'impressionsThisVisitor',
  'dismissedPersistent',
] as const;

const conditionSchema = z
  .object({
    signal: z.enum(SIGNAL_KEYS),
    op: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'truthy', 'falsy']),
    value: z.union([z.number(), z.string(), z.boolean()]).optional(),
  })
  .strict();

const profileSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(['trigger', 'never']),
    enabled: z.boolean(),
    priority: z.number().int(),
    conditions: z.array(conditionSchema),
    minConfidence: z.number().min(0).max(1).optional(),
    opportuneRequired: z.boolean().optional(),
    surface: z.enum(['pearl', 'toast']).optional(),
  })
  .strict();

export const engineConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    engineEnabled: z.boolean(),
    globalConfidenceFloor: z.number().min(0).max(1),
    maxImpressionsPerVisitor: z.number().int().min(0).max(3),
    deferTtlMs: z.number().int().min(0).max(60000),
    profiles: z.array(profileSchema),
  })
  .strict()
  .superRefine((cfg, ctx) => {
    // Priorités uniques → ordre d'évaluation déterministe (V-PRIORITY-UNIQUE).
    const priorities = cfg.profiles.map((p) => p.priority);
    if (new Set(priorities).size !== priorities.length) {
      ctx.addIssue({ code: 'custom', message: 'profile priorities must be unique' });
    }
    // Tout trigger activé doit pouvoir s'afficher (surface) — sinon inerte.
    for (const p of cfg.profiles) {
      if (p.kind === 'trigger' && p.enabled && !p.surface) {
        ctx.addIssue({
          code: 'custom',
          message: `enabled trigger ${p.id} must declare a surface`,
        });
      }
    }
  });

export type ResolvedEngineConfig = z.infer<typeof engineConfigSchema>;

/**
 * Config par défaut **failsafe** (INV-13/§7.5) :
 *  - `engineEnabled=false` (aucune proposition tant qu'un admin n'arme pas un trigger),
 *  - never-profiles comportementaux `enabled=true` (zones calmes déléguées :
 *    deep-read, fresh, fast-scroll, modale, vidéo). Checkout/form sont un
 *    **plancher dur** codé dans la politique (L9) — pas pilotable ici.
 *  - triggers TOUS `enabled=false`.
 */
export const DEFAULT_ENGINE_CONFIG: ResolvedEngineConfig = {
  schemaVersion: 1,
  engineEnabled: false,
  globalConfidenceFloor: 0.6,
  maxImpressionsPerVisitor: 1,
  deferTtlMs: 8000,
  profiles: [
    // ---- NEVER (exclusions, priorité basse = évaluées d'abord) ----
    {
      id: 'NEVER-DEEP-READ',
      kind: 'never',
      enabled: true,
      priority: 3,
      conditions: [{ signal: 'isDeepReading', op: 'truthy' }],
    },
    {
      id: 'NEVER-FRESH',
      kind: 'never',
      enabled: true,
      priority: 4,
      conditions: [{ signal: 'dwellMs', op: 'lt', value: 3000 }],
    },
    {
      id: 'NEVER-FAST-SCROLL',
      kind: 'never',
      enabled: true,
      priority: 5,
      conditions: [{ signal: 'scrollVelocity', op: 'gt', value: 1200 }],
    },
    {
      id: 'NEVER-MODAL',
      kind: 'never',
      enabled: true,
      priority: 6,
      conditions: [{ signal: 'modalOpen', op: 'truthy' }],
    },
    {
      id: 'NEVER-VIDEO',
      kind: 'never',
      enabled: true,
      priority: 7,
      conditions: [{ signal: 'videoPlaying', op: 'truthy' }],
    },
    // ---- TRIGGER (déclenchements, TOUS off par défaut — INV-13) ----
    {
      id: 'TRIG-ENTRY-MISMATCH',
      kind: 'trigger',
      enabled: false,
      priority: 100,
      conditions: [],
      minConfidence: 0.75,
      opportuneRequired: true,
      surface: 'pearl',
    },
    {
      id: 'TRIG-HESITATION',
      kind: 'trigger',
      enabled: false,
      priority: 90,
      conditions: [{ signal: 'hoverSwitcher', op: 'truthy' }],
      minConfidence: 0.5,
      opportuneRequired: false,
      surface: 'pearl',
    },
    {
      id: 'TRIG-EXIT-RESCUE',
      kind: 'trigger',
      enabled: false,
      priority: 80,
      conditions: [{ signal: 'exitIntent', op: 'truthy' }],
      minConfidence: 0.65,
      opportuneRequired: false,
      surface: 'toast',
    },
  ],
};

/**
 * Valide un payload inconnu. En cas d'échec → **défauts moteur off**
 * (INV-13). Même en cas de succès, si `engineEnabled` est vrai mais que la
 * config est par ailleurs incohérente, le `safeParse` aura déjà rejeté.
 * Ne jette jamais.
 */
export function safeParseEngineConfig(input: unknown): ResolvedEngineConfig {
  const parsed = engineConfigSchema.safeParse(input);
  return parsed.success ? parsed.data : DEFAULT_ENGINE_CONFIG;
}
