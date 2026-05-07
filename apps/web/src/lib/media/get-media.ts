import 'server-only';
import { unstable_cache } from 'next/cache';
import {
  findMediaById,
  findMediaBySlug,
  getMediaWithRelations,
} from '@/lib/db/queries/media';
import type { MediaWithRelations } from '@/lib/db/types';

async function fetchMedia(idOrSlug: string): Promise<MediaWithRelations | null> {
  const lookup = idOrSlug.startsWith('me_')
    ? await findMediaById(idOrSlug)
    : await findMediaBySlug(idOrSlug);
  if (!lookup || lookup.deletedAt !== null) return null;
  return getMediaWithRelations(lookup.id);
}

const cached = unstable_cache(
  async (idOrSlug: string) => fetchMedia(idOrSlug),
  ['media-by-id-or-slug'],
  { revalidate: 60 * 60, tags: ['media'] },
);

export async function getMedia(idOrSlug: string): Promise<MediaWithRelations | null> {
  return cached(idOrSlug);
}
