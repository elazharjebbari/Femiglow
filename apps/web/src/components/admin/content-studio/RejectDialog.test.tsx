import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RejectDialog } from './RejectDialog';

function createRunMock() {
  return vi.fn() as unknown as <T>(action: () => Promise<T>, onSuccess: (value: T) => void) => void;
}

describe('RejectDialog', () => {
  it('affiche le bouton Rejeter par défaut', () => {
    render(<RejectDialog draftId="draft_1" disabled={false} onRejected={vi.fn()} run={createRunMock()} />);
    expect(screen.getByRole('button', { name: /Rejeter/i })).toBeInTheDocument();
  });

  it('désactive le bouton quand disabled est vrai', () => {
    render(<RejectDialog draftId="draft_1" disabled onRejected={vi.fn()} run={createRunMock()} />);
    expect(screen.getByRole('button', { name: /Rejeter/i })).toBeDisabled();
  });

  it('affiche la confirmation après un clic', () => {
    render(<RejectDialog draftId="draft_1" disabled={false} onRejected={vi.fn()} run={createRunMock()} />);
    fireEvent.click(screen.getByRole('button', { name: /Rejeter/i }));
    expect(screen.getByText(/Rejeter ce brouillon/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirmer le rejet/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Annuler/i })).toBeInTheDocument();
  });

  it('revient au bouton initial quand on annule', () => {
    render(<RejectDialog draftId="draft_1" disabled={false} onRejected={vi.fn()} run={createRunMock()} />);
    fireEvent.click(screen.getByRole('button', { name: /Rejeter/i }));
    fireEvent.click(screen.getByRole('button', { name: /Annuler/i }));
    expect(screen.getByRole('button', { name: /Rejeter/i })).toBeInTheDocument();
  });

  it('affiche un champ textarea pour la raison', () => {
    render(<RejectDialog draftId="draft_1" disabled={false} onRejected={vi.fn()} run={createRunMock()} />);
    fireEvent.click(screen.getByRole('button', { name: /Rejeter/i }));
    expect(screen.getByPlaceholderText(/Raison/i)).toBeInTheDocument();
  });
});