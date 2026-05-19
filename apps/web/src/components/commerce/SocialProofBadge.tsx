import { cn } from '@/lib/utils/cn';

export interface SocialProofBadgeProps {
  rating: number;
  reviewsCount: number;
  /** Si fourni, le badge devient un lien vers cette ancre. */
  href?: string;
  size?: 'sm' | 'md';
  ariaLabel?: string;
  className?: string;
}

/**
 * Badge social proof : `★★★★⯨  4,8/5 · 287 avis`.
 *
 * Étoiles en or poudré `#B8956B`, texte tabular-nums pour précision.
 * Note rendue en format FR (virgule décimale).
 *
 * Volontairement non-cliquable par défaut (`href` undefined) — on évite
 * la sortie du tunnel de décision dans le hero. Un caller peut le rendre
 * cliquable pour les sections où c'est pertinent (footer reviews, etc.).
 */
export function SocialProofBadge({
  rating,
  reviewsCount,
  href,
  size = 'md',
  ariaLabel,
  className,
}: SocialProofBadgeProps): JSX.Element {
  const clampedRating = clamp(rating, 0, 5);
  const ratingFr = formatRatingFr(clampedRating);
  const reviewsLabel = `${reviewsCount} ${reviewsCount === 1 ? 'avis' : 'avis'}`;
  const label =
    ariaLabel ??
    `Note ${ratingFr} sur 5 basée sur ${reviewsCount} ${reviewsCount === 1 ? 'avis' : 'avis'}`;

  const content = (
    <>
      <StarRow rating={clampedRating} size={size} />
      <span className="tabular-nums">{ratingFr}/5</span>
      <span aria-hidden="true" className="text-encre/40">
        ·
      </span>
      <span className="tabular-nums">{reviewsLabel}</span>
    </>
  );

  const wrapperClass = cn(
    'inline-flex items-center gap-2',
    size === 'sm' ? 'text-[12px]' : 'text-[13px]',
    'font-medium text-encre',
    'tracking-[0.01em]',
    className,
  );

  if (href) {
    return (
      <a
        href={href}
        aria-label={label}
        className={cn(wrapperClass, 'transition-opacity hover:opacity-80')}
      >
        {content}
      </a>
    );
  }

  return (
    <span aria-label={label} className={wrapperClass}>
      {content}
    </span>
  );
}

function StarRow({ rating, size }: { rating: number; size: 'sm' | 'md' }): JSX.Element {
  const stars = computeStars(rating);
  const dimension = size === 'sm' ? 12 : 14;

  return (
    <span aria-hidden="true" className="inline-flex items-center gap-0.5">
      {stars.map((fill, i) => (
        <Star key={i} fill={fill} size={dimension} dataTestId="proof-star" />
      ))}
    </span>
  );
}

interface StarProps {
  fill: 'full' | 'half' | 'empty';
  size: number;
  dataTestId: string;
}

function Star({ fill, size, dataTestId }: StarProps): JSX.Element {
  const gold = '#B8956B';
  const empty = '#C7CCC2';

  if (fill === 'half') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        data-testid={dataTestId}
        data-fill="half"
        focusable="false"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="half-star-gradient">
            <stop offset="50%" stopColor={gold} />
            <stop offset="50%" stopColor={empty} />
          </linearGradient>
        </defs>
        <path
          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"
          fill="url(#half-star-gradient)"
        />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      data-testid={dataTestId}
      data-fill={fill}
      focusable="false"
      aria-hidden="true"
    >
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"
        fill={fill === 'full' ? gold : empty}
      />
    </svg>
  );
}

function computeStars(rating: number): Array<'full' | 'half' | 'empty'> {
  const out: Array<'full' | 'half' | 'empty'> = [];
  for (let i = 1; i <= 5; i++) {
    const diff = rating - (i - 1);
    if (diff >= 0.75) out.push('full');
    else if (diff >= 0.25) out.push('half');
    else out.push('empty');
  }
  return out;
}

function formatRatingFr(value: number): string {
  // Arrondi à 1 décimale, format FR (virgule)
  const rounded = Math.round(value * 10) / 10;
  return rounded.toString().replace('.', ',');
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
