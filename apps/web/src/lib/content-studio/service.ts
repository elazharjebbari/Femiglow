import { HttpError } from '@/lib/errors/http-error';
import { logAuditEvent } from '@/lib/audit/log-event';
import { createId } from '@/lib/ids';
import { findMediaById, getMediaWithRelations, listMedia, thumbsByMediaId } from '@/lib/db/queries/media';
import { createMedia } from '@/lib/db/queries/media';
import { enqueueJob } from '@/lib/db/queries/media-jobs';
import { env } from '@/lib/env';
import { getStorage } from '@/lib/media/storage';
import { runWorkerOnce } from '@/lib/media/worker/process-job';
import { reviewDraftContent } from './brand-rules';
import { generateForIdea } from './generation';
import { generateStudioImage } from './image-generation';
import { assertTransition } from './state-machine';
import {
  approveDraft,
  createBrief,
  createDrafts,
  createDraftVariation,
  createIdea,
  getDraft,
  getIdea,
  getLatestReview,
  getPost,
  getPostForDraft,
  getPrimaryAsset,
  insertGenerationRun,
  insertPostizDelivery,
  listPerformanceSnapshotsForPosts,
  insertReview,
  listDrafts,
  listIdeas,
  listPostizDeliveriesForPosts,
  listPrimaryAssetsForDrafts,
  listPosts,
  listReviewsByDraft,
  rejectDraft,
  cancelPost,
  archiveEntity,
  updatePostPlanning,
  updateDraft,
  updateIdeaStatus,
  upsertPrimaryAsset,
} from './repository';
import {
  buildPostizDraftPayload,
  createPostizDraft,
  listPostizIntegrations,
  parsePostizUploadedMedia,
  uploadPostizMediaFromUrl,
} from './postiz';
import type { ContentIdea } from './types';

export { listIdeas, listDrafts, listPosts };

export interface StudioMediaItem {
  id: string;
  slug: string;
  kind: string;
  source: string;
  compartment: 'imported' | 'ai_generated';
  status: string;
  alt: string;
  caption: string | null;
  originalUrl: string | null;
  thumbUrl: string | null;
  previewUrl: string | null;
  width: number | null;
  height: number | null;
  createdAt: Date;
}

export async function createContentIdea(input: Parameters<typeof createIdea>[0]) {
  const idea = await createIdea(input);
  await logAuditEvent({
    action: 'content_studio.idea.created',
    actorId: input.actorId,
    resourceType: 'content_idea',
    resourceId: idea.id,
    meta: { pillar: idea.pillar, objective: idea.objective },
  });
  return idea;
}

export async function generateIdeaDrafts(input: {
  ideaId: string;
  actorId: string | null;
}) {
  const idea = await requireIdea(input.ideaId);
  const generation = await generateForIdea(idea);
  const brief = await createBrief({
    ideaId: idea.id,
    angle: generation.brief.angle,
    proof: generation.brief.proof,
    cta: generation.brief.cta,
    mediaDirection: generation.brief.mediaDirection,
    constraints: generation.brief.constraints,
    actorId: input.actorId,
  });
  const drafts = await createDrafts(
    generation.drafts.map((draft) => ({
      briefId: brief.id,
      platform: idea.platform,
      format: idea.format,
      variantLabel: draft.variantLabel,
      hook: draft.hook,
      caption: draft.caption,
      cta: draft.cta,
      altText: draft.altText,
      hashtags: draft.hashtags,
    })),
  );
  await insertGenerationRun({
    ideaId: idea.id,
    briefId: brief.id,
    provider: generation.provider,
    model: generation.model,
    promptVersion: generation.promptVersion,
    input: { idea },
    output: {
      brief: generation.brief,
      drafts: generation.drafts,
      raw: generation.raw,
    },
    status: generation.provider === 'fallback' ? 'fallback' : 'succeeded',
    costCents: generation.provider === 'fallback' ? 0 : 2,
    errorMessage:
      generation.provider === 'fallback' && generation.raw.providerError
        ? String(generation.raw.providerError)
        : null,
    createdBy: input.actorId,
  });
  for (const draft of drafts) {
    await reviewContentDraft({ draftId: draft.id });
  }
  assertTransition(idea.status, 'generated');
  await updateIdeaStatus(idea.id, 'generated');
  await logAuditEvent({
    action: 'content_studio.idea.generated',
    actorId: input.actorId,
    resourceType: 'content_idea',
    resourceId: idea.id,
    meta: { provider: generation.provider, drafts: drafts.length },
  });
  return { idea: { ...idea, status: 'generated' as const }, brief, drafts };
}

