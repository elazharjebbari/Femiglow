/**
 * Schémas Zod runtime du feed produit Kolenda.
 *
 * Pourquoi un schéma runtime alors qu'on a déjà des `interface`
 * TypeScript dans `types.ts` ?
 *  - Les `interface` disparaissent au build : à l'exécution, rien
 *    ne garantit que `buildKitProductFeed` n'a pas oublié un champ
 *    ou injecté un `undefined` (typo, refactor, mock incomplet).
 *  - Le feed alimente deux surfaces critiques (XML Merchant publié à
 *    Google Shopping + JSON-LD `<script type="application/ld+json">`
 *    crawlé par les moteurs). Une feed cassée silencieusement = perte
 *    de visibilité jusqu'au prochain audit manuel.
 *  - On veut faire **fail-fast en dev** : `buildKitProductFeed`
 *    valide en `NODE_ENV !== 'production'` et lance immédiatement
 *    une erreur lisible si le contrat est violé. En prod, on
 *    accepte le coût d'un feed légèrement dégradé pour ne pas
 *    crasher la SSR.
 *
 * Les contraintes ici reprennent les invariants déjà testés dans
 * `kit-feed.test.ts` (4 steps, 3 claims, prix non-négatif, etc.) ;
 * elles sont la version **runtime** de ces contrats.
 */
import { z } from 'zod';

const accentSchema = z.enum(['sauge', 'petale', 'champagne', 'ciel']);

const stepIconSchema = z.enum(['buffer', 'drop', 'sparkle', 'mirror']);

const stepSchema = z.object({
  step: z.number().int().min(1).max(4),
  kicker: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  accent: accentSchema,
  // Extensions Kolenda §4.7 — tous optionnels (rétro-compat).
  duration: z.string().min(1).max(20).optional(),
  isResult: z.boolean().optional(),
  icon: stepIconSchema.optional(),
});

const stepsHeaderSchema = z.object({
  kicker: z.string().min(1).max(40),
  totalDuration: z.string().min(1).max(40),
  lead: z.string().min(1).max(200),
});

const stepsPostCtaSchema = z.object({
  label: z.string().min(1).max(40),
  // Anchor id sans `#` — caractères URL-safe.
  anchorId: z.string().regex(/^[a-z0-9-]+$/i).min(1).max(60),
});

const valueItemSchema = z.object({
  label: z.string().min(1).max(60),
  valueLabel: z.string().min(1).max(20),
  muted: z.boolean().optional(),
});

const heroSchema = z.object({
  kicker: z.string().min(1),
  title: z.string().min(1).max(120),
  lead: z.string().min(1),
  // Pricing #2 — small word près du prix : on borne strictement à 20
  // chars pour éviter qu'un préfixe trop long ne ruine l'effet visuel.
  pricePrefix: z.string().min(1).max(20),
  ctaLabel: z.string().min(1).max(40),
  // Pricing #11 — microcopy dense : on exige au moins 8 mots pour
  // garantir la « density payment section ».
  ctaMicrocopy: z
    .string()
    .min(1)
    .refine((s) => s.split(/\s+/).filter(Boolean).length >= 8, {
      message: 'ctaMicrocopy doit contenir au moins 8 mots (Kolenda Pricing #11).',
    }),
  // Extensions Kolenda §4.6 — tous optionnels pour rétro-compat.
  priceCompareAt: z.string().min(1).max(20).optional(),
  priceCompareAtAriaLabel: z.string().min(1).max(80).optional(),
  valueBreakdown: z.array(valueItemSchema).min(1).max(6).optional(),
  perUsageHint: z.string().min(1).max(80).optional(),
  ctaAccent: z.enum(['sauge-dark', 'champagne', 'terracotta']).optional(),
});

const claimSchema = z.object({
  icon: z.enum(['leaf', 'drop', 'sparkle']),
  label: z.string().min(1),
  detail: z.string().min(1),
});

const socialProofSchema = z.object({
  // Pricing #14 — chiffres précis : on n'autorise pas un comptage
  // explicitement nul (un feed vide est un bug, pas un état valide).
  reviewsCount: z.number().int().min(1),
  rating: z.number().min(0).max(5),
  quote: z.string().min(1),
  authorLabel: z.string().min(1),
  // Libellé géographique optionnel — fallback `reviewsCount` si absent.
  countLabelGeo: z.string().min(1).max(80).optional(),
});

/**
 * Schéma complet du feed produit. La validation runtime en dev
 * (cf. `validateKitProductFeed` dans `kit-feed.ts`) lève une erreur
 * détaillée pour repérer une dérive avant le déploiement.
 */
export const productFeedSchema = z.object({
  productSlug: z.string().min(1),
  locale: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'locale BCP-47 attendu'),
  canonicalUrl: z.string().url(),
  // Image Merchant : URL absolue + extension raster (les SVG sont
  // explicitement rejetés par Google Merchant, cf. kit-feed.ts).
  imageUrl: z
    .string()
    .url()
    .refine((u) => /\.(png|jpe?g|gif|bmp|tiff)(\?|$)/i.test(u), {
      message: 'imageUrl doit pointer un raster (.png|.jpg|.gif|.bmp|.tiff).',
    }),
  brand: z.string().min(1),
  currency: z.string().length(3),
  priceMajor: z.number().nonnegative(),
  promoPriceMajor: z.number().nonnegative().nullable(),
  availability: z.enum(['in_stock', 'out_of_stock']),
  description: z.string().min(1),
  hero: heroSchema,
  // Le rituel a *toujours* exactement 4 étapes (visuel imprimé).
  steps: z.array(stepSchema).length(4),
  // Header + postCta optionnels — extensions Kolenda §4.7.
  stepsHeader: stepsHeaderSchema.optional(),
  stepsPostCta: stepsPostCtaSchema.optional(),
  // 3 promesses du visuel (leaf · drop · sparkle).
  claims: z.array(claimSchema).length(3),
  socialProof: socialProofSchema,
});

export type ProductFeedSchema = z.infer<typeof productFeedSchema>;

/**
 * Helper de validation. En dev, lève une erreur explicite avec le
 * chemin du champ fautif. En prod, on retourne le feed tel quel
 * (zone hot path SSR — on évite de crasher la requête utilisateur).
 *
 * Le caller décide de l'environnement (le module de schéma reste pur,
 * sans lecture d'env).
 */
export function assertValidProductFeed(
  feed: unknown,
  options: { strict: boolean },
): void {
  const result = productFeedSchema.safeParse(feed);
  if (result.success) return;
  const formatted = result.error.issues
    .map((i) => `  - ${i.path.join('.') || '<root>'}: ${i.message}`)
    .join('\n');
  const message = `Invalid ProductFeed shape (cf. lib/products/feed/schema.ts) :\n${formatted}`;
  if (options.strict) {
    throw new Error(message);
  } else {
    // En prod, log silencieux. On ne casse pas la SSR pour un
    // feed légèrement dégradé — l'observabilité fait le reste.
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
      console.warn('[product-feed]', message);
    }
  }
}
