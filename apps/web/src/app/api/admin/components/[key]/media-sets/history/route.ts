/**
 * GET /api/admin/components/[key]/media-sets/history
 *   ?slot=&variantDim=&variantKey=&locale=&limit=
 *
 * Historique d'une cellule (plus récent d'abord), chaque entrée avec
 * l'instantané de ses items et leurs vignettes — base du panneau
 * « Historique / Restaurer ». L'historique survit à l'abandon d'un
 * brouillon (pas de FK sur `set_id`).
 *
 * cf. docs/hero-media-par-angle/05-architecture-technique.md §4.7
 */
import { NextResponse } from 'next/server';
import { HttpError } from '@/lib/errors/http-error';
import {
  mediaSetErrorResponse,
  requireAdminApi,
  requireMediaVariantsComponent,
} from '@/lib/components/media-variants/route-helpers';
import { listSetHistory } from '@/lib/db/queries/component-media-sets';
import { thumbsByMediaId } from '@/lib/db/queries/media';
import {
  mediaSetHistoryQuerySchema,
  pickSearchParams,
} from '@/lib/schemas/admin/media-sets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx {
  params: { key: string };
}

export async function GET(request: Request, ctx: Ctx): Promise<Response> {
  try {
    await requireAdminApi();
    const { component } = await requireMediaVariantsComponent(ctx.params.key);
    const url = new URL(request.url);
    const parsed = mediaSetHistoryQuerySchema.safeParse(
      pickSearchParams(url, ['slot', 'variantDim', 'variantKey', 'locale', 'limit'] as const),
    );
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Query invalide', parsed.error.flatten());
    }
    const { limit, ...tuple } = parsed.data;

    const entries = await listSetHistory({ componentId: component.id, ...tuple }, limit);
    const thumbs = await thumbsByMediaId(
      Array.from(
        new Set(
          entries
            .flatMap((e) => e.items.flatMap((i) => [i.mediaId, i.mobileMediaId]))
            .filter((id): id is string => !!id),
        ),
      ),
    );

    return NextResponse.json({
      componentKey: component.key,
      tuple,
      entries: entries.map((e) => ({
        id: e.id,
        setId: e.setId,
        version: e.version,
        status: e.status,
        action: e.action,
        crossLocale: e.crossLocale,
        actorId: e.actorId,
        notes: e.notes,
        createdAt: new Date(e.createdAt).toISOString(),
        items: [...e.items]
          .sort((a, b) => a.position - b.position)
          .map((i) => ({
            ...i,
            thumbUrl: thumbs.get(i.mediaId) ?? null,
            mobileThumbUrl: i.mobileMediaId ? (thumbs.get(i.mobileMediaId) ?? null) : null,
          })),
      })),
    });
  } catch (err) {
    return mediaSetErrorResponse(err, 'GET media-sets/history');
  }
}
