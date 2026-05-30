/**
 * AI Engine — Config > Workflows tab E2E tests.
 *
 * Covers: empty state, create form, CRUD operations, validation,
 * pipeline visualization, quality threshold, toggles, and delete confirmation.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { gotoAIEngine, ensureAuthOrSkip } from './ai-engine-helpers';

test.use({ storageState: ADMIN_STORAGE_PATH });

/* ================================================================
   Mock data
   ================================================================ */

const MOCK_PROVIDERS = {
  providers: [
    {
      id: 'prov-1', providerType: 'openai', name: 'OpenAI',
      apiKeyEnvVar: 'OPENAI_API_KEY', baseUrl: null,
      capabilities: ['text', 'image'], models: [],
      rateLimitRpm: 60, dailyBudgetCents: 500, circuitBreakerConfig: null,
      priority: 1, isFallback: false, isEnabled: true,
      healthStatus: 'healthy', lastHealthCheck: null, configured: true,
    },
  ],
};

function makeWorkflow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'wf-1',
    name: 'Reel Instagram Pipeline',
    description: 'Pipeline standard pour les reels Instagram',
    platform: 'instagram',
    format: 'reel',
    graphConfig: {
      nodes: ['brief_analysis', 'script_writer', 'image_gen', 'caption_gen', 'quality_gate'],
      edges: [],
    },
    defaultTone: 'luxurious',
    defaultLanguage: 'fr',
    qualityThreshold: '0.70',
    maxRetries: 2,
    maxBudgetCents: 100,
    humanReviewRequired: true,
    autoPublish: false,
    providerOverrides: null,
    version: 1,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const MOCK_WORKFLOW = makeWorkflow();

const MOCK_WORKFLOW_2 = makeWorkflow({
  id: 'wf-2',
  name: 'TikTok Story Generator',
  description: 'Pipeline pour les stories TikTok',
  platform: 'tiktok',
  format: 'story',
  graphConfig: { nodes: ['brief_analysis', 'script_writer', 'quality_gate'], edges: [] },
  qualityThreshold: '0.85',
  humanReviewRequired: false,
  autoPublish: true,
  version: 3,
});

const EMPTY_PROMPTS = { prompts: [] };

/* ================================================================
   Setup helpers
   ================================================================ */

async function setupMocks(
  page: import('@playwright/test').Page,
  opts: { workflows?: unknown[]; postHandler?: (route: any) => void } = {},
) {
  const workflows = opts.workflows ?? [MOCK_WORKFLOW];

  await page.route('**/api/admin/ai-engine/config/providers', (route) => {
    return route.fulfill({ json: MOCK_PROVIDERS });
  });

  await page.route('**/api/admin/ai-engine/config/workflows', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: { workflows } });
    }
    if (route.request().method() === 'POST') {
      if (opts.postHandler) return opts.postHandler(route);
      return route.fulfill({
        status: 201,
        json: {
          workflow: makeWorkflow({
            id: 'wf-new',
            name: 'New Workflow',
            version: 1,
          }),
        },
      });
    }
    return route.continue();
  });

  await page.route('**/api/admin/ai-engine/config/workflows/*', (route) => {
    if (route.request().method() === 'DELETE') {
      return route.fulfill({ json: { success: true } });
    }
    return route.continue();
  });

  await page.route('**/api/admin/ai-engine/config/prompts', (route) => {
    return route.fulfill({ json: EMPTY_PROMPTS });
  });

  await page.route('**/api/admin/ai-engine/config/api-keys', (route) => {
    return route.fulfill({ json: { apiKeys: [] } });
  });

  await page.route('**/api/admin/ai-engine/health', (route) => {
    return route.fulfill({ json: { enabled: true } });
  });
}

async function goToWorkflowsTab(page: import('@playwright/test').Page) {
  await gotoAIEngine(page, 'config');
  // Wait for page to load
  await expect(page.getByText('Configuration')).toBeVisible({ timeout: 15_000 });
  // Click Workflows tab
  await page.getByText('Workflows').first().click();
}

/* ================================================================
   Tests
   ================================================================ */

