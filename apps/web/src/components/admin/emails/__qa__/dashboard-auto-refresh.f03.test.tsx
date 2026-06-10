// @vitest-environment jsdom
/**
 * F03 — auto-refresh du dashboard : batteries F03-C-014..021 (orchestration
 * timers/visibilité, fake timers stricts) et F03-N-001..006 (grille réseau de
 * la SONDE summary — 200/401/500/hang/network — via le bouton manuel, même
 * chemin de code `probeAndRefresh` que le tick 60 s).
 *
 * Doctrine timers : fake timers + fetch stubbé + fireEvent (les `userEvent`/
 * `findBy*` PENDENT sous fake timers purs — gotcha P1.1). La grille réseau
 * tourne en timers RÉELS + MSW (chaque réponse parse le contrat réel).
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { server, http, HttpResponse, delay } from '@/test/msw/server';
import { makeSummary } from '@/test/msw/emails-handlers';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
}));

import {
  DashboardAutoRefresh,
  REFRESH_INTERVAL_MS,
} from '@/components/admin/emails/DashboardAutoRefresh';

const SUMMARY_ROUTE = '/api/admin/emails/transactional/summary';
const GENERATED_AT = '2026-06-10T10:00:00.000Z';

/** Pose document.hidden (configurable) et notifie le composant. */
function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
  vi.useRealTimers();
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
});
afterAll(() => server.close());

/* ── Orchestration (fake timers + fetch stub : MSW n'est pas sollicité) ───── */

function stubFetchOk(): ReturnType<typeof vi.fn> {
  const stub = vi.fn(async () => ({ ok: true, status: 200 }) as Response);
  vi.stubGlobal('fetch', stub);
  return stub;
}

function renderAuto(generatedAt = GENERATED_AT) {
  return render(<DashboardAutoRefresh generatedAt={generatedAt} window="7d" />);
}

