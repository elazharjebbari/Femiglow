/**
 * POST /api/admin/reset/preflight
 * → 200 { plan, impact, warnings, lock }
 *
 * Lecture seule : valide le ResetConfig, génère le plan, lit les row counts
 * actuels et renvoie le tout pour l'UI Preview.
 */
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { safeParseResetConfig, makePlan, getLockInfo } from '@/lib/reset';
import { runAuditCounts } from '@/lib/reset/phases/audit-counts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const session = await getAdminSession();
  if (!session) return new Response('Unauthorized', { status: 401 });

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

  const plan = makePlan(parsed.config);
  const lock = getLockInfo();

  // run audit counts inline (best-effort)
  let counts: Record<string, number> = {};
  try {
    const r = await runAuditCounts({
      config: parsed.config, plan, signal: new AbortController().signal,
    });
    counts = (r.stats?.counts as Record<string, number>) ?? {};
  } catch {
    // ignore
  }

  return NextResponse.json({
    plan,
    rowCounts: counts,
    lock,
    warnings: lock ? ['Un reset est déjà en cours (lock pris)'] : [],
  });
}
