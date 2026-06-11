/**
 * Locale Switcher V2 — provider + contexte (lot L3).
 *
 * Possède **une seule** instance de `useLocaleTransition` pour toute
 * l'application → un seul voile, un seul annonceur, pas de duplication
 * (les différents `LocaleSwitcher` consomment le même `switchTo`).
 *
 * Le contexte est **optionnel** : sans provider, `useLocaleSwitch()`
 * retourne `null` et les switchers gardent leur comportement V1 (zéro
 * régression, le provider n'est monté que derrière le flag).
 *
 * @see docs/locale-switcher-v2/05-frontend/component-architecture.md
 */
'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';

import type { Locale } from '@/i18n.config';

import { LiveAnnouncer } from './LiveAnnouncer';
import { LocaleVeil } from './LocaleVeil';
import {
  useLocaleTransition,
  type SwitchSurface,
} from './use-locale-transition';

interface LocaleTransitionContextValue {
  switchTo: (target: Locale, surface: SwitchSurface) => void;
  active: Locale;
}

const LocaleTransitionContext =
  createContext<LocaleTransitionContextValue | null>(null);

/** `null` si aucun provider monté (→ fallback V1). */
export function useLocaleSwitch(): LocaleTransitionContextValue | null {
  return useContext(LocaleTransitionContext);
}

export function LocaleTransitionProvider({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  const { switchTo, veil, active } = useLocaleTransition();
  const value = useMemo(() => ({ switchTo, active }), [switchTo, active]);
  return (
    <LocaleTransitionContext.Provider value={value}>
      {children}
      <LiveAnnouncer />
      <LocaleVeil veil={veil} />
    </LocaleTransitionContext.Provider>
  );
}
