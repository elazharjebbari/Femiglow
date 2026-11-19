/**
 * `StepsTimeline` — mode d'emploi du kit dans un encart crème chaud :
 *  - StepsHeader (surtitre + durée totale + cadence)
 *  - 4 StepCard reliées par un fil : liste verticale sous `lg`, quatre
 *    colonnes au-delà (révélation décalée Framer Motion)
 *  - StepsPostCtaLink (bouton de commande + réassurance)
 *
 * IntersectionObserver :
 *  - `pack_steps_view`         — IO 0.4 sur le wrapper section
 *  - `pack_steps_complete_view`— IO 0.5 sur le step `isResult`
 *
 * `prefers-reduced-motion` désactive le wrapper `m.div` (`useReducedMotion`).
 */
'use client';

import { useEffect, useRef } from 'react';
import { LazyMotion, domAnimation, m, useReducedMotion } from 'framer-motion';

import { StepCard } from './StepCard';
import { StepsHeader } from './StepsHeader';
import { StepsPostCtaLink } from './StepsPostCtaLink';
import { cn } from '@/lib/utils/cn';
import { useTracking } from '@/lib/tracking/use-tracking';
import type {
  ProductFeedStep,
  ProductFeedStepsHeader,
  ProductFeedStepsPostCta,
} from '@/lib/products/feed/types';

export interface StepsTimelineProps {
  steps: ProductFeedStep[];
  header?: ProductFeedStepsHeader;
  postCta?: ProductFeedStepsPostCta;
  /** Phase 9bis — libellé localisé du badge « Résultat ». */
  resultLabel?: string;
}

export function StepsTimeline({
  steps,
  header,
  postCta,
  resultLabel,
}: StepsTimelineProps): JSX.Element {
  const reduceMotion = useReducedMotion();
  const { emit } = useTracking();
  const wrapperRef = useRef<HTMLElement | null>(null);
  const resultRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('IntersectionObserver' in window)
    ) {
      return;
    }
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    let firedView = false;
    let firedComplete = false;

    const viewObs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          if (entry.intersectionRatio >= 0.4 && !firedView) {
            firedView = true;
            emit('pack_steps_view', {
              layout: window.innerWidth >= 1024 ? 'desktop' : 'mobile',
              total_steps: steps.length,
              total_duration_label: header?.totalDuration ?? null,
            });
            viewObs.disconnect();
          }
        }
      },
      { threshold: 0.4 },
    );
    viewObs.observe(wrapper);

    let completeObs: IntersectionObserver | null = null;
    const result = resultRef.current;
    if (result) {
      completeObs = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            if (entry.intersectionRatio >= 0.5 && !firedComplete) {
              firedComplete = true;
              emit('pack_steps_complete_view', {});
              completeObs?.disconnect();
            }
          }
        },
        { threshold: 0.5 },
      );
      completeObs.observe(result);
    }

    return () => {
      viewObs.disconnect();
      completeObs?.disconnect();
    };
  }, [emit, steps.length, header?.totalDuration]);

  return (
    <section
      ref={wrapperRef}
      data-testid="steps-timeline"
      aria-labelledby={header ? 'steps-timeline-title' : undefined}
      className="mt-16 rounded-2xl bg-creme-warm px-5 py-10 sm:px-10 sm:py-12 lg:px-12"
    >
      {header && (
        <StepsHeader header={header} headingId="steps-timeline-title" />
      )}
      <LazyMotion features={domAnimation}>
        <ol
          role="list"
          aria-label="Les quatre gestes du rituel"
          className={cn(
            'mx-auto max-w-xl lg:grid lg:max-w-none lg:grid-cols-4 lg:gap-8',
            header ? 'mt-9' : '',
          )}
          data-testid="steps-list"
        >
          {steps.map((step, i) => (
            <li
              key={step.step}
              ref={step.isResult ? resultRef : null}
              data-step={step.step}
              className="relative pb-7 last:pb-0 lg:pb-0"
            >
              {/* Fil vers le geste suivant : vertical sous la pastille en
                  liste, horizontal entre deux pastilles en colonnes. */}
              {i < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  data-testid="steps-connector"
                  className="pointer-events-none absolute bottom-0 start-5 top-10 w-px bg-champagne lg:bottom-auto lg:end-[-2rem] lg:start-10 lg:top-5 lg:h-px lg:w-auto"
                />
              )}
              {reduceMotion ? (
                <StepCard step={step} resultLabel={resultLabel} />
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
                  <StepCard step={step} resultLabel={resultLabel} />
                </m.div>
              )}
            </li>
          ))}
        </ol>
      </LazyMotion>
      {postCta && (
        <StepsPostCtaLink
          label={postCta.label}
          anchorId={postCta.anchorId}
          note={postCta.note}
        />
      )}
    </section>
  );
}
