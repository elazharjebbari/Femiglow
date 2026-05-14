import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SyncStatusView, type SyncStatusPayload } from './SyncStatusView';

const baseData = (overrides: Partial<SyncStatusPayload> = {}): SyncStatusPayload => ({
  activeAdmin: {
    mappingVersion: 'v17',
    configVersion: 'v4',
    bundleId: 'a7c4f2e9b81d',
    containerId: 'GTM-ABCD',
  },
  lastPing: {
    id: 'p1',
    receivedAt: new Date(Date.now() - 30_000).toISOString(),
    bundleId: 'a7c4f2e9b81d',
    mappingVersion: 'v17',
    configVersion: 'v4',
    containerId: 'GTM-ABCD',
    manifestMismatch: false,
  },
  drift: { status: 'ok', since: new Date().toISOString(), reasons: [] },
  silence: { ok: true, lastPingAgoMs: 30_000, thresholdHours: 6 },
  history: [],
  recentTransitions: [],
  generatedAt: new Date().toISOString(),
  ...overrides,
});

describe('SyncStatusView', () => {
  it('affiche le badge global OK avec sa headline', () => {
    render(<SyncStatusView data={baseData()} />);
    const badge = screen.getByTestId('global-status-badge');
    expect(badge).toHaveAttribute('data-status', 'ok');
    expect(badge).toHaveTextContent(/Tout est cohérent/i);
  });

  it('affiche le badge critical avec ses raisons', () => {
    render(
      <SyncStatusView
        data={baseData({
          drift: {
            status: 'critical',
            since: new Date().toISOString(),
            reasons: [{ code: 'mapping_version_drift', expected: 'v17', got: 'v16' }],
          },
        })}
      />,
    );
    const badge = screen.getByTestId('global-status-badge');
    expect(badge).toHaveAttribute('data-status', 'critical');
    expect(badge).toHaveTextContent(/DRIFT CRITIQUE/i);
    expect(screen.getByText(/Mapping : attendu v17, reçu v16/)).toBeInTheDocument();
  });

  it('affiche les 3 SyncCards (mapping/config/bundle)', () => {
    render(<SyncStatusView data={baseData()} />);
    expect(screen.getByTestId('sync-card-mapping')).toBeInTheDocument();
    expect(screen.getByTestId('sync-card-config')).toBeInTheDocument();
    expect(screen.getByTestId('sync-card-bundle')).toBeInTheDocument();
  });

  it('marque les cards en mismatch sur drift', () => {
    render(
      <SyncStatusView
        data={baseData({
          lastPing: {
            id: 'p1',
            receivedAt: new Date().toISOString(),
            bundleId: 'a7c4f2e9b81d',
            mappingVersion: 'v16', // ← drift
            configVersion: 'v4',
            containerId: 'GTM-ABCD',
            manifestMismatch: false,
          },
        })}
      />,
    );
    expect(screen.getByTestId('sync-card-mapping')).toHaveAttribute('data-match', 'false');
    expect(screen.getByTestId('sync-card-config')).toHaveAttribute('data-match', 'true');
  });

  it('affiche "aucun ping" si lastPing null', () => {
    render(<SyncStatusView data={baseData({ lastPing: null })} />);
    expect(screen.getByText(/Aucun ping reçu pour l'instant/i)).toBeInTheDocument();
  });

  it('liste les transitions récentes', () => {
    const data = baseData({
      recentTransitions: [
        {
          id: 'h1',
          at: '2026-05-12T14:23:00Z',
          from: 'critical',
          to: 'ok',
          reasons: [{ code: 'mapping_version_drift', expected: 'v17', got: 'v16' }],
        },
      ],
    });
    render(<SyncStatusView data={data} />);
    expect(screen.getByText(/critical → ok/)).toBeInTheDocument();
  });

  it('affiche le timeline (timeline ou empty)', () => {
    render(<SyncStatusView data={baseData({ history: [
      { day: '2026-05-12', pingsCount: 100, driftDetected: false },
    ] })} />);
    expect(screen.getByTestId('ping-timeline')).toBeInTheDocument();
  });
});
