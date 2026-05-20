/**
 * `PackVisual` — packshot dans la section « Le Pack » (Kolenda §4.6).
 *
 * Server Component pur — sert le SVG produit officiel
 * `/products/kit-principale.svg` (ou une variante via prop) en gardant
 * un aspect-ratio 4/5 portrait et un loading="lazy" (le visuel est sous
 * le fold initial sur mobile).
 */
import { cn } from '@/lib/utils/cn';

export interface PackVisualProps {
  /** Chemin source. Défaut : `/products/kit-principale.svg`. */
  src?: string;
  /** Texte alternatif obligatoire — a11y. */
  alt: string;
  /** Classes additionnelles sur le wrapper. */
  className?: string;
}

export function PackVisual({
  src = '/products/kit-principale.svg',
  alt,
  className,
}: PackVisualProps): JSX.Element {
  return (
    <figure
      data-testid="pack-visual"
      data-src={src}
      className={cn(
        'mx-auto aspect-[4/5] w-full max-w-md overflow-hidden rounded-md bg-creme-warm/30',
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-contain"
      />
    </figure>
  );
}
