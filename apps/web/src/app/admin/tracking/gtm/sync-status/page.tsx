import { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/require-admin';
import { TrackingShell } from '@/components/admin/tracking/TrackingShell';
import { SyncStatusLive } from '@/components/admin/tracking/gtm/SyncStatusLive';
import {
  getCurrentDriftState,
  getDailyAggregates,
  getLastSentinelPing,
  getRecentDriftTransitions,
} from '@/lib/db/queries/tracking/gtm-poka-yoke';
import { loadAdminSnapshot } from '@/lib/tracking/gtm/drift-service';
import type { SyncStatusPayload } from '@/components/admin/tracking/gtm/SyncStatusView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'GTM Sync Status — Tracking',
};

/**
 * /admin/tracking/gtm/sync-status — Couche B Poka-Yoke
 * cf. docs/gtm-poka-yoke/40-frontend/01-pages-routing.md
 */
export default async function SyncStatusPage() {
  const session = await requireAdmin('/admin/tracking/gtm/sync-status');

  const [admin, state, lastPing, history, aggregates] = await Promise.all([
    loadAdminSnapshot(),
    getCurrentDriftState().catch(() => null),
    getLastSentinelPing().catch(() => null),
    getRecentDriftTransitions(10).catch(() => []),
    getDailyAggregates(30).catch(() => []),
  ]);

  const now = new Date();
  const lastPingAgoMs = lastPing ? now.getTime() - lastPing.receivedAt.getTime() : null;
  const silenceOk = lastPingAgoMs !== null ? lastPingAgoMs < 6 * 3_600_000 : false;

  const initial: SyncStatusPayload = {
    activeAdmin: admin,
    lastPing: lastPing
      ? {
          id: lastPing.id,
          receivedAt: lastPing.receivedAt.toISOString(),
          bundleId: lastPing.bundleId,
          mappingVersion: lastPing.mappingVersion,
          configVersion: lastPing.configVersion,
          containerId: lastPing.containerId,
          manifestMismatch: lastPing.manifestMismatch,
        }
      : null,
    drift: state
      ? { status: state.status, since: state.since.toISOString(), reasons: state.reasons }
      : { status: 'ok', since: now.toISOString(), reasons: [] },
    silence: { ok: silenceOk, lastPingAgoMs, thresholdHours: 6 },
    history: aggregates.map((a) => ({
      day: a.day,
      pingsCount: a.pingsCount,
      driftDetected: a.driftDetected,
    })),
    recentTransitions: history.map((h) => ({
      id: h.id,
      at: h.at.toISOString(),
      from: h.previousStatus,
      to: h.newStatus,
      reasons: h.reasons,
    })),
    generatedAt: now.toISOString(),
  };

  return (
    <TrackingShell
      adminEmail={session.email}
      active="gtm-sync"
      title="GTM Sync Status"
      description="Surveille en temps réel la cohérence entre le mapping admin et ce que GTM exécute en production. Sentinel pings reçus à chaque session."
    >
      <SyncStatusLive initial={initial} />
    </TrackingShell>
  );
}
