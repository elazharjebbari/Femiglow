/**
 * Module 01 — Dashboard santé : cartes KPI (F-001), ADAPTÉ F03 (P2.1).
 *
 * Le composant `<KpiCards>` est désormais FENÊTRÉ (props kpi OutboxKpiWindow +
 * window + webhookLastSuccessAt/comparison/sparkline du summary). Les
 * intentions historiques (DSH-MSW-*) sont PRÉSERVÉES, deux oracles amendés
 * par le tri-état F03 (supersédés consignés) :
 *  - DSH-MSW-010 : état vide → carte Livrés affiche '— / non suivi'
 *    (E3 untracked) — l'ancien '0' neutre était l'ambiguïté DASH-02 ;
 *  - DSH-MSW-018 : l'alerte rose exige un webhook DÉJÀ armé (E2) — un système
 *    jamais branché ne hurle plus (TRV-04).
 */
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { OutboxKpiWindow } from '@/lib/admin/emails/queries';
import { KpiCards, type KpiCardsProps } from '@/components/admin/emails/KpiCards';

function makeKpi(over: Partial<OutboxKpiWindow> = {}): OutboxKpiWindow {
  return {
    total: 1234,
    sent: 1200,
    delivered: 1140,
    failed: 6,
    dlq: 0,
    pendingNow: 4,
    ...over,
  };
}

/** Rend les cartes avec un webhook ARMÉ par défaut (comportement historique). */
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

/** Normalise les espaces (insécables fr-FR inclus) pour comparer les nombres. */
function digits(s: string | null | undefined): string {
  return (s ?? '').replace(/[\s  ]/g, '');
}

