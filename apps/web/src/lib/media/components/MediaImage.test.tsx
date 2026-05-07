import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { makeImageMedia } from './__fixtures__/media';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/media/get-media', () => ({ getMedia: vi.fn() }));
vi.mock('@/lib/media/pipeline/blurhash-svg', () => ({
  blurhashToSvgDataUrl: vi.fn(async () => 'data:image/png;base64,AAA'),
}));
vi.mock('@/lib/media/usage', () => ({ recordUsage: vi.fn(async () => undefined) }));

import { getMedia } from '@/lib/media/get-media';
import { MediaImage } from './MediaImage';

const mockGetMedia = vi.mocked(getMedia);

beforeEach(() => {
  mockGetMedia.mockReset();
});

describe('MediaImage', () => {
  it('rend un placeholder si media absent', async () => {
    mockGetMedia.mockResolvedValue(null);
    const ui = await MediaImage({ slug: 'absent' });
    render(ui);
    expect(screen.getByRole('img', { name: /média introuvable/ })).toBeInTheDocument();
  });

  it('rend un placeholder ariaBusy si pas ready', async () => {
    mockGetMedia.mockResolvedValue(makeImageMedia({ status: 'pending', variants: [] }));
    const ui = await MediaImage({ slug: 'pending' });
    const { container } = render(ui);
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
  });

  it('rend un <picture> avec sources avif/webp et img jpeg fallback', async () => {
    mockGetMedia.mockResolvedValue(makeImageMedia());
    const ui = await MediaImage({ slug: 'hero-test', context: 'hero' });
    const { container } = render(ui);
    const picture = container.querySelector('picture');
    expect(picture).toBeTruthy();
    const sources = container.querySelectorAll('source');
    const types = Array.from(sources).map((s) => s.getAttribute('type'));
    expect(types).toContain('image/avif');
    expect(types).toContain('image/webp');
    const img = container.querySelector('img');
    expect(img?.getAttribute('src')).toMatch(/\.jpg$/);
    expect(img?.getAttribute('alt')).toBe('Test image');
  });

  it('zéro violation a11y avec alt fourni', async () => {
    mockGetMedia.mockResolvedValue(makeImageMedia());
    const ui = await MediaImage({ slug: 'hero-test' });
    const { container } = render(ui);
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
