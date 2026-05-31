import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CancelDialog } from './CancelDialog';

function createRunMock() {
  return vi.fn() as unknown as <T>(action: () => Promise<T>, onSuccess: (value: T) => void) => void;
}

describe('CancelDialog', () => {
  it('affiche le bouton Annuler la publication par défaut', () => {
    render(<CancelDialog postId="post_1" disabled={false} onCancelled={vi.fn()} run={createRunMock()} />);
    expect(screen.getByRole('button', { name: /Annuler la publication/i })).toBeInTheDocument();
  });

  it('désactive le bouton quand disabled est vrai', () => {
    render(<CancelDialog postId="post_1" disabled onCancelled={vi.fn()} run={createRunMock()} />);
    expect(screen.getByRole('button', { name: /Annuler la publication/i })).toBeDisabled();
  });

  it('affiche la confirmation après un clic', () => {
    render(<CancelDialog postId="post_1" disabled={false} onCancelled={vi.fn()} run={createRunMock()} />);
    fireEvent.click(screen.getByRole('button', { name: /Annuler la publication/i }));
    expect(screen.getByText(/Annuler la publication planifiée/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirmer/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Garder/i })).toBeInTheDocument();
  });

  it('revient au bouton initial quand on garde la publication', () => {
    render(<CancelDialog postId="post_1" disabled={false} onCancelled={vi.fn()} run={createRunMock()} />);
    fireEvent.click(screen.getByRole('button', { name: /Annuler la publication/i }));
    fireEvent.click(screen.getByRole('button', { name: /Garder/i }));
    expect(screen.getByRole('button', { name: /Annuler la publication/i })).toBeInTheDocument();
  });

  it('affiche un champ textarea pour la raison', () => {
    render(<CancelDialog postId="post_1" disabled={false} onCancelled={vi.fn()} run={createRunMock()} />);
    fireEvent.click(screen.getByRole('button', { name: /Annuler la publication/i }));
    expect(screen.getByPlaceholderText(/Raison/i)).toBeInTheDocument();
  });
});