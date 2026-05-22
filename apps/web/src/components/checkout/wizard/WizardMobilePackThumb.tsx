/**
 * `WizardMobilePackThumb` — petite photo pack 64×80 dans le header
 * `KitCommanderSection` mobile (Kolenda §5 W3 P7).
 *
 * Affiché uniquement `< lg`. Desktop a déjà PackVisual à droite dans
 * la section pack au-dessus, donc thumb redondant sur grand écran.
 *
 * Server Component pur.
 */
/* eslint-disable @next/next/no-img-element */
import { cn } from '@/lib/utils/cn';

export interface WizardMobilePackThumbProps {
  src?: string;
  alt?: string;
  className?: string;
}

export function WizardMobilePackThumb({
  // Aligne par défaut sur l'image principale du hero (cohérence visuelle
  // top→bottom du tunnel). Le PNG est seedé via Component-Media slot
  // `kit-hero-produit/primary` ; le fallback PNG ici sert quand on rend
  // le composant hors contexte (tests, prévisualisation admin).
  src = '/products/kit-principale.png',
  alt = 'Pack FemiGlow',
  className,
}: WizardMobilePackThumbProps): JSX.Element {
  return (
    <div
      data-testid="wizard-mobile-pack-thumb"
      className={cn('shrink-0 lg:hidden', className)}
    >
      <img
        src={src}
        alt={alt}
        width={64}
        height={80}
        className="h-20 w-16 rounded object-cover"
      />
    </div>
  );
}
