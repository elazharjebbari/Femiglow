/**
 * Phase 6 E2E — Dashboard /admin/emails (serveur réel, DB femiglow_test_e2e).
 *
 * Scénarios (cf. chantier D §1) :
 *  - DASH-01 : le badge santé est rendu dans l'un des 3 états (ok/dégradé/incident).
 *  - DASH-02 : les KPI cards affichent des chiffres (seed minimal sent/delivered
 *    datés < 7j → les compteurs reflètent le seed).
 *  - DASH-03 : navigation vers cockpit / templates / automations.
 *
 * Oracle métier : le dashboard est la première vitre opérateur — il DOIT
 * toujours afficher un verdict santé (jamais un spinner figé) et des KPI
 * cohérents avec l'état réel de la file (pas des "0" trompeurs quand on vient
 * de seeder des envois).
 *
 * Isolation : on seede des lignes outbox préfixées `e2e-` en beforeAll et on les
 * purge en afterAll. Le seed est DATÉ à maintenant (< 7j) pour entrer dans la
 * fenêtre KPI 7 jours.
 */
import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from './helpers/auth';
import {
  seedOutbox,
  cleanupE2eRows,
  closeE2eSql,
  E2E_PREFIX,
} from './_helpers/emails-db';

test.describe('Phase 6 — dashboard /admin/emails @emails-dashboard', () => {
  test.use({ storageState: ADMIN_STORAGE_PATH });
  // Seed partagé (beforeAll) → un seul worker, sinon collision PK/idem sur les
  // ids fixes `e2e-…`. Serial garde aussi l'ordre déterministe.
  test.describe.configure({ mode: 'serial' });

  // Seed minimal mais déterministe : 3 sent + 2 delivered + 1 failed, datés à
  // maintenant pour entrer dans la fenêtre 7 jours. delivered ⊂ sent côté KPI
  // (getOutboxKpi : delivered compte delivered/opened/clicked ; sent compte
  // sent+delivered+opened+clicked) → on garde sent>0 et delivered>0.
  const SEED_TOTAL = 6;
  // Préfixe propre à CETTE spec → cleanup scopé (les fichiers tournent en
  // parallèle ; un cleanup global wiperait le seed d'une autre spec).
  const DASH_PREFIX = `${E2E_PREFIX}dash-`;

  test.beforeAll(async () => {
    const now = new Date();
    const rows = [
      ...Array.from({ length: 3 }, (_, i) => ({
        id: `${E2E_PREFIX}dash-sent-${i}`,
        status: 'sent' as const,
        createdAt: now,
      })),
      ...Array.from({ length: 2 }, (_, i) => ({
        id: `${E2E_PREFIX}dash-deliv-${i}`,
        status: 'delivered' as const,
        deliveredAt: now,
        createdAt: now,
      })),
      {
        id: `${E2E_PREFIX}dash-failed-0`,
        status: 'failed' as const,
        lastError: 'SMTP 550 mailbox unavailable',
        // scheduled_for futur ⇒ non ramassé par un drain cron concurrent
        // (spec mailpit) qui sinon le passerait en 'sent'.
        scheduledFor: new Date('2999-01-01T00:00:00.000Z'),
        createdAt: now,
      },
    ];
    await cleanupE2eRows([], DASH_PREFIX);
    await seedOutbox(rows);
  });

  test.afterAll(async () => {
    await cleanupE2eRows([], DASH_PREFIX);
    await closeE2eSql();
  });

  // DASH-01 — badge santé rendu, dans l'un des 3 états attendus.
  test('DASH-01 — badge santé rendu (ok | dégradé | incident)', async ({ page }) => {
    await page.goto('/admin/emails');
    await expect(
      page.getByRole('heading', { name: 'Emails', exact: true }),
    ).toBeVisible();

    // Le HealthBadge est un <details><summary> dont le summary porte le label
    // "Système OK" / "Dégradé" / "Incident". On exige qu'EXACTEMENT un des 3
    // soit rendu (jamais un état indéterminé / spinner figé).
    const summary = page.locator('details > summary').filter({
      hasText: /Système OK|Dégradé|Incident/,
    });
    await expect(summary).toHaveCount(1);
    await expect(summary).toBeVisible();
  });

  // DASH-02 — KPI cards chiffrées, cohérentes avec le seed (sent ≥ 3, total ≥ 6).
  test('DASH-02 — KPI cards affichent des chiffres reflétant le seed', async ({
    page,
  }) => {
    await page.goto('/admin/emails');

    const sentCard = page.getByTestId('kpi-card-sent');
    const deliveredCard = page.getByTestId('kpi-card-delivered');
    const totalCard = page.getByTestId('kpi-card-total');
    await expect(sentCard).toBeVisible();
    await expect(deliveredCard).toBeVisible();
    await expect(totalCard).toBeVisible();

    // Les valeurs sont des nombres formatés fr-FR (chiffres + espaces fines).
    // Oracle : sent ≥ 3 (3 sent + 2 delivered comptent comme "sent"),
    // total ≥ SEED_TOTAL. On lit le 2e <p> de la carte (la valeur).
    const parseKpi = async (testid: string): Promise<number> => {
      const valueText = await page
        .getByTestId(testid)
        .locator('p.tabular-nums')
        .first()
        .innerText();
      return Number(valueText.replace(/[^\d]/g, ''));
    };

    const sent = await parseKpi('kpi-card-sent');
    const delivered = await parseKpi('kpi-card-delivered');
    const total = await parseKpi('kpi-card-total');

    // sent KPI = sent+delivered+opened+clicked ⇒ ≥ 5 avec notre seed.
    expect(sent).toBeGreaterThanOrEqual(5);
    expect(delivered).toBeGreaterThanOrEqual(2);
    expect(total).toBeGreaterThanOrEqual(SEED_TOTAL);
    // Invariant métier : delivered ⊆ sent.
    expect(delivered).toBeLessThanOrEqual(sent);
  });

  // DASH-03 — navigation vers les sous-sections (cockpit, templates, automations).
  test('DASH-03 — navigation vers cockpit / templates / automations', async ({
    page,
  }) => {
    await page.goto('/admin/emails');

    // Cockpit transactionnel.
    await page.getByRole('link', { name: /Liste transactionnel/i }).click();
    await expect(page).toHaveURL(/\/admin\/emails\/transactional/);
    await expect(
      page.getByRole('heading', { name: 'Transactionnel', exact: true }),
    ).toBeVisible();

    // Retour dashboard puis Templates.
    await page.goto('/admin/emails');
    await page.getByRole('link', { name: /Templates HTML/i }).click();
    await expect(page).toHaveURL(/\/admin\/emails\/templates/);
    await expect(page.getByRole('heading').first()).toBeVisible();

    // Retour dashboard puis Automatisations.
    await page.goto('/admin/emails');
    await page.getByRole('link', { name: /Automatisations/i }).click();
    await expect(page).toHaveURL(/\/admin\/emails\/automation/);
    await expect(page.getByRole('heading').first()).toBeVisible();
  });
});
