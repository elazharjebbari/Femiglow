# F07 — Contrat API `GET /api/admin/coupons/grants`

## Rôle & surface
Liste des crédits de fidélité émis (Phase 3), affichée dans la section « Codes de fidélité émis »
de `CouponsManager` (F04). Filtres `?phone=&status=`. Auth + RBAC `read`. **Téléphone MASQUÉ** dans
chaque item (`maskPhone` : `+212…78`). Fichier cible :
`src/app/api/admin/coupons/grants/route.ts`. Couche **I**. Le test existant
`grants/route.test.ts` couvre masquage + filtre phone + 403 ; on **étend** dans un nouveau fichier
`grants/route.filters.test.ts` (filtre status, combinaison, résultat vide, 401, total).

## Fonctionnement optimal (ce qui DOIT se passer)
1. `getAdminSession()` → session présente.
2. `requireCouponPermission('read', session)` → rôle avec `read`.
3. Lecture des query params : `phone` (trim, `undefined` si vide), `status` (cast `GrantStatus`).
4. `listGrants({ phoneE164: phone, status })` → lignes triées `createdAt desc`.
5. Sérialisation par item : `{ id, code, phone: maskPhone(phoneE164), valueCents, currency, status,
   activatesAt, expiresAt, sourceOrderId, redeemedOrderId, createdAt }` (dates ISO ou `null`).
6. Réponse `200 { items, total: items.length }`.

## Contrat I/O
- **Méthode/chemin** : `GET /api/admin/coupons/grants?phone=&status=`.
- **Réponse OK** : `200 { items: GrantItem[], total: number }`. `total === items.length`.
- **Masquage** : `item.phone` = `+212…78` (4 premiers + `…` + 2 derniers) ; jamais le numéro complet.
  `maskPhone(null) === '—'` ; numéro < 6 chars → `'***'`.
- **Filtres** : `phone` = égalité exacte sur `phoneE164` (driver mémoire : `g.phoneE164 === phone`) ;
  `status` ∈ `issued|redeemed|expired`. Combinables (AND).
- **Erreurs** : `401 unauthorized` (pas de session), `403 forbidden` (rôle sans `read`).

## Cas limites & non-happy-path
- **Filtre status** : `?status=redeemed` ne renvoie que les grants `redeemed`.
- **Filtres combinés** : `?phone=+212600000001&status=issued` → intersection (les deux conditions).
- **Résultat vide** : filtre ne matchant rien → `200 { items: [], total: 0 }` (pas d'erreur).
- **Param phone vide** (`?phone=`) → traité comme absent (`undefined`), liste complète.
- **PII** : aucun item ne doit contenir la sous-chaîne du numéro brut (ex. `612345`).
- **Tri** : items ordonnés `createdAt` décroissant (le plus récent d'abord).
- **status invalide** (`?status=foo`) : passé tel quel à `listGrants` ; le driver mémoire filtre par
  égalité stricte ⇒ aucun match ⇒ `items: []` (pas de 422 sur ce param).
- Rôle sans `read` → `403` (PRIME sur tout).

## Invariants couverts
- **INV-PII** : téléphone jamais en clair côté admin.
- **INV-PERM** : lister grants = `read`.
- Filtres `phone`/`status` (lacune audit « filtres grants »).

## Critères d'acceptation (observables)
- `body.items[i].phone` matche `/…/` et ne contient PAS la portion sensible du numéro.
- `body.total === body.items.length`.
- `?status=redeemed` → tous les `items[i].status === 'redeemed'`.
- `?phone=X&status=issued` → items respectant les deux conditions.
- Filtre non-matchant → `items.length === 0 && total === 0`.
- Session nulle → `401` ; rôle sans `read` → `403`.

## Points à vérifier — tous points de vue
- Backend : trim phone, cast status, AND des filtres, `total === items.length`, tri desc.
- Frontend : F04 consomme `phone` masqué tel quel (jamais de re-démasquage).
- UI/UX : champ de filtre status = select `issued|redeemed|expired` ; vide = tous.
- Data : `maskPhone` appliqué à 100 % des items ; dates ISO valides ou `null`.
- A11y / i18n : N/A (contrat).
