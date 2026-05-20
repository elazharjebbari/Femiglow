/**
 * Tests `PackVisual` — packshot Server Component (aucun hook).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { PackVisual } from './PackVisual';

afterEach(() => cleanup());

describe('PackVisual', () => {
  it('rend une figure avec src par défaut /products/kit-principale.svg', () => {
    render(<PackVisual alt="Kit FemiGlow" />);
    const fig = screen.getByTestId('pack-visual');
    expect(fig.getAttribute('data-src')).toBe('/products/kit-principale.svg');
  });

  it('override src via prop', () => {
    render(<PackVisual src="/custom/pack.svg" alt="custom" />);
    expect(
      screen.getByTestId('pack-visual').getAttribute('data-src'),
    ).toBe('/custom/pack.svg');
  });

  it('porte un alt text non vide', () => {
    render(<PackVisual alt="Kit FemiGlow paste powder polissoir" />);
    expect(
      screen.getByAltText('Kit FemiGlow paste powder polissoir'),
    ).toBeDefined();
  });

  it('image porte loading="lazy" et decoding="async"', () => {
    render(<PackVisual alt="alt" />);
    const img = screen.getByAltText('alt');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('decoding')).toBe('async');
  });

  it('preserve aspect-ratio 4/5 via classe aspect-[4/5]', () => {
    render(<PackVisual alt="alt" />);
    expect(screen.getByTestId('pack-visual').className).toContain('aspect-[4/5]');
  });

  it('propage className additionnel', () => {
    render(<PackVisual alt="alt" className="custom-class" />);
    expect(screen.getByTestId('pack-visual').className).toContain('custom-class');
  });
});
