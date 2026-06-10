/**
 * Module 02 — Cockpit : accessibilité de base + i18n (CKP-A11Y-120..123).
 *
 * Oracles a11y : rôles/labels accessibles présents et corrects sur les éléments
 * interactifs du cockpit (tableau triable, select-all, barre bulk, pagination),
 * et libellés français des colonnes/actions.
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

const SEARCH = '/api/admin/emails/transactional/search';
const SUMMARY = '/api/admin/emails/transactional/summary';

const ROWS = [
  makeSearchRow({ id: 'out_0', toEmail: 'a@exemple.test', status: 'failed' }),
  makeSearchRow({ id: 'out_1', toEmail: 'b@exemple.test', status: 'failed' }),
];

function handlers(total = ROWS.length) {
  server.use(
    http.post(SEARCH, () => HttpResponse.json({ rows: ROWS, total, window: 'matched' })),
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

describe('Cockpit — accessibilité de base (a11y)', () => {
  // CKP-A11Y-120 : colonnes triables exposent aria-sort.
  it('F04-C-078 (ex CKP-A11Y-120) : axe/aria — colonne triée expose aria-sort="descending"', async () => {
    handlers();
    const user = userEvent.setup();
    render(<TransactionalCockpit initialViews={[]} />);
    await screen.findByTestId('filtered-table');
    // Au tri par défaut (date_desc), l'en-tête Date est actif.
    const dateHeader = screen.getByRole('columnheader', { name: /date/i });
    expect(dateHeader).toHaveAttribute('aria-sort', 'descending');
    // Une colonne non active est 'none'.
    const statusHeader = screen.getByRole('columnheader', { name: /statut/i });
    expect(statusHeader).toHaveAttribute('aria-sort', 'none');
    // Trier par Statut → Statut devient 'descending', Date repasse 'none'.
    await user.click(within(statusHeader).getByRole('button'));
    await waitFor(() =>
      expect(screen.getByRole('columnheader', { name: /statut/i })).toHaveAttribute(
        'aria-sort',
        'descending',
      ),
    );
  });

  // CKP-A11Y-121 : la checkbox de sélection globale est labellisée.
  it('CKP-A11Y-121 : checkbox « Sélectionner tout » a un label accessible', async () => {
    handlers();
    render(<TransactionalCockpit initialViews={[]} />);
    await screen.findByTestId('filtered-table');
    const selectAll = screen.getByRole('checkbox', { name: /sélectionner tout/i });
    expect(selectAll).toBeInTheDocument();
    // Chaque ligne a aussi une checkbox labellisée par son destinataire.
    expect(screen.getByRole('checkbox', { name: /sélectionner a@exemple\.test/i })).toBeInTheDocument();
  });

  // CKP-A11Y-122 : la barre d'actions bulk est un toolbar labellisé.
  it('F04-C-079 (ex CKP-A11Y-122) : barre bulk = role="toolbar" avec aria-label', async () => {
    handlers();
    const user = userEvent.setup();
    render(<TransactionalCockpit initialViews={[]} />);
    await screen.findByTestId('filtered-table');
    await user.click(screen.getByRole('checkbox', { name: /sélectionner a@exemple\.test/i }));
    const toolbar = await screen.findByRole('toolbar', { name: /actions sur la sélection/i });
    expect(toolbar).toBeInTheDocument();
  });

  // CKP-A11Y-PAGINATION : la pagination est une nav labellisée + boutons nommés.
  it('CKP-A11Y-PAG : la pagination est une nav labellisée avec boutons nommés', async () => {
    handlers(5000);
    render(<TransactionalCockpit initialViews={[]} />);
    await screen.findByTestId('filtered-table');
    const nav = await screen.findByRole('navigation', { name: /pagination/i });
    expect(within(nav).getByRole('button', { name: /précédent/i })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: /suivant/i })).toBeInTheDocument();
  });
});

describe('Cockpit — libellés français (i18n)', () => {
  // CKP-I18N-123 : en-têtes de colonnes et actions bulk en français.
  it('CKP-I18N-123 : colonnes et actions affichées en français', async () => {
    handlers();
    const user = userEvent.setup();
    render(<TransactionalCockpit initialViews={[]} />);
    await screen.findByTestId('filtered-table');
    // En-têtes français.
    for (const label of ['Date', 'Destinataire', 'Template', 'Sujet', 'Statut', 'Source']) {
      expect(screen.getByRole('columnheader', { name: new RegExp(label, 'i') })).toBeInTheDocument();
    }
    // Actions bulk en français après sélection.
    await user.click(screen.getByRole('checkbox', { name: /sélectionner a@exemple\.test/i }));
    const toolbar = await screen.findByRole('toolbar');
    expect(within(toolbar).getByTestId('bulk-action-retry')).toHaveTextContent(/retry/i);
    expect(within(toolbar).getByTestId('bulk-action-suppress')).toHaveTextContent(/suppression/i);
    expect(within(toolbar).getByTestId('bulk-action-export')).toHaveTextContent(/csv/i);
  });
});
