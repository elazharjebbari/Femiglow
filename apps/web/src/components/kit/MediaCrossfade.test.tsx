/**
 * Tests `MediaCrossfade` — crossfade isolated ↔ contextual au hover/tap.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { MediaCrossfade } from './MediaCrossfade';

afterEach(() => cleanup());

describe('MediaCrossfade — sans contextual', () => {
  it('rend uniquement le slot isolated', () => {
    render(<MediaCrossfade alt="paste" isolated={<img data-testid="iso" alt="x" />} />);
    expect(screen.getByTestId('iso')).toBeDefined();
  });

  it('n\'expose pas d\'interaction (pas de role button)', () => {
    render(<MediaCrossfade alt="paste" isolated={<img alt="x" />} />);
    const wrapper = screen.getByTestId('composition-card-media');
    expect(wrapper.getAttribute('role')).toBeNull();
    expect(wrapper.getAttribute('tabindex')).toBeNull();
  });
});

describe('MediaCrossfade — avec contextual', () => {
  it('expose role="button" + tabIndex + aria-pressed', () => {
    render(
      <MediaCrossfade
        alt="paste"
        isolated={<img alt="x" />}
        contextual={<img alt="y" />}
      />,
    );
    const wrapper = screen.getByTestId('composition-card-media');
    expect(wrapper.getAttribute('role')).toBe('button');
    expect(wrapper.getAttribute('tabindex')).toBe('0');
    expect(wrapper.getAttribute('aria-pressed')).toBe('false');
  });

  it('toggle au mouseenter / mouseleave', () => {
    render(
      <MediaCrossfade
        alt="paste"
        isolated={<img alt="x" />}
        contextual={<img alt="y" />}
      />,
    );
    const wrapper = screen.getByTestId('composition-card-media');
    fireEvent.mouseEnter(wrapper);
    expect(wrapper.getAttribute('aria-pressed')).toBe('true');
    fireEvent.mouseLeave(wrapper);
    expect(wrapper.getAttribute('aria-pressed')).toBe('false');
  });

  it('toggle au touchstart (mobile)', () => {
    render(
      <MediaCrossfade
        alt="paste"
        isolated={<img alt="x" />}
        contextual={<img alt="y" />}
      />,
    );
    const wrapper = screen.getByTestId('composition-card-media');
    fireEvent.touchStart(wrapper);
    expect(wrapper.getAttribute('aria-pressed')).toBe('true');
    fireEvent.touchStart(wrapper);
    expect(wrapper.getAttribute('aria-pressed')).toBe('false');
  });

  it('toggle au keydown Enter', () => {
    render(
      <MediaCrossfade
        alt="paste"
        isolated={<img alt="x" />}
        contextual={<img alt="y" />}
      />,
    );
    const wrapper = screen.getByTestId('composition-card-media');
    fireEvent.keyDown(wrapper, { key: 'Enter' });
    expect(wrapper.getAttribute('aria-pressed')).toBe('true');
  });

  it('toggle au keydown Space', () => {
    render(
      <MediaCrossfade
        alt="paste"
        isolated={<img alt="x" />}
        contextual={<img alt="y" />}
      />,
    );
    const wrapper = screen.getByTestId('composition-card-media');
    fireEvent.keyDown(wrapper, { key: ' ' });
    expect(wrapper.getAttribute('aria-pressed')).toBe('true');
  });

  it('aria-hidden inversé entre les deux layers', () => {
    render(
      <MediaCrossfade
        alt="paste"
        isolated={<img data-testid="iso" alt="x" />}
        contextual={<img data-testid="ctx" alt="y" />}
      />,
    );
    // À l'état initial (active=false), isolated visible et contextual masqué.
    const iso = screen.getByTestId('iso').parentElement!;
    const ctx = screen.getByTestId('ctx').parentElement!;
    expect(iso.getAttribute('aria-hidden')).toBe('false');
    expect(ctx.getAttribute('aria-hidden')).toBe('true');

    const wrapper = screen.getByTestId('composition-card-media');
    fireEvent.mouseEnter(wrapper);
    expect(iso.getAttribute('aria-hidden')).toBe('true');
    expect(ctx.getAttribute('aria-hidden')).toBe('false');
  });
});
