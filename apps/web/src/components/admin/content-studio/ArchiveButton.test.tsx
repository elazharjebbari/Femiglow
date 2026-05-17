import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ArchiveButton } from './ArchiveButton';

function createRunMock() {
  return vi.fn() as unknown as <T>(action: () => Promise<T>, onSuccess: (value: T) => void) => void;
}

describe('ArchiveButton', () => {
  it('affiche le bouton Archiver pour une idée', () => {
    render(<ArchiveButton entityType="idea" entityId="idea_1" disabled={false} onArchived={vi.fn()} run={createRunMock()} />);
    expect(screen.getByRole('button', { name: /Archiver/i })).toBeInTheDocument();
  });

  it('affiche le bouton Archiver pour un brouillon', () => {
    render(<ArchiveButton entityType="draft" entityId="draft_1" disabled={false} onArchived={vi.fn()} run={createRunMock()} />);
    expect(screen.getByRole('button', { name: /Archiver/i })).toBeInTheDocument();
  });

  it('affiche le bouton Archiver pour un post', () => {
    render(<ArchiveButton entityType="post" entityId="post_1" disabled={false} onArchived={vi.fn()} run={createRunMock()} />);
    expect(screen.getByRole('button', { name: /Archiver/i })).toBeInTheDocument();
  });

  it('désactive le bouton quand disabled est vrai', () => {
    render(<ArchiveButton entityType="idea" entityId="idea_1" disabled onArchived={vi.fn()} run={createRunMock()} />);
    expect(screen.getByRole('button', { name: /Archiver/i })).toBeDisabled();
  });

  it('affiche la confirmation après un clic pour une idée', () => {
    render(<ArchiveButton entityType="idea" entityId="idea_1" disabled={false} onArchived={vi.fn()} run={createRunMock()} />);
    fireEvent.click(screen.getByRole('button', { name: /Archiver/i }));
    expect(screen.getByText(/Archiver l'idée/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirmer/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Non/i })).toBeInTheDocument();
  });

  it('affiche la confirmation après un clic pour un brouillon', () => {
    render(<ArchiveButton entityType="draft" entityId="draft_1" disabled={false} onArchived={vi.fn()} run={createRunMock()} />);
    fireEvent.click(screen.getByRole('button', { name: /Archiver/i }));
    expect(screen.getByText(/Archiver le brouillon/i)).toBeInTheDocument();
  });

  it('affiche la confirmation après un clic pour un post', () => {
    render(<ArchiveButton entityType="post" entityId="post_1" disabled={false} onArchived={vi.fn()} run={createRunMock()} />);
    fireEvent.click(screen.getByRole('button', { name: /Archiver/i }));
    expect(screen.getByText(/Archiver le post/i)).toBeInTheDocument();
  });

  it('revient au bouton initial quand on annule', () => {
    render(<ArchiveButton entityType="idea" entityId="idea_1" disabled={false} onArchived={vi.fn()} run={createRunMock()} />);
    fireEvent.click(screen.getByRole('button', { name: /Archiver/i }));
    fireEvent.click(screen.getByRole('button', { name: /Non/i }));
    expect(screen.getByRole('button', { name: /Archiver/i })).toBeInTheDocument();
  });
});