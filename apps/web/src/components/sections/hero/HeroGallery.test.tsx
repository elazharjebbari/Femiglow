import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeroGallery } from './HeroGallery';
import type { HeroGalleryImage } from '@/lib/products/hero-gallery-types';

// jsdom matchMedia n'est pas matchant par défaut → simule mobile (< 1024px)
beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('reduce') ? false : false, // mobile = false sur min-width
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

const IMG = (id: string, kind: HeroGalleryImage['kind'] = 'product'): HeroGalleryImage => ({
  id,
  src: `/${id}.jpg`,
  alt: id,
  width: 1200,
  height: 1500,
  kind,
});

describe('HeroGallery', () => {
  it('ne rend rien si images vide', () => {
    const { container } = render(<HeroGallery images={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('rend juste une image principale si 1 seule (pas de nav)', () => {
    render(<HeroGallery images={[IMG('one')]} />);
    expect(screen.queryByRole('region', { name: /galerie/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('rend une region avec aria-label pour N>=2 images', () => {
    render(<HeroGallery images={[IMG('a'), IMG('b'), IMG('c')]} />);
    expect(screen.getByRole('region', { name: /galerie produit/i })).toBeInTheDocument();
  });

  it("appelle onChange à l'init avec l'image active", () => {
    const onChange = vi.fn();
    const images = [IMG('a'), IMG('b')];
    render(<HeroGallery images={images} onChange={onChange} />);
    expect(onChange).toHaveBeenCalledWith(0, images[0]);
  });

  it('respecte initialIndex valide', () => {
    const onChange = vi.fn();
    const images = [IMG('a'), IMG('b'), IMG('c')];
    render(<HeroGallery images={images} initialIndex={2} onChange={onChange} />);
    expect(onChange).toHaveBeenCalledWith(2, images[2]);
  });
});

describe('HeroGallery — art direction (images par audience)', () => {
  const ART = (id: string): HeroGalleryImage => ({
    ...IMG(id),
    src: `/_media/${id}-desktop.webp`,
    mobile: { src: `/_media/${id}-mobile.webp`, width: 1200, height: 1600 },
  });

  function highPriorityImgs(container: HTMLElement): HTMLImageElement[] {
    return Array.from(container.querySelectorAll('img')).filter(
      (img) => (img.getAttribute('fetchpriority') ?? img.getAttribute('fetchPriority')) === 'high',
    );
  }

  it('seule l’image d’index 0 est prioritaire ; les autres slides sont lazy', () => {
    const { container } = render(<HeroGallery images={[ART('a'), ART('b'), IMG('c', 'review')]} />);
    const high = highPriorityImgs(container);
    expect(high.length).toBeGreaterThan(0);
    for (const img of high) expect(img.getAttribute('src')).toContain('a-desktop');
    const slides = container.querySelectorAll('[data-slide-index]');
    expect(slides[1]!.querySelector('img')!.getAttribute('loading')).toBe('lazy');
  });

  it('arbres desktop et mobile : même <picture> pour l’image 0 (une seule requête)', () => {
    const { container } = render(<HeroGallery images={[ART('a'), ART('b')]} />);
    const pictures = Array.from(container.querySelectorAll('picture')).filter((p) =>
      p.querySelector('img')!.getAttribute('src')!.includes('a-desktop'),
    );
    expect(pictures).toHaveLength(2);
    expect(pictures[0]!.outerHTML).toBe(pictures[1]!.outerHTML);
  });

  it('image unique art-dirigée : <picture> prioritaire', () => {
    const { container } = render(<HeroGallery images={[ART('solo')]} />);
    expect(container.querySelectorAll('picture')).toHaveLength(1);
    expect(highPriorityImgs(container)).toHaveLength(1);
  });

  it('sans art direction : aucun <picture> (rendu historique)', () => {
    const { container } = render(<HeroGallery images={[IMG('a'), IMG('b')]} />);
    expect(container.querySelector('picture')).toBeNull();
  });
});
