import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VideoPlayer4Gestes } from './VideoPlayer4Gestes';
import { mockRituel } from '@/data/mock/rituel';
import { expectNoAxeViolations } from '@/test/axe';

describe('VideoPlayer4Gestes', () => {
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
