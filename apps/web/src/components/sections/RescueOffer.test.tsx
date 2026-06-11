/**
 * Tests RescueOffer (Phase 2) — déclenchement discret + affichage selon la
 * décision serveur, une seule sollicitation par session, charte.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { RescueOffer } from './RescueOffer';

function mockFetch(show: boolean) {
  return vi.fn(async () => ({ ok: true, json: async () => ({ show }) }) as unknown as Response);
}

beforeEach(() => {
  window.sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function fireExitIntent() {
  fireEvent.mouseOut(document, { clientY: 0 });
}

describe('P2 RescueOffer', () => {
  it('R001 invisible tant qu’aucun signal', () => {
    vi.stubGlobal('fetch', mockFetch(true));
    render(<RescueOffer />);
    expect(screen.queryByTestId('rescue-offer')).toBeNull();
  });

  it('R002 exit-intent + show:true → affiche l’offre (cadeau, charte)', async () => {
    vi.stubGlobal('fetch', mockFetch(true));
    render(<RescueOffer />);
    fireExitIntent();
    await waitFor(() => expect(screen.getByTestId('rescue-offer')).toBeInTheDocument());
    const note = screen.getByTestId('rescue-offer');
    expect(note).toHaveTextContent(/cadeau/i);
    const txt = note.textContent ?? '';
    expect(txt).not.toContain('!');
    expect(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(txt)).toBe(false);
  });

  it('R003 show:false (holdout) → rien ne s’affiche', async () => {
    const f = mockFetch(false);
    vi.stubGlobal('fetch', f);
    render(<RescueOffer />);
    fireExitIntent();
    await waitFor(() => expect(f).toHaveBeenCalled());
    expect(screen.queryByTestId('rescue-offer')).toBeNull();
  });

  it('R004 une seule sollicitation par session', async () => {
    window.sessionStorage.setItem('fg_rescue_seen', '1');
    const f = mockFetch(true);
    vi.stubGlobal('fetch', f);
    render(<RescueOffer />);
    fireExitIntent();
    // Pas d'appel : déjà vu cette session.
    expect(f).not.toHaveBeenCalled();
  });

  it('R005 dismiss masque l’offre', async () => {
    vi.stubGlobal('fetch', mockFetch(true));
    render(<RescueOffer />);
    fireExitIntent();
    await waitFor(() => expect(screen.getByTestId('rescue-offer')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('rescue-offer-dismiss'));
    expect(screen.queryByTestId('rescue-offer')).toBeNull();
  });
});
