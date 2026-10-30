/**
 * Hero gallery — agrégateur des images affichées dans `HeroGallery`.
 *
 * Pourquoi un module dédié ?
 *
 *  - **Source unique** : la galerie hero du kit combine plusieurs sources
 *    (slots Component-Media + photos clientes en DB). Sans agrégateur, le
 *    composant `HeroProduitBound` devrait orchestrer 3+ resolvers à la
 *    main — peu lisible et fragile.
 *  - **Ordre stable** : on fixe l'ordre `primary → context → reviews` ici,
 *    une fois pour toutes. Les autres parties du code (e.g. JSON-LD,
 *    OG image) peuvent réutiliser cet ordre sans risque de divergence.
 *  - **Fallback gracieux** : si la table `product_review_photos` est vide
 *    ou si l'option `includeReviews` est désactivée, on retourne juste les
 *    slots produit. Pas de crash, pas d'image vide.
 *
 * cf. docs/kit-hero-optim/02-architecture.md §4
 */
import 'server-only';
import { asc, eq, and } from 'drizzle-orm';
import { db, memoryStore } from '@/lib/db/client';
import { productReviewPhotos } from '@/lib/db/schema';
import { resolveComponentSlot } from '@/lib/components/resolver';
import {
  delegatedTrace,
  mediaVariantTrackingValue,
  resolveComponentMediaSlots,
} from '@/lib/components/media-variants/resolve.server';
import type {
  FallbackLevel,
  MediaSlotTrace,
  ResolvedMediaImage,
} from '@/lib/components/media-variants/types';
import type { MediaVariantTrackingValue } from '@/lib/components/media-variants/tracking';
import type { Locale } from '@/i18n.config';
import type { KitAngle } from '@/lib/kit/angle';
import type { HeroMediaTracking } from '@/lib/kit/hero-media';
import { pickHeroVariantUrl } from '@/lib/media/pick-variant';
import type { HeroGalleryImage, HeroGalleryImageKind } from './hero-gallery-types';

export type {
  HeroGalleryImage,
  HeroGalleryImageKind,
  HeroGalleryImageSource,
} from './hero-gallery-types';

export interface GetKitHeroGalleryImagesOptions {
  /** Produit cible. Default 'kit-femiglow'. */
  productId?: string;
  /** Inclure les photos clientes (table product_review_photos). Default true. */
  includeReviews?: boolean;
  /** Nombre max de photos clientes à inclure. Default 6. */
  maxReviewPhotos?: number;
  /** Nombre max TOTAL d'images retournées (toutes catégories). Default 7. */
  maxTotal?: number;
  /** Component key (pour la résolution des slots). Default 'kit-hero-produit'. */
  componentKey?: string;
  /**
   * Image produit de fallback — utilisée comme première image si le slot
   * `kit-hero-produit/primary` n'a pas de binding actif. Conserve la
   * sémantique "image produit toujours en premier" (cf. brief Kolenda :
   * packshot dominant, reviews en appui).
   */
  productFallback?: {
    src: string;
    alt: string;
    width: number;
    height: number;
    blurDataURL?: string;
  };
}

const DEFAULTS = {
  includeReviews: true,
  maxReviewPhotos: 6,
  maxTotal: 7,
} as const;

/**
 * Construit la liste d'images affichées dans la galerie hero du kit
 * (galerie historique, sans images par audience).
 *
 * Ordre de priorité :
 *  1. Slot `primary` (packshot principal) — toujours en première position si binding actif.
 *  2. Slots `context_1` et `context_2` (si bindings actifs).
 *  3. Photos clientes (`product_review_photos`, status='published', ORDER BY display_order ASC).
 *
 * Le fallback pour le slot `primary` (cas où aucun binding n'est défini) est
 * l'option `productFallback` (fournie par l'appelant depuis `product.images[0]`).
 *
 * Wrapper de compatibilité : équivaut à `getKitHeroGallery` drapeau coupé.
 */
