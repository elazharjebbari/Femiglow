# Modèle de données

## Tables

### `gtm_sentinel_pings`

Stocke chaque ping individuel reçu de GTM. Rétention 90 jours.

| Colonne | Type | Description |
|---|---|---|
| `id` | `uuid` PK | Identifiant unique. |
| `received_at` | `timestamptz` not null default `now()` | Quand le backend a reçu le ping. |
| `sent_at` | `timestamptz` not null | Quand GTM a envoyé le ping (issue du payload). |
| `container_id` | `text` not null | Ex: `GTM-XXXX`. |
| `gtm_id` | `text` | Ex: `GTM-XXXX`, redondance avec containerId pour audit. |
| `bundle_id` | `text` not null | Ex: `a7c4f2e9b81d`, 12 chars hex. |
| `mapping_version` | `text` not null | Ex: `v17`. |
| `config_version` | `text` not null | Ex: `v4`. |
| `manifest_mismatch` | `boolean` not null default `false` | Couche C : true si le tag manifest check a flagué. |
| `manifest_mismatch_details` | `text` | Si flag : `"config=undefined,mapping=a7c4..."`. |
| `ua_hash` | `text` | Hash SHA-1 du User-Agent (anonymisé). |
| `ip_hash` | `text` | Hash SHA-1 de l'IP avec salt. |
| `page_url_hash` | `text` | Hash de l'URL (ou null si pas pertinent). |
| `raw_payload` | `jsonb` | Payload intégral pour audit. |

**Indexes** :
- `idx_pings_received_at_desc` sur `received_at DESC` (timeline)
- `idx_pings_container_bundle` sur `(container_id, bundle_id)` (queries dashboard)
- `idx_pings_mapping_v_received` sur `(mapping_version, received_at DESC)` (groupe par version)

### `gtm_drift_state`

État dérivé courant (1 ligne unique). Mis à jour à chaque ping.

| Colonne | Type | Description |
|---|---|---|
| `id` | `text` PK = `'singleton'` | Garantit unicité. |
| `status` | `text` not null | `'ok' \| 'warning' \| 'critical'`. |
| `since` | `timestamptz` not null | Quand le statut courant a commencé. |
| `reasons_json` | `jsonb` not null default `'[]'` | Liste des `DriftReason` qui justifient le statut. |
| `last_ping_id` | `uuid` | FK vers `gtm_sentinel_pings.id`. |
| `last_check_at` | `timestamptz` not null default `now()` | Quand on a recalculé. |
| `admin_snapshot` | `jsonb` not null | Snapshot des versions admin au moment du calcul (audit). |
| `updated_at` | `timestamptz` not null default `now()` | Audit. |

### `gtm_drift_history`

Append-only : chaque transition de statut. Conservée 1 an.

| Colonne | Type | Description |
|---|---|---|
| `id` | `uuid` PK | Identifiant. |
| `at` | `timestamptz` not null default `now()` | Quand le statut a changé. |
| `previous_status` | `text` | Statut précédent (`null` au démarrage). |
| `new_status` | `text` not null | Nouveau statut. |
| `reasons_json` | `jsonb` not null | Raisons justifiant la transition. |
| `triggered_by_ping_id` | `uuid` | Ping qui a déclenché la transition. |

**Indexes** : `idx_drift_history_at_desc` sur `at DESC`.

### `gtm_sentinel_daily_aggregates`

Agrégat journalier conservé indéfiniment. Construit par cron nightly.

| Colonne | Type | Description |
|---|---|---|
| `day` | `date` PK part | YYYY-MM-DD. |
| `bundle_id` | `text` PK part | Ex: `a7c4f2e9b81d`. |
| `mapping_version` | `text` not null | |
| `config_version` | `text` not null | |
| `container_id` | `text` not null | |
| `pings_count` | `integer` not null | Nombre de pings reçus ce jour pour ce bundle. |
| `drift_detected` | `boolean` not null | true si ≥1 ping en drift. |
| `first_ping_at` | `timestamptz` not null | |
| `last_ping_at` | `timestamptz` not null | |

PK composée : `(day, bundle_id)`.

## Schémas Zod

```ts
// apps/web/src/lib/tracking/gtm/sentinel-schemas.ts
import { z } from 'zod';

export const SentinelPingInputSchema = z.object({
  bundleId: z.string().regex(/^[a-f0-9]{12}$/, 'invalid bundleId format'),
  mappingVersion: z.string().min(1).max(64),
  configVersion: z.string().min(1).max(64),
  containerId: z.string().regex(/^GTM-[A-Z0-9]{4,}$/, 'invalid GTM container id'),
  gtmId: z.string().regex(/^GTM-[A-Z0-9]{4,}$/).optional(),
  sentAt: z.string().datetime(),
  manifestMismatch: z.boolean().optional().default(false),
  manifestMismatchDetails: z.string().max(512).optional(),
});

export type SentinelPingInput = z.infer<typeof SentinelPingInputSchema>;

export const DriftStatusSchema = z.enum(['ok', 'warning', 'critical']);
export type DriftStatusEnum = z.infer<typeof DriftStatusSchema>;

export const DriftReasonSchema = z.discriminatedUnion('code', [
  z.object({ code: z.literal('bundle_mismatch'), expected: z.string(), got: z.string() }),
  z.object({ code: z.literal('mapping_version_drift'), expected: z.string(), got: z.string() }),
  z.object({ code: z.literal('config_version_drift'), expected: z.string(), got: z.string() }),
  z.object({ code: z.literal('container_id_mismatch'), expected: z.string(), got: z.string() }),
  z.object({ code: z.literal('silence_excess'), lastPingAt: z.string().datetime().nullable(), thresholdHours: z.number() }),
  z.object({ code: z.literal('manifest_flag_mismatch'), details: z.string() }),
]);

export type DriftReason = z.infer<typeof DriftReasonSchema>;
```

## Volumes prévus

| Table | Volume J | Volume 90j | Taille rétention |
|---|---|---|---|
| `gtm_sentinel_pings` | ~3 000 / jour | ~270 000 lignes | ~55 MB (avec jsonb) |
| `gtm_drift_state` | 1 ligne | 1 ligne | < 1 KB |
| `gtm_drift_history` | 0-3 / jour | ~100 lignes / 90j | < 100 KB |
| `gtm_sentinel_daily_aggregates` | 1-3 / jour | 90-270 lignes | < 50 KB |

## Garanties

- **Idempotence** : recevoir le même ping 2× donne le même état final (la table pings autorise duplicates pour audit, l'état drift est dérivé).
- **Eventually consistent** : `gtm_drift_state` peut accuser 1-2s de retard sur le ping le plus récent, c'est acceptable.
- **Replay safe** : on peut supprimer `gtm_drift_state` et le reconstruire à partir des pings.
