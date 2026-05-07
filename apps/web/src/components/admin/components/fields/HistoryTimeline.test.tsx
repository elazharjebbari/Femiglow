import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HistoryTimeline, type HistoryEntry } from './HistoryTimeline';
import type { ComponentFieldDefinition } from '@/lib/db/types';

const router = { push: vi.fn(), refresh: vi.fn() };
vi.mock('next/navigation', () => ({
  useRouter: () => router,
}));

const fieldDef: ComponentFieldDefinition = {
  key: 'title',
  label: 'Titre',
  type: 'text',
  group: 'Général',
  order: 0,
  required: false,
};

const entries: HistoryEntry[] = [
  {
    id: 'h_3',
    version: 3,
    value: 'Bonjour',
    status: 'published',
    action: 'publish',
    actorId: 'admin_1',
    notes: null,
    createdAt: '2026-05-04T10:00:00Z',
  },
  {
    id: 'h_2',
    version: 2,
    value: 'Bonsoir',
    status: 'draft',
    action: 'update',
    actorId: 'admin_1',
    notes: null,
    createdAt: '2026-05-03T10:00:00Z',
  },
  {
    id: 'h_1',
    version: 1,
    value: 'Salut',
    status: 'draft',
    action: 'create',
    actorId: 'admin_1',
    notes: null,
    createdAt: '2026-05-02T10:00:00Z',
  },
];

const fetchMock = vi.fn();

beforeEach(() => {
  router.push.mockReset();
  router.refresh.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HistoryTimeline', () => {
  it('rend une entrée par version avec un badge d\'action', () => {
    render(
      <HistoryTimeline
        componentKey="home-hero"
        fieldDef={fieldDef}
        entries={entries}
      />,
    );
    const items = document.querySelectorAll('[data-history-id]');
    expect(items.length).toBe(3);
    expect(screen.getByText('Publication')).toBeInTheDocument();
    expect(screen.getByText('Création')).toBeInTheDocument();
  });

  it('rend une diff par défaut entre les 2 dernières versions', () => {
    render(
      <HistoryTimeline
        componentKey="home-hero"
        fieldDef={fieldDef}
        entries={entries}
      />,
    );
    // text mode → on doit voir « Bonsoir » (v2 = before) et « Bonjour » (v3 = after)
    const ops = Array.from(document.querySelectorAll('[data-op]')).map((el) =>
      el.getAttribute('data-op'),
    );
    expect(ops).toContain('add');
    expect(ops).toContain('del');
  });

  it('met à jour la sélection beforeId quand on clique « Avant »', () => {
    render(
      <HistoryTimeline
        componentKey="home-hero"
        fieldDef={fieldDef}
        entries={entries}
      />,
    );
    const v1Item = document.querySelector('[data-history-id="h_1"]')!;
    const beforeBtn = v1Item.querySelectorAll('button')[0]!;
    fireEvent.click(beforeBtn);
    expect(v1Item.getAttribute('data-selected')).toBe('before');
  });

  it('appelle POST /restore et redirige sur succès', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ binding: { id: 'b1' } }),
    });
    render(
      <HistoryTimeline
        componentKey="home-hero"
        fieldDef={fieldDef}
        entries={entries}
      />,
    );
    const v3Item = document.querySelector('[data-history-id="h_3"]')!;
    const restoreBtn = Array.from(v3Item.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Restaurer'),
    )!;
    fireEvent.click(restoreBtn);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toContain('/api/admin/components/home-hero/fields/title/restore');
    expect((init as RequestInit).method).toBe('POST');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ historyId: 'h_3' });
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/admin/components/home-hero'));
  });

  it('affiche une erreur quand /restore échoue (422)', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ message: 'Incompatible' }),
    });
    render(
      <HistoryTimeline
        componentKey="home-hero"
        fieldDef={fieldDef}
        entries={entries}
      />,
    );
    const v1Item = document.querySelector('[data-history-id="h_1"]')!;
    const restoreBtn = Array.from(v1Item.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Restaurer'),
    )!;
    fireEvent.click(restoreBtn);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Incompatible'));
  });

  it('rend un état vide quand entries=[]', () => {
    render(
      <HistoryTimeline
        componentKey="home-hero"
        fieldDef={fieldDef}
        entries={[]}
      />,
    );
    expect(screen.getByText(/Aucun historique/i)).toBeInTheDocument();
  });
});
