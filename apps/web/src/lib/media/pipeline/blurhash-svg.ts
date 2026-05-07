import 'server-only';
import { decode as decodeBlurhash } from 'blurhash';
import sharp from 'sharp';

/**
 * Décode un blurhash en data URL PNG (server-only) — utilisé en RSC pour
 * l'inline du placeholder sans hydratation client.
 */
export async function blurhashToSvgDataUrl(
  hash: string,
  width = 32,
  height = 18,
): Promise<string> {
  const pixels = decodeBlurhash(hash, width, height);
  const png = await sharp(Buffer.from(pixels), {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}
