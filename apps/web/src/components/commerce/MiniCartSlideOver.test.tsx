import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MiniCartSlideOver } from './MiniCartSlideOver';
import { useCartStore } from '@/lib/stores/cart-store';

beforeEach(() => {
  act(() => {
    useCartStore.setState({ items: [], isMiniCartOpen: false, isOpen: false });
  });
});

describe('MiniCartSlideOver', () => {
  it('est masqué (aria-hidden) tant que isMiniCartOpen est false', () => {
    const { container } = render(<MiniCartSlideOver />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper).toHaveAttribute('aria-hidden', 'true');
  });

  it('s’affiche en dialog quand isMiniCartOpen passe à true', () => {
    render(<MiniCartSlideOver />);
    act(() => {
      useCartStore.setState({ isMiniCartOpen: true });
    });
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('affiche un état vide quand items est vide', () => {
    render(<MiniCartSlideOver />);
    act(() => {
      useCartStore.setState({ isMiniCartOpen: true });
    });
    expect(
      screen.getByText(/votre rituel est encore à composer/i),
    ).toBeInTheDocument();
  });

  it('liste les items et un sous-total formaté', () => {
    render(<MiniCartSlideOver />);
    act(() => {
      useCartStore.setState({
        isMiniCartOpen: true,
        items: [
          {
            productId: 'fg-kit-001',
            productSlug: 'le-rituel',
            productName: 'Le rituel FemiGlow',
            quantity: 2,
            unitPriceCents: 32000,
          },
        ],
      });
    });
    expect(screen.getByText('Le rituel FemiGlow')).toBeInTheDocument();
    expect(screen.getByText(/quantité 2/i)).toBeInTheDocument();
  });

  it('ferme le dialog sur Escape', async () => {
    const user = userEvent.setup();
    render(<MiniCartSlideOver />);
    act(() => {
      useCartStore.setState({ isMiniCartOpen: true });
    });
    await user.keyboard('{Escape}');
    expect(useCartStore.getState().isMiniCartOpen).toBe(false);
  });

  it('ferme le dialog au clic sur le bouton Fermer', async () => {
    const user = userEvent.setup();
    render(<MiniCartSlideOver />);
    act(() => {
      useCartStore.setState({ isMiniCartOpen: true });
    });
    await user.click(screen.getByRole('button', { name: /^fermer$/i }));
    expect(useCartStore.getState().isMiniCartOpen).toBe(false);
  });
});
