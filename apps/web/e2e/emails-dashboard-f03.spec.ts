/**
 * F03 — dashboard /admin/emails, gate de phase P2 (serveur :3100, DB
 * femiglow_test_e2e) : F03-E-001..005 + F03-A-001/002.
 *
 * ⚠ À LANCER EN --workers=1 : F03-E-004 simule une panne DB ciblée (rename
 * d'email_outbox) — toute autre spec concurrente serait affectée. (La coupure
 * TOTALE faisait tomber le layout admin AVANT le boundary du segment.)
 *
 * Seed (préfixe e2e-f03-) :
 *  - 4 sent + 3 failed datés maintenant (fenêtre 24h ET 7j) ;
 *  - 5 sent datés J-3 (fenêtre 7j seulement → les chiffres bougent avec ?window=) ;
 *  - 12 dlq datés maintenant (check dlq24h ✗ au-delà de 10 → deep-link visible) ;
 *  - 1 delivered J-10 + email_event delivered J-10 : webhookLastSuccessAt non
 *    nul mais delivered=0 DANS la fenêtre → carte Livrés en E2 « silent »
 *    (« webhook muet depuis … ») sans aucune action opérateur (F03-E-001 — le
 *    cycle auto-refresh 60 s lui-même est verrouillé en composant C-013/014).
 */
import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from './helpers/auth';
import { expectNoSeriousAxeViolations } from './_helpers/axe-e2e';
import {
  seedOutbox,
  seedEvents,
  cleanupE2eRows,
  closeE2eSql,
  cutDbForServer,
  restoreDbForServer,
  E2E_PREFIX,
} from './_helpers/emails-db';

const P = `${E2E_PREFIX}f03-`;
const FUTURE = new Date('2999-01-01T00:00:00.000Z');

