# API Spec — Backend Poka-Yoke

## Endpoints

### `POST /api/track/sentinel` — Ping public

**Auth** : Aucune (public, anonyme).
**Rate limit** : 60 req/min/IP.
**CORS** : Domaine FemiGlow strict (`origin === env.NEXT_PUBLIC_BASE_URL`).
**Runtime** : Edge ou Node (Node préféré pour accès DB).

#### Request

```http
POST /api/track/sentinel
Content-Type: application/json
Origin: https://femiglow.ma

{
  "bundleId":     "a7c4f2e9b81d",
  "mappingVersion": "v17",
  "configVersion":  "v4",
  "containerId": "GTM-XXXX",
  "gtmId":       "GTM-XXXX",
  "sentAt":      "2026-05-13T19:32:01.234Z",
  "manifestMismatch": false,
  "manifestMismatchDetails": null
}
```

#### Response — succès

```http
HTTP/1.1 204 No Content
```

(204 = côté GTM on s'en moque de la réponse, on minimise le payload retour.)

#### Response — erreurs

| Status | Cause |
|---|---|
| 400 | Payload invalide (Zod fail). Réponse `{ "error": "invalid_input", "details": [...] }`. |
| 403 | CORS rejected (origine non autorisée). |
| 429 | Rate limited. |
| 500 | Bug serveur (loggé Sentry, le client retentera plus tard). |

#### Comportement

1. Valide payload (Zod, strict).
2. Hash IP/UA.
3. `INSERT INTO gtm_sentinel_pings`.
4. Appelle `driftDetector.recompute()`.
5. Si transition de statut : `INSERT INTO gtm_drift_history` + envoi email si transition vers `critical`.

#### Logging

- `logger.debug('gtm.sentinel.received', { bundleId, mappingV, configV })`
- `logger.warn('gtm.drift.transition', { from, to, reasons })` si transition

---

### `GET /api/admin/tracking/gtm/sync-status` — État admin

**Auth** : Admin requis (`requireAdmin`).
**Cache** : Pas de cache HTTP (toujours frais).
**Runtime** : Node.

#### Response

```json
{
  "activeAdmin": {
    "mappingVersion": "v17",
    "configVersion": "v4",
    "bundleId": "a7c4f2e9b81d",
    "containerId": "GTM-XXXX"
  },
  "lastPing": {
    "id": "uuid",
    "receivedAt": "2026-05-13T19:32:01Z",
    "sentAt": "2026-05-13T19:32:00Z",
    "mappingVersion": "v17",
    "configVersion": "v4",
    "bundleId": "a7c4f2e9b81d",
    "containerId": "GTM-XXXX",
    "manifestMismatch": false
  },
  "drift": {
    "status": "ok",
    "since": "2026-05-13T18:00:00Z",
    "reasons": []
  },
  "silence": {
    "lastPingAgo": "12 minutes",
    "ok": true,
    "thresholdHours": 6
  },
  "history": [
    {
      "day": "2026-05-13",
      "pingsCount": 320,
      "driftDetected": false,
      "bundleId": "a7c4f2e9b81d"
    }
  ],
  "recentTransitions": [
    {
      "at": "2026-05-12T14:23:00Z",
      "from": "critical",
      "to": "ok",
      "reasons": [{ "code": "mapping_version_drift", "expected": "v17", "got": "v16" }]
    }
  ]
}
```

---

### `POST /api/admin/tracking/gtm/validate-pair` — Couche A

**Auth** : Admin requis.
**Runtime** : Node.

#### Request

```json
{
  "configJson":  { /* contenu du config-v4.json */ },
  "mappingJson": { /* contenu du mapping-v17.json */ }
}
```

#### Response

```json
{
  "ok": false,
  "bundleId": {
    "config": "a7c4f2e9b81d",
    "mapping": "a7c4f2e9b81d",
    "match": true
  },
  "errors": [
    {
      "code": "missing_variable",
      "severity": "error",
      "message": "La variable {{FG Locale}} référencée par le mapping n'existe pas dans la config GTM.",
      "fix": "Ajouter une variable 'FG Locale' de type constant ou data layer dans la config GTM avant l'import du mapping."
    }
  ],
  "warnings": [
    {
      "code": "config_version_newer",
      "severity": "warning",
      "message": "Config GTM en v5, mapping attend v4. Probablement OK mais à valider.",
      "fix": "Vérifier que les variables ajoutées en v5 ne sont pas requises par le mapping."
    }
  ],
  "recommendations": [
    {
      "order": 1,
      "action": "Importer config-v4.json en premier (Submit & Publish)."
    },
    {
      "order": 2,
      "action": "Importer mapping-v17.json en second."
    },
    {
      "order": 3,
      "action": "Ouvrir GTM Preview Mode et faire un pageview pour confirmer le sentinel ping."
    }
  ]
}
```

#### Comportement

1. Parse les 2 JSONs (rejette si malformé).
2. Pour chaque règle de `pairValidator`, exécute le check.
3. Agrège erreurs/warnings/recommandations.
4. Retourne le résultat sans persister (la validation est stateless).

---

### `GET /api/admin/tracking/gtm/drift-banner` — Banner global (lightweight)

**Auth** : Admin requis.
**Cache** : 60s côté serveur (mémoire) pour ne pas hammer la DB sur chaque pageview admin.
**Runtime** : Node.

#### Response

```json
{
  "status": "critical",
  "since": "2026-05-13T18:00:00Z",
  "topReason": {
    "code": "mapping_version_drift",
    "expected": "v17",
    "got": "v16",
    "humanMessage": "GTM exécute le mapping v16 alors que v17 est actif côté admin."
  },
  "linkTo": "/admin/tracking/gtm/sync-status"
}
```

---

### `POST /api/cron/sentinel-cleanup` — Purge nightly

**Auth** : Secret cron (`x-cron-secret` header).
**Runtime** : Node, idempotent.

#### Comportement

1. Agrège pings de J-91 dans `gtm_sentinel_daily_aggregates`.
2. `DELETE FROM gtm_sentinel_pings WHERE received_at < NOW() - INTERVAL '90 days'`.
3. `DELETE FROM gtm_drift_history WHERE at < NOW() - INTERVAL '1 year'`.

#### Response

```json
{ "ok": true, "deletedPings": 1240, "aggregatedDays": 1 }
```
