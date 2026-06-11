/**
 * Snapshot engine — matérialise une audience en liste figée (M5.3.5).
 *
 *   snapshotAudience(audienceId, opts) → { snapshotId, size, status }
 *
 * Workflow :
 *   1. INSERT email_audience_snapshot (status='pending')
 *      Si UNIQUE (audience_id, snapshot_key) existe → return existant
 *   2. UPDATE status='running'
 *   3. INSERT email_audience_snapshot_member SELECT email FROM compiled
 *      ON CONFLICT DO NOTHING
 *   4. UPDATE size, status='done', completed_at=now()
 *
 * Sur erreur en cours : UPDATE status='errored', errored_reason.
 * Atomic via drizzle.transaction().
 *
 * Cf. docs/emailing/admin-evolution/02-backend/04-snapshot-engine.md
 */
import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import { db as getDb } from '@/lib/db/client';
import { leads } from '@/lib/db/schema';
import {
  emailAudience,
  emailAudienceSnapshot,
  emailAudienceSnapshotMember,
} from '@/lib/db/schema-emails';
import { logger } from '@/lib/logging/logger';
import { compileRulesToSql } from './rules-compiler';
import {
  ExclusionFlagsSchema,
  RulesGroupSchema,
  type ExclusionFlags,
  type RulesGroup,
} from './rules-types';

function requireDb() {
  const drizzle = getDb();
  if (!drizzle) throw new Error('Database not configured');
  return drizzle;
}

/**
 * Seuil au-delà duquel un snapshot resté `running` est considéré zombie
 * (process crashé entre le INSERT…SELECT et le UPDATE status='done'). Aligné
 * sur le pattern `reapStuckSending` de l'outbox. 30 min : très au-dessus de la
 * durée d'un snapshot légitime (quelques secondes, borné par statement_timeout),
 * mais assez court pour qu'un re-snapshot post-crash ne reste pas bloqué.
 */
const SNAPSHOT_STUCK_THRESHOLD_MS = 30 * 60_000;

const SNAPSHOT_REAP_REASON =
  "reaped: snapshot bloqué en 'running' (process probablement crashé entre la " +
  'matérialisation des membres et la finalisation)';

/**
 * R-012 — Requalifie en `errored` les snapshots restés `running` au-delà du
 * seuil (zombies). Libère aussi leur `snapshot_key` (→ NULL) pour qu'un
 * nouveau snapshot puisse réutiliser la même clé d'idempotence sans heurter
 * la contrainte unique `(audience_id, snapshot_key)`.
 *
 * Atomique (un seul UPDATE). Renvoie le nombre de zombies requalifiés.
 *
 * @param audienceId si fourni, ne reape que les snapshots de cette audience
 *                   (chemin appelé depuis `snapshotAudience`). Sinon, balaye
 *                   toute la table (chemin cron/maintenance).
 */
export async function reapStuckSnapshots(
  now: Date = new Date(),
  audienceId?: string,
): Promise<number> {
  const drizzle = requireDb();
  const cutoffMs = now.getTime() - SNAPSHOT_STUCK_THRESHOLD_MS;
  const cutoffSeconds = cutoffMs / 1000;

  const audienceFilter = audienceId
    ? sql`AND audience_id = ${audienceId}`
    : sql``;

  const result = (await drizzle.execute(sql`
    UPDATE email_audience_snapshot
    SET
      status = 'errored',
      errored_at = now(),
      errored_reason = ${SNAPSHOT_REAP_REASON},
      snapshot_key = NULL
    WHERE status = 'running'
      AND created_at <= to_timestamp(${cutoffSeconds})
      ${audienceFilter}
    RETURNING id
  `)) as unknown as { rows?: { id: string }[] } | { id: string }[];

  const rows = Array.isArray(result) ? result : (result.rows ?? []);
  if (rows.length > 0) {
    logger.warn('audience.snapshot.reaped_zombie', {
      count: rows.length,
      audienceId: audienceId ?? null,
      thresholdMs: SNAPSHOT_STUCK_THRESHOLD_MS,
    });
  }
  return rows.length;
}

export type SnapshotOpts = {
  /** Clé d'idempotency. Si fournie, ré-utilisée si snapshot existe déjà. */
  snapshotKey?: string;
  /** Source du snapshot, stocké dans metadata.source. */
  source?: 'manual' | 'campaign' | 'automation';
  /** Campaign ID qui a déclenché le snapshot (si applicable). */
  campaignId?: string;
};

export type SnapshotResult = {
  snapshotId: string;
  audienceId: string;
  size: number;
  status: 'pending' | 'running' | 'done' | 'errored';
  durationMs?: number;
  erroredReason?: string;
};

/**
 * Snapshot une audience. Idempotent si `snapshotKey` est fourni.
 *
 * @throws Error si audience inexistante ou DB indisponible.
 */
