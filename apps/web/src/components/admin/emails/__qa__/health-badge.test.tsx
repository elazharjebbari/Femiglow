/**
 * Module 01 — Dashboard santé : badge santé (F-002).
 *
 * Couche : composant (Testing Library, jsdom). ADAPTATION AU HARNAIS RÉEL :
 * le spec théorique postulait `<HealthBadge>` + `<HealthBadgeLive>` (fetch
 * /api/admin/emails/health). La réalité : `<HealthBadge level report infra />`
 * est présentationnel (extrait de page.tsx) — le niveau global et les checks
 * sont calculés côté serveur (`checkEmailingHealth` + `checkEmailingInfraHealth`,
 * worst-wins) et passés en props. On teste ici le RENDU à partir de rapports
 * forgés (affichage, sémantique couleur, déroulé, a11y, anti-faux-vert).
 *
 * Le CALCUL des niveaux (worst-wins, fraîcheur webhook, cron muet) est couvert
 * côté vraie-DB par `src/test/integration/emails-health-infra.integration.test.ts`
 * (HLT-INT-*). Ici on verrouille que CE QUI EST CALCULÉ est fidèlement AFFICHÉ.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HealthBadge } from '@/components/admin/emails/HealthBadge';
import type { HealthLevel, HealthReport } from '@/lib/admin/emails/health';
import type { InfraChecks } from '@/app/api/admin/emails/health/checks';

/** HealthReport déterministe, sain par défaut. */
function makeReport(over: Partial<HealthReport['checks']> = {}): HealthReport {
  return {
    level: 'ok',
    checks: {
      smtpConfigured: { ok: true },
      db: { ok: true },
      outboxStuck: { ok: true, stuckCount: 0 },
      dlq24h: { ok: true, count: 0 },
      pendingNow: 4,
      lastDeliveredAt: new Date('2026-06-04T11:50:00Z'),
      ...over,
    },
    timestamp: '2026-06-04T12:00:00Z',
  };
}

/** Fragment infra sain par défaut. */
function makeInfra(over: Partial<InfraChecks> = {}): InfraChecks {
  return {
    webhookSilent: { ok: true, sentLast7d: 1200, deliveredEventsLast7d: 1140 },
    cronOutboxLate: { ok: true, lateCount: 0, oldestEligibleAgeMs: null },
    sendingStuck: { ok: true, stuckCount: 0, oldestStuckAgeMs: null },
    ...over,
  };
}

