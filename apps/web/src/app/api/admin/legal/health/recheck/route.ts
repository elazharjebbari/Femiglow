import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { env } from '@/lib/env';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import {
  checkLinkOverHttp,
  classifyLink,
  gatherPlacementsToCheck,
  recordSnapshots,
} from '@/lib/legal/link-verifier';
import { enforceLegalRateLimit, HEALTH_RECHECK_LIMITS } from '@/lib/legal/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    const rl = await enforceLegalRateLimit('health-recheck', session.adminId, HEALTH_RECHECK_LIMITS);
    if (!rl.ok) return rl.response;

    const targets = await gatherPlacementsToCheck();
    if (targets.length === 0) {
      return NextResponse.json({ ok: true, checked: 0, notes: 'no placements' });
    }

    const baseUrl = env.NEXT_PUBLIC_SITE_URL;
    const results = await Promise.all(
      targets.map((t) => (baseUrl ? checkLinkOverHttp(baseUrl, t) : classifyLink(t))),
    );
    const inserted = await recordSnapshots(results);

    return NextResponse.json({ ok: true, checked: results.length, inserted });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
