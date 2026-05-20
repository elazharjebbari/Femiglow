import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VideoPlayer4Gestes } from './VideoPlayer4Gestes';
import { mockRituel } from '@/data/mock/rituel';
import { expectNoAxeViolations } from '@/test/axe';

describe('VideoPlayer4Gestes — variante self-hosted (legacy)', () => {
  it('rend la vidéo avec poster, sources et pistes de captions FR + AR', () => {
    const { container } = render(<VideoPlayer4Gestes video={mockRituel.videoGestes} />);
    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    expect(video).toHaveAttribute('poster', mockRituel.videoGestes.poster.src);
    expect(video?.querySelectorAll('source')).toHaveLength(2);
    const tracks = video?.querySelectorAll('track');
    expect(tracks).toHaveLength(2);
    expect(tracks?.[0]).toHaveAttribute('srclang', 'fr');
    expect(tracks?.[0]).toHaveAttribute('default');
    expect(tracks?.[1]).toHaveAttribute('srclang', 'ar');
  });

  it('bascule la transcription via aria-expanded', () => {
    render(<VideoPlayer4Gestes video={mockRituel.videoGestes} />);
    const button = screen.getByRole('button', { name: /Lire la transcription/ });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(button).toHaveTextContent(/Masquer la transcription/);
  });

  it('respecte axe', async () => {
    const { container } = render(<VideoPlayer4Gestes video={mockRituel.videoGestes} />);
    await expectNoAxeViolations(container);
  }, 15000);
});

describe('VideoPlayer4Gestes — variante YouTube (CHA-243)', () => {
  const youTubeVideo = {
    ...mockRituel.videoGestes,
    youtubeUrl: 'https://youtube.com/shorts/N2pDuciP4uQ?si=h9_ROBIt-N7Oq7jb',
  };

  it('rend un iframe YouTube (pas de <video>) quand youtubeUrl est défini', () => {
    const { container } = render(<VideoPlayer4Gestes video={youTubeVideo} />);
    // Self-hosted <video> ABSENT
    expect(container.querySelector('video')).toBeNull();
    // YouTubeEmbed PRÉSENT
    const wrap = container.querySelector('[data-testid="youtube-embed"]');
    expect(wrap).not.toBeNull();
    expect(wrap?.getAttribute('data-is-short')).toBe('true');
    expect(wrap?.getAttribute('data-video-id')).toBe('N2pDuciP4uQ');
  });

  it('iframe pointe sur youtube-nocookie.com', () => {
    render(<VideoPlayer4Gestes video={youTubeVideo} />);
    const iframe = screen.getByTitle(/quatre gestes en vidéo/i) as HTMLIFrameElement;
    expect(iframe.src).toContain('youtube-nocookie.com');
    expect(iframe.src).toContain('N2pDuciP4uQ');
  });

  it('garde la transcription dépliable dans la variante YouTube', () => {
    render(<VideoPlayer4Gestes video={youTubeVideo} />);
    const button = screen.getByRole('button', { name: /Lire la transcription/ });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('tombe sur self-hosted si youtubeUrl est un string invalide', () => {
    const bogus = { ...mockRituel.videoGestes, youtubeUrl: 'https://vimeo.com/12345' };
    const { container } = render(<VideoPlayer4Gestes video={bogus} />);
    // Doit retomber sur le player <video> historique
    expect(container.querySelector('video')).not.toBeNull();
    expect(container.querySelector('[data-testid="youtube-embed"]')).toBeNull();
  });
});
