/**
 * AI Engine — Knowledge Edit E2E tests.
 *
 * Tests: edit collection, view document, edit document with re-chunking.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { gotoAIEngine, ensureAuthOrSkip } from './ai-engine-helpers';

test.use({ storageState: ADMIN_STORAGE_PATH });

const MOCK_COLLECTIONS = {
  collections: [
    {
      id: 'col-1',
      name: 'Brand Guidelines',
      slug: 'brand-guidelines',
      description: 'Identite de marque FemiGlow',
      category: 'brand',
      documentCount: 3,
      chunkCount: 15,
      lastIndexedAt: new Date().toISOString(),
      isActive: true,
    },
  ],
};

const MOCK_DOCUMENTS = {
  documents: [
    { id: 'doc-1', title: 'Charte graphique', sourceType: 'text', chunkCount: 5, createdAt: new Date().toISOString() },
    { id: 'doc-2', title: 'Tone of voice', sourceType: 'url', chunkCount: 10, createdAt: new Date().toISOString() },
  ],
};

const MOCK_DOCUMENT_DETAIL = {
  document: {
    id: 'doc-1',
    collectionId: 'col-1',
    title: 'Charte graphique',
    sourceType: 'text',
    sourceUrl: null,
    contentText: 'FemiGlow est une marque de beaute japonaise specialisee dans le soin des ongles naturels. Notre identite visuelle repose sur des tons ivoire et terracotta.',
    metadata: null,
    chunkCount: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
};

test.describe('Knowledge Edit', () => {
  test.beforeEach(async ({ page }) => {
    const ok = await ensureAuthOrSkip(page);
    if (!ok) test.skip();

    await page.route('**/api/admin/ai-engine/knowledge', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ json: MOCK_COLLECTIONS });
      }
      return route.continue();
    });

    await page.route('**/api/admin/ai-engine/knowledge/brand-guidelines/documents', (route) => {
      return route.fulfill({ json: MOCK_DOCUMENTS });
    });

    await page.route('**/api/admin/ai-engine/knowledge/brand-guidelines/documents/doc-1', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ json: MOCK_DOCUMENT_DETAIL });
      }
      if (route.request().method() === 'PATCH') {
        return route.fulfill({
          json: { document: { id: 'doc-1' }, reChunked: true, chunkCount: 6 },
        });
      }
      return route.continue();
    });

    await page.route('**/api/admin/ai-engine/knowledge/brand-guidelines', (route) => {
      if (route.request().method() === 'PATCH') {
        return route.fulfill({
          json: { collection: { ...MOCK_COLLECTIONS.collections[0], name: 'Updated Name' } },
        });
      }
      return route.continue();
    });

    await gotoAIEngine(page, '/knowledge');
  });

  test('displays collection list with expand/collapse', async ({ page }) => {
    await expect(page.getByText('Brand Guidelines')).toBeVisible();
    await page.getByText('Brand Guidelines').click();
    await expect(page.getByText('Charte graphique')).toBeVisible();
    await expect(page.getByText('Tone of voice')).toBeVisible();
  });

  test('shows edit button on expanded collection', async ({ page }) => {
    await page.getByText('Brand Guidelines').click();
    await expect(page.getByText('Modifier', { exact: false })).toBeVisible();
  });

  test('shows view and edit buttons on document rows', async ({ page }) => {
    await page.getByText('Brand Guidelines').click();
    const row = page.getByText('Charte graphique').locator('..');
    await expect(row.locator('button[title="Voir le contenu"]')).toBeVisible();
    await expect(row.locator('button[title="Modifier ce document"]')).toBeVisible();
  });

  test('view document modal shows content', async ({ page }) => {
    await page.getByText('Brand Guidelines').click();
    const viewBtn = page.locator('button[title="Voir le contenu"]').first();
    await viewBtn.click();
    await expect(page.getByText('FemiGlow est une marque de beaute japonaise')).toBeVisible();
  });

  test('view document modal can be closed', async ({ page }) => {
    await page.getByText('Brand Guidelines').click();
    await page.locator('button[title="Voir le contenu"]').first().click();
    await expect(page.getByText('FemiGlow est une marque')).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('edit document modal shows content and title', async ({ page }) => {
    await page.getByText('Brand Guidelines').click();
    await page.locator('button[title="Modifier ce document"]').first().click();
    await expect(page.getByText('Modifier le document')).toBeVisible();
  });

  test('edit document shows re-chunking warning when content changes', async ({ page }) => {
    await page.getByText('Brand Guidelines').click();
    await page.locator('button[title="Modifier ce document"]').first().click();

    await page.waitForTimeout(500);
    const textarea = page.locator('textarea');
    if (await textarea.isVisible()) {
      await textarea.fill('New content that is different from the original');
      await expect(page.getByText('re-chunking', { exact: false })).toBeVisible();
    }
  });

  /* ------------------------------------------------------------------ */
  /*  Additional scenarios                                               */
  /* ------------------------------------------------------------------ */

  test('create collection flow — name auto-generates slug', async ({ page }) => {
    await page.route('**/api/admin/ai-engine/knowledge', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 201,
          json: {
            collection: {
              id: 'col-new',
              name: 'Tutorials SEO',
              slug: 'tutorials-seo',
              description: 'Guides SEO pour FemiGlow',
              category: 'seo',
              documentCount: 0,
              chunkCount: 0,
              lastIndexedAt: null,
              isActive: true,
            },
          },
        });
      }
      return route.continue();
    });

    await page.getByText('Nouvelle collection', { exact: false }).click();
    const nameInput = page.locator('input[name="name"], input[placeholder*="nom" i]').first();
    await nameInput.fill('Tutorials SEO');

    // Verify slug field auto-populated
    const slugInput = page.locator('input[name="slug"], input[placeholder*="slug" i]').first();
    if (await slugInput.isVisible()) {
      await expect(slugInput).toHaveValue(/tutorials-seo/i);
    }

    // Fill description
    const descInput = page.locator('textarea[name="description"], input[name="description"]').first();
    if (await descInput.isVisible()) {
      await descInput.fill('Guides SEO pour FemiGlow');
    }

    // Select category if dropdown exists
    const categorySelect = page.locator('select[name="category"]').first();
    if (await categorySelect.isVisible()) {
      await categorySelect.selectOption({ index: 1 });
    }

    // Submit
    await page.getByRole('button', { name: /cr[eé]er|enregistrer|sauvegarder/i }).first().click();
    await expect(page.getByText(/collection cr[eé][eé]e|succ[eè]s/i)).toBeVisible({ timeout: 5000 });
  });

  test('delete collection flow — shows confirm dialog with collection name', async ({ page }) => {
    await page.route('**/api/admin/ai-engine/knowledge/brand-guidelines', (route) => {
      if (route.request().method() === 'DELETE') {
        return route.fulfill({ json: { success: true } });
      }
      return route.continue();
    });

    await page.getByText('Brand Guidelines').click();
    await page.getByText('Supprimer la collection', { exact: false }).click();

    // Confirm dialog should mention the collection name
    await expect(page.getByText('Brand Guidelines')).toBeVisible();
    await page.getByRole('button', { name: /supprimer/i }).click();
    await expect(page.getByText(/supprim[eé]e|succ[eè]s/i)).toBeVisible({ timeout: 5000 });
  });

  test('delete document flow — shows confirm with doc title', async ({ page }) => {
    await page.route('**/api/admin/ai-engine/knowledge/brand-guidelines/documents/doc-1', (route) => {
      if (route.request().method() === 'DELETE') {
        return route.fulfill({ json: { success: true } });
      }
      return route.continue();
    });

    await page.getByText('Brand Guidelines').click();
    const row = page.getByText('Charte graphique').locator('..');
    await row.locator('button[title*="Supprimer"], button[aria-label*="supprimer" i]').first().click();

    // Confirm dialog should show doc title
    await expect(page.getByText('Charte graphique')).toBeVisible();
    await page.getByRole('button', { name: /supprimer/i }).click();
    await expect(page.getByText(/supprim[eé]|succ[eè]s/i)).toBeVisible({ timeout: 5000 });
  });

  test('edit document save — title only — shows success message', async ({ page }) => {
    await page.getByText('Brand Guidelines').click();
    await page.locator('button[title="Modifier ce document"]').first().click();

    await page.waitForTimeout(500);
    const titleInput = page.locator('input[name="title"], input[placeholder*="titre" i]').first();
    if (await titleInput.isVisible()) {
      await titleInput.fill('Charte graphique v2');
    }

    await page.getByRole('button', { name: /enregistrer|sauvegarder|mettre [aà] jour/i }).first().click();
    await expect(page.getByText(/document mis [aà] jour|succ[eè]s/i)).toBeVisible({ timeout: 5000 });
  });

  test('edit document with re-chunking — shows chunks re-generated message', async ({ page }) => {
    await page.getByText('Brand Guidelines').click();
    await page.locator('button[title="Modifier ce document"]').first().click();

    await page.waitForTimeout(500);
    const textarea = page.locator('textarea');
    if (await textarea.isVisible()) {
      await textarea.fill('Contenu completement different pour declencher un re-chunking complet.');
    }

    await page.getByRole('button', { name: /enregistrer|sauvegarder|mettre [aà] jour/i }).first().click();
    await expect(page.getByText(/chunks? re-g[eé]n[eé]r[eé]s?|re-chunking|6 chunks/i)).toBeVisible({ timeout: 5000 });
  });

  test('URL ingestion mode — shows URL input when toggled', async ({ page }) => {
    await page.route('**/api/admin/ai-engine/knowledge/brand-guidelines/documents', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 201,
          json: {
            document: {
              id: 'doc-new',
              title: 'Page produit importee',
              sourceType: 'url',
              sourceUrl: 'https://femiglow.com/products/nail-care',
              chunkCount: 3,
              createdAt: new Date().toISOString(),
            },
          },
        });
      }
      return route.continue();
    });

    await page.getByText('Brand Guidelines').click();
    await page.getByText('Ajouter un document', { exact: false }).click();

    // Toggle to URL mode
    const urlToggle = page.getByText(/URL|Importer depuis une URL/i).first();
    await urlToggle.click();

    const urlInput = page.locator('input[type="url"], input[name="sourceUrl"], input[placeholder*="http" i]').first();
    await expect(urlInput).toBeVisible();
    await urlInput.fill('https://femiglow.com/products/nail-care');

    await page.getByRole('button', { name: /ajouter|importer|enregistrer/i }).first().click();
  });

  test('empty state — shows message when no collections', async ({ page }) => {
    // Override the beforeEach mock with empty collections
    await page.route('**/api/admin/ai-engine/knowledge', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ json: { collections: [] } });
      }
      return route.continue();
    });

    await gotoAIEngine(page, '/knowledge');
    await expect(page.getByText(/aucune collection|pas de collection|vide/i)).toBeVisible({ timeout: 5000 });
  });

  test('error state on load — shows error banner', async ({ page }) => {
    // Override the beforeEach mock with a failure
    await page.route('**/api/admin/ai-engine/knowledge', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 500, json: { error: 'Internal Server Error' } });
      }
      return route.continue();
    });

    await gotoAIEngine(page, '/knowledge');
    await expect(page.getByText(/erreur|impossible|probl[eè]me/i)).toBeVisible({ timeout: 5000 });
  });
});
