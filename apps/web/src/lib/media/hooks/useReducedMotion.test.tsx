import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useReducedMotion } from './useReducedMotion';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useReducedMotion', () => {
  it('renvoie false par défaut', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: false,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it('renvoie true quand reduce est actif', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });
});
