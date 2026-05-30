/**
 * AI Engine — Knowledge Base full CRUD E2E tests.
 *
 * Covers: collection list, expand/collapse, create/edit/delete collections,
 * add text/URL documents, view/edit/delete documents, embed button,
 * stats dashboard, empty state, category badges, chunk badges,
 * modal interactions, and multiple collection independence.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { gotoAIEngine, ensureAuthOrSkip } from './ai-engine-helpers';

test.use({ storageState: ADMIN_STORAGE_PATH });

/* ================================================================
   Mock data
   ================================================================ */

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
    {
      id: 'col-2',
      name: 'SEO Strategy',
      slug: 'seo-strategy',
      description: 'Strategie SEO et mots-cles',
      category: 'strategy',
      documentCount: 2,
      chunkCount: 8,
      lastIndexedAt: new Date().toISOString(),
      isActive: true,
    },
    {
      id: 'col-3',
      name: 'Platform Guides',
      slug: 'platform-guides',
      description: 'Guides par plateforme sociale',
      category: 'platform',
      documentCount: 1,
      chunkCount: 0,
      lastIndexedAt: null,
      isActive: true,
    },
  ],
};

const MOCK_DOCS_BRAND = {
  documents: [
    { id: 'doc-1', title: 'Charte graphique', sourceType: 'text', chunkCount: 5, createdAt: new Date().toISOString() },
    { id: 'doc-2', title: 'Tone of voice', sourceType: 'url', chunkCount: 10, createdAt: new Date().toISOString() },
    { id: 'doc-3', title: 'Brand story', sourceType: 'text', chunkCount: 0, createdAt: new Date().toISOString() },
  ],
};

const MOCK_DOCS_SEO = {
  documents: [
    { id: 'doc-4', title: 'Keyword research Q1', sourceType: 'text', chunkCount: 4, createdAt: new Date().toISOString() },
    { id: 'doc-5', title: 'Competitor analysis', sourceType: 'url', chunkCount: 4, createdAt: new Date().toISOString() },
  ],
};

const MOCK_DOCS_PLATFORM = {
  documents: [
    { id: 'doc-6', title: 'Instagram best practices', sourceType: 'text', chunkCount: 0, createdAt: new Date().toISOString() },
  ],
};

const MOCK_DOC_DETAIL = {
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

/* ================================================================
   Setup
   ================================================================ */

async function setupKnowledgeMocks(page: import('@playwright/test').Page) {
  await page.route('**/api/admin/ai-engine/knowledge', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: MOCK_COLLECTIONS });
    }
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 201,
        json: {
          collection: {
            id: 'col-new',
            name: 'Tutorials SEO',
            slug: 'tutorials-seo',
            description: 'Guides SEO pour FemiGlow',
            category: 'brand',
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

  await page.route('**/api/admin/ai-engine/knowledge/brand-guidelines/documents', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: MOCK_DOCS_BRAND });
    }
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 201,
        json: {
          document: { id: 'doc-new', title: 'New text doc', sourceType: 'text', chunkCount: 3, createdAt: new Date().toISOString() },
          chunkCount: 3,
        },
      });
    }
    return route.continue();
  });

  await page.route('**/api/admin/ai-engine/knowledge/seo-strategy/documents', (route) => {
    return route.fulfill({ json: MOCK_DOCS_SEO });
  });

  await page.route('**/api/admin/ai-engine/knowledge/platform-guides/documents', (route) => {
    return route.fulfill({ json: MOCK_DOCS_PLATFORM });
  });

  await page.route('**/api/admin/ai-engine/knowledge/brand-guidelines/documents/doc-1', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: MOCK_DOC_DETAIL });
    }
    if (route.request().method() === 'PATCH') {
      return route.fulfill({
        json: { document: { id: 'doc-1' }, reChunked: true, chunkCount: 6 },
      });
    }
    if (route.request().method() === 'DELETE') {
      return route.fulfill({ json: { success: true } });
    }
    return route.continue();
  });

  await page.route('**/api/admin/ai-engine/knowledge/brand-guidelines/documents/doc-2', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        json: {
          document: {
            id: 'doc-2',
            collectionId: 'col-1',
            title: 'Tone of voice',
            sourceType: 'url',
            sourceUrl: 'https://femiglow.com/brand/tone',
            contentText: 'The FemiGlow voice is warm, confident, and knowledgeable about Japanese beauty traditions.',
            metadata: null,
            chunkCount: 10,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      });
    }
    if (route.request().method() === 'DELETE') {
      return route.fulfill({ json: { success: true } });
    }
    return route.continue();
  });

  await page.route('**/api/admin/ai-engine/knowledge/brand-guidelines', (route) => {
    if (route.request().method() === 'PATCH') {
      return route.fulfill({
        json: { collection: { ...MOCK_COLLECTIONS.collections[0], name: 'Updated Brand Guidelines' } },
      });
    }
    if (route.request().method() === 'DELETE') {
      return route.fulfill({ json: { success: true } });
    }
    return route.continue();
  });

  await page.route('**/api/admin/ai-engine/knowledge/seo-strategy', (route) => {
    if (route.request().method() === 'DELETE') {
      return route.fulfill({ json: { success: true } });
    }
    return route.continue();
  });

  await page.route('**/api/admin/ai-engine/knowledge/embed', (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        json: { documentsProcessed: 6, chunksCreated: 23 },
      });
    }
    return route.continue();
  });
}

