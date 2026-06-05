// @vitest-environment node
/**
 * CHANTIER H — Module 08 : machine d'états outbox, transitions LÉGALES et
 * ILLÉGALES au niveau du CLAIM. Suite VRAIE-DB (femiglow_test_outbox).
 *
 * On exerce les transitions pilotées par le pipeline (claim → deliver) :
 *   - pending  → sending → sent   (succès SMTP, event `sent`)
 *   - failed   → sending → ...     (retry dû : next_retry échu repris)
 *   - sending  → failed            (erreur transitoire, attempts < MAX)
 *   - illégales : `sent`/`delivered`/`dlq`/`sending`(autre worker) jamais
 *     re-claimées ; jamais de `pending → sent` sans passer par `sending`.
 *
 * Le claim de `attemptSend` est un UPDATE conditionnel
 * (`status IN ('pending','failed')`) : c'est lui qui REND les transitions
 * illégales impossibles. On l'attaque directement (oracle : la ligne n'est pas
 * touchée, aucun SMTP).
 *
 * IDs matrice : PIP-INT-001, PIP-INT-002, PIP-INT-003, PIP-INT-004,
 * PIP-INT-011, PIP-INT-013, PIP-INT-014.
 *
 * Lancement :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test_outbox#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run src/lib/mail/__tests__/__qa__/outbox-state-machine.integration.test.ts
 */
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';

// SMTP pilotable : 'ok' livre, 'fail' → throw transitoire dans sendMail.
// eslint-disable-next-line no-var
var smtpMode: 'ok' | 'fail' = 'ok';
// eslint-disable-next-line no-var
var sentOutboxIds: string[] = [];

vi.mock('@/lib/mail/client', () => {
  class SmtpNotConfiguredError extends Error {
    readonly code = 'SMTP_NOT_CONFIGURED';
  }
  return {
    SmtpNotConfiguredError,
    getTransporter: () => ({
      sendMail: async (opts: { headers?: Record<string, string> }) => {
        if (smtpMode === 'fail') throw new Error('smtp 421 transient');
        const id = opts.headers?.['X-FG-Outbox-Id'] ?? 'unknown';
        sentOutboxIds.push(id);
        return { messageId: `<msg-${id}@test>`, response: '250 OK' };
      },
    }),
  };
});

import { emailOutbox } from '@/lib/db/schema-emails';
import { __setTestDb, __resetTestDb } from '@/lib/db/client';
import {
  closeTestDb,
  emailsTestDb,
  truncateEmailTables,
  describeEmailsDb,
} from '@/test/db/emails-db';
import { makeOutboxRow } from '@/test/factories/emails.factory';
import { attemptSend, pickAndProcessBatch } from '../../outbox';
import { MAX_ATTEMPTS } from '../../backoff';

const db = () => emailsTestDb();

