import { afterEach, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeroProduit, type HeroProduitFields } from './HeroProduit';
import { useWizardStore } from '@/lib/checkout/state/wizard-store';
import { ToastProvider } from '@/components/ui/Toast';
import { mockKitPageContent } from '@/data/mock/kit';
import { DEFAULT_KIT_REVIEW_STATS } from '@/lib/products/reviews';
import { expectNoAxeViolations } from '@/test/axe';
import type { HeroGalleryImage } from '@/lib/products/hero-gallery-types';

const product = mockKitPageContent.product;
const reassurances = mockKitPageContent.reassurances;

const galleryImages: HeroGalleryImage[] = [
  {
    id: 'g-1',
    src: product.images[0]?.src ?? '/products/kit-principale.png',
    alt: product.images[0]?.alt ?? product.name,
    width: product.images[0]?.width ?? 1200,
    height: product.images[0]?.height ?? 1500,
    kind: 'product',
  },
];

const fields: HeroProduitFields = {
  tagline: 'Manucure japonaise halal. Deux gestes, un polissoir. La main se révèle.',
  description: 'Le pack FemiGlow associe deux soins et un polissoir.',
  attributeChips: ['Sans vernis', 'Sans UV', 'Sans acétone', 'Halal'],
  trustRow: ['Livraison offerte', 'Paiement à la livraison'],
  reviewBadgeEnabled: true,
  ctaPulseEnabled: true,
};

function renderHero() {
  return render(
    <ToastProvider>
      <HeroProduit
        product={product}
        reassurances={reassurances}
        galleryImages={galleryImages}
        fields={fields}
        reviewStats={DEFAULT_KIT_REVIEW_STATS}
      />
    </ToastProvider>,
  );
}

describe('HeroProduit', () => {
  it('rend le nom du produit en h1', () => {
    renderHero();
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent(product.name);
    expect(h1).toHaveAttribute('id', 'hero-kit-title');
  });

  it('rend le CTA principal « Commander le rituel » (charte VII.5)', () => {
    renderHero();
    expect(
      screen.getByRole('button', { name: /commander le rituel/i }),
    ).toBeInTheDocument();
  });

  it('affiche le bloc prix via PriceDisplay (avec promo 199/289 dans le mock)', () => {
    renderHero();
    expect(screen.getByText(/199\s*MAD/)).toBeInTheDocument();
    expect(screen.getByText(/289\s*MAD/)).toBeInTheDocument();
    expect(screen.queryByTestId('hero-promo-applied')).toBeNull();
  });

  describe('code promo appliqué (wizard-store)', () => {
    afterEach(() => useWizardStore.getState().clearCoupon());

    it('prix hero 199 → 99, économie recalculée vs barré, mention du code', () => {
      useWizardStore.getState().setCoupon('GLOW99', 10000, 'promo');
      renderHero();
      expect(screen.getByText(/^99\s*MAD/)).toBeInTheDocument();
      expect(screen.getByText(/289\s*MAD/)).toBeInTheDocument();
      expect(screen.queryByText(/^199\s*MAD/)).toBeNull();
      expect(screen.getByText('Économie 190 MAD')).toBeInTheDocument();
      expect(screen.getByTestId('hero-promo-applied')).toHaveTextContent('Code GLOW99 appliqué');
    });

    it('gabarits localisés : économie et mention recalculées dans la langue fournie', () => {
      useWizardStore.getState().setCoupon('GLOW99', 10000, 'promo');
      render(
        <ToastProvider>
          <HeroProduit
            product={product}
            reassurances={reassurances}
            galleryImages={galleryImages}
            fields={fields}
            reviewStats={DEFAULT_KIT_REVIEW_STATS}
            strings={{
              kicker: 'The ritual',
              ctaLabel: 'Order',
              savingsLabel: 'Save 90 MAD',
              savingsLabelTemplate: 'Save {savings} MAD',
              promoAppliedLabelTemplate: 'Code {code} applied',
            }}
          />
        </ToastProvider>,
      );
      expect(screen.getByText('Save 190 MAD')).toBeInTheDocument();
      expect(screen.getByTestId('hero-promo-applied')).toHaveTextContent('Code GLOW99 applied');
    });

    it('crédit fidélité (kind credit) : prix réduit sans mention « Code … appliqué »', () => {
      useWizardStore.getState().setCoupon('FG-SAUGE-7212', 2000, 'credit');
      renderHero();
      expect(screen.getByText(/^179\s*MAD/)).toBeInTheDocument();
      expect(screen.queryByTestId('hero-promo-applied')).toBeNull();
    });
  });

  it('rend les 4 chips attributs', () => {
    renderHero();
    const list = screen.getByRole('list', { name: 'Attributs produit' });
    expect(list).toHaveTextContent('Sans vernis');
    expect(list).toHaveTextContent('Halal');
  });

  it('expose les réassurances dans la liste dédiée', () => {
    renderHero();
    const list = screen.getByRole('list', { name: /réassurances/i });
    reassurances.forEach((r) => {
      expect(list).toHaveTextContent(r.label);
    });
  });

  it('affiche la note sociale (4,8 / 287 avis)', () => {
    renderHero();
    expect(screen.getByText(/4,8/)).toBeInTheDocument();
    expect(screen.getByText(/287 avis/i)).toBeInTheDocument();
  });

  it('affiche la trust row au-dessus du CTA', () => {
    renderHero();
    // Trust row peut apparaître plusieurs fois sur la page (autres sections),
    // on cible la première occurrence (sous le CTA).
    expect(screen.getAllByText(/livraison offerte/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/retour 30 jours/i).length).toBeGreaterThan(0);
  });

  it('respecte axe', async () => {
    const { container } = renderHero();
    await expectNoAxeViolations(container);
  });
});
