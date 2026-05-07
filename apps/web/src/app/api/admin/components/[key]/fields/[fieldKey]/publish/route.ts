/**
 * POST /api/admin/components/[key]/fields/[fieldKey]/publish
 *
 * Promeut le `draft` courant → `published`. L'ancien `published` (s'il
 * existait) bascule en `archived`. Audit + revalidateTag pour les
 * consommateurs RSC.
 *
 * Cf. docs/components-cms/backend/01-api-routes.md §B1.3.
 */
import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
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
  getPublishedBinding,
  publishBinding,
} from '@/lib/db/queries/component-fields';
import { fieldPublishSchema } from '@/lib/schemas/admin/component-fields';

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
    const parsed = fieldPublishSchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Payload invalide', parsed.error.flatten());
    }
    const url = new URL(request.url);
    const locale = url.searchParams.get('locale') ?? 'fr';

    const draft = await getDraftBinding(component.id, field.key, locale);
    if (!draft) {
      throw new HttpError('not_found', 'Aucun draft à publier');
    }

    const ifMatchHeader = request.headers.get('if-match');
    const expectedUpdatedAt = ifMatchHeader ? new Date(ifMatchHeader) : null;
    if (ifMatchHeader && Number.isNaN(expectedUpdatedAt!.getTime())) {
      throw new HttpError('invalid_input', 'If-Match non parsable');
    }

    const previous = await getPublishedBinding(component.id, field.key, locale);

    try {
      const binding = await publishBinding({
        bindingId: draft.id,
        actorId: session.adminId,
        ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}),
      });

      await auditFieldChange({
        action: 'field.publish',
        actorId: session.adminId,
        componentKey: component.key,
        fieldKey: field.key,
        bindingId: binding.id,
        meta: {
          locale,
          version: binding.version,
          previousPublishedId: previous?.id ?? null,
          notes: parsed.data.notes ?? null,
        },
      });

      // Le rendu public dépend du published binding → invalider le cache
      // ciblé pour refléter la nouvelle valeur sans relancer un build.
      revalidateTag('components');
      revalidateTag(`components:fields:${component.key}`);
      revalidateTag(`components:fields:${component.key}:${locale}`);

      return NextResponse.json({
        binding,
        previousPublishedId: previous?.id ?? null,
      });
    } catch (err) {
      if (err instanceof ConflictError) {
        throw new HttpError('version_conflict', 'Une autre modification a eu lieu', {
          remoteUpdatedAt: err.binding.updatedAt.toISOString(),
        });
      }
      if (err instanceof NotFoundError) {
        throw new HttpError('not_found', err.message);
      }
      throw err;
    }
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
