// @vitest-environment node
/**
 * MODULE 07 — Webhooks entrants : contract tests vraie-DB (phase 5 + R-021).
 *
 * On rejoue le CORPS HTTP brut de chaque fixture (src/test/fixtures/emails/
 * {stalwart,listmonk}/) contre le HANDLER de route importé directement
 * (POST), branché sur une vraie DB de test (femiglow_test_m07webhooks). Chaque
 * fixture a un ORACLE MÉTIER explicite (cf. READMEs des fixtures) :
 *
 *   Stalwart
 *     001 delivered      → email_outbox.status='delivered' + email_event delivered
 *     002 bounce-hard    → status='bounced_permanent' + suppression hard_bounce
 *     003 bounce-soft    → status='bounced_soft', AUCUNE suppression
 *     004 complaint(554) → 5xx → bounced_permanent + suppression hard_bounce
 *     005 deferred       → email_event 'retried', outbox inchangé
 *     006 rejected(503)  → 5xx → bounced_permanent + suppression
 *     007 queued-auth    → email_event 'queued', outbox inchangé
 *     008 BATCH natif    → R-021 : 3 events traités, 3 transitions outbox
 *     009 missing-msgId  → 200 ignored=no-message-id, AUCUNE écriture
 *     010 unexpected     → 200 ignored=unhandled-event (acme.*), AUCUNE écriture
 *     011 auth-failed    → 200, AUCUNE écriture DB
 *     012 large-payload  → 5xx bounce parsé sans 500
 *
 *   Listmonk
 *     001 bounce-hard    → suppression hard_bounce + subscriber blocklisted
 *     002 bounce-soft    → suppression hard_bounce (dispatcher) + blocklisted
 *     003 complaint      → suppression complaint
 *     004 optin(created) → email_subscriber_link inséré (enabled)
 *     005 optout(unsub)  → suppression unsubscribe + subscriber disabled
 *     006 campaign-start → campaign_link status='sending'
 *     007 campaign-done  → campaign_link status='sent' + métriques
 *     008 unknown-event  → 200 ignored=unknown-event, AUCUNE écriture
 *
 * + MÉTA-TEST de sensibilité : muter un champ clé d'une fixture casse ≥1 oracle.
 *
 * Lancement (DB dédiée) :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test_m07webhooks#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run --no-file-parallelism \
 *       src/test/integration/emails-webhooks-contract.integration.test.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHmac } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';

const STALWART_SECRET = 'ssssssssssssssssssssssssssssssssssssssss';
const LISTMONK_SECRET = 'llllllllllllllllllllllllllllllllllllllll';

// La route lit env.FEMIGLOW_STALWART_WEBHOOK_SECRET / env.LISTMONK_WEBHOOK_SECRET.
// On les fixe ici (vi.mock hoisté ; secrets inline pour éviter le TDZ).
vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
  return {
    ...actual,
    env: {
      ...actual.env,
      FEMIGLOW_STALWART_WEBHOOK_SECRET: 'ssssssssssssssssssssssssssssssssssssssss',
      LISTMONK_WEBHOOK_SECRET: 'llllllllllllllllllllllllllllllllllllllll',
    },
  };
});

import {
  emailOutbox,
  emailEvent,
  emailSuppression,
  emailSubscriberLink,
  emailCampaignLink,
} from '@/lib/db/schema-emails';
import {
  closeTestDb,
  emailsTestDb,
  emailsTestSql,
  truncateEmailTables,
  describeEmailsDb,
} from '@/test/db/emails-db';
import { makeOutboxRow, makeCampaignLink, makeSubscriberLink } from '@/test/factories/emails.factory';

import { POST as stalwartPOST } from '@/app/api/mail/webhook/stalwart/route';
import { POST as listmonkPOST } from '@/app/api/mail/webhook/listmonk/route';

// Init PARESSEUSE : emailsTestDb() throw sans URL femiglow_test. Proxies lazy
// (résolution au 1er accès, dans un test actif) — cf. convention §8.
const db = new Proxy({} as ReturnType<typeof emailsTestDb>, {
  get: (_t, prop) => (emailsTestDb() as never)[prop],
});
const pg = new Proxy(((..._: never[]) => {}) as unknown as ReturnType<typeof emailsTestSql>, {
  get: (_t, prop) => (emailsTestSql() as never)[prop],
  apply: (_t, thisArg, args) => Reflect.apply(emailsTestSql() as never, thisArg, args),
});

const STALWART_DIR = join(process.cwd(), 'src/test/fixtures/emails/stalwart');
const LISTMONK_DIR = join(process.cwd(), 'src/test/fixtures/emails/listmonk');

function readStalwart(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(STALWART_DIR, name), 'utf8'));
}
function readListmonk(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(LISTMONK_DIR, name), 'utf8'));
}

// ── Helpers de requête ────────────────────────────────────────────────────

function stalwartReq(body: unknown, token = STALWART_SECRET): Request {
  return new Request('http://test/api/mail/webhook/stalwart', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '127.0.0.1',
      'x-fg-webhook-token': token,
    },
    body: JSON.stringify(body),
  });
}

function listmonkReq(body: unknown, secret = LISTMONK_SECRET): Request {
  const raw = JSON.stringify(body);
  const sig = 'sha256=' + createHmac('sha256', secret).update(raw).digest('hex');
  return new Request('http://test/api/mail/webhook/listmonk', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-listmonk-signature': sig },
    body: raw,
  });
}

// ── Seed helpers ──────────────────────────────────────────────────────────

/** Sème une ligne email_outbox 'sent' dont smtp_message_id == messageId fourni. */
async function seedOutbox(
  messageId: string,
  over: Partial<ReturnType<typeof makeOutboxRow>> = {},
): Promise<{ id: string; toEmail: string }> {
  const row = makeOutboxRow({
    status: 'sent',
    smtpMessageId: messageId,
    ...over,
  });
  await db.insert(emailOutbox).values(row);
  return { id: row.id, toEmail: row.toEmail };
}

