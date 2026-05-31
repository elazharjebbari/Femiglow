'use client';

/**
 * CHA-231 — Hook React `useWizardTranslation()`.
 *
 * Lit la langue courante depuis le wizard store et expose :
 *   - `t`         : le dictionnaire complet typé (accès direct, pas d'helper
 *                   pour éviter la perte de type-safety).
 *   - `language`  : la locale active.
 *   - `dir`       : la direction du texte (`'ltr'` ou `'rtl'`), utile pour
 *                   les composants qui doivent flip leur layout.
 *
 * Usage :
 *   const { t, dir } = useWizardTranslation();
 *   return <h1 dir={dir}>{t.address.title}</h1>;
 */

import { useMemo } from 'react';

import { selectLanguage, useWizardStore } from '@/lib/checkout/state/wizard-store';

import {
  getWizardDictionary,
  type DictionaryLanguage,
  type WizardDictionary,
} from './dictionary';

interface WizardTranslation {
  t: WizardDictionary;
  language: DictionaryLanguage;
  dir: 'ltr' | 'rtl';
}

export function useWizardTranslation(): WizardTranslation {
  const language = useWizardStore(selectLanguage);
  return useMemo<WizardTranslation>(
    () => ({
      t: getWizardDictionary(language),
      language,
      dir: language === 'ar' ? 'rtl' : 'ltr',
    }),
    [language],
  );
}
