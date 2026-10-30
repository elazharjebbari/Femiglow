/**
 * Médias par audience — conversion des items (DTO) en images affichables (pur).
 *
 *  - Alt par langue : `alt[locale]` > `media.alt` (en `fr` uniquement : la
 *    médiathèque est rédigée en français, elle ne doit pas fuiter en AR/EN)
 *    > `fallbackAlt` (fourni par l'appelant, déjà localisé).
 *  - Art direction : `mobileMedia` (3:4) exposé dans `mobile` s'il est
 *    affichable ; sinon l'image desktop sert partout.
 *  - Flou de chargement : `media.blurDataUrl` (colonne `blur_data_url`),
 *    déjà recopié dans le DTO à la projection (`dto.ts`).
 *
 * cf. docs/hero-media-par-angle/05-architecture-technique.md §4.4–4.5
 */
import type { Locale } from '@/i18n.config';
import type { MediaSetItemDTO, ResolvedMediaImage } from './types';

export interface ToResolvedImagesOptions {
  locale: Locale;
  /** Alt de dernier recours (ex. nom du produit dans la langue de la page). */
  fallbackAlt?: string;
}

function nonEmpty(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

/** Alt effectif d'un item pour la langue demandée. */
export function resolveItemAlt(item: MediaSetItemDTO, locale: Locale, fallbackAlt?: string): string {
  return (
    nonEmpty(item.alt?.[locale]) ??
    (locale === 'fr' ? nonEmpty(item.mediaAlt) : null) ??
    nonEmpty(fallbackAlt) ??
    ''
  );
}

/**
 * Convertit les items d'un ensemble sélectionné en images. Les items sans
 * image desktop affichable sont ignorés (déjà filtrés par `selectMediaSet`).
 */
export function toResolvedImages(
  items: readonly MediaSetItemDTO[],
  { locale, fallbackAlt }: ToResolvedImagesOptions,
): ResolvedMediaImage[] {
  const out: ResolvedMediaImage[] = [];
  for (const item of items) {
    const desktop = item.desktop;
    if (!desktop) continue;
    const image: ResolvedMediaImage = {
      id: `mset-${item.setId}-${item.position}`,
      src: desktop.src,
      width: desktop.width,
      height: desktop.height,
      alt: resolveItemAlt(item, locale, fallbackAlt),
    };
    if (desktop.blurDataURL) image.blurDataURL = desktop.blurDataURL;
    if (item.objectPosition) image.objectPosition = item.objectPosition;
    if (item.focalX !== null && item.focalX !== undefined) image.focalX = item.focalX;
    if (item.focalY !== null && item.focalY !== undefined) image.focalY = item.focalY;

    if (item.mobile) {
      const mobile: NonNullable<ResolvedMediaImage['mobile']> = {
        src: item.mobile.src,
        width: item.mobile.width,
        height: item.mobile.height,
      };
      if (item.mobile.blurDataURL) mobile.blurDataURL = item.mobile.blurDataURL;
      image.mobile = mobile;
    }
    out.push(image);
  }
  return out;
}
