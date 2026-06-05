// @vitest-environment node
/**
 * CHANTIER H — Module 08 : erreur de config SMTP (anti busy-loop) + filtres du
 * drain (ordre, scheduled_for, batch size, snapshot manquant).
 * Suite VRAIE-DB (femiglow_test_outbox).
 *
 * Couvre :
 *  - SmtpNotConfiguredError → `failed` AVEC next_retry (backoff), SANS brûler
 *    d'essai, et SANS event `failed` — donc reprenable mais jamais en boucle
 *    immédiate (busy-loop) une fois la config réparée.
 *  - filtres du claim : scheduled_for futur exclu, ORDER BY ancienneté,
 *    LIMIT/batch borné, snapshot manquant → erreur de livraison classique.
 *
 * IDs matrice : PIP-INT-117, PIP-INT-118, PIP-INT-119, PIP-INT-062, PIP-INT-063,
 * PIP-INT-110, PIP-INT-115.
 *
 * Lancement :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test_outbox#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run src/lib/mail/__tests__/__qa__/outbox-config-drain.integration.test.ts
 */
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';

// SMTP pilotable : 'ok' livre, 'config' fait throw getTransporter() (SMTP non
// configuré), 'fail' fait throw sendMail (erreur transitoire de livraison).
// NB : on utilise `var` (hoisté) pour `smtpMode`/`sentOutboxIds` afin qu'ils
// soient accessibles dans la factory `vi.mock` (hoistée en tête de module) ;
// la classe d'erreur est définie À L'INTÉRIEUR de la factory pour éviter tout
// accès avant initialisation (TDZ).
// eslint-disable-next-line no-var
var smtpMode: 'ok' | 'config' | 'fail' = 'ok';
// eslint-disable-next-line no-var
var sentOutboxIds: string[] = [];

vi.mock('@/lib/mail/client', () => {
  class SmtpNotConfiguredError extends Error {
    readonly code = 'SMTP_NOT_CONFIGURED';
    constructor() {
      super('SMTP non configuré (env manquant : SMTP_USER, SMTP_PASSWORD)');
      this.name = 'SmtpNotConfiguredError';
    }
  }
  return {
    SmtpNotConfiguredError,
    getTransporter: () => {
      if (smtpMode === 'config') throw new SmtpNotConfiguredError();
      return {
        sendMail: async (opts: { headers?: Record<string, string> }) => {
          if (smtpMode === 'fail') throw new Error('smtp 451 transient');
          const id = opts.headers?.['X-FG-Outbox-Id'] ?? 'unknown';
          sentOutboxIds.push(id);
          return { messageId: `<msg-${id}@test>`, response: '250 OK' };
        },
      };
    },
  };
});

import { emailOutbox, emailEvent } from '@/lib/db/schema-emails';
import { __setTestDb, __resetTestDb } from '@/lib/db/client';
import {
  closeTestDb,
  emailsTestDb,
  truncateEmailTables,
  describeEmailsDb,
} from '@/test/db/emails-db';
import { makeOutboxRow } from '@/test/factories/emails.factory';
import { pickAndProcessBatch } from '../../outbox';
import { MAX_ATTEMPTS } from '../../backoff';

const db = () => emailsTestDb();

async function findRow(id: string) {
  return db().query.emailOutbox.findFirst({ where: (t) => eq(t.id, id) });
}

beforeAll(() => {
  __setTestDb(emailsTestDb() as never);
});

beforeEach(async () => {
  await truncateEmailTables();
  smtpMode = 'ok';
  sentOutboxIds.length = 0;
});

afterEach(() => {
  vi.clearAllMocks();
});

afterAll(async () => {
  __resetTestDb();
  await closeTestDb();
});

