/**
 * F08 — audiences, gate de phase P2 (serveur :3100, DB femiglow_test_e2e) :
 * F08-E-098/099/100 + F08-A-101/102 (scénarios SM-F08-01/02/03).
 *
 * Persona : Salma, responsable CRM (non technique — raisonne en MAD et en
 * pays). Oracles = ce qu'elle LIT. Seeds par helpers DB, préfixes e2e-f08-.
 */
import { test, expect, type Page } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from './helpers/auth';
import { expectNoSeriousAxeViolations } from './_helpers/axe-e2e';
import {
  seedLeads,
  cleanupLeadsByPrefix,
  seedAudience,
  seedAudienceSnapshot,
  cleanupAudiencesBySlugPrefix,
  closeE2eSql,
} from './_helpers/emails-db';

const LEAD_P = 'e2e-f08-lead-';
const SLUG_P = 'e2e-f08-';

const CONSENT_RULES = {
  kind: 'all',
  conditions: [{ kind: 'email_pattern', operator: 'contains', value: '@e2e-f08.test' }],
};

/** Étape 1 → étape 2 du wizard de création. */
async function gotoWizardStep2(page: Page, name: string): Promise<void> {
  await page.goto('/admin/emails/audiences/new');
  await page.getByTestId('name-input').fill(name);
  await page.getByTestId('next-btn').click();
  await expect(page.getByTestId('rules-group-0')).toBeVisible();
}

