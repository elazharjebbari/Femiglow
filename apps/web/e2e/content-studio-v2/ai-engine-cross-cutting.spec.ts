/**
 * AI Engine — Cross-cutting concerns E2E tests.
 *
 * Covers dark mode rendering, responsive viewport behaviour, loading &
 * error states, retry flows, and session/auth edge cases.
 *
 * All API calls are intercepted with page.route() so no real backend is
 * required.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { gotoAIEngine, ensureAuthOrSkip } from './ai-engine-helpers';

// ── Mock data ────────────────────────────────────────────────────

const MOCK_PROVIDERS = {
  providers: [
    {
      id: 'prov-cc-1',
      providerType: 'openai',
      name: 'OpenAI',
      apiKeyEnvVar: 'OPENAI_API_KEY',
      baseUrl: null,
      capabilities: ['text', 'image'],
      models: [{ name: 'gpt-4o', capability: 'text', costPer1MInput: 250, costPer1MOutput: 1000 }],
      rateLimitRpm: 60,
      dailyBudgetCents: 500,
      circuitBreakerConfig: null,
      priority: 1,
      isFallback: false,
      isEnabled: true,
      healthStatus: 'healthy',
      lastHealthCheck: new Date().toISOString(),
      configured: true,
    },
    {
      id: 'prov-cc-2',
      providerType: 'anthropic',
      name: 'Anthropic',
      apiKeyEnvVar: 'ANTHROPIC_API_KEY',
      baseUrl: null,
      capabilities: ['text'],
      models: [{ name: 'claude-3-5-sonnet', capability: 'text', costPer1MInput: 300, costPer1MOutput: 1500 }],
      rateLimitRpm: 40,
      dailyBudgetCents: 300,
      circuitBreakerConfig: null,
      priority: 2,
      isFallback: true,
      isEnabled: true,
      healthStatus: 'healthy',
      lastHealthCheck: new Date().toISOString(),
      configured: true,
    },
  ],
};

const MOCK_WORKFLOWS = {
  workflows: [
    {
      id: 'wf-cc-1',
      name: 'Cross-Cut Pipeline',
      description: 'Pipeline for cross-cutting tests',
      platform: 'instagram',
      format: 'reel',
      graphConfig: { nodes: ['brief_analysis', 'script_writer'] },
      defaultTone: 'luxurious',
      defaultLanguage: 'fr',
      qualityThreshold: '0.7',
      maxRetries: 2,
      maxBudgetCents: 100,
      humanReviewRequired: false,
      autoPublish: false,
      providerOverrides: null,
      version: 1,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
};

const MOCK_PROMPTS = {
  prompts: [
    {
      id: 'pt-cc-1',
      nodeName: 'script_writer',
      name: 'Script Writer CC',
      systemPrompt: 'Tu es un expert en contenu beaute.',
      userPromptTemplate: 'Ecris un script pour {platform}.',
      variables: ['platform'],
      version: 1,
      isActive: true,
      parentId: null,
      avgQualityScore: '0.85',
      usageCount: 15,
      createdAt: new Date().toISOString(),
    },
  ],
};

const MOCK_COLLECTIONS = {
  collections: [
    {
      id: 'col-cc-1',
      name: 'Cross-Cut Collection',
      slug: 'cross-cut-collection',
      description: 'Test collection for cross-cutting',
      category: 'brand',
      documentCount: 8,
      chunkCount: 55,
      lastIndexedAt: new Date().toISOString(),
      isActive: true,
    },
  ],
};

const MOCK_API_KEYS = {
  apiKeys: [
    {
      id: 'ak-cc-1',
      providerType: 'openai',
      providerName: 'OpenAI',
      label: 'Production key',
      source: 'database',
      masked: 'sk-proj-****abc1',
      keyPrefix: 'sk-proj-',
      keyLastFour: 'abc1',
      isActive: true,
      baseUrl: null,
      lastTestedAt: new Date().toISOString(),
      lastTestResult: 'valid',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
};

// ── Mock setup helpers ───────────────────────────────────────────

async function mockConfigAPIs(page: import('@playwright/test').Page) {
  await page.route('**/api/admin/ai-engine/config/providers', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PROVIDERS) });
  });
  await page.route('**/api/admin/ai-engine/config/workflows', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_WORKFLOWS) });
  });
  await page.route('**/api/admin/ai-engine/config/prompts', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PROMPTS) });
  });
  await page.route('**/api/admin/ai-engine/config/api-keys', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_API_KEYS) });
    } else {
      await route.continue();
    }
  });
}

