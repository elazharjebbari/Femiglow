/**
 * GET /api/admin/reset/jobs/[jobId]
 * → 200 JobSnapshot · 404 si introuvable
 */
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { getResetJobStore } from '@/lib/reset';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ jobId: string }> | { jobId: string } },
): Promise<Response> {
  const session = await getAdminSession();
  if (!session) return new Response('Unauthorized', { status: 401 });
  const params = await Promise.resolve(ctx.params);
  const snap = getResetJobStore().snapshot(params.jobId);
  if (!snap) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(snap);
}