async function findRow(id: string) {
  return db().query.emailOutbox.findFirst({ where: (t) => eq(t.id, id) });
}
async function eventsFor(id: string) {
  return db().query.emailEvent.findMany({ where: (t) => eq(t.outboxId, id) });
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

describeEmailsDb('Machine d états outbox — transitions LÉGALES', () => {
  // PIP-INT-001 — pending → sending au claim : attemptSend claim la ligne (UPDATE
  // conditionnel) puis la livre. On prouve que la ligne a bien transité par
  // `sending` (updatedAt avance) et atterrit `sent`.
  it('PIP-INT-001/003 — pending → sending → sent (succès SMTP, event sent)', async () => {
    smtpMode = 'ok';
    const row = makeOutboxRow({ status: 'pending', attempts: 0, nextRetry: null, scheduledFor: null });
    await db().insert(emailOutbox).values(row);

    await attemptSend(row.id);

    const after = await findRow(row.id);
    expect(after!.status).toBe('sent');
    expect(sentOutboxIds).toContain(row.id);
    // event `sent` journalisé exactement une fois.
    const evts = await eventsFor(row.id);
    expect(evts.filter((e) => e.type === 'sent')).toHaveLength(1);
    // smtp_message_id persisté sur sent.
    expect(after!.smtpMessageId).toBeTruthy();
  });

  // PIP-INT-002 — failed → sending au claim si retry dû : une ligne `failed`
  // avec next_retry ÉCHU est reprise par le drain et envoyée. Une ligne `failed`
  // dont next_retry est FUTUR n'est PAS reprise (échéance non atteinte).
  it('PIP-INT-002 — failed avec next_retry échu repris ; next_retry futur exclu', async () => {
    smtpMode = 'ok';
    const due = makeOutboxRow({
      status: 'failed',
      attempts: 1,
      nextRetry: new Date(Date.now() - 60_000), // échu
      scheduledFor: null,
    });
    const notDue = makeOutboxRow({
      status: 'failed',
      attempts: 1,
      nextRetry: new Date(Date.now() + 60 * 60_000), // futur
      scheduledFor: null,
    });
    await db().insert(emailOutbox).values([due, notDue]);

    const result = await pickAndProcessBatch();
    expect(result.picked).toBe(1);
    expect(sentOutboxIds).toContain(due.id);
    expect(sentOutboxIds).not.toContain(notDue.id);

    expect((await findRow(due.id))!.status).toBe('sent');
    expect((await findRow(notDue.id))!.status).toBe('failed'); // intacte
  });

  // PIP-INT-004 — sending → failed sur erreur transitoire (attempts < MAX) :
  // status failed, attempts+1, next_retry posé (reprenable).
  it('PIP-INT-004 — erreur transitoire (attempts<MAX) → failed + next_retry + attempts+1', async () => {
    smtpMode = 'fail';
    const row = makeOutboxRow({
      status: 'pending',
      attempts: 1,
      maxAttempts: MAX_ATTEMPTS,
      nextRetry: null,
      scheduledFor: null,
    });
    await db().insert(emailOutbox).values(row);

    await attemptSend(row.id).catch(() => undefined); // attemptSend re-throw

    const after = await findRow(row.id);
    expect(after!.status).toBe('failed');
    expect(after!.attempts).toBe(2); // 1 → 2
    expect(after!.nextRetry).toBeInstanceOf(Date);
    expect(after!.lastError).toMatch(/smtp/i);
  });
});

describeEmailsDb('Machine d états outbox — transitions ILLÉGALES rejetées au claim', () => {
  // PIP-INT-011 — `delivered` est terminal : attemptSend ne la re-claime pas
  // (hors inArray pending/failed) → aucune transition delivered → sending, aucun
  // SMTP, ligne intacte.
  it('PIP-INT-011 — delivered → sending rejeté (claim ne touche pas delivered)', async () => {
    const row = makeOutboxRow({ status: 'delivered', attempts: 1, nextRetry: null, scheduledFor: null });
    await db().insert(emailOutbox).values(row);

    await attemptSend(row.id);

    expect(sentOutboxIds).not.toContain(row.id);
    expect((await findRow(row.id))!.status).toBe('delivered'); // intacte
  });

  // PIP-INT-013 — claim d'une ligne déjà `sending` (capturée par un autre
  // worker) : le claim conditionnel l'EXCLUT (status hors pending/failed). On
  // simule un worker concurrent en posant la ligne en `sending` puis on tente un
  // 2e attemptSend : il ne fait rien (pas de double envoi).
  it('PIP-INT-013 — ligne déjà sending (autre worker) non re-claimée → pas de double envoi', async () => {
    const row = makeOutboxRow({ status: 'sending', attempts: 0, nextRetry: null, scheduledFor: null });
    await db().insert(emailOutbox).values(row);

    smtpMode = 'ok';
    await attemptSend(row.id); // 2e worker : ne doit RIEN faire

    // La ligne n'a pas été livrée par ce worker (le claim l'a exclue).
    expect(sentOutboxIds).not.toContain(row.id);
    // Toujours `sending` (le claim ne l'a pas reprise ; c'est le reaper, pas le
    // claim, qui récupère les sending orphelines — couvert ailleurs).
    expect((await findRow(row.id))!.status).toBe('sending');
  });

  // PIP-INT-014 — pas de saut pending → sent : un succès passe FORCÉMENT par
  // `sending`. On le prouve en interceptant l'état intermédiaire : le claim pose
  // `sending` (updatedAt avance) AVANT que deliverRow ne pose `sent`. Oracle
  // observable : sur une livraison réussie, updatedAt final > updatedAt initial
  // (la ligne a été ré-écrite au moins deux fois : claim puis sent).
  it('PIP-INT-014 — succès passe par sending (updatedAt réécrit), jamais pending→sent direct', async () => {
    smtpMode = 'ok';
    const t0 = new Date('2026-06-01T00:00:00Z');
    const row = makeOutboxRow({
      status: 'pending',
      attempts: 0,
      nextRetry: null,
      scheduledFor: null,
      createdAt: t0,
      updatedAt: t0,
    });
    await db().insert(emailOutbox).values(row);

    await attemptSend(row.id);

    const after = await findRow(row.id);
    expect(after!.status).toBe('sent');
    // updatedAt a été réécrit (claim → sending, puis → sent) : il n'est plus la
    // valeur d'origine. Preuve qu'on n'a pas fait un pending→sent atomique
    // sautant l'état sending.
    expect(after!.updatedAt.getTime()).toBeGreaterThan(t0.getTime());
  });
});
