import { cn } from '@/lib/utils/cn';

export interface RecommendationProofProps {
  /** Avis qui recommandent le Pack (« oui »). */
  recommendCount: number;
  /** Total des avis approuvés (base du pourcentage). */
  reviewsCount: number;
  /** Avis liés à un achat vérifié ; masqué si 0 / absent. */
  verifiedCount?: number;
  /** Ancre du mur d'avis. */
  href: string;
  strings: {
    /** « 82 % recommandent le Pack » (déjà formaté). */
    recommend: string;
    /** « 51 avis ». */
    reviews: string;
    /** « 36 achats vérifiés ». */
    verified?: string;
    /** « Lire les avis ». */
    readReviews: string;
    ariaLabel: string;
  };
  className?: string;
}

/** Pourcentage entier de recommandation, borné 0–100. */
export function recommendationPct(recommendCount: number, reviewsCount: number): number {
  if (reviewsCount <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((recommendCount / reviewsCount) * 100)));
}

/**
 * Preuve sociale du hero, en chiffres RÉELS (module rituels) : part des
 * clientes qui recommandent le Pack, nombre d'avis, achats vérifiés, et une
 * invitation à lire les avis. Pas d'étoiles : aucune note n'est collectée,
 * on n'en invente pas.
 *
 * Lecture d'un coup d'œil : jauge circulaire sauge (= le pourcentage) avec
 * une coche, chiffre fort en encre, détail en secondaire, lien sauge foncé.
 * Couleurs de la charte (tokens `sauge*`, `encre`) ; flèche retournée en RTL.
 */
export function RecommendationProof({
  recommendCount,
  reviewsCount,
  verifiedCount,
  href,
  strings,
  className,
}: RecommendationProofProps): JSX.Element {
  const pct = recommendationPct(recommendCount, reviewsCount);
  const r = 16;
  const circumference = 2 * Math.PI * r;
  const dash = (pct / 100) * circumference;

  return (
    <a
      href={href}
      aria-label={strings.ariaLabel}
      data-testid="recommendation-proof"
      className={cn(
        'group inline-flex max-w-full items-center gap-3 rounded-2xl border border-sauge-soft bg-sauge-soft/40 py-2.5 pe-4 ps-2.5',
        'transition-colors duration-200 hover:border-sauge hover:bg-sauge-soft/70',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sauge-dark',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="relative flex h-10 w-10 shrink-0 items-center justify-center"
      >
        <svg viewBox="0 0 40 40" width="40" height="40" className="-rotate-90" focusable="false">
          <circle cx="20" cy="20" r={r} fill="none" stroke="var(--color-sauge)" strokeWidth="3.5" />
          <circle
            cx="20"
            cy="20"
            r={r}
            fill="none"
            stroke="var(--color-sauge-dark)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            data-testid="recommendation-gauge"
          />
        </svg>
        <svg
          viewBox="0 0 16 16"
          width="14"
          height="14"
          className="absolute text-sauge-dark"
          focusable="false"
        >
          <path
            d="M4 8.4l2.6 2.6 5.4-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>

      <span className="flex min-w-0 flex-col gap-0.5 leading-tight">
        <span className="text-[15px] font-semibold tabular-nums text-encre">
          {strings.recommend}
        </span>
        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12.5px] text-encre/70">
          <span className="tabular-nums">{strings.reviews}</span>
          {verifiedCount && verifiedCount > 0 && strings.verified ? (
            <>
              <span aria-hidden="true" className="text-encre/30">
                ·
              </span>
              <span className="tabular-nums">{strings.verified}</span>
            </>
          ) : null}
          {/* Mobile : « Lire les avis » sur sa propre ligne, sans séparateur ;
              ≥ sm : même ligne, séparé par « · » (jamais orphelin). */}
          <span className="inline-flex basis-full items-center gap-1.5 whitespace-nowrap sm:basis-auto">
            <span aria-hidden="true" className="hidden text-encre/30 sm:inline">
              ·
            </span>
            <span className="inline-flex items-center gap-1 font-medium text-sauge-dark underline-offset-4 group-hover:underline">
              {strings.readReviews}
              <svg
                viewBox="0 0 16 16"
                width="12"
                height="12"
                aria-hidden="true"
                focusable="false"
                className="transition-transform duration-200 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
              >
                <path
                  d="M3 8h9M8.5 4.5L12 8l-3.5 3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </span>
        </span>
      </span>
    </a>
  );
}
