// @vitest-environment node
/**
 * R-027 — Annulation d'une relance panier abandonné sur achat (vraie DB).
 *
 * Le défaut historique (épinglé par le scénario S3-05) : un run cart.abandoned
 * en attente n'était JAMAIS annulé quand la cliente achetait → la relance
 * « panier oublié » partait malgré la commande payée.
 *
 * Comportement corrigé (ce test) : quand un `order.placed` survient pour un lead,
 * `cancelSupersededRuns` (et donc `dispatchEventTriggers`) passe à `cancelled`
 * tous les runs cart.abandoned encore EN ATTENTE (status running/waiting_for_event,
 * aucune ligne outbox) pour CE lead, avec la raison `purchase_completed`. Le
 * runner ne produit alors AUCUNE ligne outbox de relance.
 *
 * IDs : R-027-01..05 (module 05-automations).
 *
 * Lancement (DB dédiée) :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test_automation#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run --no-file-parallelism \
 *     src/lib/mail/automation/__tests__/cancel-on-purchase.integration.test.ts
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';

vi.hoisted(() => {
  process.env.MAIL_UNSUB_TOKEN_SECRET ??= 'qa-r027-cancel-secret-0123456789abcdef';
});

// SMTP mock : compte les envois réels (oracle « aucune relance »).
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
import { emailAutomation, emailAutomationRun, emailOutbox } from '@/lib/db/schema-emails';
import { userEvent } from '@/lib/db/schema';
import { __setTestDb, __resetTestDb } from '@/lib/db/client';
import {
  closeTestDb,
  emailsTestDb,
  emailsTestSql,
  truncateEmailTables,
  describeEmailsDb,
  hasEmailsTestDb,
} from '@/test/db/emails-db';
import { makeEmailAutomation } from '@/test/factories/emails.factory';
import { dispatchEventTriggers } from '@/lib/mail/automation/event-dispatcher';
import { tickAutomation } from '@/lib/mail/automation/runner';
import {
  cancelSupersededRuns,
  triggersCancelledBy,
  CANCEL_REASON_PURCHASE,
} from '@/lib/mail/automation/cancel-on-event';

const db = new Proxy({} as ReturnType<typeof emailsTestDb>, {
  get: (_t, p) => (emailsTestDb() as never)[p],
});
const pg = new Proxy(((..._: never[]) => {}) as unknown as ReturnType<typeof emailsTestSql>, {
  get: (_t, p) => (emailsTestSql() as never)[p],
  apply: (_t, thisArg, args) => Reflect.apply(emailsTestSql() as never, thisArg, args),
});

const CLIENTE = 'r027-cliente@exemple.test';
const NIGHT_UTC = new Date('2026-06-04T02:00:00.000Z'); // quiet hours
const DAY_UTC = new Date('2026-06-04T10:00:00.000Z'); // fenêtre permise

const CART_STEPS = [
  { kind: 'send', template: 'cart-abandoned', payloadKeys: ['firstName'] },
];

async function cleanup(): Promise<void> {
  await truncateEmailTables();
  await pg`DELETE FROM user_event`;
  await pg`DELETE FROM leads`;
}

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

async function emit(eventName: string, ts: Date, email = CLIENTE): Promise<number> {
  const [row] = await db
    .insert(userEvent)
    .values({
      email: email.toLowerCase(),
      eventName,
      ts,
      properties: { firstName: 'Kaoutar' },
      source: 'server',
      leadId: null,
    })
    .returning({ id: userEvent.id });
  return row!.id;
}

async function runsFor(automationId: string) {
  return db.select().from(emailAutomationRun).where(eq(emailAutomationRun.automationId, automationId));
}

// Hooks top-level GARDÉS par hasEmailsTestDb : un beforeAll de fichier s'exécute
// même quand describeEmailsDb skippe toutes les suites — sans la garde, la
// collection échouait en batterie unit (DATABASE_URL_TEST absent) alors que les
// 6 tests étaient honnêtement skippés (conventions §8).
beforeAll(() => {
  if (!hasEmailsTestDb()) return;
  __setTestDb(emailsTestDb() as never);
});

beforeEach(async () => {
  if (!hasEmailsTestDb()) return;
  await cleanup();
  smtpSentTo.length = 0;
});

afterAll(async () => {
  if (!hasEmailsTestDb()) return;
  __resetTestDb();
  await closeTestDb();
});

describe('R-027 — mapping trigger→annulateurs (pur, sans DB)', () => {
  it('R-027-00 : order.placed annule le trigger cart.abandoned', () => {
    expect(triggersCancelledBy('order.placed')).toContain('cart.abandoned');
    expect(triggersCancelledBy('email.opened')).toEqual([]);
  });
});

describeEmailsDb('R-027 — relance panier annulée sur achat (vraie DB)', () => {
  // R-027-01 — le cœur du fix : abandon → enrôlement → achat → run cancelled,
  // AUCUN outbox de relance même après un tick à l'heure permise.
  it('R-027-01 : achat avant l’envoi → run cancelled(purchase_completed), 0 relance', async () => {
    const auto = await seedCartAutomation();
    await emit('cart.abandoned', NIGHT_UTC);
    await dispatchEventTriggers(new Date(NIGHT_UTC.getTime() + 1000));

    let [run] = await runsFor(auto.id);
    expect(run!.status).toBe('running');

    // La cliente ACHÈTE, puis le dispatcher repasse (scan inclut order.placed).
    await emit('order.placed', new Date(NIGHT_UTC.getTime() + 2 * 60 * 60_000));
    const res = await dispatchEventTriggers(new Date(NIGHT_UTC.getTime() + 3 * 60 * 60_000));
    expect(res.cancelledSuperseded).toBe(1);

    [run] = await runsFor(auto.id);
    expect(run!.status).toBe('cancelled');
    expect((run!.contextJson as Record<string, unknown>)._cancelledReason).toBe(
      CANCEL_REASON_PURCHASE,
    );
    expect(run!.nextActionAt).toBeNull();

    // Un tick ultérieur à l'heure permise NE produit AUCUNE relance.
    await tickAutomation(DAY_UTC);
    const outbox = await db.select().from(emailOutbox);
    expect(outbox).toHaveLength(0);
    expect(smtpSentTo).toHaveLength(0);
  });

  // R-027-02 — appel direct de cancelSupersededRuns (l'unité moteur générique).
  it('R-027-02 : cancelSupersededRuns annule le run en attente du lead', async () => {
    const auto = await seedCartAutomation();
    await emit('cart.abandoned', NIGHT_UTC);
    await dispatchEventTriggers(new Date(NIGHT_UTC.getTime() + 1000));

    const res = await cancelSupersededRuns('order.placed', CLIENTE, DAY_UTC);
    expect(res.cancelled).toBe(1);

    const [run] = await runsFor(auto.id);
    expect(run!.status).toBe('cancelled');
  });

  // R-027-03 — borné au bon lead : un autre lead n'est pas annulé.
  it('R-027-03 : un achat d’un AUTRE lead n’annule pas la relance', async () => {
    const auto = await seedCartAutomation();
    await emit('cart.abandoned', NIGHT_UTC, CLIENTE);
    await dispatchEventTriggers(new Date(NIGHT_UTC.getTime() + 1000));

    const res = await cancelSupersededRuns('order.placed', 'autre@exemple.test', DAY_UTC);
    expect(res.cancelled).toBe(0);

    const [run] = await runsFor(auto.id);
    expect(run!.status).toBe('running');
  });

  // R-027-04 — un run qui a DÉJÀ envoyé (outbox non vide) n'est pas rétro-annulé.
  it('R-027-04 : run déjà envoyé (outbox non vide) → PAS rétro-annulé', async () => {
    const auto = await seedCartAutomation();
    await emit('cart.abandoned', NIGHT_UTC);
    await dispatchEventTriggers(new Date(NIGHT_UTC.getTime() + 1000));
    // Simule un run ayant déjà produit une ligne outbox (envoi effectué).
    const [run] = await runsFor(auto.id);
    await db
      .update(emailAutomationRun)
      .set({ outboxIds: ['eo_already_sent'] })
      .where(eq(emailAutomationRun.id, run!.id));

    const res = await cancelSupersededRuns('order.placed', CLIENTE, DAY_UTC);
    expect(res.cancelled).toBe(0);
    const [after] = await runsFor(auto.id);
    expect(after!.status).toBe('running');
  });

  // R-027-05 — un event non-annulateur ne touche rien (court-circuit).
  it('R-027-05 : un event non antagoniste n’annule aucun run', async () => {
    const auto = await seedCartAutomation();
    await emit('cart.abandoned', NIGHT_UTC);
    await dispatchEventTriggers(new Date(NIGHT_UTC.getTime() + 1000));

    const res = await cancelSupersededRuns('email.opened', CLIENTE, DAY_UTC);
    expect(res.cancelled).toBe(0);
    const [run] = await runsFor(auto.id);
    expect(run!.status).toBe('running');
  });
});
