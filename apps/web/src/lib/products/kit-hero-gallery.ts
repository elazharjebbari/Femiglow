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
import type { HeroGalleryImage, HeroGalleryImageKind } from './hero-gallery-types';

export type { HeroGalleryImage, HeroGalleryImageKind } from './hero-gallery-types';

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
 * Construit la liste d'images affichées dans la galerie hero du kit.
 *
 * Ordre de priorité :
 *  1. Slot `primary` (packshot principal) — toujours en première position si binding actif.
 *  2. Slots `context_1` et `context_2` (si bindings actifs).
 *  3. Photos clientes (`product_review_photos`, status='published', ORDER BY display_order ASC).
 *
 * Le fallback pour le slot `primary` (cas où aucun binding n'est défini) est
 * géré par le composant caller (`HeroProduitBound`) via `product.images[0]`.
 * On ne le gère pas ici pour rester pur.
 */
export async function getKitHeroGalleryImages(
  options: GetKitHeroGalleryImagesOptions = {},
): Promise<HeroGalleryImage[]> {
  const productId = options.productId ?? 'kit-femiglow';
  const componentKey = options.componentKey ?? 'kit-hero-produit';
  const includeReviews = options.includeReviews ?? DEFAULTS.includeReviews;
  const maxReviewPhotos = options.maxReviewPhotos ?? DEFAULTS.maxReviewPhotos;
  const maxTotal = options.maxTotal ?? DEFAULTS.maxTotal;

  const out: HeroGalleryImage[] = [];

  // 1. Slot primary (binding admin) — sinon fallback produit (product.images[0]).
  //    On garantit qu'une image produit reste TOUJOURS en première position
  //    pour rester aligné avec le brief Kolenda (packshot dominant).
  const primary = await resolveComponentSlot(componentKey, 'primary');
  const primaryImage = slotToImage(primary, 'product');
  if (primaryImage) {
    out.push(primaryImage);
  } else if (options.productFallback) {
    out.push({
      id: 'product-fallback',
      src: options.productFallback.src,
      alt: options.productFallback.alt,
      width: options.productFallback.width,
      height: options.productFallback.height,
      blurDataURL: options.productFallback.blurDataURL,
      kind: 'product',
    });
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

  return out.slice(0, maxTotal);
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
): HeroGalleryImage | null {
  if (!resolved?.media) return null;
  const m = resolved.media;
  const src = pickHeroVariantUrl(m) ?? m.originalUrl;
  if (!src) return null;
  return {
    id: `slot-${resolved.slot?.key ?? 'unknown'}-${m.id}`,
    src,
    alt: resolved.alt,
    width: m.originalWidth ?? 1200,
    height: m.originalHeight ?? 1500,
    blurDataURL: m.blurhash ? undefined : undefined, // TODO: dériver depuis blurhash
    kind,
  };
}

/**
 * Pick une variant adaptée au hero (priorité décroissante) :
 * `xl` > `lg` > `md` > `sm` > `xs`, format `webp` > `avif` > `jpeg`.
 *
 * Pourquoi `webp` en premier ? Universal browser support (95 %+ Q4 2026), et
 * pas besoin de logique de négociation côté client (`MediaImage` server faisait
 * `<picture><source>` pour AVIF, mais on est en client component ici).
 */
function pickHeroVariantUrl(media: NonNullable<Awaited<ReturnType<typeof resolveComponentSlot>>>['media']): string | null {
  if (!media) return null;
  const variants = (media as { variants?: Array<{ url: string; breakpoint: string | null; format: string }> }).variants;
  if (!variants || variants.length === 0) return null;
  const sizes = ['xl', 'lg', 'md', 'sm', 'xs'];
  const formats = ['webp', 'avif', 'jpeg'];
  for (const size of sizes) {
    for (const format of formats) {
      const v = variants.find((x) => x.breakpoint === size && x.format === format);
      if (v?.url) return v.url;
    }
  }
  // Aucun match strict — premier variant disponible.
  return variants[0]?.url ?? null;
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
