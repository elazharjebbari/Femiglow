/**
 * OWBS F06 — résilience réseau (conditions Maroc-mobile). Build flag-ON.
 *
 * On simule un **échec transitoire du POST de création** (réseau global OK pour
 * ne pas casser le chargement des chunks JS de l'étape suivante) : les 2
 * premières tentatives échouent, puis le réseau « revient » → un retry de la
 * file finit par envoyer le lead (201). Valide le retry/backoff de bout en bout.
 */
import { expect, test } from '@playwright/test';

import { addressStep, fillLead, leadSubmit, openLeadStep } from './_helpers/owbs';

test('F06 — échec transitoire du POST puis succès (retry de la file)', async ({ page }) => {
  let attempts = 0;
  const ok201: number[] = [];

  await page.route('**/api/checkout/lead', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    attempts += 1;
    if (attempts <= 2) return route.abort('failed'); // 2 échecs réseau transitoires
    return route.fallback(); // puis le vrai serveur répond 201
  });
  page.on('response', (r) => {
    if (r.request().method() === 'POST' && /\/api\/checkout\/lead$/.test(r.url()) && r.status() === 201) {
      ok201.push(201);
    }
  });

  await openLeadStep(page);
  await fillLead(page);
  await leadSubmit(page).click();

  // UI optimiste : avance immédiatement malgré l'échec réseau.
  await expect(addressStep(page)).toBeVisible({ timeout: 3000 });

  // La file réessaie et finit par réussir (201).
  await expect.poll(() => ok201.length, { timeout: 12000 }).toBeGreaterThanOrEqual(1);
  // Il a bien fallu plusieurs tentatives (retry effectif).
  expect(attempts).toBeGreaterThanOrEqual(3);
});
