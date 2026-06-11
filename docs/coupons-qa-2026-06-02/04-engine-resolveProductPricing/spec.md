# CPN-04 — Moteur `resolveProductPricing` (composition + fallback)

> Périmètre : `apps/web/src/lib/coupons/engine.ts` → `resolveProductPricing(input, ctx)`.
> **server-only**. Point de composition central du système : elle assemble
> `resolveCoupon` (CPN-03, sélection) + `applyCoupon` (CPN-02, math de prix) +
> le **bucketing holdout** (CPN-19), et **retombe** (`fallback`) sur
> `computePromo(priceCents, promoPriceCents)` (`apps/web/src/lib/utils/promo.ts`)
> quand aucun coupon ne s'applique.
> Criticité **P0** : c'est la fonction appelée **à l'identique** à l'affichage
> (`/kit`, CPN-06), au snapshot panier (CPN-07) et au repricing commande
> (`order-repo`, CPN-08). Toute divergence ici casse l'**invariant maître**
> (prix affiché == prix facturé → sinon `PriceMismatchError` 422).

---

## (a) Fonctionnement optimal

`resolveProductPricing` produit un objet `ResolvedPricing` qui **étend**
`PromoComputation` (même forme exacte) et y ajoute un champ `coupon`. Pipeline,
dans cet ordre exact :

1. **Charger les candidats** (en amont, via le contexte server : repo + cache
   tag `'coupons'`, cf. CPN-18). `resolveProductPricing` reçoit `ctx.candidates`
   déjà résolus ; elle n'effectue **aucune I/O bloquante de calcul**.
2. **Sélection** : `selected = resolveCoupon(ctx)` (CPN-03). Au plus un coupon,
   ou `null`.
3. **Décision sans coupon** (`selected === null`) → **fallback** :
   - `return { ...computePromo(input.priceCents, input.promoPriceCents), coupon: null }`.
   - Si `promoPriceCents` est `null`/absent → `computePromo` rend `active:false`,
     `effectivePriceCents === priceCents` (plein tarif). `coupon: null`.
4. **Décision avec coupon** (`selected !== null`) :
   - **Bucketing** (CPN-19) : `bucket = hash(visitorKey + couponId) % 100 < holdoutPct ? 'holdout' : 'treatment'` (déterministe).
     - `visitorKey == null` → **toujours `treatment`** (le bucket par défaut sert
       la remise ; choix produit : un visiteur sans clé n'est jamais privé de
       la promo — voir Risque R-04-7).
   - **bucket === 'treatment'** → le client **voit** la remise coupon :
     - `applied = applyCoupon(input.priceCents, selected)` (CPN-02) → renvoie un
       `PromoComputation` calculé depuis le coupon.
     - `return { ...applied, coupon: { id, type, mode, bucket:'treatment' } }`.
   - **bucket === 'holdout'** → le client **ne voit PAS** la remise coupon ;
     il retombe sur la promo « classique » :
     - `return { ...computePromo(input.priceCents, input.promoPriceCents), coupon: { id, type, mode, bucket:'holdout' } }`.
     - **Important** : `coupon` est **non-null** (le coupon a bien été *sélectionné*,
       il est juste *retenu en holdout*), mais le **prix** est celui de la promo
       de repli, pas celui du coupon. En **Phase 1 `holdoutPct === 0`** → cette
       branche n'arrive jamais en prod, mais le **contrat est testé** (anti-régression
       Phase 2/3).
5. **Forme préservée** : quel que soit le chemin, l'objet rendu expose
   **strictement** les 6 champs de `PromoComputation`
   (`active`, `effectivePriceCents`, `originalPriceCents`, `savingsCents`,
   `savingsPct`, `framing`) + `coupon`. Aucun champ retiré/renommé → **zéro
   régression aval** (PriceDisplay, tracking `ecommerce.value`, JSON-LD,
   snapshot, repricing consomment ces champs).

### Garde-fou « jamais d'exception » (DB / amont indisponible)

