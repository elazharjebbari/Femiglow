/**
 * Lot L10 — runtime `useLocaleSuggestionEngine` (intégration jsdom).
 * Couvre INV-13 (off → inerte), INV-14 (checkout jamais), INV-16 (dismiss
 * persistant), INV-17 (defer → show au breakpoint), INV-20 (no auto-redirect,
 * accept via switchTo). Tests négatifs inclus.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  emit: vi.fn(),
  switchTo: vi.fn(),
  pathname: '/fr/kit',
}));

vi.mock('next/navigation', () => ({
  usePathname: () => h.pathname,
}));
vi.mock('@/lib/tracking/use-tracking', () => ({
  useTracking: () => ({ emit: h.emit, consent: {} }),
}));
vi.mock('./locale-transition-context', () => ({
  useLocaleSwitch: () => ({ switchTo: h.switchTo, active: 'fr' }),
}));

import { DEFAULT_ENGINE_CONFIG } from '@/lib/i18n/engine-config-schema';

import { useLocaleSuggestionEngine } from './use-locale-suggestion-engine';

function engineOnWith(triggerId: string) {
  return {
    ...DEFAULT_ENGINE_CONFIG,
    engineEnabled: true,
    profiles: DEFAULT_ENGINE_CONFIG.profiles.map((p) =>
      p.id === triggerId ? { ...p, enabled: true } : p,
    ),
  };
}

function eventsNamed(name: string) {
  return h.emit.mock.calls.filter((c) => c[0] === name);
}

beforeEach(() => {
  h.emit.mockReset();
  h.switchTo.mockReset();
  h.pathname = '/fr/kit';
  document.cookie = 'locale_suggestion_dismissed=; max-age=0; path=/';
  window.sessionStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('INV-13 — moteur off : inerte', () => {
  it('aucun prompt, évaluation suppress émise, aucun listener scroll, inerte', () => {
    vi.useFakeTimers();
    const addSpy = vi.spyOn(window, 'addEventListener');
    const { result } = renderHook(() =>
      useLocaleSuggestionEngine({
        guessedLocale: 'ar',
        confidence: 0.9,
        config: DEFAULT_ENGINE_CONFIG,
      }),
    );
    expect(result.current.prompt).toBeNull();
    // Une évaluation d'audit a bien eu lieu, mais en suppress (jamais show).
    expect(eventsNamed('locale_suggestion_evaluated').at(-1)?.[1]).toMatchObject({
      decision: 'suppress',
    });
    expect(eventsNamed('locale_suggestion_shown')).toHaveLength(0);
    // INV-13 : aucun listener de scroll → inerte même après activité.
    expect(addSpy).not.toHaveBeenCalledWith(
      'scroll',
      expect.anything(),
      expect.anything(),
    );
    act(() => {
      vi.advanceTimersByTime(5000);
      window.dispatchEvent(new Event('scroll'));
      vi.advanceTimersByTime(600);
    });
    expect(result.current.prompt).toBeNull();
    expect(h.switchTo).not.toHaveBeenCalled();
    addSpy.mockRestore();
  });

  it('moteur off, dwell mûr → raison engine-off', () => {
    // En zone non calme, dwell suffisant : on traverse les never jusqu’à engine-off.
    const ripe = {
      ...DEFAULT_ENGINE_CONFIG,
      profiles: DEFAULT_ENGINE_CONFIG.profiles.filter(
        (p) => p.id !== 'NEVER-FRESH',
      ),
    };
    renderHook(() =>
      useLocaleSuggestionEngine({
        guessedLocale: 'ar',
        confidence: 0.9,
        config: ripe,
      }),
    );
    expect(eventsNamed('locale_suggestion_suppressed').at(-1)?.[1]).toMatchObject({
      reason: 'engine-off',
    });
  });
});

describe('INV-14 — zone calme checkout : jamais', () => {
  it('en checkout, suppress NEVER-CHECKOUT même trigger armé, pas de prompt', () => {
    h.pathname = '/fr/checkout';
    const { result } = renderHook(() =>
      useLocaleSuggestionEngine({
        guessedLocale: 'ar',
        confidence: 0.9,
        config: engineOnWith('TRIG-ENTRY-MISMATCH'),
      }),
    );
    expect(result.current.prompt).toBeNull();
    expect(eventsNamed('locale_suggestion_suppressed').at(-1)?.[1]).toMatchObject({
      neverProfile: 'NEVER-CHECKOUT',
    });
  });
});

describe('INV-20 — pas d’auto-redirect au montage', () => {
  it('switchTo n’est jamais appelé sans clic', () => {
    renderHook(() =>
      useLocaleSuggestionEngine({
        guessedLocale: 'ar',
        confidence: 0.9,
        config: engineOnWith('TRIG-ENTRY-MISMATCH'),
      }),
    );
    expect(h.switchTo).not.toHaveBeenCalled();
  });
});

describe('INV-17 — defer-to-breakpoint', () => {
  it('pas de prompt au chargement, prompt à la pause de scroll', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useLocaleSuggestionEngine({
        guessedLocale: 'ar',
        confidence: 0.9,
        config: engineOnWith('TRIG-ENTRY-MISMATCH'),
      }),
    );
    // Au chargement : dwell ~0 → NEVER-FRESH, aucun prompt.
    expect(result.current.prompt).toBeNull();

    // Laisser le dwell dépasser le seuil de fraîcheur, puis simuler scroll+pause.
    act(() => {
      vi.advanceTimersByTime(4000);
      window.dispatchEvent(new Event('scroll'));
      vi.advanceTimersByTime(600);
    });

    expect(result.current.prompt).toMatchObject({
      suggested: 'ar',
      surface: 'pearl',
      profileMatched: 'TRIG-ENTRY-MISMATCH',
    });
    expect(eventsNamed('locale_suggestion_shown').at(-1)?.[1]).toMatchObject({
      suggested: 'ar',
      profileMatched: 'TRIG-ENTRY-MISMATCH',
    });
  });
});

describe('INV-1/20 — accept bascule via switchTo (sans reload)', () => {
  it('accept appelle switchTo(ar, nudge) et ferme le prompt', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useLocaleSuggestionEngine({
        guessedLocale: 'ar',
        confidence: 0.9,
        config: engineOnWith('TRIG-ENTRY-MISMATCH'),
      }),
    );
    act(() => {
      vi.advanceTimersByTime(4000);
      window.dispatchEvent(new Event('scroll'));
      vi.advanceTimersByTime(600);
    });
    expect(result.current.prompt).not.toBeNull();

    act(() => result.current.accept());
    expect(h.switchTo).toHaveBeenCalledWith('ar', 'nudge');
    expect(result.current.prompt).toBeNull();
    expect(eventsNamed('locale_suggestion_accepted')).toHaveLength(1);
  });
});

describe('INV-16 — dismiss persistant', () => {
  it('pose le cookie et ferme le prompt', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useLocaleSuggestionEngine({
        guessedLocale: 'ar',
        confidence: 0.9,
        config: engineOnWith('TRIG-ENTRY-MISMATCH'),
      }),
    );
    act(() => {
      vi.advanceTimersByTime(4000);
      window.dispatchEvent(new Event('scroll'));
      vi.advanceTimersByTime(600);
    });
    expect(result.current.prompt).not.toBeNull();

    act(() => result.current.dismiss('persistent'));
    expect(result.current.prompt).toBeNull();
    expect(document.cookie).toContain('locale_suggestion_dismissed=1');
    expect(eventsNamed('locale_suggestion_dismissed').at(-1)?.[1]).toMatchObject({
      scope: 'persistent',
    });
  });

  it('un refus persistant existant supprime toute proposition (INV-16)', () => {
    document.cookie = 'locale_suggestion_dismissed=1; path=/';
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useLocaleSuggestionEngine({
        guessedLocale: 'ar',
        confidence: 0.9,
        config: engineOnWith('TRIG-ENTRY-MISMATCH'),
      }),
    );
    act(() => {
      vi.advanceTimersByTime(4000);
      window.dispatchEvent(new Event('scroll'));
      vi.advanceTimersByTime(600);
    });
    expect(result.current.prompt).toBeNull();
    expect(eventsNamed('locale_suggestion_suppressed').at(-1)?.[1]).toMatchObject({
      reason: 'dismissed-persistent',
    });
  });
});
