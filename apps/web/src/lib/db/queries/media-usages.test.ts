import { describe, it, expect, beforeEach } from 'vitest';
import { resetMemoryStore } from '@/lib/db/client';
import { createMedia } from './media';
import {
  recordUsage,
  listUsagesForMedia,
  countUsagesForMedia,
  deleteUsagesForMedia,
  listUnusedMedia,
} from './media-usages';

async function newMedia(slug = 'm-usage') {
  return createMedia({ kind: 'image', source: 'upload', slug, alt: 'alt' });
}

describe('queries.media-usages', () => {
  beforeEach(() => {
    resetMemoryStore();
  });

  it('recordUsage crée une nouvelle entrée', async () => {
    const m = await newMedia();
    const u = await recordUsage({
      mediaId: m.id,
      usageType: 'page',
      route: '/',
      component: 'HeroSection',
      context: 'hero',
    });
    expect(u.mediaId).toBe(m.id);
    expect(await countUsagesForMedia(m.id)).toBe(1);
  });

  it('recordUsage met à jour lastSeenAt si déjà existant', async () => {
    const m = await newMedia('mu-up');
    const first = await recordUsage({
      mediaId: m.id,
      usageType: 'section',
      route: '/about',
      component: 'Gallery',
      context: 'inline',
    });
    const second = await recordUsage({
      mediaId: m.id,
      usageType: 'section',
      route: '/about',
      component: 'Gallery',
      context: 'inline',
    });
    expect(second.id).toBe(first.id);
    expect(await countUsagesForMedia(m.id)).toBe(1);
  });

  it('listUsagesForMedia retourne tout', async () => {
    const m = await newMedia('mu-l');
    await recordUsage({
      mediaId: m.id,
      usageType: 'page',
      route: '/',
      component: 'A',
      context: 'hero',
    });
    await recordUsage({
      mediaId: m.id,
      usageType: 'page',
      route: '/x',
      component: 'B',
      context: 'inline',
    });
    expect(await listUsagesForMedia(m.id)).toHaveLength(2);
  });

  it('deleteUsagesForMedia nettoie tout', async () => {
    const m = await newMedia('mu-d');
    await recordUsage({
      mediaId: m.id,
      usageType: 'page',
      route: '/',
      component: 'A',
      context: 'hero',
    });
    await deleteUsagesForMedia(m.id);
    expect(await countUsagesForMedia(m.id)).toBe(0);
  });

  it('listUnusedMedia identifie les médias non utilisés', async () => {
    const used = await newMedia('mu-used');
    const orphan = await newMedia('mu-orphan');
    await recordUsage({
      mediaId: used.id,
      usageType: 'page',
      route: '/',
      component: 'A',
      context: 'hero',
    });
    const past = new Date(Date.now() - 86400000);
    const unused = await listUnusedMedia(past);
    expect(unused).toContain(orphan.id);
    expect(unused).not.toContain(used.id);
  });
});
