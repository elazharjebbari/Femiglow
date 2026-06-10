// @vitest-environment jsdom
/**
 * F04 lot P2.3 — sélection GLOBALE page|filter + retry par filtre :
 *  - C-010..019  machine de sélection (amorce, bascule, survie, annulation,
 *    rupture d'exhaustivité, sélection page intacte, shift-clic) ;
 *  - C-020..024  dry-count → ConfirmDialog → exécution + cap ;
 *  - C-025..030  grille réseau du POST bulk-retry-by-filter.
 *
 * Monté sous ToastProvider (le layout réel fait pareil) — l'annulation au
 * changement de filtre émet un toast.
 */
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server, http, HttpResponse, delay } from '@/test/msw/server';
import { emailsHandlers, makeSearchRow } from '@/test/msw/emails-handlers';
import { ToastProvider } from '@/components/admin/emails/ui/toast';

const push = vi.fn();
const replace = vi.fn();
let urlParams = new URLSearchParams('');
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => urlParams,
}));

import { TransactionalCockpit } from '@/components/admin/emails/cockpit/TransactionalCockpit';

const SEARCH = '/api/admin/emails/transactional/search';
const BY_FILTER = '/api/admin/emails/transactional/bulk-retry-by-filter';

const ROWS = [
  makeSearchRow({ id: 'out_a', status: 'failed', toEmail: 'a@exemple.test' }),
  makeSearchRow({ id: 'out_b', status: 'dlq', toEmail: 'b@exemple.test' }),
  makeSearchRow({ id: 'out_c', status: 'failed', toEmail: 'c@exemple.test' }),
];

type SearchBody = { pagination: { offset: number }; sort?: string };
let searchBodies: SearchBody[] = [];

function arm(total = 5312) {
  server.use(...emailsHandlers);
  server.use(
    http.post(SEARCH, async ({ request }) => {
      searchBodies.push((await request.json()) as SearchBody);
      return HttpResponse.json({ rows: ROWS, total, window: 'matched' });
    }),
  );
}

function renderCockpit() {
  return render(
    <ToastProvider>
      <TransactionalCockpit initialViews={[]} />
    </ToastProvider>,
  );
}

/** Coche toute la page via la checkbox d'en-tête. */
async function selectAllPage(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByLabelText(/Sélectionner a@exemple\.test/i);
  await user.click(screen.getByLabelText(/tout sélectionner|sélectionner la page|sélectionner tout/i));
}

/** Amorce la sélection GLOBALE (page cochée → lien d'amorce). */
async function engageFilterSelection(user: ReturnType<typeof userEvent.setup>) {
  await selectAllPage(user);
  await user.click(await screen.findByTestId('select-all-filter-link'));
  return screen.findByTestId('filter-selection-banner');
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  searchBodies = [];
  urlParams = new URLSearchParams('');
});
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});
afterAll(() => server.close());

/* ── C-010..019 : machine de sélection ──────────────────────────────────── */

