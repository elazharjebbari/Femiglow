import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { makeVideoMedia } from './__fixtures__/media';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/media/get-media', () => ({ getMedia: vi.fn() }));
vi.mock('@/lib/media/usage', () => ({ recordUsage: vi.fn(async () => undefined) }));

import { getMedia } from '@/lib/media/get-media';
import { MediaVideo } from './MediaVideo';

const mockGetMedia = vi.mocked(getMedia);

beforeEach(() => {
  mockGetMedia.mockReset();
});

describe('MediaVideo', () => {
  it('rend un <video> avec sources webm + mp4', async () => {
    mockGetMedia.mockResolvedValue(makeVideoMedia({ loadingStrategy: 'eager' }));
    const ui = await MediaVideo({ slug: 'video-test', controls: true });
    const { container } = render(ui);
    const video = container.querySelector('video');
    expect(video).toBeTruthy();
    const sources = container.querySelectorAll('source');
    const types = Array.from(sources).map((s) => s.getAttribute('type'));
    expect(types).toContain('video/webm');
    expect(types).toContain('video/mp4');
  });

  it('rend un bouton interaction lazy', async () => {
    mockGetMedia.mockResolvedValue(makeVideoMedia());
    const ui = await MediaVideo({ slug: 'video-test', lazy: 'interaction' });
    const { container } = render(ui);
    expect(container.querySelector('button')).toBeTruthy();
    expect(container.querySelector('video')).toBeNull();
  });

  it('zéro violation a11y avec controls', async () => {
    mockGetMedia.mockResolvedValue(makeVideoMedia({ loadingStrategy: 'eager' }));
    const ui = await MediaVideo({ slug: 'video-test', controls: true });
    const { container } = render(ui);
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  }, 15000);
});
