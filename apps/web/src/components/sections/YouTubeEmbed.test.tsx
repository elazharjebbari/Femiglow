/**
 * Tests YouTubeEmbed.
 *
 * Couverture :
 *   - URL Short → ratio 9:16 (axe CHA-243)
 *   - URL classique → ratio 16:9
 *   - iframe pointe sur `youtube-nocookie.com` (privacy)
 *   - iframe a `title` (a11y), `loading=lazy`, `allowfullscreen`, referrerPolicy
 *   - URL invalide → null (graceful)
 *   - Override aspectRatio
 *   - emit `video_user_play` au clic
 *   - axe a11y
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { YouTubeEmbed } from './YouTubeEmbed';
import { expectNoAxeViolations } from '@/test/axe';

const emitMock = vi.fn();
vi.mock('@/lib/tracking/use-tracking', () => ({
  useTracking: () => ({ emit: emitMock, consent: { ad_storage: 'denied' } }),
}));

beforeEach(() => emitMock.mockClear());

describe('YouTubeEmbed — parsing & rendering', () => {
  it('rend l\u2019iframe pour un Short (ratio 9:16)', () => {
    const { container } = render(
      <YouTubeEmbed
        url="https://youtube.com/shorts/N2pDuciP4uQ?si=h9_ROBIt-N7Oq7jb"
        title="Rituel 4 gestes — Short"
      />,
    );
    const wrap = container.querySelector('[data-testid="youtube-embed"]');
    expect(wrap).not.toBeNull();
    expect(wrap?.getAttribute('data-is-short')).toBe('true');
    expect(wrap?.getAttribute('data-video-id')).toBe('N2pDuciP4uQ');
    expect(wrap?.className).toContain('aspect-[9/16]');
  });

  it('rend l\u2019iframe pour une URL classique (ratio 16:9)', () => {
    const { container } = render(
      <YouTubeEmbed
        url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        title="Demo"
      />,
    );
    const wrap = container.querySelector('[data-testid="youtube-embed"]');
    expect(wrap).not.toBeNull();
    expect(wrap?.getAttribute('data-is-short')).toBe('false');
    expect(wrap?.className).toContain('aspect-video');
  });

  it('respecte l\u2019override aspectRatio', () => {
    const { container } = render(
      <YouTubeEmbed
        url="https://youtube.com/shorts/N2pDuciP4uQ"
        title="Forced landscape"
        aspectRatio="16-9"
      />,
    );
    const wrap = container.querySelector('[data-testid="youtube-embed"]');
    expect(wrap?.className).toContain('aspect-video');
    expect(wrap?.className).not.toContain('aspect-[9/16]');
  });
});

describe('YouTubeEmbed — iframe privacy & a11y', () => {
  it('utilise youtube-nocookie.com (privacy-enhanced)', () => {
    render(
      <YouTubeEmbed
        url="https://youtube.com/shorts/N2pDuciP4uQ"
        title="Short test"
      />,
    );
    const iframe = screen.getByTitle('Short test') as HTMLIFrameElement;
    expect(iframe.src).toContain('youtube-nocookie.com');
    expect(iframe.src).toContain('/embed/N2pDuciP4uQ');
    // Pas de fuite vers youtube.com (cookie domain)
    expect(iframe.src).not.toContain('://www.youtube.com');
  });

  it('inclut les params privacy/branding minimal', () => {
    render(
      <YouTubeEmbed
        url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        title="Privacy test"
      />,
    );
    const iframe = screen.getByTitle('Privacy test') as HTMLIFrameElement;
    const u = new URL(iframe.src);
    expect(u.searchParams.get('rel')).toBe('0');
    expect(u.searchParams.get('modestbranding')).toBe('1');
    expect(u.searchParams.get('iv_load_policy')).toBe('3');
    expect(u.searchParams.get('playsinline')).toBe('1');
  });

  it('iframe a les attributs a11y/perf attendus', () => {
    render(
      <YouTubeEmbed
        url="https://youtube.com/shorts/N2pDuciP4uQ"
        title="A11y test"
      />,
    );
    const iframe = screen.getByTitle('A11y test') as HTMLIFrameElement;
    expect(iframe).toHaveAttribute('loading', 'lazy');
    expect(iframe).toHaveAttribute('allowfullscreen');
    expect(iframe).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    const allow = iframe.getAttribute('allow') ?? '';
    expect(allow).toContain('encrypted-media');
    // Permissions Policy moderne : `fullscreen` requis pour Chrome/Firefox récents.
    expect(allow).toContain('fullscreen');
    // `picture-in-picture` pour le mode PiP système (Safari iOS notamment).
    expect(allow).toContain('picture-in-picture');
    // `autoplay` pour permettre un play programmatique (IFrame API) si activé un jour.
    expect(allow).toContain('autoplay');
  });

  it('expose un title accessible (a11y minimum requis)', () => {
    // axe-core ne peut pas auditer le contenu d'un iframe sous JSDOM
    // (Respondable target must be a frame). On vérifie manuellement
    // que l'iframe a un titre lisible — c'est la seule contrainte a11y
    // applicable à un iframe externe (cf. WCAG 2.4.1).
    render(
      <YouTubeEmbed
        url="https://youtube.com/shorts/N2pDuciP4uQ"
        title="Rituel kit — vidéo de démonstration"
      />,
    );
    const iframe = screen.getByTitle('Rituel kit — vidéo de démonstration');
    expect(iframe.tagName).toBe('IFRAME');
    expect(iframe.getAttribute('title')?.length).toBeGreaterThan(0);
  });
});

describe('YouTubeEmbed — invalides & tracking', () => {
  it('retourne null pour URL invalide', () => {
    const { container } = render(
      <YouTubeEmbed url="https://vimeo.com/12345" title="Bad URL" />,
    );
    expect(container.querySelector('[data-testid="youtube-embed"]')).toBeNull();
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('retourne null pour string vide', () => {
    const { container } = render(<YouTubeEmbed url="" title="Empty" />);
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('emit video_user_play au clic avec provider youtube', () => {
    const { container } = render(
      <YouTubeEmbed
        url="https://youtube.com/shorts/N2pDuciP4uQ"
        title="Tracking test"
        videoId="kit-hero-video"
      />,
    );
    const wrap = container.querySelector('[data-testid="youtube-embed"]') as HTMLElement;
    fireEvent.click(wrap);
    expect(emitMock).toHaveBeenCalledWith('video_user_play', {
      video_id: 'kit-hero-video',
      video_title: 'Tracking test',
      video_provider: 'youtube',
    });
  });

  it('utilise l\u2019id YouTube comme fallback si videoId non fourni', () => {
    const { container } = render(
      <YouTubeEmbed
        url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        title="No slug"
      />,
    );
    fireEvent.click(container.querySelector('[data-testid="youtube-embed"]') as HTMLElement);
    expect(emitMock).toHaveBeenCalledWith(
      'video_user_play',
      expect.objectContaining({ video_id: 'dQw4w9WgXcQ' }),
    );
  });
});

describe('YouTubeEmbed — options passthrough', () => {
  it('passe `hl` à l\u2019URL embed', () => {
    render(
      <YouTubeEmbed url="https://youtube.com/shorts/N2pDuciP4uQ" title="hl" hl="ar" />,
    );
    const iframe = screen.getByTitle('hl') as HTMLIFrameElement;
    expect(new URL(iframe.src).searchParams.get('hl')).toBe('ar');
  });

  it('passe `startSeconds` à l\u2019URL embed', () => {
    render(
      <YouTubeEmbed
        url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        title="start"
        startSeconds={42}
      />,
    );
    const iframe = screen.getByTitle('start') as HTMLIFrameElement;
    expect(new URL(iframe.src).searchParams.get('start')).toBe('42');
  });
});
