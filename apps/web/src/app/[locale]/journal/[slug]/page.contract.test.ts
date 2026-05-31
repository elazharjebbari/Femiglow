/**
 * Contract test pour `/[locale]/journal/[slug]/page.tsx`.
 *
 * @see apps/web/src/app/[locale]/journal/[slug]/page.tsx
 */
import { describe } from 'vitest';

import { assertI18nKeysExist } from '@/test/helpers/i18n-keys';

const REQUIRED_KEYS = [
  // Breadcrumb
  'navigation.home',
  'navigation.journal',
  // 404 fallback metadata
  'errors.404.title',
] as const;

describe('Contract: /[locale]/journal/[slug] — keys exist in FR/AR/EN', () => {
  assertI18nKeysExist(REQUIRED_KEYS);
});