async function getOutbox(id: string) {
  const rows = await db.select().from(emailOutbox).where(eq(emailOutbox.id, id));
  return rows[0];
}
async function eventsFor(outboxId: string) {
  return db.select().from(emailEvent).where(eq(emailEvent.outboxId, outboxId));
}
async function suppressionFor(email: string) {
  return db.select().from(emailSuppression).where(eq(emailSuppression.email, email.toLowerCase().trim()));
}

async function cleanup(): Promise<void> {
  await truncateEmailTables();
  // user_event est écrit par le bridge (fire-and-forget) ; hors EMAIL_TABLES.
  await pg`DELETE FROM user_event`;
}

beforeEach(async () => {
  vi.clearAllMocks();
  await cleanup();
});

afterAll(async () => {
  await closeTestDb();
});

// ════════════════════════════════════════════════════════════════════════
//  STALWART
// ════════════════════════════════════════════════════════════════════════

describeEmailsDb('Contract — webhook Stalwart (fixtures plates)', () => {
  // M07-CT-001 — 001 delivered → outbox.status='delivered' + event delivered.
  it('001 delivered : outbox → delivered + email_event delivered', async () => {
    const fx = readStalwart('001-delivered.json');
    const { id } = await seedOutbox(fx.messageId as string);

    const res = await stalwartPOST(stalwartReq(fx) as never);
    expect(res.status).toBe(200);

    const ob = await getOutbox(id);
    expect(ob!.status).toBe('delivered');
    expect(ob!.deliveredAt).not.toBeNull();
    const evs = await eventsFor(id);
    expect(evs.map((e) => e.type)).toContain('delivered');
    expect(evs.every((e) => e.source === 'stalwart')).toBe(true);
  });

  // M07-CT-002 — 002 bounce-hard (550) → bounced_permanent + suppression.
  it('002 bounce-hard : outbox → bounced_permanent + suppression hard_bounce', async () => {
    const fx = readStalwart('002-bounce-hard.json');
    const { id, toEmail } = await seedOutbox(fx.messageId as string);

    const res = await stalwartPOST(stalwartReq(fx) as never);
    expect(res.status).toBe(200);

    const ob = await getOutbox(id);
    expect(ob!.status).toBe('bounced_permanent');
    expect(ob!.bounceType).toBe('hard');
    const evs = await eventsFor(id);
    expect(evs.map((e) => e.type)).toContain('bounced_hard');
    const sup = await suppressionFor(toEmail);
    expect(sup).toHaveLength(1);
    expect(sup[0]!.reason).toBe('hard_bounce');
    expect(sup[0]!.source).toBe('stalwart');
  });

  // M07-CT-003 — 003 bounce-soft (451) → bounced_soft, AUCUNE suppression.
  it('003 bounce-soft : outbox → bounced_soft, sans suppression', async () => {
    const fx = readStalwart('003-bounce-soft.json');
    const { id, toEmail } = await seedOutbox(fx.messageId as string);

    const res = await stalwartPOST(stalwartReq(fx) as never);
    expect(res.status).toBe(200);

    const ob = await getOutbox(id);
    expect(ob!.status).toBe('bounced_soft');
    expect(ob!.bounceType).toBe('soft');
    const evs = await eventsFor(id);
    expect(evs.map((e) => e.type)).toContain('bounced_soft');
    expect(await suppressionFor(toEmail)).toHaveLength(0);
  });

  // M07-CT-004 — 004 complaint/abuse (554, 5xx) → bounced_permanent + suppression.
  it('004 complaint-abuse : 5xx → bounced_permanent + suppression', async () => {
    const fx = readStalwart('004-complaint-abuse.json');
    const { id, toEmail } = await seedOutbox(fx.messageId as string);

    const res = await stalwartPOST(stalwartReq(fx) as never);
    expect(res.status).toBe(200);

    const ob = await getOutbox(id);
    expect(ob!.status).toBe('bounced_permanent');
    const sup = await suppressionFor(toEmail);
    expect(sup).toHaveLength(1);
    expect(sup[0]!.reason).toBe('hard_bounce');
  });

  // M07-CT-005 — 005 deferred (queue.rescheduled) → email_event 'retried',
  //              outbox NON modifié (toujours 'sent'), pas de suppression.
  it('005 deferred : email_event retried, outbox inchangé', async () => {
    const fx = readStalwart('005-deferred.json');
    const { id, toEmail } = await seedOutbox(fx.messageId as string);

    const res = await stalwartPOST(stalwartReq(fx) as never);
    expect(res.status).toBe(200);

    const ob = await getOutbox(id);
    expect(ob!.status).toBe('sent'); // inchangé
    const evs = await eventsFor(id);
    expect(evs.map((e) => e.type)).toContain('retried');
    expect(await suppressionFor(toEmail)).toHaveLength(0);
  });

  // M07-CT-006 — 006 rejected (503, 5xx) → bounced_permanent + suppression.
  it('006 rejected : 503 (5xx) → bounced_permanent + suppression', async () => {
    const fx = readStalwart('006-rejected.json');
    const { id, toEmail } = await seedOutbox(fx.messageId as string);

    const res = await stalwartPOST(stalwartReq(fx) as never);
    expect(res.status).toBe(200);

    const ob = await getOutbox(id);
    expect(ob!.status).toBe('bounced_permanent');
    expect(await suppressionFor(toEmail)).toHaveLength(1);
  });

  // M07-CT-007 — 007 queued-authenticated → email_event 'queued', outbox inchangé.
  it('007 queued-authenticated : email_event queued, outbox inchangé', async () => {
    const fx = readStalwart('007-queued-authenticated.json');
    const { id } = await seedOutbox(fx.messageId as string);

    const res = await stalwartPOST(stalwartReq(fx) as never);
    expect(res.status).toBe(200);

    const ob = await getOutbox(id);
    expect(ob!.status).toBe('sent'); // inchangé
    const evs = await eventsFor(id);
    expect(evs.map((e) => e.type)).toContain('queued');
  });

  // M07-CT-008 — 009 missing-message-id → 200 ignored=no-message-id, 0 écriture.
  it('009 missing-message-id : 200 ignored, aucune écriture event', async () => {
    const fx = readStalwart('009-missing-message-id.json');
    const res = await stalwartPOST(stalwartReq(fx) as never);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ignored?: string };
    expect(body.ignored).toBe('no-message-id');
    const allEvents = await db.select().from(emailEvent);
    expect(allEvents).toHaveLength(0);
  });

  // M07-CT-009 — 010 unexpected-type (acme.*) → 200 ignored=unhandled-event,
  //              aucune écriture DB.
  it('010 unexpected-type : 200 ignored=unhandled-event, aucune écriture', async () => {
    const fx = readStalwart('010-unexpected-type.json');
    const res = await stalwartPOST(stalwartReq(fx) as never);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ignored?: string };
    expect(body.ignored).toBe('unhandled-event');
    expect(await db.select().from(emailEvent)).toHaveLength(0);
  });

  // M07-CT-010 — 011 auth-failed → 200, aucune écriture DB (signal sécurité log).
  it('011 auth-failed : 200, aucune écriture DB', async () => {
    const fx = readStalwart('011-auth-failed.json');
    const res = await stalwartPOST(stalwartReq(fx) as never);
    expect(res.status).toBe(200);
    expect(await db.select().from(emailEvent)).toHaveLength(0);
    expect(await db.select().from(emailSuppression)).toHaveLength(0);
  });

  // M07-CT-011 — 012 large-payload (50 rcpt, ~12 Ko, 5xx) parsé sans 500 ;
  //              outbox → bounced_permanent + suppression.
  it('012 large-payload : gros payload 5xx parsé sans 500 → bounced', async () => {
    const fx = readStalwart('012-large-payload.json');
    const { id, toEmail } = await seedOutbox(fx.messageId as string);

    const res = await stalwartPOST(stalwartReq(fx) as never);
    expect(res.status).toBe(200); // surtout PAS 500
    const ob = await getOutbox(id);
    expect(ob!.status).toBe('bounced_permanent');
    expect(await suppressionFor(toEmail)).toHaveLength(1);
  });

  // M07-CT-012 — champ requis manquant côté ENVELOPPE (event absent) → 4xx propre
  //              SANS 500.
  it('payload sans champ event → 400 propre (pas 500)', async () => {
    const res = await stalwartPOST(stalwartReq({ messageId: '<x>', foo: 'bar' }) as never);
    expect(res.status).toBe(400);
  });
});