export async function getKitHeroGalleryImages(
  options: GetKitHeroGalleryImagesOptions = {},
): Promise<HeroGalleryImage[]> {
  const { images } = await buildLegacyGallery(options);
  return images;
}

/* ────────────────────────────────────────────────────────────────────────
 * Galerie par audience (angle × langue) — PR 4
 * ──────────────────────────────────────────────────────────────────────── */

export interface GetKitHeroGalleryOptions extends GetKitHeroGalleryImagesOptions {
  /** Langue de la page (choix de l'ensemble et des alt). */
  locale: Locale;
  /** Angle publicitaire résolu par la page (`null` : ensemble par défaut). */
  angle: KitAngle | null;
  /**
   * Drapeau « images par audience » déjà évalué (env × CMS × `?hmv=off`, ou
   * aperçu admin). `false` → galerie historique, strictement identique.
   */
  flagEnabled: boolean;
  /** Aperçu admin : ensembles brouillons, sans cache. Ignoré drapeau coupé. */
  draft?: boolean;
  /** Alt de dernier recours des images par audience, déjà localisé. */
  fallbackAlt?: string;
}

/** Traces de résolution des deux slots de la politique du hero. */
export interface KitHeroGalleryTrace {
  primary: MediaSlotTrace;
  secondary: MediaSlotTrace;
}

export interface KitHeroGallery {
  images: HeroGalleryImage[];
  trace: KitHeroGalleryTrace;
  /** Valeur `hero_media_variant` de l'image principale. */
  trackingValue: MediaVariantTrackingValue;
  /** Niveau de repli de l'image principale (1 à 8). */
  level: FallbackLevel;
  /** `true` si la galerie a été résolue avec le drapeau actif. */
  variantsEnabled: boolean;
  /**
   * `true` si résolue depuis les ensembles BROUILLONS (aperçu admin) : elle
   * s'affiche mais n'est jamais exposée au tracking (`kitHeroGalleryTracking`).
   */
  draft: boolean;
}

const PRIMARY_SLOT = 'primary';
const SECONDARY_SLOT = 'secondary';

/**
 * Galerie du hero /kit, avec la trace de résolution pour le tracking.
 *
 * Drapeau coupé : exactement la galerie historique (`getKitHeroGalleryImages`).
 *
 * Drapeau actif (cf. §4.3) :
 *  - principale : ensemble `primary` (niveaux 1–6), sinon liaison legacy
 *    `primary` (7), sinon image produit de repli (8) ;
 *  - secondaires : ensemble `secondary` (liste entière, jamais mélangée),
 *    sinon liaisons legacy `context_1` / `context_2` ;
 *  - puis photos clientes, le tout plafonné à `maxTotal`.
 *
 * Une erreur de lecture des ensembles (base indisponible…) n'interrompt
 * jamais la page : on retombe sur les niveaux 7–8.
 */
