/**
 * Contract test pour `/[locale]/legal/[slug]/page.tsx`.
 */
import { describe } from 'vitest';

import { assertI18nKeysExist } from '@/test/helpers/i18n-keys';

const REQUIRED_KEYS = [
  'legal.chrome.back_home',
  'legal.chrome.kicker',
  'legal.chrome.last_updated',
  'legal.chrome.toc',
  'legal.chrome.toc_aria',
  'legal.chrome.version_prefix',
  'legal.chrome.not_found_title',
] as const;

describe('Contract: /[locale]/legal/[slug] — keys exist in FR/AR/EN', () => {
  assertI18nKeysExist(REQUIRED_KEYS);
});
