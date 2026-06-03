/**
 * N07 — <NavEditor/> édition locale (sans réseau).
 *
 * add / move (bornes) / remove / update + dirty + validation client (navSchema).
 * cf. docs/admin-nav-coupons-qa-2026-06-03/N07.
 */
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { NavEditor } from './NavEditor';
import type { ConfigMeta, NavItem } from '@/lib/admin-config/types';

const META: ConfigMeta = { version: 3, updatedAt: '2026-06-01T00:00:00.000Z', updatedBy: null, isDefault: false };
const ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Tableau de bord', href: '/admin', icon: 'home', position: 0 },
  { key: 'coupons', label: 'Coupons', href: '/admin/coupons', icon: 'tag', position: 1 },
];

function renderEditor(items = ITEMS) {
  return render(<NavEditor initialItems={items} meta={META} />);
}

function saveButton() {
  return screen.getByRole('button', { name: /Enregistrer/ }) as HTMLButtonElement;
}

describe('N07 NavEditor — édition locale', () => {
  it('N07-C001 état initial : non dirty → bouton Enregistrer désactivé', () => {
    renderEditor();
    expect(saveButton()).toBeDisabled();
  });

  it('N07-C002 ajouter un item → +1 ligne (« Nouvel item »)', () => {
    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: /Ajouter un item/ }));
    expect(screen.getByDisplayValue('Nouvel item')).toBeInTheDocument();
    expect(screen.getByText('3 items')).toBeInTheDocument();
  });

  it('N07-C003 supprimer un item → ligne retirée', () => {
    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer Coupons' }));
    expect(screen.queryByDisplayValue('Coupons')).not.toBeInTheDocument();
    expect(screen.getByText('1 items')).toBeInTheDocument();
  });

  it('N07-C004 éditer un libellé → devient dirty (Enregistrer actif)', () => {
    renderEditor();
    fireEvent.change(screen.getByDisplayValue('Coupons'), { target: { value: 'Coupons promo' } });
    expect(saveButton()).not.toBeDisabled();
  });

  it('N07-C005 bornes de déplacement : 1ʳᵉ ligne « Monter » désactivé, dernière « Descendre » désactivé', () => {
    renderEditor();
    const rows = screen.getAllByRole('row').slice(1); // skip header
    expect(within(rows[0]!).getByRole('button', { name: 'Monter' })).toBeDisabled();
    expect(within(rows[rows.length - 1]!).getByRole('button', { name: 'Descendre' })).toBeDisabled();
  });

  it('N07-C006 descendre la 1ʳᵉ ligne → l’ordre des clés est permuté', () => {
    renderEditor();
    const rowsBefore = screen.getAllByRole('row').slice(1);
    fireEvent.click(within(rowsBefore[0]!).getByRole('button', { name: 'Descendre' }));
    // Après permutation, la 1ʳᵉ ligne porte la clé « coupons ».
    const firstKeyInput = within(screen.getAllByRole('row').slice(1)[0]!).getByDisplayValue('coupons');
    expect(firstKeyInput).toBeInTheDocument();
  });

  it('N07-C007 validation client : libellé vide → « erreur(s) à corriger », pas de sauvegarde', () => {
    renderEditor();
    fireEvent.change(screen.getByDisplayValue('Coupons'), { target: { value: '' } });
    fireEvent.click(saveButton());
    expect(screen.getByText(/erreur\(s\) à corriger/i)).toBeInTheDocument();
  });
});