describe('HealthBadge — rendu par niveau', () => {
  // DSH-MSW-030 — ok : 🟢 Système OK, classe emerald.
  it('DSH-MSW-030 : ok — 🟢 Système OK + classe emerald', () => {
    render(<HealthBadge level="ok" report={makeReport()} infra={makeInfra()} />);
    const summary = screen.getByText(/Système OK/);
    expect(summary).toBeInTheDocument();
    expect(summary.textContent).toContain('🟢');
    // L'enveloppe <details> porte la couleur emerald.
    expect(summary.closest('details')?.className).toMatch(/emerald/);
  });

  // DSH-MSW-031 — SMTP manquant : 🔴 incident + vars listées dans le détail.
  it('DSH-MSW-031 : SMTP non configuré → 🔴 Incident + SMTP_USER/SMTP_PASSWORD listés', () => {
    render(
      <HealthBadge
        level="incident"
        report={makeReport({ smtpConfigured: { ok: false, missing: ['SMTP_USER', 'SMTP_PASSWORD'] } })}
        infra={makeInfra()}
      />,
    );
    const summary = screen.getByText(/Incident/);
    expect(summary.textContent).toContain('🔴');
    expect(summary.closest('details')?.className).toMatch(/rose/);
    // Les variables manquantes sont nommées (détail + synthèse).
    expect(screen.getAllByText(/SMTP_USER/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/SMTP_PASSWORD/).length).toBeGreaterThan(0);
  });

  // DSH-MSW-032 — DB indispo : 🔴 incident + message DB.
  it('DSH-MSW-032 : DB indispo → 🔴 Incident + message DB', () => {
    render(
      <HealthBadge
        level="incident"
        report={makeReport({ db: { ok: false, error: 'connection refused' } })}
        infra={null}
      />,
    );
    expect(screen.getByText(/Incident/)).toBeInTheDocument();
    expect(screen.getByText(/DB indispo/i)).toBeInTheDocument();
    // L'erreur DB est nommée à la fois dans le détail (✗) et la synthèse (pied).
    expect(screen.getAllByText(/connection refused/).length).toBeGreaterThan(0);
  });

  // DSH-MSW-033 — outbox stuck : 🟡 dégradé + compte.
  it("DSH-MSW-033 : outbox stuck → 🟡 Dégradé + \"7 stuck en 'sending' > 5 min\"", () => {
    render(
      <HealthBadge
        level="degraded"
        report={makeReport({ outboxStuck: { ok: false, stuckCount: 7 } })}
        infra={makeInfra()}
      />,
    );
    const summary = screen.getByText(/Dégradé/);
    expect(summary.textContent).toContain('🟡');
    expect(summary.closest('details')?.className).toMatch(/amber/);
    expect(screen.getByText(/7 stuck en 'sending' > 5 min/)).toBeInTheDocument();
  });

  // DSH-MSW-034 — DLQ 24h dans [1..10] → 🟡 dégradé.
  it('DSH-MSW-034 : DLQ 24h = 6 → 🟡 Dégradé + "6 DLQ sur 24h"', () => {
    render(
      <HealthBadge
        level="degraded"
        report={makeReport({ dlq24h: { ok: false, count: 6 } })}
        infra={makeInfra()}
      />,
    );
    expect(screen.getByText(/Dégradé/)).toBeInTheDocument();
    expect(screen.getByText(/6 DLQ sur 24h/)).toBeInTheDocument();
  });

  // DSH-MSW-035 — DLQ 24h > 10 → 🔴 incident.
  it('DSH-MSW-035 : DLQ 24h = 38 → 🔴 Incident + "38 DLQ sur 24h"', () => {
    render(
      <HealthBadge
        level="incident"
        report={makeReport({ dlq24h: { ok: false, count: 38 } })}
        infra={makeInfra()}
      />,
    );
    expect(screen.getByText(/Incident/)).toBeInTheDocument();
    expect(screen.getByText(/38 DLQ sur 24h/)).toBeInTheDocument();
  });

  // DSH-MSW-036 — pending > 50 → 🟡 dégradé.
  it('DSH-MSW-036 : pending = 640 → "640 pending en attente"', () => {
    render(
      <HealthBadge level="degraded" report={makeReport({ pendingNow: 640 })} infra={makeInfra()} />,
    );
    expect(screen.getByText(/640 pending en attente/)).toBeInTheDocument();
  });

  // DSH-MSW-037 — worst-wins : le niveau affiché = celui calculé en amont. On
  // vérifie l'AFFICHAGE fidèle (incident) ET la concaténation des anomalies.
  it('DSH-MSW-037 : worst-wins — DLQ>10 + pending>50 → 🔴 Incident, synthèse concatène les 2', () => {
    render(
      <HealthBadge
        level="incident"
        report={makeReport({ dlq24h: { ok: false, count: 38 }, pendingNow: 640 })}
        infra={makeInfra()}
      />,
    );
    const summary = screen.getByText(/Incident/);
    expect(summary.textContent).toContain('🔴');
    // La phrase de synthèse (pied) concatène DLQ ET pending avec le séparateur ·.
    const synth = summary.closest('details')?.querySelector('p.font-medium');
    expect(synth?.textContent).toMatch(/38 DLQ sur 24h/);
    expect(synth?.textContent).toMatch(/640 pending en attente/);
    expect(synth?.textContent).toContain('·');
  });

  // DSH-MSW-044 — détail déroulable liste les checks (avec ✓/✗).
  it('DSH-MSW-044 : détail déroulé liste les checks (SMTP/DLQ/Dernier livré/Webhook)', async () => {
    render(<HealthBadge level="ok" report={makeReport()} infra={makeInfra()} />);
    await userEvent.click(screen.getByText(/Système OK/));
    expect(screen.getByText(/SMTP :/)).toBeInTheDocument();
    expect(screen.getByText(/DLQ 24h :/)).toBeInTheDocument();
    expect(screen.getByText(/Dernier livré :/)).toBeInTheDocument();
    // Le détail inclut bien les checks infra additionnels (chantier 1.2).
    expect(screen.getByText(/Webhook \(delivered 7j\)/)).toBeInTheDocument();
  });

  // DSH-MSW-045 — a11y : le badge est pilotable sans souris. Le déroulé repose
  // sur un <summary> NATIF (élément focusable et activable au clavier par le
  // navigateur) — on verrouille le contrat structurel a11y : le summary est un
  // vrai <summary>, focusable, premier enfant du <details> qu'il contrôle, et
  // son activation (qu'on déclenche ici via click, équivalent de Entrée/Espace
  // sur summary natif) ouvre le détail.
  // NB : jsdom n'implémente PAS le toggle clavier natif de <details> (limite
  // connue du DOM simulé) → on exerce l'activation par click plutôt que par
  // keydown, ce qui teste la même bascule `open` côté navigateur.
  it('DSH-MSW-045 : a11y — summary natif focusable contrôle un détail déroulable', async () => {
    render(<HealthBadge level="ok" report={makeReport()} infra={makeInfra()} />);
    const summary = screen.getByText(/Système OK/);
    expect(summary.tagName).toBe('SUMMARY');
    const details = summary.closest('details') as HTMLDetailsElement;
    expect(details.firstElementChild).toBe(summary);

    // Focusable au clavier (élément interactif natif).
    summary.focus();
    expect(summary).toHaveFocus();

    // Fermé au départ, ouvert après activation → le détail devient visible.
    expect(details.open).toBe(false);
    await userEvent.click(summary);
    expect(details.open).toBe(true);
    expect(screen.getByText(/Pending :/)).toBeVisible();
  });
});

