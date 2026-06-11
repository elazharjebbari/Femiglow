import { and, desc, eq, inArray } from 'drizzle-orm';
import { db, memoryStore } from '@/lib/db/client';
import { createId } from '@/lib/ids';
import {
  contentAssetBindings,
  contentBrandReviews,
  contentBriefs,
  contentCampaigns,
  contentDrafts,
  contentGenerationRuns,
  contentIdeas,
  contentLearningNotes,
  contentPostizDeliveries,
  contentPosts,
  contentPerformanceSnapshots,
} from '@/lib/db/schema-content-studio';
import type {
  BrandReviewStatus,
  ContentAssetBinding,
  ContentBrandReview,
  ContentBrief,
  ContentCampaign,
  ContentDraft,
  ContentFormat,
  ContentGenerationRun,
  ContentIdea,
  ContentLearningNote,
  ContentPerformanceSnapshot,
  ContentObjective,
  ContentPillar,
  ContentPlatform,
  ContentPost,
  ContentPostizDelivery,
  ContentStatus,
  MediaRole,
} from './types';
import { assertTransition } from './state-machine';

interface Store {
  contentCampaigns: Map<string, ContentCampaign>;
  contentIdeas: Map<string, ContentIdea>;
  contentBriefs: Map<string, ContentBrief>;
  contentDrafts: Map<string, ContentDraft>;
  contentAssetBindings: Map<string, ContentAssetBinding>;
  contentBrandReviews: Map<string, ContentBrandReview>;
  contentGenerationRuns: Map<string, ContentGenerationRun>;
  contentPosts: Map<string, ContentPost>;
  contentPostizDeliveries: Map<string, ContentPostizDelivery>;
  contentPerformanceSnapshots: Map<string, ContentPerformanceSnapshot>;
  contentLearningNotes: Map<string, ContentLearningNote>;
}

function store(): Store {
  const s = memoryStore() as unknown as Store & Record<string, unknown>;
  if (!s.contentCampaigns) s.contentCampaigns = new Map();
  if (!s.contentIdeas) s.contentIdeas = new Map();
  if (!s.contentBriefs) s.contentBriefs = new Map();
  if (!s.contentDrafts) s.contentDrafts = new Map();
  if (!s.contentAssetBindings) s.contentAssetBindings = new Map();
  if (!s.contentBrandReviews) s.contentBrandReviews = new Map();
  if (!s.contentGenerationRuns) s.contentGenerationRuns = new Map();
  if (!s.contentPosts) s.contentPosts = new Map();
  if (!s.contentPostizDeliveries) s.contentPostizDeliveries = new Map();
  if (!s.contentPerformanceSnapshots) s.contentPerformanceSnapshots = new Map();
  if (!s.contentLearningNotes) s.contentLearningNotes = new Map();
  return s;
}