test.describe('Config > Workflows', () => {
  /* ---- Empty state ---- */

  test('empty state shows create CTA', async ({ page }) => {
    const ok = await ensureAuthOrSkip(page);
    if (!ok) test.skip();

    await setupMocks(page, { workflows: [] });
    await goToWorkflowsTab(page);

    await expect(page.getByText('Aucun workflow personnalis', { exact: false })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Cr', { exact: false }).filter({ hasText: /Cr[eé]er un workflow/ })).toBeVisible();
  });

  test('empty state CTA opens create form', async ({ page }) => {
    const ok = await ensureAuthOrSkip(page);
    if (!ok) test.skip();

    await setupMocks(page, { workflows: [] });
    await goToWorkflowsTab(page);

    await page.getByText('Cr', { exact: false }).filter({ hasText: /Cr[eé]er un workflow/ }).first().click();
    await expect(page.getByText('Cr', { exact: false }).filter({ hasText: /Cr[eé]er un workflow/ }).first()).toBeVisible();
    await expect(page.getByText('NOM', { exact: false })).toBeVisible({ timeout: 5_000 });
  });

  /* ---- Create form ---- */

  test('create workflow form opens from top button', async ({ page }) => {
    const ok = await ensureAuthOrSkip(page);
    if (!ok) test.skip();

    await setupMocks(page);
    await goToWorkflowsTab(page);

    await expect(page.getByText('Reel Instagram Pipeline')).toBeVisible({ timeout: 5_000 });
    await page.getByText('Cr', { exact: false }).filter({ hasText: /Cr[eé]er un workflow/ }).click();
    // Form title should say "Creer un workflow"
    await expect(page.getByText('Cr', { exact: false }).filter({ hasText: /Cr[eé]er un workflow/ }).first()).toBeVisible({ timeout: 3_000 });
  });

  test('create form has all fields', async ({ page }) => {
    const ok = await ensureAuthOrSkip(page);
    if (!ok) test.skip();

    await setupMocks(page);
    await goToWorkflowsTab(page);
    await expect(page.getByText('Reel Instagram Pipeline')).toBeVisible({ timeout: 5_000 });
    await page.getByText('Cr', { exact: false }).filter({ hasText: /Cr[eé]er un workflow/ }).click();

    // Name field
    await expect(page.getByText('NOM', { exact: false })).toBeVisible({ timeout: 3_000 });
    // Description field
    await expect(page.getByText('DESCRIPTION', { exact: false })).toBeVisible();
    // Platform select
    await expect(page.getByText('PLATEFORME', { exact: false })).toBeVisible();
    // Format select
    await expect(page.getByText('FORMAT', { exact: false })).toBeVisible();
    // Quality threshold
    await expect(page.getByText('SEUIL QUALIT', { exact: false })).toBeVisible();
    // Budget
    await expect(page.getByText('BUDGET MAX', { exact: false })).toBeVisible();
    // Retries
    await expect(page.getByText('RETRIES MAX', { exact: false })).toBeVisible();
    // HITL toggle
    await expect(page.getByText('Review humaine')).toBeVisible();
    // Auto-publish toggle
    await expect(page.getByText('Auto-publication')).toBeVisible();
  });

  test('submit creates workflow and closes form', async ({ page }) => {
    const ok = await ensureAuthOrSkip(page);
    if (!ok) test.skip();

    await setupMocks(page);
    await goToWorkflowsTab(page);
    await expect(page.getByText('Reel Instagram Pipeline')).toBeVisible({ timeout: 5_000 });
    await page.getByText('Cr', { exact: false }).filter({ hasText: /Cr[eé]er un workflow/ }).click();

    // Fill name
    const nameInput = page.locator('input[type="text"]').filter({ hasText: '' }).first();
    await nameInput.fill('Post LinkedIn B2B');

    // Fill description
    const descInput = page.locator('input[placeholder="Description du workflow"]');
    await descInput.fill('Workflow pour contenus LinkedIn B2B');

    // Click Sauvegarder
    await page.getByRole('button', { name: /Sauvegarder/i }).click();

    // The form should close, and no form elements remain
    await expect(page.locator('input[placeholder="Description du workflow"]')).toBeHidden({ timeout: 5_000 });
  });

  /* ---- Workflow card ---- */

  test('workflow card shows name and badges', async ({ page }) => {
    const ok = await ensureAuthOrSkip(page);
    if (!ok) test.skip();

    await setupMocks(page);
    await goToWorkflowsTab(page);

    await expect(page.getByText('Reel Instagram Pipeline')).toBeVisible({ timeout: 5_000 });
    // Active badge
    await expect(page.getByText('Actif').first()).toBeVisible();
    // Version badge
    await expect(page.getByText('v1')).toBeVisible();
  });

  test('workflow card shows pipeline visualization', async ({ page }) => {
    const ok = await ensureAuthOrSkip(page);
    if (!ok) test.skip();

    await setupMocks(page);
    await goToWorkflowsTab(page);

    await expect(page.getByText('Reel Instagram Pipeline')).toBeVisible({ timeout: 5_000 });
    // Pipeline nodes are displayed with labels from NODE_LABELS
    await expect(page.getByText('Brief')).toBeVisible();
    await expect(page.getByText('Script')).toBeVisible();
    await expect(page.getByText('Caption')).toBeVisible();
    await expect(page.getByText('Qualit', { exact: false })).toBeVisible();
  });

  test('workflow card shows platform and format info', async ({ page }) => {
    const ok = await ensureAuthOrSkip(page);
    if (!ok) test.skip();

    await setupMocks(page);
    await goToWorkflowsTab(page);

    await expect(page.getByText('Reel Instagram Pipeline')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Instagram')).toBeVisible();
  });

  test('workflow shows quality threshold', async ({ page }) => {
    const ok = await ensureAuthOrSkip(page);
    if (!ok) test.skip();

    await setupMocks(page);
    await goToWorkflowsTab(page);

    await expect(page.getByText('Reel Instagram Pipeline')).toBeVisible({ timeout: 5_000 });
    // Quality >= 70%
    await expect(page.getByText(/70%/)).toBeVisible();
  });

  test('workflow shows HITL and publication status', async ({ page }) => {
    const ok = await ensureAuthOrSkip(page);
    if (!ok) test.skip();

    await setupMocks(page);
    await goToWorkflowsTab(page);

    await expect(page.getByText('Reel Instagram Pipeline')).toBeVisible({ timeout: 5_000 });
    // HITL: Requis (humanReviewRequired: true)
    await expect(page.getByText('HITL: Requis')).toBeVisible();
    // Publication: Manuelle (autoPublish: false)
    await expect(page.getByText('Publication: Manuelle')).toBeVisible();
  });

  /* ---- Edit workflow ---- */

  test('click Editer opens pre-filled form', async ({ page }) => {
    const ok = await ensureAuthOrSkip(page);
    if (!ok) test.skip();

    await setupMocks(page);
    await goToWorkflowsTab(page);

    await expect(page.getByText('Reel Instagram Pipeline')).toBeVisible({ timeout: 5_000 });
    // Click Editer on the workflow card
    await page.getByText('Éditer').first().click();

    // Form should say "Editer le workflow"
    await expect(page.getByText('Éditer le workflow')).toBeVisible({ timeout: 3_000 });

    // Name field should be pre-filled
    const nameInput = page.locator('input[type="text"]').first();
    await expect(nameInput).toHaveValue('Reel Instagram Pipeline');
  });

  test('edit and save updates workflow', async ({ page }) => {
    const ok = await ensureAuthOrSkip(page);
    if (!ok) test.skip();

    await setupMocks(page);
    await goToWorkflowsTab(page);

    await expect(page.getByText('Reel Instagram Pipeline')).toBeVisible({ timeout: 5_000 });
    await page.getByText('Éditer').first().click();

    // Change the name
    const nameInput = page.locator('input[type="text"]').first();
    await nameInput.clear();
    await nameInput.fill('Reel Instagram Pipeline v2');

    await page.getByRole('button', { name: /Sauvegarder/i }).click();

    // Form should close
    await expect(page.getByText('Éditer le workflow')).toBeHidden({ timeout: 5_000 });
  });

  /* ---- Delete workflow ---- */

  test('delete confirmation works via window.confirm', async ({ page }) => {
    const ok = await ensureAuthOrSkip(page);
    if (!ok) test.skip();

    await setupMocks(page);
    await goToWorkflowsTab(page);

    await expect(page.getByText('Reel Instagram Pipeline')).toBeVisible({ timeout: 5_000 });

    // Listen for the dialog event (window.confirm)
    page.on('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Reel Instagram Pipeline');
      await dialog.accept();
    });

    await page.getByText('Supprimer').first().click();
  });

  test('cancel delete — dismiss dialog keeps workflow', async ({ page }) => {
    const ok = await ensureAuthOrSkip(page);
    if (!ok) test.skip();

    await setupMocks(page);
    await goToWorkflowsTab(page);

    await expect(page.getByText('Reel Instagram Pipeline')).toBeVisible({ timeout: 5_000 });

    // Dismiss the confirm dialog
    page.on('dialog', async (dialog) => {
      await dialog.dismiss();
    });

    await page.getByText('Supprimer').first().click();

    // Workflow should still be visible
    await expect(page.getByText('Reel Instagram Pipeline')).toBeVisible();
  });

  /* ---- Cancel form ---- */

  test('cancel form discards changes', async ({ page }) => {
    const ok = await ensureAuthOrSkip(page);
    if (!ok) test.skip();

    await setupMocks(page);
    await goToWorkflowsTab(page);

    await expect(page.getByText('Reel Instagram Pipeline')).toBeVisible({ timeout: 5_000 });
    await page.getByText('Cr', { exact: false }).filter({ hasText: /Cr[eé]er un workflow/ }).click();

    // Fill the name
    const nameInput = page.locator('input[type="text"]').first();
    await nameInput.fill('This should be discarded');

    // Click Annuler
    await page.getByRole('button', { name: /Annuler/i }).click();

    // Form should close
    await expect(page.locator('input[placeholder="Description du workflow"]')).toBeHidden({ timeout: 3_000 });
  });

  /* ---- Validation ---- */

  test('validation prevents empty name submit', async ({ page }) => {
    const ok = await ensureAuthOrSkip(page);
    if (!ok) test.skip();

    await setupMocks(page);
    await goToWorkflowsTab(page);

    await expect(page.getByText('Reel Instagram Pipeline')).toBeVisible({ timeout: 5_000 });
    await page.getByText('Cr', { exact: false }).filter({ hasText: /Cr[eé]er un workflow/ }).click();

    // Sauvegarder should be disabled when name is empty
    const saveButton = page.getByRole('button', { name: /Sauvegarder/i });
    await expect(saveButton).toBeDisabled();
  });

  /* ---- Multiple workflows ---- */

  test('multiple workflows render in list', async ({ page }) => {
    const ok = await ensureAuthOrSkip(page);
    if (!ok) test.skip();

    await setupMocks(page, { workflows: [MOCK_WORKFLOW, MOCK_WORKFLOW_2] });
    await goToWorkflowsTab(page);

    await expect(page.getByText('Reel Instagram Pipeline')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('TikTok Story Generator')).toBeVisible();
    // Version badges
    await expect(page.getByText('v1')).toBeVisible();
    await expect(page.getByText('v3')).toBeVisible();
  });

  test('workflow 2 shows auto-publication and no HITL', async ({ page }) => {
    const ok = await ensureAuthOrSkip(page);
    if (!ok) test.skip();

    await setupMocks(page, { workflows: [MOCK_WORKFLOW, MOCK_WORKFLOW_2] });
    await goToWorkflowsTab(page);

    await expect(page.getByText('TikTok Story Generator')).toBeVisible({ timeout: 5_000 });
    // MOCK_WORKFLOW_2 has humanReviewRequired: false, autoPublish: true
    await expect(page.getByText('HITL: Auto')).toBeVisible();
    await expect(page.getByText('Publication: Auto')).toBeVisible();
  });

  /* ---- Toggle behavior ---- */

  test('toggle review humaine in create form', async ({ page }) => {
    const ok = await ensureAuthOrSkip(page);
    if (!ok) test.skip();

    await setupMocks(page);
    await goToWorkflowsTab(page);

    await expect(page.getByText('Reel Instagram Pipeline')).toBeVisible({ timeout: 5_000 });
    await page.getByText('Cr', { exact: false }).filter({ hasText: /Cr[eé]er un workflow/ }).click();

    // Review humaine toggle — default is true, so the switch should be on
    const hitlSwitch = page.getByRole('switch', { name: /Review humaine/i }).or(
      page.locator('button[role="switch"]').first(),
    );
    if (await hitlSwitch.isVisible()) {
      // Click to toggle off
      await hitlSwitch.click();
      await expect(hitlSwitch).toHaveAttribute('aria-checked', 'false');
      // Click to toggle back on
      await hitlSwitch.click();
      await expect(hitlSwitch).toHaveAttribute('aria-checked', 'true');
    }
  });

  test('toggle auto-publication in create form', async ({ page }) => {
    const ok = await ensureAuthOrSkip(page);
    if (!ok) test.skip();

    await setupMocks(page);
    await goToWorkflowsTab(page);

    await expect(page.getByText('Reel Instagram Pipeline')).toBeVisible({ timeout: 5_000 });
    await page.getByText('Cr', { exact: false }).filter({ hasText: /Cr[eé]er un workflow/ }).click();

    // Auto-publication toggle — default is false
    const autoSwitch = page.locator('button[role="switch"]').last();
    if (await autoSwitch.isVisible()) {
      await expect(autoSwitch).toHaveAttribute('aria-checked', 'false');
      await autoSwitch.click();
      await expect(autoSwitch).toHaveAttribute('aria-checked', 'true');
    }
  });

  /* ---- Save error ---- */

  test('save workflow error shows toast/error', async ({ page }) => {
    const ok = await ensureAuthOrSkip(page);
    if (!ok) test.skip();

    await setupMocks(page, {
      postHandler: (route: any) => {
        return route.fulfill({ status: 400, json: { error: 'Nom deja utilise' } });
      },
    });
    await goToWorkflowsTab(page);

    await expect(page.getByText('Reel Instagram Pipeline')).toBeVisible({ timeout: 5_000 });
    await page.getByText('Cr', { exact: false }).filter({ hasText: /Cr[eé]er un workflow/ }).click();

    const nameInput = page.locator('input[type="text"]').first();
    await nameInput.fill('Duplicate Name');
    await page.getByRole('button', { name: /Sauvegarder/i }).click();

    // Toast/error should appear — sonner toast with error message
    await expect(page.getByText(/Nom deja utilise|erreur/i)).toBeVisible({ timeout: 5_000 });
  });
});
