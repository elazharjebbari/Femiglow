'use client';

import { cn } from '@/lib/utils/cn';

export interface HeroGalleryArrowProps {
  direction: 'prev' | 'next';
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

function ChevronIcon({ direction }: { direction: 'prev' | 'next' }): JSX.Element {
  const path = direction === 'prev' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6';
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="rtl:scale-x-[-1]"
    >
      <path d={path} />
    </svg>
  );
}

/**
 * Bouton flèche pour la navigation desktop de la galerie. Visibilité gérée
 * via Tailwind opacity au hover du parent (cf. HeroGallery).
 */
export function HeroGalleryArrow({
  direction,
  onClick,
  disabled,
  className,
}: HeroGalleryArrowProps): JSX.Element {
  const label = direction === 'prev' ? 'Image précédente' : 'Image suivante';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'absolute top-1/2 z-10 -translate-y-1/2',
        'flex h-10 w-10 items-center justify-center rounded-full',
        'bg-creme-warm/85 text-encre shadow-sm ring-1 ring-encre/10 backdrop-blur-sm',
        'transition-all duration-300 ease-out',
        'opacity-0 group-hover/gallery:opacity-100 focus-visible:opacity-100',
        'hover:bg-creme-warm hover:ring-encre/30',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A5D4A] focus-visible:ring-offset-2',
        'active:scale-95',
        'disabled:cursor-not-allowed disabled:opacity-30',
        direction === 'prev' ? 'start-3' : 'end-3',
        className,
      )}
    >
      <ChevronIcon direction={direction} />
    </button>
  );
}
