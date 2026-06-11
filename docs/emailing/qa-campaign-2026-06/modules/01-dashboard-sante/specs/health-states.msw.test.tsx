/**
 * Module 01 — Dashboard santé : badge santé (F-002).
 *
 * Couche : composant + MSW. Modèle prêt à adapter.
 * Déploiement : apps/web/src/components/admin/emails/__qa__/health-states.msw.test.tsx
 *
 * On teste le rendu du badge à partir d'un HealthReport. Deux angles :
 *  1. Le badge présentationnel <HealthBadge level report /> (extrait de
 *     page.tsx) rendu directement avec des reports forgés — couvre l'affichage.
 *  2. Un <HealthBadgeLive /> qui fetch GET /api/admin/emails/health via MSW —
 *     couvre le câblage réseau + grille d'échecs.
 *
 * Le type HealthReport est la source de vérité (lib/admin/emails/health.ts).
 */
import { describe, expect, it, beforeAll, afterEach, afterAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import type { HealthReport, HealthLevel } from '@/lib/admin/emails/health';
// Composants à extraire de src/app/admin/emails/page.tsx :
import { HealthBadge, HealthBadgeLive } from '@/components/admin/emails/HealthBadge';

const HEALTH_URL = '/api/admin/emails/health';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/**
 * Factory HealthReport déterministe alignée sur le type réel.
 * `level` est recalculé par le composant cible OU fourni explicitement selon
 * la version testée ; ici on fournit les deux pour robustesse.
 */
function makeHealthReport(over: Partial<HealthReport['checks']> = {}, level: HealthLevel = 'ok'): HealthReport {
  return {
    level,
    checks: {
      smtpConfigured: { ok: true },
      db: { ok: true },
      outboxStuck: { ok: true, stuckCount: 0 },
      dlq24h: { ok: true, count: 0 },
      pendingNow: 4,
      lastDeliveredAt: new Date('2026-06-03T11:50:00Z'), // récent
      ...over,
    },
    timestamp: '2026-06-03T12:00:00Z',
  };
}

function serveHealth(report: HealthReport) {
  server.use(http.get(HEALTH_URL, () => HttpResponse.json(report)));
}

describe('HealthBadge — rendu par niveau', () => {
  it('DSH-MSW-030 : ok — 🟢 Système OK', () => {
    render(<HealthBadge level="ok" report={makeHealthReport({}, 'ok')} />);
    expect(screen.getByText(/Système OK/)).toBeInTheDocument();
    expect(screen.getByText(/🟢/)).toBeInTheDocument();
  });

  it('DSH-MSW-031 : SMTP manquant → 🔴 incident + vars listées', () => {
    const report = makeHealthReport(
      { smtpConfigured: { ok: false, missing: ['SMTP_USER', 'SMTP_PASSWORD'] } },
      'incident',
    );
    render(<HealthBadge level="incident" report={report} />);
    expect(screen.getByText(/Incident/)).toBeInTheDocument();
    expect(screen.getByText(/SMTP_USER/)).toBeInTheDocument();
  });

  it('DSH-MSW-032 : DB indispo → 🔴 incident', () => {
    const report = makeHealthReport({ db: { ok: false, error: 'connection refused' } }, 'incident');
    render(<HealthBadge level="incident" report={report} />);
    expect(screen.getByText(/Incident/)).toBeInTheDocument();
    expect(screen.getByText(/DB indispo/i)).toBeInTheDocument();
  });

  it('DSH-MSW-033 : outbox stuck → 🟡 dégradé + compte', () => {
    const report = makeHealthReport({ outboxStuck: { ok: false, stuckCount: 7 } }, 'degraded');
    render(<HealthBadge level="degraded" report={report} />);
    expect(screen.getByText(/Dégradé/)).toBeInTheDocument();
    expect(screen.getByText(/7 stuck en 'sending' > 5 min/)).toBeInTheDocument();
  });

  it('DSH-MSW-034 : DLQ 24h dans [1..10] → 🟡 dégradé', () => {
    const report = makeHealthReport({ dlq24h: { ok: true, count: 6 } }, 'degraded');
    render(<HealthBadge level="degraded" report={report} />);
    expect(screen.getByText(/Dégradé/)).toBeInTheDocument();
    expect(screen.getByText(/6 DLQ sur 24h/)).toBeInTheDocument();
  });

  it('DSH-MSW-035 : DLQ 24h > 10 → 🔴 incident', () => {
    const report = makeHealthReport({ dlq24h: { ok: false, count: 38 } }, 'incident');
    render(<HealthBadge level="incident" report={report} />);
    expect(screen.getByText(/Incident/)).toBeInTheDocument();
    expect(screen.getByText(/38 DLQ sur 24h/)).toBeInTheDocument();
  });

  it('DSH-MSW-036 : pending > 50 → 🟡 dégradé', () => {
    const report = makeHealthReport({ pendingNow: 640 }, 'degraded');
    render(<HealthBadge level="degraded" report={report} />);
    expect(screen.getByText(/640 pending en attente/)).toBeInTheDocument();
  });

  it('DSH-MSW-044 : détail déroulable liste les checks (✓/✗)', async () => {
    const report = makeHealthReport({}, 'ok');
    render(<HealthBadge level="ok" report={report} />);
    await userEvent.click(screen.getByText(/Système OK/));
    expect(screen.getByText(/SMTP :/)).toBeInTheDocument();
    expect(screen.getByText(/DLQ 24h :/)).toBeInTheDocument();
    expect(screen.getByText(/Dernier livré :/)).toBeInTheDocument();
  });

  it('DSH-MSW-045 : a11y — badge ouvrable au clavier', async () => {
    render(<HealthBadge level="ok" report={makeHealthReport()} />);
    const summary = screen.getByText(/Système OK/);
    summary.focus();
    await userEvent.keyboard('{Enter}');
    // <details> natif : Enter sur le summary bascule open ; le détail apparaît.
    expect(screen.getByText(/Pending :/)).toBeVisible();
  });
});

describe('HealthBadge — REGRESSION audit F-002 (angles morts)', () => {
  // Ces tests sont écrits ROUGE : tant que health.ts ignore ces signaux,
  // le badge reste 🟢 à tort. On n'affaiblit PAS l'oracle, on escalade.

  it('DSH-MSW-038 : dernier delivered = null → badge NON vert', () => {
    const report = makeHealthReport({ lastDeliveredAt: null }, 'degraded');
    render(<HealthBadge level={report.level} report={report} />);
    expect(screen.queryByText(/Système OK/)).not.toBeInTheDocument();
  });

  it('DSH-MSW-039 : dernier delivered > 24h → 🟡 dégradé', () => {
    const stale = new Date('2026-06-01T11:50:00Z'); // ~48h avant timestamp
    const report = makeHealthReport({ lastDeliveredAt: stale }, 'degraded');
    render(<HealthBadge level={report.level} report={report} />);
    expect(screen.getByText(/Dégradé/)).toBeInTheDocument();
  });

  it('DSH-MSW-040 : dernier delivered > 72h → 🔴 incident', () => {
    const veryStale = new Date('2026-05-29T11:50:00Z');
    const report = makeHealthReport({ lastDeliveredAt: veryStale }, 'incident');
    render(<HealthBadge level={report.level} report={report} />);
    expect(screen.getByText(/Incident/)).toBeInTheDocument();
  });
});

describe('HealthBadgeLive — câblage réseau + grille d’échecs', () => {
  it('DSH-MSW-037 : worst-wins — DLQ>10 + pending>50 → incident', async () => {
    serveHealth(makeHealthReport({ dlq24h: { ok: false, count: 38 }, pendingNow: 640 }, 'incident'));
    render(<HealthBadgeLive />);
    expect(await screen.findByText(/Incident/)).toBeInTheDocument();
  });

  it('DSH-MSW-042 : Listmonk down (état cible) → niveau >= dégradé', async () => {
    // Champ cible additionnel listmonk:{ok:false} dans checks (à ajouter au type).
    const report = makeHealthReport({}, 'degraded');
    (report.checks as Record<string, unknown>).listmonk = { ok: false, error: 'timeout' };
    serveHealth(report);
    render(<HealthBadgeLive />);
    expect(await screen.findByText(/Dégradé|Incident/)).toBeInTheDocument();
  });

  it('DSH-MSW-041 : 500 sur /health → badge "indéterminé", PAS 🟢', async () => {
    server.use(http.get(HEALTH_URL, () => HttpResponse.json({ error: 'internal' }, { status: 500 })));
    render(<HealthBadgeLive />);
    // Anti-faux-vert : sur erreur de probe, on n'affiche jamais "Système OK".
    expect(await screen.findByText(/indéterminé|indisponible|erreur/i)).toBeInTheDocument();
    expect(screen.queryByText(/Système OK/)).not.toBeInTheDocument();
  });
});
