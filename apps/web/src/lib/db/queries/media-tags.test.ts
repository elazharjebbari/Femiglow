import { describe, it, expect, beforeEach } from 'vitest';
import { resetMemoryStore } from '@/lib/db/client';
import { createMedia } from './media';
import {
  listTags,
  findTagByName,
  findTagById,
  createTag,
  getOrCreateTagsByName,
  attachTags,
  detachTags,
  setTags,
  deleteTag,
} from './media-tags';

async function newMedia(slug = 'm-tag') {
  return createMedia({ kind: 'image', source: 'upload', slug, alt: 'alt' });
}

describe('queries.media-tags', () => {
  beforeEach(() => {
    resetMemoryStore();
  });

  it('createTag normalise le nom', async () => {
    const t = await createTag({ name: 'Été 2026' });
    expect(t.name).toBe('ete-2026');
  });

  it('createTag déduplique', async () => {
    const a = await createTag({ name: 'hero' });
    const b = await createTag({ name: 'hero' });
    expect(a.id).toBe(b.id);
  });

  it('findTagByName / findTagById', async () => {
    const t = await createTag({ name: 'banner' });
    expect((await findTagByName('banner'))?.id).toBe(t.id);
    expect((await findTagById(t.id))?.name).toBe('banner');
  });

  it('getOrCreateTagsByName retourne 2 tags uniques pour 2 noms distincts', async () => {
    const tags = await getOrCreateTagsByName(['Hero', 'banner']);
    expect(tags).toHaveLength(2);
    expect(tags.map((t) => t.name).sort()).toEqual(['banner', 'hero']);
  });

  it('attachTags + setTags + detachTags', async () => {
    const m = await newMedia('m-att');
    const t1 = await createTag({ name: 't1' });
    const t2 = await createTag({ name: 't2' });
    await attachTags(m.id, [t1.id, t2.id]);
    await setTags(m.id, [t1.id]);
    await detachTags(m.id, [t1.id]);
    expect(await listTags()).toHaveLength(2);
  });

  it('listTags trie par name', async () => {
    await createTag({ name: 'zeta' });
    await createTag({ name: 'alpha' });
    const list = await listTags();
    expect(list[0]?.name).toBe('alpha');
  });

  it('deleteTag supprime', async () => {
    const t = await createTag({ name: 'todelete' });
    await deleteTag(t.id);
    expect(await findTagById(t.id)).toBeNull();
  });
});
