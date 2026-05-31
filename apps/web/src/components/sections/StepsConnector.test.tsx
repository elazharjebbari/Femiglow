/**
 * Tests `StepsConnector` — Server Component pur, 2 spans aria-hidden.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { StepsConnector } from './StepsConnector';

afterEach(() => cleanup());

describe('StepsConnector', () => {
  it('rend le connecteur desktop (hidden lg:block)', () => {
    render(<StepsConnector />);
    const desktop = screen.getByTestId('steps-connector-desktop');
    expect(desktop.className).toContain('hidden');
    expect(desktop.className).toContain('lg:block');
    expect(desktop.className).toContain('border-dashed');
  });

  it('rend le connecteur mobile (sm:hidden)', () => {
    render(<StepsConnector />);
    const mobile = screen.getByTestId('steps-connector-mobile');
    expect(mobile.className).toContain('sm:hidden');
    expect(mobile.className).toContain('bg-encre/10');
    expect(mobile.className).toContain('start-6');
  });

  it('les deux spans sont aria-hidden par défaut', () => {
    render(<StepsConnector />);
    expect(
      screen
        .getByTestId('steps-connector-desktop')
        .getAttribute('aria-hidden'),
    ).toBe('true');
    expect(
      screen.getByTestId('steps-connector-mobile').getAttribute('aria-hidden'),
    ).toBe('true');
  });

  it('respect ariaHidden=false (cas edge)', () => {
    render(<StepsConnector ariaHidden={false} />);
    expect(
      screen
        .getByTestId('steps-connector-desktop')
        .getAttribute('aria-hidden'),
    ).toBe('false');
  });

  it('porte pointer-events-none (n\'intercepte aucun click)', () => {
    render(<StepsConnector />);
    expect(
      screen
        .getByTestId('steps-connector-desktop')
        .className.includes('pointer-events-none'),
    ).toBe(true);
    expect(
      screen
        .getByTestId('steps-connector-mobile')
        .className.includes('pointer-events-none'),
    ).toBe(true);
  });
});
