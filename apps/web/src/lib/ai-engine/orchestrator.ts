import { randomUUID } from 'node:crypto';
import { Command } from '@langchain/langgraph';
import { getContentEngine } from './graph';
import { getEngineConfig } from './config';
import { createLogger } from './utils/logger';
import { createJob, updateJobResult, updateJobStatus } from './jobs';

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
  /** Preview data sent to the UI when status = 'review' */
  reviewPayload?: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Check if the graph execution was interrupted (paused at a HITL gate).
 *
 * After `engine.invoke()` returns, the graph state will contain pending
 * tasks with interrupts if it hit an `interrupt()` call or was configured
 * with `interruptBefore`.  We use `engine.getState()` to inspect this.
 */
async function isGraphInterrupted(
  threadId: string,
): Promise<{ interrupted: boolean; interruptValue: Record<string, unknown> | null }> {
  const engine = getContentEngine();

  try {
    const snapshot = await engine.getState({ configurable: { thread_id: threadId } });

    // LangGraph stores pending interrupts on each task
    const { tasks, next, values } = snapshot;

    if (tasks && tasks.length > 0) {
      for (const task of tasks) {
        if (task.interrupts && task.interrupts.length > 0) {
          const firstInterrupt = task.interrupts[0];
          return {
            interrupted: true,
            interruptValue: (firstInterrupt?.value ?? null) as Record<string, unknown> | null,
          };
        }
      }
    }

    // Also check the 'next' field -- if the graph still has pending nodes,
    // it was interrupted before those nodes could run.
    if (next && next.length > 0) {
      // Graph was interrupted before these nodes -- extract preview from state
      const stateValues = values as Record<string, unknown> | undefined;
      return {
        interrupted: true,
        interruptValue: stateValues
          ? {
              jobId: stateValues.jobId,
              script: stateValues.script,
              caption: stateValues.caption,
              hashtags: stateValues.hashtags,
              images: stateValues.images,
              videos: stateValues.videos,
              qualityScores: stateValues.qualityScores,
              moderationResult: stateValues.moderationResult,
            }
          : null,
      };
    }
  } catch (err) {
    log.warn('Failed to check graph interrupt state', { data: { error: String(err) } });
  }

  return { interrupted: false, interruptValue: null };
}

function buildResultFromState(
  finalState: Record<string, unknown>,
  jobId: string,
  durationMs: number,
  status: 'completed' | 'review' | 'failed',
  reviewPayload?: Record<string, unknown> | null,
): GenerationResult {
  return {
    jobId,
    status,
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
    reviewPayload: reviewPayload ?? null,
  };
}

// ---------------------------------------------------------------------------
// Main generation entry point
// ---------------------------------------------------------------------------

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

  const engine = getContentEngine();

  const initialState = {
    jobId,
    tenantId: 'femiglow',
    createdAt: new Date().toISOString(),
    platform: request.platform,
    format: request.format,
    contentType: request.contentType,
    brief: request.briefInput,
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

  await createJob(jobId, request).catch(() => {});

  try {
    log.info('Invoking LangGraph engine', { jobId, data: { stateKeys: Object.keys(initialState) } });

    const result = await engine.invoke(initialState as never, {
      configurable: { thread_id: jobId },
      recursionLimit: 50,
    });

    const durationMs = Date.now() - startTime;
    const finalState = result as Record<string, unknown>;

    // ── Check if the graph was interrupted (HITL pause) ────────────
    const { interrupted, interruptValue } = await isGraphInterrupted(jobId);

    if (interrupted) {
      log.info('Generation paused for human review', {
        jobId,
        durationMs,
        data: { step: finalState.currentStep },
      });

      const genResult = buildResultFromState(finalState, jobId, durationMs, 'review', interruptValue);
      await updateJobStatus(jobId, 'review').catch(() => {});
      return genResult;
    }

    // ── Graph completed normally ───────────────────────────────────
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

    const genResult = buildResultFromState(finalState, jobId, durationMs, 'completed');
    await updateJobResult(jobId, genResult).catch(() => {});
    return genResult;
  } catch (err) {
    const durationMs = Date.now() - startTime;
    log.error('Generation failed', {
      jobId,
      durationMs,
      data: { error: String(err) },
    });

    const failResult: GenerationResult = {
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

    await updateJobResult(jobId, failResult).catch(() => {});

    return failResult;
  }
}

// ---------------------------------------------------------------------------
// Resume generation after human review
// ---------------------------------------------------------------------------

export interface ReviewDecision {
  decision: 'approved' | 'rejected' | 'edit_requested';
  feedback?: string;
}

/**
 * Resume a paused generation after a human review decision.
 *
 * The graph was interrupted before or inside the `reviewGate` node.
 * We resume it by passing a `Command({ resume: decision })` which
 * provides the decision value to the `interrupt()` call inside the node.
 */
export async function resumeGeneration(
  jobId: string,
  decision: ReviewDecision,
): Promise<GenerationResult> {
  const startTime = Date.now();

  log.info('Resuming generation after review', {
    jobId,
    data: { decision: decision.decision, hasFeedback: !!decision.feedback },
  });

  const engine = getContentEngine();

  try {
    await updateJobStatus(jobId, 'running').catch(() => {});

    // Resume the graph with the human decision.
    // `Command({ resume })` feeds the value back to `interrupt()`.
    const result = await engine.invoke(
      new Command({ resume: decision }) as never,
      {
        configurable: { thread_id: jobId },
        recursionLimit: 50,
      },
    );

    const durationMs = Date.now() - startTime;
    const finalState = result as Record<string, unknown>;

    // Check if the graph paused again (e.g. after edit_requested -> regenerate -> review again)
    const { interrupted, interruptValue } = await isGraphInterrupted(jobId);

    if (interrupted) {
      log.info('Generation paused again for review after resume', { jobId, durationMs });
      const genResult = buildResultFromState(finalState, jobId, durationMs, 'review', interruptValue);
      await updateJobStatus(jobId, 'review').catch(() => {});
      return genResult;
    }

    log.info('Generation completed after resume', {
      jobId,
      durationMs,
      data: { step: finalState.currentStep },
    });

    const genResult = buildResultFromState(finalState, jobId, durationMs, 'completed');
    await updateJobResult(jobId, genResult).catch(() => {});
    return genResult;
  } catch (err) {
    const durationMs = Date.now() - startTime;
    log.error('Resume failed', { jobId, durationMs, data: { error: String(err) } });

    const failResult: GenerationResult = {
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
      errors: [{ node: 'orchestrator:resume', errorType: 'UnhandledError', message: String(err), timestamp: new Date().toISOString(), retryable: false }],
      durationMs,
    };

    await updateJobResult(jobId, failResult).catch(() => {});
    return failResult;
  }
}