describe('HealthBadge — anti-faux-vert (REGRESSION F-002 affichage)', () => {
  // DSH-MSW-038 — quand le niveau calculé est dégradé (ex. lastDeliveredAt=null /
  // webhook muet remonté par l'infra), le badge ne doit PAS afficher 🟢.
  it('DSH-MSW-038 : niveau dégradé → JAMAIS "Système OK" ni 🟢', () => {
    render(
      <HealthBadge
        level="degraded"
        report={makeReport({ lastDeliveredAt: null })}
        infra={makeInfra({ webhookSilent: { ok: false, sentLast7d: 4200, deliveredEventsLast7d: 0 } })}
      />,
    );
    expect(screen.queryByText(/Système OK/)).not.toBeInTheDocument();
    expect(screen.queryByText(/🟢/)).not.toBeInTheDocument();
    expect(screen.getByText(/Dégradé/)).toBeInTheDocument();
  });

  // DSH-MSW-043 — webhook Stalwart muet (0 event, envois>0) → l'anomalie est
  // nommée dans le détail ET la synthèse (incident affiché).
  it('DSH-MSW-043 : webhook muet 24h → détail "0 reçu pour N envoyés" + synthèse webhook muet', async () => {
    render(
      <HealthBadge
        level="incident"
        report={makeReport()}
        infra={makeInfra({ webhookSilent: { ok: false, sentLast7d: 4200, deliveredEventsLast7d: 0 } })}
      />,
    );
    const summary = screen.getByText(/Incident/);
    await userEvent.click(summary);
    expect(screen.getByText(/0 reçu pour 4200 envoyés/)).toBeInTheDocument();
    const synth = summary.closest('details')?.querySelector('p.font-medium');
    expect(synth?.textContent).toMatch(/webhook muet/);
  });

  // DSH-MSW-041 — cron outbox muet (lignes en file > 15 min) → synthèse nomme le
  // cron à l'arrêt (actionnable, pas juste "pending élevé").
  it("DSH-MSW-041 : cron outbox muet → synthèse \"en file > 15 min (cron outbox à l'arrêt ?)\"", () => {
    render(
      <HealthBadge
        level="incident"
        report={makeReport()}
        infra={makeInfra({ cronOutboxLate: { ok: false, lateCount: 120, oldestEligibleAgeMs: 40 * 60_000 } })}
      />,
    );
    const synth = screen.getByText(/Incident/).closest('details')?.querySelector('p.font-medium');
    expect(synth?.textContent).toMatch(/120 en file > 15 min/);
    expect(synth?.textContent).toMatch(/cron outbox à l'arrêt/);
  });
});
