import { NextResponse } from 'next/server';
import { requireAdminApi, requireContentStudioEnabled } from '@/lib/content-studio/auth';
import { formatErrorResponse } from '@/lib/errors/http-error';
import { listGenerationRuns } from '@/lib/content-studio/repository';
import { getDailySpentCents } from '@/lib/content-studio/budget';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    requireContentStudioEnabled();
    await requireAdminApi();
    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? '50')));
    const [runs, dailySpentCents] = await Promise.all([
      listGenerationRuns(limit),
      getDailySpentCents(),
    ]);
    const dailyBudgetCents = Number(env.CONTENT_STUDIO_DAILY_GENERATION_BUDGET_CENTS) || 0;
    return NextResponse.json({
      runs,
      budget: {
        dailyBudgetCents,
        dailySpentCents,
        remainingCents: dailyBudgetCents > 0 ? Math.max(0, dailyBudgetCents - dailySpentCents) : null,
      },
    });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}