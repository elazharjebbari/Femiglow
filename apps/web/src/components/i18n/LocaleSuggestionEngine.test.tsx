/**
 * Lot L10 — montage `LocaleSuggestionEngine` : rien si off (INV-13), prompt
 * au breakpoint, accept câblé sur switchTo (INV-1).
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  emit: vi.fn(),
  switchTo: vi.fn(),
  pathname: '/fr/kit',
}));

vi.mock('next/navigation', () => ({ usePathname: () => h.pathname }));
vi.mock('@/lib/tracking/use-tracking', () => ({
  useTracking: () => ({ emit: h.emit, consent: {} }),
}));
vi.mock('./locale-transition-context', () => ({
  useLocaleSwitch: () => ({ switchTo: h.switchTo, active: 'fr' }),
}));

import { DEFAULT_ENGINE_CONFIG } from '@/lib/i18n/engine-config-schema';

import { LocaleSuggestionEngine } from './LocaleSuggestionEngine';

function engineOn() {
  return {
    ...DEFAULT_ENGINE_CONFIG,
    engineEnabled: true,
    profiles: DEFAULT_ENGINE_CONFIG.profiles.map((p) =>
      p.id === 'TRIG-ENTRY-MISMATCH' ? { ...p, enabled: true } : p,
    ),
  };
}

beforeEach(() => {
  h.emit.mockReset();
  h.switchTo.mockReset();
  h.pathname = '/fr/kit';
  document.cookie = 'locale_suggestion_dismissed=; max-age=0; path=/';
  window.sessionStorage.clear();
});
afterEach(() => vi.useRealTimers());

describe('moteur off (INV-13)', () => {
  it('ne rend rien', () => {
    render(
      <LocaleSuggestionEngine
        guessedLocale="ar"
        confidence={0.9}
        config={DEFAULT_ENGINE_CONFIG}
      />,
    );
    expect(screen.queryByTestId('locale-suggestion-prompt')).toBeNull();
  });
});

describe('moteur on — affichage au breakpoint', () => {
  it('montre la perle et accepte via switchTo', () => {
    vi.useFakeTimers();
    render(
      <LocaleSuggestionEngine guessedLocale="ar" confidence={0.9} config={engineOn()} />,
    );
    expect(screen.queryByTestId('locale-suggestion-prompt')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(4000);
      window.dispatchEvent(new Event('scroll'));
      vi.advanceTimersByTime(600);
    });

    const prompt = screen.getByTestId('locale-suggestion-prompt');
    expect(prompt.getAttribute('data-suggested')).toBe('ar');
    expect(prompt.getAttribute('data-surface')).toBe('pearl');

    act(() => {
      fireEvent.click(screen.getByTestId('locale-suggestion-accept'));
    });
    expect(h.switchTo).toHaveBeenCalledWith('ar', 'nudge');
  });
});