function rowCampaign(row: typeof contentCampaigns.$inferSelect): ContentCampaign {
  return {
    id: row.id,
    name: row.name,
    objective: row.objective,
    status: row.status as ContentCampaign['status'],
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
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
    rejectionReason: (row as Record<string, unknown>).rejectionReason as string | null ?? null,
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
    rejectionReason: (row as Record<string, unknown>).rejectionReason as string | null ?? null,
    parentDraftId: (row as Record<string, unknown>).parentDraftId as string | null ?? null,
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
    reviewerId: (row as Record<string, unknown>).reviewerId as string | null ?? null,
    reviewType: ((row as Record<string, unknown>).reviewType as 'auto' | 'manual') ?? 'auto',
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
    cancelledBy: (row as Record<string, unknown>).cancelledBy as string | null ?? null,
    cancelledAt: (row as Record<string, unknown>).cancelledAt as Date | null ?? null,
    cancelReason: (row as Record<string, unknown>).cancelReason as string | null ?? null,
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
    rejectionReason: null,
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

export async function listIdeas(filters?: { status?: string; pillar?: string; platform?: string; limit?: number; offset?: number }): Promise<ContentIdea[]> {
  const limit = filters?.limit ?? 100;
  const offset = filters?.offset ?? 0;
  const drizzle = db();
  if (drizzle) {
    const conditions = [];
    if (filters?.status) conditions.push(eq(contentIdeas.status, filters.status));
    if (filters?.pillar) conditions.push(eq(contentIdeas.pillar, filters.pillar));
    if (filters?.platform) conditions.push(eq(contentIdeas.platform, filters.platform));
    const rows = await drizzle.select().from(contentIdeas)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(contentIdeas.createdAt))
      .limit(limit)
      .offset(offset);
    return rows.map(rowIdea);
  }
  let items = Array.from(store().contentIdeas.values()).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
  if (filters?.status) items = items.filter((i) => i.status === filters.status);
  if (filters?.pillar) items = items.filter((i) => i.pillar === filters.pillar);
  if (filters?.platform) items = items.filter((i) => i.platform === filters.platform);
  return items.slice(offset, offset + limit);
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

export async function updateBrief(id: string, patch: Partial<Pick<ContentBrief, 'angle' | 'proof' | 'cta' | 'mediaDirection' | 'constraints'>>): Promise<ContentBrief | null> {
  const existing = await getBrief(id);
  if (!existing) return null;
  const updated: ContentBrief = { ...existing, ...patch };
  const drizzle = db();
  if (drizzle) {
    const setFields: Record<string, unknown> = {};
    if (patch.angle !== undefined) setFields.angle = patch.angle;
    if (patch.proof !== undefined) setFields.proof = patch.proof;
    if (patch.cta !== undefined) setFields.cta = patch.cta;
    if (patch.mediaDirection !== undefined) setFields.mediaDirection = patch.mediaDirection;
    if (patch.constraints !== undefined) setFields.constraints = patch.constraints;
    await drizzle.update(contentBriefs).set(setFields).where(eq(contentBriefs.id, id));
  } else {
    store().contentBriefs.set(id, updated);
  }
  return updated;
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
    rejectionReason: null as string | null,
    parentDraftId: null as string | null,
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

export async function listDrafts(filters?: { status?: string; platform?: string; format?: string; limit?: number; offset?: number }): Promise<ContentDraft[]> {
  const limit = filters?.limit ?? 100;
  const offset = filters?.offset ?? 0;
  const drizzle = db();
  if (drizzle) {
    const conditions = [];
    if (filters?.status) conditions.push(eq(contentDrafts.status, filters.status));
    if (filters?.platform) conditions.push(eq(contentDrafts.platform, filters.platform));
    if (filters?.format) conditions.push(eq(contentDrafts.format, filters.format));
    const rows = await drizzle.select().from(contentDrafts)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(contentDrafts.createdAt))
      .limit(limit)
      .offset(offset);
    return rows.map(rowDraft);
  }
  let items = Array.from(store().contentDrafts.values()).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
  if (filters?.status) items = items.filter((d) => d.status === filters.status);
  if (filters?.platform) items = items.filter((d) => d.platform === filters.platform);
  if (filters?.format) items = items.filter((d) => d.format === filters.format);
  return items.slice(offset, offset + limit);
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
  patch: Partial<Pick<ContentDraft, 'caption' | 'hook' | 'cta' | 'altText' | 'hashtags' | 'status' | 'scoreTotal' | 'editedBy' | 'rejectionReason'>>,
): Promise<ContentDraft | null> {
  const existing = await getDraft(id);
  if (!existing) return null;
  // Un patch peut porter des clés explicitement `undefined` (ex. PATCH
  // {mediaId} seul → service passe caption: undefined). Le spread JS écrase
  // alors la valeur existante : drizzle ignorait l'undefined côté DB mais
  // l'objet RETOURNÉ (donc l'état client) perdait sa caption — et le
  // memory-store la perdait pour de bon. On ne garde que les clés définies
  // (`null` reste un effacement volontaire, seul `undefined` est ignoré).
  const definedPatch = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== undefined),
  ) as typeof patch;
  const updated: ContentDraft = { ...existing, ...definedPatch, updatedAt: new Date() };
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

/**
 * Upsert a set of media bindings for a draft, one per role (MP-AR-003,
 * BUG-004). Each (draftId, role) is delete-then-insert SCOPED to that role, so
 * other roles in the bundle are untouched — unlike the legacy
 * `upsertPrimaryAsset` which wiped every binding for the draft.
 */
export async function upsertBundleAssets(input: {
  draftId: string;
  assets: Array<{
    mediaId: string;
    role: MediaRole;
    crop?: Record<string, unknown>;
    meta?: Record<string, unknown>;
  }>;
}): Promise<ContentAssetBinding[]> {
  const drizzle = db();
  const out: ContentAssetBinding[] = [];
  for (const a of input.assets) {
    const binding: ContentAssetBinding = {
      id: createId('cab'),
      draftId: input.draftId,
      mediaId: a.mediaId,
      role: a.role,
      crop: a.crop ?? {},
      meta: a.meta ?? {},
      createdAt: new Date(),
    };
    if (drizzle) {
      // Transaction : un crash entre le delete et l'insert laissait le draft
      // sans asset pour ce rôle (perte du visuel lié).
      await drizzle.transaction(async (tx) => {
        await tx
          .delete(contentAssetBindings)
          .where(
            and(
              eq(contentAssetBindings.draftId, input.draftId),
              eq(contentAssetBindings.role, a.role),
            ),
          );
        await tx.insert(contentAssetBindings).values(binding);
      });
    } else {
      for (const [id, row] of store().contentAssetBindings.entries()) {
        if (row.draftId === input.draftId && row.role === a.role) {
          store().contentAssetBindings.delete(id);
        }
      }
      store().contentAssetBindings.set(binding.id, binding);
    }
    out.push(binding);
  }
  return out;
}

/**
 * D6 non-regression shim — keeps every existing call site working unchanged.
 * Defaults to the `primary_image` role (the legacy `primary` semantics).
 */
export async function upsertPrimaryAsset(input: {
  draftId: string;
  mediaId: string;
  role?: MediaRole;
}): Promise<ContentAssetBinding> {
  const [binding] = await upsertBundleAssets({
    draftId: input.draftId,
    assets: [{ mediaId: input.mediaId, role: input.role ?? 'primary_image' }],
  });
  // upsertBundleAssets always pushes exactly one binding for a single asset.
  return binding!;
}

/** Return a draft's bindings keyed by role (MP-AR-003). */
export async function getDraftBundle(
  draftId: string,
): Promise<Partial<Record<MediaRole, ContentAssetBinding>>> {
  const drizzle = db();
  const bundle: Partial<Record<MediaRole, ContentAssetBinding>> = {};
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(contentAssetBindings)
      .where(eq(contentAssetBindings.draftId, draftId));
    for (const row of rows) bundle[row.role as MediaRole] = rowBinding(row);
    return bundle;
  }
  for (const b of store().contentAssetBindings.values()) {
    if (b.draftId === draftId) bundle[b.role] = b;
  }
  return bundle;
}

