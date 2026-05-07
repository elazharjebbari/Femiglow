import { beforeEach, describe, expect, it } from 'vitest';
import { resetMemoryStore } from '@/lib/db/client';
import { createMedia, updateMedia, softDeleteMedia } from '@/lib/db/queries/media';
import { GET } from './route';

describe('GET /api/media/[idOrSlug]', () => {
  beforeEach(() => {
    resetMemoryStore();
  });

  it('renvoie un media ready avec cache header', async () => {
    const m = await createMedia({ kind: 'image', source: 'upload', slug: 'public-1', alt: 'a' });
    await updateMedia(m.id, { status: 'ready' });
    const res = await GET(new Request('http://x/api/media/public-1'), { params: { idOrSlug: 'public-1' } });
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toContain('s-maxage=86400');
    const json = (await res.json()) as { id: string; status: string };
    expect(json.id).toBe(m.id);
  });

  it('404 si non ready', async () => {
    const m = await createMedia({ kind: 'image', source: 'upload', slug: 'pending-1', alt: 'a' });
    const res = await GET(new Request('http://x'), { params: { idOrSlug: m.slug } });
    expect(res.status).toBe(404);
  });

  it('404 si soft-deleted', async () => {
    const m = await createMedia({ kind: 'image', source: 'upload', slug: 'deleted-1', alt: 'a' });
    await updateMedia(m.id, { status: 'ready' });
    await softDeleteMedia(m.id);
    const res = await GET(new Request('http://x'), { params: { idOrSlug: m.slug } });
    expect(res.status).toBe(404);
  });

  it('404 si slug inconnu', async () => {
    const res = await GET(new Request('http://x'), { params: { idOrSlug: 'nope' } });
    expect(res.status).toBe(404);
  });
});
