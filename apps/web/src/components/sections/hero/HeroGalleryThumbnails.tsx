'use client';

import { cn } from '@/lib/utils/cn';
import type { HeroGalleryImage } from '@/lib/products/hero-gallery-types';

export interface HeroGalleryThumbnailsProps {
  images: HeroGalleryImage[];
  currentIndex: number;
  onSelect: (index: number) => void;
  className?: string;
}

/**
 * Colonne verticale de vignettes pour la version desktop. Affiche les 6
 * premières images en hauteur ; au-delà, scroll vertical interne (rare en
 * pratique — la galerie est cappée à 7 par défaut).
 */
export function HeroGalleryThumbnails({
  images,
  currentIndex,
  onSelect,
  className,
}: HeroGalleryThumbnailsProps): JSX.Element | null {
  if (images.length <= 1) return null;

  return (
    <ul
      className={cn(
        'flex max-h-[600px] flex-col gap-3 overflow-y-auto pe-1',
        '[scrollbar-width:thin] [&::-webkit-scrollbar]:w-1',
        '[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-encre/15',
        className,
      )}
      aria-label="Vignettes produit"
    >
      {images.map((img, i) => {
        const active = i === currentIndex;
        return (
          <li key={img.id} className="shrink-0">
            <button
              type="button"
              aria-current={active ? 'true' : undefined}
              aria-label={`Voir l'image ${i + 1} sur ${images.length}${img.kind === 'review' ? ' (photo cliente)' : ''}`}
              onClick={() => onSelect(i)}
              className={cn(
                'group relative block aspect-[4/5] w-16 overflow-hidden rounded',
                'transition-all duration-200',
                active
                  ? 'ring-2 ring-[#4A5D4A] ring-offset-2 ring-offset-creme-warm'
                  : 'ring-1 ring-[#C7CCC2] hover:ring-[#4A5D4A]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A5D4A] focus-visible:ring-offset-2',
                'active:scale-[0.97]',
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.src}
                alt=""
                aria-hidden="true"
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
              />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
