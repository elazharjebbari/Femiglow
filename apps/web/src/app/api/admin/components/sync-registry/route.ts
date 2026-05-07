/**
 * POST /api/admin/components/sync-registry
 *   Synchronise les composants & profils d'animation depuis le registre TS.
 *   N'ingère pas de Media — utiliser /seed-from-docs pour ça.
 */
import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import {
  syncAnimationRegistry,
  syncComponentRegistry,
  syncDefaultAnimationBindings,
} from '@/lib/components/seed-pipeline';
import { auditTrackingChange } from '@/lib/tracking/server/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const components = await syncComponentRegistry();
    const animations = await syncAnimationRegistry();
    const animationBindings = await syncDefaultAnimationBindings();
    await auditTrackingChange({
      action: 'sync',
      resource: 'site_component',
      actorId: session.adminId,
      meta: { components, animations, animationBindings },
    });
    revalidateTag('components');
    return NextResponse.json({ components, animations, animationBindings });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
