/**
 * Module 02 — Cockpit : vues sauvegardées (F-016, défaut P1).
 *
 * Audit : `handleSelectView` était un no-op (highlight seul, n'appliquait PAS le
 * filterState) ; `onCreate` = window.alert stub. Fix livré :
 *  - sélectionner une vue applique RÉELLEMENT son filterState (filters + sort)
 *    → POST /search reçoit les filtres de la vue (CKP-MSW-070) ;
 *  - aria-current sur la vue active (CKP-MSW-071) ;
 *  - « + Nouvelle vue » ouvre un vrai formulaire, pas une alert (CKP-MSW-072) ;
 *  - la création persiste via POST /views (CKP-MSW-073) ;
 *  - les vues système restent non éditables (CKP-MSW-076).
 *
 * Le feedback d'échec rename/delete (CKP-MSW-074/075) est déjà couvert par
 * cockpit-bulk-actions.msw.test.tsx — non dupliqué ici.
 *
 * Harnais RÉEL : serveur MSW partagé + override local.
 */
import {
  describe,
  expect,
  it,
  beforeAll,
  afterEach,
  afterAll,
  beforeEach,
  vi,
} from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server, http, HttpResponse } from '@/test/msw/server';
import { makeSearchRow, makeSummary } from '@/test/msw/emails-handlers';
import type { SidebarView } from '@/components/admin/emails/cockpit/SavedViewsSidebar';

const push = vi.fn();
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => new URLSearchParams(''),
}));

import { TransactionalCockpit } from '@/components/admin/emails/cockpit/TransactionalCockpit';

const SEARCH = '/api/admin/emails/transactional/search';
const SUMMARY = '/api/admin/emails/transactional/summary';
const VIEWS = '/api/admin/emails/views';

type SearchBody = {
  filters: { key: string; value: unknown }[];
  freetext?: string;
  pagination: { limit: number; offset: number };
  sort?: string;
};

