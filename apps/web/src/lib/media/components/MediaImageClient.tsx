'use client';
import type { CSSProperties } from 'react';
import type {
  MediaLoadingStrategy,
  PaletteEntry,
  VariantFormat,
  MediaObjectFit,
  MediaObjectPosition,
} from '@/lib/db/types';

interface VariantEntry {
  width: number;
  url: string;
}

export interface MediaImageClientProps {
  byFormat: Array<{ format: VariantFormat; entries: VariantEntry[] }>;
  fallbackUrl: string;
  fallbackWidth: number;
  fallbackHeight: number;
  alt: string;
  sizes: string;
  loading: 'eager' | 'lazy';
  fetchPriority: 'high' | 'low' | 'auto';
  decoding: 'async' | 'sync' | 'auto';
  blurDataUrl?: string;
  palette?: PaletteEntry[];
  className?: string;
  style?: CSSProperties;
  strategy: MediaLoadingStrategy;
  /**
   * Mode d'adaptation de l'image au cadre de l'interface.
   * - cover (défaut)  → l'image remplit, peut rogner.
   * - contain         → l'image est entière, lettrebox possible.
   * - fill            → étire (ratio cassé).
   * - none            → taille naturelle.
   * - scale-down      → contain ou none, le plus petit.
   */
  objectFit?: MediaObjectFit;
  /** Position de l'image dans le cadre (focal point). */
  objectPosition?: MediaObjectPosition;
  /** Override fin du focal point en % (0-100). Surcharge `objectPosition`. */
  focalX?: number | null;
  focalY?: number | null;
  /**
   * Ratio imposé par le slot (`'4/5'`, `'16/9'`, `'1/1'`). Si fourni, le
   * `<picture>` adopte ce ratio plutôt que celui de l'image source. Évite
   * les grilles "boiteuses" quand un slot reçoit une image au mauvais
   * ratio (typiquement triptyques wide-and-short en cartes 4/5).
   */
  slotAspectRatio?: string;
  /**
   * Couleur de fond derrière l'image (utile en `contain` : sinon on voit
   * le damier de transparence du PNG). Token couleur (resolu via CSS
   * variable, ex. `creme` → `var(--color-creme)`) ou hex/rgba/CSS valide.
   */
  backgroundFill?: string;
}

const MIME_BY_FORMAT: Record<VariantFormat, string> = {
  avif: 'image/avif',
  webp: 'image/webp',
  jpeg: 'image/jpeg',
  png: 'image/png',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  opus: 'audio/ogg',
  poster: 'image/jpeg',
};

function buildSrcsetEntries(entries: VariantEntry[]): string {
  return entries.map((e) => `${e.url} ${e.width}w`).join(', ');
}

/**
 * Tokens couleur acceptés (mappés sur les CSS variables de `tokens.css`).
 * Tout autre input passe-through (hex, rgba, named CSS color, gradient…).
 */
const COLOR_TOKEN_MAP: Record<string, string> = {
  creme: 'var(--color-creme)',
  'creme-warm': 'var(--color-creme-warm)',
  encre: 'var(--color-encre)',
  'encre-soft': 'var(--color-encre-soft)',
  sauge: 'var(--color-sauge)',
  'sauge-soft': 'var(--color-sauge-soft)',
  'sauge-dark': 'var(--color-sauge-dark)',
  petale: 'var(--color-petale)',
  'petale-soft': 'var(--color-petale-soft)',
  'petale-dark': 'var(--color-petale-dark)',
  ciel: 'var(--color-ciel)',
  'ciel-soft': 'var(--color-ciel-soft)',
  'ciel-dark': 'var(--color-ciel-dark)',
  champagne: 'var(--color-champagne)',
  'champagne-soft': 'var(--color-champagne-soft)',
  'champagne-dark': 'var(--color-champagne-dark)',
  transparent: 'transparent',
};

function resolveBackgroundFill(fill: string | undefined): string | null {
  if (!fill) return null;
  return COLOR_TOKEN_MAP[fill] ?? fill;
}

export function MediaImageClient({
  byFormat,
  fallbackUrl,
  fallbackWidth,
  fallbackHeight,
  alt,
  sizes,
  loading,
  fetchPriority,
  decoding,
  blurDataUrl,
  palette,
  className,
  style,
  objectFit = 'cover',
  objectPosition = 'center',
  focalX,
  focalY,
  slotAspectRatio,
  backgroundFill,
}: MediaImageClientProps) {
  // Si le slot impose un ratio, il a priorité sur le ratio naturel : sinon
  // les grilles deviennent hétérogènes dès qu'une image source est mal
  // proportionnée (un triptyque wide-and-short va casser l'alignement).
  const aspectRatio = slotAspectRatio
    ? slotAspectRatio.replace(':', '/')
    : `${fallbackWidth} / ${fallbackHeight}`;
  const resolvedFill = resolveBackgroundFill(backgroundFill);
  const bgColor = resolvedFill ?? palette?.[0]?.hex ?? '#f3ede4';

  const positionValue = (() => {
    if (typeof focalX === 'number' && typeof focalY === 'number') {
      const x = Math.max(0, Math.min(100, focalX));
      const y = Math.max(0, Math.min(100, focalY));
      return `${x}% ${y}%`;
    }
    return objectPosition;
  })();

  const pictureStyle: CSSProperties = {
    backgroundColor: bgColor,
    // En `contain`, on laisse le bg uni couvrir le letterbox plutôt que
    // d'étirer le blurhash (qui paraîtrait flou et déformé).
    backgroundImage:
      blurDataUrl && objectFit !== 'contain' ? `url("${blurDataUrl}")` : undefined,
    backgroundSize: objectFit === 'contain' ? 'contain' : 'cover',
    backgroundPosition: positionValue,
    backgroundRepeat: 'no-repeat',
    aspectRatio,
    display: 'block',
    overflow: 'hidden',
    ...style,
  };

  // Pas de fade-in opacity : sur certains mobiles (iOS Safari ancien, Android
  // avec décodeur AVIF capricieux, cache navigateur + hydratation React), le
  // signal `onLoad` peut ne jamais arriver et l'image restait à opacity:0
  // (page « floutée à jamais »). Le blurhash en background couvre déjà la
  // phase de chargement — l'image apparaît dès que le navigateur la peint.
  const imgStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'block',
    objectFit,
    objectPosition: positionValue,
  };

  const fallbackEntry = byFormat.find((b) => b.format === 'jpeg' || b.format === 'png');
  const fallbackSrcset = fallbackEntry ? buildSrcsetEntries(fallbackEntry.entries) : undefined;

  return (
    <picture className={className} style={pictureStyle}>
      {byFormat
        .filter((b) => b.format !== 'jpeg' && b.format !== 'png')
        .map((b) => (
          <source
            key={b.format}
            type={MIME_BY_FORMAT[b.format]}
            srcSet={buildSrcsetEntries(b.entries)}
            sizes={sizes}
          />
        ))}
      <img
        src={fallbackUrl}
        srcSet={fallbackSrcset}
        sizes={fallbackSrcset ? sizes : undefined}
        width={fallbackWidth}
        height={fallbackHeight}
        alt={alt}
        loading={loading}
        fetchPriority={fetchPriority}
        decoding={decoding}
        style={imgStyle}
        className="media-img"
      />
    </picture>
  );
}
