/**
 * Lot L3 — `LocaleVeil` : voile de transition (fallback), présentationnel.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LocaleVeil } from './LocaleVeil';

describe('LocaleVeil', () => {
  it('ne rend rien quand inactif', () => {
    const { queryByTestId } = render(
      <LocaleVeil veil={{ active: false, phase: null }} />,
    );
    expect(queryByTestId('locale-veil')).toBeNull();
  });

  it('rend un overlay aria-hidden non-cliquable quand actif', () => {
    const { getByTestId } = render(
      <LocaleVeil veil={{ active: true, phase: 'in' }} />,
    );
    const veil = getByTestId('locale-veil');
    expect(veil.getAttribute('aria-hidden')).toBe('true');
    expect(veil.getAttribute('data-phase')).toBe('in');
    expect(veil.className).toContain('pointer-events-none');
    expect(veil.className).toContain('fixed');
  });
});