/** Map a persisted binding row to the domain type (MP-AR-003). */
function rowBinding(row: typeof contentAssetBindings.$inferSelect): ContentAssetBinding {
  return {
    id: row.id,
    draftId: row.draftId,
    mediaId: row.mediaId,
    role: row.role as MediaRole,
    crop: (row.crop as Record<string, unknown>) ?? {},
    meta: (row.meta as Record<string, unknown>) ?? {},
    createdAt: row.createdAt,
  };
}

export async function getPrimaryAsset(draftId: string): Promise<ContentAssetBinding | null> {
  const drizzle = db();
  if (drizzle) {
    // Prefer a typed primary visual; fall back to any binding for the draft.
    const rows = await drizzle
      .select()
      .from(contentAssetBindings)
      .where(
        and(
          eq(contentAssetBindings.draftId, draftId),
          inArray(contentAssetBindings.role, ['primary_image', 'primary_video']),
        ),
      )
      .limit(1);
    const row = rows[0];
    return row ? rowBinding(row) : null;
  }
  return (
    Array.from(store().contentAssetBindings.values()).find(
      (b) => b.draftId === draftId && (b.role === 'primary_image' || b.role === 'primary_video'),
    ) ?? null
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
      .where(inArray(contentAssetBindings.role, ['primary_image', 'primary_video']));
    return rows.filter((row) => draftIds.includes(row.draftId)).map(rowBinding);
  }
  return Array.from(store().contentAssetBindings.values()).filter(
    (binding) =>
      (binding.role === 'primary_image' || binding.role === 'primary_video') &&
      draftIds.includes(binding.draftId),
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

export async function listGenerationRuns(limit = 50): Promise<ContentGenerationRun[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(contentGenerationRuns)
      .orderBy(desc(contentGenerationRuns.createdAt))
      .limit(limit);
    return rows.map(rowGenerationRun);
  }
  return Array.from(store().contentGenerationRuns.values())
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

function rowGenerationRun(row: typeof contentGenerationRuns.$inferSelect): ContentGenerationRun {
  return {
    id: row.id,
    ideaId: row.ideaId,
    briefId: row.briefId,
    provider: row.provider,
    model: row.model,
    promptVersion: row.promptVersion,
    input: (row.input ?? {}) as Record<string, unknown>,
    output: (row.output ?? {}) as Record<string, unknown>,
    status: row.status as ContentGenerationRun['status'],
    costCents: row.costCents,
    errorMessage: row.errorMessage,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  };
}

function isUniqueViolation(err: unknown): boolean {
  const direct = (err as { code?: string } | null)?.code;
  const nested = (err as { cause?: { code?: string } } | null)?.cause?.code;
  return direct === '23505' || nested === '23505';
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
    cancelledBy: null,
    cancelledAt: null,
    cancelReason: null,
    createdAt: now,
    updatedAt: now,
  };
  const drizzle = db();
  if (drizzle) {
    try {
      // Transaction : insert du post + bascule du draft sont atomiques (un
      // crash entre les deux laissait un post sans draft approuvé, ou l'inverse).
      await drizzle.transaction(async (tx) => {
        await tx.insert(contentPosts).values({ ...post, utm: post.utm as never });
        await tx
          .update(contentDrafts)
          .set({ status: 'approved', editedBy: input.actorId, updatedAt: now })
          .where(eq(contentDrafts.id, input.draftId));
      });
    } catch (err) {
      // Double-approve concurrent : la contrainte unique (0066) gagne la
      // course — on renvoie le post existant (idempotent) au lieu d'un 500.
      if (isUniqueViolation(err)) {
        const existing = await getPostForDraft(input.draftId);
        if (existing) return existing;
      }
      throw err;
    }
    return post;
  }
  // Store mémoire : simule la contrainte unique de la 0066.
  const existing = Array.from(store().contentPosts.values()).find(
    (p) => p.draftId === input.draftId,
  );
  if (existing) return existing;
  store().contentPosts.set(post.id, post);
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

export async function listPosts(filters?: { status?: string; scheduledAfter?: string; scheduledBefore?: string; limit?: number; offset?: number }): Promise<ContentPost[]> {
  const limit = filters?.limit ?? 100;
  const offset = filters?.offset ?? 0;
  const drizzle = db();
  if (drizzle) {
    const conditions = [];
    if (filters?.status) conditions.push(eq(contentPosts.status, filters.status));
    if (filters?.scheduledAfter) conditions.push(desc(contentPosts.scheduledAt));
    const rows = await drizzle.select().from(contentPosts)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(contentPosts.createdAt))
      .limit(limit)
      .offset(offset);
    return rows.map(rowPost);
  }
  let items = Array.from(store().contentPosts.values()).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
  if (filters?.status) items = items.filter((p) => p.status === filters.status);
  if (filters?.scheduledAfter) {
    const after = new Date(filters.scheduledAfter).getTime();
    items = items.filter((p) => p.scheduledAt && new Date(p.scheduledAt).getTime() >= after);
  }
  if (filters?.scheduledBefore) {
    const before = new Date(filters.scheduledBefore).getTime();
    items = items.filter((p) => p.scheduledAt && new Date(p.scheduledAt).getTime() <= before);
  }
  return items.slice(offset, offset + limit);
}

export async function updatePostPlanning(input: {
  postId: string;
  scheduledAt: Date | null;
  status?: ContentStatus;
}): Promise<ContentPost | null> {
  const existing = await getPost(input.postId);
  if (!existing) return null;
  if (input.status && input.status !== existing.status) {
    assertTransition(existing.status, input.status);
  }
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

// --- P2: Review actions ---

export async function rejectDraft(id: string, reason?: string): Promise<ContentDraft | null> {
  return updateDraft(id, { status: 'rejected', rejectionReason: reason ?? null });
}

export async function cancelPost(id: string, reason?: string, cancelledBy?: string | null): Promise<ContentPost | null> {
  const existing = await getPost(id);
  if (!existing) return null;
  const updated: ContentPost = {
    ...existing,
    status: 'cancelled',
    cancelReason: reason ?? null,
    cancelledBy: cancelledBy ?? null,
    cancelledAt: new Date(),
    updatedAt: new Date(),
  };
  const drizzle = db();
  if (drizzle) {
    await drizzle
      .update(contentPosts)
      .set({
        status: updated.status,
        cancelReason: updated.cancelReason,
        cancelledBy: updated.cancelledBy,
        cancelledAt: updated.cancelledAt,
        updatedAt: updated.updatedAt,
      })
      .where(eq(contentPosts.id, id));
  } else {
    store().contentPosts.set(id, updated);
  }
  return updated;
}

export async function archiveEntity(
  table: 'idea' | 'draft' | 'post',
  id: string,
): Promise<ContentIdea | ContentDraft | ContentPost | null> {
  if (table === 'idea') {
    await updateIdeaStatus(id, 'archived');
    return getIdea(id);
  }
  if (table === 'draft') {
    return updateDraft(id, { status: 'archived' });
  }
  const existing = await getPost(id);
  if (!existing) return null;
  const updated: ContentPost = { ...existing, status: 'archived', updatedAt: new Date() };
  const drizzle = db();
  if (drizzle) {
    await drizzle.update(contentPosts).set({ status: 'archived', updatedAt: updated.updatedAt }).where(eq(contentPosts.id, id));
  } else {
    store().contentPosts.set(id, updated);
  }
  return updated;
}

export async function createDraftVariation(
  fromDraftId: string,
  overrides: {
    variantLabel?: string;
    caption?: string;
    // ACT-BE-014 — champs régénérés (sinon clonés du parent à l'identique).
    hook?: string;
    cta?: string;
    altText?: string;
    hashtags?: string[];
    promptOverride?: string;
  },
): Promise<ContentDraft | null> {
  const parent = await getDraft(fromDraftId);
  if (!parent) return null;
  const now = new Date();
  const draft: ContentDraft = {
    id: createId('cd'),
    briefId: parent.briefId,
    platform: parent.platform,
    format: parent.format,
    variantLabel: overrides.variantLabel ?? `Variante`,
    caption: overrides.caption ?? parent.caption,
    hook: overrides.hook ?? parent.hook,
    cta: overrides.cta ?? parent.cta,
    altText: overrides.altText ?? parent.altText,
    hashtags: overrides.hashtags ?? parent.hashtags,
    rejectionReason: null,
    parentDraftId: fromDraftId,
    status: 'generated',
    scoreTotal: null,
    editedBy: null,
    createdAt: now,
    updatedAt: now,
  };
  const drizzle = db();
  if (drizzle) {
    await drizzle.insert(contentDrafts).values({ ...draft, hashtags: draft.hashtags as never });
  } else {
    store().contentDrafts.set(draft.id, draft);
  }
  return draft;
}

/**
 * Liste les N dernières brand reviews (toutes drafts confondues).
 * Utilisé par le BrandHealthCard du dashboard `/home` (Phase 6) pour
 * calculer le score moyen 30 jours + le top des violations.
 */
export async function listRecentBrandReviews(limit = 200): Promise<ContentBrandReview[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(contentBrandReviews)
      .orderBy(desc(contentBrandReviews.createdAt))
      .limit(limit);
    return rows.map(rowReview);
  }
  return Array.from(store().contentBrandReviews.values())
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

export async function listReviewsByDraft(draftId: string): Promise<ContentBrandReview[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(contentBrandReviews)
      .where(eq(contentBrandReviews.draftId, draftId))
      .orderBy(desc(contentBrandReviews.createdAt));
    return rows.map(rowReview);
  }
  return Array.from(store().contentBrandReviews.values())
    .filter((r) => r.draftId === draftId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

function rowLearningNote(row: typeof contentLearningNotes.$inferSelect): ContentLearningNote {
  return {
    id: row.id,
    postId: row.postId,
    note: row.note,
    tags: (row.tags as string[]) ?? [],
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  };
}

export async function createLearningNote(input: {
  postId: string | null;
  note: string;
  tags?: string[];
  createdBy?: string | null;
}): Promise<ContentLearningNote> {
  const note: ContentLearningNote = {
    id: createId('cln'),
    postId: input.postId,
    note: input.note,
    tags: input.tags ?? [],
    createdBy: input.createdBy ?? null,
    createdAt: new Date(),
  };
  const drizzle = db();
  if (drizzle) {
    await drizzle.insert(contentLearningNotes).values({
      ...note,
      tags: note.tags as never,
    });
  } else {
    store().contentLearningNotes.set(note.id, note);
  }
  return note;
}

export async function listLearningNotesForPost(postId: string): Promise<ContentLearningNote[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(contentLearningNotes)
      .where(eq(contentLearningNotes.postId, postId))
      .orderBy(desc(contentLearningNotes.createdAt));
    return rows.map(rowLearningNote);
  }
  return Array.from(store().contentLearningNotes.values())
    .filter((n) => n.postId === postId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function listLearningNotes(limit = 50): Promise<ContentLearningNote[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(contentLearningNotes)
      .orderBy(desc(contentLearningNotes.createdAt))
      .limit(limit);
    return rows.map(rowLearningNote);
  }
  return Array.from(store().contentLearningNotes.values())
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

// --- Campaigns ---

export async function listCampaigns(filters?: { status?: string }): Promise<ContentCampaign[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(contentCampaigns)
      .where(filters?.status ? eq(contentCampaigns.status, filters.status as 'draft' | 'active' | 'archived') : undefined)
      .orderBy(desc(contentCampaigns.createdAt));
    return rows.map(rowCampaign);
  }
  let items = Array.from(store().contentCampaigns.values());
  if (filters?.status) items = items.filter((c) => c.status === filters.status);
  return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function getCampaign(id: string): Promise<ContentCampaign | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(contentCampaigns)
      .where(eq(contentCampaigns.id, id))
      .limit(1);
    return rows[0] ? rowCampaign(rows[0]) : null;
  }
  return store().contentCampaigns.get(id) ?? null;
}

export async function createCampaign(input: {
  name: string;
  objective: string;
  startsAt?: Date | null;
  endsAt?: Date | null;
  createdBy?: string | null;
}): Promise<ContentCampaign> {
  const id = createId('cmp');
  const now = new Date();
  const campaign: ContentCampaign = {
    id,
    name: input.name,
    objective: input.objective,
    status: 'draft',
    startsAt: input.startsAt ?? null,
    endsAt: input.endsAt ?? null,
    createdBy: input.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
  };
  const drizzle = db();
  if (drizzle) {
    await drizzle.insert(contentCampaigns).values({
      id,
      name: input.name,
      objective: input.objective,
      status: 'draft',
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
      createdBy: input.createdBy ?? null,
    });
    return campaign;
  }
  store().contentCampaigns.set(id, campaign);
  return campaign;
}

export async function updateCampaignStatus(id: string, status: ContentCampaign['status']): Promise<ContentCampaign> {
  const drizzle = db();
  if (drizzle) {
    await drizzle
      .update(contentCampaigns)
      .set({ status, updatedAt: new Date() })
      .where(eq(contentCampaigns.id, id));
    const rows = await drizzle
      .select()
      .from(contentCampaigns)
      .where(eq(contentCampaigns.id, id))
      .limit(1);
    if (!rows[0]) throw new Error('Campaign not found');
    return rowCampaign(rows[0]);
  }
  const campaign = store().contentCampaigns.get(id);
  if (!campaign) throw new Error('Campaign not found');
  campaign.status = status;
  campaign.updatedAt = new Date();
  return campaign;
}

export async function updateCampaign(id: string, patch: { name?: string; objective?: string; startsAt?: Date | null; endsAt?: Date | null }): Promise<ContentCampaign> {
  const drizzle = db();
  if (drizzle) {
    await drizzle
      .update(contentCampaigns)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(contentCampaigns.id, id));
    const rows = await drizzle
      .select()
      .from(contentCampaigns)
      .where(eq(contentCampaigns.id, id))
      .limit(1);
    if (!rows[0]) throw new Error('Campaign not found');
    return rowCampaign(rows[0]);
  }
  const campaign = store().contentCampaigns.get(id);
  if (!campaign) throw new Error('Campaign not found');
  if (patch.name !== undefined) campaign.name = patch.name;
  if (patch.objective !== undefined) campaign.objective = patch.objective;
  if (patch.startsAt !== undefined) campaign.startsAt = patch.startsAt;
  if (patch.endsAt !== undefined) campaign.endsAt = patch.endsAt;
  campaign.updatedAt = new Date();
  return campaign;
}
