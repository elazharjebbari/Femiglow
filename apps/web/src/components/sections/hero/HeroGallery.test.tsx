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
