/**
 * POST /api/admin/components/[key]/media-sets/[setId]/cancel-schedule
 *
 * Annule une programmation : l'ensemble redevient brouillon. Refusé (409
 * `invalid_state`) si un autre brouillon existe déjà pour la cellule. Pas
 * d'invalidation : la version publique ne change pas.
 *
 * cf. docs/hero-media-par-angle/05-architecture-technique.md §4.7
 */
import { cancelSetSchedule } from '@/lib/db/queries/component-media-sets';
import { mediaSetTransitionHandler } from '@/lib/components/media-variants/transition-route';
import { mediaSetMutationSchema } from '@/lib/schemas/admin/media-sets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = mediaSetTransitionHandler({
  route: 'POST media-sets/[setId]/cancel-schedule',
  action: 'media_set.cancel_schedule',
  schema: mediaSetMutationSchema,
  revalidate: false,
  run: ({ setId, actorId, expectedUpdatedAt }) =>
    cancelSetSchedule({ setId, actorId, expectedUpdatedAt }),
  auditMeta: (_body, before) => ({
    scheduledAt: before.scheduledAt ? new Date(before.scheduledAt).toISOString() : null,
  }),
});
