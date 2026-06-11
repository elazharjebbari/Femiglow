/**
 * VAGUE 4 — COCKPIT : SuppressionList (UX-COCKPIT-001).
 *
 * Oracle UX4-COCKPIT-002 (MSW) :
 *  - GET /api/admin/emails/suppression renvoie la liste paginée (rendue) ;
 *  - le bouton « Retirer » déclenche DELETE après confirmation et la ligne
 *    disparaît ; échec → message role=alert, ligne conservée (pas de faux succès).
 */
import {
  describe,
  expect,
  it,
  beforeAll,
  afterEach,
  afterAll,
  vi,
} from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server, http, HttpResponse } from '@/test/msw/server';
import { SuppressionList } from '@/components/admin/emails/cockpit/SuppressionList';

const ROUTE = '/api/admin/emails/suppression';

type Row = { email: string; reason: string; detail: string | null; since: string; source: string };

function makeRow(over: Partial<Row> = {}): Row {
  return {
    email: 'bloque@exemple.test',
    reason: 'hard_bounce',
    detail: 'listmonk:permanent',
    since: '2026-06-01T10:00:00.000Z',
    source: 'listmonk',
    ...over,
  };
}

/** Handler GET stateful : sert un store mutable d'adresses. */
function statefulList(store: Row[]) {
  return http.get(ROUTE, ({ request }) => {
    const q = (new URL(request.url).searchParams.get('q') ?? '').toLowerCase();
    const rows = q ? store.filter((r) => r.email.toLowerCase().includes(q)) : store;
    return HttpResponse.json({ rows, total: rows.length, limit: 50, offset: 0 });
  });
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});
afterAll(() => server.close());

describe('SuppressionList — liste de suppression consultable & réversible (UX4-COCKPIT-002)', () => {
  it('UX4-COCKPIT-002 : GET → liste paginée rendue (adresses + raison FR)', async () => {
    const store = [
      makeRow({ email: 'alpha@exemple.test', reason: 'hard_bounce' }),
      makeRow({ email: 'beta@exemple.test', reason: 'unsubscribe', source: 'manual' }),
    ];
    server.use(statefulList(store));
    render(<SuppressionList />);

    expect(await screen.findByTestId('suppression-row-alpha@exemple.test')).toBeInTheDocument();
    expect(screen.getByTestId('suppression-row-beta@exemple.test')).toBeInTheDocument();
    // Libellé FR de la raison (pas le slug brut).
    expect(within(screen.getByTestId('suppression-row-beta@exemple.test')).getByText(/Désinscription/i)).toBeInTheDocument();
  });

  it('UX4-COCKPIT-002b : « Retirer » confirmé → DELETE { email } → la ligne disparaît + feedback', async () => {
    const store = [makeRow({ email: 'faux.positif@exemple.test' })];
    let deletedEmail = '';
    server.use(
      statefulList(store),
      http.delete(ROUTE, async ({ request }) => {
        const body = (await request.json()) as { email: string };
        deletedEmail = body.email;
        // Retire du store pour que le re-GET ne renvoie plus la ligne.
        const idx = store.findIndex((r) => r.email === body.email);
        if (idx >= 0) store.splice(idx, 1);
        return HttpResponse.json({ removed: true });
      }),
    );
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    render(<SuppressionList />);

    const removeBtn = await screen.findByTestId('suppression-remove-faux.positif@exemple.test');
    await user.click(removeBtn);

    await waitFor(() => expect(deletedEmail).toBe('faux.positif@exemple.test'));
    // La ligne disparaît après le re-fetch.
    await waitFor(() =>
      expect(screen.queryByTestId('suppression-row-faux.positif@exemple.test')).toBeNull(),
    );
    // Feedback honnête de retrait.
    expect(await screen.findByTestId('suppression-remove-ok')).toHaveTextContent(/retiré/i);
    confirmSpy.mockRestore();
  });

  it('UX4-COCKPIT-002c : confirmation ANNULÉE → aucun DELETE, ligne conservée', async () => {
    const store = [makeRow({ email: 'garde@exemple.test' })];
    let deleteHits = 0;
    server.use(
      statefulList(store),
      http.delete(ROUTE, () => {
        deleteHits += 1;
        return HttpResponse.json({ removed: true });
      }),
    );
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    render(<SuppressionList />);
    await user.click(await screen.findByTestId('suppression-remove-garde@exemple.test'));
    // Laisse le temps à un éventuel fetch indésirable.
    await new Promise((r) => setTimeout(r, 50));
    expect(deleteHits).toBe(0);
    expect(screen.getByTestId('suppression-row-garde@exemple.test')).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it('UX4-COCKPIT-002d : DELETE 500 → role=alert visible, ligne CONSERVÉE (pas de faux succès)', async () => {
    const store = [makeRow({ email: 'echec@exemple.test' })];
    server.use(
      statefulList(store),
      http.delete(ROUTE, () => HttpResponse.json({ error: 'internal' }, { status: 500 })),
    );
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    render(<SuppressionList />);
    await user.click(await screen.findByTestId('suppression-remove-echec@exemple.test'));
    expect(await screen.findByTestId('suppression-remove-error')).toBeInTheDocument();
    // La ligne reste : pas de faux succès.
    expect(screen.getByTestId('suppression-row-echec@exemple.test')).toBeInTheDocument();
    confirmSpy.mockRestore();
  });
});
