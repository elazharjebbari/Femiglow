/**
 * CouponWelcomeNote — câblage du champ code au parent (PriceBlock).
 * Via MSW /api/coupons/redeem : un code valide remonte onCouponValid(code,cents) ;
 * une ré-édition remonte onCouponClear.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CouponWelcomeNote } from './CouponWelcomeNote';
import { server } from '@/test/msw/server';
import { redeemHandlers } from '@/test/msw/coupons-handlers';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());

function renderNote(onValid = vi.fn(), onClear = vi.fn()) {
  render(
    <CouponWelcomeNote
      finalPriceLabel="199 MAD"
      savingsLabel="90 MAD offerts"
      onCouponValid={onValid}
      onCouponClear={onClear}
    />,
  );
  return { onValid, onClear };
}

describe('CouponWelcomeNote — câblage code', () => {
  it('CWN-C001 code valide → onCouponValid(code upper, valueCents)', async () => {
    server.use(...redeemHandlers({ byCode: { 'FG-DEMO-1234': { valid: true, valueCents: 2000 } } }));
    const { onValid } = renderNote();
    fireEvent.change(screen.getByLabelText('Votre code'), { target: { value: 'fg-demo-1234' } });
    fireEvent.click(screen.getByText('Appliquer'));
    await screen.findByTestId('invitation-code-ok');
    expect(onValid).toHaveBeenCalledWith('FG-DEMO-1234', 2000);
  });

  it('CWN-C002 ré-édition après validation → onCouponClear', async () => {
    server.use(...redeemHandlers({ byCode: { 'FG-DEMO-1234': { valid: true, valueCents: 2000 } } }));
    const { onClear } = renderNote();
    const input = screen.getByLabelText('Votre code');
    fireEvent.change(input, { target: { value: 'FG-DEMO-1234' } });
    fireEvent.click(screen.getByText('Appliquer'));
    await screen.findByTestId('invitation-code-ok');
    fireEvent.change(input, { target: { value: 'FG-DEMO-123' } });
    await waitFor(() => expect(onClear).toHaveBeenCalled());
  });

  it('CWN-C003 code invalide → message KO, pas d’onCouponValid', async () => {
    server.use(...redeemHandlers({ byCode: {} }));
    const { onValid } = renderNote();
    fireEvent.change(screen.getByLabelText('Votre code'), { target: { value: 'FG-NOPE-0000' } });
    fireEvent.click(screen.getByText('Appliquer'));
    await screen.findByTestId('invitation-code-ko');
    expect(onValid).not.toHaveBeenCalled();
  });
});
