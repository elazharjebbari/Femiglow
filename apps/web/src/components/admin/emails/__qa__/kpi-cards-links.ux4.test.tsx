/**
 * VAGUE 4 — UX-DASH-001 / UX-DASH-006 : cartes KPI cliquables (drill-down) +
 * lien contextuel events depuis la bannière « livraison silencieuse ».
 *
 * Couche : composant présentationnel `<KpiCards kpi=… />` (RTL, jsdom). Aucune
 * route réseau — purement structurel (href / aria-label / role).
 *
 * Oracle imposé UX4-DASHBOARD-001 :
 *  - carte « Échecs » → <a href="/admin/emails/transactional?status=failed,bounced_soft,bounced_permanent">
 *  - carte « DLQ »    → ?status=dlq
 *  - carte « En attente » → ?status=pending
 *  - carte « Total tentatives » → PAS un lien
 *  - aria-label chiffré présent sur chaque carte liée.
 */
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { OutboxKpi } from '@/lib/admin/emails/queries';
import { KpiCards } from '@/components/admin/emails/KpiCards';

function makeKpi(over: Partial<OutboxKpi> = {}): OutboxKpi {
  return {
    totalLast7d: 1234,
    sentLast7d: 1200,
    deliveredLast7d: 1140,
    failedLast7d: 42,
    dlqLast7d: 7,
    pendingNow: 120,
    ...over,
  };
}

/** Récupère l'élément <a> qui ENVELOPPE une carte (ou null). */
function cardAnchor(testId: string): HTMLAnchorElement | null {
  return screen.getByTestId(testId).closest('a');
}

describe('UX4-DASHBOARD-001 — cartes KPI deep-linkables vers le cockpit filtré', () => {
  it('UX4-DASHBOARD-001a : « Échecs » est un lien vers ?status=failed,bounced_soft,bounced_permanent', () => {
    render(<KpiCards kpi={makeKpi()} />);
    const a = cardAnchor('kpi-card-failed');
    expect(a).not.toBeNull();
    expect(a).toHaveAttribute(
      'href',
      '/admin/emails/transactional?status=failed,bounced_soft,bounced_permanent',
    );
  });

  it('UX4-DASHBOARD-001b : « DLQ » → ?status=dlq', () => {
    render(<KpiCards kpi={makeKpi()} />);
    expect(cardAnchor('kpi-card-dlq')).toHaveAttribute(
      'href',
      '/admin/emails/transactional?status=dlq',
    );
  });

  it('UX4-DASHBOARD-001c : « En attente » → ?status=pending', () => {
    render(<KpiCards kpi={makeKpi()} />);
    expect(cardAnchor('kpi-card-pending')).toHaveAttribute(
      'href',
      '/admin/emails/transactional?status=pending',
    );
  });

  it('UX4-DASHBOARD-001d : « Envoyés » et « Livrés » → ?status=sent,delivered', () => {
    render(<KpiCards kpi={makeKpi()} />);
    expect(cardAnchor('kpi-card-sent')).toHaveAttribute(
      'href',
      '/admin/emails/transactional?status=sent,delivered',
    );
    expect(cardAnchor('kpi-card-delivered')).toHaveAttribute(
      'href',
      '/admin/emails/transactional?status=sent,delivered',
    );
  });

  it('UX4-DASHBOARD-001e : la carte « Total tentatives » N\'EST PAS un lien (neutre)', () => {
    render(<KpiCards kpi={makeKpi()} />);
    expect(cardAnchor('kpi-card-total')).toBeNull();
  });

  it('UX4-DASHBOARD-001f : aria-label chiffré explicite sur les cartes liées', () => {
    render(<KpiCards kpi={makeKpi({ failedLast7d: 42, dlqLast7d: 7, pendingNow: 120 })} />);
    // « Voir les 42 échecs » (aria-label porté par le lien).
    const failed = cardAnchor('kpi-card-failed');
    expect(failed?.getAttribute('aria-label') ?? '').toMatch(/42/);
    expect(failed?.getAttribute('aria-label') ?? '').toMatch(/échec/i);
    expect(cardAnchor('kpi-card-dlq')?.getAttribute('aria-label') ?? '').toMatch(/7/);
    expect(cardAnchor('kpi-card-pending')?.getAttribute('aria-label') ?? '').toMatch(/120/);
  });

  it('UX4-DASHBOARD-001g : le lien reste accessible même à 0 (un opérateur peut explorer)', () => {
    render(<KpiCards kpi={makeKpi({ failedLast7d: 0 })} />);
    // À 0, la carte reste cliquable (cohérence drill-down), aria-label « 0 échec ».
    const a = cardAnchor('kpi-card-failed');
    expect(a).not.toBeNull();
    expect(a?.getAttribute('aria-label') ?? '').toMatch(/0/);
  });
});

describe('UX4-DASHBOARD-006 — lien contextuel events depuis la bannière silencieuse', () => {
  it('UX4-DASHBOARD-006a : la bannière « livraison silencieuse » offre un lien vers events?source=email', () => {
    render(<KpiCards kpi={makeKpi({ sentLast7d: 4200, deliveredLast7d: 0, totalLast7d: 4200 })} />);
    const banner = screen.getByTestId('delivery-silent-banner');
    const link = within(banner).getByRole('link', { name: /event/i });
    expect(link).toHaveAttribute('href', '/admin/emails/events?source=email');
  });

  it('UX4-DASHBOARD-006b : aucun lien events dans la bannière quand il n\'y a pas d\'anomalie', () => {
    render(<KpiCards kpi={makeKpi({ sentLast7d: 1200, deliveredLast7d: 1140 })} />);
    expect(screen.queryByTestId('delivery-silent-banner')).not.toBeInTheDocument();
  });
});
