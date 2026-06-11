# N09 — Contrat `PATCH /api/admin/settings/[section]` pour `section='nav'`

## Rôle & surface
Contrat serveur de persistance de la navigation : `PATCH /api/admin/settings/nav`
(`apps/web/src/app/api/admin/settings/[section]/route.ts`). Vérifie l'auth, la validité de la section,
le verrou optimiste `If-Match`, la validation Zod (`navSchema`), l'upsert versionné, l'invalidation de
cache (×2) et l'audit `app-config.update`. Testé en **import direct** (pattern
`api/admin/coupons/route.test.ts`) : `vi.mock` `getAdminSession`, `upsertAppConfig`, `logAuditEvent`,
`next/cache`. Couche **I** (intégration / contrat).
Fichier cible : `src/app/api/admin/settings/[section]/route.nav.test.ts` (nouveau).

## Fonctionnement optimal (ce qui DOIT se passer)
1. `getAdminSession()` → session `{ adminId, email }` présente.
2. `parseSection('nav')` → OK (`nav` ∈ `SECTIONS`).
3. Header `If-Match` présent et numérique → `expectedVersion = Number(ifMatch)`.
4. Corps JSON parsé ; supporte `{ payload, note }` OU payload direct. `note` non-vide → string, sinon
   `null`.
5. `navSchema.safeParse(payloadInput)` → OK.
6. `upsertAppConfig({ section:'nav', payload, expectedVersion, actorId }, { note })` → `result.ok`.
7. `revalidateTag(APP_CONFIG_TAG)` (`'app-config'`) **et** `revalidateTag(sectionTag('nav'))`
   (`'app-config:nav'`) — 2 appels.
8. `logAuditEvent({ action:'app-config.update', actorId, resourceType:'app_config', resourceId:'nav',
   meta:{ version, snapshotId, note } })`.
9. Réponse `200 { section:'nav', payload, meta:{ version, updatedAt, updatedBy, isDefault:false },
   snapshotId }`.

## Contrat I/O
- **Méthode/chemin** : `PATCH /api/admin/settings/:section`. `PATCH(request, ctx)` avec
  `ctx.params = { section:'nav' }` (sync ou `Promise`).
- **Headers** : `If-Match: <version>` requis ; `Content-Type: application/json`.
- **Body** : `{ payload: { items:[…] }, note? }` ou `{ items:[…] }` direct.
- **Réponse OK** : `200` (voir ci-dessus). `meta.isDefault` est **codé en dur à `false`** côté PATCH.
- **Réponses erreur** :
  - `401` (`getAdminSession` → null) via `HttpError('unauthorized')` → `formatErrorResponse`.
  - `404` section inconnue (`parseSection` lève `HttpError('not_found')`).
  - `400` (`invalid_input`) si `If-Match` absent OU `Number(ifMatch)` est `NaN`.
  - `400` (`invalid_input`) si corps non-JSON (`request.json()` throw).
  - `422` `{ error:{ code:'validation_failed', message:'Payload invalide', details: issues } }` si
    `navSchema` échoue (réponse construite à la main, PAS via `HttpError`).
  - `409` `{ error:{ code:'version_conflict', message, details:{ currentVersion } } }` si
    `upsertAppConfig` renvoie `!result.ok`.
- **Effets de bord** (succès only) : `revalidateTag` ×2, `logAuditEvent` ×1.

## Cas limites & non-happy-path
- **Ordre des gardes** : 401 (session) PRIME sur tout ; puis 404 (section) ; puis 400 (`If-Match`) ;
  puis 400 (JSON) ; puis 422 (schéma) ; puis 409 (version). Tester au moins 401>404 et 404>400.
- **`If-Match` manquant** → 400 `invalid_input` (jamais 422/409). **`If-Match: 'abc'`** (`NaN`) → 400.
  **`If-Match: '0'`** valide (`Number('0')=0`, non-NaN) → passe la garde.
- **Section inconnue** (`/api/admin/settings/zzz`) → 404 `not_found`, message « Section "zzz"
  inconnue. ». **Section `flags`/`rbac`/`branding`** valides (mais hors scope nav) — vérifier que `nav`
  route bien vers `navSchema`.
- **Payload nav invalide** (clé dupliquée, href sans `/`, item avec champ inconnu via `.strict()`) →
  422 `validation_failed` avec `details` = `issues` Zod (path/message). **Aucun** `revalidateTag`,
  **aucun** `logAuditEvent`.
- **Version stale** (`upsertAppConfig` → `{ ok:false, currentVersion:5 }`) → 409
  `version_conflict`, `details.currentVersion === 5`, **aucun** revalidate/audit.
- **`note`** : `{ payload, note:'réorg menu' }` → `note` propagé à `upsertAppConfig` et dans
  `meta.note` de l'audit ; `note:''` → `null`.
- **Payload direct** (sans wrapper `payload`) : `{ items:[…] }` → traité comme payload (branche
  `'payload' in body` fausse).
- **`ctx.params` en `Promise`** → `await Promise.resolve(ctx.params)` ne casse pas.
- **Échec ⇒ aucune mutation observable** : sur 401/404/400/422/409, `upsertAppConfig` non appelé (ou
  appelé mais renvoie conflit pour 409), `revalidateTag`/`logAuditEvent` à 0.

## Invariants couverts
- **NAV-INV-LOCK** : `If-Match` obligatoire (400 sinon) ; version stale → 409 sans écriture.
- **NAV-INV-PERSIST** : succès → 200 + version (de `upsertAppConfig`) + audit `app-config.update`
  (`resourceId:'nav'`) + `revalidateTag` ×2.
- **NAV-INV-CONFIG** : `nav` route vers `navSchema` (payload invalide → 422).

## Critères d'acceptation (observables)
- Session null → `res.status === 401`.
- `section='zzz'` → `res.status === 404`, body.error message « Section "zzz" inconnue. ».
- `If-Match` absent → `res.status === 400`, `body.error.code === 'invalid_input'`.
- `If-Match: 'abc'` → `res.status === 400`.
- Payload nav invalide → `res.status === 422`, `body.error.code === 'validation_failed'`,
  `Array.isArray(body.error.details)`.
- `upsertAppConfig` → `{ok:false,currentVersion:5}` → `res.status === 409`,
  `body.error.code === 'version_conflict'`, `body.error.details.currentVersion === 5`.
- Succès → `res.status === 200`, `body.section === 'nav'`, `body.meta.isDefault === false`,
  `body.snapshotId` défini.
- Succès → `revalidateTag` appelé 2× (`'app-config'` et `'app-config:nav'`).
- Succès → `logAuditEvent` appelé 1× avec `action:'app-config.update'`, `resourceId:'nav'`,
  `meta.version` = version retournée par l'upsert.
- Échec (422/409) → `revalidateTag` 0× et `logAuditEvent` 0×.

## Points à vérifier — tous points de vue
- Backend : ordre des gardes, `Number(ifMatch)` NaN, `'payload' in body`, 422 fait main vs HttpError,
  2 `revalidateTag` distincts, `meta.isDefault` forcé false.
- Frontend : ces codes sont consommés par `NavEditor` (N08) — alignement des messages.
- UI/UX : N/A (contrat).
- Data : `upsertAppConfig` reçoit `expectedVersion` exact + `actorId` = `session.adminId` ; audit
  capte `version/snapshotId/note`.
- A11y : N/A.
- i18n : messages serveur FR ; l'UI les remplace par ses propres libellés.
