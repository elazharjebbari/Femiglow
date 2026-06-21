// @vitest-environment jsdom
/**
 * F07 P3.4-l (Lot 6) — liste interactive : recherche, tri, EmptyState,
 * dupliquer (POST → navigation), supprimer (ConfirmDialog + garde 409).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { TemplatesListClient } from '../TemplatesListClient';
import type { TemplateListItem } from '../template-list';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

const items: TemplateListItem[] = [
  { id: '1', slug: 'bienvenue', name: 'Accueil', subjectTmpl: 'Salut', updatedAt: '2026-06-01T00:00:00.000Z' },
  { id: '2', slug: 'relance', name: 'Panier', subjectTmpl: 'Reviens', updatedAt: '2026-06-10T00:00:00.000Z' },
];

beforeEach(() => {
  push.mockClear();
  global.fetch = vi.fn();
});

describe('TemplatesListClient (P3.4-l)', () => {
  it('F07-C-032 — EmptyState quand aucun template (CTA création)', () => {
    render(<TemplatesListClient initialItems={[]} />);
    expect(screen.getByText('Aucun template')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Nouveau template/ })).toHaveAttribute(
      'href',
      '/admin/emails/templates/new',
    );
    // Pas de barre de recherche sans données.
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });

  it('F07-C-033 — recherche filtre par slug/nom/sujet ; sans résultat → EmptyState filtré + reset', () => {
    render(<TemplatesListClient initialItems={items} />);
    const search = screen.getByRole('searchbox');
    fireEvent.change(search, { target: { value: 'reviens' } });
    expect(screen.getByText('Panier')).toBeInTheDocument();
    expect(screen.queryByText('Accueil')).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'zzz' } });
    expect(screen.getByText('Aucun résultat')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Réinitialiser/ }));
    expect(screen.getByText('Accueil')).toBeInTheDocument();
  });

  it('F07-C-034 — tri par colonne : clic Slug trie asc puis desc (aria-sort)', () => {
    render(<TemplatesListClient initialItems={items} />);
    const slugHeader = screen.getByRole('columnheader', { name: /Slug/ });
    fireEvent.click(within(slugHeader).getByRole('button'));
    expect(slugHeader).toHaveAttribute('aria-sort', 'ascending');
    // 1re ligne de corps = bienvenue (asc).
    const firstRow = screen.getAllByRole('row')[1]!;
    expect(within(firstRow).getByText('bienvenue')).toBeInTheDocument();

    fireEvent.click(within(slugHeader).getByRole('button'));
    expect(slugHeader).toHaveAttribute('aria-sort', 'descending');
    const firstRowDesc = screen.getAllByRole('row')[1]!;
    expect(within(firstRowDesc).getByText('relance')).toBeInTheDocument();
  });

  it('F07-C-035 — Dupliquer : POST puis navigation vers l’éditeur de la copie', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ id: '99', slug: 'bienvenue-copie' }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    );
    render(<TemplatesListClient initialItems={items} />);
    const row = screen.getByText('bienvenue').closest('tr')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Dupliquer' }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith('/admin/emails/templates/99/edit'),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/admin/emails/templates/1/duplicate',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('F07-C-036 — Supprimer : ConfirmDialog → DELETE 200 retire la ligne', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    render(<TemplatesListClient initialItems={items} />);
    const row = screen.getByText('relance').closest('tr')!;
    fireEvent.click(within(row).getByRole('button', { name: /Supprimer relance/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Supprimer' }));
    await waitFor(() => expect(screen.queryByText('relance')).not.toBeInTheDocument());
  });

  it('F07-C-037 — Supprimer : DELETE 409 affiche les automations bloquantes (pas d’échec muet)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({
          error: 'Template utilisé par une ou plusieurs automations',
          automations: [{ id: 'a1', slug: 'welcome-flow', name: 'Flux bienvenue', active: true }],
        }),
        { status: 409, headers: { 'content-type': 'application/json' } },
      ),
    );
    render(<TemplatesListClient initialItems={items} />);
    const row = screen.getByText('bienvenue').closest('tr')!;
    fireEvent.click(within(row).getByRole('button', { name: /Supprimer bienvenue/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Supprimer' }));
    // Le template reste présent + bandeau listant l'automation bloquante.
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /Flux bienvenue/ })).toHaveAttribute(
        'href',
        '/admin/emails/automation/welcome-flow',
      ),
    );
    expect(screen.getByText('bienvenue')).toBeInTheDocument();
  });
});
