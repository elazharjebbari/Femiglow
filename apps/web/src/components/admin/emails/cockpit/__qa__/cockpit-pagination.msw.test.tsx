/**
 * Module 02 — Cockpit : pagination (F-011, défaut P0 / R-015).
 *
 * Couche : composant + MSW (harnais RÉEL du repo : serveur MSW partagé
 * `@/test/msw/server`, override local des handlers search/summary).
 *
 * Audit : `TransactionalCockpit` avait un state `offset` mais AUCUN contrôle UI
 * pour l'incrémenter (PAGE_SIZE=50). L'opérateur était bloqué aux 50 premières
 * lignes quel que soit `total` (qui peut valoir 5 000) → aveugle au-delà.
 *
 * Fix livré (cf. TransactionalCockpit.tsx) : nav de pagination (préc./suiv.),
 * indicateur « X–Y sur total », bornes (préc. disabled à offset 0, suiv. disabled
 * en dernière page), reset à la page 1 sur changement de filtre/tri.
 *
 * Oracle réseau : le body POST /search expose `pagination:{limit,offset}` — on
 * inspecte l'offset EXACT reçu par le serveur (pas seulement le rendu).
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
const TOTAL = 5000;

/**
 * Installe des handlers paginés : capture chaque offset reçu et sert 50 lignes
 * synthétiques dont les ids encodent l'offset (pour vérifier le contenu de page).
 * Le total et la `window` sont paramétrables (borne haute, petit total).
 */
function paginatedHandlers(
  observedOffsets: number[],
  opts: { total?: number; window?: 'matched' | 'truncated'; pageSize?: number } = {},
) {
  const total = opts.total ?? TOTAL;
  const win = opts.window ?? 'truncated';
  server.use(
    http.post(SEARCH, async ({ request }) => {
      const body = (await request.json()) as {
        pagination: { limit: number; offset: number };
      };
      const offset = body.pagination.offset;
      observedOffsets.push(offset);
      const remaining = Math.max(0, total - offset);
      const count = Math.min(opts.pageSize ?? 50, remaining);
      const rows = Array.from({ length: count }, (_, i) =>
        makeSearchRow({ id: `out_${offset + i}`, toEmail: `client${offset + i}@exemple.test` }),
      );
      return HttpResponse.json({ rows, total, window: win });
    }),
    http.get(SUMMARY, () => HttpResponse.json(makeSummary())),
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  // Baseline neutre : empêche tout 'unhandled' avant override paginé.
  server.use(http.get(SUMMARY, () => HttpResponse.json(makeSummary())));
});
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});
afterAll(() => server.close());

