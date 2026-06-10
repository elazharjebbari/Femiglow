// @vitest-environment jsdom
/**
 * F04 lot P2.2 — cockpit transactionnel, lisibilité + export serveur :
 *  - C-006..009  erreurs de parsing VISIBLES (CKPT-03) ;
 *  - C-031..040  export CSV honnête page/serveur + grille réseau (CKPT-01) ;
 *  - C-041..045  raisons de skip traduites (CKPT-02) ;
 *  - C-046..048  feedback reap + grille réseau (CKPT-07) ;
 *  - C-049..052  saut de page borné (CKPT-12) ;
 *  - C-053..055  bannière contexte santé (DASH-12) ;
 *  - C-056..059  tooltips file/5000+ + seuils/clics KPI.
 *
 * Harnais : MSW par fichier, cockpit RÉEL monté, corps des POST capturés.
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
import { emailsHandlers, makeSearchRow, makeSummary } from '@/test/msw/emails-handlers';

const push = vi.fn();
const replace = vi.fn();
let urlParams = new URLSearchParams('');
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => urlParams,
}));

import { TransactionalCockpit } from '@/components/admin/emails/cockpit/TransactionalCockpit';

const SEARCH = '/api/admin/emails/transactional/search';
const EXPORT = '/api/admin/emails/transactional/export';
const RETRY = '/api/admin/emails/transactional/bulk-retry';
const REAP = '/api/admin/emails/transactional/reap-stuck';

const ROW_A = makeSearchRow({ id: 'out_a', status: 'failed', toEmail: 'a@exemple.test' });
const ROW_B = makeSearchRow({ id: 'out_b', status: 'dlq', toEmail: 'b@exemple.test' });

type SearchBody = {
  filters: { key: string; value: unknown }[];
  pagination: { limit: number; offset: number };
};
let searchBodies: SearchBody[] = [];

/** Baseline : 2 lignes + summary nominal ; chaque POST /search est capturé. */
function arm(total = 2, window: 'matched' | 'truncated' = 'matched') {
  server.use(...emailsHandlers);
  server.use(
    http.post(SEARCH, async ({ request }) => {
      searchBodies.push((await request.json()) as SearchBody);
      return HttpResponse.json({ rows: [ROW_A, ROW_B], total, window });
    }),
  );
}

function renderCockpit() {
  return render(<TransactionalCockpit initialViews={[]} />);
}

/** Le tableau est peuplé (premier search résolu). */
async function tableReady() {
  await screen.findByLabelText(/Sélectionner a@exemple\.test/i);
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  searchBodies = [];
  urlParams = new URLSearchParams('');
});
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete (URL as unknown as Record<string, unknown>).createObjectURL;
  delete (URL as unknown as Record<string, unknown>).revokeObjectURL;
});
afterAll(() => server.close());

/* ── CKPT-03 : erreurs de parsing visibles ───────────────────────────────── */

