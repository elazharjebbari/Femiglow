/**
 * LEGAL-V2 — DELETE /api/admin/legal/cleanup-e2e
 *
 * Supprime les pages test E2E orphelines (slug LIKE 'e2e-test-%').
 *
 * Body :
 *   {
 *     "dryRun": true | false,
 *     "olderThanDays": 7
 *   }
 *
 * Cf. docs/pages-legales-fix-2026-05/02-backend/api-routes.md
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logLegalEvent } from '@/lib/legal/audit';
import { cleanupLegalE2E } from '@/lib/legal/cleanup';
import { requireSameOrigin } from '@/lib/legal/csrf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const inputSchema = z.object({
  dryRun: z.boolean().default(true),
  olderThanDays: z.number().int().min(7).max(365).default(7),
});

export async function DELETE(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    requireSameOrigin(request);

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      payload = {}; // accepter body vide pour défauts
    }
    const parsed = inputSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'validation_failed', details: parsed.error.issues } },
        { status: 400 },
      );
    }

    const result = await cleanupLegalE2E(parsed.data);
    await logLegalEvent('legal.cleanup.e2e', session.adminId, null, {
      candidates: result.candidates,
      deleted: result.deleted,
      dry_run: result.dryRun,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
