// @vitest-environment node
/**
 * CHANTIER C — PHASE 7, SCÉNARIO MÉTIER S2 : INCIDENT BOUNCE HARD.
 *
 * Enchaîne les modules 07 (send transactionnel), 08 (outbox/drain SMTP) et 09
 * (webhook Stalwart → bounce → suppression) sur UNE cliente réelle, bout en
 * bout, contre la VRAIE DB (femiglow_test_scenarios). C'est la répétition
 * générale d'un incident de prod : une adresse qui n'existe pas (550) reçoit un
 * email, le serveur SMTP le rejette en bounce permanent, et le système doit
 *   (a) marquer l'outbox `bounced_permanent`,
 *   (b) poser une suppression `hard_bounce`,
 *   (c) BLOQUER tout envoi ultérieur vers elle (RGPD + réputation),
 *   (d) ne le débloquer QUE par une réactivation explicite.
 *
 * AUCUNE modification de `src` : tout défaut découvert est consigné en
 * bugsFound (ces scénarios SONT le filet de détection).
 *
 * ── Pourquoi un SMTP mocké à messageId DÉTERMINISTE ? ─────────────────────
 * Le webhook Stalwart retrouve l'outbox par `smtp_message_id` (route.ts:146-150).
 * En prod c'est Stalwart qui génère le Message-ID ; ici on contrôle le mock pour
 * qu'il renvoie un messageId STABLE et CONNU (`<msg-<outboxId>@test>`), de sorte
 * qu'on puisse REJOUER un payload de bounce ciblé sur CETTE ligne — comme le
 * ferait Stalwart sur l'envoi réel.
 *
 * Lancement (DB dédiée) :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test_scenarios#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run --no-file-parallelism \
 *       src/test/scenarios/emails-s2-bounce.scenario.test.ts
 *
 * IDs scénario : S2-01 (envoi+drain), S2-02 (bounce→suppression),
 *   S2-03 (re-send bloqué), S2-04 (réactivation → l'envoi repart),
 *   S2-05 (constat métier : pas de surface admin de réactivation).
 */
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { eq, sql } from 'drizzle-orm';

// Le secret unsub n'est pas requis pour le bounce, mais sendTransactional
// l'utilise pour injecter l'URL unsub : on le pose AVANT les imports hoistés
// pour un rendu déterministe (le module env parse process.env à l'import).
vi.hoisted(() => {
  process.env.MAIL_UNSUB_TOKEN_SECRET ??= 'qa-s2-bounce-secret-0123456789abcdef';
  process.env.FEMIGLOW_STALWART_WEBHOOK_SECRET ??= 'qa-s2-stalwart-webhook-secret';
});

// Le rate-limit du webhook est auxiliaire — sans Redis il pourrait throw/bloquer.
// On le neutralise pour isoler l'oracle métier (bounce → suppression).
vi.mock('@/lib/mail/rate-limit', () => ({
  enforceMailRateLimit: vi.fn().mockResolvedValue(null),
}));

// SMTP mock à messageId DÉTERMINISTE : on connaît d'avance le smtp_message_id
// posé sur l'outbox, donc on peut cibler le webhook de bounce dessus.
// `sentTo` compte les adresses réellement « envoyées » (jamais une suppressée).
// eslint-disable-next-line no-var
var smtpSentTo: string[] = [];
vi.mock('@/lib/mail/client', () => ({
  SmtpNotConfiguredError: class extends Error {
    readonly code = 'SMTP_NOT_CONFIGURED';
  },
  getTransporter: () => ({
    sendMail: async (opts: { to?: string; headers?: Record<string, string> }) => {
      const id = opts.headers?.['X-FG-Outbox-Id'] ?? 'unknown';
      smtpSentTo.push(typeof opts.to === 'string' ? opts.to : id);
      return { messageId: `<msg-${id}@test>`, response: '250 OK' };
    },
  }),
}));

import { emailOutbox, emailEvent, emailSuppression } from '@/lib/db/schema-emails';
import { __setTestDb, __resetTestDb } from '@/lib/db/client';
import {
  closeTestDb,
  emailsTestDb,
  truncateEmailTables,
  describeEmailsDb,
} from '@/test/db/emails-db';
import { sendTransactional } from '@/lib/mail/send';
import { POST as stalwartWebhook } from '@/app/api/mail/webhook/stalwart/route';

