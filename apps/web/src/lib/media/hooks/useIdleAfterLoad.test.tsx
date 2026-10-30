import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { IDLE_FALLBACK_DELAY_MS, useIdleAfterLoad } from './useIdleAfterLoad';

type IdleWindow = {
  requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

const w = window as unknown as IdleWindow;
const originalRic = w.requestIdleCallback;
const originalCic = w.cancelIdleCallback;

function setReadyState(state: DocumentReadyState): void {
  Object.defineProperty(document, 'readyState', { configurable: true, get: () => state });
}

beforeEach(() => {
  setReadyState('loading');
});

afterEach(() => {
  // Retire l'override d'instance → retour au getter du prototype (jsdom).
  delete (document as unknown as { readyState?: unknown }).readyState;
  w.requestIdleCallback = originalRic;
  w.cancelIdleCallback = originalCic;
  vi.useRealTimers();
});

describe('useIdleAfterLoad', () => {
  it('reste false tant que window.load n’a pas eu lieu', () => {
    const ric = vi.fn(() => 1);
    w.requestIdleCallback = ric;
    const { result } = renderHook(() => useIdleAfterLoad());
    expect(result.current).toBe(false);
    expect(ric).not.toHaveBeenCalled();
  });

  it('passe à true après load PUIS requestIdleCallback', () => {
    let idleCb: (() => void) | undefined;
    w.requestIdleCallback = vi.fn((cb: () => void) => {
      idleCb = cb;
      return 7;
    });
    const { result } = renderHook(() => useIdleAfterLoad());
    act(() => {
      window.dispatchEvent(new Event('load'));
    });
    expect(result.current).toBe(false);
    act(() => idleCb?.());
    expect(result.current).toBe(true);
  });

  it('page déjà chargée → seulement l’attente idle', () => {
    setReadyState('complete');
    let idleCb: (() => void) | undefined;
    w.requestIdleCallback = vi.fn((cb: () => void) => {
      idleCb = cb;
      return 1;
    });
    const { result } = renderHook(() => useIdleAfterLoad());
    expect(result.current).toBe(false);
    act(() => idleCb?.());
    expect(result.current).toBe(true);
  });

  it('repli setTimeout sans requestIdleCallback', () => {
    vi.useFakeTimers();
    w.requestIdleCallback = undefined;
    const { result } = renderHook(() => useIdleAfterLoad());
    act(() => {
      window.dispatchEvent(new Event('load'));
    });
    act(() => {
      vi.advanceTimersByTime(IDLE_FALLBACK_DELAY_MS - 1);
    });
    expect(result.current).toBe(false);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(true);
  });

  it('annule l’attente idle au démontage', () => {
    setReadyState('complete');
    const cic = vi.fn();
    w.requestIdleCallback = vi.fn(() => 42);
    w.cancelIdleCallback = cic;
    const { unmount } = renderHook(() => useIdleAfterLoad());
    unmount();
    expect(cic).toHaveBeenCalledWith(42);
  });
});
