// @vitest-environment node
/**
 * CHANTIER 1.3 — Reaper des lignes `sending` orphelines + intégrité du claim
 * concurrent (SKIP LOCKED). Suite VRAIE-DB (femiglow_test_outbox).
 *
 * Contexte du bug (P0) : `attemptSend`/`pickAndProcessBatch` claiment une ligne
 * en la passant à `sending`. Si le process meurt (crash / restart de
 * `next start` après un build — FRÉQUENT en prod) entre le claim et le passage
 * à un statut terminal, la ligne reste `sending` POUR TOUJOURS : le claim du
 * cron ne sélectionne que `pending`/`failed`, donc elle n'est jamais reprise →
 * email perdu sans retry.
 *
 * Fix : `reapStuckSending()` (appelé en tête de `pickAndProcessBatch`)
 * requalifie toute ligne `sending` plus vieille que `REAP_THRESHOLD_MS`.
 *
 * Le volet concurrence (OBX-INT-003) vérifie en plus que 2 drains parallèles
 * ne traitent jamais la même ligne 2× (FOR UPDATE SKIP LOCKED).
 *
 * Lancement :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test_outbox#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run src/lib/mail/__tests__/outbox-reaper.integration.test.ts
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';

// SMTP : on contrôle l'issue d'envoi sans serveur réel. Le transporter mock
// enregistre l'outboxId (header X-FG-Outbox-Id) de chaque sendMail pour pouvoir
// asserter qu'aucune ligne n'est livrée 2× sous concurrence.
const deliveredOutboxIds: string[] = [];
let smtpShouldFail = false;

vi.mock('@/lib/mail/client', () => ({
  SmtpNotConfiguredError: class SmtpNotConfiguredError extends Error {
    readonly code = 'SMTP_NOT_CONFIGURED';
  },
  getTransporter: () => ({
    sendMail: async (opts: { headers?: Record<string, string> }) => {
      if (smtpShouldFail) throw new Error('smtp boom (transient)');
      const outboxId = opts.headers?.['X-FG-Outbox-Id'] ?? 'unknown';
      deliveredOutboxIds.push(outboxId);
      return { messageId: `<msg-${outboxId}@test>`, response: '250 OK' };
    },
  }),
}));

import { emailOutbox } from '@/lib/db/schema-emails';
import { __setTestDb, __resetTestDb } from '@/lib/db/client';
import {
  closeTestDb,
  emailsTestDb,
  truncateEmailTables,
  describeEmailsDb,
} from '@/test/db/emails-db';
import { makeOutboxRow } from '@/test/factories/emails.factory';
import {
  pickAndProcessBatch,
  reapStuckSending,
  REAP_THRESHOLD_MS,
} from '../outbox';
import { MAX_ATTEMPTS } from '../backoff';

const db = () => emailsTestDb();

beforeAll(() => {
  // Le code sous test appelle getDb() de @/lib/db/client → on l'aiguille sur la
  // MÊME connexion que le harnais (évite toute divergence de visibilité).
  __setTestDb(emailsTestDb() as never);
});

beforeEach(async () => {
  await truncateEmailTables();
  deliveredOutboxIds.length = 0;
  smtpShouldFail = false;
});

afterEach(() => {
  vi.clearAllMocks();
});

afterAll(async () => {
  __resetTestDb();
  await closeTestDb();
});

/** Renseigne une horloge « il y a N minutes » par rapport à maintenant. */
function minutesAgo(min: number): Date {
  return new Date(Date.now() - min * 60_000);
}