const db = () => emailsTestDb();
const WEBHOOK_SECRET = 'qa-s2-stalwart-webhook-secret';

/**
 * Draine le fire-and-forget `attemptSend` déclenché par `sendTransactional`.
 * On attend la ligne `email_event` (écrite EN DERNIER par attemptSend après
 * l'UPDATE outbox→sent) : garantie que la tx de fond a COMMITÉ. Indispensable
 * contre le deadlock TRUNCATE (R-023). Retourne la ligne outbox finale.
 */
async function drainAndGet(outboxId: string) {
  await vi.waitFor(async () => {
    const ev = await db()
      .select({ id: emailEvent.id })
      .from(emailEvent)
      .where(eq(emailEvent.outboxId, outboxId));
    expect(ev.length).toBeGreaterThanOrEqual(1);
  });
  const [row] = await db().select().from(emailOutbox).where(eq(emailOutbox.id, outboxId));
  return row!;
}

/** POST réel du webhook Stalwart avec le header d'auth attendu (route.ts:55). */
function postBounce(messageId: string, errorCode = 550): Promise<Response> {
  const body = {
    event: 'delivery.failed' as const,
    queueId: 'q-bounce-1',
    messageId,
    rcpt: 'user-inexistante@exemple.test',
    errorCode,
    reason: '5.1.1 The email account that you tried to reach does not exist',
    ts: new Date().toISOString(),
  };
  const req = new Request('http://localhost/api/mail/webhook/stalwart', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-fg-webhook-token': WEBHOOK_SECRET,
    },
    body: JSON.stringify(body),
  });
  return stalwartWebhook(req as never);
}

async function suppressionFor(email: string) {
  return db().select().from(emailSuppression).where(eq(emailSuppression.email, email));
}

beforeAll(() => {
  __setTestDb(emailsTestDb() as never);
});

beforeEach(async () => {
  await truncateEmailTables();
  smtpSentTo.length = 0;
});

afterAll(async () => {
  __resetTestDb();
  await closeTestDb();
});

