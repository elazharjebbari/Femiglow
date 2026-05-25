/**
 * AI Engine — Knowledge Base E2E tests.
 *
 * Uses page.route() to mock the knowledge API for deterministic tests.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { gotoAIEngine, ensureAuthOrSkip } from './ai-engine-helpers';

test.use({ storageState: ADMIN_STORAGE_PATH });

const MOCK_COLLECTIONS = {
  collections: [
    {
      id: 'col-1',
      name: 'Ingredients J-Beauty',
      slug: 'ingredients-j-beauty',
      description: 'Collection des ingredients japonais utilises par FemiGlow',
      category: 'science',
      documentCount: 12,
      chunkCount: 87,
      lastIndexedAt: new Date().toISOString(),
      isActive: true,
    },
    {
      id: 'col-2',
      name: 'Strategie de marque',
      slug: 'strategie-marque',
      description: 'Guidelines et tone of voice FemiGlow',
      category: 'brand',
      documentCount: 5,
      chunkCount: 34,
      lastIndexedAt: new Date().toISOString(),
      isActive: true,
    },
    {
      id: 'col-3',
      name: 'Plateforme Instagram',
      slug: 'plateforme-instagram',
      description: null,
      category: 'platform',
      documentCount: 3,
      chunkCount: 0,
      lastIndexedAt: null,
      isActive: true,
    },
  ],
};

const MOCK_DOCUMENTS = {
  documents: [
    {
      id: 'doc-1',
      title: 'Guide Tsubaki Oil',
      sourceType: 'text',
      chunkCount: 15,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'doc-2',
      title: 'Rituel Camellia',
      sourceType: 'text',
      chunkCount: 10,
      createdAt: new Date().toISOString(),
    },
  ],
};

/** Set up mock route for knowledge API. */
async function mockKnowledgeAPIs(page: import('@playwright/test').Page) {
  await page.route('**/api/admin/ai-engine/knowledge', async (route) => {
    // Only intercept the base endpoint (not /embed or /{slug}/documents)
    const url = new URL(route.request().url());
    if (url.pathname === '/api/admin/ai-engine/knowledge') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_COLLECTIONS),
      });
    } else {
      await route.continue();
    }
  });
  await page.route('**/api/admin/ai-engine/knowledge/*/documents', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_DOCUMENTS),
    });
  });
  await page.route('**/api/admin/ai-engine/knowledge/embed', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ documentsProcessed: 20, chunksCreated: 121, errors: [] }),
    });
  });
}

// ─────────────────────────────────────────────────────────────────
// 1. Page loads with "Base de connaissances" title
// ─────────────────────────────────────────────────────────────────
test('knowledge — page loads with "Base de connaissances" title', async ({ page }) => {
  await mockKnowledgeAPIs(page);
  await gotoAIEngine(page, 'knowledge');
  ensureAuthOrSkip(page);

  await expect(page.getByText('AI Engine')).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByRole('heading', { name: /Base de connaissances/i }),
  ).toBeVisible({ timeout: 15_000 });
});

// ─────────────────────────────────────────────────────────────────
// 2. Stats cards show (Collections, Documents, Chunks)
// ─────────────────────────────────────────────────────────────────
test('knowledge — stats cards show (Collections, Documents, Chunks)', async ({ page }) => {
  await mockKnowledgeAPIs(page);
  await gotoAIEngine(page, 'knowledge');
  ensureAuthOrSkip(page);

  await expect(
    page.getByRole('heading', { name: /Base de connaissances/i }),
  ).toBeVisible({ timeout: 15_000 });

  // Stat card labels
  await expect(page.getByText('Collections').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Documents').first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Chunks').first()).toBeVisible({ timeout: 10_000 });
});

