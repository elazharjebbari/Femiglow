import { desc, eq, inArray } from 'drizzle-orm';
import { db, memoryStore } from '@/lib/db/client';
import { createId } from '@/lib/ids';
import {
  contentAssetBindings,
  contentBrandReviews,
  contentBriefs,
  contentDrafts,
  contentGenerationRuns,
  contentIdeas,
  contentPostizDeliveries,
  contentPosts,
  contentPerformanceSnapshots,
} from '@/lib/db/schema-content-studio';
import type {
  BrandReviewStatus,
  ContentAssetBinding,
  ContentBrandReview,
  ContentBrief,
  ContentDraft,
  ContentFormat,
  ContentGenerationRun,
  ContentIdea,
  ContentPerformanceSnapshot,
  ContentObjective,
  ContentPillar,
  ContentPlatform,
  ContentPost,
  ContentPostizDelivery,
  ContentStatus,
} from './types';

interface Store {
  contentIdeas: Map<string, ContentIdea>;
  contentBriefs: Map<string, ContentBrief>;
  contentDrafts: Map<string, ContentDraft>;
  contentAssetBindings: Map<string, ContentAssetBinding>;
  contentBrandReviews: Map<string, ContentBrandReview>;
  contentGenerationRuns: Map<string, ContentGenerationRun>;
  contentPosts: Map<string, ContentPost>;
  contentPostizDeliveries: Map<string, ContentPostizDelivery>;
  contentPerformanceSnapshots: Map<string, ContentPerformanceSnapshot>;
}

function store(): Store {
  const s = memoryStore() as unknown as Store & Record<string, unknown>;
  if (!s.contentIdeas) s.contentIdeas = new Map();
  if (!s.contentBriefs) s.contentBriefs = new Map();
  if (!s.contentDrafts) s.contentDrafts = new Map();
  if (!s.contentAssetBindings) s.contentAssetBindings = new Map();
  if (!s.contentBrandReviews) s.contentBrandReviews = new Map();
  if (!s.contentGenerationRuns) s.contentGenerationRuns = new Map();
  if (!s.contentPosts) s.contentPosts = new Map();
  if (!s.contentPostizDeliveries) s.contentPostizDeliveries = new Map();
  if (!s.contentPerformanceSnapshots) s.contentPerformanceSnapshots = new Map();
  return s;
}

