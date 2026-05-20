/**
 * Tests `StepsHeader` — Server Component pur.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { StepsHeader } from './StepsHeader';

afterEach(() => cleanup());

const header = {
  kicker: 'EN TOUT',
  totalDuration: '5 minutes le soir',
  lead: 'Quatre gestes lents, une fois par semaine.',
};

describe('StepsHeader', () => {
  it('rend le kicker', () => {
    render(<StepsHeader header={header} />);
    expect(screen.getByText('EN TOUT')).toBeDefined();
  });

  it('rend le h3 avec la durée totale', () => {
    render(<StepsHeader header={header} />);
    const h3 = screen.getByRole('heading', { level: 3 });
    expect(h3.textContent).toContain('5 minutes le soir');
  });

  it('rend le lead', () => {
    render(<StepsHeader header={header} />);
    expect(screen.getByText(/Quatre gestes lents/)).toBeDefined();
  });

  it('propage headingId sur le h3', () => {
    render(<StepsHeader header={header} headingId="hello-id" />);
    const h3 = screen.getByRole('heading', { level: 3 });
    expect(h3.id).toBe('hello-id');
  });

  it('porte data-testid="steps-header"', () => {
    render(<StepsHeader header={header} />);
    expect(screen.getByTestId('steps-header')).toBeDefined();
  });
});
