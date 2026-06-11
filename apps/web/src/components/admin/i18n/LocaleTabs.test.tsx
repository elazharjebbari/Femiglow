/**
 * RTL — LocaleTabs (T3.8).
 *
 * Couvre :
 *  - rendu des 3 onglets FR / AR / EN avec aria-selected sur l'actif
 *  - onClick d'un onglet inactif → callback onChange(locale)
 *  - onClick de l'onglet déjà actif → aucun callback (évite re-render inutile)
 *  - badge de complétion : point vert si traduit, gris sinon
 *  - tabindex roving (0 pour actif, -1 pour les autres)
 *
 * Cf. docs/i18n-strategy-2026-05/PHASE-3-PROGRESS.md (T3.8)
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LocaleTabs } from './LocaleTabs';

describe('LocaleTabs', () => {
  it('rend les 3 onglets FR / AR / EN', () => {
    render(<LocaleTabs activeLocale="fr" onChange={() => {}} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveTextContent(/FR/);
    expect(tabs[1]).toHaveTextContent(/AR/);
    expect(tabs[2]).toHaveTextContent(/EN/);
  });

  it("marque aria-selected sur l'onglet actif uniquement", () => {
    render(<LocaleTabs activeLocale="ar" onChange={() => {}} />);
    const [fr, ar, en] = screen.getAllByRole('tab');
    expect(fr).toHaveAttribute('aria-selected', 'false');
    expect(ar).toHaveAttribute('aria-selected', 'true');
    expect(en).toHaveAttribute('aria-selected', 'false');
  });

  it('appelle onChange(locale) quand on clique un onglet inactif', () => {
    const onChange = vi.fn();
    render(<LocaleTabs activeLocale="fr" onChange={onChange} />);
    const arTab = screen.getByRole('tab', { selected: false, name: /AR/ });
    fireEvent.click(arTab);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('ar');
  });

  it("n'appelle PAS onChange quand on clique l'onglet déjà actif", () => {
    const onChange = vi.fn();
    render(<LocaleTabs activeLocale="fr" onChange={onChange} />);
    const frTab = screen.getByRole('tab', { selected: true });
    fireEvent.click(frTab);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("affiche le badge 'traduit' (sr-only contient 'au moins un champ traduit') quand completion=true", () => {
    render(
      <LocaleTabs
        activeLocale="fr"
        onChange={() => {}}
        completion={{ fr: true, ar: false, en: false }}
      />,
    );
    expect(
      screen.getByText(/Français.*au moins un champ traduit/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Arabe.*rien de traduit/i)).toBeInTheDocument();
  });

  it('tabindex est 0 sur actif, -1 sur les autres (roving tabindex)', () => {
    render(<LocaleTabs activeLocale="en" onChange={() => {}} />);
    const [fr, ar, en] = screen.getAllByRole('tab');
    expect(fr).toHaveAttribute('tabindex', '-1');
    expect(ar).toHaveAttribute('tabindex', '-1');
    expect(en).toHaveAttribute('tabindex', '0');
  });

  it('lie aria-controls au panelId fourni', () => {
    render(
      <LocaleTabs activeLocale="fr" onChange={() => {}} panelId="my-editor-pane" />,
    );
    const fr = screen.getByRole('tab', { selected: true });
    expect(fr).toHaveAttribute('aria-controls', 'my-editor-pane');
  });
});
