/**
 * N08 — <NavEditor/> sauvegarde réseau (MSW).
 *
 * PATCH /api/admin/settings/nav : envoi du header If-Match, succès (version++),
 * conflit 409, validation serveur 422 (mappée par ligne), erreur serveur 500.
 * cf. docs/admin-nav-coupons-qa-2026-06-03/N08.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { server } from '@/test/msw/server';
import { navSettingsHandlers, navSaveCalls, resetNavSaveCalls } from '@/test/msw/nav-settings-handlers';
import { NavEditor } from './NavEditor';
import type { ConfigMeta, NavItem } from '@/lib/admin-config/types';

const META: ConfigMeta = { version: 3, updatedAt: '2026-06-01T00:00:00.000Z', updatedBy: null, isDefault: false };
const ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Tableau de bord', href: '/admin', icon: 'home', position: 0 },
  { key: 'coupons', label: 'Coupons', href: '/admin/coupons', icon: 'tag', position: 1 },
];

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  resetNavSaveCalls();
});
afterAll(() => server.close());

function renderDirty() {
  render(<NavEditor initialItems={ITEMS} meta={META} />);
  // rendre l'état dirty (édition valide)
  fireEvent.change(screen.getByDisplayValue('Coupons'), { target: { value: 'Coupons promo' } });
  return screen.getByRole('button', { name: /Enregistrer/ });
}

describe('N08 NavEditor — sauvegarde', () => {
  it('N08-M001 succès → message + header If-Match envoyé', async () => {
    server.use(...navSettingsHandlers({ version: 3 }));
    fireEvent.click(renderDirty());
    expect(await screen.findByText('Navigation enregistrée.')).toBeInTheDocument();
    expect(navSaveCalls).toHaveLength(1);
    expect(navSaveCalls[0]!.ifMatch).toBe('3');
  });

  it('N08-M002 conflit de version (409) → message « recharge la page »', async () => {
    server.use(...navSettingsHandlers({ fail: 'conflict' }));
    fireEvent.click(renderDirty());
    expect(await screen.findByText(/Recharge la page/i)).toBeInTheDocument();
    expect(screen.queryByText('Navigation enregistrée.')).not.toBeInTheDocument();
  });

  it('N08-M003 validation serveur (422) → erreur par ligne mappée', async () => {
    server.use(...navSettingsHandlers({ fail: 'validation' }));
    fireEvent.click(renderDirty());
    expect(await screen.findByText(/Validation serveur en échec/i)).toBeInTheDocument();
    // Le message serveur est mappé à la fois inline (cellule) ET dans la liste récap.
    expect((await screen.findAllByText(/Label requis \(serveur\)/i)).length).toBeGreaterThanOrEqual(1);
  });

  it('N08-M004 erreur serveur (500) → « Erreur serveur. »', async () => {
    server.use(...navSettingsHandlers({ fail: 500 }));
    fireEvent.click(renderDirty());
    expect(await screen.findByText('Erreur serveur.')).toBeInTheDocument();
  });

  it('N08-M005 panne réseau → pas de message de succès (échec géré)', async () => {
    server.use(...navSettingsHandlers({ fail: 'network' }));
    fireEvent.click(renderDirty());
    await waitFor(() => expect(navSaveCalls.length).toBe(1));
    expect(screen.queryByText('Navigation enregistrée.')).not.toBeInTheDocument();
  });
});
