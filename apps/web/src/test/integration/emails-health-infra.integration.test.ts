// @vitest-environment node
/**
 * HLT-INT — health emailing « qui voit les pannes réelles » (chantier 1.2, code).
 *
 * Deux familles d'oracles, dans UN SEUL fichier (lifecycle DB partagé : une
 * connexion postgres-js, un truncate par test) — c'est volontaire : deux suites
 * vraie-DB pointées sur la MÊME base (femiglow_test_health) ne doivent pas tourner
 * en parallèle (TRUNCATE concurrents → deadlock + lignes croisées). Tout regrouper
 * dans un fichier garantit l'exécution séquentielle quelle que soit l'invocation.
 *
 * A. checkEmailingInfraHealth(db, now) — fonction pure des 3 checks :
 *    (a) webhook silencieux : emails `sent` sur 7j mais 0 event `delivered`.
 *    (b) cron outbox en retard : lignes éligibles au pickup en retard > 15 min.
 *    (c) sending bloqué : lignes `sending` figées > 15 min (reaper muet).
 *    (d) état sain → tous ok, level ok (zéro faux positif).
 *
 * B. GET /api/admin/emails/health — composition ADDITIVE : le handler conserve
 *    tout le contrat de base (`checks.smtpConfigured`/`outboxStuck`/`dlq24h`/
 *    `pendingNow`/`lastDeliveredAt`, lus explicitement par l'UI) ET ajoute les 3
 *    checks infra ; le `level` global = pire des deux. Sans ça, le webhook mort
 *    laissait le badge `ok` (régression P0 verrouillée par HLT-INT-022).
 *
 * Suite VRAIE-DB → DATABASE_URL/DATABASE_URL_TEST sur femiglow_test_health :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test_health#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run src/test/integration/emails-health-infra.integration.test.ts
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminSession } from '@/lib/auth/session';

// — Mocks hoistés (pour la famille B : exercice du route handler) —
// requireAdmin : on shunt l'auth (pas de cookie Next en contexte node).
const sessionMock: AdminSession = {
  adminId: 'adm_test_health',
  email: 'admin@femiglow.ma',
  issuedAt: Date.now(),
  expiresAt: Date.now() + 1000 * 60 * 60,
};
vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: () => Promise.resolve(sessionMock),
  requireAdmin: () => Promise.resolve(sessionMock),
}));

// env : SMTP configuré pour que le check de base `smtpConfigured` reste `ok`
// (sinon il pollue le `level` et masque l'oracle des checks infra).
vi.mock('@/lib/env', () => ({
  env: { SMTP_USER: 'smtp-user', SMTP_PASSWORD: 'smtp-pass' },
}));

import { emailOutbox, emailEvent } from '@/lib/db/schema-emails';
import { __setTestDb, __resetTestDb, type DrizzleDb } from '@/lib/db/client';
import {
  closeTestDb,
  emailsTestDb,
  truncateEmailTables,
  describeEmailsDb,
} from '@/test/db/emails-db';
import { makeOutboxRow, makeEmailEvent, resetEmailFactories } from '@/test/factories';
import {
  checkEmailingInfraHealth,
  CRON_LATE_THRESHOLD_MS,
  WEBHOOK_SILENCE_WINDOW_MS,
} from '@/app/api/admin/emails/health/checks';
import { GET } from '@/app/api/admin/emails/health/route';

/** Instant de référence stable pour les calculs d'âge de la famille A. */
const NOW = new Date('2026-06-04T12:00:00.000Z');

const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 24 * 60 * 60_000);

// La famille B passe par `db()` du client applicatif → on l'aligne sur Date.now()
// (le route handler appelle checkEmailingInfraHealth() avec now=new Date()).
const realDaysAgo = (d: number) => new Date(Date.now() - d * 24 * 60 * 60_000);
const realMinAgo = (m: number) => new Date(Date.now() - m * 60_000);

beforeAll(() => {
  const db = emailsTestDb();
  // Le route handler lit `db()` de @/lib/db/client → on lui injecte la même
  // instance de test (cast : schéma de test plus large, mêmes tables SQL).
  __setTestDb(db as unknown as DrizzleDb);
});

beforeEach(async () => {
  await truncateEmailTables();
  resetEmailFactories();
});

afterAll(async () => {
  __resetTestDb();
  await closeTestDb();
});

// ════════════════════════════════════════════════════════════════════════════
// A. Fonction pure checkEmailingInfraHealth(db, now)
// ════════════════════════════════════════════════════════════════════════════