// ── R-021 : BATCH NATIF ───────────────────────────────────────────────────

describeEmailsDb('Contract — Stalwart R-021 batch natif {events:[…]}', () => {
  // M07-CT-R021 — la fixture 008 (enveloppe native, 3 events) est ACCEPTÉE par
  // la route (200), et les 3 transitions outbox correspondantes ont lieu :
  //   batch-0001 delivered  → delivered
  //   batch-0002 failed 550 → bounced_permanent + suppression
  //   batch-0003 rescheduled→ event 'retried', outbox inchangé
  it('008 batch : 200 + 3 événements traités + transitions outbox', async () => {
    const fx = readStalwart('008-batch-multi-events.json');

    const d = await seedOutbox('<batch-0001@femiglow-maroc.com>');
    const f = await seedOutbox('<batch-0002@femiglow-maroc.com>');
    const r = await seedOutbox('<batch-0003@femiglow-maroc.com>');

    const res = await stalwartPOST(stalwartReq(fx) as never);
    // Oracle 1 — la route ACCEPTE le batch natif (avant R-021 : 400).
    expect(res.status).toBe(200);
    const body = (await res.json()) as { processed?: number; results?: unknown[] };
    expect(body.processed).toBe(3);

    // Oracle 2 — delivered.
    expect((await getOutbox(d.id))!.status).toBe('delivered');
    // Oracle 3 — failed 550 → bounced_permanent + suppression.
    expect((await getOutbox(f.id))!.status).toBe('bounced_permanent');
    expect(await suppressionFor(f.toEmail)).toHaveLength(1);
    // Oracle 4 — rescheduled → event 'retried', outbox inchangé.
    expect((await getOutbox(r.id))!.status).toBe('sent');
    expect((await eventsFor(r.id)).map((e) => e.type)).toContain('retried');
  });

  // M07-CT-R021-ISO — isolation par-événement : un événement du lot dont le
  // messageId est INCONNU (pas d'outbox) ne fait PAS échouer les autres.
  it('008 batch : un messageId inconnu n\'empêche pas les autres transitions', async () => {
    const fx = readStalwart('008-batch-multi-events.json');
    // On ne sème QUE le 1er (delivered) et le 3e (rescheduled). Le 2e (failed)
    // pointe sur un messageId inexistant → statut 'unknown-message-id', isolé.
    const d = await seedOutbox('<batch-0001@femiglow-maroc.com>');
    const r = await seedOutbox('<batch-0003@femiglow-maroc.com>');

    const res = await stalwartPOST(stalwartReq(fx) as never);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { processed?: number };
    expect(body.processed).toBe(3); // les 3 ont été tentés

    // Le 1er et le 3e ont bien transité malgré le 2e orphelin.
    expect((await getOutbox(d.id))!.status).toBe('delivered');
    expect((await eventsFor(r.id)).map((e) => e.type)).toContain('retried');
  });
});

