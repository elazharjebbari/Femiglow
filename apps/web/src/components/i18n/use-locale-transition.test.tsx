/**
 * Lot L2 — tests du hook `useLocaleTransition`.
 * Couvre INV-1 (no-reload + fallback), INV-2 (dir), INV-4 (UTM), INV-7
 * (reduced), INV-11 (no-op), et la sélection des 4 modes.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  replace: vi.fn(),
  emit: vi.fn(),
  pathname: '/fr/kit',
  search: 'utm_source=ig',
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: h.replace }),
  usePathname: () => h.pathname,
  useSearchParams: () => new URLSearchParams(h.search),
}));
vi.mock('@/lib/tracking/use-tracking', () => ({
  useTracking: () => ({ emit: h.emit, consent: {} }),
}));

import { useLocaleTransition } from './use-locale-transition';

function setReducedMotion(matches: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: matches && q.includes('reduce'),
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

beforeEach(() => {
  h.replace.mockReset();
  h.emit.mockReset();
  h.pathname = '/fr/kit';
  h.search = 'utm_source=ig';
  delete (document as unknown as { startViewTransition?: unknown })
    .startViewTransition;
  setReducedMotion(false);
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute('dir');
});

describe('INV-11 — no-op sur la langue active', () => {
  it('ne navigue pas si target === active', () => {
    const { result } = renderHook(() => useLocaleTransition());
    expect(result.current.active).toBe('fr');
    act(() => result.current.switchTo('fr', 'header'));
    expect(h.replace).not.toHaveBeenCalled();
    expect(h.emit).not.toHaveBeenCalled();
  });
});

describe('INV-7 — reduced-motion : bascule directe', () => {
  it('applique dir + URL (UTM préservé) + event reduced, sans VT', () => {
    setReducedMotion(true);
    const { result } = renderHook(() => useLocaleTransition());
    act(() => result.current.switchTo('ar', 'header'));
    expect(document.documentElement.dir).toBe('rtl'); // INV-2
    expect(h.replace).toHaveBeenCalledWith('/ar/kit?utm_source=ig'); // INV-4
    expect(h.emit).toHaveBeenCalledWith(
      'locale_switch',
      expect.objectContaining({ from: 'fr', to: 'ar', transition: 'reduced' }),
    );
  });
});

describe('mode View Transitions', () => {
  it('utilise startViewTransition et pose dir rtl (INV-2)', () => {
    const startViewTransition = vi.fn((cb: () => void) => {
      cb();
      return {};
    });
    (
      document as unknown as { startViewTransition: unknown }
    ).startViewTransition = startViewTransition;
    const { result } = renderHook(() => useLocaleTransition());
    act(() => result.current.switchTo('ar', 'footer'));
    expect(startViewTransition).toHaveBeenCalledTimes(1);
    expect(document.documentElement.dir).toBe('rtl');
    expect(h.replace).toHaveBeenCalledWith('/ar/kit?utm_source=ig');
    expect(h.emit).toHaveBeenCalledWith(
      'locale_switch',
      expect.objectContaining({ transition: 'vt', surface: 'footer' }),
    );
  });
});

describe('mode voile (fallback)', () => {
  it('joue le voile puis applique la bascule (event veil)', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useLocaleTransition());
    act(() => result.current.switchTo('en', 'drawer'));
    // phase "in" immédiate, replace pas encore appelé
    expect(result.current.veil.active).toBe(true);
    expect(h.replace).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(200));
    expect(h.replace).toHaveBeenCalledWith('/en/kit?utm_source=ig');
    expect(h.emit).toHaveBeenCalledWith(
      'locale_switch',
      expect.objectContaining({ transition: 'veil', to: 'en' }),
    );
    vi.useRealTimers();
  });
});

describe('INV-1 — reload de secours si la soft-nav échoue', () => {
  it('appelle window.location.assign et émet transition reload', () => {
    setReducedMotion(true);
    h.replace.mockImplementation(() => {
      throw new Error('nav failed');
    });
    const assign = vi.fn();
    vi.stubGlobal('location', { assign } as unknown as Location);
    const { result } = renderHook(() => useLocaleTransition());
    act(() => result.current.switchTo('ar', 'header'));
    expect(assign).toHaveBeenCalledWith('/ar/kit?utm_source=ig');
    expect(h.emit).toHaveBeenCalledWith(
      'locale_switch',
      expect.objectContaining({ transition: 'reload' }),
    );
  });
});
