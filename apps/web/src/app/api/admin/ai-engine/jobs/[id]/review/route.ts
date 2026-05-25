import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminApi } from '@/lib/content-studio/auth';
import { formatErrorResponse } from '@/lib/errors/http-error';
import { resumeGeneration } from '@/lib/ai-engine/orchestrator';
import { getJob } from '@/lib/ai-engine/jobs';
import { bridgeToContentStudio } from '@/lib/ai-engine/bridge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const reviewDecisionSchema = z.object({
  decision: z.enum(['approved', 'rejected', 'edit_requested']),
  feedback: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    await requireAdminApi();

    const { id: jobId } = await params;

    // Validate that the job exists and is in review status
    const job = await getJob(jobId);
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 },
      );
    }

    if (job.status !== 'review') {
      return NextResponse.json(
        { error: `Job is not awaiting review (current status: ${job.status})` },
        { status: 409 },
      );
    }

    const body = await request.json();
    const parsed = reviewDecisionSchema.parse(body);

    const result = await resumeGeneration(jobId, parsed);

    // Bridge successful generations into Content Studio records
    let bridgeResult: { ideaId: string; briefId: string; draftId: string } | null = null;
    let contentStudioUrl: string | null = null;

    if (result.status === 'completed') {
      try {
        const briefInput = (job.briefInput ?? {}) as Record<string, unknown>;
        bridgeResult = await bridgeToContentStudio(result, {
          platform: job.platform,
          format: job.format,
          contentType: job.contentType,
          briefInput: {
            objective: (briefInput.objective as string) ?? 'awareness',
            keyMessage: (briefInput.keyMessage as string) ?? '',
            tone: briefInput.tone as string | undefined,
            targetAudience: briefInput.targetAudience as string | undefined,
            productFocus: briefInput.productFocus as string | undefined,
          },
        });
        contentStudioUrl = `/admin/content-studio-v2/library?highlight=${bridgeResult.draftId}`;
      } catch (bridgeErr) {
        console.error('[ai-engine:review] Bridge to Content Studio failed (non-blocking):', bridgeErr);
      }
    }

    return NextResponse.json({
      ...result,
      bridgeResult,
      contentStudioUrl,
    });
  } catch (err) {
    console.error('[ai-engine:review] Route error:', err);
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
