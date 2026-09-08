/**
 * Invariant « page sans code strictement intacte ».
 *
 * Deux niveaux d'oracle :
 *
 *  A. UNITAIRE — le prédicat et l'arithmétique. Sans code, le sélecteur rend
 *     la MÊME référence gelée et `applyCouponToPrice` est l'identité.
 *
 *  B. DOM DIFF — l'oracle qui compte pour le client. On rend une surface
 *     coupon-aware SANS code, on capture `innerHTML` comme RÉFÉRENCE, puis on
 *     applique/retire un coupon et on re-rend : le HTML sans code doit être
 *     STRICTEMENT ÉGAL à la référence (`toBe`, pas `toContain`). Un fragment
 *     vide, une classe conditionnelle, un `data-*` ajouté, un espace en plus
 *     font échouer le test — c'est le but.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, act } from '@testing-library/react';

import { useWizardStore } from './wizard-store';
import {
  NO_COUPON,
  applyCouponToPrice,
  selectAppliedCoupon,
  useAppliedCoupon,
} from './use-applied-coupon';

afterEach(() => {
  act(() => {
    useWizardStore.getState().clearCoupon();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// A. Prédicat pur
// ─────────────────────────────────────────────────────────────────────────

describe('selectAppliedCoupon — définition unique de « visiteuse promo »', () => {
  it('store neutre → la référence gelée NO_COUPON (identité, pas une copie)', () => {
    expect(selectAppliedCoupon({ couponCode: null, creditCents: 0, couponKind: null })).toBe(
      NO_COUPON,
    );
  });

  it('code mémorisé mais pas encore re-validé (creditCents 0) → NO_COUPON', () => {
    // Garde anti-422 : un code sans montant ne doit RIEN afficher ni RIEN
    // déduire du total attendu.
    expect(
      selectAppliedCoupon({ couponCode: 'GLOW99', creditCents: 0, couponKind: 'promo' }),
    ).toBe(NO_COUPON);
  });

  it('montant sans code → NO_COUPON', () => {
    expect(
      selectAppliedCoupon({ couponCode: null, creditCents: 10000, couponKind: 'promo' }),
    ).toBe(NO_COUPON);
  });

  it('valeurs aberrantes (NaN, négatif) → NO_COUPON, jamais d’exception', () => {
    expect(
      selectAppliedCoupon({ couponCode: 'X', creditCents: Number.NaN, couponKind: 'promo' }),
    ).toBe(NO_COUPON);
    expect(
      selectAppliedCoupon({ couponCode: 'X', creditCents: -500, couponKind: 'promo' }),
    ).toBe(NO_COUPON);
  });

  it('GLOW99 validé → hasDiscount + isPromo', () => {
    const c = selectAppliedCoupon({
      couponCode: 'glow99',
      creditCents: 10000,
      couponKind: 'promo',
    });
    expect(c).toEqual({
      hasDiscount: true,
      isPromo: true,
      code: 'GLOW99',
      creditCents: 10000,
      kind: 'promo',
    });
  });

  it('crédit de fidélité → hasDiscount mais PAS isPromo (pas de mention « Code … »)', () => {
    const c = selectAppliedCoupon({
      couponCode: 'FG-SAUGE-7212',
      creditCents: 2000,
      couponKind: 'credit',
    });
    expect(c.hasDiscount).toBe(true);
    expect(c.isPromo).toBe(false);
  });
});

describe('applyCouponToPrice — sans code, c’est l’identité', () => {
  it.each([0, 1, 99, 19900, 28900, 1_000_000])('%i centimes inchangés', (gross) => {
    expect(applyCouponToPrice(gross, NO_COUPON)).toEqual({
      netCents: gross,
      discountCents: 0,
    });
  });

  it('remise plafonnée au prix, jamais négative', () => {
    const coupon = selectAppliedCoupon({
      couponCode: 'GLOW99',
      creditCents: 10000,
      couponKind: 'promo',
    });
    expect(applyCouponToPrice(19900, coupon)).toEqual({ netCents: 9900, discountCents: 10000 });
    expect(applyCouponToPrice(5000, coupon)).toEqual({ netCents: 0, discountCents: 5000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// B. Invariance de rendu
// ─────────────────────────────────────────────────────────────────────────

/**
 * Sonde minimale : elle rend EXACTEMENT ce qu'une surface coupon-aware a le
 * droit de rendre — le prix net, et la mention promo sous `hasDiscount`.
 * `null` (pas `<></>`) quand il n'y a pas de code.
 */
function CouponProbe({ grossCents }: { grossCents: number }): JSX.Element {
  const coupon = useAppliedCoupon();
  const { netCents, discountCents } = applyCouponToPrice(grossCents, coupon);
  return (
    <div data-testid="probe">
      <p>{(netCents / 100).toFixed(0)} MAD</p>
      {coupon.isPromo ? (
        <p data-testid="probe-promo">
          Code {coupon.code} appliqué · −{(discountCents / 100).toFixed(0)} MAD
        </p>
      ) : null}
    </div>
  );
}

