/**
 * POST /api/admin/components/[key]/media-sets/bulk-publish
 *
 * Publie en masse les BROUILLONS d'un composant qui correspondent au
 * filtre (`slot`, `variantDim`, `variantKey`, `locale`, `source` —
 * typiquement `source: 'import'` après `pnpm import:component-media`).
 *
 *  - `dryRun: true` : ne publie rien, liste ce qui serait publié, ce que
 *    chaque publication remplacerait (publié, programmation annulée) et
 *    les avertissements (média supprimé ou pas prêt, ensemble vide).
 *  - Sinon : chaque publication est INDÉPENDANTE (sa propre transaction,
 *    avec `expectedUpdatedAt` = l'état lu) ; un échec n'empêche pas les
 *    suivantes et est rapporté par item. Une seule invalidation de cache
 *    à la fin si au moins une publication a réussi.
 *
 * Garde-fous : même origine (403) ; filtre non vide OU `all: true` (400) ;
 * `expected` (plan revu de l'essai à blanc, `setId` + `updatedAt`) : si les
 * brouillons ont changé entre-temps, rien n'est publié (409
 * `invalid_state`, raison `bulk.plan_changed`).
 *
 * Audit : `media_set.publish` (avec `bulk: true`) par ensemble publié,
 * plus un `media_set.bulk_publish` récapitulatif — APRÈS l'invalidation,
 * et sans jamais transformer une publication réussie en échec. Les erreurs
 * internes ne sont pas renvoyées telles quelles (message générique + log).
 *
 * cf. docs/hero-media-par-angle/05-architecture-technique.md §4.7
 */
import { NextResponse } from 'next/server';
import { HttpError } from '@/lib/errors/http-error';
import {
  auditMediaSetChange,
  enrichSetsForAdmin,
  mediaSetErrorResponse,
  readJsonBody,
  requireAdminApi,
  requireMediaVariantsComponent,
  toMediaSetHttpError,
} from '@/lib/components/media-variants/route-helpers';
import { revalidateMediaSets } from '@/lib/components/media-variants/revalidate.server';
import { listSetsByComponent, publishSet } from '@/lib/db/queries/component-media-sets';
import { mediaSetBulkPublishSchema } from '@/lib/schemas/admin/media-sets';
import { requireSameOrigin } from '@/lib/legal/csrf';
import { logger } from '@/lib/logging/logger';
import type { ComponentMediaSetWithItems } from '@/lib/db/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Plafond d'ensembles traités par appel (≈ 56 cellules pour le kit). */
const BULK_LIMIT = 200;

interface Ctx {
  params: { key: string };
}

function tupleKey(s: { slot: string; variantDim: string; variantKey: string; locale: string }): string {
  return [s.slot, s.variantDim, s.variantKey, s.locale].join('\u0000');
}

function summarize(set: ComponentMediaSetWithItems) {
  return {
    setId: set.id,
    slot: set.slot,
    variantDim: set.variantDim,
    variantKey: set.variantKey,
    locale: set.locale,
    source: set.source,
    version: set.version,
    itemCount: set.items.length,
    updatedAt: new Date(set.updatedAt).toISOString(),
  };
}

