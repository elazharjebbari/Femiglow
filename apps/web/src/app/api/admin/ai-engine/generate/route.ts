import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminApi } from '@/lib/content-studio/auth';
import { formatErrorResponse } from '@/lib/errors/http-error';
import { runGeneration } from '@/lib/ai-engine/orchestrator';
import { getEngineConfig } from '@/lib/ai-engine/config';

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
    const parsed = generateRequestSchema.parse(body);

    const result = await runGeneration(parsed);

    const statusCode = result.status === 'failed' ? 500 : 200;
    return NextResponse.json(result, { status: statusCode });
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
