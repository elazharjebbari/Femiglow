/**
 * Module 02 — Cockpit : bulk actions, GRILLE D'ÉCHECS complète (F-013, F-014).
 *
 * Couche : composant + MSW (couche reine). Modèle canonique.
 * Déploiement : apps/web/src/components/admin/emails/cockpit/__qa__/cockpit-bulk-actions.msw.test.tsx
 *
 * Cible directe de l'audit C1 : `TransactionalCockpit.handleBulkAction`
 * appelle `await fetch(...)` SANS lire `res.ok`, puis vide la sélection et
 * re-fetch — ce qui transforme tout échec HTTP en faux succès. Ces tests
 * exigent le comportement CIBLE et échouent ROUGE tant que le bug est là.
 *
 * On rend le vrai `TransactionalCockpit` ; les sélecteurs/labels proviennent
 * de BulkActionsBar.tsx (data-testid="bulk-action-retry" / "bulk-action-suppress",
 * "bulk-actions-bar") et FilteredTable.tsx (aria-label "Sélectionner …",
 * data-testid="selection-count").
 */
import { describe, expect, it, beforeAll, afterEach, afterAll, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import { server } from '@/test/msw/server';
import { failWith } from '@/test/msw/handlers/emails';
import { makeOutboxRow } from '@/test/factories/emails';

// Mocks next/navigation (le cockpit utilise useRouter + useSearchParams).
const push = vi.fn();
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => new URLSearchParams(''),
}));

import { TransactionalCockpit } from '@/components/admin/emails/cockpit/TransactionalCockpit';

const SEARCH = '/api/admin/emails/transactional/search';
const RETRY = '/api/admin/emails/transactional/bulk-retry';
const SUPPRESS = '/api/admin/emails/transactional/bulk-suppress';
const SUMMARY = '/api/admin/emails/transactional/summary';

const FAILED_ROWS = [
  makeOutboxRow({ seq: 0, status: 'failed', toEmail: 'a@exemple.test' }),
  makeOutboxRow({ seq: 1, status: 'dlq', toEmail: 'b@exemple.test' }),
];

/** Handlers nominaux : tableau de 2 lignes failed + summary minimal. */
function baseHandlers() {
  server.use(
    http.post(SEARCH, () => HttpResponse.json({ rows: FAILED_ROWS, total: 2, window: 'matched' })),
    http.get(SUMMARY, () =>
      HttpResponse.json({ window: '1h', delivered: 0, queued: 0, failed: 2, hardBounced: 0, sparkline: [] }),
    ),
  );
}

/** Rend le cockpit et sélectionne les 2 lignes failed. */
async function renderWithSelection() {
  const user = userEvent.setup();
  render(<TransactionalCockpit initialViews={[]} />);
  // Attendre le 1er rendu des lignes (post-fetch).
  const cb1 = await screen.findByLabelText(/Sélectionner a@exemple\.test/i);
  const cb2 = await screen.findByLabelText(/Sélectionner b@exemple\.test/i);
  await user.click(cb1);
  await user.click(cb2);
  expect(screen.getByTestId('selection-count')).toHaveTextContent(/2 sélectionnés/);
  return user;
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});
afterAll(() => server.close());
beforeEach(() => baseHandlers());

// ── Bulk retry : grille d'échecs 5 points (+ nominal + partiel) ──────────

