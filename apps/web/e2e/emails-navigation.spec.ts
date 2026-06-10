/**
 * F02 — NAVIGATION & IA de la section emails : E2E (serveur réel,
 * DB femiglow_test_e2e). Batterie technique/fonctionnalites/F02.
 *
 *  - 'F02-E-001' tour des 9 sections AU CLAVIER (Tab/Entrée, zéro souris),
 *    onglet actif aria-current=page à chaque étape ;
 *  - 'F02-E-002' Suppression découvrable par DEUX chemins (onglet + palette) ;
 *  - 'F02-E-003' badge DLQ visible par l'astreinte → clic → cockpit ;
 *  - 'F02-E-004' nav-counters en panne : AUCUN badge mais navigation intacte ;
 *  - 'F02-E-005' /campaigns/new → flux de création (redirect + ancre) ;
 *  - 'F02-E-006' axe sur 3 écrans clés : 0 violation serious/critical.
 *
 * Isolation : lignes outbox préfixées `e2e-nav-`, scheduled_for=2999 (jamais
 * claimables par un drain cron concurrent), purge scopée.
 */
import { test, expect, type Page } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from './helpers/auth';
import { seedOutbox, cleanupE2eRows, closeE2eSql } from './_helpers/emails-db';
import { expectNoSeriousAxeViolations } from './_helpers/axe-e2e';

const PREFIX = 'e2e-nav-';
const FUTURE_SCHEDULED = new Date('2999-01-01T00:00:00.000Z');

/** Ordre canonique de la barre (spec F02 §2 — figé). */
const SECTIONS: Array<{ label: string; path: string }> = [
  { label: 'Dashboard', path: '/admin/emails' },
  { label: 'Transactionnel', path: '/admin/emails/transactional' },
  { label: 'Campagnes', path: '/admin/emails/campaigns' },
  { label: 'Automations', path: '/admin/emails/automation' },
  { label: 'Audiences', path: '/admin/emails/audiences' },
  { label: 'Templates', path: '/admin/emails/templates' },
  { label: 'Suppression', path: '/admin/emails/suppression' },
  { label: 'Events', path: '/admin/emails/events' },
  { label: 'Listmonk', path: '/admin/emails/listmonk' },
];

const tabsNav = (page: Page) => page.getByRole('navigation', { name: 'Sections emails' });

/**
 * Amène le focus sur un lien de la barre d'onglets EXCLUSIVEMENT au clavier :
 * Tab jusqu'à ce que l'élément actif soit le lien visé (borne anti-boucle).
 * C'est volontairement le chemin réel d'un opérateur sans souris — pas un
 * `.focus()` programmatique qui masquerait un ordre de tabulation cassé.
 */
async function tabToLink(page: Page, href: string, maxPresses = 120): Promise<void> {
  for (let i = 0; i < maxPresses; i += 1) {
    const active = await page.evaluate(() => {
      const el = document.activeElement;
      return el instanceof HTMLAnchorElement
        ? { href: el.getAttribute('href'), inTabs: !!el.closest('nav[aria-label="Sections emails"]') }
        : null;
    });
    if (active?.href === href && active.inTabs) return;
    await page.keyboard.press('Tab');
  }
  throw new Error(`Focus jamais atteint sur ${href} après ${maxPresses} Tab`);
}

