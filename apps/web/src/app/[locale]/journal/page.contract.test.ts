/**
 * Contract test pour `/[locale]/journal/page.tsx`.
 *
 * Vérifie que les clés i18n consommées par la page existent dans les
 * 3 locales FR/AR/EN avec des valeurs non-vides.
 *
 * @see apps/web/src/app/[locale]/journal/page.tsx
 * @see apps/web/src/test/helpers/i18n-keys.ts
 */
import { describe } from 'vitest';

import { assertI18nKeysExist } from '@/test/helpers/i18n-keys';

const REQUIRED_KEYS = [
  // generateMetadata
  'marketing.journal.metadata.title_base',
  'marketing.journal.metadata.description_default',
  'marketing.journal.metadata.description_filtered',
  // CrossLinkBanner
  'marketing.journal.cross.maison.kicker',
  'marketing.journal.cross.maison.title',
  'marketing.journal.cross.maison.description',
  'marketing.journal.cross.maison.cta',
  'marketing.journal.cross.maison.image_alt',
] as const;

describe('Contract: /[locale]/journal — keys exist in FR/AR/EN', () => {
  assertI18nKeysExist(REQUIRED_KEYS);
});
