/**
 * POST /api/admin/reset/run
 * → 202 { jobId, plan, etaMs }
 *
 * Valide config, vérifie auth + lock, démarre l'orchestration en
 * fire-and-forget, retourne le jobId. Client suit ensuite via SSE.
 */
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import {
  safeParseResetConfig, makePlan, startReset,
  LockHeldError, ResetError,
} from '@/lib/reset';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// rate-limit naïf (in-memory) : 1 reset / 60s / admin
const LAST_RUN_BY_ADMIN = new Map<string, number>();
const RATE_LIMIT_MS = 60_000;

export async function POST(request: Request): Promise<Response> {
  const session = await getAdminSession();
  if (!session) return new Response('Unauthorized', { status: 401 });

  const last = LAST_RUN_BY_ADMIN.get(session.adminId) ?? 0;
  if (Date.now() - last < RATE_LIMIT_MS) {
    return NextResponse.json(
      { error: { code: 'RATE_LIMIT_EXCEEDED', message: `Patiente ${Math.ceil((RATE_LIMIT_MS - (Date.now() - last)) / 1000)} s` } },
      { status: 429 },
    );
  }

  let raw: unknown = {};
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: { code: 'invalid_json' } }, { status: 400 });
  }

  const parsed = safeParseResetConfig({ ...(raw as object), actorId: session.adminId });
  if (!parsed.ok) {
    return NextResponse.json(
      { error: { code: 'CONFIG_INVALID', issues: parsed.errors } },
      { status: 400 },
    );
  }

  try {
    const plan = makePlan(parsed.config);
    const started = startReset({ config: parsed.config, plan });
    LAST_RUN_BY_ADMIN.set(session.adminId, Date.now());
    return NextResponse.json({
      jobId: started.jobId,
      plan: started.plan,
      etaMs: started.plan.totalEtaMs,
    }, { status: 202 });
  } catch (err) {
    if (err instanceof LockHeldError) {
      return NextResponse.json(
        { error: { code: 'LOCK_HELD', info: err.info, message: err.message } },
        { status: 409 },
      );
    }
    if (err instanceof ResetError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: 500 },
      );
    }
    throw err;
  }
}