describe('Bulk retry — grille d’échecs (F-013)', () => {
  it('CKP-MSW-040 : 200 nominal → résultat partiel affiché, sélection vidée APRÈS succès', async () => {
    server.use(
      http.post(RETRY, () => HttpResponse.json({ retried: 2, skipped: 0, skippedIds: [] })),
    );
    const user = await renderWithSelection();
    await user.click(screen.getByTestId('bulk-action-retry'));
    // Oracle : feedback honnête.
    expect(await screen.findByText(/2 relancés/i)).toBeInTheDocument();
    // La sélection n'est vidée qu'après un res.ok confirmé.
    expect(screen.queryByTestId('selection-count')).not.toBeInTheDocument();
  });

  it('CKP-MSW-041 : 401 → alerte session, sélection CONSERVÉE (anti faux-succès)', async () => {
    server.use(failWith.unauthorized(RETRY));
    const user = await renderWithSelection();
    await user.click(screen.getByTestId('bulk-action-retry'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/session|autoris/i);
    // Oracle central F-013 : la sélection N'EST PAS vidée.
    expect(screen.getByTestId('selection-count')).toHaveTextContent(/2 sélectionnés/);
  });

  it('CKP-MSW-042 : 422 → message de validation, pas de faux succès', async () => {
    server.use(failWith.validation(RETRY, 'ids invalides'));
    const user = await renderWithSelection();
    await user.click(screen.getByTestId('bulk-action-retry'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/valid/i);
    expect(screen.getByTestId('selection-count')).toBeInTheDocument();
  });

  it('CKP-MSW-043 : 500 → message générique + réessayer + sélection conservée', async () => {
    server.use(failWith.serverError(RETRY));
    const user = await renderWithSelection();
    await user.click(screen.getByTestId('bulk-action-retry'));
    const alert = await screen.findByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(within(alert).getByRole('button', { name: /réessayer/i })).toBeInTheDocument();
    expect(screen.getByTestId('selection-count')).toBeInTheDocument();
  });

  it('CKP-MSW-044 : hang → état chargement, pas de double-soumission', async () => {
    let calls = 0;
    server.use(
      http.post(RETRY, async () => {
        calls += 1;
        await delay('infinite');
        return HttpResponse.json({ retried: 0, skipped: 0, skippedIds: [] });
      }),
    );
    const user = await renderWithSelection();
    const btn = screen.getByTestId('bulk-action-retry');
    await user.click(btn);
    // Oracle : bouton désactivé pendant l'envoi + double clic sans effet.
    expect(btn).toBeDisabled();
    await user.click(btn).catch(() => {});
    expect(calls).toBe(1);
  });

  it('CKP-MSW-045 : network error → alerte, sélection conservée, pas de crash', async () => {
    server.use(failWith.network(RETRY));
    const user = await renderWithSelection();
    await user.click(screen.getByTestId('bulk-action-retry'));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByTestId('selection-count')).toBeInTheDocument();
  });

  it('CKP-MSW-046 : résultat skipped → raison affichée (wrong_status)', async () => {
    server.use(
      http.post(RETRY, () =>
        HttpResponse.json({
          retried: 1,
          skipped: 1,
          skippedIds: [{ id: FAILED_ROWS[1].id, reason: 'wrong_status' }],
        }),
      ),
    );
    const user = await renderWithSelection();
    await user.click(screen.getByTestId('bulk-action-retry'));
    expect(await screen.findByText(/1 relancé/i)).toBeInTheDocument();
    expect(screen.getByText(/1 ignoré/i)).toBeInTheDocument();
    expect(screen.getByText(/wrong_status|statut/i)).toBeInTheDocument();
  });
});

// ── Bulk suppress : confirmation + grille d'échecs + propagation Listmonk ─

describe('Bulk suppress — confirmation, échecs, Listmonk (F-014)', () => {
  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('CKP-MSW-050 : 200 → confirmation honorée + comptes affichés', async () => {
    server.use(http.post(SUPPRESS, () => HttpResponse.json({ suppressed: 2, skipped: 0 })));
    const user = await renderWithSelection();
    await user.click(screen.getByTestId('bulk-action-suppress'));
    expect(window.confirm).toHaveBeenCalled();
    expect(await screen.findByText(/2 .*suppression|2 suppressed/i)).toBeInTheDocument();
  });

  it('CKP-MSW-051 : 500 → alerte, sélection conservée (anti faux-succès)', async () => {
    server.use(failWith.serverError(SUPPRESS));
    const user = await renderWithSelection();
    await user.click(screen.getByTestId('bulk-action-suppress'));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByTestId('selection-count')).toHaveTextContent(/2 sélectionnés/);
  });

  it('CKP-MSW-052 : 401 → message session, sélection conservée', async () => {
    server.use(failWith.unauthorized(SUPPRESS));
    const user = await renderWithSelection();
    await user.click(screen.getByTestId('bulk-action-suppress'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/session|autoris/i);
    expect(screen.getByTestId('selection-count')).toBeInTheDocument();
  });

  it('CKP-MSW-053 : 422 → message de validation', async () => {
    server.use(failWith.validation(SUPPRESS));
    const user = await renderWithSelection();
    await user.click(screen.getByTestId('bulk-action-suppress'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/valid/i);
  });

  it('CKP-MSW-054 : annulation de la confirmation → aucun POST', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    let calls = 0;
    server.use(http.post(SUPPRESS, () => { calls += 1; return HttpResponse.json({ suppressed: 0, skipped: 0 }); }));
    const user = await renderWithSelection();
    await user.click(screen.getByTestId('bulk-action-suppress'));
    expect(calls).toBe(0);
    // Confirmation annulée ⇒ sélection conservée.
    expect(screen.getByTestId('selection-count')).toBeInTheDocument();
  });

  it('CKP-MSW-056 : REGRESSION — succès suppress déclenche la blocklist Listmonk', async () => {
    let listmonkCalled = false;
    server.use(
      http.post(SUPPRESS, () => HttpResponse.json({ suppressed: 2, skipped: 0 })),
      // État cible : la route (ou un effet) propage vers Listmonk blocklist.
      http.post('/api/admin/emails/listmonk/blocklist', () => {
        listmonkCalled = true;
        return HttpResponse.json({ ok: true });
      }),
    );
    const user = await renderWithSelection();
    await user.click(screen.getByTestId('bulk-action-suppress'));
    await screen.findByText(/suppress|suppression/i);
    // Oracle cible F-014 : la propagation Listmonk a bien eu lieu.
    expect(listmonkCalled).toBe(true);
  });
});
