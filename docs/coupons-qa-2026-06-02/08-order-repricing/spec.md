# CPN-08 — Repricing commande server-authoritative (coupon-aware)

> Périmètre : `apps/web/src/lib/checkout/repos/order-repo.ts` → `orderRepo.createOrder(input)`
> (le repricing, ~ligne 188-211) **+** la route `apps/web/src/app/api/checkout/order/route.ts` → `POST`.
> Criticité **P0 — LA ZONE LA PLUS CRITIQUE DU SYSTÈME**. C'est ici que se joue
> l'INVARIANT MAÎTRE (`G-PRICE-PARITY`) : **prix AFFICHÉ == prix FACTURÉ**.
> Tout écart est rejeté en **HTTP 422 `price_mismatch`**. Aucune fraude de prix
> par le client n'est tolérée : **le serveur est autoritaire**.

---

## (a) Fonctionnement optimal

### Principe directeur

Le serveur **ne fait jamais confiance** au prix envoyé par le client. À chaque
commande, il **recalcule** le total de zéro à partir des prix de référence
(`product_variants`) **et du même contexte coupon que l'affichage**, puis le
compare à `expectedTotalCents` transmis par le client.

- Si `computedTotal === expectedTotalCents` → commande acceptée, `order.totalCents = computedTotal`.
- Si `computedTotal !== expectedTotalCents` → `PriceMismatchError` → **422 `price_mismatch`**.

### Le changement coupon-aware (cœur de CPN-08)

Aujourd'hui (legacy), le repricing fait par SKU (~ligne 199) :

```ts
const effectivePrice = v.promoPriceCents ?? v.priceCents;
```

Il doit devenir **coupon-aware** en passant par `resolveProductPricing` avec le
**MÊME `couponContext`** que celui utilisé à l'affichage `/kit` (CPN-04/CPN-05) :

```ts
const pricing = resolveProductPricing(
  { priceCents: v.priceCents, promoPriceCents: v.promoPriceCents, sku: it.sku },
  input.couponContext, // reconstruit depuis la requête (visitorKey, trafficSource, device, now)
);
const effectivePrice = pricing.effectivePriceCents;
```

La règle de fallback est **strictement** celle de `resolveProductPricing` :

1. **Coupon actif + éligible + bucket `treatment`** → `effectivePrice` = prix coupon
   (ex. 28900 − 9000 = **19900**).
2. **Coupon sélectionné mais bucket `holdout`** → `effectivePrice` = `computePromo(price, promoPriceCents)`
   (le prix de repli, PAS le prix coupon). En Phase 1 `holdoutPct = 0` → branche théorique.
3. **Aucun coupon (legacy / `couponContext` absent / coupon expiré entre affichage et commande)**
   → fallback exact `v.promoPriceCents ?? v.priceCents` (comportement legacy préservé).

> **Garantie de non-régression** : si `couponContext` est absent, le résultat
> DOIT être **identique** au code legacy (`v.promoPriceCents ?? v.priceCents`).
> Le coupon-aware ne change RIEN au comportement legacy quand il n'y a pas de
> coupon en jeu. C'est le filet de sécurité du rollback (CPN-17).

### CreateOrderInput gagne `couponContext`

`CreateOrderInput` (et le `createOrderInputSchema` Zod) gagnent un champ
**optionnel** `couponContext` (forme `CouponContext` de CPN-05, reconstruite
serveur depuis `req`). Optionnel pour ne pas casser les intégrations legacy.

### Détermination du `couponContext` côté route

La route reconstruit `couponContext` depuis la requête **avec le même
`visitorKey` que l'affichage** (CPN-05) : cookie/visitorKey, `trafficSource`,
`device`, `now` injecté. Le `visitorKey` DOIT être celui qui a servi au calcul
du bucket à l'affichage, sinon le bucket diverge → prix divergent → 422
(cf. risque R-08-5, test cross-surface).

### Après succès (chaîne inchangée)

`markPurchased(lead)` → `dispatchOrderWebhook` + `sendTransactional` +
`recordOrderPlaced`, le tout **fire-and-forget** (jamais bloquant). L'émission
de l'event `converted` (CPN-09) s'insère ici, **seulement si `!result.replayed`**.

---

## (b) Contrats I/O

