/**
 * Phase 6 E2E — Page publique de désinscription one-click (RFC 8058).
 *
 * Chemin RÉEL :
 *   token signé HMAC (généré côté spec, même algo que la lib)
 *     → GET /api/mail/unsubscribe?t=<token>
 *       → page de confirmation digne (200, message clair)
 *         → oracle DB : email_suppression(reason='unsubscribe') posé
 *           → 2e visite : idempotente (toujours 200, une seule ligne).
 *
 * Oracles (cf. chantier D §4) :
 *  - UNSUB-01 : la page publique confirme la désinscription (pas un 4xx/5xx,
 *    message lisible).
 *  - UNSUB-02 : la suppression est RÉELLEMENT posée en base (reason/source).
 *  - UNSUB-03 : idempotence — 2e visite OK, toujours exactement 1 ligne.
 *  - UNSUB-04 : token invalide → page "Lien invalide" digne (400, pas de crash).
 *
 * Oracle métier : un lien de désinscription est une obligation légale ; il DOIT
 * fonctionner du premier coup, être rejouable sans erreur, et poser réellement
 * la suppression (sinon on continue d'écrire à quelqu'un qui s'est désinscrit).
 *
 * MAIL_UNSUB_TOKEN_SECRET est lu depuis process.env (chargé par
 * playwright.config.ts) et n'est JAMAIS affiché.
 */
import { test, expect } from '@playwright/test';
import { generateUnsubTokenE2e } from './_helpers/unsub-token';
import {
  countSuppression,
  readSuppression,
  deleteSuppression,
  closeE2eSql,
} from './_helpers/emails-db';

const UNSUB_EMAIL = 'e2e-unsub-cliente@exemple.test';

test.describe('Phase 6 — désinscription publique one-click @emails-unsubscribe', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    await deleteSuppression(UNSUB_EMAIL);
  });

  test.afterAll(async () => {
    await deleteSuppression(UNSUB_EMAIL);
    await closeE2eSql();
  });

  test('UNSUB — token signé → page confirme → DB suppression posée → idempotent', async ({
    page,
    request,
  }) => {
    const secret = process.env.MAIL_UNSUB_TOKEN_SECRET;
    expect(
      secret,
      'MAIL_UNSUB_TOKEN_SECRET doit être chargé depuis .env',
    ).toBeTruthy();

    const token = generateUnsubTokenE2e(UNSUB_EMAIL);

    // UNSUB-01 — la page publique confirme la désinscription (200 + message).
    const res = await page.goto(
      `/api/mail/unsubscribe?t=${encodeURIComponent(token)}`,
    );
    expect(res?.status()).toBe(200);
    await expect(
      page.getByRole('heading', { name: /Désinscription confirmée/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/plus de communications marketing/i),
    ).toBeVisible();

    // UNSUB-02 — la suppression est RÉELLEMENT posée en base.
    const row = await readSuppression(UNSUB_EMAIL);
    expect(row, 'une ligne email_suppression doit exister').not.toBeNull();
    expect(row!.reason).toBe('unsubscribe');
    expect(row!.source).toBe('manual');
    expect(await countSuppression(UNSUB_EMAIL)).toBe(1);

    // UNSUB-03 — idempotence : 2e visite (même token) → toujours 200, et la
    // base ne contient TOUJOURS qu'une seule ligne (onConflictDoNothing).
    const res2 = await request.get(
      `http://127.0.0.1:8013/api/mail/unsubscribe?t=${encodeURIComponent(token)}`,
    );
    expect(res2.status()).toBe(200);
    expect(
      await countSuppression(UNSUB_EMAIL),
      'la 2e désinscription ne doit PAS dupliquer la ligne',
    ).toBe(1);
  });

  // UNSUB-04 — token invalide → page "Lien invalide" digne (400), pas de crash.
  test('UNSUB-04 — token invalide → page Lien invalide (400, digne)', async ({
    page,
  }) => {
    // Isolation du témoin (UNSUB-01 a pu poser une suppression en serial).
    await deleteSuppression(UNSUB_EMAIL);
    const res = await page.goto(
      '/api/mail/unsubscribe?t=ceci-nest-pas-un-token-valide',
    );
    expect(res?.status()).toBe(400);
    await expect(
      page.getByRole('heading', { name: /Lien invalide/i }),
    ).toBeVisible();
    // Aucune suppression posée pour un token invalide (l'email n'est même pas
    // décodable) — on vérifie qu'on n'a rien créé pour notre adresse témoin.
    expect(await countSuppression(UNSUB_EMAIL)).toBe(0);
  });
});
