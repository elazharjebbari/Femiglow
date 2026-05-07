import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { recoverFailedJobs } from '@/lib/db/queries/media-jobs';
import { logAuditEvent } from '@/lib/audit/log-event';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: Request): Promise<Response> {
  try {
    const auth = request.headers.get('authorization');
    const expected = env.CRON_SECRET ? `Bearer ${env.CRON_SECRET}` : null;
    if (!expected || auth !== expected) {
      throw new HttpError('unauthorized', 'Bearer manquant ou invalide');
    }
    const sinceParam = new URL(request.url).searchParams.get('sinceDays');
    const sinceDays = sinceParam ? Math.max(1, Math.min(30, Number(sinceParam))) : 7;
    const recovered = await recoverFailedJobs(sinceDays);
    await logAuditEvent({
      action: 'system.media_recover',
      actorId: null,
      meta: { recovered, since_days: sinceDays },
    });
    return NextResponse.json({ recovered });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