describe('F04 — sélection globale page|filter (CKPT-04)', () => {
  it("F04-C-010 — lien d'amorce SEULEMENT si total > page", async () => {
    arm(5312);
    const user = userEvent.setup();
    renderCockpit();
    await selectAllPage(user);
    expect(await screen.findByTestId('select-all-filter-link')).toBeInTheDocument();
  });

  it("F04-C-010b — total <= page : PAS de lien d'amorce", async () => {
    arm(3);
    const user = userEvent.setup();
    renderCockpit();
    await selectAllPage(user);
    expect(screen.queryByTestId('select-all-filter-link')).not.toBeInTheDocument();
  });

  it('F04-C-011 — clic amorce → bannière « 5 312 emails sélectionnés (filtre …) [annuler] »', async () => {
    arm(5312);
    const user = userEvent.setup();
    renderCockpit();
    const banner = await engageFilterSelection(user);
    expect(banner.textContent!.replace(/[\s  ]/g, ' ')).toContain('5 312 emails sélectionnés');
    expect(within(banner).getByTestId('filter-selection-cancel')).toBeInTheDocument();
  });

  it("F04-C-012 — le bouton Retry affiche le compteur GLOBAL « (5 312) », pas « (3) »", async () => {
    arm(5312);
    const user = userEvent.setup();
    renderCockpit();
    await engageFilterSelection(user);
    const retry = screen.getByTestId('bulk-action-retry');
    expect(retry.textContent!.replace(/[\s  ]/g, ' ')).toContain('Retry (5 312)');
  });

  it('F04-C-013 — changement de PAGE : la sélection-filtre SURVIT', async () => {
    arm(5312);
    const user = userEvent.setup();
    renderCockpit();
    await engageFilterSelection(user);
    await user.click(screen.getByTestId('pagination-next'));
    await waitFor(() => expect(searchBodies.at(-1)!.pagination.offset).toBe(50));
    expect(screen.getByTestId('filter-selection-banner').textContent!.replace(/[\s  ]/g, ' ')).toContain(
      '5 312',
    );
  });

  it('F04-C-014 — changement de FILTRE : annulée + toast info', async () => {
    arm(5312);
    const user = userEvent.setup();
    renderCockpit();
    await engageFilterSelection(user);
    // Changement de filtre via quick-filter DLQ.
    await user.click(screen.getByTestId('quick-filter-dlq'));
    await waitFor(() =>
      expect(screen.queryByTestId('filter-selection-banner')).not.toBeInTheDocument(),
    );
    expect(
      await screen.findByText(/Sélection globale annulée — les filtres ont changé/),
    ).toBeInTheDocument();
    // Mode page VIDE : plus aucun compteur de sélection.
    expect(screen.queryByTestId('selection-count')).not.toBeInTheDocument();
  });

  it('F04-C-015 — changement de TRI : la sélection-filtre SURVIT', async () => {
    arm(5312);
    const user = userEvent.setup();
    renderCockpit();
    await engageFilterSelection(user);
    // Tri par en-tête de colonne : Date est active (date_desc) → clic = date_asc.
    await user.click(screen.getByRole('button', { name: /^date/i }));
    await waitFor(() => expect(searchBodies.at(-1)!.sort).toBe('date_asc'));
    expect(screen.getByTestId('filter-selection-banner')).toBeInTheDocument();
  });

  it('F04-C-016 — « annuler » → mode page vide, SANS toast', async () => {
    arm(5312);
    const user = userEvent.setup();
    renderCockpit();
    await engageFilterSelection(user);
    await user.click(screen.getByTestId('filter-selection-cancel'));
    expect(screen.queryByTestId('filter-selection-banner')).not.toBeInTheDocument();
    expect(screen.queryByText(/Sélection globale annulée/)).not.toBeInTheDocument();
  });

  it("F04-C-017 — décocher une ligne ROMPT l'exhaustivité (retour mode page)", async () => {
    arm(5312);
    const user = userEvent.setup();
    renderCockpit();
    await engageFilterSelection(user);
    await user.click(screen.getByLabelText(/Sélectionner b@exemple\.test/i)); // décoche
    expect(screen.queryByTestId('filter-selection-banner')).not.toBeInTheDocument();
    // Mode page : 2 lignes restantes sélectionnées.
    expect(screen.getByTestId('selection-count')).toHaveTextContent(/2 sélectionnés/);
  });

  it('F04-C-018 — la sélection PAGE reste par ids : Retry (3)', async () => {
    arm(5312);
    const user = userEvent.setup();
    renderCockpit();
    await selectAllPage(user);
    const retry = screen.getByTestId('bulk-action-retry');
    expect(retry).toHaveTextContent('Retry (3)');
  });

  it('F04-C-019 — shift-clic sélectionne un intervalle de lignes', async () => {
    arm(5312);
    const user = userEvent.setup();
    renderCockpit();
    await screen.findByLabelText(/Sélectionner a@exemple\.test/i);
    await user.click(screen.getByLabelText(/Sélectionner a@exemple\.test/i));
    const cbC = screen.getByLabelText(/Sélectionner c@exemple\.test/i);
    await user.keyboard('{Shift>}');
    await user.click(cbC);
    await user.keyboard('{/Shift}');
    expect(screen.getByTestId('selection-count')).toHaveTextContent(/3 sélectionnés/);
  });
});

/* ── C-020..024 : dry-count → confirm → exec + cap ──────────────────────── */

