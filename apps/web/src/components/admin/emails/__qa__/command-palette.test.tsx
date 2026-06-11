/**
 * Module 01 — Command palette globale (F-004). Couche : composant (jsdom).
 *
 * Le composant `GlobalCommandPalette` est déjà couvert par
 * `../__tests__/GlobalCommandPalette.test.tsx` (open/escape/fuzzy/enter/
 * a11y basique). Ce fichier ajoute les oracles de la MATRICE module 01 non
 * encore tracés : ⌘K (meta), filtre fuzzy ciblé, ↓ + Enter → push(href),
 * Esc ferme, état vide role=status, et aria-activedescendant SUIT l'item actif.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GlobalCommandPalette } from '@/components/admin/emails/GlobalCommandPalette';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

beforeEach(() => {
  pushMock.mockClear();
});

describe('GlobalCommandPalette — matrice module 01 (DSH-MSW-06x)', () => {
  // DSH-MSW-060 — ⌘K (metaKey) ouvre la palette (pas seulement Ctrl).
  it('DSH-MSW-060 : ⌘K (metaKey) ouvre la palette (role=dialog)', () => {
    render(<GlobalCommandPalette />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  // DSH-MSW-061 — filtre fuzzy 'camp' surface 'Campagnes', masque les autres.
  it("DSH-MSW-061 : filtre fuzzy 'camp' surface 'Campagnes' et masque le reste", () => {
    render(<GlobalCommandPalette />);
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'camp' } });
    expect(screen.getByText('Campagnes')).toBeInTheDocument();
    expect(screen.queryByText('Templates HTML')).not.toBeInTheDocument();
    expect(screen.queryByText('Audiences')).not.toBeInTheDocument();
  });

  // DSH-MSW-062 — ↓ puis Enter exécute router.push vers l'item actif.
  it('DSH-MSW-062 : ↓ puis Enter → router.push(href de l item actif)', () => {
    render(<GlobalCommandPalette />);
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    const input = screen.getByRole('textbox');
    // Idx 0 = Dashboard emails ; ↓ → idx 1 = Emails transactionnels.
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith('/admin/emails/transactional');
  });

  // DSH-MSW-063 — Esc ferme la palette.
  it('DSH-MSW-063 : Esc ferme la palette', () => {
    render(<GlobalCommandPalette />);
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // DSH-MSW-064 — requête sans match → 'Aucun résultat' avec role=status.
  it("DSH-MSW-064 : sans match → 'Aucun résultat' (role=status)", () => {
    render(<GlobalCommandPalette />);
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'zzzzqwx' } });
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(/Aucun résultat/i);
  });

  // DSH-MSW-065 — aria-activedescendant SUIT l'item actif (sync clavier ↔ a11y).
  it("DSH-MSW-065 : aria-activedescendant pointe l'id de l'item sélectionné et suit ↓", () => {
    render(<GlobalCommandPalette />);
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    const input = screen.getByRole('textbox');

    // À l'ouverture, l'item actif est le premier (Dashboard emails).
    const optionsInitial = screen.getAllByRole('option');
    const firstActiveId = optionsInitial.find(
      (o) => o.getAttribute('aria-selected') === 'true',
    )?.id;
    expect(firstActiveId).toBeTruthy();
    expect(input).toHaveAttribute('aria-activedescendant', firstActiveId);

    // Après ↓, l'activedescendant pointe le NOUVEL item actif.
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const optionsAfter = screen.getAllByRole('option');
    const secondActiveId = optionsAfter.find(
      (o) => o.getAttribute('aria-selected') === 'true',
    )?.id;
    expect(secondActiveId).toBeTruthy();
    expect(secondActiveId).not.toBe(firstActiveId);
    expect(input).toHaveAttribute('aria-activedescendant', secondActiveId);
  });
});
