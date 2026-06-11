# CPN-07 — Projection du snapshot panier coupon-aware

> Périmètre : `apps/web/src/lib/checkout/helpers/cart-snapshot-builder.ts`
> (`isPromoActive`, `projectCartSnapshotFromVariant`) et son appelant
> `apps/web/src/components/sections/KitCommanderSectionBound.tsx`.
> Criticité **P0**. Porte le gate **G-PRICE-PARITY** : le `totalCents` du snapshot
> projeté DOIT être strictement égal au total recalculé par `order-repo` lors du
> repricing (sinon `PriceMismatchError → HTTP 422`).

---

## (a) Fonctionnement optimal

Le snapshot panier est la **structure transmise du wizard checkout vers la
commande**. Son `totalCents` est la promesse de prix du client : `order-repo`
recalcule ce total côté serveur (coupon-aware) et **rejette en 422** toute
divergence. Le snapshot doit donc porter le **prix effectif coupon**.

Séparation des responsabilités (à préserver) :

1. **`projectCartSnapshotFromVariant` reste PUR** : il ne connaît PAS le coupon.
   Il reçoit une `VariantPriceInput` `{ sku, priceCents, promoPriceCents, currency, variantId }`
   et applique mécaniquement le contrat compare-at. Les **13 tests unitaires
   existants restent verts** (aucune régression de signature/comportement).

2. **L'appelant `KitCommanderSectionBound` est coupon-aware** : il appelle
   `resolveProductPricing(input, ctx)` PUIS injecte le résultat dans le helper en
   passant `promoPriceCents = effectivePriceCents`. C'est le **point de jonction**
   où le prix coupon entre dans le snapshot.

Comportement, par cas :

- **Coupon actif (treatment)** : l'appelant passe `priceCents=28900`,
  `promoPriceCents=19900`. Le helper produit
  `unitPriceCents=19900`, `compareAtPriceCents=28900`,
  `totalCents=19900×qty`, `compareAtTotalCents=28900×qty`.

- **Pas de coupon / coupon inactif** : l'appelant passe `promoPriceCents=null`
  (ou la promo statique fallback 199 si la source legacy le fournit). Si null →
  `unitPriceCents=28900`, `compareAtPriceCents=undefined`,
  `compareAtTotalCents=undefined`. Si 199 (fallback) → comme le cas coupon.

- **Garde promo ≥ prix / 0 / négatif** (via `isPromoActive`) : `promoPriceCents`
  ignoré → plein tarif, pas de compare-at.

- **`quantity > 1`** : `totalCents = unitPriceCents × quantity`,
  `compareAtTotalCents = compareAtPriceCents × quantity` (si défini).

> **Invariant maître (anti-422)** : pour un contexte donné, le `totalCents`
> projeté par le snapshot doit être **bit-identique** au total que `order-repo`
> recalculera via le même moteur coupon. C'est le test le plus critique du
> dossier : `snapshot.totalCents === recomputeCouponAware(ctx).totalCents`.

---

## (b) Contrats I/O

### `projectCartSnapshotFromVariant(variant, options): CartSnapshot`

```ts
interface VariantPriceInput {
  sku: string;
  priceCents: number;
  promoPriceCents: number | null;   // = effectivePriceCents (coupon) injecté par l'appelant
  currency: string;
  variantId?: string;
}
interface ProjectCartSnapshotOptions { productName: string; quantity?: number; }
```

| Champ snapshot | Promo active | Pas de promo |
|---|---|---|
| `items[0].unitPriceCents` | `promoPriceCents` (19900) | `priceCents` (28900) |
| `items[0].compareAtPriceCents` | `priceCents` (28900) | `undefined` |
| `items[0].quantity` | `quantity ?? 1` | `quantity ?? 1` |
| `items[0].sku` | `variant.sku` | `variant.sku` |
| `items[0].variantId` | `variant.variantId` | `variant.variantId` |
| `totalCents` | `unitPriceCents × qty` (19900×qty) | `priceCents × qty` (28900×qty) |
| `compareAtTotalCents` | `compareAtPriceCents × qty` (28900×qty) | `undefined` |
| `currency` | `variant.currency` | `variant.currency` |

`isPromoActive(variant)` ⇔ `promoPriceCents !== null && > 0 && < priceCents`.

### Contrat appelant (`KitCommanderSectionBound`)

```
const pricing = resolveProductPricing(input, ctx);   // coupon-aware
projectCartSnapshotFromVariant(
  { sku, priceCents: pricing.originalPriceCents,
    promoPriceCents: pricing.active ? pricing.effectivePriceCents : null,
    currency, variantId },
  { productName, quantity },
);
```

### Invariant cross-surface (gate)

```
snapshot.totalCents === orderRepo.recompute(ctx).expectedTotalCents
// sinon -> PriceMismatchError 422
```

---

## (c) Points de vérification par axe

**Backend**
- Pureté du helper : pas d'I/O, pas d'horloge, sortie déterministe.
- 13 cas unitaires existants inchangés (non-régression de signature).
- `totalCents` = produit exact `unit × qty` (entiers, pas d'arrondi flottant).

**Frontend**
- `KitCommanderSectionBound` appelle bien `resolveProductPricing` AVANT le helper.
- L'`effectivePriceCents` coupon est ce qui est injecté (pas la promo statique
  quand un coupon est actif).

