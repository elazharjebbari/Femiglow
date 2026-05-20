/**
 * Tests `VideoPosterCover` — overlay click-to-play.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('next/image', () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    <img alt={alt} src={src} />
  ),
}));
vi.mock('@/lib/tracking/use-tracking', () => ({
  useTracking: () => ({ emit: vi.fn() }),
}));

import { VideoPosterCover } from './VideoPosterCover';
import type { RituelVideo } from '@/lib/schemas';

afterEach(() => cleanup());

function makeVideo(over: Partial<RituelVideo> = {}): RituelVideo {
  return {
    sources: { mp4: '/v.mp4', webm: '/v.webm' },
    youtubeUrl: 'https://youtube.com/shorts/N2pDuciP4uQ',
    poster: { src: '/poster.jpg', alt: 'Poster default', width: 1920, height: 1080 },
    captions: { fr: '/c.vtt', ar: '/c-ar.vtt' },
    transcript: 'x',
    durationSeconds: 90,
    ...over,
  } as RituelVideo;
}

describe('VideoPosterCover — état non joué', () => {
  it('rend un <button> avec aria-label dérivé de l\'alt du poster', () => {
    render(
      <VideoPosterCover
        video={makeVideo()}
        videoId="v1"
        iframeTitle="Titre"
        played={false}
        onPlay={() => {}}
      />,
    );
    const btn = screen.getByTestId('video-poster-cover');
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.getAttribute('aria-label')).toContain('Poster default');
  });

  it('utilise posterCustom si fourni', () => {
    render(
      <VideoPosterCover
        video={makeVideo({
          posterCustom: { src: '/custom.jpg', alt: 'Custom paste', width: 1080, height: 1920 },
        })}
        videoId="v1"
        iframeTitle="Titre"
        played={false}
        onPlay={() => {}}
      />,
    );
    const img = screen.getByRole('img');
    expect(img.getAttribute('src')).toBe('/custom.jpg');
    expect(img.getAttribute('alt')).toBe('Custom paste');
  });

  it('fallback sur poster si posterCustom absent', () => {
    render(
      <VideoPosterCover
        video={makeVideo()}
        videoId="v1"
        iframeTitle="Titre"
        played={false}
        onPlay={() => {}}
      />,
    );
    expect(screen.getByRole('img').getAttribute('src')).toBe('/poster.jpg');
  });

  it('applique la couleur d\'accent au bouton play (sauge)', () => {
    render(
      <VideoPosterCover
        video={makeVideo({ accentColor: 'sauge' })}
        videoId="v1"
        iframeTitle="Titre"
        played={false}
        onPlay={() => {}}
      />,
    );
    const btn = screen.getByTestId('video-poster-play-button') as HTMLElement;
    expect(btn.style.backgroundColor).toBe('rgb(168, 184, 158)');
  });

  it('fallback champagne si accentColor absent', () => {
    render(
      <VideoPosterCover
        video={makeVideo()}
        videoId="v1"
        iframeTitle="Titre"
        played={false}
        onPlay={() => {}}
      />,
    );
    expect(
      (screen.getByTestId('video-poster-play-button') as HTMLElement).style.backgroundColor,
    ).toBe('rgb(184, 149, 107)');
  });

  it('rend le badge durationDisplay si fourni', () => {
    render(
      <VideoPosterCover
        video={makeVideo({ durationDisplay: '90″' })}
        videoId="v1"
        iframeTitle="Titre"
        played={false}
        onPlay={() => {}}
      />,
    );
    expect(screen.getByTestId('video-poster-duration-badge').textContent).toBe('90″');
  });

  it('omet le badge si durationDisplay absent', () => {
    render(
      <VideoPosterCover
        video={makeVideo()}
        videoId="v1"
        iframeTitle="Titre"
        played={false}
        onPlay={() => {}}
      />,
    );
    expect(screen.queryByTestId('video-poster-duration-badge')).toBeNull();
  });

  it('au clic, appelle onPlay', () => {
    const onPlay = vi.fn();
    render(
      <VideoPosterCover
        video={makeVideo()}
        videoId="v1"
        iframeTitle="Titre"
        played={false}
        onPlay={onPlay}
      />,
    );
    fireEvent.click(screen.getByTestId('video-poster-cover'));
    expect(onPlay).toHaveBeenCalledTimes(1);
  });
});

describe('VideoPosterCover — état joué', () => {
  it('rend YouTubeEmbed quand played=true', () => {
    render(
      <VideoPosterCover
        video={makeVideo()}
        videoId="v1"
        iframeTitle="Vidéo lancée"
        played
        onPlay={() => {}}
      />,
    );
    expect(screen.queryByTestId('video-poster-cover')).toBeNull();
    expect(screen.getByTestId('youtube-embed')).toBeDefined();
  });

  it('iframe inclut autoplay=1, mute=1 et captions FR', () => {
    render(
      <VideoPosterCover
        video={makeVideo()}
        videoId="v1"
        iframeTitle="Vidéo lancée"
        played
        onPlay={() => {}}
      />,
    );
    const iframe = screen.getByTitle('Vidéo lancée') as HTMLIFrameElement;
    expect(iframe.src).toContain('autoplay=1');
    expect(iframe.src).toContain('mute=1');
    expect(iframe.src).toContain('cc_load_policy=1');
    expect(iframe.src).toContain('cc_lang_pref=fr');
  });
});
