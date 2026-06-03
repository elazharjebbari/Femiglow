# F15 — Contrat API `POST /api/coupons/rescue`

## Rôle & surface
Résolution **server-side** de l'offre de sauvetage (Phase 2), appelée par le client APRÈS un signal
d'engagement (exit-intent / scroll profond, visiteur non converti). Le serveur (autoritaire) décide
du bucket via le contexte (cookie), **journalise un événement `exposed` pour treatment ET holdout**
(dénominateurs comparables), et renvoie `show = (bucket === 'treatment')`. **Aucun effet prix**
(avantage non monétaire). **Publique, sans auth, best-effort** : un échec de log ne bloque jamais la
réponse, et toute exception → `{ show:false }`. Fichier cible :
`src/app/api/coupons/rescue/route.ts`. Couche **I**. Le test existant `rescue/route.test.ts` couvre
3 cas (R001 pas de rescue, R002 holdout=0, R003 holdout=100) ; on **étend**.

## Fonctionnement optimal (ce qui DOIT se passer)
1. `buildCouponContext({ referer, userAgent, sessionId })` — `sessionId` = `fg_session_id` puis fallback `_fbp` puis `null`.
2. `resolveRescueCoupon(ctx)` → `null` si aucun coupon rescue actif éligible.
3. Si `null` → `200 { show:false }` (pas d'event).
4. Sinon, journalise `recordCouponEvent({ couponId, phase:'exposed', bucket, visitorKey, trafficSource, device })`
   en best-effort (try/catch silencieux).
5. Réponse `200 { show: resolved.bucket === 'treatment' }`.
6. Toute exception (context/engine) → `200 { show:false }` (jamais d'erreur visible).

## Contrat I/O
- **Méthode/chemin** : `POST /api/coupons/rescue`. Pas de body requis ; cookies `fg_session_id` / `_fbp`,
  headers `referer` / `user-agent` alimentent le contexte.
- **Réponse** : toujours `200 { show: boolean }`. Jamais de 4xx/5xx au client.
- **Bucket** : `treatment` → `show:true` ; `holdout` → `show:false`. Déterminé par
  `(visitorKey, couponId)` + `holdoutPct` (INV-BUCKET).
- **Effet de bord** : exactement 1 event `exposed` (phase) par appel résolu, avec le `bucket` réel
  (treatment OU holdout) — les deux buckets sont loggés pour des dénominateurs comparables.

## Cas limites & non-happy-path
- **Aucun coupon rescue actif** → `show:false`, **0 event** journalisé.
- **holdout=0** (tout traité) → `bucket=treatment` → `show:true` + 1 event `exposed/treatment`.
- **holdout=100** (tout en contrôle) → `bucket=holdout` → `show:false` MAIS 1 event `exposed/holdout`
  (contrôle compté — clé de la mesure d'incrémentalité).
- **Échec du log** (`recordCouponEvent` throw) → la réponse `show` reste correcte (best-effort, non bloquant).
- **Exception amont** (`buildCouponContext`/`resolveRescueCoupon` throw) → `200 { show:false }`.
- **Déterminisme bucket** : même `fg_session_id` + même coupon ⇒ même bucket (stable entre appels).
- **Fallback sessionId** : sans `fg_session_id`, `_fbp` sert de clé ; sans aucun, `null` (bucketing dégradé mais sans crash).

## Invariants couverts
- **INV-BUCKET** : bucket déterministe et stable par `(visitorKey, couponId)`.
- Journalisation symétrique treatment + holdout (dénominateurs comparables pour F06 stats).
- Best-effort public : jamais d'erreur côté visiteur (lacune audit « rescue côté opérateur / robustesse »).

## Critères d'acceptation (observables)
- Pas de rescue actif → `body.show === false` ET `countByPhaseAndBucket(coupon)` ne contient aucun `exposed` (aucun coupon).
- holdout=0 → `body.show === true` ET au moins un event `exposed/treatment`.
- holdout=100 → `body.show === false` ET au moins un event `exposed/holdout`.
- `recordCouponEvent` qui throw → `res.status === 200` et `body.show` conforme au bucket.
- Exception engine → `res.status === 200 && body.show === false`.

## Points à vérifier — tous points de vue
- Backend : symétrie d'event treatment/holdout, try/catch log non bloquant, catch global → show:false.
- Frontend : F09/F12 n'affichent l'offre que si `show:true` ; aucune offre si erreur réseau.
- UI/UX : avantage non monétaire (cadeau) — pas de ligne prix, charte respectée.
- Data : 1 event `exposed` par appel résolu, bucket exact ; aucun event si pas de coupon.
- A11y / i18n : N/A (contrat) ; l'offre rendue est testée côté composant.
