// @vitest-environment node
/**
 * HLT-F002 — les angles morts du badge santé (F-002), côté `checkEmailingHealth`.
 *
 * Ces oracles ÉTAIENT ROUGES tant que `checkEmailingHealth` ignorait la fraîcheur
 * `delivered` et le heartbeat du cron de drain : le badge restait 🟢 alors que le
 * webhook Stalwart était mort (aucun `delivered` ne revenait) ou que le cron
 * `email-outbox` ne tournait plus (file gelée en silence). Le fix câble ces deux
 * conditions DANS le niveau global (worst-wins) + expose le compteur DLQ.
 *
 * Couverture matrice : DSH-UNIT-044 (fraîcheur delivered influence le niveau),
 * DSH-UNIT-045 (heartbeat cron absent/périmé → incident), PIP-INT-091/F-114
 * (DLQ 24h exposé + dégrade). Tout est déterministe via `now` injecté.
 *
 * Suite VRAIE-DB → DATABASE_URL/DATABASE_URL_TEST sur femiglow_test_health :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test_health#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run --no-file-parallelism \
 *       src/test/integration/emails-health-f002.integration.test.ts
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// env : SMTP configuré → le check `smtpConfigured` reste `ok` et ne pollue pas
// le niveau (on veut isoler les oracles F-002). Le module env parse process.env
// à l'import → on mocke AVANT que health.ts ne l'évalue.
vi.mock('@/lib/env', () => ({
  env: { SMTP_USER: 'smtp-user', SMTP_PASSWORD: 'smtp-pass' },
}));

import { emailOutbox, emailSettings } from '@/lib/db/schema-emails';
import { __setTestDb, __resetTestDb, type DrizzleDb } from '@/lib/db/client';
import {
  closeTestDb,
  emailsTestDb,
  truncateEmailTables,
  describeEmailsDb,
} from '@/test/db/emails-db';
import { makeOutboxRow, resetEmailFactories } from '@/test/factories';
import { checkEmailingHealth } from '@/lib/admin/emails/health';
import {
  OUTBOX_CRON_NAME,
  cronHeartbeatKey,
  recordCronHeartbeat,
} from '@/lib/admin/emails/cron-heartbeat';

/** Instant de référence stable. */
const NOW = new Date('2026-06-04T12:00:00.000Z');
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 60 * 60_000);

/** Pose un heartbeat outbox FRAIS (tick il y a `m` min) — par défaut très récent. */
async function seedFreshHeartbeat(db: any, m = 1): Promise<void> {
  await recordCronHeartbeat(db, OUTBOX_CRON_NAME, { at: minutesAgo(m), processed: 0 });
}

