'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Theme provider for Content Studio v2.
 *
 * Tri-state ('light' | 'dark' | 'system'). The resolved theme is applied
 * via `data-theme` on the inner `.cs-v2-shell` wrapper. The choice is
 * persisted in localStorage (key: `cs-v2-theme`) so it survives reloads.
 *
 * Note on SSR flash: the initial render uses 'light' to keep the markup
 * stable. A blocking inline script in the layout (added in a follow-up
 * if a FOUC is observed) can rehydrate the theme synchronously from
 * localStorage before paint.
 */

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (next: ThemePreference) => void;
  toggle: () => void;
}

const STORAGE_KEY = 'cs-v2-theme';

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readPreference(): ThemePreference {
  if (typeof window === 'undefined') return 'light';
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  return 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('light');
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>('light');

  // Hydrate from localStorage + system after mount (avoids SSR mismatch).
  useEffect(() => {
    setPreferenceState(readPreference());
    setSystemTheme(resolveSystemTheme());
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => setSystemTheme(event.matches ? 'dark' : 'light');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const resolved: ResolvedTheme = preference === 'system' ? systemTheme : preference;

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  }, []);

  const toggle = useCallback(() => {
    setPreferenceState((current) => {
      const next: ThemePreference = current === 'dark' ? 'light' : 'dark';
      if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  // Apply data-theme to the closest .cs-v2-shell wrapper.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.querySelector('.cs-v2-shell');
    if (!root) return;
    root.setAttribute('data-theme', resolved);
  }, [resolved]);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, resolved, setPreference, toggle }),
    [preference, resolved, setPreference, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside <ThemeProvider>');
  }
  return ctx;
}