function rowIdea(row: typeof contentIdeas.$inferSelect): ContentIdea {
  return {
    id: row.id,
    campaignId: row.campaignId,
    pillar: row.pillar as ContentPillar,
    objective: row.objective as ContentObjective,
    platform: row.platform as ContentPlatform,
    format: row.format as ContentFormat,
    prompt: row.prompt,
    sourceType: row.sourceType,
    sourceRef: row.sourceRef,
    status: row.status as ContentStatus,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function rowBrief(row: typeof contentBriefs.$inferSelect): ContentBrief {
  return {
    id: row.id,
    ideaId: row.ideaId,
    angle: row.angle,
    proof: row.proof,
    cta: row.cta,
    mediaDirection: row.mediaDirection,
    constraints: (row.constraints as Record<string, unknown>) ?? {},
    version: row.version,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  };
}

function rowDraft(row: typeof contentDrafts.$inferSelect): ContentDraft {
  return {
    id: row.id,
    briefId: row.briefId,
    platform: row.platform as ContentPlatform,
    format: row.format as ContentFormat,
    variantLabel: row.variantLabel,
    caption: row.caption,
    hook: row.hook,
    cta: row.cta,
    altText: row.altText,
    hashtags: Array.isArray(row.hashtags) ? (row.hashtags as string[]) : [],
    status: row.status as ContentStatus,
    scoreTotal: row.scoreTotal,
    editedBy: row.editedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function rowReview(row: typeof contentBrandReviews.$inferSelect): ContentBrandReview {
  return {
    id: row.id,
    draftId: row.draftId,
    status: row.status as BrandReviewStatus,
    scoreTotal: row.scoreTotal,
    score: (row.score as Record<string, number>) ?? {},
    violations: Array.isArray(row.violations) ? (row.violations as never) : [],
    rulesVersion: row.rulesVersion,
    createdAt: row.createdAt,
  };
}

function rowPost(row: typeof contentPosts.$inferSelect): ContentPost {
  return {
    id: row.id,
    draftId: row.draftId,
    status: row.status as ContentStatus,
    scheduledAt: row.scheduledAt,
    publishedAt: row.publishedAt,
    utm: (row.utm as Record<string, unknown>) ?? {},
    approvedBy: row.approvedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function rowDelivery(row: typeof contentPostizDeliveries.$inferSelect): ContentPostizDelivery {
  return {
    id: row.id,
    postId: row.postId,
    integrationId: row.integrationId,
    postizPostId: row.postizPostId,
    status: row.status as ContentPostizDelivery['status'],
    request: (row.request as Record<string, unknown>) ?? {},
    response: (row.response as Record<string, unknown>) ?? {},
    attemptCount: row.attemptCount,
    lastError: row.lastError,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function createIdea(input: {
  campaignId?: string | null;
  pillar: ContentPillar;
  objective: ContentObjective;
  platform: ContentPlatform;
  format: ContentFormat;
  prompt: string;
  sourceType?: string | null;
  sourceRef?: string | null;
  actorId: string | null;
}): Promise<ContentIdea> {
  const now = new Date();
  const idea: ContentIdea = {
    id: createId('ci'),
    campaignId: input.campaignId ?? null,
    pillar: input.pillar,
    objective: input.objective,
    platform: input.platform,
    format: input.format,
    prompt: input.prompt,
    sourceType: input.sourceType ?? null,
    sourceRef: input.sourceRef ?? null,
    status: 'idea',
    createdBy: input.actorId,
    createdAt: now,
    updatedAt: now,
  };
  const drizzle = db();
  if (drizzle) await drizzle.insert(contentIdeas).values(idea);
  else store().contentIdeas.set(idea.id, idea);
  return idea;
}

export async function listIdeas(): Promise<ContentIdea[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle.select().from(contentIdeas).orderBy(desc(contentIdeas.createdAt)).limit(100);
    return rows.map(rowIdea);
  }
  return Array.from(store().contentIdeas.values()).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
}

export async function getIdea(id: string): Promise<ContentIdea | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle.select().from(contentIdeas).where(eq(contentIdeas.id, id)).limit(1);
    return rows[0] ? rowIdea(rows[0]) : null;
  }
  return store().contentIdeas.get(id) ?? null;
}

export async function updateIdeaStatus(id: string, status: ContentStatus): Promise<void> {
  const drizzle = db();
  const updatedAt = new Date();
  if (drizzle) {
    await drizzle.update(contentIdeas).set({ status, updatedAt }).where(eq(contentIdeas.id, id));
    return;
  }
  const existing = store().contentIdeas.get(id);
  if (existing) store().contentIdeas.set(id, { ...existing, status, updatedAt });
}

export async function createBrief(input: {
  ideaId: string;
  angle: string;
  proof?: string | null;
  cta: string;
  mediaDirection?: string | null;
  constraints?: Record<string, unknown>;
  actorId: string | null;
}): Promise<ContentBrief> {
  const brief: ContentBrief = {
    id: createId('cb'),
    ideaId: input.ideaId,
    angle: input.angle,
    proof: input.proof ?? null,
    cta: input.cta,
    mediaDirection: input.mediaDirection ?? null,
    constraints: input.constraints ?? {},
    version: 1,
    createdBy: input.actorId,
    createdAt: new Date(),
  };
  const drizzle = db();
  if (drizzle) await drizzle.insert(contentBriefs).values(brief);
  else store().contentBriefs.set(brief.id, brief);
  return brief;
}

export async function getBrief(id: string): Promise<ContentBrief | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle.select().from(contentBriefs).where(eq(contentBriefs.id, id)).limit(1);
    return rows[0] ? rowBrief(rows[0]) : null;
  }
  return store().contentBriefs.get(id) ?? null;
}

export async function getLatestBriefForIdea(ideaId: string): Promise<ContentBrief | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(contentBriefs)
      .where(eq(contentBriefs.ideaId, ideaId))
      .orderBy(desc(contentBriefs.version))
      .limit(1);
    return rows[0] ? rowBrief(rows[0]) : null;
  }
  return (
    Array.from(store().contentBriefs.values())
      .filter((b) => b.ideaId === ideaId)
      .sort((a, b) => b.version - a.version)[0] ?? null
  );
}

export async function createDrafts(
  inputs: Array<{
    briefId: string;
    platform: ContentPlatform;
    format: ContentFormat;
    variantLabel: string;
    caption: string;
    hook?: string | null;
    cta?: string | null;
    altText?: string | null;
    hashtags?: string[];
  }>,
): Promise<ContentDraft[]> {
  const now = new Date();
  const drafts = inputs.map((input) => ({
    id: createId('cd'),
    briefId: input.briefId,
    platform: input.platform,
    format: input.format,
    variantLabel: input.variantLabel,
    caption: input.caption,
    hook: input.hook ?? null,
    cta: input.cta ?? null,
    altText: input.altText ?? null,
    hashtags: input.hashtags ?? [],
    status: 'generated' as ContentStatus,
    scoreTotal: null,
    editedBy: null,
    createdAt: now,
    updatedAt: now,
  }));
  const drizzle = db();
  if (drizzle) {
    await drizzle.insert(contentDrafts).values(
      drafts.map((d) => ({ ...d, hashtags: d.hashtags as never })),
    );
  } else {
    for (const d of drafts) store().contentDrafts.set(d.id, d);
  }
  return drafts;
}

export async function listDrafts(): Promise<ContentDraft[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle.select().from(contentDrafts).orderBy(desc(contentDrafts.createdAt)).limit(100);
    return rows.map(rowDraft);
  }
  return Array.from(store().contentDrafts.values()).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
}

