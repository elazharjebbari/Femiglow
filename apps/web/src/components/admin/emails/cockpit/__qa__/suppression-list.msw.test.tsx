/**
 * VAGUE 4 — COCKPIT : SuppressionList (UX-COCKPIT-001).
 * ADAPTÉ P1.5 (emails-ux) : l'écran est le PILOTE du socle F01 —
 * window.confirm → ConfirmDialog ; feedback succès inline → toast ;
 * échec → erreur DANS le dialog (resté ouvert), ligne conservée.
 *
 * Oracles (intentions inchangées) :
 *  - GET → liste paginée rendue ;
 *  - « Retirer » confirmé via le DIALOG → DELETE { email } → ligne disparue
 *    + toast résultat ;
 *  - annulation (bouton Annuler) → aucun DELETE ;
 *  - DELETE 500 → role=alert dans le dialog, ligne CONSERVÉE (zéro faux succès).
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
import { ToastProvider } from '@/components/admin/emails/ui/toast';

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

/** Rendu sous le provider du socle (le layout réel fait pareil). */
function renderList() {
  return render(
    <ToastProvider>
      <SuppressionList />
    </ToastProvider>,
  );
}

/** Ouvre le ConfirmDialog du retrait et clique le verbe « Retirer ». */
async function confirmRemoval(user: ReturnType<typeof userEvent.setup>, email: string) {
  await user.click(await screen.findByTestId(`suppression-remove-${email}`));
  const dialog = await screen.findByRole('dialog');
  expect(dialog).toHaveTextContent(/pourra de nouveau recevoir des emails/i);
  await user.click(within(dialog).getByRole('button', { name: /^retirer$/i }));
  return dialog;
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
    renderList();

    expect(await screen.findByTestId('suppression-row-alpha@exemple.test')).toBeInTheDocument();
    expect(screen.getByTestId('suppression-row-beta@exemple.test')).toBeInTheDocument();
    // Libellé FR de la raison (pas le slug brut).
    expect(within(screen.getByTestId('suppression-row-beta@exemple.test')).getByText(/Désinscription/i)).toBeInTheDocument();
  });

  it('UX4-COCKPIT-002b : « Retirer » confirmé (ConfirmDialog) → DELETE { email } → ligne disparue + toast', async () => {
    const store = [makeRow({ email: 'faux.positif@exemple.test' })];
    let deletedEmail = '';
    server.use(
      statefulList(store),
      http.delete(ROUTE, async ({ request }) => {
        const body = (await request.json()) as { email: string };
        deletedEmail = body.email;
        const idx = store.findIndex((r) => r.email === body.email);
        if (idx >= 0) store.splice(idx, 1);
        return HttpResponse.json({ removed: true });
      }),
    );
    const user = userEvent.setup();
    renderList();

    await confirmRemoval(user, 'faux.positif@exemple.test');

    await waitFor(() => expect(deletedEmail).toBe('faux.positif@exemple.test'));
    await waitFor(() =>
      expect(screen.queryByTestId('suppression-row-faux.positif@exemple.test')).toBeNull(),
    );
    // Feedback résultat : TOAST du socle (plus de bloc inline).
    expect(await screen.findByText(/faux\.positif@exemple\.test retiré de la liste/i)).toBeInTheDocument();
    // Le dialog s'est refermé.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('UX4-COCKPIT-002c : Annuler dans le dialog → aucun DELETE, ligne conservée', async () => {
    const store = [makeRow({ email: 'garde@exemple.test' })];
    let deleteHits = 0;
    server.use(
      statefulList(store),
      http.delete(ROUTE, () => {
        deleteHits += 1;
        return HttpResponse.json({ removed: true });
      }),
    );
    const user = userEvent.setup();
    renderList();

    await user.click(await screen.findByTestId('suppression-remove-garde@exemple.test'));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^annuler$/i }));

    expect(deleteHits).toBe(0);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('suppression-row-garde@exemple.test')).toBeInTheDocument();
  });

  it('UX4-COCKPIT-002d : DELETE 500 → erreur DANS le dialog resté ouvert, ligne CONSERVÉE', async () => {
    const store = [makeRow({ email: 'echec@exemple.test' })];
    server.use(
      statefulList(store),
      http.delete(ROUTE, () => HttpResponse.json({ error: 'internal' }, { status: 500 })),
    );
    const user = userEvent.setup();
    renderList();

    const dialog = await confirmRemoval(user, 'echec@exemple.test');

    // Le dialog RESTE ouvert avec un role=alert actionnable (re-tentative possible).
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent(/le retrait a échoué \(http 500\)/i);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // Pas de faux succès : pas de toast, ligne toujours là.
    expect(screen.queryByText(/retiré de la liste/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('suppression-row-echec@exemple.test')).toBeInTheDocument();
  });

  it('P1.5 : la re-tentative depuis le dialog après un 500 aboutit (même action rejouée)', async () => {
    const store = [makeRow({ email: 'retente@exemple.test' })];
    let calls = 0;
    server.use(
      statefulList(store),
      http.delete(ROUTE, () => {
        calls += 1;
        if (calls === 1) return HttpResponse.json({ error: 'x' }, { status: 500 });
        const idx = store.findIndex((r) => r.email === 'retente@exemple.test');
        if (idx >= 0) store.splice(idx, 1);
        return HttpResponse.json({ removed: true });
      }),
    );
    const user = userEvent.setup();
    renderList();

    const dialog = await confirmRemoval(user, 'retente@exemple.test');
    await within(dialog).findByRole('alert');

    // Le serveur revient : on re-clique le MÊME verbe dans le MÊME dialog.
    await user.click(within(dialog).getByRole('button', { name: /^retirer$/i }));
    expect(await screen.findByText(/retente@exemple\.test retiré de la liste/i)).toBeInTheDocument();
    expect(calls).toBe(2);
  });
});
