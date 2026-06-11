/**
 * Module 01 — Dashboard santé : cartes KPI (F-001).
 *
 * Couche : composant (Testing Library, jsdom). ADAPTATION AU HARNAIS RÉEL :
 * le spec théorique postulait un `<KpiBoard>` qui fetch `/api/admin/emails/kpi`
 * via MSW. La réalité du code (`page.tsx`) est un Server Component qui lit la DB
 * directement (`getOutboxKpi()`) puis passe l'objet `OutboxKpi` à un composant
 * présentationnel. Il N'EXISTE PAS de route `/api/admin/emails/kpi`, donc pas de
 * fetch côté client → pas d'états loading/erreur réseau dans cette surface.
 *
 * On teste donc le vrai composant présentationnel `<KpiCards kpi=… />` (extrait
 * de page.tsx) nourri par des `OutboxKpi` forgés. L'exactitude des CHIFFRES
 * (fenêtre 7j, bornes) est couverte côté vraie-DB dans
 * `src/lib/admin/emails/__qa__/dashboard-kpi.db.test.ts` (DSH-DB-*).
 *
 * Les états réseau (500/hang) du spec — DSH-MSW-020/021 — ne s'appliquent pas à
 * la surface réelle (aucun fetch client) ; consignés dans matrixSkipped.
 */
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { OutboxKpi } from '@/lib/admin/emails/queries';
import { KpiCards } from '@/components/admin/emails/KpiCards';