describeEmailsDb('S2 — incident bounce hard de bout en bout (modules 07+08+09)', () => {
  const CLIENTE = 'user-inexistante@exemple.test';

  // S2-01 — envoi transactionnel réel + drain : l'outbox finit `sent` avec un
  // smtp_message_id (celui que Stalwart utilisera pour corréler le bounce), et
  // le SMTP a bien été sollicité une fois pour CETTE adresse.
  it('S2-01 : sendTransactional → drain → outbox sent + smtp_message_id corrélable', async () => {
    const res = await sendTransactional({
      template: 'order-confirmation',
      to: { email: CLIENTE, name: 'Kaoutar' },
      payload: {
        firstName: 'Kaoutar',
        orderId: 'FG-S2-001',
        orderTotal: '199.00 MAD',
        itemsCount: 1,
        deliveryEstimate: '2-4 jours ouvrés',
      },
      idempotencyKey: 'order-confirm:FG-S2-001',
      source: 'api.checkout.order',
    });
    expect(res.status).toBe('queued');
    expect(res.outboxId).toBeTruthy();

    const row = await drainAndGet(res.outboxId!);
    // Oracle métier : livré au SMTP, message-id posé, exactement 1 envoi réel.
    expect(row.status).toBe('sent');
    expect(row.smtpMessageId).toBe(`<msg-${res.outboxId}@test>`);
    expect(smtpSentTo).toHaveLength(1);
    expect(smtpSentTo[0]).toContain(CLIENTE);
  });

  // S2-02 — Stalwart REJOUE un bounce hard (550) sur le message-id réel : l'outbox
  // passe `bounced_permanent`, un event `bounced_hard` est journalisé, et une
  // suppression `hard_bounce` (source=stalwart) est posée sur l'adresse.
  it('S2-02 : webhook bounce hard sur le message-id réel → bounced_permanent + suppression hard_bounce', async () => {
    const sent = await sendTransactional({
      template: 'order-confirmation',
      to: { email: CLIENTE, name: 'Kaoutar' },
      payload: {
        firstName: 'Kaoutar',
        orderId: 'FG-S2-002',
        orderTotal: '199.00 MAD',
        itemsCount: 1,
        deliveryEstimate: '2-4 jours ouvrés',
      },
      idempotencyKey: 'order-confirm:FG-S2-002',
      source: 'api.checkout.order',
    });
    const row = await drainAndGet(sent.outboxId!);
    const messageId = row.smtpMessageId!;

    const webhookRes = await postBounce(messageId, 550);
    // Oracle protocole : 200 (le webhook ne 500 jamais sur un event traité).
    expect(webhookRes.status).toBe(200);
    const webhookBody = (await webhookRes.json()) as { results: { status: string }[] };
    expect(webhookBody.results[0]!.status).toBe('bounced_hard');

    // Oracle 1 — outbox bascule bounced_permanent + métadonnées de bounce.
    const [after] = await db().select().from(emailOutbox).where(eq(emailOutbox.id, sent.outboxId!));
    expect(after!.status).toBe('bounced_permanent');
    expect(after!.bounceType).toBe('hard');
    expect(after!.bouncedAt).toBeInstanceOf(Date);
    expect(after!.bounceReason).toContain('5.1.1');

    // Oracle 2 — event bounced_hard journalisé (source stalwart).
    const evts = await db().select().from(emailEvent).where(eq(emailEvent.outboxId, sent.outboxId!));
    const hard = evts.filter((e) => e.type === 'bounced_hard');
    expect(hard).toHaveLength(1);
    expect(hard[0]!.source).toBe('stalwart');

    // Oracle 3 — suppression hard_bounce posée (le cœur de l'incident).
    const supp = await suppressionFor(CLIENTE);
    expect(supp).toHaveLength(1);
    expect(supp[0]!.reason).toBe('hard_bounce');
    expect(supp[0]!.source).toBe('stalwart');
  });

  // S2-03 — après le bounce/suppression, un NOUVEL envoi vers la même adresse est
  // REFUSÉ en amont (status suppressed) : aucune ligne outbox, AUCUN SMTP. C'est
  // la protection réputation/RGPD : on n'écrit plus jamais à une adresse morte.
  it('S2-03 : nouvel envoi vers l’adresse suppressée → suppressed, jamais de SMTP', async () => {
    // Reproduit l'incident complet (envoi + bounce) pour poser la suppression.
    const sent = await sendTransactional({
      template: 'order-confirmation',
      to: { email: CLIENTE, name: 'Kaoutar' },
      payload: {
        firstName: 'Kaoutar',
        orderId: 'FG-S2-003a',
        orderTotal: '199.00 MAD',
        itemsCount: 1,
        deliveryEstimate: '2-4 jours ouvrés',
      },
      idempotencyKey: 'order-confirm:FG-S2-003a',
      source: 'api.checkout.order',
    });
    const row = await drainAndGet(sent.outboxId!);
    await postBounce(row.smtpMessageId!, 550);
    const before = smtpSentTo.length; // 1 envoi (le premier, légitime)

    // Nouvel envoi (ex. une autre commande) vers la MÊME adresse → bloqué.
    const blocked = await sendTransactional({
      template: 'order-confirmation',
      to: { email: CLIENTE, name: 'Kaoutar' },
      payload: {
        firstName: 'Kaoutar',
        orderId: 'FG-S2-003b',
        orderTotal: '250.00 MAD',
        itemsCount: 2,
        deliveryEstimate: '2-4 jours ouvrés',
      },
      idempotencyKey: 'order-confirm:FG-S2-003b',
      source: 'api.checkout.order',
    });

    // Oracle 1 — suppressed sans outboxId.
    expect(blocked.status).toBe('suppressed');
    expect(blocked.outboxId).toBeNull();

    // Oracle 2 — AUCUNE ligne outbox pour la 2e idempotencyKey (court-circuit
    // AVANT tout INSERT, cf. send.ts:53-60).
    const rows2 = await db()
      .select()
      .from(emailOutbox)
      .where(eq(emailOutbox.idempotencyKey, 'order-confirm:FG-S2-003b'));
    expect(rows2).toHaveLength(0);

    // Oracle 3 — aucun SMTP supplémentaire (compteur figé après le 1er envoi).
    expect(smtpSentTo).toHaveLength(before);
  });

  // S2-04 — RÉACTIVATION manuelle : la suppression est retirée (réactivation
  // explicite), puis un nouvel envoi vers l'adresse REPART (queued → sent au
  // drain). Oracle : la suppression n'est PAS une condamnation définitive — une
  // fois levée, le canal se rouvre.
  //
  // NB MÉTIER (cf. S2-05) : il n'existe AUCUNE surface admin/route applicative
  // pour retirer une suppression. On exerce donc la SEULE voie disponible — un
  // DELETE SQL direct — ce qui DOCUMENTE que la réactivation n'est aujourd'hui
  // possible que par accès DB brut (constat consigné en bugsFound).
  it('S2-04 : suppression retirée (réactivation) → l’envoi vers l’adresse repart (queued→sent)', async () => {
    const sent = await sendTransactional({
      template: 'order-confirmation',
      to: { email: CLIENTE, name: 'Kaoutar' },
      payload: {
        firstName: 'Kaoutar',
        orderId: 'FG-S2-004a',
        orderTotal: '199.00 MAD',
        itemsCount: 1,
        deliveryEstimate: '2-4 jours ouvrés',
      },
      idempotencyKey: 'order-confirm:FG-S2-004a',
      source: 'api.checkout.order',
    });
    const row = await drainAndGet(sent.outboxId!);
    await postBounce(row.smtpMessageId!, 550);
    expect(await suppressionFor(CLIENTE)).toHaveLength(1);

    // Réactivation : on retire la suppression (seule voie réelle = DELETE SQL ;
    // aucune route/admin n'existe — cf. S2-05 / bugsFound).
    await db().execute(sql`DELETE FROM email_suppression WHERE email = ${CLIENTE}`);
    expect(await suppressionFor(CLIENTE)).toHaveLength(0);

    // L'envoi repart : queued (plus suppressed) puis sent au drain.
    const resumed = await sendTransactional({
      template: 'order-confirmation',
      to: { email: CLIENTE, name: 'Kaoutar' },
      payload: {
        firstName: 'Kaoutar',
        orderId: 'FG-S2-004b',
        orderTotal: '320.00 MAD',
        itemsCount: 3,
        deliveryEstimate: '2-4 jours ouvrés',
      },
      idempotencyKey: 'order-confirm:FG-S2-004b',
      source: 'api.checkout.order',
    });
    expect(resumed.status).toBe('queued');
    expect(resumed.outboxId).toBeTruthy();

    const resumedRow = await drainAndGet(resumed.outboxId!);
    expect(resumedRow.status).toBe('sent');
    // Le SMTP a bien renvoyé vers l'adresse réactivée (2 envois au total : le
    // premier légitime + ce nouvel envoi post-réactivation).
    expect(smtpSentTo.filter((t) => t.includes(CLIENTE))).toHaveLength(2);
  });

  // S2-05 — CONSTAT MÉTIER (documenté, pas un échec) : aucune surface applicative
  // (route admin / fonction exportée) ne permet de RETIRER une suppression. On
  // PROUVE l'absence par recherche statique côté src ; la levée n'est donc
  // possible qu'en base. Le test échouerait si une telle surface apparaissait —
  // signal pour mettre à jour le constat. (Consigné en bugsFound.)
  it('S2-05 : aucune route/fonction applicative ne retire une suppression (constat métier)', async () => {
    const { execSync } = await import('node:child_process');
    const cwd = process.cwd();
    // Recherche d'un DELETE/remove ciblant email_suppression hors tests.
    let hits = '';
    try {
      hits = execSync(
        "grep -rniE 'delete\\(emailSuppression|DELETE FROM email_suppression|removeSuppression|reactivateSuppression|unsuppress' src/lib src/app --include='*.ts' | grep -v '/test' | grep -v '.test.ts' || true",
        { cwd, encoding: 'utf8' },
      );
    } catch {
      hits = '';
    }
    // Oracle anti-régression DOCUMENTAIRE : tant qu'AUCUNE surface n'existe, le
    // set de hits est vide. Si ça change (surface ajoutée), ce test rouge invite
    // à mettre à jour le constat bugsFound — il ne masque jamais la lacune.
    expect(hits.trim()).toBe('');
  });
});