`resolveProductPricing` ne doit **jamais** propager d'exception vers l'appelant
(une page `/kit` ne plante pas pour un coupon). Si le chargement amont des
candidats échoue (DB down, cache miss + lecture KO), le contexte fournit
`candidates: []` (ou le wrapper attrape l'erreur) → `selected = null` →
**fallback silencieux** sur `computePromo`. Le résultat est alors **identique
au comportement pré-coupon** (la promo `promoPriceCents` classique). C'est ce
qui rend la bascule promo→coupon (CPN-17) **rollback-safe**.

---

## (b) Contrats I/O

### Signature

```ts
interface ProductPricingInput {
  priceCents: number;                 // prix plein (ex. 28900 = 289 MAD)
  promoPriceCents: number | null;     // promo « classique » de repli (ex. 19900 = 199 MAD)
  currency: string;                   // ex. 'MAD'
}

// ctx : CouponContext (CPN-03/CPN-05) + candidates déjà chargés
interface ResolvedPricing extends PromoComputation {
  coupon: {
    id: string;
    type: 'amount' | 'percent';       // type de remise du coupon
    mode: string;                     // ex. 'auto' | 'code' (mode d'application)
    bucket: 'treatment' | 'holdout';
  } | null;
}

function resolveProductPricing(
  input: ProductPricingInput,
  ctx: CouponContext,
): ResolvedPricing;   // server-only, synchrone une fois candidates chargés
```

> `PromoComputation` = `{ active, effectivePriceCents, originalPriceCents, savingsCents, savingsPct, framing }`
> (`apps/web/src/lib/utils/promo.ts`). `ResolvedPricing` n'ajoute QUE `coupon`.

### Invariants

- **INV-1 (déterminisme total)** : `(input, ctx)` identiques → `ResolvedPricing`
  identique, champ par champ. C'est le socle de l'invariant maître affichage↔caisse.
- **INV-2 (forme préservée)** : les 6 clés de `PromoComputation` sont **toujours**
  présentes, du bon type, sans clé surnuméraire hormis `coupon`.
- **INV-3 (fallback sans coupon)** : `selected===null` ⇒ résultat ===
  `{ ...computePromo(price, promo), coupon:null }` (égalité stricte de chaque champ).
- **INV-4 (plein tarif)** : `selected===null && promoPriceCents==null` ⇒
  `active:false`, `effectivePriceCents===priceCents`, `savingsCents===0`,
  `savingsPct===0`, `coupon:null`.
- **INV-5 (treatment montre la remise)** : `selected!=null && bucket==='treatment'`
  ⇒ `effectivePriceCents === applyCoupon(price, selected).effectivePriceCents`
  et `coupon.bucket==='treatment'`.
- **INV-6 (holdout = prix de repli, coupon non-null)** : `selected!=null && bucket==='holdout'`
  ⇒ prix == `computePromo(price, promo)` MAIS `coupon!=null` avec `bucket:'holdout'`.
- **INV-7 (jamais d'exception)** : toute défaillance amont ⇒ fallback silencieux,
  `coupon:null`, jamais de throw.
- **INV-8 (visitorKey null ⇒ treatment)** : `selected!=null && visitorKey==null`
  ⇒ `bucket==='treatment'` (sert la remise).

---

## (c) Points de vérification par axe

**Backend**
- Ordre du pipeline (sélection → bucket → applyCoupon|fallback) respecté.
- `coupon.bucket` cohérent avec la décision holdout (CPN-19) pour un `visitorKey` donné.
- Le fallback réutilise **exactement** `computePromo` (pas de recalcul local divergent).
- Branche holdout : prix de repli ET `coupon` non-null simultanément.

**Frontend** — *non applicable directement* (server-only). Vérifié en aval :
CPN-06 (PriceDisplay), CPN-14 (CouponWelcomeNote) consomment `ResolvedPricing`
sans flash SSR.

**UI/UX** — *non applicable* (pas de rendu ici). La cohérence d'affichage est
garantie par INV-2 (forme stable) en amont des composants.

**Design / charte** — *non applicable* (logique pure). Aucune chaîne de
copie/couleur produite ici.

**Data**
- `input.priceCents` / `promoPriceCents` en **centimes entiers** ; pas de
  flottants ni d'arrondi divergent (cohérent `computePromo`).
- `coupon.type`/`mode` lus depuis le `CouponRow` sélectionné (pas inventés).
- DB indisponible (candidates vides) → résultat = promo classique (data-safe).

**Sécurité**
- server-only : pas de fuite vers le bundle client (`server-only` en tête /
  via wrapper). Un `ctx` forgé ne peut pas faire baisser le prix au-delà de ce
  que `resolveCoupon` autorise (l'éligibilité tranche en amont).
- Pas de PII dans `coupon` (id/type/mode/bucket uniquement).

**Performance**
- Composition O(n log n) (dominée par le tri de `resolveCoupon`) sur n petit ;
  budget p95 < 5 ms hors I/O. Pas d'`await` réseau dans le corps de calcul.

**Accessibilité / i18n** — *non applicable* (server-only, aucune sortie texte).

**Observabilité**
- Le bucket choisi (`treatment`/`holdout`) doit pouvoir être journalisé en aval
  (CPN-09 `exposed`) **sans** influencer le calcul. La fonction reste pure du
  point de vue prix.

---

## (d) Edge cases & matrice d'états

| État | Situation | Attendu |
|---|---|---|
| Nominal coupon | coupon actif éligible, treatment, price 28900 → -90 MAD | `effectivePriceCents===19900`, `active:true`, `coupon.bucket==='treatment'` |
| Nominal fallback | pas de coupon, promo 19900 | `computePromo(28900,19900)`, `effectivePriceCents===19900`, `coupon:null` |
| Plein tarif | pas de coupon, `promoPriceCents:null` | `active:false`, `effectivePriceCents===28900`, `coupon:null` |
| Holdout | coupon sélectionné mais bucket holdout | prix == `computePromo(price,promo)`, `coupon!=null` bucket `holdout` |
| Holdout sans promo | holdout + `promoPriceCents:null` | plein tarif 28900, `coupon!=null` bucket holdout |
| Phase 1 holdout=0 | coupon, holdoutPct 0 | toujours `treatment` (jamais holdout) |
| visitorKey null | coupon, `visitorKey:null` | `bucket==='treatment'` |
| Vide | candidates [] | fallback, `coupon:null` |
| Limite | coupon amène effectif == price (remise nulle) | `active:false` (computePromo garde promo<price), prix plein |
| Limite | coupon amène effectif <= 0 | clampé par applyCoupon/computePromo à >=0, jamais négatif |
| Invalide | coupon `amount` > price (remise > prix) | applyCoupon clampe ; `effectivePriceCents>=0`, jamais négatif |
| Erreur réseau/DB | chargement candidats échoue → candidates [] | fallback silencieux, pas de throw, `coupon:null` |
| Concurrence | candidates mutés entre 2 appels | chaque appel = snapshot ; déterministe sur l'entrée fournie |
| Cache | candidats servis depuis cache tag coupons (CPN-18) | bucket recalculé (pas caché) ; prix cohérent |
| i18n | currency 'MAD' vs ctx | devise tranchée en amont (CPN-03) ; ici currency juste portée |
| a11y | — | non applicable |
| Forme | n'importe quel chemin | 6 champs PromoComputation + `coupon` exactement |

---

## (e) Risques

| ID | Risque | Impact | Mitigation testée |
|---|---|---|---|
| R-04-1 | Forme `PromoComputation` altérée (clé manquante/renommée) | Régression aval massive (PriceDisplay, tracking, JSON-LD) | INV-2 + assert clés exactes (snapshot de forme) |
| R-04-2 | Fallback ne réutilise pas `computePromo` (recalcul divergent) | Prix de repli ≠ promo réelle → mismatch | INV-3 égalité champ-à-champ vs `computePromo` |
| R-04-3 | Holdout sert le prix coupon (au lieu du repli) | Biais expérience / fuite remise au groupe témoin | INV-6 + cas holdout |
| R-04-4 | Holdout renvoie `coupon:null` (perte d'attribution) | Stats incrémentalité faussées (CPN-12) | INV-6 : `coupon!=null` bucket holdout |
| R-04-5 | Exception propagée si candidates KO | Page /kit 500 | INV-7 + cas DB down |
| R-04-6 | Prix effectif négatif (remise > prix) | Total négatif / 422 | clamp >=0 (cas limite/invalide) |
| R-04-7 | `visitorKey null` mis en holdout par défaut | Visiteurs anonymes privés de promo / mismatch | INV-8 : null → treatment |
| R-04-8 | Bucket figé/caché (dépend cookie) | Fuite entre visiteurs, mismatch | bucket recalculé à chaque appel (vérifié ici + CPN-18/19) |
| R-04-9 | `coupon.type/mode` inventés au lieu de lus | Mauvaise journalisation/affichage | assert égalité avec le `CouponRow` source |

---

## (f) Critères d'acceptation testables

- **AC-04-1** : coupon actif éligible, treatment, `price 28900 / promo 19900`,
  coupon `amount -9000` → `effectivePriceCents===19900`, `active:true`,
  `savingsCents===9000`, `coupon!=null`, `coupon.bucket==='treatment'`.
- **AC-04-2** : aucun coupon, `price 28900 / promo 19900` → résultat **strictement
  égal** champ-à-champ à `{ ...computePromo(28900,19900), coupon:null }`
  (`effectivePriceCents===19900`).
- **AC-04-3** : aucun coupon, `promoPriceCents:null` → `active:false`,
  `effectivePriceCents===28900`, `savingsCents===0`, `savingsPct===0`,
  `framing` cohérent computePromo, `coupon:null`.
- **AC-04-4** : coupon sélectionné, bucket forcé `holdout` → `effectivePriceCents ===
  computePromo(28900,19900).effectivePriceCents` ET `coupon!=null` avec
  `coupon.bucket==='holdout'`.
- **AC-04-5** : holdout + `promoPriceCents:null` → plein tarif `28900`,
  `coupon!=null` bucket `holdout`.
- **AC-04-6** : Phase 1 `holdoutPct===0` + coupon → toujours `treatment`,
  jamais `holdout`, quel que soit `visitorKey`.
- **AC-04-7** : `visitorKey:null` + coupon → `bucket==='treatment'`.
- **AC-04-8** : la forme rendue contient **exactement**
  `['active','effectivePriceCents','originalPriceCents','savingsCents','savingsPct','framing','coupon']`
  (ni plus ni moins) sur les 4 chemins (treatment / fallback-promo / fallback-plein / holdout).
- **AC-04-9** : candidates `[]` (ou wrapper amont en erreur) → fallback,
  `coupon:null`, `expect(()=>resolveProductPricing()).not.toThrow()`.
- **AC-04-10** : coupon `amount` supérieur au prix → `effectivePriceCents>=0`
  (clamp), jamais négatif.
- **AC-04-11** : déterminisme — 20 appels identiques `(input,ctx)` → 20
  `ResolvedPricing` strictement égaux (sérialisation JSON identique).
- **AC-04-12** : `coupon.type` et `coupon.mode` rendus === ceux du `CouponRow`
  sélectionné (pas de valeur inventée).
