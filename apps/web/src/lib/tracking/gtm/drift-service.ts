import { mappingStore } from '@/lib/tracking/mappings/store';
import { logger } from '@/lib/logging/logger';
import {
  getCurrentDriftState,
  getLastSentinelPing,
  insertDriftHistory,
  insertSentinelPing,
  upsertDriftState,
  type InsertPingInput,
  type StoredPing,
} from '@/lib/db/queries/tracking/gtm-poka-yoke';
import { applyHysteresis, classifyDrift } from './drift-detector';
import type { AdminSnapshot, DriftClassification } from './drift-detector';
import type { DriftStatusEnum } from './sentinel-schemas';

/**
 * Orchestrator côté serveur :
 *  - ingestion d'un ping
 *  - recompute drift state
 *  - persist transition + side effects
 *
 * Toutes les fonctions sont idempotentes (rejouer un même ping = même état).
 */

export async function ingestPing(input: InsertPingInput): Promise<DriftClassification | null> {
  const inserted = await insertSentinelPing(input);
  if (!inserted) {
    logger.debug?.('gtm.sentinel.skipped_no_db');
    return null;
  }
  logger.debug?.('gtm.sentinel.received', {
    bundleId: input.bundleId,
    mappingVersion: input.mappingVersion,
    configVersion: input.configVersion,
  });
  return recomputeFromPing(inserted);
}

export async function recomputeFromPing(ping: StoredPing): Promise<DriftClassification> {
  const adminSnapshot = await loadAdminSnapshot();
  const previous = await getCurrentDriftState();

  const raw = classifyDrift({
    admin: adminSnapshot,
    lastPing: {
      bundleId: ping.bundleId,
      mappingVersion: ping.mappingVersion,
      configVersion: ping.configVersion,
      containerId: ping.containerId,
      manifestMismatch: ping.manifestMismatch,
      manifestMismatchDetails: ping.manifestMismatchDetails,
      receivedAt: ping.receivedAt,
    },
    lastEditAt: null,
    now: new Date(),
  });

  const final = applyHysteresis({
    previous: previous ? { status: previous.status, since: previous.since } : null,
    current: raw,
    now: new Date(),
  });

  await persistTransition({
    previous: previous?.status ?? null,
    final,
    pingId: ping.id,
    adminSnapshot,
  });

  return final;
}

export async function recomputeFromTimer(): Promise<DriftClassification> {
  const adminSnapshot = await loadAdminSnapshot();
  const lastPing = await getLastSentinelPing();
  const previous = await getCurrentDriftState();

  const raw = classifyDrift({
    admin: adminSnapshot,
    lastPing: lastPing
      ? {
          bundleId: lastPing.bundleId,
          mappingVersion: lastPing.mappingVersion,
          configVersion: lastPing.configVersion,
          containerId: lastPing.containerId,
          manifestMismatch: lastPing.manifestMismatch,
          manifestMismatchDetails: lastPing.manifestMismatchDetails,
          receivedAt: lastPing.receivedAt,
        }
      : null,
    lastEditAt: null,
    now: new Date(),
  });

  const final = applyHysteresis({
    previous: previous ? { status: previous.status, since: previous.since } : null,
    current: raw,
    now: new Date(),
  });

  await persistTransition({
    previous: previous?.status ?? null,
    final,
    pingId: lastPing?.id ?? null,
    adminSnapshot,
  });
  return final;
}

export async function loadAdminSnapshot(): Promise<AdminSnapshot> {
  const active = await mappingStore.getActive();
  const mappingVersion = active?.name ?? 'unknown';
  const containerId = process.env.GTM_CONTAINER_ID ?? 'GTM-UNKNOWN';
  const configVersion = process.env.GTM_CONFIG_VERSION ?? 'unknown';
  // bundleId stocké dans le mapping si présent
  const m = active?.mappings as Record<string, unknown> | undefined;
  const manifest = m && typeof m === 'object' && '__manifest__' in m ? (m['__manifest__'] as Record<string, unknown>) : undefined;
  const bundleId = typeof manifest?.bundleId === 'string' ? manifest.bundleId : 'unknown';
  return { mappingVersion, configVersion, bundleId, containerId };
}

async function persistTransition(input: {
  previous: DriftStatusEnum | null;
  final: DriftClassification;
  pingId: string | null;
  adminSnapshot: AdminSnapshot;
}): Promise<void> {
  await upsertDriftState({
    status: input.final.status,
    since: input.final.since,
    reasons: input.final.reasons,
    lastPingId: input.pingId,
    adminSnapshot: input.adminSnapshot as unknown as Record<string, unknown>,
  });

  if (input.previous !== input.final.status) {
    await insertDriftHistory({
      previousStatus: input.previous,
      newStatus: input.final.status,
      reasons: input.final.reasons,
      triggeredByPingId: input.pingId,
    });
    if (input.final.status === 'critical') {
      logger.error?.('gtm.drift.critical', { reasons: input.final.reasons });
    } else if (input.final.status === 'warning') {
      logger.warn?.('gtm.drift.warning', { reasons: input.final.reasons });
    } else {
      logger.info?.('gtm.drift.resolved', { from: input.previous });
    }
  }
}
