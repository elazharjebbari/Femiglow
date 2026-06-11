/**
 * F01 — <CouponsManager/> création (composant + MSW).
 *
 * Geste opérateur : remplir libellé + montant, cliquer « Créer (brouillon) »,
 * voir la ligne apparaître (via refresh). Erreurs réseau explicites.
 * cf. docs/coupon-loyalty-qa-ui-2026-06-03/01-admin-create.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { server } from '@/test/msw/server';
import { couponsAdminHandlers } from '@/test/msw/coupons-handlers';
import { CouponsManager } from './CouponsManager';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('F01 CouponsManager — création', () => {
  it('F01-C001 crée un brouillon et l’affiche après refresh', async () => {
    server.use(...couponsAdminHandlers({ coupons: [], newCouponId: 'cpn_new' }));
    render(<CouponsManager initialCoupons={[]} />);
    fireEvent.change(screen.getByLabelText('Libellé'), { target: { value: 'Flash' } });
    fireEvent.change(screen.getByLabelText('Montant offert'), { target: { value: '5000' } });
    fireEvent.click(screen.getByText('Créer (brouillon)'));
    expect(await screen.findByTestId('coupon-row-cpn_new')).toBeInTheDocument();
  });

  it('F01-C002 valeur affichée en MAD absolu (5000c → 50 MAD)', async () => {
    server.use(...couponsAdminHandlers({ coupons: [], newCouponId: 'cpn_new' }));
    render(<CouponsManager initialCoupons={[]} />);
    fireEvent.change(screen.getByLabelText('Montant offert'), { target: { value: '5000' } });
    fireEvent.click(screen.getByText('Créer (brouillon)'));
    const row = await screen.findByTestId('coupon-row-cpn_new');
    expect(row).toHaveTextContent('50 MAD');
  });

  it('F01-C003 refus 403 → alerte « HTTP 403 », pas de ligne', async () => {
    server.use(...couponsAdminHandlers({ coupons: [], fail: { create: 403 } }));
    render(<CouponsManager initialCoupons={[]} />);
    fireEvent.click(screen.getByText('Créer (brouillon)'));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('HTTP 403');
    expect(screen.queryByTestId('coupon-row-cpn_new')).not.toBeInTheDocument();
  });

  it('F01-C004 doublon 409 → alerte « HTTP 409 »', async () => {
    server.use(...couponsAdminHandlers({ coupons: [], fail: { create: 409 } }));
    render(<CouponsManager initialCoupons={[]} />);
    fireEvent.click(screen.getByText('Créer (brouillon)'));
    expect(await screen.findByRole('alert')).toHaveTextContent('HTTP 409');
  });

  it('F01-C005 payload invalide 422 → alerte « HTTP 422 »', async () => {
    server.use(...couponsAdminHandlers({ coupons: [], fail: { create: 422 } }));
    render(<CouponsManager initialCoupons={[]} />);
    fireEvent.click(screen.getByText('Créer (brouillon)'));
    expect(await screen.findByRole('alert')).toHaveTextContent('HTTP 422');
  });

  it('F01-M006 panne réseau (fetch throw) → « Erreur réseau. »', async () => {
    server.use(...couponsAdminHandlers({ coupons: [], fail: { create: 'network' } }));
    render(<CouponsManager initialCoupons={[]} />);
    fireEvent.click(screen.getByText('Créer (brouillon)'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Erreur réseau.');
  });

  it('F01-C007 bouton réactivé après l’opération (busy relâché)', async () => {
    server.use(...couponsAdminHandlers({ coupons: [], newCouponId: 'cpn_new' }));
    render(<CouponsManager initialCoupons={[]} />);
    const btn = screen.getByText('Créer (brouillon)') as HTMLButtonElement;
    fireEvent.click(btn);
    await screen.findByTestId('coupon-row-cpn_new');
    await waitFor(() => expect(btn.disabled).toBe(false));
  });

  it('F01-V008 charte : aucun %/!/emoji dans la zone de création', async () => {
    server.use(...couponsAdminHandlers({ coupons: [] }));
    render(<CouponsManager initialCoupons={[]} />);
    const section = screen.getByText('Nouveau coupon d’accueil').closest('section')!;
    expect(section.textContent ?? '').not.toMatch(/[%!]|🎉|⏰/);
  });
});
