/**
 * MODÈLE — scénario métier Playwright (05-strategie-tests.md §2.4).
 *
 * Scénario SM-F04-01 « matinée d'astreinte » : l'opérateur ouvre le dashboard,
 * voit des échecs, descend au cockpit via le deep-link santé, isole la DLQ,
 * relance en masse, vérifie le feedback honnête puis l'assainissement des KPI.
 *
 * Patrons imposés :
 *  - état initial posé par HELPERS DB (pas par l'UI) → rapide et déterministe ;
 *  - test.step() pour un triage lisible en cas d'échec ;
 *  - oracles = ce que l'opérateur LIT (textes, badges), jamais le state interne ;
 *  - AUCUN waitForTimeout — waits sémantiques (expect…toPass, getByRole) ;
 *  - cible : instance worktree + femiglow_emailqa (jamais la prod).
 */
import { test, expect } from '@playwright/test';
import { seedOutbox, truncateEmails } from './_helpers/emails-db';

test.describe('SM-F04-01 — matinée d’astreinte : drainer la DLQ', () => {
  test.beforeEach(async () => {
    await truncateEmails();
    // 3 mails en DLQ + 47 délivrés — la matinée typique.
    await seedOutbox([
      { status: 'dlq', toEmail: 'k1@client.test', template: 'order-confirmation', attempts: 5 },
      { status: 'dlq', toEmail: 'k2@client.test', template: 'order-confirmation', attempts: 5 },
      { status: 'dlq', toEmail: 'k3@client.test', template: 'welcome', attempts: 5 },
      ...Array.from({ length: 47 }, (_, i) => ({
        status: 'delivered' as const,
        toEmail: `ok${i}@client.test`,
        template: 'welcome',
      })),
    ]);
  });

  test('du signal santé à la file assainie', async ({ page }) => {
    await test.step('1. Le dashboard signale l’incident', async () => {
      await page.goto('/admin/emails');
      const health = page.getByRole('group', { name: /santé/i }).or(page.locator('details', { hasText: /Système|Dégradé|Incident/ }));
      await health.click();
      await expect(page.getByText(/DLQ 24h : 3/)).toBeVisible();
    });

    await test.step('2. Deep-link santé → cockpit pré-filtré AVEC contexte', async () => {
      await page.getByRole('link', { name: /voir la dlq/i }).click();
      await expect(page).toHaveURL(/transactional\?.*status=dlq/);
      // CKP-F15 : bannière de contexte (pourquoi je suis ici).
      await expect(page.getByText(/depuis le check santé/i)).toBeVisible();
      await expect(page.getByRole('row')).toHaveCount(3 + 1); // 3 lignes + header
    });

    await test.step('3. Sélection globale + retry en masse', async () => {
      await page.getByRole('checkbox', { name: /sélectionner tout/i }).check();
      await page.getByRole('button', { name: /retry \(3\)/i }).click();
      // Feedback HONNÊTE : compte exact, raisons traduites le cas échéant.
      await expect(page.getByRole('status')).toHaveText(/3 relancés/i);
    });

    await test.step('4. La file s’assainit (oracle différé, sans sleep)', async () => {
      await expect(async () => {
        await page.getByRole('button', { name: /rafraîchir/i }).click();
        await expect(page.getByText(/aucun email ne correspond/i)).toBeVisible();
      }).toPass({ timeout: 15_000 });
    });

    await test.step('5. Retour dashboard : le badge DLQ est retombé', async () => {
      await page.goto('/admin/emails');
      await expect(page.getByText(/DLQ 24h : 0/)).toBeVisible();
    });
  });
});

/**
 * Checklist de revue pour tout nouveau spec E2E :
 *  [ ] état posé par helpers DB, nettoyé en beforeEach
 *  [ ] chaque étape = test.step nommé du point de vue opérateur
 *  [ ] aucun sélecteur CSS/classe ; rôle+nom accessible d'abord
 *  [ ] aucun waitForTimeout ; oracles différés via toPass/poll
 *  [ ] le spec correspond à UNE ligne SM-* de 04-scenarios-metier.md
 */
