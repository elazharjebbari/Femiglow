/**
 * VAGUE 4 — COCKPIT : pilotabilité du cockpit (UX-COCKPIT-002/003/004).
 *
 * Oracles (harnais composant RTL + MSW partagé) :
 *  - UX4-COCKPIT-003 : monter le cockpit avec une vue SYSTÈME filterState=
 *    {status:['failed']}, cliquer la vue → POST /search rappelé avec
 *    status:['failed'] (et NON vide) — régression F-016 au premier chargement.
 *  - UX4-COCKPIT-004 : dans CommandPalette, taper 'template:wel' déclenche
 *    /templates/autocomplete (slugs proposés) ; 'to:cl' déclenche
 *    recipients-autocomplete ; 'source:ap' déclenche /sources.
 *  - UX4-COCKPIT-005 : filtres rapides « Soft bounces » / « DLQ » → POST /search
 *    avec status:['bounced_soft'] / status:['dlq'].
 *  - « Libérer les envois bloqués » → POST /reap-stuck + feedback.
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
const TEMPLATES_AC = '/api/admin/emails/templates/autocomplete';
const RECIPIENTS_AC = '/api/admin/emails/transactional/recipients-autocomplete';
const SOURCES = '/api/admin/emails/transactional/sources';
const REAP = '/api/admin/emails/transactional/reap-stuck';

type SearchBody = {
  filters: { key: string; value: unknown; operator?: string }[];
  freetext?: string;
  pagination: { limit: number; offset: number };
  sort?: string;
};

function captureSearch(bodies: SearchBody[]) {
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
});
afterAll(() => server.close());

describe('Cockpit vague 4 — pilotabilité', () => {
  // UX4-COCKPIT-003 — régression F-016 : la vue système applique vraiment son filtre.
  it('UX4-COCKPIT-003 : cliquer une vue système filterState={status:[failed]} → POST search avec status [failed]', async () => {
    const bodies: SearchBody[] = [];
    captureSearch(bodies);
    const user = userEvent.setup();
    render(
      <TransactionalCockpit
        initialViews={[
          {
            id: 'sys-failed',
            name: 'Échecs du jour',
            isSystem: true,
            filterState: { filters: { status: ['failed'] }, sort: 'date_desc', cols: [] },
          },
        ]}
      />,
    );
    await waitFor(() => expect(bodies.length).toBeGreaterThanOrEqual(1));
    // Au 1er chargement : aucun filtre.
    expect(bodies[bodies.length - 1]!.filters).toEqual([]);

    await user.click(await screen.findByTestId('view-sys-failed'));

    await waitFor(() => {
      const last = bodies[bodies.length - 1]!;
      expect(last.filters).toEqual([
        expect.objectContaining({ key: 'status', value: ['failed'] }),
      ]);
    });
    // Et surtout : le filtre n'est PAS vide (le no-op F-016 est corrigé).
    expect(bodies[bodies.length - 1]!.filters.length).toBeGreaterThan(0);
  });

  // UX4-COCKPIT-005 — filtre rapide Soft bounces.
  it('F04-C-076 (ex UX4-COCKPIT-005) : filtre rapide « Soft bounces » → POST search status [bounced_soft]', async () => {
    const bodies: SearchBody[] = [];
    captureSearch(bodies);
    const user = userEvent.setup();
    render(<TransactionalCockpit initialViews={[]} />);
    await waitFor(() => expect(bodies.length).toBeGreaterThanOrEqual(1));
    await user.click(await screen.findByTestId('quick-filter-bounced_soft'));
    await waitFor(() => {
      expect(bodies[bodies.length - 1]!.filters).toEqual([
        expect.objectContaining({ key: 'status', value: ['bounced_soft'] }),
      ]);
    });
  });

  // UX4-COCKPIT-005b — filtre rapide DLQ.
  it('F04-C-075 (ex UX4-COCKPIT-005b) : filtre rapide « DLQ » → POST search status [dlq]', async () => {
    const bodies: SearchBody[] = [];
    captureSearch(bodies);
    const user = userEvent.setup();
    render(<TransactionalCockpit initialViews={[]} />);
    await waitFor(() => expect(bodies.length).toBeGreaterThanOrEqual(1));
    await user.click(await screen.findByTestId('quick-filter-dlq'));
    await waitFor(() => {
      expect(bodies[bodies.length - 1]!.filters).toEqual([
        expect.objectContaining({ key: 'status', value: ['dlq'] }),
      ]);
    });
  });

  // UX4-COCKPIT-004 — autocomplétion template: branchée sur /templates/autocomplete.
  it('UX4-COCKPIT-004 : ⌘K + « template:wel » → appelle /templates/autocomplete et propose les slugs', async () => {
    const bodies: SearchBody[] = [];
    captureSearch(bodies);
    let acHits = 0;
    server.use(
      http.get(TEMPLATES_AC, () => {
        acHits += 1;
        return HttpResponse.json({
          templates: [
            { slug: 'welcome-rituel', name: 'welcome.subject', source: 'system' },
            { slug: 'cart-abandon', name: 'cart.subject', source: 'system' },
          ],
        });
      }),
    );
    const user = userEvent.setup();
    render(<TransactionalCockpit initialViews={[]} />);
    await waitFor(() => expect(bodies.length).toBeGreaterThanOrEqual(1));
    await user.keyboard('{Meta>}k{/Meta}');
    const input = await screen.findByPlaceholderText(/status:failed/i);
    await user.type(input, 'template:wel');

    await waitFor(() => expect(acHits).toBeGreaterThanOrEqual(1));
    // La suggestion filtrée par « wel » propose welcome-rituel, pas cart-abandon.
    const opts = await screen.findAllByTestId('palette-entity-option');
    const texts = opts.map((o) => o.textContent ?? '');
    expect(texts.some((t) => t.includes('welcome-rituel'))).toBe(true);
    expect(texts.some((t) => t.includes('cart-abandon'))).toBe(false);
  });

  // UX4-COCKPIT-004b — autocomplétion to: branchée sur recipients-autocomplete.
  it('UX4-COCKPIT-004b : ⌘K + « to:cl » → appelle recipients-autocomplete et propose les emails', async () => {
    const bodies: SearchBody[] = [];
    captureSearch(bodies);
    let acHits = 0;
    let lastQ = '';
    server.use(
      http.get(RECIPIENTS_AC, ({ request }) => {
        acHits += 1;
        lastQ = new URL(request.url).searchParams.get('q') ?? '';
        return HttpResponse.json({ recipients: ['client@exemple.test', 'claire@exemple.test'] });
      }),
    );
    const user = userEvent.setup();
    render(<TransactionalCockpit initialViews={[]} />);
    await waitFor(() => expect(bodies.length).toBeGreaterThanOrEqual(1));
    await user.keyboard('{Meta>}k{/Meta}');
    const input = await screen.findByPlaceholderText(/status:failed/i);
    await user.type(input, 'to:cl');

    await waitFor(() => expect(acHits).toBeGreaterThanOrEqual(1));
    expect(lastQ).toBe('cl');
    const opts = await screen.findAllByTestId('palette-entity-option');
    expect(opts.map((o) => o.textContent ?? '').some((t) => t.includes('client@exemple.test'))).toBe(
      true,
    );
  });

  // UX4-COCKPIT-004c — autocomplétion source: branchée sur /sources.
  it('UX4-COCKPIT-004c : ⌘K + « source:ap » → appelle /sources', async () => {
    const bodies: SearchBody[] = [];
    captureSearch(bodies);
    let acHits = 0;
    server.use(
      http.get(SOURCES, () => {
        acHits += 1;
        return HttpResponse.json({ sources: ['api.contact', 'app'] });
      }),
    );
    const user = userEvent.setup();
    render(<TransactionalCockpit initialViews={[]} />);
    await waitFor(() => expect(bodies.length).toBeGreaterThanOrEqual(1));
    await user.keyboard('{Meta>}k{/Meta}');
    const input = await screen.findByPlaceholderText(/status:failed/i);
    await user.type(input, 'source:ap');
    await waitFor(() => expect(acHits).toBeGreaterThanOrEqual(1));
    const opts = await screen.findAllByTestId('palette-entity-option');
    expect(opts.map((o) => o.textContent ?? '').some((t) => t.includes('api.contact'))).toBe(true);
  });

  // UX-COCKPIT-007 — la confirmation de suppress chiffre les ADRESSES DISTINCTES
  // et mentionne la propagation (transactionnel ET campagnes) + la réversibilité.
  it('F04-C-070 (ex UX-COCKPIT-007) : confirm suppress → nb d’adresses distinctes + propagation + réversibilité', async () => {
    // 2 lignes outbox partageant la MÊME adresse → 1 adresse distincte.
    server.use(
      http.post(SEARCH, () =>
        HttpResponse.json({
          rows: [
            makeSearchRow({ id: 'o1', status: 'failed' }),
            makeSearchRow({ id: 'o2', status: 'failed' }),
          ].map((r) => ({ ...r, toEmail: 'meme.client@exemple.test' })),
          total: 2,
          window: 'matched',
        }),
      ),
      http.get(SUMMARY, () => HttpResponse.json(makeSummary())),
    );
    let confirmMsg = '';
    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation((m?: string) => {
      confirmMsg = m ?? '';
      return false; // on annule : on ne teste que le contenu du message.
    });
    const user = userEvent.setup();
    render(<TransactionalCockpit initialViews={[]} />);
    // Sélectionne toute la page (2 lignes, même destinataire).
    await user.click(await screen.findByTestId('select-all'));
    // Ouvre la barre d'actions → bouton « Marquer en suppression ».
    await user.click(await screen.findByRole('button', { name: /Marquer en suppression/i }));
    expect(confirmMsg).toMatch(/1 adresse distincte/i);
    expect(confirmMsg).toMatch(/transactionnel ET campagnes/i);
    expect(confirmMsg).toMatch(/liste de suppression/i);
    confirmSpy.mockRestore();
  });

  // UX-COCKPIT-004 — « Libérer les envois bloqués » → POST reap-stuck + feedback honnête.
  it('UX-COCKPIT-004 : « Libérer les envois bloqués » confirme puis POST reap-stuck → feedback', async () => {
    const bodies: SearchBody[] = [];
    captureSearch(bodies);
    let reapHits = 0;
    server.use(
      http.post(REAP, () => {
        reapHits += 1;
        return HttpResponse.json({ reaped: 3 });
      }),
    );
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    render(<TransactionalCockpit initialViews={[]} />);
    await waitFor(() => expect(bodies.length).toBeGreaterThanOrEqual(1));
    await user.click(await screen.findByTestId('reap-stuck-btn'));
    await waitFor(() => expect(reapHits).toBe(1));
    expect(await screen.findByTestId('reap-feedback')).toHaveTextContent(/3 envois? bloqués? libérés?/i);
    confirmSpy.mockRestore();
  });
});
