/**
 * Tests `VideoPostCta` — lien éditorial post-vidéo.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const emitMock = vi.fn();
vi.mock('@/lib/tracking/use-tracking', () => ({
  useTracking: () => ({ emit: emitMock }),
}));

import { VideoPostCta } from './VideoPostCta';

beforeEach(() => {
  emitMock.mockReset();
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('VideoPostCta — rendu', () => {
  it('rend un <a> avec href par défaut #commander-femiglow', () => {
    render(<VideoPostCta videoId="rituel-4-gestes" />);
    const link = screen.getByTestId('video-post-cta');
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('#commander-femiglow');
  });

  it('affiche le label par défaut « Voir le pack ci-dessous »', () => {
    render(<VideoPostCta videoId="v1" />);
    expect(screen.getByTestId('video-post-cta').textContent).toContain(
      'Voir le pack ci-dessous',
    );
  });

  it('inclut la flèche ↓ décorative aria-hidden', () => {
    render(<VideoPostCta videoId="v1" />);
    const link = screen.getByTestId('video-post-cta');
    expect(link.textContent).toContain('↓');
    const arrow = link.querySelector('[aria-hidden="true"]');
    expect(arrow?.textContent).toBe('↓');
  });

  it('supporte un href custom (override de l\'ancre)', () => {
    render(<VideoPostCta videoId="v1" href="#autre-ancre" />);
    expect(screen.getByTestId('video-post-cta').getAttribute('href')).toBe(
      '#autre-ancre',
    );
  });

  it('supporte un label custom', () => {
    render(<VideoPostCta videoId="v1" label="Découvrir le pack" />);
    expect(screen.getByTestId('video-post-cta').textContent).toContain(
      'Découvrir le pack',
    );
  });
});

describe('VideoPostCta — interaction', () => {
  it('émet video_cta_click avec les bons params au clic', () => {
    render(<VideoPostCta videoId="rituel-4-gestes" />);
    fireEvent.click(screen.getByTestId('video-post-cta'));
    expect(emitMock).toHaveBeenCalledWith('video_cta_click', {
      video_id: 'rituel-4-gestes',
      cta_label: 'Voir le pack ci-dessous',
      cta_target: '#commander-femiglow',
    });
  });

  it('scrollIntoView appelé si l\'ancre cible existe dans le DOM', () => {
    const target = document.createElement('section');
    target.id = 'commander-femiglow';
    const scrollSpy = vi.fn();
    (target as any).scrollIntoView = scrollSpy;
    document.body.appendChild(target);

    render(<VideoPostCta videoId="v1" />);
    fireEvent.click(screen.getByTestId('video-post-cta'));

    expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  });

  it('ne crashe pas si l\'ancre cible n\'existe pas (laisse le navigateur faire)', () => {
    render(<VideoPostCta videoId="v1" />);
    expect(() => fireEvent.click(screen.getByTestId('video-post-cta'))).not.toThrow();
    expect(emitMock).toHaveBeenCalledTimes(1);
  });

  it('n\'intercepte pas un href absolu (laisse passer la navigation)', () => {
    render(<VideoPostCta videoId="v1" href="https://example.com" />);
    const link = screen.getByTestId('video-post-cta');
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(ev);
    // preventDefault n'a PAS été appelé (laissé au browser).
    expect(ev.defaultPrevented).toBe(false);
    expect(emitMock).toHaveBeenCalledWith('video_cta_click', expect.any(Object));
  });
});
