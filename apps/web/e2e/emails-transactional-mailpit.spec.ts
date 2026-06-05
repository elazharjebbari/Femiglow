/**
 * Phase 6 E2E — Transactionnel BOUT-EN-BOUT RÉEL (Mailpit).
 *
 * Chemin complet sans mock :
 *   seed 1 ligne outbox `pending` (snapshots HTML/text présents)
 *     → POST /api/cron/email-outbox (bearer = CRON_SECRET) déclenche le drain
 *       → le mailer SMTP envoie réellement vers Mailpit (127.0.0.1:1025)
 *         → on lit le mail capturé via l'API Mailpit.
 *
 * Oracles (cf. chantier D §3) :
 *  - MAILPIT-01 : Mailpit reçoit le mail ; sujet + destinataire EXACTS.
 *  - MAILPIT-02 : en-tête List-Unsubscribe présent, URL http portant `?t=`
 *    (token signé) et JAMAIS `?email=` (fuite PII + one-click cassé).
 *  - MAILPIT-03 : List-Unsubscribe-Post = One-Click (RFC 8058).
 *
 * Oracle métier : la promesse RGPD/délivrabilité (bouton de désinscription
 * natif fonctionnel) ne tient QUE si l'en-tête réellement émis par le pipeline
 * porte le token signé. Un test unitaire le vérifie déjà ; ici on prouve le
 * bout-en-bout serveur réel + SMTP réel.
 *
 * CRON_SECRET est lu depuis process.env (chargé par playwright.config.ts depuis
 * .env) — jamais affiché.
 */
import { test, expect } from '@playwright/test';
import { readLastEmail, clearMailbox } from './_helpers/mailpit';
import {
  seedOutbox,
  cleanupE2eRows,
  closeE2eSql,
  readOutboxRow,
  E2E_PREFIX,
} from './_helpers/emails-db';

const TO_EMAIL = 'e2e-mailpit-cliente@exemple.test';
const SUBJECT = 'E2E Mailpit — confirmation de votre rituel FemiGlow';
// Préfixe propre à CETTE spec → cleanup scopé (parallélisme inter-fichiers).
const MAILPIT_PREFIX = `${E2E_PREFIX}mailpit-`;
const OUTBOX_ID = `${MAILPIT_PREFIX}pending-1`;

test.describe('Phase 6 — transactionnel bout-en-bout (Mailpit) @emails-mailpit', () => {
  test.describe.configure({ mode: 'serial' });

  test.afterAll(async () => {
    await cleanupE2eRows([], MAILPIT_PREFIX);
    await closeE2eSql();
  });

  test('MAILPIT — pending → drain cron → Mailpit reçoit (sujet/dest + List-Unsubscribe ?t=)', async ({
    request,
  }) => {
    const cronSecret = process.env.CRON_SECRET;
    expect(
      cronSecret,
      'CRON_SECRET doit être chargé depuis .env par playwright.config.ts',
    ).toBeTruthy();

    // Isolation : nos lignes mailpit propres + boîte Mailpit vide (scopé au
    // préfixe pour ne pas toucher le seed d'une autre spec concurrente).
    await cleanupE2eRows([], MAILPIT_PREFIX);
    await clearMailbox(request);

    // 1) Seed une ligne pending prête à partir (snapshots requis par deliverRow).
    await seedOutbox([
      {
        id: OUTBOX_ID,
        status: 'pending',
        toEmail: TO_EMAIL,
        toName: 'Kaoutar Benani',
        subject: SUBJECT,
        nextRetry: null,
      },
    ]);

    // 2) Déclencher le drain via le cron RÉEL (bearer obligatoire).
    const res = await request.post('http://127.0.0.1:8013/api/cron/email-outbox', {
      headers: { authorization: `Bearer ${cronSecret}` },
    });
    expect(res.status(), 'le cron doit répondre 200 (drain ok)').toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      picked: number;
      succeeded: number;
    };
    expect(body.ok).toBe(true);
    // Au moins notre ligne a été ramassée et envoyée.
    expect(body.picked).toBeGreaterThanOrEqual(1);
    expect(body.succeeded).toBeGreaterThanOrEqual(1);

    // 3) Mailpit a capté le mail — sujet + destinataire EXACTS.
    const mail = await readLastEmail(request, TO_EMAIL, { timeout: 15_000 });
    // MAILPIT-01 — destinataire + sujet exacts.
    expect(mail.To.map((t) => t.Address)).toContain(TO_EMAIL);
    expect(mail.Subject).toBe(SUBJECT);

    // MAILPIT-02 — List-Unsubscribe : URL http avec `?t=`, sans `?email=`.
    const header = mail.ListUnsubscribe?.Header ?? '';
    expect(header, 'en-tête List-Unsubscribe doit être présent').toBeTruthy();
    const httpMatch = /<(https?:[^>]+)>/.exec(header);
    expect(httpMatch, 'List-Unsubscribe doit contenir une URL http').not.toBeNull();
    const httpUrl = new URL(httpMatch![1]!);
    expect(httpUrl.pathname).toBe('/api/mail/unsubscribe');
    expect(
      httpUrl.searchParams.get('t'),
      'token signé `t` requis (one-click RFC 8058)',
    ).toBeTruthy();
    expect(
      httpUrl.searchParams.get('email'),
      '`?email=` interdit (fuite PII + one-click cassé)',
    ).toBeNull();
    // La variante mailto reste présente (RFC 8058 recommande les deux).
    expect(header).toContain('<mailto:');

    // MAILPIT-03 — List-Unsubscribe-Post one-click.
    expect(mail.ListUnsubscribe?.HeaderPost).toContain('One-Click');

    // Oracle DB de cohérence : la ligne est passée en 'sent' et porte un
    // smtp_message_id (le pipeline a bien écrit l'état post-envoi).
    await expect
      .poll(async () => (await readOutboxRow(OUTBOX_ID))?.status, {
        timeout: 10_000,
        message: 'la ligne outbox doit passer à sent après drain',
      })
      .toBe('sent');
    const finalRow = await readOutboxRow(OUTBOX_ID);
    expect(finalRow?.smtp_message_id).toBeTruthy();
  });
});
