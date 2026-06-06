// @vitest-environment jsdom
/**
 * F02 — EmailsTabs (NAV-F01/F02, TRV-03/SUP-01) : batterie F02-U (mapping,
 * capage) + F02-C-001..018 + C-031.
 *
 * Doctrine testée : structure statique sans fetch au rendu, badges
 * post-hydratation, dégradation SILENCIEUSE (500/hang/réseau), lastKnown
 * conservé, refresh 30 s suspendu onglet caché.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server, http, HttpResponse, delay } from '@/test/msw/server';

let pathname = '/admin/emails';
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import {
  EmailsTabs,
  EMAILS_SECTIONS,
  activeKeyFromPathname,
  formatBadge,
} from '@/components/admin/emails/EmailsTabs';

const API = '/api/admin/emails/nav-counters';

let apiCalls = 0;
function armCounters(over: Partial<Record<'dlq' | 'automationErrors' | 'listmonkSyncFailed', number>> = {}) {
  server.use(
    http.get(API, () => {
      apiCalls += 1;
      return HttpResponse.json({
        dlq: 0,
        automationErrors: 0,
        listmonkSyncFailed: 0,
        generatedAt: '2026-06-06T10:00:00.000Z',
        ...over,
      });
    }),
  );
}

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  apiCalls = 0;
  pathname = '/admin/emails';
  vi.useRealTimers();
  vi.clearAllMocks();
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
});
afterAll(() => server.close());

/* ── F02-U — mapping route → onglet (table de la spec §3) ─────────────────── */
describe('activeKeyFromPathname — table de la spec', () => {
  it.each([
    ['/admin/emails', 'dashboard'],
    ['/admin/emails/', 'dashboard'],
    ['/admin/emails/transactional', 'transactional'],
    ['/admin/emails/transactional/abc123', 'transactional'],
    ['/admin/emails/campaigns', 'campaigns'],
    ['/admin/emails/campaigns/new', 'campaigns'],
    ['/admin/emails/campaigns/42/edit', 'campaigns'],
    ['/admin/emails/automation', 'automation'],
    ['/admin/emails/automation/new', 'automation'],
    ['/admin/emails/automation/runs', 'automation'],
    ['/admin/emails/automation/runs/9', 'automation'],
    ['/admin/emails/audiences/new', 'audiences'],
    ['/admin/emails/templates/7/edit', 'templates'],
    ['/admin/emails/suppression', 'suppression'],
    ['/admin/emails/events', 'events'],
    ['/admin/emails/listmonk', 'listmonk'],
    ['/admin/emails/listmonk/campaigns/3', 'listmonk'],
    ['/admin/emails/inexistant', null],
    ['/admin/coupons', null],
  ] as const)('F02-U — %s → %s', (path, expected) => {
    expect(activeKeyFromPathname(path)).toBe(expected);
  });

  it('F02-U-010..012 — formatBadge : 0→null (pas de badge), 3→"3", 150→"99+"', () => {
    expect(formatBadge(0)).toBeNull();
    expect(formatBadge(-1)).toBeNull();
    expect(formatBadge(3)).toBe('3');
    expect(formatBadge(99)).toBe('99');
    expect(formatBadge(150)).toBe('99+');
  });

  it('F02-U-016/017 — navCountersSchema : accepte le bien-formé, rejette le négatif', async () => {
    const { navCountersSchema } = await import('@/lib/mail/wire-schemas');
    const ok = { dlq: 3, automationErrors: 0, listmonkSyncFailed: 0, generatedAt: '2026-06-06T10:00:00.000Z' };
    expect(navCountersSchema.safeParse(ok).success).toBe(true);
    expect(navCountersSchema.safeParse({ ...ok, dlq: -1 }).success).toBe(false);
    expect(navCountersSchema.safeParse({ ...ok, generatedAt: 'pas-une-date' }).success).toBe(false);
  });
});

