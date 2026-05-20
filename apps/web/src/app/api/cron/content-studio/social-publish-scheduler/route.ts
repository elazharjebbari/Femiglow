import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { runScheduledPublishJobs } from '@/lib/social-publishing/worker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  try {
    authorizeCron(request);
    const body = await readBody(request);
    const limit = typeof body.limit === 'number' && Number.isFinite(body.limit) ? body.limit : undefined;
    const result = await runScheduledPublishJobs({ limit });
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

async function readBody(request: Request): Promise<{ limit?: unknown }> {
  try {
    const json = await request.json();
    return (json && typeof json === 'object' ? json : {}) as { limit?: unknown };
  } catch {
    return {};
  }
}
