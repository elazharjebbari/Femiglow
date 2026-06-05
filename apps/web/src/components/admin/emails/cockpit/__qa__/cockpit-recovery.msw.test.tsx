/**
 * Module 02 — Cockpit : récupération après échec (grille 5 points, volet
 * « retry/cancel ») + annulation du formulaire de création de vue.
 *
 * Complète cockpit-bulk-actions.msw.test.tsx (qui couvre 401/422/500/hang/
 * network) par le chemin de RÉCUPÉRATION : après un échec bulk, cliquer
 * « Réessayer » rejoue la MÊME action, et un 2e essai réussi vide la sélection
 * et affiche le feedback honnête. Plus l'annulation du formulaire create-view.
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
const RETRY = '/api/admin/emails/transactional/bulk-retry';

const ROW_A = makeSearchRow({ id: 'out_a', status: 'failed', toEmail: 'a@exemple.test' });
const ROW_B = makeSearchRow({ id: 'out_b', status: 'dlq', toEmail: 'b@exemple.test' });

function baseHandlers() {
  server.use(
    http.post(SEARCH, () => HttpResponse.json({ rows: [ROW_A, ROW_B], total: 2, window: 'matched' })),
    http.get(SUMMARY, () => HttpResponse.json(makeSummary())),
  );
}

async function renderWithSelection() {
  const user = userEvent.setup();
  render(<TransactionalCockpit initialViews={[]} />);
  await user.click(await screen.findByLabelText(/Sélectionner a@exemple\.test/i));
  await user.click(screen.getByLabelText(/Sélectionner b@exemple\.test/i));
  expect(screen.getByTestId('selection-count')).toHaveTextContent(/2 sélectionnés/);
  return user;
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => baseHandlers());
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

describe('Cockpit — récupération après échec bulk (grille 5 pts : retry)', () => {
  // CKP-RETRY-RECOVER : 500 puis « Réessayer » réussi → feedback + sélection vidée.
  it('CKP-RETRY-RECOVER : 500 → Réessayer (2e essai 200) → succès honnête, sélection vidée', async () => {
    // 1er POST → 500, 2e POST → 200. On bascule le handler après le 1er appel.
    let calls = 0;
    server.use(
      http.post(RETRY, () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json({ ok: false, error: 'boom' }, { status: 500 });
        }
        return HttpResponse.json({ retried: 2, skipped: 0, skippedIds: [] });
      }),
    );
    const user = await renderWithSelection();
    await user.click(screen.getByTestId('bulk-action-retry'));
    // 1er essai : alerte + sélection conservée.
    const alert = await screen.findByRole('alert');
    expect(screen.getByTestId('selection-count')).toHaveTextContent(/2 sélectionnés/);
    // Réessayer (rejoue la MÊME action retry).
    await user.click(within(alert).getByRole('button', { name: /réessayer/i }));
    // 2e essai réussi : feedback honnête + sélection vidée.
    expect(await screen.findByTestId('bulk-action-feedback')).toHaveTextContent(/2 relancés/i);
    expect(screen.queryByTestId('selection-count')).not.toBeInTheDocument();
    expect(calls).toBe(2);
  });

  // CKP-RETRY-RECOVER-NET : network error puis Réessayer réussi.
  it('CKP-RETRY-RECOVER-NET : network error → Réessayer (200) → succès', async () => {
    let calls = 0;
    server.use(
      http.post(RETRY, () => {
        calls += 1;
        if (calls === 1) return HttpResponse.error();
        return HttpResponse.json({ retried: 2, skipped: 0, skippedIds: [] });
      }),
    );
    const user = await renderWithSelection();
    await user.click(screen.getByTestId('bulk-action-retry'));
    const alert = await screen.findByRole('alert');
    expect(screen.getByTestId('selection-count')).toBeInTheDocument();
    await user.click(within(alert).getByRole('button', { name: /réessayer/i }));
    expect(await screen.findByTestId('bulk-action-feedback')).toHaveTextContent(/2 relancés/i);
    expect(calls).toBe(2);
  });
});

describe('Cockpit — annulation du formulaire create-view', () => {
  // CKP-CREATEVIEW-CANCEL : Annuler ferme le formulaire sans POST /views.
  it('CKP-CREATEVIEW-CANCEL : « Annuler » ferme le formulaire, aucun POST /views', async () => {
    let viewsCalls = 0;
    server.use(
      http.post('/api/admin/emails/views', () => {
        viewsCalls += 1;
        return HttpResponse.json({ id: 'view_x', name: 'x', isSystem: false });
      }),
    );
    const user = userEvent.setup();
    render(<TransactionalCockpit initialViews={[]} />);
    await user.click(await screen.findByTestId('create-view-btn'));
    expect(screen.getByTestId('create-view-form')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/nom de la vue/i), 'abandonnée');
    await user.click(screen.getByRole('button', { name: /annuler/i }));
    // Oracle : formulaire fermé, aucun appel réseau de création.
    await waitFor(() => expect(screen.queryByTestId('create-view-form')).not.toBeInTheDocument());
    expect(viewsCalls).toBe(0);
  });

  // CKP-CREATEVIEW-EMPTY : bouton Enregistrer désactivé tant que le nom est vide.
  it('CKP-CREATEVIEW-EMPTY : « Enregistrer » désactivé si le nom est vide', async () => {
    const user = userEvent.setup();
    render(<TransactionalCockpit initialViews={[]} />);
    await user.click(await screen.findByTestId('create-view-btn'));
    expect(screen.getByRole('button', { name: /enregistrer/i })).toBeDisabled();
    await user.type(screen.getByLabelText(/nom de la vue/i), 'Nom valide');
    expect(screen.getByRole('button', { name: /enregistrer/i })).toBeEnabled();
  });
});