### Payload (POST /api/checkout/order) — coupon-aware

```jsonc
{
  "leadId": "lead_…",                 // chat_lead avec addressCompletedAt requis
  "formContext": { "formId": "kit", "formMode": "wizard_embed", "variantKey": null },
  "items": [
    { "sku": "kit", "name": "Kit FemiGlow", "quantity": 1, "unitPriceCents": 19900 }
  ],
  "expectedTotalCents": 19900,        // total client, RE-VÉRIFIÉ serveur
  "currency": "MAD",
  "paymentMethod": "cod",
  "shippingMode": "standard",
  "couponContext": {                  // NOUVEAU (CPN-05), optionnel
    "visitorKey": "vk_abc123",        // MÊME clé que l'affichage
    "trafficSource": "paid_social",
    "device": "mobile"
    // now injecté serveur
  }
}
```

### Réponses

| Cas | HTTP | Body |
|---|---|---|
| Succès COD | `201` | `{ orderId, status:'pending_confirmation', totalCents, currency }` |
| Succès carte/virement | `201` | `{ orderId, status:'created', totalCents, currency }` |
| Total client ≠ total serveur | `422` | `{ error:{ code:'price_mismatch', message, details:{ expectedTotalCents, computedTotalCents } } }` |
| Stock insuffisant | `409` | `{ error:{ code:'stock_insufficient', message, details:{ variantId, sku, requested } } }` |
| SKU inconnu (et pas de fallback slug) | `400` | `{ error:{ code:'invalid_input', message, details:{ sku } } }` |
| Lead introuvable | `404` | `{ error:{ code:'not_found', … } }` |
| Adresse non finalisée | `4xx` | `{ error:{ code:'invalid_state', … } }` |
| Payload Zod invalide | `422` | erreur Zod (`zodErrorResponse`) |
| JSON invalide | `4xx` | `{ error:{ code:'invalid_json', … } }` |
| Replay idempotent | `201` | **même** body que l'original ; `result.replayed === true` |

> **Note contractuelle (autorité serveur)** : `order.totalCents` est écrit avec
> `input.expectedTotalCents` (voir order-repo ligne 243) — MAIS uniquement
> **après** que `computedTotal === expectedTotalCents` a été vérifié. Donc
> `order.totalCents === computedTotal === expectedTotalCents` (les trois sont
> égaux quand la commande passe). Le serveur n'« accepte » jamais un total qu'il
> n'a pas lui-même recalculé.

---

## (c) Points de vérification par axe

