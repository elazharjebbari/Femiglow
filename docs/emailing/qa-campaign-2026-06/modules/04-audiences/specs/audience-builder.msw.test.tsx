/**
 * AUD-BLD-* / AUD-AC-* — AudienceRulesBuilder + autocompletes.
 *
 * Le builder est CONTRÔLÉ (value/onChange) : on vérifie qu'aucune condition
 * n'est perdue lors d'ajout / suppression / réordonnancement / imbrication.
 * Les autocompletes appellent le réseau → MSW (succès + échec sans faux
 * résultats).
 *
 * NB chemin : à déposer sous apps/web/src/components/admin/emails/audiences/.
 * NB cache : TagAutocomplete mémoize au niveau module → cette suite réimporte
 * le composant via resetModules pour isoler l'état réseau.
 */
import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { server, http, HttpResponse } from '@/test/msw/server';
import { AudienceRulesBuilder } from '@/components/admin/emails/audiences/AudienceRulesBuilder';
import type { RulesGroup } from '@/lib/mail/audiences/rules-types';

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});
afterAll(() => server.close());

const empty = (): RulesGroup => ({ kind: 'all', conditions: [] });

// ── Builder : ajout / suppression / toggle / imbrication ────────────────
describe('AudienceRulesBuilder — manipulation des règles', () => {
  it('AUD-BLD-001 : état vide affiche « Aucun critère »', () => {
    render(<AudienceRulesBuilder value={empty()} onChange={vi.fn()} />);
    expect(screen.getByText(/Aucun critère/i)).toBeInTheDocument();
    expect(screen.getByTestId('add-rule-btn')).toBeInTheDocument();
  });

  it('AUD-BLD-002 : ajout d’une règle via menu pousse la condition', async () => {
    const onChange = vi.fn();
    render(<AudienceRulesBuilder value={empty()} onChange={onChange} />);
    await act(async () => fireEvent.click(screen.getByTestId('add-rule-btn')));
    await act(async () => fireEvent.click(screen.getByTestId('add-rule-order_count')));
    const next = onChange.mock.calls.at(-1)![0] as RulesGroup;
    expect(next.conditions).toHaveLength(1);
    expect((next.conditions[0] as { kind: string }).kind).toBe('order_count');
  });

  it('AUD-BLD-003 : suppression retire la condition', async () => {
    const onChange = vi.fn();
    const value: RulesGroup = { kind: 'all', conditions: [{ kind: 'has_tag', tag: 'vip' }] };
    render(<AudienceRulesBuilder value={value} onChange={onChange} />);
    await act(async () => fireEvent.click(screen.getByTestId('remove-rule')));
    expect((onChange.mock.calls[0]![0] as RulesGroup).conditions).toHaveLength(0);
  });

  it('AUD-BLD-004 : toggle ET↔OU change kind', async () => {
    const onChange = vi.fn();
    const value: RulesGroup = {
      kind: 'all',
      conditions: [{ kind: 'has_tag', tag: 'a' }, { kind: 'has_tag', tag: 'b' }],
    };
    render(<AudienceRulesBuilder value={value} onChange={onChange} />);
    await act(async () => fireEvent.click(screen.getByTestId('toggle-combinator')));
    expect((onChange.mock.calls[0]![0] as RulesGroup).kind).toBe('any');
  });

  it('AUD-BLD-005 : sous-groupe a le kind opposé au parent', async () => {
    const onChange = vi.fn();
    render(<AudienceRulesBuilder value={empty()} onChange={onChange} />);
    await act(async () => fireEvent.click(screen.getByTestId('add-group-btn')));
    const sub = (onChange.mock.calls[0]![0] as RulesGroup).conditions[0] as RulesGroup;
    expect(sub.kind).toBe('any');
  });

  it('AUD-BLD-006 : masque l’ajout de groupe à maxDepth', () => {
    render(<AudienceRulesBuilder value={empty()} onChange={vi.fn()} depth={3} maxDepth={3} />);
    expect(screen.queryByTestId('add-group-btn')).not.toBeInTheDocument();
  });

  it('AUD-BLD-007 : édition d’une règle propage la nouvelle valeur', async () => {
    const onChange = vi.fn();
    const value: RulesGroup = { kind: 'all', conditions: [{ kind: 'has_tag', tag: 'vip' }] };
    render(<AudienceRulesBuilder value={value} onChange={onChange} />);
    const input = screen.getByDisplayValue('vip') as HTMLInputElement;
    await act(async () => fireEvent.change(input, { target: { value: 'premium' } }));
    expect((onChange.mock.calls.at(-1)![0] as RulesGroup).conditions[0]).toMatchObject({ tag: 'premium' });
  });

  it('AUD-BLD-008 : la suppression d’une règle au milieu conserve les autres (pas de perte)', async () => {
    const onChange = vi.fn();
    const value: RulesGroup = {
      kind: 'all',
      conditions: [
        { kind: 'has_tag', tag: 'a' },
        { kind: 'has_tag', tag: 'b' },
        { kind: 'has_tag', tag: 'c' },
      ],
    };
    render(<AudienceRulesBuilder value={value} onChange={onChange} />);
    // Supprime la 2e règle (index 1).
    const removeBtns = screen.getAllByTestId('remove-rule');
    await act(async () => fireEvent.click(removeBtns[1]!));
    const next = onChange.mock.calls[0]![0] as RulesGroup;
    expect(next.conditions.map((c) => (c as { tag: string }).tag)).toEqual(['a', 'c']);
  });

  it('AUD-BLD-009 : toggle masqué avec une seule condition', () => {
    const value: RulesGroup = { kind: 'all', conditions: [{ kind: 'has_tag', tag: 'vip' }] };
    render(<AudienceRulesBuilder value={value} onChange={vi.fn()} />);
    expect(screen.queryByTestId('toggle-combinator')).not.toBeInTheDocument();
  });
});

// ── Autocomplete tags (datalist alimentée par l'API) ────────────────────
describe('TagAutocomplete — réseau (MSW)', () => {
  it('AUD-AC-001 : suggestions remplies depuis l’API', async () => {
    vi.resetModules();
    server.use(
      http.get('/api/admin/leads/tags/autocomplete', () =>
        HttpResponse.json({ tags: [{ tag: 'ambassadrice', count: 12 }, { tag: 'vip', count: 4 }] }),
      ),
    );
    const { TagAutocomplete } = await import('@/components/admin/emails/audiences/TagAutocomplete');
    render(<TagAutocomplete value="" onChange={vi.fn()} />);
    await waitFor(() => {
      const opts = document.querySelectorAll('datalist option');
      expect(Array.from(opts).some((o) => (o as HTMLOptionElement).value === 'ambassadrice')).toBe(true);
    });
  });

  it('AUD-AC-002 : erreur 500 → aucune suggestion fantôme', async () => {
    vi.resetModules();
    server.use(
      http.get('/api/admin/leads/tags/autocomplete', () =>
        HttpResponse.json({ error: 'internal' }, { status: 500 }),
      ),
    );
    const { TagAutocomplete } = await import('@/components/admin/emails/audiences/TagAutocomplete');
    render(<TagAutocomplete value="" onChange={vi.fn()} />);
    // L'input reste libre, mais aucune option fantôme n'est ajoutée.
    await waitFor(() => {
      const opts = document.querySelectorAll('datalist option');
      expect(opts.length).toBe(0);
    });
  });
});
