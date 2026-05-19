import { cn } from '@/lib/utils/cn';

export interface AttributeChipsProps {
  items: string[];
  ariaLabel?: string;
  className?: string;
}

/**
 * Pastilles d'attributs produit (« Sans vernis · Sans UV · Sans acétone ·
 * Halal »). Réponses aux requêtes mentales du visiteur, placées sous le
 * tagline du hero (Attention p. 53 — *goal-directed attention*).
 *
 * Composant pur (server-safe). Pas d'animation, pas d'interactivité — un
 * seul point focal par viewport (le CTA), les chips restent statiques.
 */
export function AttributeChips({
  items,
  ariaLabel = 'Attributs produit',
  className,
}: AttributeChipsProps): JSX.Element | null {
  if (!items || items.length === 0) return null;

  return (
    <ul
      aria-label={ariaLabel}
      className={cn('flex flex-wrap gap-2', className)}
    >
      {items.map((label) => (
        <li
          key={label}
          className={cn(
            'inline-flex items-center rounded-full',
            'border border-[#C7CCC2] bg-[#E8EDE3]',
            'px-3 py-1.5',
            'text-[12px] font-medium leading-none text-encre',
            'tracking-[0.01em]',
          )}
        >
          {label}
        </li>
      ))}
    </ul>
  );
}