export async function getKitHeroGallery(options: GetKitHeroGalleryOptions): Promise<KitHeroGallery> {
  if (!options.flagEnabled) {
    const { images, primaryLevel } = await buildLegacyGallery(options);
    return {
      images,
      trace: {
        primary: delegatedTrace(PRIMARY_SLOT, primaryLevel),
        secondary: delegatedTrace(SECONDARY_SLOT, 7),
      },
      trackingValue: primaryLevel === 7 ? 'legacy' : 'product',
      level: primaryLevel,
      variantsEnabled: false,
      draft: false,
    };
  }

  const productId = options.productId ?? 'kit-femiglow';
  const componentKey = options.componentKey ?? 'kit-hero-produit';
  const includeReviews = options.includeReviews ?? DEFAULTS.includeReviews;
  const maxReviewPhotos = options.maxReviewPhotos ?? DEFAULTS.maxReviewPhotos;
  const maxTotal = options.maxTotal ?? DEFAULTS.maxTotal;

  const [resolved, reviewImages] = await Promise.all([
    resolveComponentMediaSlots(
      componentKey,
      { locale: options.locale, variants: { angle: options.angle } },
      { draft: options.draft === true, fallbackAlt: options.fallbackAlt },
    ).catch((error: unknown) => {
      // Repli silencieux côté visiteuse, mais visible dans les logs serveur.
      console.error('[kit-hero-gallery] résolution des images par audience impossible', error);
      return { slots: {}, traces: {} } as Awaited<ReturnType<typeof resolveComponentMediaSlots>>;
    }),
    includeReviews ? readReviewPhotos(productId, maxReviewPhotos) : Promise.resolve([]),
  ]);

  const out: HeroGalleryImage[] = [];

  // 1. Principale : ensemble (1–6) > liaison legacy (7) > produit (8).
  let primaryTrace: MediaSlotTrace;
  const setPrimary = resolved.slots[PRIMARY_SLOT]?.[0];
  if (setPrimary) {
    out.push(resolvedToGalleryImage(setPrimary, 'product'));
    primaryTrace = resolved.traces[PRIMARY_SLOT] ?? delegatedTrace(PRIMARY_SLOT, 7);
  } else {
    const legacy = slotToImage(await resolveComponentSlot(componentKey, 'primary'), 'product', {
      withMediaMeta: true,
    });
    if (legacy) {
      out.push(legacy);
      primaryTrace = delegatedTrace(PRIMARY_SLOT, 7);
    } else {
      const fallback = productFallbackImage(options.productFallback);
      if (fallback) out.push(fallback);
      primaryTrace = delegatedTrace(PRIMARY_SLOT, 8);
    }
  }

  // 2. Secondaires : liste de l'ensemble, sinon liaisons legacy contextuelles.
  let secondaryTrace: MediaSlotTrace;
  const setSecondary = resolved.slots[SECONDARY_SLOT];
  if (setSecondary && setSecondary.length > 0) {
    out.push(...setSecondary.map((img) => resolvedToGalleryImage(img, 'context')));
    secondaryTrace = resolved.traces[SECONDARY_SLOT] ?? delegatedTrace(SECONDARY_SLOT, 7);
  } else {
    const legacy = await Promise.all(
      (['context_1', 'context_2'] as const).map((slotKey) =>
        resolveComponentSlot(componentKey, slotKey),
      ),
    );
    for (const ctx of legacy) {
      const image = slotToImage(ctx, 'context', { withMediaMeta: true });
      if (image) out.push(image);
    }
    secondaryTrace = delegatedTrace(SECONDARY_SLOT, 7);
  }

  // 3. Photos clientes en queue.
  out.push(...reviewImages);

  const traces = { [PRIMARY_SLOT]: primaryTrace, [SECONDARY_SLOT]: secondaryTrace };
  return {
    images: out.slice(0, maxTotal),
    trace: { primary: primaryTrace, secondary: secondaryTrace },
    trackingValue: mediaVariantTrackingValue(traces, PRIMARY_SLOT),
    level: primaryTrace.level,
    variantsEnabled: true,
    draft: options.draft === true,
  };
}

/**
 * Valeurs de tracking d'une galerie : `null` si elle a été résolue drapeau
 * coupé (rien n'est alors émis ni posé dans le HTML, cf. `lib/kit/hero-media.ts`)
 * ou depuis des brouillons (aperçu admin : une variante non publiée ne doit
 * apparaître ni dans les attributs `data-hero-media-*` ni dans les événements).
 */
export function kitHeroGalleryTracking(
  gallery:
    | (Pick<KitHeroGallery, 'variantsEnabled' | 'trackingValue' | 'level'> &
        Partial<Pick<KitHeroGallery, 'draft'>>)
    | null
    | undefined,
): HeroMediaTracking | null {
  if (!gallery?.variantsEnabled || gallery.draft) return null;
  return { variant: gallery.trackingValue, level: gallery.level };
}

