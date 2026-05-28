/**
 * Type augmentation `next-intl` — clés de traduction type-safe.
 *
 * Cette déclaration garantit que `t('marketing.hero.title')` est validé à
 * la compilation : si la clé n'existe pas dans `messages/fr.json`,
 * TypeScript rejette le code.
 *
 * Le fichier source de vérité est `messages/fr.json` (locale par défaut).
 * Les autres locales DOIVENT respecter le même shape (validé par script
 * `validate-seeds.py`).
 *
 * @see docs/i18n-strategy-2026-05/04-frontend/translation-keys.md
 */
import 'next-intl';

import type messages from '@/messages/fr.json';

declare module 'next-intl' {
  // Étend l'interface IntlMessages avec le shape réel des messages FR.
  // next-intl utilise cette info pour :
  //   - autocomplete des keys dans useTranslations / getTranslations
  //   - type-check des plurals / interpolations
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AppConfig {
    Messages: typeof messages;
  }
}
