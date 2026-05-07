/**
 * Tests visuels rapides FunnelGlobal — labels, valeurs, ratios.
 * cf. docs/analytics/06-tests-strategy.md §4
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { FunnelStep } from '@/lib/analytics/queries/funnel';
import { FunnelGlobal } from './FunnelGlobal';

const STEPS: FunnelStep[] = [
  { stage: 'view', sessions: 1000, progressionFromPrevious: null, dropoffToNext: 0.6, medianTimeToNextSeconds: 30 },
  { stage: 'engage', sessions: 400, progressionFromPrevious: 0.4, dropoffToNext: 0.5, medianTimeToNextSeconds: 60 },
  { stage: 'cta', sessions: 200, progressionFromPrevious: 0.5, dropoffToNext: 0.5, medianTimeToNextSeconds: 45 },
  { stage: 'checkout', sessions: 100, progressionFromPrevious: 0.5, dropoffToNext: 0.5, medianTimeToNextSeconds: 90 },
  { stage: 'purchase', sessions: 50, progressionFromPrevious: 0.5, dropoffToNext: null, medianTimeToNextSeconds: null },
];

describe('FunnelGlobal', () => {
  it('renders all 5 stage labels and absolute volumes', () => {
    render(<FunnelGlobal steps={STEPS} />);
    for (const label of ['View', 'Engage', 'CTA', 'Checkout', 'Purchase']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    // 1 000 (formatNumber utilise \u202f, normalisé par getByText en espace standard)
    expect(screen.getByText(/^1\s000$/)).toBeInTheDocument();
    // "50" apparaît plusieurs fois ("50" volume + "50 % depuis ..."), on cible
    // explicitement la cellule volume.
    expect(screen.getAllByText(/^50$/).length).toBeGreaterThan(0);
  });

  it('shows empty state when baseline=0', () => {
    const empty: FunnelStep[] = STEPS.map((s) => ({
      ...s,
      sessions: 0,
      progressionFromPrevious: null,
      dropoffToNext: null,
      medianTimeToNextSeconds: null,
    }));
    render(<FunnelGlobal steps={empty} />);
    expect(screen.getByText(/Aucune session/i)).toBeInTheDocument();
  });
});
