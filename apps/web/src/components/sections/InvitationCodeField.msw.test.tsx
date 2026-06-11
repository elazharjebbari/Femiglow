/**
 * F08 — InvitationCodeField : saisie + validation via MSW (composant + M).
 *
 * États idle → checking → valid/invalid ; anti-stale (onClear) ; garde <3 chars ;
 * normalisation upper sur onValid ; i18n AR. Utilise redeemHandlers (frontière
 * /api/coupons/redeem). cf. docs/coupon-loyalty-qa-ui-2026-06-03/08-invitation-field.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { server } from '@/test/msw/server';
import { redeemHandlers } from '@/test/msw/coupons-handlers';
import { InvitationCodeField } from './InvitationCodeField';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const VALID = { 'FG-SAUGE-7212': { valid: true, valueCents: 2000 } };

describe('F08 InvitationCodeField', () => {
  it('F08-C001 code valide → message OK + onValid(code upper, valueCents)', async () => {
    server.use(...redeemHandlers({ byCode: VALID }));
    const onValid = vi.fn();
    render(<InvitationCodeField onValid={onValid} />);
    fireEvent.change(screen.getByLabelText('Votre code'), { target: { value: 'fg-sauge-7212' } });
    fireEvent.click(screen.getByText('Appliquer'));
    expect(await screen.findByTestId('invitation-code-ok')).toHaveTextContent('Crédit de 20 MAD');
    expect(onValid).toHaveBeenCalledWith('FG-SAUGE-7212', 2000);
  });

  it('F08-C002 code inconnu → message KO (role=alert), pas d’onValid', async () => {
    server.use(...redeemHandlers({ byCode: {} })); // tout → not_found
    const onValid = vi.fn();
    render(<InvitationCodeField onValid={onValid} />);
    fireEvent.change(screen.getByLabelText('Votre code'), { target: { value: 'FG-NOPE-0000' } });
    fireEvent.click(screen.getByText('Appliquer'));
    const ko = await screen.findByTestId('invitation-code-ko');
    expect(ko).toHaveAttribute('role', 'alert');
    expect(ko).toHaveTextContent('Code introuvable ou expiré.');
    expect(onValid).not.toHaveBeenCalled();
  });

  it('F08-C003 anti-stale : ré-édition après validation → onClear + OK disparaît', async () => {
    server.use(...redeemHandlers({ byCode: VALID }));
    const onClear = vi.fn();
    render(<InvitationCodeField onValid={vi.fn()} onClear={onClear} />);
    const input = screen.getByLabelText('Votre code');
    fireEvent.change(input, { target: { value: 'FG-SAUGE-7212' } });
    fireEvent.click(screen.getByText('Appliquer'));
    await screen.findByTestId('invitation-code-ok');
    fireEvent.change(input, { target: { value: 'FG-SAUGE-721' } });
    expect(onClear).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByTestId('invitation-code-ok')).not.toBeInTheDocument());
  });

  it('F08-C004 garde <3 caractères : bouton désactivé (aucune requête)', () => {
    server.use(...redeemHandlers({ byCode: VALID }));
    render(<InvitationCodeField onValid={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Votre code'), { target: { value: 'ab' } });
    expect(screen.getByText('Appliquer')).toBeDisabled();
  });

  it('F08-C005 ≥3 caractères : bouton actif', () => {
    server.use(...redeemHandlers({ byCode: VALID }));
    render(<InvitationCodeField onValid={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Votre code'), { target: { value: 'abc' } });
    expect(screen.getByText('Appliquer')).not.toBeDisabled();
  });

  it('F08-C006 i18n AR : aria-label + phrase de crédit arabe', async () => {
    server.use(...redeemHandlers({ byCode: VALID }));
    render(<InvitationCodeField isArabic onValid={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('رمز الدعوة'), { target: { value: 'FG-SAUGE-7212' } });
    fireEvent.click(screen.getByText('تطبيق'));
    const ok = await screen.findByTestId('invitation-code-ok');
    // OBS-01 corrigé : la devise est désormais localisée (درهم) en arabe,
    // cohérent avec LoyaltyCodeCard.
    expect(ok).toHaveTextContent('رصيد');
    expect(ok).toHaveTextContent('20 درهم');
  });

  it('F08-C007 reprise : initialCode pré-rempli', () => {
    server.use(...redeemHandlers({ byCode: VALID }));
    render(<InvitationCodeField initialCode="FG-REPRISE-1" onValid={vi.fn()} />);
    expect(screen.getByLabelText('Votre code')).toHaveValue('FG-REPRISE-1');
  });
});
