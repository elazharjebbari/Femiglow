import { createHash } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { db, memoryStore, schema } from '@/lib/db/client';
import { createId } from '@/lib/ids';
import type { TrackingConsentSnapshot, TrackingConsentState } from '@/lib/db/types';

const MAX_MEMORY_SNAPSHOTS = 1000;

export interface UpsertConsentSnapshotInput {
  anonymousId: string;
  state: TrackingConsentState;
  source: 'banner' | 'preferences' | 'api' | 'auto';
  ipAnonymized: string;
  uaHash: string;
}

function hashState(state: TrackingConsentState): string {
  const record = state as unknown as Record<string, string>;
  const ordered = Object.keys(record)
    .sort()
    .map((k) => `${k}:${record[k]}`)
    .join('|');
  return createHash('sha256').update(ordered).digest('hex').slice(0, 32);
}

function rowToSnapshot(
  row: typeof schema.trackingConsentSnapshots.$inferSelect,
): TrackingConsentSnapshot {
  return {
    id: row.id,
    anonymousId: row.anonymousId,
    state: row.state as TrackingConsentState,
    stateHash: row.stateHash,
    source: row.source as TrackingConsentSnapshot['source'],
    ipAnonymized: row.ipAnonymized,
    uaHash: row.uaHash,
    createdAt: row.createdAt,
  };
}

export async function upsertConsentSnapshot(
  input: UpsertConsentSnapshotInput,
): Promise<TrackingConsentSnapshot> {
  const stateHash = hashState(input.state);
  const drizzle = db();
  const existing = drizzle
    ? (
        await drizzle
          .select()
          .from(schema.trackingConsentSnapshots)
          .where(
            and(
              eq(schema.trackingConsentSnapshots.anonymousId, input.anonymousId),
              eq(schema.trackingConsentSnapshots.stateHash, stateHash),
            ),
          )
          .limit(1)
      )[0]
    : null;
  if (existing) return rowToSnapshot(existing);
  const memExisting = !drizzle
    ? Array.from(memoryStore().trackingConsentSnapshots.values()).find(
        (s) => s.anonymousId === input.anonymousId && s.stateHash === stateHash,
      )
    : null;
  if (memExisting) return memExisting;
  const snapshot: TrackingConsentSnapshot = {
    id: createId('tcs'),
    anonymousId: input.anonymousId,
    state: input.state,
    stateHash,
    source: input.source,
    ipAnonymized: input.ipAnonymized,
    uaHash: input.uaHash,
    createdAt: new Date(),
  };
  if (drizzle) {
    await drizzle
      .insert(schema.trackingConsentSnapshots)
      .values({
        id: snapshot.id,
        anonymousId: snapshot.anonymousId,
        state: snapshot.state,
        stateHash: snapshot.stateHash,
        source: snapshot.source,
        ipAnonymized: snapshot.ipAnonymized,
        uaHash: snapshot.uaHash,
        createdAt: snapshot.createdAt,
      })
      .onConflictDoNothing();
  } else {
    const store = memoryStore();
    store.trackingConsentSnapshots.set(snapshot.id, snapshot);
    store.trackingConsentOrder.push(snapshot.id);
    while (store.trackingConsentOrder.length > MAX_MEMORY_SNAPSHOTS) {
      const oldest = store.trackingConsentOrder.shift();
      if (oldest) store.trackingConsentSnapshots.delete(oldest);
    }
  }
  return snapshot;
}

export async function listConsentSnapshotsForAnonymous(
  anonymousId: string,
  limit = 50,
): Promise<TrackingConsentSnapshot[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.trackingConsentSnapshots)
      .where(eq(schema.trackingConsentSnapshots.anonymousId, anonymousId))
      .orderBy(desc(schema.trackingConsentSnapshots.createdAt))
      .limit(limit);
    return rows.map(rowToSnapshot);
  }
  return Array.from(memoryStore().trackingConsentSnapshots.values())
    .filter((s) => s.anonymousId === anonymousId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

export { hashState };
