/**
 * Tests `ResetSettingsConfirmDialog`.
 *
 * Couvre :
 *  - Ne rend rien si `open=false`.
 *  - Rend titre, description, code attendu (`RESET`) quand `open=true`.
 *  - Bouton confirm désactivé tant que la saisie n'est pas exactement « RESET ».
 *  - `busy=true` désactive même si saisie OK.
 *  - Escape, clic backdrop, bouton Annuler → onCancel.
 *  - Token personnalisé honoré.
 *  - Réouverture remet la saisie à zéro.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

import { ResetSettingsConfirmDialog } from './ResetSettingsConfirmDialog';

afterEach(() => cleanup());

describe('ResetSettingsConfirmDialog', () => {
  it('ne rend rien quand open=false', () => {
    render(
      <ResetSettingsConfirmDialog open={false} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.queryByTestId('seo-reset-dialog')).toBeNull();
  });

  it('rend le titre et le code attendu par défaut', () => {
    render(<ResetSettingsConfirmDialog open onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('Restaurer les paramètres par défaut')).toBeTruthy();
    expect(screen.getByText('RESET')).toBeTruthy();
  });

  it('confirme désactivé au mount', () => {
    render(<ResetSettingsConfirmDialog open onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByTestId<HTMLButtonElement>('seo-reset-confirm').disabled).toBe(true);
  });

  it('confirme reste désactivé pour une saisie incorrecte ou partielle', () => {
    render(<ResetSettingsConfirmDialog open onConfirm={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByTestId('seo-reset-input'), { target: { value: 'RESE' } });
    expect(screen.getByTestId<HTMLButtonElement>('seo-reset-confirm').disabled).toBe(true);
    fireEvent.change(screen.getByTestId('seo-reset-input'), { target: { value: 'reset' } });
    expect(screen.getByTestId<HTMLButtonElement>('seo-reset-confirm').disabled).toBe(true);
  });

  it('confirme s\'active quand la saisie est exactement RESET', () => {
    const onConfirm = vi.fn();
    render(<ResetSettingsConfirmDialog open onConfirm={onConfirm} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByTestId('seo-reset-input'), { target: { value: 'RESET' } });
    const btn = screen.getByTestId<HTMLButtonElement>('seo-reset-confirm');
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('busy désactive même si la saisie est correcte', () => {
    render(
      <ResetSettingsConfirmDialog open busy onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    fireEvent.change(screen.getByTestId('seo-reset-input'), { target: { value: 'RESET' } });
    expect(screen.getByTestId<HTMLButtonElement>('seo-reset-confirm').disabled).toBe(true);
  });

  it('Annuler, Escape, clic backdrop appellent onCancel', () => {
    const onCancel1 = vi.fn();
    const { unmount } = render(
      <ResetSettingsConfirmDialog open onConfirm={vi.fn()} onCancel={onCancel1} />,
    );
    fireEvent.click(screen.getByTestId('seo-reset-cancel'));
    expect(onCancel1).toHaveBeenCalledTimes(1);
    unmount();

    const onCancel2 = vi.fn();
    render(<ResetSettingsConfirmDialog open onConfirm={vi.fn()} onCancel={onCancel2} />);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onCancel2).toHaveBeenCalledTimes(1);
    cleanup();

    const onCancel3 = vi.fn();
    render(<ResetSettingsConfirmDialog open onConfirm={vi.fn()} onCancel={onCancel3} />);
    fireEvent.click(screen.getByTestId('seo-reset-dialog-backdrop'));
    expect(onCancel3).toHaveBeenCalledTimes(1);
  });

  it('accepte un expectedToken personnalisé', () => {
    render(
      <ResetSettingsConfirmDialog
        open
        expectedToken="DEFAULTS"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText('DEFAULTS')).toBeTruthy();
    fireEvent.change(screen.getByTestId('seo-reset-input'), { target: { value: 'RESET' } });
    expect(screen.getByTestId<HTMLButtonElement>('seo-reset-confirm').disabled).toBe(true);
    fireEvent.change(screen.getByTestId('seo-reset-input'), { target: { value: 'DEFAULTS' } });
    expect(screen.getByTestId<HTMLButtonElement>('seo-reset-confirm').disabled).toBe(false);
  });

  it('saisie réinitialisée à chaque réouverture', () => {
    const { rerender } = render(
      <ResetSettingsConfirmDialog open onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    fireEvent.change(screen.getByTestId('seo-reset-input'), { target: { value: 'RESET' } });
    expect(screen.getByTestId<HTMLButtonElement>('seo-reset-confirm').disabled).toBe(false);

    rerender(<ResetSettingsConfirmDialog open={false} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    rerender(<ResetSettingsConfirmDialog open onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByTestId<HTMLInputElement>('seo-reset-input').value).toBe('');
    expect(screen.getByTestId<HTMLButtonElement>('seo-reset-confirm').disabled).toBe(true);
  });
});
