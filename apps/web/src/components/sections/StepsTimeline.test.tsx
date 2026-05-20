/**
 * Tests `StepsTimeline` — Client wrapper de la grille 4 gestes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

const emitMock = vi.fn();

vi.mock('@/lib/tracking/use-tracking', () => ({
  useTracking: () => ({ emit: emitMock, consent: { analytics: 'granted' } }),
}));

import { StepsTimeline } from './StepsTimeline';
import type {
  ProductFeedStep,
  ProductFeedStepsHeader,
  ProductFeedStepsPostCta,
} from '@/lib/products/feed/types';

// Désactive Framer Motion pour des tests déterministes — useReducedMotion
// renvoie true → StepCard est rendu directement sans m.div wrapper.
vi.mock('framer-motion', async () => {
  const actual =
    await vi.importActual<typeof import('framer-motion')>('framer-motion');
  return {
    ...actual,
    useReducedMotion: () => true,
    LazyMotion: ({ children }: { children: React.ReactNode }) => children,
  };
});

beforeEach(() => {
  emitMock.mockReset();
});

afterEach(() => cleanup());

const steps: ProductFeedStep[] = [
  {
    step: 1,
    kicker: 'Préparation',
    title: 'Préparez',
    description: 'desc 1',
    accent: 'sauge',
    duration: '30 s',
    icon: 'buffer',
  },
  {
    step: 2,
    kicker: 'Geste 1',
    title: 'Paste',
    description: 'desc 2',
    accent: 'sauge',
    duration: '1 min',
    icon: 'drop',
  },
  {
    step: 3,
    kicker: 'Geste 2',
    title: 'Powder',
    description: 'desc 3',
    accent: 'petale',
    duration: '2 min',
    icon: 'sparkle',
  },
  {
    step: 4,
    kicker: 'Step 4',
    title: 'Shine',
    description: 'desc 4',
    accent: 'champagne',
    duration: '1 min',
    icon: 'mirror',
    isResult: true,
  },
];

const header: ProductFeedStepsHeader = {
  kicker: 'EN TOUT',
  totalDuration: '5 minutes le soir',
  lead: 'lead text',
};

describe('StepsTimeline', () => {
  it('rend le wrapper section avec data-testid', () => {
    render(<StepsTimeline steps={steps} header={header} />);
    expect(screen.getByTestId('steps-timeline')).toBeDefined();
  });

  it('rend StepsHeader si header présent', () => {
    render(<StepsTimeline steps={steps} header={header} />);
    expect(screen.getByTestId('steps-header')).toBeDefined();
  });

  it('ne rend pas StepsHeader si absent (rétro-compat)', () => {
    render(<StepsTimeline steps={steps} />);
    expect(screen.queryByTestId('steps-header')).toBeNull();
  });

  it('rend les 4 cartes', () => {
    render(<StepsTimeline steps={steps} />);
    expect(screen.getByTestId('step-card-1')).toBeDefined();
    expect(screen.getByTestId('step-card-2')).toBeDefined();
    expect(screen.getByTestId('step-card-3')).toBeDefined();
    expect(screen.getByTestId('step-card-4')).toBeDefined();
  });

  it('rend le connecteur visuel (Server StepsConnector)', () => {
    render(<StepsTimeline steps={steps} />);
    expect(screen.getByTestId('steps-connector-mobile')).toBeDefined();
    expect(screen.getByTestId('steps-connector-desktop')).toBeDefined();
  });

  it('porte aria-labelledby si header présent', () => {
    render(<StepsTimeline steps={steps} header={header} />);
    expect(
      screen.getByTestId('steps-timeline').getAttribute('aria-labelledby'),
    ).toBe('steps-timeline-title');
  });

  it('list aria-label = Les quatre gestes du rituel', () => {
    render(<StepsTimeline steps={steps} />);
    expect(
      screen.getByTestId('steps-list').getAttribute('aria-label'),
    ).toBe('Les quatre gestes du rituel');
  });

  it('rend StepsPostCtaLink si postCta présent', () => {
    const postCta: ProductFeedStepsPostCta = {
      label: 'Démarrer le rituel',
      anchorId: 'commander-femiglow',
    };
    render(<StepsTimeline steps={steps} postCta={postCta} />);
    expect(screen.getByTestId('steps-post-cta')).toBeDefined();
  });

  it('ne rend PAS StepsPostCtaLink si postCta absent', () => {
    render(<StepsTimeline steps={steps} />);
    expect(screen.queryByTestId('steps-post-cta')).toBeNull();
  });
});

describe('StepsTimeline — IntersectionObserver tracking', () => {
  it('émet pack_steps_view au franchissement seuil 0.4', () => {
    type Cb = (entries: IntersectionObserverEntry[]) => void;
    const callbacks: Cb[] = [];
    class IOTrigger {
      constructor(cb: Cb) {
        callbacks.push(cb);
      }
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
      takeRecords = () => [];
      root = null;
      rootMargin = '';
      thresholds = [0.4];
    }
    const original = window.IntersectionObserver;
    // @ts-expect-error mock
    window.IntersectionObserver = IOTrigger;

    try {
      render(<StepsTimeline steps={steps} header={header} />);
      // Le 1er callback enregistré est celui du wrapper (view).
      callbacks[0]!([
        { isIntersecting: true, intersectionRatio: 0.5 } as IntersectionObserverEntry,
      ]);
      const events = emitMock.mock.calls.map((c) => c[0]);
      expect(events).toContain('pack_steps_view');
      const viewCall = emitMock.mock.calls.find(
        (c) => c[0] === 'pack_steps_view',
      );
      expect(viewCall?.[1]).toMatchObject({
        total_steps: 4,
        total_duration_label: '5 minutes le soir',
      });
    } finally {
      window.IntersectionObserver = original;
    }
  });

  it('émet pack_steps_complete_view quand le step result entre dans le viewport', () => {
    type Cb = (entries: IntersectionObserverEntry[]) => void;
    const callbacks: Cb[] = [];
    class IOTrigger {
      constructor(cb: Cb) {
        callbacks.push(cb);
      }
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
      takeRecords = () => [];
      root = null;
      rootMargin = '';
      thresholds = [0.5];
    }
    const original = window.IntersectionObserver;
    // @ts-expect-error mock
    window.IntersectionObserver = IOTrigger;

    try {
      render(<StepsTimeline steps={steps} />);
      // 2 observers : view (wrapper) puis complete (step result)
      // Le 2ᵉ callback est celui du step result.
      expect(callbacks.length).toBeGreaterThanOrEqual(2);
      callbacks[1]!([
        { isIntersecting: true, intersectionRatio: 0.6 } as IntersectionObserverEntry,
      ]);
      const events = emitMock.mock.calls.map((c) => c[0]);
      expect(events).toContain('pack_steps_complete_view');
    } finally {
      window.IntersectionObserver = original;
    }
  });
});
