import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ShippingPriceDisplay } from './ShippingPriceDisplay';

describe('<ShippingPriceDisplay />', () => {
  it('affiche le prix tel quel quand freeShipping=false', () => {
    render(
      <ShippingPriceDisplay displayPrice="19 MAD" freeShipping={false} />,
    );
    expect(screen.getByText('19 MAD')).toBeInTheDocument();
    expect(screen.queryByText('Offerte')).not.toBeInTheDocument();
  });

  it('barre le prix et affiche "Offerte" quand freeShipping=true', () => {
    const { container } = render(
      <ShippingPriceDisplay displayPrice="19 MAD" freeShipping />,
    );
    expect(screen.getByText('19 MAD')).toBeInTheDocument();
    expect(screen.getByText('Offerte')).toBeInTheDocument();
    // Le prix barré doit porter la classe line-through (visuel)
    const struck = screen.getByText('19 MAD');
    expect(struck.className).toMatch(/line-through/);
    // Et avoir aria-hidden pour ne pas être lu deux fois par SR
    expect(struck.getAttribute('aria-hidden')).toBe('true');
    // Le wrapper porte le data-attribute pour scraping/test
    expect(
      container.querySelector('[data-free-shipping="true"]'),
    ).toBeInTheDocument();
  });

  it('expose un srNote lisible par lecteur d\'écran', () => {
    render(
      <ShippingPriceDisplay
        displayPrice="19 MAD"
        freeShipping
        srNote="Livraison normalement à 19 MAD, actuellement offerte"
      />,
    );
    expect(
      screen.getByText(
        /Livraison normalement à 19 MAD, actuellement offerte/,
      ),
    ).toBeInTheDocument();
  });

  it('respecte la prop size pour la taille typographique', () => {
    const { rerender, container } = render(
      <ShippingPriceDisplay displayPrice="19 MAD" freeShipping size="xs" />,
    );
    expect(container.querySelector('.text-xs')).toBeInTheDocument();
    rerender(
      <ShippingPriceDisplay displayPrice="19 MAD" freeShipping size="md" />,
    );
    expect(container.querySelector('.text-base')).toBeInTheDocument();
  });
});
