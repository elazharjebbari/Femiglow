import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DriftBanner } from './DriftBanner';

describe('DriftBanner', () => {
  it('rend la version warning', () => {
    render(
      <DriftBanner
        status="warning"
        humanMessage="Drift mineur sur le bundleId."
        linkTo="/admin/tracking/gtm/sync-status"
      />,
    );
    expect(screen.getByTestId('drift-banner')).toHaveAttribute('data-status', 'warning');
    expect(screen.getByText(/Drift mineur sur le bundleId/i)).toBeInTheDocument();
    expect(screen.getByText(/Attention/i)).toBeInTheDocument();
    expect(screen.getByTestId('drift-banner-link')).toHaveAttribute('href', '/admin/tracking/gtm/sync-status');
  });

  it('rend la version critical', () => {
    render(
      <DriftBanner
        status="critical"
        humanMessage="Container ID incorrect."
        linkTo="/admin/tracking/gtm/sync-status"
      />,
    );
    expect(screen.getByTestId('drift-banner')).toHaveAttribute('data-status', 'critical');
    expect(screen.getByText(/Container ID incorrect/)).toBeInTheDocument();
    expect(screen.getByText(/Drift critique/i)).toBeInTheDocument();
  });

  it('a un role alert et aria-live polite', () => {
    render(
      <DriftBanner status="critical" humanMessage="msg" linkTo="/x" />,
    );
    const banner = screen.getByTestId('drift-banner');
    expect(banner).toHaveAttribute('role', 'alert');
    expect(banner).toHaveAttribute('aria-live', 'polite');
  });

  it('utilise un icône différent par statut', () => {
    const { rerender } = render(
      <DriftBanner status="warning" humanMessage="x" linkTo="/x" />,
    );
    expect(screen.getByText('⚠')).toBeInTheDocument();
    rerender(<DriftBanner status="critical" humanMessage="x" linkTo="/x" />);
    expect(screen.getByText('🚨')).toBeInTheDocument();
  });

  it('respecte le linkTo personnalisé', () => {
    render(
      <DriftBanner status="warning" humanMessage="x" linkTo="/admin/tracking/gtm/custom" />,
    );
    expect(screen.getByTestId('drift-banner-link')).toHaveAttribute('href', '/admin/tracking/gtm/custom');
  });
});
