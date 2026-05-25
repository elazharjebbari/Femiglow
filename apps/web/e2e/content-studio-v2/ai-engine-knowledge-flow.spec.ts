/**
 * AI Engine — Knowledge ingestion flow E2E tests (serial).
 *
 * Uses page.route() to mock knowledge APIs.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { gotoAIEngine, ensureAuthOrSkip } from './ai-engine-helpers';

test.use({ storageState: ADMIN_STORAGE_PATH });

const MOCK_COLLECTIONS = {
  collections: [
    {
      id: 'col-1',
      name: 'Science des ingrédients',
      slug: 'science-ingredients',
      description: 'Recherche et données sur les ingrédients J-Beauty',
      category: 'science',
      documentCount: 3,
      chunkCount: 42,
      lastIndexedAt: '2026-05-20T10:00:00Z',
      isActive: true,
    },
    {
      id: 'col-2',
      name: 'Stratégie de marque',
      slug: 'brand-strategy',
      description: 'Guidelines et positionnement FemiGlow',
      category: 'brand',
      documentCount: 2,
      chunkCount: 28,
      lastIndexedAt: '2026-05-19T08:00:00Z',
      isActive: true,
    },
  ],
};

const MOCK_DOCUMENTS = {
  documents: [
    {
      id: 'doc-1',
      title: 'Acide hyaluronique en cosmétique',
      sourceType: 'text',
      chunkCount: 15,
      createdAt: '2026-05-15T09:00:00Z',
    },
    {
      id: 'doc-2',
      title: 'Propriétés du Tsubaki Oil',
      sourceType: 'text',
      chunkCount: 12,
      createdAt: '2026-05-16T14:00:00Z',
    },
    {
      id: 'doc-3',
      title: 'Extrait de riz fermenté',
      sourceType: 'text',
      chunkCount: 15,
      createdAt: '2026-05-18T11:00:00Z',
    },
  ],
};

const MOCK_INGEST_RESPONSE = {
  id: 'doc-4',
  title: 'Nouveau document de test',
  sourceType: 'text',
  chunkCount: 8,
  createdAt: '2026-05-25T12:00:00Z',
};

test.describe.serial('Knowledge ingestion flow', () => {
  let sharedPage: import('@playwright/test').Page;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: ADMIN_STORAGE_PATH });
    sharedPage = await context.newPage();

    // Mock collections API
    await sharedPage.route('**/api/admin/ai-engine/knowledge', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_COLLECTIONS),
        });
      } else {
        await route.continue();
      }
    });

    // Mock documents API for the first collection
    await sharedPage.route('**/api/admin/ai-engine/knowledge/science-ingredients/documents', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_DOCUMENTS),
        });
      } else if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_INGEST_RESPONSE),
        });
      }
    });

    // Mock documents API for the second collection
    await sharedPage.route('**/api/admin/ai-engine/knowledge/brand-strategy/documents', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ documents: [] }),
      });
    });

    // Mock embed API
    await sharedPage.route('**/api/admin/ai-engine/knowledge/embed', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ documentsProcessed: 1, chunksCreated: 8 }),
      });
    });
  });

  test.afterAll(async () => {
    await sharedPage.context().close();
  });

  // 1. Navigate to knowledge page
  test('navigate to knowledge page', async () => {
    await gotoAIEngine(sharedPage, 'knowledge');
    ensureAuthOrSkip(sharedPage);

    await expect(sharedPage.getByText('Base de connaissances')).toBeVisible({ timeout: 15_000 });
  });

  // 2. Collections are displayed with counts
  test('collections are displayed with counts', async () => {
    await expect(sharedPage.getByText('Science des ingrédients')).toBeVisible({ timeout: 10_000 });
    await expect(sharedPage.getByText('Stratégie de marque')).toBeVisible({ timeout: 10_000 });

    // Document and chunk counts should be visible
    await expect(sharedPage.getByText('3')).toBeVisible({ timeout: 10_000 });
    await expect(sharedPage.getByText('42')).toBeVisible({ timeout: 10_000 });
  });

  // 3. Click collection to expand documents
  test('click collection to expand documents', async () => {
    // Click on the first collection to expand
    const collectionBtn = sharedPage.locator('button', { hasText: 'Science des ingrédients' });
    await expect(collectionBtn).toBeVisible({ timeout: 10_000 });
    await collectionBtn.click();

    // Documents should appear
    await expect(sharedPage.getByText('Acide hyaluronique en cosmétique')).toBeVisible({ timeout: 10_000 });
    await expect(sharedPage.getByText('Propriétés du Tsubaki Oil')).toBeVisible({ timeout: 10_000 });
  });

  // 4. "Ajouter un document" form is present
  test('"Ajouter un document" button is present', async () => {
    await expect(
      sharedPage.getByRole('button', { name: /Ajouter un document/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  // 5. Fill title and content, submit
  test('fill title and content, submit ingestion form', async () => {
    // Click "Ajouter un document"
    await sharedPage.getByRole('button', { name: /Ajouter un document/i }).click();

    // Fill in the form
    const titleInput = sharedPage.locator('input[type="text"]').last();
    await expect(titleInput).toBeVisible({ timeout: 5_000 });
    await titleInput.fill('Nouveau document de test');

    const contentTextarea = sharedPage.locator('textarea').last();
    await expect(contentTextarea).toBeVisible({ timeout: 5_000 });
    await contentTextarea.fill('Contenu du document de test pour la base de connaissances FemiGlow.');

    // Click "Ingérer"
    const ingestBtn = sharedPage.getByRole('button', { name: /Ingérer/i });
    await expect(ingestBtn).toBeEnabled({ timeout: 5_000 });
    await ingestBtn.click();
  });

  // 6. Verify document appears in list after ingestion
  test('verify success message after ingestion', async () => {
    // Should show success feedback
    await expect(
      sharedPage.getByText(/Document ingéré/i),
    ).toBeVisible({ timeout: 10_000 });
  });
});
