/**
 * F03 — HealthBadge : deep-links CONTEXTUALISÉS + contraste du pied
 * (batterie F03-C-029..035 ; complète health-badge-actions.ux4 qui verrouille
 * le « quelle ligne porte quel lien »).
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HealthBadge } from '@/components/admin/emails/HealthBadge';
import type { HealthReport } from '@/lib/admin/emails/health';
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
      cronHeartbeat: {
        ok: true,
        lastTickAt: new Date('2026-06-04T11:59:00Z'),
        ageMs: 60_000,
        stale: false,
      },
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

const allHrefs = () =>
  (screen.queryAllByRole('link') as HTMLAnchorElement[]).map((a) => a.getAttribute('href') ?? '');

describe('F03 — HealthBadge', () => {
  it('F03-C-029 — chaque check est rendu déplié (les 11 lignes)', () => {
    render(<HealthBadge level="ok" report={makeReport()} infra={makeInfra()} />);
    for (const re of [
      /SMTP/i,
      /^DB/i,
      /Outbox stuck/i,
      /DLQ 24h/i,
      /Pending/i,
      /Dernier livré/i,
      /Fra(î|i)cheur livraison/i,
      /Cron de drain/i,
      /Webhook/i,
      /File outbox/i,
      /Sending bloqué/i,
    ]) {
      const items = Array.from(document.querySelectorAll('details ul > li'));
      expect(
        items.some((li) => re.test(li.textContent ?? '')),
        `ligne manquante : ${re}`,
      ).toBe(true);
    }
  });

  it('F03-C-030 — check DLQ ✗ → lien ?status=dlq AVEC from=health&check=dlq24h', () => {
    render(
      <HealthBadge
        level="degraded"
        report={makeReport({ dlq24h: { ok: false, count: 3 } })}
        infra={makeInfra()}
      />,
    );
    const href = allHrefs().find((h) => h.includes('status=dlq'));
    expect(href).toBeDefined();
    expect(href).toContain('from=health&check=dlq24h');
  });

  it('F03-C-031 — TOUT lien du badge porte from=health (jamais de lien nu)', () => {
    render(
      <HealthBadge
        level="incident"
        report={makeReport({ dlq24h: { ok: false, count: 3 } })}
        infra={makeInfra({
          webhookSilent: { ok: false, sentLast7d: 42, deliveredEventsLast7d: 0 },
          sendingStuck: { ok: false, stuckCount: 2, oldestStuckAgeMs: 20 * 60_000 },
          cronOutboxLate: { ok: false, lateCount: 5, oldestEligibleAgeMs: 30 * 60_000 },
        })}
      />,
    );
    const hrefs = allHrefs();
    expect(hrefs.length).toBeGreaterThanOrEqual(4);
    for (const h of hrefs) expect(h).toContain('from=health');
  });

  it('F03-C-032 — la fenêtre courante est propagée (&window=30d)', () => {
    render(
      <HealthBadge
        level="degraded"
        report={makeReport({ dlq24h: { ok: false, count: 3 } })}
        infra={makeInfra()}
        window="30d"
      />,
    );
    expect(allHrefs().find((h) => h.includes('status=dlq'))).toContain('window=30d');
  });

  it('F03-C-033 — webhook muet → lien vers events?source=email contextualisé', () => {
    render(
      <HealthBadge
        level="incident"
        report={makeReport()}
        infra={makeInfra({ webhookSilent: { ok: false, sentLast7d: 42, deliveredEventsLast7d: 0 } })}
      />,
    );
    const href = allHrefs().find((h) => h.startsWith('/admin/emails/events?source=email'));
    expect(href).toBeDefined();
    expect(href).toContain('check=webhookSilent');
  });

  it('F03-C-034 — pied de synthèse en *-800 (contraste DASH-11)', () => {
    render(
      <HealthBadge
        level="incident"
        report={makeReport({ dlq24h: { ok: false, count: 3 } })}
        infra={makeInfra()}
      />,
    );
    const foot = document.querySelector('details > p');
    expect(foot?.className).toContain('text-rose-800');
  });

  it('F03-C-035 — check ✓ : aucune ligne de lien (anti-bruit)', () => {
    render(<HealthBadge level="ok" report={makeReport()} infra={makeInfra()} />);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });
});
