/**
 * Lot L2 — tests des helpers de transition.
 * Couvre INV-2 (dir/lang), INV-7 (reduced-motion), INV-10 (aria-live).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  announceLocale,
  applyHtmlLocale,
  getDirection,
  LIVE_REGION_ID,
  prefersReducedMotion,
  supportsViewTransitions,
} from './transition-helpers';

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute('dir');
  document.documentElement.removeAttribute('lang');
  document.getElementById(LIVE_REGION_ID)?.remove();
});

describe('getDirection', () => {
  it('ar → rtl', () => expect(getDirection('ar')).toBe('rtl'));
  it('fr → ltr', () => expect(getDirection('fr')).toBe('ltr'));
  it('en → ltr', () => expect(getDirection('en')).toBe('ltr'));
});

describe('applyHtmlLocale (INV-2)', () => {
  it('pose lang + dir rtl pour ar', () => {
    applyHtmlLocale('ar');
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
  });
  it('pose lang + dir ltr pour fr', () => {
    applyHtmlLocale('fr');
    expect(document.documentElement.lang).toBe('fr');
    expect(document.documentElement.dir).toBe('ltr');
  });
});

describe('prefersReducedMotion (INV-7)', () => {
  it('true quand la media query matche', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q.includes('reduce'),
      media: q,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    expect(prefersReducedMotion()).toBe(true);
  });
  it('false quand elle ne matche pas', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    expect(prefersReducedMotion()).toBe(false);
  });
});

describe('supportsViewTransitions', () => {
  it('true si document.startViewTransition est une fonction', () => {
    (document as unknown as { startViewTransition: unknown }).startViewTransition =
      () => ({});
    expect(supportsViewTransitions()).toBe(true);
    delete (document as unknown as { startViewTransition?: unknown })
      .startViewTransition;
  });
  it('false sinon', () => {
    delete (document as unknown as { startViewTransition?: unknown })
      .startViewTransition;
    expect(supportsViewTransitions()).toBe(false);
  });
});

describe('announceLocale (INV-10)', () => {
  it('écrit dans la région aria-live si présente', () => {
    const region = document.createElement('div');
    region.id = LIVE_REGION_ID;
    document.body.appendChild(region);
    announceLocale('ar');
    expect(region.textContent).toBe('العربية');
  });
  it('no-op silencieux si la région est absente', () => {
    expect(() => announceLocale('ar')).not.toThrow();
  });
});