**UI/UX**
- `compareAtPriceCents` défini ⇒ le strike-through apparaît dans le récap panier.
- `compareAtPriceCents=undefined` ⇒ pas de barré (pas de fausse promo).

**Data**
- Tous les montants en centimes entiers. `currency` propagée telle quelle.
- `compareAtTotalCents` cohérent : `compareAtPriceCents × qty` ou `undefined`.

**Sécurité**
- Aucun prix négatif. La garde `isPromoActive` bloque les promos ≥ prix.
- Le client ne peut pas forcer un `totalCents` plus bas : `order-repo` reprice.

**Performance**
- Helper O(1). Pas de cache nécessaire ; pas de figement de bucket.

**Accessibilité / i18n** — indirect : le rendu du snapshot (récap panier) hérite
de `<PriceDisplay>` (CPN-06) pour fr/ar. Ici on vérifie les **valeurs**, pas le rendu.

**Observabilité / tracking**
- Le `totalCents` snapshot alimente `add_to_cart`/`begin_checkout` `value` —
  doit être cohérent avec `view_item` (199), cf. CPN-16.

---

## (d) Edge cases & matrice d'états

| État | priceCents | promoPriceCents | qty | unitPriceCents | compareAtPriceCents | totalCents | compareAtTotalCents |
|---|---|---|---|---|---|---|---|
| Coupon actif | 28900 | 19900 | 1 | 19900 | 28900 | 19900 | 28900 |
| Coupon actif qty 2 | 28900 | 19900 | 2 | 19900 | 28900 | 39800 | 57800 |
| Coupon actif qty 3 | 28900 | 19900 | 3 | 19900 | 28900 | 59700 | 86700 |
| Pas de coupon (null) | 28900 | null | 1 | 28900 | undefined | 28900 | undefined |
| Fallback promo 199 | 28900 | 19900 | 1 | 19900 | 28900 | 19900 | 28900 |
| Garde promo == prix | 28900 | 28900 | 1 | 28900 | undefined | 28900 | undefined |
| Garde promo > prix | 28900 | 30000 | 1 | 28900 | undefined | 28900 | undefined |
| Garde promo 0 | 28900 | 0 | 1 | 28900 | undefined | 28900 | undefined |
| Garde promo négative | 28900 | -100 | 1 | 28900 | undefined | 28900 | undefined |
| Cross-surface treatment | 28900 | 19900 | 1 | 19900 | 28900 | 19900 (==reprice) | 28900 |
| Cross-surface qty 2 | 28900 | 19900 | 2 | 19900 | 28900 | 39800 (==reprice) | 57800 |

---

## (e) Risques

| ID | Risque | Impact | Mitigation testée |
|---|---|---|---|
| R-07-1 | `totalCents` snapshot ≠ total reprice | Commande rejetée 422 / friction conversion | Test cross-surface `snapshot.total === reprice.total` |
| R-07-2 | Helper rendu impur / coupon-aware | Couplage, perte de testabilité | 13 cas U existants verts + pureté |
| R-07-3 | Appelant injecte promo statique au lieu de l'effectif coupon | Affiché 199 mais snapshot 199 statique divergent du moteur | Test appelant injecte `effectivePriceCents` |
| R-07-4 | Mauvais `compareAtTotalCents` (qty oubliée) | Récap incohérent | Cas qty>1 exact |
| R-07-5 | Garde promo≥prix non appliquée | compareAt < unit absurde | Cas garde (4 sous-cas) |
| R-07-6 | Arrondi flottant sur `unit × qty` | Centime perdu → 422 | Oracles entiers exacts |
| R-07-7 | `currency` perdue/altérée | Mauvaise devise facturée | `snapshot.currency === variant.currency` |
| R-07-8 | `compareAt` exposé sans promo | Fausse promo affichée | `compareAtPriceCents===undefined` sans promo |

---

## (f) Critères d'acceptation testables

- **AC-07-1** : coupon actif qty=1 → snapshot
  `{ unitPriceCents:19900, compareAtPriceCents:28900, totalCents:19900, compareAtTotalCents:28900 }`.
- **AC-07-2** : coupon actif qty=2 → `totalCents:39800`, `compareAtTotalCents:57800`.
- **AC-07-3** : `promoPriceCents=null` → `unitPriceCents:28900`,
  `compareAtPriceCents:undefined`, `compareAtTotalCents:undefined`.
- **AC-07-4** : garde `promoPriceCents ∈ {28900,30000,0,-100}` → plein tarif,
  `compareAtPriceCents:undefined`.
- **AC-07-5** : `snapshot.currency === variant.currency` ; `items[0].sku === variant.sku`.
- **AC-07-6** : les **13 tests unitaires existants** du helper restent verts
  (non-régression).
- **AC-07-7 (gate)** : pour un contexte coupon donné,
  `projectCartSnapshotFromVariant(...).totalCents === orderRepo.recompute(ctx).expectedTotalCents`
  (treatment 19900 ; holdout/pas-de-coupon 28900), pour qty ∈ {1,2,3}.
- **AC-07-8** : `KitCommanderSectionBound` appelle `resolveProductPricing` puis
  passe `effectivePriceCents` (et non une constante 19900) au helper.
- **AC-07-9** : E2E commander → snapshot total == total commande, aucun 422.
