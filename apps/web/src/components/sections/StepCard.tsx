/**
 * `StepCard` — un geste du rituel : pastille numérotée, titre, durée,
 * consigne en une phrase.
 *
 * La pastille porte le numéro (l'ordre est l'information utile) ; le geste
 * final (`isResult`) a une pastille pleine et une pastille « Résultat ».
 * Les couleurs n'utilisent que des jetons pleins de la charte : les variantes
 * transparentes (`text-encre/70`, `ring-…/15`) ne sont pas générées, les
 * jetons étant des variables CSS.
 *
 * Server Component pur — aucune dépendance navigateur.
 */
import { cn } from '@/lib/utils/cn';
import type { FeedAccent, ProductFeedStep } from '@/lib/products/feed/types';

const accentDot: Record<FeedAccent, string> = {
  sauge: 'bg-sauge-soft text-sauge-dark',
  petale: 'bg-petale-soft text-petale-dark',
  champagne: 'bg-champagne-soft text-champagne-dark',
  ciel: 'bg-ciel-soft text-ciel-dark',
};

const accentDotResult: Record<FeedAccent, string> = {
  sauge: 'bg-sauge-dark text-creme',
  petale: 'bg-petale-dark text-creme',
  champagne: 'bg-champagne-dark text-creme',
  ciel: 'bg-ciel-dark text-creme',
};

export interface StepCardProps {
  step: ProductFeedStep;
  /** Libellé localisé de la pastille « Résultat ». Défaut FR. */
  resultLabel?: string;
}

export function StepCard({ step, resultLabel = 'Résultat' }: StepCardProps): JSX.Element {
  return (
    <article
      data-testid={`step-card-${step.step}`}
      data-step={step.step}
      data-is-result={step.isResult ? 'true' : undefined}
      className="flex gap-4 lg:flex-col lg:gap-5"
    >
      <span
        aria-hidden="true"
        data-testid={`step-dot-${step.step}`}
        className={cn(
          'relative z-10 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-body text-[15px] font-semibold leading-none tabular-nums',
          step.isResult ? accentDotResult[step.accent] : accentDot[step.accent],
        )}
      >
        {step.step}
      </span>
      <div className="min-w-0 flex-1 pt-1 lg:pt-0">
        <h4 className="font-display text-[1.375rem] font-medium leading-[1.2] text-encre [text-wrap:balance]">
          {step.title}
        </h4>
        {(step.duration || step.isResult) && (
          <p className="mt-1.5 flex flex-wrap items-center gap-2 font-body text-[13px] font-medium text-encre-soft">
            {step.duration && (
              <span data-testid={`step-duration-${step.step}`} className="tabular-nums">
                {step.duration}
              </span>
            )}
            {step.isResult && (
              <span
                data-testid={`step-badge-${step.step}`}
                className="inline-flex items-center rounded-full border border-champagne bg-creme px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.12em] text-champagne-dark"
              >
                {resultLabel}
              </span>
            )}
          </p>
        )}
        <p
          className={cn(
            'mt-2 font-body text-[15px] leading-[1.6]',
            step.isResult ? 'text-encre' : 'text-encre-soft',
          )}
        >
          {step.description}
        </p>
      </div>
    </article>
  );
}
