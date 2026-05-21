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
  src = '/products/kit-principale.svg',
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
