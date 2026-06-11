// @vitest-environment node
/**
 * CHANTIER H — Module 08 : DLQ, comptage attempts, transitions & retry manuel.
 * Suite VRAIE-DB (femiglow_test_outbox).
 *
 * Couvre :
 *  - DLQ : à `attempts >= MAX`, ligne `dlq` + event `dlq` + `next_retry` null,
 *    `last_error` parlant. La DLQ n'est PAS re-drainée automatiquement.
 *  - attempts : +1 par ÉCHEC exactement ; PAS d'incrément sur SUCCÈS (le budget
 *    de retry n'est pas grillé par une livraison réussie).
 *  - retry manuel : `dlq → pending` (attempts=0) autorisé ; `sent → pending`
 *    refusé (hors inArray du retry).
 *  - transitions illégales : `sent`/`dlq` jamais re-claimées par le drain.
 *  - terminaux : `bounced_permanent` jamais ré-essayé par le drain.
 *
 * IDs matrice : PIP-INT-005, PIP-INT-010, PIP-INT-012, PIP-INT-016, PIP-INT-017,
 * PIP-INT-040, PIP-INT-041, PIP-INT-042, PIP-INT-045, PIP-INT-090, PIP-INT-092.
 *
 * Lancement :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test_outbox#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run src/lib/mail/__tests__/__qa__/outbox-dlq-attempts.integration.test.ts
 */
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';

// SMTP pilotable : `smtpMode` décide de l'issue (ok / throw transitoire).
let smtpMode: 'ok' | 'fail' = 'ok';
const sentOutboxIds: string[] = [];

vi.mock('@/lib/mail/client', () => ({
  SmtpNotConfiguredError: class SmtpNotConfiguredError extends Error {
    readonly code = 'SMTP_NOT_CONFIGURED';
  },
  getTransporter: () => ({
    sendMail: async (opts: { headers?: Record<string, string> }) => {
      if (smtpMode === 'fail') throw new Error('smtp 421 service temporarily unavailable');
      const id = opts.headers?.['X-FG-Outbox-Id'] ?? 'unknown';
      sentOutboxIds.push(id);
      return { messageId: `<msg-${id}@test>`, response: '250 OK' };
    },
  }),
}));

import { emailOutbox, emailEvent } from '@/lib/db/schema-emails';
import { __setTestDb, __resetTestDb } from '@/lib/db/client';
import {
  closeTestDb,
  emailsTestDb,
  truncateEmailTables,
  describeEmailsDb,
} from '@/test/db/emails-db';
import { makeOutboxRow } from '@/test/factories/emails.factory';
import { pickAndProcessBatch, attemptSend, retryOutbox } from '../../outbox';
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

describeEmailsDb('DLQ — entrée au plafond de tentatives', () => {
  // PIP-INT-005 + PIP-INT-090 — une ligne déjà à MAX-1 tentatives qui échoue
  // encore passe en `dlq`, next_retry=null, et un event `dlq` est inséré.
  it('attempts atteint MAX → dlq + event dlq + next_retry null + last_error parlant', async () => {
    smtpMode = 'fail';
    const row = makeOutboxRow({
      status: 'pending',
      attempts: MAX_ATTEMPTS - 1, // +1 sur cet échec → MAX → dlq
      maxAttempts: MAX_ATTEMPTS,
      nextRetry: null,
      scheduledFor: null,
    });
    await db().insert(emailOutbox).values(row);

    const result = await pickAndProcessBatch();
    expect(result.picked).toBe(1);
    expect(result.dlq).toBe(1);
    expect(result.failed).toBe(0);

    const after = await findRow(row.id);
    expect(after!.status).toBe('dlq');
    expect(after!.attempts).toBe(MAX_ATTEMPTS);
    expect(after!.nextRetry).toBeNull(); // pas de reprise auto
    expect(after!.lastError).toMatch(/smtp/i);

    // Un event `dlq` (et un seul) a été journalisé.
    const evts = await eventsFor(row.id);
    const dlqEvents = evts.filter((e) => e.type === 'dlq');
    expect(dlqEvents).toHaveLength(1);
    expect((dlqEvents[0]!.rawJson as { error?: string }).error).toMatch(/smtp/i);
  });

  // PIP-INT-092 — la DLQ n'est PAS re-drainée automatiquement : un 2e tick ne
  // la touche pas (next_retry null + attempts >= max → exclue du claim).
  it('PIP-INT-092 — une ligne dlq n est pas reprise par un tick ultérieur', async () => {
    const row = makeOutboxRow({
      status: 'dlq',
      attempts: MAX_ATTEMPTS,
      maxAttempts: MAX_ATTEMPTS,
      nextRetry: null,
      scheduledFor: null,
    });
    await db().insert(emailOutbox).values(row);

    smtpMode = 'ok';
    const result = await pickAndProcessBatch();
    expect(result.picked).toBe(0);
    expect(sentOutboxIds).not.toContain(row.id);

    const after = await findRow(row.id);
    expect(after!.status).toBe('dlq'); // stable
  });
});

