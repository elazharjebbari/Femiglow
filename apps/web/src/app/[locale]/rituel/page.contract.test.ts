/**
 * Contract test pour `/[locale]/rituel/page.tsx`.
 *
 * Vérifie que les clés i18n consommées par la page existent dans les
 * 3 locales FR/AR/EN avec des valeurs non-vides.
 *
 * @see apps/web/src/app/[locale]/rituel/page.tsx
 * @see apps/web/src/test/helpers/i18n-keys.ts
 */
import { describe } from 'vitest';

import { assertI18nKeysExist } from '@/test/helpers/i18n-keys';

const REQUIRED_KEYS = [
  // generateMetadata
  'marketing.rituel.metadata.title',
  'marketing.rituel.metadata.description',
  'marketing.rituel.metadata.og_title',
  'marketing.rituel.metadata.og_description',
  // JSON-LD howTo (page corps)
  'marketing.rituel.howto.name',
  'marketing.rituel.howto.description',
] as const;

describe('Contract: /[locale]/rituel — keys exist in FR/AR/EN', () => {
  assertI18nKeysExist(REQUIRED_KEYS);
});
