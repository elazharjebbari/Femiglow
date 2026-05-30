import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/content-studio/auth';
import { formatErrorResponse } from '@/lib/errors/http-error';
import { listJobs, getJobStats } from '@/lib/ai-engine/jobs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    await requireAdminApi();

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') ?? '20', 10);
    const offset = parseInt(searchParams.get('offset') ?? '0', 10);
    const status = searchParams.get('status') ?? undefined;
    const includeStats = searchParams.get('stats') === 'true';

    const jobs = await listJobs({ limit, offset, status });

    const response: Record<string, unknown> = { jobs };

    if (includeStats) {
      const [daily, weekly, monthly] = await Promise.all([
        getJobStats('day'),
        getJobStats('week'),
        getJobStats('month'),
      ]);
      response.stats = { daily, weekly, monthly };
    }

    return NextResponse.json(response);
  } catch (err) {
    const errRes = formatErrorResponse(err);
    return NextResponse.json(errRes.body, { status: errRes.status });
  }
}
