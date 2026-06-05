/**
 * Module 02 — Cockpit : états du tableau (vide / chargement / erreur fetch
 * INITIAL / gros volume) + sélection multiple (F-012).
 *
 * Complète la grille d'échecs des actions BULK (déjà couverte par
 * cockpit-bulk-actions.msw.test.tsx) en visant le fetch search INITIAL et le
 * comportement du tableau aux limites.
 *
 * Harnais RÉEL : serveur MSW partagé, override local search/summary.
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
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server, http, HttpResponse } from '@/test/msw/server';
import { makeSearchRow, makeSummary, emailsFailWith } from '@/test/msw/emails-handlers';

const push = vi.fn();
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => new URLSearchParams(''),
}));

import { TransactionalCockpit } from '@/components/admin/emails/cockpit/TransactionalCockpit';

const SEARCH = '/api/admin/emails/transactional/search';
const SUMMARY = '/api/admin/emails/transactional/summary';

/** Summary neutre pour toutes les suites (évite tout 'unhandled'). */
function summaryHandler() {
  server.use(http.get(SUMMARY, () => HttpResponse.json(makeSummary())));
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => summaryHandler());
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});
afterAll(() => server.close());

// ── États du tableau ────────────────────────────────────────────────────────

describe('Cockpit — états du tableau (vide / chargement / erreur / volume)', () => {
  // CKP-STATE-01 : 0 résultat → message utile (pas un tableau vide muet).
  it('CKP-STATE-01 : 0 résultat → état vide avec message d’aide', async () => {
    server.use(
      http.post(SEARCH, () =>
        HttpResponse.json({ rows: [], total: 0, window: 'matched' }),
      ),
    );
    render(<TransactionalCockpit initialViews={[]} />);
    const empty = await screen.findByTestId('filtered-table-empty');
    // Oracle : message actionnable, pas juste une zone blanche.
    expect(empty).toHaveTextContent(/aucun email/i);
    expect(empty).toHaveTextContent(/relâch|efface/i);
    // Pas de nav de pagination sur 0 résultat.
    expect(screen.queryByTestId('cockpit-pagination')).not.toBeInTheDocument();
  });

  // CKP-STATE-02 : pendant le fetch initial → skeleton/chargement visible.
  it('CKP-STATE-02 : fetch initial en vol → skeleton de chargement', async () => {
    // Search qui ne répond jamais → l'état isSearching reste true.
    server.use(emailsFailWith.hang(SEARCH, 'post'));
    render(<TransactionalCockpit initialViews={[]} />);
    // Oracle : skeleton présent tant que les données ne sont pas là.
    expect(await screen.findByTestId('filtered-table-skeleton')).toBeInTheDocument();
    // Le vrai tableau n'est pas (encore) monté.
    expect(screen.queryByTestId('filtered-table')).not.toBeInTheDocument();
  });

  // CKP-STATE-03 : erreur réseau sur le fetch INITIAL → bannière d'erreur.
  it('CKP-STATE-03 : network error au chargement → erreur visible, pas de tableau muet', async () => {
    server.use(emailsFailWith.network(SEARCH, 'post'));
    render(<TransactionalCockpit initialViews={[]} />);
    // Oracle : un role=alert apparaît (searchError), pas un état vide trompeur.
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/erreur/i);
  });

  // CKP-STATE-04 : 500 sur le fetch INITIAL → bannière d'erreur.
  it('CKP-STATE-04 : 500 au chargement → erreur visible', async () => {
    server.use(emailsFailWith.serverError(SEARCH, 'post'));
    render(<TransactionalCockpit initialViews={[]} />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  // CKP-STATE-05 : gros volume (5000) → rendu borné à PAGE_SIZE, pas de freeze.
  it('CKP-STATE-05 : 5000 résultats → seule la page courante est rendue (50 lignes)', async () => {
    server.use(
      http.post(SEARCH, () =>
        HttpResponse.json({
          rows: Array.from({ length: 50 }, (_, i) => makeSearchRow({ id: `out_${i}` })),
          total: 5000,
          window: 'truncated',
        }),
      ),
    );
    render(<TransactionalCockpit initialViews={[]} />);
    const table = await screen.findByTestId('filtered-table');
    // Oracle anti-freeze : le DOM ne contient QUE 50 lignes de DONNÉES (chacune
    // porte data-testid="row-<id>"), pas 5000 — la ligne d'en-tête est exclue.
    const dataRows = within(table)
      .getAllByRole('row')
      .filter((r) => r.getAttribute('data-testid')?.startsWith('row-'));
    expect(dataRows).toHaveLength(50);
    // La pagination signale qu'il y a plus de lignes ailleurs.
    expect(screen.getByTestId('cockpit-pagination')).toBeInTheDocument();
  });
});

// ── Sélection multiple (F-012) ────────────────────────────────────────────────

describe('Cockpit — sélection multiple (F-012)', () => {
  const ROWS = [
    makeSearchRow({ id: 'out_0', toEmail: 'a@exemple.test', status: 'failed' }),
    makeSearchRow({ id: 'out_1', toEmail: 'b@exemple.test', status: 'failed' }),
    makeSearchRow({ id: 'out_2', toEmail: 'c@exemple.test', status: 'failed' }),
  ];

  function rowsHandler(total = ROWS.length) {
    server.use(
      http.post(SEARCH, () => HttpResponse.json({ rows: ROWS, total, window: 'matched' })),
    );
  }

  // CKP-MSW-030 : cocher une ligne → compteur « N sélectionnés » + barre bulk.
  it('CKP-MSW-030 : cocher une ligne → compteur 1 + barre d’actions montée', async () => {
    rowsHandler();
    const user = userEvent.setup();
    render(<TransactionalCockpit initialViews={[]} />);
    await user.click(await screen.findByLabelText(/Sélectionner a@exemple\.test/i));
    expect(screen.getByTestId('selection-count')).toHaveTextContent(/1 sélectionné/);
    expect(screen.getByTestId('bulk-actions-bar')).toBeInTheDocument();
  });

  // CKP-MSW-031 : shift+click → sélection de la plage entière.
  it('CKP-MSW-031 : shift+click sélectionne toute la plage intermédiaire', async () => {
    rowsHandler();
    const user = userEvent.setup();
    render(<TransactionalCockpit initialViews={[]} />);
    const first = await screen.findByLabelText(/Sélectionner a@exemple\.test/i);
    await user.click(first); // ancre idx 0
    const third = screen.getByLabelText(/Sélectionner c@exemple\.test/i);
    await user.keyboard('{Shift>}');
    await user.click(third);
    await user.keyboard('{/Shift}');
    // Oracle : les 3 lignes (0..2) sont sélectionnées.
    expect(screen.getByTestId('selection-count')).toHaveTextContent(/3 sélectionnés/);
  });

  // CKP-MSW-032 : select-all coche les lignes visibles ; indeterminate si partiel.
  it('CKP-MSW-032 : select-all coche les visibles ; indeterminate quand partiel', async () => {
    rowsHandler();
    const user = userEvent.setup();
    render(<TransactionalCockpit initialViews={[]} />);
    const selectAll = (await screen.findByTestId('select-all')) as HTMLInputElement;
    // Partiel : une seule ligne → header indeterminate.
    await user.click(screen.getByLabelText(/Sélectionner a@exemple\.test/i));
    expect(selectAll.indeterminate).toBe(true);
    expect(selectAll.checked).toBe(false);
    // Tout cocher via le header.
    await user.click(selectAll);
    expect(screen.getByTestId('selection-count')).toHaveTextContent(/3 sélectionnés/);
    expect((screen.getByTestId('select-all') as HTMLInputElement).checked).toBe(true);
  });

  // CKP-MSW-035 : re-décocher le select-all vide la sélection.
  it('CKP-MSW-035 : re-cliquer le select-all coché → sélection vidée', async () => {
    rowsHandler();
    const user = userEvent.setup();
    render(<TransactionalCockpit initialViews={[]} />);
    const selectAll = await screen.findByTestId('select-all');
    await user.click(selectAll); // tout cocher
    expect(screen.getByTestId('selection-count')).toHaveTextContent(/3 sélectionnés/);
    await user.click(screen.getByTestId('select-all')); // re-décocher
    // Oracle : plus aucune ligne sélectionnée → la barre bulk disparaît.
    await waitFor(() =>
      expect(screen.queryByTestId('selection-count')).not.toBeInTheDocument(),
    );
    expect(screen.queryByTestId('bulk-actions-bar')).not.toBeInTheDocument();
  });
});
