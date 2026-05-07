import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeroProduit } from './HeroProduit';
import { ToastProvider } from '@/components/ui/Toast';
import { mockKitPageContent } from '@/data/mock/kit';
import { expectNoAxeViolations } from '@/test/axe';

const product = mockKitPageContent.product;
const reassurances = mockKitPageContent.reassurances;

function renderHero() {
  return render(
    <ToastProvider>
      <HeroProduit product={product} reassurances={reassurances} />
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

  it('rend le CTA principal « Composer mon rituel » (charte VII.5)', () => {
    renderHero();
    expect(
      screen.getByRole('button', { name: /composer mon rituel/i }),
    ).toBeInTheDocument();
  });

  it('affiche le bloc prix via PriceDisplay (sans promo dans le mock)', () => {
    renderHero();
    // mockKit : 32000 cents MAD → "320 MAD"
    expect(screen.getByText(/320\s*MAD/)).toBeInTheDocument();
    // Pas de prix barré, pas de label « Économisez »
    expect(screen.queryByText(/Économisez/i)).not.toBeInTheDocument();
  });

  it('expose les réassurances dans la liste dédiée', () => {
    renderHero();
    const list = screen.getByRole('list', { name: /réassurances/i });
    reassurances.forEach((r) => {
      expect(list).toHaveTextContent(r.label);
    });
  });

  it('respecte axe', async () => {
    const { container } = renderHero();
    await expectNoAxeViolations(container);
  });
});