**Backend**
- `effectivePrice` calculé via `resolveProductPricing` avec `input.couponContext`.
- `computedTotal = Σ effectivePrice × quantity` sur tous les items.
- `computedTotal !== expectedTotalCents` ⇒ `PriceMismatchError` (jamais d'acceptation silencieuse).
- Fallback `couponContext` absent ≡ legacy `promoPriceCents ?? priceCents` (parité bit-à-bit).
- Fallback slug→primary variant (CHA-233) toujours opérationnel sous coupon-aware.
- `order.totalCents === computedTotal` après succès.

**Sécurité**
- Client envoie `expectedTotalCents` arbitraire (0, 1, 28900 alors que serveur calcule 19900, négatif bloqué Zod `nonnegative`) → jamais facturé au prix client ; 422.
- Client envoie `unitPriceCents` mensonger dans `items[]` → ignoré (le serveur ne lit que `sku` + `quantity` pour le prix) ; total recalculé serveur.
- Client envoie un `couponContext.visitorKey` forgé pour tomber en `treatment` → sans incidence Phase 1 (holdout=0, tout treatment) ; en Phase ≥2, le bucket reste déterministe (pas exploitable au-delà du coupon réellement actif).
- Pas de PII dans `couponContext` (visitorKey = hash anonyme).

**Data / intégrité**
- `order_items.unitPriceCents` = `effectivePrice` coupon-aware (pas le prix client).
- `Σ order_items.unitPriceCents × quantity === order.totalCents`.
- Devise cohérente entre payload, variant et coupon (`currency` length 3).
- Stock : réservé (CAS) puis **commit** après insert (sinon fuite `reserved`).

**Performance**
- Un seul `select … where inArray(sku)` (+ fallback slug si besoin). `resolveProductPricing` = O(1) par item. Budget route < 150 ms hors I/O DB.
- Pas de N+1 sur les variants.

**Idempotence**
- `withIdempotency({ scope:'order_create', payload:input })` : double POST même Idempotency-Key → un seul `orders` créé ; 2e réponse = replay (`result.replayed === true`), même body, **pas** de 2e stock commit, **pas** de 2e event converted (CPN-09).
- Payload différent sous même clé → conflit idempotence (selon middleware) — documenter comme rejet.

**Observabilité / logs**
- `logger.info('checkout.order.created', { orderId, leadId, replayed })`.
- `logger.error('checkout.order.failed', …)` sur erreur non typée.
- Le 422 `price_mismatch` expose `details.expectedTotalCents` + `details.computedTotalCents` (diagnostic mismatch).
- L'écart affichage↔caisse doit être traçable (event converted CPN-09 porte `amountCents` = remise).

**Frontend (parcours opérateur, via E2E)**
- Le wizard envoie l'`expectedTotalCents` issu du **snapshot panier** (CPN-07), lui-même issu du **même** `resolveProductPricing` que l'affichage `/kit` (CPN-06).
- Donc, en conditions nominales, l'utilisateur ne voit JAMAIS un 422 : le prix affiché (19900) est exactement le prix facturé (19900).
- Si un 422 survient (course coupon, cf. matrice), l'UI affiche un message de re-synchronisation prix (pas de crash, pas de double débit).

---

## (d) Edge cases & matrice d'états

| # | État | Entrée (kit, prix nu 28900, promo 19900, coupon −90) | Serveur calcule | Résultat |
|---|---|---|---|---|
| 1 | **Nominal coupon treatment** | couponContext actif, `expectedTotalCents=19900` | 19900 | **201**, `totalCents=19900` |
| 2 | **Nominal qty>1** | coupon treatment, qty=2, `expected=39800` | 2×19900=39800 | **201**, `totalCents=39800` |
| 3 | **Limite : total = prix nu** | pas de coupon, pas de promo, `expected=28900` | 28900 | **201**, `totalCents=28900` |
| 4 | **Invalide : total client menteur (sans coupon)** | client envoie `expected=28900` mais serveur (coupon) calcule 19900 | 19900 | **422** `price_mismatch` (expected 28900 ≠ computed 19900) |
| 5 | **Invalide : client sous-paie** | client envoie `expected=10000`, serveur 19900 | 19900 | **422** (expected 10000 ≠ 19900) |
| 6 | **Invalide : total 0** | client `expected=0`, serveur 19900 | 19900 | **422** |
| 7 | **Course : coupon expiré entre affichage et commande** | client avait vu 19900, envoie `expected=19900` ; au moment commande coupon `endsAt` dépassé → resolveProductPricing fallback `promoPriceCents`=19900 | **19900** (promo de repli identique) | **201** (cohérent — promo couvre) |
| 8 | **Course : coupon expiré ET promo retirée** | client envoie `expected=19900` ; coupon off ET `promoPriceCents=null` → fallback `priceCents`=28900 | 28900 | **422** (expected 19900 ≠ computed 28900) — course documentée |
| 9 | **Holdout treatment (Phase 1)** | holdoutPct=0 → toujours treatment, `expected=19900` | 19900 | **201** |
| 10 | **Holdout (théorique Phase ≥2)** | bucket holdout → prix de repli `promoPriceCents`=19900 ; client a vu 19900 | 19900 | **201** (l'affichage holdout montrait déjà le repli) |
| 11 | **Cross-surface : bucket divergent** | `couponContext.visitorKey` de la commande ≠ celui de l'affichage → bucket différent (Phase ≥2) → prix différent | ≠ affiché | **422** (R-08-5) |
| 12 | **SKU inconnu** | item `sku='zzz'` sans fallback slug | — `UnknownSkuError` | **400** `invalid_input` |
| 13 | **Stock insuffisant** | coupon OK, stock variant = 0 | prix OK mais réserve échoue | **409** `stock_insufficient` |
| 14 | **Idempotence : double POST même clé** | 2 POST identiques, même Idempotency-Key | 19900 | 1er **201** ; 2e **201** replay (même orderId, même body, `replayed=true`), un seul order |
| 15 | **Legacy : sans couponContext** | payload sans `couponContext`, `expected=19900` (promo) | `promoPriceCents`=19900 | **201** (parité legacy) |
| 16 | **Concurrence : 2 leads, dernier stock** | 2 commandes simultanées, stock=1 | CAS atomique | 1× **201**, 1× **409** |
| 17 | **Cache : candidats coupon mis en cache (CPN-18)** | resolveProductPricing relit candidats mais recalcule bucket | prix cohérent affichage | **201** (bucket jamais figé) |

---

## (e) Risques

| ID | Risque | Impact | Mitigation testée |
|---|---|---|---|
| R-08-1 | Repricing PAS coupon-aware (reste `promoPriceCents ?? priceCents`) alors que l'affichage applique le coupon | **422 systématique** sur tout le trafic → conversion à zéro | Cas 1/2 : 201 + `totalCents=prix coupon` ; E2E /kit→order sans 422 |
| R-08-2 | Client falsifie `expectedTotalCents` / `unitPriceCents` | Fraude de prix (paie moins) | Cas 4/5/6 : 422 ; serveur ignore prix client |
| R-08-3 | Course coupon expiré → mismatch | 422 sur un vrai client de bonne foi | Cas 7 (promo couvre→201) + cas 8 (documenté 422) |
| R-08-4 | Fallback legacy cassé par l'ajout coupon-aware | Régression sur trafic sans coupon | Cas 15 : parité bit-à-bit avec legacy |
| R-08-5 | `visitorKey` du checkout ≠ celui de l'affichage → bucket divergent | 422 intermittent (Phase ≥2) | Cas 11 cross-surface ; CPN-05 garantit même clé |
| R-08-6 | Double POST crée 2 orders / double commit stock | Double débit / stock corrompu | Cas 14 idempotence ; un seul order, un seul commit |
| R-08-7 | `order.totalCents` écrit avec un total non vérifié | Facture incohérente | Vérif `totalCents===computedTotal===expected` |
| R-08-8 | Émission event converted bloque/échoue la commande | Commande perdue à cause d'un log | CPN-09 fire-and-forget ; ici : succès commande même si event échoue |
| R-08-9 | Coupon-aware appliqué EN PLUS de `promoPriceCents` (double remise) | Prix < attendu, marge perdue | resolveProductPricing prend coupon OU promo, jamais les deux empilés (CPN-04/17) |

---

## (f) Critères d'acceptation testables

- **AC-08-1** : coupon actif treatment, `expectedTotalCents=19900` → **201**, `body.totalCents===19900`, `order_items[0].unitPriceCents===19900`.
- **AC-08-2** : qty=2 coupon treatment, `expected=39800` → **201**, `totalCents===39800`.
- **AC-08-3** : client envoie `expected=28900` alors que serveur calcule 19900 → **422** `price_mismatch`, `details.expectedTotalCents===28900 && details.computedTotalCents===19900`. Aucun `orders` créé.
- **AC-08-4** : client envoie `expected=10000` (sous-paiement) → **422** ; aucun order.
- **AC-08-5** : course — coupon expiré mais `promoPriceCents=19900`, client `expected=19900` → **201** (fallback promo couvre).
- **AC-08-6** : course — coupon off ET `promoPriceCents=null`, client `expected=19900` → **422**, `computedTotalCents===28900`.
- **AC-08-7** : Phase 1 (holdout=0) → toujours treatment, jamais de branche holdout exécutée ; `bucket==='treatment'`.
- **AC-08-8** : SKU inconnu sans fallback slug → **400** `invalid_input`, `details.sku` présent.
- **AC-08-9** : stock=0 → **409** `stock_insufficient`, `details.sku` présent, aucun order persisté.
- **AC-08-10** : double POST même Idempotency-Key → **un seul** `orders` ; 2e réponse `replayed===true`, body identique ; stock commit une seule fois.
- **AC-08-11** : payload SANS `couponContext` → résultat **strictement identique** au repricing legacy (`promoPriceCents ?? priceCents`).
- **AC-08-12** (E2E) : parcours réel /kit → lead → adresse → commande, coupon welcome_auto actif → **aucun 422**, `order.totalCents === prix affiché sur /kit`.
- **AC-08-13** : `order.totalCents === computedTotal === expectedTotalCents` à chaque succès (jamais d'écart).