describeEmailsDb('checkEmailingInfraHealth — webhook silencieux (HLT-INT-001..003)', () => {
  // HLT-INT-001 — emails `sent` sur 7j mais 0 event `delivered` → incident webhook.
  it('détecte le webhook silencieux : des emails partent mais aucun event delivered ne revient', async () => {
    const db = emailsTestDb();
    await db.insert(emailOutbox).values([
      makeOutboxRow({ status: 'sent', createdAt: daysAgo(1), updatedAt: daysAgo(1) }),
      makeOutboxRow({ status: 'sent', createdAt: daysAgo(2), updatedAt: daysAgo(2) }),
      makeOutboxRow({ status: 'opened', createdAt: daysAgo(3), updatedAt: daysAgo(3) }),
      makeOutboxRow({ status: 'bounced_permanent', createdAt: daysAgo(4), updatedAt: daysAgo(4) }),
    ]);

    const { checks, level } = await checkEmailingInfraHealth(db, NOW);

    expect(checks.webhookSilent.sentLast7d).toBe(4);
    expect(checks.webhookSilent.deliveredEventsLast7d).toBe(0);
    expect(checks.webhookSilent.ok).toBe(false);
    expect(level).toBe('incident');
  });

  // HLT-INT-002 — des events `delivered` arrivent bien → pas de faux positif.
  it('ne signale PAS le webhook si des events delivered arrivent', async () => {
    const db = emailsTestDb();
    const [outbox] = await db
      .insert(emailOutbox)
      .values(makeOutboxRow({ status: 'sent', createdAt: daysAgo(1), updatedAt: daysAgo(1) }))
      .returning();
    await db.insert(emailEvent).values(
      makeEmailEvent({ outboxId: outbox!.id, type: 'delivered', ts: daysAgo(1) }),
    );

    const { checks, level } = await checkEmailingInfraHealth(db, NOW);

    expect(checks.webhookSilent.sentLast7d).toBe(1);
    expect(checks.webhookSilent.deliveredEventsLast7d).toBe(1);
    expect(checks.webhookSilent.ok).toBe(true);
    expect(level).toBe('ok');
  });

  // HLT-INT-003 — event `delivered` HORS fenêtre 7j → toujours silencieux.
  it('ignore les events delivered antérieurs à la fenêtre de 7 jours', async () => {
    const db = emailsTestDb();
    const [outbox] = await db
      .insert(emailOutbox)
      .values(makeOutboxRow({ status: 'sent', createdAt: daysAgo(1), updatedAt: daysAgo(1) }))
      .returning();
    const tooOld = new Date(NOW.getTime() - WEBHOOK_SILENCE_WINDOW_MS - 60_000);
    await db.insert(emailEvent).values(
      makeEmailEvent({ outboxId: outbox!.id, type: 'delivered', ts: tooOld }),
    );

    const { checks, level } = await checkEmailingInfraHealth(db, NOW);

    expect(checks.webhookSilent.deliveredEventsLast7d).toBe(0);
    expect(checks.webhookSilent.ok).toBe(false);
    expect(level).toBe('incident');
  });
});

describeEmailsDb('checkEmailingInfraHealth — cron outbox en retard (HLT-INT-004..006)', () => {
  // HLT-INT-004 — lignes pending/failed éligibles en retard > 15 min → incident cron.
  it('détecte les lignes pending éligibles non ramassées depuis > 15 min', async () => {
    const db = emailsTestDb();
    await db.insert(emailOutbox).values([
      makeOutboxRow({
        status: 'pending',
        nextRetry: null,
        createdAt: minutesAgo(20),
        updatedAt: minutesAgo(20),
      }),
      makeOutboxRow({
        status: 'failed',
        nextRetry: minutesAgo(30),
        createdAt: minutesAgo(40),
        updatedAt: minutesAgo(35),
      }),
    ]);

    const { checks, level } = await checkEmailingInfraHealth(db, NOW);

    expect(checks.cronOutboxLate.lateCount).toBe(2);
    expect(checks.cronOutboxLate.ok).toBe(false);
    // Le plus ancien éligible : next_retry du `failed` (30 min) — l'ancrage est
    // next_retry quand présent, sinon created_at.
    expect(checks.cronOutboxLate.oldestEligibleAgeMs).toBe(30 * 60_000);
    expect(level).toBe('incident');
  });

  // HLT-INT-005 — pending récent (< 15 min) → cron a juste eu son tick, ok.
  it('ne signale PAS un pending récent (cron a juste eu son tick)', async () => {
    const db = emailsTestDb();
    await db.insert(emailOutbox).values(
      makeOutboxRow({
        status: 'pending',
        nextRetry: null,
        createdAt: minutesAgo(5),
        updatedAt: minutesAgo(5),
      }),
    );

    const { checks, level } = await checkEmailingInfraHealth(db, NOW);

    expect(checks.cronOutboxLate.lateCount).toBe(0);
    expect(checks.cronOutboxLate.ok).toBe(true);
    expect(level).toBe('ok');
  });

  // HLT-INT-006 — pending vieux mais next_retry DANS LE FUTUR → pas éligible, ok.
  it("n'inclut PAS un pending dont le next_retry est encore dans le futur (backoff légitime)", async () => {
    const db = emailsTestDb();
    await db.insert(emailOutbox).values(
      makeOutboxRow({
        status: 'failed',
        nextRetry: new Date(NOW.getTime() + 10 * 60_000),
        createdAt: minutesAgo(60),
        updatedAt: minutesAgo(20),
      }),
    );

    const { checks, level } = await checkEmailingInfraHealth(db, NOW);

    expect(checks.cronOutboxLate.lateCount).toBe(0);
    expect(checks.cronOutboxLate.ok).toBe(true);
    expect(level).toBe('ok');
  });
});

