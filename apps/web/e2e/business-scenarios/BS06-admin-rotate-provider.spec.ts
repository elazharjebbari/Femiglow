/**
 * BS06 — Admin rotate provider (OpenAI → Gemini).
 *
 * STATUS : skip — nécessite admin auth + chargements multiples + DB shared
 * mais transactionnellement clean.
 */
import { test } from '@playwright/test';

test.describe('@critical BS06 — Rotation provider primary', () => {
  test.skip('bascule priority sans interrompre conversations en cours', async () => {});
  test.skip('reset breaker remet compteurs à zéro', async () => {});
});
