/**
 * Tests `VideoChapters` — mini-timeline cliquable.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const emitMock = vi.fn();
vi.mock('@/lib/tracking/use-tracking', () => ({
  useTracking: () => ({ emit: emitMock }),
}));

import { VideoChapters, VideoChaptersFromRituel } from './VideoChapters';
import type { RituelVideo, VideoChapter } from '@/lib/schemas';

const baseChapters: ReadonlyArray<VideoChapter> = [
  { key: 'paste', label: 'Paste', startSeconds: 0 },
  { key: 'powder', label: 'Powder', startSeconds: 18 },
  { key: 'step-4', label: 'Step 4', startSeconds: 42 },
  { key: 'polissage', label: 'Polissage', startSeconds: 68 },
];

afterEach(() => {
  cleanup();
  emitMock.mockReset();
});

describe('VideoChapters — rétrocompat', () => {
  it('ne rend rien quand chapters est undefined', () => {
    const { container } = render(
      <VideoChapters chapters={undefined} videoId="v1" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('ne rend rien quand chapters.length === 0', () => {
    const { container } = render(<VideoChapters chapters={[]} videoId="v1" />);
    expect(container.firstChild).toBeNull();
  });

  it('ne rend rien quand chapters.length === 1 (timeline dégénérée)', () => {
    const { container } = render(
      <VideoChapters
        chapters={[{ key: 'paste', label: 'Paste', startSeconds: 0 }]}
        videoId="v1"
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});

describe('VideoChapters — rendu nominal', () => {
  it('rend une <nav aria-label="Chapitres de la vidéo">', () => {
    render(<VideoChapters chapters={baseChapters} videoId="v1" />);
    const nav = screen.getByTestId('video-chapters');
    expect(nav.tagName).toBe('NAV');
    expect(nav.getAttribute('aria-label')).toBe('Chapitres de la vidéo');
  });

  it('rend un <button> par chapitre avec numérotation 01..04', () => {
    render(<VideoChapters chapters={baseChapters} videoId="v1" />);
    expect(screen.getByText('01')).toBeDefined();
    expect(screen.getByText('02')).toBeDefined();
    expect(screen.getByText('03')).toBeDefined();
    expect(screen.getByText('04')).toBeDefined();
  });

  it('affiche les labels des chapitres', () => {
    render(<VideoChapters chapters={baseChapters} videoId="v1" />);
    expect(screen.getByText('Paste')).toBeDefined();
    expect(screen.getByText('Powder')).toBeDefined();
    expect(screen.getByText('Step 4')).toBeDefined();
    expect(screen.getByText('Polissage')).toBeDefined();
  });

  it('formate les timestamps en M:SS (pas de pad sur les minutes)', () => {
    render(<VideoChapters chapters={baseChapters} videoId="v1" />);
    expect(screen.getByText('0:00')).toBeDefined();
    expect(screen.getByText('0:18')).toBeDefined();
    expect(screen.getByText('0:42')).toBeDefined();
    expect(screen.getByText('1:08')).toBeDefined();
  });
});

describe('VideoChapters — état actif', () => {
  it('au currentSeconds=0, premier chapitre est actif', () => {
    render(
      <VideoChapters chapters={baseChapters} videoId="v1" currentSeconds={0} />,
    );
    expect(
      screen.getByTestId('video-chapter-paste').getAttribute('aria-current'),
    ).toBe('step');
    expect(
      screen.getByTestId('video-chapter-powder').getAttribute('aria-current'),
    ).toBeNull();
  });

  it('au currentSeconds=20, le 2e chapitre devient actif', () => {
    render(
      <VideoChapters chapters={baseChapters} videoId="v1" currentSeconds={20} />,
    );
    expect(
      screen.getByTestId('video-chapter-powder').getAttribute('aria-current'),
    ).toBe('step');
    expect(
      screen.getByTestId('video-chapter-paste').getAttribute('aria-current'),
    ).toBeNull();
  });

  it('au currentSeconds=90, le dernier chapitre est actif', () => {
    render(
      <VideoChapters chapters={baseChapters} videoId="v1" currentSeconds={90} />,
    );
    expect(
      screen.getByTestId('video-chapter-polissage').getAttribute('aria-current'),
    ).toBe('step');
  });
});

describe('VideoChapters — interaction', () => {
  it('au clic, émet video_chapter_click avec les bons params', () => {
    render(<VideoChapters chapters={baseChapters} videoId="rituel-4-gestes" />);
    fireEvent.click(screen.getByTestId('video-chapter-powder'));
    expect(emitMock).toHaveBeenCalledTimes(1);
    expect(emitMock).toHaveBeenCalledWith('video_chapter_click', {
      video_id: 'rituel-4-gestes',
      chapter_key: 'powder',
      chapter_label: 'Powder',
      chapter_index: 1,
      chapter_start_seconds: 18,
    });
  });

  it('au clic, appelle onSeek avec startSeconds + chapter', () => {
    const onSeek = vi.fn();
    render(
      <VideoChapters chapters={baseChapters} videoId="v1" onSeek={onSeek} />,
    );
    fireEvent.click(screen.getByTestId('video-chapter-step-4'));
    expect(onSeek).toHaveBeenCalledTimes(1);
    expect(onSeek).toHaveBeenCalledWith(42, baseChapters[2]);
  });

  it('ne crashe pas quand onSeek est absent (émet quand même le tracking)', () => {
    render(<VideoChapters chapters={baseChapters} videoId="v1" />);
    fireEvent.click(screen.getByTestId('video-chapter-polissage'));
    expect(emitMock).toHaveBeenCalledTimes(1);
  });
});

describe('VideoChaptersFromRituel — adapter', () => {
  it('extrait chapters/accentColor depuis le RituelVideo', () => {
    const video = {
      chapters: baseChapters,
      accentColor: 'sauge',
    } as unknown as RituelVideo;
    render(<VideoChaptersFromRituel video={video} videoId="v1" />);
    expect(screen.getByTestId('video-chapters')).toBeDefined();
  });

  it('rend null si le RituelVideo n\'a pas de chapters', () => {
    const video = {} as unknown as RituelVideo;
    const { container } = render(
      <VideoChaptersFromRituel video={video} videoId="v1" />,
    );
    expect(container.firstChild).toBeNull();
  });
});
