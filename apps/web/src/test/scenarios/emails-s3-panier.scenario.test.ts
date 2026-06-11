// @vitest-environment node
/**
 * CHANTIER C — PHASE 7, SCÉNARIO MÉTIER S3 : AUTOMATION PANIER ABANDONNÉ.
 *
 * Enchaîne les modules 05 (automation runner V2 + send) et 08 (outbox), plus le
 * sous-module FREQUENCY (quiet hours), contre la VRAIE DB (femiglow_test_scenarios).
 *
 * Le parcours réel :
 *   1. une automation `cart.abandoned` est seedée (triggerType='event', un step
 *      `send` du template `cart-abandoned`) ;
 *   2. un `user_event` cart.abandoned est émis → `dispatchEventTriggers` crée un
 *      run (enrôlement idempotent par eventId) ;
 *   3. le step `send` tombe en QUIET HOURS (now injecté en pleine nuit) → le run
 *      est DIFFÉRÉ (nextActionAt = prochain 08:00 local, RIEN n'est envoyé) ;
 *   4. au tick à l'heure permise → l'email part UNE SEULE fois.
 *
 * VARIANTE ACHAT : depuis R-027 (vague 4), un achat (`order.placed`) ANNULE les
 * runs cart-abandon encore EN ATTENTE pour le lead — `cancelSupersededRuns`,
 * câblé dans `dispatchEventTriggers`, passe le run à `cancelled(purchase_completed)`
 * et AUCUNE relance ne part. Le test S3-05 vérifie désormais ce comportement
 * CORRIGÉ (ex-constat métier `bugsFound`, maintenant résolu).
 *
 * Pas de sleep : tout passe par `now` injecté (dispatcher + runner +
 * applyQuietHours) — déterminisme total, jamais de vrai minuit.
 *
 * Lancement (DB dédiée) :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test_scenarios#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run --no-file-parallelism \
 *       src/test/scenarios/emails-s3-panier.scenario.test.ts
 *
 * IDs scénario : S3-01 (enrôlement), S3-02 (quiet hours → différé),
 *   S3-03 (tick permis → 1 envoi), S3-04 (idempotence : pas de double envoi),
 *   S3-05 (variante achat : la relance est ANNULÉE par l'achat — R-027).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';

vi.hoisted(() => {
  process.env.MAIL_UNSUB_TOKEN_SECRET ??= 'qa-s3-panier-secret-0123456789abcdef';
});

// SMTP mock : compte les envois réels par adresse (l'oracle « une seule relance »).
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

import { createId } from '@/lib/ids';
import { emailAutomation, emailAutomationRun, emailOutbox, emailEvent } from '@/lib/db/schema-emails';
import { userEvent } from '@/lib/db/schema';
import { __setTestDb, __resetTestDb } from '@/lib/db/client';
import {
  closeTestDb,
  emailsTestDb,
  emailsTestSql,
  truncateEmailTables,
  describeEmailsDb,
} from '@/test/db/emails-db';
import { makeEmailAutomation } from '@/test/factories/emails.factory';
import { dispatchEventTriggers } from '@/lib/mail/automation/event-dispatcher';
import { tickAutomation } from '@/lib/mail/automation/runner';

// Proxies LAZY (emailsTestDb() throw sans URL femiglow_test ; appel module-level
// casserait le run global avant le skip describeEmailsDb).
const db = new Proxy({} as ReturnType<typeof emailsTestDb>, {
  get: (_t, p) => (emailsTestDb() as never)[p],
});
const pg = new Proxy(((..._: never[]) => {}) as unknown as ReturnType<typeof emailsTestSql>, {
  get: (_t, p) => (emailsTestSql() as never)[p],
  apply: (_t, thisArg, args) => Reflect.apply(emailsTestSql() as never, thisArg, args),
});

const CLIENTE = 'panier-cliente@exemple.test';

// Casablanca = UTC+1 (pas de DST). 02:00 UTC = 03:00 local → NUIT (hors [08:00,22:00[).
const NIGHT_UTC = new Date('2026-06-04T02:00:00.000Z'); // 03:00 Casablanca → quiet
// 10:00 UTC = 11:00 local → fenêtre permise.
const DAY_UTC = new Date('2026-06-04T10:00:00.000Z'); // 11:00 Casablanca → permis

const CART_STEPS = [
  {
    kind: 'send',
    template: 'cart-abandoned',
    payloadKeys: ['firstName', 'cartItemsLabel', 'resumeUrl'],
  },
];

async function cleanup(): Promise<void> {
  await truncateEmailTables();
  await pg`DELETE FROM user_event`;
  await pg`DELETE FROM leads`;
}

/** Seede l'automation cart-abandon (event-driven, quiet hours 08:00→22:00 par défaut). */
async function seedCartAutomation(over: Parameters<typeof makeEmailAutomation>[0] = {}) {
  const row = makeEmailAutomation({
    slug: `cart-abandoned-${createId()}`,
    name: 'Relance panier abandonné',
    triggerType: 'event',
    triggerConfig: { eventName: 'cart.abandoned' },
    steps: CART_STEPS as unknown as object[],
    active: true,
    cooldownSeconds: 0,
    quietHoursEnabled: true,
    quietHoursStart: '08:00',
    quietHoursEnd: '22:00',
    quietHoursTz: 'Africa/Casablanca',
    ...over,
  });
  await db.insert(emailAutomation).values(row);
  return row;
}

