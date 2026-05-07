/**
 * RTL — BulkActionBar.
 *
 * Couvre :
 *  - n'apparaît pas si count=0,
 *  - tous les boutons firent leur callback respectif,
 *  - sélecteurs « Mode d'affichage » / « Position » → onSetDisplay,
 *  - axe (aria-label sur la région).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { expectNoAxeViolations } from '@/test/axe';
import { BulkActionBar } from './BulkActionBar';

const noop = () => {};
const baseProps = {
  busy: false,
  onActivate: noop,
  onDeactivate: noop,
  onDelete: noop,
  onSetDisplay: noop,
  onClear: noop,
};

describe('BulkActionBar', () => {
  it("n'affiche rien si count=0", () => {
    const { container } = render(<BulkActionBar count={0} {...baseProps} />);
    expect(container.firstChild).toBeNull();
  });

  it('affiche le compteur', () => {
    render(<BulkActionBar count={3} {...baseProps} />);
    expect(screen.getByTestId('bulk-count')).toHaveTextContent(/3 sélectionnés/);
  });

  it('clic activer → onActivate', () => {
    const onActivate = vi.fn();
    render(<BulkActionBar count={2} {...baseProps} onActivate={onActivate} />);
    fireEvent.click(screen.getByRole('button', { name: /^activer$/i }));
    expect(onActivate).toHaveBeenCalled();
  });

  it('clic désactiver → onDeactivate', () => {
    const onDeactivate = vi.fn();
    render(<BulkActionBar count={2} {...baseProps} onDeactivate={onDeactivate} />);
    fireEvent.click(screen.getByRole('button', { name: /^désactiver$/i }));
    expect(onDeactivate).toHaveBeenCalled();
  });

  it('clic supprimer → confirm() → onDelete', () => {
    const onDelete = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<BulkActionBar count={2} {...baseProps} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole('button', { name: /^supprimer$/i }));
    expect(onDelete).toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("supprimer annulé via confirm() → pas d'appel", () => {
    const onDelete = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<BulkActionBar count={2} {...baseProps} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole('button', { name: /^supprimer$/i }));
    expect(onDelete).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('changer le select « fit » → onSetDisplay(fit, center)', () => {
    const onSetDisplay = vi.fn();
    render(<BulkActionBar count={2} {...baseProps} onSetDisplay={onSetDisplay} />);
    fireEvent.change(screen.getByLabelText(/mode d.affichage groupé/i), {
      target: { value: 'contain' },
    });
    expect(onSetDisplay).toHaveBeenCalledWith('contain', 'center');
  });

  it('changer le select « position » → onSetDisplay(cover, pos)', () => {
    const onSetDisplay = vi.fn();
    render(<BulkActionBar count={2} {...baseProps} onSetDisplay={onSetDisplay} />);
    fireEvent.change(screen.getByLabelText(/position groupée/i), {
      target: { value: 'top' },
    });
    expect(onSetDisplay).toHaveBeenCalledWith('cover', 'top');
  });

  it('clic effacer → onClear', () => {
    const onClear = vi.fn();
    render(<BulkActionBar count={2} {...baseProps} onClear={onClear} />);
    fireEvent.click(screen.getByRole('button', { name: /effacer/i }));
    expect(onClear).toHaveBeenCalled();
  });

  it('respecte axe', async () => {
    const { container } = render(<BulkActionBar count={2} {...baseProps} />);
    await expectNoAxeViolations(container);
  });
});
