# F05 — Contrat API `POST /api/admin/coupons/[id]/status`

## Rôle & surface
Transition de statut d'un coupon (`draft` → `active` → `paused` → `archived`) déclenchée par
l'opérateur depuis `CouponsManager`. Acte de **mise en ligne** ⇒ permission `publish` (et non
`write`). Effet immédiat sur `/kit` via `revalidateTag(coupons)` + `revalidateTag(products)`.
Fichier cible : `src/app/api/admin/coupons/[id]/status/route.ts`. Couche **I** (intégration / contrat),
repo en `memoryStore`, auth/role mockés.

## Fonctionnement optimal (ce qui DOIT se passer)
1. `getAdminSession()` → session présente.
2. `requireCouponPermission('publish', session)` → le rôle a le droit `publish` sur `coupons`.
3. `ctx.params` (sync ou Promise) résout `{ id }`.
4. Corps JSON parsé puis validé par `couponStatusActionSchema` = `{ status: enum(draft|active|paused|archived) }`.
5. `getCouponById(id)` → coupon existant.
6. **Garde archivé** : si `current.status === 'archived'` et `target !== 'archived'` → conflit (verrou
   irréversible : un coupon archivé ne se réactive jamais).
7. `setCouponStatus(id, target)` → coupon mis à jour, `revalidateTag` x2, `logAuditEvent` (`coupons.status`,
   meta `{ from, to }`).
8. Réponse `200 { coupon: <updated> }` avec `coupon.status === target`.

## Contrat I/O
- **Méthode/chemin** : `POST /api/admin/coupons/:id/status`. Signature `POST(request, ctx)` avec
  `ctx.params = { id }` (ou `Promise<{ id }>`).
- **Body** : `{ "status": "active" }`. JSON `content-type: application/json`.
- **Réponse OK** : `200 { coupon: { id, status, ... } }`.
- **Réponses erreur** (via `formatErrorResponse`, enveloppe `{ error: { code, message, details? } }`) :
  - `401 unauthorized` — session absente.
  - `403 forbidden` — rôle sans droit `publish`.
  - `404 not_found` — id inconnu.
  - `409 conflict` — `archived` → autre statut.
  - `422` — JSON valide mais statut hors enum → `{ error: { code: 'validation_failed', message: 'Statut invalide', details } }` (réponse construite à la main, PAS via HttpError).
  - `400 invalid_input` — corps non-JSON (`HttpError('invalid_input')` → 400).
- **Effets de bord** : `revalidateTag(COUPONS_TAG)`, `revalidateTag(PRODUCTS_TAG)`, `logAuditEvent`.

## Cas limites & non-happy-path
- JSON malformé (`request.json()` throw) → `400 invalid_input` (distinct du `422` schéma).
- `status` absent / valeur libre (`"on"`, `"ACTIVE"`, `42`, `null`) → `422 validation_failed`.
- `archived` → `active`/`paused`/`draft` → `409 conflict` ; **`archived` → `archived` autorisé** (idempotent, 200).
- `active` → `archived` autorisé (sens du verrou : seul le départ d'`archived` est bloqué).
- Ordre des gardes : 401 (session) PRIME sur 403 ; 403 PRIME sur 422 ; 422 (validation corps) PRIME sur 404 ;
  la garde 409 archivé est évaluée APRÈS le 404 (coupon doit exister).
- `ctx.params` fourni en `Promise` ⇒ `await Promise.resolve(ctx.params)` ne casse pas.
- Pas de `revalidateTag`/`logAuditEvent` sur un échec (401/403/404/409/422).

## Invariants couverts
- **INV-PERM** : transition de statut = `publish` strict (un rôle `read`/`write` sans `publish` → 403).
- Verrou archivage (lacune audit « lock archived → 409 »).
- Effet ISR `/kit` (revalidation déclenchée uniquement au succès).

## Critères d'acceptation (observables)
- `res.status === 200` et `(await res.json()).coupon.status === 'active'` sur transition valide.
- Rôle viewer/non-publish → `res.status === 403`, `body.error.code === 'forbidden'`.
- Session nulle → `401`, `body.error.code === 'unauthorized'`.
- Id inconnu → `404`, `body.error.code === 'not_found'`.
- `archived`→`active` → `409`, `body.error.code === 'conflict'`.
- Statut hors enum → `422`, `body.error.code === 'validation_failed'`.
- `revalidateTag` appelé 2× au succès ; 0× en cas d'échec (spy).

## Points à vérifier — tous points de vue
- Backend : ordre des gardes, `await Promise.resolve(ctx.params)`, mapping `conflict`→409, `validation_failed`→422.
- Frontend : 409/403 doivent remonter un `role="alert"` lisible dans `CouponsManager` (couvert en F02).
- UI/UX : verrou archivé doit désactiver le bouton réactiver côté UI (F02).
- Data : `logAuditEvent` capte `{ from, to }` exacts ; aucune écriture si échec.
- A11y : N/A (contrat).
- i18n : message d'erreur FR ; l'UI traduit côté client.
