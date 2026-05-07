import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PriceDisplay } from './PriceDisplay';

describe('PriceDisplay', () => {
  it('rend un prix simple quand aucune promo', () => {
    render(<PriceDisplay priceCents={32000} currency="MAD" />);
    // formatPrice MAD → "320 MAD"
    expect(screen.getByText(/320\s*MAD/)).toBeInTheDocument();
  });

  it('rend prix actif + barré quand promo active', () => {
    const { container } = render(
      <PriceDisplay priceCents={40000} promoPriceCents={32000} currency="MAD" />,
    );
    // Le prix actif (320 MAD) et le prix barré (400 MAD) doivent tous deux
    // être présents dans le DOM.
    expect(screen.getByText(/320\s*MAD/)).toBeInTheDocument();
    expect(screen.getByText(/400\s*MAD/)).toBeInTheDocument();
    // Vérifie que le prix barré porte la classe line-through (sans dépendre
    // du DOM exact, on cherche un descendant strikethrough).
    const struck = container.querySelector('.line-through');
    expect(struck?.textContent).toMatch(/400\s*MAD/);
  });

  it('affiche le label « Économisez … » quand showSavings (default)', () => {
    render(
      <PriceDisplay priceCents={40000} promoPriceCents={32000} currency="MAD" />,
    );
    expect(screen.getByText(/Économisez/i)).toBeInTheDocument();
  });

  it('masque le label quand showSavings=false (sticky compacte)', () => {
    render(
      <PriceDisplay
        priceCents={40000}
        promoPriceCents={32000}
        currency="MAD"
        showSavings={false}
      />,
    );
    expect(screen.queryByText(/Économisez/i)).not.toBeInTheDocument();
  });

  it('ignore une promo invalide (>= prix) → fallback prix simple', () => {
    render(
      <PriceDisplay priceCents={32000} promoPriceCents={40000} currency="MAD" />,
    );
    // Pas de prix barré rendu
    expect(screen.queryByText(/400\s*MAD/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Économisez/i)).not.toBeInTheDocument();
    expect(screen.getByText(/320\s*MAD/)).toBeInTheDocument();
  });

  it('aria-label décrit prix actif + prix initial quand promo active', () => {
    render(
      <PriceDisplay priceCents={40000} promoPriceCents={32000} currency="MAD" />,
    );
    expect(
      screen.getByLabelText(/Prix : 320\s*MAD, prix initial 400\s*MAD/),
    ).toBeInTheDocument();
  });
});
