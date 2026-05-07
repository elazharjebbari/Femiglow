/**
 * POST /api/admin/components/[key]/fields/[fieldKey]/schedule
 *
 * Programme la publication d'un draft pour un instant futur. Le cron
 * `/api/cron/promote-scheduled-fields` se chargera de la promotion (B1.8).
 *
 * Cf. docs/components-cms/backend/01-api-routes.md §B1.4.
 */
import { NextResponse } from 'next/server';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import {
  auditFieldChange,
  requireAdminApi,
  requireComponentAndField,
} from '@/lib/components/fields/route-helpers';
import {
  ConflictError,
  NotFoundError,
  getDraftBinding,
  scheduleBinding,
} from '@/lib/db/queries/component-fields';
import { fieldScheduleSchema } from '@/lib/schemas/admin/component-fields';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx {
  params: { key: string; fieldKey: string };
}

export async function POST(request: Request, ctx: Ctx): Promise<Response> {
  try {
    const session = await requireAdminApi();
    const { component, field } = await requireComponentAndField(
      ctx.params.key,
      ctx.params.fieldKey,
    );

    const json = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = fieldScheduleSchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Payload invalide', parsed.error.flatten());
    }
    const scheduledAt = new Date(parsed.data.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new HttpError('invalid_input', 'scheduledAt non parsable');
    }
    const url = new URL(request.url);
    const locale = url.searchParams.get('locale') ?? 'fr';

    const draft = await getDraftBinding(component.id, field.key, locale);
    if (!draft) throw new HttpError('not_found', 'Aucun draft à programmer');

    try {
      const binding = await scheduleBinding({
        bindingId: draft.id,
        scheduledAt,
        actorId: session.adminId,
      });
      await auditFieldChange({
        action: 'field.schedule',
        actorId: session.adminId,
        componentKey: component.key,
        fieldKey: field.key,
        bindingId: binding.id,
        meta: { locale, scheduledAt: scheduledAt.toISOString() },
      });
      return NextResponse.json({ binding });
    } catch (err) {
      if (err instanceof Error && err.message === 'schedule.in_past') {
        throw new HttpError(
          'schedule_in_past',
          'La date de publication doit être dans le futur (au moins +1 minute).',
        );
      }
      if (err instanceof ConflictError) {
        throw new HttpError('version_conflict', 'Une autre modification a eu lieu');
      }
      if (err instanceof NotFoundError) throw new HttpError('not_found', err.message);
      throw err;
    }
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