describeEmailsDb('checkEmailingInfraHealth — sending bloqué / reaper muet (HLT-INT-007..008)', () => {
  // HLT-INT-007 — lignes `sending` figées > 15 min → incident reaper.
  it('détecte les lignes sending figées depuis > 15 min', async () => {
    const db = emailsTestDb();
    await db.insert(emailOutbox).values([
      makeOutboxRow({ status: 'sending', createdAt: minutesAgo(40), updatedAt: minutesAgo(40) }),
      makeOutboxRow({ status: 'sending', createdAt: minutesAgo(25), updatedAt: minutesAgo(18) }),
    ]);

    const { checks, level } = await checkEmailingInfraHealth(db, NOW);

    expect(checks.sendingStuck.stuckCount).toBe(2);
    expect(checks.sendingStuck.ok).toBe(false);
    expect(checks.sendingStuck.oldestStuckAgeMs).toBe(40 * 60_000);
    expect(level).toBe('incident');
  });

  // HLT-INT-008 — sending récent (< 15 min, envoi en cours légitime) → ok.
  it('ne signale PAS un sending récent (envoi SMTP en cours)', async () => {
    const db = emailsTestDb();
    await db.insert(emailOutbox).values(
      makeOutboxRow({ status: 'sending', createdAt: minutesAgo(2), updatedAt: minutesAgo(1) }),
    );

    const { checks, level } = await checkEmailingInfraHealth(db, NOW);

    expect(checks.sendingStuck.stuckCount).toBe(0);
    expect(checks.sendingStuck.ok).toBe(true);
    expect(level).toBe('ok');
  });
});