export async function updateContentDraft(input: {
  draftId: string;
  actorId: string;
  patch: {
    caption?: string;
    hook?: string | null;
    cta?: string | null;
    altText?: string | null;
    hashtags?: string[];
    mediaId?: string | null;
  };
}) {
  const draft = await requireDraft(input.draftId);
  if (input.patch.mediaId) {
    const media = await findMediaById(input.patch.mediaId);
    if (!media || media.deletedAt !== null) throw new HttpError('not_found', 'Média introuvable');
    if (media.status !== 'ready' && media.status !== 'passthrough') {
      throw new HttpError('invalid_state', 'Le média n’est pas prêt.');
    }
    await upsertPrimaryAsset({ draftId: draft.id, mediaId: media.id });
  }
  const updated = await updateDraft(draft.id, {
    caption: input.patch.caption,
    hook: input.patch.hook,
    cta: input.patch.cta,
    altText: input.patch.altText,
    hashtags: input.patch.hashtags,
    editedBy: input.actorId,
  });
  if (!updated) throw new HttpError('not_found', 'Brouillon introuvable');
  await reviewContentDraft({ draftId: updated.id });
  return updated;
}

export async function listContentStudioMedia(input: {
  q?: string;
  limit?: number;
  compartment?: 'imported' | 'ai_generated' | 'all';
} = {}): Promise<StudioMediaItem[]> {
  const result = await listMedia({
    q: input.q,
    kind: 'image',
    status: 'ready',
    limit: 100,
    sort: 'created_desc',
  });
  const compartment = input.compartment ?? 'imported';
  const rows = result.rows
    .filter((media) => {
      if (compartment === 'all') return true;
      const isAi = isContentStudioAiMedia(media.overrides);
      return compartment === 'ai_generated' ? isAi : !isAi;
    })
    .slice(0, input.limit ?? 30);
  const thumbs = await thumbsByMediaId(rows.map((media) => media.id));
  return rows.map((media) => {
    const thumbUrl = thumbs.get(media.id) ?? null;
    const compartment = isContentStudioAiMedia(media.overrides) ? 'ai_generated' : 'imported';
    return {
      id: media.id,
      slug: media.slug,
      kind: media.kind,
      source: media.source,
      compartment,
      status: media.status,
      alt: media.alt,
      caption: media.caption,
      originalUrl: media.originalUrl,
      thumbUrl,
      previewUrl: thumbUrl ?? media.originalUrl,
      width: media.originalWidth,
      height: media.originalHeight,
      createdAt: media.createdAt,
    };
  });
}

export async function listDraftPrimaryAssets() {
  const drafts = await listDrafts();
  const assets = await listPrimaryAssetsForDrafts(drafts.map((draft) => draft.id));
  const mediaById = new Map(
    (await listContentStudioMedia({ limit: 100, compartment: 'all' })).map((media) => [
      media.id,
      media,
    ]),
  );
  return Object.fromEntries(
    assets.map((asset) => [
      asset.draftId,
      {
        mediaId: asset.mediaId,
        media: mediaById.get(asset.mediaId) ?? null,
      },
    ]),
  );
}

