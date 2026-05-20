/**
 * Tests `CompositionCard` — card refondue de la section « La composition ».
 *
 * Couvre les invariants Kolenda :
 *  - pastille numérotée 01/02/03 avec couleur d'accent,
 *  - titre + volume inline en tabular-nums,
 *  - sensation rendue uniquement si présente, encadrée par « … »,
 *  - lien « Lire le détail » avec href attendu,
 *  - fallback média via `subProduct.image` si `mediaSlot` absent.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/components/ui/Image', () => ({
  Image: ({ alt }: { alt: string }) => <img alt={alt} data-testid="img-fallback" />,
}));

import { CompositionCard } from './CompositionCard';
import type { SubProduct } from '@/lib/schemas';

function makeSub(overrides: Partial<SubProduct> = {}): SubProduct {
  return {
    id: '1-paste',
    name: '1 Paste',
    shortDescription: 'Crème onctueuse, sauge verte.',
    volume: '15 g',
    sensation: 'Tiède au contact.',
    accentColor: 'sauge',
    image: { src: '/p.jpg', alt: 'Paste pot', width: 800, height: 1000 },
    ingredients: [
      { name: 'x', inci: 'x', function: 'x', origin: 'x' },
    ],
    certifications: [],
    ...overrides,
  } as SubProduct;
}

describe('CompositionCard — rendu de base', () => {
  it('rend la pastille numérotée formatée (01 pour index 0)', () => {
    render(<CompositionCard subProduct={makeSub()} index={0} />);
    expect(screen.getByTestId('composition-number-badge').textContent).toBe('01');
  });

  it('applique la couleur sauge pour accentColor sauge', () => {
    render(<CompositionCard subProduct={makeSub({ accentColor: 'sauge' })} index={0} />);
    const badge = screen.getByTestId('composition-number-badge') as HTMLElement;
    expect(badge.style.color).toBe('rgb(168, 184, 158)');
  });

  it('fallback champagne si accentColor absent', () => {
    render(<CompositionCard subProduct={makeSub({ accentColor: undefined })} index={0} />);
    expect((screen.getByTestId('composition-number-badge') as HTMLElement).style.color).toBe(
      'rgb(184, 149, 107)',
    );
  });

  it('rend le titre suivi du volume inline (« 1 Paste · 15 g »)', () => {
    const { container } = render(<CompositionCard subProduct={makeSub()} index={0} />);
    const h3 = container.querySelector('h3');
    // L'espace entre le nom et le `·` est fourni par `ml-2` (marge CSS) — il
    // n'apparaît PAS dans `textContent`. On vérifie donc la concaténation
    // logique (nom + séparateur + volume) sans préjuger du whitespace.
    const text = h3?.textContent?.replace(/\s+/g, ' ').trim();
    expect(text).toMatch(/^1 Paste\s*·\s*15 g$/);
  });

  it('lowercase le volume (15 G → 15 g)', () => {
    const { container } = render(
      <CompositionCard subProduct={makeSub({ volume: '15 G' })} index={0} />,
    );
    expect(container.querySelector('h3')?.textContent).toContain('· 15 g');
  });

  it('rend la sensation entre guillemets si présente', () => {
    render(<CompositionCard subProduct={makeSub()} index={0} />);
    expect(screen.getByTestId('composition-card-sensation').textContent).toBe(
      '« Tiède au contact. »',
    );
  });

  it('omet la sensation si absente du SubProduct', () => {
    render(<CompositionCard subProduct={makeSub({ sensation: undefined })} index={0} />);
    expect(screen.queryByTestId('composition-card-sensation')).toBeNull();
  });
});

describe('CompositionCard — lien détail', () => {
  it('rend le lien si detailsHref fourni', () => {
    render(
      <CompositionCard
        subProduct={makeSub()}
        index={0}
        detailsHref="#ingredients-1-paste"
      />,
    );
    const link = screen.getByTestId('composition-card-link-1-paste') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('#ingredients-1-paste');
    expect(link.textContent).toContain('Lire le détail');
  });

  it('omet le lien si detailsHref absent', () => {
    render(<CompositionCard subProduct={makeSub()} index={0} />);
    expect(screen.queryByTestId('composition-card-link-1-paste')).toBeNull();
  });
});

describe('CompositionCard — media', () => {
  it('utilise le mediaSlot si fourni', () => {
    render(
      <CompositionCard
        subProduct={makeSub()}
        index={0}
        mediaSlot={<div data-testid="custom-slot">slot</div>}
      />,
    );
    expect(screen.getByTestId('custom-slot')).toBeDefined();
    expect(screen.queryByTestId('img-fallback')).toBeNull();
  });

  it('fallback sur subProduct.image si mediaSlot absent', () => {
    render(<CompositionCard subProduct={makeSub()} index={0} />);
    expect(screen.getByTestId('img-fallback')).toBeDefined();
  });
});
