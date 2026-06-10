/**
 * F03 — cartes KPI fenêtrées : batterie F03-C-006..013 (tri-état + bandeau),
 * F03-C-022..028 (drill-down fenêtré + tendances + sparkline),
 * F03-C-040..041 (carte En attente).
 *
 * Composant présentationnel pur — pas de réseau ; la grille réseau du
 * dashboard vit dans dashboard-auto-refresh.f03.test.tsx (la sonde client).
 */
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { OutboxKpiWindow } from '@/lib/admin/emails/queries';
import { KpiCards, type KpiCardsProps } from '@/components/admin/emails/KpiCards';

function makeKpi(over: Partial<OutboxKpiWindow> = {}): OutboxKpiWindow {
  return { total: 100, sent: 42, delivered: 38, failed: 3, dlq: 2, pendingNow: 12, ...over };
}

function renderCards(
  kpiOver: Partial<OutboxKpiWindow> = {},
  props: Partial<Omit<KpiCardsProps, 'kpi'>> = {},
) {
  return render(
    <KpiCards
      kpi={makeKpi(kpiOver)}
      window={props.window ?? '7d'}
      webhookLastSuccessAt={
        props.webhookLastSuccessAt !== undefined
          ? props.webhookLastSuccessAt
          : '2026-06-01T10:00:00.000Z'
      }
      comparison={props.comparison}
      sparkline={props.sparkline}
      generatedAt={props.generatedAt ?? new Date().toISOString()}
    />,
  );
}

const card = (id: string) => screen.getByTestId(id);
const anchor = (id: string) => card(id).closest('a');

describe('F03 — carte Livrés (tri-état en situation)', () => {
  it('F03-C-006 — E1 tracked : fmt(delivered) + « % des envoyés »', () => {
    renderCards({ sent: 42, delivered: 38 });
    const c = card('kpi-card-delivered');
    expect(within(c).getByText('38')).toBeInTheDocument();
    expect(c).toHaveTextContent('90.5 % des envoyés');
    expect(c.querySelector('.text-rose-700')).toBeNull();
  });

  it('F03-C-007 — E2 silent : « 0 » + webhook muet + lien diagnostiquer, ton rose', () => {
    renderCards({ sent: 42, delivered: 0 });
    const c = card('kpi-card-delivered');
    expect(c.querySelector('.text-rose-700')?.textContent).toBe('0');
    expect(c).toHaveTextContent(/webhook muet depuis/);
    expect(screen.getByRole('link', { name: /diagnostiquer/i })).toBeInTheDocument();
  });

  it("F03-C-008 — E3 untracked : « — / non suivi », PAS de rose, PAS d'alerte", () => {
    renderCards({ sent: 0, delivered: 0, total: 0 }, { webhookLastSuccessAt: null });
    const c = card('kpi-card-delivered');
    // La VALEUR est '—' (le trend affiche aussi '—' sans comparison → cibler .text-2xl).
    expect(c.querySelector('.text-2xl')?.textContent).toBe('—');
    expect(c).toHaveTextContent('non suivi');
    expect(c.querySelector('.text-rose-700')).toBeNull();
    expect(screen.queryByTestId('delivery-silent-banner')).not.toBeInTheDocument();
  });

  it('F03-C-009 — le lien diagnostiquer porte from=health&check=deliveredFreshness + fenêtre', () => {
    renderCards({ sent: 42, delivered: 0 }, { window: '24h' });
    const link = screen.getByRole('link', { name: /diagnostiquer/i });
    const href = link.getAttribute('href') ?? '';
    expect(href).toContain('from=health&check=deliveredFreshness');
    expect(href).toContain('window=24h');
  });
});

