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
import { imageCostCents } from './pricing';
import { generateStudioImage } from './image-generation';
import { generateStudioVideo } from './video-generation';
import { assertTransition } from './state-machine';
import {
  approveDraft,
  createBrief,
  createCampaign,
  createDrafts,
  createDraftVariation,
  createIdea,
  createLearningNote,
  getBrief,
  getCampaign,
  getDraft,
  getIdea,
  getLatestReview,
  getPost,
  getPostForDraft,
  getPrimaryAsset,
  insertGenerationRun,
  insertPostizDelivery,
  listCampaigns,
  listLearningNotesForPost,
  listLearningNotes,
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
  updateCampaign,
  updateCampaignStatus,
  updateBrief,
  updatePostPlanning,
  updateDraft,
  updateIdeaStatus,
  upsertPrimaryAsset,
  upsertBundleAssets,
} from './repository';
import {
  buildPostizDraftPayload,
  createPostizDraft,
  extractPostizPostId,
  listPostizIntegrations,
  parsePostizUploadedMedia,
  uploadPostizMediaFromUrl,
} from './postiz';
import type { ContentIdea } from './types';
import { synthesizeVoiceover, type TtsProvider } from '@/lib/ai-engine/nodes/generate-voiceover';
import { resolveProviderCredential } from './provider-credentials';
import { getEngineConfig } from '@/lib/ai-engine/config';
import { checkDailyBudget } from './budget';

