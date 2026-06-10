/**
 * Module 02 — Cockpit : grille d'échecs des actions réseau (P0 UX opérateur).
 *
 * Cible directe de l'audit C1 : `TransactionalCockpit.handleBulkAction` (et la
 * recherche) appelait `await fetch(...)` SANS lire `res.ok`, puis vidait la
 * sélection et re-fetch — transformant tout échec HTTP en FAUX SUCCÈS.
 *
 * Grille 5 points par action réseau : 200 nominal, 401, 422, 500, hang.
 * Network error en bonus. Oracle central : zéro faux succès — un échec produit
 * un message visible (role=alert) ET conserve la sélection ; le toast de succès
 * n'apparaît QUE sur res.ok.
 *
 * Harnais RÉEL du repo : serveur MSW partagé `@/test/msw/server`, handlers
 * `@/test/msw/emails-handlers` (emailsHandlers baseline + emailsFailWith), env
 * jsdom (défaut), lifecycle PAR FICHIER. Sélecteurs : BulkActionsBar
 * (data-testid bulk-action-retry / bulk-action-suppress), FilteredTable
 * (aria-label "Sélectionner <email>", data-testid selection-count).
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
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server, http, HttpResponse } from '@/test/msw/server';
import { emailsHandlers, emailsFailWith, makeSearchRow } from '@/test/msw/emails-handlers';

// next/navigation : le cockpit utilise useRouter + useSearchParams.
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
const SUPPRESS = '/api/admin/emails/transactional/bulk-suppress';

const ROW_A = makeSearchRow({ id: 'out_a', status: 'failed', toEmail: 'a@exemple.test' });
const ROW_B = makeSearchRow({ id: 'out_b', status: 'dlq', toEmail: 'b@exemple.test' });

/** Baseline : 2 lignes failed/dlq + summary nominal. */
function baseHandlers() {
  server.use(...emailsHandlers);
  server.use(
    http.post(SEARCH, () =>
      HttpResponse.json({ rows: [ROW_A, ROW_B], total: 2, window: 'matched' }),
    ),
  );
}

