import { z } from 'zod';

const loadingStrategy = z.enum(['eager', 'viewport', 'idle', 'interaction']);
const fetchPriority = z.enum(['high', 'low', 'auto']);
const placeholderStrategy = z.enum(['svg', 'blurhash', 'palette', 'none']);
const objectFit = z.enum(['cover', 'contain', 'fill', 'none', 'scale-down']);
const objectPosition = z.enum([
  'center',
  'top',
  'bottom',
  'left',
  'right',
  'top left',
  'top right',
  'bottom left',
  'bottom right',
]);
/**
 * Backdrop coloré : tokens admis (résolus côté client en CSS variable),
 * ou hex/rgba arbitraire. Validation laxe : on borne juste la longueur.
 */
const backgroundFill = z.string().min(1).max(80);

export const componentListFiltersSchema = z.object({
  pageGroup: z.string().min(1).max(40).optional(),
  q: z.string().min(1).max(80).optional(),
});

export const componentUpdateSchema = z.object({
  description: z.string().max(400).nullable().optional(),
  defaultSvgFallback: z.string().max(200).nullable().optional(),
  defaultLoadingStrategy: loadingStrategy.optional(),
  defaultFetchPriority: fetchPriority.optional(),
  supportsAnimation: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const bindingUpsertSchema = z.object({
  slot: z.string().min(1).max(60),
  mediaId: z.string().min(1).max(40).nullable(),
  loadingStrategy: loadingStrategy.optional(),
  fetchPriority: fetchPriority.optional(),
  priority: z.boolean().optional(),
  placeholderStrategy: placeholderStrategy.optional(),
  customAlt: z.string().max(400).nullable().optional(),
  displayOrder: z.number().int().min(0).max(999).optional(),
  isActive: z.boolean().optional(),
  notes: z.string().max(400).nullable().optional(),
  objectFit: objectFit.optional(),
  objectPosition: objectPosition.optional(),
  focalX: z.number().int().min(0).max(100).nullable().optional(),
  focalY: z.number().int().min(0).max(100).nullable().optional(),
  backgroundFill: backgroundFill.nullable().optional(),
});

/**
 * PATCH d'un binding existant : isActive **et/ou** display modes.
 *
 * Compat ascendante : `bindingActivateSchema` accepte `{ isActive: boolean }`
 * et tolère désormais aussi un patch d'affichage. Au moins un champ requis.
 */
export const bindingActivateSchema = z
  .object({
    isActive: z.boolean().optional(),
    objectFit: objectFit.optional(),
    objectPosition: objectPosition.optional(),
    focalX: z.number().int().min(0).max(100).nullable().optional(),
    focalY: z.number().int().min(0).max(100).nullable().optional(),
    backgroundFill: backgroundFill.nullable().optional(),
    loadingStrategy: loadingStrategy.optional(),
    fetchPriority: fetchPriority.optional(),
    placeholderStrategy: placeholderStrategy.optional(),
  })
  .refine(
    (v) =>
      v.isActive !== undefined ||
      v.objectFit !== undefined ||
      v.objectPosition !== undefined ||
      v.focalX !== undefined ||
      v.focalY !== undefined ||
      v.backgroundFill !== undefined ||
      v.loadingStrategy !== undefined ||
      v.fetchPriority !== undefined ||
      v.placeholderStrategy !== undefined,
    { message: 'Au moins un champ requis' },
  );

/** POST /bindings/bulk : `{ action, ids, ...patch }`. */
export const bindingBulkSchema = z.object({
  action: z.enum(['activate', 'deactivate', 'delete', 'update']),
  ids: z.array(z.string().min(1).max(40)).min(1).max(200),
  patch: z
    .object({
      loadingStrategy: loadingStrategy.optional(),
      fetchPriority: fetchPriority.optional(),
      placeholderStrategy: placeholderStrategy.optional(),
      objectFit: objectFit.optional(),
      objectPosition: objectPosition.optional(),
      focalX: z.number().int().min(0).max(100).nullable().optional(),
      focalY: z.number().int().min(0).max(100).nullable().optional(),
      backgroundFill: backgroundFill.nullable().optional(),
    })
    .optional(),
});

/**
 * POST /components/bulk : opérations groupées au niveau composant.
 *
 *  - `activate-bindings`     → active tous les bindings média des composants ciblés
 *  - `deactivate-bindings`   → désactive tous les bindings média des composants ciblés
 *  - `publish-drafts`        → publie tous les drafts de champs des composants ciblés
 */
export const componentBulkSchema = z.object({
  action: z.enum(['activate-bindings', 'deactivate-bindings', 'publish-drafts']),
  componentIds: z.array(z.string().min(1).max(40)).min(1).max(200),
  locale: z.string().min(2).max(10).optional(),
});

export const animationBindingUpsertSchema = z.object({
  animationKey: z.string().min(1).max(60),
  isDefault: z.boolean().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
});

export const seedFromDocsSchema = z.object({
  autoActivate: z.boolean().optional(),
  force: z.boolean().optional(),
  forceAlt: z.boolean().optional(),
  filterPageGroup: z.string().min(1).max(40).optional(),
  dryRun: z.boolean().optional(),
});

export type ComponentListFilters = z.infer<typeof componentListFiltersSchema>;
export type ComponentUpdate = z.infer<typeof componentUpdateSchema>;
export type BindingUpsert = z.infer<typeof bindingUpsertSchema>;
export type BindingActivate = z.infer<typeof bindingActivateSchema>;
export type BindingBulk = z.infer<typeof bindingBulkSchema>;
export type ComponentBulk = z.infer<typeof componentBulkSchema>;
export type AnimationBindingUpsert = z.infer<typeof animationBindingUpsertSchema>;
export type SeedFromDocsInput = z.infer<typeof seedFromDocsSchema>;
