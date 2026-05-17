import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { syncPostizIntegrationsJob } from '@/lib/content-studio/automation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: Request): Promise<Response> {
  try {
    authorizeCron(request);
    const result = await syncPostizIntegrationsJob();
    return NextResponse.json(result);
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

function authorizeCron(request: Request): void {
  const auth = request.headers.get('authorization');
  const expected = env.CRON_SECRET ? `Bearer ${env.CRON_SECRET}` : null;
  if (!expected || auth !== expected) {
    throw new HttpError('unauthorized', 'Bearer manquant ou invalide');
  }
}
