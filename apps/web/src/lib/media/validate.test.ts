import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { MediaValidationError, validateUpload } from './validate';

async function pngBuffer(): Promise<Buffer> {
  return sharp({
    create: { width: 8, height: 8, channels: 3, background: { r: 255, g: 0, b: 0 } },
  })
    .png()
    .toBuffer();
}

describe('validateUpload', () => {
  it('accepte un PNG valide', async () => {
    const buf = await pngBuffer();
    const result = await validateUpload(buf);
    expect(result.kind).toBe('image');
    expect(result.mime).toBe('image/png');
  });

  it('détecte un SVG comme image', async () => {
    const buf = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    const result = await validateUpload(buf);
    expect(result.kind).toBe('image');
    expect(result.mime).toBe('image/svg+xml');
  });

  it('rejette si déclaration ne matche pas le contenu', async () => {
    const buf = await pngBuffer();
    await expect(validateUpload(buf, 'video')).rejects.toThrow(MediaValidationError);
  });

  it('rejette les buffers corrompus', async () => {
    await expect(validateUpload(Buffer.from('not-a-real-file'))).rejects.toThrow(MediaValidationError);
  });
});
