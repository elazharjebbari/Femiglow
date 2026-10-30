/**
 * POST /api/admin/components/[key]/media-sets/[setId]/publish
 *
 * Publie un brouillon (ou une programmation, sans attendre l'échéance).
 * Atomique côté requêtes : l'ancien publié du tuple est archivé, une
 * programmation concurrente est annulée (`superseded_by_publish`), la
 * version augmente. Corps facultatif : `{ notes?, expectedUpdatedAt? }`.
 *
 * Invalide `components` et `components:media-sets:<key>` : la cellule
 * change pour le public.
 *
 * cf. docs/hero-media-par-angle/05-architecture-technique.md §4.7
 */
import { publishSet } from '@/lib/db/queries/component-media-sets';
import { mediaSetTransitionHandler } from '@/lib/components/media-variants/transition-route';
import { mediaSetMutationSchema } from '@/lib/schemas/admin/media-sets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = mediaSetTransitionHandler({
  route: 'POST media-sets/[setId]/publish',
  action: 'media_set.publish',
  schema: mediaSetMutationSchema,
  revalidate: true,
  run: ({ setId, actorId, expectedUpdatedAt }) =>
    publishSet({ setId, actorId, expectedUpdatedAt }),
  auditMeta: (body) => ({ notes: body.notes ?? null }),
});
