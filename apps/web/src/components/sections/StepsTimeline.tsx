/**
 * `StepsTimeline` — Client wrapper de la grille « 4 gestes du rituel »
 * (Kolenda §4.7). Encapsule :
 *  - StepsHeader (kicker + durée totale + lead)
 *  - 4 StepCard avec reveal stagger Framer Motion (LazyMotion)
 *  - StepsConnector (timeline visuelle)
 *
 * En Phase G3, ce composant n'émet PAS encore les events IO — G4
 * ajoute `pack_steps_view`, `pack_steps_complete_view` et brunche
 * StepsPostCtaLink.
 *
 * `prefers-reduced-motion` désactive le wrapper `m.div` (`useReducedMotion`).
 */
'use client';

import { LazyMotion, domAnimation, m, useReducedMotion } from 'framer-motion';

import { StepCard } from './StepCard';
import { StepsConnector } from './StepsConnector';
import { StepsHeader } from './StepsHeader';
import { cn } from '@/lib/utils/cn';
import type {
  ProductFeedStep,
  ProductFeedStepsHeader,
} from '@/lib/products/feed/types';

export interface StepsTimelineProps {
  steps: ProductFeedStep[];
  header?: ProductFeedStepsHeader;
}

export function StepsTimeline({
  steps,
  header,
}: StepsTimelineProps): JSX.Element {
  const reduceMotion = useReducedMotion();

  return (
    <section
      data-testid="steps-timeline"
      aria-labelledby={header ? 'steps-timeline-title' : undefined}
      className="mt-20"
    >
      {header && (
        <StepsHeader header={header} headingId="steps-timeline-title" />
      )}
      <LazyMotion features={domAnimation}>
        <ol
          role="list"
          aria-label="Les quatre gestes du rituel"
          className={cn(
            'relative grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4',
            header ? 'mt-10' : '',
          )}
          data-testid="steps-list"
        >
          <StepsConnector />
          {steps.map((step, i) => (
            <li
              key={step.step}
              data-step={step.step}
              className="relative"
            >
              {reduceMotion ? (
                <StepCard step={step} />
              ) : (
                <m.div
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-10% 0px' }}
                  transition={{
                    delay: i * 0.08,
                    duration: 0.5,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <StepCard step={step} />
                </m.div>
              )}
            </li>
          ))}
        </ol>
      </LazyMotion>
    </section>
  );
}