/** Émet un user_event cart.abandoned avec les vars du panier. Retourne l'eventId. */
async function emitCartAbandoned(ts: Date, properties: Record<string, unknown>): Promise<number> {
  const [row] = await db
    .insert(userEvent)
    .values({
      email: CLIENTE.toLowerCase(),
      eventName: 'cart.abandoned',
      ts,
      properties,
      source: 'server',
      leadId: null,
    })
    .returning({ id: userEvent.id });
  return row!.id;
}

async function runsFor(automationId: string) {
  return db.select().from(emailAutomationRun).where(eq(emailAutomationRun.automationId, automationId));
}

const CART_PROPS = {
  firstName: 'Kaoutar',
  cartItemsLabel: '2 × Sérum lumière (200 MAD)',
  resumeUrl: 'https://femiglow-maroc.com/panier?resume=s3abc',
};

beforeAll(() => {
  __setTestDb(emailsTestDb() as never);
});

beforeEach(async () => {
  await cleanup();
  smtpSentTo.length = 0;
});

afterAll(async () => {
  __resetTestDb();
  await closeTestDb();
});

describeEmailsDb('S3 — automation panier abandonné + quiet hours (modules 05+08+frequency)', () => {
  // S3-01 — l'event cart.abandoned crée EXACTEMENT un run, prêt à être traité, qui
  // porte les vars réelles du panier dans son contexte.
  it('S3-01 : user_event cart.abandoned → 1 run enrôlé avec les vars du panier', async () => {
    const auto = await seedCartAutomation();
    const eventId = await emitCartAbandoned(NIGHT_UTC, CART_PROPS);

    const res = await dispatchEventTriggers(new Date(NIGHT_UTC.getTime() + 1000));

    expect(res.enrolled).toBe(1);
    const runs = await runsFor(auto.id);
    expect(runs).toHaveLength(1);
    expect(runs[0]!.status).toBe('running');
    expect(runs[0]!.recipientEmail).toBe(CLIENTE.toLowerCase());
    const ctx = runs[0]!.contextJson as Record<string, unknown>;
    expect(ctx.cartItemsLabel).toBe(CART_PROPS.cartItemsLabel);
    expect(ctx.resumeUrl).toBe(CART_PROPS.resumeUrl);
    expect(ctx.dedupeKey).toBe(`event:${eventId}`);
  });

  // S3-02 — le step send évalué EN PLEINE NUIT (now = 03:00 local) est DIFFÉRÉ :
  // le run reste step 0, nextActionAt = prochain 08:00 local, AUCUN email envoyé,
  // AUCUNE ligne outbox. C'est le cœur du contrôle de fréquence.
  it('S3-02 : tick en quiet hours → run différé (nextActionAt=08:00 local), 0 envoi, 0 outbox', async () => {
    const auto = await seedCartAutomation();
    await emitCartAbandoned(NIGHT_UTC, CART_PROPS);
    await dispatchEventTriggers(new Date(NIGHT_UTC.getTime() + 1000));

    // Tick du runner en pleine nuit : le send tombe hors fenêtre → defer.
    const tickRes = await tickAutomation(new Date(NIGHT_UTC.getTime() + 2000));
    expect(tickRes.picked).toBe(1);
    expect(tickRes.advanced).toBe(1); // defer() renvoie false → compté "advanced" (pas completed)
    expect(tickRes.completed).toBe(0);

    const [run] = await runsFor(auto.id);
    // Oracle 1 — toujours running, toujours sur le step d'envoi (path inchangé).
    expect(run!.status).toBe('running');
    const ctx = run!.contextJson as Record<string, unknown>;
    expect(ctx._path).toEqual([0]);
    expect(ctx._deferredReason).toContain('quiet_hours');

    // Oracle 2 — nextActionAt repoussé au prochain 08:00 Casablanca (= 07:00 UTC),
    // strictement APRÈS l'instant de tick (différé vers l'avant).
    const next = run!.nextActionAt!;
    expect(next).toBeInstanceOf(Date);
    expect(next.getTime()).toBeGreaterThan(NIGHT_UTC.getTime());
    // 08:00 Casablanca du 2026-06-04 = 07:00:00 UTC.
    expect(next.toISOString()).toBe('2026-06-04T07:00:00.000Z');

    // Oracle 3 — RIEN n'est parti : ni SMTP, ni outbox.
    expect(smtpSentTo).toHaveLength(0);
    expect(await db.select().from(emailOutbox)).toHaveLength(0);
  });

  // S3-03 — au tick à l'heure permise (now = 11:00 local), le send part : 1 ligne
  // outbox `cart-abandoned`, livrée au SMTP, le run COMPLÈTE (un seul step).
  it('S3-03 : tick à l’heure permise → email parti une fois, run complété', async () => {
    const auto = await seedCartAutomation();
    await emitCartAbandoned(NIGHT_UTC, CART_PROPS);
    await dispatchEventTriggers(new Date(NIGHT_UTC.getTime() + 1000));
    // D'abord différé en pleine nuit...
    await tickAutomation(new Date(NIGHT_UTC.getTime() + 2000));
    expect(smtpSentTo).toHaveLength(0);

    // ... puis tick à l'heure permise → l'envoi part.
    const tickRes = await tickAutomation(DAY_UTC);
    expect(tickRes.picked).toBe(1);
    expect(tickRes.completed).toBe(1); // seul step (send) → run completé

    const [run] = await runsFor(auto.id);
    expect(run!.status).toBe('completed');

    // Oracle 1 — exactement une ligne outbox du bon template, queued→sent.
    const outbox = await db.select().from(emailOutbox);
    expect(outbox).toHaveLength(1);
    expect(outbox[0]!.template).toBe('cart-abandoned');
    expect(outbox[0]!.toEmail).toBe(CLIENTE.toLowerCase());

    // Oracle 2 — drainé : la ligne est sent + le SMTP a été sollicité 1 fois.
    await vi.waitFor(async () => {
      const [r] = await db.select().from(emailOutbox).where(eq(emailOutbox.id, outbox[0]!.id));
      expect(r!.status).toBe('sent');
    });
    expect(smtpSentTo.filter((t) => t.includes(CLIENTE))).toHaveLength(1);

    // Oracle 3 — l'idempotencyKey de l'outbox est dérivée du run+step (anti-doublon).
    expect(outbox[0]!.idempotencyKey).toBe(`automation:${run!.id}:step0`);
  });

  // S3-04 — ANTI-DOUBLON : même si un second tick re-claime le run (ex. ré-armement
  // accidentel), l'idempotencyKey `automation:<run>:step0` garantit qu'aucune 2e
  // ligne outbox n'est créée et qu'aucun 2e SMTP ne part.
  it('S3-04 : un re-tick ne renvoie pas l’email (idempotence par idempotencyKey)', async () => {
    const auto = await seedCartAutomation();
    await emitCartAbandoned(NIGHT_UTC, CART_PROPS);
    await dispatchEventTriggers(new Date(NIGHT_UTC.getTime() + 1000));
    await tickAutomation(DAY_UTC); // envoi (le run complète)
    await vi.waitFor(async () => {
      const ob = await db.select().from(emailOutbox);
      expect(ob).toHaveLength(1);
    });
    const sentBefore = smtpSentTo.length;

    // Force un re-claim : ré-arme le run complété sur le step send (simulateur de
    // double-traitement) puis re-tick. L'idempotencyKey doit absorber le doublon.
    const [run] = await runsFor(auto.id);
    await db
      .update(emailAutomationRun)
      .set({
        status: 'running',
        nextActionAt: new Date(DAY_UTC.getTime() - 1000),
        contextJson: { ...(run!.contextJson as object), _path: [0] },
      })
      .where(eq(emailAutomationRun.id, run!.id));

    await tickAutomation(new Date(DAY_UTC.getTime() + 1000));
    await vi.waitFor(async () => {
      // laisse le fire-and-forget éventuel se draîner
      const ob = await db.select().from(emailOutbox);
      expect(ob.length).toBeGreaterThanOrEqual(1);
    });

    // Oracle dur — toujours UNE SEULE ligne outbox et AUCUN nouvel envoi SMTP.
    const outbox = await db.select().from(emailOutbox);
    expect(outbox).toHaveLength(1);
    expect(smtpSentTo).toHaveLength(sentBefore);
  });
});