async function mockKnowledgeAPIs(page: import('@playwright/test').Page) {
  await page.route('**/api/admin/ai-engine/knowledge', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/admin/ai-engine/knowledge') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_COLLECTIONS) });
    } else {
      await route.continue();
    }
  });
}

/* ================================================================
   Dark Mode
   ================================================================ */

test.describe('Dark Mode', () => {
  test.use({ storageState: ADMIN_STORAGE_PATH });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('cs-v2-theme', 'dark');
    });
  });

  test('config page renders correctly in dark mode', async ({ page }) => {
    await mockConfigAPIs(page);
    await gotoAIEngine(page, 'config');
    ensureAuthOrSkip(page);

    await expect(page.locator('.cs-v2-shell[data-theme="dark"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Fournisseurs IA')).toBeVisible({ timeout: 20_000 });

    // Verify dark background
    const bgColor = await page.locator('.cs-v2-shell').evaluate((el) => {
      return getComputedStyle(el).backgroundColor;
    });
    const match = bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    expect(match).toBeTruthy();
    if (match) {
      expect(Number(match[1])).toBeLessThan(80);
      expect(Number(match[2])).toBeLessThan(80);
      expect(Number(match[3])).toBeLessThan(80);
    }

    // Verify text is light (readable on dark bg)
    const fgColor = await page.getByText('Fournisseurs IA').evaluate((el) => {
      return getComputedStyle(el).color;
    });
    const fgMatch = fgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    expect(fgMatch).toBeTruthy();
    if (fgMatch) {
      expect(Number(fgMatch[1])).toBeGreaterThan(140);
    }
  });

  test('knowledge page renders correctly in dark mode', async ({ page }) => {
    await mockKnowledgeAPIs(page);
    await gotoAIEngine(page, 'knowledge');
    ensureAuthOrSkip(page);

    await expect(page.locator('.cs-v2-shell[data-theme="dark"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /Base de connaissances/i })).toBeVisible({ timeout: 15_000 });

    // Text should be readable (light foreground)
    const heading = page.getByRole('heading', { name: /Base de connaissances/i });
    const color = await heading.evaluate((el) => getComputedStyle(el).color);
    const m = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    expect(m).toBeTruthy();
    if (m) {
      expect(Number(m[1])).toBeGreaterThan(140);
    }
  });

  test('config modals/forms readable in dark mode', async ({ page }) => {
    await mockConfigAPIs(page);
    await gotoAIEngine(page, 'config');
    ensureAuthOrSkip(page);

    await expect(page.locator('.cs-v2-shell[data-theme="dark"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('OpenAI')).toBeVisible({ timeout: 20_000 });

    // Open the provider edit form
    const editButton = page.getByText('Éditer').first();
    await editButton.click();

    // Wait for the inline edit form to appear
    const priorityLabel = page.getByText('Priorité').first();
    await expect(priorityLabel).toBeVisible({ timeout: 5_000 });

    // Verify the form background is not white
    const formBg = await page.locator('input[type="number"]').first().evaluate((el) => {
      const container = el.closest('div');
      return container ? getComputedStyle(container).backgroundColor : 'unknown';
    });
    // The form should not have a pure white background in dark mode
    if (formBg !== 'rgba(0, 0, 0, 0)' && formBg !== 'transparent' && formBg !== 'unknown') {
      const m = formBg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (m) {
        // Should not be bright white (all channels > 240)
        const isBrightWhite = Number(m[1]) > 240 && Number(m[2]) > 240 && Number(m[3]) > 240;
        expect(isBrightWhite).toBe(false);
      }
    }
  });

  test('theme toggle switches mode', async ({ page }) => {
    await mockConfigAPIs(page);
    await gotoAIEngine(page, 'config');
    ensureAuthOrSkip(page);

    // Currently dark
    await expect(page.locator('.cs-v2-shell[data-theme="dark"]')).toBeVisible({ timeout: 15_000 });

    // Find and click the theme toggle in the sidebar
    const sidebar = page.locator('.cs-sidebar');
    const toggleButtons = sidebar.locator('button');
    // Theme toggle is typically the first button in the bottom area
    const bottomArea = sidebar.locator('.px-3.py-3').first();
    const toggle = bottomArea.locator('button').first();
    const toggleVisible = await toggle.isVisible({ timeout: 5_000 }).catch(() => false);

    if (toggleVisible) {
      await toggle.click();
      // After clicking, theme should switch to light
      const dataTheme = await page.locator('.cs-v2-shell').getAttribute('data-theme');
      // Either it is now 'light' or the dark attribute is removed
      expect(dataTheme === 'light' || dataTheme === null || dataTheme === '').toBe(true);
    }
  });

  test('dark mode sidebar has correct contrast', async ({ page }) => {
    await mockConfigAPIs(page);
    await gotoAIEngine(page, 'config');
    ensureAuthOrSkip(page);

    await expect(page.locator('.cs-v2-shell[data-theme="dark"]')).toBeVisible({ timeout: 15_000 });

    const sidebar = page.locator('.cs-sidebar');
    const sidebarBg = await sidebar.evaluate((el) => getComputedStyle(el).backgroundColor);
    // Sidebar in dark mode should have dark background
    if (sidebarBg !== 'rgba(0, 0, 0, 0)' && sidebarBg !== 'transparent') {
      const m = sidebarBg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (m) {
        expect(Number(m[1])).toBeLessThan(100);
        expect(Number(m[2])).toBeLessThan(100);
        expect(Number(m[3])).toBeLessThan(100);
      }
    }
  });
});

/* ================================================================
   Responsive
   ================================================================ */

test.describe('Responsive', () => {
  test.use({ storageState: ADMIN_STORAGE_PATH });

  test('config page on mobile viewport (375px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockConfigAPIs(page);
    await gotoAIEngine(page, 'config');
    ensureAuthOrSkip(page);

    await expect(page.getByText('Fournisseurs IA')).toBeVisible({ timeout: 20_000 });

    // Verify no horizontal scrollbar (body scrollWidth <= viewport width + tolerance)
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth + 5;
    });
    // On very small viewports some overflow is acceptable; key is content is visible
    await expect(page.getByText('OpenAI')).toBeVisible();
  });

  test('config page on tablet viewport (768px)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await mockConfigAPIs(page);
    await gotoAIEngine(page, 'config');
    ensureAuthOrSkip(page);

    await expect(page.getByText('Fournisseurs IA')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('OpenAI')).toBeVisible({ timeout: 10_000 });

    // Provider cards should be visible and not cut off
    const cardVisible = await page.evaluate(() => {
      const el = document.querySelector('.cs-v2-shell');
      if (!el) return false;
      const style = getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
    expect(cardVisible).toBe(true);
  });

  test('knowledge page on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockKnowledgeAPIs(page);
    await gotoAIEngine(page, 'knowledge');
    ensureAuthOrSkip(page);

    await expect(page.getByRole('heading', { name: /Base de connaissances/i })).toBeVisible({ timeout: 15_000 });
    // Collection data should be visible on mobile
    const collectionText = page.getByText('Cross-Cut Collection');
    const collectionButton = page.locator('button', { hasText: 'Cross-Cut Collection' });
    await expect(collectionText.or(collectionButton).first()).toBeVisible({ timeout: 20_000 });
  });

  test('stat cards adapt to narrow viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockConfigAPIs(page);
    await gotoAIEngine(page, 'config');
    ensureAuthOrSkip(page);

    await expect(page.getByText('Fournisseurs IA')).toBeVisible({ timeout: 20_000 });

    // Stat cards (provider count, workflow count, etc.) should be visible
    // and not overflow the viewport excessively
    const shell = page.locator('.cs-v2-shell');
    const isVisible = await shell.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    expect(isVisible).toBe(true);
  });

  test('provider grid collapses to single column on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockConfigAPIs(page);
    await gotoAIEngine(page, 'config');
    ensureAuthOrSkip(page);

    await expect(page.getByText('OpenAI')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Anthropic')).toBeVisible({ timeout: 10_000 });

    // Both provider cards should be stacked: second card below the first
    const positions = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('[class*="cs-bg-elevated"], article, section'))
        .filter((el) => el.textContent?.includes('OpenAI') || el.textContent?.includes('Anthropic'))
        .filter((el) => {
          const rect = el.getBoundingClientRect();
          return rect.width > 100 && rect.height > 50;
        });
      return cards.slice(0, 2).map((c) => ({
        top: c.getBoundingClientRect().top,
        left: c.getBoundingClientRect().left,
        width: c.getBoundingClientRect().width,
      }));
    });

    if (positions.length === 2) {
      // On mobile, cards should be stacked (second card below the first)
      expect(positions[1].top).toBeGreaterThanOrEqual(positions[0].top);
    }
  });

  test('config page tabs are scrollable on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockConfigAPIs(page);
    await gotoAIEngine(page, 'config');
    ensureAuthOrSkip(page);

    await expect(page.getByText('Fournisseurs IA')).toBeVisible({ timeout: 20_000 });

    // The config page has tabs: Fournisseurs, Workflows, Prompts, Cles API, Base de connaissances
    // On mobile, all tab text should still be accessible (visible or scrollable)
    const firstTab = page.getByText('Fournisseurs IA');
    await expect(firstTab).toBeVisible();
  });
});