export async function getDraft(id: string): Promise<ContentDraft | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle.select().from(contentDrafts).where(eq(contentDrafts.id, id)).limit(1);
    return rows[0] ? rowDraft(rows[0]) : null;
  }
  return store().contentDrafts.get(id) ?? null;
}

export async function updateDraft(
  id: string,
  patch: Partial<Pick<ContentDraft, 'caption' | 'hook' | 'cta' | 'altText' | 'hashtags' | 'status' | 'scoreTotal' | 'editedBy'>>,
): Promise<ContentDraft | null> {
  const existing = await getDraft(id);
  if (!existing) return null;
  const updated: ContentDraft = { ...existing, ...patch, updatedAt: new Date() };
  const drizzle = db();
  if (drizzle) {
    await drizzle
      .update(contentDrafts)
      .set({
        caption: updated.caption,
        hook: updated.hook,
        cta: updated.cta,
        altText: updated.altText,
        hashtags: updated.hashtags as never,
        status: updated.status,
        scoreTotal: updated.scoreTotal,
        editedBy: updated.editedBy,
        updatedAt: updated.updatedAt,
      })
      .where(eq(contentDrafts.id, id));
  } else {
    store().contentDrafts.set(id, updated);
  }
  return updated;
}

export async function upsertPrimaryAsset(input: {
  draftId: string;
  mediaId: string;
}): Promise<ContentAssetBinding> {
  const binding: ContentAssetBinding = {
    id: createId('cab'),
    draftId: input.draftId,
    mediaId: input.mediaId,
    role: 'primary',
    crop: {},
    createdAt: new Date(),
  };
  const drizzle = db();
  if (drizzle) {
    await drizzle
      .delete(contentAssetBindings)
      .where(eq(contentAssetBindings.draftId, input.draftId));
    await drizzle.insert(contentAssetBindings).values(binding);
  } else {
    for (const [id, row] of store().contentAssetBindings.entries()) {
      if (row.draftId === input.draftId && row.role === 'primary') {
        store().contentAssetBindings.delete(id);
      }
    }
    store().contentAssetBindings.set(binding.id, binding);
  }
  return binding;
}

export async function getPrimaryAsset(draftId: string): Promise<ContentAssetBinding | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(contentAssetBindings)
      .where(eq(contentAssetBindings.draftId, draftId))
      .limit(1);
    const row = rows[0];
    return row
      ? {
          id: row.id,
          draftId: row.draftId,
          mediaId: row.mediaId,
          role: row.role,
          crop: (row.crop as Record<string, unknown>) ?? {},
          createdAt: row.createdAt,
        }
      : null;
  }
  return (
    Array.from(store().contentAssetBindings.values()).find((b) => b.draftId === draftId) ??
    null
  );
}

