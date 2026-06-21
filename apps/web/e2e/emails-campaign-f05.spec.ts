/**
 * SM-F05-01 — « Campagne de A à Z avec épreuve » (F05-E-001).
 *
 * Parcours : un draft seedé à l'étape 6 (Vérif) → on envoie une ÉPREUVE
 * (test-send) à Salma → Mailpit la capte → on confirme (ack chiffré) →
 * « Envoyer maintenant » → le détail affiche le statut **sending**.
 *
 * ── VERROU INFRA (lis-moi avant d'exécuter) ──────────────────────────────
 * TOUS les oracles de ce scénario passent par Listmonk :
 *   - le test-send (`sendCampaignTest`) appelle `listmonk.transactional.send`
 *     (Listmonk relaie en SMTP → Mailpit) — ce n'est PAS un envoi SMTP direct ;
 *   - la finalisation (`finalizeCampaign`) crée + démarre une campagne Listmonk.
 * Il faut donc un Listmonk e2e DÉDIÉ, configuré pour relayer en SMTP vers Mailpit
 * (127.0.0.1:1025), pointé par `LISTMONK_INTERNAL_URL`, avec un template d'id
 * `E2E_LISTMONK_TEMPLATE_ID` (défaut 1).
 *
 * ⚠️ NE JAMAIS pointer `LISTMONK_INTERNAL_URL` sur le Listmonk de PROD
 * (`listmonk.service`, :9000) : la finalisation y créerait une vraie campagne et
 * un vrai envoi de masse. Le défaut `.env` du worktree (:9999, mort) est un
 * garde-fou volontaire : sans Listmonk e2e joignable, ce spec SE SKIP
 * proprement (jamais de faux rouge, jamais de fuite vers la prod).
 *
 * Préconditions infra : serveur :3100 (PLAYWRIGHT_BASE_URL) sur femiglow_test_e2e,
 * Mailpit up, Listmonk e2e up. États initiaux posés en DB (helpers), pas via l'UI.
 */
import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from './helpers/auth';
import { readLastEmail, clearMailbox } from './_helpers/mailpit';
import {
  seedAudience,
  seedAudienceSnapshot,
  seedCampaign,
  readCampaign,
  cleanupAudiencesBySlugPrefix,
  cleanupCampaignsByIdPrefix,
  closeE2eSql,
} from './_helpers/emails-db';

const PREFIX = 'e2e-f05-';
const CAMPAIGN_ID = `${PREFIX}newsletter-juin`;
const AUDIENCE_SLUG = `${PREFIX}newsletter`;
const SALMA = 'salma@femiglow-maroc.com';
const SUBJECT = '✨ Rituels de juin';
// Template Listmonk requis par le test-send (template_id). À créer côté Listmonk
// e2e ; surchargeable via l'env si l'instance utilise un autre id.
const LISTMONK_TEMPLATE_ID = Number(process.env.E2E_LISTMONK_TEMPLATE_ID ?? '1');

/**
 * Sonde la joignabilité du Listmonk e2e (sans secret). Retourne `true` seulement
 * si l'endpoint répond — un :9999 mort (défaut worktree) renvoie false → skip.
 */
async function listmonkReachable(): Promise<boolean> {
  const base = process.env.LISTMONK_INTERNAL_URL;
  if (!base) return false;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 2500);
  try {
    // /api/health existe sur Listmonk ; tout statut HTTP (même 401/403) prouve
    // que le service répond. Seule une erreur réseau (service mort) → false.
    await fetch(`${base.replace(/\/$/, '')}/api/health`, { signal: ctrl.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

test.describe('SM-F05-01 — campagne de A à Z avec épreuve @emails-campaign', () => {
  test.describe.configure({ mode: 'serial' });
  test.use({ storageState: ADMIN_STORAGE_PATH });

  test.afterAll(async () => {
    await cleanupCampaignsByIdPrefix(PREFIX);
    await cleanupAudiencesBySlugPrefix(PREFIX);
    await closeE2eSql();
  });

  test('F05-E-001 : épreuve reçue dans Mailpit, puis envoi → statut sending', async ({
    page,
    request,
  }) => {
    test.skip(
      !(await listmonkReachable()),
      'Listmonk e2e injoignable (LISTMONK_INTERNAL_URL) — SM-F05-01 a besoin de Listmonk ' +
        '(test-send + finalize). Lève un Listmonk e2e relayant en SMTP vers Mailpit ; ' +
        'ne JAMAIS pointer sur la prod :9000.',
    );

    // 1) État initial en DB : audience native « Newsletter » + snapshot ~1234,
    //    et un draft posé à l'étape 6 (audience/template/sujet déjà saisis).
    await cleanupCampaignsByIdPrefix(PREFIX);
    await cleanupAudiencesBySlugPrefix(PREFIX);
    await clearMailbox(request);

    const audienceId = await seedAudience({
      slug: AUDIENCE_SLUG,
      name: 'Newsletter',
      rules: { kind: 'all', conditions: [{ kind: 'consent_marketing', value: true }] },
    });
    await seedAudienceSnapshot({ audienceId, size: 1234, rules: { kind: 'all', conditions: [] } });
    await seedCampaign({
      id: CAMPAIGN_ID,
      status: 'draft',
      name: 'Newsletter juin',
      subject: SUBJECT,
      preheader: 'Ton rituel du mois',
      wizardStep: 6,
      audienceId,
      listmonkTemplateId: LISTMONK_TEMPLATE_ID,
      body: '<p>Bonjour, voici les rituels de juin.</p>',
    });

    // 2) Ouvrir le wizard → il rouvre à l'étape 6 (Vérif).
    await page.goto(`/admin/emails/campaigns/${CAMPAIGN_ID}/edit`);
    await expect(page.getByRole('checkbox')).toBeVisible(); // ack de l'étape 6

    // 3) Envoyer une ÉPREUVE à Salma.
    await page.getByRole('combobox', { name: 'Adresse e-mail du test' }).fill(SALMA);
    await page.getByRole('button', { name: 'Envoyer le test' }).click();
    await expect(page.getByText(/Épreuve envoyée/i)).toBeVisible();

    // Oracle Mailpit : l'épreuve arrive pour Salma avec le bon sujet.
    const mail = await readLastEmail(request, SALMA, { timeout: 15_000 });
    expect(mail.To.map((t) => t.Address)).toContain(SALMA);
    expect(mail.Subject).toContain('Rituels de juin');

    // 4) Confirmer (ack chiffré) puis « Envoyer maintenant ».
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: /Envoyer maintenant/i }).click();

    // 5) Redirect détail → statut « En cours d'envoi » (Pill sending).
    await page.waitForURL(`**/admin/emails/campaigns/${CAMPAIGN_ID}`);
    await expect(page.getByText(/En cours d’envoi/i)).toBeVisible();

    // Oracle DB : la campagne est passée en sending et porte un id Listmonk.
    await expect
      .poll(async () => (await readCampaign(CAMPAIGN_ID))?.status, {
        timeout: 10_000,
        message: 'la campagne doit passer à sending après finalize',
      })
      .toBe('sending');
    expect((await readCampaign(CAMPAIGN_ID))?.listmonk_campaign_id).toBeTruthy();
  });
});