test.describe('F03 — dashboard (gate P2) @emails-f03', () => {
  test.use({ storageState: ADMIN_STORAGE_PATH });
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    await cleanupE2eRows([], P);
    const now = Date.now();
    const d3 = new Date(now - 3 * 86_400_000);
    const d10 = new Date(now - 10 * 86_400_000);
    await seedOutbox([
      ...Array.from({ length: 4 }, (_, i) => ({
        id: `${P}sent24-${i}`,
        status: 'sent' as const,
        createdAt: new Date(now),
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        id: `${P}fail24-${i}`,
        status: 'failed' as const,
        lastError: 'SMTP 451 temporary failure',
        scheduledFor: FUTURE,
        createdAt: new Date(now),
      })),
      // 12 dlq : le check santé dlq24h ne passe en ✗ (et n'expose son action
      // « Voir la DLQ ») qu'au-delà de 10 (seuil incident).
      ...Array.from({ length: 12 }, (_, i) => ({
        id: `${P}dlq-${i}`,
        status: 'dlq' as const,
        attempts: 5,
        lastError: 'SMTP 550 mailbox unavailable',
        scheduledFor: FUTURE,
        createdAt: new Date(now),
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        id: `${P}sent7d-${i}`,
        status: 'sent' as const,
        createdAt: d3,
      })),
      // Webhook DÉJÀ vu (J-10, HORS fenêtre 7j) → l'état E2 « silent » est
      // possible (delivered=0 en fenêtre mais webhookLastSuccessAt non nul).
      {
        id: `${P}old-deliv`,
        status: 'delivered' as const,
        deliveredAt: d10,
        createdAt: d10,
      },
    ]);
    await seedEvents([{ outboxId: `${P}old-deliv`, type: 'delivered', ts: d10 }]);
  });

  test.afterAll(async () => {
    await restoreDbForServer(); // ceinture+bretelles si E-004 a échoué à mi-course
    await cleanupE2eRows([], P);
    await closeE2eSql();
  });

  // F03-E-001 — SM-F03-01 : l'incident webhook est VISIBLE sans action.
  test('F03-E-001 — carte Livrés « webhook muet depuis … » + bandeau, sans clic', async ({
    page,
  }) => {
    await page.goto('/admin/emails');
    const card = page.getByTestId('kpi-card-delivered');
    await expect(card).toBeVisible();
    // Tri-état E2 silent : la carte le DIT (pas un 0 nu) et donne l'heure du
    // dernier signe de vie webhook.
    await expect(card).toContainText(/webhook muet depuis/);
    // Bandeau d'alerte transverse + action de diagnostic.
    await expect(page.getByTestId('delivery-silent-banner')).toBeVisible();
    await expect(page.getByRole('link', { name: /Diagnostiquer/ }).first()).toBeVisible();
  });

  // F03-E-002 — SM-F03-02 : comparer 24h / 7j, l'URL suit, les chiffres bougent.
  test('F03-E-002 — sélecteur 24h → 7j : chiffres et URL ?window= suivent', async ({
    page,
  }) => {
    await page.goto('/admin/emails?window=24h');
    const totalValue = () =>
      page.getByTestId('kpi-card-total').locator('p.tabular-nums').first().innerText();

    const total24 = Number((await totalValue()).replace(/[^\d]/g, ''));

    // Bascule 7 jours via le radiogroup (libellé « 7 j »).
    await page.getByRole('radio', { name: '7 j' }).click();
    await expect(page).toHaveURL(/window=7d/);
    await expect
      .poll(async () => Number((await totalValue()).replace(/[^\d]/g, '')), {
        message: 'le total 7j doit inclure les envois J-3 (> total 24h)',
      })
      .toBeGreaterThan(total24);
  });

  // F03-E-003 — SM-F03-03 : livraison silencieuse → diagnostic en un clic.
  test('F03-E-003 — Diagnostiquer → cockpit sent,delivered avec bannière from=health', async ({
    page,
  }) => {
    await page.goto('/admin/emails');
    await page.getByRole('link', { name: /Diagnostiquer/ }).first().click();
    await expect(page).toHaveURL(/transactional\?.*status=sent%2Cdelivered|transactional\?.*status=sent,delivered/);
    await expect(page).toHaveURL(/from=health/);
    await expect(page).toHaveURL(/check=deliveredFreshness/);
    // CKP-F15 — l'opérateur sait POURQUOI il est là.
    const banner = page.getByTestId('health-context-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(/contrôle santé/i);
    await expect(banner).toContainText('deliveredFreshness');
  });

  // F03-E-005 — astreinte : badge santé déplié → check DLQ ✗ → cockpit contextualisé.
  test('F03-E-005 — check DLQ ✗ → cockpit ?status=dlq&from=health avec bannière', async ({
    page,
  }) => {
    await page.goto('/admin/emails');
    // Déplier le badge santé (details/summary).
    await page
      .locator('details > summary')
      .filter({ hasText: /Système OK|Dégradé|Incident/ })
      .click();
    // Le check DLQ est ✗ (12 lignes seedées <24h, seuil 10) → action rendue.
    await page.getByRole('link', { name: /Voir la DLQ/i }).click();
    await expect(page).toHaveURL(/transactional\?.*status=dlq/);
    await expect(page).toHaveURL(/from=health/);
    await expect(page).toHaveURL(/check=dlq24h/);
    const banner = page.getByTestId('health-context-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('dlq24h');
  });

  // F03-A-001 — axe Playwright sur le dashboard (rendu réel : contraste compris).
  test('F03-A-001 — axe dashboard : 0 violation serious/critical', async ({ page }) => {
    test.setTimeout(90_000); // l'analyse axe-core peut dépasser 30 s sur page dense
    await page.goto('/admin/emails');
    await expect(page.getByTestId('kpi-card-total')).toBeVisible();
    await expectNoSeriousAxeViolations(page, 'dashboard /admin/emails');
  });

  // F03-A-002 — le sélecteur de fenêtre est navigable au clavier (radiogroup).
  test('F03-A-002 — radiogroup fenêtre : Tab l\'atteint, les flèches changent la fenêtre', async ({
    page,
  }) => {
    await page.goto('/admin/emails?window=24h');
    const radiogroup = page.getByRole('radiogroup');
    await expect(radiogroup).toBeVisible();

    // Tab jusqu'au radiogroup (roving tabindex → un seul stop Tab).
    let reached = false;
    for (let i = 0; i < 80; i += 1) {
      await page.keyboard.press('Tab');
      const inGroup = await page.evaluate(() => {
        const el = document.activeElement;
        return Boolean(el?.closest('[role="radiogroup"]'));
      });
      if (inGroup) {
        reached = true;
        break;
      }
    }
    expect(reached, 'Tab doit atteindre le sélecteur de fenêtre').toBe(true);

    // Flèche droite → fenêtre suivante (l'URL suit).
    await page.keyboard.press('ArrowRight');
    await expect(page).toHaveURL(/window=7d/);
    await page.keyboard.press('ArrowRight');
    await expect(page).toHaveURL(/window=30d/);
  });

  // F03-E-004 — SM-F03-04 : DB coupée → message honnête, Réessayer ramène la page.
  // EN DERNIER dans le fichier (serial) : il coupe puis restaure la DB.
  test('F03-E-004 — DB down → error boundary neutre + Réessayer après reprise', async ({
    page,
  }) => {
    // Panne ciblée : email_outbox indisponible → les requêtes de la PAGE
    // échouent, le layout reste sain → boundary du segment (DASH-09).
    await cutDbForServer();
    try {
      await page.goto('/admin/emails');
      // Message NEUTRE (DASH-09) : pas de « base de données », pas de stack.
      const retry = page.getByRole('button', { name: /Réessayer/i });
      await expect(retry).toBeVisible({ timeout: 15_000 });
      const bodyText = (await page.locator('body').innerText()).toLowerCase();
      expect(bodyText).not.toContain('base de données');
      expect(bodyText).not.toContain('postgres');
    } finally {
      await restoreDbForServer();
    }

    // Reprise : Réessayer re-rend le dashboard (poll — le pool serveur se
    // reconnecte au premier accès réussi).
    await expect(async () => {
      await page.getByRole('button', { name: /Réessayer/i }).click();
      await expect(page.getByTestId('kpi-card-total')).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 30_000 });
  });
});
