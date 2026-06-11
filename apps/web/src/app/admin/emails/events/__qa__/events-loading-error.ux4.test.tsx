/**
 * VAGUE 4 — UX-DASH-010 : états loading/error de la page Events.
 *
 * Couche : composant (RTL, jsdom). On rend directement les segments
 * `loading.tsx` (skeleton) et `error.tsx` (error boundary client).
 *
 * Oracle imposé UX4-DASHBOARD-006 : `events/error.tsx` rend role=alert.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EventsLoading from '@/app/admin/emails/events/loading';
import EventsError from '@/app/admin/emails/events/error';

describe('UX4-DASHBOARD-006 — events/error.tsx', () => {
  it('UX4-DASHBOARD-006a : rend un role=alert avec message FR actionnable', () => {
    const reset = vi.fn();
    render(<EventsError error={new Error('boom') as Error & { digest?: string }} reset={reset} />);
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    // Message FR, pas de fuite anglaise générique.
    expect(alert.textContent ?? '').toMatch(/indisponible|erreur/i);
  });

  it('UX4-DASHBOARD-006b : le bouton « Réessayer » appelle reset()', async () => {
    const reset = vi.fn();
    render(<EventsError error={new Error('boom') as Error & { digest?: string }} reset={reset} />);
    await userEvent.click(screen.getByRole('button', { name: /réessayer/i }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('UX4-DASHBOARD-006c : un lien de retour vers le tableau de bord est présent', () => {
    const reset = vi.fn();
    render(<EventsError error={new Error('boom') as Error & { digest?: string }} reset={reset} />);
    const back = screen.getByRole('link', { name: /tableau de bord|dashboard/i });
    expect(back).toHaveAttribute('href', '/admin/emails');
  });
});

describe('UX4-DASHBOARD-006 (suite) — events/loading.tsx', () => {
  it('UX4-DASHBOARD-006d : rend un skeleton avec role=status muet (annonce lecteur d\'écran)', () => {
    render(<EventsLoading />);
    const status = screen.getByRole('status');
    expect(status.textContent ?? '').toMatch(/chargement/i);
  });
});
