import { Fragment } from 'react';
import { cn } from '@/lib/utils/cn';

export interface TrustRowProps {
  items: string[];
  separator?: string;
  className?: string;
}

/**
 * Ligne de réassurance horizontale : `Livraison offerte · Paiement à la
 * livraison · Retour 30 jours`.
 *
 * Placée AU-DESSUS du CTA (Copywriting p. 17 — *mots positifs collés au
 * CTA*) pour être lue avant la décision de clic. Casse normale (pas de
 * MAJUSCULES criardes), 13 px, opacity contrôlée par le caller via
 * className si besoin (default: text-encre/70).
 */
export function TrustRow({
  items,
  separator = '·',
  className,
}: TrustRowProps): JSX.Element | null {
  if (!items || items.length === 0) return null;

  return (
    <p
      className={cn(
        'flex flex-wrap items-center gap-x-2 gap-y-1',
        'text-[13px] leading-snug text-encre/70',
        'tracking-[0.005em]',
        className,
      )}
    >
      {items.map((item, i) => (
        <Fragment key={item}>
          {i > 0 ? (
            <span aria-hidden="true" className="text-encre/35">
              {separator}
            </span>
          ) : null}
          <span>{item}</span>
        </Fragment>
      ))}
    </p>
  );
}