describe('F03 — orchestration auto-refresh (fake timers)', () => {
  it('F03-C-014 — exactement 1 refresh à T+60 s, 0 avant', async () => {
    vi.useFakeTimers();
    const fetchStub = stubFetchOk();
    renderAuto();

    await act(() => vi.advanceTimersByTimeAsync(REFRESH_INTERVAL_MS - 1_000));
    expect(fetchStub).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();

    await act(() => vi.advanceTimersByTimeAsync(1_000));
    expect(fetchStub).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('F03-C-015 — onglet caché : AUCUN refresh même après 180 s', async () => {
    vi.useFakeTimers();
    const fetchStub = stubFetchOk();
    renderAuto();
    setHidden(true);

    await act(() => vi.advanceTimersByTimeAsync(180_000));
    expect(fetchStub).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('F03-C-016 — retour au premier plan → 1 refresh immédiat', async () => {
    vi.useFakeTimers();
    const fetchStub = stubFetchOk();
    renderAuto();
    setHidden(true);
    await act(() => vi.advanceTimersByTimeAsync(125_000));
    expect(fetchStub).not.toHaveBeenCalled();

    await act(async () => {
      setHidden(false);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetchStub).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it("F03-C-017 — l'âge COURT onglet caché : après 247 s, « 247 s »", async () => {
    vi.useFakeTimers();
    stubFetchOk();
    renderAuto();
    setHidden(true);
    await act(() => vi.advanceTimersByTimeAsync(247_000));
    expect(screen.getByTestId('dashboard-age')).toHaveTextContent(/247 s/);
    vi.unstubAllGlobals();
  });

  it("F03-C-018 — l'âge revient à 0 s quand de NOUVELLES données arrivent (generatedAt change)", async () => {
    vi.useFakeTimers();
    stubFetchOk();
    const { rerender } = renderAuto();
    await act(() => vi.advanceTimersByTimeAsync(45_000));
    expect(screen.getByTestId('dashboard-age')).toHaveTextContent(/45 s/);

    // Le refresh RSC livre un nouveau generatedAt → reset honnête.
    rerender(<DashboardAutoRefresh generatedAt="2026-06-10T10:01:00.000Z" window="7d" />);
    expect(screen.getByTestId('dashboard-age')).toHaveTextContent(/0 s/);
    vi.unstubAllGlobals();
  });

  it('F03-C-019 — démontage : plus AUCUN timer résiduel', async () => {
    vi.useFakeTimers();
    const fetchStub = stubFetchOk();
    const { unmount } = renderAuto();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    await act(() => vi.advanceTimersByTimeAsync(10 * REFRESH_INTERVAL_MS));
    expect(fetchStub).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('F03-C-020 — bouton manuel : 1 refresh, anti double-clic pendant le vol', async () => {
    vi.useFakeTimers();
    // fetch qui ne répond qu'après 5 s : le 2e clic pendant le vol est ignoré.
    const fetchStub = vi.fn(
      () =>
        new Promise<Response>((resolve) =>
          setTimeout(() => resolve({ ok: true, status: 200 } as Response), 5_000),
        ),
    );
    vi.stubGlobal('fetch', fetchStub);
    renderAuto();

    const btn = screen.getByRole('button', { name: /rafraîchir/i });
    fireEvent.click(btn);
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(btn).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(btn); // double-clic pendant le vol
    await act(() => vi.advanceTimersByTimeAsync(5_000));
    expect(fetchStub).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(btn).toHaveAttribute('aria-busy', 'false');
    vi.unstubAllGlobals();
  });

  it('F03-C-021 — la timezone est nommée : « (Casablanca) »', () => {
    vi.useFakeTimers();
    stubFetchOk();
    renderAuto();
    expect(screen.getByTestId('dashboard-age')).toHaveTextContent(/\(Casablanca\)/);
    vi.unstubAllGlobals();
  });
});

/* ── Grille réseau de la sonde (timers réels + MSW) ───────────────────────── */

describe('F03 — grille réseau de la sonde summary (N-001..006)', () => {
  // Le libellé alterne « Rafraîchir » / « Rafraîchissement… » → préfixe commun.
  const clickRefresh = () =>
    fireEvent.click(screen.getByRole('button', { name: /rafraîch/i }));

  it('F03-N-001 — 200 nominal : router.refresh émis, AUCUN bandeau', async () => {
    server.use(http.get(SUMMARY_ROUTE, () => HttpResponse.json(makeSummary({ window: '7d' }))));
    renderAuto();
    clickRefresh();
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('refresh-degraded-banner')).not.toBeInTheDocument();
  });

  it('F03-N-002 — 401 : bandeau session expirée, PAS de refresh (pas de faux succès)', async () => {
    server.use(http.get(SUMMARY_ROUTE, () => HttpResponse.json({ error: 'auth' }, { status: 401 })));
    renderAuto();
    clickRefresh();
    const banner = await screen.findByTestId('refresh-degraded-banner');
    expect(banner).toHaveTextContent(/session expirée/i);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('F03-N-003 — 500 : bandeau « données figées à HH:MM », données précédentes intactes', async () => {
    server.use(http.get(SUMMARY_ROUTE, () => HttpResponse.json({ error: 'x' }, { status: 500 })));
    renderAuto();
    clickRefresh();
    const banner = await screen.findByTestId('refresh-degraded-banner');
    // 10:00 UTC = 11:00 Casablanca (generatedAt du rendu serveur conservé).
    expect(banner).toHaveTextContent(/rafraîchissement impossible — données figées à 11:00/i);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('F03-N-004 — hang : bouton occupé, AUCUN double fetch', async () => {
    let hits = 0;
    server.use(
      http.get(SUMMARY_ROUTE, async () => {
        hits += 1;
        await delay('infinite');
        return HttpResponse.json(makeSummary());
      }),
    );
    renderAuto();
    clickRefresh();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /rafraîch/i })).toHaveAttribute(
        'aria-busy',
        'true',
      ),
    );
    clickRefresh(); // pendant le vol
    clickRefresh();
    expect(hits).toBe(1);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('F03-N-005 — panne réseau : bandeau figé, jamais de faux « à jour »', async () => {
    server.use(http.get(SUMMARY_ROUTE, () => HttpResponse.error()));
    renderAuto();
    clickRefresh();
    const banner = await screen.findByTestId('refresh-degraded-banner');
    expect(banner).toHaveTextContent(/données figées à 11:00/i);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("F03-N-006 — un refresh raté ne remet PAS l'âge à zéro", async () => {
    server.use(http.get(SUMMARY_ROUTE, () => HttpResponse.json({ error: 'x' }, { status: 500 })));
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 500 }) as Response),
    );
    renderAuto();
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(screen.getByTestId('dashboard-age')).toHaveTextContent(/30 s/);

    fireEvent.click(screen.getByRole('button', { name: /rafraîch/i }));
    await act(() => vi.advanceTimersByTimeAsync(0));
    // L'âge n'a PAS été réinitialisé (les données n'ont pas changé).
    expect(screen.getByTestId('dashboard-age')).toHaveTextContent(/il y a 30 s/);
    expect(screen.getByTestId('dashboard-age')).not.toHaveTextContent(/il y a 0 s/);
    vi.unstubAllGlobals();
  });
});
