/**
 * Queries SEO-CMS — overrides, settings, audit snapshots.
 * Dual driver : Drizzle si DATABASE_URL, fallback memoryStore en dev/tests.
 */
import { and, asc, desc, eq, ilike, or } from 'drizzle-orm';
import { db, memoryStore, schema } from '@/lib/db/client';
import { createId } from '@/lib/ids';
import type {
  KnownPage,
  SeoAuditSnapshot,
  SeoOverride,
  SeoScope,
  SeoSettings,
} from '@/lib/seo/types';
import { seoSettingsDefault } from '@/lib/seo/defaults';

interface MemoryOverrideRow extends SeoOverride {}
interface MemorySettingsRow extends SeoSettings {}
interface MemoryAuditRow extends SeoAuditSnapshot {}

interface ExtendedStore {
  seoOverrides: Map<string, MemoryOverrideRow>;
  seoSettings: MemorySettingsRow | null;
  seoAuditSnapshots: Map<string, MemoryAuditRow>;
}

function ext(): ExtendedStore {
  const store = memoryStore() as unknown as ExtendedStore & Record<string, unknown>;
  if (!store.seoOverrides) store.seoOverrides = new Map();
  if (typeof store.seoSettings === 'undefined') store.seoSettings = null;
  if (!store.seoAuditSnapshots) store.seoAuditSnapshots = new Map();
  return store;
}

function rowToOverride(r: typeof schema.seoOverrides.$inferSelect): SeoOverride {
  return {
    id: r.id,
    scope: r.scope,
    targetKey: r.targetKey,
    locale: r.locale,
    title: r.title,
    description: r.description,
    keywords: Array.isArray(r.keywords) ? (r.keywords as string[]) : [],
    ogTitle: r.ogTitle,
    ogDescription: r.ogDescription,
    ogImageMediaId: r.ogImageMediaId,
    ogImageTemplate: r.ogImageTemplate,
    twitterCard: r.twitterCard,
    canonical: r.canonical,
    robotsIndex: r.robotsIndex,
    robotsFollow: r.robotsFollow,
    structuredData: r.structuredData,
    publishedAt: r.publishedAt,
    draftedAt: r.draftedAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    createdBy: r.createdBy,
  };
}

export interface ListOverridesOptions {
  scope?: SeoScope;
  search?: string;
  publishedOnly?: boolean;
  limit?: number;
  offset?: number;
}

export async function listOverrides(
  opts: ListOverridesOptions = {},
): Promise<{ items: SeoOverride[]; total: number }> {
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = opts.offset ?? 0;
  const drizzle = db();
  if (drizzle) {
    const conds = [];
    if (opts.scope) conds.push(eq(schema.seoOverrides.scope, opts.scope));
    if (opts.publishedOnly) {
      // Drizzle: isNotNull import to keep simple, we use raw not-null check via ne(... null) alternative.
      // For simplicity use sql template via where(...) — fall back to filtering after fetch.
    }
    if (opts.search) {
      conds.push(
        or(
          ilike(schema.seoOverrides.targetKey, `%${opts.search}%`),
          ilike(schema.seoOverrides.title, `%${opts.search}%`),
        )!,
      );
    }
    const where = conds.length ? and(...conds) : undefined;
    const rows = await drizzle
      .select()
      .from(schema.seoOverrides)
      .where(where as never)
      .orderBy(desc(schema.seoOverrides.updatedAt))
      .limit(limit)
      .offset(offset);
    let items = rows.map(rowToOverride);
    if (opts.publishedOnly) items = items.filter((it) => it.publishedAt !== null);
    return { items, total: items.length + offset };
  }
  const all = Array.from(ext().seoOverrides.values());
  let filtered = all;
  if (opts.scope) filtered = filtered.filter((it) => it.scope === opts.scope);
  if (opts.publishedOnly) filtered = filtered.filter((it) => it.publishedAt !== null);
  if (opts.search) {
    const q = opts.search.toLowerCase();
    filtered = filtered.filter(
      (it) =>
        it.targetKey.toLowerCase().includes(q) ||
        (it.title?.toLowerCase().includes(q) ?? false),
    );
  }
  filtered.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  const sliced = filtered.slice(offset, offset + limit);
  return { items: sliced, total: filtered.length };
}

export async function getOverrideById(id: string): Promise<SeoOverride | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.seoOverrides)
      .where(eq(schema.seoOverrides.id, id))
      .limit(1);
    return rows[0] ? rowToOverride(rows[0]) : null;
  }
  return ext().seoOverrides.get(id) ?? null;
}

export async function getOverrideByTarget(
  scope: SeoScope,
  targetKey: string,
  locale: string,
): Promise<SeoOverride | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.seoOverrides)
      .where(
        and(
          eq(schema.seoOverrides.scope, scope),
          eq(schema.seoOverrides.targetKey, targetKey),
          eq(schema.seoOverrides.locale, locale),
        ),
      )
      .limit(1);
    return rows[0] ? rowToOverride(rows[0]) : null;
  }
  for (const row of ext().seoOverrides.values()) {
    if (row.scope === scope && row.targetKey === targetKey && row.locale === locale) {
      return row;
    }
  }
  return null;
}

