/**
 * Tests `BulkDeleteConfirmDialog`.
 *
 * Couvre :
 *  - `open=false` ne rend rien (pas de fuite DOM, pas de focus parasite).
 *  - `open=true` rend le titre, la description et le count.
 *  - Le bouton « Supprimer » est désactivé au mount, le reste tant que la
 *    saisie ne correspond pas à `count`, et s'active dès qu'elle correspond.
 *  - `busy=true` désactive les deux boutons même quand la saisie est valide.
 *  - `onConfirm` n'est appelé que si la saisie matche et `busy=false`.
 *  - `onCancel` est appelé par le bouton Annuler, par `Escape` et par clic backdrop.
 *  - Réouverture remet la saisie à zéro (évite la double-confirmation par
 *    inertie de l'état précédent).
 *  - `aria-invalid` posé tant que la saisie est non vide et incorrecte.
 */
import { describe, it, expect, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach } from 'vitest';

import { BulkDeleteConfirmDialog } from './BulkDeleteConfirmDialog';

afterEach(() => {
  cleanup();
});

describe('BulkDeleteConfirmDialog', () => {
  it('ne rend rien quand open=false', () => {
    render(
      <BulkDeleteConfirmDialog
        open={false}
        count={5}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('seo-bulk-delete-dialog')).toBeNull();
  });

  it('rend le titre, la description et le count quand open=true', () => {
    render(
      <BulkDeleteConfirmDialog
        open
        count={12}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByTestId('seo-bulk-delete-dialog')).toBeTruthy();
    expect(screen.getByText('Confirmer la suppression')).toBeTruthy();
    // Le count apparaît au moins une fois dans la description et le bouton.
    expect(screen.getAllByText(/12/).length).toBeGreaterThan(0);
  });

  it('confirme désactivé au mount', () => {
    render(
      <BulkDeleteConfirmDialog
        open
        count={3}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByTestId<HTMLButtonElement>('seo-bulk-delete-confirm').disabled).toBe(true);
  });

  it('confirme reste désactivé pour une saisie incorrecte', () => {
    render(
      <BulkDeleteConfirmDialog
        open
        count={4}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const input = screen.getByTestId<HTMLInputElement>('seo-bulk-delete-input');
    fireEvent.change(input, { target: { value: '7' } });
    expect(screen.getByTestId<HTMLButtonElement>('seo-bulk-delete-confirm').disabled).toBe(true);
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('confirme s\'active quand la saisie correspond exactement', () => {
    render(
      <BulkDeleteConfirmDialog
        open
        count={4}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByTestId('seo-bulk-delete-input'), {
      target: { value: '4' },
    });
    expect(screen.getByTestId<HTMLButtonElement>('seo-bulk-delete-confirm').disabled).toBe(false);
  });

  it('appelle onConfirm uniquement quand la saisie matche', () => {
    const onConfirm = vi.fn();
    render(
      <BulkDeleteConfirmDialog
        open
        count={2}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    const confirm = screen.getByTestId('seo-bulk-delete-confirm');
    // Clic alors que disabled — doit être no-op (le browser bloque mais on
    // teste le contract handler quand même).
    fireEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId('seo-bulk-delete-input'), {
      target: { value: '2' },
    });
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('busy désactive le bouton confirmer même si la saisie matche', () => {
    render(
      <BulkDeleteConfirmDialog
        open
        count={3}
        busy
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByTestId('seo-bulk-delete-input'), {
      target: { value: '3' },
    });
    expect(screen.getByTestId<HTMLButtonElement>('seo-bulk-delete-confirm').disabled).toBe(true);
  });

  it('Annuler appelle onCancel', () => {
    const onCancel = vi.fn();
    render(
      <BulkDeleteConfirmDialog
        open
        count={1}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByTestId('seo-bulk-delete-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Escape appelle onCancel', () => {
    const onCancel = vi.fn();
    render(
      <BulkDeleteConfirmDialog
        open
        count={1}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('clic sur le backdrop appelle onCancel, clic à l\'intérieur ne le fait pas', () => {
    const onCancel = vi.fn();
    render(
      <BulkDeleteConfirmDialog
        open
        count={1}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );
    const backdrop = screen.getByTestId('seo-bulk-delete-dialog-backdrop');
    const dialog = screen.getByTestId('seo-bulk-delete-dialog');

    fireEvent.click(dialog);
    expect(onCancel).not.toHaveBeenCalled();

    fireEvent.click(backdrop);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('la saisie est réinitialisée à chaque réouverture', () => {
    const { rerender } = render(
      <BulkDeleteConfirmDialog
        open
        count={5}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByTestId('seo-bulk-delete-input'), {
      target: { value: '5' },
    });
    expect(screen.getByTestId<HTMLButtonElement>('seo-bulk-delete-confirm').disabled).toBe(false);

    // Fermer
    rerender(
      <BulkDeleteConfirmDialog
        open={false}
        count={5}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    // Rouvrir avec un autre count
    rerender(
      <BulkDeleteConfirmDialog
        open
        count={3}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    // Le champ est vide, le bouton est disabled — la saisie précédente n'a
    // pas fui.
    expect(screen.getByTestId<HTMLInputElement>('seo-bulk-delete-input').value).toBe('');
    expect(screen.getByTestId<HTMLButtonElement>('seo-bulk-delete-confirm').disabled).toBe(true);
  });
});
