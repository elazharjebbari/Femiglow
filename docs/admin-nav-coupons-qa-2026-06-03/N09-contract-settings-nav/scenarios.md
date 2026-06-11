# N09 — Scénarios (Gherkin FR)

Persona : **Karim**, opérateur authentifié (la session est mockée). Contrat serveur testé en import
direct ; `upsertAppConfig`, `logAuditEvent`, `next/cache` mockés.

## Scénario N09-S1 — Persistance d'une nav valide (happy)
Contexte: Karim sauvegarde une navigation valide, version courante 1.
Étant donné une session admin et `upsertAppConfig` qui renvoie `{ ok:true, row:{ version:2 },
snapshot:{ id:'snap_x' } }`
Quand un `PATCH /api/admin/settings/nav` arrive avec `If-Match: 1` et un payload nav valide
Alors la réponse est 200 avec `section:'nav'`, `meta.version:2`, `meta.isDefault:false`, un `snapshotId`
Et `revalidateTag` est appelé pour `'app-config'` ET `'app-config:nav'`
Et `logAuditEvent` enregistre `app-config.update` sur `resourceId:'nav'` avec `meta.version:2`.

## Scénario N09-S2 — En-tête de verrou manquant (edge 400)
Contexte: une requête sans `If-Match`.
Étant donné une session admin et un payload nav valide
Quand le `PATCH` arrive sans en-tête `If-Match`
Alors la réponse est 400 `invalid_input`
Et aucune écriture ni invalidation de cache n'a lieu (le verrou optimiste est obligatoire).

## Scénario N09-S3 — Conflit de version (edge 409)
Contexte: un autre admin a déjà sauvegardé (version courante 5).
Étant donné `upsertAppConfig` qui renvoie `{ ok:false, currentVersion:5 }`
Quand le `PATCH` arrive avec `If-Match: 1` et un payload valide
Alors la réponse est 409 `version_conflict` avec `details.currentVersion: 5`
Et `revalidateTag` et `logAuditEvent` ne sont PAS appelés (aucune écriture).

## Scénario N09-S4 — Payload nav invalide (edge 422)
Contexte: le payload contient deux items avec la même clé.
Étant donné une session admin et `If-Match: 1`
Quand le `PATCH` arrive avec un payload nav à clé dupliquée
Alors la réponse est 422 `validation_failed` avec `details` (issues Zod tableau)
Et `upsertAppConfig` n'est pas appelé, ni `revalidateTag`, ni `logAuditEvent`.

## Scénario N09-S5 — Section inconnue, auth d'abord (edge ordre des gardes)
Contexte: une requête vers une section inexistante, sans session.
Étant donné `getAdminSession` qui renvoie `null`
Quand le `PATCH /api/admin/settings/zzz` arrive
Alors la réponse est 401 (l'authentification prime sur la validation de section)
Et si la session est valide mais la section reste « zzz », la réponse devient 404 « Section "zzz"
inconnue. ».