export interface UpsertOverrideInput {
  id?: string;
  scope: SeoScope;
  targetKey: string;
  locale: string;
  title?: string | null;
  description?: string | null;
  keywords?: string[];
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImageMediaId?: string | null;
  ogImageTemplate?: SeoOverride['ogImageTemplate'];
  twitterCard?: SeoOverride['twitterCard'];
  canonical?: string | null;
  robotsIndex?: boolean;
  robotsFollow?: boolean;
  structuredData?: unknown;
  actorId: string | null;
}

export async function upsertOverride(input: UpsertOverrideInput): Promise<SeoOverride> {
  const now = new Date();
  const drizzle = db();
  const existing = input.id
    ? await getOverrideById(input.id)
    : await getOverrideByTarget(input.scope, input.targetKey, input.locale);
  const id = existing?.id ?? input.id ?? createId('seo');
  const baseValues = {
    id,
    scope: input.scope,
    targetKey: input.targetKey,
    locale: input.locale,
    title: input.title ?? null,
    description: input.description ?? null,
    keywords: input.keywords ?? [],
    ogTitle: input.ogTitle ?? null,
    ogDescription: input.ogDescription ?? null,
    ogImageMediaId: input.ogImageMediaId ?? null,
    ogImageTemplate: input.ogImageTemplate ?? null,
    twitterCard: input.twitterCard ?? 'summary_large_image',
    canonical: input.canonical ?? null,
    robotsIndex: input.robotsIndex ?? true,
    robotsFollow: input.robotsFollow ?? true,
    structuredData: input.structuredData ?? null,
    draftedAt: now,
    updatedAt: now,
  } as const;

  if (drizzle) {
    if (existing) {
      await drizzle
        .update(schema.seoOverrides)
        .set(baseValues)
        .where(eq(schema.seoOverrides.id, id));
    } else {
      await drizzle.insert(schema.seoOverrides).values({
        ...baseValues,
        createdAt: now,
        createdBy: input.actorId,
      } as never);
    }
    const rows = await drizzle
      .select()
      .from(schema.seoOverrides)
      .where(eq(schema.seoOverrides.id, id))
      .limit(1);
    return rowToOverride(rows[0]!);
  }
  const next: SeoOverride = {
    ...baseValues,
    keywords: input.keywords ?? [],
    structuredData: input.structuredData ?? null,
    publishedAt: existing?.publishedAt ?? null,
    createdAt: existing?.createdAt ?? now,
    createdBy: existing?.createdBy ?? input.actorId,
  };
  ext().seoOverrides.set(id, next);
  return next;
}

export async function publishOverride(
  id: string,
  actorId: string | null,
): Promise<{ override: SeoOverride; snapshot: SeoAuditSnapshot } | null> {
  const drizzle = db();
  const existing = await getOverrideById(id);
  if (!existing) return null;
  const now = new Date();
  const snapshotPayload = { ...existing };
  const snapshot: SeoAuditSnapshot = {
    id: createId('seoaudit'),
    scope: existing.scope,
    targetKey: existing.targetKey,
    locale: existing.locale,
    capturedAt: now,
    payload: snapshotPayload,
    actorId,
  };
  if (drizzle) {
    await drizzle
      .update(schema.seoOverrides)
      .set({ publishedAt: now, updatedAt: now })
      .where(eq(schema.seoOverrides.id, id));
    await drizzle.insert(schema.seoAuditSnapshots).values({
      id: snapshot.id,
      scope: snapshot.scope,
      targetKey: snapshot.targetKey,
      locale: snapshot.locale,
      capturedAt: snapshot.capturedAt,
      payload: snapshot.payload as never,
      actorId,
    } as never);
    const rows = await drizzle
      .select()
      .from(schema.seoOverrides)
      .where(eq(schema.seoOverrides.id, id))
      .limit(1);
    return { override: rowToOverride(rows[0]!), snapshot };
  }
  const updated: SeoOverride = { ...existing, publishedAt: now, updatedAt: now };
  ext().seoOverrides.set(id, updated);
  ext().seoAuditSnapshots.set(snapshot.id, snapshot);
  return { override: updated, snapshot };
}

/**
 * published → draft. Clear `publishedAt` ; le draft reste accessible côté admin
 * mais cesse d'être consommé par le resolver public (cf. resolveSeoMetadata).
 */
