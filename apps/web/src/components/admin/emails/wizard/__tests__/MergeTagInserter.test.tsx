// @vitest-environment jsdom
/**
 * F05 P3.2-c3 — MergeTagInserter (menu d'insertion, layers U + D + a11y).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MergeTagInserter } from '@/components/admin/emails/wizard/MergeTagInserter';

afterEach(() => vi.clearAllMocks());

describe('F05 — MergeTagInserter', () => {
  it('CMP-ASSIST-D-001 — fermé par défaut ; ouvre un menu listant les tags "always"', async () => {
    const user = userEvent.setup();
    render(<MergeTagInserter onInsert={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: /Insérer un champ/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /E-mail du contact/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Lien de désabonnement/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Voir dans le navigateur/i })).toBeInTheDocument();
  });

  it('CMP-ASSIST-D-002 — sélection d’un tag appelle onInsert(token) et ferme le menu', async () => {
    const user = userEvent.setup();
    const onInsert = vi.fn();
    render(<MergeTagInserter onInsert={onInsert} />);
    await user.click(screen.getByRole('button', { name: /Insérer un champ/i }));
    await user.click(screen.getByRole('menuitem', { name: /E-mail du contact/i }));
    expect(onInsert).toHaveBeenCalledWith('{{ .Subscriber.Email }}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('CMP-ASSIST-D-003 — groupe conditionnel honnête (avertissement + tag Nom)', async () => {
    const user = userEvent.setup();
    render(<MergeTagInserter onInsert={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /Insérer un champ/i }));
    expect(screen.getByText(/souvent vide pour les audiences/i)).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Nom du contact/i })).toBeInTheDocument();
  });

  it('CMP-ASSIST-D-004 — Échap ferme le menu', async () => {
    const user = userEvent.setup();
    render(<MergeTagInserter onInsert={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /Insérer un champ/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
