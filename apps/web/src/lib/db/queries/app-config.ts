/**
 * Queries Admin-Config — table `app_config` + `app_config_snapshots`.
 *
 * Dual driver : Drizzle si `DATABASE_URL`, fallback memoryStore en dev/tests.
 * cf. docs/admin-config/backend/02-zod-validation.md
 */
import { desc, eq } from 'drizzle-orm';
import { db, memoryStore, schema } from '@/lib/db/client';
import { createId } from '@/lib/ids';
import { adminUsers } from '@/lib/db/schema';

export interface AppConfigRow {
  section: string;
  payload: unknown;
  version: number;
  updatedAt: Date;
  updatedBy: { id: string; email: string } | null;
}

export interface AppConfigSnapshotRow {
  id: string;
  section: string;
  payload: unknown;
  version: number;
  actor: { id: string; email: string } | null;
  note: string | null;
  capturedAt: Date;
}

interface MemoryRow {
  section: string;
  payload: unknown;
  version: number;
  updatedAt: Date;
  updatedBy: string | null;
}

interface MemorySnapshot {
  id: string;
  section: string;
  payload: unknown;
  version: number;
  actorId: string | null;
  note: string | null;
  capturedAt: Date;
}

interface ExtendedStore {
  appConfig: Map<string, MemoryRow>;
  appConfigSnapshots: Map<string, MemorySnapshot>;
}

function ext(): ExtendedStore {
  const store = memoryStore() as unknown as ExtendedStore & Record<string, unknown>;
  if (!store.appConfig) store.appConfig = new Map();
  if (!store.appConfigSnapshots) store.appConfigSnapshots = new Map();
  return store;
}

async function resolveActor(
  id: string | null | undefined,
): Promise<{ id: string; email: string } | null> {
  if (!id) return null;
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle.select().from(adminUsers).where(eq(adminUsers.id, id)).limit(1);
    return rows[0] ? { id: rows[0].id, email: rows[0].email } : null;
  }
  const u = ext().appConfig ? memoryStore().adminUsers.get(id) : null;
  return u ? { id: u.id, email: u.email } : null;
}

export async function getAppConfigRow(section: string): Promise<AppConfigRow | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.appConfig)
      .where(eq(schema.appConfig.section, section))
      .limit(1);
    if (!rows[0]) return null;
    const r = rows[0];
    const actor = await resolveActor(r.updatedBy);
    return {
      section: r.section,
      payload: r.payload,
      version: r.version,
      updatedAt: r.updatedAt,
      updatedBy: actor,
    };
  }
  const m = ext().appConfig.get(section);
  if (!m) return null;
  const actor = await resolveActor(m.updatedBy);
  return {
    section: m.section,
    payload: m.payload,
    version: m.version,
    updatedAt: m.updatedAt,
    updatedBy: actor,
  };
}

export interface UpsertInput {
  section: string;
  payload: unknown;
  expectedVersion: number;
  actorId: string | null;
}

export interface UpsertResult {
  ok: true;
  row: AppConfigRow;
  snapshot: AppConfigSnapshotRow;
}

export interface UpsertConflict {
  ok: false;
  reason: 'stale_version';
  currentVersion: number;
}

