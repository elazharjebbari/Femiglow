/**
 * BS05 — Admin publie un nouveau canned pair.
 *
 * Référence : `docs/chat-test-strategy-2026-05/03-business-scenarios/BS05-admin-publie-canned.md`
 *
 * STATUS : skip — nécessite admin auth + DB transactionnelle isolée.
 * Couverture parallèle assurée par tests admin/queries.test.ts et
 * admin-coverage.regression.test.ts (présence pages + routes).
 */
import { test } from '@playwright/test';

test.describe('@critical BS05 — Admin publie canned', () => {
  test.skip('admin crée canned → visible côté visiteur < 10s', async () => {});
  test.skip('édition crée nouvelle version immutable', async () => {});
});
