'use client';

/**
 * CHA-232 — Affichage du prix de livraison (avec mode "offerte").
 *
 * Quand `freeShipping=true` : le prix catalogue (FR : "19 MAD") est barré
 * en typo discrète, et un libellé "Offerte" en font-medium + couleur
 * champagne-dark vient le remplacer comme valeur principale. L'utilisateur
 * comprend immédiatement : « c'est cadeau ».
 *
 * Le span barré reste lisible en SR (lecteur d'écran lit "19 MAD, offerte")
 * pour ne pas perdre le contexte de la valeur initiale.
 *
 * Quand `freeShipping=false` : rendu standard du prix.
 *
 * Props
 * ─────
 * - `displayPrice` (string) : la valeur formatée (ex. "19 MAD", "40-60 MAD",
 *   "Gratuit", formatPrice(cents)). Le composant ne fait pas le formatting.
 * - `freeShipping` (boolean) : si vrai, barre `displayPrice` et affiche "Offerte".
 * - `size` (xs|sm|md) : variante d'échelle pour adapter à chaque surface.
 * - `align` (left|right) : alignement du contenu.
 * - `srNote` (optionnel) : précision pour SR (ex: "Livraison").
 */
import { cn } from '@/lib/utils/cn';

interface ShippingPriceDisplayProps {
  displayPrice: string;
  freeShipping: boolean;
  size?: 'xs' | 'sm' | 'md';
  align?: 'left' | 'right';
  srNote?: string;
  className?: string;
}

export function ShippingPriceDisplay({
  displayPrice,
  freeShipping,
  size = 'sm',
  align = 'left',
  srNote,
  className,
}: ShippingPriceDisplayProps) {
  if (!freeShipping) {
    return <span className={className}>{displayPrice}</span>;
  }

  const sizeClasses = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
  } as const;

  return (
    <span
      className={cn(
        'inline-flex items-baseline gap-2 whitespace-nowrap',
        align === 'right' && 'justify-end',
        className,
      )}
      data-free-shipping="true"
    >
      <span
        aria-hidden="true"
        className={cn(
          'line-through decoration-encre/40 decoration-[1px] text-encre/40',
          sizeClasses[size],
        )}
      >
        {displayPrice}
      </span>
      <span
        className={cn(
          'font-medium tracking-tight text-champagne-dark',
          sizeClasses[size],
        )}
      >
        Offerte
      </span>
      {srNote && <span className="sr-only">{srNote}.</span>}
    </span>
  );
}