export async function POST(request: Request, ctx: Ctx): Promise<Response> {
  try {
    const session = await requireAdminApi();
    requireSameOrigin(request);
    const { component } = await requireMediaVariantsComponent(ctx.params.key);

    const parsed = mediaSetBulkPublishSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Payload invalide', parsed.error.flatten());
    }
    const { filter, dryRun, all: publishAll = false, expected } = parsed.data;

    const liveSets = await listSetsByComponent(component.id);
    const matching = liveSets.filter(
      (s) =>
        s.status === 'draft' &&
        (!filter.slot || s.slot === filter.slot) &&
        (!filter.variantDim || s.variantDim === filter.variantDim) &&
        (!filter.variantKey || s.variantKey === filter.variantKey) &&
        (!filter.locale || s.locale === filter.locale) &&
        (!filter.source || s.source === filter.source),
    );
    const drafts = matching.slice(0, BULK_LIMIT);
    const truncated = matching.length > drafts.length;

    // Plan revu : on ne publie que si les brouillons sont EXACTEMENT ceux
    // de l'essai à blanc (mêmes ensembles, même `updatedAt`).
    if (!dryRun && expected) {
      const reviewed = new Map(expected.map((e) => [e.setId, Date.parse(e.updatedAt)]));
      const unchanged =
        reviewed.size === expected.length &&
        reviewed.size === drafts.length &&
        drafts.every((d) => reviewed.get(d.id) === new Date(d.updatedAt).getTime());
      if (!unchanged) {
        throw new HttpError(
          'invalid_state',
          'La liste des brouillons a changé depuis la vérification : relancez l’essai à blanc avant de publier.',
          { reason: 'bulk.plan_changed', matched: matching.length },
        );
      }
    }

    if (dryRun) {
      const byTuple = new Map<string, { published?: ComponentMediaSetWithItems; scheduled?: ComponentMediaSetWithItems }>();
      for (const s of liveSets) {
        if (s.status !== 'published' && s.status !== 'scheduled') continue;
        const entry = byTuple.get(tupleKey(s)) ?? {};
        entry[s.status] = s;
        byTuple.set(tupleKey(s), entry);
      }
      const enriched = await enrichSetsForAdmin(drafts);
      return NextResponse.json({
        dryRun: true,
        filter,
        all: publishAll,
        matched: matching.length,
        truncated,
        results: enriched.map((set, i) => {
          const others = byTuple.get(tupleKey(set)) ?? {};
          const warnings: string[] = [];
          if (set.items.length === 0) warnings.push('items.empty');
          if (set.hasUnavailableMedia) warnings.push('media.unavailable');
          return {
            ...summarize(drafts[i]!),
            replacesPublished: others.published
              ? { setId: others.published.id, version: others.published.version }
              : null,
            supersedesScheduled: others.scheduled
              ? {
                  setId: others.scheduled.id,
                  scheduledAt: others.scheduled.scheduledAt
                    ? new Date(others.scheduled.scheduledAt).toISOString()
                    : null,
                }
              : null,
            warnings,
          };
        }),
      });
    }

    const results: Array<
      ReturnType<typeof summarize> & (
        | { ok: true; publishedVersion: number }
        | { ok: false; error: { code: string; message: string; details?: unknown } }
      )
    > = [];
    // 1. Publications — chacune indépendante. Le succès est consigné JUSTE
    //    après `publishSet` : rien d'ultérieur ne peut le faire passer pour
    //    un échec.
    const succeeded: Array<{ draft: ComponentMediaSetWithItems; published: ComponentMediaSetWithItems }> = [];
    for (const draft of drafts) {
      let published: ComponentMediaSetWithItems;
      try {
        published = await publishSet({
          setId: draft.id,
          actorId: session.adminId,
          expectedUpdatedAt: draft.updatedAt,
        });
      } catch (err) {
        const mapped = await toMediaSetHttpError(err);
        if (!(mapped instanceof HttpError)) {
          // Message interne (SQL, pilote…) : journalisé, jamais renvoyé.
          logger.error('admin.media_sets.bulk_publish.item_failed', {
            set_id: draft.id,
            component_key: component.key,
            error: mapped instanceof Error ? mapped.message : String(mapped),
          });
        }
        results.push({
          ...summarize(draft),
          ok: false,
          error:
            mapped instanceof HttpError
              ? { code: mapped.code, message: mapped.message, details: mapped.details }
              : { code: 'internal_error', message: 'Erreur interne lors de la publication de cet ensemble' },
        });
        continue;
      }
      results.push({ ...summarize(draft), ok: true, publishedVersion: published.version });
      succeeded.push({ draft, published });
    }

    // 2. Invalidation dès qu'au moins une publication a réussi.
    const publishedCount = succeeded.length;
    const revalidated =
      publishedCount > 0 ? revalidateMediaSets([component.key], 'POST media-sets/bulk-publish') : [];

    // 3. Audit (ne lève pas — cf. `auditMediaSetChange`).
    for (const { draft, published } of succeeded) {
      await auditMediaSetChange({
        action: 'media_set.publish',
        actorId: session.adminId,
        componentKey: component.key,
        set: published,
        meta: { bulk: true, fromVersion: draft.version },
      });
    }
    await auditMediaSetChange({
      action: 'media_set.bulk_publish',
      actorId: session.adminId,
      componentKey: component.key,
      meta: {
        filter,
        all: publishAll,
        matched: matching.length,
        published: publishedCount,
        failed: results.length - publishedCount,
        truncated,
      },
    });

    return NextResponse.json({
      dryRun: false,
      filter,
      all: publishAll,
      matched: matching.length,
      truncated,
      published: publishedCount,
      failed: results.length - publishedCount,
      results,
      revalidated,
    });
  } catch (err) {
    return mediaSetErrorResponse(err, 'POST media-sets/bulk-publish');
  }
}
