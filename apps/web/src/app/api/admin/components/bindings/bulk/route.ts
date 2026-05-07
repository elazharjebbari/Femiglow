/**
 * POST /api/admin/components/bindings/bulk
 *
 * Opération groupée sur plusieurs `componentMediaBindings`.
 *
 *   Body : {
 *     action: 'activate' | 'deactivate' | 'delete' | 'update',
 *     ids: string[],            // 1..200
 *     patch?: { ...display modes / strategy }   // requis si action='update'
 *   }
 *
 * Retour : `{ ok: true, count: <bindings affectés> }`.
 *
 * Sécurité :
 *  - admin session requise,
 *  - rate-limit 30 appels / 5 min / IP (multi-sélection peut être bruyante en
 *    cas de mauvaise UX, on borne).
 *
 * Cache : un seul `revalidateTag('components')` en fin.
 */
import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { checkRateLimit } from '@/lib/rate-limit/check';
import { bindingBulkSchema } from '@/lib/schemas/admin/components';
import {
  bulkSetActive,
  bulkDelete,
  bulkUpdate,
} from '@/lib/db/queries/component-bindings';
import { auditTrackingChange } from '@/lib/tracking/server/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const rate = await checkRateLimit({
      key: `bindings-bulk:${ip}`,
      limit: 30,
      windowMs: 60 * 5 * 1000,
    });
    if (!rate.ok) throw new HttpError('rate_limited', 'Trop de requêtes');

    const json = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = bindingBulkSchema.safeParse(json);
    if (!parsed.success)
      throw new HttpError('invalid_input', 'Payload invalide', parsed.error.flatten());

    const { action, ids, patch } = parsed.data;

    let count = 0;
    switch (action) {
      case 'activate':
        count = await bulkSetActive(ids, true);
        break;
      case 'deactivate':
        count = await bulkSetActive(ids, false);
        break;
      case 'delete':
        count = await bulkDelete(ids);
        break;
      case 'update':
        if (!patch || Object.keys(patch).length === 0) {
          throw new HttpError('invalid_input', 'patch requis pour action=update');
        }
        count = await bulkUpdate(ids, patch);
        break;
    }

    await auditTrackingChange({
      action: `bulk-${action}`,
      resource: 'component_media_binding',
      actorId: session.adminId,
      meta: { count, ids: ids.length },
    });
    revalidateTag('components');

    return NextResponse.json({ ok: true, count });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
