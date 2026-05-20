/**
 * Tests `PostCtaLink` — lien éditorial réutilisable sous chaque sous-produit
 * (et autre contexte conversion).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const emitMock = vi.fn();
vi.mock('@/lib/tracking/use-tracking', () => ({
  useTracking: () => ({ emit: emitMock }),
}));

import { PostCtaLink } from './PostCtaLink';

beforeEach(() => {
  emitMock.mockReset();
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('PostCtaLink — rendu', () => {
  it('rend un <a> avec href par défaut #commander-femiglow', () => {
    render(<PostCtaLink subProductId="1-paste" />);
    const link = screen.getByTestId('composition-post-cta-1-paste');
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('#commander-femiglow');
  });

  it('affiche « Voir le pack ↓ »', () => {
    render(<PostCtaLink subProductId="1-paste" />);
    const link = screen.getByTestId('composition-post-cta-1-paste');
    expect(link.textContent).toContain('Voir le pack');
    expect(link.textContent).toContain('↓');
  });

  it('supporte un href custom', () => {
    render(<PostCtaLink subProductId="2-powder" href="#autre" />);
    expect(
      screen.getByTestId('composition-post-cta-2-powder').getAttribute('href'),
    ).toBe('#autre');
  });
});

describe('PostCtaLink — interaction', () => {
  it('émet composition_post_cta_click au clic avec subProductId et cta_target', () => {
    render(<PostCtaLink subProductId="1-paste" />);
    fireEvent.click(screen.getByTestId('composition-post-cta-1-paste'));
    expect(emitMock).toHaveBeenCalledWith('composition_post_cta_click', {
      sub_product_id: '1-paste',
      cta_target: '#commander-femiglow',
    });
  });

  it('scrollIntoView appelé si l\'ancre cible existe dans le DOM', () => {
    const target = document.createElement('section');
    target.id = 'commander-femiglow';
    const scrollSpy = vi.fn();
    (target as any).scrollIntoView = scrollSpy;
    document.body.appendChild(target);

    render(<PostCtaLink subProductId="3-polissoir" />);
    fireEvent.click(screen.getByTestId('composition-post-cta-3-polissoir'));
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  });

  it('ne crashe pas si l\'ancre cible n\'existe pas', () => {
    render(<PostCtaLink subProductId="1-paste" />);
    expect(() =>
      fireEvent.click(screen.getByTestId('composition-post-cta-1-paste')),
    ).not.toThrow();
    expect(emitMock).toHaveBeenCalledTimes(1);
  });
});
