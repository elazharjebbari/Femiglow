/**
 * Le flou est un confort : si son calcul échoue, l'optimisation (upload
 * admin, seed, import) réussit quand même, avec `blurDataUrl = null`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { resetMemoryStore } from '@/lib/db/client';
import { findMediaById, updateMedia } from '@/lib/db/queries/media';
import type { StorageAdapter } from '@/lib/media/storage';

vi.mock('./blur-data-url', async (importActual) => {
  const actual = await importActual<typeof import('./blur-data-url')>();
  return { ...actual, computeBlurDataUrl: vi.fn(async () => Promise.reject(new Error('flou en panne'))) };
});

const { optimizeImage } = await import('./optimize-image');
const { ingestImageBuffer } = await import('@/lib/media/ingest');

const storage: StorageAdapter = {
  driver: 'local',
  async put({ key, body }) {
    return { key, url: `mem://${key}`, sizeBytes: body.byteLength };
  },
  async delete() {},
  publicUrl(key) {
    return `mem://${key}`;
  },
};

async function png(): Promise<Buffer> {
  return sharp({ create: { width: 40, height: 50, channels: 3, background: '#c08070' } }).png().toBuffer();
}

beforeEach(() => resetMemoryStore());

describe('calcul du flou en échec', () => {
  it('optimizeImage réussit avec blurDataUrl = null', async () => {
    const result = await optimizeImage(
      { mediaId: 'me_x', buffer: await png(), breakpoints: ['sm'], formats: ['webp'] },
      storage,
    );
    expect(result.blurDataUrl).toBeNull();
    expect(result.blurhash).toBeTruthy();
    expect(result.variants).toHaveLength(1);
  });

  it('ingest : média ready sans flou ; un flou périmé est effacé à la ré-optimisation', async () => {
    const base = { buffer: await png(), filename: 'a.png', slug: 'a', alt: 'A', breakpoints: ['sm' as const], optimize: { formats: ['webp' as const] }, storage };
    const created = await ingestImageBuffer(base);
    expect(created.media).toMatchObject({ status: 'ready', blurDataUrl: null });

    await updateMedia(created.media.id, { blurDataUrl: 'data:image/webp;base64,AAAA' });
    const again = await ingestImageBuffer({ ...base, force: true });
    expect(again.status).toBe('reprocessed');
    expect((await findMediaById(created.media.id))?.blurDataUrl).toBeNull();
  });
});
