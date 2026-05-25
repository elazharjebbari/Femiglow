/**
 * AI Engine — Knowledge Base E2E tests.
 *
 * Verifies that the knowledge page loads, collections are listed with
 * document/chunk counts, and the "Generer les embeddings" button is visible.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { gotoAIEngine, ensureAuthOrSkip } from './ai-engine-helpers';

test.use({ storageState: ADMIN_STORAGE_PATH });

test('knowledge — page loads with collections listed', async ({ page }) => {
  await gotoAIEngine(page, 'knowledge');
  ensureAuthOrSkip(page);

  await expect(page.getByText('AI Engine')).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByRole('heading', { name: /Base de connaissances/i }),
  ).toBeVisible({ timeout: 15_000 });

  // Wait for loading to finish: either collections appear or the empty state.
  const collectionsSection = page.getByText('Collections');
  const emptyState = page.getByText('Aucune collection');

  await expect(
    collectionsSection.or(emptyState),
  ).toBeVisible({ timeout: 20_000 });
});

test('knowledge — collections show document and chunk counts', async ({ page }) => {
  await gotoAIEngine(page, 'knowledge');
  ensureAuthOrSkip(page);

  // Wait for data to load.
  await expect(
    page.getByRole('heading', { name: /Base de connaissances/i }),
  ).toBeVisible({ timeout: 15_000 });

  // The stat cards show "Documents" and "Chunks" labels.
  const docsLabel = page.getByText('Documents');
  const chunksLabel = page.getByText('Chunks');

  await expect(docsLabel.first()).toBeVisible({ timeout: 20_000 });
  await expect(chunksLabel.first()).toBeVisible({ timeout: 10_000 });
});

test('knowledge — "Generer les embeddings" button is visible', async ({ page }) => {
  await gotoAIEngine(page, 'knowledge');
  ensureAuthOrSkip(page);

  await expect(
    page.getByRole('heading', { name: /Base de connaissances/i }),
  ).toBeVisible({ timeout: 15_000 });

  const embedButton = page.getByRole('button', { name: /Générer les embeddings/i });
  await expect(embedButton).toBeVisible({ timeout: 15_000 });
});
