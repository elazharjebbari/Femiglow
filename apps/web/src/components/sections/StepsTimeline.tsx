/**
 * `StepsTimeline` — Client wrapper de la grille « 4 gestes du rituel »
 * (Kolenda §4.7). Encapsule :
 *  - StepsHeader (kicker + durée totale + lead)
 *  - 4 StepCard avec reveal stagger Framer Motion (LazyMotion)
 *  - StepsConnector (timeline visuelle)
 *  - StepsPostCtaLink (relance funnel)
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
import { StepsConnector } from './StepsConnector';
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
}

export function StepsTimeline({
  steps,
  header,
  postCta,
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
              ref={step.isResult ? resultRef : null}
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
      {postCta && (
        <StepsPostCtaLink
          label={postCta.label}
          anchorId={postCta.anchorId}
        />
      )}
    </section>
  );
}
