/**
 * OWBS F12 — parité legacy (RSK-18). À lancer sur un build **flag-OFF**
 * (NEXT_PUBLIC_CHECKOUT_OPTIMISTIC_WIZARD_ENABLED=false). Garantit que, flag OFF,
 * le comportement est l'ancien : l'étape n'avance qu'APRÈS la réponse réseau
 * (await bloquant), et AUCUN flux /sync n'est sollicité.
 *
 * C'est l'inverse exact de TST-E-01 (optimiste < 1,5 s) → preuve de non-régression.
 */
import { expect, test } from '@playwright/test';

import { addressStep, fillLead, leadSubmit, openLeadStep } from './_helpers/owbs';

test('F12-S02 — flag OFF : legacy (attend le réseau, aucun /sync)', async ({ page }) => {
  let syncCalls = 0;
  page.on('request', (r) => {
    if (r.url().includes('/api/checkout/lead/sync')) syncCalls += 1;
  });

  // POST de création retardé de 4 s : en legacy, l'UI DOIT attendre.
  await page.route('**/api/checkout/lead', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    await new Promise((r) => setTimeout(r, 4000));
    return route.fallback();
  });

  await openLeadStep(page);
  await fillLead(page);

  const t0 = Date.now();
  await leadSubmit(page).click();
  await expect(addressStep(page)).toBeVisible({ timeout: 9000 });
  const elapsed = Date.now() - t0;

  // Legacy : l'étape n'apparaît qu'après la réponse (~4 s), pas instantanément.
  expect(elapsed, `legacy doit attendre le réseau (elapsed=${elapsed}ms)`).toBeGreaterThan(3000);
  // Legacy n'utilise ni la file ni le beacon → aucun /sync.
  expect(syncCalls).toBe(0);
});
