/**
 * Module 02 — Cockpit : requêtes de recherche EXACTES envoyées au serveur
 * (F-010 / F-015 / F-019). Oracle : le BODY POST /search intercepté par MSW
 * (filters/freetext/pagination/sort) — pas seulement le rendu.
 *
 * Couvre :
 *  - barre ⌘K (CommandPalette) : Enter applique les filtres parsés → body exact
 *  - clic carte KPI → filtre status mappé (CKP-MSW-065)
 *  - bouton « effacer » → reset filtres (body filters vides)
 *  - pagination préservée dans le body (limit constant)
 *
 * Harnais RÉEL : serveur MSW partagé, override local. La palette ⌘K du cockpit
 * est `CommandPalette` (cmdk) montée en permanence ; on l'ouvre via Cmd+K.
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

const push = vi.fn();
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => new URLSearchParams(''),
}));

import { TransactionalCockpit } from '@/components/admin/emails/cockpit/TransactionalCockpit';

const SEARCH = '/api/admin/emails/transactional/search';
const SUMMARY = '/api/admin/emails/transactional/summary';

type SearchBody = {
  filters: { key: string; value: unknown; operator?: string }[];
  freetext?: string;
  pagination: { limit: number; offset: number };
  sort?: string;
};

/** Capture chaque body POST /search ; sert 2 lignes. */
function captureSearchBodies(bodies: SearchBody[]) {
  server.use(
    http.post(SEARCH, async ({ request }) => {
      bodies.push((await request.json()) as SearchBody);
      return HttpResponse.json({
        rows: [makeSearchRow({ id: 'out_0' }), makeSearchRow({ id: 'out_1' })],
        total: 2,
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
});
afterAll(() => server.close());

describe('Cockpit — requêtes de recherche exactes (F-010 / F-019)', () => {
  // CKP-MSW-092 / F-010 : ⌘K → saisir status:failed → Enter → body filters exact.
  it('CKP-MSW-092 : ⌘K + « status:failed » + Entrée → POST search avec filtre status [failed]', async () => {
    const bodies: SearchBody[] = [];
    captureSearchBodies(bodies);
    const user = userEvent.setup();
    render(<TransactionalCockpit initialViews={[]} />);
    await waitFor(() => expect(bodies.length).toBeGreaterThanOrEqual(1));
    // Ouvre la palette ⌘K (le hook écoute metaKey+k au niveau window).
    await user.keyboard('{Meta>}k{/Meta}');
    const input = await screen.findByPlaceholderText(/status:failed/i);
    await user.type(input, 'status:failed');
    await user.keyboard('{Enter}');
    // Oracle réseau : un body avec EXACTEMENT filters=[{key:'status',value:['failed']}].
    await waitFor(() => {
      const last = bodies[bodies.length - 1]!;
      expect(last.filters).toEqual([
        expect.objectContaining({ key: 'status', value: ['failed'] }),
      ]);
    });
  });

  // F-010 : freetext (token libre) part dans le champ freetext, pas en filtre.
  it('CKP-SEARCH-FT : ⌘K + token libre « fatima » → body.freetext="fatima", filters vide', async () => {
    const bodies: SearchBody[] = [];
    captureSearchBodies(bodies);
    const user = userEvent.setup();
    render(<TransactionalCockpit initialViews={[]} />);
    await waitFor(() => expect(bodies.length).toBeGreaterThanOrEqual(1));
    await user.keyboard('{Meta>}k{/Meta}');
    const input = await screen.findByPlaceholderText(/status:failed/i);
    await user.type(input, 'fatima');
    await user.keyboard('{Enter}');
    await waitFor(() => {
      const last = bodies[bodies.length - 1]!;
      expect(last.freetext).toBe('fatima');
      expect(last.filters).toEqual([]);
    });
  });

  // CKP-MSW-065 / F-015 : clic carte « Échecs » → applique status:failed,dlq.
  it('F04-C-003 (ex CKP-MSW-065) : clic carte Échecs → POST search avec status [failed, dlq] (requêtes annulables)', async () => {
    const bodies: SearchBody[] = [];
    captureSearchBodies(bodies);
    const user = userEvent.setup();
    render(<TransactionalCockpit initialViews={[]} />);
    await waitFor(() => expect(bodies.length).toBeGreaterThanOrEqual(1));
    await user.click(await screen.findByTestId('kpi-failed'));
    await waitFor(() => {
      const last = bodies[bodies.length - 1]!;
      expect(last.filters).toEqual([
        expect.objectContaining({ key: 'status', value: ['failed', 'dlq'] }),
      ]);
    });
  });

  // CKP-MSW-065b / F-015 : clic carte « En file » → status pending,sending.
  it('CKP-SEARCH-QUEUED : clic carte En file → status [pending, sending]', async () => {
    const bodies: SearchBody[] = [];
    captureSearchBodies(bodies);
    const user = userEvent.setup();
    render(<TransactionalCockpit initialViews={[]} />);
    await waitFor(() => expect(bodies.length).toBeGreaterThanOrEqual(1));
    await user.click(await screen.findByTestId('kpi-queued'));
    await waitFor(() => {
      const last = bodies[bodies.length - 1]!;
      expect(last.filters).toEqual([
        expect.objectContaining({ key: 'status', value: ['pending', 'sending'] }),
      ]);
    });
  });

  // F-010 reset : après un filtre, cliquer « effacer » renvoie un body filters vide.
  it('CKP-SEARCH-RESET : « effacer » après un filtre → POST search avec filters vides', async () => {
    const bodies: SearchBody[] = [];
    captureSearchBodies(bodies);
    const user = userEvent.setup();
    render(<TransactionalCockpit initialViews={[]} />);
    await waitFor(() => expect(bodies.length).toBeGreaterThanOrEqual(1));
    // Applique un filtre via une carte KPI.
    await user.click(await screen.findByTestId('kpi-failed'));
    await waitFor(() =>
      expect(bodies[bodies.length - 1]!.filters.length).toBeGreaterThan(0),
    );
    // « effacer » n'apparaît que quand des filtres sont actifs.
    await user.click(await screen.findByRole('button', { name: /effacer/i }));
    await waitFor(() => expect(bodies[bodies.length - 1]!.filters).toEqual([]));
  });

  // Pagination : la limite reste constante (PAGE_SIZE) entre deux recherches.
  it('CKP-SEARCH-LIMIT : limit constant (50) dans chaque body, offset reset après filtre', async () => {
    const bodies: SearchBody[] = [];
    captureSearchBodies(bodies);
    const user = userEvent.setup();
    render(<TransactionalCockpit initialViews={[]} />);
    await waitFor(() => expect(bodies.length).toBeGreaterThanOrEqual(1));
    await user.click(await screen.findByTestId('kpi-failed'));
    await waitFor(() => expect(bodies.length).toBeGreaterThanOrEqual(2));
    // Oracle : tous les bodies portent limit=50 ; le dernier offset est 0 (reset).
    for (const b of bodies) expect(b.pagination.limit).toBe(50);
    expect(bodies[bodies.length - 1]!.pagination.offset).toBe(0);
  });
});
