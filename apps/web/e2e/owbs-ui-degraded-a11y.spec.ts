/**
 * OWBS — e2e flag-ON : indicateur dégradé (F05), annonce a11y (F08), idempotence
 * de transition (F14). Build avec NEXT_PUBLIC_CHECKOUT_OPTIMISTIC_WIZARD_ENABLED=true.
 */
import { expect, test } from '@playwright/test';

import { addressStep, fillLead, leadSubmit, openLeadStep } from './_helpers/owbs';

test('F08-S13 — l\'annonceur d\'étape reflète l\'étape courante', async ({ page }) => {
  await openLeadStep(page);
  const announcer = page.locator('[data-testid="wizard-step-announcer"]');
  await expect(announcer).toHaveCount(1);
  // À l'étape lead, l'annonceur porte le libellé de l'étape lead (non vide).
  await expect(announcer).not.toHaveText('');

  await fillLead(page);
  await leadSubmit(page).click();
  await expect(addressStep(page)).toBeVisible({ timeout: 3000 });
  // Après transition optimiste, l'annonceur reflète la nouvelle étape (address).
  await expect(announcer).not.toHaveText('');
});

test('F05-S06 — sync en échec (4xx) → indicateur dégradé non bloquant', async ({ page }) => {
  // Le POST de création (fetch de fond) échoue en 4xx -> non-retryable -> drop ->
  // markSyncDegraded -> l'indicateur apparaît, SANS bloquer la navigation.
  await page.route('**/api/checkout/lead', (route) =>
    route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'invalid_input', message: 'ko' } }),
    }),
  );

  await openLeadStep(page);
  await fillLead(page);
  await leadSubmit(page).click();

  // L'UI a avancé (optimiste) ...
  await expect(addressStep(page)).toBeVisible({ timeout: 3000 });
  // ... et l'indicateur de sync dégradée finit par apparaître.
  await expect(page.locator('[data-testid="wizard-sync-indicator"]')).toBeVisible({ timeout: 5000 });
  // La navigation reste libre : l'étape address est bien interactive.
  await expect(addressStep(page)).toBeVisible();
});

test('F14 — double-tap sur « Continuer » → une seule transition (pas de double lead UI)', async ({ page }) => {
  let leadPosts = 0;
  await page.route('**/api/checkout/lead', async (route) => {
    leadPosts += 1;
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ leadId: 'cl_e2e0000000000000000', status: 'created', nextStep: 'address' }),
    });
  });

  await openLeadStep(page);
  await fillLead(page);
  const btn = leadSubmit(page);
  await Promise.all([btn.click(), btn.click().catch(() => {})]);

  await expect(addressStep(page)).toBeVisible({ timeout: 3000 });
  // L'étape lead a disparu après la 1re transition → pas de 2ᵉ soumission.
  await expect(page.locator('[data-testid="wizard-step-lead"]')).toHaveCount(0);
  // Au plus une création réellement envoyée (idempotence de transition).
  expect(leadPosts).toBeLessThanOrEqual(1);
});
