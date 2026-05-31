import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { retryPostizDeliveriesJob } from '@/lib/content-studio/automation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  try {
    authorizeCron(request);
    const searchParams = new URL(request.url).searchParams;
    const result = await retryPostizDeliveriesJob({
      limit: numericParam(searchParams.get('limit'), 5),
      maxAttempts: numericParam(searchParams.get('maxAttempts'), 3),
      dryRun: searchParams.get('dryRun') === 'true',
    });
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

function numericParam(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
