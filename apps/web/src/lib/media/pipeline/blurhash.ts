import { encode as encodeBlurhash } from 'blurhash';
import sharp from 'sharp';

export async function computeBlurhash(buffer: Buffer): Promise<string> {
  const { data, info } = await sharp(buffer)
    .raw()
    .ensureAlpha()
    .resize(32, 32, { fit: 'inside' })
    .toBuffer({ resolveWithObject: true });
  return encodeBlurhash(new Uint8ClampedArray(data), info.width, info.height, 4, 4);
}