describeEmailsDb('S3 (variante achat) — annulation du run sur order.placed (R-027)', () => {
  // S3-05 — COMPORTEMENT CORRIGÉ (R-027, vague 4) : un order.placed survenu après
  // l'enrôlement et AVANT l'envoi annule le run cart-abandon. On émet l'achat,
  // le dispatcher repasse (scan inclut order.placed → cancelSupersededRuns), puis
  // on tick à l'heure permise : AUCUNE relance ne part.
  // → la cliente qui a payé NE reçoit PAS de relance « panier abandonné ».
  it('S3-05 : achat émis après enrôlement → la relance est ANNULÉE (R-027)', async () => {
    const auto = await seedCartAutomation();
    await emitCartAbandoned(NIGHT_UTC, CART_PROPS);
    await dispatchEventTriggers(new Date(NIGHT_UTC.getTime() + 1000));

    // La cliente ACHÈTE (order.placed) entre l'abandon et la relance.
    await db.insert(userEvent).values({
      email: CLIENTE.toLowerCase(),
      eventName: 'order.placed',
      ts: new Date(NIGHT_UTC.getTime() + 3 * 60 * 60_000),
      properties: { orderId: 'FG-S3-PAID', totalMad: 400 },
      source: 'server',
      leadId: null,
    });

    // Le dispatcher repasse : l'order.placed annule le run cart-abandon en attente.
    const dispatchRes = await dispatchEventTriggers(new Date(NIGHT_UTC.getTime() + 4 * 60 * 60_000));
    expect(dispatchRes.cancelledSuperseded).toBe(1);

    // Le run est cancelled, raison purchase_completed.
    let [run] = await runsFor(auto.id);
    expect(run!.status).toBe('cancelled');
    expect((run!.contextJson as Record<string, unknown>)._cancelledReason).toBe('purchase_completed');

    // Tick à l'heure permise : le run cancelled n'est plus claimé → AUCUNE relance.
    const tickRes = await tickAutomation(DAY_UTC);
    expect(tickRes.picked).toBe(0);
    expect(tickRes.completed).toBe(0);

    const outbox = await db.select().from(emailOutbox);
    // Oracle CORRIGÉ : aucune ligne outbox de relance, le SMTP n'est pas sollicité.
    expect(outbox).toHaveLength(0);
    expect(smtpSentTo).toHaveLength(0);
    [run] = await runsFor(auto.id);
    expect(run!.status).toBe('cancelled'); // pas 'completed'
  });
});
