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

describe('VideoPosterCover — posterCoverSvg 3 modes', () => {
  const inlineSvg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920"><rect width="1080" height="1920" fill="#E8EDE3"/></svg>';

  it('mode inline : rend le SVG via dangerouslySetInnerHTML', () => {
    render(
      <VideoPosterCover
        video={makeVideo({
          posterCoverSvg: {
            source: 'inline',
            inline: inlineSvg,
            meta: { ariaLabel: 'Cover personnalisée' },
          },
        })}
        videoId="v1"
        iframeTitle="Titre"
        played={false}
        onPlay={() => {}}
      />,
    );
    const node = screen.getByTestId('video-poster-svg-inline');
    expect(node).toBeDefined();
    expect(node.getAttribute('aria-label')).toBe('Cover personnalisée');
    // Le SVG sanitized contient bien le <rect>
    expect(node.innerHTML).toContain('rect');
  });

  it('mode inline : strip script même si présent au montage', () => {
    const dangerous =
      '<svg viewBox="0 0 100 100"><script>alert(1)</script><rect width="100" height="100"/></svg>';
    render(
      <VideoPosterCover
        video={makeVideo({
          posterCoverSvg: { source: 'inline', inline: dangerous },
        })}
        videoId="v1"
        iframeTitle="Titre"
        played={false}
        onPlay={() => {}}
      />,
    );
    const node = screen.getByTestId('video-poster-svg-inline');
    expect(node.innerHTML).not.toContain('<script');
    expect(node.innerHTML).not.toContain('alert');
  });

  it('mode file : rend <img> pointant sur /api/media/<id>', () => {
    render(
      <VideoPosterCover
        video={makeVideo({
          posterCoverSvg: {
            source: 'file',
            fileMediaId: 'media_abc123',
            meta: { ariaLabel: 'Cover fichier' },
          },
        })}
        videoId="v1"
        iframeTitle="Titre"
        played={false}
        onPlay={() => {}}
      />,
    );
    const img = screen.getByTestId('video-poster-svg-file') as HTMLImageElement;
    expect(img.tagName).toBe('IMG');
    expect(img.getAttribute('src')).toBe('/api/kit-video-cover/media_abc123');
    expect(img.getAttribute('alt')).toBe('Cover fichier');
  });

  it('mode url : rend <img> avec referrerPolicy no-referrer', () => {
    render(
      <VideoPosterCover
        video={makeVideo({
          posterCoverSvg: {
            source: 'url',
            url: 'https://cdn.example.com/cover.svg',
            meta: { ariaLabel: 'Cover externe' },
          },
        })}
        videoId="v1"
        iframeTitle="Titre"
        played={false}
        onPlay={() => {}}
      />,
    );
    const img = screen.getByTestId('video-poster-svg-url') as HTMLImageElement;
    expect(img.tagName).toBe('IMG');
    expect(img.getAttribute('src')).toBe('https://cdn.example.com/cover.svg');
    expect(img.getAttribute('referrerpolicy')).toBe('no-referrer');
  });

  it('voile encre toujours rendu (contraste pour bouton play + badge durée)', () => {
    const { container } = render(
      <VideoPosterCover
        video={makeVideo({
          posterCoverSvg: { source: 'inline', inline: inlineSvg },
        })}
        videoId="v1"
        iframeTitle="Titre"
        played={false}
        onPlay={() => {}}
      />,
    );
    // Voile renforcé à 45 % depuis l'ajout du texte overlay Kolenda
    // (garantit le contraste AAA WCAG du kicker + titre).
    expect(container.querySelector('.bg-\\[\\#2C2A28\\]\\/45')).not.toBeNull();
  });

  it('fallback rétrocompat : <Image> si posterCoverSvg absent', () => {
    render(
      <VideoPosterCover
        video={makeVideo()}
        videoId="v1"
        iframeTitle="Titre"
        played={false}
        onPlay={() => {}}
      />,
    );
    // Pas de testid SVG, on garde le fallback Image.
    expect(screen.queryByTestId('video-poster-svg-inline')).toBeNull();
    expect(screen.queryByTestId('video-poster-svg-file')).toBeNull();
    expect(screen.queryByTestId('video-poster-svg-url')).toBeNull();
    expect(screen.getByRole('img')).toBeDefined();
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