export async function generateVisualForDraft(input: {
  draftId: string;
  actorId: string | null;
  prompt: string;
  size: '1024x1024' | '1024x1536' | '1536x1024';
  quality: 'low' | 'medium' | 'high';
}) {
  const draft = await requireDraft(input.draftId);
  const finalPrompt = buildVisualPrompt({
    draft,
    userPrompt: input.prompt,
  });
  const generated = await generateStudioImage({
    prompt: finalPrompt,
    size: input.size,
    quality: input.quality,
  });
  const media = await createMedia({
    kind: 'image',
    source: 'upload',
    slug: `content-studio-ai-${draft.id}-${createId().slice(0, 8)}`,
    alt: draft.altText ?? draft.hook ?? 'Visuel généré par IA pour FemiGlow',
    caption: `Généré par le Content Studio depuis ${draft.variantLabel}`,
    originalFilename: `${draft.id}.png`,
    originalMime: generated.mime,
    originalSizeBytes: generated.buffer.byteLength,
    qualityProfile: 'inline',
    loadingStrategy: 'viewport',
    overrides: {
      contentStudio: {
        origin: 'ai_generated',
        provider: generated.provider,
        promptVersion: 'content-studio-image-v0-2026-05-15',
        sourceDraftId: draft.id,
      },
    },
    createdBy: input.actorId,
  });
  const sourceKey = `sources/${media.id}/${createId('src')}.png`;
  await getStorage().put({ key: sourceKey, body: generated.buffer, contentType: generated.mime });
  await enqueueJob({ mediaId: media.id, kind: 'optimize', payload: { sourceKey } });
  await runWorkerOnce();
  await insertGenerationRun({
    ideaId: null,
    briefId: draft.briefId,
    provider: generated.provider,
    model: generated.model,
    promptVersion: 'content-studio-image-v0-2026-05-15',
    input: {
      draftId: draft.id,
      prompt: input.prompt,
      finalPrompt,
      size: input.size,
      quality: input.quality,
    },
    output: { mediaId: media.id, usage: generated.usage },
    status: 'succeeded',
    costCents: generated.estimatedCostCents,
    errorMessage: null,
    createdBy: input.actorId,
  });
  await logAuditEvent({
    action: 'content_studio.visual.generated',
    actorId: input.actorId,
    resourceType: 'media',
    resourceId: media.id,
    meta: {
      draftId: draft.id,
      provider: generated.provider,
      model: generated.model,
      size: input.size,
      quality: input.quality,
    },
  });
  const generatedMedia = (await listContentStudioMedia({ compartment: 'ai_generated', limit: 40 }))
    .find((item) => item.id === media.id);
  if (!generatedMedia) {
    throw new HttpError('upstream_failed', 'Image générée mais optimisation média non finalisée.');
  }
  return generatedMedia;
}

function isContentStudioAiMedia(overrides: { contentStudio?: unknown } | null | undefined): boolean {
  const contentStudio = overrides?.contentStudio;
  return (
    typeof contentStudio === 'object' &&
    contentStudio !== null &&
    'origin' in contentStudio &&
    (contentStudio as { origin?: unknown }).origin === 'ai_generated'
  );
}

function buildVisualPrompt(input: { draft: Awaited<ReturnType<typeof requireDraft>>; userPrompt: string }) {
  return [
    'Créer un visuel social premium pour FemiGlow Maroc.',
    'Respecter une direction beauté naturelle, élégante, apaisée, sans promesse médicale.',
    'Ne pas ajouter de texte lisible, de logo inventé, de claims avant/après, ni de peau ou ongles irréalistes.',
    `Format éditorial: ${input.draft.platform} ${input.draft.format}.`,
    `Caption contexte: ${input.draft.caption.slice(0, 700)}`,
    `Direction demandée: ${input.userPrompt}`,
  ].join('\n');
}

export async function listPostizDeliveriesOverview() {
  const posts = await listPosts();
  return listPostizDeliveriesForPosts(posts.map((post) => post.id));
}

export async function listContentPerformanceSnapshotsOverview() {
  const posts = await listPosts();
  return listPerformanceSnapshotsForPosts(posts.map((post) => post.id));
}

export async function reviewContentDraft(input: { draftId: string }) {
  const draft = await requireDraft(input.draftId);
  assertTransition(draft.status, 'needs_review');
  const review = reviewDraftContent(draft);
  return insertReview(review);
}

export async function approveContentDraft(input: {
  draftId: string;
  actorId: string;
}) {
  const draft = await requireDraft(input.draftId);
  assertTransition(draft.status, 'approved');
  const review = (await getLatestReview(draft.id)) ?? (await reviewContentDraft({ draftId: draft.id }));
  if (review.status === 'blocked') {
    throw new HttpError('invalid_state', 'Le brouillon est bloqué par la charte.', {
      violations: review.violations,
    });
  }
  const existing = await getPostForDraft(draft.id);
  if (existing) return existing;
  const post = await approveDraft({ draftId: draft.id, actorId: input.actorId });
  await logAuditEvent({
    action: 'content_studio.draft.approved',
    actorId: input.actorId,
    resourceType: 'content_draft',
    resourceId: draft.id,
    meta: { score: review.scoreTotal },
  });
  return post;
}