export async function listPrimaryAssetsForDrafts(
  draftIds: string[],
): Promise<ContentAssetBinding[]> {
  if (draftIds.length === 0) return [];
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(contentAssetBindings)
      .where(eq(contentAssetBindings.role, 'primary'));
    return rows
      .filter((row) => draftIds.includes(row.draftId))
      .map((row) => ({
        id: row.id,
        draftId: row.draftId,
        mediaId: row.mediaId,
        role: row.role,
        crop: (row.crop as Record<string, unknown>) ?? {},
        createdAt: row.createdAt,
      }));
  }
  return Array.from(store().contentAssetBindings.values()).filter(
    (binding) => binding.role === 'primary' && draftIds.includes(binding.draftId),
  );
}

export async function insertReview(review: ContentBrandReview): Promise<ContentBrandReview> {
  const drizzle = db();
  if (drizzle) {
    await drizzle.insert(contentBrandReviews).values({
      ...review,
      score: review.score as never,
      violations: review.violations as never,
    });
  } else {
    store().contentBrandReviews.set(review.id, review);
  }
  // After brand review, draft always moves to needs_review regardless of
  // whether violations were found. Approval is a separate action that
  // checks for blocking violations before allowing the transition.
  await updateDraft(review.draftId, {
    status: 'needs_review',
    scoreTotal: review.scoreTotal,
  });
  return review;
}

export async function getLatestReview(draftId: string): Promise<ContentBrandReview | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(contentBrandReviews)
      .where(eq(contentBrandReviews.draftId, draftId))
      .orderBy(desc(contentBrandReviews.createdAt))
      .limit(1);
    return rows[0] ? rowReview(rows[0]) : null;
  }
  return (
    Array.from(store().contentBrandReviews.values())
      .filter((r) => r.draftId === draftId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null
  );
}

export async function insertGenerationRun(
  run: Omit<ContentGenerationRun, 'id' | 'createdAt'>,
): Promise<ContentGenerationRun> {
  const row: ContentGenerationRun = { ...run, id: createId('cgr'), createdAt: new Date() };
  const drizzle = db();
  if (drizzle) {
    await drizzle.insert(contentGenerationRuns).values({
      ...row,
      input: row.input as never,
      output: row.output as never,
    });
  } else {
    store().contentGenerationRuns.set(row.id, row);
  }
  return row;
}

export async function approveDraft(input: {
  draftId: string;
  actorId: string;
}): Promise<ContentPost> {
  const now = new Date();
  const post: ContentPost = {
    id: createId('cp'),
    draftId: input.draftId,
    status: 'approved',
    scheduledAt: null,
    publishedAt: null,
    utm: {},
    approvedBy: input.actorId,
    createdAt: now,
    updatedAt: now,
  };
  const drizzle = db();
  if (drizzle) {
    await drizzle.insert(contentPosts).values({ ...post, utm: post.utm as never });
  } else {
    store().contentPosts.set(post.id, post);
  }
  await updateDraft(input.draftId, { status: 'approved', editedBy: input.actorId });
  return post;
}

export async function getPostForDraft(draftId: string): Promise<ContentPost | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle.select().from(contentPosts).where(eq(contentPosts.draftId, draftId)).limit(1);
    return rows[0] ? rowPost(rows[0]) : null;
  }
  return Array.from(store().contentPosts.values()).find((p) => p.draftId === draftId) ?? null;
}

export async function getPost(id: string): Promise<ContentPost | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle.select().from(contentPosts).where(eq(contentPosts.id, id)).limit(1);
    return rows[0] ? rowPost(rows[0]) : null;
  }
  return store().contentPosts.get(id) ?? null;
}

export async function listPosts(): Promise<ContentPost[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle.select().from(contentPosts).orderBy(desc(contentPosts.createdAt)).limit(100);
    return rows.map(rowPost);
  }
  return Array.from(store().contentPosts.values()).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
}

