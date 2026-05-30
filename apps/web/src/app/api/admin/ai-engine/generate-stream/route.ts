import { z } from 'zod';
import { requireAdminApi } from '@/lib/content-studio/auth';
import { formatErrorResponse } from '@/lib/errors/http-error';
import { getEngineConfig } from '@/lib/ai-engine/config';
import { createContentEngine } from '@/lib/ai-engine/graph';
import { createJob, updateJobResult } from '@/lib/ai-engine/jobs';
import { bridgeToContentStudio } from '@/lib/ai-engine/bridge';
import type { GenerationResult } from '@/lib/ai-engine/orchestrator';
import { randomUUID } from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const generateRequestSchema = z.object({
  platform: z.enum(['instagram', 'facebook', 'tiktok', 'pinterest', 'youtube', 'linkedin', 'twitter', 'threads']),
  format: z.enum(['post', 'story', 'reel', 'carousel', 'short', 'pin', 'article']),
  contentType: z.string().min(1),
  briefInput: z.object({
    objective: z.enum(['awareness', 'engagement', 'conversion', 'education', 'entertainment']),
    tone: z.enum(['professional', 'casual', 'playful', 'luxurious', 'educational', 'inspiring']).optional(),
    targetAudience: z.string().optional(),
    productFocus: z.string().optional(),
    keyMessage: z.string().min(1),
    constraints: z.array(z.string()).optional(),
    seasonalContext: z.string().optional(),
    trendReference: z.string().optional(),
    language: z.string().optional(),
    maxBudgetCents: z.number().int().positive().optional(),
  }),
  ideaId: z.string().uuid().optional(),
  workflowId: z.string().uuid().optional(),
});

/**
 * Map LangGraph node names to human-readable pipeline step IDs
 * used by the front-end GenerationProgress component.
 */
const NODE_TO_STEP: Record<string, string> = {
  parseBrief: 'parse_brief',
  enrichKnowledge: 'enrich_knowledge',
  enrichTrends: 'enrich_trends',
  generateScript: 'generate_script',
  generateImages: 'generate_images',
  generateVideo: 'generate_video',
  generateVoiceover: 'generate_voiceover',
  generateMusic: 'generate_music',
  generateSubtitles: 'generate_subtitles',
  generateCaption: 'generate_caption',
  compose: 'compose',
  transcodeExport: 'compose',
  qualityCheck: 'quality_check',
  moderate: 'quality_check',
  reviewGate: 'quality_check',
  generateVariants: 'done',
};

function sseEvent(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request): Promise<Response> {
  try {
    await requireAdminApi();

    const config = getEngineConfig();
    if (!config.enabled) {
      return new Response(
        JSON.stringify({ error: 'AI Engine is disabled. Set AI_ENGINE_ENABLED=true.' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const body = await request.json();
    const parsed = generateRequestSchema.parse(body);

    const jobId = randomUUID();
    const startTime = Date.now();

    const engine = createContentEngine();

    const initialState = {
      jobId,
      tenantId: 'femiglow',
      createdAt: new Date().toISOString(),
      platform: parsed.platform,
      format: parsed.format,
      contentType: parsed.contentType,
      brief: parsed.briefInput,
      briefInput: parsed.briefInput,
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
      humanReview: config.quality.humanReviewRequired ? null : { decision: 'approved_direct' as const },
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

    await createJob(jobId, parsed).catch(() => {});

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial event
          controller.enqueue(
            encoder.encode(sseEvent({ step: 'init', status: 'running', jobId })),
          );

          const stepTimers: Record<string, number> = {};
          let lastStep = '';

          // Use LangGraph .stream() with "updates" mode to detect node transitions
          const graphStream = await engine.stream(initialState as never, {
            recursionLimit: 50,
            streamMode: 'updates' as never,
          });

          let finalState: Record<string, unknown> = {};

          for await (const chunk of graphStream) {
            // In "updates" mode, each chunk is an object keyed by node name
            const chunkObj = chunk as Record<string, unknown>;

            for (const nodeName of Object.keys(chunkObj)) {
              const stepId = NODE_TO_STEP[nodeName] ?? nodeName;

              // Mark previous step as done
              if (lastStep && lastStep !== stepId) {
                const timerStart = stepTimers[lastStep];
                const duration = timerStart != null
                  ? Date.now() - timerStart
                  : undefined;
                controller.enqueue(
                  encoder.encode(
                    sseEvent({ step: lastStep, status: 'done', durationMs: duration }),
                  ),
                );
              }

              // Mark new step as running
              if (stepId !== lastStep) {
                stepTimers[stepId] = Date.now();
                controller.enqueue(
                  encoder.encode(sseEvent({ step: stepId, status: 'running' })),
                );
                lastStep = stepId;
              }

              // Merge updates into final state
              const nodeUpdate = chunkObj[nodeName] as Record<string, unknown> | undefined;
              if (nodeUpdate && typeof nodeUpdate === 'object') {
                finalState = { ...finalState, ...nodeUpdate };
              }
            }
          }

          // Mark last step as done
          if (lastStep) {
            const lastTimerStart = stepTimers[lastStep];
            const duration = lastTimerStart != null
              ? Date.now() - lastTimerStart
              : undefined;
            controller.enqueue(
              encoder.encode(sseEvent({ step: lastStep, status: 'done', durationMs: duration })),
            );
          }

          const durationMs = Date.now() - startTime;

          const genResult: GenerationResult = {
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

          await updateJobResult(jobId, genResult).catch(() => {});

          // Bridge to Content Studio
          let bridgeResult: { ideaId: string; briefId: string; draftId: string } | null = null;
          let contentStudioUrl: string | null = null;

          if (genResult.status !== 'failed') {
            try {
              bridgeResult = await bridgeToContentStudio(genResult, parsed);
              contentStudioUrl = `/admin/content-studio-v2/library?highlight=${bridgeResult.draftId}`;
            } catch {
              // Non-blocking
            }
          }

          // Send final result
          controller.enqueue(
            encoder.encode(
              sseEvent({
                step: 'complete',
                status: 'done',
                result: { ...genResult, bridgeResult, contentStudioUrl },
              }),
            ),
          );

          controller.close();
        } catch (err) {
          const durationMs = Date.now() - startTime;

          // Send error event
          controller.enqueue(
            encoder.encode(
              sseEvent({
                step: 'error',
                status: 'error',
                error: err instanceof Error ? err.message : String(err),
                durationMs,
              }),
            ),
          );

          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err) {
    console.error('[ai-engine:generate-stream] Route error:', err);
    if (err instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ error: 'Validation error', details: err.errors }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }
    const errRes = formatErrorResponse(err);
    return new Response(JSON.stringify(errRes.body), {
      status: errRes.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
