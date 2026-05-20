/**
 * Tests GET /api/kit-video-cover/[id] — service public d'un cover uploadé.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { resetMemoryStore } from '@/lib/db/client';
import { saveKitVideoCoverFile } from '@/lib/kit/video/cover-files-store';
import { GET } from './route';

beforeEach(() => {
  resetMemoryStore();
});

const VALID_SVG = '<svg viewBox="0 0 100 100"><rect width="100" height="100" fill="#E8EDE3"/></svg>';

describe('GET /api/kit-video-cover/[id]', () => {
  it('200 sert un SVG valide stocké', async () => {
    const record = saveKitVideoCoverFile(VALID_SVG, 'adm_1');
    const res = await GET(new Request('http://test'), { params: { id: record.id } });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('image/svg+xml');
    expect(res.headers.get('cache-control')).toContain('immutable');
    const text = await res.text();
    expect(text).toContain('<rect');
  });

  it('404 si l\'id n\'existe pas', async () => {
    const res = await GET(new Request('http://test'), { params: { id: 'kvc_nope' } });
    expect(res.status).toBe(404);
  });

  it('404 si l\'id n\'est pas au format attendu', async () => {
    const res = await GET(new Request('http://test'), { params: { id: '../etc/passwd' } });
    expect(res.status).toBe(404);
  });

  it('x-content-type-options nosniff présent', async () => {
    const record = saveKitVideoCoverFile(VALID_SVG, null);
    const res = await GET(new Request('http://test'), { params: { id: record.id } });
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });
});
