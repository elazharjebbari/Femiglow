/**
 * F04 — cockpit transactionnel, gate de phase P2 (serveur :3100, DB
 * femiglow_test_e2e) : F04-E-001..006 + F04-A-001/002 (scénarios SM-F04-*).
 *
 * ⚠ À LANCER EN --workers=1 : les oracles santé (DLQ 24h : N) lisent l'état
 * GLOBAL de la DB — une autre spec qui seede des dlq fausserait les comptes.
 *
 * Patrons (modeles-code/exemple-e2e.spec.ts) : état posé par helpers DB,
 * test.step du point de vue opérateur, oracles = ce que l'opérateur LIT,
 * waits sémantiques (toPass/poll), préfixe e2e-f04- + cleanup scopé.
 */
import { test, expect, type Page } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from './helpers/auth';
import { expectNoSeriousAxeViolations } from './_helpers/axe-e2e';
import {
  seedOutbox,
  seedEvents,
  cleanupE2eRows,
  cleanupSavedViewsByPrefix,
  closeE2eSql,
  readOutboxByIds,
  countSuppression,
  deleteSuppression,
  E2E_PREFIX,
} from './_helpers/emails-db';

const P = `${E2E_PREFIX}f04-`;
const FUTURE = new Date('2999-01-01T00:00:00.000Z');
const BAD_EMAILS = [0, 1, 2, 3].map((i) => `${P}bad-${i}@bad.tld`);
const CLIENT_EMAIL = `${P}kaoutar@cliente.test`;

async function gotoCockpit(page: Page, qs = ''): Promise<void> {
  await page.goto(`/admin/emails/transactional${qs}`);
  await expect(page.getByTestId('filtered-table')).toBeVisible();
}

