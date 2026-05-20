/**
 * Tests `PriceBlock` — bloc prix Pack §4.6.
 *
 * Couvre :
 *  - rendu prix XXL + prix barré
 *  - bandeau économie (rendu conditionnel)
 *  - valueBreakdown rendu si présent, absent sinon
 *  - perUsageHint rendu si présent
 *  - CTA label = hero.ctaLabel
 *  - tracking pack_section_view + pack_economy_view via IO mock custom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { PriceBlock } from './PriceBlock';
import type { ProductFeed } from '@/lib/products/feed/types';
import type { Product } from '@/lib/schemas';

const emitMock = vi.fn();

vi.mock('@/lib/tracking/use-tracking', () => ({
  useTracking: () => ({ emit: emitMock, consent: { analytics: 'granted' } }),
}));

vi.mock('@/components/commerce/CommanderAnchorButton', () => ({
  CommanderAnchorButton: ({ children }: { children: React.ReactNode }) => (
    <button data-testid="kit-commander-anchor-button">{children}</button>
  ),
}));

const product = {
  id: 'kit_femiglow',
  slug: 'kit-femiglow',
  name: 'Kit Manucure FemiGlow',
  description: 'Kit complet de soin des ongles',
  priceCents: 3500,
  promoPriceCents: null,
  currency: 'EUR',
  inStock: true,
  images: [
    { src: '/products/kit-principale.svg', alt: 'Kit FemiGlow', width: 800, height: 1000 },
  ],
} as unknown as Product;

const baseHero: ProductFeed['hero'] = {
  kicker: 'Le pack',
  title: 'Le rituel s’installe en deux gestes.',
  lead: 'Trois objets dans la main, deux gestes dans la soirée.',
  pricePrefix: 'Tout compris :',
  ctaLabel: 'Commander le rituel',
  ctaMicrocopy:
    'Paste · Powder · Polissoir Step 4 inclus · Livraison offerte · Retour 30 j.',
  priceCompareAt: '49 €',
  priceCompareAtAriaLabel: 'Prix non packagé 49 €',
  valueBreakdown: [
    { label: '1 Paste · 30 ml', valueLabel: '19 €' },
    { label: 'Notice', valueLabel: 'offert', muted: true },
  ],
  perUsageHint: '≈ 0,74 € par soin sur 47 jours',
  ctaAccent: 'sauge-dark',
};

function feedWith(overrides: Partial<ProductFeed['hero']> = {}): ProductFeed {
  return {
    productSlug: 'kit',
    locale: 'fr-FR',
    canonicalUrl: 'https://example.com/kit',
    imageUrl: 'https://example.com/og/kit.png',
    brand: 'FemiGlow',
    currency: 'EUR',
    priceMajor: 35,
    promoPriceMajor: null,
    availability: 'in_stock',
    description: 'desc',
    hero: { ...baseHero, ...overrides },
    steps: [],
    claims: [],
    socialProof: {
      reviewsCount: 287,
      rating: 4.8,
      quote: 'q',
      authorLabel: 'a',
    },
  } as unknown as ProductFeed;
}

beforeEach(() => {
  emitMock.mockReset();
});

afterEach(() => cleanup());

describe('PriceBlock — rendu', () => {
  it('affiche le prix XXL en majeurs', () => {
    render(<PriceBlock feed={feedWith()} product={product} />);
    const line = screen.getByTestId('pack-price-line');
    expect(line.textContent).toMatch(/35/);
    expect(line.textContent).toContain('EUR');
  });

  it('affiche le prix barré avec aria-label custom', () => {
    render(<PriceBlock feed={feedWith()} product={product} />);
    const compare = screen.getByTestId('pack-price-compare-at');
    expect(compare.textContent).toBe('49 €');
    expect(compare.getAttribute('aria-label')).toContain('non packagé');
  });

  it('affiche le bandeau économie « Vous économisez 14 € · 29 % »', () => {
    render(<PriceBlock feed={feedWith()} product={product} />);
    const badge = screen.getByTestId('pack-savings-badge');
    expect(badge.textContent).toContain('14');
    expect(badge.textContent).toContain('29');
    expect(badge.textContent).toMatch(/économisez/);
  });

  it('n’affiche PAS le bandeau économie si pas de priceCompareAt', () => {
    render(
      <PriceBlock
        feed={feedWith({ priceCompareAt: undefined })}
        product={product}
      />,
    );
    expect(screen.queryByTestId('pack-savings-badge')).toBeNull();
  });

  it('affiche valueBreakdown si items présents', () => {
    render(<PriceBlock feed={feedWith()} product={product} />);
    expect(screen.getByTestId('pack-value-breakdown')).toBeDefined();
    expect(screen.getByText('1 Paste · 30 ml')).toBeDefined();
  });

  it('n’affiche pas valueBreakdown si vide/undefined', () => {
    render(
      <PriceBlock
        feed={feedWith({ valueBreakdown: undefined })}
        product={product}
      />,
    );
    expect(screen.queryByTestId('pack-value-breakdown')).toBeNull();
  });

  it('affiche perUsageHint si présent', () => {
    render(<PriceBlock feed={feedWith()} product={product} />);
    expect(screen.getByTestId('pack-per-usage-hint').textContent).toMatch(
      /par soin/,
    );
  });

  it('CTA porte le label hero.ctaLabel', () => {
    render(<PriceBlock feed={feedWith()} product={product} />);
    expect(
      screen.getByTestId('kit-commander-anchor-button').textContent,
    ).toBe('Commander le rituel');
  });

  it('porte data-cta-accent depuis hero.ctaAccent', () => {
    render(<PriceBlock feed={feedWith()} product={product} />);
    const block = screen.getByTestId('pack-price-block');
    expect(block.getAttribute('data-cta-accent')).toBe('sauge-dark');
  });

  it('fallback ctaAccent=champagne si non fourni', () => {
    render(
      <PriceBlock
        feed={feedWith({ ctaAccent: undefined })}
        product={product}
      />,
    );
    expect(
      screen.getByTestId('pack-price-block').getAttribute('data-cta-accent'),
    ).toBe('champagne');
  });

  it('affiche la microcopy CTA en bas', () => {
    render(<PriceBlock feed={feedWith()} product={product} />);
    expect(screen.getByText(/Paste · Powder/)).toBeDefined();
  });
});

describe('PriceBlock — tracking IO', () => {
  it('attache IntersectionObserver au mount et émet pack_section_view + pack_economy_view au franchissement', () => {
    // Mock IO qui déclenche immédiatement à 0.6 (>= 0.3 et >= 0.5).
    type Cb = (entries: IntersectionObserverEntry[]) => void;
    const captured: { current: Cb | null } = { current: null };
    const observeMock = vi.fn();
    const disconnectMock = vi.fn();
    class IOTrigger {
      constructor(cb: Cb) {
        captured.current = cb;
      }
      observe = observeMock;
      unobserve = vi.fn();
      disconnect = disconnectMock;
      takeRecords = () => [];
      root = null;
      rootMargin = '';
      thresholds = [0.3, 0.5];
    }
    const original = window.IntersectionObserver;
    // @ts-expect-error mock
    window.IntersectionObserver = IOTrigger;

    try {
      render(<PriceBlock feed={feedWith()} product={product} />);
      // Simule l'entrée dans le viewport.
      captured.current?.([
        { isIntersecting: true, intersectionRatio: 0.6 } as IntersectionObserverEntry,
      ]);
      expect(emitMock).toHaveBeenCalled();
      const events = emitMock.mock.calls.map((c) => c[0]);
      expect(events).toContain('pack_section_view');
      expect(events).toContain('pack_economy_view');
      // pack_economy_view params
      const economyCall = emitMock.mock.calls.find(
        (c) => c[0] === 'pack_economy_view',
      );
      expect(economyCall?.[1]).toMatchObject({
        savings_eur: 14,
        savings_pct: 29,
      });
    } finally {
      window.IntersectionObserver = original;
    }
  });
});
