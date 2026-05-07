/**
 * GET /api/admin/components/[key]/fields
 *
 * Liste les champs éditoriaux d'un composant (registre) avec pour chacun
 * la valeur publiée (si binding existe) et la valeur draft (si edition
 * en cours). Décodage jsonb → JS via `decodeValue`.
 *
 * Cf. docs/components-cms/backend/01-api-routes.md §B1.1.
 */
import { NextResponse } from 'next/server';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { requireAdminApi } from '@/lib/components/fields/route-helpers';
import { getDraftBinding, getPublishedBinding } from '@/lib/db/queries/component-fields';
import { getSiteComponentByKey } from '@/lib/db/queries/site-components';
import { decodeValue } from '@/lib/components/fields/encoding';
import { fieldsListQuerySchema } from '@/lib/schemas/admin/component-fields';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx {
  params: { key: string };
}

export async function GET(request: Request, ctx: Ctx): Promise<Response> {
  try {
    await requireAdminApi();
    const url = new URL(request.url);
    const parsed = fieldsListQuerySchema.safeParse({
      locale: url.searchParams.get('locale') ?? undefined,
    });
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Query invalide', parsed.error.flatten());
    }
    const locale = parsed.data.locale ?? 'fr';
    const cmp = await getSiteComponentByKey(ctx.params.key);
    if (!cmp) throw new HttpError('not_found', 'Composant introuvable');

    const fields = await Promise.all(
      (cmp.fields ?? []).map(async (def) => {
        const [pub, draft] = await Promise.all([
          getPublishedBinding(cmp.id, def.key, locale),
          getDraftBinding(cmp.id, def.key, locale),
        ]);
        return {
          key: def.key,
          label: def.label,
          type: def.type,
          required: def.required,
          ...(def.description !== undefined ? { description: def.description } : {}),
          ...(def.group !== undefined ? { group: def.group } : {}),
          ...(def.config !== undefined ? { config: def.config } : {}),
          ...(def.defaultValue !== undefined ? { defaultValue: def.defaultValue } : {}),
          published: pub
            ? {
                id: pub.id,
                value: decodeValue(pub.value, def.type),
                version: pub.version,
                publishedAt: pub.publishedAt?.toISOString() ?? null,
                updatedAt: pub.updatedAt.toISOString(),
                authorId: pub.authorId,
              }
            : null,
          draft: draft
            ? {
                id: draft.id,
                value: decodeValue(draft.value, def.type),
                version: draft.version,
                updatedAt: draft.updatedAt.toISOString(),
                authorId: draft.authorId,
              }
            : null,
        };
      }),
    );

    return NextResponse.json({
      componentKey: cmp.key,
      locale,
      fields,
    });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
