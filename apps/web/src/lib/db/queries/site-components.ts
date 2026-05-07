/**
 * Queries — table `site_components` (registre des composants visuels du site).
 *
 * Lecture/écriture transparente : Drizzle si DATABASE_URL, fallback memoryStore
 * en dev/tests. Les données restent identiques (mêmes types) — la liste tirée
 * du registre TS (`SITE_COMPONENT_REGISTRY`) est synchronisée via
 * `upsertSiteComponentFromSeed()`.
 */
import { and, asc, eq } from 'drizzle-orm';
import { db, memoryStore, schema } from '@/lib/db/client';
import { createId } from '@/lib/ids';
import type { SiteComponent, SlotDefinition } from '@/lib/db/types';
import type { SiteComponentSeed } from '@/lib/components/registry';

export interface UpdateSiteComponentInput {
  description?: string | null;
  defaultSvgFallback?: string | null;
  defaultLoadingStrategy?: SiteComponent['defaultLoadingStrategy'];
  defaultFetchPriority?: SiteComponent['defaultFetchPriority'];
  supportsAnimation?: boolean;
  metadata?: Record<string, unknown>;
}

function toRecord(row: unknown): SiteComponent {
  return row as SiteComponent;
}

export async function listSiteComponents(opts?: {
  pageGroup?: string;
}): Promise<SiteComponent[]> {
  const drizzle = db();
  if (drizzle) {
    const where = opts?.pageGroup
      ? eq(schema.siteComponents.pageGroup, opts.pageGroup)
      : undefined;
    const rows = await drizzle
      .select()
      .from(schema.siteComponents)
      .where(where as never)
      .orderBy(asc(schema.siteComponents.pageGroup), asc(schema.siteComponents.name));
    return rows.map(toRecord);
  }
  const all = Array.from(memoryStore().siteComponents.values());
  const filtered = opts?.pageGroup ? all.filter((c) => c.pageGroup === opts.pageGroup) : all;
  return filtered.sort(
    (a, b) => a.pageGroup.localeCompare(b.pageGroup) || a.name.localeCompare(b.name),
  );
}

export async function getSiteComponentByKey(key: string): Promise<SiteComponent | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.siteComponents)
      .where(eq(schema.siteComponents.key, key))
      .limit(1);
    return rows[0] ? toRecord(rows[0]) : null;
  }
  for (const c of memoryStore().siteComponents.values()) {
    if (c.key === key) return c;
  }
  return null;
}

export async function getSiteComponentById(id: string): Promise<SiteComponent | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.siteComponents)
      .where(eq(schema.siteComponents.id, id))
      .limit(1);
    return rows[0] ? toRecord(rows[0]) : null;
  }
  return memoryStore().siteComponents.get(id) ?? null;
}

/**
 * Upserts an entry from the TS registry. Used by sync-registry route + the
 * seed pipeline. We keep `description`, `slots`, `category`, `pageGroup`,
 * `filePath` always in sync (registre = source de vérité). Mais on ne touche
 * pas `metadata` si l'admin l'a personnalisé (champ user-controlled).
 */
