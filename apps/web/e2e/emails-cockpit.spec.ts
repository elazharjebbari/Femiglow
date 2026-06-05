/**
 * Phase 6 E2E — Cockpit transactionnel /admin/emails/transactional + S5
 * "OPÉRATEUR SOUS PRESSION" (serveur réel, DB femiglow_test_e2e).
 *
 * S5 : on seede 5 000 lignes outbox variées (statuts / templates / dates) puis
 * on vérifie que le cockpit tient sous la charge :
 *  - COCK-01 : la liste rend en < 5 s (premier paint des lignes).
 *  - COCK-02 : recherche `status:failed` exacte (toutes les lignes rendues sont
 *    failed ; aucune autre).
 *  - COCK-03 : pagination au-delà de 50 — page 2 montre des lignes DIFFÉRENTES
 *    de la page 1 (offset effectif, pas un re-render des 50 premières).
 *  - COCK-04 : bulk retry sur une sélection — ORACLE DB : `next_retry` resetté
 *    (et status→pending) UNIQUEMENT sur les ids sélectionnés ; les autres
 *    lignes failed NON sélectionnées gardent leur ancien next_retry.
 *  - COCK-05 : détail d'une ligne (clic → page /transactional/[id]).
 *
 * Oracle métier transverse : un cockpit qui ment (recherche approximative,
 * pagination factice, bulk qui touche plus que la sélection) est pire que pas
 * de cockpit — l'opérateur prend des décisions sur ces données.
 *
 * Isolation : 5 000 lignes préfixées `e2e-cock-`, purgées en afterAll.
 */
import { test, expect, type Page } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from './helpers/auth';
import {
  seedOutbox,
  cleanupE2eRows,
  closeE2eSql,
  readOutboxByIds,
  E2E_PREFIX,
  type SeedOutboxRow,
} from './_helpers/emails-db';

const COCK_PREFIX = `${E2E_PREFIX}cock-`;
const SEED_COUNT = 5000;
// next_retry "ancien" posé sur les failed seedés → un reset le ramènera à ~now.
const OLD_NEXT_RETRY = new Date('2020-01-01T00:00:00.000Z');
// scheduled_for FUTUR sur TOUTES les lignes cockpit → le pickup du cron
// (`scheduled_for <= now()`) ne les ramasse jamais. Indispensable car la spec
// mailpit déclenche un drain cron RÉEL et tournerait en parallèle : sans ce
// garde, le cron enverrait 5 000 mails cockpit vers Mailpit et pourrait même
// ne pas voir la ligne mailpit (LIMIT 100). L'UI bulkRetry (COCK-04) reste
// éligible (elle filtre sur le statut, pas sur scheduled_for).
const FUTURE_SCHEDULED = new Date('2999-01-01T00:00:00.000Z');

const TEMPLATES = ['welcome-rituel', 'cart-abandon', 'order-confirm', 'j45-relance'];
const STATUSES: SeedOutboxRow['status'][] = [
  'pending',
  'sent',
  'delivered',
  'failed',
  'bounced_soft',
  'dlq',
];

/**
 * Génère 5 000 lignes variées. Statuts/templates tournent par modulo ; les
 * dates s'échelonnent sur ~5000 minutes pour un tri date_desc déterministe.
 * Les `failed` portent un next_retry ANCIEN (OLD_NEXT_RETRY) → oracle reset.
 */
function buildSeed(): SeedOutboxRow[] {
  const baseTime = Date.now();
  const rows: SeedOutboxRow[] = [];
  for (let i = 0; i < SEED_COUNT; i += 1) {
    const status = STATUSES[i % STATUSES.length]!;
    const isFailed = status === 'failed';
    rows.push({
      id: `${COCK_PREFIX}${String(i).padStart(5, '0')}`,
      status,
      template: TEMPLATES[i % TEMPLATES.length],
      toEmail: `e2e-cock-${String(i).padStart(5, '0')}@exemple.test`,
      attempts: isFailed ? 2 : 0,
      lastError: isFailed ? 'SMTP 451 temporary failure' : null,
      nextRetry: isFailed ? OLD_NEXT_RETRY : null,
      // Non-éligible au cron (cf. FUTURE_SCHEDULED) — n'affecte ni l'affichage
      // cockpit ni l'éligibilité bulkRetry (qui filtre sur le statut).
      scheduledFor: FUTURE_SCHEDULED,
      // Décroissant : i=0 le plus récent (tri par défaut date_desc).
      createdAt: new Date(baseTime - i * 60_000),
    });
  }
  return rows;
}