test.describe('F04 — cockpit (gate P2) @emails-f04', () => {
  test.use({ storageState: ADMIN_STORAGE_PATH });
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    await cleanupE2eRows([], P);
    await cleanupSavedViewsByPrefix('e2e-');
    for (const e of BAD_EMAILS) await deleteSuppression(e);
    // Les oracles « DLQ 24h : N » et « file assainie » lisent l'état GLOBAL de
    // la DB e2e : on requalifie tout résidu dlq/sending hors périmètre (vieux
    // runs interrompus) — DB jetable dédiée aux specs, jamais prod/staging.
    const { e2eSql } = await import('./_helpers/emails-db');
    await e2eSql()`
      UPDATE email_outbox SET status = 'failed', updated_at = now()
      WHERE status IN ('dlq', 'sending') AND id NOT LIKE ${P + '%'}`;
    const now = Date.now();
    await seedOutbox([
      // SM-F04-01 — 12 DLQ (la matinée d'astreinte ; le check dlq24h n'expose
      // son deep-link qu'au-delà de 10) + un fond de delivered.
      ...Array.from({ length: 12 }, (_, i) => ({
        id: `${P}dlq-${i}`,
        status: 'dlq' as const,
        template: 'order-confirm',
        toEmail: `${P}dlq-${i}@cliente.test`,
        attempts: 5,
        lastError: 'SMTP 550 mailbox unavailable',
        scheduledFor: FUTURE,
        createdAt: new Date(now - i * 1000),
      })),
      ...Array.from({ length: 8 }, (_, i) => ({
        id: `${P}ok-${i}`,
        status: 'delivered' as const,
        deliveredAt: new Date(now),
        createdAt: new Date(now - i * 1000),
        scheduledFor: FUTURE,
      })),
      // SM-F04-02 — le domaine pourri : 4 échecs vers @bad.tld.
      ...BAD_EMAILS.map((email, i) => ({
        id: `${P}bad-${i}`,
        status: 'failed' as const,
        toEmail: email,
        lastError: 'SMTP 550 domain blacklisted',
        scheduledFor: FUTURE,
        createdAt: new Date(now - i * 1000),
      })),
      // SM-F04-03 — l'enquête client : adresse SUPPRESSÉE (le deep-link
      // suppression du détail ne se rend que sur ce statut) avec timeline.
      {
        id: `${P}client-0`,
        status: 'suppressed' as const,
        toEmail: CLIENT_EMAIL,
        toName: 'Kaoutar Benani',
        template: 'order-confirm',
        lastError: 'hard bounce → suppression',
        scheduledFor: FUTURE,
        createdAt: new Date(now),
      },
      // SM-F04-04 — 2 échecs dédiés au test du filtre fautif (E-002 passe les
      // lignes @bad.tld en 'suppressed' avant E-004 — il faut des failed à soi).
      ...[0, 1].map((i) => ({
        id: `${P}warn-${i}`,
        status: 'failed' as const,
        lastError: 'SMTP 451 temporary failure',
        scheduledFor: FUTURE,
        createdAt: new Date(now - i * 1000),
      })),
      // SM-F04-06 — 2 envois figés en 'sending' depuis 2 h (crash de déploiement).
      ...[0, 1].map((i) => ({
        id: `${P}stuck-${i}`,
        status: 'sending' as const,
        attempts: 1,
        scheduledFor: FUTURE,
        createdAt: new Date(now - 2 * 3_600_000),
      })),
    ]);
    await seedEvents([
      { outboxId: `${P}client-0`, type: 'sent', ts: new Date(now - 60_000), source: 'app' },
      { outboxId: `${P}client-0`, type: 'bounced_hard', ts: new Date(now), source: 'stalwart' },
    ]);
  });

  test.afterAll(async () => {
    await cleanupE2eRows([], P);
    await cleanupSavedViewsByPrefix('e2e-');
    for (const e of BAD_EMAILS) await deleteSuppression(e);
    await closeE2eSql();
  });

  // ── F04-E-001 — SM-F04-01 : matinée d'astreinte, du signal à la file assainie.
  test('F04-E-001 — dashboard → deep-link santé → DLQ → retry global → file assainie', async ({
    page,
  }) => {
    await test.step("1. Le dashboard signale l'incident (DLQ 24h : 12)", async () => {
      await page.goto('/admin/emails');
      await page
        .locator('details > summary')
        .filter({ hasText: /Système OK|Dégradé|Incident/ })
        .click();
      await expect(page.getByText(/DLQ 24h : 12/)).toBeVisible();
    });

    await test.step('2. Deep-link santé → cockpit pré-filtré AVEC contexte', async () => {
      await page.getByRole('link', { name: /Voir la DLQ/i }).click();
      await expect(page).toHaveURL(/transactional\?.*status=dlq/);
      await expect(page.getByTestId('health-context-banner')).toBeVisible();
      // Les lignes de l'incident sont rendues (échantillon).
      for (const i of [0, 5, 11]) {
        await expect(page.getByTestId(`row-${P}dlq-${i}`)).toBeVisible();
      }
    });

    await test.step('3. Sélection de la page + retry en masse, feedback honnête', async () => {
      await page.getByLabel('Sélectionner tout').check();
      await expect(page.getByTestId('selection-count')).toContainText('12');
      await page.getByRole('button', { name: /Retry \(12\)/i }).click();
      await expect(page.getByTestId('bulk-action-feedback')).toContainText(/12 relanc/i, {
        timeout: 10_000,
      });
    });

    await test.step("4. La file s'assainit (oracle différé, sans sleep)", async () => {
      await expect(async () => {
        await page.goto('/admin/emails/transactional?status=dlq');
        await expect(
          page.getByText(/Aucun email ne correspond à ces filtres/),
        ).toBeVisible({ timeout: 5_000 });
      }).toPass({ timeout: 20_000 });
    });

    await test.step('5. Retour dashboard : le check DLQ est retombé à 0', async () => {
      await page.goto('/admin/emails');
      await page
        .locator('details > summary')
        .filter({ hasText: /Système OK|Dégradé|Incident/ })
        .click();
      await expect(page.getByText(/DLQ 24h : 0/)).toBeVisible();
    });
  });

  // ── F04-E-002 — SM-F04-02 : domaine pourri → export CSV preuve → suppression.
  test('F04-E-002 — filtre to:@bad.tld → export CSV daté → adresses bloquées', async ({
    page,
  }) => {
    await test.step('1. Filtrer la population *@bad.tld (glob de la grammaire)', async () => {
      await gotoCockpit(page, `?to=${encodeURIComponent('*@bad.tld')}`);
      for (const i of [0, 1, 2, 3]) {
        await expect(page.getByTestId(`row-${P}bad-${i}`)).toBeVisible();
      }
    });

    await test.step('2. Export CSV de la sélection (preuve datée)', async () => {
      await page.getByLabel('Sélectionner tout').check();
      await expect(page.getByTestId('selection-count')).toContainText('4');
      const bar = page.locator('[aria-label="Actions sur la sélection"]');
      const downloadP = page.waitForEvent('download');
      await bar.getByRole('button', { name: /Exporter CSV/ }).click();
      const download = await downloadP;
      // Nom de fichier DATÉ (emails-transactionnels-YYYY-MM-DD.csv).
      expect(download.suggestedFilename()).toMatch(
        /emails-transactionnels-\d{4}-\d{2}-\d{2}\.csv/,
      );
    });

    await test.step('3. Suppression en masse (confirm natif encore en place — TRV-01 cockpit, dette suivie)', async () => {
      page.once('dialog', (d) => d.accept());
      const bar = page.locator('[aria-label="Actions sur la sélection"]');
      await bar.getByRole('button', { name: /Marquer en suppression/ }).click();
      await expect(page.getByTestId('bulk-action-feedback')).toContainText(
        /4 mis en suppression/,
        { timeout: 10_000 },
      );
    });

    await test.step('4. Oracle DB : les 4 adresses sont en liste de suppression', async () => {
      await expect
        .poll(
          async () => {
            let n = 0;
            for (const e of BAD_EMAILS) n += await countSuppression(e);
            return n;
          },
          { timeout: 10_000 },
        )
        .toBe(4);
    });
  });

  // ── F04-E-003 — SM-F04-03 : enquête client → détail → timeline → suppression.
  test('F04-E-003 — recherche → détail → timeline lisible → deep-link suppression', async ({
    page,
  }) => {
    await test.step('1. Retrouver la cliente par adresse', async () => {
      await gotoCockpit(page, `?to=${encodeURIComponent(CLIENT_EMAIL)}`);
      await expect(page.getByTestId(`row-${P}client-0`)).toBeVisible();
    });

    await test.step('2. Ouvrir le détail : timeline pédagogique', async () => {
      await page.getByTestId(`row-${P}client-0`).locator('td button').first().click();
      await expect(page).toHaveURL(new RegExp(`/transactional/${P}client-0`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      await expect(page.getByText('Métadonnées')).toBeVisible();
      // Timeline : les 2 événements seedés + la légende des sources.
      await expect(page.getByTestId('timeline-legend')).toContainText('webhook Stalwart');
      await expect(page.locator('[data-testid^="timeline-source-"]').first()).toBeVisible();
    });

    await test.step('3. Deep-link suppression depuis le détail', async () => {
      await page.getByTestId('suppression-deeplink').click();
      await expect(page).toHaveURL(/\/admin\/emails\/suppression\?email=/);
      await expect(
        page.getByRole('heading', { name: 'Liste de suppression' }),
      ).toBeVisible();
    });
  });

  // ── F04-E-004 — SM-F04-04 : faute de frappe dans la grammaire → warning + filtres valides appliqués.
  test('F04-E-004 — filtre fautif : warning visible, les filtres VALIDES s\'appliquent', async ({
    page,
  }) => {
    // `status:dlq` valide + `attempts:beaucoup` invalide (grammaire >N/<N/=N).
    await gotoCockpit(page, '?status=failed&attempts=beaucoup');
    const errors = page.getByTestId('filter-parse-errors');
    await expect(errors).toBeVisible();
    await expect(errors).toContainText(/« beaucoup » ignoré — attendu : >N, <N, =N/);
    // Le filtre VALIDE est appliqué (lignes failed seulement).
    await expect(page.getByTestId(`row-${P}warn-0`)).toBeVisible();
    const badges = page.locator('[data-testid^="row-"] [data-status]');
    const statuses = await badges.evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-status') ?? ''),
    );
    expect(statuses.length).toBeGreaterThan(0);
    for (const s of statuses) expect(s).toBe('failed');
  });

  // ── F04-E-005 — SM-F04-05 : vue d'équipe créée, appliquée, restituée après reload.
  test('F04-E-005 — créer une vue, recharger, la vue restitue ses filtres', async ({
    page,
  }) => {
    await test.step('1. Construire le filtre puis « + Nouvelle vue » (sidebar)', async () => {
      await gotoCockpit(page, '?status=failed');
      await page.getByTestId('create-view-btn').click();
      const form = page.getByTestId('create-view-form');
      await expect(form).toBeVisible();
      await form.locator('#create-view-name').fill('e2e-vue-echecs');
      await form.getByRole('button', { name: /Créer|Enregistrer/i }).click();
      await expect(page.getByText('e2e-vue-echecs').first()).toBeVisible({ timeout: 10_000 });
    });

    await test.step('2. Reload neutre puis appliquer la vue', async () => {
      await gotoCockpit(page); // sans filtre
      await page.getByText('e2e-vue-echecs', { exact: false }).first().click();
      // La vue ré-applique status:failed : toutes les lignes rendues sont failed.
      await expect(page.locator('[data-testid^="row-"] [data-status]').first()).toBeVisible();
      const statuses = await page
        .locator('[data-testid^="row-"] [data-status]')
        .evaluateAll((els) => els.map((el) => el.getAttribute('data-status') ?? ''));
      for (const s of statuses) expect(s).toBe('failed');
    });
  });

  // ── F04-E-006 — SM-F04-06 : reap après crash → la file est assainie.
  test('F04-E-006 — « Libérer les envois bloqués » re-met en file les sending figés', async ({
    page,
  }) => {
    await gotoCockpit(page, '?status=sending');
    await expect(page.getByTestId(`row-${P}stuck-0`)).toBeVisible();

    page.once('dialog', (d) => d.accept()); // confirm natif (cockpit, dette TRV-01)
    await page.getByRole('button', { name: /Libérer les envois bloqués/i }).click();

    // Feedback honnête : N libérés → re-mis en file (ou DLQ si plafond).
    await expect(page.getByText(/libéré.*re-mis en file/i)).toBeVisible({ timeout: 10_000 });

    // Oracle DB : les 2 figés ne sont plus 'sending' (pending, attempts+1).
    await expect
      .poll(
        async () => {
          const map = await readOutboxByIds([`${P}stuck-0`, `${P}stuck-1`]);
          return [...map.values()].every((r) => r.status === 'pending');
        },
        { timeout: 10_000 },
      )
      .toBe(true);
  });

  // ── F04-A-001/002 — axe Playwright (rendu réel).
  test('F04-A-001 — axe cockpit : 0 violation serious/critical', async ({ page }) => {
    test.setTimeout(90_000); // l'analyse axe-core peut dépasser 30 s sur page dense
    await gotoCockpit(page);
    await expectNoSeriousAxeViolations(page, 'cockpit /admin/emails/transactional');
  });

  test('F04-A-002 — axe détail + timeline : 0 violation serious/critical', async ({
    page,
  }) => {
    test.setTimeout(90_000); // l'analyse axe-core peut dépasser 30 s sur page dense
    await page.goto(`/admin/emails/transactional/${P}client-0`);
    await expect(page.getByText('Métadonnées')).toBeVisible();
    await expectNoSeriousAxeViolations(page, 'détail transactionnel');
  });
});
