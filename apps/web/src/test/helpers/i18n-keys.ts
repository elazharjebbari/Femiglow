/**
 * Helper de test — vérifie qu'un ensemble de clés i18n existe dans toutes
 * les locales. Pattern "contract test" qui prévient le drift code ↔ messages.
 *
 * Usage typique : pour chaque page migrée vers `app/[locale]/`, on crée
 * un test `*.contract.test.ts` qui liste les clés consommées par la page,
 * et passe par `assertI18nKeysExist` pour valider la présence dans FR/AR/EN.
 *
 * Si un traducteur supprime une clé d'`ar.json` par erreur, le test fail
 * IMMÉDIATEMENT en CI — pas besoin d'attendre un crash runtime.
 *
 * @example
 * import { assertI18nKeysExist } from '@/test/helpers/i18n-keys';
 *
 * describe('/[locale]/contact contract', () => {
 *   assertI18nKeysExist([
 *     'marketing.contact.metadata.title',
 *     'marketing.contact.faq.duree.question',
 *   ]);
 * });
 */
import { describe, expect, it } from 'vitest';

import frMessages from '../../../messages/fr.json';
import arMessages from '../../../messages/ar.json';
import enMessages from '../../../messages/en.json';
import { LOCALES, type Locale } from '../../i18n.config';

type MessagesShape = Record<string, unknown>;

const MESSAGES_BY_LOCALE: Record<Locale, MessagesShape> = {
  fr: frMessages as MessagesShape,
  ar: arMessages as MessagesShape,
  en: enMessages as MessagesShape,
};

/**
 * Résout une clé dotted (ex: `marketing.contact.faq.duree.question`)
 * dans un objet messages et retourne la valeur (string) ou `undefined` si
 * la clé n'existe pas / n'est pas une string.
 */
function resolveKey(messages: MessagesShape, key: string): string | undefined {
  const parts = key.split('.');
  let current: unknown = messages;
  for (const part of parts) {
    if (typeof current !== 'object' || current === null) return undefined;
    current = (current as MessagesShape)[part];
  }
  return typeof current === 'string' ? current : undefined;
}

/**
 * Génère une suite de tests qui vérifie que chaque clé existe dans chaque
 * locale spécifiée (par défaut toutes les LOCALES).
 *
 * À appeler à l'intérieur d'un `describe` (pas en top-level).
 */
export function assertI18nKeysExist(
  keys: readonly string[],
  locales: readonly Locale[] = LOCALES,
): void {
  describe.each(locales)('locale %s', (locale) => {
    const messages = MESSAGES_BY_LOCALE[locale];

    it.each(keys)('has non-empty string key %s', (key) => {
      const value = resolveKey(messages, key);
      expect(value, `Missing key "${key}" in messages-${locale}.json`).toBeTypeOf(
        'string',
      );
      expect(
        value && value.trim().length,
        `Key "${key}" is empty in messages-${locale}.json`,
      ).toBeGreaterThan(0);
    });
  });
}

/**
 * Variante stricte : en plus de vérifier l'existence, retourne la valeur FR
 * (pour des assertions plus poussées comme le format ICU, longueur SEO, etc.).
 */
export function getMessageFor(locale: Locale, key: string): string | undefined {
  return resolveKey(MESSAGES_BY_LOCALE[locale], key);
}