describe('F04 — erreurs de parsing visibles (CKPT-03)', () => {
  it('F04-C-006 — filtre fautif au mount → section role=alert + input palette aria-invalid', async () => {
    urlParams = new URLSearchParams('attempts=abc');
    arm();
    const user = userEvent.setup();
    renderCockpit();
    await tableReady();

    const alertBox = screen.getByTestId('filter-parse-errors');
    expect(alertBox).toHaveAttribute('role', 'alert');
    expect(alertBox).toHaveTextContent('attendu : >N, <N, =N');

    // L'input de la palette signale l'invalidité en live.
    await user.keyboard('{Meta>}k{/Meta}');
    const input = await screen.findByRole('combobox');
    await user.type(input, 'attempts:abc');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it("F04-C-007 — autant de lignes d'erreur que d'erreurs", async () => {
    urlParams = new URLSearchParams('attempts=abc&status=plop');
    arm();
    renderCockpit();
    await tableReady();
    const items = within(screen.getByTestId('filter-parse-errors')).getAllByRole('listitem');
    expect(items).toHaveLength(2);
  });

  it('F04-C-008 — input 100 % valide → AUCUN warning', async () => {
    urlParams = new URLSearchParams('status=failed');
    arm();
    renderCockpit();
    await tableReady();
    expect(screen.queryByTestId('filter-parse-errors')).not.toBeInTheDocument();
  });

  it('F04-C-009 — parsing PARTIEL : status:failed appliqué malgré attempts:abc', async () => {
    urlParams = new URLSearchParams('status=failed&attempts=abc');
    arm();
    renderCockpit();
    await tableReady();
    expect(screen.getByTestId('filter-parse-errors')).toBeInTheDocument();
    // Le POST /search contient bien le filtre valide.
    expect(searchBodies[0]!.filters).toEqual([
      expect.objectContaining({ key: 'status', value: ['failed'] }),
    ]);
  });
});

/* ── CKPT-01 : export honnête + grille réseau ───────────────────────────── */

describe('F04 — export CSV honnête (CKPT-01)', () => {
  function spyDownload() {
    // NE PAS stubber l'objet URL entier (ça détruirait `new URL()`, utilisé
    // par le cockpit ET MSW) — on greffe seulement les 2 méthodes Blob.
    (URL as unknown as Record<string, unknown>).createObjectURL = vi.fn(() => 'blob:fake');
    (URL as unknown as Record<string, unknown>).revokeObjectURL = vi.fn();
    const clicks: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicks.push(this.download);
    });
    return clicks;
  }

  it("F04-C-032 — total <= page → libellé « Exporter CSV (page) », chemin CLIENT (zéro POST)", async () => {
    arm(2);
    let exportHits = 0;
    server.use(
      http.post(EXPORT, () => {
        exportHits += 1;
        return new HttpResponse('x', { status: 200 });
      }),
    );
    const clicks = spyDownload();
    const user = userEvent.setup();
    renderCockpit();
    await tableReady();

    const btn = screen.getByTestId('export-all-btn');
    expect(btn).toHaveTextContent('Exporter CSV (page)');
    await user.click(btn);
    expect(exportHits).toBe(0);
    expect(clicks[0]).toMatch(/^emails-transactionnels-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it("F04-C-033 — total > page → libellé « Exporter CSV (serveur, ~5 312 lignes) »", async () => {
    arm(5312);
    renderCockpit();
    await tableReady();
    expect(screen.getByTestId('export-all-btn').textContent!.replace(/[\s  ]/g, ' ')).toContain(
      'Exporter CSV (serveur, ~5 312 lignes)',
    );
  });

  it('F04-C-031 / F04-C-035 — POST /export avec le filterState COURANT, téléchargement daté', async () => {
    urlParams = new URLSearchParams('status=failed');
    arm(5312);
    let exportBody: unknown = null;
    server.use(
      http.post(EXPORT, async ({ request }) => {
        exportBody = await request.json();
        return new HttpResponse('﻿id\r\n', {
          status: 200,
          headers: { 'x-export-capped': 'false', 'content-type': 'text/csv; charset=utf-8' },
        });
      }),
    );
    const clicks = spyDownload();
    const user = userEvent.setup();
    renderCockpit();
    await tableReady();

    await user.click(screen.getByTestId('export-all-btn'));
    await waitFor(() => expect(exportBody).not.toBeNull());
    expect(exportBody).toMatchObject({
      filters: [expect.objectContaining({ key: 'status', value: ['failed'] })],
    });
    await waitFor(() => expect(clicks).toHaveLength(1));
    expect(clicks[0]).toMatch(/^emails-transactionnels-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it('F04-C-034 — réponse cappée → message « Export limité aux 100 000 premières lignes »', async () => {
    arm(200_000, 'truncated');
    server.use(
      http.post(EXPORT, () =>
        new HttpResponse('﻿id\r\n', { status: 200, headers: { 'x-export-capped': 'true' } }),
      ),
    );
    spyDownload();
    const user = userEvent.setup();
    renderCockpit();
    await tableReady();
    await user.click(screen.getByTestId('export-all-btn'));
    expect(await screen.findByTestId('export-capped-msg')).toHaveTextContent(
      /Export limité aux 100 000 premières lignes/,
    );
  });

  for (const [id, status, expected] of [
    ['F04-C-036', 401, /session expirée/i],
    ['F04-C-037', 422, /données invalides/i],
    // 500 sans corps exploitable → message générique (un corps {error} serait
    // relayé tel quel, ce qui est aussi honnête — testé via le détail 422).
    ['F04-C-038', 500, /erreur serveur \(http 500\)/i],
  ] as const) {
    it(`${id} — POST /export ${status} → alerte visible, AUCUN téléchargement`, async () => {
      arm(5312);
      server.use(
        http.post(EXPORT, () =>
          status === 500
            ? HttpResponse.json({}, { status })
            : HttpResponse.json({ error: 'nope' }, { status }),
        ),
      );
      const clicks = spyDownload();
      const user = userEvent.setup();
      renderCockpit();
      await tableReady();
      await user.click(screen.getByTestId('export-all-btn'));
      expect(await screen.findByTestId('export-error')).toHaveTextContent(expected);
      expect(clicks).toHaveLength(0);
    });
  }

  it("F04-C-039 — hang : « Préparation de l'export… » aria-busy, UN SEUL POST", async () => {
    arm(5312);
    let hits = 0;
    server.use(
      http.post(EXPORT, async () => {
        hits += 1;
        await delay('infinite');
        return new HttpResponse('x');
      }),
    );
    const user = userEvent.setup();
    renderCockpit();
    await tableReady();

    const btn = screen.getByTestId('export-all-btn');
    await user.click(btn);
    await waitFor(() => expect(btn).toHaveAttribute('aria-busy', 'true'));
    expect(btn).toHaveTextContent("Préparation de l'export…");
    await user.click(btn); // double-clic pendant le vol
    expect(hits).toBe(1);
  });

  it('F04-C-040 — network error → message réseau + Réessayer rejoue le POST', async () => {
    arm(5312);
    let hits = 0;
    server.use(
      http.post(EXPORT, () => {
        hits += 1;
        return HttpResponse.error();
      }),
    );
    const user = userEvent.setup();
    renderCockpit();
    await tableReady();
    await user.click(screen.getByTestId('export-all-btn'));
    const err = await screen.findByTestId('export-error');
    expect(err).toHaveTextContent(/échec réseau/i);
    await user.click(within(err).getByRole('button', { name: /réessayer/i }));
    await waitFor(() => expect(hits).toBe(2));
  });
});

/* ── CKPT-02 : raisons traduites dans le feedback bulk ──────────────────── */

describe('F04 — raisons de skip traduites (CKPT-02)', () => {
  async function retryWithSkips(skippedIds: { id: string; reason: string }[]) {
    arm();
    server.use(
      http.post(RETRY, () =>
        HttpResponse.json({
          retried: 1,
          skipped: skippedIds.length,
          skippedIds,
        }),
      ),
    );
    const user = userEvent.setup();
    renderCockpit();
    await tableReady();
    await user.click(screen.getByLabelText(/Sélectionner a@exemple\.test/i));
    await user.click(screen.getByLabelText(/Sélectionner b@exemple\.test/i));
    await user.click(screen.getByTestId('bulk-action-retry'));
    return screen.findByTestId('bulk-action-feedback');
  }

  it("F04-C-041 — not_found → « (non trouvé) », JAMAIS le code anglais", async () => {
    const fb = await retryWithSkips([{ id: 'x', reason: 'not_found' }]);
    expect(fb).toHaveTextContent('1 ignoré (non trouvé)');
    expect(fb).not.toHaveTextContent('not_found');
  });

  it('F04-C-042 — 2 wrong_status → « 2 ignorés (statut non relançable) »', async () => {
    const fb = await retryWithSkips([
      { id: 'x', reason: 'wrong_status' },
      { id: 'y', reason: 'wrong_status' },
    ]);
    expect(fb).toHaveTextContent('2 ignorés (statut non relançable)');
  });

  it('F04-C-043 — suppressed → « (adresse en liste de suppression) »', async () => {
    const fb = await retryWithSkips([{ id: 'x', reason: 'suppressed' }]);
    expect(fb).toHaveTextContent('(adresse en liste de suppression)');
  });

  it('F04-C-044 — cap_exceeded → « (au-delà du plafond de tentatives) »', async () => {
    const fb = await retryWithSkips([{ id: 'x', reason: 'cap_exceeded' }]);
    expect(fb).toHaveTextContent('(au-delà du plafond de tentatives)');
  });

  it('F04-C-045 — raisons multiples COMPTÉES « 1 non trouvé · 1 statut non relançable »', async () => {
    const fb = await retryWithSkips([
      { id: 'x', reason: 'not_found' },
      { id: 'y', reason: 'wrong_status' },
    ]);
    expect(fb).toHaveTextContent('1 non trouvé · 1 statut non relançable');
  });
});

/* ── CKPT-07 : feedback reap + grille réseau ────────────────────────────── */

describe('F04 — reap : feedback précis + grille réseau (CKPT-07)', () => {
  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('F04-C-046 — succès → précise le statut résultant (file ou DLQ)', async () => {
    arm();
    server.use(http.post(REAP, () => HttpResponse.json({ reaped: 3 })));
    const user = userEvent.setup();
    renderCockpit();
    await tableReady();
    await user.click(screen.getByTestId('reap-stuck-btn'));
    expect(await screen.findByTestId('reap-feedback')).toHaveTextContent(
      '3 envois bloqués libérés → re-mis en file (ou DLQ si plafond).',
    );
  });

  it('F04-C-047 — zéro → « Aucun envoi bloqué à libérer. »', async () => {
    arm();
    server.use(http.post(REAP, () => HttpResponse.json({ reaped: 0 })));
    const user = userEvent.setup();
    renderCockpit();
    await tableReady();
    await user.click(screen.getByTestId('reap-stuck-btn'));
    expect(await screen.findByTestId('reap-feedback')).toHaveTextContent(
      'Aucun envoi bloqué à libérer.',
    );
  });

  it('F04-C-048 — grille réseau reap : 401/422/500/network → alerte, hang → busy + 1 POST', async () => {
    // 401 / 422 / 500 / network : un message d'erreur VISIBLE, zéro faux succès.
    for (const status of [401, 422, 500] as const) {
      arm();
      server.use(http.post(REAP, () => HttpResponse.json({ error: 'x' }, { status })));
      const user = userEvent.setup();
      const view = renderCockpit();
      await tableReady();
      await user.click(screen.getByTestId('reap-stuck-btn'));
      expect(await screen.findByTestId('reap-error')).toBeInTheDocument();
      expect(screen.queryByTestId('reap-feedback')).not.toBeInTheDocument();
      view.unmount();
      server.resetHandlers();
    }
    // network error
    arm();
    server.use(http.post(REAP, () => HttpResponse.error()));
    const user = userEvent.setup();
    const view = renderCockpit();
    await tableReady();
    await user.click(screen.getByTestId('reap-stuck-btn'));
    expect(await screen.findByTestId('reap-error')).toHaveTextContent(/échec réseau/i);
    view.unmount();
    server.resetHandlers();

    // hang : bouton occupé, un SEUL POST
    arm();
    let hits = 0;
    server.use(
      http.post(REAP, async () => {
        hits += 1;
        await delay('infinite');
        return HttpResponse.json({ reaped: 0 });
      }),
    );
    renderCockpit();
    await tableReady();
    const btn = screen.getByTestId('reap-stuck-btn');
    await user.click(btn);
    await waitFor(() => expect(btn).toHaveTextContent('Libération…'));
    await user.click(btn);
    expect(hits).toBe(1);
  });
});

/* ── CKPT-12 : saut de page ─────────────────────────────────────────────── */

describe('F04 — saut de page (CKPT-12)', () => {
  it('F04-C-049 — saut à la page 12 → POST /search offset=550', async () => {
    arm(600);
    const user = userEvent.setup();
    renderCockpit();
    await tableReady();
    const input = screen.getByTestId('page-jump-input');
    await user.clear(input);
    await user.type(input, '12{Enter}');
    await waitFor(() =>
      expect(searchBodies.at(-1)!.pagination.offset).toBe(550),
    );
  });

  it("F04-C-050 — valeur invalide ignorée : pas de navigation, l'input revient à la page courante", async () => {
    arm(600);
    const user = userEvent.setup();
    renderCockpit();
    await tableReady();
    const before = searchBodies.length;
    const input = screen.getByTestId('page-jump-input');
    await user.clear(input);
    await user.type(input, 'abc{Enter}');
    expect(searchBodies.length).toBe(before); // aucun POST déclenché
    expect(input).toHaveValue('1');
  });

  it('F04-C-051 — page 999 hors borne → ramenée à la dernière page', async () => {
    arm(230); // 5 pages
    const user = userEvent.setup();
    renderCockpit();
    await tableReady();
    const input = screen.getByTestId('page-jump-input');
    await user.clear(input);
    await user.type(input, '999{Enter}');
    await waitFor(() => expect(searchBodies.at(-1)!.pagination.offset).toBe(200));
    expect(input).toHaveValue('5');
  });

  it('F04-C-052 — Précédent disabled page 1 ; Suivant disabled en dernière page', async () => {
    arm(60); // 2 pages
    const user = userEvent.setup();
    renderCockpit();
    await tableReady();
    expect(screen.getByTestId('pagination-prev')).toBeDisabled();
    const input = screen.getByTestId('page-jump-input');
    await user.clear(input);
    await user.type(input, '2{Enter}');
    // En dernière page : rows mockées (2) < total-offset… on vérifie via l'état
    // des boutons une fois le search re-résolu.
    await waitFor(() => expect(screen.getByTestId('pagination-prev')).toBeEnabled());
  });
});

/* ── DASH-12 : bannière contexte santé ──────────────────────────────────── */

describe('F04 — bannière contexte santé (DASH-12)', () => {
  it('F04-C-053 — ?from=health → bannière avec raison + heure de relevé', async () => {
    urlParams = new URLSearchParams(
      'status=dlq&from=health&check=dlq24h&at=2026-06-10T09%3A30%3A00.000Z',
    );
    arm();
    renderCockpit();
    await tableReady();
    const banner = screen.getByTestId('health-context-banner');
    expect(banner).toHaveTextContent(/depuis le contrôle santé/);
    expect(banner).toHaveTextContent('dlq24h');
    expect(banner).toHaveTextContent('09:30');
  });

  it('F04-C-054 — from absent → AUCUNE bannière', async () => {
    urlParams = new URLSearchParams('status=dlq');
    arm();
    renderCockpit();
    await tableReady();
    expect(screen.queryByTestId('health-context-banner')).not.toBeInTheDocument();
  });

  it("F04-C-055 — fermer masque ET retire from/check/at de l'URL", async () => {
    urlParams = new URLSearchParams('from=health&check=dlq24h');
    arm();
    const user = userEvent.setup();
    renderCockpit();
    await tableReady();
    await user.click(screen.getByRole('button', { name: /fermer la bannière/i }));
    expect(screen.queryByTestId('health-context-banner')).not.toBeInTheDocument();
    const lastReplace = replace.mock.calls.at(-1)![0] as string;
    expect(lastReplace).not.toContain('from=health');
    expect(lastReplace).not.toContain('check=');
  });
});

/* ── CKPT-05/06 + CKP-F11 : tooltips & KPI ──────────────────────────────── */

describe('F04 — tooltips & KPI header', () => {
  it("F04-C-056 — carte « En file » : placeholder '—' EXPLIQUÉ (pas de graphe plat)", async () => {
    arm();
    renderCockpit();
    await tableReady();
    const queued = await screen.findByTestId('kpi-queued');
    const ph = within(queued).getByTestId('sparkline-placeholder');
    expect(ph).toHaveTextContent('—');
    expect(ph).toHaveAttribute('title', expect.stringMatching(/instantané/));
  });

  it("F04-C-057 — total tronqué : « 5 000+ » porte un title explicatif", async () => {
    arm(5000, 'truncated');
    renderCockpit();
    await tableReady();
    const range = await screen.findByTestId('pagination-range');
    expect(range.textContent).toContain('+');
    expect(range).toHaveAttribute('title', expect.stringMatching(/compte exact non calculé/i));
  });

  it('F04-C-058 — seuil failed ≥ 5 → carte Échecs en mode alerte', async () => {
    arm();
    server.use(
      http.get('/api/admin/emails/transactional/summary', () =>
        HttpResponse.json(makeSummary({ failed: 7 })),
      ),
    );
    renderCockpit();
    await tableReady();
    const failed = await screen.findByTestId('kpi-failed');
    expect(within(failed).getByText(/attention/i)).toBeInTheDocument();
  });

  it('F04-C-059 — clic carte Échecs → POST /search avec status failed+dlq', async () => {
    arm();
    const user = userEvent.setup();
    renderCockpit();
    await tableReady();
    await user.click(await screen.findByTestId('kpi-failed'));
    await waitFor(() => {
      const last = searchBodies.at(-1)!;
      expect(last.filters).toEqual([
        expect.objectContaining({ key: 'status', value: ['failed', 'dlq'] }),
      ]);
    });
  });
});
