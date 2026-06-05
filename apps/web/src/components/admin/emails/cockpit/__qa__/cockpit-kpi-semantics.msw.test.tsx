/**
 * Module 02 — Cockpit : sémantique des KPI (F-015, défaut P1).
 *
 * Bugs d'audit corrigés dans KpiHeader.tsx :
 *  - Couleur de tendance INVERSÉE : `Trend` rendait tout pct>0 en emerald → une
 *    HAUSSE d'échecs s'affichait en vert ↑ (faux signal rassurant). Cible : pour
 *    Échecs/Hard bounces, pct>0 = ROUGE (mauvais), pct<0 = VERT (bon).
 *  - Sparkline « En file » TROMPEUSE : la carte queued recevait la série
 *    delivered. Le DTO summary n'expose aucune série queued → on n'affiche plus
 *    de sparkline sur cette carte (au lieu d'une courbe mensongère).
 *
 * Tests directs sur KpiHeader (la comparison n'existe que pour window 24h+, donc
 * on injecte directement le DTO) + tests d'intégration via TransactionalCockpit
 * pour l'alerte et le mapping de clic.
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
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server, http, HttpResponse } from '@/test/msw/server';
import { makeSearchRow, makeSummary } from '@/test/msw/emails-handlers';
import { KpiHeader, type SummaryDto } from '@/components/admin/emails/cockpit/KpiHeader';

const push = vi.fn();
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => new URLSearchParams(''),
}));

import { TransactionalCockpit } from '@/components/admin/emails/cockpit/TransactionalCockpit';

const SEARCH = '/api/admin/emails/transactional/search';
const SUMMARY = '/api/admin/emails/transactional/summary';

function dto(over: Partial<SummaryDto> = {}): SummaryDto {
  return {
    window: '24h',
    delivered: 1000,
    queued: 12,
    failed: 30,
    hardBounced: 2,
    sparkline: Array.from({ length: 12 }, (_, i) => ({ delivered: 100 - i, failed: i })),
    comparison: { deliveredPct: 10, failedPct: 40 },
    ...over,
  };
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => server.use(http.get(SUMMARY, () => HttpResponse.json(makeSummary()))));
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});
afterAll(() => server.close());

// ── Couleur de tendance (cartes directes) ─────────────────────────────────────

describe('KpiHeader — sémantique de couleur des tendances (F-015)', () => {
  // CKP-MSW-060 : hausse d'échecs (failedPct>0) → ROUGE, pas emerald.
  it('CKP-MSW-060 : failedPct=+40 → tendance ROUGE sur la carte Échecs (régression)', () => {
    render(<KpiHeader data={dto({ comparison: { deliveredPct: 10, failedPct: 40 } })} />);
    const failed = screen.getByTestId('kpi-failed');
    const trend = within(failed).getByLabelText(/increase/i);
    // Oracle : la HAUSSE d'échecs est rouge (mauvais signal), jamais emerald.
    expect(trend.className).toMatch(/red/);
    expect(trend.className).not.toMatch(/emerald/);
    expect(trend).toHaveAttribute('data-trend', 'bad');
    expect(trend).toHaveTextContent('↑ 40%');
  });

  // CKP-MSW-061 : baisse d'échecs (failedPct<0) → VERT.
  it('CKP-MSW-061 : failedPct=-20 → tendance VERTE sur la carte Échecs', () => {
    render(<KpiHeader data={dto({ comparison: { deliveredPct: 10, failedPct: -20 } })} />);
    const failed = screen.getByTestId('kpi-failed');
    const trend = within(failed).getByLabelText(/decrease/i);
    // Oracle : la BAISSE d'échecs est bonne → vert.
    expect(trend.className).toMatch(/emerald/);
    expect(trend).toHaveAttribute('data-trend', 'good');
    expect(trend).toHaveTextContent('↓ 20%');
  });

  // Symétrie : la carte Délivrés garde la polarité normale (hausse = vert).
  it('CKP-KPI-DELIVERED-POLARITY : hausse de delivered (pct>0) reste VERTE', () => {
    render(<KpiHeader data={dto({ comparison: { deliveredPct: 15, failedPct: 0 } })} />);
    const delivered = screen.getByTestId('kpi-delivered');
    const trend = within(delivered).getByLabelText(/increase/i);
    expect(trend.className).toMatch(/emerald/);
    expect(trend).toHaveAttribute('data-trend', 'good');
  });

  // CKP-MSW-062 : la carte « En file » n'affiche PAS la sparkline delivered.
  it('CKP-MSW-062 : carte « En file » sans sparkline delivered trompeuse', () => {
    render(<KpiHeader data={dto()} />);
    const queued = screen.getByTestId('kpi-queued');
    const delivered = screen.getByTestId('kpi-delivered');
    // Oracle : delivered a une sparkline ; queued n'en a aucune (série inexistante).
    expect(within(delivered).queryByRole('img')).not.toBeNull();
    expect(within(queued).queryByRole('img')).toBeNull();
  });
});

// ── Alerte + mapping de clic (via le cockpit, MSW summary) ─────────────────────

describe('Cockpit — alerte KPI + mapping de clic (F-015)', () => {
  function cockpitWithSummary(summary: ReturnType<typeof makeSummary>) {
    server.use(
      http.post(SEARCH, () =>
        HttpResponse.json({ rows: [makeSearchRow({ id: 'r0' })], total: 1, window: 'matched' }),
      ),
      http.get(SUMMARY, () => HttpResponse.json(summary)),
    );
  }

  // CKP-MSW-063 : failed >= seuil → mode alerte (badge attention sur la carte).
  it('CKP-MSW-063 : failed au-dessus du seuil → carte Échecs en alerte', async () => {
    cockpitWithSummary(makeSummary({ failed: 50, hardBounced: 0 }));
    render(<TransactionalCockpit initialViews={[]} />);
    const failed = await screen.findByTestId('kpi-failed');
    // Oracle : badge « attention » visible (seuil défaut 5).
    expect(failed).toHaveTextContent(/attention/i);
  });

  // CKP-MSW-064 : hardBounced > 0 → alerte sur la carte Hard bounces.
  it('CKP-MSW-064 : hardBounced>0 → carte Hard bounces en alerte', async () => {
    cockpitWithSummary(makeSummary({ failed: 0, hardBounced: 3 }));
    render(<TransactionalCockpit initialViews={[]} />);
    const hard = await screen.findByTestId('kpi-hard-bounced');
    expect(hard).toHaveTextContent(/attention/i);
  });

  // CKP-MSW-066 : erreur summary → bannière + Réessayer câblé.
  it('CKP-MSW-066 : summary 500 → bannière d’erreur + bouton Réessayer', async () => {
    let summaryCalls = 0;
    server.use(
      http.post(SEARCH, () =>
        HttpResponse.json({ rows: [makeSearchRow({ id: 'r0' })], total: 1, window: 'matched' }),
      ),
      http.get(SUMMARY, () => {
        summaryCalls += 1;
        return HttpResponse.json({ ok: false, error: 'boom' }, { status: 500 });
      }),
    );
    const user = userEvent.setup();
    render(<TransactionalCockpit initialViews={[]} />);
    // La bannière d'erreur KPI (role=alert) mentionne l'échec de chargement.
    const alert = await screen.findByText(/impossible de charger les kpi/i);
    expect(alert).toBeInTheDocument();
    // Réessayer relance un GET summary (oracle : nouvel appel observé).
    const before = summaryCalls;
    await user.click(within(alert.closest('[role="alert"]')!).getByRole('button', { name: /réessayer/i }));
    await waitFor(() => expect(summaryCalls).toBeGreaterThan(before));
  });
});
