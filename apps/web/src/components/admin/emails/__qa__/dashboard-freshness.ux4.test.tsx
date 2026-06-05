/**
 * VAGUE 4 — UX-DASH-004 : horodatage de fraîcheur + bouton « Rafraîchir »
 * (router.refresh) sur le dashboard emailing.
 *
 * Couche : composant client `<DashboardFreshness generatedAt=… />` (RTL, jsdom).
 * On mocke `next/navigation` pour capturer l'appel `router.refresh()`.
 *
 * Oracle imposé UX4-DASHBOARD-003 :
 *  - l'horodatage de génération s'affiche (role=status) ;
 *  - le bouton « Rafraîchir » appelle `router.refresh`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

import { DashboardFreshness } from '@/components/admin/emails/DashboardFreshness';

afterEach(() => {
  refresh.mockClear();
});

describe('UX4-DASHBOARD-003 — fraîcheur + rafraîchir', () => {
  it('UX4-DASHBOARD-003a : affiche l\'horodatage de génération dans un role=status', () => {
    render(<DashboardFreshness generatedAt="2026-06-05T08:30:00Z" />);
    const status = screen.getByRole('status');
    // L'heure formatée fr-FR est visible (on n'asserte pas l'exact fuseau, juste
    // qu'un horodatage non vide est rendu et que le mot « Données » est présent).
    expect(status).toHaveTextContent(/donn[ée]es|arrêt|à jour|mise à jour/i);
    expect(status.textContent ?? '').toMatch(/\d{1,2}[:h]\d{2}/);
  });

  it('UX4-DASHBOARD-003b : le bouton « Rafraîchir » appelle router.refresh()', async () => {
    render(<DashboardFreshness generatedAt="2026-06-05T08:30:00Z" />);
    const btn = screen.getByRole('button', { name: /rafra(î|i)chir/i });
    await userEvent.click(btn);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('UX4-DASHBOARD-003c : anti double-clic — un second clic immédiat ne relance pas', async () => {
    render(<DashboardFreshness generatedAt="2026-06-05T08:30:00Z" />);
    const btn = screen.getByRole('button', { name: /rafra(î|i)chir/i });
    await userEvent.click(btn);
    // Le bouton se désactive pendant le refresh → un second clic est sans effet.
    expect(btn).toBeDisabled();
    await userEvent.click(btn);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('UX4-DASHBOARD-003d : timestamp invalide → pas de crash, fallback lisible', () => {
    render(<DashboardFreshness generatedAt="pas-une-date" />);
    // Le composant ne doit pas afficher « Invalid Date » brut.
    expect(screen.getByRole('status').textContent ?? '').not.toMatch(/Invalid Date/);
  });
});
