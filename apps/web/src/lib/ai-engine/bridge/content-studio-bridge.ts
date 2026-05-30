import {
  createIdea,
  createBrief,
  createDrafts,
  insertGenerationRun,
  upsertPrimaryAsset,
} from '@/lib/content-studio/repository';
import type {
  ContentPillar,
  ContentObjective,
  ContentPlatform,
  ContentFormat,
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

  // 4. Bind images as assets if present (skip mock images)
  const images = (result.images ?? []) as Array<Record<string, unknown>>;
  const realImage = images.find((img) => {
    const provider = img.provider as string | undefined;
    return provider && !provider.startsWith('mock');
  });
  if (realImage) {
    const mediaId = realImage.assetId as string | undefined;
    if (mediaId) {
      try {
        await upsertPrimaryAsset({ draftId: draft.id, mediaId });
      } catch {
        // Media ID might not exist in media table yet — non-blocking
      }
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
