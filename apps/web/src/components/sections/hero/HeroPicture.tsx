import NextImage from 'next/image';
import type { CSSProperties } from 'react';
import type { HeroGalleryImage } from '@/lib/products/hero-gallery-types';
import {
  HERO_PICTURE_MOBILE_MEDIA,
  fetchPriorityProps,
  heroPictureSources,
} from './hero-picture-props';

export interface HeroPictureProps {
  image: HeroGalleryImage;
  /**
   * Image LCP : `fetchPriority="high"` + chargement immédiat. Seule l'image
   * d'index 0 doit la recevoir ; les autres sont en `loading="lazy"`.
   */
  priority?: boolean;
  /**
   * `sizes` du rendu classique (sans art direction). Ignoré quand l'image a
   * une version mobile : les `sizes` sont alors constants
   * (`hero-picture-props.ts`) pour que les arbres mobile et desktop de la
   * galerie produisent le même `<picture>` et partagent la requête.
   */
  sizes: string;
}

/**
 * Image de la galerie hero, à placer dans un conteneur positionné
 * (`relative` + ratio) : l'image le remplit (`fill`, `object-cover`).
 *
 *  - Sans `image.mobile` : EXACTEMENT le `next/image` historique (mêmes
 *    attributs, même preload automatique en `priority`) — drapeau « images
 *    par audience » coupé = HTML inchangé.
 *  - Avec `image.mobile` (art direction) :
 *    `<picture><source media="(max-width: 1023px)" …mobile 3:4/><img …desktop 4:5/></picture>`
 *    via `getImageProps`. Le choix est fait par le navigateur dès le HTML
 *    initial (scanner de préchargement), jamais en JS : pas de flash ni de
 *    LCP retardé. Le preload explicite est émis côté serveur par
 *    `HeroProduitBound`.
 *
 * cf. docs/hero-media-par-angle/05-architecture-technique.md §4.5
 */
export function HeroPicture({ image, priority = false, sizes }: HeroPictureProps): JSX.Element {
  const positionStyle: CSSProperties | undefined = image.objectPosition
    ? { objectPosition: image.objectPosition }
    : undefined;

  const sources = heroPictureSources(image, { priority });
  if (!sources) {
    return (
      <NextImage
        src={image.src}
        alt={image.alt}
        fill
        priority={priority}
        sizes={sizes}
        placeholder={image.blurDataURL ? 'blur' : 'empty'}
        blurDataURL={image.blurDataURL}
        className="object-cover"
        {...(positionStyle ? { style: positionStyle } : {})}
      />
    );
  }

  const { desktop, mobile } = sources;
  const { fetchPriority, ...desktopRest } = desktop;
  return (
    <picture data-hero-picture="art-direction">
      <source
        media={HERO_PICTURE_MOBILE_MEDIA}
        srcSet={mobile.srcSet ?? mobile.src}
        sizes={mobile.sizes}
      />
      {/* `<img>` brut : `next/image` ne sait pas produire de `<picture>` ;
          `getImageProps` fournit les mêmes attributs optimisés (srcset,
          loader, lazy/priority). */}
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
      <img
        {...desktopRest}
        {...fetchPriorityProps(fetchPriority)}
        className="object-cover"
        style={positionStyle ? { ...desktop.style, ...positionStyle } : desktop.style}
      />
    </picture>
  );
}

