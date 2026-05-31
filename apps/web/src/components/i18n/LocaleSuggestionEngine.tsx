/**
 * Moteur de suggestion — composant de montage (lot L10).
 *
 * Branche le runtime `useLocaleSuggestionEngine` au composant de présentation
 * `LocaleSuggestionPrompt` : rien n'est rendu tant que le moteur ne décide pas
 * de montrer une proposition (au breakpoint). Inerte si moteur off (INV-13).
 *
 * Les amorces serveur (`guessedLocale`, `confidence`, `config`) sont résolues
 * en RSC (no-flash) et passées en props. Les libellés sont des endonymes
 * (jamais de latin sur /ar — INV-6) ; fournis en props, sinon dérivés.
 *
 * @see docs/locale-switcher-v2/10-suggestion-engine/04-frontend/engine-runtime.md
 */
'use client';

import { getLocaleConfig, type Locale } from '@/i18n.config';
import { type ResolvedEngineConfig } from '@/lib/i18n/engine-config-schema';

import { LocaleSuggestionPrompt } from './LocaleSuggestionPrompt';
import { useLocaleSuggestionEngine } from './use-locale-suggestion-engine';

export interface LocaleSuggestionEngineLabels {
  switchLabel: string;
  stayLabel: string;
  ariaLabel: string;
}

export interface LocaleSuggestionEngineProps {
  guessedLocale: Locale;
  confidence: number;
  config: ResolvedEngineConfig;
  /** Libellés (résolus serveur). À défaut : endonyme + libellés neutres. */
  labels?: LocaleSuggestionEngineLabels;
}

export function LocaleSuggestionEngine({
  guessedLocale,
  confidence,
  config,
  labels,
}: LocaleSuggestionEngineProps): JSX.Element | null {
  const { prompt, accept, dismiss } = useLocaleSuggestionEngine({
    guessedLocale,
    confidence,
    config,
  });

  if (!prompt) return null;

  const endonym = getLocaleConfig(prompt.suggested).displayNameNative;
  const resolved: LocaleSuggestionEngineLabels = labels ?? {
    switchLabel: endonym,
    stayLabel: '×',
    ariaLabel: endonym,
  };

  return (
    <LocaleSuggestionPrompt
      suggested={prompt.suggested}
      surface={prompt.surface}
      switchLabel={resolved.switchLabel}
      stayLabel={resolved.stayLabel}
      ariaLabel={resolved.ariaLabel}
      onAccept={accept}
      onDismiss={() => dismiss('persistent')}
    />
  );
}
