/**
 * Tests CheckoutTimeToSubmit — affichage histogramme + percentiles + empty.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { CheckoutTimeToSubmit as TTS } from '@/lib/analytics/queries/checkout';
import { CheckoutTimeToSubmit } from './CheckoutTimeToSubmit';

function makeBuckets(): TTS['buckets'] {
  return Array.from({ length: 12 }, (_, i) => ({
    fromSeconds: i * 50,
    toSeconds: (i + 1) * 50,
    sessions: 0,
  }));
}

describe('CheckoutTimeToSubmit', () => {
  it('shows P25/P50/P75/P95 boxes when sample > 0', () => {
    const data: TTS = {
      buckets: makeBuckets().map((b, i) =>
        i < 3 ? { ...b, sessions: 5 } : b,
      ),
      p25: 25,
      p50: 75,
      p75: 130,
      p95: 200,
      sampleSize: 15,
    };
    render(<CheckoutTimeToSubmit data={data} />);
    // Labels percentiles
    expect(screen.getByText('P25')).toBeInTheDocument();
    expect(screen.getByText('P50')).toBeInTheDocument();
    expect(screen.getByText('P75')).toBeInTheDocument();
    expect(screen.getByText('P95')).toBeInTheDocument();
    // Échantillon
    expect(screen.getByText(/15 sessions/i)).toBeInTheDocument();
  });

  it('shows empty state when sampleSize=0', () => {
    const data: TTS = {
      buckets: makeBuckets(),
      p25: null,
      p50: null,
      p75: null,
      p95: null,
      sampleSize: 0,
    };
    render(<CheckoutTimeToSubmit data={data} />);
    expect(screen.getByText(/Aucune session avec begin_checkout/i)).toBeInTheDocument();
  });
});