describeEmailsDb('reaper — lignes sending orphelines (CHANTIER 1.3)', () => {
  // OBX-INT-001 — une ligne `sending` figée > seuil, avec des tentatives
  // restantes, est requalifiée `pending` (reprise immédiate) avec attempts++ et
  // un lastError parlant indiquant le reap.
  it('requalifie en pending une ligne sending bloquée depuis 15 min (attempts < max)', async () => {
    const row = makeOutboxRow({
      status: 'sending',
      attempts: 1,
      updatedAt: minutesAgo(15),
      lastError: null,
    });
    await db().insert(emailOutbox).values(row);

    const reaped = await reapStuckSending();
    expect(reaped).toBe(1);

    const after = await db().query.emailOutbox.findFirst({
      where: (t) => eq(t.id, row.id),
    });
    expect(after).toBeTruthy();
    expect(after!.status).toBe('pending');
    // Un essai « brûlé » est compté pour ne pas boucler indéfiniment.
    expect(after!.attempts).toBe(2);
    // next_retry posé pour reprise immédiate (pas null).
    expect(after!.nextRetry).toBeInstanceOf(Date);
    // lastError doit parler du reap (traçabilité opérateur).
    expect(after!.lastError).toMatch(/reaped/i);
    expect(after!.lastError).toMatch(/sending/i);
  });

  // OBX-INT-002 — une ligne `sending` figée dont attempts+1 atteint le plafond
  // est envoyée en `dlq` (pas de boucle infinie sur une ligne empoisonnée).
  it('envoie en dlq une ligne sending bloquée au plafond de tentatives', async () => {
    const row = makeOutboxRow({
      status: 'sending',
      attempts: MAX_ATTEMPTS - 1, // +1 → MAX_ATTEMPTS
      maxAttempts: MAX_ATTEMPTS,
      updatedAt: minutesAgo(30),
    });
    await db().insert(emailOutbox).values(row);

    const reaped = await reapStuckSending();
    expect(reaped).toBe(1);

    const after = await db().query.emailOutbox.findFirst({
      where: (t) => eq(t.id, row.id),
    });
    expect(after!.status).toBe('dlq');
    expect(after!.attempts).toBe(MAX_ATTEMPTS);
    expect(after!.nextRetry).toBeNull();
    expect(after!.lastError).toMatch(/reaped/i);
  });

  // OBX-INT-003 — une ligne `sending` RÉCENTE (en cours d'envoi légitime) n'est
  // PAS reapée : on ne tue pas un envoi normal.
  it('ne reape PAS une ligne sending récente (en dessous du seuil)', async () => {
    const fresh = makeOutboxRow({
      status: 'sending',
      attempts: 0,
      // 1 min < seuil 10 min.
      updatedAt: minutesAgo(1),
    });
    await db().insert(emailOutbox).values(fresh);

    const reaped = await reapStuckSending();
    expect(reaped).toBe(0);

    const after = await db().query.emailOutbox.findFirst({
      where: (t) => eq(t.id, fresh.id),
    });
    expect(after!.status).toBe('sending');
    expect(after!.attempts).toBe(0);
  });

  // OBX-INT-004 — bug d'origine reproduit de bout en bout : une ligne sending
  // orpheline est récupérée PAR LE DRAIN (reaper en tête de pickAndProcessBatch)
  // puis effectivement RÉ-ENVOYÉE dans le même tour. C'est le scénario
  // « process crashé après le claim » : sans le fix, l'email serait perdu.
  it('pickAndProcessBatch reape PUIS livre la ligne orpheline dans le même tour', async () => {
    const orphan = makeOutboxRow({
      status: 'sending',
      attempts: 1,
      updatedAt: minutesAgo(20),
    });
    await db().insert(emailOutbox).values(orphan);

    const result = await pickAndProcessBatch();

    expect(result.reaped).toBe(1);
    // Requalifiée pending → claimée → délivrée dans le même appel.
    expect(result.picked).toBe(1);
    expect(result.succeeded).toBe(1);
    expect(deliveredOutboxIds).toContain(orphan.id);

    const after = await db().query.emailOutbox.findFirst({
      where: (t) => eq(t.id, orphan.id),
    });
    expect(after!.status).toBe('sent');
  });

  // OBX-INT-005 — NON-RÉGRESSION : sans aucune ligne sending, le reaper ne
  // requalifie rien et le drain reste un no-op propre.
  it('ne touche aucune ligne quand il n y a pas de sending figé', async () => {
    const pending = makeOutboxRow({ status: 'pending', scheduledFor: null });
    await db().insert(emailOutbox).values(pending);

    const result = await pickAndProcessBatch();
    expect(result.reaped).toBe(0);
    expect(result.succeeded).toBe(1); // la pending normale part bien
  });
});

describeEmailsDb('claim concurrent — FOR UPDATE SKIP LOCKED (CHANTIER 1.3, non-régression)', () => {
  // OBX-INT-006 — 2 drains EN PARALLÈLE sur un même lot de lignes pending :
  // aucune ligne n'est traitée 2× (SKIP LOCKED disjoint les sous-ensembles),
  // et le total livré == nombre de lignes. Garde-fou : le reaper ajouté ne doit
  // pas casser la disjonction du claim.
  it('deux pickAndProcessBatch en parallèle ne livrent aucune ligne 2×', async () => {
    const N = 24;
    const rows = Array.from({ length: N }, () =>
      makeOutboxRow({ status: 'pending', scheduledFor: null, nextRetry: null }),
    );
    await db().insert(emailOutbox).values(rows);

    const [a, b] = await Promise.all([
      pickAndProcessBatch(),
      pickAndProcessBatch(),
    ]);

    // Union des deux lots == exactement les N lignes, sans doublon.
    expect(a.succeeded + b.succeeded).toBe(N);
    const uniqueDelivered = new Set(deliveredOutboxIds);
    expect(uniqueDelivered.size).toBe(N);
    expect(deliveredOutboxIds.length).toBe(N);

    // Toutes les lignes sont en `sent`, aucune restée `sending`/`pending`.
    const all = await db().query.emailOutbox.findMany();
    expect(all.every((r) => r.status === 'sent')).toBe(true);
  });
});