export async function rejectContentDraft(input: { draftId: string; reason?: string }) {
  const draft = await requireDraft(input.draftId);
  assertTransition(draft.status, 'rejected');
  return rejectDraft(draft.id, input.reason);
}

export async function cancelScheduledPost(input: { postId: string; reason?: string; actorId?: string | null }) {
  const post = await getPost(input.postId);
  if (!post) throw new HttpError('not_found', 'Post introuvable.');
  assertTransition(post.status, 'cancelled');
  return cancelPost(post.id, input.reason, input.actorId);
}

export async function archiveContentIdea(ideaId: string) {
  const idea = await getIdea(ideaId);
  if (!idea) throw new HttpError('not_found', 'Idée introuvable.');
  assertTransition(idea.status, 'archived');
  await updateIdeaStatus(ideaId, 'archived');
  return getIdea(ideaId);
}

export async function archiveContentDraft(draftId: string) {
  const draft = await getDraft(draftId);
  if (!draft) throw new HttpError('not_found', 'Brouillon introuvable.');
  assertTransition(draft.status, 'archived');
  return archiveEntity('draft', draftId);
}

export async function archiveContentPost(postId: string) {
  const post = await getPost(postId);
  if (!post) throw new HttpError('not_found', 'Post introuvable.');
  assertTransition(post.status, 'archived');
  return archiveEntity('post', postId);
}

export async function createVariation(input: { draftId: string; variantLabel?: string }) {
  const draft = await requireDraft(input.draftId);
  assertTransition(draft.status, 'generated');
  return createDraftVariation(draft.id, { variantLabel: input.variantLabel });
}

export async function reschedulePost(input: { postId: string; scheduledAt: string }) {
  const post = await getPost(input.postId);
  if (!post) throw new HttpError('not_found', 'Post introuvable.');
  const date = new Date(input.scheduledAt);
  if (Number.isNaN(date.getTime())) throw new HttpError('invalid_input', 'Date invalide.');
  return updatePostPlanning({ postId: post.id, scheduledAt: date });
}

export async function syncPostizIntegrations() {
  const integrations = await listPostizIntegrations();
  return {
    integrations: integrations.map((integration) => ({
      id: integration.id,
      provider: integration.provider ?? integration.identifier ?? 'unknown',
      identifier: integration.identifier ?? null,
      name: integration.name ?? null,
      disabled: Boolean(integration.disabled),
      profile: integration.profile ?? null,
    })),
  };
}

