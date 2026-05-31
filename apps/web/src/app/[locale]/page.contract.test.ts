/**
 * Contract test pour `/[locale]/page.tsx` (home).
 *
 * @see apps/web/src/app/[locale]/page.tsx
 */
import { describe } from 'vitest';

import { assertI18nKeysExist } from '@/test/helpers/i18n-keys';

const REQUIRED_KEYS = [
  'marketing.home.metadata.title',
  'marketing.home.metadata.description',
  'marketing.home.metadata.og_title',
  'marketing.home.metadata.og_description',
] as const;

describe('Contract: /[locale]/ (home) — keys exist in FR/AR/EN', () => {
  assertI18nKeysExist(REQUIRED_KEYS);
});
