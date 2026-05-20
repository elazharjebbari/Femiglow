import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IdeaForm } from './IdeaForm';

function createRunMock() {
  return vi.fn() as unknown as <T>(action: () => Promise<T>, onSuccess: (value: T) => void) => void;
}

describe('IdeaForm', () => {
  it('affiche les champs de cadrage et le bouton de soumission', () => {
    render(<IdeaForm disabled={false} onCreate={vi.fn()} run={createRunMock()} />);
    expect(screen.getByText(/Créer une idée/i)).toBeInTheDocument();
    expect(screen.getByText(/Pilier/i)).toBeInTheDocument();
    expect(screen.getByText(/Objectif/i)).toBeInTheDocument();
    expect(screen.getByText(/Plateforme/i)).toBeInTheDocument();
    expect(screen.getByText(/Format/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Intention/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: /Enregistrer/i })).toBeInTheDocument();
  });

  it('désactive le bouton quand disabled est vrai', () => {
    render(<IdeaForm disabled={true} onCreate={vi.fn()} run={createRunMock()} />);
    expect(screen.getByRole('button', { name: /Enregistrer/i })).toBeDisabled();
  });

  it('affiche le texte par défaut dans le champ intention', () => {
    render(<IdeaForm disabled={false} onCreate={vi.fn()} run={createRunMock()} />);
    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveValue('Présenter le rituel FemiGlow comme un geste lent du soir');
  });
});