describeEmailsDb('SMTP non configuré — anti busy-loop (F-081)', () => {
  // PIP-INT-117 + PIP-INT-119 — config error : status failed, next_retry POSÉ
  // (futur), attempts NON brûlés (inchangés).
  it('PIP-INT-117/119 — config error → failed + next_retry futur, attempts inchangés', async () => {
    smtpMode = 'config';
    const row = makeOutboxRow({
      status: 'pending',
      attempts: 2,
      maxAttempts: MAX_ATTEMPTS,
      nextRetry: null,
      scheduledFor: null,
    });
    await db().insert(emailOutbox).values(row);

    const now = new Date('2026-06-04T10:00:00Z');
    const result = await pickAndProcessBatch(now);
    expect(result.picked).toBe(1);

    const after = await findRow(row.id);
    expect(after!.status).toBe('failed');
    // attempts NON brûlés : la config n'est pas la faute de l'email.
    expect(after!.attempts).toBe(2);
    // next_retry POSÉ et dans le futur (pas null → pas de busy-loop, mais
    // reprenable une fois la config réparée).
    expect(after!.nextRetry).toBeInstanceOf(Date);
    expect(after!.nextRetry!.getTime()).toBeGreaterThan(now.getTime());
    expect(after!.lastError).toMatch(/SMTP non configuré/i);

    // PAS d'event `failed`/`dlq` pour une erreur de config (pas une panne de
    // livraison ; ne pollue pas la timeline).
    const evts = await db().query.emailEvent.findMany({ where: (t) => eq(t.outboxId, row.id) });
    expect(evts.filter((e) => e.type === 'failed' || e.type === 'dlq')).toHaveLength(0);
  });

  // PIP-INT-118 — la ligne n'est PAS re-claimée immédiatement au tick suivant
  // (next_retry futur l'exclut). Sans le fix, elle bouclerait à chaque tick.
  it('PIP-INT-118 — la ligne n est pas re-claimée au tick immédiat suivant', async () => {
    smtpMode = 'config';
    const row = makeOutboxRow({
      status: 'pending',
      attempts: 0,
      nextRetry: null,
      scheduledFor: null,
    });
    await db().insert(emailOutbox).values(row);

    // IMPORTANT : le claim utilise le `now()` Postgres (horloge réelle), pas le
    // `now` injecté (qui ne sert qu'au calcul du backoff). On ancre donc le
    // backoff sur l'instant RÉEL pour que `next_retry` (≈ now+60s) soit
    // effectivement futur vis-à-vis de l'horloge DB.
    const t0 = new Date();
    await pickAndProcessBatch(t0); // 1er tick : config error, next_retry ~ +60s

    // 2e tick « immédiat » : la ligne a un next_retry futur → exclue du claim.
    // Aucun nouvel essai, attempts toujours 0 (pas de busy-loop).
    const second = await pickAndProcessBatch(t0);
    expect(second.picked).toBe(0);

    const after = await findRow(row.id);
    expect(after!.attempts).toBe(0); // pas de busy-loop
    expect(after!.status).toBe('failed');
    expect(after!.nextRetry!.getTime()).toBeGreaterThan(t0.getTime());
  });

  // Une fois le next_retry échu (config réparée), la ligne est reprise et part.
  it('config réparée → la ligne est reprise au tick suivant l échéance et part', async () => {
    smtpMode = 'config';
    const row = makeOutboxRow({ status: 'pending', attempts: 0, nextRetry: null, scheduledFor: null });
    await db().insert(emailOutbox).values(row);

    const t0 = new Date('2026-06-04T10:00:00Z');
    await pickAndProcessBatch(t0);

    // 1h plus tard, config réparée :
    smtpMode = 'ok';
    const t1 = new Date(t0.getTime() + 60 * 60_000);
    const result = await pickAndProcessBatch(t1);
    expect(result.succeeded).toBe(1);
    expect(sentOutboxIds).toContain(row.id);
    expect((await findRow(row.id))!.status).toBe('sent');
  });
});