describe('Dashboard KPIs — états & sémantique (fenêtré F03)', () => {
  // DSH-MSW-011 — état nominal : les 6 cartes présentes avec leurs libellés.
  it('DSH-MSW-011 : état nominal — 6 cartes peuplées avec valeurs distinctes', () => {
    renderCards();
    for (const label of ['Envoyés (7 j)', 'Livrés', 'Échecs', 'DLQ', 'En attente', 'Total tentatives']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(digits(screen.getByTestId('kpi-card-sent').textContent)).toContain('1200');
    expect(digits(screen.getByTestId('kpi-card-delivered').textContent)).toContain('1140');
    expect(within(screen.getByTestId('kpi-card-failed')).getByText('6')).toBeInTheDocument();
    expect(within(screen.getByTestId('kpi-card-dlq')).getByText('0')).toBeInTheDocument();
    expect(within(screen.getByTestId('kpi-card-pending')).getByText('4')).toBeInTheDocument();
  });

  // DSH-MSW-010 (amendé F03/E3) — état vide : Livrés '— / non suivi', jamais NaN.
  it("DSH-MSW-010 : état vide — Livrés affiche '— / non suivi' (untracked), pas NaN/0.0 %", () => {
    renderCards(
      { total: 0, sent: 0, delivered: 0, failed: 0, dlq: 0, pendingNow: 0 },
      { webhookLastSuccessAt: null },
    );
    const livres = screen.getByTestId('kpi-card-delivered');
    // La VALEUR est '—' (cibler .text-2xl : le trend affiche aussi '—').
    expect(livres.querySelector('.text-2xl')?.textContent).toBe('—');
    expect(livres).toHaveTextContent('non suivi');
    expect(livres).not.toHaveTextContent('NaN');
    expect(livres).not.toHaveTextContent('0.0 %');
    // Aucune bannière d'anomalie quand il n'y a tout simplement aucun envoi.
    expect(screen.queryByTestId('delivery-silent-banner')).not.toBeInTheDocument();
  });

  // DSH-MSW-012 — Échecs > 0 → ton ambre sur la valeur.
  it('DSH-MSW-012 : Échecs > 0 → ton ambre', () => {
    renderCards({ failed: 12 });
    const card = screen.getByTestId('kpi-card-failed');
    expect(card.querySelector('.text-amber-700')?.textContent).toBe('12');
  });

  // DSH-MSW-013 — DLQ > 0 → ton rose.
  it('DSH-MSW-013 : DLQ > 0 → ton rose', () => {
    renderCards({ dlq: 5 });
    expect(screen.getByTestId('kpi-card-dlq').querySelector('.text-rose-700')?.textContent).toBe('5');
  });

  // DSH-MSW-014 — En attente > 50 → ton ambre (seuil cron). 51 déclenche.
  it('DSH-MSW-014 : En attente = 51 → ton ambre (seuil 50)', () => {
    renderCards({ pendingNow: 51 });
    expect(
      screen.getByTestId('kpi-card-pending').querySelector('.text-amber-700')?.textContent,
    ).toBe('51');
  });

  it('DSH-MSW-014b : En attente = 50 reste neutre (borne stricte)', () => {
    renderCards({ pendingNow: 50 });
    expect(screen.getByTestId('kpi-card-pending').querySelector('.text-amber-700')).toBeNull();
  });

  // DSH-MSW-015 — sous-libellé Livrés = pourcentage des envoyés.
  it("DSH-MSW-015 : sous-libellé Livrés = '95.0 % des envoyés' (1140/1200)", () => {
    renderCards({ sent: 1200, delivered: 1140 });
    expect(
      within(screen.getByTestId('kpi-card-delivered')).getByText(/95\.0 % des envoyés/),
    ).toBeInTheDocument();
  });

  // DSH-MSW-016 — gros volume formaté fr-FR (séparateur de milliers).
  it('DSH-MSW-016 : gros volume (50 000 envoyés) formaté fr-FR', () => {
    renderCards({ sent: 50000, total: 50000 });
    const card = screen.getByTestId('kpi-card-sent');
    expect(card.textContent).not.toContain('50000');
    expect(digits(card.textContent)).toContain('50000');
  });

  // DSH-MSW-018 (amendé F03/E2) — webhook armé + 0 livré → alerte rose nommée.
  it('DSH-MSW-018 : REGRESSION F-001 — Livrés=0 & Envoyés=4200 (webhook armé) → alerte rose « webhook muet »', () => {
    renderCards({ sent: 4200, delivered: 0, total: 4200 });
    const card = screen.getByTestId('kpi-card-delivered');
    expect(card.querySelector('.text-rose-700')?.textContent).toBe('0');
    expect(card).toHaveTextContent(/webhook muet depuis/i);
  });

  // DSH-MSW-019 — bannière "delivery silencieux" distincte du simple 0.
  it('DSH-MSW-019 : bannière « livraison silencieuse » quand envoyés>0 & livrés=0', () => {
    renderCards({ sent: 4200, delivered: 0, total: 4200 });
    const banner = screen.getByTestId('delivery-silent-banner');
    expect(banner).toHaveAttribute('role', 'alert');
    expect(banner).toHaveTextContent(/webhook/i);
    expect(digits(banner.textContent)).toContain('4200');
  });

  it('DSH-MSW-019b : aucune bannière quand au moins une livraison est confirmée', () => {
    renderCards({ sent: 4200, delivered: 1 });
    expect(screen.queryByTestId('delivery-silent-banner')).not.toBeInTheDocument();
    expect(screen.getByTestId('kpi-card-delivered').querySelector('.text-rose-700')).toBeNull();
  });

  // DSH-MSW-022 — i18n fr : les 6 libellés sont en français, aucune chaîne EN.
  it('DSH-MSW-022 : i18n fr — 6 libellés français, aucune chaîne anglaise résiduelle', () => {
    renderCards();
    for (const label of ['Envoyés (7 j)', 'Livrés', 'Échecs', 'DLQ', 'En attente', 'Total tentatives']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.queryByText(/^Sent$|^Delivered$|^Failed$|^Pending$/)).not.toBeInTheDocument();
  });
});
