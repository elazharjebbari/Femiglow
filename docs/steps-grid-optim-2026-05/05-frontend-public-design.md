# 05 — Frontend public — design

## 1. Inventaire des composants

| Composant | Type | Rôle |
|---|---|---|
| `StepsTimeline.tsx` | Client | Wrapper de la grille : monte IO tracking `pack_steps_view` + `pack_steps_complete_view`, rend StepsHeader + 4 StepCard + StepsConnector + PostCtaLink |
| `StepsHeader.tsx` | Server | Bloc d'en-tête au-dessus de la timeline (kicker / totalDuration / lead) |
| `StepCard.tsx` | Server | Carte individuelle d'un step. Refonte du `FeedStepCard` inline |
| `StepIcon.tsx` | Server | Picto stroke 1.5 selon `icon: 'buffer' \| 'drop' \| 'sparkle' \| 'mirror'` |
| `StepsConnector.tsx` | Server | Ligne pointillée (desktop) ou timeline verticale (mobile) — purement visuel, `aria-hidden` |
| `StepsPostCtaLink.tsx` | Client | Lien éditorial « Démarrer le rituel ↓ », émet `pack_steps_cta_click` au clic |

## 2. StepsTimeline (Client)

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { LazyMotion, domAnimation, m, useReducedMotion } from 'framer-motion';

import { StepsHeader } from './StepsHeader';
import { StepCard } from './StepCard';
import { StepsConnector } from './StepsConnector';
import { StepsPostCtaLink } from './StepsPostCtaLink';
import { useTracking } from '@/lib/tracking/use-tracking';
import type {
  ProductFeedStep,
  ProductFeedStepsHeader,
  ProductFeedStepsPostCta,
} from '@/lib/products/feed/types';

interface StepsTimelineProps {
  steps: ProductFeedStep[];
  header?: ProductFeedStepsHeader;
  postCta?: ProductFeedStepsPostCta;
}

