import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminApi } from '@/lib/content-studio/auth';
import { formatErrorResponse } from '@/lib/errors/http-error';
import { runGeneration } from '@/lib/ai-engine/orchestrator';
import { getEngineConfig } from '@/lib/ai-engine/config';
import { bridgeToContentStudio } from '@/lib/ai-engine/bridge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const generateRequestSchema = z.object({
  platform: z.enum(['instagram', 'facebook', 'tiktok', 'pinterest', 'youtube', 'linkedin', 'twitter', 'threads']),
  format: z.enum(['post', 'story', 'reel', 'carousel', 'short', 'pin', 'article', 'single_image', 'text_post', 'infographic']),
  contentType: z.string().min(1),
  briefInput: z.object({
    objective: z.enum(['awareness', 'engagement', 'conversion', 'education', 'entertainment', 'loyalty', 'ugc']),
    tone: z.enum(['professional', 'casual', 'playful', 'luxurious', 'educational', 'inspiring', 'empowering', 'authentic', 'urgent']).optional(),
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

// Flat schema matching the create page's form submission
const generateRequestFlat = z.object({
  objective: z.string().min(1),
  platform: z.string().min(1),
  format: z.string().min(1),
  tone: z.string().min(1),
  keyMessage: z.string().min(1),
  productFocus: z.string().optional(),
  trendReference: z.string().optional(),
  model: z.string().optional(),
  temperature: z.number().optional(),
  maxTokens: z.number().optional(),
  imageEnabled: z.boolean().optional(),
  imageModel: z.string().optional(),
  videoEnabled: z.boolean().optional(),
  videoModel: z.string().optional(),
  humanReviewRequired: z.boolean().optional(),
});

/**
 * Normalise incoming request body. Accepts EITHER the original nested
 * schema (used by programmatic callers / tests) OR the flat schema
 * that the create-page form sends.
 */
function normalizeRequest(body: unknown) {
  // Try the original nested schema first
  const nested = generateRequestSchema.safeParse(body);
  if (nested.success) return nested.data;

  // Try the flat schema from the create page
  const flat = generateRequestFlat.safeParse(body);
  if (flat.success) {
    const d = flat.data;
    return {
      platform: d.platform as z.infer<typeof generateRequestSchema>['platform'],
      format: d.format as z.infer<typeof generateRequestSchema>['format'],
      contentType: d.format, // derive contentType from format
      briefInput: {
        objective: d.objective as z.infer<typeof generateRequestSchema>['briefInput']['objective'],
        tone: d.tone as z.infer<typeof generateRequestSchema>['briefInput']['tone'],
        keyMessage: d.keyMessage,
        productFocus: d.productFocus,
        trendReference: d.trendReference,
      },
      // Pass through generation config (consumed downstream by engine state)
      model: d.model,
      temperature: d.temperature,
      maxTokens: d.maxTokens,
      imageEnabled: d.imageEnabled,
      imageModel: d.imageModel,
      videoEnabled: d.videoEnabled,
      videoModel: d.videoModel,
      humanReviewRequired: d.humanReviewRequired,
    };
  }

  // Both schemas failed — throw the original nested error for richer messages
  return generateRequestSchema.parse(body);
}

export async function POST(request: Request): Promise<Response> {
  try {
    await requireAdminApi();

    const config = getEngineConfig();
    if (!config.enabled) {
      return NextResponse.json(
        { error: 'AI Engine is disabled. Set AI_ENGINE_ENABLED=true.' },
        { status: 503 },
      );
    }

    const body = await request.json();
    const parsed = normalizeRequest(body);

    const result = await runGeneration(parsed);

    // Bridge successful generations into Content Studio records
    let bridgeResult: { ideaId: string; briefId: string; draftId: string } | null = null;
    let contentStudioUrl: string | null = null;

    if (result.status !== 'failed') {
      try {
        bridgeResult = await bridgeToContentStudio(result, parsed);
        contentStudioUrl = `/admin/content-studio-v2/library?highlight=${bridgeResult.draftId}`;
      } catch (bridgeErr) {
        console.error('[ai-engine:generate] Bridge to Content Studio failed (non-blocking):', bridgeErr);
      }
    }

    const statusCode = result.status === 'failed' ? 500 : 200;
    return NextResponse.json(
      { ...result, bridgeResult, contentStudioUrl },
      { status: statusCode },
    );
  } catch (err) {
    console.error('[ai-engine:generate] Route error:', err);
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: err.errors },
        { status: 400 },
      );
    }
    const errRes = formatErrorResponse(err);
    return NextResponse.json(errRes.body, { status: errRes.status });
  }
}
