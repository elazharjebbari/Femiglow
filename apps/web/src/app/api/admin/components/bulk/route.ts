/**
 * POST /api/admin/components/bulk
 *
 * Opérations groupées au **niveau composant** (à ne pas confondre avec
 * `/api/admin/components/bindings/bulk` qui agit sur des binding-IDs).
 *
 *   Body : {
 *     action: 'activate-bindings' | 'deactivate-bindings' | 'publish-drafts',
 *     componentIds: string[],   // 1..200
 *     locale?: string,          // défaut 'fr' (utilisé pour publish-drafts)
 *   }
 *
 *   - `activate-bindings` / `deactivate-bindings` : (dés)active tous les
 *     `componentMediaBindings` rattachés aux composants ciblés.
 *   - `publish-drafts` : promeut tous les drafts de champs (locale donnée)
 *     des composants ciblés en `published`. Les erreurs individuelles
 *     n'aborte pas le batch (best-effort).
 *
 * Retour : `{ ok: true, affected: { components, bindings?, fields? }, summary?: ... }`
 *
 * Sécurité :
 *   - admin session requise,
 *   - rate-limit 30 / 5 min / IP.
 *
 * Cache : `revalidateTag('components')` en fin (+ tags de champs si publish).
 */
import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { checkRateLimit } from '@/lib/rate-limit/check';
import { componentBulkSchema } from '@/lib/schemas/admin/components';
import { getSiteComponentById } from '@/lib/db/queries/site-components';
import {
  bulkSetActive,
  listBindingsByComponent,
} from '@/lib/db/queries/component-bindings';
import {
  listBindingsByComponent as listFieldBindingsByComponent,
  publishBinding,
} from '@/lib/db/queries/component-fields';
import { auditTrackingChange } from '@/lib/tracking/server/audit';
import { logAuditEvent } from '@/lib/audit/log-event';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const rate = await checkRateLimit({
      key: `components-bulk:${ip}`,
      limit: 30,
      windowMs: 60 * 5 * 1000,
    });
    if (!rate.ok) throw new HttpError('rate_limited', 'Trop de requêtes');

    const json = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = componentBulkSchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Payload invalide', parsed.error.flatten());
    }
    const { action, componentIds } = parsed.data;
    const locale = parsed.data.locale ?? 'fr';

    // Filtrer les IDs réellement existants pour éviter une opération
    // silencieuse sur un id inconnu.
    const components = (
      await Promise.all(componentIds.map((id) => getSiteComponentById(id)))
    ).filter((c): c is NonNullable<typeof c> => !!c);

    if (components.length === 0) {
      throw new HttpError('not_found', 'Aucun composant trouvé');
    }

    if (action === 'activate-bindings' || action === 'deactivate-bindings') {
      const isActive = action === 'activate-bindings';
      // Collecter tous les binding-IDs des composants ciblés.
      const bindingIds: string[] = [];
      for (const c of components) {
        const bs = await listBindingsByComponent(c.id);
        for (const b of bs) bindingIds.push(b.id);
      }
      const count = await bulkSetActive(bindingIds, isActive);

      await auditTrackingChange({
        action: isActive ? 'bulk-activate' : 'bulk-deactivate',
        resource: 'component_media_binding',
        actorId: session.adminId,
        meta: {
          scope: 'components',
          componentIds: components.map((c) => c.id),
          bindings: count,
        },
      });
      revalidateTag('components');
      return NextResponse.json({
        ok: true,
        affected: { components: components.length, bindings: count },
      });
    }

    // action === 'publish-drafts'
    let publishedCount = 0;
    let skippedCount = 0;
    const failed: Array<{ componentKey: string; fieldKey: string; reason: string }> = [];

    for (const c of components) {
      const fieldBindings = await listFieldBindingsByComponent(c.id, locale);
      const drafts = fieldBindings.filter((b) => b.status === 'draft');
      if (drafts.length === 0) {
        skippedCount += 1;
        continue;
      }
      for (const draft of drafts) {
        try {
          const promoted = await publishBinding({
            bindingId: draft.id,
            actorId: session.adminId,
          });
          await logAuditEvent({
            action: 'field.publish',
            actorId: session.adminId,
            resourceType: 'component_field_binding',
            resourceId: promoted.id,
            meta: {
              componentKey: c.key,
              fieldKey: draft.fieldKey,
              locale,
              version: promoted.version,
              bulk: true,
            },
          });
          publishedCount += 1;
        } catch (err) {
          failed.push({
            componentKey: c.key,
            fieldKey: draft.fieldKey,
            reason: err instanceof Error ? err.message : 'Erreur inconnue',
          });
        }
      }
      revalidateTag(`components:fields:${c.key}`);
      revalidateTag(`components:fields:${c.key}:${locale}`);
    }

    revalidateTag('components');

    return NextResponse.json({
      ok: true,
      affected: { components: components.length, fields: publishedCount },
      summary: {
        published: publishedCount,
        skipped: skippedCount,
        failed: failed.length,
      },
      ...(failed.length > 0 ? { failed } : {}),
    });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
