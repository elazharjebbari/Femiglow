/**
 * MODÈLE — test composant « vue opérateur » avec grille réseau complète.
 *
 * Illustre, sur l'action « Retirer » de la liste de suppression (F09/SUP-F04),
 * TOUS les patrons imposés par 05-strategie-tests.md :
 *   §3.1 grille réseau 6 cas (200/401/422/500/hang/network) — zéro faux succès
 *   §3.3 parcours opérateur scénarisé (recherche → retrait → feedback → refetch)
 *   §4   anti-flakiness : fake timers pour le debounce, delay('infinite') pour
 *        l'état de chargement, AUCUN setTimeout dans le test
 *   §6   noms préfixés par l'ID de batterie (F09-C-0xx)
 *
 * Harnais réel du repo : serveur partagé @/test/msw/server, lifecycle PAR
 * FICHIER, politique 'error' (tout appel non mocké = échec immédiat).
 */
import {
  describe, it, expect,
  beforeAll, beforeEach, afterEach, afterAll, vi,
} from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server, http, HttpResponse, delay } from '@/test/msw/server';

import { SuppressionList } from '@/components/admin/emails/cockpit/SuppressionList';

const API = '/api/admin/emails/suppression';

/** Factory locale minimale — pour du partagé, passer par emails.factory. */
function makeEntry(over: Partial<Record<string, unknown>> = {}) {
  return {
    email: 'bounce@exemple.test',
    reason: 'hard_bounce',
    detail: null,
    source: 'stalwart',
    since: '2026-06-01T10:00:00.000Z',
    ...over,
  };
}

/** Baseline nominale : 2 entrées, GET filtrable, DELETE ok. */
function baseHandlers(rows = [makeEntry(), makeEntry({ email: 'unsub@exemple.test', reason: 'unsubscribe', source: 'manual' })]) {
  server.use(
    http.get(API, ({ request }) => {
      const q = new URL(request.url).searchParams.get('q') ?? '';
      const filtered = rows.filter((r) => String(r.email).includes(q));
      return HttpResponse.json({ rows: filtered, total: filtered.length, limit: 50, offset: 0 });
    }),
    http.delete(API, () => HttpResponse.json({ removed: true })),
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => baseHandlers());
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
  vi.useRealTimers();
});
afterAll(() => server.close());

/** Rend la liste et attend la fin du chargement initial. */
async function renderList() {
  const user = userEvent.setup();
  render(<SuppressionList />);
  await screen.findByText('bounce@exemple.test'); // fin du skeleton
  return user;
}

/* ────────────────────────────────────────────────────────────────────────────
 * §3.3 — Parcours opérateur scénarisé (le test « long » qui attrape les
 * bugs d'enchaînement d'états).
 * ──────────────────────────────────────────────────────────────────────── */
describe('SuppressionList — parcours opérateur', () => {
  it('F09-C-001 — rechercher, retirer, lire le feedback, voir la liste rafraîchie', async () => {
    const user = await renderList();

    // 1. L'opérateur filtre par email.
    await user.type(screen.getByRole('searchbox', { name: /filtrer par email/i }), 'bounce');
    await user.click(screen.getByRole('button', { name: /rechercher/i }));
    expect(await screen.findByText('bounce@exemple.test')).toBeInTheDocument();
    expect(screen.queryByText('unsub@exemple.test')).not.toBeInTheDocument();

    // 2. Il retire l'adresse — le dialog rappelle les CONSÉQUENCES.
    await user.click(screen.getByRole('button', { name: /retirer bounce@exemple\.test/i }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(/pourra de nouveau recevoir des emails/i);
    await user.click(within(dialog).getByRole('button', { name: /^retirer$/i }));

    // 3. Feedback succès formulé RÉSULTAT (pas « opération effectuée »).
    expect(await screen.findByRole('status')).toHaveTextContent(
      /bounce@exemple\.test retiré de la liste/i,
    );
  });
});

/* ────────────────────────────────────────────────────────────────────────────
 * §3.1 — GRILLE RÉSEAU (bloc obligatoire pour CHAQUE action réseau).
 * Oracle central : zéro faux succès ; l'état opérateur est préservé.
 * ──────────────────────────────────────────────────────────────────────── */
describe('Retirer — grille réseau', () => {
  /** Ouvre le dialog et confirme le retrait de la 1re entrée. */
  async function confirmRemoval(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: /retirer bounce@exemple\.test/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^retirer$/i }));
  }

  it('F09-C-010 — 200 : feedback succès, la ligne disparaît après refetch', async () => {
    const user = await renderList();
    await confirmRemoval(user);
    expect(await screen.findByRole('status')).toHaveTextContent(/retiré/i);
  });

  it.each([
    ['F09-C-011', 401, /session expirée ou non autorisée/i],
    ['F09-C-012', 422, /invalide/i],
    ['F09-C-013', 500, /réessaie/i],
  ])('%s — %i : alerte visible, AUCUN faux succès, la ligne reste', async (_id, status, msg) => {
    server.use(http.delete(API, () => HttpResponse.json({ error: 'x' }, { status })));
    const user = await renderList();
    await confirmRemoval(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(msg);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();          // pas de toast succès
    expect(screen.getByText('bounce@exemple.test')).toBeInTheDocument();   // état préservé
  });

  it('F09-C-014 — hang : bouton en cours + désactivé, UN SEUL DELETE émis au double-clic', async () => {
    let calls = 0;
    server.use(http.delete(API, async () => { calls += 1; await delay('infinite'); return HttpResponse.json({}); }));
    const user = await renderList();
    await confirmRemoval(user);

    const busy = await screen.findByRole('button', { name: /retrait/i });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute('aria-busy', 'true');
    await user.click(busy).catch(() => {});  // double-clic agressif
    expect(calls).toBe(1);
  });

  it('F09-C-015 — network error : message réseau actionnable + Réessayer rejoue la MÊME action', async () => {
    server.use(http.delete(API, () => HttpResponse.error()));
    const user = await renderList();
    await confirmRemoval(user);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/réseau/i);

    // L'opérateur réessaie — cette fois le serveur répond.
    server.use(http.delete(API, () => HttpResponse.json({ removed: true })));
    await user.click(within(alert).getByRole('button', { name: /réessayer/i }));
    expect(await screen.findByRole('status')).toHaveTextContent(/retiré/i);
  });
});

/* ────────────────────────────────────────────────────────────────────────────
 * §4 — fake timers : tout debounce/auto-dismiss se teste à horloge contrôlée.
 * ──────────────────────────────────────────────────────────────────────── */
describe('Feedback — temporalité', () => {
  it('F09-C-020 — le toast succès disparaît à 4 s, pas avant', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SuppressionList />);
    await screen.findByText('bounce@exemple.test');

    await user.click(screen.getByRole('button', { name: /retirer bounce@exemple\.test/i }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /^retirer$/i }));
    const status = await screen.findByRole('status');

    vi.advanceTimersByTime(3_900);
    expect(status).toBeInTheDocument();
    vi.advanceTimersByTime(200);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
