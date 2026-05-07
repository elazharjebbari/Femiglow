import { describe, it, expect, beforeEach } from 'vitest';
import { resetMemoryStore } from '@/lib/db/client';
import { createMedia } from './media';
import {
  createVariant,
  listVariants,
  deleteVariantsByMedia,
  findVariant,
  upsertVariant,
  totalVariantsSize,
} from './media-variants';

async function newMedia(slug = 'media-v') {
  return createMedia({ kind: 'image', source: 'upload', slug, alt: 'alt' });
}

describe('queries.media-variants', () => {
  beforeEach(() => {
    resetMemoryStore();
  });

  it('crée une variant et la retrouve', async () => {
    const m = await newMedia();
    const v = await createVariant({
      mediaId: m.id,
      format: 'webp',
      breakpoint: 'md',
      width: 768,
      height: 432,
      sizeBytes: 1234,
      url: '/cdn/m.webp',
      checksum: 'sha-v',
    });
    const list = await listVariants(m.id);
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(v.id);
  });

  it('findVariant — match format + breakpoint', async () => {
    const m = await newMedia('m2');
    await createVariant({
      mediaId: m.id,
      format: 'avif',
      breakpoint: 'lg',
      sizeBytes: 100,
      url: '/cdn/x.avif',
      checksum: 'c',
    });
    const found = await findVariant(m.id, 'avif', 'lg');
    expect(found).not.toBeNull();
    const miss = await findVariant(m.id, 'avif', 'sm');
    expect(miss).toBeNull();
  });

  it('upsertVariant met à jour si existe', async () => {
    const m = await newMedia('m3');
    const v1 = await upsertVariant({
      mediaId: m.id,
      format: 'webp',
      breakpoint: 'md',
      sizeBytes: 100,
      url: '/v1.webp',
      checksum: 'c1',
    });
    const v2 = await upsertVariant({
      mediaId: m.id,
      format: 'webp',
      breakpoint: 'md',
      sizeBytes: 200,
      url: '/v2.webp',
      checksum: 'c2',
    });
    expect(v2.id).toBe(v1.id);
    expect(v2.url).toBe('/v2.webp');
    expect(v2.sizeBytes).toBe(200);
  });

  it('deleteVariantsByMedia supprime tout', async () => {
    const m = await newMedia('m4');
    await createVariant({
      mediaId: m.id,
      format: 'webp',
      sizeBytes: 1,
      url: '/a',
      checksum: 'a',
    });
    await createVariant({
      mediaId: m.id,
      format: 'avif',
      sizeBytes: 2,
      url: '/b',
      checksum: 'b',
    });
    await deleteVariantsByMedia(m.id);
    const list = await listVariants(m.id);
    expect(list).toHaveLength(0);
  });

  it('totalVariantsSize somme correctement', () => {
    const total = totalVariantsSize([
      { sizeBytes: 100 } as never,
      { sizeBytes: 250 } as never,
      { sizeBytes: 50 } as never,
    ]);
    expect(total).toBe(400);
  });
});
