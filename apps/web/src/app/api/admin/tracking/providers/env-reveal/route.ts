import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { HttpError, formatErrorResponse } from '@/lib/errors/http-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SNAP_CAPI_TOKEN = process.env.SNAP_CAPI_TOKEN;

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Non autorisé');

    const url = new URL(request.url);
    const kind = url.searchParams.get('kind');

    // Actuellement, seul Snap a un token .env suggéré.
    if (kind === 'snap') {
      return NextResponse.json({ token: SNAP_CAPI_TOKEN ?? null });
    }

    return NextResponse.json({ token: null });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}