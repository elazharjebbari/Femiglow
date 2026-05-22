/**
 * Tests `WizardMobilePackThumb` — Server Component pur.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { WizardMobilePackThumb } from './WizardMobilePackThumb';

afterEach(() => cleanup());

describe('WizardMobilePackThumb', () => {
  it('rend l\'image avec src par défaut', () => {
    render(<WizardMobilePackThumb />);
    const img = screen
      .getByTestId('wizard-mobile-pack-thumb')
      .querySelector('img');
    expect(img?.getAttribute('src')).toBe('/products/kit-principale.png');
  });

  it('alt non vide par défaut', () => {
    render(<WizardMobilePackThumb />);
    const img = screen
      .getByTestId('wizard-mobile-pack-thumb')
      .querySelector('img');
    expect(img?.getAttribute('alt')).toBe('Pack FemiGlow');
  });

  it('override src + alt via props', () => {
    render(<WizardMobilePackThumb src="/x.png" alt="Custom alt" />);
    const img = screen
      .getByTestId('wizard-mobile-pack-thumb')
      .querySelector('img');
    expect(img?.getAttribute('src')).toBe('/x.png');
    expect(img?.getAttribute('alt')).toBe('Custom alt');
  });

  it('classes responsive lg:hidden', () => {
    render(<WizardMobilePackThumb />);
    expect(
      screen
        .getByTestId('wizard-mobile-pack-thumb')
        .className.includes('lg:hidden'),
    ).toBe(true);
  });

  it('image 64×80', () => {
    render(<WizardMobilePackThumb />);
    const img = screen
      .getByTestId('wizard-mobile-pack-thumb')
      .querySelector('img');
    expect(img?.getAttribute('width')).toBe('64');
    expect(img?.getAttribute('height')).toBe('80');
  });
});
