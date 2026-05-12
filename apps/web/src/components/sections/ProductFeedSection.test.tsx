/**
 * Tests composant <ProductFeedSection/>.
 *
 * Couvre :
 *  - rendu du heading h2 + kicker hero,
 *  - les 4 cartes de step (numéros 1-4 + titres),
 *  - les 3 promesses (icônes + labels),
 *  - le bandeau social proof (rating + reviews count + citation),
 *  - le CTA principal (CHA-246 — `CommanderAnchorButton` qui scroll-anchor
 *    vers le wizard embarqué `#commander-femiglow` ; tests CTA dédiés
 *    dans `CommanderAnchorButton.test.tsx`),
 *  - microcopy sous le CTA (Pricing #11),
 *  - aria-label sur la liste des gestes (a11y),
 *  - axe a11y clean.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';

import { ToastProvider } from '@/components/ui/Toast';
import { mockKitPageContent } from '@/data/mock/kit';
import { buildKitProductFeed } from '@/lib/products/feed/kit-feed';
import { expectNoAxeViolations } from '@/test/axe';

import { ProductFeedSection } from './ProductFeedSection';

const product = mockKitPageContent.product;
const feed = buildKitProductFeed(product, mockKitPageContent);

function renderSection() {
  return render(
    <ToastProvider>
      <ProductFeedSection feed={feed} product={product} />
    </ToastProvider>,
  );
}

describe('ProductFeedSection', () => {
  it('rend le heading hero en h2 (le h1 est dans HeroProduit)', () => {
    renderSection();
    const heading = screen.getByRole('heading', { level: 2, name: /rituel/i });
    expect(heading).toBeInTheDocument();
    expect(heading.id).toBe('product-feed-title');
  });

  it('expose les 4 gestes dans une liste ordonnée nommée', () => {
    renderSection();
    const list = screen.getByRole('list', { name: /quatre gestes/i });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    // Numéros 1..4 visibles dans les pastilles.
    ['1', '2', '3', '4'].forEach((n) => {
      expect(within(list).getByText(n)).toBeInTheDocument();
    });
    // Titres présents.
    expect(within(list).getByText(/préparez vos ongles/i)).toBeInTheDocument();
    expect(within(list).getByText(/appliquez la paste/i)).toBeInTheDocument();
    expect(within(list).getByText(/appliquez la powder/i)).toBeInTheDocument();
    expect(within(list).getByText(/polish\s*&\s*shine/i)).toBeInTheDocument();
  });

  it('expose les 3 promesses du visuel officiel', () => {
    renderSection();
    const claimsList = screen.getByRole('list', { name: /promesses/i });
    const items = within(claimsList).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(within(claimsList).getByText(/origine naturelle/i)).toBeInTheDocument();
    expect(within(claimsList).getByText(/sans produits chimiques/i)).toBeInTheDocument();
    expect(within(claimsList).getByText(/forts et éclatants/i)).toBeInTheDocument();
  });

  it('affiche le bandeau social proof avec rating + nombre + citation', () => {
    renderSection();
    const figure = screen.getByRole('figure', { name: /avis/i });
    expect(within(figure).getByText(`${feed.socialProof.rating.toFixed(1)}/5`)).toBeInTheDocument();
    expect(
      within(figure).getByText(new RegExp(`${feed.socialProof.reviewsCount}\\s*avis`)),
    ).toBeInTheDocument();
    expect(within(figure).getByText(new RegExp(feed.socialProof.quote))).toBeInTheDocument();
    expect(within(figure).getByText(new RegExp(feed.socialProof.authorLabel))).toBeInTheDocument();
  });

  it('affiche le bloc prix avec small word (Pricing #2) et microcopy dense (#11)', () => {
    renderSection();
    // pricePrefix peut contenir des espaces insécables (U+00A0) que la
    // normalisation testing-library aplatit ; on matche en regex souple.
    expect(screen.getByText(/tout compris/i)).toBeInTheDocument();
    // Microcopy dense : on cherche un fragment caractéristique au lieu du
    // littéral entier (séparateurs typographiques + espaces fins peuvent
    // varier).
    expect(screen.getByText(/livraison offerte au maroc/i)).toBeInTheDocument();
  });

  it('rend le CTA `CommanderAnchorButton` avec le label custom du feed (CHA-246)', () => {
    renderSection();
    // CHA-246 — Le CTA n'est plus `AddToCartButton` (qui redirigeait
    // vers `/panier`) : c'est `CommanderAnchorButton` qui scroll-anchor
    // vers le wizard funnel embarqué (`#commander-femiglow`). Le
    // libellé reste piloté par `feed.hero.ctaLabel`.
    const button = screen.getByRole('button', { name: new RegExp(feed.hero.ctaLabel, 'i') });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('data-testid', 'kit-commander-anchor-button');
  });

  it('expose un id de section ancrable (data-testid + id par défaut)', () => {
    renderSection();
    const section = screen.getByTestId('product-feed-section');
    expect(section).toHaveAttribute('id', 'product-feed');
  });

  it('respecte axe (a11y)', async () => {
    const { container } = renderSection();
    await expectNoAxeViolations(container);
  });
});
