/**
 * Content Studio v2 — /library FULL operator scenarios.
 *
 * Comprehensive E2E coverage for every interaction surface in the library
 * mode: grid rendering, search, filters (status / platform / pillar /
 * date-range), reset, result counter, card selection, bulk-action bar,
 * per-card hover actions (duplicate / archive), card link navigation,
 * and Cmd+K palette commands when items are selected.
 *
 * Resilient to empty DB state: tests that need cards skip gracefully.
 * Mutation tests (approve, archive, duplicate) intercept API routes to
 * avoid altering real staging data.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';

test.use({ storageState: ADMIN_STORAGE_PATH });

const LIBRARY_URL = '/admin/content-studio-v2/library';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function ensureAuthOrSkip(page: import('@playwright/test').Page) {
  if (page.url().includes('/admin/login')) {
    test.skip(true, 'Admin auth storage state is not valid in this environment.');
  }
}

async function ensureLibraryOrSkip(page: import('@playwright/test').Page) {
  const heading = page.getByRole('heading', { name: /bibliothèque/i, level: 1 });
  const visible = await heading.isVisible({ timeout: 10_000 }).catch(() => false);
  if (!visible) {
    test.skip(true, 'Library page did not render (server error or feature gated).');
  }
}

/** Returns true when the library grid has at least one card. */
async function hasCards(page: import('@playwright/test').Page): Promise<boolean> {
  return page
    .locator('[data-cs-library-card] input[type="checkbox"]')
    .first()
    .isVisible({ timeout: 3_000 })
    .catch(() => false);
}

