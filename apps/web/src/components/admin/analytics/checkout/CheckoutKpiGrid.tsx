/**
 * CheckoutKpiGrid — 4 cards KPI globaux pour l'onglet Checkout.
 * cf. docs/analytics/05-onglets-specs.md §5.2
 *
 * 1. Vues panier (sessions distinct view_cart)
 * 2. Begin checkout (sessions distinct begin_checkout)
 * 3. Achats (sessions distinct purchase, client + serveur) — le champ data
 *    historique reste `submissions` ; le libellé opérateur dit « Achats » pour
 *    lever l'ambiguïté avec une soumission de formulaire. cf. finding F-CHK-02.
 * 4. Abandons (begin_checkout sans achat, fenêtre 60 min écoulée)
 *
 * Le sous-total `serverFallbackPurchases` est affiché en discret sous Achats
 * pour la transparence ops.
 */
import { KpiCard } from '../primitives/KpiCard';
import type { CheckoutKpiTotals } from '@/lib/analytics/queries/checkout';
import { formatNumber } from '@/lib/analytics/format';

interface CheckoutKpiGridProps {
  totals: CheckoutKpiTotals;
  loading?: boolean;
}

export function CheckoutKpiGrid({ totals, loading }: CheckoutKpiGridProps) {
  const fallbackHint =
    totals.serverFallbackPurchases > 0
      ? `dont ${formatNumber(totals.serverFallbackPurchases)} via webhook`
      : undefined;

  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      data-testid="checkout-kpi-grid"
    >
      <KpiCard
        label="Vues panier"
        value={totals.viewCart}
        format="number"
        loading={loading}
      />
      <KpiCard
        label="Begin checkout"
        value={totals.beginCheckout}
        format="number"
        loading={loading}
      />
      <KpiCard
        label="Achats"
        value={totals.submissions}
        format="number"
        loading={loading}
        comparisonLabel={fallbackHint}
      />
      <KpiCard
        label="Abandons"
        value={totals.abandons}
        format="number"
        loading={loading}
        comparisonLabel="Begin checkout sans achat après 60 min"
      />
    </div>
  );
}
