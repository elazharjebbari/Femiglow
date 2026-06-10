/**
 * F01 — SOCLE UI : scénarios métier E2E sur l'écran pilote (serveur réel,
 * DB femiglow_test_e2e). Batterie technique/fonctionnalites/F01.
 *
 *  - 'F01-E-073' SM-F01-01 « opérateur pressé » : 3 mutations d'affilée →
 *    3 toasts succès lisibles, AUCUN dialog NATIF (window.confirm/alert) ;
 *  - 'F01-E-074' SM-F01-02 « fausse manip » : Échap puis Annuler sur le
 *    ConfirmDialog → AUCUNE donnée détruite (oracle DB : compte inchangé) ;
 *  - 'F01-A-078' axe sur la page adoptante : 0 violation serious/critical.
 *
 * PÉRIMÈTRE P1 : le seul écran adoptant du socle est SuppressionList
 * (pilote P1.5) — les 3 mutations de SM-F01-01 se jouent donc sur cet écran ;
 * la version inter-écrans arrive quand le cockpit adopte (P2). Reportés avec
 * leurs adoptants (cf. 03-batterie-tests.csv) : SM-F01-03 Freshness (dashboard
 * C3, P2), SM-F01-04 wizard+F5 (campagnes C4, P3), SM-F01-05 toast Réessayer
 * (cockpit, P2).
 *
 * Isolation : adresses préfixées `e2e-socle-`, purge scopée en before/afterAll.
 */
import { test, expect, type Page } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from './helpers/auth';
import {
  seedSuppression,
  countSuppressionByPrefix,
  cleanupSuppressionByPrefix,
  closeE2eSql,
} from './_helpers/emails-db';
import { expectNoSeriousAxeViolations } from './_helpers/axe-e2e';

const PREFIX = 'e2e-socle-';
const EMAILS = [
  `${PREFIX}presse-1@exemple.test`,
  `${PREFIX}presse-2@exemple.test`,
  `${PREFIX}presse-3@exemple.test`,
  `${PREFIX}garde-a@exemple.test`,
  `${PREFIX}garde-b@exemple.test`,
];

/**
 * Enregistre tout dialog NATIF du navigateur (window.confirm/alert/prompt).
 * Oracle SM-F01-01 : ce tableau doit rester VIDE — le socle a remplacé les
 * confirms natifs par ConfirmDialog (verrou cliquet côté unit, preuve E2E ici).
 */
function trackNativeDialogs(page: Page): string[] {
  const natives: string[] = [];
  page.on('dialog', (d) => {
    natives.push(d.type());
    void d.dismiss();
  });
  return natives;
}

async function gotoSuppression(page: Page): Promise<void> {
  await page.goto('/admin/emails/suppression');
  await expect(page.getByTestId('suppression-list')).toBeVisible();
}

test.describe('F01 — socle UI, écran pilote Suppression @emails-socle', () => {
  test.use({ storageState: ADMIN_STORAGE_PATH });
  // Les 3 tests partagent le même seed (compteurs DB) → un seul worker.
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    await cleanupSuppressionByPrefix(PREFIX);
    await seedSuppression(
      EMAILS.map((email, i) => ({
        email,
        reason: i % 2 === 0 ? 'hard_bounce' : 'unsubscribe',
        source: i % 2 === 0 ? 'stalwart' : 'manual',
        detail: 'seed e2e socle',
      })),
    );
  });

  test.afterAll(async () => {
    await cleanupSuppressionByPrefix(PREFIX);
    await closeE2eSql();
  });

  test("F01-E-073 — SM-F01-01 opérateur pressé : 3 retraits enchaînés, 3 toasts résultat, zéro dialog natif", async ({ page }) => {
    const natives = trackNativeDialogs(page);
    await gotoSuppression(page);

    for (const email of EMAILS.slice(0, 3)) {
      // Filtre pour isoler la ligne (l'écran pagine à 50 ; le seed des autres
      // specs ne doit pas pousser la ligne hors page).
      await page.getByTestId('suppression-search-input').fill(email);
      await page.getByRole('button', { name: 'Rechercher' }).click();
      await page.getByTestId(`suppression-remove-${email}`).click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      // Verbe d'action explicite — jamais « OK » (invariant F01-C-069b).
      await expect(dialog.getByRole('button', { name: /^ok$/i })).toHaveCount(0);
      await dialog.getByRole('button', { name: 'Retirer', exact: true }).click();

      // Toast RÉSULTAT (nomme l'adresse), pas un « opération effectuée ».
      await expect(
        page.getByTestId('toast-viewport').getByText(`${email} retiré de la liste de suppression`),
      ).toBeVisible();
      // La ligne a disparu de la table.
      await expect(page.getByTestId(`suppression-row-${email}`)).toHaveCount(0);
    }

    // AUCUN window.confirm/alert pendant les 3 mutations.
    expect(natives).toEqual([]);
    // Oracle DB : exactement les 3 adresses traitées ont été retirées.
    expect(await countSuppressionByPrefix(PREFIX)).toBe(2);
  });

  test('F01-E-074 — SM-F01-02 fausse manip : Échap puis Annuler → aucune donnée détruite', async ({ page }) => {
    await gotoSuppression(page);
    const before = await countSuppressionByPrefix(PREFIX);
    expect(before).toBe(2); // garde-a + garde-b (état hérité du test 073, mode serial)

    // 1er réflexe de fausse manip : Échap.
    await page.getByTestId(`suppression-remove-${PREFIX}garde-a@exemple.test`).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // 2e réflexe : bouton Annuler.
    await page.getByTestId(`suppression-remove-${PREFIX}garde-b@exemple.test`).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Annuler', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Rien n'a été détruit : pas de toast, lignes en place, DB inchangée.
    await expect(page.getByText(/retiré de la liste/i)).toHaveCount(0);
    await expect(page.getByTestId(`suppression-row-${PREFIX}garde-a@exemple.test`)).toBeVisible();
    await expect(page.getByTestId(`suppression-row-${PREFIX}garde-b@exemple.test`)).toBeVisible();
    expect(await countSuppressionByPrefix(PREFIX)).toBe(before);
  });

  test('F01-A-078 — axe sur la page adoptante (table peuplée PUIS dialog ouvert) : 0 serious/critical', async ({ page }) => {
    await gotoSuppression(page);
    await expect(page.getByTestId(`suppression-row-${PREFIX}garde-a@exemple.test`)).toBeVisible();
    await expectNoSeriousAxeViolations(page, '/admin/emails/suppression (table)');

    // Même page avec le ConfirmDialog ouvert (overlay + focus trap).
    await page.getByTestId(`suppression-remove-${PREFIX}garde-a@exemple.test`).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expectNoSeriousAxeViolations(page, '/admin/emails/suppression (dialog ouvert)');
    await page.keyboard.press('Escape');
  });
});