/** Image produit de repli dérivée de `product.images[0]` (forme commune). */
export function kitHeroProductFallback(
  image: { src: string; alt: string; width: number; height: number; blurDataURL?: string } | undefined,
): GetKitHeroGalleryImagesOptions['productFallback'] {
  if (!image) return undefined;
  return {
    src: image.src,
    alt: image.alt,
    width: image.width,
    height: image.height,
    blurDataURL: image.blurDataURL,
  };
}

/* ────────────────────────────────────────────────────────────────────────
 * Internes
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Galerie historique + niveau de l'image principale (7 = liaison, 8 =
 * produit). Le code de construction est INCHANGÉ : c'est la garantie
 * « drapeau coupé = rendu identique ».
 */
async function buildLegacyGallery(
  options: GetKitHeroGalleryImagesOptions,
): Promise<{ images: HeroGalleryImage[]; primaryLevel: Extract<FallbackLevel, 7 | 8> }> {
  const productId = options.productId ?? 'kit-femiglow';
  const componentKey = options.componentKey ?? 'kit-hero-produit';
  const includeReviews = options.includeReviews ?? DEFAULTS.includeReviews;
  const maxReviewPhotos = options.maxReviewPhotos ?? DEFAULTS.maxReviewPhotos;
  const maxTotal = options.maxTotal ?? DEFAULTS.maxTotal;

  const out: HeroGalleryImage[] = [];
  let primaryLevel: Extract<FallbackLevel, 7 | 8> = 8;

  // 1. Slot primary (binding admin) — sinon fallback produit (product.images[0]).
  //    On garantit qu'une image produit reste TOUJOURS en première position
  //    pour rester aligné avec le brief Kolenda (packshot dominant).
  const primary = await resolveComponentSlot(componentKey, 'primary');
  const primaryImage = slotToImage(primary, 'product');
  if (primaryImage) {
    out.push(primaryImage);
    primaryLevel = 7;
  } else {
    const fallback = productFallbackImage(options.productFallback);
    if (fallback) out.push(fallback);
  }

  // 2. Slots contextuels
  for (const slotKey of ['context_1', 'context_2'] as const) {
    const ctx = await resolveComponentSlot(componentKey, slotKey);
    const ctxImage = slotToImage(ctx, 'context');
    if (ctxImage) out.push(ctxImage);
  }

  // 3. Photos clientes (review_photos) — en queue, jouent le rôle de
  //    vignettes secondaires (côté thumbnails desktop / slides mobile).
  if (includeReviews) {
    const reviewImages = await readReviewPhotos(productId, maxReviewPhotos);
    out.push(...reviewImages);
  }

  return { images: out.slice(0, maxTotal), primaryLevel };
}

function productFallbackImage(
  fallback: GetKitHeroGalleryImagesOptions['productFallback'],
): HeroGalleryImage | null {
  if (!fallback) return null;
  return {
    id: 'product-fallback',
    src: fallback.src,
    alt: fallback.alt,
    width: fallback.width,
    height: fallback.height,
    blurDataURL: fallback.blurDataURL,
    kind: 'product',
  };
}

/** Image « par audience » résolue → image de galerie (art direction comprise). */
function resolvedToGalleryImage(
  image: ResolvedMediaImage,
  kind: HeroGalleryImageKind,
): HeroGalleryImage {
  const out: HeroGalleryImage = {
    id: image.id,
    src: image.src,
    alt: image.alt,
    width: image.width,
    height: image.height,
    kind,
  };
  if (image.blurDataURL) out.blurDataURL = image.blurDataURL;
  const position = cssObjectPosition(image);
  if (position) out.objectPosition = position;
  if (image.mobile) {
    // Pas de `blurDataURL` mobile : un `<source>` ne porte pas de placeholder,
    // seul le flou desktop de l'image LCP est utilisé (cf. HeroPicture).
    out.mobile = {
      src: image.mobile.src,
      width: image.mobile.width,
      height: image.mobile.height,
    };
  }
  return out;
}

