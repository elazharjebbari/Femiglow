import { randomUUID } from 'node:crypto';
import { createContentEngine } from './graph';
import { getEngineConfig } from './config';
import { createLogger } from './utils/logger';

const log = createLogger('orchestrator');

export interface GenerationRequest {
  platform: string;
  format: string;
  contentType: string;
  briefInput: {
    objective: string;
    tone?: string;
    targetAudience?: string;
    productFocus?: string;
    keyMessage: string;
    constraints?: string[];
    seasonalContext?: string;
    trendReference?: string;
    language?: string;
    maxBudgetCents?: number;
  };
  ideaId?: string;
  workflowId?: string;
}

export interface GenerationResult {
  jobId: string;
  status: 'completed' | 'review' | 'failed';
  script: Record<string, unknown> | null;
  caption: string;
  hashtags: string[];
  images: Array<Record<string, unknown>>;
  videos: Array<Record<string, unknown>>;
  qualityScores: Record<string, number>;
  moderationResult: Record<string, unknown> | null;
  costTracking: Record<string, unknown>;
  errors: Array<Record<string, unknown>>;
  durationMs: number;
}

export async function runGeneration(request: GenerationRequest): Promise<GenerationResult> {
  const config = getEngineConfig();
  if (!config.enabled) {
    throw new Error('AI Engine is disabled. Set AI_ENGINE_ENABLED=true to enable.');
  }

  const jobId = randomUUID();
  const startTime = Date.now();

  log.info('Starting generation', {
    jobId,
    data: {
      platform: request.platform,
      format: request.format,
      contentType: request.contentType,
      objective: request.briefInput.objective,
    },
  });

  const engine = createContentEngine();

  const initialState = {
    jobId,
    tenantId: 'femiglow',
    createdAt: new Date().toISOString(),
    platform: request.platform,
    format: request.format,
    contentType: request.contentType,
    briefInput: request.briefInput,
    knowledgeContext: '',
    trendContext: '',
    brandGuidelines: '',
    performanceContext: '',
    script: null,
    caption: '',
    hashtags: [],
    ctaText: '',
    imagePrompts: [],
    images: [],
    videoPrompts: [],
    videos: [],
    voiceover: null,
    music: null,
    subtitles: null,
    composition: null,
    thumbnails: [],
    exports: {},
    qualityScores: {},
    moderationResult: null,
    humanReview: config.quality.humanReviewRequired ? null : { decision: 'approved_direct' },
    currentStep: 'init',
    errors: [],
    retries: {},
    costTracking: {
      totalCents: 0,
      breakdown: {},
      tokensUsed: {},
      budgetRemainingCents: config.budget.maxPerJobCents,
    },
    variants: [],
    selectedVariant: null,
  };

  try {
    const result = await engine.invoke(initialState as never);

    const durationMs = Date.now() - startTime;
    const finalState = result as Record<string, unknown>;

    log.info('Generation completed', {
      jobId,
      durationMs,
      costCents: (finalState.costTracking as Record<string, unknown>)?.totalCents as number,
      data: {
        step: finalState.currentStep,
        imagesCount: (finalState.images as unknown[])?.length ?? 0,
        qualityAvg: (finalState.qualityScores as Record<string, number>)?.average,
      },
    });

    return {
      jobId,
      status: finalState.humanReview ? 'completed' : 'review',
      script: (finalState.script as Record<string, unknown>) ?? null,
      caption: (finalState.caption as string) ?? '',
      hashtags: (finalState.hashtags as string[]) ?? [],
      images: (finalState.images as Array<Record<string, unknown>>) ?? [],
      videos: (finalState.videos as Array<Record<string, unknown>>) ?? [],
      qualityScores: (finalState.qualityScores as Record<string, number>) ?? {},
      moderationResult: (finalState.moderationResult as Record<string, unknown>) ?? null,
      costTracking: (finalState.costTracking as Record<string, unknown>) ?? {},
      errors: (finalState.errors as Array<Record<string, unknown>>) ?? [],
      durationMs,
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    log.error('Generation failed', {
      jobId,
      durationMs,
      data: { error: String(err) },
    });

    return {
      jobId,
      status: 'failed',
      script: null,
      caption: '',
      hashtags: [],
      images: [],
      videos: [],
      qualityScores: {},
      moderationResult: null,
      costTracking: {},
      errors: [{ node: 'orchestrator', errorType: 'UnhandledError', message: String(err), timestamp: new Date().toISOString(), retryable: false }],
      durationMs,
    };
  }
}
