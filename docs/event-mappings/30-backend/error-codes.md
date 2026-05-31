# 30.3 — Codes d'erreur API

## Format de réponse

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Le nom Meta 'PUR-CHASE!' n'est pas conforme",
    "details": {
      "field": "mappings.purchase.meta.mappedName",
      "expected": "^[A-Za-z][A-Za-z0-9_ ]{0,39}$",
      "received": "PUR-CHASE!"
    }
  }
}
```

## Codes

| code | HTTP | Quand | Action UI |
|---|---|---|---|
| `unauthorized` | 401 | Session admin absente ou expirée | Redirect /admin/login |
| `forbidden` | 403 | Action interdite (ex: édition `__default__`, delete active) | Toast erreur explicite |
| `not_found` | 404 | Version inconnue | Toast + redirect liste |
| `validation_failed` | 400 | Body invalide (Zod) | Surligne champs en erreur |
| `mapping_name_invalid` | 400 | mappedName ne respecte pas la regex provider | Inline error sous la cellule |
| `version_already_active` | 409 | Activate sur version déjà active | Toast neutre (no-op) |
| `version_deleted` | 409 | Action sur version status=deleted | Suggérer restore d'abord |
| `cannot_delete_active` | 403 | Tentative delete sur active | Suggérer activate une autre d'abord |
| `cannot_delete_default` | 403 | Tentative delete sur `__default__` | Bloquer le bouton côté UI |
| `cannot_edit_default` | 403 | Tentative édition sur `__default__` | Bloquer côté UI, hint "Cloner d'abord" |
| `source_not_found` | 404 | Clone d'un sourceId inexistant | Toast + refresh liste |
| `import_invalid` | 400 | JSON importé non conforme schema | Détail field-par-field |
| `gtm_export_failed` | 500 | Échec interne build GTM | Log + retry button |
| `gtm_export_schema_mismatch` | 500 | Output GTM ne respecte pas le schema officiel | Bug interne — page Sentry |
| `rate_limited` | 429 | > 10 req/sec/admin | Toast "Trop de requêtes" + backoff client |
| `internal_error` | 500 | Catch-all | Toast "Erreur serveur" + Sentry |
| `storage_unavailable` | 503 | DB indispo (transient) | Retry UI auto après 5s |

## Mapping cohérent avec `formatErrorResponse`

Le helper existant `lib/errors/http-error.ts` (utilisé partout dans l'admin tracking) gère :
- `HttpError(code, message, details?)` → réponse standardisée
- Codes définis ici sont ajoutés au type union `HttpErrorCode` si pas encore présents

Exemple route handler :
```typescript
try {
  // ...
} catch (err) {
  if (err instanceof Error && err.message === 'cannot_delete_active_or_default') {
    throw new HttpError('cannot_delete_active', "Impossible de supprimer la version active", { id });
  }
  throw err;
}
```

## Côté UI — gestion des erreurs

Hook `useMappingsApi()` :
- Catch fetch → parse `{ error: { code, message, details } }`
- Dispatche selon code :
  - 401 → redirect
  - 4xx → toast avec `message` user-friendly
  - 5xx → toast "Erreur serveur" + log Sentry
- `details.field` → highlight inline si présent

## Tests

- 1 test par code dans `route.test.ts` (vitest integration)
- 1 test e2e qui simule échec validation (Playwright) et vérifie le toast + inline error