export { listIdeas, listDrafts, listPosts, listCampaigns, getCampaign, createCampaign, updateCampaign, updateCampaignStatus } from './repository';

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
  /** Duration in milliseconds for videos. Null for images. */
  durationMs?: number | null;
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
  /** CS v2 Phase 2 — optional override of the text-generation model for this run. */
  model?: string;
  /** ACT-BE-013 — mode mock/live propagé du cookie cs_generation_mode. */
  mode?: 'mock' | 'live';
}) {
  const idea = await requireIdea(input.ideaId);
  // ACT-BE-016 (BUG-051) : valider la transition AVANT toute écriture
  // (génération LLM, brief, drafts, run). Sinon une idée déjà « generated »
  // (transition generated→generated interdite) faisait créer brief+drafts+run
  // PUIS échouait, laissant des écritures partielles/orphelines. assertTransition
  // lève déjà HttpError('invalid_state') → 409 lisible (pas un 500 opaque).
  assertTransition(idea.status, 'generated');
  await checkDailyBudget(2);
  const generation = await generateForIdea(idea, { model: input.model, mode: input.mode });
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
  // (transition déjà validée en tête de fonction — ACT-BE-016)
  await updateIdeaStatus(idea.id, 'generated');
  await logAuditEvent({
    action: 'content_studio.idea.generated',
    actorId: input.actorId,
    resourceType: 'content_idea',
    resourceId: idea.id,
    meta: { provider: generation.provider, drafts: drafts.length },
  });
  // CS v2 Phase 7 polish (G07) — surface the generation run metadata so the
  // UI can display "Généré par {model} · {cost}¢". One entry per
  // /ideas/:id/generate call today; an array shape leaves room for batched
  // multi-run generations later.
  return {
    idea: { ...idea, status: 'generated' as const },
    brief,
    drafts,
    runs: [
      {
        provider: generation.provider,
        model: generation.model,
        costCents: generation.provider === 'fallback' ? 0 : 2,
        status: generation.provider === 'fallback' ? 'fallback' : 'succeeded',
      },
    ],
  };
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
  /** CS v2 Phase 3 — image (default, legacy) or video discriminator. */
  kind?: 'image' | 'video';
  /** CS v2 Phase 3 — optional model id override (image or video model). */
  model?: string;
  /** Mode mock/live propagé depuis le cookie côté route handler. */
  mode?: 'mock' | 'live';
}) {
  const draft = await requireDraft(input.draftId);
  if (input.kind === 'video') {
    return generateVideoForDraft({
      draftId: draft.id,
      draft,
      actorId: input.actorId,
      prompt: input.prompt,
      model: input.model,
      mode: input.mode,
    });
  }
  // ACT-BE-035 — coût pré-check budget depuis la MÊME source que le coût
  // enregistré (./pricing). En mock, génération gratuite → 0.
  const visualCostEstimate = imageCostCents(
    input.mode === 'mock' ? undefined : input.model ?? env.CONTENT_STUDIO_IMAGE_MODEL,
    input.quality,
  );
  await checkDailyBudget(visualCostEstimate);
  const finalPrompt = buildVisualPrompt({
    draft,
    userPrompt: input.prompt,
  });
  const generated = await generateStudioImage({
    prompt: finalPrompt,
    size: input.size,
    quality: input.quality,
    model: input.model,
    mode: input.mode,
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
  await upsertPrimaryAsset({ draftId: draft.id, mediaId: media.id });
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
      // ACT-DA-005 — modèle INTENTIONNEL (choisi par l'opérateur) tracé à côté
      // du modèle EXÉCUTÉ (colonne `model` = generated.model). En mock, l'exécuté
      // est 'mock-*' ; sans cette trace on perdait le modèle réellement demandé.
      intendedModel: input.model ?? null,
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

/**
 * CS v2 create-audit Phase 3+4 — generate a video asset and bind it to the
 * draft. Today only the mock provider is wired (Veo/Sora are backlog). The
 * caller (route handler) already validated the kind=video and any model id.
 */
async function generateVideoForDraft(args: {
  draftId: string;
  draft: Awaited<ReturnType<typeof requireDraft>>;
  actorId: string | null;
  prompt: string;
  model?: string;
  mode?: 'mock' | 'live';
}) {
  const { draft } = args;
  // Mock video has cost 0; still keep budget call for parity with future
  // real providers. Estimate 2c so the daily cap notion stays consistent.
  await checkDailyBudget(0);
  const generated = await generateStudioVideo({
    format: draft.format,
    prompt: args.prompt,
    model: args.model,
    mode: args.mode,
  });
  const media = await createMedia({
    kind: 'video',
    source: 'upload',
    slug: `content-studio-ai-video-${draft.id}-${createId().slice(0, 8)}`,
    alt: draft.altText ?? draft.hook ?? 'Vidéo générée pour FemiGlow',
    caption: `Vidéo mock générée pour ${draft.variantLabel}`,
    originalFilename: `${draft.id}.mp4`,
    originalMime: generated.mime,
    originalSizeBytes: generated.sizeBytes,
    originalWidth: generated.width,
    originalHeight: generated.height,
    originalDurationMs: generated.durationMs,
    originalUrl: generated.publicUrl,
    status: 'passthrough',
    qualityProfile: 'inline',
    loadingStrategy: 'viewport',
    overrides: {
      contentStudio: {
        origin: 'ai_generated',
        provider: generated.provider,
        promptVersion: 'content-studio-video-v0-2026-05-28',
        sourceDraftId: draft.id,
        kind: 'video',
        posterUrl: generated.posterUrl,
      },
    },
    createdBy: args.actorId,
  });
  // MP-AR-003: this is the video path → bind under the typed primary_video role
  // so the media bundle / compose step (MP-CO) can resolve the source clip.
  await upsertPrimaryAsset({ draftId: draft.id, mediaId: media.id, role: 'primary_video' });
  await insertGenerationRun({
    ideaId: null,
    briefId: draft.briefId,
    provider: generated.provider,
    model: generated.model,
    promptVersion: 'content-studio-video-v0-2026-05-28',
    input: {
      draftId: draft.id,
      prompt: args.prompt,
      kind: 'video',
      format: draft.format,
    },
    output: {
      mediaId: media.id,
      publicUrl: generated.publicUrl,
      posterUrl: generated.posterUrl,
      usage: generated.usage,
    },
    status: 'succeeded',
    costCents: generated.estimatedCostCents,
    errorMessage: null,
    createdBy: args.actorId,
  });
  await logAuditEvent({
    action: 'content_studio.video.generated',
    actorId: args.actorId,
    resourceType: 'media',
    resourceId: media.id,
    meta: {
      draftId: draft.id,
      provider: generated.provider,
      model: generated.model,
      format: draft.format,
    },
  });
  // Video uses status='passthrough' and bypasses the image worker, so it
  // does not show up in listContentStudioMedia (which filters kind=image,
  // status=ready). Build the StudioMediaItem directly from what we already
  // know about the freshly-inserted row.
  const out: StudioMediaItem = {
    id: media.id,
    slug: media.slug,
    kind: media.kind,
    source: media.source,
    compartment: 'ai_generated',
    status: media.status,
    alt: media.alt,
    caption: media.caption,
    originalUrl: media.originalUrl,
    thumbUrl: generated.posterUrl,
    previewUrl: media.originalUrl,
    width: media.originalWidth,
    height: media.originalHeight,
    durationMs: generated.durationMs,
    createdAt: media.createdAt,
  };
  return out;
}

// ───────────────────────────────────────────────────────────────────────────
// MP-VO-02 (BUG-004) — per-draft voice-over generation (pipeline B). Mirrors
// generateVideoForDraft: passthrough audio media + role='voiceover' bundle
// binding. Reuses the AI-engine synthesis core (no TTS reimplementation).
// ───────────────────────────────────────────────────────────────────────────

export interface VoiceoverForDraftInput {
  draftId: string;
  actorId: string | null;
  /** Operator-edited narration. If omitted, derived from the draft. */
  script?: string;
  voice?: string;
  mode?: 'mock' | 'live';
}

export interface VoiceoverResult {
  id: string;
  draftId: string;
  role: 'voiceover';
  kind: 'audio';
  alt: string;
  slug: string;
  previewUrl: string;
  originalUrl: string;
  durationSec: number | null;
  provider: string;
  voice: string;
  costCents: number;
  createdAt: string;
}

const VOICEOVER_VIDEO_FORMATS = new Set(['reel', 'story']);
const VOICEOVER_PROMPT_VERSION = 'content-studio-voiceover-v0-2026-05-30';

/** Build the narration string from a draft when the operator gave no script. */
function buildVoiceoverTextFromDraft(draft: Awaited<ReturnType<typeof requireDraft>>): string {
  const parts = [draft.hook, draft.caption].map((s) => (s ?? '').trim()).filter(Boolean);
  return parts.length > 0 ? parts.join('. ') : 'Le rituel FemiGlow.';
}

function ttsCostEstimateCents(provider: TtsProvider, textLength: number): number {
  if (provider === 'openai') return (Math.min(textLength, 4096) / 1_000_000) * 1500;
  if (provider === 'elevenlabs') return (Math.min(textLength, 5000) / 1000) * 3;
  return 0;
}

export async function generateVoiceoverForDraft(
  input: VoiceoverForDraftInput,
): Promise<VoiceoverResult> {
  const draft = await requireDraft(input.draftId);

  // Voice-over only makes sense for video formats (the audio rides a video).
  if (!VOICEOVER_VIDEO_FORMATS.has(draft.format)) {
    throw new HttpError(
      'invalid_state',
      'Voix-off réservée aux formats vidéo (Reel/Story).',
    );
  }

  const mode = input.mode ?? 'mock';
  const voice = input.voice ?? 'mock';
  const text = input.script?.trim() || buildVoiceoverTextFromDraft(draft);

  // Mode-aware provider + credential resolution.
  let provider: TtsProvider = 'mock';
  let apiKey: string | undefined;
  if (mode === 'live') {
    const engineTts = getEngineConfig().providers.tts.default;
    provider = engineTts === 'elevenlabs' ? 'elevenlabs' : 'openai';
    apiKey = await resolveProviderCredential(provider);
    if (!apiKey) {
      throw new HttpError(
        'invalid_state',
        'Aucune clé TTS configurée. Ajoutez une clé ou repassez en mode mock.',
      );
    }
  }

  await checkDailyBudget(ttsCostEstimateCents(provider, text.length));

  let out;
  try {
    out = await synthesizeVoiceover({
      text,
      jobId: draft.id,
      provider,
      apiKey,
      onProviderError: 'throw',
      voice,
    });
  } catch (err) {
    throw new HttpError('upstream_failed', 'Échec du fournisseur TTS.', {
      cause: String(err),
    });
  }

  if (!out.voiceover.url) {
    throw new HttpError('upstream_failed', 'Génération audio indisponible (ffmpeg).');
  }

  const ext = out.voiceover.mimeType === 'audio/wav' ? 'wav' : 'mp3';
  const media = await createMedia({
    kind: 'audio',
    source: 'upload',
    slug: `content-studio-vo-${draft.id}-${createId().slice(0, 8)}`,
    alt: `Voix-off pour ${draft.variantLabel ?? draft.id}`,
    originalFilename: `${draft.id}.${ext}`,
    originalMime: out.voiceover.mimeType,
    originalSizeBytes: out.voiceover.fileSizeBytes,
    originalDurationMs: out.voiceover.durationMs,
    originalUrl: out.voiceover.url,
    status: 'passthrough',
    qualityProfile: 'inline',
    loadingStrategy: 'viewport',
    overrides: {
      contentStudio: {
        origin: 'ai_generated',
        kind: 'audio',
        provider: out.voiceover.provider,
        sourceDraftId: draft.id,
        voice,
        narration: text,
        promptVersion: VOICEOVER_PROMPT_VERSION,
      },
    },
    createdBy: input.actorId,
  });

  // role-scoped bind: replaces a prior voice-over, never the primary video.
  await upsertBundleAssets({
    draftId: draft.id,
    assets: [
      {
        mediaId: media.id,
        role: 'voiceover',
        meta: { provider: out.voiceover.provider, voice, durationMs: out.voiceover.durationMs },
      },
    ],
  });

  await insertGenerationRun({
    ideaId: null,
    briefId: draft.briefId,
    provider: out.voiceover.provider,
    model: provider === 'mock' ? 'mock' : provider,
    promptVersion: VOICEOVER_PROMPT_VERSION,
    input: { draftId: draft.id, script: text, voice, mode, intendedProvider: provider },
    output: { mediaId: media.id, durationMs: out.voiceover.durationMs, truncated: out.truncated },
    status: 'succeeded',
    costCents: out.costCents,
    errorMessage: null,
    createdBy: input.actorId,
  });

  await logAuditEvent({
    action: 'content_studio.voiceover.generated',
    actorId: input.actorId,
    resourceType: 'media',
    resourceId: media.id,
    meta: { draftId: draft.id, provider: out.voiceover.provider, voice, mode },
  });

  return {
    id: media.id,
    draftId: draft.id,
    role: 'voiceover',
    kind: 'audio',
    alt: media.alt,
    slug: media.slug,
    previewUrl: media.originalUrl ?? out.voiceover.url,
    originalUrl: media.originalUrl ?? out.voiceover.url,
    durationSec: out.voiceover.durationMs ? Math.round(out.voiceover.durationMs / 1000) : null,
    provider: out.voiceover.provider,
    voice,
    costCents: out.costCents,
    createdAt: media.createdAt.toISOString(),
  };
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
  const asset = await getPrimaryAsset(draft.id);
  if (!asset) {
    throw new HttpError(
      'invalid_state',
      'Un visuel doit être associé avant approbation. Générez un visuel ou choisissez un media, puis cliquez « Sauvegarder + relire ».',
    );
  }
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

export async function createVariation(input: {
  draftId: string;
  variantLabel?: string;
  promptOverride?: string;
  mode?: 'mock' | 'live';
}) {
  const draft = await requireDraft(input.draftId);
  assertTransition(draft.status, 'generated');

  // ACT-BE-014 (BUG-017) — RÉGÉNÉRER réellement le texte au lieu de cloner le
  // parent à l'identique : on remonte à l'idée via le brief et on relance la
  // génération en consommant promptOverride (injecté dans le prompt). Le
  // fallback varié (hooks/hashtags) garantit que la variation diffère même en
  // mock. Repli sur un clone si l'idée/brief est introuvable.
  const brief = await getBrief(draft.briefId);
  const idea = brief ? await getIdea(brief.ideaId) : null;
  if (idea) {
    const variationIdea = input.promptOverride
      ? { ...idea, prompt: `${idea.prompt}\n\nVariation demandée : ${input.promptOverride}` }
      : idea;
    const gen = await generateForIdea(variationIdea, { mode: input.mode });
    const fresh = gen.drafts[0];
    if (fresh) {
      return createDraftVariation(draft.id, {
        variantLabel: input.variantLabel ?? fresh.variantLabel,
        caption: fresh.caption,
        hook: fresh.hook,
        cta: fresh.cta,
        altText: fresh.altText,
        hashtags: fresh.hashtags,
        promptOverride: input.promptOverride,
      });
    }
  }

  return createDraftVariation(draft.id, {
    variantLabel: input.variantLabel,
    promptOverride: input.promptOverride,
  });
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

export async function updateContentBrief(input: { briefId: string; patch: { angle?: string; proof?: string; cta?: string; mediaDirection?: string; constraints?: Record<string, unknown> } }) {
  const brief = await getBrief(input.briefId);
  if (!brief) throw new HttpError('not_found', 'Brief introuvable.');
  return updateBrief(brief.id, input.patch);
}

export async function addLearningNote(input: { postId: string | null; note: string; tags?: string[] }) {
  return createLearningNote({
    postId: input.postId,
    note: input.note,
    tags: input.tags,
  });
}

export { listLearningNotesForPost, listLearningNotes };