export async function createDraftInPostiz(input: {
  postId: string;
  integrationId: string;
  actorId: string | null;
  scheduledAt?: string | null;
  tags?: Array<{ value: string; label: string }>;
}) {
  const post = await import('./repository').then((m) => m.getPost(input.postId));
  if (!post) throw new HttpError('not_found', 'Post introuvable');
  assertTransition(post.status, 'scheduled');
  if (post.status !== 'approved' && post.status !== 'scheduled') {
    throw new HttpError('invalid_state', 'Seul un post approuvé ou planifié peut être envoyé à Postiz.');
  }
  const draft = await requireDraft(post.draftId);
  if (draft.status !== 'approved') {
    throw new HttpError('invalid_state', 'Le brouillon doit être approuvé.');
  }
  const review = await getLatestReview(draft.id);
  if (review?.status === 'blocked') {
    throw new HttpError('invalid_state', 'Le brouillon est bloqué par la charte.');
  }
  const asset = await getPrimaryAsset(draft.id);
  let image: { id: string; path: string } | null = null;
  let sourceImage: { id: string; path: string; filename: string } | null = null;
  if (asset) {
    const media = await getMediaWithRelations(asset.mediaId);
    if (!media || media.deletedAt !== null) throw new HttpError('not_found', 'Média introuvable');
    if (media.status !== 'ready' && media.status !== 'passthrough') {
      throw new HttpError('invalid_state', 'Le média n’est pas prêt.');
    }
    const mediaUrl = pickPostizMediaUrl(media);
    if (!mediaUrl) {
      throw new HttpError('invalid_state', 'Le média n’a pas d’URL publique utilisable.');
    }
    sourceImage = {
      id: media.id,
      path: absoluteUrl(mediaUrl),
      filename: postizFilename(media.slug, absoluteUrl(mediaUrl)),
    };
    const upload = await uploadPostizMediaFromUrl({
      url: sourceImage.path,
      filename: sourceImage.filename,
    });
    const uploaded = upload.ok ? parsePostizUploadedMedia(upload.body) : null;
    if (!upload.ok || !uploaded) {
      const delivery = await insertPostizDelivery({
        postId: post.id,
        integrationId: input.integrationId,
        status: 'failed',
        request: {
          stage: 'postiz_media_upload',
          sourceImage,
        },
        response: upload.body,
        lastError: upload.ok
          ? 'Réponse upload Postiz invalide.'
          : `Upload média Postiz échoué: HTTP ${upload.status}`,
      });
      throw new HttpError('upstream_failed', 'Upload média Postiz échoué.', {
        status: upload.status,
        deliveryId: delivery.id,
      });
    }
    image = { id: uploaded.id, path: uploaded.path };
  }
  const payload = buildPostizDraftPayload({
    integrationId: input.integrationId,
    platform: draft.platform,
    format: draft.format,
    content: draft.caption,
    scheduledAt: input.scheduledAt ?? post.scheduledAt,
    image,
    tags: input.tags,
  });

  let result: Awaited<ReturnType<typeof createPostizDraft>>;
  try {
    result = await createPostizDraft({
      integrationId: input.integrationId,
      platform: draft.platform,
      format: draft.format,
      content: draft.caption,
      scheduledAt: input.scheduledAt ?? post.scheduledAt,
      image,
      tags: input.tags,
    });
  } catch (err) {
    const delivery = await insertPostizDelivery({
      postId: post.id,
      integrationId: input.integrationId,
      status: 'failed',
      request: payload,
      response: {},
      lastError: String(err),
    });
    throw new HttpError('upstream_failed', 'Postiz indisponible.', { deliveryId: delivery.id });
  }

  const postizPostId = extractPostizPostId(result.body);
  const delivery = await insertPostizDelivery({
    postId: post.id,
    integrationId: input.integrationId,
    postizPostId,
    status: result.ok ? 'sent' : result.status === 401 ? 'auth_failed' : 'failed',
    request: payload,
    response: result.body,
    lastError: result.ok ? null : `HTTP ${result.status}`,
  });
  if (!result.ok) {
    throw new HttpError('upstream_failed', 'Création du brouillon Postiz échouée.', {
      status: result.status,
      deliveryId: delivery.id,
    });
  }
  await logAuditEvent({
    action: 'content_studio.postiz.draft_created',
    actorId: input.actorId,
    resourceType: 'content_post',
    resourceId: post.id,
    meta: { integrationId: input.integrationId, deliveryId: delivery.id },
  });
  const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : post.scheduledAt;
  const updatedPost = await updatePostPlanning({
    postId: post.id,
    scheduledAt,
    status: scheduledAt ? 'scheduled' : post.status,
  });
  return { delivery, post: updatedPost ?? post };
}

async function requireIdea(id: string): Promise<ContentIdea> {
  const idea = await getIdea(id);
  if (!idea) throw new HttpError('not_found', 'Idée introuvable');
  return idea;
}

async function requireDraft(id: string) {
  const draft = await getDraft(id);
  if (!draft) throw new HttpError('not_found', 'Brouillon introuvable');
  return draft;
}

function extractPostizPostId(body: Record<string, unknown>): string | null {
  const id = body.id ?? body.postId ?? body.post?.['id' as never];
  return typeof id === 'string' ? id : null;
}

function absoluteUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
}

function pickPostizMediaUrl(media: Awaited<ReturnType<typeof getMediaWithRelations>>): string | null {
  if (!media) return null;
  const jpgOrWebp = media.variants.find(
    (variant) => variant.format === 'webp' || variant.format === 'jpeg',
  );
  return jpgOrWebp?.url ?? media.variants[0]?.url ?? media.originalUrl;
}

function postizFilename(slug: string, url: string): string {
  const cleanSlug = slug.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'femiglow';
  const pathname = /^https?:\/\//i.test(url) ? new URL(url).pathname : url;
  const ext = pathname.match(/\.(webp|jpe?g|png)$/i)?.[1]?.toLowerCase() ?? 'jpg';
  return `${cleanSlug}.${ext === 'jpeg' ? 'jpg' : ext}`;
}