beforeAll(() => {
  __setTestDb(emailsTestDb() as unknown as DrizzleDb);
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
// DSH-UNIT-044 — Fraîcheur delivered câblée dans le niveau
// ════════════════════════════════════════════════════════════════════════════

describeEmailsDb('checkEmailingHealth — fraîcheur delivered (DSH-UNIT-044)', () => {
  // DSH-UNIT-044a — des envois récents + dernier delivered > 24h (≤72h) → degraded.
  it('delivered > 24h avec des envois récents → degraded (webhook qui faiblit)', async () => {
    const db = emailsTestDb();
    await seedFreshHeartbeat(db);
    await db.insert(emailOutbox).values([
      // Envoi récent (le système envoie bien) …
      makeOutboxRow({ status: 'sent', createdAt: hoursAgo(2), updatedAt: hoursAgo(2) }),
      // … mais le dernier delivered date de 30h.
      makeOutboxRow({
        status: 'delivered',
        createdAt: hoursAgo(30),
        updatedAt: hoursAgo(30),
        deliveredAt: hoursAgo(30),
      }),
    ]);

    const report = await checkEmailingHealth(NOW);

    expect(report.checks.deliveredFreshness?.ok).toBe(false);
    expect(report.checks.deliveredFreshness?.level).toBe('degraded');
    expect(report.checks.deliveredFreshness?.recentSent).toBe(true);
    expect(report.level).toBe('degraded'); // câblé DANS le niveau, plus seulement exposé
  });

  // DSH-UNIT-044b — dernier delivered > 72h avec des envois récents → incident.
  it('delivered > 72h avec des envois récents → incident (webhook mort)', async () => {
    const db = emailsTestDb();
    await seedFreshHeartbeat(db);
    await db.insert(emailOutbox).values([
      makeOutboxRow({ status: 'sent', createdAt: hoursAgo(1), updatedAt: hoursAgo(1) }),
      makeOutboxRow({
        status: 'delivered',
        createdAt: hoursAgo(80),
        updatedAt: hoursAgo(80),
        deliveredAt: hoursAgo(80),
      }),
    ]);

    const report = await checkEmailingHealth(NOW);

    expect(report.checks.deliveredFreshness?.level).toBe('incident');
    expect(report.level).toBe('incident');
  });

  // DSH-UNIT-044c — AUCUN delivered alors que des envois récents existent → incident.
  // C'est le symptôme du webhook Stalwart cassé côté RÉCEPTION (W-URL).
  it('jamais delivered malgré des envois récents → incident', async () => {
    const db = emailsTestDb();
    await seedFreshHeartbeat(db);
    await db.insert(emailOutbox).values([
      makeOutboxRow({ status: 'sent', createdAt: hoursAgo(3), updatedAt: hoursAgo(3) }),
      makeOutboxRow({ status: 'sent', createdAt: hoursAgo(5), updatedAt: hoursAgo(5) }),
    ]);

    const report = await checkEmailingHealth(NOW);

    expect(report.checks.lastDeliveredAt).toBeNull();
    expect(report.checks.deliveredFreshness?.recentSent).toBe(true);
    expect(report.checks.deliveredFreshness?.level).toBe('incident');
    expect(report.level).toBe('incident');
  });

  // DSH-UNIT-044d — ZÉRO FAUX POSITIF : aucun envoi récent → la fraîcheur ne
  // dégrade pas (une boîte calme ne doit pas virer au rouge).
  it('aucun envoi récent → fraîcheur ok même sans delivered (pas de faux positif)', async () => {
    const db = emailsTestDb();
    await seedFreshHeartbeat(db);
    // Un seul envoi TRÈS ancien (hors fenêtre 72h) → ne compte pas comme récent.
    await db.insert(emailOutbox).values(
      makeOutboxRow({ status: 'sent', createdAt: hoursAgo(100), updatedAt: hoursAgo(100) }),
    );

    const report = await checkEmailingHealth(NOW);

    expect(report.checks.deliveredFreshness?.recentSent).toBe(false);
    expect(report.checks.deliveredFreshness?.ok).toBe(true);
    expect(report.level).toBe('ok');
  });

  // DSH-UNIT-044e — delivered frais (8 min) + envois récents → ok.
  it('delivered récent → ok (pipeline de réception vivant)', async () => {
    const db = emailsTestDb();
    await seedFreshHeartbeat(db);
    await db.insert(emailOutbox).values([
      makeOutboxRow({ status: 'sent', createdAt: minutesAgo(10), updatedAt: minutesAgo(10) }),
      makeOutboxRow({
        status: 'delivered',
        createdAt: minutesAgo(8),
        updatedAt: minutesAgo(8),
        deliveredAt: minutesAgo(8),
      }),
    ]);

    const report = await checkEmailingHealth(NOW);

    expect(report.checks.deliveredFreshness?.ok).toBe(true);
    expect(report.level).toBe('ok');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// DSH-UNIT-045 — Heartbeat cron câblé dans le niveau (MÊME SUR FILE VIDE)
// ════════════════════════════════════════════════════════════════════════════

describeEmailsDb('checkEmailingHealth — heartbeat cron (DSH-UNIT-045)', () => {
  // DSH-UNIT-045a — heartbeat armé mais périmé (> 15 min) → incident, MÊME SUR
  // FILE VIDE. C'est la seule façon de voir un cron mort quand rien ne s'accumule.
  it('heartbeat périmé (40 min) sur file VIDE → incident', async () => {
    const db = emailsTestDb();
    await recordCronHeartbeat(db, OUTBOX_CRON_NAME, { at: minutesAgo(40), processed: 0 });
    // Aucune ligne outbox : la file est vide.

    const report = await checkEmailingHealth(NOW);

    expect(report.checks.pendingNow).toBe(0);
    expect(report.checks.cronHeartbeat?.stale).toBe(true);
    expect(report.checks.cronHeartbeat?.ageMs).toBe(40 * 60_000);
    expect(report.level).toBe('incident'); // cron muet rendu visible
  });

  // DSH-UNIT-045b — heartbeat frais (1 min) → ok (cron vivant, rien à drainer).
  it('heartbeat frais → ok (cron vivant)', async () => {
    const db = emailsTestDb();
    await recordCronHeartbeat(db, OUTBOX_CRON_NAME, { at: minutesAgo(1), processed: 0 });

    const report = await checkEmailingHealth(NOW);

    expect(report.checks.cronHeartbeat?.stale).toBe(false);
    expect(report.checks.cronHeartbeat?.ok).toBe(true);
    expect(report.level).toBe('ok');
  });

  // DSH-UNIT-045c — AUCUN heartbeat (mécanisme non initialisé) → on ne conclut
  // PAS « cron mort » (évite le faux incident sur base vierge / premier déploiement).
  it('aucun heartbeat → pas d\'incident faux-positif (mécanisme non armé)', async () => {
    const db = emailsTestDb();
    // Pas de recordCronHeartbeat : aucune ligne `cron:email-outbox:last_tick`.

    const report = await checkEmailingHealth(NOW);

    expect(report.checks.cronHeartbeat?.lastTickAt).toBeNull();
    expect(report.checks.cronHeartbeat?.stale).toBe(false);
    expect(report.level).toBe('ok');
  });

  // DSH-UNIT-045d — l'idempotence du heartbeat : un double tick n'écrit qu'UNE
  // ligne (upsert), et le health check lit le tick le plus récent.
  it('double tick = upsert (une seule ligne, dernier tick gagnant)', async () => {
    const db = emailsTestDb();
    await recordCronHeartbeat(db, OUTBOX_CRON_NAME, { at: minutesAgo(40), processed: 3 });
    await recordCronHeartbeat(db, OUTBOX_CRON_NAME, { at: minutesAgo(1), processed: 0 });

    const rows = await db
      .select({ key: emailSettings.key })
      .from(emailSettings);
    const hbRows = rows.filter((r: { key: string }) => r.key === cronHeartbeatKey(OUTBOX_CRON_NAME));
    expect(hbRows).toHaveLength(1);

    const report = await checkEmailingHealth(NOW);
    expect(report.checks.cronHeartbeat?.ageMs).toBe(1 * 60_000); // dernier tick
    expect(report.level).toBe('ok');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// PIP-INT-091 / F-114 — DLQ 24h exposé + dégrade
// ════════════════════════════════════════════════════════════════════════════

describeEmailsDb('checkEmailingHealth — DLQ visible (PIP-INT-091 / F-114)', () => {
  // PIP-INT-091a — dlq > 0 sur 24h glissantes → degraded + compte exposé.
  it('dlq > 0 sur 24h → degraded + count exposé dans le payload', async () => {
    const db = emailsTestDb();
    await seedFreshHeartbeat(db);
    await db.insert(emailOutbox).values([
      makeOutboxRow({ status: 'dlq', createdAt: hoursAgo(2), updatedAt: hoursAgo(2) }),
      makeOutboxRow({ status: 'dlq', createdAt: hoursAgo(10), updatedAt: hoursAgo(10) }),
      makeOutboxRow({ status: 'dlq', createdAt: hoursAgo(23), updatedAt: hoursAgo(23) }),
    ]);

    const report = await checkEmailingHealth(NOW);

    expect(report.checks.dlq24h.count).toBe(3);
    expect(report.checks.dlq24h.ok).toBe(true); // ≤ 10 → pas incident…
    expect(report.level).toBe('degraded'); // … mais dlq>0 dégrade
  });

  // PIP-INT-091b — DLQ hors fenêtre 24h → non compté (fenêtre glissante).
  it('dlq > 24h → hors fenêtre, non compté', async () => {
    const db = emailsTestDb();
    await seedFreshHeartbeat(db);
    await db.insert(emailOutbox).values(
      makeOutboxRow({ status: 'dlq', createdAt: hoursAgo(30), updatedAt: hoursAgo(30) }),
    );

    const report = await checkEmailingHealth(NOW);

    expect(report.checks.dlq24h.count).toBe(0);
    expect(report.level).toBe('ok');
  });

  // PIP-INT-091c — dlq > 10 sur 24h → incident (seuil haut).
  it('dlq > 10 sur 24h → incident', async () => {
    const db = emailsTestDb();
    await seedFreshHeartbeat(db);
    const rows = Array.from({ length: 11 }, (_, i) =>
      makeOutboxRow({ status: 'dlq', createdAt: hoursAgo(1 + i * 0.1), updatedAt: hoursAgo(1) }),
    );
    await db.insert(emailOutbox).values(rows);

    const report = await checkEmailingHealth(NOW);

    expect(report.checks.dlq24h.count).toBe(11);
    expect(report.level).toBe('incident');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Composition worst-wins — F-002 ne casse pas les checks existants
// ════════════════════════════════════════════════════════════════════════════

describeEmailsDb('checkEmailingHealth — composition F-002 (worst-wins)', () => {
  // HLT-F002-COMPO-1 — système pleinement sain (heartbeat frais, delivered frais,
  // 0 dlq) → ok : zéro faux positif des nouveaux checks réunis.
  it('système pleinement sain → ok', async () => {
    const db = emailsTestDb();
    await seedFreshHeartbeat(db);
    await db.insert(emailOutbox).values([
      makeOutboxRow({ status: 'sent', createdAt: minutesAgo(12), updatedAt: minutesAgo(12) }),
      makeOutboxRow({
        status: 'delivered',
        createdAt: minutesAgo(9),
        updatedAt: minutesAgo(9),
        deliveredAt: minutesAgo(9),
      }),
    ]);

    const report = await checkEmailingHealth(NOW);
    expect(report.level).toBe('ok');
  });

  // HLT-F002-COMPO-2 — cron mort (heartbeat périmé) + delivered qui faiblit (>24h)
  // → le pire l'emporte : incident (heartbeat) écrase le degraded (fraîcheur).
  it('cron périmé (incident) + fraîcheur degraded → incident (worst-wins)', async () => {
    const db = emailsTestDb();
    await recordCronHeartbeat(db, OUTBOX_CRON_NAME, { at: minutesAgo(40), processed: 0 });
    await db.insert(emailOutbox).values([
      makeOutboxRow({ status: 'sent', createdAt: hoursAgo(2), updatedAt: hoursAgo(2) }),
      makeOutboxRow({
        status: 'delivered',
        createdAt: hoursAgo(30),
        updatedAt: hoursAgo(30),
        deliveredAt: hoursAgo(30),
      }),
    ]);

    const report = await checkEmailingHealth(NOW);
    expect(report.checks.deliveredFreshness?.level).toBe('degraded');
    expect(report.checks.cronHeartbeat?.stale).toBe(true);
    expect(report.level).toBe('incident');
  });
});
