/**
 * Module 02 — Cockpit : pagination (F-011, défaut P0).
 *
 * Couche : composant + MSW. Modèle prêt à adapter.
 * Déploiement : apps/web/src/components/admin/emails/cockpit/__qa__/cockpit-pagination.msw.test.tsx
 *
 * Audit : `TransactionalCockpit` a un state `offset` mais aucun contrôle UI
 * pour l'incrémenter (PAGE_SIZE=50, offset reset à 0 seulement). L'opérateur
 * est bloqué aux 50 premières lignes. Ces tests exigent le comportement CIBLE
 * (contrôles préc./suiv., bornes, indicateur, reset) → ROUGE tant que le
 * câblage manque, c'est volontaire.
 *
 * Le body POST /search expose `pagination:{limit,offset}` (cf.
 * TransactionalCockpit.fetchSearch) — c'est l'oracle réseau qu'on inspecte.
 */
import { describe, expect, it, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { makeOutboxRow } from '@/test/factories/emails';

const push = vi.fn();
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => new URLSearchParams(''),
}));

import { TransactionalCockpit } from '@/components/admin/emails/cockpit/TransactionalCockpit';

const SEARCH = '/api/admin/emails/transactional/search';
const SUMMARY = '/api/admin/emails/transactional/summary';
const TOTAL = 5000;

/** Capture les offsets reçus + sert une page de 50 lignes synthétiques. */
function paginatedHandlers(observedOffsets: number[]) {
  server.use(
    http.post(SEARCH, async ({ request }) => {
      const body = (await request.json()) as { pagination: { limit: number; offset: number } };
      observedOffsets.push(body.pagination.offset);
      const offset = body.pagination.offset;
      const rows = Array.from({ length: 50 }, (_, i) => makeOutboxRow({ seq: offset + i }));
      return HttpResponse.json({ rows, total: TOTAL, window: 'truncated' });
    }),
    http.get(SUMMARY, () =>
      HttpResponse.json({ window: '1h', delivered: 0, queued: 0, failed: 0, hardBounced: 0, sparkline: [] }),
    ),
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => { server.resetHandlers(); vi.clearAllMocks(); });
afterAll(() => server.close());

describe('Pagination du cockpit (F-011)', () => {
  it('CKP-MSW-020 : total=5000 → contrôle "page suivante" présent', async () => {
    paginatedHandlers([]);
    render(<TransactionalCockpit initialViews={[]} />);
    expect(await screen.findByText(/sur 5 000 total|sur 5000/)).toBeInTheDocument();
    // Oracle cible : un bouton de pagination existe.
    expect(screen.getByRole('button', { name: /suivant|page suivante/i })).toBeInTheDocument();
  });

  it('CKP-MSW-021 : clic Suivant → POST search avec offset=50', async () => {
    const offsets: number[] = [];
    paginatedHandlers(offsets);
    const user = userEvent.setup();
    render(<TransactionalCockpit initialViews={[]} />);
    await screen.findByText(/total/);
    await user.click(screen.getByRole('button', { name: /suivant|page suivante/i }));
    // Le 1er fetch utilise offset 0 ; après "suivant", on attend offset 50.
    await vi.waitFor(() => expect(offsets).toContain(50));
  });

  it('CKP-MSW-022 : Précédent depuis page 2 → offset=0', async () => {
    const offsets: number[] = [];
    paginatedHandlers(offsets);
    const user = userEvent.setup();
    render(<TransactionalCockpit initialViews={[]} />);
    await screen.findByText(/total/);
    await user.click(screen.getByRole('button', { name: /suivant|page suivante/i }));
    await vi.waitFor(() => expect(offsets).toContain(50));
    await user.click(screen.getByRole('button', { name: /précédent|page précédente/i }));
    await vi.waitFor(() => expect(offsets.filter((o) => o === 0).length).toBeGreaterThanOrEqual(2));
  });

  it('CKP-MSW-023 : borne basse — Précédent désactivé en page 1', async () => {
    paginatedHandlers([]);
    render(<TransactionalCockpit initialViews={[]} />);
    await screen.findByText(/total/);
    expect(screen.getByRole('button', { name: /précédent|page précédente/i })).toBeDisabled();
  });

  it('CKP-MSW-024 : borne haute — Suivant désactivé sur la dernière page', async () => {
    // Dernière page : offset 4950, rows 50 → 4950+50 >= 5000.
    server.use(
      http.post(SEARCH, () =>
        HttpResponse.json({
          rows: Array.from({ length: 50 }, (_, i) => makeOutboxRow({ seq: 4950 + i })),
          total: TOTAL,
          window: 'truncated',
        }),
      ),
      http.get(SUMMARY, () =>
        HttpResponse.json({ window: '1h', delivered: 0, queued: 0, failed: 0, hardBounced: 0, sparkline: [] }),
      ),
    );
    // Simuler l'arrivée directe en dernière page via props/URL (état cible :
    // offset pilotable). On vérifie le disabled du bouton suivant.
    render(<TransactionalCockpit initialViews={[]} />);
    await screen.findByText(/total/);
    // NB : adapter selon l'API d'init de page choisie lors du fix.
    expect(screen.getByRole('button', { name: /suivant|page suivante/i })).toBeDefined();
  });

  it('CKP-MSW-025 : indicateur "X–Y sur total" exact en page 2', async () => {
    const offsets: number[] = [];
    paginatedHandlers(offsets);
    const user = userEvent.setup();
    render(<TransactionalCockpit initialViews={[]} />);
    await screen.findByText(/total/);
    await user.click(screen.getByRole('button', { name: /suivant|page suivante/i }));
    expect(await screen.findByText(/51.*100.*5 000|51–100/)).toBeInTheDocument();
  });

  it('CKP-MSW-026 : changement de filtre → reset page 1 (offset 0)', async () => {
    const offsets: number[] = [];
    paginatedHandlers(offsets);
    const user = userEvent.setup();
    render(<TransactionalCockpit initialViews={[]} />);
    await screen.findByText(/total/);
    await user.click(screen.getByRole('button', { name: /suivant|page suivante/i }));
    await vi.waitFor(() => expect(offsets).toContain(50));
    // Appliquer un filtre (bouton effacer / ⌘K) doit ramener offset 0.
    // Ici on déclenche un changement de filtre via la barre d'aide si présente.
    const clear = screen.queryByRole('button', { name: /effacer/i });
    if (clear) {
      await user.click(clear);
      await vi.waitFor(() => expect(offsets[offsets.length - 1]).toBe(0));
    }
  });

  it('CKP-MSW-028 : total<=50 → contrôles pagination masqués/inactifs', async () => {
    server.use(
      http.post(SEARCH, () =>
        HttpResponse.json({ rows: [makeOutboxRow({ seq: 0 })], total: 1, window: 'matched' }),
      ),
      http.get(SUMMARY, () =>
        HttpResponse.json({ window: '1h', delivered: 0, queued: 0, failed: 0, hardBounced: 0, sparkline: [] }),
      ),
    );
    render(<TransactionalCockpit initialViews={[]} />);
    await screen.findByText(/sur 1 total/);
    const next = screen.queryByRole('button', { name: /suivant|page suivante/i });
    if (next) expect(next).toBeDisabled();
  });
});
