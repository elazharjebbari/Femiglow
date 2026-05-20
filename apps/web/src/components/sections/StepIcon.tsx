/**
 * `StepIcon` — pictogramme SVG inline stroke 1.5 affiché au-dessus de
 * la pastille numérotée (Kolenda §4.7 — Ecom #6 « show, don't tell »).
 *
 * 4 icônes figées :
 *  - `buffer`  : étape de limage / préparation (rectangle strié)
 *  - `drop`    : application d'un soin (goutte)
 *  - `sparkle` : étape qui lustre la lumière (étoile à 4 branches)
 *  - `mirror`  : résultat miroir final (cercle avec reflet)
 *
 * Cohérent avec la grammaire des claims `leaf/drop/sparkle` (même
 * `viewBox`, même stroke). Server Component pur — `aria-hidden`.
 */
import type { ProductFeedStepIcon } from '@/lib/products/feed/types';

export interface StepIconProps {
  name: ProductFeedStepIcon;
  className?: string;
}

export function StepIcon({ name, className }: StepIconProps): JSX.Element {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    className,
    'data-testid': `step-icon-${name}`,
  };

  if (name === 'buffer') {
    return (
      <svg {...common}>
        <rect x="3" y="9" width="18" height="6" rx="1.2" />
        <line x1="3" y1="11.2" x2="21" y2="11.2" />
        <line x1="3" y1="12.5" x2="21" y2="12.5" />
        <line x1="3" y1="13.8" x2="21" y2="13.8" />
      </svg>
    );
  }
  if (name === 'drop') {
    return (
      <svg {...common}>
        <path d="M12 3.5s6 6.5 6 11a6 6 0 1 1-12 0c0-4.5 6-11 6-11Z" />
      </svg>
    );
  }
  if (name === 'sparkle') {
    return (
      <svg {...common}>
        <path d="M12 4v4M12 16v4M4 12h4M16 12h4" />
        <path d="M7.5 7.5l2.2 2.2M14.3 14.3l2.2 2.2M16.5 7.5l-2.2 2.2M9.7 14.3l-2.2 2.2" />
      </svg>
    );
  }
  // mirror
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="7" />
      <path d="M9 10.5c.8-1.4 2.3-2 3.6-1.7" />
      <circle cx="9.5" cy="11" r="0.6" fill="currentColor" />
    </svg>
  );
}