describe('F04 — retry par filtre : dry-count + confirmation (CKPT-02)', () => {
  function armByFilter(handlers: Parameters<typeof http.post>[1]) {
    server.use(http.post(BY_FILTER, handlers));
  }

  it('F04-C-020 — dry-count affiché dans le ConfirmDialog ; \'F04-C-025 : 200 nominal', async () => {
    arm(5312);
    armByFilter(async ({ request }) => {
      const body = (await request.json()) as { dry_run: boolean };
      return body.dry_run
        ? HttpResponse.json({ count: 5312 })
        : HttpResponse.json({ retried: 5290, skipped: [] });
    });
    const user = userEvent.setup();
    renderCockpit();
    await engageFilterSelection(user);
    await user.click(screen.getByTestId('bulk-action-retry'));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent!.replace(/[\s  ]/g, ' ')).toContain(
      '5 312 emails seront relancés — confirmer ?',
    );
  });

  it('F04-C-021 — confirmation → POST dry_run:false ; \'F04-C-023 : feedback honnête', async () => {
    arm(5312);
    let execBody: { dry_run: boolean } | null = null;
    armByFilter(async ({ request }) => {
      const body = (await request.json()) as { dry_run: boolean };
      if (body.dry_run) return HttpResponse.json({ count: 5312 });
      execBody = body;
      return HttpResponse.json({
        retried: 5290,
        skipped: [{ reason: 'wrong_status', count: 22 }],
      });
    });
    const user = userEvent.setup();
    renderCockpit();
    await engageFilterSelection(user);
    await user.click(screen.getByTestId('bulk-action-retry'));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^relancer$/i }));

    const feedback = await screen.findByTestId('bulk-action-feedback');
    expect(feedback.textContent!.replace(/[\s  ]/g, ' ')).toContain(
      '5 290 relancés · 22 ignorés (statut non relançable)',
    );
    expect(execBody).toMatchObject({ dry_run: false });
  });

  it("F04-C-022 — annulation du dialog : AUCUN POST dry_run:false", async () => {
    arm(5312);
    let execHits = 0;
    armByFilter(async ({ request }) => {
      const body = (await request.json()) as { dry_run: boolean };
      if (body.dry_run) return HttpResponse.json({ count: 5312 });
      execHits += 1;
      return HttpResponse.json({ retried: 0, skipped: [] });
    });
    const user = userEvent.setup();
    renderCockpit();
    await engageFilterSelection(user);
    await user.click(screen.getByTestId('bulk-action-retry'));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^annuler$/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(execHits).toBe(0);
  });

  it("F04-C-024 — dry-count 12 480 > cap → message cap, AUCUNE confirmation ni exec", async () => {
    arm(20_000);
    let execHits = 0;
    armByFilter(async ({ request }) => {
      const body = (await request.json()) as { dry_run: boolean };
      if (body.dry_run) return HttpResponse.json({ count: 12_480 });
      execHits += 1;
      return HttpResponse.json({ retried: 0, skipped: [] });
    });
    const user = userEvent.setup();
    renderCockpit();
    await engageFilterSelection(user);
    await user.click(screen.getByTestId('bulk-action-retry'));
    const cap = await screen.findByTestId('filter-retry-cap');
    expect(cap.textContent!.replace(/[\s  ]/g, ' ')).toContain(
      '12 480 emails correspondent — au-delà de 10 000, affinez le filtre.',
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(execHits).toBe(0);
  });
});

/* ── C-025..030 : grille réseau du dry-count ────────────────────────────── */

describe('F04 — grille réseau bulk-retry-by-filter', () => {
  for (const [id, status, expected] of [
    ['F04-C-026', 401, /session expirée/i],
    ['F04-C-027', 422, /données invalides/i],
    ['F04-C-028', 500, /erreur serveur|réessaie/i],
  ] as const) {
    it(`${id} — POST ${status} → alerte visible, PAS de dialog, sélection conservée`, async () => {
      arm(5312);
      server.use(
        http.post(BY_FILTER, () =>
          status === 500
            ? HttpResponse.json({}, { status })
            : HttpResponse.json({ error: 'nope' }, { status }),
        ),
      );
      const user = userEvent.setup();
      renderCockpit();
      await engageFilterSelection(user);
      await user.click(screen.getByTestId('bulk-action-retry'));
      expect(await screen.findByTestId('filter-retry-error')).toHaveTextContent(expected);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      // La sélection-filtre est CONSERVÉE (on peut réessayer).
      expect(screen.getByTestId('filter-selection-banner')).toBeInTheDocument();
    });
  }

  it('F04-C-029 — hang : bouton occupé/désactivé, UN SEUL POST au double-clic', async () => {
    arm(5312);
    let hits = 0;
    server.use(
      http.post(BY_FILTER, async () => {
        hits += 1;
        await delay('infinite');
        return HttpResponse.json({ count: 0 });
      }),
    );
    const user = userEvent.setup();
    renderCockpit();
    await engageFilterSelection(user);
    const retry = screen.getByTestId('bulk-action-retry');
    await user.click(retry);
    await waitFor(() => expect(retry).toBeDisabled());
    await user.click(retry).catch(() => {});
    expect(hits).toBe(1);
  });

  it("F04-C-030 — network error : message réseau + Réessayer REJOUE l'action", async () => {
    arm(5312);
    let hits = 0;
    server.use(
      http.post(BY_FILTER, () => {
        hits += 1;
        return HttpResponse.error();
      }),
    );
    const user = userEvent.setup();
    renderCockpit();
    await engageFilterSelection(user);
    await user.click(screen.getByTestId('bulk-action-retry'));
    const err = await screen.findByTestId('filter-retry-error');
    expect(err).toHaveTextContent(/échec réseau/i);
    await user.click(within(err).getByRole('button', { name: /réessayer/i }));
    await waitFor(() => expect(hits).toBe(2));
  });
});

