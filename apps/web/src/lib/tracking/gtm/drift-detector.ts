import type { DriftReason, DriftStatusEnum } from './sentinel-schemas';

/**
 * Couche B — Classification du drift entre l'état admin (source de vérité)
 * et l'état runtime (déclaré par le dernier sentinel ping).
 *
 * Fonction PURE et déterministe — facile à tester.
 * cf. docs/gtm-poka-yoke/10-architecture/03-drift-rules.md
 */

export type AdminSnapshot = {
  mappingVersion: string;
  configVersion: string;
  bundleId: string;
  containerId: string;
};

export type LastPing = {
  bundleId: string;
  mappingVersion: string;
  configVersion: string;
  containerId: string;
  manifestMismatch: boolean;
  manifestMismatchDetails: string | null;
  receivedAt: Date;
} | null;

export type ClassifyDriftInput = {
  admin: AdminSnapshot;
  lastPing: LastPing;
  lastEditAt: Date | null;
  now: Date;
  thresholds?: {
    silenceWarningHours: number;
    silenceCriticalHours: number;
  };
};

export type DriftClassification = {
  status: DriftStatusEnum;
  since: Date;
  reasons: DriftReason[];
};

const DEFAULT_THRESHOLDS = {
  silenceWarningHours: 6,
  silenceCriticalHours: 24,
};

export function classifyDrift(input: ClassifyDriftInput): DriftClassification {
  const thresholds = input.thresholds ?? DEFAULT_THRESHOLDS;

  // 1. Silence check first — pas de ping = on ne sait rien d'autre
  if (!input.lastPing) {
    const hoursSinceEdit = input.lastEditAt
      ? hoursBetween(input.lastEditAt, input.now)
      : 0;

    if (hoursSinceEdit < thresholds.silenceWarningHours) {
      return { status: 'ok', since: input.now, reasons: [] };
    }
    if (hoursSinceEdit < thresholds.silenceCriticalHours) {
      return {
        status: 'warning',
        since: input.now,
        reasons: [
          {
            code: 'silence_excess',
            lastPingAt: null,
            thresholdHours: thresholds.silenceWarningHours,
          },
        ],
      };
    }
    return {
      status: 'critical',
      since: input.now,
      reasons: [
        {
          code: 'silence_excess',
          lastPingAt: null,
          thresholdHours: thresholds.silenceCriticalHours,
        },
      ],
    };
  }

  const reasons: DriftReason[] = [];

  // 2. Container ID
  if (input.lastPing.containerId !== input.admin.containerId) {
    reasons.push({
      code: 'container_id_mismatch',
      expected: input.admin.containerId,
      got: input.lastPing.containerId,
    });
  }

  // 3. Mapping version
  if (input.lastPing.mappingVersion !== input.admin.mappingVersion) {
    reasons.push({
      code: 'mapping_version_drift',
      expected: input.admin.mappingVersion,
      got: input.lastPing.mappingVersion,
    });
  }

  // 4. Config version
  if (input.lastPing.configVersion !== input.admin.configVersion) {
    reasons.push({
      code: 'config_version_drift',
      expected: input.admin.configVersion,
      got: input.lastPing.configVersion,
    });
  }

  // 5. Manifest flag (couche C)
  if (input.lastPing.manifestMismatch) {
    reasons.push({
      code: 'manifest_flag_mismatch',
      details: input.lastPing.manifestMismatchDetails ?? 'unknown',
    });
  }

  // 6. Bundle ID — warning seulement si versions matchent par ailleurs
  if (reasons.length === 0 && input.lastPing.bundleId !== input.admin.bundleId) {
    return {
      status: 'warning',
      since: input.lastPing.receivedAt,
      reasons: [
        {
          code: 'bundle_mismatch',
          expected: input.admin.bundleId,
          got: input.lastPing.bundleId,
        },
      ],
    };
  }

  if (reasons.length === 0) {
    return { status: 'ok', since: input.lastPing.receivedAt, reasons: [] };
  }

  return { status: 'critical', since: input.lastPing.receivedAt, reasons };
}

function hoursBetween(a: Date, b: Date): number {
  return Math.abs(b.getTime() - a.getTime()) / 3_600_000;
}

/**
 * Anti-flapping : ne pas changer si on a basculé il y a moins de 5 minutes
 * sauf si on retourne à un statut critical (toujours autorisé).
 */
export function applyHysteresis(opts: {
  previous: { status: DriftStatusEnum; since: Date } | null;
  current: DriftClassification;
  now: Date;
  minStableMinutes?: number;
}): DriftClassification {
  const minStable = opts.minStableMinutes ?? 5;
  if (!opts.previous) return opts.current;
  if (opts.previous.status === opts.current.status) return opts.current;

  // Autoriser toute transition VERS critical
  if (opts.current.status === 'critical') return opts.current;

  const minutesSince = (opts.now.getTime() - opts.previous.since.getTime()) / 60_000;
  if (minutesSince < minStable && opts.previous.status !== 'ok') {
    // On garde l'état précédent (warning/critical) tant que la stabilité minimum n'est pas atteinte
    return {
      status: opts.previous.status,
      since: opts.previous.since,
      reasons: opts.current.reasons,
    };
  }
  return opts.current;
}