/** Rend le cockpit et sélectionne les 2 lignes. Retourne `user`. */
async function renderWithSelection() {
  const user = userEvent.setup();
  render(<TransactionalCockpit initialViews={[]} />);
  const cbA = await screen.findByLabelText(/Sélectionner a@exemple\.test/i);
  const cbB = await screen.findByLabelText(/Sélectionner b@exemple\.test/i);
  await user.click(cbA);
  await user.click(cbB);
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

// ── Bulk retry : grille d'échecs (F-013) ────────────────────────────────────

describe('Bulk retry — grille d’échecs (F-013)', () => {
  // CKP-MSW-040 : 200 nominal → résultat honnête affiché, sélection vidée APRÈS succès
  it('F04-C-072 (ex CKP-MSW-040) : retry 200 → feedback succès, sélection vidée seulement après res.ok', async () => {
    server.use(
      http.post(RETRY, () => HttpResponse.json({ retried: 2, skipped: 0, skippedIds: [] })),
    );
    const user = await renderWithSelection();
    await user.click(screen.getByTestId('bulk-action-retry'));
    expect(await screen.findByTestId('bulk-action-feedback')).toHaveTextContent(/2 relancés/i);
    // La sélection n'est vidée qu'après un res.ok confirmé.
    expect(screen.queryByTestId('selection-count')).not.toBeInTheDocument();
  });

  // CKP-MSW-041 : 401 → alerte session, sélection CONSERVÉE (anti faux-succès)
  it('CKP-MSW-041 : 401 → alerte session visible, sélection conservée', async () => {
    server.use(emailsFailWith.unauthorized(RETRY, 'post'));
    const user = await renderWithSelection();
    await user.click(screen.getByTestId('bulk-action-retry'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/session|autoris/i);
    // Oracle central F-013 : la sélection N'EST PAS vidée.
    expect(screen.getByTestId('selection-count')).toHaveTextContent(/2 sélectionnés/);
  });

  // CKP-MSW-042 : 422 → détail de validation affiché, pas de faux succès
  it('CKP-MSW-042 : 422 → message de validation, sélection conservée', async () => {
    server.use(emailsFailWith.validation(RETRY, 'post', 'ids invalides'));
    const user = await renderWithSelection();
    await user.click(screen.getByTestId('bulk-action-retry'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/valid/i);
    expect(screen.getByTestId('selection-count')).toBeInTheDocument();
  });

  // CKP-MSW-043 : 500 → erreur générique + bouton réessayer + sélection conservée
  it('CKP-MSW-043 : 500 → erreur visible + réessayer, sélection conservée', async () => {
    server.use(emailsFailWith.serverError(RETRY, 'post'));
    const user = await renderWithSelection();
    await user.click(screen.getByTestId('bulk-action-retry'));
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByRole('button', { name: /réessayer/i })).toBeInTheDocument();
    expect(screen.getByTestId('selection-count')).toBeInTheDocument();
  });

  // CKP-MSW-044 : hang → bouton désactivé (loading) + anti double-soumission
  it('CKP-MSW-044 : hang → bouton désactivé, pas de double-soumission', async () => {
    let calls = 0;
    server.use(
      http.post(RETRY, async () => {
        calls += 1;
        await new Promise(() => {}); // hang infini
        return HttpResponse.json({ retried: 0, skipped: 0, skippedIds: [] });
      }),
    );
    const user = await renderWithSelection();
    const btn = screen.getByTestId('bulk-action-retry');
    await user.click(btn);
    // Oracle : bouton désactivé pendant l'envoi (état loading visible).
    expect(await screen.findByTestId('bulk-action-retry')).toBeDisabled();
    // Double clic sans effet : un seul POST atteint le serveur.
    await user.click(btn).catch(() => {});
    expect(calls).toBe(1);
  });

  // CKP-MSW-045 : network error → alerte, sélection conservée, pas de crash
  it('CKP-MSW-045 : network error → alerte visible, sélection conservée', async () => {
    server.use(emailsFailWith.network(RETRY, 'post'));
    const user = await renderWithSelection();
    await user.click(screen.getByTestId('bulk-action-retry'));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByTestId('selection-count')).toHaveTextContent(/2 sélectionnés/);
  });

  // CKP-MSW-046 : résultat partiel → raison skipped affichée (wrong_status)
  it('CKP-MSW-046 : skipped → relancés + ignorés + raison affichés', async () => {
    server.use(
      http.post(RETRY, () =>
        HttpResponse.json({
          retried: 1,
          skipped: 1,
          skippedIds: [{ id: 'out_b', reason: 'wrong_status' }],
        }),
      ),
    );
    const user = await renderWithSelection();
    await user.click(screen.getByTestId('bulk-action-retry'));
    const feedback = await screen.findByTestId('bulk-action-feedback');
    expect(feedback).toHaveTextContent(/1 relancé/i);
    expect(feedback).toHaveTextContent(/1 ignoré/i);
    expect(feedback).toHaveTextContent(/wrong_status|statut/i);
  });
});

// ── Bulk suppress : confirmation + grille d'échecs (F-014) ───────────────────

describe('Bulk suppress — confirmation + grille d’échecs (F-014)', () => {
  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  // CKP-MSW-050 : 200 → confirmation honorée + comptes affichés, sélection vidée
  it('F04-C-071 (ex CKP-MSW-050) : suppress 200 → confirmation + comptes, sélection vidée après succès', async () => {
    server.use(http.post(SUPPRESS, () => HttpResponse.json({ suppressed: 2, skipped: 0 })));
    const user = await renderWithSelection();
    await user.click(screen.getByTestId('bulk-action-suppress'));
    expect(window.confirm).toHaveBeenCalled();
    expect(await screen.findByTestId('bulk-action-feedback')).toHaveTextContent(
      /2 .*suppr/i,
    );
    expect(screen.queryByTestId('selection-count')).not.toBeInTheDocument();
  });

  // CKP-MSW-051 : 500 → alerte, sélection conservée (anti faux-succès)
  it('CKP-MSW-051 : 500 → alerte visible, sélection conservée', async () => {
    server.use(emailsFailWith.serverError(SUPPRESS, 'post'));
    const user = await renderWithSelection();
    await user.click(screen.getByTestId('bulk-action-suppress'));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByTestId('selection-count')).toHaveTextContent(/2 sélectionnés/);
  });

  // CKP-MSW-052 : 401 → message session, sélection conservée
  it('CKP-MSW-052 : 401 → message session, sélection conservée', async () => {
    server.use(emailsFailWith.unauthorized(SUPPRESS, 'post'));
    const user = await renderWithSelection();
    await user.click(screen.getByTestId('bulk-action-suppress'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/session|autoris/i);
    expect(screen.getByTestId('selection-count')).toBeInTheDocument();
  });

  // CKP-MSW-053 : 422 → message de validation
  it('CKP-MSW-053 : 422 → message de validation', async () => {
    server.use(emailsFailWith.validation(SUPPRESS, 'post', 'cibles invalides'));
    const user = await renderWithSelection();
    await user.click(screen.getByTestId('bulk-action-suppress'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/valid/i);
    expect(screen.getByTestId('selection-count')).toBeInTheDocument();
  });

  // CKP-MSW-054 : annulation de la confirmation → aucun POST, sélection conservée
  it('CKP-MSW-054 : confirmation annulée → aucun POST, sélection conservée', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    let calls = 0;
    server.use(
      http.post(SUPPRESS, () => {
        calls += 1;
        return HttpResponse.json({ suppressed: 0, skipped: 0 });
      }),
    );
    const user = await renderWithSelection();
    await user.click(screen.getByTestId('bulk-action-suppress'));
    expect(calls).toBe(0);
    expect(screen.getByTestId('selection-count')).toBeInTheDocument();
  });

  // CKP-MSW-055 : hang → bouton désactivé + anti double-soumission
  it('CKP-MSW-055 : hang → bouton désactivé, pas de double-soumission', async () => {
    let calls = 0;
    server.use(
      http.post(SUPPRESS, async () => {
        calls += 1;
        await new Promise(() => {});
        return HttpResponse.json({ suppressed: 0, skipped: 0 });
      }),
    );
    const user = await renderWithSelection();
    const btn = screen.getByTestId('bulk-action-suppress');
    await user.click(btn);
    expect(await screen.findByTestId('bulk-action-suppress')).toBeDisabled();
    await user.click(btn).catch(() => {});
    expect(calls).toBe(1);
  });
});

// ── Recherche : pas de faux succès silencieux (F-010) ────────────────────────

describe('Recherche cockpit — grille d’échecs (F-010)', () => {
  // CKP-MSW-060 : search 500 au chargement → erreur visible
  it('CKP-MSW-060 : search 500 → erreur visible, pas de tableau silencieux', async () => {
    server.use(emailsFailWith.serverError(SEARCH, 'post'));
    render(<TransactionalCockpit initialViews={[]} />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  // CKP-MSW-061 : search 401 → erreur visible (session)
  it('CKP-MSW-061 : search 401 → erreur visible', async () => {
    server.use(emailsFailWith.unauthorized(SEARCH, 'post'));
    render(<TransactionalCockpit initialViews={[]} />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  // CKP-MSW-062 : search network error → erreur visible, pas de crash
  it('CKP-MSW-062 : search network error → erreur visible', async () => {
    server.use(emailsFailWith.network(SEARCH, 'post'));
    render(<TransactionalCockpit initialViews={[]} />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});

// ── Saved views CRUD : grille d'échecs (F-016) ───────────────────────────────

describe('Saved views — feedback d’échec rename/delete (F-016)', () => {
  const VIEWS = [{ id: 'view_1', name: 'Échecs récents', isSystem: false }];

  // CKP-MSW-070 : rename 500 → erreur visible, vue NON renommée en optimiste
  it('F04-C-065 (ex CKP-MSW-070) : rename 500 → erreur visible, pas de faux succès', async () => {
    server.use(emailsFailWith.serverError('/api/admin/emails/views/view_1', 'patch'));
    const user = userEvent.setup();
    render(<TransactionalCockpit initialViews={VIEWS} />);
    await screen.findByLabelText(/Sélectionner a@exemple\.test/i);
    // Ouvre le menu ⋯ de la vue puis "Renommer".
    await user.click(screen.getByRole('button', { name: /Actions/i }));
    await user.click(screen.getByRole('menuitem', { name: /renommer/i }));
    const input = screen.getByLabelText(/Renommer la vue/i);
    await user.clear(input);
    await user.type(input, 'Nouveau nom{Enter}');
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    // Le nom optimiste ne doit PAS persister sur échec.
    expect(screen.queryByText('Nouveau nom')).not.toBeInTheDocument();
  });

  // CKP-MSW-071 : delete 500 → erreur visible, vue NON retirée en optimiste
  it('F04-C-066 (ex CKP-MSW-071) : delete 500 → erreur visible, vue conservée', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    server.use(emailsFailWith.serverError('/api/admin/emails/views/view_1', 'delete'));
    const user = userEvent.setup();
    render(<TransactionalCockpit initialViews={VIEWS} />);
    await screen.findByLabelText(/Sélectionner a@exemple\.test/i);
    await user.click(screen.getByRole('button', { name: /Actions/i }));
    await user.click(screen.getByRole('menuitem', { name: /supprimer/i }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Échecs récents')).toBeInTheDocument();
  });
});
