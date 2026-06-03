/**
 * StickyCartCTA — le prix actif est réduit par le crédit de fidélité (store),
 * en cohérence avec le bloc prix /kit et le récap du formulaire.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { StickyCartCTA } from './StickyCartCTA';
import { useWizardStore } from '@/lib/checkout/state/wizard-store';

vi.mock('@/components/chat/chat-store', () => ({ useChatStore: () => false }));

afterEach(() => {
  useWizardStore.getState().clearCoupon();
  cleanup();
});

function renderCTA(props: Partial<Parameters<typeof StickyCartCTA>[0]> = {}) {
  return render(
    <StickyCartCTA
      productName="Pack FemiGlow"
      priceCents={28900}
      promoPriceCents={19900}
      currency="MAD"
      observeId="sentinel"
      {...props}
    >
      <button>Commander</button>
    </StickyCartCTA>,
  );
}

describe('StickyCartCTA — crédit de fidélité', () => {
  it('sans crédit : affiche le prix actif 199', () => {
    const { container } = renderCTA();
    expect(container.textContent).toMatch(/199/);
  });

  it('avec crédit 2000c : prix actif réduit à 179 (barré 289 conservé)', () => {
    useWizardStore.setState({ creditCents: 2000, couponCode: 'FG-X' });
    const { container } = renderCTA();
    expect(container.textContent).toMatch(/179/);
    expect(container.textContent).toMatch(/289/);
  });

  it('sans promo : le crédit réduit directement le prix', () => {
    useWizardStore.setState({ creditCents: 2000, couponCode: 'FG-X' });
    const { container } = renderCTA({ priceCents: 19900, promoPriceCents: null });
    expect(container.textContent).toMatch(/179/);
  });

  it('crédit > prix : plancher 0', () => {
    useWizardStore.setState({ creditCents: 999999, couponCode: 'FG-X' });
    const { container } = renderCTA({ priceCents: 19900, promoPriceCents: null });
    expect(container.textContent).toMatch(/0\s*MAD/);
  });
});
