/**
 * OWBS — e2e de la transition optimiste (build flag-ON requis).
 *
 * TST-E-01 : l'étape lead_capture avance vers `address` SANS attendre le réseau.
 *   On retarde fortement `/api/checkout/lead` (le fetch de fond de la file) ;
 *   l'UI doit néanmoins afficher l'étape address quasi immédiatement.
 *
 * Nécessite un build avec NEXT_PUBLIC_CHECKOUT_OPTIMISTIC_WIZARD_ENABLED=true.
 * cf. docs/checkout-leads-background-2026-06-01/04-tests/playwright-plan.md
 */
import { expect, test, type Page } from '@playwright/test';

const NET_DELAY_MS = 6000; // le fetch de fond est très lent…
const UI_BUDGET_MS = 3000; // …mais l'UI doit avancer bien avant.

async function openLeadStep(page: Page): Promise<void> {
  const shell = page.locator('[data-testid="wizard-shell"]').first();
  await shell.scrollIntoViewIfNeeded();
  // Étape panier éventuelle → on passe à l'étape lead.
  const cart = page.locator('[data-testid="wizard-step-cart"]');
  if (await cart.first().isVisible().catch(() => false)) {
    await cart.first().locator('button').first().click();
  }
  await expect(page.locator('[data-testid="wizard-step-lead"]')).toBeVisible({ timeout: 10_000 });
}

async function fillLead(page: Page): Promise<void> {
  const step = page.locator('[data-testid="wizard-step-lead"]');
  // NB : cibler par `name` — le 1er input[type=text] est le honeypot `website`.
  await step.locator('input[name="firstName"]').fill('Salma');
  // Saisie digit-par-digit pour que le masque téléphone traite chaque touche.
  await step.locator('input[name="phone"]').pressSequentially('0600000000', { delay: 20 });
  await step.locator('input[name="consent"]').check();
  // Le bouton se déverrouille quand react-hook-form passe `isValid` (onChange).
  await expect(page.locator('[data-testid="wizard-lead-submit"]')).toBeEnabled({ timeout: 5000 });
}

test('TST-E-01 — lead_capture avance vers address sans attendre le réseau', async ({ page }) => {
  // Le POST de création (envoyé en tâche de fond par la file) est très lent.
  await page.route('**/api/checkout/lead', async (route) => {
    await new Promise((r) => setTimeout(r, NET_DELAY_MS));
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ leadId: 'cl_e2e0000000000000000', status: 'created', nextStep: 'address' }),
    });
  });

  await page.goto('/fr/kit');
  await openLeadStep(page);
  await fillLead(page);

  const t0 = Date.now();
  await page.locator('[data-testid="wizard-lead-submit"]').click();

  // L'étape address doit apparaître bien avant la résolution réseau (6 s).
  await expect(page.locator('[data-testid="wizard-step-address"]')).toBeVisible({
    timeout: UI_BUDGET_MS,
  });
  const elapsed = Date.now() - t0;
  expect(
    elapsed,
    `transition lead→address = ${elapsed}ms (réseau bridé à ${NET_DELAY_MS}ms : l'UI a attendu le réseau)`,
  ).toBeLessThan(UI_BUDGET_MS);
});

test('TST-E-03 — fermeture/masquage onglet → lead flushé via beacon (/sync)', async ({ page }) => {
  // Le fetch de fond échoue → l'envelope reste en file (zéro perte à couvrir).
  await page.route('**/api/checkout/lead', (route) => route.abort());

  await page.goto('/fr/kit');
  await openLeadStep(page);
  await fillLead(page);
  await page.locator('[data-testid="wizard-lead-submit"]').click();
  await expect(page.locator('[data-testid="wizard-step-address"]')).toBeVisible({ timeout: UI_BUDGET_MS });

  // Le masquage de l'onglet déclenche le beacon vers /sync.
  const syncReq = page.waitForRequest('**/api/checkout/lead/sync', { timeout: 5000 });
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });

  const req = await syncReq;
  const body = req.postData() ?? '';
  expect(body, 'le beacon doit porter une envelope lead_create').toContain('lead_create');
  expect(body, 'le beacon doit porter le leadId client').toContain('cl_');
});
