import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { makeAudioMedia } from './__fixtures__/media';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/media/get-media', () => ({ getMedia: vi.fn() }));
vi.mock('@/lib/media/usage', () => ({ recordUsage: vi.fn(async () => undefined) }));

import { getMedia } from '@/lib/media/get-media';
import { MediaAudio } from './MediaAudio';

const mockGetMedia = vi.mocked(getMedia);

beforeEach(() => {
  mockGetMedia.mockReset();
});

describe('MediaAudio', () => {
  it('rend un <audio> avec sources opus + mp3', async () => {
    mockGetMedia.mockResolvedValue(makeAudioMedia());
    const ui = await MediaAudio({ slug: 'audio-test' });
    const { container } = render(ui);
    const audio = container.querySelector('audio');
    expect(audio).toBeTruthy();
    expect(audio?.hasAttribute('controls')).toBe(true);
    const types = Array.from(container.querySelectorAll('source')).map((s) =>
      s.getAttribute('type'),
    );
    expect(types).toContain('audio/ogg');
    expect(types).toContain('audio/mpeg');
  });

  it('throw si controls=false', async () => {
    mockGetMedia.mockResolvedValue(makeAudioMedia());
    await expect(MediaAudio({ slug: 'audio-test', controls: false })).rejects.toThrow(/controls/);
  });

  it('zéro violation a11y', async () => {
    mockGetMedia.mockResolvedValue(makeAudioMedia());
    const ui = await MediaAudio({ slug: 'audio-test' });
    const { container } = render(ui);
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  }, 15000);
});
