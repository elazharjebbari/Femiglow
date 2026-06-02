/**
 * OWBS — helpers e2e partagés (pré-vague harness, cf. docs/owbs-ui-test-battery).
 * En vrai navigateur, le masque téléphone et la checkbox se manipulent
 * normalement (pas de pièges jsdom des tests RTL).
 */
import { expect, type Page } from '@playwright/test';

/** Ouvre le wizard sur /<locale>/kit et avance jusqu'à l'étape lead. */
export async function openLeadStep(page: Page, locale = 'fr'): Promise<void> {
  await page.goto(`/${locale}/kit`);
  const shell = page.locator('[data-testid="wizard-shell"]').first();
  await shell.scrollIntoViewIfNeeded();
  const cart = page.locator('[data-testid="wizard-step-cart"]');
  if (await cart.first().isVisible().catch(() => false)) {
    await cart.first().locator('button').first().click();
  }
  await expect(page.locator('[data-testid="wizard-step-lead"]')).toBeVisible({ timeout: 10_000 });
}

/** Remplit l'étape lead avec des données valides et attend le submit activé. */
export async function fillLead(
  page: Page,
  { firstName = 'Salma', phone = '0600000000' } = {},
): Promise<void> {
  const step = page.locator('[data-testid="wizard-step-lead"]');
  // Cibler par name : le 1er input[type=text] est le honeypot `website`.
  await step.locator('input[name="firstName"]').fill(firstName);
  await step.locator('input[name="phone"]').pressSequentially(phone, { delay: 20 });
  await step.locator('input[name="consent"]').check();
  await expect(page.locator('[data-testid="wizard-lead-submit"]')).toBeEnabled({ timeout: 5000 });
}

export const leadSubmit = (page: Page) => page.locator('[data-testid="wizard-lead-submit"]');
export const addressStep = (page: Page) => page.locator('[data-testid="wizard-step-address"]');