describeEmailsDb('drain — filtres de sélection', () => {
  // PIP-INT-063 — une ligne `scheduled_for` dans le FUTUR n'est pas reprise
  // avant l'heure.
  it('PIP-INT-063 — scheduled_for futur exclu du batch', async () => {
    const future = new Date(Date.now() + 60 * 60_000);
    const scheduled = makeOutboxRow({ status: 'pending', scheduledFor: future, nextRetry: null });
    const dueNow = makeOutboxRow({ status: 'pending', scheduledFor: null, nextRetry: null });
    await db().insert(emailOutbox).values([scheduled, dueNow]);

    smtpMode = 'ok';
    const result = await pickAndProcessBatch();
    expect(result.picked).toBe(1);
    expect(sentOutboxIds).toContain(dueNow.id);
    expect(sentOutboxIds).not.toContain(scheduled.id);
    expect((await findRow(scheduled.id))!.status).toBe('pending'); // intacte
  });

  // PIP-INT-062 — ORDER BY next_retry NULLS FIRST, created_at ASC : les plus
  // anciennes d'abord. On vérifie l'ordre des envois SMTP.
  it('PIP-INT-062 — les lignes les plus anciennes sont traitées en premier', async () => {
    const base = new Date('2026-06-01T00:00:00Z').getTime();
    const oldest = makeOutboxRow({
      status: 'pending',
      nextRetry: null,
      scheduledFor: null,
      createdAt: new Date(base),
      updatedAt: new Date(base),
    });
    const middle = makeOutboxRow({
      status: 'pending',
      nextRetry: null,
      scheduledFor: null,
      createdAt: new Date(base + 1000),
      updatedAt: new Date(base + 1000),
    });
    const newest = makeOutboxRow({
      status: 'pending',
      nextRetry: null,
      scheduledFor: null,
      createdAt: new Date(base + 2000),
      updatedAt: new Date(base + 2000),
    });
    // Insère dans le désordre pour prouver que c'est l'ORDER BY qui tranche.
    await db().insert(emailOutbox).values([newest, oldest, middle]);

    smtpMode = 'ok';
    await pickAndProcessBatch();

    // Les 3 partent ; l'ordre des sendMail suit created_at ASC.
    expect(sentOutboxIds).toEqual([oldest.id, middle.id, newest.id]);
  });

  // PIP-INT-115 — snapshot manquant → erreur de livraison classique (failed +
  // attempts+1 + next_retry). deliverRow jette « missing rendered snapshot ».
  it('PIP-INT-115 — htmlSnapshot null → failed avec erreur missing snapshot', async () => {
    smtpMode = 'ok';
    const row = makeOutboxRow({
      status: 'pending',
      htmlSnapshot: null,
      textSnapshot: null,
      attempts: 0,
      nextRetry: null,
      scheduledFor: null,
    });
    await db().insert(emailOutbox).values(row);

    const result = await pickAndProcessBatch();
    expect(result.failed).toBe(1);
    expect(sentOutboxIds).toHaveLength(0); // jamais arrivé au sendMail

    const after = await findRow(row.id);
    expect(after!.status).toBe('failed');
    expect(after!.attempts).toBe(1);
    expect(after!.lastError).toMatch(/missing rendered snapshot/i);
  });

  // PIP-INT-110 — transport down (sendMail throw) → failed + next_retry posé
  // (erreur transitoire, reprenable).
  it('PIP-INT-110 — transport down (sendMail throw) → failed + next_retry', async () => {
    smtpMode = 'fail';
    const row = makeOutboxRow({ status: 'pending', attempts: 0, nextRetry: null, scheduledFor: null });
    await db().insert(emailOutbox).values(row);

    const now = new Date('2026-06-04T10:00:00Z');
    const result = await pickAndProcessBatch(now);
    expect(result.failed).toBe(1);

    const after = await findRow(row.id);
    expect(after!.status).toBe('failed');
    expect(after!.attempts).toBe(1);
    expect(after!.nextRetry).toBeInstanceOf(Date);
    expect(after!.nextRetry!.getTime()).toBeGreaterThan(now.getTime());
  });
});
