/**
 * POST /api/admin/components/[key]/media-sets/[setId]/unpublish
 *
 * Dépublie un ensemble publié (archivé) : la cellule retombe au niveau de
 * repli suivant (§4.3). Invalide `components` et
 * `components:media-sets:<key>`.
 *
 * cf. docs/hero-media-par-angle/05-architecture-technique.md §4.7
 */
import { unpublishSet } from '@/lib/db/queries/component-media-sets';
import { mediaSetTransitionHandler } from '@/lib/components/media-variants/transition-route';
import { mediaSetMutationSchema } from '@/lib/schemas/admin/media-sets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = mediaSetTransitionHandler({
  route: 'POST media-sets/[setId]/unpublish',
  action: 'media_set.unpublish',
  schema: mediaSetMutationSchema,
  revalidate: true,
  run: ({ setId, actorId, expectedUpdatedAt }) =>
    unpublishSet({ setId, actorId, expectedUpdatedAt }),
  auditMeta: (body) => ({ notes: body.notes ?? null }),
});
