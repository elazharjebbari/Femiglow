/**
 * Checks d'infrastructure emailing — extension du health check (chantier 1.2).
 *
 * Le health check historique (`lib/admin/emails/health.ts`) ne « voit » que
 * l'intérieur de l'outbox (stuck en `sending` > 5 min, DLQ, pending). Il reste
 * AVEUGLE à deux pannes P0 réelles constatées en prod :
 *
 *   1. WEBHOOK STALWART MORT — des emails sont marqués `sent` mais plus aucun
 *      `email_event` de type `delivered` n'arrive (le webhook Stalwart pointe sur
 *      une route inexistante → 64k erreurs/jour). Le badge restait VERT car
 *      l'outbox n'est pas « stuck » : les lignes passent juste à `sent` et n'ont
 *      jamais leur statut promu en `delivered` faute d'event entrant.
 *
 *   2. CRON OUTBOX / REAPER SANS TIMER — les crons emailing (email-outbox,
 *      email-automation, …) n'ont pas de timer systemd en prod (déploiement
 *      single-instance, pas de scheduler Vercel). Conséquences observables en DB :
 *        - des lignes `pending`/`failed` éligibles au pickup (next_retry échu)
 *          s'accumulent sans jamais être ramassées (le claim tourne chaque minute
 *          quand le cron est vivant) ;
 *        - des lignes `sending` orphelines (process redémarré entre claim et
 *          statut terminal) que le reaper aurait dû requalifier (REAP_THRESHOLD =
 *          10 min) restent figées.
 *
 * Ce module ajoute 3 checks SQL agrégés (une requête each, `count(*)`/`max()`),
 * branchés ADDITIVEMENT sur le rapport existant par la route. Aucun champ
 * existant n'est modifié → l'UI du dashboard (qui lit `checks.smtpConfigured`,
 * `checks.outboxStuck`, … explicitement) continue de fonctionner.
 *
 * Les seuils opérationnels :
 *  - webhook silencieux : `sent > 0` sur 7j ET 0 event `delivered` sur 7j.
 *  - cron outbox en retard : ligne `pending`/`failed` éligible (next_retry échu
 *    ou nul) dont l'échéance (`next_retry`, à défaut `created_at`) date de plus de
 *    15 min — le claim tourne chaque minute, 15 min = ~15 ticks ratés.
 *  - sending bloqué : ligne `sending` dont `updated_at` date de plus de 15 min —
 *    au-dessus du seuil du reaper (10 min), donc le reaper lui-même est muet.
 */
