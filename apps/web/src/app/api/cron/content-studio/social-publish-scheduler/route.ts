import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { runScheduledPublishJobs } from '@/lib/social-publishing/worker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET handler — invoqué par le cron Vercel (qui envoie GET par défaut).
 *
 * Référence : `docs/live-systems-fix-2026-05/07-system-publishing.md` § QW1
 *
 * Authorize via Bearer ou via header `x-vercel-cron` (Vercel set ce header
 * automatiquement sur ses cron invocations, cf. docs Vercel Crons).
 */
export async function GET(request: Request): Promise<Response> {
  try {
    authorizeCronOrVercel(request);
    const url = new URL(request.url);
    const limitRaw = url.searchParams.get('limit');
    const limit = limitRaw ? parseInt(limitRaw, 10) : undefined;
    const result = await runScheduledPublishJobs({
      limit: Number.isFinite(limit ?? NaN) ? limit : undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

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

/**
 * Auth pour les invocations cron Vercel : accepte soit le Bearer
 * `CRON_SECRET` (manuel ou autre source), soit le header `x-vercel-cron`
 * set automatiquement par Vercel sur ses crons.
 */
function authorizeCronOrVercel(request: Request): void {
  // Header Vercel signal d'invocation cron interne
  if (request.headers.get('x-vercel-cron') === '1') return;
  // Bearer secret manuel
  const auth = request.headers.get('authorization');
  const expected = env.CRON_SECRET ? `Bearer ${env.CRON_SECRET}` : null;
  if (!expected || auth !== expected) {
    throw new HttpError('unauthorized', 'Bearer ou header Vercel manquant');
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
