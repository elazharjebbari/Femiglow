/**
 * Module 01 — Dashboard santé : KPIs (F-001).
 *
 * Couche : composant + MSW (couche reine). Modèle prêt à adapter.
 *
 * NB déploiement : copier sous
 *   apps/web/src/components/admin/emails/__qa__/dashboard-kpis.msw.test.tsx
 * pour bénéficier de l'alias `@/` et du setup vitest du repo.
 *
 * La page `/admin/emails/page.tsx` est un Server Component qui lit la DB
 * directement (getOutboxKpi). On ne peut pas la rendre telle quelle en
 * jsdom ; on teste donc :
 *  - les fonctions pures de formatage (extraites/réimplémentées identiques),
 *  - un <KpiBoard> présentationnel (à extraire de page.tsx) nourri par MSW
 *    via une route /api/admin/emails/kpi (état cible : la lecture KPI passe
 *    par une route fetchable, ce qui la rend testable côté composant).
 *
 * Tant que l'extraction n'est pas faite, ces tests servent de SPÉCIFICATION
 * exécutable : ils référencent les sélecteurs/labels réels de page.tsx.
 */
import { describe, expect, it, beforeAll, afterEach, afterAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { server } from '@/test/msw/server';
import { failWith } from '@/test/msw/handlers/emails';
import { http, HttpResponse } from 'msw';

// Composant cible à extraire de src/app/admin/emails/page.tsx (section KPI).
// Signature attendue : <KpiBoard /> fetch GET /api/admin/emails/kpi.
import { KpiBoard } from '@/components/admin/emails/KpiBoard';

const KPI_URL = '/api/admin/emails/kpi';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Factory KPI alignée sur OutboxKpi (lib/admin/emails/queries.ts). */
function makeKpi(over: Partial<Record<string, number>> = {}) {
  return {
    totalLast7d: 1234,
    sentLast7d: 1200,
    deliveredLast7d: 1140,
    failedLast7d: 6,
    dlqLast7d: 0,
    pendingNow: 4,
    ...over,
  };
}

function useKpi(kpi: ReturnType<typeof makeKpi>) {
  server.use(http.get(KPI_URL, () => HttpResponse.json(kpi)));
}

describe('Dashboard KPIs — états & sémantique', () => {
  it('DSH-MSW-011 : état nominal — 6 cartes peuplées', async () => {
    useKpi(makeKpi());
    render(<KpiBoard />);
    expect(await screen.findByText('Envoyés (7j)')).toBeInTheDocument();
    expect(screen.getByText('Livrés')).toBeInTheDocument();
    expect(screen.getByText('Échecs')).toBeInTheDocument();
    expect(screen.getByText('DLQ')).toBeInTheDocument();
    expect(screen.getByText('En attente')).toBeInTheDocument();
    expect(screen.getByText('Total tentatives')).toBeInTheDocument();
  });

  it('DSH-MSW-010 : état vide — Livrés affiche le tiret, pas 0.0 %', async () => {
    useKpi(makeKpi({ totalLast7d: 0, sentLast7d: 0, deliveredLast7d: 0, pendingNow: 0 }));
    render(<KpiBoard />);
    // Oracle anti-division-par-zéro : sous-libellé Livrés === '—' (pas 'NaN %').
    const livres = await screen.findByTestId('kpi-card-delivered');
    expect(livres).toHaveTextContent('—');
    expect(livres).not.toHaveTextContent('NaN');
  });

  it('DSH-MSW-012 : Échecs > 0 → ton ambre', async () => {
    useKpi(makeKpi({ failedLast7d: 12 }));
    render(<KpiBoard />);
    const card = await screen.findByTestId('kpi-card-failed');
    expect(card.querySelector('.text-amber-700')).not.toBeNull();
  });

  it('DSH-MSW-013 : DLQ > 0 → ton rose', async () => {
    useKpi(makeKpi({ dlqLast7d: 5 }));
    render(<KpiBoard />);
    const card = await screen.findByTestId('kpi-card-dlq');
    expect(card.querySelector('.text-rose-700')).not.toBeNull();
  });

  it('DSH-MSW-014 : En attente > 50 → ton ambre (seuil cron 60s)', async () => {
    useKpi(makeKpi({ pendingNow: 51 }));
    render(<KpiBoard />);
    const card = await screen.findByTestId('kpi-card-pending');
    expect(card.querySelector('.text-amber-700')).not.toBeNull();
  });

  it('DSH-MSW-015 : sous-libellé Livrés = pourcentage des envoyés', async () => {
    useKpi(makeKpi({ sentLast7d: 1200, deliveredLast7d: 1140 }));
    render(<KpiBoard />);
    // 1140/1200 = 95.0 %
    expect(await screen.findByText(/95\.0 % des envoyés/)).toBeInTheDocument();
  });

  it('DSH-MSW-016 : gros volume formaté fr-FR (séparateur de milliers)', async () => {
    useKpi(makeKpi({ sentLast7d: 50000, totalLast7d: 50000 }));
    render(<KpiBoard />);
    const card = await screen.findByTestId('kpi-card-sent');
    // fr-FR : 50 000 (espace insécable U+202F/U+00A0). On matche les deux blocs.
    expect(card.textContent?.replace(/[  \s]/g, '')).toContain('50000');
  });

  // ── REGRESSION F-001 : webhook delivery silencieux ────────────────────

  it('DSH-MSW-018 : REGRESSION — Livrés=0 alors qu’Envoyés=4200 → carte en alerte', async () => {
    useKpi(makeKpi({ sentLast7d: 4200, deliveredLast7d: 0, totalLast7d: 4200 }));
    render(<KpiBoard />);
    const card = await screen.findByTestId('kpi-card-delivered');
    // Oracle cible : la carte Livrés passe en alerte (ton rose), pas neutre.
    expect(card.querySelector('.text-rose-700')).not.toBeNull();
  });

  it('DSH-MSW-019 : REGRESSION — bannière "delivery silencieux" quand envoyés>0 & livrés=0', async () => {
    useKpi(makeKpi({ sentLast7d: 4200, deliveredLast7d: 0, totalLast7d: 4200 }));
    render(<KpiBoard />);
    // Anomalie nommée, distincte d'un simple '0'.
    expect(await screen.findByText(/webhook|delivery silencieux|aucune livraison/i)).toBeInTheDocument();
  });

  // ── Grille d'échecs réseau sur la lecture KPI ─────────────────────────

  it('DSH-MSW-020 : 500 → message d’erreur, AUCUNE carte fantôme à 0', async () => {
    server.use(failWith.serverError(KPI_URL)); // failWith pose un POST ; ici on force le GET :
    server.use(http.get(KPI_URL, () => HttpResponse.json({ error: 'internal' }, { status: 500 })));
    render(<KpiBoard />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    // Oracle anti-"faux 0" : on ne doit pas afficher des cartes à 0 trompeuses.
    expect(screen.queryByTestId('kpi-card-delivered')).not.toBeInTheDocument();
  });

  it('DSH-MSW-021 : hang → état chargement visible (pas de 0 prématuré)', async () => {
    server.use(http.get(KPI_URL, async () => { await new Promise(() => {}); return HttpResponse.json({}); }));
    render(<KpiBoard />);
    expect(await screen.findByTestId('kpi-board-skeleton')).toBeInTheDocument();
  });

  it('DSH-MSW-022 : i18n fr — les 6 libellés sont en français', async () => {
    useKpi(makeKpi());
    render(<KpiBoard />);
    for (const label of ['Envoyés (7j)', 'Livrés', 'Échecs', 'DLQ', 'En attente', 'Total tentatives']) {
      expect(await screen.findByText(label)).toBeInTheDocument();
    }
    // Aucune chaîne anglaise résiduelle parasite.
    expect(screen.queryByText(/Sent|Delivered|Failed|Pending/)).not.toBeInTheDocument();
  });
});
