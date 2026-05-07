import 'server-only';
import { env } from '@/lib/env';
import { resolveComponentSlot } from './resolver';

interface ResolvedOg {
  /** URL absolue (préfixée NEXT_PUBLIC_SITE_URL) si binding actif. */
  url: string;
  alt: string;
  width: number;
  height: number;
}

/**
 * Résout un slot `og` d'un composant et renvoie une URL absolue prête pour
 * `metadata.openGraph.images`. Si pas de binding actif → null (l'appelant
 * doit fallback sur l'asset SVG par défaut).
 *
 * Choisit la variante JPEG la plus large (les crawlers OG préfèrent JPEG/PNG
 * à AVIF/WebP).
 */
export async function resolveOgImage(
  componentKey: string,
  slot = 'og',
): Promise<ResolvedOg | null> {
  const resolved = await resolveComponentSlot(componentKey, slot);
  if (!resolved?.binding?.isActive || !resolved.media) return null;

  const raster = resolved.media.variants
    .filter((v) => v.format === 'jpeg' || v.format === 'png')
    .sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  const best = raster[0];
  if (!best) return null;

  // Préfixer avec l'origine du site pour produire une URL absolue.
  const origin = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  const path = best.url.startsWith('http') ? best.url : `${origin}${best.url}`;

  return {
    url: path,
    alt: resolved.alt,
    width: best.width ?? resolved.media.originalWidth ?? 1200,
    height: best.height ?? resolved.media.originalHeight ?? 630,
  };
}
