/**
 * Phase 6 E2E — Comportement DÉGRADÉ digne (pas de crash / spinner infini).
 *
 * Contexte : Listmonk est volontairement MORT (port 9999) sur l'env e2e ; la
 * page /admin/emails/listmonk doit rester digne (la page admin SSR rend, seul
 * le contenu de l'iframe ne charge pas — pas de crash côté Next).
 *
 * Scénarios (cf. chantier D §5) :
 *  - DEGRADED-01 : /admin/emails/listmonk rend une page digne (heading + cadre
 *    iframe ou message d'indispo), pas un 500 ni un écran blanc.
 *  - DEGRADED-02 : cockpit avec la recherche qui 500 (forcé via route
 *    interception) → message d'erreur digne (role=alert), pas de spinner figé,
 *    et la page reste utilisable (pas de crash React).
 *
 * Oracle métier : un opérateur qui ouvre une page pendant un incident (Listmonk
 * down, backend KO) doit COMPRENDRE l'état, pas tomber sur un écran cassé.
 */
import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from './helpers/auth';

test.describe('Phase 6 — dégradé digne @emails-degraded', () => {
  test.use({ storageState: ADMIN_STORAGE_PATH });

  // DEGRADED-01 — page Listmonk (Listmonk mort) reste digne.
  test('DEGRADED-01 — /admin/emails/listmonk rend une page digne malgré Listmonk down', async ({
    page,
  }) => {
    const res = await page.goto('/admin/emails/listmonk');
    // La page SSR Next DOIT rendre (pas de 500 même si Listmonk est injoignable :
    // le contenu Listmonk vit dans une iframe, le SSR ne l'attend pas).
    expect(res?.status(), 'la page admin ne doit pas être un 5xx').toBeLessThan(500);

    // Heading "Listmonk" présent (digne : on sait où on est).
    await expect(
      page.getByRole('heading', { name: 'Listmonk', exact: true }),
    ).toBeVisible();

    // Soit un cadre iframe (LISTMONK_PUBLIC_URL configuré), soit le message
    // d'indispo — dans les deux cas, pas d'écran blanc. On exige l'un OU l'autre.
    const frame = page.locator('iframe[title="Listmonk"]');
    const downMsg = page.getByText(
      /n'est pas encore exposé publiquement|Listmonk/i,
    );
    const hasFrame = (await frame.count()) > 0;
    if (hasFrame) {
      await expect(frame).toBeVisible();
      // Le lien "Ouvrir dans un nouvel onglet" reste une issue de secours digne.
      await expect(
        page.getByRole('link', { name: /Ouvrir dans un nouvel onglet/i }),
      ).toBeVisible();
    } else {
      await expect(downMsg.first()).toBeVisible();
    }
  });

  // DEGRADED-02 — cockpit : la recherche renvoie 500 → erreur digne.
  test('DEGRADED-02 — cockpit avec recherche en 500 affiche une erreur digne', async ({
    page,
  }) => {
    // Forcer le endpoint de recherche à 500 (panne backend simulée proprement,
    // sans toucher la DB). Le cockpit appelle POST /search au montage.
    await page.route('**/api/admin/emails/transactional/search', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ ok: false, error: 'panne simulée e2e' }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto('/admin/emails/transactional');

    // Le shell rend (heading visible) — pas de crash global.
    await expect(
      page.getByRole('heading', { name: 'Transactionnel', exact: true }),
    ).toBeVisible();

    // Oracle digne : un message d'erreur (role=alert) apparaît ; pas de spinner
    // figé. Le cockpit affiche "Erreur : HTTP 500" via le bloc searchError.
    const alert = page.getByRole('alert').filter({ hasText: /Erreur|500/i });
    await expect(alert.first()).toBeVisible({ timeout: 10_000 });

    // Le squelette de chargement NE doit PAS rester affiché indéfiniment
    // (isSearching repasse à false même en erreur).
    await expect(page.getByTestId('filtered-table-skeleton')).toBeHidden();
  });
});
