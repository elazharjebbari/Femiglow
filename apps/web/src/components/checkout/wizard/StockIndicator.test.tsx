/**
 * Régression stock 2026-06-01 — un statut `in_stock` NE DOIT JAMAIS afficher le
 * bloc « Rupture momentanée / réassort » (qui désactive le bouton de commande et
 * bloque l'étape adresse). Le bloc n'apparaît que pour `out_of_stock`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('@/lib/checkout/client/wizard-client', () => ({
  wizardClient: { getStock: vi.fn() },
}));
import { wizardClient } from '@/lib/checkout/client/wizard-client';
import { StockIndicator } from './StockIndicator';

const snap = (status: string, effectiveDisplay: number) => ({
  variantId: 'pvar_ukmyfpxwh7tpp79z',
  sku: 'FEMI-KIT-100',
  status,
  effectiveDisplay,
  thresholdLow: 5,
});

describe('StockIndicator — statut → rendu', () => {
  beforeEach(() => vi.clearAllMocks());

  it('in_stock → pastille EN STOCK, AUCUN bloc rupture/réassort', async () => {
    (wizardClient.getStock as ReturnType<typeof vi.fn>).mockResolvedValue(snap('in_stock', -1));
    render(<StockIndicator variantId="pvar_ukmyfpxwh7tpp79z" />);
    await waitFor(() =>
      expect(screen.getByTestId('stock-indicator-in-stock')).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('stock-indicator-out-of-stock')).toBeNull();
  });

  it('low_stock → bannière derniers exemplaires, pas de bloc rupture', async () => {
    (wizardClient.getStock as ReturnType<typeof vi.fn>).mockResolvedValue(snap('low_stock', 3));
    render(<StockIndicator variantId="pvar_ukmyfpxwh7tpp79z" />);
    await waitFor(() =>
      expect(screen.getByTestId('stock-indicator-low-stock')).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('stock-indicator-out-of-stock')).toBeNull();
  });

  it('out_of_stock → bloc rupture présent (le seul cas qui bloque)', async () => {
    (wizardClient.getStock as ReturnType<typeof vi.fn>).mockResolvedValue(snap('out_of_stock', 0));
    render(<StockIndicator variantId="pvar_ukmyfpxwh7tpp79z" />);
    await waitFor(() =>
      expect(screen.getByTestId('stock-indicator-out-of-stock')).toBeInTheDocument(),
    );
  });
});