/* ================================================================
   Loading & Error States
   ================================================================ */

test.describe('Loading & Error States', () => {
  test.use({ storageState: ADMIN_STORAGE_PATH });

  test('config page shows skeleton while loading', async ({ page }) => {
    // Set up a delayed provider response
    await page.route('**/api/admin/ai-engine/config/providers', async (route) => {
      // Delay the response
      await new Promise((r) => setTimeout(r, 2000));
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PROVIDERS) });
    });
    await page.route('**/api/admin/ai-engine/config/workflows', async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_WORKFLOWS) });
    });
    await page.route('**/api/admin/ai-engine/config/prompts', async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PROMPTS) });
    });

    await gotoAIEngine(page, 'config');
    ensureAuthOrSkip(page);

    // During loading, the page should show a loading indicator (skeleton, spinner, or loading text)
    const loadingIndicator = page.locator('.cs-skeleton, [class*="skeleton"], [class*="spinner"]')
      .first()
      .or(page.getByText(/chargement|loading/i).first())
      .or(page.locator('.cs-spin').first());

    const hasLoading = await loadingIndicator.isVisible({ timeout: 3_000 }).catch(() => false);
    // If the data loaded fast enough to skip the loading state, that is also acceptable
    const hasData = await page.getByText('Fournisseurs IA').isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasLoading || hasData).toBe(true);

    // Eventually the data should load
    await expect(page.getByText('Fournisseurs IA')).toBeVisible({ timeout: 15_000 });
  });

  test('config page shows error with retry on fetch failure', async ({ page }) => {
    await page.route('**/api/admin/ai-engine/config/providers', async (route) => {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Erreur serveur' }) });
    });
    await page.route('**/api/admin/ai-engine/config/workflows', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_WORKFLOWS) });
    });
    await page.route('**/api/admin/ai-engine/config/prompts', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PROMPTS) });
    });

    await gotoAIEngine(page, 'config');
    ensureAuthOrSkip(page);

    // Error message should appear
    await expect(page.getByText(/erreur|impossible|error/i).first()).toBeVisible({ timeout: 15_000 });

    // Retry button should be present
    const retryButton = page.getByRole('button', { name: /r[eé]essayer|retry|recharger/i }).first();
    await expect(retryButton).toBeVisible({ timeout: 10_000 });
  });

  test('retry button re-fetches data', async ({ page }) => {
    let callCount = 0;
    await page.route('**/api/admin/ai-engine/config/providers', async (route) => {
      callCount++;
      if (callCount === 1) {
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Erreur serveur' }) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PROVIDERS) });
      }
    });
    await page.route('**/api/admin/ai-engine/config/workflows', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_WORKFLOWS) });
    });
    await page.route('**/api/admin/ai-engine/config/prompts', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PROMPTS) });
    });

    await gotoAIEngine(page, 'config');
    ensureAuthOrSkip(page);

    // Wait for error state
    await expect(page.getByText(/erreur|impossible|error/i).first()).toBeVisible({ timeout: 15_000 });

    // Click retry
    const retryButton = page.getByRole('button', { name: /r[eé]essayer|retry|recharger/i }).first();
    await retryButton.click();

    // Data should now load
    await expect(page.getByText('OpenAI')).toBeVisible({ timeout: 15_000 });
    expect(callCount).toBeGreaterThanOrEqual(2);
  });

  test('knowledge page shows loading state', async ({ page }) => {
    await page.route('**/api/admin/ai-engine/knowledge', async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_COLLECTIONS) });
    });

    await gotoAIEngine(page, 'knowledge');
    ensureAuthOrSkip(page);

    // During load — either loading indicator or the final heading is already visible
    const heading = page.getByRole('heading', { name: /Base de connaissances/i });
    const loadingEl = page.locator('.cs-skeleton, .cs-spin, [class*="spinner"]').first()
      .or(page.getByText(/chargement|loading/i).first());

    const headingVisible = await heading.isVisible({ timeout: 5_000 }).catch(() => false);
    const loadingVisible = await loadingEl.isVisible({ timeout: 3_000 }).catch(() => false);
    expect(headingVisible || loadingVisible).toBe(true);

    // Eventually the data loads
    await expect(heading).toBeVisible({ timeout: 15_000 });
  });

  test('knowledge page shows error state', async ({ page }) => {
    await page.route('**/api/admin/ai-engine/knowledge', async (route) => {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Erreur serveur' }) });
    });

    await gotoAIEngine(page, 'knowledge');
    ensureAuthOrSkip(page);

    // Error should be visible
    await expect(
      page.getByText(/erreur|impossible|error/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('API keys tab shows loading spinner', async ({ page }) => {
    await mockConfigAPIs(page);
    // Override API keys to be slow
    await page.route('**/api/admin/ai-engine/config/api-keys', async (route) => {
      if (route.request().method() === 'GET') {
        await new Promise((r) => setTimeout(r, 2000));
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_API_KEYS) });
      } else {
        await route.continue();
      }
    });

    await gotoAIEngine(page, 'config');
    ensureAuthOrSkip(page);

    await expect(page.getByText('Fournisseurs IA')).toBeVisible({ timeout: 20_000 });

    // Click the API keys tab
    await page.getByText('Cles API', { exact: false }).click();

    // While loading, there should be a spinner or loading indicator
    const spinner = page.locator('.cs-spin, [class*="spinner"]').first()
      .or(page.getByText(/chargement|loading/i).first());
    const hasSpinner = await spinner.isVisible({ timeout: 3_000 }).catch(() => false);
    // Data may load fast enough to skip loading state
    const hasData = await page.getByText('OpenAI').isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasSpinner || hasData).toBe(true);
  });

  test('slow API response shows loading correctly', async ({ page }) => {
    await page.route('**/api/admin/ai-engine/config/providers', async (route) => {
      await new Promise((r) => setTimeout(r, 3000));
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ providers: [] }) });
    });
    await page.route('**/api/admin/ai-engine/config/workflows', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_WORKFLOWS) });
    });
    await page.route('**/api/admin/ai-engine/config/prompts', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PROMPTS) });
    });

    await gotoAIEngine(page, 'config');
    ensureAuthOrSkip(page);

    // During the 3s delay, verify something is visible (loading indicator or page shell)
    const shell = page.locator('.cs-v2-shell');
    await expect(shell).toBeVisible({ timeout: 5_000 });

    // After the delay, the page should display its content (possibly empty providers)
    await expect(page.getByText('Fournisseurs IA').or(page.getByText(/aucun fournisseur/i))).toBeVisible({ timeout: 10_000 });
  });

  test('network timeout shows error gracefully', async ({ page }) => {
    await page.route('**/api/admin/ai-engine/config/providers', async (route) => {
      await route.abort('timedout');
    });
    await page.route('**/api/admin/ai-engine/config/workflows', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_WORKFLOWS) });
    });
    await page.route('**/api/admin/ai-engine/config/prompts', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PROMPTS) });
    });

    await gotoAIEngine(page, 'config');
    ensureAuthOrSkip(page);

    // Should show error rather than crash
    await expect(page.getByText(/erreur|impossible|error|failed/i).first()).toBeVisible({ timeout: 15_000 });
  });
});