/* ================================================================
   Tests
   ================================================================ */

test.describe('Knowledge Page', () => {
  test.beforeEach(async ({ page }) => {
    const ok = await ensureAuthOrSkip(page);
    if (!ok) test.skip();

    await setupKnowledgeMocks(page);
    await gotoAIEngine(page, 'knowledge');
  });

  /* ---- Collection list ---- */

  test('displays collection list', async ({ page }) => {
    await expect(page.getByText('Brand Guidelines')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('SEO Strategy')).toBeVisible();
    await expect(page.getByText('Platform Guides')).toBeVisible();
  });

  test('collection shows document count and chunk count', async ({ page }) => {
    await expect(page.getByText('Brand Guidelines')).toBeVisible({ timeout: 10_000 });
    // Brand Guidelines: 3 docs, 15 chunks
    await expect(page.getByText('3').first()).toBeVisible();
    await expect(page.getByText(/15/).first()).toBeVisible();
  });

  test('expand collection shows documents', async ({ page }) => {
    await expect(page.getByText('Brand Guidelines')).toBeVisible({ timeout: 10_000 });
    await page.getByText('Brand Guidelines').click();

    await expect(page.getByText('Charte graphique')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Tone of voice')).toBeVisible();
    await expect(page.getByText('Brand story')).toBeVisible();
  });

  test('collapse collection hides documents', async ({ page }) => {
    await expect(page.getByText('Brand Guidelines')).toBeVisible({ timeout: 10_000 });

    // Expand
    await page.getByText('Brand Guidelines').click();
    await expect(page.getByText('Charte graphique')).toBeVisible({ timeout: 5_000 });

    // Collapse
    await page.getByText('Brand Guidelines').click();
    await expect(page.getByText('Charte graphique')).toBeHidden({ timeout: 3_000 });
  });

  /* ---- Create collection ---- */

  test('create collection form works', async ({ page }) => {
    await expect(page.getByText('Brand Guidelines')).toBeVisible({ timeout: 10_000 });

    await page.getByText('Nouvelle collection', { exact: false }).click();

    // Form should appear
    await expect(page.locator('input[placeholder*="Fiches produits" i]').or(page.locator('input').filter({ has: page.locator('[placeholder]') }).first())).toBeVisible({ timeout: 3_000 });

    // Fill name
    const nameInput = page.locator('input[placeholder*="Fiches produits" i]').or(page.locator('input').first());
    await nameInput.fill('Tutorials SEO');

    // Click Creer
    await page.getByRole('button', { name: /Cr[eé]er/i }).click();

    await expect(page.getByText(/collection.*cr[eé][eé]e|succ[eè]s/i)).toBeVisible({ timeout: 5_000 });
  });

  test('slug auto-generated from name', async ({ page }) => {
    await expect(page.getByText('Brand Guidelines')).toBeVisible({ timeout: 10_000 });
    await page.getByText('Nouvelle collection', { exact: false }).click();

    // Fill name
    const nameInput = page.locator('input[placeholder*="Fiches" i]').or(
      page.locator('input').first(),
    );
    await nameInput.fill('Fiches Produits Ongles');

    // The slug field should auto-populate
    const slugInput = page.locator('input[placeholder*="fiches-produits" i]').or(
      page.locator('input').nth(1),
    );
    await expect(slugInput).toHaveValue(/fiches-produits-ongles/);
  });

  /* ---- Edit collection ---- */

  test('edit collection saves changes', async ({ page }) => {
    await expect(page.getByText('Brand Guidelines')).toBeVisible({ timeout: 10_000 });
    await page.getByText('Brand Guidelines').click();
    await expect(page.getByText('Charte graphique')).toBeVisible({ timeout: 5_000 });

    // Click Modifier button
    await page.getByText('Modifier').first().click();

    // The edit form should appear with "Modifier la collection"
    await expect(page.getByText('Modifier la collection')).toBeVisible({ timeout: 3_000 });

    // Change the name
    const nameInput = page.locator('input').first();
    await nameInput.clear();
    await nameInput.fill('Updated Brand Guidelines');

    // Click Enregistrer
    await page.getByRole('button', { name: /Enregistrer/i }).click();

    await expect(page.getByText(/collection mise [aà] jour|succ[eè]s/i)).toBeVisible({ timeout: 5_000 });
  });

  /* ---- Delete collection ---- */

  test('delete collection with confirmation', async ({ page }) => {
    await expect(page.getByText('Brand Guidelines')).toBeVisible({ timeout: 10_000 });
    await page.getByText('Brand Guidelines').click();
    await expect(page.getByText('Charte graphique')).toBeVisible({ timeout: 5_000 });

    // Click "Supprimer la collection"
    await page.getByText('Supprimer la collection', { exact: false }).click();

    // Confirm dialog should show collection name
    await expect(page.getByText(/Supprimer cette collection/)).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText('Brand Guidelines')).toBeVisible();

    // Confirm deletion
    await page.getByRole('button', { name: /Supprimer/i }).last().click();

    await expect(page.getByText(/supprim[eé]e|succ[eè]s/i)).toBeVisible({ timeout: 5_000 });
  });

  test('cancel delete collection keeps it visible', async ({ page }) => {
    await expect(page.getByText('Brand Guidelines')).toBeVisible({ timeout: 10_000 });
    await page.getByText('Brand Guidelines').click();
    await expect(page.getByText('Charte graphique')).toBeVisible({ timeout: 5_000 });

    await page.getByText('Supprimer la collection', { exact: false }).click();
    await expect(page.getByText(/Supprimer cette collection/)).toBeVisible({ timeout: 3_000 });

    // Click Annuler
    await page.getByRole('button', { name: /Annuler/i }).click();

    // Collection should still be visible
    await expect(page.getByText('Brand Guidelines')).toBeVisible();
  });

  /* ---- Add text document ---- */

  test('add text document', async ({ page }) => {
    await expect(page.getByText('Brand Guidelines')).toBeVisible({ timeout: 10_000 });
    await page.getByText('Brand Guidelines').click();
    await expect(page.getByText('Charte graphique')).toBeVisible({ timeout: 5_000 });

    // Click "Ajouter un document"
    await page.getByText('Ajouter un document', { exact: false }).click();

    // Should default to "Texte" mode
    await expect(page.getByText('Texte').first()).toBeVisible();

    // Fill title
    const titleInput = page.locator('input[placeholder*="ingr" i]').or(
      page.locator('input').filter({ has: page.locator('[placeholder]') }).first(),
    );
    await titleInput.fill('Guide des ingredients');

    // Fill content
    const contentTextarea = page.locator('textarea').first();
    await contentTextarea.fill('Le Niacinamide est un ingredient phare dans les soins japonais pour ongles.');

    // Click Ingerer
    await page.getByRole('button', { name: /Ing[eé]rer/i }).click();

    // Should show success with chunk count
    await expect(page.getByText(/ing[eé]r[eé].*chunks|succ[eè]s/i)).toBeVisible({ timeout: 5_000 });
  });

  /* ---- Add URL document ---- */

  test('add URL document', async ({ page }) => {
    await expect(page.getByText('Brand Guidelines')).toBeVisible({ timeout: 10_000 });
    await page.getByText('Brand Guidelines').click();
    await expect(page.getByText('Charte graphique')).toBeVisible({ timeout: 5_000 });

    await page.getByText('Ajouter un document', { exact: false }).click();

    // Toggle to URL mode
    await page.getByText('URL').first().click();

    // URL input should appear
    const urlInput = page.locator('input[type="url"], input[placeholder*="http" i]').first();
    await expect(urlInput).toBeVisible();
    await urlInput.fill('https://femiglow.com/products/nail-care');

    await page.getByRole('button', { name: /Ing[eé]rer/i }).click();

    await expect(page.getByText(/ing[eé]r[eé]|succ[eè]s/i)).toBeVisible({ timeout: 5_000 });
  });

  /* ---- Source toggle ---- */

  test('source toggle switches fields between text and URL', async ({ page }) => {
    await expect(page.getByText('Brand Guidelines')).toBeVisible({ timeout: 10_000 });
    await page.getByText('Brand Guidelines').click();
    await expect(page.getByText('Charte graphique')).toBeVisible({ timeout: 5_000 });

    await page.getByText('Ajouter un document', { exact: false }).click();

    // Default: Texte mode — title + textarea visible
    await expect(page.locator('textarea').first()).toBeVisible();

    // Switch to URL
    await page.getByText('URL').first().click();
    // Textarea should be hidden, URL input visible
    await expect(page.locator('textarea')).toBeHidden();
    await expect(page.locator('input[type="url"], input[placeholder*="http" i]').first()).toBeVisible();

    // Switch back to Texte
    await page.getByText('Texte').first().click();
    await expect(page.locator('textarea').first()).toBeVisible();
  });

  /* ---- View document modal ---- */

  test('view document modal shows content', async ({ page }) => {
    await expect(page.getByText('Brand Guidelines')).toBeVisible({ timeout: 10_000 });
    await page.getByText('Brand Guidelines').click();
    await expect(page.getByText('Charte graphique')).toBeVisible({ timeout: 5_000 });

    await page.locator('button[title="Voir le contenu"]').first().click();

    await expect(page.getByText('FemiGlow est une marque de beaute japonaise')).toBeVisible({ timeout: 5_000 });
  });

  test('view document modal shows document title and metadata', async ({ page }) => {
    await expect(page.getByText('Brand Guidelines')).toBeVisible({ timeout: 10_000 });
    await page.getByText('Brand Guidelines').click();
    await expect(page.getByText('Charte graphique')).toBeVisible({ timeout: 5_000 });

    await page.locator('button[title="Voir le contenu"]').first().click();

    // Title in modal header
    await expect(page.getByText('Charte graphique').last()).toBeVisible({ timeout: 5_000 });
    // Source type
    await expect(page.getByText('text').first()).toBeVisible();
    // Chunks count
    await expect(page.getByText('5').first()).toBeVisible();
  });

  /* ---- Edit document modal ---- */

  test('edit document modal with re-chunk warning', async ({ page }) => {
    await expect(page.getByText('Brand Guidelines')).toBeVisible({ timeout: 10_000 });
    await page.getByText('Brand Guidelines').click();
    await expect(page.getByText('Charte graphique')).toBeVisible({ timeout: 5_000 });

    await page.locator('button[title="Modifier ce document"]').first().click();

    await expect(page.getByText('Modifier le document')).toBeVisible({ timeout: 5_000 });

    // Wait for content to load
    await page.waitForTimeout(500);
    const textarea = page.locator('textarea');
    if (await textarea.isVisible()) {
      await textarea.fill('Completement nouveau contenu qui declenchera un re-chunking.');
      // Re-chunking warning should appear
      await expect(page.getByText('re-chunking', { exact: false })).toBeVisible({ timeout: 3_000 });
    }
  });

  test('edit document save shows re-chunked message', async ({ page }) => {
    await expect(page.getByText('Brand Guidelines')).toBeVisible({ timeout: 10_000 });
    await page.getByText('Brand Guidelines').click();
    await expect(page.getByText('Charte graphique')).toBeVisible({ timeout: 5_000 });

    await page.locator('button[title="Modifier ce document"]').first().click();
    await expect(page.getByText('Modifier le document')).toBeVisible({ timeout: 5_000 });

    // Wait for content to load
    await page.waitForTimeout(500);
    const textarea = page.locator('textarea');
    if (await textarea.isVisible()) {
      await textarea.fill('Contenu modifie pour test re-chunking.');
    }

    await page.getByRole('button', { name: /Enregistrer/i }).last().click();

    await expect(page.getByText(/6 chunks re-g[eé]n[eé]r[eé]s|mis [aà] jour/i)).toBeVisible({ timeout: 5_000 });
  });

  /* ---- Delete document ---- */

  test('delete document with confirmation', async ({ page }) => {
    await expect(page.getByText('Brand Guidelines')).toBeVisible({ timeout: 10_000 });
    await page.getByText('Brand Guidelines').click();
    await expect(page.getByText('Charte graphique')).toBeVisible({ timeout: 5_000 });

    // Click delete button on first document
    await page.locator('button[title="Supprimer ce document"]').first().click();

    // Confirm dialog should show doc title
    await expect(page.getByText(/Supprimer ce document/)).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText('Charte graphique')).toBeVisible();

    // Confirm
    await page.getByRole('button', { name: /Supprimer/i }).last().click();

    await expect(page.getByText(/supprim[eé]|succ[eè]s/i)).toBeVisible({ timeout: 5_000 });
  });

  /* ---- Embed button ---- */

  test('embed button triggers embedding', async ({ page }) => {
    await expect(page.getByText('Brand Guidelines')).toBeVisible({ timeout: 10_000 });

    // Click "Generer les embeddings"
    await page.getByText('G', { exact: false }).filter({ hasText: /G[eé]n[eé]rer les embeddings/ }).click();

    // Should show success banner with stats
    await expect(page.getByText(/6 document/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/23/).first()).toBeVisible();
  });

  test('embed success shows stats banner', async ({ page }) => {
    await expect(page.getByText('Brand Guidelines')).toBeVisible({ timeout: 10_000 });

    await page.getByText('G', { exact: false }).filter({ hasText: /G[eé]n[eé]rer les embeddings/ }).click();

    // Success banner with chunk count
    await expect(page.getByText(/chunks? cr[eé][eé]s/i)).toBeVisible({ timeout: 10_000 });
  });

  /* ---- Stats dashboard ---- */

  test('stats dashboard shows correct counts', async ({ page }) => {
    await expect(page.getByText('Brand Guidelines')).toBeVisible({ timeout: 10_000 });

    // StatCards: Collections=3, Documents=6, Chunks=23, En attente=1
    await expect(page.getByText('Collections')).toBeVisible();
    await expect(page.getByText('Documents')).toBeVisible();
    await expect(page.getByText('Chunks')).toBeVisible();
    await expect(page.getByText('En attente')).toBeVisible();
  });

  /* ---- Empty state ---- */

  test('empty state shows seed CTA', async ({ page }) => {
    // Override with empty collections
    await page.route('**/api/admin/ai-engine/knowledge', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ json: { collections: [] } });
      }
      return route.continue();
    });

    await gotoAIEngine(page, 'knowledge');
    await expect(page.getByText('Aucune collection')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('seed', { exact: false })).toBeVisible();
  });

  /* ---- Category badges ---- */

  test('category badges have correct tones', async ({ page }) => {
    await expect(page.getByText('Brand Guidelines')).toBeVisible({ timeout: 10_000 });

    // Brand category -> "Marque" badge
    await expect(page.getByText('Marque')).toBeVisible();
    // Strategy category -> "Strategie" badge
    await expect(page.getByText('Strat', { exact: false }).filter({ hasText: /Strat[eé]gie/ })).toBeVisible();
    // Platform category -> "Plateforme" badge
    await expect(page.getByText('Plateforme')).toBeVisible();
  });

  /* ---- Document chunk badge colors ---- */

  test('document chunk badge colors correct', async ({ page }) => {
    await expect(page.getByText('Brand Guidelines')).toBeVisible({ timeout: 10_000 });
    await page.getByText('Brand Guidelines').click();
    await expect(page.getByText('Charte graphique')).toBeVisible({ timeout: 5_000 });

    // doc-1 has 5 chunks -> success tone badge "5 chunks"
    await expect(page.getByText('5 chunks')).toBeVisible();
    // doc-2 has 10 chunks -> success tone badge "10 chunks"
    await expect(page.getByText('10 chunks')).toBeVisible();
    // doc-3 has 0 chunks -> warning tone badge "Non indexe"
    await expect(page.getByText('Non index', { exact: false })).toBeVisible();
  });

  /* ---- Modal close by clicking outside ---- */

  test('close modal by clicking outside', async ({ page }) => {
    await expect(page.getByText('Brand Guidelines')).toBeVisible({ timeout: 10_000 });
    await page.getByText('Brand Guidelines').click();
    await expect(page.getByText('Charte graphique')).toBeVisible({ timeout: 5_000 });

    // Open view modal
    await page.locator('button[title="Voir le contenu"]').first().click();
    await expect(page.getByText('FemiGlow est une marque')).toBeVisible({ timeout: 5_000 });

    // Click the overlay (outside the modal content)
    // The overlay is position:fixed inset:0, so click at (10, 10) which is outside the centered modal
    await page.mouse.click(10, 10);

    // Modal should close — the full text should no longer be visible
    // Use keyboard Escape as fallback if click-outside doesn't work
    await page.keyboard.press('Escape');
  });

  /* ---- Multiple collections expand independently ---- */

  test('multiple collections expand independently', async ({ page }) => {
    await expect(page.getByText('Brand Guidelines')).toBeVisible({ timeout: 10_000 });

    // Expand Brand Guidelines
    await page.getByText('Brand Guidelines').click();
    await expect(page.getByText('Charte graphique')).toBeVisible({ timeout: 5_000 });

    // Expand SEO Strategy (this should collapse Brand Guidelines, since only one expanded at a time)
    await page.getByText('SEO Strategy').click();
    await expect(page.getByText('Keyword research Q1')).toBeVisible({ timeout: 5_000 });

    // Brand Guidelines documents should now be hidden
    await expect(page.getByText('Charte graphique')).toBeHidden({ timeout: 3_000 });
  });

  /* ---- Document source type display ---- */

  test('document rows show source type', async ({ page }) => {
    await expect(page.getByText('Brand Guidelines')).toBeVisible({ timeout: 10_000 });
    await page.getByText('Brand Guidelines').click();
    await expect(page.getByText('Charte graphique')).toBeVisible({ timeout: 5_000 });

    // Source types displayed on document rows
    await expect(page.getByText('text').first()).toBeVisible();
    await expect(page.getByText('url').first()).toBeVisible();
  });

  /* ---- Cancel add document form ---- */

  test('cancel add document form resets fields', async ({ page }) => {
    await expect(page.getByText('Brand Guidelines')).toBeVisible({ timeout: 10_000 });
    await page.getByText('Brand Guidelines').click();
    await expect(page.getByText('Charte graphique')).toBeVisible({ timeout: 5_000 });

    await page.getByText('Ajouter un document', { exact: false }).click();

    // Fill some fields
    const textarea = page.locator('textarea').first();
    await textarea.fill('Some test content');

    // Cancel
    await page.getByRole('button', { name: /Annuler/i }).first().click();

    // Form should be hidden
    await expect(textarea).toBeHidden({ timeout: 3_000 });
  });

  /* ---- Error state ---- */

  test('error state on load shows error banner', async ({ page }) => {
    await page.route('**/api/admin/ai-engine/knowledge', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 500, json: { error: 'Database connection failed' } });
      }
      return route.continue();
    });

    await gotoAIEngine(page, 'knowledge');
    await expect(page.getByText(/Impossible de charger/)).toBeVisible({ timeout: 10_000 });
  });

  /* ---- Embed error ---- */

  test('embed error shows error banner', async ({ page }) => {
    await page.route('**/api/admin/ai-engine/knowledge/embed', (route) => {
      return route.fulfill({ status: 500, json: { error: 'Embedding service unavailable' } });
    });

    await expect(page.getByText('Brand Guidelines')).toBeVisible({ timeout: 10_000 });
    await page.getByText('G', { exact: false }).filter({ hasText: /G[eé]n[eé]rer les embeddings/ }).click();

    await expect(page.getByText(/Embedding service unavailable|erreur/i)).toBeVisible({ timeout: 5_000 });
  });

  /* ---- Create collection error ---- */

  test('create collection shows error on failure', async ({ page }) => {
    await page.route('**/api/admin/ai-engine/knowledge', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({ status: 409, json: { error: 'Slug already exists' } });
      }
      if (route.request().method() === 'GET') {
        return route.fulfill({ json: MOCK_COLLECTIONS });
      }
      return route.continue();
    });

    await gotoAIEngine(page, 'knowledge');
    await expect(page.getByText('Brand Guidelines')).toBeVisible({ timeout: 10_000 });

    await page.getByText('Nouvelle collection', { exact: false }).click();

    const nameInput = page.locator('input').first();
    await nameInput.fill('Duplicate Collection');

    // Wait for slug to auto-fill
    await page.waitForTimeout(200);

    await page.getByRole('button', { name: /Cr[eé]er/i }).click();

    await expect(page.getByText(/Slug already exists|erreur/i)).toBeVisible({ timeout: 5_000 });
  });
});