export async function unpublishOverride(
  id: string,
): Promise<SeoOverride | null> {
  const drizzle = db();
  const existing = await getOverrideById(id);
  if (!existing) return null;
  if (existing.publishedAt === null) return existing;
  const now = new Date();
  if (drizzle) {
    await drizzle
      .update(schema.seoOverrides)
      .set({ publishedAt: null, updatedAt: now })
      .where(eq(schema.seoOverrides.id, id));
    const rows = await drizzle
      .select()
      .from(schema.seoOverrides)
      .where(eq(schema.seoOverrides.id, id))
      .limit(1);
    return rows[0] ? rowToOverride(rows[0]) : null;
  }
  const updated: SeoOverride = { ...existing, publishedAt: null, updatedAt: now };
  ext().seoOverrides.set(id, updated);
  return updated;
}

export async function deleteOverride(id: string): Promise<boolean> {
  const drizzle = db();
  if (drizzle) {
    const res = await drizzle
      .delete(schema.seoOverrides)
      .where(eq(schema.seoOverrides.id, id))
      .returning();
    return res.length > 0;
  }
  return ext().seoOverrides.delete(id);
}

export async function getSeoSettings(): Promise<SeoSettings> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.seoSettings)
      .where(eq(schema.seoSettings.id, 'singleton'))
      .limit(1);
    const r = rows[0];
    if (!r) return seoSettingsDefault;
    return {
      id: 'singleton',
      siteName: r.siteName,
      defaultDescription: r.defaultDescription,
      defaultOgImageMediaId: r.defaultOgImageMediaId,
      twitterHandle: r.twitterHandle,
      organizationJsonLd: r.organizationJsonLd,
      defaultRobotsIndex: r.defaultRobotsIndex,
      defaultRobotsFollow: r.defaultRobotsFollow,
      knownPages: Array.isArray(r.knownPages) ? (r.knownPages as KnownPage[]) : [],
      updatedAt: r.updatedAt,
      updatedBy: r.updatedBy,
    };
  }
  return ext().seoSettings ?? seoSettingsDefault;
}

export async function upsertSeoSettings(input: {
  siteName: string;
  defaultDescription: string | null;
  defaultOgImageMediaId: string | null;
  twitterHandle: string | null;
  organizationJsonLd: unknown;
  defaultRobotsIndex: boolean;
  defaultRobotsFollow: boolean;
  knownPages: KnownPage[];
  actorId: string | null;
}): Promise<SeoSettings> {
  const drizzle = db();
  const now = new Date();
  if (drizzle) {
    const existing = await drizzle
      .select()
      .from(schema.seoSettings)
      .where(eq(schema.seoSettings.id, 'singleton'))
      .limit(1);
    const values = {
      id: 'singleton',
      siteName: input.siteName,
      defaultDescription: input.defaultDescription,
      defaultOgImageMediaId: input.defaultOgImageMediaId,
      twitterHandle: input.twitterHandle,
      organizationJsonLd: input.organizationJsonLd as never,
      defaultRobotsIndex: input.defaultRobotsIndex,
      defaultRobotsFollow: input.defaultRobotsFollow,
      knownPages: input.knownPages as never,
      updatedAt: now,
      updatedBy: input.actorId,
    } as const;
    if (existing[0]) {
      await drizzle
        .update(schema.seoSettings)
        .set(values)
        .where(eq(schema.seoSettings.id, 'singleton'));
    } else {
      await drizzle.insert(schema.seoSettings).values(values);
    }
    return getSeoSettings();
  }
  const next: SeoSettings = {
    id: 'singleton',
    siteName: input.siteName,
    defaultDescription: input.defaultDescription,
    defaultOgImageMediaId: input.defaultOgImageMediaId,
    twitterHandle: input.twitterHandle,
    organizationJsonLd: input.organizationJsonLd,
    defaultRobotsIndex: input.defaultRobotsIndex,
    defaultRobotsFollow: input.defaultRobotsFollow,
    knownPages: input.knownPages,
    updatedAt: now,
    updatedBy: input.actorId,
  };
  ext().seoSettings = next;
  return next;
}

export async function listAuditSnapshots(
  scope: SeoScope,
  targetKey: string,
  locale: string,
  limit = 50,
): Promise<SeoAuditSnapshot[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.seoAuditSnapshots)
      .where(
        and(
          eq(schema.seoAuditSnapshots.scope, scope),
          eq(schema.seoAuditSnapshots.targetKey, targetKey),
          eq(schema.seoAuditSnapshots.locale, locale),
        ),
      )
      .orderBy(desc(schema.seoAuditSnapshots.capturedAt))
      .limit(limit);
    return rows.map((r) => ({
      id: r.id,
      scope: r.scope,
      targetKey: r.targetKey,
      locale: r.locale,
      capturedAt: r.capturedAt,
      payload: r.payload,
      actorId: r.actorId,
    }));
  }
  const all = Array.from(ext().seoAuditSnapshots.values()).filter(
    (s) => s.scope === scope && s.targetKey === targetKey && s.locale === locale,
  );
  all.sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime());
  return all.slice(0, limit);
}

// Marker import to keep `asc` referenced in case build strictness changes
export const __noop_for_typecheck_seo = asc;
