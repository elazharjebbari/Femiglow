/**
 * Tests `TimeEstimateBadge` — Server Component pur.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { TimeEstimateBadge } from './TimeEstimateBadge';

afterEach(() => cleanup());

describe('TimeEstimateBadge', () => {
  it('rend le label passé en prop', () => {
    render(<TimeEstimateBadge label="≈ 90 secondes pour confirmer" />);
    expect(screen.getByTestId('wizard-time-estimate').textContent).toBe(
      '≈ 90 secondes pour confirmer',
    );
  });

  it('porte data-testid="wizard-time-estimate"', () => {
    render(<TimeEstimateBadge label="x" />);
    expect(screen.getByTestId('wizard-time-estimate')).toBeDefined();
  });

  it('style italic + text-encre/60 + centré', () => {
    render(<TimeEstimateBadge label="x" />);
    const el = screen.getByTestId('wizard-time-estimate');
    expect(el.className).toContain('italic');
    expect(el.className).toContain('text-encre/60');
    expect(el.className).toContain('text-center');
  });
});