import { and, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';

import { emailOutbox, emailEvent } from '@/lib/db/schema-emails';
import type { HealthLevel } from '@/lib/admin/emails/health';

/** Fenêtre d'observation pour le webhook silencieux : 7 jours (= fenêtre KPI). */
export const WEBHOOK_SILENCE_WINDOW_MS = 7 * 24 * 60 * 60_000;

/**
 * Retard toléré avant d'alerter sur le cron outbox / le reaper : 15 min.
 * - cron claim : tourne chaque minute → 15 min d'éligibilité = cron muet.
 * - reaper : seuil interne 10 min (REAP_THRESHOLD_MS) → 15 min = reaper muet.
 */
export const CRON_LATE_THRESHOLD_MS = 15 * 60_000;

/**
 * Drizzle minimal requis par les checks : on accepte le client applicatif
 * (`db()` de `@/lib/db/client`) comme le client de test (`emailsTestDb()`).
 * Typé `any` volontairement : les deux clients exposent `.select()` mais
 * proviennent de configs drizzle distinctes (schémas différents). On garde le
 * contrat à l'usage (méthodes appelées ci-dessous) plutôt qu'au type.
 */
type AnyDrizzle = any;

export type InfraChecks = {
  /**
   * `delivered` event silencieux : des emails partent (`sent`/`delivered`/…) mais
   * aucun `email_event` `delivered` n'arrive → webhook Stalwart probablement mort.
   */
  webhookSilent: {
    ok: boolean;
    sentLast7d: number;
    deliveredEventsLast7d: number;
  };
  /**
   * Lignes éligibles au pickup mais en retard de > 15 min → cron outbox à l'arrêt.
   */
  cronOutboxLate: {
    ok: boolean;
    lateCount: number;
    oldestEligibleAgeMs: number | null;
  };
  /**
   * Lignes figées en `sending` depuis > 15 min → reaper à l'arrêt / process orphelin.
   */
  sendingStuck: {
    ok: boolean;
    stuckCount: number;
    oldestStuckAgeMs: number | null;
  };
};

export type InfraHealthFragment = {
  /** Pire niveau induit par les 3 checks infra (`ok` si tout va bien). */
  level: HealthLevel;
  checks: InfraChecks;
};

function worst(a: HealthLevel, b: HealthLevel): HealthLevel {
  if (a === 'incident' || b === 'incident') return 'incident';
  if (a === 'degraded' || b === 'degraded') return 'degraded';
  return 'ok';
}

/**
 * Exécute les 3 checks infra contre la DB fournie. Requêtes agrégées (pas de
 * fetch de lignes). `now` injectable pour le déterminisme des tests.
 *
 * Statuts :
 *  - webhook silencieux → `incident` (panne de pipeline, emails « perdus de vue »).
 *  - cron outbox en retard → `incident` (envois bloqués, file qui gonfle).
 *  - sending bloqué → `incident` (emails potentiellement perdus sans trace).
 */
export async function checkEmailingInfraHealth(
  db: AnyDrizzle,
  now: Date = new Date(),
): Promise<InfraHealthFragment> {
  const sevenDaysAgo = new Date(now.getTime() - WEBHOOK_SILENCE_WINDOW_MS);
  const lateBefore = new Date(now.getTime() - CRON_LATE_THRESHOLD_MS);

  // — 1. Webhook silencieux —
  // (a) combien d'emails ont quitté l'app sur 7j (statut >= sent) ?
  // (b) combien d'events `delivered` reçus sur 7j ?
  const [sentAgg] = await db
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
        gte(emailOutbox.createdAt, sevenDaysAgo),
      ),
    );
  const sentLast7d = sentAgg?.n ?? 0;

  const [deliveredAgg] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(emailEvent)
    .where(and(eq(emailEvent.type, 'delivered'), gte(emailEvent.ts, sevenDaysAgo)));
  const deliveredEventsLast7d = deliveredAgg?.n ?? 0;

  // Panne SSI des envois existent mais aucun event `delivered` ne revient.
  const webhookSilentBad = sentLast7d > 0 && deliveredEventsLast7d === 0;

  // — 2. Cron outbox en retard —
  // Lignes éligibles au claim (pending/failed, next_retry échu ou nul) dont
  // l'échéance effective (next_retry sinon created_at) précède `lateBefore`.
  // NB : on borne le COALESCE via `lte(<expr sql>, <Date>)` (et non un littéral
  // Date interpolé dans le template `sql`) pour que drizzle/postgres-js binde
  // bien la Date en paramètre `timestamptz` plutôt que de la sérialiser à cru.
  const lateBeforeIso = lateBefore.toISOString();
  const eligibleAndLate = and(
    inArray(emailOutbox.status, ['pending', 'failed']),
    or(isNull(emailOutbox.nextRetry), lte(emailOutbox.nextRetry, now)),
    sql`COALESCE(${emailOutbox.nextRetry}, ${emailOutbox.createdAt}) <= ${lateBeforeIso}::timestamptz`,
  );
  const [cronAgg] = await db
    .select({
      n: sql<number>`count(*)::int`,
      oldest: sql<Date | null>`min(COALESCE(${emailOutbox.nextRetry}, ${emailOutbox.createdAt}))`,
    })
    .from(emailOutbox)
    .where(eligibleAndLate);
  const lateCount = cronAgg?.n ?? 0;
  const oldestEligible = cronAgg?.oldest ? new Date(cronAgg.oldest) : null;
  const oldestEligibleAgeMs = oldestEligible ? now.getTime() - oldestEligible.getTime() : null;

  // — 3. Sending bloqué —
  // Lignes en `sending` non touchées depuis > 15 min (reaper muet).
  const [sendingAgg] = await db
    .select({
      n: sql<number>`count(*)::int`,
      oldest: sql<Date | null>`min(${emailOutbox.updatedAt})`,
    })
    .from(emailOutbox)
    .where(and(eq(emailOutbox.status, 'sending'), lte(emailOutbox.updatedAt, lateBefore)));
  const stuckCount = sendingAgg?.n ?? 0;
  const oldestStuck = sendingAgg?.oldest ? new Date(sendingAgg.oldest) : null;
  const oldestStuckAgeMs = oldestStuck ? now.getTime() - oldestStuck.getTime() : null;

  const checks: InfraChecks = {
    webhookSilent: {
      ok: !webhookSilentBad,
      sentLast7d,
      deliveredEventsLast7d,
    },
    cronOutboxLate: {
      ok: lateCount === 0,
      lateCount,
      oldestEligibleAgeMs,
    },
    sendingStuck: {
      ok: stuckCount === 0,
      stuckCount,
      oldestStuckAgeMs,
    },
  };

  let level: HealthLevel = 'ok';
  if (webhookSilentBad) level = worst(level, 'incident');
  if (lateCount > 0) level = worst(level, 'incident');
  if (stuckCount > 0) level = worst(level, 'incident');

  return { level, checks };
}
