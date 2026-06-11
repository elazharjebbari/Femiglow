/**
 * VAGUE 4 — UX-DASH-002 / UX-DASH-011 : badge santé actionnable + checks
 * deliveredFreshness/cronHeartbeat rendus dans le <ul>.
 *
 * Couche : composant présentationnel `<HealthBadge level report infra />`
 * (RTL, jsdom). On forge des rapports en panne et on verrouille :
 *  - chaque check ✗ rend une ligne <a> vers la population concernée (≤ 2 clics) ;
 *  - deliveredFreshness et cronHeartbeat (qui INFLUENCENT le niveau) apparaissent
 *    dans le détail avec ✓/✗ — la cause du rouge n'est plus invisible.
 *
 * Oracle imposé UX4-DASHBOARD-002.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HealthBadge } from '@/components/admin/emails/HealthBadge';
import type { HealthLevel, HealthReport } from '@/lib/admin/emails/health';
import type { InfraChecks } from '@/app/api/admin/emails/health/checks';

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
      deliveredFreshness: { ok: true, level: 'ok', ageMs: 10 * 60_000, recentSent: true },
      cronHeartbeat: { ok: true, lastTickAt: new Date('2026-06-04T11:59:00Z'), ageMs: 60_000, stale: false },
      ...over,
    },
    timestamp: '2026-06-04T12:00:00Z',
  };
}

function makeInfra(over: Partial<InfraChecks> = {}): InfraChecks {
  return {
    webhookSilent: { ok: true, sentLast7d: 1200, deliveredEventsLast7d: 1140 },
    cronOutboxLate: { ok: true, lateCount: 0, oldestEligibleAgeMs: null },
    sendingStuck: { ok: true, stuckCount: 0, oldestStuckAgeMs: null },
    ...over,
  };
}

/** Renvoie le <a> dont le href matche, dans le détail déroulé. */
function linkByHref(href: string): HTMLAnchorElement {
  const links = screen.getAllByRole('link') as HTMLAnchorElement[];
  const found = links.find((a) => a.getAttribute('href') === href);
  if (!found) throw new Error(`Aucun lien d'action avec href=${href}`);
  return found;
}

/** Renvoie le <li> (ligne de check) dont le texte matche, dans le <ul> du détail. */
function checkRow(re: RegExp): HTMLElement {
  const items = Array.from(document.querySelectorAll('details ul > li')) as HTMLElement[];
  const found = items.find((li) => re.test(li.textContent ?? ''));
  if (!found) throw new Error(`Aucune ligne de check matchant ${re}`);
  return found;
}

describe('UX4-DASHBOARD-002 — badge santé : lignes de check actionnables', () => {
  it('UX4-DASHBOARD-002a : DLQ 24h > 0 → lien vers ?status=dlq dans la ligne DLQ', () => {
    render(
      <HealthBadge level="degraded" report={makeReport({ dlq24h: { ok: false, count: 7 } })} infra={makeInfra()} />,
    );
    const link = linkByHref('/admin/emails/transactional?status=dlq');
    // Le lien est porté par la LIGNE DLQ (population concernée), pas ailleurs.
    expect(checkRow(/DLQ 24h/i).contains(link)).toBe(true);
  });

  it('UX4-DASHBOARD-002b : sending bloqué > 0 → lien vers ?status=sending', () => {
    render(
      <HealthBadge
        level="incident"
        report={makeReport()}
        infra={makeInfra({ sendingStuck: { ok: false, stuckCount: 3, oldestStuckAgeMs: 20 * 60_000 } })}
      />,
    );
    const link = linkByHref('/admin/emails/transactional?status=sending');
    expect(checkRow(/Sending bloqué/i).contains(link)).toBe(true);
  });

  it('UX4-DASHBOARD-002c : file outbox en retard → lien vers ?status=pending,failed', () => {
    render(
      <HealthBadge
        level="incident"
        report={makeReport()}
        infra={makeInfra({ cronOutboxLate: { ok: false, lateCount: 120, oldestEligibleAgeMs: 40 * 60_000 } })}
      />,
    );
    const link = linkByHref('/admin/emails/transactional?status=pending,failed');
    expect(checkRow(/File outbox/i).contains(link)).toBe(true);
  });

  it('UX4-DASHBOARD-002d : webhook muet → lien vers /admin/emails/events?source=email', () => {
    render(
      <HealthBadge
        level="incident"
        report={makeReport()}
        infra={makeInfra({ webhookSilent: { ok: false, sentLast7d: 4200, deliveredEventsLast7d: 0 } })}
      />,
    );
    const link = linkByHref('/admin/emails/events?source=email');
    expect(checkRow(/Webhook/i).contains(link)).toBe(true);
  });

  it('UX4-DASHBOARD-002e : check OK → la ligne N\'EST PAS un lien (anti-bruit)', () => {
    render(<HealthBadge level="ok" report={makeReport()} infra={makeInfra()} />);
    // Tout est sain → aucun lien d'action dans le détail (pas de population à corriger).
    // Les seuls liens éventuels seraient des actions ; il ne doit y en avoir aucun.
    const links = screen.queryAllByRole('link');
    expect(links).toHaveLength(0);
  });
});

describe('UX4-DASHBOARD-002 (suite) — deliveredFreshness & cronHeartbeat rendus dans le <ul>', () => {
  it('UX4-DASHBOARD-002f : cron de drain muet (stale) → ligne ✗ visible dans le détail', async () => {
    render(
      <HealthBadge
        level="incident"
        report={makeReport({
          cronHeartbeat: { ok: false, lastTickAt: new Date('2026-06-03T12:00:00Z'), ageMs: 24 * 3600_000, stale: true },
        })}
        infra={makeInfra()}
      />,
    );
    await userEvent.click(screen.getByText(/Incident/));
    const cronLine = checkRow(/Cron de drain/i);
    expect(cronLine.textContent).toMatch(/✗/);
  });

  it('UX4-DASHBOARD-002g : delivered périmé (incident) → ligne ✗ « Fraîcheur livraison » visible', async () => {
    render(
      <HealthBadge
        level="incident"
        report={makeReport({
          deliveredFreshness: { ok: false, level: 'incident', ageMs: null, recentSent: true },
        })}
        infra={makeInfra()}
      />,
    );
    await userEvent.click(screen.getByText(/Incident/));
    const freshLine = checkRow(/Fra(î|i)cheur livraison/i);
    expect(freshLine.textContent).toMatch(/✗/);
  });

  it('UX4-DASHBOARD-002h : delivered & cron sains → lignes ✓ présentes (visibilité symétrique)', async () => {
    render(<HealthBadge level="ok" report={makeReport()} infra={makeInfra()} />);
    await userEvent.click(screen.getByText(/Système OK/));
    expect(checkRow(/Fra(î|i)cheur livraison/i).textContent).toMatch(/✓/);
    expect(checkRow(/Cron de drain/i).textContent).toMatch(/✓/);
  });

  it('UX4-DASHBOARD-002i : sans deliveredFreshness/cronHeartbeat (report legacy) → pas de crash', () => {
    // Contrat ascendant : les champs sont OPTIONNELS dans le type. Un report sans
    // eux ne doit pas casser le rendu (les anciens consommateurs/tests).
    const legacy = makeReport();
    delete legacy.checks.deliveredFreshness;
    delete legacy.checks.cronHeartbeat;
    render(<HealthBadge level="ok" report={legacy} infra={makeInfra()} />);
    expect(screen.getByText(/Système OK/)).toBeInTheDocument();
  });
});