/** Point focal (%) prioritaire sur le cadrage nommé. */
function cssObjectPosition(
  image: Pick<ResolvedMediaImage, 'objectPosition' | 'focalX' | 'focalY'>,
): string | undefined {
  if (isPercent(image.focalX) && isPercent(image.focalY)) {
    return `${image.focalX}% ${image.focalY}%`;
  }
  return image.objectPosition ?? undefined;
}

function isPercent(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
}

/**
 * Lit les `product_review_photos` publiées d'un produit, triées par
 * `display_order`. Source = Drizzle en prod, memoryStore en dev/tests.
 */
async function readReviewPhotos(
  productId: string,
  limit: number,
): Promise<HeroGalleryImage[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(productReviewPhotos)
      .where(
        and(
          eq(productReviewPhotos.productId, productId),
          eq(productReviewPhotos.status, 'published'),
        ),
      )
      .orderBy(asc(productReviewPhotos.displayOrder))
      .limit(limit);
    return rows.map(rowToImage);
  }

  // memoryStore fallback (dev local, tests vitest)
  const all = Array.from(memoryStore().productReviewPhotos.values())
    .filter((p) => p.productId === productId && p.status === 'published')
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .slice(0, limit);
  return all.map(rowToImage);
}

/**
 * Convertit un `ResolvedComponentSlot` (Component-Media binding) en
 * `HeroGalleryImage`.
 *
 * Stratégie de résolution de l'URL (priorité décroissante) :
 *  1. Une variant grande taille (`xl`/`lg`) en `webp` (puis `avif`, puis `jpeg`).
 *     C'est la même approche que `MediaImage` côté server — sans la négociation
 *     `<picture>` multi-source qui nécessiterait un wrapper RSC.
 *  2. `originalUrl` si disponible (cas legacy / SVG fallback explicite).
 *  3. `null` — les slots contextuels sont optionnels, on les ignore silencieusement.
 *
 * Retourne `null` si pas de media actif.
 */
function slotToImage(
  resolved: Awaited<ReturnType<typeof resolveComponentSlot>>,
  kind: HeroGalleryImageKind,
  { withMediaMeta = false }: { withMediaMeta?: boolean } = {},
): HeroGalleryImage | null {
  if (!resolved?.media) return null;
  const m = resolved.media;
  const src = pickHeroVariantUrl(m) ?? m.originalUrl;
  if (!src) return null;
  const image: HeroGalleryImage = {
    id: `slot-${resolved.slot?.key ?? 'unknown'}-${m.id}`,
    src,
    alt: resolved.alt,
    width: m.originalWidth ?? 1200,
    height: m.originalHeight ?? 1500,
    blurDataURL: m.blurhash ? undefined : undefined, // TODO: dériver depuis blurhash
    kind,
  };
  // Galerie par audience uniquement (drapeau actif) : identifiant du média
  // et flou de chargement (`media.blur_data_url`). La galerie historique
  // reste inchangée octet pour octet (pas de placeholder ajouté).
  if (withMediaMeta) {
    image.mediaId = m.id;
    const blur = typeof m.blurDataUrl === 'string' ? m.blurDataUrl.trim() : '';
    if (blur) image.blurDataURL = blur;
  }
  return image;
}

function rowToImage(row: {
  id: string;
  src: string;
  alt: string;
  width: number;
  height: number;
  blurDataUrl: string | null;
  reviewerInitials: string | null;
  reviewerCity: string | null;
}): HeroGalleryImage {
  const caption = buildCaption(row.reviewerInitials, row.reviewerCity);
  return {
    id: `review-${row.id}`,
    src: row.src,
    alt: row.alt,
    width: row.width,
    height: row.height,
    blurDataURL: row.blurDataUrl ?? undefined,
    kind: 'review',
    caption,
  };
}

function buildCaption(initials: string | null, city: string | null): string | undefined {
  const parts = [initials, city].filter((p): p is string => !!p && p.trim().length > 0);
  return parts.length > 0 ? parts.join(' · ') : undefined;
}
