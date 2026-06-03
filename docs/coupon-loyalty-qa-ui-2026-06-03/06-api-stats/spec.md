# F06 — Contrat API `GET /api/admin/coupons/[id]/stats`

## Rôle & surface
Agrégats d'incrémentalité (treatment vs holdout) + uplift, alimentant le panneau stats de
`CouponsManager`. Lecture seule ⇒ permission `read`. Fichier cible :
`src/app/api/admin/coupons/[id]/stats/route.ts`. Couche **I**. Les comptes proviennent de
`countByPhaseAndBucket(id)` (events semés en mémoire), l'agrégation par `computeCouponStats` (PUR,
déjà testé en unit dans `stats.test.ts` — ici on teste le **branchement** et le **contrat**).

## Fonctionnement optimal (ce qui DOIT se passer)
1. `getAdminSession()` → session présente.
2. `requireCouponPermission('read', session)` → rôle avec droit `read`.
3. `ctx.params` → `{ id }`.
4. `getCouponById(id)` → coupon existant.
5. `countByPhaseAndBucket(id)` → tableau `{ phase, bucket, count }[]`.
6. `computeCouponStats(counts)` → objet `stats`.
7. Réponse `200 { couponId: id, stats }`.

## Contrat I/O
- **Méthode/chemin** : `GET /api/admin/coupons/:id/stats`. Signature `GET(_request, ctx)`,
  `ctx.params = { id }` (ou Promise).
- **Réponse OK** : `200 { couponId: string, stats: CouponStats }` où `CouponStats` =
  `{ exposed:{treatment,holdout}, converted:{treatment,holdout}, conversionRate:{treatment|null,holdout|null}, upliftAbsolute:number|null, upliftRelative:number|null, noControl:boolean, lowSample:boolean }`.
- **Erreurs** : `401 unauthorized` (pas de session), `403 forbidden` (rôle sans `read`),
  `404 not_found` (id inconnu). Enveloppe `{ error: { code, message } }`.
- **Seuils internes** : `lowSample = (exposed.treatment + exposed.holdout) < 100` ;
  `noControl = exposed.holdout === 0` ; `conversionRate.x = conv/exp` ou `null` si `exp === 0`.

## Cas limites & non-happy-path
- **Holdout exposé = 0** → `noControl: true`, `upliftAbsolute: null`, `upliftRelative: null`,
  `conversionRate.holdout: null`.
- **Échantillon < 100** (somme expositions) → `lowSample: true` (lecture non fiable signalée à l'UI).
- **Échantillon ≥ 100** → `lowSample: false`.
- **Treatment et holdout présents, conversions présentes** → `upliftAbsolute` = différence de taux ;
  `upliftRelative` = `treatment/holdout − 1` (et `null` si `holdout` rate = 0).
- **Aucun event** (`counts === []`) → tout à 0/null, `noControl: true`, `lowSample: true`.
- Id inconnu → `404` (avant tout calcul).
- Rôle sans `read` → `403` (PRIME sur 404).

## Invariants couverts
- **INV-PERM** : lecture stats = `read` (un rôle sans `read` → 403).
- Robustesse division-par-zéro / `noControl` / `lowSample` branchés correctement (lacune audit agrégation uplift).

## Critères d'acceptation (observables)
- `res.status === 200`, `body.couponId === id`, `body.stats` conforme à `CouponStats`.
- Holdout=0 → `body.stats.noControl === true && body.stats.upliftAbsolute === null`.
- Somme expo < 100 → `body.stats.lowSample === true`.
- Conversions treatment/holdout présentes → `body.stats.upliftAbsolute` ≈ `taux_t − taux_h` (tolérance flottante).
- Rôle sans read → `403 forbidden` ; id inconnu → `404 not_found`.

## Points à vérifier — tous points de vue
- Backend : branchement `countByPhaseAndBucket → computeCouponStats`, garde 404 avant calcul, RBAC `read`.
- Frontend : `noControl`/`lowSample` doivent piloter un libellé prudent côté `CouponsManager` (F03).
- UI/UX : pas d'affichage `%` brut (charte) — l'UI formate ; le contrat reste numérique.
- Data : les `counts` reflètent fidèlement les events semés (phase/bucket).
- A11y / i18n : N/A (contrat).
