# F19 — Intégration pricing : parité prix affiché == prix facturé (anti-422 + holdout + sélection)

## Rôle & surface
Verrouiller, **au point d'intégration**, l'invariant central du système : **le prix que la cliente
voit est exactement le prix qu'on lui débite**. Bien que la couche soit `I` (intégration, Vitest pur,
`memoryStore` + horloge injectée), chaque oracle se traduit par une **conséquence vécue dans l'UI** :
le montant affiché sur `/kit`, le récap du wizard, la ligne « économie » terracotta, et surtout
l'**absence d'erreur 422** au moment où la cliente valide sa commande.

Surface logique : `apps/web/src/lib/coupons/engine.ts` —
`resolveProductPricing` (source UNIQUE des trois points : affichage Server Component, snapshot wizard,
re-pricing order-repo), via `selectCoupon` + `computeResolvedPricing` + `applyCoupon`, en s'appuyant
sur `eligibility.ts`, `bucketing.ts`, `context.ts`. Point d'issuance/repricing observé :
`apps/web/src/app/api/checkout/order/route.ts` (envoi de `expectedTotalCents`, `PriceMismatchError`→422).

Fichier de test : `src/lib/coupons/pricing-integration.test.ts`.

## Fonctionnement optimal (ce qui DOIT se passer)
1. **Parité tri-points (INV-PRICE).** Pour un même `PricingInput` + `CouponContext` + `now`,
   `resolveProductPricing` renvoie la **même** `ResolvedPricing` quel que soit l'appelant (affichage,
   snapshot, order). On l'asserte en appelant la fonction trois fois avec les mêmes entrées et en
   comparant la sortie complète (`finalPriceCents`, `active`, `coupon.bucket`). Conséquence UI : le
   `199 MAD` montré sur `/kit` est le `199 MAD` débité ; aucune dérive entre écrans.
2. **Éligibilité évaluée DANS le contexte checkout.** `selectCoupon` filtre par `isCandidate`
   (actif + fenêtre + éligible + `target=product_price`). Un coupon réservé `trafficSource=meta`
   n'est retenu que si le contexte le porte ; sinon prix plein. Le contexte d'affichage et le contexte
   checkout sont reconstruits à partir des **mêmes primitives** (referer/UA/session → `visitorKey`
   identique) — c'est ce qui garantit qu'un coupon visible à l'affichage l'est encore au checkout.
3. **Holdout (INV-BUCKET).** Pour un visiteur en `holdout` : la `ResolvedCouponRef` est **conservée**
   (`coupon.bucket==='holdout'`, pour le tracking d'incrémentalité) MAIS le prix reste **plein**
   (`active:false`, `finalPriceCents===priceCents`). Le groupe contrôle voit le prix normal ; le
   groupe `treatment` voit la remise. Le bucket est **déterministe et stable** sur `(visitorKey,couponId)`
   → identique affichage/checkout → pas de mismatch.
4. **Plancher & garde non-prix.** `applyCoupon` ne renvoie jamais de prix négatif ; `percent=100`,
   `percent=0`, montant fixe ≥ prix → `active:false`, prix plein. Un coupon `target !== 'product_price'`
   (ex. `rescue`, `future_credit`) passé par erreur → ignoré, prix plein, `coupon:null`.
5. **Anti-422 (INV-422).** `expectedTotalCents` envoyé par le client == prix d'affichage résolu (après
   crédit, plancher 0). Tant que la source unique est respectée et le bucket stable, le re-pricing
   serveur recalcule **la même valeur** → pas de `PriceMismatchError`. À l'inverse, un
   `expectedTotalCents` divergent (ex. UI stale, manipulation) → `PriceMismatchError` → **HTTP 422**
   (`error.code==='price_mismatch'`). Conséquence UI : la cliente est bloquée plutôt que débitée d'un
   mauvais montant.
6. **Non-cumul + tie-break (INV-NONCUMUL).** `selectCoupon` retient **un seul** coupon prix à la fois ;
   tri déterministe : `priority` desc → `createdAt` asc → `id` asc. Deux coupons éligibles → seul le
   gagnant s'applique (une seule ligne « économie » dans le récap).

## Contrat I/O
- `resolveProductPricing(input: PricingInput, ctx: CouponContext): Promise<ResolvedPricing>` — source
  unique. `computeResolvedPricing(input, coupon, ctx)` — variante PURE (coupon déjà sélectionné).
- `selectCoupon(coupons: CouponDef[], ctx, now): CouponDef | null` — filtre `isCandidate` + tri.
- `applyCoupon(priceCents, coupon): PromoComputation` — calcul pur, jamais négatif.
- `pickBucket(visitorKey, couponId, holdoutPct): 'treatment' | 'holdout'`.
- `ResolvedPricing` = `PromoComputation` (`active`, `priceCents`, `promoPriceCents`/`finalPriceCents`)
  + `coupon: ResolvedCouponRef | null` (`{ id, type, mode, bucket }`).
