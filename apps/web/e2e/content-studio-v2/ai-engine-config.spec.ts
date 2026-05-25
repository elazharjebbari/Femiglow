/**
 * AI Engine — Configuration page E2E tests.
 *
 * Verifies that the config page loads with its 4 tabs, that the providers
 * tab shows OpenAI as configured, and that clicking tabs switches content.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { gotoAIEngine, ensureAuthOrSkip } from './ai-engine-helpers';

test.use({ storageState: ADMIN_STORAGE_PATH });

test('config — page loads with "Configuration" header', async ({ page }) => {
  await gotoAIEngine(page, 'config');
  ensureAuthOrSkip(page);

  await expect(page.getByText('AI Engine')).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByRole('heading', { name: /Configuration/i }),
  ).toBeVisible({ timeout: 15_000 });
});

test('config — four tabs are visible', async ({ page }) => {
  await gotoAIEngine(page, 'config');
  ensureAuthOrSkip(page);

  // Wait for the tab navigation to appear (data loaded).
  for (const label of ['Fournisseurs', 'Workflows', 'Prompts', 'Base de connaissances']) {
    await expect(
      page.getByRole('button', { name: label }),
    ).toBeVisible({ timeout: 20_000 });
  }
});

test('config — providers tab shows OpenAI as "Configure"', async ({ page }) => {
  await gotoAIEngine(page, 'config');
  ensureAuthOrSkip(page);

  // Wait for providers to load (the "Fournisseurs IA" sub-heading appears).
  await expect(page.getByText('Fournisseurs IA')).toBeVisible({ timeout: 20_000 });

  // The OpenAI card should show "Configuré" badge.
  await expect(page.getByText('OpenAI')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Configure').first()).toBeVisible({ timeout: 10_000 });
});

test('config — clicking tabs switches content', async ({ page }) => {
  await gotoAIEngine(page, 'config');
  ensureAuthOrSkip(page);

  // Wait for initial tab to load.
  await expect(page.getByText('Fournisseurs IA')).toBeVisible({ timeout: 20_000 });

  // Click "Workflows" tab.
  await page.getByRole('button', { name: 'Workflows' }).click();
  await expect(
    page.getByText(/Workflows de generation/i),
  ).toBeVisible({ timeout: 10_000 });

  // Click "Prompts" tab.
  await page.getByRole('button', { name: 'Prompts' }).click();
  await expect(
    page.getByText(/Templates de prompts/i),
  ).toBeVisible({ timeout: 10_000 });

  // Click "Base de connaissances" tab.
  await page.getByRole('button', { name: 'Base de connaissances' }).click();
  await expect(
    page.getByText(/Gerez les collections/i),
  ).toBeVisible({ timeout: 10_000 });
});
