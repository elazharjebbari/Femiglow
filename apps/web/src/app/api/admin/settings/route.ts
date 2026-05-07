/**
 * GET /api/admin/settings
 * Retourne toutes les sections résolues (NAV, flags, RBAC, branding) avec leur meta.
 * cf. docs/admin-config/backend/02-zod-validation.md
 */
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { getAppConfig } from '@/lib/admin-config/resolve';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const resolved = await getAppConfig();
    return NextResponse.json(resolved);
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
