/**
 * F03 — <CouponsManager/> stats d'incrémentalité à la demande (composant + MSW).
 *
 * Clic « Stats » → span lazy `coupon-stats-{id}` : format `X.X pts` / `—` /
 * suffixe « (pas de contrôle) ». Échec = silencieux (pas d'alerte, pas de span).
 * cf. docs/coupon-loyalty-qa-ui-2026-06-03/03-admin-stats.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { server } from '@/test/msw/server';
import { couponsAdminHandlers, draftCoupon, type MswCouponStats } from '@/test/msw/coupons-handlers';
import { CouponsManager } from './CouponsManager';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const coupon = draftCoupon({ id: 'c1', status: 'active' });

function statsOf(over: Partial<MswCouponStats>): MswCouponStats {
  return {
    exposed: { treatment: 1000, holdout: 100 },
    converted: { treatment: 150, holdout: 10 },
    conversionRate: { treatment: 0.15, holdout: 0.1 },
    upliftAbsolute: 0.05,
    upliftRelative: 0.5,
    noControl: false,
    lowSample: false,
    ...over,
  };
}

describe('F03 CouponsManager — stats', () => {
  it('F03-C001 le span n’apparaît qu’après clic (lazy)', async () => {
    server.use(...couponsAdminHandlers({ coupons: [coupon] }));
    render(<CouponsManager initialCoupons={[coupon] as never} />);
    expect(screen.queryByTestId('coupon-stats-c1')).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByTestId('coupon-row-c1')).getByText('Stats'));
    expect(await screen.findByTestId('coupon-stats-c1')).toBeInTheDocument();
  });

  it('F03-C002 uplift positif → « 5.0 pts »', async () => {
    server.use(...couponsAdminHandlers({ coupons: [coupon], stats: { c1: statsOf({ upliftAbsolute: 0.05 }) } }));
    render(<CouponsManager initialCoupons={[coupon] as never} />);
    fireEvent.click(within(screen.getByTestId('coupon-row-c1')).getByText('Stats'));
    expect(await screen.findByTestId('coupon-stats-c1')).toHaveTextContent('5.0 pts');
  });

  it('F03-C003 uplift null → « — »', async () => {
    server.use(...couponsAdminHandlers({ coupons: [coupon], stats: { c1: statsOf({ upliftAbsolute: null }) } }));
    render(<CouponsManager initialCoupons={[coupon] as never} />);
    fireEvent.click(within(screen.getByTestId('coupon-row-c1')).getByText('Stats'));
    const span = await screen.findByTestId('coupon-stats-c1');
    expect(span).toHaveTextContent('—');
  });

  it('F03-C004 noControl → suffixe « (pas de contrôle) »', async () => {
    server.use(...couponsAdminHandlers({ coupons: [coupon], stats: { c1: statsOf({ upliftAbsolute: null, noControl: true }) } }));
    render(<CouponsManager initialCoupons={[coupon] as never} />);
    fireEvent.click(within(screen.getByTestId('coupon-row-c1')).getByText('Stats'));
    expect(await screen.findByTestId('coupon-stats-c1')).toHaveTextContent('(pas de contrôle)');
  });

  it('F03-C005 échec (500) → silencieux : pas de span, pas d’alerte', async () => {
    server.use(...couponsAdminHandlers({ coupons: [coupon], fail: { stats: 500 } }));
    render(<CouponsManager initialCoupons={[coupon] as never} />);
    fireEvent.click(within(screen.getByTestId('coupon-row-c1')).getByText('Stats'));
    // laisser le micro-task se résoudre
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByTestId('coupon-stats-c1')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
