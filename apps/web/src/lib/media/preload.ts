import 'server-only';
import { getMedia } from '@/lib/media/get-media';
import { resolveConfig, pickVariants, buildSrcset, type MediaContextHint } from '@/lib/media/resolve/config';

export interface PreloadHint {
  rel: 'preload';
  as: 'image';
  href: string;
  imageSrcset?: string;
  imageSizes?: string;
  type?: string;
}

export async function buildHeroPreload(
  idOrSlug: string,
  context: MediaContextHint = 'hero',
  sizes?: string,
): Promise<PreloadHint | null> {
  const media = await getMedia(idOrSlug);
  if (!media || media.kind !== 'image') return null;
  if (media.status !== 'ready' && media.status !== 'passthrough') return null;
  const config = resolveConfig({ media, context, props: { sizes, priority: true } });
  const picked = pickVariants(media.variants, config);
  const entries = picked.byFormat.get(picked.bestFormat) ?? [];
  if (entries.length === 0) return null;
  const last = entries[entries.length - 1];
  if (!last) return null;
  const mimeMap: Record<string, string> = {
    avif: 'image/avif',
    webp: 'image/webp',
    jpeg: 'image/jpeg',
    png: 'image/png',
  };
  return {
    rel: 'preload',
    as: 'image',
    href: last.url,
    imageSrcset: buildSrcset(entries),
    imageSizes: config.sizes,
    type: mimeMap[picked.bestFormat],
  };
}
