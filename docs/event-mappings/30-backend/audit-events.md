# 30.5 — Audit events

## Catalogue des actions auditées

| Action | Déclencheur | `before` | `after` | `meta` |
|---|---|---|---|---|
| `create` | POST /mappings (kind=default OR import) | `null` | `{ mappings, name }` | `{ source: 'default'\|'import' }` |
| `duplicate` | POST /mappings (kind=clone) | `null` | `{ mappings, clonedFrom }` | `{ sourceId }` |
| `edit` | PUT /mappings/:id → crée nouvelle version | `{ mappings: before }` | `{ mappings: after }` | `{ sourceId, diffSummary: {added, removed, changed} }` |
| `activate` | POST /mappings/:id/activate | `{ activeBefore: oldId }` | `{ activeAfter: id }` | `{ archivedId }` |
| `archive` | POST /mappings/:id/archive (manuel) | `{ status: 'active' }` | `{ status: 'archived' }` | `{}` |
| `delete` | DELETE /mappings/:id | `{ status: prev }` | `{ status: 'deleted' }` | `{}` |
| `restore` | POST /mappings/:id/restore | `{ status: 'deleted' }` | `{ status: 'archived' }` | `{}` |
| `reset_to_default` | POST /mappings/reset-default | `{ activeBefore: oldId }` | `{ activeAfter: '__default__' }` | `{ resetType: 'factory' }` |
| `export_gtm` | POST /mappings/:id/export-gtm | `null` | `null` | `{ env, sha256, tagsCount, eventsCount }` |
| `test_event` | POST /mappings/:id/test | `null` | `null` | `{ eventName, results: {meta:{...}, ga4:{...}, ...} }` |

## Schema `meta` détaillé

### Pour `edit`

```json
{
  "sourceId": "emv_old",
  "diffSummary": {
    "added": 2,
    "removed": 0,
    "changed": 3,
    "samples": [
      { "event": "form_start", "provider": "tiktok", "before": null, "after": "form_start" }
    ]
  }
}
```

### Pour `export_gtm`

```json
{
  "env": "production",
  "sha256": "abc123...",
  "tagsCount": 180,
  "eventsCount": 30,
  "containerSize": 45678
}
```

### Pour `test_event`

```json
{
  "eventName": "purchase",
  "results": {
    "meta":       { "wouldDispatch": true, "mappedName": "Purchase", "isCustom": false },
    "google_ga4": { "wouldDispatch": true, "mappedName": "purchase", "isCustom": false },
    "google_ads": { "wouldDispatch": true, "mappedName": "purchase", "isCustom": false },
    "tiktok":     { "wouldDispatch": true, "mappedName": "CompletePayment", "isCustom": false },
    "snap":       { "wouldDispatch": true, "mappedName": "PURCHASE", "isCustom": false },
    "pinterest":  { "wouldDispatch": false, "skipReason": "isEnabled=false" }
  }
}
```

## Conservation

- **Indéfinie** par défaut (audit légal)
- Cleanup V2 : job cron archive les rows >2 ans dans un blob S3 + delete DB

## Lecture audit log

Route `GET /api/admin/tracking/events/mappings/[id]/audit?limit=50` retourne :
```json
{
  "auditEntries": [
    { "id": "ema_...", "action": "activate", "actorId": "u_xxx", "createdAt": "...", "meta": {...} },
    ...
  ]
}
```

UI : sous chaque version, un bouton "Historique" qui dépile un timeline avec toutes les actions.

## Intégration logger structuré

En plus du DB audit log, chaque action émet un log structuré :
```json
{
  "ts": "2026-05-13T...",
  "level": "info",
  "event": "tracking.event_mapping.activate",
  "actor_id": "u_xxx",
  "version_id": "emv_xxx",
  "meta": {...}
}
```

Permet correlation côté observability tooling (Sentry, Datadog si configuré).

## Cohérence avec `auditTrackingChange` existant

Le système réutilise le helper existant `lib/tracking/server/audit.ts` qui pousse vers `audit_events` (table d'audit globale). On ajoute un nouveau `resource` : `'event_mapping'` à la liste existante.

```typescript
auditTrackingChange({
  action: 'edit',
  resource: 'event_mapping',
  resourceId: versionId,
  actorId: session.adminId,
  meta: { diffSummary, sourceId },
});
```

Et **en parallèle**, on insère dans `event_mapping_audit` (table dédiée) pour avoir les `before`/`after` complets (que `audit_events` ne stocke pas).
