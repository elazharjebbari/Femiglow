/**
 * POST /api/admin/reset/jobs/[jobId]/cancel
 * → 200 { ok, status }
 */
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { getResetJobStore } from '@/lib/reset';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ jobId: string }> | { jobId: string } },
): Promise<Response> {
  const session = await getAdminSession();
  if (!session) return new Response('Unauthorized', { status: 401 });
  const params = await Promise.resolve(ctx.params);
  const job = getResetJobStore().get(params.jobId);
  if (!job) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  job.abort.abort();
  return NextResponse.json({ ok: true, status: job.status });
}