describe('Pagination du cockpit (F-011 / R-015)', () => {
  // CKP-MSW-020 : total>PAGE_SIZE → le contrôle « Suivant » EXISTE (régression P0).
  it('CKP-MSW-020 : total=5000 → contrôle « Suivant » rendu (pagination existe)', async () => {
    paginatedHandlers([]);
    render(<TransactionalCockpit initialViews={[]} />);
    // La nav de pagination est montée et nommée.
    expect(await screen.findByTestId('cockpit-pagination')).toBeInTheDocument();
    const next = screen.getByRole('button', { name: /suivant/i });
    expect(next).toBeInTheDocument();
    expect(next).toBeEnabled();
  });

  // CKP-MSW-021 : clic Suivant → POST search avec offset=50 (oracle réseau exact).
  it('CKP-MSW-021 : clic « Suivant » → POST search avec offset=50', async () => {
    const offsets: number[] = [];
    paginatedHandlers(offsets);
    const user = userEvent.setup();
    render(<TransactionalCockpit initialViews={[]} />);
    await screen.findByTestId('cockpit-pagination');
    // Premier fetch : offset 0.
    await waitFor(() => expect(offsets).toContain(0));
    await user.click(screen.getByRole('button', { name: /suivant/i }));
    // Après « Suivant », le serveur reçoit exactement offset=50.
    await waitFor(() => expect(offsets).toContain(50));
  });

  // CKP-MSW-022 : Précédent depuis page 2 → offset revient à 0.
  it('CKP-MSW-022 : « Précédent » depuis la page 2 → offset=0', async () => {
    const offsets: number[] = [];
    paginatedHandlers(offsets);
    const user = userEvent.setup();
    render(<TransactionalCockpit initialViews={[]} />);
    await screen.findByTestId('cockpit-pagination');
    await user.click(screen.getByRole('button', { name: /suivant/i }));
    await waitFor(() => expect(offsets).toContain(50));
    await user.click(screen.getByRole('button', { name: /précédent/i }));
    // L'offset 0 a été redemandé (au moins le fetch initial + retour page 1).
    await waitFor(() =>
      expect(offsets.filter((o) => o === 0).length).toBeGreaterThanOrEqual(2),
    );
  });

  // CKP-MSW-023 : borne basse — Précédent désactivé en page 1.
  it('CKP-MSW-023 : borne basse — « Précédent » désactivé en page 1', async () => {
    paginatedHandlers([]);
    render(<TransactionalCockpit initialViews={[]} />);
    await screen.findByTestId('cockpit-pagination');
    expect(screen.getByRole('button', { name: /précédent/i })).toBeDisabled();
  });

  // CKP-MSW-024 : borne haute — Suivant désactivé sur la dernière page.
  it('CKP-MSW-024 : borne haute — « Suivant » désactivé sur la dernière page', async () => {
    // Petit total exact (120) : page 1 (0..49), page 2 (50..99), page 3 (100..119)
    // → 100+20 >= 120 sur la dernière page.
    const offsets: number[] = [];
    paginatedHandlers(offsets, { total: 120, window: 'matched' });
    const user = userEvent.setup();
    render(<TransactionalCockpit initialViews={[]} />);
    await screen.findByTestId('cockpit-pagination');
    // page 1 → suivant actif
    expect(screen.getByRole('button', { name: /suivant/i })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: /suivant/i })); // → offset 50
    await waitFor(() => expect(offsets).toContain(50));
    await user.click(screen.getByRole('button', { name: /suivant/i })); // → offset 100 (dernière)
    await waitFor(() => expect(offsets).toContain(100));
    // 100 + 20 lignes = 120 = total → plus de page suivante.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /suivant/i })).toBeDisabled(),
    );
  });

  // CKP-MSW-025 : indicateur « X–Y sur total » exact en page 2.
  it('CKP-MSW-025 : indicateur « 51–100 sur 5 000 » en page 2', async () => {
    const offsets: number[] = [];
    paginatedHandlers(offsets);
    const user = userEvent.setup();
    render(<TransactionalCockpit initialViews={[]} />);
    await screen.findByTestId('cockpit-pagination');
    // Page 1 : 1–50.
    expect(screen.getByTestId('pagination-range')).toHaveTextContent(/^1–50 sur 5\s?000/);
    await user.click(screen.getByRole('button', { name: /suivant/i }));
    // Page 2 : 51–100.
    await waitFor(() =>
      expect(screen.getByTestId('pagination-range')).toHaveTextContent(/51–100 sur 5\s?000/),
    );
  });

  // CKP-MSW-026 : changement de filtre → reset page 1 (offset 0).
  it('CKP-MSW-026 : changement de filtre (effacer) → reset à offset 0', async () => {
    const offsets: number[] = [];
    paginatedHandlers(offsets);
    const user = userEvent.setup();
    render(<TransactionalCockpit initialViews={[]} />);
    await screen.findByTestId('cockpit-pagination');
    await user.click(screen.getByRole('button', { name: /suivant/i }));
    await waitFor(() => expect(offsets).toContain(50));
    // Cliquer une carte KPI applique un filtre (applyParseResult) → reset offset 0.
    await user.click(screen.getByTestId('kpi-failed'));
    await waitFor(() => expect(offsets[offsets.length - 1]).toBe(0));
  });

  // CKP-MSW-027 : changement de tri → reset page 1 (offset 0).
  it('CKP-MSW-027 : changement de tri → reset à offset 0', async () => {
    const offsets: number[] = [];
    paginatedHandlers(offsets);
    const user = userEvent.setup();
    render(<TransactionalCockpit initialViews={[]} />);
    await screen.findByTestId('cockpit-pagination');
    await user.click(screen.getByRole('button', { name: /suivant/i }));
    await waitFor(() => expect(offsets).toContain(50));
    // Cliquer un en-tête triable (Statut) change le tri → doit ramener offset 0.
    await user.click(screen.getByRole('button', { name: /^Statut/i }));
    await waitFor(() => expect(offsets[offsets.length - 1]).toBe(0));
  });

  // CKP-MSW-028 : total<=PAGE_SIZE → pas de nav de pagination affichée.
  it('CKP-MSW-028 : total<=50 → contrôles de pagination masqués', async () => {
    server.use(
      http.post(SEARCH, () =>
        HttpResponse.json({
          rows: [makeSearchRow({ id: 'out_only' })],
          total: 1,
          window: 'matched',
        }),
      ),
      http.get(SUMMARY, () => HttpResponse.json(makeSummary())),
    );
    render(<TransactionalCockpit initialViews={[]} />);
    // Le tableau est chargé…
    expect(await screen.findByTestId('filtered-table')).toBeInTheDocument();
    // …mais aucune nav de pagination (1 seule page).
    expect(screen.queryByTestId('cockpit-pagination')).not.toBeInTheDocument();
  });
});
