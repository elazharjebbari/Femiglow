import { describe, it, expect, beforeEach } from 'vitest';
import { resetMemoryStore } from '@/lib/db/client';
import {
  createMedia,
  findMediaById,
  findMediaBySlug,
  findMediaByPhash,
  listMedia,
  updateMedia,
  softDeleteMedia,
  restoreMedia,
  hardDeleteMedia,
  getMediaWithRelations,
  normalizeSlug,
  type CreateMediaInput,
} from './media';

function baseInput(overrides: Partial<CreateMediaInput> = {}): CreateMediaInput {
  return {
    kind: 'image',
    source: 'upload',
    slug: 'mon-image',
    alt: 'Description par défaut',
    ...overrides,
  };
}

describe('queries.media', () => {
  beforeEach(() => {
    resetMemoryStore();
  });

  it('normalizeSlug — diacritiques + espaces + casse', () => {
    expect(normalizeSlug('Été à Paris ')).toBe('ete-a-paris');
    expect(normalizeSlug('Hello World!!')).toBe('hello-world');
    expect(normalizeSlug('--abc--')).toBe('abc');
  });

  it('normalizeSlug — tronque à 80 caractères', () => {
    const slug = normalizeSlug('a'.repeat(120));
    expect(slug.length).toBe(80);
  });

  it('crée et retrouve un media par id', async () => {
    const m = await createMedia(baseInput());
    const found = await findMediaById(m.id);
    expect(found?.id).toBe(m.id);
    expect(found?.slug).toBe('mon-image');
  });

  it('refuse de créer un slug déjà existant', async () => {
    await createMedia(baseInput({ slug: 'doublon' }));
    await expect(createMedia(baseInput({ slug: 'doublon' }))).rejects.toThrow();
  });

  it('retrouve un media par slug', async () => {
    await createMedia(baseInput({ slug: 'unique' }));
    const found = await findMediaBySlug('unique');
    expect(found).not.toBeNull();
  });

  it('retrouve un media par phash', async () => {
    const m = await createMedia(baseInput({ slug: 'with-phash' }));
    await updateMedia(m.id, { phash: 'p123' });
    const list = await findMediaByPhash('p123');
    expect(list).toHaveLength(1);
  });

  it('listMedia paginate', async () => {
    for (let i = 0; i < 12; i += 1) {
      await createMedia(baseInput({ slug: `image-${i}` }));
    }
    const result = await listMedia({ limit: 5 });
    expect(result.rows).toHaveLength(5);
    expect(result.total).toBe(12);
    expect(result.nextCursor).not.toBeNull();
  });

  it('listMedia filtre par kind', async () => {
    await createMedia(baseInput({ slug: 'img-a', kind: 'image' }));
    await createMedia(baseInput({ slug: 'vid-a', kind: 'video' }));
    const onlyVideos = await listMedia({ kind: 'video' });
    expect(onlyVideos.rows).toHaveLength(1);
    expect(onlyVideos.rows[0]?.kind).toBe('video');
  });

  it('updateMedia met à jour alt et caption', async () => {
    const m = await createMedia(baseInput());
    const updated = await updateMedia(m.id, { alt: 'Nouveau alt', caption: 'Une légende' });
    expect(updated?.alt).toBe('Nouveau alt');
    expect(updated?.caption).toBe('Une légende');
  });

  it('softDeleteMedia masque dans listMedia', async () => {
    const m = await createMedia(baseInput({ slug: 'to-soft-delete' }));
    await softDeleteMedia(m.id);
    const result = await listMedia({});
    expect(result.rows.find((r) => r.id === m.id)).toBeUndefined();
  });

  it('restoreMedia ré-affiche le media', async () => {
    const m = await createMedia(baseInput({ slug: 'restore-me' }));
    await softDeleteMedia(m.id);
    await restoreMedia(m.id);
    const found = await findMediaById(m.id);
    expect(found?.deletedAt).toBeNull();
  });

  it('hardDeleteMedia supprime définitivement', async () => {
    const m = await createMedia(baseInput({ slug: 'hard-delete' }));
    await hardDeleteMedia(m.id);
    const found = await findMediaById(m.id);
    expect(found).toBeNull();
  });

  it('getMediaWithRelations retourne variants/tags vides par défaut', async () => {
    const m = await createMedia(baseInput({ slug: 'with-rel' }));
    const rel = await getMediaWithRelations(m.id);
    expect(rel?.id).toBe(m.id);
    expect(rel?.variants).toEqual([]);
    expect(rel?.tags).toEqual([]);
  });
});