test.describe('F08 — audiences (gate P2) @emails-f08', () => {
  test.use({ storageState: ADMIN_STORAGE_PATH });
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    await cleanupAudiencesBySlugPrefix(SLUG_P);
    await cleanupLeadsByPrefix(LEAD_P);
    // 12 leads MA consentantes à 2 commandes entre 100 et 500 MAD (cents) —
    // la cible de SM-F08-01 ; + 2 FR et 1 sans téléphone (hors cible).
    await seedLeads([
      ...Array.from({ length: 12 }, (_, i) => ({
        id: `${LEAD_P}ma-${i}`,
        email: `ma${i}@e2e-f08.test`,
        phone: `+2126000000${String(i).padStart(2, '0')}`,
        consentMarketing: true,
        orders: [15000, 20000], // 150 + 200 MAD → total 350 MAD ∈ [100, 500]
      })),
      ...Array.from({ length: 2 }, (_, i) => ({
        id: `${LEAD_P}fr-${i}`,
        email: `fr${i}@e2e-f08.test`,
        phone: `+33600000${String(i).padStart(3, '0')}`,
        consentMarketing: true,
        orders: [15000, 20000],
      })),
      {
        id: `${LEAD_P}nophone`,
        email: `nophone@e2e-f08.test`,
        phone: null,
        consentMarketing: true,
        orders: [15000, 20000],
      },
    ]);
  });

  test.afterAll(async () => {
    await cleanupAudiencesBySlugPrefix(SLUG_P);
    await cleanupLeadsByPrefix(LEAD_P);
    await closeE2eSql();
  });

  // ── F08-E-098 — SM-F08-01 : le segment promo, erreurs corrigées en route.
  test('F08-E-098 — segment « clientes fidèles » : chips pays, bornes inversées corrigées, audience non vide', async ({
    page,
  }) => {
    await test.step('1. Métadonnées (slug auto)', async () => {
      await gotoWizardStep2(page, 'E2E f08 clientes fidèles');
      // (slug auto e2e-f08-clientes-fideles — préfixe de cleanup)
    });

    await test.step('1bis. Périmètre du seed (email contient @e2e-f08.test — isolation DB partagée)', async () => {
      await page.getByTestId('add-rule-btn').click();
      await page.getByTestId('add-rule-email_pattern').click();
      await page
        .getByTestId('rule-editor-email_pattern')
        .getByLabel('Valeur')
        .fill('@e2e-f08.test');
    });

    await test.step('2. Pays parmi {MA, FR} puis retrait de la chip FR', async () => {
      await page.getByTestId('add-rule-btn').click();
      await page.getByTestId('add-rule-country').click();
      await page
        .getByTestId('rule-editor-country')
        .getByLabel('Opérateur')
        .selectOption('in'); // eq → in, sans dialog (sans perte)
      await page.getByTestId('country-add-select').selectOption('FR');
      await expect(page.getByTestId('country-chip-MA')).toBeVisible();
      await expect(page.getByTestId('country-chip-FR')).toBeVisible();
      await page.getByTestId('country-remove-FR').click();
      await expect(page.getByTestId('country-chip-FR')).not.toBeVisible();
    });

    await test.step('3. Total dépensé entre 500 et 100 → erreur → « Inverser les bornes »', async () => {
      await page.getByTestId('add-rule-btn').click();
      await page.getByTestId('add-rule-order_total').click();
      const editor = page.getByTestId('rule-editor-order_total');
      await editor.getByLabel('Opérateur').selectOption('between');
      await editor.getByTestId('num-between-lo').fill('500');
      await editor.getByTestId('num-between-hi').fill('100');
      const err = page.getByTestId('between-error');
      await expect(err).toBeVisible();
      await expect(err).toContainText('La borne basse doit être ≤ la borne haute');
      await page.getByTestId('swap-bounds').click();
      await expect(page.getByTestId('between-error')).not.toBeVisible();
      await expect(editor.getByTestId('num-between-lo')).toHaveValue('100');
      await expect(editor.getByTestId('num-between-hi')).toHaveValue('500');
    });

    await test.step('4. Nombre de commandes ≥ 2 ; le combinateur ET est lisible', async () => {
      await page.getByTestId('add-rule-btn').click();
      await page.getByTestId('add-rule-order_count').click();
      const editor = page.getByTestId('rule-editor-order_count');
      await editor.getByTestId('num-value').fill('2');
      await expect(page.getByTestId('toggle-combinator')).toHaveText('ET (toutes)');
    });

    await test.step("5. L'aperçu compte la cible (12 MA, pas les FR ni la sans-téléphone)", async () => {
      const count = page.getByTestId('preview-count');
      await expect(count).toBeVisible({ timeout: 15_000 });
      await expect(count).toContainText('12 contacts');
    });

    await test.step("6. Mode recommandé, création, redirection détail non vide", async () => {
      await page.getByTestId('next-btn').click();
      await expect(page.getByText('Récapitulatif')).toBeVisible();
      await expect(page.getByTestId('eval-mode-dynamic-detail')).toContainText(
        /au moment du send/,
      );
      await page.getByTestId('submit-btn').click();
      await expect(page).toHaveURL(/\/admin\/emails\/audiences\/[0-9a-f-]{36}$/, {
        timeout: 15_000,
      });
      // Détail : count live non vide + restitution FR lisible.
      await expect(page.getByTestId('live-count')).toContainText('12');
      await expect(page.getByTestId('rules-readable')).toContainText('🇲🇦 Maroc');
      await expect(page.getByTestId('rules-readable')).toContainText(
        'entre 100 MAD et 500 MAD',
      );
      // Hint R-011 présent (règle pays).
      await expect(page.getByTestId('country-hint')).toBeVisible();
    });
  });

  // ── F08-E-099 — SM-F08-02 : snapshot périmé détecté avant l'envoi.
  test('F08-E-099 — drift > 10 % détecté → re-snapshoter assainit', async ({ page }) => {
    let audienceId = '';
    await test.step('Seed : snapshot J-21 size=1100, live réel = 12', async () => {
      audienceId = await seedAudience({
        slug: `${SLUG_P}drift`,
        name: 'E2E f08 drift',
        rules: CONSENT_RULES, // matche les 15 leads e2e-f08 ? non : tous les @e2e-f08.test = 15
      });
      await seedAudienceSnapshot({
        audienceId,
        size: 1100,
        createdAt: new Date(Date.now() - 21 * 86_400_000),
        rules: CONSENT_RULES,
      });
    });

    await test.step("1. La ligne affiche l'âge, l'écart et le bandeau > 10 %", async () => {
      await page.goto(`/admin/emails/audiences/${audienceId}`);
      await expect(page.getByText(/créé il y a 21 j/)).toBeVisible();
      // live = 15 leads @e2e-f08.test ; size figé 1100 → ▼ −1085 (−99 %).
      await expect(page.getByText(/▼ −1[\s ]?085/)).toBeVisible();
      const banner = page.getByTestId('drift-banner');
      await expect(banner).toBeVisible();
      await expect(banner).toContainText("Écart > 10 % avec l'audience live");
    });

    await test.step('2. re-snapshoter → nouveau snapshot done à la taille live, bandeau éteint', async () => {
      await page.getByTestId('drift-resnapshot').click();
      // Le snapshot manuel est synchrone côté route → après refresh, le
      // dernier done est à la taille live et le drift retombe (bandeau éteint).
      await expect(async () => {
        await page.goto(`/admin/emails/audiences/${audienceId}`);
        await expect(page.getByText(/= à jour/).first()).toBeVisible({ timeout: 5_000 });
        await expect(page.getByTestId('drift-banner')).toHaveCount(0);
      }).toPass({ timeout: 30_000 });
    });
  });

  // ── F08-E-100 — SM-F08-03 : le tag VIP est neutralisé et EXPLIQUÉ.
  test('F08-E-100 — tags grisés au menu ; règle legacy bloquée puis retirée', async ({
    page,
  }) => {
    let legacyId = '';
    await test.step('Seed : audience legacy not_has_tag=vip', async () => {
      legacyId = await seedAudience({
        slug: `${SLUG_P}non-vip`,
        name: 'E2E f08 non-vip',
        rules: {
          kind: 'all',
          conditions: [
            { kind: 'not_has_tag', tag: 'vip' },
            { kind: 'consent_marketing', value: true },
          ],
        },
      });
    });

    await test.step('1. Le menu grise les 2 items tag (un clic ne fait rien)', async () => {
      await gotoWizardStep2(page, 'E2E f08 tentative vip');
      await page.getByTestId('add-rule-btn').click();
      for (const kind of ['has_tag', 'not_has_tag']) {
        const item = page.getByTestId(`add-rule-${kind}`);
        await expect(item).toBeDisabled();
        await expect(item).toContainText('bientôt — M5.5');
      }
      // Clic forcé sans effet : aucune règle tag n'apparaît.
      await page.getByTestId('add-rule-has_tag').click({ force: true });
      await expect(page.getByTestId('rule-editor-has_tag')).toHaveCount(0);
    });

    await test.step('2. La règle legacy porte la bannière et bloque Continuer', async () => {
      // Ouvre l'audience legacy en édition → étape 2.
      await page.goto(`/admin/emails/audiences/${legacyId}/edit`);
      await expect(page.getByTestId('name-input')).toHaveValue('E2E f08 non-vip');
      await page.getByTestId('next-btn').click();
      const banner = page.getByTestId('tag-rule-banner');
      await expect(banner).toBeVisible();
      await expect(banner).toContainText('Critère inactif');
      await expect(banner).toContainText('ne cible actuellement AUCUN contact');

      await page.getByTestId('next-btn').click();
      await expect(page.getByTestId('rules-error')).toContainText(
        'Une règle « tag » est inactive (M5.5 non livré). Retirez-la pour continuer.',
      );
      await expect(page.getByText('Récapitulatif')).not.toBeVisible();
    });

    await test.step('3. ✕ sur la règle tag → bannière éteinte, Continuer débloqué', async () => {
      await page
        .getByTestId('rule-editor-not_has_tag')
        .getByTestId('remove-rule')
        .click();
      await expect(page.getByTestId('tag-rule-banner')).toHaveCount(0);
      await page.getByTestId('next-btn').click();
      await expect(page.getByText('Récapitulatif')).toBeVisible();
    });
  });

  // ── F08-A-101/102 — axe Playwright (rendu réel).
  test('F08-A-101 — axe wizard étape critères : 0 violation serious/critical', async ({
    page,
  }) => {
    test.setTimeout(90_000); // l'analyse axe-core peut dépasser 30 s sur page dense
    await gotoWizardStep2(page, 'E2E f08 axe');
    // Un builder non vide (entre + chips) pour auditer les éditeurs réels.
    await page.getByTestId('add-rule-btn').click();
    await page.getByTestId('add-rule-country').click();
    await page.getByTestId('add-rule-btn').click();
    await page.getByTestId('add-rule-order_total').click();
    await expectNoSeriousAxeViolations(page, 'wizard audiences étape 2');
  });

  test('F08-A-102 — axe page détail audience : 0 violation serious/critical', async ({
    page,
  }) => {
    test.setTimeout(90_000); // l'analyse axe-core peut dépasser 30 s sur page dense
    const audienceId = await seedAudience({
      slug: `${SLUG_P}axe-detail`,
      name: 'E2E f08 axe détail',
      rules: {
        kind: 'all',
        conditions: [{ kind: 'country', operator: 'eq', value: 'MA' }],
      },
    });
    await seedAudienceSnapshot({ audienceId, size: 12, rules: CONSENT_RULES });
    await page.goto(`/admin/emails/audiences/${audienceId}`);
    await expect(page.getByTestId('snapshots-panel')).toBeVisible();
    await expectNoSeriousAxeViolations(page, 'détail audience');
  });
});