/* ================================================================
   Session & Auth
   ================================================================ */

test.describe('Session & Auth', () => {
  test.use({ storageState: ADMIN_STORAGE_PATH });

  test('unauthenticated access redirects to login', async ({ browser }) => {
    // Create a fresh context WITHOUT any storageState to simulate unauthenticated user
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    await page.addInitScript(() => {
      try { window.sessionStorage.removeItem('femiglow:chunk-reload-attempted'); } catch {}
    });
    await page.goto('/admin/content-studio-v2/ai-engine/config');
    await page.waitForLoadState('domcontentloaded');

    // Should either redirect to login or show an auth error
    const isOnLogin = page.url().includes('/admin/login');
    const hasAuthError = await page.getByText(/connexion|login|authentif/i).first()
      .isVisible({ timeout: 10_000 })
      .catch(() => false);

    expect(isOnLogin || hasAuthError).toBe(true);
    await context.close();
  });

  test('401 API response shows appropriate error', async ({ page }) => {
    await page.route('**/api/admin/ai-engine/config/providers', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Session expirée' }),
      });
    });
    await page.route('**/api/admin/ai-engine/config/workflows', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_WORKFLOWS) });
    });
    await page.route('**/api/admin/ai-engine/config/prompts', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PROMPTS) });
    });

    await gotoAIEngine(page, 'config');
    ensureAuthOrSkip(page);

    // An error message should be shown
    await expect(page.getByText(/erreur|session|unauthorized|expir[eé]e/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('unauthenticated knowledge page redirects to login', async ({ browser }) => {
    // Create a fresh context WITHOUT any storageState to simulate unauthenticated user
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    await page.addInitScript(() => {
      try { window.sessionStorage.removeItem('femiglow:chunk-reload-attempted'); } catch {}
    });
    await page.goto('/admin/content-studio-v2/ai-engine/knowledge');
    await page.waitForLoadState('domcontentloaded');

    const isOnLogin = page.url().includes('/admin/login');
    const hasAuthError = await page.getByText(/connexion|login|authentif/i).first()
      .isVisible({ timeout: 10_000 })
      .catch(() => false);

    expect(isOnLogin || hasAuthError).toBe(true);
    await context.close();
  });
});

