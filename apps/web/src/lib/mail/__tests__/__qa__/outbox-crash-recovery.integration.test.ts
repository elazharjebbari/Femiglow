// @vitest-environment node
/**
 * CHANTIER H — Module 08 : résilience crash mid-batch / redéploiement. Suite
 * VRAIE-DB (femiglow_test_outbox).
 *
 * Scénario réel : le cron claime un lot (UPDATE → `sending`) puis le process
 * meurt (SIGTERM redéploiement, OOM, crash) AVANT d'amener toutes les lignes à
 * un statut terminal. Sans recyclage, ces lignes restent `sending` POUR
 * TOUJOURS (le claim ne regarde que pending/failed). Le reaper
 * (`reapStuckSending`) requalifie les `sending` orphelines (au-delà du seuil) en
 * `pending` — elles repartent au tick suivant. Les lignes déjà `sent` ne sont
 * JAMAIS re-livrées (pas de double envoi).
 *
 * On simule le crash en posant directement des lignes `sending` ANCIENNES
 * (updated_at au-delà de REAP_THRESHOLD_MS) — comme si le process était mort
 * juste après le claim.
 *
 * IDs matrice : PIP-INT-150, PIP-INT-151, PIP-INT-152, PIP-INT-155.
 *
 * Lancement :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test_outbox#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run src/lib/mail/__tests__/__qa__/outbox-crash-recovery.integration.test.ts
 */
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { eq, inArray } from 'drizzle-orm';

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
import { pickAndProcessBatch, reapStuckSending, REAP_THRESHOLD_MS } from '../../outbox';
import { MAX_ATTEMPTS } from '../../backoff';

const db = () => emailsTestDb();

async function findRow(id: string) {
  return db().query.emailOutbox.findFirst({ where: (t) => eq(t.id, id) });
}
async function eventsFor(id: string) {
  return db().query.emailEvent.findMany({ where: (t) => eq(t.outboxId, id) });
}

/** Une ligne « orpheline » : claimée (`sending`) puis figée (process crashé),
 *  updated_at largement au-delà du seuil de reaping. */
function stuckSending(overrides = {}) {
  const longAgo = new Date(Date.now() - REAP_THRESHOLD_MS - 5 * 60_000);
  return makeOutboxRow({
    status: 'sending',
    attempts: 0,
    nextRetry: null,
    scheduledFor: null,
    updatedAt: longAgo,
    createdAt: longAgo,
    ...overrides,
  });
}

beforeAll(() => {
  __setTestDb(emailsTestDb() as never);
});

beforeEach(async () => {
  await truncateEmailTables();
  sentOutboxIds.length = 0;
});

afterEach(() => {
  vi.clearAllMocks();
});

afterAll(async () => {
  __resetTestDb();
  await closeTestDb();
});

describeEmailsDb('Crash mid-batch — recyclage des sending orphelines', () => {
  // PIP-INT-150 + PIP-INT-151 — crash après 4/10 envois : 4 lignes `sent`, 6
  // lignes restées `sending`. Au tick suivant : les 6 orphelines sont reapées
  // puis renvoyées (recyclables), les 4 `sent` ne sont JAMAIS re-livrées.
  it('PIP-INT-150/151 — 4 sent + 6 sending orphelines → 6 recyclées, 4 sent jamais re-livrées', async () => {
    const sent = Array.from({ length: 4 }, () =>
      makeOutboxRow({ status: 'sent', attempts: 0, nextRetry: null, scheduledFor: null }),
    );
    const stuck = Array.from({ length: 6 }, () => stuckSending());
    await db().insert(emailOutbox).values([...sent, ...stuck]);
    const sentIds = sent.map((r) => r.id);
    const stuckIds = stuck.map((r) => r.id);

    // Tick de reprise (le reaper tourne en tête de pickAndProcessBatch).
    const result = await pickAndProcessBatch();

    // Les 6 orphelines ont été reapées puis livrées dans le même tour.
    expect(result.reaped).toBe(6);
    expect(result.succeeded).toBe(6);

    // Les 6 sont maintenant `sent`.
    const stuckAfter = await db().query.emailOutbox.findMany({
      where: (t) => inArray(t.id, stuckIds),
    });
    expect(stuckAfter.every((r) => r.status === 'sent')).toBe(true);

    // CRUCIAL : aucune des 4 lignes déjà `sent` n'a été re-livrée (pas dans le
    // claim, pas dans sentOutboxIds de ce tick).
    for (const id of sentIds) {
      expect(sentOutboxIds).not.toContain(id);
      expect((await findRow(id))!.status).toBe('sent');
    }
  });

  // PIP-INT-152 — redéploiement (SIGTERM) pendant un batch de 80 : les 80
  // restées `sending` sont toutes reprises au(x) tick(s) suivant(s), aucune
  // perdue. (BATCH_SIZE=100 ⇒ un seul tick suffit après reaping.)
  it('PIP-INT-152 — 80 sending orphelines toutes reprises, aucune perdue', async () => {
    const stuck = Array.from({ length: 80 }, () => stuckSending());
    await db().insert(emailOutbox).values(stuck);
    const ids = stuck.map((r) => r.id);

    const result = await pickAndProcessBatch();
    expect(result.reaped).toBe(80);

    const after = await db().query.emailOutbox.findMany({ where: (t) => inArray(t.id, ids) });
    // Aucune ligne perdue ni bloquée en `sending` : toutes livrées.
    expect(after).toHaveLength(80);
    expect(after.every((r) => r.status === 'sent')).toBe(true);
  });

  // PIP-INT-155 — cohérence du journal après recovery : une ligne orpheline
  // recyclée puis livrée n'a QU'UN SEUL event `sent` (pas de doublon dû au
  // recyclage). Le reaper remet `pending` sans émettre d'event `sent`.
  it('PIP-INT-155 — après recovery, exactement un event sent par ligne (pas de doublon)', async () => {
    const stuck = stuckSending();
    await db().insert(emailOutbox).values(stuck);

    await pickAndProcessBatch();

    const evts = await eventsFor(stuck.id);
    expect(evts.filter((e) => e.type === 'sent')).toHaveLength(1);
    expect((await findRow(stuck.id))!.status).toBe('sent');
  });

  // Reaper au plafond : une orpheline déjà à MAX-1 attempts est recyclée +1 →
  // atteint le plafond → `dlq` (pas `pending`), pas de boucle infinie sur une
  // ligne empoisonnée. (Couvre la branche dlq du reaper, cf. PIP-INT-036.)
  it('reaper d une orpheline au plafond → dlq, pas pending', async () => {
    const stuck = stuckSending({ attempts: MAX_ATTEMPTS - 1, maxAttempts: MAX_ATTEMPTS });
    await db().insert(emailOutbox).values(stuck);

    const reaped = await reapStuckSending();
    expect(reaped).toBe(1);

    const after = await findRow(stuck.id);
    expect(after!.status).toBe('dlq');
    expect(after!.attempts).toBe(MAX_ATTEMPTS);
    expect(after!.nextRetry).toBeNull();
  });
});