describeEmailsDb('attempts — comptage échec vs succès', () => {
  // PIP-INT-041 — un échec transitoire incrémente attempts d'exactement 1 et
  // pose un next_retry (backoff) — la ligne reste reprenable.
  it('PIP-INT-041 — échec transitoire → attempts+1, status failed, next_retry posé', async () => {
    smtpMode = 'fail';
    const row = makeOutboxRow({
      status: 'pending',
      attempts: 0,
      maxAttempts: MAX_ATTEMPTS,
      nextRetry: null,
      scheduledFor: null,
    });
    await db().insert(emailOutbox).values(row);

    const result = await pickAndProcessBatch();
    expect(result.failed).toBe(1);

    const after = await findRow(row.id);
    expect(after!.status).toBe('failed');
    expect(after!.attempts).toBe(1); // exactement +1
    expect(after!.nextRetry).toBeInstanceOf(Date); // reprenable par le cron
    // event `failed` journalisé.
    const evts = await eventsFor(row.id);
    expect(evts.filter((e) => e.type === 'failed')).toHaveLength(1);
  });

  // PIP-INT-040 — un SUCCÈS n'incrémente PAS attempts (le compteur reste à sa
  // valeur d'entrée). Bug d'origine corrigé (deliverRow ne fait plus +1 sur sent).
  it('PIP-INT-040 — succès SMTP n incrémente PAS attempts', async () => {
    smtpMode = 'ok';
    const row = makeOutboxRow({
      status: 'pending',
      attempts: 2, // avait déjà échoué 2× avant de réussir
      maxAttempts: MAX_ATTEMPTS,
      nextRetry: null,
      scheduledFor: null,
    });
    await db().insert(emailOutbox).values(row);

    const result = await pickAndProcessBatch();
    expect(result.succeeded).toBe(1);

    const after = await findRow(row.id);
    expect(after!.status).toBe('sent');
    // attempts inchangé : un succès ne consomme pas le budget de retry.
    expect(after!.attempts).toBe(2);
  });

  // PIP-INT-042 — budget de retry non épuisé par des succès : une ligne ayant
  // réussi puis remise en jeu (échec) ne saute pas prématurément en DLQ. On
  // exerce la séquence succès→échec sur la MÊME ligne via attemptSend.
  it('PIP-INT-042 — succès puis échec : attempts ne grimpe que sur l échec', async () => {
    const row = makeOutboxRow({
      status: 'pending',
      attempts: 0,
      maxAttempts: MAX_ATTEMPTS,
      nextRetry: null,
      scheduledFor: null,
    });
    await db().insert(emailOutbox).values(row);

    // 1er passage : succès → attempts reste 0.
    smtpMode = 'ok';
    await attemptSend(row.id);
    let after = await findRow(row.id);
    expect(after!.status).toBe('sent');
    expect(after!.attempts).toBe(0);

    // On replace la ligne en pending (comme un retry manuel) puis on échoue :
    // seul l'échec consomme un essai.
    await retryOutbox(row.id); // sent → ... → retryOutbox n'agit PAS sur sent
    // sent n'est pas dans l'inArray du retry → la ligne reste `sent`. On force
    // donc un retour pending explicite pour isoler l'oracle attempts.
    await db()
      .update(emailOutbox)
      .set({ status: 'pending', attempts: 0, nextRetry: null })
      .where(eq(emailOutbox.id, row.id));
    smtpMode = 'fail';
    await attemptSend(row.id).catch(() => undefined); // attemptSend re-throw l'erreur
    after = await findRow(row.id);
    expect(after!.attempts).toBe(1); // +1 sur le seul échec
    expect(after!.status).toBe('failed');
  });
});