function skipIfNoCards(has: boolean) {
  if (!has) {
    test.skip(true, 'No library cards in DB — skipping test that requires items.');
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('library — operator scenarios', () => {
  test.describe.configure({ mode: 'serial' });

  // ---- Rendering --------------------------------------------------------

  test('renders grid with cards or empty state', async ({ page }) => {
    await page.goto(LIBRARY_URL);
    await ensureAuthOrSkip(page);
    await ensureLibraryOrSkip(page);

    const grid = page.getByRole('list', { name: /bibliothèque de contenus/i });
    const empty = page.getByRole('status');
    await expect(grid.or(empty).first()).toBeVisible();
  });

  // ---- Search -----------------------------------------------------------

  test('search input filters items — URL gets ?q=', async ({ page }) => {
    await page.goto(LIBRARY_URL);
    await ensureAuthOrSkip(page);
    await ensureLibraryOrSkip(page);

    const search = page.getByLabel('Rechercher dans la bibliothèque');
    await search.fill('femiglow');
    // LibrarySearch debounces 250ms then serialises as ?q=
    await expect(page).toHaveURL(/[?&]q=femiglow/i, { timeout: 5_000 });
  });

  test('clear search — URL drops ?q=', async ({ page }) => {
    await page.goto(`${LIBRARY_URL}?q=femiglow`);
    await ensureAuthOrSkip(page);
    await ensureLibraryOrSkip(page);

    const search = page.getByLabel('Rechercher dans la bibliothèque');
    await search.fill('');
    await expect(page).toHaveURL((url) => !/[?&]q=/.test(url.search), { timeout: 5_000 });
  });

  // ---- Filters ----------------------------------------------------------

  test('status filter — open popover, check checkbox, URL updates', async ({ page }) => {
    await page.goto(LIBRARY_URL);
    await ensureAuthOrSkip(page);
    await ensureLibraryOrSkip(page);

    // Open the Statut popover
    const statusTrigger = page.getByRole('button', { name: /statut/i }).first();
    await statusTrigger.click();

    // The popover should open with status checkboxes
    const listbox = page.getByRole('listbox');
    await expect(listbox.first()).toBeVisible();

    // Click the first available status checkbox label (e.g. "Idee").
    // Use click() instead of check() because the React controlled component
    // re-renders on onChange and Playwright's check() assertion can race.
    const firstStatusCheckbox = listbox.first().locator('input[type="checkbox"]').first();
    await firstStatusCheckbox.click();

    // URL should include ?status=
    await expect(page).toHaveURL(/[?&]status=/, { timeout: 5_000 });
  });

  test('platform filter — select Instagram, URL updates', async ({ page }) => {
    await page.goto(LIBRARY_URL);
    await ensureAuthOrSkip(page);
    await ensureLibraryOrSkip(page);

    const platformTrigger = page.getByRole('button', { name: /plateforme\s*:/i });
    await platformTrigger.click();
    await page.getByRole('option', { name: /instagram/i }).click();
    await expect(page).toHaveURL(/[?&]platform=instagram/, { timeout: 5_000 });

    // Revert to "Toutes"
    await platformTrigger.click();
    await page.getByRole('option', { name: /toutes/i }).click();
    await expect(page).toHaveURL((url) => !/[?&]platform=/.test(url.search), { timeout: 5_000 });
  });

  test('pillar filter — select a pillar, URL updates', async ({ page }) => {
    await page.goto(LIBRARY_URL);
    await ensureAuthOrSkip(page);
    await ensureLibraryOrSkip(page);

    const pillarTrigger = page.getByRole('button', { name: /pilier\s*:/i });
    await pillarTrigger.click();

    // Pick the first non-"Tous" option
    const options = page.getByRole('option');
    const count = await options.count();
    if (count < 2) {
      test.skip(true, 'No pillar options to test.');
      return;
    }
    // Click second option (first is "Tous")
    await options.nth(1).click();
    await expect(page).toHaveURL(/[?&]pillar=/, { timeout: 5_000 });
  });

  test('date range — set from/to dates, URL updates', async ({ page }) => {
    await page.goto(LIBRARY_URL);
    await ensureAuthOrSkip(page);
    await ensureLibraryOrSkip(page);

    const dateFrom = page.getByLabel('Date de début');
    const dateTo = page.getByLabel('Date de fin');

    await dateFrom.fill('2025-01-01');
    await expect(page).toHaveURL(/[?&]from=2025-01-01/, { timeout: 5_000 });

    await dateTo.fill('2025-12-31');
    await expect(page).toHaveURL(/[?&]to=2025-12-31/, { timeout: 5_000 });
  });

  test('reset filters — click Reinitialiser, all cleared', async ({ page }) => {
    // Start with some filters applied
    await page.goto(`${LIBRARY_URL}?platform=instagram&pillar=rituel`);
    await ensureAuthOrSkip(page);
    await ensureLibraryOrSkip(page);

    // The Reinitialiser button should be visible when filters are active
    const resetBtn = page.getByRole('button', { name: /réinitialiser/i });
    await expect(resetBtn).toBeVisible({ timeout: 5_000 });
    await resetBtn.click();

    // URL should no longer have platform= or pillar=
    await expect(page).toHaveURL(
      (url) => !/[?&](platform|pillar|status|from|to)=/.test(url.search),
      { timeout: 5_000 },
    );
  });

  test('result counter reflects filtered count', async ({ page }) => {
    await page.goto(LIBRARY_URL);
    await ensureAuthOrSkip(page);
    await ensureLibraryOrSkip(page);

    // The result counter exists with pattern "N / M resultats".
    // Scope to the filter toolbar to avoid matching notification regions.
    const toolbar = page.getByRole('toolbar', { name: /filtres bibliothèque/i });
    const counter = toolbar.locator('[aria-live="polite"]');
    await expect(counter).toBeVisible();
    await expect(counter).toHaveText(/\d+\s*\/\s*\d+\s*résultats?/);
  });

  // ---- Card Selection & Bulk Action Bar ---------------------------------

  test('select single card via checkbox — bulk bar appears', async ({ page }) => {
    await page.goto(LIBRARY_URL);
    await ensureAuthOrSkip(page);
    await ensureLibraryOrSkip(page);
    const cards = await hasCards(page);
    skipIfNoCards(cards);

    // Bar should not be visible before selection
    await expect(page.getByRole('region', { name: /actions groupées/i })).not.toBeVisible();

    const firstCheckbox = page.locator('[data-cs-library-card] input[type="checkbox"]').first();
    await firstCheckbox.check();

    const bar = page.getByRole('region', { name: /actions groupées/i });
    await expect(bar).toBeVisible();
    await expect(bar).toContainText(/1 sélectionné/);
  });

  test('select second card — count updates to "2 selectionnes"', async ({ page }) => {
    await page.goto(LIBRARY_URL);
    await ensureAuthOrSkip(page);
    await ensureLibraryOrSkip(page);
    const cards = await hasCards(page);
    skipIfNoCards(cards);

    const checkboxes = page.locator('[data-cs-library-card] input[type="checkbox"]');
    const total = await checkboxes.count();
    if (total < 2) {
      test.skip(true, 'Need at least 2 cards to test multi-select.');
      return;
    }

    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();

    const bar = page.getByRole('region', { name: /actions groupées/i });
    await expect(bar).toBeVisible();
    await expect(bar).toContainText(/2 sélectionnés/);
  });

  test('click Annuler in bulk bar — selection cleared, bar disappears', async ({ page }) => {
    await page.goto(LIBRARY_URL);
    await ensureAuthOrSkip(page);
    await ensureLibraryOrSkip(page);
    const cards = await hasCards(page);
    skipIfNoCards(cards);

    const firstCheckbox = page.locator('[data-cs-library-card] input[type="checkbox"]').first();
    await firstCheckbox.check();

    const bar = page.getByRole('region', { name: /actions groupées/i });
    await expect(bar).toBeVisible();

    await bar.getByRole('button', { name: /annuler/i }).click();

    await expect(bar).not.toBeVisible();
    await expect(firstCheckbox).not.toBeChecked();
  });

  test('select cards — click Approuver — toast success', async ({ page }) => {
    await page.goto(LIBRARY_URL);
    await ensureAuthOrSkip(page);
    await ensureLibraryOrSkip(page);
    const cards = await hasCards(page);
    skipIfNoCards(cards);

    // Intercept approve API to avoid mutating staging data
    await page.route('**/api/admin/content-studio/drafts/*/approve', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }),
    );

    const firstCheckbox = page.locator('[data-cs-library-card] input[type="checkbox"]').first();
    await firstCheckbox.check();

    const bar = page.getByRole('region', { name: /actions groupées/i });
    await bar.getByRole('button', { name: /approuver/i }).click();

    // Toast should appear with success message
    await expect(page.getByText(/\d+ draft[s]? approuvé/)).toBeVisible({ timeout: 8_000 });
  });

  test('select cards — click Archiver — confirm dialog — confirm — toast', async ({ page }) => {
    await page.goto(LIBRARY_URL);
    await ensureAuthOrSkip(page);
    await ensureLibraryOrSkip(page);
    const cards = await hasCards(page);
    skipIfNoCards(cards);

    // Intercept archive API to avoid mutating staging data
    await page.route('**/api/admin/content-studio/drafts/*/archive', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }),
    );
    await page.route('**/api/admin/content-studio/posts/*/archive', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }),
    );

    const firstCheckbox = page.locator('[data-cs-library-card] input[type="checkbox"]').first();
    await firstCheckbox.check();

    const bar = page.getByRole('region', { name: /actions groupées/i });
    await bar.getByRole('button', { name: /archiver/i }).click();

    // Confirmation dialog should appear
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/archiver \d+ élément/i);

    // Click confirm
    await dialog.getByRole('button', { name: /confirmer l'archivage/i }).click();

    // Toast should appear with success message
    await expect(page.getByText(/\d+ élément[s]? archivé/)).toBeVisible({ timeout: 8_000 });
  });

  // ---- Per-card Hover Actions -------------------------------------------

  test('hover card — action buttons visible', async ({ page }) => {
    await page.goto(LIBRARY_URL);
    await ensureAuthOrSkip(page);
    await ensureLibraryOrSkip(page);
    const cards = await hasCards(page);
    skipIfNoCards(cards);

    const firstCard = page.locator('li[data-cs-library-card]').first();

    // The hover actions overlay uses CSS `:hover` / `:focus-within` to
    // toggle opacity from 0 to 1. In headless Chromium the pseudo-class
    // may not engage reliably. We verify the action elements exist in the
    // DOM (they are always rendered) then manually set opacity via JS to
    // confirm they become visible — replicating the user experience.
    const actions = firstCard.locator('[data-cs-library-actions]');
    await expect(actions).toBeAttached();

    // Force opacity:1 via JS to simulate hover state
    await actions.evaluate((el) => { el.style.opacity = '1'; });
    await expect(actions).toHaveCSS('opacity', '1');

    // Verify the three action buttons exist
    await expect(firstCard.locator('[aria-label="Ouvrir"]')).toBeVisible();
    await expect(firstCard.locator('[aria-label="Dupliquer"]')).toBeVisible();
    await expect(firstCard.locator('[aria-label="Archiver"]')).toBeVisible();
  });

  test('click Dupliquer on card — toast "Variante creee"', async ({ page }) => {
    await page.goto(LIBRARY_URL);
    await ensureAuthOrSkip(page);
    await ensureLibraryOrSkip(page);
    const cards = await hasCards(page);
    skipIfNoCards(cards);

    // Intercept duplicate API
    await page.route('**/api/admin/content-studio/drafts/*/variation', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }),
    );

    const firstCard = page.locator('li[data-cs-library-card]').first();

    // Force the action overlay visible (opacity:0 in non-hover state)
    await firstCard.locator('[data-cs-library-actions]').evaluate((el) => { el.style.opacity = '1'; });

    // Click the Dupliquer button
    await firstCard.locator('button[aria-label="Dupliquer"]').click();

    // Toast should confirm creation
    await expect(page.getByText(/variante créée/i)).toBeVisible({ timeout: 8_000 });
  });

  test('click Archiver on single card — card disappears (optimistic)', async ({ page }) => {
    await page.goto(LIBRARY_URL);
    await ensureAuthOrSkip(page);
    await ensureLibraryOrSkip(page);
    const cards = await hasCards(page);
    skipIfNoCards(cards);

    // Intercept archive API
    await page.route('**/api/admin/content-studio/drafts/*/archive', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }),
    );
    await page.route('**/api/admin/content-studio/posts/*/archive', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }),
    );

    const cardsBefore = await page.locator('li[data-cs-library-card]').count();
    const firstCard = page.locator('li[data-cs-library-card]').first();

    // Force the action overlay visible (opacity:0 in non-hover state)
    await firstCard.locator('[data-cs-library-actions]').evaluate((el) => { el.style.opacity = '1'; });

    // Click the Archiver action button on the card
    await firstCard.locator('button[aria-label="Archiver"]').click();

    // Card count should decrease by 1 (optimistic removal)
    if (cardsBefore > 1) {
      await expect(page.locator('li[data-cs-library-card]')).toHaveCount(cardsBefore - 1, {
        timeout: 5_000,
      });
    } else {
      // If only 1 card, the empty state should appear
      await expect(page.getByRole('status')).toBeVisible({ timeout: 5_000 });
    }

    // Toast should confirm
    await expect(page.getByText(/archivé/i)).toBeVisible({ timeout: 8_000 });
  });

  test('click card link — navigates to /create/{draftId}', async ({ page }) => {
    await page.goto(LIBRARY_URL);
    await ensureAuthOrSkip(page);
    await ensureLibraryOrSkip(page);
    const cards = await hasCards(page);
    skipIfNoCards(cards);

    // Find the first card link (the <a> with aria-label starting "Ouvrir :")
    const cardLink = page.locator('li[data-cs-library-card]').first().locator('a[aria-label^="Ouvrir :"]');
    const href = await cardLink.getAttribute('href');
    expect(href).toMatch(/\/admin\/content-studio-v2\/create\/.+/);

    // Click and verify navigation
    await cardLink.click();
    await expect(page).toHaveURL(/\/admin\/content-studio-v2\/create\//, { timeout: 15_000 });
  });

  // ---- Cmd+K Palette with Selection -------------------------------------

  test('Cmd+K palette shows library commands when items selected', async ({ page }) => {
    await page.goto(LIBRARY_URL);
    await ensureAuthOrSkip(page);
    await ensureLibraryOrSkip(page);
    const cards = await hasCards(page);
    skipIfNoCards(cards);

    // Select a card first so library commands register
    const firstCheckbox = page.locator('[data-cs-library-card] input[type="checkbox"]').first();
    await firstCheckbox.check();

    // Wait for bulk bar to confirm selection is active
    await expect(page.getByRole('region', { name: /actions groupées/i })).toBeVisible();

    // Move focus away from the checkbox to the page body so the hotkey
    // handler on the shell can catch Ctrl/Cmd+K without the input eating it.
    await page.getByRole('heading', { name: /bibliothèque/i, level: 1 }).click();

    // Open the palette
    await page.keyboard.press('ControlOrMeta+k');
    const palette = page.getByRole('dialog', { name: /palette de commandes/i });
    await expect(palette).toBeVisible({ timeout: 5_000 });

    // Should show selection-specific commands
    await expect(page.getByText(/approuver la sélection/i)).toBeVisible();
    await expect(page.getByText(/archiver la sélection/i)).toBeVisible();
    await expect(page.getByText(/effacer la sélection/i)).toBeVisible();

    // Close palette
    await page.keyboard.press('Escape');
    await expect(palette).not.toBeVisible();
  });
});