// ── Idempotence / rejeu (Stalwart) ─────────────────────────────────────────

describeEmailsDb('Contract — Stalwart idempotence / rejeu', () => {
  // M07-CT-IDEM-HARD — rejouer 2× le même bounce-hard ⇒ UNE seule suppression
  // (email PK + onConflictDoNothing). L'outbox reste bounced_permanent.
  it('rejeu d\'un bounce-hard : une seule ligne suppression', async () => {
    const fx = readStalwart('002-bounce-hard.json');
    const { id, toEmail } = await seedOutbox(fx.messageId as string);

    await stalwartPOST(stalwartReq(fx) as never);
    await stalwartPOST(stalwartReq(fx) as never); // rejeu

    expect((await getOutbox(id))!.status).toBe('bounced_permanent');
    // Oracle idempotence : suppression non dupliquée (email = PK).
    expect(await suppressionFor(toEmail)).toHaveLength(1);
  });
});

// ════════════════════════════════════════════════════════════════════════
//  LISTMONK
// ════════════════════════════════════════════════════════════════════════

describeEmailsDb('Contract — webhook Listmonk', () => {
  // M07-CT-LM-001 — 001 bounce-hard → suppression hard_bounce + subscriber
  //                 blocklisted (si le subscriber existe).
  it('001 bounce-hard : suppression hard_bounce + subscriber blocklisted', async () => {
    const fx = readListmonk('001-bounce-hard.json');
    const email = (((fx.data as Record<string, unknown>).subscriber as Record<string, unknown>).email) as string;
    await db.insert(emailSubscriberLink).values(makeSubscriberLink({ email, status: 'enabled' }));

    const res = await listmonkPOST(listmonkReq(fx) as never);
    expect(res.status).toBe(200);

    const sup = await suppressionFor(email);
    expect(sup).toHaveLength(1);
    expect(sup[0]!.reason).toBe('hard_bounce');
    expect(sup[0]!.source).toBe('listmonk');
    const sub = await db.select().from(emailSubscriberLink).where(eq(emailSubscriberLink.email, email));
    expect(sub[0]!.status).toBe('blocklisted');
  });

  // M07-CT-LM-002 — 002 bounce-soft : le dispatcher traite TOUT subscriber.bounced
  //                 comme hard_bounce (suppression hard_bounce + blocklisted).
  //                 On épingle le comportement EXISTANT (cf. dispatcher).
  it('002 bounce-soft : dispatcher insère suppression + blocklist (comportement existant)', async () => {
    const fx = readListmonk('002-bounce-soft.json');
    const email = (((fx.data as Record<string, unknown>).subscriber as Record<string, unknown>).email) as string;
    await db.insert(emailSubscriberLink).values(makeSubscriberLink({ email, status: 'enabled' }));

    const res = await listmonkPOST(listmonkReq(fx) as never);
    expect(res.status).toBe(200);

    const sup = await suppressionFor(email);
    expect(sup).toHaveLength(1);
    // detail encode le bounce_type 'soft' transmis par Listmonk.
    expect(sup[0]!.detail).toBe('listmonk:soft');
    const sub = await db.select().from(emailSubscriberLink).where(eq(emailSubscriberLink.email, email));
    expect(sub[0]!.status).toBe('blocklisted');
  });

  // M07-CT-LM-003 — 003 complaint → suppression complaint.
  it('003 complaint : suppression complaint', async () => {
    const fx = readListmonk('003-complaint.json');
    const email = (((fx.data as Record<string, unknown>).subscriber as Record<string, unknown>).email) as string;

    const res = await listmonkPOST(listmonkReq(fx) as never);
    expect(res.status).toBe(200);

    const sup = await suppressionFor(email);
    expect(sup).toHaveLength(1);
    expect(sup[0]!.reason).toBe('complaint');
  });

  // M07-CT-LM-004 — 004 subscriber.created → email_subscriber_link inséré (enabled).
  it('004 optin (subscriber.created) : email_subscriber_link inséré enabled', async () => {
    const fx = readListmonk('004-subscriber-optin.json');
    const email = ((fx.data as Record<string, unknown>).email) as string;

    const res = await listmonkPOST(listmonkReq(fx) as never);
    expect(res.status).toBe(200);

    const sub = await db.select().from(emailSubscriberLink).where(eq(emailSubscriberLink.email, email.toLowerCase()));
    expect(sub).toHaveLength(1);
    expect(sub[0]!.status).toBe('enabled');
    expect(sub[0]!.consentSource).toBe('listmonk');
  });

  // M07-CT-LM-005 — 005 unsubscribe → suppression unsubscribe + subscriber disabled.
  it('005 optout (unsubscribe) : suppression unsubscribe + subscriber disabled', async () => {
    const fx = readListmonk('005-subscriber-optout.json');
    const email = (((fx.data as Record<string, unknown>).subscriber as Record<string, unknown>).email) as string;
    await db.insert(emailSubscriberLink).values(makeSubscriberLink({ email, status: 'enabled' }));

    const res = await listmonkPOST(listmonkReq(fx) as never);
    expect(res.status).toBe(200);

    const sup = await suppressionFor(email);
    expect(sup).toHaveLength(1);
    expect(sup[0]!.reason).toBe('unsubscribe');
    const sub = await db.select().from(emailSubscriberLink).where(eq(emailSubscriberLink.email, email));
    expect(sub[0]!.status).toBe('disabled');
    expect(sub[0]!.unsubscribedAt).not.toBeNull();
  });

  // M07-CT-LM-006 — 006 campaign.started → campaign_link.status='sending' + startedAt.
  it('006 campaign-started : campaign_link → sending', async () => {
    const fx = readListmonk('006-campaign-started.json');
    const lmId = (fx.data as Record<string, unknown>).id as number;
    await db.insert(emailCampaignLink).values(
      makeCampaignLink({ listmonkCampaignId: lmId, status: 'scheduled' }),
    );

    const res = await listmonkPOST(listmonkReq(fx) as never);
    expect(res.status).toBe(200);

    const camp = await db.select().from(emailCampaignLink).where(eq(emailCampaignLink.listmonkCampaignId, lmId));
    expect(camp[0]!.status).toBe('sending');
    expect(camp[0]!.startedAt).not.toBeNull();
  });

  // M07-CT-LM-007 — 007 campaign.completed → status='sent' + métriques sent/opens/...
  it('007 campaign-completed : campaign_link → sent + métriques', async () => {
    const fx = readListmonk('007-campaign-completed.json');
    const data = fx.data as Record<string, unknown>;
    const lmId = data.id as number;
    await db.insert(emailCampaignLink).values(
      makeCampaignLink({ listmonkCampaignId: lmId, status: 'sending' }),
    );

    const res = await listmonkPOST(listmonkReq(fx) as never);
    expect(res.status).toBe(200);

    const camp = await db.select().from(emailCampaignLink).where(eq(emailCampaignLink.listmonkCampaignId, lmId));
    expect(camp[0]!.status).toBe('sent');
    expect(camp[0]!.finishedAt).not.toBeNull();
    expect(camp[0]!.sentCount).toBe(data.sent);
    expect(camp[0]!.openCount).toBe(data.views);
    expect(camp[0]!.clickCount).toBe(data.clicks);
    expect(camp[0]!.bounceCount).toBe(data.bounces);
  });

  // M07-CT-LM-008 — 008 unknown-event (subscriber.deleted) → 200 ignored=unknown-event,
  //                 AUCUNE écriture (ni suppression, ni subscriber, ni event).
  it('008 unknown-event : 200 ignored, aucune écriture', async () => {
    const fx = readListmonk('008-unknown-event.json');
    const res = await listmonkPOST(listmonkReq(fx) as never);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ignored?: string };
    expect(body.ignored).toBe('unknown-event');
    expect(await db.select().from(emailSuppression)).toHaveLength(0);
    expect(await db.select().from(emailEvent)).toHaveLength(0);
  });

  // M07-CT-LM-SIG — signature HMAC invalide → 401, aucune écriture.
  it('signature HMAC invalide : 401, aucune écriture', async () => {
    const fx = readListmonk('001-bounce-hard.json');
    const raw = JSON.stringify(fx);
    const req = new Request('http://test/api/mail/webhook/listmonk', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-listmonk-signature': 'sha256=deadbeef' },
      body: raw,
    });
    const res = await listmonkPOST(req as never);
    expect(res.status).toBe(401);
    expect(await db.select().from(emailSuppression)).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════════
//  MÉTA-TEST de sensibilité (anti-oracle-mou)
// ════════════════════════════════════════════════════════════════════════

describeEmailsDb('Contract — méta-test de sensibilité', () => {
  // M07-CT-META-1 — muter errorCode 550→451 sur bounce-hard fait basculer
  // l'oracle : plus de suppression, status bounced_soft (≠ bounced_permanent).
  it('muter errorCode 550→451 casse l\'oracle bounce-hard', async () => {
    const fx = readStalwart('002-bounce-hard.json');

    // Baseline (fixture intacte) — hard.
    const a = await seedOutbox('<meta-hard-a@femiglow-maroc.com>');
    await stalwartPOST(
      stalwartReq({ ...fx, messageId: '<meta-hard-a@femiglow-maroc.com>' }) as never,
    );
    expect((await getOutbox(a.id))!.status).toBe('bounced_permanent');
    expect(await suppressionFor(a.toEmail)).toHaveLength(1);

    // Mutation — errorCode 451 → DOIT basculer en soft, SANS suppression.
    const b = await seedOutbox('<meta-hard-b@femiglow-maroc.com>');
    await stalwartPOST(
      stalwartReq({
        ...fx,
        messageId: '<meta-hard-b@femiglow-maroc.com>',
        errorCode: 451,
      }) as never,
    );
    expect((await getOutbox(b.id))!.status).toBe('bounced_soft'); // a basculé
    expect(await suppressionFor(b.toEmail)).toHaveLength(0); // a basculé
  });

  // M07-CT-META-2 — muter l'`event` de delivered en valeur inconnue fait basculer
  // l'oracle : l'outbox N'EST PLUS marqué 'delivered' (event ignoré).
  it('muter event delivered→inconnu casse l\'oracle delivered', async () => {
    const fx = readStalwart('001-delivered.json');
    const { id } = await seedOutbox(fx.messageId as string);

    await stalwartPOST(stalwartReq({ ...fx, event: 'totally.bogus' }) as never);

    const ob = await getOutbox(id);
    // L'outbox reste 'sent' (event inconnu ignoré) — l'oracle delivered bascule.
    expect(ob!.status).toBe('sent');
    expect(await eventsFor(id)).toHaveLength(0);
  });

  // M07-CT-META-3 — muter le messageId pour qu'il ne corresponde à aucun outbox
  // fait basculer l'oracle : aucune transition (ignored=unknown-message-id).
  it('muter messageId vers un inconnu casse l\'oracle de transition', async () => {
    const fx = readStalwart('001-delivered.json');
    const { id } = await seedOutbox(fx.messageId as string);

    const res = await stalwartPOST(
      stalwartReq({ ...fx, messageId: '<does-not-exist@nowhere>' }) as never,
    );
    const body = (await res.json()) as { ignored?: string };
    expect(body.ignored).toBe('unknown-message-id');
    // L'outbox semé n'a PAS bougé.
    expect((await getOutbox(id))!.status).toBe('sent');
  });
});
