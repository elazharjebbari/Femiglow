/**
 * F02 — <CouponsManager/> transitions de statut (composant + MSW).
 *
 * Matrice de visibilité des actions par statut + transitions + refresh + verrou
 * archivé (boutons masqués) + erreurs de transition.
 * cf. docs/coupon-loyalty-qa-ui-2026-06-03/02-admin-status.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { server } from '@/test/msw/server';
import { couponsAdminHandlers, draftCoupon } from '@/test/msw/coupons-handlers';
import { CouponsManager } from './CouponsManager';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderWith(status: string) {
  server.use(...couponsAdminHandlers({ coupons: [draftCoupon({ id: 'c1', status })] }));
  render(<CouponsManager initialCoupons={[draftCoupon({ id: 'c1', status })] as never} />);
  return within(screen.getByTestId('coupon-row-c1'));
}

describe('F02 CouponsManager — transitions', () => {
  it('F02-C001 brouillon : Activer + Archiver + Stats, pas de Pauser', () => {
    const row = renderWith('draft');
    expect(row.getByText('Activer')).toBeInTheDocument();
    expect(row.getByText('Archiver')).toBeInTheDocument();
    expect(row.getByText('Stats')).toBeInTheDocument();
    expect(row.queryByText('Pauser')).not.toBeInTheDocument();
  });

  it('F02-C002 actif : Pauser + Archiver + Stats, pas d’Activer', () => {
    const row = renderWith('active');
    expect(row.getByText('Pauser')).toBeInTheDocument();
    expect(row.getByText('Archiver')).toBeInTheDocument();
    expect(row.queryByText('Activer')).not.toBeInTheDocument();
  });

  it('F02-C003 archivé : verrou UI — seul Stats reste (pas de réactivation)', () => {
    const row = renderWith('archived');
    expect(row.queryByText('Activer')).not.toBeInTheDocument();
    expect(row.queryByText('Pauser')).not.toBeInTheDocument();
    expect(row.queryByText('Archiver')).not.toBeInTheDocument();
    expect(row.getByText('Stats')).toBeInTheDocument();
  });

  it('F02-C004 Activer un brouillon → statut « Actif » après refresh', async () => {
    const row = renderWith('draft');
    fireEvent.click(row.getByText('Activer'));
    await screen.findByText('Actif');
    expect(screen.getByTestId('coupon-status-c1')).toHaveTextContent('Actif');
  });

  it('F02-C005 Pauser un actif → statut « En pause »', async () => {
    const row = renderWith('active');
    fireEvent.click(row.getByText('Pauser'));
    await screen.findByText('En pause');
    expect(screen.getByTestId('coupon-status-c1')).toHaveTextContent('En pause');
  });

  it('F02-C006 Archiver → statut « Archivé »', async () => {
    const row = renderWith('draft');
    fireEvent.click(row.getByText('Archiver'));
    await screen.findByText('Archivé');
    expect(screen.getByTestId('coupon-status-c1')).toHaveTextContent('Archivé');
  });

  it('F02-C007 transition refusée (500) → alerte « HTTP 500 »', async () => {
    server.use(...couponsAdminHandlers({ coupons: [draftCoupon({ id: 'c1', status: 'draft' })], fail: { transition: 500 } }));
    render(<CouponsManager initialCoupons={[draftCoupon({ id: 'c1', status: 'draft' })] as never} />);
    fireEvent.click(within(screen.getByTestId('coupon-row-c1')).getByText('Activer'));
    expect(await screen.findByRole('alert')).toHaveTextContent('HTTP 500');
  });

  it('F02-M008 panne réseau sur transition → « Erreur réseau. »', async () => {
    server.use(...couponsAdminHandlers({ coupons: [draftCoupon({ id: 'c1', status: 'draft' })], fail: { transition: 'network' } }));
    render(<CouponsManager initialCoupons={[draftCoupon({ id: 'c1', status: 'draft' })] as never} />);
    fireEvent.click(within(screen.getByTestId('coupon-row-c1')).getByText('Activer'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Erreur réseau.');
  });
});
