/**
 * PUT /api/admin/components/[key]/media-sets/draft
 *
 * Crée ou remplace le brouillon d'une cellule (slot × dimension × clé ×
 * langue). La liste d'items est complète et ordonnée (position = index) :
 * elle remplace l'existante en bloc.
 *
 *  - Forme : `mediaSetDraftSchema` (400) ; cohérence avec la politique et
 *    médias disponibles : couche requêtes (422 + `issues`).
 *  - Verrouillage optimiste : header `If-Match` = `updatedAt` du brouillon
 *    (ou `expectedUpdatedAt` dans le corps) → 409 + état courant.
 *    `If-None-Match: *` = le client part d'un état sans brouillon : 409 +
 *    brouillon courant si un brouillon existe déjà (jamais écrasé en silence).
 *  - Même origine exigée (`requireSameOrigin`, 403).
 *  - Audit : `media_set.draft.{create|update}` (ne lève pas).
 *  - Pas d'invalidation de cache : un brouillon n'est pas servi au public.
 *
 * cf. docs/hero-media-par-angle/05-architecture-technique.md §4.7
 */
import { NextResponse } from 'next/server';
import { HttpError } from '@/lib/errors/http-error';
import {
  auditMediaSetChange,
  mediaSetErrorResponse,
  readExpectNoDraft,
  readExpectedUpdatedAt,
  readJsonBody,
  requireAdminApi,
  requireMediaVariantsComponent,
} from '@/lib/components/media-variants/route-helpers';
import { findSetByTuple, upsertDraftSet } from '@/lib/db/queries/component-media-sets';
import { requireSameOrigin } from '@/lib/legal/csrf';
import { mediaSetDraftSchema } from '@/lib/schemas/admin/media-sets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx {
  params: { key: string };
}

export async function PUT(request: Request, ctx: Ctx): Promise<Response> {
  try {
    const session = await requireAdminApi();
    requireSameOrigin(request);
    const { component } = await requireMediaVariantsComponent(ctx.params.key);

    const parsed = mediaSetDraftSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Payload invalide', parsed.error.flatten());
    }
    const body = parsed.data;
    const expectedUpdatedAt = readExpectedUpdatedAt(request, body.expectedUpdatedAt);
    const expectNoDraft = readExpectNoDraft(request, expectedUpdatedAt);

    const tuple = {
      slot: body.slot,
      variantDim: body.variantDim,
      variantKey: body.variantKey,
      locale: body.locale,
    };
    // Lecture ciblée (201 vs 200 et libellé d'audit) ; la vraie garde de
    // concurrence reste dans `upsertDraftSet` (If-Match + index unique).
    const existing = await findSetByTuple({ componentId: component.id, ...tuple }, 'draft');

    const set = await upsertDraftSet({
      componentId: component.id,
      ...tuple,
      items: body.items,
      ...(body.crossLocale !== undefined ? { crossLocale: body.crossLocale } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      authorId: session.adminId,
      expectedUpdatedAt,
      ...(expectNoDraft ? { expectNoDraft: true } : {}),
    });

    await auditMediaSetChange({
      action: existing ? 'media_set.draft.update' : 'media_set.draft.create',
      actorId: session.adminId,
      componentKey: component.key,
      set,
      meta: { itemCount: set.items.length, crossLocale: set.crossLocale },
    });

    return NextResponse.json({ set }, { status: existing ? 200 : 201 });
  } catch (err) {
    return mediaSetErrorResponse(err, 'PUT media-sets/draft');
  }
}
