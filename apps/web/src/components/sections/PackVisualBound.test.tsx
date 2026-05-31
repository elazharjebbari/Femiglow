/**
 * Tests `PackVisualBound` — wrapper RSC qui délègue à ComponentMedia.
 *
 * On mock ComponentMedia (RSC async + accès DB) pour isoler le rôle
 * de PackVisualBound : structure `<figure>`, aspect-ratio, alt
 * propagé, classes wrapper. Les rendus media (variants AVIF/WebP)
 * sont couverts par les tests propres de ComponentMedia / MediaImage.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('@/lib/components/ComponentMedia', () => ({
  ComponentMedia: ({
    componentKey,
    slot,
    altOverride,
    sizes,
    className,
  }: {
    componentKey: string;
    slot: string;
    altOverride?: string;
    sizes?: string;
    className?: string;
  }) => (
    <span
      data-testid="component-media-mock"
      data-component-key={componentKey}
      data-slot={slot}
      data-alt={altOverride}
      data-sizes={sizes}
      className={className}
    />
  ),
}));

import { PackVisualBound } from './PackVisualBound';

afterEach(() => cleanup());

describe('PackVisualBound', () => {
  it('rend une <figure> avec data-testid pack-visual', () => {
    render(<PackVisualBound alt="alt test" />);
    expect(screen.getByTestId('pack-visual').tagName).toBe('FIGURE');
  });

  it('délègue à ComponentMedia avec componentKey + slot corrects', () => {
    render(<PackVisualBound alt="alt test" />);
    const mock = screen.getByTestId('component-media-mock');
    expect(mock.getAttribute('data-component-key')).toBe('kit-pack-visual');
    expect(mock.getAttribute('data-slot')).toBe('primary');
  });

  it('propage l’alt via altOverride', () => {
    render(<PackVisualBound alt="Pack FemiGlow custom alt" />);
    expect(
      screen.getByTestId('component-media-mock').getAttribute('data-alt'),
    ).toBe('Pack FemiGlow custom alt');
  });

  it('passe le sizes responsive (mobile/desktop)', () => {
    render(<PackVisualBound alt="alt" />);
    expect(
      screen.getByTestId('component-media-mock').getAttribute('data-sizes'),
    ).toBe('(min-width: 768px) 40vw, 100vw');
  });

  it('preserve aspect-ratio 4/5 sur le wrapper', () => {
    render(<PackVisualBound alt="alt" />);
    expect(screen.getByTestId('pack-visual').className).toContain('aspect-[4/5]');
  });

  it('propage className additionnel', () => {
    render(<PackVisualBound alt="alt" className="custom-extra" />);
    expect(screen.getByTestId('pack-visual').className).toContain('custom-extra');
  });
});
