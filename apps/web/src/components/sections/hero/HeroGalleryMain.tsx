'use client';

import NextImage from 'next/image';
import { cn } from '@/lib/utils/cn';
import type { HeroGalleryImage } from '@/lib/products/hero-gallery-types';

export interface HeroGalleryMainProps {
  image: HeroGalleryImage;
  priority?: boolean;
  /** Sizes passé au composant `next/image`. */
  sizes?: string;
  className?: string;
  /** Ratio CSS personnalisé. Default '4/5'. */
  aspectRatio?: string;
}

/**
 * Image principale de la galerie. Composant purement déclaratif : aucun
 * useState, aucun useEffect — le swap d'image est piloté par le parent via
 * le `key` de React (remount complet à chaque image, ce qui re-déclenche
 * l'animation CSS keyframe `heroSwapIn` définie dans globals.css).
 *
 * Conserver le composant pur évite tout hydration mismatch entre SSR et
 * client. L'animation est désactivée auto sous `prefers-reduced-motion`
 * via la règle `@media` dans globals.css.
 */
export function HeroGalleryMain({
  image,
  priority = false,
  sizes = '(min-width: 1024px) 40vw, 100vw',
  className,
  aspectRatio = '4 / 5',
}: HeroGalleryMainProps): JSX.Element {
  return (
    <figure
      className={cn(
        'relative w-full overflow-hidden rounded-md bg-[#E8EDE3]',
        className,
      )}
      style={{ aspectRatio }}
    >
      <NextImage
        src={image.src}
        alt={image.alt}
        fill
        priority={priority}
        sizes={sizes}
        placeholder={image.blurDataURL ? 'blur' : 'empty'}
        blurDataURL={image.blurDataURL}
        className="object-cover"
      />
      {image.caption ? (
        <figcaption className="absolute bottom-2 right-2 rounded-full bg-encre/70 px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-creme-warm">
          {image.caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
