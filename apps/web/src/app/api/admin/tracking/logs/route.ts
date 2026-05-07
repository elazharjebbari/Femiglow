import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { listEvents } from '@/lib/db/queries/tracking/events-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get('limit') ?? '50'), 500);
    const offset = Math.max(Number(url.searchParams.get('offset') ?? '0'), 0);
    const eventName = url.searchParams.get('eventName') ?? undefined;
    const pageRoute = url.searchParams.get('pageRoute') ?? undefined;
    const anonymousId = url.searchParams.get('anonymousId') ?? undefined;
    const sessionId = url.searchParams.get('sessionId') ?? undefined;
    const conv = url.searchParams.get('isConversion');
    const fromStr = url.searchParams.get('fromDate');
    const toStr = url.searchParams.get('toDate');
    const events = await listEvents({
      limit,
      offset,
      eventName,
      pageRoute,
      anonymousId,
      sessionId,
      isConversion: conv === '1' ? true : conv === '0' ? false : undefined,
      fromDate: fromStr ? new Date(fromStr) : undefined,
      toDate: toStr ? new Date(toStr) : undefined,
    });
    return NextResponse.json({ events });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
