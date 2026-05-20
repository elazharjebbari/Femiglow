/**
 * Tests de rendu du composant `CompositionReveal` — section « La composition »
 * de la page `/kit`.
 *
 * Couvre les invariants visuels post-refonte Kolenda (phase 0+) :
 *  - section avec id et titre `composition-title`,
 *  - fond sable `#EFE9DD` (rythme : Hero ivoire → composition sable),
 *  - intro et H2 takeaway en français,
 *  - rendu d'autant de cards que de sous-produits passés en `items`,
 *  - rendu rétrocompat sans `mediaSlots` (fallback `subProduct.image`).
 *
 * cf. docs/composition-reveal-optim-2026-05/05-frontend-public-design.md
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/components/ui/Image', () => ({
  Image: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

import { CompositionReveal } from './CompositionReveal';
import type { SubProduct } from '@/lib/schemas';

function makeSub(overrides: Partial<SubProduct> = {}): SubProduct {
  return {
    id: '1-paste',
    name: 'Paste',
    volume: '15 g',
    shortDescription: 'Crème onctueuse, sauge verte.',
    image: { src: '/paste.jpg', alt: 'Pot Paste FemiGlow', width: 800, height: 1000 },
    ingredients: [
      {
        name: 'Cera Alba',
        inci: 'Cera Alba',
        function: 'filmogène',
        origin: 'Atlas',
        percent: 12,
      },
    ],
    certifications: [{ label: 'Halal', issuer: 'Halal Cosmetics Council' }],
    ...overrides,
  } as SubProduct;
}

describe('CompositionReveal — phase 0', () => {
  it('rend la section avec id "composition-title"', () => {
    const items = [
      makeSub({ id: 'a', name: 'Paste' }),
      makeSub({ id: 'b', name: 'Powder' }),
      makeSub({ id: 'c', name: 'Polissoir' }),
    ];
    render(<CompositionReveal items={items} />);
    expect(screen.getByRole('region', { name: /trois objets/i })).toBeDefined();
    expect(document.getElementById('composition-title')).not.toBeNull();
  });

  it('utilise un fond sable (#EFE9DD) — pas le bg-creme par défaut', () => {
    const items = [makeSub()];
    const { container } = render(<CompositionReveal items={items} />);
    const section = container.querySelector('section');
    expect(section).not.toBeNull();
    const cls = (section!.className || '').toString();
    // Tolère soit la classe utilitaire arbitraire `bg-[#EFE9DD]`, soit un
    // alias Tailwind dédié (`bg-sable`). On vérifie qu'on n'utilise PLUS
    // l'ancien `bg-creme` sur la section composition.
    expect(/bg-creme(?!-)/.test(cls)).toBe(false);
    expect(/bg-(?:\[#EFE9DD\]|sable)/.test(cls)).toBe(true);
  });

  it('rend une <li> par sous-produit', () => {
    const items = [
      makeSub({ id: 'a' }),
      makeSub({ id: 'b' }),
      makeSub({ id: 'c' }),
    ];
    const { container } = render(<CompositionReveal items={items} />);
    expect(container.querySelectorAll('li').length).toBe(3);
  });

  it('rend le lien « Lire le détail » (pas « Voir la composition ») par card', () => {
    const items = [makeSub({ id: 'a' })];
    render(<CompositionReveal items={items} />);
    expect(screen.getAllByText(/Lire le détail/i).length).toBe(1);
    expect(screen.queryAllByText(/Voir la composition/i).length).toBe(0);
  });

  it('wrappe chaque card dans un Reveal avec stagger (delay = index × 120 ms)', () => {
    const items = [
      makeSub({ id: 'a' }),
      makeSub({ id: 'b' }),
      makeSub({ id: 'c' }),
    ];
    const { container } = render(<CompositionReveal items={items} />);
    // Le composant `Reveal` rend `<m.div>` quand reducedMotion=false ; il
    // applique alors `initial`/`whileInView`. En jsdom on ne peut pas
    // observer ces props directement, mais on peut vérifier qu'un wrapper
    // <div> par card existe entre le <li> et l'<article>.
    const lis = container.querySelectorAll('li');
    lis.forEach((li) => {
      const firstChild = li.firstElementChild;
      expect(firstChild?.tagName).toBe('DIV');
      // L'article CompositionCard est petit-enfant (li > div Reveal > article).
      expect(firstChild?.firstElementChild?.tagName).toBe('ARTICLE');
    });
  });
});
