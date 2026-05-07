/**
 * POST /api/admin/components/[key]/fields/[fieldKey]/cancel-schedule
 *
 * Bascule un binding `scheduled` → `draft`. Le draft conserve sa valeur,
 * seul le `scheduledAt` est nettoyé.
 *
 * Cf. docs/components-cms/backend/01-api-routes.md §B1.5.
 */
import { NextResponse } from 'next/server';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import {
  auditFieldChange,
  requireAdminApi,
  requireComponentAndField,
} from '@/lib/components/fields/route-helpers';
import {
  NotFoundError,
  cancelSchedule,
  getBindingByStatus,
} from '@/lib/db/queries/component-fields';

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
    const url = new URL(request.url);
    const locale = url.searchParams.get('locale') ?? 'fr';

    const scheduled = await getBindingByStatus(component.id, field.key, locale, 'scheduled');
    if (!scheduled) throw new HttpError('not_found', 'Aucune publication programmée à annuler');

    try {
      const binding = await cancelSchedule(scheduled.id, session.adminId);
      await auditFieldChange({
        action: 'field.cancel_schedule',
        actorId: session.adminId,
        componentKey: component.key,
        fieldKey: field.key,
        bindingId: binding.id,
        meta: { locale },
      });
      return NextResponse.json({ binding });
    } catch (err) {
      if (err instanceof NotFoundError) throw new HttpError('not_found', err.message);
      throw err;
    }
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
