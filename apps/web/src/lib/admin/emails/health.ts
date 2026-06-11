/**
 * Health check for the emailing stack (M2).
 *
 * Probes that all the moving parts are functional :
 *  - DB reachable (count outbox rows last hour)
 *  - SMTP transport configured (env vars present)
 *  - Outbox not stuck (no row stuck in 'sending' > 5 min)
 *  - DLQ size acceptable (< 10 last 24h)
 *  - Last delivered timestamp (was anything ever delivered?)
 *
 * Returns a structured report consumable by the admin badge AND by external
 * monitoring (the route /api/admin/emails/health exposes this).
 */
import 'server-only';
import { and, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { db as getDb } from '@/lib/db/client';
import { emailOutbox } from '@/lib/db/schema-emails';
import { env } from '@/lib/env';
import {
  CRON_HEARTBEAT_STALE_MS,
  OUTBOX_CRON_NAME,
  readCronHeartbeat,
} from '@/lib/admin/emails/cron-heartbeat';

export type HealthLevel = 'ok' | 'degraded' | 'incident';

/**
 * Fraîcheur `delivered` — F-002. Tant que des envois récents existent, on
 * attend des accusés de réception. Leur absence trahit un webhook mort.
 *  - dernier delivered > 24h (mais ≤ 72h) → `degraded` (warn).
 *  - dernier delivered > 72h OU jamais delivered → `incident`.
 */
export const DELIVERED_WARN_MS = 24 * 60 * 60_000;
export const DELIVERED_INCIDENT_MS = 72 * 60 * 60_000;

export type HealthReport = {
  level: HealthLevel;
  checks: {
    smtpConfigured: { ok: boolean; missing?: string[] };
    db: { ok: boolean; error?: string };
    outboxStuck: { ok: boolean; stuckCount: number };
    dlq24h: { ok: boolean; count: number };
    pendingNow: number;
    lastDeliveredAt: Date | null;
    /**
     * Fraîcheur de réception (F-002). `recentSent` = des envois ont eu lieu
     * dans la fenêtre d'incident → on est en droit d'attendre des `delivered`.
     * `ageMs` = âge du dernier delivered (null si jamais).
     *
     * Optionnel dans le TYPE pour préserver le contrat des consommateurs
     * présentationnels existants (le badge lit les champs explicitement) ; le
     * producteur `checkEmailingHealth` le renseigne TOUJOURS.
     */
    deliveredFreshness?: {
      ok: boolean;
      level: HealthLevel;
      ageMs: number | null;
      recentSent: boolean;
    };
    /**
     * Heartbeat du cron de drain (F-002). `lastTickAt` null + envois en attente
     * possibles → cron muet. `stale` = pas de tick depuis le seuil.
     */
    cronHeartbeat?: {
      ok: boolean;
      lastTickAt: Date | null;
      ageMs: number | null;
      stale: boolean;
    };
  };
  timestamp: string;
};

export async function checkEmailingHealth(now: Date = new Date()): Promise<HealthReport> {
  const issues: HealthLevel[] = ['ok'];

  // 1. SMTP env config
  const missingSmtp: string[] = [];
  if (!env.SMTP_USER) missingSmtp.push('SMTP_USER');
  if (!env.SMTP_PASSWORD) missingSmtp.push('SMTP_PASSWORD');
  const smtpConfigured = { ok: missingSmtp.length === 0, missing: missingSmtp };
  if (!smtpConfigured.ok) issues.push('incident');

  // 2. DB reachable
  const drizzle = getDb();
  let dbOk = true;
  let dbError: string | undefined;
  if (!drizzle) {
    dbOk = false;
    dbError = 'Database not configured';
    issues.push('incident');
  }

  let stuckCount = 0;
  let dlqCount = 0;
  let pendingNow = 0;
  let lastDeliveredAt: Date | null = null;
  let recentSent = false;
  let cronLastTickAt: Date | null = null;
  let cronHeartbeatPresent = false;

  if (drizzle && dbOk) {
    try {
      // 3. Stuck in 'sending' > 5 min
      const fiveMinAgo = new Date(now.getTime() - 5 * 60_000);
      const [stuck] = await drizzle
        .select({ n: sql<number>`count(*)::int` })
        .from(emailOutbox)
        .where(and(eq(emailOutbox.status, 'sending'), lte(emailOutbox.updatedAt, fiveMinAgo)));
      stuckCount = stuck?.n ?? 0;
      if (stuckCount > 0) issues.push('degraded');

      // 4. DLQ last 24h
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60_000);
      const [dlq] = await drizzle
        .select({ n: sql<number>`count(*)::int` })
        .from(emailOutbox)
        .where(and(eq(emailOutbox.status, 'dlq'), gte(emailOutbox.createdAt, dayAgo)));
      dlqCount = dlq?.n ?? 0;
      if (dlqCount > 10) issues.push('incident');
      else if (dlqCount > 0) issues.push('degraded');

      // 5. Pending now
      const [pending] = await drizzle
        .select({ n: sql<number>`count(*)::int` })
        .from(emailOutbox)
        .where(eq(emailOutbox.status, 'pending'));
      pendingNow = pending?.n ?? 0;
      if (pendingNow > 50) issues.push('degraded');

      // 6. Last delivered
      const [last] = await drizzle
        .select({ at: emailOutbox.deliveredAt })
        .from(emailOutbox)
        .where(eq(emailOutbox.status, 'delivered'))
        .orderBy(sql`${emailOutbox.deliveredAt} DESC NULLS LAST`)
        .limit(1);
      lastDeliveredAt = last?.at ?? null;

      // 7. Envois récents (F-002) — y a-t-il eu des envois dans la fenêtre
      // d'incident (72h) ? Si oui, l'absence de delivered devient une anomalie.
      const incidentWindowAgo = new Date(now.getTime() - DELIVERED_INCIDENT_MS);
      const [recent] = await drizzle
        .select({ n: sql<number>`count(*)::int` })
        .from(emailOutbox)
        .where(
          and(
            inArray(emailOutbox.status, [
              'sent',
              'delivered',
              'opened',
              'clicked',
              'bounced_soft',
              'bounced_permanent',
            ]),
            gte(emailOutbox.createdAt, incidentWindowAgo),
          ),
        );
      recentSent = (recent?.n ?? 0) > 0;

      // 8. Heartbeat du cron de drain (F-002) — câblé dans le NIVEAU.
      const hb = await readCronHeartbeat(drizzle, OUTBOX_CRON_NAME);
      cronHeartbeatPresent = hb.present;
      cronLastTickAt = hb.lastTickAt;
    } catch (err) {
      dbOk = false;
      dbError = err instanceof Error ? err.message : String(err);
      issues.push('incident');
    }
  }

  // — Fraîcheur delivered (F-002) — câblée DANS le niveau —
  // On n'évalue la fraîcheur QUE si des envois récents existent (sinon une base
  // calme — aucun envoi — ne doit pas virer au rouge à tort).
  const deliveredAgeMs = lastDeliveredAt ? now.getTime() - lastDeliveredAt.getTime() : null;
  let deliveredLevel: HealthLevel = 'ok';
  if (dbOk && recentSent) {
    if (deliveredAgeMs === null || deliveredAgeMs > DELIVERED_INCIDENT_MS) {
      // jamais delivered malgré des envois, ou dernier delivered > 72h.
      deliveredLevel = 'incident';
    } else if (deliveredAgeMs > DELIVERED_WARN_MS) {
      deliveredLevel = 'degraded';
    }
  }
  if (deliveredLevel !== 'ok') issues.push(deliveredLevel);
  const deliveredFreshness = {
    ok: deliveredLevel === 'ok',
    level: deliveredLevel,
    ageMs: deliveredAgeMs,
    recentSent,
  };

  // — Heartbeat cron (F-002) — câblé DANS le niveau, MÊME SUR FILE VIDE —
  // Un heartbeat ARMÉ (le cron a déjà tické au moins une fois) mais dont le
  // dernier tick dépasse le seuil ⇒ le drain est mort : incident (badge rouge,
  // actionnable). Le seuil s'applique indépendamment du contenu de la file —
  // c'est précisément ce qui rend la panne visible sur une file vide. Si AUCUN
  // heartbeat n'existe (mécanisme non initialisé), on ne conclut rien.
  const cronAgeMs = cronLastTickAt ? now.getTime() - cronLastTickAt.getTime() : null;
  const cronStale =
    dbOk &&
    cronHeartbeatPresent &&
    (cronLastTickAt === null || (cronAgeMs ?? Number.POSITIVE_INFINITY) > CRON_HEARTBEAT_STALE_MS);
  if (cronStale) issues.push('incident');
  const cronHeartbeat = {
    ok: !cronStale,
    lastTickAt: cronLastTickAt,
    ageMs: cronAgeMs,
    stale: cronStale,
  };

  // Compute overall level (worst wins)
  const level: HealthLevel = issues.includes('incident')
    ? 'incident'
    : issues.includes('degraded')
      ? 'degraded'
      : 'ok';

  return {
    level,
    checks: {
      smtpConfigured,
      db: { ok: dbOk, error: dbError },
      outboxStuck: { ok: stuckCount === 0, stuckCount },
      dlq24h: { ok: dlqCount <= 10, count: dlqCount },
      pendingNow,
      lastDeliveredAt,
      deliveredFreshness,
      cronHeartbeat,
    },
    timestamp: now.toISOString(),
  };
}
