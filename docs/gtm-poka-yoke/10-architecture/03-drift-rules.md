# Règles de classification du drift

Le `driftDetector` compare l'état admin (source de vérité côté FemiGlow) avec l'état runtime (déclaré par le dernier sentinel ping).

## Sortie

```ts
type DriftStatus =
  | { status: 'ok'; since: Date }
  | { status: 'warning'; reasons: DriftReason[]; since: Date }
  | { status: 'critical'; reasons: DriftReason[]; since: Date };

type DriftReason =
  | { code: 'bundle_mismatch'; expected: string; got: string }
  | { code: 'mapping_version_drift'; expected: string; got: string }
  | { code: 'config_version_drift'; expected: string; got: string }
  | { code: 'container_id_mismatch'; expected: string; got: string }
  | { code: 'silence_excess'; lastPingAt: Date; thresholdHours: number }
  | { code: 'manifest_flag_mismatch'; details: string };
```

## Matrice de classification

| Situation | Statut | Code |
|---|---|---|
| Bundle ID admin = Bundle ID ping | `ok` | — |
| Bundle ID diffère, mais mapping_v et config_v cohérents (cache GTM possible) | `warning` | `bundle_mismatch` |
| `mapping_v admin ≠ mapping_v ping` | `critical` | `mapping_version_drift` |
| `config_v admin ≠ config_v ping` | `critical` | `config_version_drift` |
| `container_id admin ≠ container_id ping` | `critical` | `container_id_mismatch` |
| Aucun ping reçu depuis < 6h | `ok` (trop tôt pour conclure) | — |
| Aucun ping depuis 6h-24h ET édit admin < 24h | `warning` | `silence_excess` |
| Aucun ping depuis > 24h | `critical` | `silence_excess` |
| Tag Manifest Check côté GTM a flagué mismatch | `critical` | `manifest_flag_mismatch` |

## Logique d'évaluation

```ts
function classifyDrift(input: {
  admin: { bundleId: string; mappingVersion: string; configVersion: string; containerId: string };
  lastPing: SentinelPing | null;
  lastEditAt: Date | null;
  now: Date;
}): DriftStatus {
  // 1. Silence check (toujours en premier — pas de ping = on ne sait rien d'autre)
  if (!input.lastPing) {
    const hoursSinceEdit = hoursBetween(input.lastEditAt, input.now);
    if (hoursSinceEdit < 6) return { status: 'ok', since: input.now };
    if (hoursSinceEdit < 24) return {
      status: 'warning',
      reasons: [{ code: 'silence_excess', lastPingAt: null, thresholdHours: 6 }],
      since: input.now,
    };
    return {
      status: 'critical',
      reasons: [{ code: 'silence_excess', lastPingAt: null, thresholdHours: 24 }],
      since: input.now,
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

  // 5. Bundle ID (warning seulement si versions matchent)
  if (
    reasons.length === 0
    && input.lastPing.bundleId !== input.admin.bundleId
  ) {
    return {
      status: 'warning',
      reasons: [{
        code: 'bundle_mismatch',
        expected: input.admin.bundleId,
        got: input.lastPing.bundleId,
      }],
      since: input.lastPing.receivedAt,
    };
  }

  // 6. Manifest flag (côté GTM Couche C)
  if (input.lastPing.manifestMismatch) {
    reasons.push({
      code: 'manifest_flag_mismatch',
      details: input.lastPing.manifestMismatchDetails ?? 'unknown',
    });
  }

  if (reasons.length === 0) return { status: 'ok', since: input.lastPing.receivedAt };

  // Toute autre raison = critical
  return {
    status: 'critical',
    reasons,
    since: input.lastPing.receivedAt,
  };
}
```

## Seuils configurables

Les seuils sont dans `env`:

```
GTM_SENTINEL_SILENCE_WARNING_HOURS=6
GTM_SENTINEL_SILENCE_CRITICAL_HOURS=24
GTM_SENTINEL_PING_GRACE_AFTER_EDIT_HOURS=2
```

## Hystérésis (anti-flapping)

Quand le statut change, on garde la nouvelle valeur **stable pendant 5 minutes minimum** avant de la rebasculer. Cela évite le flapping si les pings arrivent en désordre (CDN cache, batching).