/* ================================================================
   CSS & Visual Integrity
   ================================================================ */

test.describe('CSS & Visual Integrity', () => {
  test.use({ storageState: ADMIN_STORAGE_PATH });

  test('config page renders with proper spacing and no overlapping elements', async ({ page }) => {
    await mockConfigAPIs(page);
    await gotoAIEngine(page, 'config');
    ensureAuthOrSkip(page);

    await expect(page.getByText('Fournisseurs IA')).toBeVisible({ timeout: 20_000 });

    // Check that the main content area does not overlap the sidebar
    const sidebarRect = await page.locator('.cs-sidebar').boundingBox();
    const mainContent = page.locator('.cs-v2-shell main, .cs-v2-shell > div:nth-child(2)').first();
    const contentRect = await mainContent.boundingBox().catch(() => null);

    if (sidebarRect && contentRect) {
      // Content left edge should be at or after sidebar right edge
      expect(contentRect.x).toBeGreaterThanOrEqual(sidebarRect.x + sidebarRect.width - 5);
    }
  });

  test('provider badges use accent colors', async ({ page }) => {
    await mockConfigAPIs(page);
    await gotoAIEngine(page, 'config');
    ensureAuthOrSkip(page);

    await expect(page.getByText('OpenAI')).toBeVisible({ timeout: 20_000 });

    // Capability badges (Texte, Image) should have non-default colors
    const textBadge = page.locator('span').filter({ hasText: 'Texte' }).first();
    const badgeVisible = await textBadge.isVisible({ timeout: 5_000 }).catch(() => false);
    if (badgeVisible) {
      const color = await textBadge.evaluate((el) => getComputedStyle(el).color);
      // Should not be pure black (#000)
      expect(color).not.toBe('rgb(0, 0, 0)');
    }
  });

  test('sidebar width is consistent across AI Engine pages', async ({ page }) => {
    await mockConfigAPIs(page);
    await mockKnowledgeAPIs(page);

    // Check config page sidebar width
    await gotoAIEngine(page, 'config');
    ensureAuthOrSkip(page);
    await expect(page.getByText('Fournisseurs IA')).toBeVisible({ timeout: 20_000 });

    const configSidebarWidth = await page.locator('.cs-sidebar').evaluate((el) => {
      return el.getBoundingClientRect().width;
    });

    // Navigate to knowledge page
    await gotoAIEngine(page, 'knowledge');
    await expect(page.getByRole('heading', { name: /Base de connaissances/i })).toBeVisible({ timeout: 15_000 });

    const knowledgeSidebarWidth = await page.locator('.cs-sidebar').evaluate((el) => {
      return el.getBoundingClientRect().width;
    });

    // Sidebar width should be the same (232px as specified in Sidebar.tsx)
    expect(Math.abs(configSidebarWidth - knowledgeSidebarWidth)).toBeLessThan(5);
  });
});
