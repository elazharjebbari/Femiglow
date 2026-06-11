/**
 * Contract test pour `/[locale]/kit/page.tsx`.
 *
 * NB : la page /kit utilise principalement `resolveSeoMetadata` (admin
 * override CMS) pour title/description — pas de keys i18n consommées
 * directement dans cette phase. Cependant on garde un test contract
 * minimal sur les keys que la page pourrait consommer en Phase 3 (locale
 * passée à `resolveSeoMetadata`).
 *
 * Pour l'instant on vérifie seulement la présence du namespace
 * `marketing.kit.metadata` qui sera utilisé en Phase 3.
 *
 * @see apps/web/src/app/[locale]/kit/page.tsx
 */
import { describe } from 'vitest';

import { assertI18nKeysExist } from '@/test/helpers/i18n-keys';

const REQUIRED_KEYS = [
  // Keys préparées (i18n-content) pour Phase 3 CMS multilingue
  // NB : nommées `*_fallback` car la source primary est `resolveSeoMetadata`
  // (admin CMS override) — ces keys sont le fallback i18n si pas d'override.
  'marketing.kit.metadata.title_fallback',
  'marketing.kit.metadata.description_fallback',
  'marketing.kit.metadata.og_alt',
] as const;

describe('Contract: /[locale]/kit — keys exist in FR/AR/EN', () => {
  assertI18nKeysExist(REQUIRED_KEYS);
});
