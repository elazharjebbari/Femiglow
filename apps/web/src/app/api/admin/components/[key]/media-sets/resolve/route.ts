/**
 * GET /api/admin/components/[key]/media-sets/resolve?locale=&angle=&draft=1
 *
 * Diagnostic : pour un contexte d'audience simulé, renvoie par slot le
 * niveau de repli atteint (1–6 ensemble, 7 délégué aux liaisons legacy /
 * produit), l'ensemble retenu, les images et la valeur de tracking
 * `hero_media_variant` — via `resolveComponentMediaSlots`, exactement le
 * chemin du rendu public.
 *
 *  - Chaque dimension de la politique se passe sous son propre nom
 *    (`angle=e`, `ab:<exp>=b`) ; absente, vide ou `*` = pas de valeur.
 *  - `draft=1` : aperçu brouillon (brouillon > publié, sans cache) —
 *    réservé aux admins, ce que la route garantit déjà.
 *  - Sans `draft` : lecture publique CACHÉE, c'est-à-dire ce que voit
 *    réellement une visiteuse à cet instant (utile pour vérifier une
 *    invalidation).
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
import {
  mediaVariantTrackingValue,
  resolveComponentMediaSlots,
  traceTrackingValue,
} from '@/lib/components/media-variants/resolve.server';
import { WILDCARD, isValidVariantKey } from '@/lib/components/media-variants/dimensions';
import { mediaSetResolveQuerySchema, pickSearchParams } from '@/lib/schemas/admin/media-sets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx {
  params: { key: string };
}

export async function GET(request: Request, ctx: Ctx): Promise<Response> {
  try {
    await requireAdminApi();
    const { component, policy } = await requireMediaVariantsComponent(ctx.params.key);

    const url = new URL(request.url);
    const parsed = mediaSetResolveQuerySchema.safeParse(
      pickSearchParams(url, ['locale', 'draft'] as const),
    );
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Query invalide', parsed.error.flatten());
    }
    const { locale, draft } = parsed.data;

    const variants: Record<string, string | null> = {};
    for (const dim of policy.dimensions) {
      const raw = url.searchParams.get(dim)?.trim() ?? '';
      if (raw === '' || raw === WILDCARD) {
        variants[dim] = null;
        continue;
      }
      if (raw.length > 64 || !isValidVariantKey(dim, raw)) {
        throw new HttpError('invalid_input', `Valeur invalide pour « ${dim} » : ${raw.slice(0, 64)}`);
      }
      variants[dim] = raw;
    }

    const { slots, traces } = await resolveComponentMediaSlots(
      component.key,
      { locale, variants },
      { draft },
    );

    return NextResponse.json({
      componentKey: component.key,
      context: { locale, variants, draft },
      trackingValue: mediaVariantTrackingValue(traces),
      slots: policy.slots.map((slotPolicy) => {
        const trace = traces[slotPolicy.key] ?? null;
        const images = slots[slotPolicy.key] ?? null;
        return {
          slot: slotPolicy.key,
          level: trace?.level ?? 7,
          delegated: images === null,
          trace,
          trackingValue: traceTrackingValue(trace),
          images: images?.map((img) => ({
            id: img.id,
            src: img.src,
            width: img.width,
            height: img.height,
            alt: img.alt,
            mobile: img.mobile ? { src: img.mobile.src } : null,
          })) ?? null,
        };
      }),
    });
  } catch (err) {
    return mediaSetErrorResponse(err, 'GET media-sets/resolve');
  }
}