/* ── F02-C — structure & onglet actif ─────────────────────────────────────── */
describe('EmailsTabs — structure', () => {
  it('F02-C-001 — les 9 onglets dans l’ordre canonique', async () => {
    armCounters();
    render(<EmailsTabs />);
    const nav = screen.getByRole('navigation', { name: /sections emails/i });
    const labels = within(nav)
      .getAllByRole('link')
      .map((a) => a.textContent);
    expect(labels).toEqual([
      'Dashboard',
      'Transactionnel',
      'Campagnes',
      'Automations',
      'Audiences',
      'Templates',
      'Suppression',
      'Events',
      'Listmonk',
    ]);
    expect(EMAILS_SECTIONS).toHaveLength(9);
  });

  it('F02-C-002/003 — un SEUL aria-current=page, sur la bonne section (sous-route incluse)', async () => {
    armCounters();
    pathname = '/admin/emails/transactional/out_abc123';
    render(<EmailsTabs />);
    const current = screen
      .getAllByRole('link')
      .filter((a) => a.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent('Transactionnel');
  });

  it('F02-C-004 — Suppression présente et cliquable (SUP-01)', async () => {
    armCounters();
    render(<EmailsTabs />);
    expect(screen.getByRole('link', { name: /suppression/i })).toHaveAttribute(
      'href',
      '/admin/emails/suppression',
    );
  });

  it('F02-C-017 — Tab parcourt les 9 onglets dans l’ordre', async () => {
    armCounters();
    const user = userEvent.setup();
    render(<EmailsTabs />);
    const links = screen.getAllByRole('link');
    for (const link of links) {
      await user.tab();
      expect(document.activeElement).toBe(link);
    }
  });
});

/* ── F02-C — badges ───────────────────────────────────────────────────────── */
describe('EmailsTabs — badges', () => {
  it('F02-C-005 — dlq=0 : aucune pastille sur Transactionnel', async () => {
    armCounters({ dlq: 0 });
    render(<EmailsTabs />);
    await waitFor(() => expect(apiCalls).toBe(1));
    expect(
      within(screen.getByRole('link', { name: /transactionnel/i })).queryByText(/^\d/),
    ).not.toBeInTheDocument();
  });

  it('F02-C-006 — dlq=3 : pastille « 3 » avec libellé accessible', async () => {
    armCounters({ dlq: 3 });
    render(<EmailsTabs />);
    const badge = await screen.findByText('3');
    expect(badge).toHaveAttribute('aria-label', '3 message(s) en DLQ');
    expect(screen.getByRole('link', { name: /transactionnel.*3 message/i })).toBeInTheDocument();
  });

  it('F02-C-007 — dlq=150 : pastille plafonnée « 99+ »', async () => {
    armCounters({ dlq: 150 });
    render(<EmailsTabs />);
    expect(await screen.findByText('99+')).toBeInTheDocument();
  });

  it('F02-C-008 — automationErrors=2 : pastille « 2 » sur Automations', async () => {
    armCounters({ automationErrors: 2 });
    render(<EmailsTabs />);
    const auto = screen.getByRole('link', { name: /automations/i });
    expect(await within(auto).findByText('2')).toBeInTheDocument();
  });

  it('F02-C-009 — listmonkSyncFailed=1 : pastille token warning sur Listmonk', async () => {
    armCounters({ listmonkSyncFailed: 1 });
    render(<EmailsTabs />);
    const lmk = screen.getByRole('link', { name: /listmonk/i });
    const badge = await within(lmk).findByText('1');
    expect(badge.className).toMatch(/amber/);
  });
});

/* ── F02-C — grille de dégradation (silencieuse, jamais bloquante) ────────── */
describe('EmailsTabs — dégradation nav-counters', () => {
  it.each([
    ['F02-C-010', 500],
    ['F02-C-010b', 401],
  ])('%s — HTTP %i : 9 onglets sans badge, aucun role=alert', async (_id, status) => {
    server.use(http.get(API, () => HttpResponse.json({ error: 'x' }, { status })));
    render(<EmailsTabs />);
    await waitFor(() => expect(screen.getAllByRole('link')).toHaveLength(9));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument();
  });

  it('F02-C-011 — hang : rendu non bloqué, onglets interactifs sans badge', async () => {
    server.use(http.get(API, async () => { await delay('infinite'); return HttpResponse.json({}); }));
    render(<EmailsTabs />);
    expect(screen.getAllByRole('link')).toHaveLength(9); // immédiat
    expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument();
  });

  it('F02-C-012 — network error : dégradation silencieuse', async () => {
    server.use(http.get(API, () => HttpResponse.error()));
    render(<EmailsTabs />);
    await waitFor(() => expect(screen.getAllByRole('link')).toHaveLength(9));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('F02-C-016 — un refresh en échec CONSERVE les derniers compteurs (pas de clignotement)', async () => {
    vi.useFakeTimers();
    armCounters({ dlq: 3 });
    render(<EmailsTabs />);
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    expect(screen.getByText('3')).toBeInTheDocument();

    // Le refresh suivant échoue : la pastille « 3 » doit RESTER.
    server.use(http.get(API, () => HttpResponse.json({ error: 'x' }, { status: 500 })));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('F02-C-031 — aucun fetch synchrone au rendu : 1er appel post-effet uniquement', async () => {
    armCounters();
    vi.useFakeTimers();
    render(<EmailsTabs />);
    // Le rendu lui-même n'attend RIEN (les liens sont là sans réponse réseau).
    expect(screen.getAllByRole('link')).toHaveLength(9);
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    expect(apiCalls).toBe(1); // un seul, déclenché par l'effet
  });
});

/* ── F02-A — a11y ─────────────────────────────────────────────────────────── */
describe('EmailsTabs — a11y', () => {
  it('F02-A-001 — axe : 0 violation serious/critical sur la barre (avec badges)', async () => {
    const { expectNoAxeViolations } = await import('@/test/axe');
    armCounters({ dlq: 3, automationErrors: 2 });
    const { container } = render(<EmailsTabs />);
    await screen.findByText('3');
    await expectNoAxeViolations(container);
  });

  it('F02-A-003 — badge jamais couleur seule : nombre + sens dans le nom accessible', async () => {
    armCounters({ dlq: 3 });
    render(<EmailsTabs />);
    await screen.findByText('3');
    // Le NOM ACCESSIBLE de l'onglet inclut le compteur ET sa signification.
    expect(
      screen.getByRole('link', { name: /transactionnel.*3 message\(s\) en dlq/i }),
    ).toBeInTheDocument();
  });
});

/* ── F02-C — cycle de refresh ─────────────────────────────────────────────── */
describe('EmailsTabs — refresh 30 s', () => {
  it('F02-C-014 — onglet caché : pas d’appel pendant l’intervalle', async () => {
    vi.useFakeTimers();
    armCounters();
    render(<EmailsTabs />);
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    expect(apiCalls).toBe(1);

    act(() => setHidden(true));
    await act(async () => { await vi.advanceTimersByTimeAsync(90_000); });
    expect(apiCalls).toBe(1); // inchangé
  });

  it('F02-C-015 — retour premier plan : un appel immédiat', async () => {
    vi.useFakeTimers();
    armCounters();
    render(<EmailsTabs />);
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    act(() => setHidden(true));
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    const before = apiCalls;

    act(() => setHidden(false));
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    expect(apiCalls).toBe(before + 1);
  });
});
