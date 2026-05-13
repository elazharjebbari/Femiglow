import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import {
  getCurrentDriftState,
  getDailyAggregates,
  getLastSentinelPing,
  getRecentDriftTransitions,
} from '@/lib/db/queries/tracking/gtm-poka-yoke';
import { loadAdminSnapshot } from '@/lib/tracking/gtm/drift-service';

/**
 * GET /api/admin/tracking/gtm/sync-status
 * Renvoie l'état complet du Poka-Yoke pour le dashboard admin.
 *
 * cf. docs/gtm-poka-yoke/30-backend/01-api-spec.md
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  await requireAdmin('/admin/tracking/gtm/sync-status');

  const [admin, state, lastPing, history, aggregates] = await Promise.all([
    loadAdminSnapshot(),
    getCurrentDriftState(),
    getLastSentinelPing(),
    getRecentDriftTransitions(10),
    getDailyAggregates(30),
  ]);

  const now = new Date();
  const lastPingAgoMs = lastPing ? now.getTime() - lastPing.receivedAt.getTime() : null;
  const silenceOk = lastPingAgoMs !== null ? lastPingAgoMs < 6 * 3_600_000 : false;

  return NextResponse.json(
    {
      activeAdmin: admin,
      lastPing: lastPing
        ? {
            id: lastPing.id,
            receivedAt: lastPing.receivedAt.toISOString(),
            sentAt: lastPing.sentAt.toISOString(),
            bundleId: lastPing.bundleId,
            mappingVersion: lastPing.mappingVersion,
            configVersion: lastPing.configVersion,
            containerId: lastPing.containerId,
            manifestMismatch: lastPing.manifestMismatch,
          }
        : null,
      drift: state
        ? {
            status: state.status,
            since: state.since.toISOString(),
            reasons: state.reasons,
          }
        : { status: 'ok', since: now.toISOString(), reasons: [] },
      silence: {
        ok: silenceOk,
        lastPingAgoMs,
        thresholdHours: 6,
      },
      history: aggregates,
      recentTransitions: history.map((h) => ({
        id: h.id,
        at: h.at.toISOString(),
        from: h.previousStatus,
        to: h.newStatus,
        reasons: h.reasons,
      })),
      generatedAt: now.toISOString(),
    },
    {
      headers: { 'cache-control': 'no-store' },
    },
  );
}