- Point order (observé pour l'oracle UI) : `POST /api/checkout/order` avec `expectedTotalCents`.
  Mismatch → réponse `{ error: { code: 'price_mismatch', ... } }`, statut **422**.
- Déterminisme : `now` injecté via `ctx.now`, jamais `Date.now()` dans les oracles.

## Cas limites & non-happy-path
- **Aucun coupon éligible** → `selectCoupon` null → fallback `computePromo(price, promoPriceCents)`,
  `coupon:null`. Prix plein ou promo legacy, jamais de crash.
- **Coupon hors fenêtre** (`now < startsAt` ou `now > endsAt`) → exclu (frontière incluse testée).
- **Coupon `status !== 'active'`** (draft/paused/archived) → exclu.
- **Éligibilité exigée mais absente du contexte** (`trafficSources=['meta']`, contexte sans source)
  → NON éligible → prix plein. C'est la garde « on ne devine pas ».
- **`visitorKey` absent/vide** → toujours `treatment` (jamais de holdout sans clé stable, sinon le
  bucket varierait entre affichage et checkout → mismatch prix).
- **`holdoutPct=0`** → `treatment` (remise pour tous) ; **`holdoutPct=100`** → `holdout` (si visitorKey
  présent) → prix plein + ref conservée.
- **Devise coupon ≠ devise variante** → coupon ignoré, fallback, `coupon:null`.
- **`percent=100`/`percent=0`/fixed ≥ prix** → `active:false`, prix plein (0 n'est pas une promo).
- **Coupon `target='rescue'`/`'future_credit'`** passé à `computeResolvedPricing` → ignoré, prix plein.
- **Tie-break** : deux coupons même `priority` → le plus ancien `createdAt` gagne ; égalité `createdAt`
  → `id` lexicographiquement plus petit.
- **Stale UI / mismatch (INV-422)** : `expectedTotalCents` ≠ prix résolu → 422 `price_mismatch`.

## Invariants couverts
- **INV-PRICE** : `resolveProductPricing` source unique ; parité affichage/snapshot/order (199 MAD).
- **INV-422** : `expectedTotalCents` == prix résolu (plancher 0) ; mismatch → `PriceMismatchError`/422.
- **INV-BUCKET** : `(visitorKey, couponId)` → bucket déterministe et stable entre Server Component et API.
- **INV-NONCUMUL** : un seul coupon prix appliqué ; tie-break priority>age>id.
- Lacune d'audit : aucune assertion d'**intégration** liant éligibilité-en-contexte + holdout + parité
  au point order ; les tests purs existants couvrent les briques mais pas leur composition au checkout.

## Critères d'acceptation (observables)
- Trois appels identiques de `resolveProductPricing` → sorties **strictement égales** (parité tri-points).
- Visiteur `treatment` : `active===true`, `finalPriceCents < priceCents`, `coupon.bucket==='treatment'`.
- Visiteur `holdout` : `active===false`, `finalPriceCents===priceCents`, `coupon.bucket==='holdout'`
  (ref **conservée**, prix **plein**).
- Contexte sans `visitorKey` → `coupon.bucket==='treatment'` même si `holdoutPct>0`.
- Coupon non éligible en contexte → `selectCoupon` null → `coupon===null`, prix plein.
- `applyCoupon` ne renvoie jamais `finalPriceCents < 0` ; `percent=0/100` → `active===false`.
- Deux candidats → `selectCoupon` renvoie celui de `priority` max, puis `createdAt` min, puis `id` min.
- `expectedTotalCents` aligné → pas de `price_mismatch` ; divergent → réponse `code==='price_mismatch'`
  / statut 422.

## Points à vérifier — tous points de vue
- Backend : `resolveProductPricing` appelée à l'identique aux trois points ; order-repo recalcule et
  compare à `expectedTotalCents` ; 422 sur écart.
- Frontend : le montant affiché provient de la même résolution ; pas de recalcul divergent côté client.
- UI/UX/design : une seule ligne « économie » terracotta (non-cumul) ; pas de `%` ; montants absolus.
- Data : `coupon.bucket` persisté pour le tracking incrémentalité, même en holdout (prix plein).
- A11y : hors scope (couche intégration) ; la conséquence UI est testée en F10/F11.
- i18n : montants en MAD ; parité indépendante de la langue.
- Sécurité : `visitorKey` = hash anonyme, jamais de PII ; mismatch bloque le débit erroné.
