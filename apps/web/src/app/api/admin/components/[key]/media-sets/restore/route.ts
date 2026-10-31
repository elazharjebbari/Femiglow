/**
 * POST /api/admin/components/[key]/media-sets/restore
 *
 * Restaure une entrée d'historique sous forme de BROUILLON de la même
 * cellule (jamais publiée directement ; le brouillon existant est écrasé).
 * La forme est revalidée contre la politique ACTUELLE et les médias
 * doivent toujours exister : sinon 422 avec la liste des problèmes.
 *
 * Corps : `{ historyId, expectedUpdatedAt? }` (ou header `If-Match` =
 * `updatedAt` du brouillon courant ; `If-None-Match: *` si le client ne
 * connaît aucun brouillon → 409 s'il en existe un). Pas d'invalidation.
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
import {
  getSetHistoryById,
  restoreSetFromHistory,
} from '@/lib/db/queries/component-media-sets';
import { mediaSetRestoreSchema } from '@/lib/schemas/admin/media-sets';
import { requireSameOrigin } from '@/lib/legal/csrf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx {
  params: { key: string };
}

export async function POST(request: Request, ctx: Ctx): Promise<Response> {
  try {
    const session = await requireAdminApi();
    requireSameOrigin(request);
    const { component } = await requireMediaVariantsComponent(ctx.params.key);

    const parsed = mediaSetRestoreSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Payload invalide', parsed.error.flatten());
    }
    const expectedUpdatedAt = readExpectedUpdatedAt(request, parsed.data.expectedUpdatedAt);
    const expectNoDraft = readExpectNoDraft(request, expectedUpdatedAt);

    // L'entrée doit appartenir au composant de l'URL (pas de restauration
    // croisée entre composants).
    const snapshot = await getSetHistoryById(parsed.data.historyId);
    if (!snapshot || snapshot.componentId !== component.id) {
      throw new HttpError('not_found', 'Entrée d’historique introuvable');
    }

    const set = await restoreSetFromHistory({
      historyId: snapshot.id,
      actorId: session.adminId,
      expectedUpdatedAt,
      ...(expectNoDraft ? { expectNoDraft: true } : {}),
    });

    await auditMediaSetChange({
      action: 'media_set.restore',
      actorId: session.adminId,
      componentKey: component.key,
      set,
      meta: { fromHistoryId: snapshot.id, fromVersion: snapshot.version, fromSetId: snapshot.setId },
    });

    return NextResponse.json({ set, restoredFromVersion: snapshot.version });
  } catch (err) {
    return mediaSetErrorResponse(err, 'POST media-sets/restore');
  }
}