describeEmailsDb('retry manuel — retryOutbox', () => {
  // PIP-INT-016 — dlq → pending autorisé manuellement (attempts réinitialisé).
  it('PIP-INT-016 — retryOutbox replace une ligne dlq en pending (attempts=0)', async () => {
    const row = makeOutboxRow({
      status: 'dlq',
      attempts: MAX_ATTEMPTS,
      lastError: 'smtp boom final',
      nextRetry: null,
    });
    await db().insert(emailOutbox).values(row);

    await retryOutbox(row.id);

    const after = await findRow(row.id);
    expect(after!.status).toBe('pending');
    expect(after!.attempts).toBe(0);
    expect(after!.lastError).toBeNull();
    expect(after!.nextRetry).toBeInstanceOf(Date);
  });

  // PIP-INT-017 — sent → pending REFUSÉ : retryOutbox ne touche pas une ligne
  // déjà livrée (pas dans son inArray) — pas de re-livraison accidentelle.
  it('PIP-INT-017 — retryOutbox n affecte PAS une ligne sent', async () => {
    const row = makeOutboxRow({ status: 'sent', attempts: 1, nextRetry: null });
    await db().insert(emailOutbox).values(row);

    await retryOutbox(row.id);

    const after = await findRow(row.id);
    expect(after!.status).toBe('sent'); // inchangé
    expect(after!.attempts).toBe(1);
  });
});

describeEmailsDb('transitions illégales — le drain ne re-claime jamais les terminaux', () => {
  // PIP-INT-010 + PIP-INT-012 — `sent` et `dlq` ne sont JAMAIS re-claimées par
  // le drain (WHERE status IN ('pending','failed')). Pas de double envoi.
  it('PIP-INT-010/012 — sent et dlq exclues du claim (aucun re-envoi)', async () => {
    const sentRow = makeOutboxRow({ status: 'sent', attempts: 1, nextRetry: null, scheduledFor: null });
    const dlqRow = makeOutboxRow({
      status: 'dlq',
      attempts: MAX_ATTEMPTS,
      nextRetry: null,
      scheduledFor: null,
    });
    await db().insert(emailOutbox).values([sentRow, dlqRow]);

    smtpMode = 'ok';
    const result = await pickAndProcessBatch();
    expect(result.picked).toBe(0);
    expect(sentOutboxIds).toHaveLength(0);

    expect((await findRow(sentRow.id))!.status).toBe('sent');
    expect((await findRow(dlqRow.id))!.status).toBe('dlq');
  });

  // PIP-INT-045 — `bounced_permanent` (hard) est TERMINAL : jamais ré-essayé par
  // le drain (hors `pending`/`failed`).
  it('PIP-INT-045 — bounced_permanent (hard) reste terminal, jamais re-claimé', async () => {
    const row = makeOutboxRow({
      status: 'bounced_permanent',
      attempts: 1,
      nextRetry: null,
      scheduledFor: null,
    });
    await db().insert(emailOutbox).values(row);

    smtpMode = 'ok';
    const result = await pickAndProcessBatch();
    expect(result.picked).toBe(0);
    expect((await findRow(row.id))!.status).toBe('bounced_permanent');
  });
});
