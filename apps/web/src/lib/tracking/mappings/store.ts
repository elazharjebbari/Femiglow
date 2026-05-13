/**
 * Service CRUD pour event_mapping_versions.
 * cf. docs/event-mappings/30-backend/service-layer.md + ADR-001
 */
import { and, desc, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db/client';
import { createId } from '@/lib/ids';
import { logger } from '@/lib/logging/logger';
import {
  DEFAULT_VERSION_ID,
  MAPPING_STATUSES,
  type MappingStatus,
  type Mappings,
  type MappingVersion,
  type MappingVersionListItem,
} from './types';

const MAX_VERSIONS = 50;

interface ActorOpts {
  actorId: string;
}

function rowToVersion(row: typeof schema.eventMappingVersions.$inferSelect): MappingVersion {
  return {
    id: row.id,
    name: row.name,
    notes: row.notes,
    status: row.status as MappingStatus,
    isActive: row.isActive,
    isDefault: row.isDefault,
    mappings: (row.mappings as Mappings) ?? {},
    clonedFrom: row.clonedFrom,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    activatedAt: row.activatedAt,
    archivedAt: row.archivedAt,
    deletedAt: row.deletedAt,
  };
}

function rowToListItem(
  row: typeof schema.eventMappingVersions.$inferSelect,
): MappingVersionListItem {
  return {
    id: row.id,
    name: row.name,
    notes: row.notes,
    status: row.status as MappingStatus,
    isActive: row.isActive,
    isDefault: row.isDefault,
    clonedFrom: row.clonedFrom,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    activatedAt: row.activatedAt,
    archivedAt: row.archivedAt,
    deletedAt: row.deletedAt,
    eventsCount: Object.keys((row.mappings as Mappings) ?? {}).length,
  };
}

export const mappingStore = {
  async list(opts: { status?: MappingStatus[] } = {}): Promise<MappingVersionListItem[]> {
    const drizzle = db();
    if (!drizzle) return [];
    const rows = await drizzle
      .select()
      .from(schema.eventMappingVersions)
      .orderBy(desc(schema.eventMappingVersions.createdAt));
    return rows
      .filter((r) => !opts.status || opts.status.includes(r.status as MappingStatus))
      .map(rowToListItem);
  },

  async get(id: string): Promise<MappingVersion | null> {
    const drizzle = db();
    if (!drizzle) return null;
    const rows = await drizzle
      .select()
      .from(schema.eventMappingVersions)
      .where(eq(schema.eventMappingVersions.id, id))
      .limit(1);
    return rows[0] ? rowToVersion(rows[0]) : null;
  },

  async getActive(): Promise<MappingVersion | null> {
    const drizzle = db();
    if (!drizzle) return null;
    const rows = await drizzle
      .select()
      .from(schema.eventMappingVersions)
      .where(eq(schema.eventMappingVersions.isActive, true))
      .limit(1);
    return rows[0] ? rowToVersion(rows[0]) : null;
  },

  async getDefault(): Promise<MappingVersion | null> {
    return this.get(DEFAULT_VERSION_ID);
  },

  async create(
    input: { name: string; notes?: string | null; mappings: Mappings; clonedFrom?: string | null },
    opts: ActorOpts,
  ): Promise<MappingVersion> {
    const drizzle = db();
    if (!drizzle) throw new Error('storage_unavailable');
    const id = createId('emv');
    await drizzle.insert(schema.eventMappingVersions).values({
      id,
      name: input.name,
      notes: input.notes ?? null,
      status: 'draft',
      isActive: false,
      isDefault: false,
      mappings: input.mappings as unknown as Record<string, unknown>,
      clonedFrom: input.clonedFrom ?? null,
      createdBy: opts.actorId,
    });
    await this.trimFifo();
    const created = await this.get(id);
    if (!created) throw new Error('insert_failed');
    return created;
  },

  async clone(
    sourceId: string,
    overrides: { name?: string; notes?: string | null; mappings?: Mappings },
    opts: ActorOpts,
  ): Promise<MappingVersion> {
    const source = await this.get(sourceId);
    if (!source) throw new Error('source_not_found');
    const mappings = overrides.mappings ?? JSON.parse(JSON.stringify(source.mappings));
    return this.create(
      {
        name: overrides.name ?? `${source.name} (clone)`,
        notes: overrides.notes ?? null,
        mappings,
        clonedFrom: sourceId,
      },
      opts,
    );
  },

  async activate(id: string, opts: ActorOpts): Promise<MappingVersion> {
    const drizzle = db();
    if (!drizzle) throw new Error('storage_unavailable');
    const target = await this.get(id);
    if (!target) throw new Error('not_found');
    if (target.status === 'deleted') throw new Error('version_deleted');
    if (target.isActive) return target;

    // Transaction : désactive ancienne + active nouvelle.
    await drizzle.transaction(async (tx) => {
      await tx
        .update(schema.eventMappingVersions)
        .set({ isActive: false, status: 'archived', archivedAt: new Date() })
        .where(eq(schema.eventMappingVersions.isActive, true));
      await tx
        .update(schema.eventMappingVersions)
        .set({ isActive: true, status: 'active', activatedAt: new Date() })
        .where(eq(schema.eventMappingVersions.id, id));
    });

    invalidateActiveCache();
    logger.info('tracking.event_mapping.activate', { actor_id: opts.actorId, version_id: id });
    const updated = await this.get(id);
    return updated!;
  },

  async archive(id: string, opts: ActorOpts): Promise<MappingVersion> {
    const drizzle = db();
    if (!drizzle) throw new Error('storage_unavailable');
    const v = await this.get(id);
    if (!v) throw new Error('not_found');
    if (v.isActive) throw new Error('cannot_archive_active');
    await drizzle
      .update(schema.eventMappingVersions)
      .set({ status: 'archived', archivedAt: new Date() })
      .where(eq(schema.eventMappingVersions.id, id));
    logger.info('tracking.event_mapping.archive', { actor_id: opts.actorId, version_id: id });
    return (await this.get(id))!;
  },

  async softDelete(id: string, opts: ActorOpts): Promise<void> {
    const drizzle = db();
    if (!drizzle) throw new Error('storage_unavailable');
    const v = await this.get(id);
    if (!v) throw new Error('not_found');
    if (v.isActive) throw new Error('cannot_delete_active');
    if (v.isDefault) throw new Error('cannot_delete_default');
    await drizzle
      .update(schema.eventMappingVersions)
      .set({ status: 'deleted', deletedAt: new Date() })
      .where(eq(schema.eventMappingVersions.id, id));
    logger.info('tracking.event_mapping.delete', { actor_id: opts.actorId, version_id: id });
  },

  async restore(id: string, opts: ActorOpts): Promise<MappingVersion> {
    const drizzle = db();
    if (!drizzle) throw new Error('storage_unavailable');
    const v = await this.get(id);
    if (!v) throw new Error('not_found');
    if (v.status !== 'deleted') throw new Error('not_deleted');
    await drizzle
      .update(schema.eventMappingVersions)
      .set({ status: 'archived', deletedAt: null })
      .where(eq(schema.eventMappingVersions.id, id));
    logger.info('tracking.event_mapping.restore', { actor_id: opts.actorId, version_id: id });
    return (await this.get(id))!;
  },

  /**
   * D-001 — Édition = clone. Refuse l'in-place sur __default__.
   */
  async editAsClone(
    sourceId: string,
    input: { mappings: Mappings; name?: string; notes?: string | null },
    opts: ActorOpts,
  ): Promise<MappingVersion> {
    const source = await this.get(sourceId);
    if (!source) throw new Error('not_found');
    // Pas de check is_default ici : on autorise à cloner depuis __default__ pour en faire
    // une nouvelle version éditable (workflow attendu).
    return this.create(
      {
        name: input.name ?? `${source.name} (édition)`,
        notes: input.notes ?? source.notes,
        mappings: input.mappings,
        clonedFrom: sourceId,
      },
      opts,
    );
  },

  async resetToDefault(opts: ActorOpts): Promise<MappingVersion> {
    return this.activate(DEFAULT_VERSION_ID, opts);
  },

  /**
   * FIFO : garde max MAX_VERSIONS rows. Préserve toujours active + default.
   */
  async trimFifo(): Promise<void> {
    const drizzle = db();
    if (!drizzle) return;
    const all = await drizzle
      .select({ id: schema.eventMappingVersions.id, isActive: schema.eventMappingVersions.isActive, isDefault: schema.eventMappingVersions.isDefault, createdAt: schema.eventMappingVersions.createdAt })
      .from(schema.eventMappingVersions);
    if (all.length <= MAX_VERSIONS) return;
    const sorted = all.slice().sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const toRemove: string[] = [];
    let remaining = all.length;
    for (const r of sorted) {
      if (remaining <= MAX_VERSIONS) break;
      if (r.isActive || r.isDefault) continue;
      toRemove.push(r.id);
      remaining--;
    }
    if (toRemove.length === 0) return;
    for (const id of toRemove) {
      await drizzle.delete(schema.eventMappingVersions).where(eq(schema.eventMappingVersions.id, id));
    }
    logger.info('tracking.event_mapping.fifo_trim', { removed: toRemove.length });
  },

  async _resetForTests(): Promise<void> {
    const drizzle = db();
    if (!drizzle) return;
    await drizzle.delete(schema.eventMappingVersions);
  },
};

// Cache mémoïse l'active pour le resolver
let activeCache: { value: MappingVersion | null; expiresAt: number } | null = null;
const ACTIVE_CACHE_TTL_MS = 30_000;

export async function getActiveMemoized(): Promise<MappingVersion | null> {
  const now = Date.now();
  if (activeCache && activeCache.expiresAt > now) return activeCache.value;
  const v = await mappingStore.getActive();
  activeCache = { value: v, expiresAt: now + ACTIVE_CACHE_TTL_MS };
  return v;
}

export function invalidateActiveCache(): void {
  activeCache = null;
}
