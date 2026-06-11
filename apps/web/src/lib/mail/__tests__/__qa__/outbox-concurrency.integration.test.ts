// @vitest-environment node
/**
 * CHANTIER H — Module 08 : drain concurrent (FOR UPDATE SKIP LOCKED) et bornage
 * du batch. Suite VRAIE-DB (femiglow_test_outbox).
 *
 * Oracle central : deux `pickAndProcessBatch()` lancés EN PARALLÈLE traitent des
 * sous-ensembles DISJOINTS — chaque ligne due est envoyée EXACTEMENT une fois
 * (jamais deux fois, jamais perdue). C'est la propriété qui garantit qu'on peut
 * faire tourner plusieurs runners/cron sans double envoi.
 *
 * Pour exercer une vraie concurrence (et pas un mock instantané), le transport
 * stub introduit une micro-latence : sans SKIP LOCKED, les deux batchs
 * claimeraient la même ligne avant que l'autre n'ait écrit `sending`.
 *
 * IDs matrice : PIP-INT-060, PIP-INT-061, PIP-INT-065.
 * (PIP-INT-064 « borne temporelle du batch » est un écart documenté non corrigé
 *  — le drain est 100 séquentiel sans budget temps ; consigné dans bugsFound.)
 *
 * Lancement :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test_outbox#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run src/lib/mail/__tests__/__qa__/outbox-concurrency.integration.test.ts
 */
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { inArray } from 'drizzle-orm';

// Transport stub avec micro-latence : enregistre chaque id envoyé. La latence
// force un réel chevauchement temporel entre les deux batchs concurrents.
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
        // Petit yield pour entrelacer les deux batchs (sans sleep arbitraire :
        // une microtask suffit à céder la main au runner concurrent).
        await Promise.resolve();
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
import { pickAndProcessBatch } from '../../outbox';

const db = () => emailsTestDb();

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

describeEmailsDb('Drain concurrent — SKIP LOCKED réel', () => {
  // PIP-INT-060 + PIP-INT-061 — deux batchs concurrents : chaque ligne traitée
  // EXACTEMENT une fois (pas de double envoi), et l'union des deux batchs couvre
  // TOUTES les lignes dues (aucune perdue). C'est la propriété d'isolation des
  // runners concurrents par FOR UPDATE SKIP LOCKED.
  it('PIP-INT-060/061 — 2 batchs parallèles : chaque ligne envoyée une seule fois, aucune perdue', async () => {
    const N = 20;
    const rows = Array.from({ length: N }, () =>
      makeOutboxRow({ status: 'pending', attempts: 0, nextRetry: null, scheduledFor: null }),
    );
    await db().insert(emailOutbox).values(rows);
    const ids = rows.map((r) => r.id);

    // Deux runners EN PARALLÈLE sur la même file.
    const [a, b] = await Promise.all([pickAndProcessBatch(), pickAndProcessBatch()]);

    // Union des deux picks = exactement N (aucune ligne perdue), et somme des
    // picked = N (aucun double claim).
    expect(a.picked + b.picked).toBe(N);

    // Chaque id envoyé EXACTEMENT une fois (pas de doublon dans sentOutboxIds).
    const sentForOurRows = sentOutboxIds.filter((id) => ids.includes(id));
    expect(new Set(sentForOurRows).size).toBe(N); // toutes couvertes
    expect(sentForOurRows.length).toBe(N); // aucune envoyée deux fois

    // Toutes les lignes sont `sent` en base.
    const after = await db().query.emailOutbox.findMany({
      where: (t) => inArray(t.id, ids),
    });
    expect(after.every((r) => r.status === 'sent')).toBe(true);
  });

  // PIP-INT-065 — au plus BATCH_SIZE (100) lignes par tick : on insère 130
  // lignes dues, un seul tick en prend au plus 100 (LIMIT respecté), le reste
  // reste `pending` pour le tick suivant.
  it('PIP-INT-065 — un tick prend au plus BATCH_SIZE (100) lignes (LIMIT respecté)', async () => {
    const N = 130;
    const rows = Array.from({ length: N }, () =>
      makeOutboxRow({ status: 'pending', attempts: 0, nextRetry: null, scheduledFor: null }),
    );
    await db().insert(emailOutbox).values(rows);

    const result = await pickAndProcessBatch();
    expect(result.picked).toBeLessThanOrEqual(100);
    expect(result.picked).toBe(100); // LIMIT exactement atteint avec 130 dues

    // Il reste des lignes pending non encore traitées (130 - 100 = 30).
    const remaining = await db().query.emailOutbox.findMany({
      where: (t) => inArray(t.status, ['pending']),
    });
    expect(remaining.length).toBe(N - 100);
  });
});