export function StepsTimeline({ steps, header, postCta }: StepsTimelineProps) {
  const { emit } = useTracking();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const resultRef = useRef<HTMLLIElement | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;
    const wrapper = wrapperRef.current;
    const result = resultRef.current;
    if (!wrapper) return;

    let firedView = false;
    let firedComplete = false;

    const viewObs = new IntersectionObserver(
      ([entry]) => {
        if (!firedView && entry?.isIntersecting && entry.intersectionRatio >= 0.4) {
          firedView = true;
          emit('pack_steps_view', {
            layout: window.innerWidth >= 1024 ? 'desktop' : 'mobile',
            total_steps: steps.length,
            total_duration_label: header?.totalDuration ?? null,
          });
          viewObs.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    viewObs.observe(wrapper);

    let completeObs: IntersectionObserver | null = null;
    if (result) {
      completeObs = new IntersectionObserver(
        ([entry]) => {
          if (!firedComplete && entry?.isIntersecting && entry.intersectionRatio >= 0.5) {
            firedComplete = true;
            emit('pack_steps_complete_view', {});
            completeObs?.disconnect();
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

  const list = (
    <ol
      role="list"
      aria-label="Les quatre gestes du rituel"
      className="relative grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4"
      data-testid="steps-timeline-list"
    >
      <StepsConnector aria-hidden />
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
              transition={{ delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <StepCard step={step} />
            </m.div>
          )}
        </li>
      ))}
    </ol>
  );

  return (
    <section
      ref={wrapperRef}
      data-testid="steps-timeline"
      aria-labelledby={header ? 'steps-timeline-title' : undefined}
      className="mt-20"
    >
      {header && <StepsHeader header={header} headingId="steps-timeline-title" />}
      <LazyMotion features={domAnimation}>
        <div className="mt-10">{list}</div>
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
```

## 3. StepsHeader (Server)

```tsx
import { Heading } from '@/components/ui/Heading';
import { Kicker } from '@/components/ui/Kicker';
import { Text } from '@/components/ui/Text';
import type { ProductFeedStepsHeader } from '@/lib/products/feed/types';

interface Props {
  header: ProductFeedStepsHeader;
  headingId?: string;
}

export function StepsHeader({ header, headingId }: Props) {
  return (
    <div
      data-testid="steps-header"
      className="mx-auto max-w-xl space-y-2 text-center"
    >
      <Kicker tone="champagne">{header.kicker}</Kicker>
      <Heading id={headingId} as="h3" size="display-sm">
        {header.totalDuration}
      </Heading>
      <Text size="body" tone="secondary" prose className="mx-auto">
        {header.lead}
      </Text>
    </div>
  );
}
```

## 4. StepCard (Server) — refonte

```tsx
import { Heading } from '@/components/ui/Heading';
import { Kicker } from '@/components/ui/Kicker';
import { Text } from '@/components/ui/Text';
import { StepIcon } from './StepIcon';
import { cn } from '@/lib/utils/cn';
import type { FeedAccent, ProductFeedStep } from '@/lib/products/feed/types';

const accentDot: Record<FeedAccent, string> = {
  sauge: 'bg-sauge-soft text-sauge-dark ring-1 ring-sauge-dark/15',
  petale: 'bg-petale-soft text-petale-dark ring-1 ring-petale-dark/15',
  champagne: 'bg-champagne-soft text-champagne-dark ring-1 ring-champagne-dark/15',
  ciel: 'bg-ciel-soft text-ciel-dark ring-1 ring-ciel-dark/15',
};

const accentResultRing: Record<FeedAccent, string> = {
  sauge: 'ring-2 ring-sauge-dark/30',
  petale: 'ring-2 ring-petale-dark/30',
  champagne: 'ring-2 ring-champagne-dark/30',
  ciel: 'ring-2 ring-ciel-dark/30',
};

export function StepCard({ step }: { step: ProductFeedStep }) {
  return (
    <article
      data-testid={`step-card-${step.step}`}
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
            className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-[0.14em] text-encre/60 tabular-nums"
          >
            <span aria-hidden="true">·</span>
            {step.duration}
          </span>
        )}
        {step.isResult && (
          <span
            data-testid={`step-badge-${step.step}`}
            className="inline-flex items-center rounded-full bg-champagne-dark/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-champagne-dark"
          >
            Résultat
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
```

## 5. StepIcon (Server)

```tsx
import type { ProductFeedStepIcon } from '@/lib/products/feed/types';

interface Props {
  name: ProductFeedStepIcon;
  className?: string;
}

export function StepIcon({ name, className }: Props) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    className,
  };

  if (name === 'buffer') {
    return (
      <svg {...common}>
        <rect x="3" y="9" width="18" height="6" rx="1.2" />
        <line x1="3" y1="11.5" x2="21" y2="11.5" />
        <line x1="3" y1="12.5" x2="21" y2="12.5" />
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
    </svg>
  );
}
```

## 6. StepsConnector (Server)

```tsx
export function StepsConnector(props: { 'aria-hidden'?: boolean }) {
  return (
    <>
      {/* Desktop : ligne pointillée horizontale au centre des pastilles */}
      <span
        aria-hidden={props['aria-hidden']}
        className="pointer-events-none absolute left-0 right-0 top-6 hidden h-px border-t border-dashed border-encre/15 lg:block"
        data-testid="steps-connector-desktop"
      />
      {/* Mobile : timeline verticale à gauche des pastilles */}
      <span
        aria-hidden={props['aria-hidden']}
        className="pointer-events-none absolute bottom-2 left-6 top-2 w-px bg-encre/10 sm:hidden"
        data-testid="steps-connector-mobile"
      />
    </>
  );
}
```

## 7. StepsPostCtaLink (Client)

```tsx
'use client';

import { useCallback } from 'react';
import { useTracking } from '@/lib/tracking/use-tracking';

interface Props {
  label: string;
  anchorId: string;
}

export function StepsPostCtaLink({ label, anchorId }: Props) {
  const { emit } = useTracking();
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      emit('pack_steps_cta_click', { cta_target: `#${anchorId}` });
      const target = document.getElementById(anchorId);
      if (target) {
        event.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    [emit, anchorId],
  );
  return (
    <div className="mt-12 text-center">
      <a
        href={`#${anchorId}`}
        onClick={handleClick}
        data-testid="steps-post-cta"
        className="inline-flex items-center gap-1 pt-1 font-body text-[12px] uppercase tracking-[0.18em] text-encre/70 underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A876] focus-visible:ring-offset-2 focus-visible:ring-offset-creme"
      >
        {label}
        <span aria-hidden="true">↓</span>
      </a>
    </div>
  );
}
```

## 8. Intégration dans `ProductFeedSection`

```diff
- {/* 2 — Rituel 4 gestes ------------------------------------------ */}
- <ol role="list" aria-label="Les quatre gestes du rituel" className="mt-20 grid …">
-   {feed.steps.map((step) => <FeedStepCard key={step.step} step={step} />)}
- </ol>
+ {/* 2 — Rituel 4 gestes (Kolenda §4.7) ---------------------------- */}
+ <StepsTimeline
+   steps={feed.steps}
+   header={feed.stepsHeader}
+   postCta={feed.stepsPostCta}
+ />
```

Le composant `FeedStepCard` interne devient obsolète et peut être
supprimé (sauf si utilisé ailleurs — grep avant suppression).

## 9. Responsive comportement

| Breakpoint | Grid | Connector | Header | PostCta |
|---|---|---|---|---|
| < 640 (mobile) | 1 colonne | Ligne verticale gauche | Visible centré | Visible centré |
| ≥ 640 < 1024 (tablet) | 2 colonnes | Aucun (la ligne casserait) | Visible | Visible |
| ≥ 1024 (desktop) | 4 colonnes | Ligne pointillée horizontale | Visible | Visible |

## 10. Conventions FemiGlow

- Apostrophe `'` U+2019 dans toute la copy
- `motion-safe:` désactive auto si `prefers-reduced-motion`
- Color literal sur les opacités non-Tailwind (cf. règle `bg-encre/X`)
- Pas de mention nominale fondatrice
- Pas de cliché orientaliste
- Charte palette : pastilles `sauge-soft / petale-soft / ciel-soft / champagne-soft`
