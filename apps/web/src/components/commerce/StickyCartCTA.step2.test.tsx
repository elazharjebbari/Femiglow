/**
 * Faux CTA de l'étape 2 : « Je commande » restait affiché sur le formulaire,
 * le tap ne faisait que déplacer la page, et le prix sans livraison
 * contredisait le récapitulatif.
 */
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { COMMANDER_ANCHOR_ID } from '@/lib/checkout/commander-launcher';
import { useWizardStore } from '@/lib/checkout/state/wizard-store';
import { StickyCartCTA } from './StickyCartCTA';

type Observed = { target: Element; callback: IntersectionObserverCallback };
let observed: Observed[] = [];

class FakeIntersectionObserver {
  constructor(private readonly callback: IntersectionObserverCallback) {}
  observe(target: Element) {
    observed.push({ target, callback: this.callback });
  }
  disconnect() {
    observed = observed.filter((o) => o.callback !== this.callback);
  }
  unobserve() {}
  takeRecords() {
    return [];
  }
}

function setOnScreen(id: string, isIntersecting: boolean) {
  act(() => {
    for (const { target, callback } of observed) {
      if (target.id !== id) continue;
      callback(
        [{ isIntersecting, target } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    }
  });
}

function setup() {
  render(
    <>
      <div id="hero" />
      <section id={COMMANDER_ANCHOR_ID} />
      <StickyCartCTA productName="Kit" priceCents={19900} currency="MAD" observeId="hero">
        <button type="button">Je commande</button>
      </StickyCartCTA>
    </>,
  );
  // Hero sorti de l'écran : la barre s'affiche.
  setOnScreen('hero', false);
  return screen.getByTestId('sticky-cart-cta');
}

beforeEach(() => {
  observed = [];
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
  useWizardStore.getState().reset();
});
afterEach(() => vi.unstubAllGlobals());

describe('StickyCartCTA et le formulaire', () => {
  it('étape 1 : la barre reste affichée sur le formulaire', () => {
    const bar = setup();
    expect(bar).toHaveAttribute('data-visible', 'true');
  });

  it('étape 2, formulaire à l’écran : la barre disparaît', () => {
    useWizardStore.setState({ currentStep: 'address' });
    const bar = setup();
    setOnScreen(COMMANDER_ANCHOR_ID, true);
    expect(bar).toHaveAttribute('data-visible', 'false');
    expect(bar).toHaveAttribute('aria-hidden', 'true');
  });

  it('étape 2, cliente revenue plus haut dans la page : la barre la ramène', () => {
    useWizardStore.setState({ currentStep: 'address' });
    const bar = setup();
    setOnScreen(COMMANDER_ANCHOR_ID, true);
    setOnScreen(COMMANDER_ANCHOR_ID, false);
    expect(bar).toHaveAttribute('data-visible', 'true');
  });

  it('remerciement : pas de nouvelle invitation sur le formulaire', () => {
    useWizardStore.setState({ currentStep: 'thank_you' });
    const bar = setup();
    setOnScreen(COMMANDER_ANCHOR_ID, true);
    expect(bar).toHaveAttribute('data-visible', 'false');
  });

  it('retour à l’étape 1 avec une ville : pas de second prix sans livraison', () => {
    useWizardStore.getState().mergeAddressDraft({ city: 'Rabat' });
    const bar = setup();
    setOnScreen(COMMANDER_ANCHOR_ID, true);
    expect(bar).toHaveAttribute('data-visible', 'false');
  });

  it('barre retirée : l’onglet du code ne reste pas seul à l’écran', () => {
    useWizardStore.setState({
      currentStep: 'address',
      couponCode: 'GLOW99',
      creditCents: 10000,
      couponKind: 'promo',
    });
    setup();
    setOnScreen(COMMANDER_ANCHOR_ID, true);
    expect(screen.queryByTestId('sticky-promo-flag')).not.toBeInTheDocument();
  });

  it('passage à l’étape 2 pendant que le formulaire est à l’écran', () => {
    const bar = setup();
    expect(bar).toHaveAttribute('data-visible', 'true');
    act(() => useWizardStore.setState({ currentStep: 'address' }));
    setOnScreen(COMMANDER_ANCHOR_ID, true);
    expect(bar).toHaveAttribute('data-visible', 'false');
  });
});
