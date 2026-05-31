import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddToCartButton } from './AddToCartButton';
import { ToastProvider } from '@/components/ui/Toast';
import { useCartStore } from '@/lib/stores/cart-store';
import { mockKit } from '@/data/mock/product';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

function renderWithProviders(ui: React.ReactNode) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

beforeEach(() => {
  act(() => {
    useCartStore.setState({ items: [], isMiniCartOpen: false, isOpen: false });
  });
  pushMock.mockClear();
});

describe('AddToCartButton', () => {
  it('rend le libellé par défaut « Commander le rituel » (intention d\'achat claire)', () => {
    renderWithProviders(<AddToCartButton product={mockKit} />);
    expect(
      screen.getByRole('button', { name: /commander le rituel/i }),
    ).toBeInTheDocument();
  });

  it('ajoute l’item au panier et ouvre le mini-cart au clic', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddToCartButton product={mockKit} />);
    await user.click(screen.getByRole('button', { name: /commander/i }));
    const state = useCartStore.getState();
    expect(state.items).toHaveLength(1);
    expect(state.items[0]?.productId).toBe(mockKit.id);
    expect(state.isMiniCartOpen).toBe(true);
  });

  it('affiche un toast de confirmation', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddToCartButton product={mockKit} />);
    await user.click(screen.getByRole('button', { name: /commander/i }));
    expect(await screen.findByText(/ajouté à votre rituel/i)).toBeInTheDocument();
  });

  it('cumule la quantité si l’item existe déjà', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddToCartButton product={mockKit} />);
    const button = screen.getByRole('button', { name: /commander/i });
    await user.click(button);
    await user.click(button);
    expect(useCartStore.getState().items[0]?.quantity).toBe(2);
  });

  it('utilise le prix promo (effectif) pour le panier quand une promo est active', async () => {
    const user = userEvent.setup();
    const promoKit = {
      ...mockKit,
      priceCents: 40000,
      promoPriceCents: 32000,
    };
    renderWithProviders(<AddToCartButton product={promoKit} />);
    await user.click(screen.getByRole('button', { name: /commander/i }));
    const state = useCartStore.getState();
    expect(state.items[0]?.unitPriceCents).toBe(32000);
  });

  it('ignore une promo incohérente (>= prix barré) — fallback prix barré', async () => {
    const user = userEvent.setup();
    const badPromo = {
      ...mockKit,
      priceCents: 32000,
      promoPriceCents: 40000,
    };
    renderWithProviders(<AddToCartButton product={badPromo} />);
    await user.click(screen.getByRole('button', { name: /commander/i }));
    const state = useCartStore.getState();
    expect(state.items[0]?.unitPriceCents).toBe(32000);
  });

  it('avec redirectTo : ajoute au panier sans ouvrir le mini-cart, puis route vers la cible', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddToCartButton product={mockKit} redirectTo="/panier" />);
    await user.click(screen.getByRole('button', { name: /commander/i }));
    const state = useCartStore.getState();
    expect(state.items).toHaveLength(1);
    expect(state.isMiniCartOpen).toBe(false);
    expect(pushMock).toHaveBeenCalledWith('/panier');
  });
});
