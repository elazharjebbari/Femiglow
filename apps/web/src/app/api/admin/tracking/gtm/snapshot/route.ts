import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { gtmSnapshot } from '@/lib/tracking/gtm/snapshot';
import { auditTrackingChange } from '@/lib/tracking/server/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/tracking/gtm/snapshot
 * Force l'écriture des 4 fichiers `infra/gtm/container.<env>.json`
 * (utile post-modif catalog ou pour synchroniser sans changer l'active).
 *
 * Cf. docs/gtm/17-onboarding-robustness.md §3.4.
 */
export async function POST(): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    const result = await gtmSnapshot.writeAll();

    await auditTrackingChange({
      action: 'export_download',
      resource: 'tracking_gtm',
      resourceId: 'snapshot',
      actorId: session.adminId,
      meta: {
        snapshot: 'manual',
        envs: result.written.map((w) => w.env),
        skippedReason: result.skippedReason ?? null,
        errorsCount: result.errors.length,
      },
    });

    return NextResponse.json({
      written: result.written.map((w) => ({
        env: w.env,
        path: w.path,
        sha256: w.sha256,
        bytes: w.bytes,
        skipped: w.skipped,
      })),
      skippedReason: result.skippedReason ?? null,
      errors: result.errors,
    });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
