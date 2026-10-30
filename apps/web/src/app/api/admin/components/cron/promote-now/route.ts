/**
 * POST /api/admin/components/cron/promote-now
 *
 * Déclenche manuellement la promotion des bindings programmés dont le
 * `scheduledAt` est passé. Réservé aux admins (auth session).
 *
 * Pratique pour le runbook (R5) ou pour rattraper un cron en panne.
 * Promeut aussi les ensembles « médias par audience » échus (section
 * `mediaSets` de la réponse, cf. `promoteDueMediaSetsSafely`).
 *
 * Cf. docs/components-cms/action-plan/01-phases.md §P10.
 */
import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { logger } from '@/lib/logging/logger';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { requireAdminApi } from '@/lib/components/fields/route-helpers';
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

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await requireAdminApi();
    void request; // POST sans body
    const start = Date.now();

    const promoted: PromotedItem[] = [];
    const failed: FailedItem[] = [];
    // Bloc « champs » isolé : une panne ici (lecture, composant, revalidate)
    // ne doit pas empêcher la promotion des ensembles de médias ci-dessous.
    let fieldsError: unknown = null;
    try {
      const due = await listScheduledDue(new Date());
      const componentsTouched = new Set<string>();
      const componentLocales = new Set<string>();

      for (const binding of due) {
        const cmp = await getSiteComponentById(binding.componentId);
        const componentKey = cmp?.key ?? '?';
        try {
          const fromVersion = binding.version;
          const result = await publishBinding({
            bindingId: binding.id,
            actorId: session.adminId,
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
            actorId: session.adminId,
            resourceType: 'component_field_binding',
            resourceId: result.id,
            meta: {
              componentKey,
              fieldKey: binding.fieldKey,
              locale: binding.locale,
              fromVersion,
              toVersion: result.version,
              trigger: 'manual',
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
            trigger: 'manual',
          });
        }
      }

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
        trigger: 'manual',
      });
    }

    // Ensembles « médias par audience » programmés : toujours exécutés,
    // même si le bloc champs a échoué, et sans jamais lever
    // (cf. `promoteDueMediaSetsSafely`).
    const mediaSets = await promoteDueMediaSetsSafely({
      trigger: 'manual',
      actorId: session.adminId,
    });

    const durationMs = Date.now() - start;
    logger.info('cron.promote_scheduled_fields.completed', {
      promoted: promoted.length,
      failed: failed.length,
      fields_crashed: fieldsError !== null,
      media_sets_promoted: mediaSets.promoted.length,
      media_sets_failed: mediaSets.failed.length + (mediaSets.error ? 1 : 0),
      duration_ms: durationMs,
      trigger: 'manual',
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