function captureSearchBodies(bodies: SearchBody[]) {
  server.use(
    http.post(SEARCH, async ({ request }) => {
      bodies.push((await request.json()) as SearchBody);
      return HttpResponse.json({
        rows: [makeSearchRow({ id: 'out_0' })],
        total: 1,
        window: 'matched',
      });
    }),
    http.get(SUMMARY, () => HttpResponse.json(makeSummary())),
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => server.use(http.get(SUMMARY, () => HttpResponse.json(makeSummary()))));
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

describe('Cockpit — vues sauvegardées (F-016)', () => {
  // CKP-MSW-070 : sélectionner une vue APPLIQUE son filterState (régression).
  it('CKP-MSW-070 : sélection d’une vue → POST search avec le filterState de la vue', async () => {
    const bodies: SearchBody[] = [];
    captureSearchBodies(bodies);
    const viewsList: SidebarView[] = [
      {
        id: 'view_failures',
        name: 'Échecs récents',
        isSystem: false,
        filterState: { filters: { status: ['failed', 'dlq'] }, sort: 'date_desc', cols: [] },
      },
    ];
    const user = userEvent.setup();
    render(<TransactionalCockpit initialViews={viewsList} />);
    await waitFor(() => expect(bodies.length).toBeGreaterThanOrEqual(1));
    // Le 1er fetch est sans filtre.
    expect(bodies[0]!.filters).toEqual([]);
    await user.click(screen.getByTestId('view-view_failures'));
    // Oracle : un POST /search porte EXACTEMENT les filtres de la vue.
    await waitFor(() => {
      const last = bodies[bodies.length - 1]!;
      expect(last.filters).toEqual([
        expect.objectContaining({ key: 'status', value: ['failed', 'dlq'] }),
      ]);
    });
  });

  // CKP-MSW-071 : la vue sélectionnée est marquée active (aria-current).
  it('CKP-MSW-071 : vue active surlignée via aria-current', async () => {
    captureSearchBodies([]);
    const viewsList: SidebarView[] = [
      {
        id: 'view_failures',
        name: 'Échecs récents',
        isSystem: false,
        filterState: { filters: { status: ['failed'] } },
      },
    ];
    const user = userEvent.setup();
    render(<TransactionalCockpit initialViews={viewsList} />);
    const viewBtn = await screen.findByTestId('view-view_failures');
    expect(viewBtn).not.toHaveAttribute('aria-current', 'true');
    await user.click(viewBtn);
    await waitFor(() =>
      expect(screen.getByTestId('view-view_failures')).toHaveAttribute('aria-current', 'true'),
    );
  });

  // CKP-MSW-072 : « Nouvelle vue » ouvre un VRAI formulaire (pas window.alert).
  it('CKP-MSW-072 : « + Nouvelle vue » monte un formulaire, sans window.alert', async () => {
    captureSearchBodies([]);
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();
    render(<TransactionalCockpit initialViews={[]} />);
    await user.click(await screen.findByTestId('create-view-btn'));
    // Oracle : formulaire de création monté, alert jamais appelée.
    expect(screen.getByTestId('create-view-form')).toBeInTheDocument();
    expect(screen.getByLabelText(/nom de la vue/i)).toBeInTheDocument();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  // CKP-MSW-073 : la création persiste via POST /views avec name + filterState.
  it('CKP-MSW-073 : enregistrer la vue → POST /views avec name + scope + filterState', async () => {
    captureSearchBodies([]);
    let createBody: { name?: string; scope?: string; filterState?: unknown } | null = null;
    server.use(
      http.post(VIEWS, async ({ request }) => {
        createBody = (await request.json()) as typeof createBody;
        return HttpResponse.json({
          id: 'view_new',
          name: createBody?.name ?? 'x',
          isSystem: false,
          filterState: createBody?.filterState,
        });
      }),
    );
    const user = userEvent.setup();
    render(<TransactionalCockpit initialViews={[]} />);
    await user.click(await screen.findByTestId('create-view-btn'));
    await user.type(screen.getByLabelText(/nom de la vue/i), 'Ma vue QA');
    await user.click(screen.getByRole('button', { name: /enregistrer/i }));
    // Oracle réseau : POST /views reçu avec le bon name + scope transactional.
    await waitFor(() => expect(createBody).not.toBeNull());
    expect(createBody!.name).toBe('Ma vue QA');
    expect(createBody!.scope).toBe('transactional');
    expect(createBody!.filterState).toBeDefined();
    // La nouvelle vue apparaît dans la sidebar.
    await waitFor(() => expect(screen.getByTestId('view-view_new')).toBeInTheDocument());
  });

  // CKP-MSW-073b : création échoue (500) → message visible, formulaire conservé.
  it('CKP-SAVEDVIEW-CREATE-ERR : POST /views 500 → erreur visible, formulaire reste ouvert', async () => {
    captureSearchBodies([]);
    server.use(
      http.post(VIEWS, () =>
        HttpResponse.json({ ok: false, error: 'boom' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    render(<TransactionalCockpit initialViews={[]} />);
    await user.click(await screen.findByTestId('create-view-btn'));
    await user.type(screen.getByLabelText(/nom de la vue/i), 'Échec attendu');
    await user.click(screen.getByRole('button', { name: /enregistrer/i }));
    // Oracle anti faux-succès : alerte visible ET le formulaire n'est pas fermé.
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByTestId('create-view-form')).toBeInTheDocument();
  });

  // CKP-MSW-076 : les vues système n'ont pas de menu rename/delete.
  it('CKP-MSW-076 : vue système non éditable (pas de menu 3-points)', async () => {
    captureSearchBodies([]);
    const viewsList: SidebarView[] = [
      { id: 'view_sys', name: 'Tous les échecs', isSystem: true, filterState: { filters: {} } },
      { id: 'view_own', name: 'Ma vue', isSystem: false, filterState: { filters: {} } },
    ];
    render(<TransactionalCockpit initialViews={viewsList} />);
    await screen.findByTestId('view-view_sys');
    // La vue système est rendue mais sans bouton « Actions » (menu ⋯).
    // La vue custom, elle, en a un → exactement 1 menu d'actions au total.
    expect(screen.getAllByRole('button', { name: /^Actions$/i })).toHaveLength(1);
  });
});
