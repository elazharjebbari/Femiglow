import {
  createIdea,
  createBrief,
  createDrafts,
  insertGenerationRun,
  upsertBundleAssets,
} from '@/lib/content-studio/repository';
import type {
  ContentPillar,
  ContentObjective,
  ContentPlatform,
  ContentFormat,
  MediaRole,
} from '@/lib/content-studio/types';
import type { GenerationRequest, GenerationResult } from '../orchestrator';

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

const PILLAR_MAP: Record<string, ContentPillar> = {
  rituel: 'rituel',
  produit: 'produit',
  preuve: 'preuve',
  journal: 'journal',
  maison: 'maison',
  reassurance: 'reassurance',
  saison: 'saison',
  coulisses: 'coulisses',
};

const OBJECTIVE_MAP: Record<string, ContentObjective> = {
  engagement: 'consideration',
  awareness: 'notoriete',
  conversion: 'conversion',
  education: 'consideration',
  entertainment: 'notoriete',
};

const PLATFORM_MAP: Record<string, ContentPlatform> = {
  instagram: 'instagram',
  facebook: 'facebook',
};

const FORMAT_MAP: Record<string, ContentFormat> = {
  post: 'post',
  story: 'story',
  reel: 'reel',
  carousel: 'carousel',
};

function mapPillar(contentType: string): ContentPillar {
  return PILLAR_MAP[contentType.toLowerCase()] ?? 'produit';
}

function mapObjective(objective: string): ContentObjective {
  return OBJECTIVE_MAP[objective.toLowerCase()] ?? 'consideration';
}

function mapPlatform(platform: string): ContentPlatform {
  return PLATFORM_MAP[platform.toLowerCase()] ?? 'instagram';
}

function mapFormat(format: string): ContentFormat {
  return FORMAT_MAP[format.toLowerCase()] ?? 'post';
}

// ---------------------------------------------------------------------------
// Bridge
// ---------------------------------------------------------------------------

export interface BridgeResult {
  ideaId: string;
  briefId: string;
  draftId: string;
}

/**
 * Creates Content Studio records (idea, brief, draft, generation run) from an
 * AI Engine generation result so the content appears in the existing library.
 */
export async function bridgeToContentStudio(
  result: GenerationResult,
  request: GenerationRequest,
): Promise<BridgeResult> {
  const platform = mapPlatform(request.platform);
  const format = mapFormat(request.format);

  // 1. Create content_idea ------------------------------------------------
  const idea = await createIdea({
    pillar: mapPillar(request.contentType),
    objective: mapObjective(request.briefInput.objective),
    platform,
    format,
    prompt: request.briefInput.keyMessage,
    sourceType: 'ai-engine',
    sourceRef: result.jobId,
    actorId: null,
  });

  // Skip the normal idea -> brief -> generated flow: set status directly
  // (createIdea sets status to 'idea', we need 'generated')
  const { updateIdeaStatus } = await import('@/lib/content-studio/repository');
  await updateIdeaStatus(idea.id, 'generated');

  // 2. Create content_brief -----------------------------------------------
  const script = result.script as Record<string, unknown> | null;
  const hook = (script?.hook as string) ?? '';
  const cta = (script?.cta as string) ?? '';
  const visualDirection = script?.visualDirection;

  const brief = await createBrief({
    ideaId: idea.id,
    angle: hook || request.briefInput.keyMessage,
    proof: cta || null,
    cta: cta || 'Voir plus',
    mediaDirection: visualDirection ? JSON.stringify(visualDirection) : '',
    actorId: null,
  });

  // 3. Create content_draft -----------------------------------------------
  const qualityAvg =
    typeof result.qualityScores?.average === 'number'
      ? Math.round(result.qualityScores.average * 100)
      : null;

  const drafts = await createDrafts([
    {
      briefId: brief.id,
      platform,
      format,
      variantLabel: 'ai-engine',
      caption: result.caption || '',
      hook: hook || null,
      cta: cta || null,
      hashtags: result.hashtags ?? [],
    },
  ]);

  const draft = drafts[0]!;

  // Set the quality score on the draft if available
  if (qualityAvg !== null) {
    const { updateDraft } = await import('@/lib/content-studio/repository');
    await updateDraft(draft.id, { scoreTotal: qualityAvg });
  }

  // 4. Bind the full media bundle by role (MP-AR-002, BUG-004). The legacy
  //    behavior bound at most ONE image; we now surface every artifact the
  //    graph produced (voiceover/music/composed video) — without dropping them.
  type Artifact = { assetId?: string; provider?: string };
  const bundle: Array<{ mediaId: string; role: MediaRole; meta?: Record<string, unknown> }> = [];

  const pushAsset = (a: Artifact | null | undefined, role: MediaRole) => {
    if (!a) return;
    // Preserve the legacy "skip mock" rule ONLY for primary visuals; audio /
    // composed mocks are deterministic and must surface to the operator.
    const isVisual = role === 'primary_image' || role === 'primary_video';
    if (isVisual && a.provider?.startsWith('mock')) return;
    if (a.assetId) bundle.push({ mediaId: a.assetId, role });
  };

  const images = (result.images ?? []) as Artifact[];
  const realImage = images.find((img) => img.provider && !img.provider.startsWith('mock'));
  pushAsset(realImage ?? null, 'primary_image');
  pushAsset((result.videos?.[0] as Artifact | undefined) ?? null, 'primary_video');
  pushAsset((result.voiceover as Artifact | null) ?? null, 'voiceover');
  pushAsset((result.music as Artifact | null) ?? null, 'music');
  pushAsset((result.composedVideo as Artifact | null) ?? null, 'composed_video');

  // Subtitles are SRT TEXT, not a MediaAsset. The bridge's job is to not DROP
  // the text; the canonical `.srt` asset write happens in the per-draft
  // subtitles service (MP-SU). Record the SRT in the binding meta meanwhile.
  if (typeof result.subtitles === 'string' && result.subtitles.length > 0) {
    bundle.push({
      mediaId: `srt:${draft.id}`,
      role: 'subtitles',
      meta: { srt: result.subtitles, source: 'ai-engine' },
    });
  }

  if (bundle.length > 0) {
    try {
      await upsertBundleAssets({ draftId: draft.id, assets: bundle });
    } catch {
      // Media IDs might not exist in the media table yet — non-blocking
      // (mirrors the original try/catch contract).
    }
  }

  // 5. Create content_generation_run --------------------------------------
  const costCents =
    typeof (result.costTracking as Record<string, unknown>)?.totalCents === 'number'
      ? ((result.costTracking as Record<string, unknown>).totalCents as number)
      : 0;

  try {
    await insertGenerationRun({
      ideaId: idea.id,
      briefId: brief.id,
      provider: 'ai-engine-langgraph',
      model: 'langgraph-v1',
      promptVersion: 'ai-engine-v1',
      input: { platform: request.platform, format: request.format, keyMessage: request.briefInput.keyMessage } as Record<string, unknown>,
      output: { status: result.status, durationMs: result.durationMs, qualityAvg: result.qualityScores?.average } as Record<string, unknown>,
      status: 'succeeded',
      costCents,
      errorMessage: null,
      createdBy: null,
    });
  } catch {
    // generation_run insert is non-critical
  }

  return {
    ideaId: idea.id,
    briefId: brief.id,
    draftId: draft.id,
  };
}
