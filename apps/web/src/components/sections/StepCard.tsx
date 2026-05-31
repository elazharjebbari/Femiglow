/**
 * `StepCard` — carte d'une étape du rituel 4 gestes (Kolenda §4.7).
 *
 * Refonte du `FeedStepCard` inline historique :
 *  - pastille numérotée colorée (palette FemiGlow)
 *  - badge durée (« · 30 s ») si `duration` présente
 *  - anneau doublé + badge « RÉSULTAT » + italique sur le step `isResult`
 *  - icône SVG optionnelle au-dessus de la pastille (rendue en G3)
 *
 * Server Component pur — aucune dépendance navigateur.
 */
import { Heading } from '@/components/ui/Heading';
import { Kicker } from '@/components/ui/Kicker';
import { Text } from '@/components/ui/Text';
import { StepIcon } from '@/components/sections/StepIcon';
import { cn } from '@/lib/utils/cn';
import type { FeedAccent, ProductFeedStep } from '@/lib/products/feed/types';

const accentDot: Record<FeedAccent, string> = {
  sauge: 'bg-sauge-soft text-sauge-dark ring-1 ring-sauge-dark/15',
  petale: 'bg-petale-soft text-petale-dark ring-1 ring-petale-dark/15',
  champagne:
    'bg-champagne-soft text-champagne-dark ring-1 ring-champagne-dark/15',
  ciel: 'bg-ciel-soft text-ciel-dark ring-1 ring-ciel-dark/15',
};

const accentResultRing: Record<FeedAccent, string> = {
  sauge: 'ring-2 ring-sauge-dark/30',
  petale: 'ring-2 ring-petale-dark/30',
  champagne: 'ring-2 ring-champagne-dark/30',
  ciel: 'ring-2 ring-ciel-dark/30',
};

export interface StepCardProps {
  step: ProductFeedStep;
  /** Phase 9bis — libellé du badge « Résultat » localisé. Défaut FR. */
  resultLabel?: string;
}

export function StepCard({ step, resultLabel = 'Résultat' }: StepCardProps): JSX.Element {
  return (
    <article
      data-testid={`step-card-${step.step}`}
      data-step={step.step}
      data-is-result={step.isResult ? 'true' : undefined}
      className="flex h-full flex-col gap-3"
    >
      {step.icon && (
        <StepIcon name={step.icon} className="h-6 w-6 text-encre/55" />
      )}
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={cn(
            'inline-flex h-12 w-12 items-center justify-center rounded-full font-display text-xl',
            accentDot[step.accent],
            step.isResult && accentResultRing[step.accent],
          )}
        >
          {step.step}
        </span>
        {step.duration && (
          <span
            data-testid={`step-duration-${step.step}`}
            className="inline-flex items-baseline gap-1 text-xs font-medium uppercase tracking-[0.14em] text-encre/60 tabular-nums"
          >
            <span aria-hidden="true">·</span>
            <span>{step.duration}</span>
          </span>
        )}
        {step.isResult && (
          <span
            data-testid={`step-badge-${step.step}`}
            className="inline-flex items-center rounded-full bg-champagne-dark/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-champagne-dark"
          >
            {resultLabel}
          </span>
        )}
      </div>
      <Kicker>{step.kicker}</Kicker>
      <Heading as="h4" size="sm">
        {step.title}
      </Heading>
      <Text
        size="body"
        tone="secondary"
        prose
        className={cn(step.isResult && 'font-display italic')}
      >
        {step.description}
      </Text>
    </article>
  );
}