test.describe('F02 — navigation section emails @emails-navigation', () => {
  test.use({ storageState: ADMIN_STORAGE_PATH });
  // Le badge DLQ (E-003) dépend d'un seed partagé + cache serveur 30 s → serial.
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    await cleanupE2eRows([], PREFIX);
    // 3 messages en DLQ : le badge « 3 » de l'astreinte (F02-E-003).
    await seedOutbox(
      [0, 1, 2].map((i) => ({
        id: `${PREFIX}dlq-${i}`,
        status: 'dlq' as const,
        lastError: 'SMTP 550 permanent failure',
        attempts: 5,
        scheduledFor: FUTURE_SCHEDULED,
      })),
    );
  });

  test.afterAll(async () => {
    await cleanupE2eRows([], PREFIX);
    await closeE2eSql();
  });

  test('F02-E-001 — tour des 9 sections au clavier, aria-current=page à chaque étape', async ({ page }) => {
    test.setTimeout(120_000); // 9 navigations + tabulations réelles
    await page.goto('/admin/emails');
    await expect(tabsNav(page)).toBeVisible();

    for (const section of SECTIONS) {
      await tabToLink(page, section.path);
      await page.keyboard.press('Enter');
      await page.waitForURL((url) => url.pathname === section.path, { timeout: 15_000 });
      // L'onglet actif est marqué pour TOUT LE MONDE (AT comprises).
      const activeTab = tabsNav(page).getByRole('link', { name: section.label, exact: false });
      await expect(activeTab.first()).toHaveAttribute('aria-current', 'page');
    }
  });

  test('F02-E-002 — Suppression découvrable par l’onglet ET par la palette ⌘K', async ({ page }) => {
    // Chemin 1 : l'onglet (TRV-03 — fini les écrans orphelins).
    await page.goto('/admin/emails');
    await tabsNav(page).getByRole('link', { name: 'Suppression' }).click();
    await page.waitForURL('**/admin/emails/suppression');
    await expect(page.getByRole('heading', { name: 'Liste de suppression' })).toBeVisible();

    // Chemin 2 : la palette (SUP-01 — découvrable aussi au clavier).
    await page.goto('/admin/emails');
    await page.keyboard.press('Control+k');
    const palette = page.getByRole('dialog');
    await expect(palette).toBeVisible();
    await page.getByRole('textbox', { name: /recherche commandes/i }).fill('suppr');
    await palette.getByText('Liste de suppression').click();
    await page.waitForURL('**/admin/emails/suppression');
    await expect(page.getByTestId('suppression-list')).toBeVisible();
  });

  test('F02-E-003 — l’astreinte voit le badge DLQ sur Transactionnel et clique vers le cockpit', async ({ page }) => {
    // Le compteur serveur est caché 30 s (unstable_cache) : on recharge
    // jusqu'à apparition du badge — borne large mais jamais de faux vert.
    test.setTimeout(120_000);
    await page.goto('/admin/emails');

    const badge = tabsNav(page)
      .getByRole('link', { name: /Transactionnel/ })
      .locator('[aria-label*="DLQ"]');
    await expect(async () => {
      await page.reload();
      await expect(badge).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 90_000, intervals: [5_000] });

    // Le libellé accessible porte le nombre ET son sens (jamais couleur seule).
    await expect(badge).toHaveAttribute('aria-label', /\d+ message\(s\) en DLQ/);
    const count = Number((await badge.textContent())?.replace('+', '') ?? '0');
    expect(count).toBeGreaterThanOrEqual(3);

    // Clic → le cockpit transactionnel s'ouvre (l'écran où vivent les DLQ).
    await tabsNav(page).getByRole('link', { name: /Transactionnel/ }).click();
    await page.waitForURL('**/admin/emails/transactional');
    await expect(page.getByTestId('filtered-table')).toBeVisible();
  });

  test('F02-E-004 — nav-counters en panne : aucun badge, navigation 100 % fonctionnelle', async ({ page }) => {
    // Panne simulée à la frontière réseau (l'écran ne peut pas la distinguer
    // d'une vraie panne serveur) — dégradation silencieuse exigée par la spec.
    await page.route('**/api/admin/emails/nav-counters*', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"down"}' }),
    );
    await page.goto('/admin/emails');
    const nav = tabsNav(page);
    await expect(nav).toBeVisible();

    // Les 9 onglets sont là, AUCUN badge, AUCUN toast d'erreur.
    for (const section of SECTIONS) {
      await expect(nav.getByRole('link', { name: section.label, exact: false }).first()).toBeVisible();
    }
    await expect(nav.locator('[aria-label*="DLQ"], [aria-label*="erreur"]')).toHaveCount(0);
    // Silencieux = pas de toast d'erreur (un alert métier du dashboard resterait légitime).
    await expect(page.getByTestId('toast-viewport').getByRole('alert')).toHaveCount(0);

    // La navigation reste possible malgré la panne compteurs.
    await nav.getByRole('link', { name: 'Suppression' }).click();
    await page.waitForURL('**/admin/emails/suppression');
    await expect(page.getByRole('heading', { name: 'Liste de suppression' })).toBeVisible();
    await nav.getByRole('link', { name: 'Campagnes' }).click();
    await page.waitForURL('**/admin/emails/campaigns');
  });

  test('F02-E-005 — /campaigns/new aboutit au flux de création (plus de lien mort CAMP-08)', async ({ page }) => {
    await page.goto('/admin/emails/campaigns/new');
    await page.waitForURL('**/admin/emails/campaigns*');
    // L'ancre cible existe et le formulaire de création est utilisable.
    await expect(page.locator('#nouvelle-campagne')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Nom de la nouvelle campagne' })).toBeVisible();
    await expect(page.getByRole('button', { name: '+ Créer' })).toBeEnabled();
  });

  test('F02-E-006 — axe layout + barre sur 3 écrans clés : 0 serious/critical', async ({ page }) => {
    test.setTimeout(90_000);
    for (const path of ['/admin/emails', '/admin/emails/transactional', '/admin/emails/suppression']) {
      await page.goto(path);
      await expect(tabsNav(page)).toBeVisible();
      await expectNoSeriousAxeViolations(page, path);
    }
  });
});
