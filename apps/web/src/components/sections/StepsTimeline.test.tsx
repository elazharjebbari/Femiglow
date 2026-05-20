/**
 * Tests `StepsTimeline` — Client wrapper de la grille 4 gestes (G3).
 *
 * G4 ajoutera des tests IntersectionObserver pour les events tracking.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { StepsTimeline } from './StepsTimeline';
import type {
  ProductFeedStep,
  ProductFeedStepsHeader,
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
});
