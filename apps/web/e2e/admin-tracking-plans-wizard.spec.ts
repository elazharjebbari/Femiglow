/**
 * E2E Playwright — wizard de création TrackingPlan v2 (golden path).
 *
 * Couvre le flux principal :
 *   /admin/tracking/plans → "Nouveau plan" → 5 steps → save → detail.
 *
 * Tolérance : skip propre si la session admin est indisponible
 * (redirect /admin/login). Le `sessionStorage` est purgé au début pour
 * écarter tout draft Zustand antérieur (le store wizard persiste en
 * sessionStorage cf. `wizard-store.ts`).
 */
import { test, expect, type Page } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from './helpers/auth';

test.use({ storageState: ADMIN_STORAGE_PATH });

async function ensureAuthOrSkip(page: Page): Promise<void> {
  if (page.url().includes('/admin/login')) test.skip();
}

async function clearWizardDraft(page: Page): Promise<void> {
  // Le store wizard persiste sous la clé `tracking-plan-wizard` en
  // sessionStorage. On purge pour partir d'un draft propre à chaque run.
  await page.evaluate(() => {
    try {
      window.sessionStorage.removeItem('tracking-plan-wizard');
    } catch {
      /* sandboxed contexts may throw */
    }
  });
}

test.describe('Admin /admin/tracking/plans — wizard golden path', () => {
  test('liste des plans accessible (ou skip si non authentifié)', async ({ page }) => {
    await page.goto('/admin/tracking/plans');
    await ensureAuthOrSkip(page);
    await expect(
      page.getByRole('heading', { name: /plans de tracking|tracking/i }).first(),
    ).toBeVisible();
  });

  test('crée un brouillon via le wizard 5 steps', async ({ page }) => {
    // Compile-on-demand Next dev : 60 s safe net.
    test.setTimeout(90_000);

    await page.goto('/admin/tracking/plans/new');
    await ensureAuthOrSkip(page);
    await clearWizardDraft(page);
    await page.reload();
    await ensureAuthOrSkip(page);

    // ─── Step 1 — Outils
    // On active GA4 + Meta via leurs switches (role="switch").
    await page.getByRole('switch', { name: /google analytics 4/i }).click();
    await expect(page.getByRole('switch', { name: /google analytics 4/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await page.getByRole('switch', { name: /meta pixel/i }).click();
    await page.getByRole('button', { name: /suivant/i }).click();

    // ─── Step 2 — Identifiants
    // GA4 + Meta IDs (formats respectent les regex ID_RULES).
    await page.getByLabel(/ga4 measurement id/i).fill('G-5VHP17SDZM');
    await page.getByLabel(/meta pixel id/i).fill('987654321987654');
    await page.getByRole('button', { name: /suivant/i }).click();

    // ─── Step 3 — Événements (preset page_view)
    await page.getByRole('button', { name: /\+ page_view/i }).click();
    // Vérifie que le preset est devenu non-cliquable (disabled).
    await expect(page.getByRole('button', { name: /\+ page_view/i })).toBeDisabled();
    await page.getByRole('button', { name: /suivant/i }).click();

    // ─── Step 4 — Consentement (on garde defaults v2)
    await page.getByRole('button', { name: /suivant/i }).click();

    // ─── Step 5 — Revue
    const planName = `E2E Plan ${Date.now()}`;
    await page.getByLabel(/nom du plan/i).fill(planName);
    await expect(page.getByRole('button', { name: /enregistrer le brouillon/i })).toBeEnabled();
    await page.getByRole('button', { name: /enregistrer le brouillon/i }).click();

    // Redirige vers /admin/tracking/plans/[id] après POST.
    await page.waitForURL(/\/admin\/tracking\/plans\/plan_[a-z0-9_]+$/, { timeout: 30_000 });

    // Détail : le nom du plan est visible dans le shell.
    await expect(page.getByRole('heading', { name: new RegExp(planName, 'i') })).toBeVisible();
  });

  test('bouton "Précédent" est désactivé à l\'étape initiale', async ({ page }) => {
    await page.goto('/admin/tracking/plans/new');
    await ensureAuthOrSkip(page);
    await clearWizardDraft(page);
    await page.reload();
    await ensureAuthOrSkip(page);

    await expect(page.getByRole('button', { name: /précédent/i })).toBeDisabled();
  });
});
