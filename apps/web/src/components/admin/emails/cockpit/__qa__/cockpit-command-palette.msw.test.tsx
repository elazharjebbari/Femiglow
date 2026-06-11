/**
 * Module 02 — Cockpit : palette ⌘K du cockpit (CommandPalette, F-019) montée
 * DANS TransactionalCockpit + GlobalCommandPalette (navigation transverse).
 *
 * Couvre : ouverture ⌘K (090), suggestions status: (091), compteur d'erreurs de
 * parsing (093), Esc ferme (094) ; navigation clavier de GlobalCommandPalette.
 * L'application réelle des filtres (092) est couverte par
 * cockpit-search-requests.msw.test.tsx — non dupliquée ici.
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
import { makeSearchRow, makeSummary } from '@/test/msw/emails-handlers';

const push = vi.fn();
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => new URLSearchParams(''),
}));

import { TransactionalCockpit } from '@/components/admin/emails/cockpit/TransactionalCockpit';
import { GlobalCommandPalette } from '@/components/admin/emails/GlobalCommandPalette';

const SEARCH = '/api/admin/emails/transactional/search';
const SUMMARY = '/api/admin/emails/transactional/summary';

function cockpitHandlers() {
  server.use(
    http.post(SEARCH, () =>
      HttpResponse.json({ rows: [makeSearchRow({ id: 'r0' })], total: 1, window: 'matched' }),
    ),
    http.get(SUMMARY, () => HttpResponse.json(makeSummary())),
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => server.use(http.get(SUMMARY, () => HttpResponse.json(makeSummary()))));
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});
afterAll(() => server.close());

// ── CommandPalette du cockpit (cmdk) ──────────────────────────────────────────

describe('Cockpit — palette ⌘K (CommandPalette, F-019)', () => {
  // CKP-MSW-090 : ⌘K ouvre la palette (input filtre visible).
  it('CKP-MSW-090 : ⌘K ouvre la palette du cockpit', async () => {
    cockpitHandlers();
    const user = userEvent.setup();
    render(<TransactionalCockpit initialViews={[]} />);
    await screen.findByTestId('filtered-table');
    // Fermée par défaut.
    expect(screen.queryByPlaceholderText(/status:failed/i)).not.toBeInTheDocument();
    await user.keyboard('{Meta>}k{/Meta}');
    expect(await screen.findByPlaceholderText(/status:failed/i)).toBeInTheDocument();
  });

  // CKP-MSW-091 : saisir « status: » propose le groupe de statuts.
  it('CKP-MSW-091 : « status: » affiche le groupe de suggestions de statuts', async () => {
    cockpitHandlers();
    const user = userEvent.setup();
    render(<TransactionalCockpit initialViews={[]} />);
    await screen.findByTestId('filtered-table');
    await user.keyboard('{Meta>}k{/Meta}');
    const input = await screen.findByPlaceholderText(/status:failed/i);
    await user.type(input, 'status:');
    // Oracle : le heading « Statuts » apparaît + au moins une suggestion connue.
    expect(await screen.findByText(/^Statuts$/i)).toBeInTheDocument();
    expect(screen.getByText(/status:failed/)).toBeInTheDocument();
  });

  // CKP-MSW-093 : input erroné → compteur d'erreurs affiché.
  it('CKP-MSW-093 : statut inconnu → badge « N erreur(s) »', async () => {
    cockpitHandlers();
    const user = userEvent.setup();
    render(<TransactionalCockpit initialViews={[]} />);
    await screen.findByTestId('filtered-table');
    await user.keyboard('{Meta>}k{/Meta}');
    const input = await screen.findByPlaceholderText(/status:failed/i);
    await user.type(input, 'status:nope');
    // Oracle : un compteur d'erreur de parsing est affiché.
    expect(await screen.findByText(/1 erreur/i)).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  // CKP-MSW-094 : Esc ferme la palette.
  it('CKP-MSW-094 : Esc ferme la palette', async () => {
    cockpitHandlers();
    const user = userEvent.setup();
    render(<TransactionalCockpit initialViews={[]} />);
    await screen.findByTestId('filtered-table');
    await user.keyboard('{Meta>}k{/Meta}');
    const input = await screen.findByPlaceholderText(/status:failed/i);
    expect(input).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByPlaceholderText(/status:failed/i)).not.toBeInTheDocument(),
    );
  });
});

// ── GlobalCommandPalette (navigation transverse) ──────────────────────────────

describe('GlobalCommandPalette — navigation + actions', () => {
  // GCP-OPEN : ⌘K ouvre + focus l'input.
  it('GCP-01 : ⌘K ouvre la palette globale et focus l’input', async () => {
    const user = userEvent.setup();
    render(<GlobalCommandPalette />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.keyboard('{Meta>}k{/Meta}');
    const dialog = await screen.findByRole('dialog', { name: /palette de commandes/i });
    expect(dialog).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByLabelText(/recherche commandes/i)).toHaveFocus(),
    );
  });

  // GCP-FILTER : filtrer puis Enter navigue (router.push appelé avec le href).
  it('GCP-02 : filtrer « transac » + Entrée → router.push vers /admin/emails/transactional', async () => {
    const user = userEvent.setup();
    render(<GlobalCommandPalette />);
    await user.keyboard('{Meta>}k{/Meta}');
    const input = await screen.findByLabelText(/recherche commandes/i);
    await user.type(input, 'transac');
    await user.keyboard('{Enter}');
    expect(push).toHaveBeenCalledWith('/admin/emails/transactional');
  });

  // GCP-ARROW : ↓ déplace la sélection active (aria-selected suit l'index).
  it('GCP-03 : ↓ déplace la sélection active dans la liste', async () => {
    const user = userEvent.setup();
    render(<GlobalCommandPalette />);
    await user.keyboard('{Meta>}k{/Meta}');
    const input = await screen.findByLabelText(/recherche commandes/i);
    // Premier item actif au départ.
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    await user.type(input, '{ArrowDown}');
    await waitFor(() => {
      const opts = screen.getAllByRole('option');
      expect(opts[0]).toHaveAttribute('aria-selected', 'false');
      expect(opts[1]).toHaveAttribute('aria-selected', 'true');
    });
  });

  // GCP-EMPTY : requête sans résultat → message « Aucun résultat ».
  it('GCP-04 : requête sans correspondance → « Aucun résultat »', async () => {
    const user = userEvent.setup();
    render(<GlobalCommandPalette />);
    await user.keyboard('{Meta>}k{/Meta}');
    const input = await screen.findByLabelText(/recherche commandes/i);
    await user.type(input, 'zzzzznomatch');
    expect(await screen.findByText(/aucun résultat/i)).toBeInTheDocument();
  });

  // GCP-ESC : Esc ferme la palette globale.
  it('GCP-05 : Esc ferme la palette globale', async () => {
    const user = userEvent.setup();
    render(<GlobalCommandPalette />);
    await user.keyboard('{Meta>}k{/Meta}');
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  // GCP-ACTION : une action custom (sans href) est exécutée à l'activation.
  it('GCP-06 : action custom exécutée à l’activation (Entrée)', async () => {
    const onRun = vi.fn();
    const user = userEvent.setup();
    render(
      <GlobalCommandPalette
        extraCommands={[
          { id: 'do-x', label: 'Exécuter X spécial', group: 'Actions', action: onRun },
        ]}
      />,
    );
    await user.keyboard('{Meta>}k{/Meta}');
    const input = await screen.findByLabelText(/recherche commandes/i);
    await user.type(input, 'X spécial');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(onRun).toHaveBeenCalledTimes(1));
    // Pas de navigation pour une action sans href.
    expect(push).not.toHaveBeenCalled();
  });
});
