/**
 * Médias par audience — projection des lignes en DTO compact (pur).
 *
 * `listPublishedSetsWithMedia` renvoie les lignes complètes (ensemble +
 * items + `media` + TOUS ses variants). Mises telles quelles dans
 * `unstable_cache`, elles dépasseraient vite la limite de 2 Mo par entrée
 * (≈ 56 ensembles × 4 items × 2 médias × 15 variants) et leurs `Date`
 * reviendraient en chaînes sur un hit. On projette donc AVANT la mise en
 * cache vers `MediaSetDTO` : par item, l'URL déjà choisie (desktop et
 * mobile) avec ses dimensions et son flou, les alt, le cadrage ; par
 * ensemble, l'identité du tuple, la version, le statut et des dates ISO.
 *
 * cf. docs/hero-media-par-angle/05-architecture-technique.md §4.4
 */
import type {
  ComponentMediaSetItemWithMedia,
  ComponentMediaSetWithMedia,
  MediaSetMedia,
} from '@/lib/db/types';
import { pickHeroVariantUrl } from '@/lib/media/pick-variant';
import type { MediaSetDTO, MediaSetImageSource, MediaSetItemDTO } from './types';

/** Dimensions par défaut si l'original n'est pas renseigné (ratio 4:5, cf. galerie). */
export const DEFAULT_DESKTOP_SIZE = { width: 1200, height: 1500 } as const;
/** Dimensions par défaut de l'image mobile (ratio 3:4). */
export const DEFAULT_MOBILE_SIZE = { width: 1200, height: 1600 } as const;

/** URL affichable d'un média (variant hero, sinon original), ou `null`. */
export function mediaDisplayUrl(
  media: Pick<MediaSetMedia, 'originalUrl' | 'variants'> | null | undefined,
): string | null {
  if (!media) return null;
  return pickHeroVariantUrl(media) ?? media.originalUrl ?? null;
}

function nonEmpty(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function toIso(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toImageSource(
  media: MediaSetMedia | null | undefined,
  fallback: { width: number; height: number },
): MediaSetImageSource | null {
  const src = mediaDisplayUrl(media);
  if (!media || !src) return null;
  const out: MediaSetImageSource = {
    src,
    width: media.originalWidth ?? fallback.width,
    height: media.originalHeight ?? fallback.height,
  };
  const blur = nonEmpty(media.blurDataUrl);
  if (blur) out.blurDataURL = blur;
  return out;
}

export function toMediaSetItemDTO(item: ComponentMediaSetItemWithMedia): MediaSetItemDTO {
  return {
    setId: item.setId,
    position: item.position,
    desktop: toImageSource(item.media, DEFAULT_DESKTOP_SIZE),
    mobile: toImageSource(item.mobileMedia, DEFAULT_MOBILE_SIZE),
    alt: { ...(item.alt ?? {}) },
    mediaAlt: nonEmpty(item.media?.alt),
    objectPosition: item.objectPosition ?? null,
    focalX: item.focalX ?? null,
    focalY: item.focalY ?? null,
  };
}

export function toMediaSetDTO(set: ComponentMediaSetWithMedia): MediaSetDTO {
  return {
    id: set.id,
    slot: set.slot,
    variantDim: set.variantDim,
    variantKey: set.variantKey,
    locale: set.locale,
    crossLocale: set.crossLocale,
    version: set.version,
    status: set.status,
    publishedAt: toIso(set.publishedAt),
    updatedAt: toIso(set.updatedAt) ?? new Date(0).toISOString(),
    items: [...set.items].sort((a, b) => a.position - b.position).map(toMediaSetItemDTO),
  };
}

export function toMediaSetDTOs(sets: readonly ComponentMediaSetWithMedia[]): MediaSetDTO[] {
  return sets.map(toMediaSetDTO);
}
