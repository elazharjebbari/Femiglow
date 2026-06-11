/**
 * Module 02 — E2E cockpit : incident 200 échecs SMTP (F-011, F-013).
 *
 * Conventions repo (cf. e2e/admin-leads.spec.ts, e2e/admin-components-multi-select.spec.ts) :
 *  - storageState admin fourni par le projet "setup" (e2e/global.setup.ts →
 *    .auth/admin.json). Si la session n'est pas préchauffée, la page redirige
 *    vers /admin/login : on skip proprement (pas d'échec dur).
 *  - sélecteurs par rôle/label en priorité ; data-testid en dernier recours
 *    (ici : "selection-count", "select-all", "bulk-action-retry" issus de
 *    FilteredTable.tsx / BulkActionsBar.tsx).
 *  - JAMAIS la prod : base-url = serveur local de test + DB de test seedée.
 *
 * Déploiement : apps/web/e2e/emails-cockpit-incident.spec.ts
 *
 * Pré-requis data (seed DB de test, hors de ce fichier) :
 *  - ≥ 200 rows email_outbox status='failed' template='order-confirmation'
 *    récentes, + assez de volume total (>50) pour exercer la pagination.
 */
import { test, expect, type Page } from '@playwright/test';

const COCKPIT = '/admin/emails/transactional';

/** Garde commune : si redirigé vers login (pas de fixture admin), skip. */
async function gotoCockpitOrSkip(page: Page): Promise<boolean> {
  const res = await page.goto(COCKPIT);
  expect(res).not.toBeNull();
  if (page.url().includes('/admin/login')) {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    test.skip(true, 'Session admin non préchauffée (storageState absent).');
    return false;
  }
  return true;
}

test.describe('Cockpit transactionnel — incident SMTP', () => {
  test('CKP-E2E-112 : pagination réelle — atteindre la ligne 51+', async ({ page }) => {
    if (!(await gotoCockpitOrSkip(page))) return;

    // Le tableau doit afficher un total > 50.
    await expect(page.getByText(/sur .* total/)).toBeVisible();

    const next = page.getByRole('button', { name: /suivant|page suivante/i });
    if ((await next.count()) === 0) {
      // État cible non encore livré (F-011) : on documente l'échec attendu.
      test.fail(true, 'Régression F-011 : aucun contrôle de pagination (offset bloqué à 0).');
      return;
    }

    await expect(next).toBeEnabled();
    await next.click();
    // Indicateur de page 2 : "51–100 sur N".
    await expect(page.getByText(/51.*100|51–100/)).toBeVisible();
    // Précédent désormais actif.
    await expect(page.getByRole('button', { name: /précédent|page précédente/i })).toBeEnabled();
  });

  test('CKP-E2E-110 : tri → sélection → retry → résultat partiel honnête', async ({ page }) => {
    if (!(await gotoCockpitOrSkip(page))) return;

    // Filtrer sur les échecs via la palette ⌘K (ou la barre de filtres).
    await page.keyboard.press('Meta+k').catch(() => {});
    const palette = page.getByRole('dialog');
    if (await palette.isVisible().catch(() => false)) {
      await page.getByRole('textbox').first().fill('status:failed template:order-confirmation');
      await page.keyboard.press('Enter');
    }

    // Sélectionner toute la page visible.
    const selectAll = page.getByTestId('select-all');
    await expect(selectAll).toBeVisible();
    await selectAll.click();

    // La bulk bar apparaît avec un compteur.
    await expect(page.getByTestId('selection-count')).toBeVisible();

    // Lancer le retry.
    await page.getByTestId('bulk-action-retry').click();

    // Oracle : feedback honnête "X relancés[, Y ignorés]" (et pas un silence).
    await expect(page.getByText(/relancé|relancés/i)).toBeVisible();
  });

  test('CKP-E2E-111 : session expirée en plein bulk → alerte + sélection conservée', async ({ page, context }) => {
    if (!(await gotoCockpitOrSkip(page))) return;

    const selectAll = page.getByTestId('select-all');
    await expect(selectAll).toBeVisible();
    await selectAll.click();
    await expect(page.getByTestId('selection-count')).toBeVisible();

    // Simuler l'expiration de session : router la route bulk vers un 401.
    await context.route('**/api/admin/emails/transactional/bulk-retry', (route) =>
      route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'unauthorized' }) }),
    );

    await page.getByTestId('bulk-action-retry').click();

    // Oracle anti faux-succès (F-013) :
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('alert')).toContainText(/session|autoris/i);
    // La sélection DOIT être conservée.
    await expect(page.getByTestId('selection-count')).toBeVisible();
  });
});