describe('invariance DOM — la visiteuse sans code ne voit RIEN changer', () => {
  it('le HTML sans code est strictement égal à la référence, avant et après un cycle promo', () => {
    // 1. RÉFÉRENCE : première visite, aucun code.
    const first = render(<CouponProbe grossCents={19900} />);
    const reference = first.getByTestId('probe').outerHTML;
    expect(reference).toContain('199 MAD');
    expect(first.queryByTestId('probe-promo')).toBeNull();
    first.unmount();

    // 2. Cycle promo complet : le code s'applique puis est retiré.
    const promo = render(<CouponProbe grossCents={19900} />);
    act(() => {
      useWizardStore.getState().setCoupon('GLOW99', 10000, 'promo');
    });
    expect(promo.getByTestId('probe')).toHaveTextContent('99 MAD');
    expect(promo.getByTestId('probe-promo')).toHaveTextContent('Code GLOW99 appliqué');
    act(() => {
      useWizardStore.getState().clearCoupon();
    });

    // 3. ORACLE : retour à l'état sans code ⇒ HTML identique au byte près.
    expect(promo.getByTestId('probe').outerHTML).toBe(reference);
    promo.unmount();

    // 4. Nouvelle visiteuse, jamais exposée au code ⇒ même HTML.
    const third = render(<CouponProbe grossCents={19900} />);
    expect(third.getByTestId('probe').outerHTML).toBe(reference);
  });

  it('sans code, le hook rend la MÊME référence à chaque rendu (zéro invalidation en aval)', () => {
    const seen: unknown[] = [];
    function Spy(): null {
      seen.push(useAppliedCoupon());
      return null;
    }
    const view = render(<Spy />);
    view.rerender(<Spy />);
    view.rerender(<Spy />);
    expect(seen).toHaveLength(3);
    expect(seen.every((c) => c === NO_COUPON)).toBe(true);
  });

  it('parité hydratation : un code déjà persisté ne change RIEN au premier rendu', () => {
    // Simule le retour d'une visiteuse GLOW99 : le store porte déjà le code
    // AVANT le premier rendu (storage localStorage synchrone). Le HTML ISR
    // servi affiche 199 : le premier rendu client doit afficher 199 lui aussi.
    act(() => {
      useWizardStore.getState().setCoupon('GLOW99', 10000, 'promo');
    });
    let firstPaint = '';
    function CapturingProbe(): JSX.Element {
      const coupon = useAppliedCoupon();
      const { netCents } = applyCouponToPrice(19900, coupon);
      const html = `${(netCents / 100).toFixed(0)} MAD`;
      if (!firstPaint) firstPaint = html;
      return <p data-testid="capture">{html}</p>;
    }
    render(<CapturingProbe />);
    expect(firstPaint).toBe('199 MAD'); // aucun mismatch d'hydratation
    expect(screen.getByTestId('capture')).toHaveTextContent('99 MAD'); // puis la remise
  });
});

// ─────────────────────────────────────────────────────────────────────────
// D. Graine résolue côté serveur (SSR) — /kit?code=GLOW99
// ─────────────────────────────────────────────────────────────────────────

function Probe({ initial }: { initial?: { code: string; valueCents: number; kind: 'promo' | 'credit' } }) {
  const coupon = useAppliedCoupon({ initial });
  return (
    <span data-testid="probe">
      {`${coupon.hasDiscount}|${coupon.isPromo}|${coupon.code ?? ''}|${coupon.creditCents}|${
        applyCouponToPrice(19900, coupon).netCents
      }`}
    </span>
  );
}

describe('useAppliedCoupon — graine serveur', () => {
  const SEED = { code: 'GLOW99', valueCents: 10000, kind: 'promo' as const };

  it('INVARIANCE — sans graine ni store, rien n’est appliqué et le prix reste entier', () => {
    render(<Probe />);
    expect(screen.getByTestId('probe').textContent).toBe('false|false||0|19900');
  });

  it('graine seule (première visite publicitaire) : 199 → 99 dès le premier rendu', () => {
    render(<Probe initial={SEED} />);
    expect(screen.getByTestId('probe').textContent).toBe('true|true|GLOW99|10000|9900');
  });

  it('le store fait autorité dès qu’il porte un code re-validé', () => {
    act(() => {
      useWizardStore.getState().setCoupon('GLOW99', 5000, 'promo');
    });
    render(<Probe initial={SEED} />);
    expect(screen.getByTestId('probe').textContent).toBe('true|true|GLOW99|5000|14900');
  });

  it('graine vide ou de montant nul → ignorée', () => {
    render(<Probe initial={{ code: '', valueCents: 0, kind: 'promo' }} />);
    expect(screen.getByTestId('probe').textContent).toBe('false|false||0|19900');
  });
});