/* ── C-073/074 : parcours opérateur longs + A-003 a11y bannière ─────────── */

describe('F04 — parcours opérateur (métier)', () => {
  it('F04-C-073 — DLQ → tout sélectionner → retry (1 ignoré) → sélection vidée', async () => {
    arm(3);
    server.use(
      http.post('/api/admin/emails/transactional/bulk-retry', () =>
        HttpResponse.json({
          retried: 2,
          skipped: 1,
          skippedIds: [{ id: 'out_b', reason: 'wrong_status' }],
        }),
      ),
    );
    const user = userEvent.setup();
    renderCockpit();
    // 1. Filtrer DLQ.
    await screen.findByLabelText(/Sélectionner a@exemple\.test/i);
    await user.click(screen.getByTestId('quick-filter-dlq'));
    // 2. Tout sélectionner (page = total → pas d'amorce) puis retry.
    await selectAllPage(user);
    await user.click(screen.getByTestId('bulk-action-retry'));
    // 3. Résultat honnête (raison FR) + sélection vidée après succès.
    const fb = await screen.findByTestId('bulk-action-feedback');
    expect(fb).toHaveTextContent('2 relancés · 1 ignoré (statut non relançable)');
    expect(screen.queryByTestId('selection-count')).not.toBeInTheDocument();
  });

  it('F04-C-074 — sélection-filtre → export serveur ET retry par filtre : libellés ~N cohérents', async () => {
    arm(5312);
    server.use(
      http.post(BY_FILTER, async ({ request }) => {
        const body = (await request.json()) as { dry_run: boolean };
        return body.dry_run
          ? HttpResponse.json({ count: 5312 })
          : HttpResponse.json({ retried: 5312, skipped: [] });
      }),
    );
    const user = userEvent.setup();
    renderCockpit();
    await engageFilterSelection(user);

    const flat = (s: string | null) => (s ?? '').replace(/[\s  ]/g, ' ');
    // Cohérence des périmètres affichés : bannière, Retry, Export — même ~N.
    expect(flat(screen.getByTestId('filter-selection-banner').textContent)).toContain('5 312');
    expect(flat(screen.getByTestId('bulk-action-retry').textContent)).toContain('Retry (5 312)');
    expect(flat(screen.getByTestId('bulk-action-export').textContent)).toContain(
      'Exporter CSV (serveur, ~5 312 lignes)',
    );
    expect(flat(screen.getByTestId('export-all-btn').textContent)).toContain(
      'Exporter CSV (serveur, ~5 312',
    );
    // Le retry par filtre aboutit (dialog → confirm → feedback global).
    await user.click(screen.getByTestId('bulk-action-retry'));
    const dialog = await screen.findByRole('dialog');
    expect(flat(dialog.textContent)).toContain('5 312 emails seront relancés');
    await user.click(within(dialog).getByRole('button', { name: /^relancer$/i }));
    expect(flat((await screen.findByTestId('bulk-action-feedback')).textContent)).toContain(
      '5 312 relancés',
    );
  });
});

describe('F04 — a11y de la bannière de sélection globale', () => {
  it('F04-A-003 — bannière role=status (annoncée) + compteur lisible + axe propre', async () => {
    arm(5312);
    const user = userEvent.setup();
    const { container } = renderCockpit();
    await engageFilterSelection(user);
    const banner = screen.getByTestId('filter-selection-banner');
    expect(banner).toHaveAttribute('role', 'status');
    const { expectNoAxeViolations } = await import('@/test/axe');
    await expectNoAxeViolations(container);
  });
});
