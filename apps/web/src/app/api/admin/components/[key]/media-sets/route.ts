/**
 * GET /api/admin/components/[key]/media-sets
 *
 * Liste les ensembles « médias par audience » d'un composant (matrice
 * admin) avec leurs items, vignettes et état des médias, plus :
 *  - la politique du composant (slots, dimensions) et les valeurs connues
 *    de chaque dimension ;
 *  - la couverture : pour chaque valeur de dimension × langue × slot, le
 *    niveau de repli et l'ensemble PUBLIÉ qui serait servi — calculés avec
 *    `selectMediaSet`, la même fonction que le rendu public ;
 *  - `stuckScheduled` : programmations échues que le cron ne peut pas
 *    publier (média supprimé ou pas prêt, ensemble vide) ou en retard
 *    anormal (cron arrêté ?).
 *
 * Filtres (query) : `status` (draft|published|scheduled|archived|all ;
 * défaut = tout sauf archivé — filtré en base), `slot`, `variantDim`,
 * `variantKey`, `locale` (tous appliqués en base). Avec `status=archived|all`, pagination
 * `limit` (≤ 500, défaut 100) / `offset` — les archivés s'accumulent à
 * chaque publication. Les filtres ne s'appliquent qu'à `sets`.
 *
 * cf. docs/hero-media-par-angle/05-architecture-technique.md §4.7
 */
import { NextResponse } from 'next/server';
import { HttpError } from '@/lib/errors/http-error';
import {
  enrichSetsForAdmin,
  mediaSetErrorResponse,
  requireAdminApi,
  requireMediaVariantsComponent,
} from '@/lib/components/media-variants/route-helpers';
import {
  listPublishedSetsWithMedia,
  listSetsByComponent,
} from '@/lib/db/queries/component-media-sets';
import { computeMediaSetCoverage } from '@/lib/components/media-variants/coverage';
import { toMediaSetDTOs } from '@/lib/components/media-variants/dto';
import { getDimension } from '@/lib/components/media-variants/dimensions';
import { MEDIA_SET_LOCALES } from '@/lib/components/media-variants/policy';
import { mediaSetListQuerySchema, pickSearchParams } from '@/lib/schemas/admin/media-sets';
import type { FieldBindingStatus } from '@/lib/db/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Au-delà, une programmation échue sans blocage connu est « en retard » (cron arrêté ?). */
const OVERDUE_AFTER_MS = 15 * 60_000;

const LIVE: FieldBindingStatus[] = ['draft', 'published', 'scheduled'];

interface Ctx {
  params: { key: string };
}

export async function GET(request: Request, ctx: Ctx): Promise<Response> {
  try {
    await requireAdminApi();
    const { component, policy } = await requireMediaVariantsComponent(ctx.params.key);

    const url = new URL(request.url);
    const parsed = mediaSetListQuerySchema.safeParse(
      pickSearchParams(url, [
        'status',
        'slot',
        'variantDim',
        'variantKey',
        'locale',
        'limit',
        'offset',
      ] as const),
    );
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Query invalide', parsed.error.flatten());
    }
    const q = parsed.data;

    // Statuts filtrés en base ; pagination seulement quand les archivés
    // (non bornés) sont demandés.
    const statuses: FieldBindingStatus[] =
      q.status === 'all' ? [...LIVE, 'archived'] : q.status ? [q.status] : LIVE;
    const paginate = q.status === 'archived' || q.status === 'all';

    const [page, scheduled, published] = await Promise.all([
      listSetsByComponent(component.id, {
        statuses,
        ...(q.slot ? { slot: q.slot } : {}),
        ...(q.variantDim ? { variantDim: q.variantDim } : {}),
        ...(q.variantKey ? { variantKey: q.variantKey } : {}),
        ...(q.locale ? { locale: q.locale } : {}),
        ...(paginate ? { limit: q.limit + 1, offset: q.offset } : {}),
      }),
      listSetsByComponent(component.id, { statuses: ['scheduled'] }),
      listPublishedSetsWithMedia(component.id),
    ]);
    const hasMore = paginate && page.length > q.limit;
    const filtered = hasMore ? page.slice(0, q.limit) : page;

    const now = Date.now();
    const due = scheduled.filter((s) => s.scheduledAt && new Date(s.scheduledAt).getTime() <= now);
    const [sets, dueEnriched] = await Promise.all([enrichSetsForAdmin(filtered), enrichSetsForAdmin(due)]);
    const stuckScheduled = dueEnriched.flatMap((s) => {
      const overdueMs = now - new Date(s.scheduledAt!).getTime();
      const reason =
        s.items.length === 0 || s.hasUnavailableMedia
          ? ('media_unavailable' as const)
          : overdueMs > OVERDUE_AFTER_MS
            ? ('overdue' as const)
            : null;
      if (!reason) return [];
      return [
        {
          setId: s.id,
          slot: s.slot,
          variantDim: s.variantDim,
          variantKey: s.variantKey,
          locale: s.locale,
          scheduledAt: new Date(s.scheduledAt!).toISOString(),
          reason,
          unavailableMediaIds: s.items.flatMap((i) =>
            [i.media, i.mobileMedia].filter((m) => m && m.state !== 'ok').map((m) => m!.id),
          ),
        },
      ];
    });

    // Lecture directe (sans cache) : l'admin voit l'état réel de la base,
    // même dans la fenêtre où le cache public n'est pas encore invalidé.
    const coverage = computeMediaSetCoverage(toMediaSetDTOs(published), policy);

    return NextResponse.json({
      componentKey: component.key,
      policy,
      dimensions: policy.dimensions.map((id) => {
        const dim = getDimension(id);
        return { id, label: dim?.label ?? id, values: dim?.values ?? null };
      }),
      locales: MEDIA_SET_LOCALES,
      sets,
      page: paginate ? { limit: q.limit, offset: q.offset, hasMore } : null,
      stuckScheduled,
      coverage,
    });
  } catch (err) {
    return mediaSetErrorResponse(err, 'GET media-sets');
  }
}
