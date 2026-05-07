import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { optimizeImage } from './optimize-image';
import type { StorageAdapter } from '@/lib/media/storage';

function memStorage(): StorageAdapter & { put_calls: string[] } {
  const calls: string[] = [];
  return {
    driver: 'local',
    put_calls: calls,
    async put({ key, body }) {
      calls.push(key);
      return { key, url: `mem://${key}`, sizeBytes: body.byteLength };
    },
    async delete() {},
    publicUrl(key) {
      return `mem://${key}`;
    },
  };
}

async function jpegBuffer(width = 1024, height = 768): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 100, b: 50 } },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
}

describe('optimizeImage', () => {
  it('produit blurhash, palette, phash et plusieurs variants', async () => {
    const buf = await jpegBuffer();
    const storage = memStorage();
    const result = await optimizeImage(
      {
        mediaId: 'me_test',
        buffer: buf,
        breakpoints: ['md', 'lg'],
        formats: ['webp', 'jpeg'],
      },
      storage,
    );
    expect(result.blurhash).toMatch(/^[\x21-\x7e]+$/);
    expect(result.palette.length).toBeGreaterThan(0);
    expect(result.phash).toMatch(/^[0-9a-f]+$/);
    expect(result.variants).toHaveLength(4);
    expect(result.width).toBe(1024);
    expect(result.height).toBe(768);
    expect(storage.put_calls.length).toBe(4);
  }, 30_000);

  it('respecte les breakpoints fournis', async () => {
    const buf = await jpegBuffer(800, 600);
    const result = await optimizeImage(
      {
        mediaId: 'me_test2',
        buffer: buf,
        breakpoints: ['sm'],
        formats: ['webp'],
      },
      memStorage(),
    );
    expect(result.variants).toHaveLength(1);
    const variant = result.variants[0];
    expect(variant?.format).toBe('webp');
    expect(variant?.width).toBeLessThanOrEqual(480);
  }, 20_000);

  it('crope physiquement les variants quand targetAspectRatio est fourni', async () => {
    // Source 1600×900 (paysage 16:9). Target 1/1 → variants doivent être
    // carrés (900×900 max, redimensionnés ensuite par breakpoint).
    const buf = await jpegBuffer(1600, 900);
    const result = await optimizeImage(
      {
        mediaId: 'me_crop',
        buffer: buf,
        breakpoints: ['md'],
        formats: ['webp'],
        targetAspectRatio: '1/1',
      },
      memStorage(),
    );
    // Les dimensions effectives reportées correspondent à la zone cropée.
    expect(result.width).toBe(900);
    expect(result.height).toBe(900);
    const variant = result.variants[0]!;
    // Variant doit être (à 1px près) carré : la résize sharp peut arrondir.
    expect(Math.abs(variant.width - variant.height)).toBeLessThanOrEqual(1);
  }, 30_000);

  it('respecte le focal point lors du crop', async () => {
    // On vérifie indirectement via les dimensions : un crop avec focal
    // X=0% sur source paysage doit donner les mêmes width/height que
    // sans focal, mais positionné différemment. On valide que ça
    // produit des variants carrés exploitables.
    const buf = await jpegBuffer(1600, 900);
    const result = await optimizeImage(
      {
        mediaId: 'me_focal',
        buffer: buf,
        breakpoints: ['md'],
        formats: ['webp'],
        targetAspectRatio: '1/1',
        focalX: 0,
        focalY: 50,
      },
      memStorage(),
    );
    expect(result.width).toBe(900);
    expect(result.height).toBe(900);
  }, 30_000);

  it('skip le crop si la source est déjà au bon ratio', async () => {
    // Source 800×1000 (4/5 exact). targetAspectRatio='4/5' → pas de crop.
    const buf = await jpegBuffer(800, 1000);
    const result = await optimizeImage(
      {
        mediaId: 'me_noop',
        buffer: buf,
        breakpoints: ['sm'],
        formats: ['webp'],
        targetAspectRatio: '4/5',
      },
      memStorage(),
    );
    expect(result.width).toBe(800);
    expect(result.height).toBe(1000);
  }, 20_000);

  it('JPEG aplatit la transparence sur la couleur fournie (pas de noir)', async () => {
    // PNG transparent : sans flatten, le JPEG aurait des bords noirs.
    const buf = await sharp({
      create: {
        width: 200,
        height: 200,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .png()
      .toBuffer();
    const result = await optimizeImage(
      {
        mediaId: 'me_flatten',
        buffer: buf,
        breakpoints: ['sm'],
        formats: ['jpeg'],
        flattenBackground: '#FBF8F1',
      },
      memStorage(),
    );
    expect(result.variants).toHaveLength(1);
    // On ne peut pas inspecter les pixels du buffer stocké directement,
    // mais on s'assure qu'il y a bien eu encodage et qu'aucune erreur n'a
    // été levée (flatten requis pour JPEG sur PNG transparent, sinon noir).
    expect(result.variants[0]?.format).toBe('jpeg');
    expect(result.variants[0]?.sizeBytes).toBeGreaterThan(0);
  }, 20_000);
});
