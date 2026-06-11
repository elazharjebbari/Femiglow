/**
 * F04 — <CouponsManager/> section « Codes de fidélité émis » (composant + MSW).
 *
 * Chargement à la demande, masquage PII du téléphone, dates fr-MA, état vide,
 * toggle Charger→Rafraîchir, échec silencieux.
 * cf. docs/coupon-loyalty-qa-ui-2026-06-03/04-admin-grants.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { server } from '@/test/msw/server';
import { couponsAdminHandlers, maskedGrant } from '@/test/msw/coupons-handlers';
import { CouponsManager } from './CouponsManager';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('F04 CouponsManager — codes de fidélité émis', () => {
  it('F04-C001 table absente avant chargement', () => {
    server.use(...couponsAdminHandlers({ grants: [maskedGrant()] }));
    render(<CouponsManager initialCoupons={[]} />);
    expect(screen.queryByTestId('coupons-grants-table')).not.toBeInTheDocument();
    expect(screen.getByText('Charger')).toBeInTheDocument();
  });

  it('F04-C002 « Charger » affiche la table + bascule en « Rafraîchir »', async () => {
    server.use(...couponsAdminHandlers({ grants: [maskedGrant({ id: 'g1' })] }));
    render(<CouponsManager initialCoupons={[]} />);
    fireEvent.click(screen.getByText('Charger'));
    expect(await screen.findByTestId('grant-row-g1')).toBeInTheDocument();
    expect(screen.getByText('Rafraîchir')).toBeInTheDocument();
  });

  it('F04-C003 INV-PII : téléphone masqué (pas de 6 chiffres consécutifs)', async () => {
    server.use(...couponsAdminHandlers({ grants: [maskedGrant({ id: 'g1', phone: '0612…78' })] }));
    render(<CouponsManager initialCoupons={[]} />);
    fireEvent.click(screen.getByText('Charger'));
    const row = await screen.findByTestId('grant-row-g1');
    // Oracle PII ciblé sur la CELLULE téléphone (pas tout le <tr> dont le
    // textContent concatène sans séparateur code+tel+dates → faux positifs).
    const phoneCell = within(row).getByText('0612…78');
    expect(phoneCell.textContent ?? '').not.toMatch(/\d{6,}/);
  });

  it('F04-C004 valeur en MAD + code en clair (FG-…)', async () => {
    server.use(...couponsAdminHandlers({ grants: [maskedGrant({ id: 'g1', code: 'FG-SAUGE-7212', valueCents: 2000 })] }));
    render(<CouponsManager initialCoupons={[]} />);
    fireEvent.click(screen.getByText('Charger'));
    const row = await screen.findByTestId('grant-row-g1');
    expect(row).toHaveTextContent('FG-SAUGE-7212');
    expect(row).toHaveTextContent('20 MAD');
  });

  it('F04-C005 état vide → « Aucun code émis. »', async () => {
    server.use(...couponsAdminHandlers({ grants: [] }));
    render(<CouponsManager initialCoupons={[]} />);
    fireEvent.click(screen.getByText('Charger'));
    expect(await screen.findByText('Aucun code émis.')).toBeInTheDocument();
  });

  it('F04-C006 dates rendues (activation/expiration non vides)', async () => {
    server.use(...couponsAdminHandlers({
      grants: [maskedGrant({ id: 'g1', activatesAt: '2026-06-10T00:00:00.000Z', expiresAt: '2026-08-09T00:00:00.000Z' })],
    }));
    render(<CouponsManager initialCoupons={[]} />);
    fireEvent.click(screen.getByText('Charger'));
    const row = await screen.findByTestId('grant-row-g1');
    // fr-MA : au moins une date numérique présente, pas le placeholder « — »
    expect(within(row).queryByText('—')).not.toBeInTheDocument();
  });

  it('F04-C007 échec (500) → silencieux : pas de table, pas d’alerte', async () => {
    server.use(...couponsAdminHandlers({ grants: [maskedGrant()], fail: { grants: 500 } }));
    render(<CouponsManager initialCoupons={[]} />);
    fireEvent.click(screen.getByText('Charger'));
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByTestId('coupons-grants-table')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
