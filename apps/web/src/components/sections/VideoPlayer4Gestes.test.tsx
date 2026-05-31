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

describe('VideoPlayer4Gestes — variante YouTube (CHA-243 + Phase 2 click-to-play)', () => {
  const youTubeVideo = {
    ...mockRituel.videoGestes,
    youtubeUrl: 'https://youtube.com/shorts/N2pDuciP4uQ?si=h9_ROBIt-N7Oq7jb',
  };

  it('rend le poster cover (pas d\'iframe) au paint initial quand youtubeUrl est défini', () => {
    const { container } = render(<VideoPlayer4Gestes video={youTubeVideo} />);
    // Self-hosted <video> ABSENT
    expect(container.querySelector('video')).toBeNull();
    // Poster cover PRÉSENT
    expect(screen.getByTestId('video-poster-cover')).toBeDefined();
    // Iframe ABSENT (montée seulement après clic)
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('au clic sur le poster, monte l\'iframe sur youtube-nocookie.com avec autoplay', () => {
    render(<VideoPlayer4Gestes video={youTubeVideo} />);
    fireEvent.click(screen.getByTestId('video-poster-cover'));
    const iframe = screen.getByTitle(/quatre gestes en vidéo/i) as HTMLIFrameElement;
    expect(iframe.src).toContain('youtube-nocookie.com');
    expect(iframe.src).toContain('N2pDuciP4uQ');
    expect(iframe.src).toContain('autoplay=1');
    expect(iframe.src).toContain('mute=1');
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
    expect(screen.queryByTestId('video-poster-cover')).toBeNull();
  });

  it('affiche la provenance maison en italique sous le sous-titre', () => {
    render(<VideoPlayer4Gestes video={youTubeVideo} />);
    const prov = screen.getByTestId('video-provenance');
    expect(prov).toBeDefined();
    expect(prov.textContent).toMatch(/Rabat/);
    expect(prov.className).toMatch(/italic/);
  });

  it('omet la provenance si video.provenance est absent', () => {
    const noProv = { ...youTubeVideo, provenance: undefined };
    render(<VideoPlayer4Gestes video={noProv} />);
    expect(screen.queryByTestId('video-provenance')).toBeNull();
  });

  it('rend la CTA post-vidéo « Voir le pack ci-dessous » pointant sur #commander-femiglow', () => {
    render(<VideoPlayer4Gestes video={youTubeVideo} />);
    const cta = screen.getByTestId('video-post-cta');
    expect(cta.getAttribute('href')).toBe('#commander-femiglow');
    expect(cta.textContent).toContain('Voir le pack ci-dessous');
  });
});
