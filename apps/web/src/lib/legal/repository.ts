import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';

import { db, schema } from '@/lib/db/client';
import type {
  LegalPageRow,
  LegalPageHistoryRow,
  LegalPagePlacementRow,
  LegalZoneRow,
  LegalTemplateVarRow,
} from '@/lib/db/schema';
import { createId } from '@/lib/ids';
import {
  LEGAL_PAGE_ID_PREFIX,
  LEGAL_PAGE_HISTORY_ID_PREFIX,
  type LegalPageStatus,
} from '@/lib/legal/types';

function conn() {
  const c = db();
  if (!c) throw new Error('legal repository requires DATABASE_URL');
  return c;
}

export async function getLegalPageBySlug(slug: string): Promise<LegalPageRow | null> {
  const rows = await conn().select().from(schema.legalPages).where(eq(schema.legalPages.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export async function getPublishedLegalPage(slug: string): Promise<LegalPageRow | null> {
  const rows = await conn()
    .select()
    .from(schema.legalPages)
    .where(and(eq(schema.legalPages.slug, slug), eq(schema.legalPages.status, 'published')))
    .limit(1);
  return rows[0] ?? null;
}

export async function listLegalPages(filter: {
  status?: LegalPageStatus;
} = {}): Promise<LegalPageRow[]> {
  const c = conn();
  if (filter.status) {
    return c
      .select()
      .from(schema.legalPages)
      .where(eq(schema.legalPages.status, filter.status))
      .orderBy(desc(schema.legalPages.updatedAt));
  }
  return c.select().from(schema.legalPages).orderBy(desc(schema.legalPages.updatedAt));
}

export interface LegalListStats {
  total: number;
  draft: number;
  review: number;
  published: number;
  archived: number;
}

export async function legalListStats(): Promise<LegalListStats> {
  const rows = await conn()
    .select({ status: schema.legalPages.status, count: sql<number>`count(*)::int` })
    .from(schema.legalPages)
    .groupBy(schema.legalPages.status);

  const stats: LegalListStats = {
    total: 0,
    draft: 0,
    review: 0,
    published: 0,
    archived: 0,
  };
  for (const r of rows) {
    stats.total += r.count;
    stats[r.status as keyof Omit<LegalListStats, 'total'>] = r.count;
  }
  return stats;
}

export interface CreateLegalPageInput {
  slug: string;
  title: string;
  description?: string | null;
  bodyMd: string;
  includeInSearch?: boolean;
  canonicalUrl?: string | null;
  locale?: 'fr-MA' | 'ar-MA';
  requireLegalReview?: boolean;
  actorId?: string | null;
}

export async function createLegalPage(input: CreateLegalPageInput): Promise<LegalPageRow> {
  const id = createId(LEGAL_PAGE_ID_PREFIX);
  const [row] = await conn()
    .insert(schema.legalPages)
    .values({
      id,
      slug: input.slug,
      title: input.title,
      description: input.description ?? null,
      bodyMd: input.bodyMd,
      includeInSearch: input.includeInSearch ?? false,
      canonicalUrl: input.canonicalUrl ?? null,
      locale: input.locale ?? 'fr-MA',
      requireLegalReview: input.requireLegalReview ?? true,
      createdBy: input.actorId ?? null,
      updatedBy: input.actorId ?? null,
    })
    .returning();
  if (!row) throw new Error('createLegalPage returned no row');
  return row;
}

export interface UpdateLegalPageInput {
  title?: string;
  description?: string | null;
  bodyMd?: string;
  includeInSearch?: boolean;
  canonicalUrl?: string | null;
  requireLegalReview?: boolean;
  actorId?: string | null;
}

export async function updateLegalPage(slug: string, patch: UpdateLegalPageInput): Promise<LegalPageRow | null> {
  const updates: Record<string, unknown> = {
    updatedAt: sql`now()`,
    updatedBy: patch.actorId ?? null,
  };
  if (patch.title !== undefined) updates.title = patch.title;
  if (patch.description !== undefined) updates.description = patch.description;
  if (patch.bodyMd !== undefined) updates.bodyMd = patch.bodyMd;
  if (patch.includeInSearch !== undefined) updates.includeInSearch = patch.includeInSearch;
  if (patch.canonicalUrl !== undefined) updates.canonicalUrl = patch.canonicalUrl;
  if (patch.requireLegalReview !== undefined) updates.requireLegalReview = patch.requireLegalReview;

  const [row] = await conn()
    .update(schema.legalPages)
    .set(updates)
    .where(eq(schema.legalPages.slug, slug))
    .returning();
  return row ?? null;
}

export async function archiveLegalPage(slug: string, actorId: string | null): Promise<LegalPageRow | null> {
  const [row] = await conn()
    .update(schema.legalPages)
    .set({ status: 'archived', updatedAt: sql`now()`, updatedBy: actorId })
    .where(eq(schema.legalPages.slug, slug))
    .returning();
  return row ?? null;
}

export async function submitForReview(
  slug: string,
  actorId: string | null,
): Promise<LegalPageRow | null> {
  const [row] = await conn()
    .update(schema.legalPages)
    .set({
      status: 'review',
      submittedAt: sql`now()`,
      submittedBy: actorId,
      updatedAt: sql`now()`,
      updatedBy: actorId,
    })
    .where(eq(schema.legalPages.slug, slug))
    .returning();
  return row ?? null;
}

export async function listHistoryForSlug(slug: string): Promise<LegalPageHistoryRow[]> {
  return conn()
    .select()
    .from(schema.legalPagesHistory)
    .where(eq(schema.legalPagesHistory.slug, slug))
    .orderBy(desc(schema.legalPagesHistory.version));
}

export async function getHistoryEntry(
  pageId: string,
  version: number,
): Promise<LegalPageHistoryRow | null> {
  const rows = await conn()
    .select()
    .from(schema.legalPagesHistory)
    .where(
      and(
        eq(schema.legalPagesHistory.pageId, pageId),
        eq(schema.legalPagesHistory.version, version),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function listPlacementsForZone(zoneKey: string): Promise<
  Array<{ pageSlug: string; title: string; labelOverride: string | null; displayOrder: number }>
> {
  const rows = await conn()
    .select({
      pageSlug: schema.legalPagePlacements.pageSlug,
      title: schema.legalPages.title,
      labelOverride: schema.legalPagePlacements.labelOverride,
      displayOrder: schema.legalPagePlacements.displayOrder,
    })
    .from(schema.legalPagePlacements)
    .innerJoin(schema.legalPages, eq(schema.legalPages.slug, schema.legalPagePlacements.pageSlug))
    .where(
      and(
        eq(schema.legalPagePlacements.zoneKey, zoneKey),
        eq(schema.legalPagePlacements.isVisible, true),
        eq(schema.legalPages.status, 'published'),
      ),
    )
    .orderBy(asc(schema.legalPagePlacements.displayOrder), asc(schema.legalPages.title));
  return rows;
}

export async function listAllPlacements(): Promise<LegalPagePlacementRow[]> {
  return conn().select().from(schema.legalPagePlacements);
}

export async function upsertPlacement(input: {
  pageSlug: string;
  zoneKey: string;
  displayOrder?: number;
  isVisible?: boolean;
  labelOverride?: string | null;
}): Promise<void> {
  await conn()
    .insert(schema.legalPagePlacements)
    .values({
      pageSlug: input.pageSlug,
      zoneKey: input.zoneKey,
      displayOrder: input.displayOrder ?? 0,
      isVisible: input.isVisible ?? true,
      labelOverride: input.labelOverride ?? null,
    })
    .onConflictDoUpdate({
      target: [schema.legalPagePlacements.pageSlug, schema.legalPagePlacements.zoneKey],
      set: {
        displayOrder: input.displayOrder,
        isVisible: input.isVisible,
        labelOverride: input.labelOverride,
        updatedAt: sql`now()`,
      },
    });
}

export async function listAllZones(): Promise<LegalZoneRow[]> {
  return conn().select().from(schema.legalZones).orderBy(asc(schema.legalZones.displayOrder));
}

export async function listAllTemplateVars(): Promise<LegalTemplateVarRow[]> {
  return conn().select().from(schema.legalTemplateVars).orderBy(asc(schema.legalTemplateVars.key));
}

export async function updateTemplateVar(
  key: string,
  value: string | null,
  actorId: string | null,
): Promise<LegalTemplateVarRow | null> {
  const [row] = await conn()
    .update(schema.legalTemplateVars)
    .set({ value, updatedAt: sql`now()`, updatedBy: actorId })
    .where(eq(schema.legalTemplateVars.key, key))
    .returning();
  return row ?? null;
}

export async function listPublishedSlugs(): Promise<string[]> {
  const rows = await conn()
    .select({ slug: schema.legalPages.slug })
    .from(schema.legalPages)
    .where(eq(schema.legalPages.status, 'published'));
  return rows.map((r) => r.slug);
}

export async function listPublishedSearchablePages(): Promise<
  Array<Pick<LegalPageRow, 'slug' | 'updatedAt' | 'publishedAt'>>
> {
  const rows = await conn()
    .select({
      slug: schema.legalPages.slug,
      updatedAt: schema.legalPages.updatedAt,
      publishedAt: schema.legalPages.publishedAt,
    })
    .from(schema.legalPages)
    .where(
      and(
        eq(schema.legalPages.status, 'published'),
        eq(schema.legalPages.includeInSearch, true),
      ),
    );
  return rows;
}

export async function pagesWithMissingPlacements(): Promise<string[]> {
  const published = await conn()
    .select({ slug: schema.legalPages.slug })
    .from(schema.legalPages)
    .where(eq(schema.legalPages.status, 'published'));
  if (published.length === 0) return [];

  const placed = await conn()
    .selectDistinct({ slug: schema.legalPagePlacements.pageSlug })
    .from(schema.legalPagePlacements)
    .where(
      and(
        inArray(
          schema.legalPagePlacements.pageSlug,
          published.map((p) => p.slug),
        ),
        eq(schema.legalPagePlacements.isVisible, true),
      ),
    );

  const placedSet = new Set(placed.map((p) => p.slug));
  return published.filter((p) => !placedSet.has(p.slug)).map((p) => p.slug);
}

export { LEGAL_PAGE_HISTORY_ID_PREFIX };
