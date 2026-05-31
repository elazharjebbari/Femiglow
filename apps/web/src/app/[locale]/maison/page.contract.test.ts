/**
 * Contract test pour `/[locale]/maison/page.tsx`.
 *
 * @see apps/web/src/app/[locale]/maison/page.tsx
 * @see apps/web/src/test/helpers/i18n-keys.ts
 */
import { describe } from 'vitest';

import { assertI18nKeysExist } from '@/test/helpers/i18n-keys';

const REQUIRED_KEYS = [
  'marketing.maison.metadata.title',
  'marketing.maison.metadata.description',
  'marketing.maison.metadata.og_title',
  'marketing.maison.metadata.og_description',
  'marketing.maison.metadata.og_alt',
] as const;

describe('Contract: /[locale]/maison — keys exist in FR/AR/EN', () => {
  assertI18nKeysExist(REQUIRED_KEYS);
});