// ─────────────────────────────────────────────────────────────────
// 3. Collection rows render
// ─────────────────────────────────────────────────────────────────
test('knowledge — collection rows render', async ({ page }) => {
  await mockKnowledgeAPIs(page);
  await gotoAIEngine(page, 'knowledge');
  ensureAuthOrSkip(page);

  await expect(
    page.getByRole('heading', { name: /Base de connaissances/i }),
  ).toBeVisible({ timeout: 15_000 });

  // Collection names from mock
  await expect(page.getByText('Ingredients J-Beauty')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Strategie de marque')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Plateforme Instagram')).toBeVisible({ timeout: 10_000 });
});

// ─────────────────────────────────────────────────────────────────
// 4. Collection shows name and category
// ─────────────────────────────────────────────────────────────────
test('knowledge — collection shows name and category badge', async ({ page }) => {
  await mockKnowledgeAPIs(page);
  await gotoAIEngine(page, 'knowledge');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Ingredients J-Beauty')).toBeVisible({ timeout: 20_000 });

  // Category badges: Science, Marque, Plateforme
  await expect(page.getByText('Science')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Marque')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Plateforme').first()).toBeVisible({ timeout: 10_000 });
});

// ─────────────────────────────────────────────────────────────────
// 5. "Générer les embeddings" button visible
// ─────────────────────────────────────────────────────────────────
test('knowledge — "Générer les embeddings" button visible', async ({ page }) => {
  await mockKnowledgeAPIs(page);
  await gotoAIEngine(page, 'knowledge');
  ensureAuthOrSkip(page);

  await expect(
    page.getByRole('heading', { name: /Base de connaissances/i }),
  ).toBeVisible({ timeout: 15_000 });

  const embedButton = page.getByRole('button', { name: /Générer les embeddings/i });
  await expect(embedButton).toBeVisible({ timeout: 15_000 });
});

// ─────────────────────────────────────────────────────────────────
// 6. Click collection expands documents
// ─────────────────────────────────────────────────────────────────
test('knowledge — click collection expands documents', async ({ page }) => {
  await mockKnowledgeAPIs(page);
  await gotoAIEngine(page, 'knowledge');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Ingredients J-Beauty')).toBeVisible({ timeout: 20_000 });

  // Click the first collection row to expand it.
  await page.getByText('Ingredients J-Beauty').click();

  // Wait for documents to load (from mock).
  await expect(page.getByText('Guide Tsubaki Oil')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Rituel Camellia')).toBeVisible({ timeout: 10_000 });
});

// ─────────────────────────────────────────────────────────────────
// 7. Document ingestion form appears on expand
// ─────────────────────────────────────────────────────────────────
test('knowledge — "Ajouter un document" button appears on expand', async ({ page }) => {
  await mockKnowledgeAPIs(page);
  await gotoAIEngine(page, 'knowledge');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Ingredients J-Beauty')).toBeVisible({ timeout: 20_000 });
  await page.getByText('Ingredients J-Beauty').click();

  // Wait for the expanded content to show.
  await expect(page.getByText('Guide Tsubaki Oil')).toBeVisible({ timeout: 15_000 });

  // "Ajouter un document" button
  const addButton = page.getByRole('button', { name: /Ajouter un document/i });
  await expect(addButton).toBeVisible({ timeout: 10_000 });

  // Click it to show the form
  await addButton.click();

  // Form fields should appear
  await expect(page.getByText('Titre du document')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Contenu')).toBeVisible({ timeout: 10_000 });
});

// ─────────────────────────────────────────────────────────────────
// 8. Back button navigates correctly
// ─────────────────────────────────────────────────────────────────
test('knowledge — back button navigates to AI Engine dashboard', async ({ page }) => {
  await mockKnowledgeAPIs(page);
  await gotoAIEngine(page, 'knowledge');
  ensureAuthOrSkip(page);

  await expect(
    page.getByRole('heading', { name: /Base de connaissances/i }),
  ).toBeVisible({ timeout: 15_000 });

  // The back arrow link points to /ai-engine
  const backLink = page.locator('a[href*="/ai-engine"]').first();
  await expect(backLink).toBeVisible({ timeout: 10_000 });
  await backLink.click();
  await expect(page).toHaveURL(/\/ai-engine$/, { timeout: 15_000 });
});