/** Factory KPI déterministe alignée sur le type `OutboxKpi`. */
function makeKpi(over: Partial<OutboxKpi> = {}): OutboxKpi {
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

/** Normalise les espaces (insécables fr-FR inclus) pour comparer les nombres. */
function digits(s: string | null | undefined): string {
  return (s ?? '').replace(/[\s  ]/g, '');
}

describe('Dashboard KPIs — états & sémantique', () => {
  // DSH-MSW-011 — état nominal : les 6 cartes présentes avec leurs libellés.
  it('DSH-MSW-011 : état nominal — 6 cartes peuplées avec valeurs distinctes', () => {
    render(<KpiCards kpi={makeKpi()} />);
    for (const label of ['Envoyés (7j)', 'Livrés', 'Échecs', 'DLQ', 'En attente', 'Total tentatives']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    // Valeurs ancrées dans la BONNE carte (pas n'importe où dans la page).
    expect(digits(screen.getByTestId('kpi-card-sent').textContent)).toContain('1200');
    expect(digits(screen.getByTestId('kpi-card-delivered').textContent)).toContain('1140');
    expect(within(screen.getByTestId('kpi-card-failed')).getByText('6')).toBeInTheDocument();
    expect(within(screen.getByTestId('kpi-card-dlq')).getByText('0')).toBeInTheDocument();
    expect(within(screen.getByTestId('kpi-card-pending')).getByText('4')).toBeInTheDocument();
  });

  // DSH-MSW-010 — état vide : tout à 0 ; Livrés affiche '—', pas '0.0 %'.
  it("DSH-MSW-010 : état vide — cartes à 0, sous-libellé Livrés = '—' (pas NaN/0.0 %)", () => {
    render(
      <KpiCards
        kpi={makeKpi({
          totalLast7d: 0,
          sentLast7d: 0,
          deliveredLast7d: 0,
          failedLast7d: 0,
          dlqLast7d: 0,
          pendingNow: 0,
        })}
      />,
    );
    const livres = screen.getByTestId('kpi-card-delivered');
    expect(livres).toHaveTextContent('—');
    expect(livres).not.toHaveTextContent('NaN');
    expect(livres).not.toHaveTextContent('0.0 %');
    // Aucune bannière d'anomalie quand il n'y a tout simplement aucun envoi.
    expect(screen.queryByTestId('delivery-silent-banner')).not.toBeInTheDocument();
    // La valeur Livrés reste un vrai '0' (zéro est une donnée).
    expect(within(livres).getByText('0')).toBeInTheDocument();
  });

  // DSH-MSW-012 — Échecs > 0 → ton ambre sur la valeur.
  it('DSH-MSW-012 : Échecs > 0 → ton ambre', () => {
    render(<KpiCards kpi={makeKpi({ failedLast7d: 12 })} />);
    const card = screen.getByTestId('kpi-card-failed');
    expect(card.querySelector('.text-amber-700')).not.toBeNull();
    // L'ambre est bien porté par la VALEUR (12), pas par le libellé.
    expect(card.querySelector('.text-amber-700')?.textContent).toBe('12');
  });

  // DSH-MSW-013 — DLQ > 0 → ton rose.
  it('DSH-MSW-013 : DLQ > 0 → ton rose', () => {
    render(<KpiCards kpi={makeKpi({ dlqLast7d: 5 })} />);
    const card = screen.getByTestId('kpi-card-dlq');
    expect(card.querySelector('.text-rose-700')?.textContent).toBe('5');
  });

  // DSH-MSW-014 — En attente > 50 → ton ambre (seuil cron). 51 déclenche.
  it('DSH-MSW-014 : En attente = 51 → ton ambre (seuil 50)', () => {
    render(<KpiCards kpi={makeKpi({ pendingNow: 51 })} />);
    const card = screen.getByTestId('kpi-card-pending');
    expect(card.querySelector('.text-amber-700')?.textContent).toBe('51');
  });

  // DSH-MSW-014b — En attente = 50 reste neutre (borne stricte, anti-faux-positif).
  it('DSH-MSW-014b : En attente = 50 reste neutre (borne stricte)', () => {
    render(<KpiCards kpi={makeKpi({ pendingNow: 50 })} />);
    const card = screen.getByTestId('kpi-card-pending');
    expect(card.querySelector('.text-amber-700')).toBeNull();
  });

  // DSH-MSW-015 — sous-libellé Livrés = pourcentage des envoyés.
  it("DSH-MSW-015 : sous-libellé Livrés = '95.0 % des envoyés' (1140/1200)", () => {
    render(<KpiCards kpi={makeKpi({ sentLast7d: 1200, deliveredLast7d: 1140 })} />);
    const card = screen.getByTestId('kpi-card-delivered');
    expect(within(card).getByText(/95\.0 % des envoyés/)).toBeInTheDocument();
  });

  // DSH-MSW-016 — gros volume formaté fr-FR (séparateur de milliers).
  it('DSH-MSW-016 : gros volume (50 000 envoyés) formaté fr-FR', () => {
    render(<KpiCards kpi={makeKpi({ sentLast7d: 50000, totalLast7d: 50000 })} />);
    const card = screen.getByTestId('kpi-card-sent');
    // La valeur ne doit PAS être '50000' collé : un séparateur est présent.
    expect(card.textContent).not.toContain('50000');
    expect(digits(card.textContent)).toContain('50000');
  });

  // DSH-MSW-018 — REGRESSION F-001 : Livrés=0 alors qu'Envoyés=4200 → alerte rose.
  it('DSH-MSW-018 : REGRESSION F-001 — Livrés=0 & Envoyés=4200 → carte Livrés en alerte (rose)', () => {
    render(<KpiCards kpi={makeKpi({ sentLast7d: 4200, deliveredLast7d: 0, totalLast7d: 4200 })} />);
    const card = screen.getByTestId('kpi-card-delivered');
    // Oracle anti-régression : la valeur Livrés (0) passe en rose, PAS neutre.
    expect(card.querySelector('.text-rose-700')?.textContent).toBe('0');
    // Le sous-libellé nomme l'anomalie au lieu d'un '0.0 % des envoyés' trompeur.
    expect(card).toHaveTextContent(/webhook/i);
  });

  // DSH-MSW-019 — REGRESSION F-001 : bannière "delivery silencieux" distincte du simple 0.
  it('DSH-MSW-019 : REGRESSION F-001 — bannière "livraison silencieuse" quand envoyés>0 & livrés=0', () => {
    render(<KpiCards kpi={makeKpi({ sentLast7d: 4200, deliveredLast7d: 0, totalLast7d: 4200 })} />);
    const banner = screen.getByTestId('delivery-silent-banner');
    expect(banner).toBeInTheDocument();
    // C'est une vraie alerte sémantique, pas un texte décoratif.
    expect(banner).toHaveAttribute('role', 'alert');
    expect(banner).toHaveTextContent(/webhook/i);
    // Le volume concerné est nommé (4 200), pas juste « 0 ».
    expect(digits(banner.textContent)).toContain('4200');
  });

  // DSH-MSW-019b — anti-faux-positif : avec ≥1 livraison, AUCUNE bannière.
  it('DSH-MSW-019b : aucune bannière quand au moins une livraison est confirmée', () => {
    render(<KpiCards kpi={makeKpi({ sentLast7d: 4200, deliveredLast7d: 1 })} />);
    expect(screen.queryByTestId('delivery-silent-banner')).not.toBeInTheDocument();
    expect(screen.getByTestId('kpi-card-delivered').querySelector('.text-rose-700')).toBeNull();
  });

  // DSH-MSW-022 — i18n fr : les 6 libellés sont en français, aucune chaîne EN.
  it('DSH-MSW-022 : i18n fr — 6 libellés français, aucune chaîne anglaise résiduelle', () => {
    render(<KpiCards kpi={makeKpi()} />);
    for (const label of ['Envoyés (7j)', 'Livrés', 'Échecs', 'DLQ', 'En attente', 'Total tentatives']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.queryByText(/^Sent$|^Delivered$|^Failed$|^Pending$/)).not.toBeInTheDocument();
  });
});
