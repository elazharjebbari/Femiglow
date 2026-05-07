/**
 * RTL — SelectAllCheckbox.
 *
 * Couvre les trois états (vide / partiel / plein) + le voyant texte.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SelectAllCheckbox } from './SelectAllCheckbox';

describe('SelectAllCheckbox', () => {
  it('état vide : voyant « Tout sélectionner »', () => {
    render(
      <SelectAllCheckbox totalCount={5} selectedCount={0} onChange={() => {}} />,
    );
    const cb = screen.getByRole('checkbox') as HTMLInputElement;
    expect(cb.checked).toBe(false);
    expect(cb.indeterminate).toBe(false);
    expect(screen.getByTestId('select-all-state')).toHaveTextContent(
      /Tout sélectionner/,
    );
  });

  it('état partiel : indeterminate=true + voyant « x / total »', () => {
    render(
      <SelectAllCheckbox totalCount={5} selectedCount={2} onChange={() => {}} />,
    );
    const cb = screen.getByRole('checkbox') as HTMLInputElement;
    expect(cb.checked).toBe(false);
    expect(cb.indeterminate).toBe(true);
    expect(screen.getByTestId('select-all-state')).toHaveTextContent(/2 \/ 5/);
  });

  it('état plein : checked + voyant « Tout sélectionné »', () => {
    render(
      <SelectAllCheckbox totalCount={5} selectedCount={5} onChange={() => {}} />,
    );
    const cb = screen.getByRole('checkbox') as HTMLInputElement;
    expect(cb.checked).toBe(true);
    expect(cb.indeterminate).toBe(false);
    expect(screen.getByTestId('select-all-state')).toHaveTextContent(/Tout sélectionné/);
  });

  it("clic depuis « tout sélectionné » → onChange(false)", () => {
    const onChange = vi.fn();
    render(
      <SelectAllCheckbox totalCount={5} selectedCount={5} onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('clic depuis « rien » → onChange(true)', () => {
    const onChange = vi.fn();
    render(
      <SelectAllCheckbox totalCount={5} selectedCount={0} onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