export async function updatePostPlanning(input: {
  postId: string;
  scheduledAt: Date | null;
  status?: ContentStatus;
}): Promise<ContentPost | null> {
  const existing = await getPost(input.postId);
  if (!existing) return null;
  const updated: ContentPost = {
    ...existing,
    scheduledAt: input.scheduledAt,
    status: input.status ?? existing.status,
    updatedAt: new Date(),
  };
  const drizzle = db();
  if (drizzle) {
    await drizzle
      .update(contentPosts)
      .set({
        scheduledAt: updated.scheduledAt,
        status: updated.status,
        updatedAt: updated.updatedAt,
      })
      .where(eq(contentPosts.id, input.postId));
  } else {
    store().contentPosts.set(input.postId, updated);
  }
  return updated;
}

export async function insertPostizDelivery(input: {
  postId: string;
  integrationId: string;
  postizPostId?: string | null;
  status: ContentPostizDelivery['status'];
  request: Record<string, unknown>;
  response: Record<string, unknown>;
  attemptCount?: number;
  lastError?: string | null;
}): Promise<ContentPostizDelivery> {
  const now = new Date();
  const delivery: ContentPostizDelivery = {
    id: createId('cpd'),
    postId: input.postId,
    integrationId: input.integrationId,
    postizPostId: input.postizPostId ?? null,
    status: input.status,
    request: input.request,
    response: input.response,
    attemptCount: input.attemptCount ?? 1,
    lastError: input.lastError ?? null,
    createdAt: now,
    updatedAt: now,
  };
  const drizzle = db();
  if (drizzle) {
    await drizzle.insert(contentPostizDeliveries).values({
      ...delivery,
      request: delivery.request as never,
      response: delivery.response as never,
    });
  } else {
    store().contentPostizDeliveries.set(delivery.id, delivery);
  }
  return delivery;
}

export async function listPostizDeliveriesForPosts(
  postIds: string[],
): Promise<ContentPostizDelivery[]> {
  if (postIds.length === 0) return [];
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(contentPostizDeliveries)
      .where(inArray(contentPostizDeliveries.postId, postIds))
      .orderBy(desc(contentPostizDeliveries.createdAt))
      .limit(200);
    return rows.map(rowDelivery);
  }
  return Array.from(store().contentPostizDeliveries.values())
    .filter((delivery) => postIds.includes(delivery.postId))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function listPostizDeliveriesByStatus(input: {
  statuses: ContentPostizDelivery['status'][];
  limit?: number;
}): Promise<ContentPostizDelivery[]> {
  if (input.statuses.length === 0) return [];
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(contentPostizDeliveries)
      .where(inArray(contentPostizDeliveries.status, input.statuses))
      .orderBy(desc(contentPostizDeliveries.createdAt))
      .limit(limit);
    return rows.map(rowDelivery);
  }
  return Array.from(store().contentPostizDeliveries.values())
    .filter((delivery) => input.statuses.includes(delivery.status))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

export async function insertPerformanceSnapshot(input: {
  postId: string;
  source: string;
  metrics: Record<string, unknown>;
}): Promise<ContentPerformanceSnapshot> {
  const snapshot: ContentPerformanceSnapshot = {
    id: createId('cps'),
    postId: input.postId,
    source: input.source,
    metrics: input.metrics,
    capturedAt: new Date(),
  };
  const drizzle = db();
  if (drizzle) {
    await drizzle.insert(contentPerformanceSnapshots).values({
      ...snapshot,
      metrics: snapshot.metrics as never,
    });
  } else {
    store().contentPerformanceSnapshots.set(snapshot.id, snapshot);
  }
  return snapshot;
}

export async function listPerformanceSnapshotsForPosts(
  postIds: string[],
): Promise<ContentPerformanceSnapshot[]> {
  if (postIds.length === 0) return [];
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(contentPerformanceSnapshots)
      .where(inArray(contentPerformanceSnapshots.postId, postIds))
      .orderBy(desc(contentPerformanceSnapshots.capturedAt))
      .limit(200);
    return rows.map((row) => ({
      id: row.id,
      postId: row.postId,
      source: row.source,
      metrics: (row.metrics as Record<string, unknown>) ?? {},
      capturedAt: row.capturedAt,
    }));
  }
  return Array.from(store().contentPerformanceSnapshots.values())
    .filter((snapshot) => postIds.includes(snapshot.postId))
    .sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime())
    .slice(0, 200);
}