/**
 * Applique un filtre statut via l'URL (le cockpit initialise ses filtres depuis
 * `?status=...` au montage — cf. deserializeFilters). On évite volontairement la
 * palette ⌘K : DEUX palettes écoutent Ctrl+K dans l'admin (CommandPalette
 * cockpit + GlobalCommandPalette), et l'overlay de la seconde intercepte les
 * clics suivants. La voie URL est déterministe et sans flake.
 */
async function gotoCockpitWithStatus(page: Page, status: string): Promise<void> {
  await page.goto(`/admin/emails/transactional?status=${encodeURIComponent(status)}`);
  await expect(page.getByTestId('filtered-table')).toBeVisible();
  await expect(page.locator('[data-testid^="row-"]').first()).toBeVisible();
}

test.describe('Phase 6 — cockpit transactionnel (S5 sous pression) @emails-cockpit', () => {
  test.use({ storageState: ADMIN_STORAGE_PATH });
  // 5 000 lignes seedées une fois → serial (un worker), purge en fin.
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    // Cleanup scopé au préfixe cockpit (les fichiers tournent en parallèle ;
    // un cleanup global wiperait le seed des autres specs).
    await cleanupE2eRows([], COCK_PREFIX);
    await seedOutbox(buildSeed());
  });

  test.afterAll(async () => {
    await cleanupE2eRows([], COCK_PREFIX);
    await closeE2eSql();
  });

  // COCK-01 — la liste rend en < 5 s malgré 5 000 lignes en base.
  test('COCK-01 — la liste rend en < 5 s sous 5 000 lignes', async ({ page }) => {
    const start = Date.now();
    await page.goto('/admin/emails/transactional');
    // On attend le 1er rendu de lignes (table peuplée), pas juste le shell.
    await expect(page.getByTestId('filtered-table')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('[data-testid^="row-"]').first()).toBeVisible({
      timeout: 5_000,
    });
    const elapsed = Date.now() - start;
    // Oracle dur : sous 5 s, premier paint des données. La pagination plafonne
    // à 50 lignes par page (PAGE_SIZE) — le rendu ne dépend pas du total.
    expect(elapsed).toBeLessThan(5_000);
  });

  // COCK-02 — recherche status:failed EXACTE : toutes les lignes affichées sont
  // failed, aucune autre. On lit les badges de statut rendus.
  test('COCK-02 — recherche status:failed exacte', async ({ page }) => {
    await gotoCockpitWithStatus(page, 'failed');

    // Chaque ligne visible DOIT porter le statut "failed" et rien d'autre.
    const statuses = await page
      .locator('[data-testid^="row-"] td span')
      .filter({ hasText: /^(pending|sent|delivered|failed|bounced_soft|dlq|sending|opened|clicked|bounced_permanent|suppressed)$/ })
      .allInnerTexts();
    expect(statuses.length).toBeGreaterThan(0);
    for (const s of statuses) {
      expect(s.trim()).toBe('failed');
    }
  });

  // COCK-03 — pagination > 50 : page 2 montre des lignes différentes de page 1.
  test('COCK-03 — pagination au-delà de 50 (lignes différentes)', async ({ page }) => {
    await page.goto('/admin/emails/transactional');
    await expect(page.getByTestId('filtered-table')).toBeVisible();
    await expect(page.locator('[data-testid^="row-"]').first()).toBeVisible();

    // La pagination n'apparaît que si total > PAGE_SIZE (50) — vrai ici (5000).
    const pager = page.getByTestId('cockpit-pagination');
    await expect(pager).toBeVisible();

    // Empreinte page 1 : les ids des lignes (data-testid="row-<id>").
    const idsOf = async (): Promise<string[]> =>
      page.locator('[data-testid^="row-"]').evaluateAll((els) =>
        els.map((el) => el.getAttribute('data-testid') ?? ''),
      );
    const page1 = await idsOf();
    expect(page1.length).toBe(50);
    const rangeP1 = await page.getByTestId('pagination-range').innerText();

    // Aller page 2.
    await page.getByTestId('pagination-next').click();
    // Attendre que la plage affichée change (oracle anti-no-op).
    await expect(page.getByTestId('pagination-range')).not.toHaveText(rangeP1);
    await expect(page.locator('[data-testid^="row-"]').first()).toBeVisible();

    const page2 = await idsOf();
    expect(page2.length).toBe(50);

    // Oracle : aucune intersection entre page 1 et page 2 (offset réel).
    const set1 = new Set(page1);
    const overlap = page2.filter((id) => set1.has(id));
    expect(overlap).toEqual([]);
  });

  // COCK-04 — bulk retry sur une sélection : ORACLE DB. next_retry resetté +
  // status→pending UNIQUEMENT sur les ids cochés ; les autres failed intacts.
  test('COCK-04 — bulk retry ne touche QUE la sélection (oracle DB)', async ({
    page,
  }) => {
    // On filtre sur les failed pour avoir une page homogène d'éligibles.
    await gotoCockpitWithStatus(page, 'failed');

    // On ne retient QUE des lignes appartenant à CETTE spec (préfixe cockpit).
    // Sans ce garde, le rendu pouvait capter des lignes d'autres specs (dash /
    // mailpit) que LEUR afterAll supprime en parallèle → l'id envoyé au
    // bulk-retry devenait `not_found` (flake observée 1/6 en run combiné).
    // On polle jusqu'à voir ≥ 4 lignes cockpit failed (3 sélection + 1 témoin),
    // ce qui garantit aussi que le re-fetch client `status=failed` a abouti.
    let cockpitIds: string[] = [];
    await expect
      .poll(
        async () => {
          cockpitIds = (
            await page
              .locator(`[data-testid^="row-${COCK_PREFIX}"]`)
              .evaluateAll((els) =>
                els.map((el) => (el.getAttribute('data-testid') ?? '').replace(/^row-/, '')),
              )
          ).filter((id) => id.startsWith(COCK_PREFIX));
          return cockpitIds.length;
        },
        {
          timeout: 10_000,
          message: 'au moins 4 lignes failed de CETTE spec doivent être rendues',
        },
      )
      .toBeGreaterThanOrEqual(4);

    const selectedIds = cockpitIds.slice(0, 3);
    // Un id failed NON sélectionné (témoin négatif) : présent dans la page mais
    // pas coché. On en prend un au-delà des 3 premiers.
    const controlId = cockpitIds[3]!;

    // Cocher les 3 premières checkboxes de ligne.
    for (const id of selectedIds) {
      await page
        .locator(`[data-testid="row-${id}"] input[type="checkbox"]`)
        .check();
    }
    await expect(page.getByTestId('selection-count')).toContainText('3');

    // Lancer le bulk retry via la BulkActionsBar.
    await page.getByRole('button', { name: /Retry \(3\)/i }).click();

    // Feedback honnête : "3 relancés".
    await expect(page.getByTestId('bulk-action-feedback')).toContainText(
      /3 relanc/i,
      { timeout: 10_000 },
    );

    // Oracle DB : les 3 sélectionnés → status pending + next_retry > seed ancien.
    // Le témoin controlId → toujours failed + next_retry inchangé (ancien).
    await expect
      .poll(
        async () => {
          const map = await readOutboxByIds([...selectedIds, controlId]);
          const selOk = selectedIds.every((id) => {
            const r = map.get(id);
            return (
              r != null &&
              r.status === 'pending' &&
              r.next_retry != null &&
              r.next_retry.getTime() > OLD_NEXT_RETRY.getTime()
            );
          });
          const control = map.get(controlId);
          const controlUntouched =
            control != null &&
            control.status === 'failed' &&
            control.next_retry != null &&
            control.next_retry.getTime() === OLD_NEXT_RETRY.getTime();
          return selOk && controlUntouched;
        },
        { timeout: 10_000, message: 'bulk retry doit resetter UNIQUEMENT la sélection' },
      )
      .toBe(true);
  });

  // COCK-05 — détail d'une ligne : clic sur le destinataire → page détail.
  test('COCK-05 — détail d\'une ligne ouvre /transactional/[id]', async ({
    page,
  }) => {
    await page.goto('/admin/emails/transactional');
    await expect(page.getByTestId('filtered-table')).toBeVisible();
    const firstRow = page.locator('[data-testid^="row-"]').first();
    await expect(firstRow).toBeVisible();
    const rowId = (
      (await firstRow.getAttribute('data-testid')) ?? ''
    ).replace(/^row-/, '');

    // Clic sur le bouton destinataire (FilteredTable : onRowClick).
    await firstRow.locator('td button').first().click();
    await expect(page).toHaveURL(
      new RegExp(`/admin/emails/transactional/${rowId.replace(/[^a-zA-Z0-9-]/g, '')}`),
    );
    // La page détail affiche la section Métadonnées.
    await expect(page.getByText('Métadonnées')).toBeVisible();
  });
});