describeEmailsDb('checkEmailingInfraHealth — état sain (HLT-INT-009..011)', () => {
  // HLT-INT-009 — système sain → tous checks ok, level ok (zéro faux positif).
  it('ne déclenche AUCUN check sur un état sain', async () => {
    const db = emailsTestDb();
    const [out1] = await db
      .insert(emailOutbox)
      .values(
        makeOutboxRow({
          status: 'delivered',
          createdAt: daysAgo(1),
          updatedAt: daysAgo(1),
          deliveredAt: daysAgo(1),
        }),
      )
      .returning();
    await db.insert(emailEvent).values(
      makeEmailEvent({ outboxId: out1!.id, type: 'delivered', ts: daysAgo(1) }),
    );
    await db.insert(emailOutbox).values(
      makeOutboxRow({ status: 'pending', nextRetry: null, createdAt: minutesAgo(1), updatedAt: minutesAgo(1) }),
    );
    await db.insert(emailOutbox).values(
      makeOutboxRow({ status: 'sending', createdAt: minutesAgo(1), updatedAt: minutesAgo(1) }),
    );

    const { checks, level } = await checkEmailingInfraHealth(db, NOW);

    expect(checks.webhookSilent.ok).toBe(true);
    expect(checks.cronOutboxLate.ok).toBe(true);
    expect(checks.cronOutboxLate.lateCount).toBe(0);
    expect(checks.cronOutboxLate.oldestEligibleAgeMs).toBeNull();
    expect(checks.sendingStuck.ok).toBe(true);
    expect(checks.sendingStuck.oldestStuckAgeMs).toBeNull();
    expect(level).toBe('ok');
  });

  // HLT-INT-010 — base vide → tous ok (sentLast7d=0 désactive le check webhook).
  it('reste ok sur une base vide (aucun envoi → pas de panne possible)', async () => {
    const db = emailsTestDb();
    const { checks, level } = await checkEmailingInfraHealth(db, NOW);

    expect(checks.webhookSilent.sentLast7d).toBe(0);
    expect(checks.webhookSilent.ok).toBe(true);
    expect(checks.cronOutboxLate.ok).toBe(true);
    expect(checks.sendingStuck.ok).toBe(true);
    expect(level).toBe('ok');
  });

  // HLT-INT-011 — garde-fou sur la constante de seuil (cohérence d'intention).
  it('utilise un seuil de retard de 15 minutes', () => {
    expect(CRON_LATE_THRESHOLD_MS).toBe(15 * 60_000);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// B. Composition du route handler GET /api/admin/emails/health
// ════════════════════════════════════════════════════════════════════════════

async function callHealth(): Promise<{ status: number; body: Record<string, any> }> {
  const res = await GET();
  return { status: res.status, body: await res.json() };
}

describeEmailsDb('GET /api/admin/emails/health — composition additive (HLT-INT-021..024)', () => {
  // HLT-INT-021 — base saine + infra saine → tout ok, contrat de base intact.
  // Le dernier `delivered` est FRAIS (8 min) — un état réellement sain au sens
  // de la fraîcheur F-002 : la livraison la plus récente est bien en deçà du
  // seuil de warn (24h). (Auparavant `realDaysAgo(1)` flirtait avec le seuil et
  // basculait `degraded` au moindre drift d'horloge — pas un système « sain ».)
  it('préserve le contrat de base et renvoie ok quand tout est sain', async () => {
    const db = emailsTestDb();
    const [out] = await db
      .insert(emailOutbox)
      .values(
        makeOutboxRow({
          status: 'delivered',
          createdAt: realMinAgo(8),
          updatedAt: realMinAgo(8),
          deliveredAt: realMinAgo(8),
        }),
      )
      .returning();
    await db.insert(emailEvent).values(
      makeEmailEvent({ outboxId: out!.id, type: 'delivered', ts: realMinAgo(8) }),
    );

    const { status, body } = await callHealth();

    expect(status).toBe(200);
    // Contrat de base préservé (champs lus par l'UI).
    expect(body.checks.smtpConfigured.ok).toBe(true);
    expect(body.checks.db.ok).toBe(true);
    expect(body.checks.outboxStuck).toBeDefined();
    expect(body.checks.dlq24h).toBeDefined();
    expect(body.checks).toHaveProperty('pendingNow');
    expect(body.checks).toHaveProperty('lastDeliveredAt');
    // Nouveaux checks additifs présents.
    expect(body.checks.webhookSilent.ok).toBe(true);
    expect(body.checks.cronOutboxLate.ok).toBe(true);
    expect(body.checks.sendingStuck.ok).toBe(true);
    expect(body.level).toBe('ok');
  });

  // HLT-INT-022 — RÉGRESSION P0 : webhook mort → level incident (avant : ok).
  it('passe en incident quand le webhook est mort (emails sent, aucun delivered)', async () => {
    const db = emailsTestDb();
    await db.insert(emailOutbox).values([
      makeOutboxRow({ status: 'sent', createdAt: realDaysAgo(1), updatedAt: realDaysAgo(1) }),
      makeOutboxRow({ status: 'sent', createdAt: realDaysAgo(2), updatedAt: realDaysAgo(2) }),
    ]);

    const { body } = await callHealth();

    // Le check de base outboxStuck reste ok (aucune ligne en `sending`) — c'est
    // précisément pourquoi l'ancien badge restait vert.
    expect(body.checks.outboxStuck.ok).toBe(true);
    expect(body.checks.webhookSilent.ok).toBe(false);
    expect(body.checks.webhookSilent.sentLast7d).toBe(2);
    expect(body.checks.webhookSilent.deliveredEventsLast7d).toBe(0);
    expect(body.level).toBe('incident');
  });

  // HLT-INT-023 — cron outbox en retard → incident, base par ailleurs saine.
  it('passe en incident quand des lignes éligibles traînent depuis > 15 min', async () => {
    const db = emailsTestDb();
    await db.insert(emailOutbox).values(
      makeOutboxRow({
        status: 'pending',
        nextRetry: null,
        createdAt: realMinAgo(30),
        updatedAt: realMinAgo(30),
      }),
    );

    const { body } = await callHealth();

    expect(body.checks.cronOutboxLate.ok).toBe(false);
    expect(body.checks.cronOutboxLate.lateCount).toBe(1);
    expect(body.level).toBe('incident');
  });

  // HLT-INT-024 — sending bloqué → incident.
  it('passe en incident quand des lignes sending sont figées > 15 min', async () => {
    const db = emailsTestDb();
    await db.insert(emailOutbox).values(
      makeOutboxRow({ status: 'sending', createdAt: realMinAgo(30), updatedAt: realMinAgo(30) }),
    );

    const { body } = await callHealth();

    expect(body.checks.sendingStuck.ok).toBe(false);
    expect(body.checks.sendingStuck.stuckCount).toBe(1);
    expect(body.level).toBe('incident');
  });
});
