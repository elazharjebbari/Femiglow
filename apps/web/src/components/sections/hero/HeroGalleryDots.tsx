'use client';

import { cn } from '@/lib/utils/cn';

export interface HeroGalleryDotsProps {
  count: number;
  activeIndex: number;
  onSelect: (index: number) => void;
  className?: string;
}

/**
 * Indicateur dots pour la galerie mobile.
 *
 * Au-delà de 6 images on bascule en compteur texte "3 / 8" pour rester
 * lisible (UX p. 5-6 — show ≤ 4 options, cf. playbook §3.8).
 */
export function HeroGalleryDots({
  count,
  activeIndex,
  onSelect,
  className,
}: HeroGalleryDotsProps): JSX.Element | null {
  if (count <= 1) return null;

  if (count > 6) {
    return (
      <div
        className={cn(
          'flex items-center justify-center pt-3 text-[12px] tabular-nums text-encre/60',
          className,
        )}
        aria-live="polite"
      >
        <span className="font-medium text-encre/80">{activeIndex + 1}</span>
        <span className="mx-1">/</span>
        <span>{count}</span>
      </div>
    );
  }

  return (
    <div
      className={cn('flex items-center justify-center gap-3 pt-3', className)}
      role="tablist"
      aria-label="Sélecteur d'image"
    >
      {Array.from({ length: count }).map((_, i) => {
        const active = i === activeIndex;
        return (
          <button
            key={i}
            type="button"
            role="tab"
            aria-current={active ? 'true' : undefined}
            aria-selected={active}
            aria-label={`Voir l'image ${i + 1} sur ${count}`}
            onClick={() => onSelect(i)}
            className={cn(
              // zone de tap étendue (24px) avec dot visible 8px
              'group flex h-6 w-6 items-center justify-center',
              'cursor-pointer focus-visible:outline-none',
            )}
          >
            <span
              className={cn(
                'block h-2 w-2 rounded-full transition-colors duration-200',
                active ? 'bg-[#4A5D4A]' : 'bg-[#C7CCC2]',
                'group-focus-visible:ring-2 group-focus-visible:ring-[#4A5D4A] group-focus-visible:ring-offset-2',
                'group-active:scale-90',
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
