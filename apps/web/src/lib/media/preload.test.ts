import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeImageMedia } from './components/__fixtures__/media';

vi.mock('@/lib/media/get-media', () => ({ getMedia: vi.fn() }));
import { getMedia } from '@/lib/media/get-media';
import { buildHeroPreload } from './preload';

const mockGetMedia = vi.mocked(getMedia);

beforeEach(() => mockGetMedia.mockReset());

describe('buildHeroPreload', () => {
  it('précharge le hero dans le MEILLEUR format (avif) avec imagesrcset + type', async () => {
    mockGetMedia.mockResolvedValue(makeImageMedia());
    const hint = await buildHeroPreload('me_test123', 'hero');
    expect(hint).not.toBeNull();
    expect(hint?.rel).toBe('preload');
    expect(hint?.as).toBe('image');
    expect(hint?.type).toBe('image/avif'); // bestFormat = avif (cf. resolve/config)
    expect(hint?.imageSrcset).toContain('.avif');
    expect(hint?.imageSrcset).toMatch(/\d+w/); // descripteurs de largeur
    expect(hint?.href).toContain('.avif');
  });

  it('retourne null si média introuvable', async () => {
    mockGetMedia.mockResolvedValue(null);
    expect(await buildHeroPreload('me_absent', 'hero')).toBeNull();
  });

  it('retourne null si le média n\'est pas une image', async () => {
    mockGetMedia.mockResolvedValue(makeImageMedia({ kind: 'video' } as any));
    expect(await buildHeroPreload('me_video', 'hero')).toBeNull();
  });
});
