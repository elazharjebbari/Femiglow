/**
 * StickyPromoFlag — l'onglet « Code X appliqué » n'existe QUE pour un code
 * promo réellement appliqué ; au clic : message « déjà appliqué », tracking,
 * scroll vers le formulaire.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

const { emit, scrollToCommander } = vi.hoisted(() => ({ emit: vi.fn(), scrollToCommander: vi.fn() }));
vi.mock('@/lib/tracking/use-tracking', () => ({ useTracking: () => ({ emit }) }));
vi.mock('@/components/commerce/CommanderAnchorButton', () => ({ scrollToCommander }));
vi.mock('@/components/chat/chat-store', () => ({ useChatStore: () => false }));

import { ToastProvider } from '@/components/ui/Toast';
import { useWizardStore } from '@/lib/checkout/state/wizard-store';
import { StickyCartCTA } from './StickyCartCTA';
import { StickyPromoFlag } from './StickyPromoFlag';

beforeEach(() => {
  emit.mockClear();
  scrollToCommander.mockClear();
});

afterEach(() => {
  useWizardStore.getState().clearCoupon();
  vi.useRealTimers();
  cleanup();
});

function applyPromo() {
  useWizardStore.setState({ creditCents: 10000, couponCode: 'glow99', couponKind: 'promo' });
}

describe('StickyPromoFlag', () => {
  it('sans code : rien n’est rendu', () => {
    const { container } = render(<StickyPromoFlag currency="MAD" />);
    expect(container.innerHTML).toBe('');
  });

  it('crédit de fidélité (pas un code promo) : rien n’est rendu', () => {
    useWizardStore.setState({ creditCents: 2000, couponCode: 'FG-X', couponKind: 'credit' });
    const { container } = render(<StickyPromoFlag currency="MAD" />);
    expect(container.innerHTML).toBe('');
  });

  it('code mémorisé sans montant : rien n’est rendu', () => {
    useWizardStore.setState({ creditCents: 0, couponCode: 'GLOW99', couponKind: 'promo' });
    const { container } = render(<StickyPromoFlag currency="MAD" />);
    expect(container.innerHTML).toBe('');
  });

  it('code promo appliqué : « Code GLOW99 appliqué » et nom accessible avec le montant', () => {
    applyPromo();
    render(<StickyPromoFlag currency="MAD" />);
    const flag = screen.getByTestId('sticky-promo-flag');
    expect(screen.getByTestId('sticky-promo-flag-label').textContent).toBe('Code GLOW99 appliqué');
    expect(flag.getAttribute('aria-label')).toMatch(/GLOW99.*100\s*MAD/);
  });

  it('clic : message « déjà appliqué », cta_click tracké, scroll vers le formulaire', () => {
    vi.useFakeTimers();
    applyPromo();
    render(
      <ToastProvider>
        <StickyPromoFlag currency="MAD" />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByTestId('sticky-promo-flag'));
    expect(screen.getByRole('status').textContent).toMatch(/GLOW99 est déjà appliqué : −100\s*MAD/);
    expect(emit).toHaveBeenCalledWith('cta_click', {
      cta_intent: 'promo_flag',
      label: 'GLOW99',
      destination: '#commander-femiglow',
      component_id: 'sticky_promo_flag',
    });
    expect(scrollToCommander).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(scrollToCommander).toHaveBeenCalledWith('commander-femiglow');
  });

  it('hors ToastProvider : le clic ne lève pas et scrolle quand même', () => {
    vi.useFakeTimers();
    applyPromo();
    render(<StickyPromoFlag currency="MAD" />);
    expect(() => fireEvent.click(screen.getByTestId('sticky-promo-flag'))).not.toThrow();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(scrollToCommander).toHaveBeenCalledTimes(1);
  });

  it('libellés localisés (AR) : le code reste en LTR dans la phrase', () => {
    applyPromo();
    render(
      <StickyPromoFlag
        currency="MAD"
        locale="ar"
        strings={{ label: 'الرمز {code} مُطبَّق', toast: '{code} {amount}', aria: '{code} {amount}' }}
      />,
    );
    const label = screen.getByTestId('sticky-promo-flag-label');
    expect(label.textContent).toBe('الرمز GLOW99 مُطبَّق');
    expect(label.querySelector('[dir="ltr"]')?.textContent).toBe('GLOW99');
  });
});

describe('StickyCartCTA — flag promo', () => {
  function renderCTA() {
    return render(
      <StickyCartCTA
        productName="Pack FemiGlow"
        priceCents={28900}
        promoPriceCents={19900}
        currency="MAD"
        observeId="sentinel"
      >
        <button>Commander</button>
      </StickyCartCTA>,
    );
  }

  it('sans code : la sticky ne contient pas de flag', () => {
    renderCTA();
    expect(screen.queryByTestId('sticky-promo-flag')).toBeNull();
  });

  it('avec GLOW99 : flag présent, prix 99', () => {
    applyPromo();
    const { container } = renderCTA();
    expect(screen.getByTestId('sticky-promo-flag')).toBeTruthy();
    expect(container.textContent).toMatch(/99\s*MAD/);
  });
});