describe('F03 — bandeau livraison silencieuse fenêtré', () => {
  it('F03-C-010 — bandeau role=alert présent en E2, libellé « sur 7 j »', () => {
    renderCards({ sent: 42, delivered: 0 });
    const banner = screen.getByTestId('delivery-silent-banner');
    expect(banner).toHaveAttribute('role', 'alert');
    expect(banner).toHaveTextContent(/sur 7 j mais aucune livraison/);
  });

  it('F03-C-011 — bandeau ABSENT si delivered > 0', () => {
    renderCards({ sent: 42, delivered: 38 });
    expect(screen.queryByTestId('delivery-silent-banner')).not.toBeInTheDocument();
  });

  it('F03-C-012 — le libellé de fenêtre suit le sélecteur (« sur 24 h »)', () => {
    renderCards({ sent: 42, delivered: 0 }, { window: '24h' });
    expect(screen.getByTestId('delivery-silent-banner')).toHaveTextContent(/sur 24 h/);
  });

  it('F03-C-013 — fenêtre 30 j AVEC livraisons → aucun bandeau', () => {
    renderCards({ sent: 900, delivered: 850 }, { window: '30d' });
    expect(screen.queryByTestId('delivery-silent-banner')).not.toBeInTheDocument();
  });
});

describe('F03 — drill-down fenêtré + tendances + sparkline', () => {
  it('F03-C-022 — carte Échecs → ?status=failed,bounced_soft,bounced_permanent&window=courant', () => {
    renderCards({}, { window: '30d' });
    expect(anchor('kpi-card-failed')).toHaveAttribute(
      'href',
      '/admin/emails/transactional?status=failed,bounced_soft,bounced_permanent&window=30d',
    );
  });

  it('F03-C-023 — carte DLQ → ?status=dlq&window propagé', () => {
    renderCards({}, { window: '24h' });
    expect(anchor('kpi-card-dlq')).toHaveAttribute(
      'href',
      '/admin/emails/transactional?status=dlq&window=24h',
    );
  });

  it('F03-C-024 — carte Total inerte (aucun lien)', () => {
    renderCards();
    expect(anchor('kpi-card-total')).toBeNull();
  });

  it("F03-C-025 — aria-label chiffré « Voir les 3 échecs »", () => {
    renderCards({ failed: 3 });
    expect(anchor('kpi-card-failed')?.getAttribute('aria-label')).toBe('Voir les 3 échecs');
  });

  it('F03-C-026 — tendance « +12% vs 7 j préc. » ton emerald sur Livrés', () => {
    renderCards({}, { comparison: { deliveredPct: 12, failedPct: 0 } });
    const trend = within(card('kpi-card-delivered')).getByTestId('kpi-trend');
    expect(trend).toHaveTextContent('+12% vs 7 j préc.');
    expect(trend.className).toContain('text-emerald-700');
  });

  it("F03-C-026b — POLARITÉ : +50% d'échecs est ROSE (jamais de vert mécanique)", () => {
    renderCards({}, { comparison: { deliveredPct: 0, failedPct: 50 } });
    const trend = within(card('kpi-card-failed')).getByTestId('kpi-trend');
    expect(trend).toHaveTextContent('+50% vs 7 j préc.');
    expect(trend.className).toContain('text-rose-700');
  });

  it("F03-C-027 — comparison absent → tendance '—', jamais NaN%", () => {
    renderCards({}, { comparison: undefined });
    const trend = within(card('kpi-card-delivered')).getByTestId('kpi-trend');
    expect(trend).toHaveTextContent('—');
    expect(card('kpi-card-delivered').textContent).not.toContain('NaN');
  });

  it('F03-C-028 — sparkline 12 points rendue, aria-hidden (décorative)', () => {
    renderCards(
      {},
      { sparkline: Array.from({ length: 12 }, (_, i) => ({ delivered: i, failed: 0 })) },
    );
    const sparks = screen.getAllByTestId('kpi-sparkline');
    expect(sparks.length).toBeGreaterThanOrEqual(1);
    for (const s of sparks) expect(s).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('F03 — carte En attente', () => {
  it("F03-C-040 — sous-texte « relevé il y a Xs · drain 60 s »", () => {
    renderCards({ pendingNow: 12 }, { generatedAt: new Date(Date.now() - 5_000).toISOString() });
    expect(card('kpi-card-pending')).toHaveTextContent(/relevé il y a \d+ s · drain 60 s/);
  });

  it('F03-C-041 — pending=342 → ton ambre', () => {
    renderCards({ pendingNow: 342 });
    expect(card('kpi-card-pending').querySelector('.text-amber-700')?.textContent).toBe('342');
  });
});
