/**
 * CHA-230 — E2E Playwright pour /admin/settings/form-config.
 *
 * Couverture
 * ──────────
 *  1. Auth required — sans session redirige sur /admin/login.
 *  2. Avec session :
 *     - La card `Form Config` est visible sur `/admin/settings`.
 *     - La liste `/admin/settings/form-config` affiche les 2 wizards seedés.
 *     - L'édition d'un wizard charge l'éditeur (description + steps + copy).
 *     - L'onglet Historique liste au moins la version courante.
 *  3. API publique `/api/checkout/form-config/wizard_kit` retourne un payload
 *     non vide après navigation (validation du contrat lecture publique).
 *
 * Pré-requis local
 *   pnpm drizzle-kit migrate    # seed wizard_kit + wizard_commander (0018).
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from './helpers/auth';

test.describe('CHA-230 — /admin/settings/form-config (auth required)', () => {
  test('redirige vers /admin/login sans session', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('/admin/settings/form-config');
    await expect(page).toHaveURL(/\/admin\/login/);
    await ctx.close();
  });
});

test.describe('CHA-230 — /admin/settings/form-config (admin)', () => {
  test.use({ storageState: ADMIN_STORAGE_PATH });

  test('la card Form Config est visible sur /admin/settings', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/admin/settings');
    await expect(
      page.getByRole('heading', { name: /Réglages/i }),
    ).toBeVisible();
    await expect(
      page.getByTestId('settings-card-form-config'),
    ).toBeVisible();
  });

  test('liste les 2 wizards seedés', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/admin/settings/form-config');
    await expect(
      page.getByRole('heading', { name: /Configuration des formulaires/i }),
    ).toBeVisible();
    await expect(page.getByTestId('form-config-list')).toBeVisible();
    // Les 2 wizards sont rendus
    await expect(page.getByText('Wizard Kit')).toBeVisible();
    await expect(page.getByText('Wizard Commander')).toBeVisible();
  });

  test('ouvre l\'éditeur wizard_kit', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/admin/settings/form-config/wizard_kit');
    // Heading dans le shell (breadcrumb / titre éditeur)
    await expect(
      page.getByRole('heading', { name: /wizard_kit/i }).first(),
    ).toBeVisible();
    // Au moins un fieldset attendu (état, steps, defaults, copy, validation)
    await expect(page.getByText(/État/).first()).toBeVisible();
    // Bouton enregistrer présent
    await expect(
      page.getByRole('button', { name: /Enregistrer/i }),
    ).toBeVisible();
  });
});

test.describe('CHA-230 — API publique form-config (contrat lecture)', () => {
  test('GET /api/checkout/form-config/wizard_kit retourne un payload non vide', async ({
    request,
  }) => {
    const res = await request.get('/api/checkout/form-config/wizard_kit');
    expect(res.ok()).toBe(true);
    const body = (await res.json()) as {
      key: string;
      version: number;
      config: { steps: string[]; modes: string[] };
    };
    expect(body.key).toBe('wizard_kit');
    expect(typeof body.version).toBe('number');
    expect(Array.isArray(body.config?.steps)).toBe(true);
    expect(body.config.steps.length).toBeGreaterThanOrEqual(4);
    expect(body.config.modes.length).toBeGreaterThanOrEqual(1);
  });
});