export async function upsertSiteComponentFromSeed(
  seed: SiteComponentSeed,
): Promise<SiteComponent> {
  const existing = await getSiteComponentByKey(seed.key);
  const now = new Date();

  if (existing) {
    const updated: SiteComponent = {
      ...existing,
      name: seed.name,
      description: seed.description,
      category: seed.category,
      pageGroup: seed.pageGroup,
      filePath: seed.filePath,
      slots: seed.slots,
      fields: seed.fields ?? [],
      defaultSvgFallback: seed.defaultSvgFallback,
      defaultLoadingStrategy: seed.defaultLoadingStrategy,
      defaultFetchPriority: seed.defaultFetchPriority,
      supportsAnimation: seed.supportsAnimation,
      // metadata : on merge mais on ne sur-écrit pas les clés admin
      metadata: { ...(seed.metadata ?? {}), ...existing.metadata },
      updatedAt: now,
    };
    const drizzle = db();
    if (drizzle) {
      await drizzle
        .update(schema.siteComponents)
        .set({
          name: updated.name,
          description: updated.description,
          category: updated.category,
          pageGroup: updated.pageGroup,
          filePath: updated.filePath,
          slots: updated.slots,
          fields: updated.fields,
          defaultSvgFallback: updated.defaultSvgFallback,
          defaultLoadingStrategy: updated.defaultLoadingStrategy,
          defaultFetchPriority: updated.defaultFetchPriority,
          supportsAnimation: updated.supportsAnimation,
          metadata: updated.metadata,
          updatedAt: now,
        })
        .where(eq(schema.siteComponents.id, existing.id));
      return updated;
    }
    memoryStore().siteComponents.set(existing.id, updated);
    return updated;
  }

  const created: SiteComponent = {
    id: createId('cmp'),
    key: seed.key,
    name: seed.name,
    description: seed.description,
    category: seed.category,
    pageGroup: seed.pageGroup,
    filePath: seed.filePath,
    slots: seed.slots,
    fields: seed.fields ?? [],
    defaultSvgFallback: seed.defaultSvgFallback,
    defaultLoadingStrategy: seed.defaultLoadingStrategy,
    defaultFetchPriority: seed.defaultFetchPriority,
    supportsAnimation: seed.supportsAnimation,
    metadata: seed.metadata ?? {},
    createdAt: now,
    updatedAt: now,
  };

  const drizzle = db();
  if (drizzle) {
    await drizzle.insert(schema.siteComponents).values(created);
    return created;
  }
  memoryStore().siteComponents.set(created.id, created);
  return created;
}

export async function updateSiteComponent(
  id: string,
  input: UpdateSiteComponentInput,
): Promise<SiteComponent | null> {
  const existing = await getSiteComponentById(id);
  if (!existing) return null;
  const now = new Date();
  const updated: SiteComponent = {
    ...existing,
    description: input.description ?? existing.description,
    defaultSvgFallback: input.defaultSvgFallback ?? existing.defaultSvgFallback,
    defaultLoadingStrategy: input.defaultLoadingStrategy ?? existing.defaultLoadingStrategy,
    defaultFetchPriority: input.defaultFetchPriority ?? existing.defaultFetchPriority,
    supportsAnimation: input.supportsAnimation ?? existing.supportsAnimation,
    metadata: { ...existing.metadata, ...(input.metadata ?? {}) },
    updatedAt: now,
  };
  const drizzle = db();
  if (drizzle) {
    await drizzle
      .update(schema.siteComponents)
      .set({
        description: updated.description,
        defaultSvgFallback: updated.defaultSvgFallback,
        defaultLoadingStrategy: updated.defaultLoadingStrategy,
        defaultFetchPriority: updated.defaultFetchPriority,
        supportsAnimation: updated.supportsAnimation,
        metadata: updated.metadata,
        updatedAt: now,
      })
      .where(eq(schema.siteComponents.id, id));
    return updated;
  }
  memoryStore().siteComponents.set(id, updated);
  return updated;
}

export async function deleteSiteComponent(id: string): Promise<void> {
  const drizzle = db();
  if (drizzle) {
    await drizzle.delete(schema.siteComponents).where(eq(schema.siteComponents.id, id));
    return;
  }
  memoryStore().siteComponents.delete(id);
}

export async function findSlot(
  componentKey: string,
  slot: string,
): Promise<SlotDefinition | null> {
  const cmp = await getSiteComponentByKey(componentKey);
  if (!cmp) return null;
  return cmp.slots.find((s) => s.key === slot) ?? null;
}

export async function listPageGroups(): Promise<string[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .selectDistinct({ pageGroup: schema.siteComponents.pageGroup })
      .from(schema.siteComponents)
      .orderBy(asc(schema.siteComponents.pageGroup));
    return rows.map((r) => r.pageGroup);
  }
  const groups = new Set<string>();
  for (const c of memoryStore().siteComponents.values()) groups.add(c.pageGroup);
  return Array.from(groups).sort();
}

export async function countSiteComponents(): Promise<number> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle.select().from(schema.siteComponents);
    return rows.length;
  }
  return memoryStore().siteComponents.size;
}

// Composé pour /admin
export async function listSiteComponentsByGroup(): Promise<Record<string, SiteComponent[]>> {
  const all = await listSiteComponents();
  const grouped: Record<string, SiteComponent[]> = {};
  for (const c of all) {
    grouped[c.pageGroup] = grouped[c.pageGroup] ?? [];
    grouped[c.pageGroup]!.push(c);
  }
  return grouped;
}

// Helpers pour seed pipeline
export { eq as _eq, and as _and };
