import { beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { resetMemoryStore } from '@/lib/db/client';
import { createMedia, findMediaById } from '@/lib/db/queries/media';
import { enqueueJob } from '@/lib/db/queries/media-jobs';
import { listVariants } from '@/lib/db/queries/media-variants';
import { runWorkerOnce } from './process-job';

vi.mock('@/lib/media/storage', async () => {
  const writes = new Map<string, Buffer>();
  return {
    getStorage: () => ({
      driver: 'local',
      async put({ key, body }: { key: string; body: Buffer }) {
        writes.set(key, body);
        return { key, url: `mem://${key}`, sizeBytes: body.byteLength };
      },
      async delete(key: string) {
        writes.delete(key);
      },
      publicUrl(key: string) {
        return `mem://${key}`;
      },
      async get(key: string) {
        const buf = writes.get(key);
        if (!buf) throw new Error(`missing ${key}`);
        return buf;
      },
    }),
  };
});

describe('worker.process-job', () => {
  beforeEach(() => {
    resetMemoryStore();
  });

  it('traite un job optimize sur image et passe le media en ready', async () => {
    const { getStorage } = await import('@/lib/media/storage');
    const storage = getStorage();
    const buf = await sharp({
      create: { width: 200, height: 100, channels: 3, background: { r: 0, g: 100, b: 200 } },
    })
      .jpeg()
      .toBuffer();
    const sourceKey = 'sources/test.jpg';
    await storage.put({ key: sourceKey, body: buf, contentType: 'image/jpeg' });
    const media = await createMedia({ kind: 'image', source: 'upload', slug: 'test', alt: 'a' });
    await enqueueJob({ mediaId: media.id, kind: 'optimize', payload: { sourceKey } });

    const result = await runWorkerOnce();
    expect(result.processed).toBe(1);

    const after = await findMediaById(media.id);
    expect(after?.status).toBe('ready');
    expect(after?.blurhash).toBeTruthy();
    const variants = await listVariants(media.id);
    expect(variants.length).toBeGreaterThan(0);
  }, 30_000);

  it('marque le media en failed si le job échoue', async () => {
    const media = await createMedia({ kind: 'image', source: 'upload', slug: 'fail', alt: 'a' });
    await enqueueJob({ mediaId: media.id, kind: 'optimize', payload: { sourceKey: 'missing' } });
    const result = await runWorkerOnce();
    expect(result.processed).toBe(0);
    const after = await findMediaById(media.id);
    expect(after?.status).toBe('failed');
  });
});
