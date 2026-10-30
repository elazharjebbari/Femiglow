import sharp from 'sharp';

/**
 * Placeholder de chargement (`media.blur_data_url`) : miniature WebP de
 * ≈ 16×20 px encodée en data URL, injectée telle quelle dans
 * `next/image` (`placeholder="blur"` + `blurDataURL`). Le navigateur
 * l'agrandit avec un flou CSS : quelques centaines d'octets suffisent.
 *
 * Calculée directement depuis l'image (pas depuis le blurhash) : rendu plus
 * fidèle, aucun décodage côté serveur au moment du rendu, et pas de
 * dépendance `server-only` (utilisable par les scripts `tsx`).
 *
 * cf. docs/hero-media-par-angle/05-architecture-technique.md §4.5
 */

/** Taille maximale de la data URL (préfixe compris) : reste inline dans le HTML. */
export const BLUR_DATA_URL_MAX_BYTES = 1536;

/** Boîte englobante de la miniature (ratio de l'image conservé). */
export const BLUR_DATA_URL_BOX = { width: 16, height: 20 } as const;

/**
 * Tentatives successives : si une image très texturée dépasse le budget,
 * on réduit la boîte puis la qualité. La dernière tient toujours (≤ 8×10).
 */
const ATTEMPTS: ReadonlyArray<{ width: number; height: number; quality: number }> = [
  { width: BLUR_DATA_URL_BOX.width, height: BLUR_DATA_URL_BOX.height, quality: 50 },
  { width: 12, height: 15, quality: 40 },
  { width: 8, height: 10, quality: 30 },
];

const PREFIX = 'data:image/webp;base64,';

export interface BlurDataUrlOptions {
  /** Budget en octets de la data URL. Défaut : `BLUR_DATA_URL_MAX_BYTES`. */
  maxBytes?: number;
}

/**
 * Calcule la data URL du placeholder. `rotate()` applique l'orientation
 * EXIF (sans effet sur un buffer déjà normalisé par sharp). Lève une erreur
 * si l'image est illisible, ou si aucune tentative ne tient dans le budget
 * (budget anormalement bas).
 */
export async function computeBlurDataUrl(
  buffer: Buffer,
  options: BlurDataUrlOptions = {},
): Promise<string> {
  const maxBytes = options.maxBytes ?? BLUR_DATA_URL_MAX_BYTES;
  for (const attempt of ATTEMPTS) {
    const data = await sharp(buffer)
      .rotate()
      .resize(attempt.width, attempt.height, { fit: 'inside' })
      .webp({ quality: attempt.quality, alphaQuality: attempt.quality, effort: 6 })
      .toBuffer();
    const url = `${PREFIX}${data.toString('base64')}`;
    if (url.length <= maxBytes) return url;
  }
  throw new Error(`blur_data_url: impossible de rester sous ${maxBytes} octets`);
}

/** Vrai si `value` ressemble à un placeholder produit par `computeBlurDataUrl`. */
export function isBlurDataUrl(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^data:image\/(webp|png|jpeg|avif);base64,[A-Za-z0-9+/]+=*$/.test(value)
  );
}
