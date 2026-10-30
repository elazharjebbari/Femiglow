/**
 * DELETE /api/admin/components/[key]/media-sets/[setId]
 *
 * Abandonne un BROUILLON (`discardDraft`) : l'ensemble et ses items sont
 * supprimés, ce qui libère les médias pour une suppression définitive ;
 * l'historique est conservé (restaurable). Tout autre statut → 409
 * `invalid_state` (dépublier ou annuler la programmation d'abord).
 * Pas d'invalidation : un brouillon n'est pas servi.
 *
 * cf. docs/hero-media-par-angle/05-architecture-technique.md §4.7
 */
import { discardDraft } from '@/lib/db/queries/component-media-sets';
import { mediaSetTransitionHandler } from '@/lib/components/media-variants/transition-route';
import { mediaSetMutationSchema } from '@/lib/schemas/admin/media-sets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const DELETE = mediaSetTransitionHandler({
  route: 'DELETE media-sets/[setId]',
  action: 'media_set.discard',
  schema: mediaSetMutationSchema,
  revalidate: false,
  run: ({ setId, actorId, expectedUpdatedAt }) =>
    discardDraft({ setId, actorId, expectedUpdatedAt }),
  auditMeta: (_body, _before, after) => ({ itemCount: after.items.length }),
});
