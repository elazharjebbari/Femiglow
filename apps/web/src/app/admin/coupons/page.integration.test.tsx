/**
 * N03 — Intégration onglet Coupons (niveau composition).
 *
 * Le RSC async `/admin/coupons` (requireAdmin + fetch) est couvert par l'E2E N10.
 * Ici on valide la COMPOSITION qu'il rend : <AdminShell active="coupons"> englobe
 * <CouponsManager>, l'onglet Coupons est surligné, et le manager s'affiche.
 * Anti-régression du bug initial (`active="settings"`).
 * cf. docs/admin-nav-coupons-qa-2026-06-03/N03-coupons-tab-integration.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdminShell } from '@/components/admin/AdminShell';
import { CouponsManager } from '@/components/admin/coupons/CouponsManager';

function renderCouponsPage() {
  // Reproduit la composition de app/admin/coupons/page.tsx (active="coupons").
  return render(
    <AdminShell adminEmail="op@femiglow.ma" active="coupons">
      <CouponsManager initialCoupons={[]} />
    </AdminShell>,
  );
}

describe('N03 intégration onglet Coupons', () => {
  it('N03-C001 l’onglet Coupons est surligné (aria-current=page)', () => {
    renderCouponsPage();
    expect(screen.getByTestId('admin-nav-coupons')).toHaveAttribute('aria-current', 'page');
  });

  it('N03-C002 le gestionnaire de coupons est rendu sous l’onglet', () => {
    renderCouponsPage();
    expect(screen.getByTestId('coupons-manager')).toBeInTheDocument();
  });

  it('N03-C003 anti-régression : Réglages n’est PAS l’onglet actif', () => {
    renderCouponsPage();
    expect(screen.getByTestId('admin-nav-settings')).not.toHaveAttribute('aria-current');
  });
});
