/**
 * `FeedClaims` — les trois promesses du kit, sous le mode d'emploi.
 *
 * Mobile : trois lignes alignées au début (pictogramme, promesse, détail),
 * séparées par un filet — se lit d'un coup d'œil, sans bloc centré à
 * rallonge. À partir de `sm` : trois colonnes.
 * Server Component pur.
 */
import { cn } from '@/lib/utils/cn';
import type { ProductFeedClaim } from '@/lib/products/feed/types';

const iconTone: Record<ProductFeedClaim['icon'], string> = {
  leaf: 'bg-sauge-soft text-sauge-dark',
  drop: 'bg-ciel-soft text-ciel-dark',
  sparkle: 'bg-petale-soft text-petale-dark',
};

export interface FeedClaimsProps {
  claims: ProductFeedClaim[];
  /** Nom accessible de la liste. */
  ariaLabel?: string;
}

export function FeedClaims({
  claims,
  ariaLabel = 'Promesses produit',
}: FeedClaimsProps): JSX.Element {
  return (
    <ul
      role="list"
      aria-label={ariaLabel}
      data-testid="feed-claims"
      className="mt-10 grid grid-cols-1 divide-y divide-champagne-soft border-y border-champagne-soft sm:mt-14 sm:grid-cols-3 sm:gap-8 sm:divide-y-0 sm:py-8"
    >
      {claims.map((claim) => (
        <li
          key={claim.icon}
          data-testid={`feed-claim-${claim.icon}`}
          className="flex items-start gap-4 py-5 text-start sm:py-0"
        >
          <span
            aria-hidden="true"
            className={cn(
              'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
              iconTone[claim.icon],
            )}
          >
            <FeedClaimIcon name={claim.icon} />
          </span>
          <div className="min-w-0">
            <p className="font-body text-base font-medium leading-[1.35] text-encre">
              {claim.label}
            </p>
            <p className="mt-1 font-body text-sm leading-[1.5] text-encre-soft">
              {claim.detail}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Pictogrammes au trait fin, décoratifs (le libellé porte le sens). */
function FeedClaimIcon({ name }: { name: ProductFeedClaim['icon'] }): JSX.Element {
  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  if (name === 'leaf') {
    return (
      <svg {...common}>
        <path d="M5 19c8 0 14-6 14-14-7 0-14 5-14 14Z" />
        <path d="M5 19c4-4 7-7 12-12" />
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
  return (
    <svg {...common}>
      <path d="M12 4v4M12 16v4M4 12h4M16 12h4" />
      <path d="M7.5 7.5l2.2 2.2M14.3 14.3l2.2 2.2M16.5 7.5l-2.2 2.2M9.7 14.3l-2.2 2.2" />
    </svg>
  );
}
