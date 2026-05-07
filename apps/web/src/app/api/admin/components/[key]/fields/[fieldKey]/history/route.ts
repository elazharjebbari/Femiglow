/**
 * GET /api/admin/components/[key]/fields/[fieldKey]/history
 *
 * Liste les entrées history d'un champ (ordre desc par createdAt). Utilisé
 * par la timeline admin (P11) et le diff/restore.
 *
 * Cf. docs/components-cms/backend/01-api-routes.md §B1.7.
 */
import { NextResponse } from 'next/server';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import {
  requireAdminApi,
  requireComponentAndField,
} from '@/lib/components/fields/route-helpers';
import { listHistory } from '@/lib/db/queries/component-fields';
import { fieldHistoryQuerySchema } from '@/lib/schemas/admin/component-fields';
import { decodeValue } from '@/lib/components/fields/encoding';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx {
  params: { key: string; fieldKey: string };
}

export async function GET(request: Request, ctx: Ctx): Promise<Response> {
  try {
    await requireAdminApi();
    const { component, field } = await requireComponentAndField(
      ctx.params.key,
      ctx.params.fieldKey,
    );
    const url = new URL(request.url);
    const parsed = fieldHistoryQuerySchema.safeParse({
      limit: url.searchParams.get('limit') ?? undefined,
      before: url.searchParams.get('before') ?? undefined,
      locale: url.searchParams.get('locale') ?? undefined,
    });
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Query invalide', parsed.error.flatten());
    }
    const locale = parsed.data.locale ?? 'fr';
    const limit = parsed.data.limit ?? 20;

    let entries = await listHistory(component.id, field.key, locale, limit + 1);
    if (parsed.data.before) {
      const cutoff = new Date(parsed.data.before).getTime();
      entries = entries.filter((e) => e.createdAt.getTime() < cutoff);
    }
    const hasMore = entries.length > limit;
    const page = entries.slice(0, limit);

    return NextResponse.json({
      entries: page.map((e) => ({
        id: e.id,
        version: e.version,
        value: decodeValue(e.value, field.type),
        status: e.status,
        action: e.action,
        actorId: e.actorId,
        notes: e.notes,
        createdAt: e.createdAt.toISOString(),
      })),
      nextCursor: hasMore ? page[page.length - 1]!.createdAt.toISOString() : null,
    });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
