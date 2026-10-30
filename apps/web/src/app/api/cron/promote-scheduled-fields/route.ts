/**
 * GET/POST /api/cron/promote-scheduled-fields
 *
 * Promeut tous les bindings `scheduled` dont `scheduledAt <= now()` au
 * statut `published`. Idempotent : si la promotion échoue (validation,
 * conflit), le binding reste `scheduled` et un retry est attempté au tick
 * suivant.
 *
 * Promeut aussi les ensembles « médias par audience » programmés
 * (`promoteDueMediaSets`) et invalide `components:media-sets:<key>` pour
 * chaque composant touché — section `mediaSets` de la réponse. Une panne
 * des ensembles n'empêche jamais la promotion des champs.
 *
 * Auth : `Authorization: Bearer <CRON_SECRET>` (tourne sans user admin).
 *
 * Cf. docs/components-cms/backend/01-api-routes.md §B1.8.
 */
import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { env } from '@/lib/env';
import { logger } from '@/lib/logging/logger';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { ConflictError, listScheduledDue, publishBinding } from '@/lib/db/queries/component-fields';
import { getSiteComponentById } from '@/lib/db/queries/site-components';
import { logAuditEvent } from '@/lib/audit/log-event';
import { promoteDueMediaSetsSafely } from '@/lib/components/media-variants/promote.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface PromotedItem {
  componentKey: string;
  fieldKey: string;
  fromVersion: number | null;
  toVersion: number;
}
interface FailedItem {
  componentKey: string;
  fieldKey: string;
  error: string;
}

async function handle(request: Request): Promise<Response> {
  try {
    const auth = request.headers.get('authorization');
    const expected = env.CRON_SECRET ? `Bearer ${env.CRON_SECRET}` : null;
    if (!expected || auth !== expected) {
      throw new HttpError('unauthorized', 'Bearer manquant ou invalide');
    }
    const start = Date.now();

    const promoted: PromotedItem[] = [];
    const failed: FailedItem[] = [];
    // Bloc « champs » isolé : une panne ici (lecture, composant, revalidate)
    // ne doit pas empêcher la promotion des ensembles de médias ci-dessous.
    let fieldsError: unknown = null;
    try {
      const due = await listScheduledDue(new Date());
      const componentsTouched = new Set<string>();
      const componentLocales = new Set<string>(); // `${key}:${locale}`

      for (const binding of due) {
        const cmp = await getSiteComponentById(binding.componentId);
        const componentKey = cmp?.key ?? '?';
        try {
          const fromVersion = binding.version;
          const result = await publishBinding({
            bindingId: binding.id,
            actorId: null,
          });
          promoted.push({
            componentKey,
            fieldKey: binding.fieldKey,
            fromVersion,
            toVersion: result.version,
          });
          componentsTouched.add(componentKey);
          componentLocales.add(`${componentKey}:${binding.locale}`);
          await logAuditEvent({
            action: 'field.publish.scheduled',
            actorId: null,
            resourceType: 'component_field_binding',
            resourceId: result.id,
            meta: {
              componentKey,
              fieldKey: binding.fieldKey,
              locale: binding.locale,
              fromVersion,
              toVersion: result.version,
            },
          });
        } catch (err) {
          const code =
            err instanceof ConflictError
              ? 'version_conflict'
              : err instanceof Error
                ? err.message
                : 'unknown';
          failed.push({ componentKey, fieldKey: binding.fieldKey, error: code });
          logger.error('cron.promote_scheduled_fields.failed', {
            binding_id: binding.id,
            component_key: componentKey,
            field_key: binding.fieldKey,
            error: code,
          });
        }
      }

      // Une seule passe d'invalidation à la fin pour économiser les calls.
      if (componentsTouched.size > 0) {
        revalidateTag('components');
        for (const key of componentsTouched) {
          revalidateTag(`components:fields:${key}`);
        }
        for (const tag of componentLocales) {
          const [key, locale] = tag.split(':');
          revalidateTag(`components:fields:${key}:${locale}`);
        }
      }
    } catch (err) {
      fieldsError = err;
      logger.error('cron.promote_scheduled_fields.crashed', {
        error: err instanceof Error ? err.message : String(err),
        trigger: 'cron',
      });
    }

    // Ensembles « médias par audience » programmés : toujours exécutés,
    // même si le bloc champs a échoué, et sans jamais lever
    // (cf. `promoteDueMediaSetsSafely`).
    const mediaSets = await promoteDueMediaSetsSafely({ trigger: 'cron', actorId: null });

    const durationMs = Date.now() - start;
    logger.info('cron.promote_scheduled_fields.completed', {
      promoted: promoted.length,
      failed: failed.length,
      fields_crashed: fieldsError !== null,
      media_sets_promoted: mediaSets.promoted.length,
      media_sets_failed: mediaSets.failed.length + (mediaSets.error ? 1 : 0),
      duration_ms: durationMs,
    });

    if (fieldsError) {
      // 500 pour que la supervision du cron voie la panne, avec le détail
      // de ce qui a malgré tout été promu (ensembles de médias).
      return NextResponse.json(
        {
          error: { code: 'internal_error', message: 'Promotion des champs interrompue' },
          promoted,
          failed,
          mediaSets,
          durationMs,
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ promoted, failed, mediaSets, durationMs });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function GET(request: Request): Promise<Response> {
  return handle(request);
}
export async function POST(request: Request): Promise<Response> {
  return handle(request);
}
