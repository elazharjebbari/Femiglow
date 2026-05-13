import { desc, eq, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db/client';
import type { DriftReason, DriftStatusEnum, SentinelPingInput } from '@/lib/tracking/gtm/sentinel-schemas';

/**
 * DAL — GTM Poka-Yoke.
 * Toutes les fonctions tolèrent l'absence de DB (mode test/dev sans Postgres)
 * en retournant des valeurs sentinelles.
 */

export type StoredPing = {
  id: string;
  receivedAt: Date;
  sentAt: Date;
  containerId: string;
  bundleId: string;
  mappingVersion: string;
  configVersion: string;
  manifestMismatch: boolean;
  manifestMismatchDetails: string | null;
};

export type StoredDriftState = {
  status: DriftStatusEnum;
  since: Date;
  reasons: DriftReason[];
  lastPingId: string | null;
  lastCheckAt: Date;
  adminSnapshot: Record<string, unknown>;
};

export type StoredHistoryEntry = {
  id: string;
  at: Date;
  previousStatus: DriftStatusEnum | null;
  newStatus: DriftStatusEnum;
  reasons: DriftReason[];
  triggeredByPingId: string | null;
};

export type DailyAggregate = {
  day: string;
  bundleId: string;
  mappingVersion: string;
  configVersion: string;
  containerId: string;
  pingsCount: number;
  driftDetected: boolean;
};

export type InsertPingInput = SentinelPingInput & {
  uaHash?: string | null;
  ipHash?: string | null;
  pageUrlHash?: string | null;
  rawPayload?: Record<string, unknown>;
};

export async function insertSentinelPing(input: InsertPingInput): Promise<StoredPing | null> {
  const drizzle = db();
  if (!drizzle) return null;
  const inserted = await drizzle
    .insert(schema.gtmSentinelPings)
    .values({
      sentAt: new Date(input.sentAt),
      containerId: input.containerId,
      gtmId: input.gtmId ?? null,
      bundleId: input.bundleId,
      mappingVersion: input.mappingVersion,
      configVersion: input.configVersion,
      manifestMismatch: input.manifestMismatch ?? false,
      manifestMismatchDetails: input.manifestMismatchDetails ?? null,
      uaHash: input.uaHash ?? null,
      ipHash: input.ipHash ?? null,
      pageUrlHash: input.pageUrlHash ?? null,
      rawPayload: input.rawPayload ?? {},
    })
    .returning();
  const row = inserted[0];
  if (!row) return null;
  return rowToStoredPing(row);
}

export async function getLastSentinelPing(): Promise<StoredPing | null> {
  const drizzle = db();
  if (!drizzle) return null;
  const rows = await drizzle
    .select()
    .from(schema.gtmSentinelPings)
    .orderBy(desc(schema.gtmSentinelPings.receivedAt))
    .limit(1);
  const row = rows[0];
  return row ? rowToStoredPing(row) : null;
}

export async function getCurrentDriftState(): Promise<StoredDriftState | null> {
  const drizzle = db();
  if (!drizzle) return null;
  const rows = await drizzle
    .select()
    .from(schema.gtmDriftState)
    .where(eq(schema.gtmDriftState.id, 'singleton'))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    status: row.status as DriftStatusEnum,
    since: row.since,
    reasons: (row.reasonsJson as DriftReason[]) ?? [],
    lastPingId: row.lastPingId,
    lastCheckAt: row.lastCheckAt,
    adminSnapshot: (row.adminSnapshot as Record<string, unknown>) ?? {},
  };
}

export async function upsertDriftState(input: {
  status: DriftStatusEnum;
  since: Date;
  reasons: DriftReason[];
  lastPingId: string | null;
  adminSnapshot: Record<string, unknown>;
}): Promise<void> {
  const drizzle = db();
  if (!drizzle) return;
  await drizzle
    .insert(schema.gtmDriftState)
    .values({
      id: 'singleton',
      status: input.status,
      since: input.since,
      reasonsJson: input.reasons as unknown[],
      lastPingId: input.lastPingId,
      lastCheckAt: new Date(),
      adminSnapshot: input.adminSnapshot,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.gtmDriftState.id,
      set: {
        status: input.status,
        since: input.since,
        reasonsJson: input.reasons as unknown[],
        lastPingId: input.lastPingId,
        lastCheckAt: new Date(),
        adminSnapshot: input.adminSnapshot,
        updatedAt: new Date(),
      },
    });
}

export async function insertDriftHistory(input: {
  previousStatus: DriftStatusEnum | null;
  newStatus: DriftStatusEnum;
  reasons: DriftReason[];
  triggeredByPingId: string | null;
}): Promise<void> {
  const drizzle = db();
  if (!drizzle) return;
  await drizzle.insert(schema.gtmDriftHistory).values({
    previousStatus: input.previousStatus,
    newStatus: input.newStatus,
    reasonsJson: input.reasons as unknown[],
    triggeredByPingId: input.triggeredByPingId,
  });
}

export async function getRecentDriftTransitions(limit: number = 10): Promise<StoredHistoryEntry[]> {
  const drizzle = db();
  if (!drizzle) return [];
  const rows = await drizzle
    .select()
    .from(schema.gtmDriftHistory)
    .orderBy(desc(schema.gtmDriftHistory.at))
    .limit(limit);
  return rows.map((row) => ({
    id: row.id,
    at: row.at,
    previousStatus: row.previousStatus as DriftStatusEnum | null,
    newStatus: row.newStatus as DriftStatusEnum,
    reasons: (row.reasonsJson as DriftReason[]) ?? [],
    triggeredByPingId: row.triggeredByPingId,
  }));
}

export async function getDailyAggregates(daysBack: number = 30): Promise<DailyAggregate[]> {
  const drizzle = db();
  if (!drizzle) return [];
  const rows = await drizzle.execute<{
    day: string;
    bundle_id: string;
    mapping_version: string;
    config_version: string;
    container_id: string;
    pings_count: number;
    drift_detected: boolean;
  }>(sql`
    SELECT
      to_char(date_trunc('day', received_at), 'YYYY-MM-DD') AS day,
      bundle_id, mapping_version, config_version, container_id,
      COUNT(*)::int AS pings_count,
      bool_or(manifest_mismatch) AS drift_detected
    FROM gtm_sentinel_pings
    WHERE received_at > now() - (${daysBack}::int * INTERVAL '1 day')
    GROUP BY day, bundle_id, mapping_version, config_version, container_id
    ORDER BY day DESC
  `);
  const list = (rows as unknown as { rows?: unknown[] }).rows ?? (rows as unknown as unknown[]);
  return (list as Array<Record<string, unknown>>).map((r) => ({
    day: String(r.day),
    bundleId: String(r.bundle_id),
    mappingVersion: String(r.mapping_version),
    configVersion: String(r.config_version),
    containerId: String(r.container_id),
    pingsCount: Number(r.pings_count ?? 0),
    driftDetected: Boolean(r.drift_detected),
  }));
}

function rowToStoredPing(row: typeof schema.gtmSentinelPings.$inferSelect): StoredPing {
  return {
    id: row.id,
    receivedAt: row.receivedAt,
    sentAt: row.sentAt,
    containerId: row.containerId,
    bundleId: row.bundleId,
    mappingVersion: row.mappingVersion,
    configVersion: row.configVersion,
    manifestMismatch: row.manifestMismatch,
    manifestMismatchDetails: row.manifestMismatchDetails,
  };
}