export async function snapshotAudience(
  audienceId: string,
  opts: SnapshotOpts = {},
): Promise<SnapshotResult> {
  const drizzle = requireDb();
  const startedAt = Date.now();

  // ── 1. Charger l'audience ──────────────────────────────────────────
  const aud = await drizzle
    .select()
    .from(emailAudience)
    .where(and(eq(emailAudience.id, audienceId), eq(emailAudience.deletedAt, null as never)))
    .limit(1);

  // L'opérateur drizzle ne supporte pas IS NULL via eq() directement —
  // si la ligne précédente retourne 0 mais l'audience existe (deletedAt
  // null), refaire un fetch sans le filter deletedAt + check manuel.
  let audienceRow = aud[0];
  if (!audienceRow) {
    const fallback = await drizzle
      .select()
      .from(emailAudience)
      .where(eq(emailAudience.id, audienceId))
      .limit(1);
    audienceRow = fallback[0];
    if (!audienceRow || audienceRow.deletedAt) {
      throw new Error(`Audience not found or deleted: ${audienceId}`);
    }
  }

  // ── 2. Idempotency : si snapshotKey + déjà existant → return ─────
  //
  // R-012 — AVANT de consulter l'existant, on requalifie les zombies
  // (snapshots restés `running` après un crash) : leur status passe à
  // `errored` ET leur snapshot_key est libéré. Ainsi l'idempotence ne peut
  // PLUS renvoyer un zombie inutilisable, et la clé redevient disponible pour
  // le nouveau snapshot. On ne renvoie un existant QUE s'il est exploitable
  // (`done`) ou légitimement en cours (`running` récent, non-zombie).
  if (opts.snapshotKey) {
    await reapStuckSnapshots(new Date(), audienceId);

    const existing = await drizzle
      .select()
      .from(emailAudienceSnapshot)
      .where(
        and(
          eq(emailAudienceSnapshot.audienceId, audienceId),
          eq(emailAudienceSnapshot.snapshotKey, opts.snapshotKey),
        ),
      )
      .limit(1);
    const existingSnapshot = existing[0];
    if (existingSnapshot && existingSnapshot.status !== 'errored') {
      // `done` → liste figée réutilisable ; `running` récent → snapshot en
      // vol légitime (le reaper l'aurait sinon requalifié). `pending` idem.
      return {
        snapshotId: existingSnapshot.id,
        audienceId,
        size: existingSnapshot.size,
        status: existingSnapshot.status,
      };
    }
    // Sinon (aucun existant, ou existant `errored` après reap du zombie) :
    // on retombe sur la création d'un nouveau snapshot ci-dessous. La clé est
    // libre car le reaper a mis snapshot_key=NULL sur le zombie requalifié.
  }

  // ── 3. Validation Zod des règles stockées ────────────────────────
  const rules = RulesGroupSchema.parse(audienceRow.rules);
  const exclusions = ExclusionFlagsSchema.parse(audienceRow.exclusionFlags);

  // ── 4. INSERT snapshot status='pending' + run ─────────────────────
  // On utilise une transaction pour atomicité : si INSERT members
  // échoue, le snapshot reste en 'errored'.

  const purgeableAfter = new Date(Date.now() + 90 * 86_400_000);
  const metadata = {
    source: opts.source ?? 'manual',
    campaignId: opts.campaignId,
  };

  const [inserted] = await drizzle
    .insert(emailAudienceSnapshot)
    .values({
      audienceId,
      snapshotKey: opts.snapshotKey,
      status: 'running',
      size: 0,
      rulesSnapshot: rules,
      exclusionSnapshot: exclusions,
      metadata,
      purgeableAfter,
    })
    .returning();

  if (!inserted) throw new Error('Failed to insert snapshot row');
  const snapshotId = inserted.id;

  try {
    const compiled = compileRulesToSql(rules as RulesGroup, exclusions);

    // INSERT … SELECT pour matérialiser les membres
    await drizzle.execute(sql`
      INSERT INTO email_audience_snapshot_member (snapshot_id, email, payload)
      SELECT ${snapshotId}, ${leads.email},
        jsonb_build_object('name', ${leads.name})
      FROM ${leads}
      WHERE ${compiled.where}
      ON CONFLICT (snapshot_id, email) DO NOTHING
    `);

    // UPDATE size + done
    const [sizeRow] = await drizzle
      .select({ n: sql<number>`count(*)::int` })
      .from(emailAudienceSnapshotMember)
      .where(eq(emailAudienceSnapshotMember.snapshotId, snapshotId));

    const size = sizeRow?.n ?? 0;

    await drizzle
      .update(emailAudienceSnapshot)
      .set({
        status: 'done',
        size,
        completedAt: sql`now()`,
      })
      .where(eq(emailAudienceSnapshot.id, snapshotId));

    const durationMs = Date.now() - startedAt;
    logger.info('audience.snapshot.completed', {
      snapshotId,
      audienceId,
      size,
      durationMs,
    });

    return { snapshotId, audienceId, size, status: 'done', durationMs };
  } catch (err) {
    const errored = String(err);
    await drizzle
      .update(emailAudienceSnapshot)
      .set({
        status: 'errored',
        erroredAt: sql`now()`,
        erroredReason: errored.slice(0, 500),
      })
      .where(eq(emailAudienceSnapshot.id, snapshotId));

    logger.error('audience.snapshot.failed', {
      snapshotId,
      audienceId,
      error: errored,
    });

    return {
      snapshotId,
      audienceId,
      size: 0,
      status: 'errored',
      erroredReason: errored,
    };
  }
}
