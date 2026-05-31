/**
 * Tests `useVisualViewportHeight` — hook clavier-aware mobile.
 *
 * Couvre :
 *  - Fallback `window.innerHeight` si `visualViewport` API absente
 *    (vieux browsers, JSDOM par défaut).
 *  - Mise à jour live quand `visualViewport.resize` se déclenche
 *    (cas réel : clavier virtuel iOS qui apparaît/disparaît).
 *  - Désabonnement propre au démontage (anti-leak).
 *
 * cf. docs/chat-assistant/21-mobile-ux-plan.md §2.2 F6
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useVisualViewportHeight } from './use-visual-viewport';

const ORIGINAL_VV = window.visualViewport;
const ORIGINAL_INNER = window.innerHeight;

afterEach(() => {
  // Restore JSDOM defaults.
  Object.defineProperty(window, 'visualViewport', {
    value: ORIGINAL_VV,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(window, 'innerHeight', {
    value: ORIGINAL_INNER,
    configurable: true,
    writable: true,
  });
  vi.restoreAllMocks();
});

describe('useVisualViewportHeight', () => {
  it('retourne window.innerHeight quand visualViewport est absent', () => {
    Object.defineProperty(window, 'visualViewport', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(window, 'innerHeight', {
      value: 800,
      configurable: true,
      writable: true,
    });
    const { result } = renderHook(() => useVisualViewportHeight());
    expect(result.current).toBe(800);
  });

  it('met à jour la valeur quand visualViewport.resize se déclenche', () => {
    const listeners = new Map<string, EventListener>();
    const fakeVV = {
      height: 600,
      addEventListener: (ev: string, cb: EventListener) => {
        listeners.set(ev, cb);
      },
      removeEventListener: (ev: string) => {
        listeners.delete(ev);
      },
    };
    Object.defineProperty(window, 'visualViewport', {
      value: fakeVV,
      configurable: true,
      writable: true,
    });

    const { result } = renderHook(() => useVisualViewportHeight());
    expect(result.current).toBe(600);

    // Simule l'apparition du clavier virtuel : viewport rétrécit.
    act(() => {
      fakeVV.height = 380;
      listeners.get('resize')?.(new Event('resize'));
    });
    expect(result.current).toBe(380);
  });

  it('désabonne les listeners au démontage', () => {
    const listeners = new Map<string, EventListener>();
    let removeCalls = 0;
    const fakeVV = {
      height: 600,
      addEventListener: (ev: string, cb: EventListener) => {
        listeners.set(ev, cb);
      },
      removeEventListener: (ev: string) => {
        removeCalls += 1;
        listeners.delete(ev);
      },
    };
    Object.defineProperty(window, 'visualViewport', {
      value: fakeVV,
      configurable: true,
      writable: true,
    });

    const { unmount } = renderHook(() => useVisualViewportHeight());
    unmount();
    // 2 listeners (`resize` + `scroll`) → 2 removeEventListener.
    expect(removeCalls).toBe(2);
  });
});