export async function upsertAppConfig(
  input: UpsertInput,
  options: { note?: string | null } = {},
): Promise<UpsertResult | UpsertConflict> {
  const { section, payload, expectedVersion, actorId } = input;
  const note = options.note ?? null;
  const drizzle = db();
  const now = new Date();

  if (drizzle) {
    const existingRows = await drizzle
      .select()
      .from(schema.appConfig)
      .where(eq(schema.appConfig.section, section))
      .limit(1);
    const existing = existingRows[0];
    const currentVersion = existing?.version ?? 0;
    if (currentVersion !== expectedVersion) {
      return { ok: false, reason: 'stale_version', currentVersion };
    }
    const newVersion = currentVersion + 1;
    if (existing) {
      await drizzle
        .update(schema.appConfig)
        .set({
          payload: payload as never,
          version: newVersion,
          updatedAt: now,
          updatedBy: actorId,
        })
        .where(eq(schema.appConfig.section, section));
    } else {
      await drizzle.insert(schema.appConfig).values({
        section,
        payload: payload as never,
        version: newVersion,
        updatedAt: now,
        updatedBy: actorId,
      });
    }
    const snapshotId = createId('snap');
    await drizzle.insert(schema.appConfigSnapshots).values({
      id: snapshotId,
      section,
      payload: payload as never,
      version: newVersion,
      actorId,
      note,
      capturedAt: now,
    });
    const actor = await resolveActor(actorId);
    return {
      ok: true,
      row: {
        section,
        payload,
        version: newVersion,
        updatedAt: now,
        updatedBy: actor,
      },
      snapshot: {
        id: snapshotId,
        section,
        payload,
        version: newVersion,
        actor,
        note,
        capturedAt: now,
      },
    };
  }

  // memory store
  const store = ext();
  const existing = store.appConfig.get(section);
  const currentVersion = existing?.version ?? 0;
  if (currentVersion !== expectedVersion) {
    return { ok: false, reason: 'stale_version', currentVersion };
  }
  const newVersion = currentVersion + 1;
  store.appConfig.set(section, {
    section,
    payload,
    version: newVersion,
    updatedAt: now,
    updatedBy: actorId,
  });
  const snapshotId = createId('snap');
  store.appConfigSnapshots.set(snapshotId, {
    id: snapshotId,
    section,
    payload,
    version: newVersion,
    actorId,
    note,
    capturedAt: now,
  });
  const actor = await resolveActor(actorId);
  return {
    ok: true,
    row: {
      section,
      payload,
      version: newVersion,
      updatedAt: now,
      updatedBy: actor,
    },
    snapshot: {
      id: snapshotId,
      section,
      payload,
      version: newVersion,
      actor,
      note,
      capturedAt: now,
    },
  };
}

export async function listAppConfigSnapshots(
  section: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ items: AppConfigSnapshotRow[]; total: number }> {
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = opts.offset ?? 0;
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.appConfigSnapshots)
      .where(eq(schema.appConfigSnapshots.section, section))
      .orderBy(desc(schema.appConfigSnapshots.capturedAt))
      .limit(limit)
      .offset(offset);
    const items: AppConfigSnapshotRow[] = await Promise.all(
      rows.map(async (r) => ({
        id: r.id,
        section: r.section,
        payload: r.payload,
        version: r.version,
        actor: await resolveActor(r.actorId),
        note: r.note,
        capturedAt: r.capturedAt,
      })),
    );
    return { items, total: items.length + offset };
  }
  const all = Array.from(ext().appConfigSnapshots.values()).filter((s) => s.section === section);
  all.sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime());
  const sliced = all.slice(offset, offset + limit);
  const items: AppConfigSnapshotRow[] = await Promise.all(
    sliced.map(async (s) => ({
      id: s.id,
      section: s.section,
      payload: s.payload,
      version: s.version,
      actor: await resolveActor(s.actorId),
      note: s.note,
      capturedAt: s.capturedAt,
    })),
  );
  return { items, total: all.length };
}

export async function getSnapshotById(id: string): Promise<AppConfigSnapshotRow | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.appConfigSnapshots)
      .where(eq(schema.appConfigSnapshots.id, id))
      .limit(1);
    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id,
      section: r.section,
      payload: r.payload,
      version: r.version,
      actor: await resolveActor(r.actorId),
      note: r.note,
      capturedAt: r.capturedAt,
    };
  }
  const s = ext().appConfigSnapshots.get(id);
  if (!s) return null;
  return {
    id: s.id,
    section: s.section,
    payload: s.payload,
    version: s.version,
    actor: await resolveActor(s.actorId),
    note: s.note,
    capturedAt: s.capturedAt,
  };
}

