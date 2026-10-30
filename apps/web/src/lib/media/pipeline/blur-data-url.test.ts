import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import {
  BLUR_DATA_URL_BOX,
  BLUR_DATA_URL_MAX_BYTES,
  computeBlurDataUrl,
  isBlurDataUrl,
} from './blur-data-url';

async function decode(dataUrl: string): Promise<sharp.Metadata> {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return sharp(Buffer.from(base64, 'base64')).metadata();
}

/** Bruit aléatoire : le pire cas pour la compression. */
async function noise(width: number, height: number): Promise<Buffer> {
  const raw = Buffer.alloc(width * height * 3);
  for (let i = 0; i < raw.length; i += 1) raw[i] = Math.floor(Math.random() * 256);
  return sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer();
}

describe('computeBlurDataUrl', () => {
  it('produit une data URL WebP 16×20 pour un portrait 4:5, sous 1,5 Ko', async () => {
    const buf = await sharp({
      create: { width: 1200, height: 1500, channels: 3, background: { r: 230, g: 190, b: 180 } },
    })
      .png()
      .toBuffer();
    const url = await computeBlurDataUrl(buf);
    expect(url.startsWith('data:image/webp;base64,')).toBe(true);
    expect(url.length).toBeLessThanOrEqual(BLUR_DATA_URL_MAX_BYTES);
    expect(isBlurDataUrl(url)).toBe(true);
    const meta = await decode(url);
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(BLUR_DATA_URL_BOX.width);
    expect(meta.height).toBe(BLUR_DATA_URL_BOX.height);
  });

  it('conserve le ratio (paysage 16:9 → 16×9)', async () => {
    const buf = await sharp({
      create: { width: 1600, height: 900, channels: 3, background: '#336699' },
    })
      .jpeg()
      .toBuffer();
    const meta = await decode(await computeBlurDataUrl(buf));
    expect(meta.width).toBe(16);
    expect(meta.height).toBe(9);
  });

  it('applique l’orientation EXIF (portrait stocké couché)', async () => {
    // 300×200 stocké avec orientation 6 (rotation 90°) → affiché 200×300.
    const buf = await sharp({
      create: { width: 300, height: 200, channels: 3, background: '#aa8866' },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const meta = await decode(await computeBlurDataUrl(buf));
    expect(meta.height!).toBeGreaterThan(meta.width!);
  });

  it('reste sous le budget même sur du bruit pur', async () => {
    const url = await computeBlurDataUrl(await noise(400, 500));
    expect(url.length).toBeLessThanOrEqual(BLUR_DATA_URL_MAX_BYTES);
  });

  it('réduit la miniature si le budget est serré, et échoue si impossible', async () => {
    // Bruit à la taille de la boîte : rien n'est moyenné par le resize,
    // la première tentative est donc la plus lourde.
    const buf = await noise(16, 20);
    const roomy = await computeBlurDataUrl(buf);
    const tight = await computeBlurDataUrl(buf, { maxBytes: roomy.length - 1 });
    expect(tight.length).toBeLessThan(roomy.length);
    const meta = await decode(tight);
    expect(meta.width!).toBeLessThan(16);
    await expect(computeBlurDataUrl(buf, { maxBytes: 10 })).rejects.toThrow(/blur_data_url/);
  });

  it('lève une erreur sur un buffer illisible', async () => {
    await expect(computeBlurDataUrl(Buffer.from('pas une image'))).rejects.toThrow();
  });
});

describe('isBlurDataUrl', () => {
  it('accepte les data URL image base64 et refuse le reste', () => {
    expect(isBlurDataUrl('data:image/webp;base64,UklGRg==')).toBe(true);
    expect(isBlurDataUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
    expect(isBlurDataUrl('https://example.com/x.webp')).toBe(false);
    expect(isBlurDataUrl('data:text/html;base64,PGI+')).toBe(false);
    expect(isBlurDataUrl(null)).toBe(false);
  });
});
