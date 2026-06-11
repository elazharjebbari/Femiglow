# CPN-02 — Moteur `applyCoupon` (math de prix pur)

> Périmètre : `apps/web/src/lib/coupons/engine.ts` → `applyCoupon(priceCents, coupon)`.
> Fonction **PURE**, sans I/O, sans horloge, sans accès DB. Source unique de la
> transformation « coupon → prix candidat », puis **délégation** à
> `computePromo` (`apps/web/src/lib/utils/promo.ts`) pour la garde et le framing.
> Criticité **P0** : tout écart se propage à l'affichage ET à la facturation.

---

## (a) Fonctionnement optimal

`applyCoupon` répond à une seule question : *« étant donné un prix de base et la
définition d'un coupon, quel est le `PromoComputation` résultant ? »*

Algorithme :

1. **Calcul du candidat `promoPriceCents`** selon `coupon.valueKind` :
   - `fixed_amount` : `candidat = priceCents - coupon.valueAmount` (valueAmount en centimes).
   - `percent` : `candidat = Math.round(priceCents * (1 - coupon.valueAmount / 100))` (valueAmount en points de %, 0..100).
2. **Plancher à zéro** : `candidat = Math.max(0, candidat)` (un coupon ne crée jamais un prix négatif).
3. **Délégation totale** : `return computePromo(priceCents, candidat)`.

Le point décisif est que **`applyCoupon` ne décide JAMAIS lui-même si la promo
est active** : il fabrique un candidat puis laisse `computePromo` trancher. La
garde « promo active SEULEMENT si `promo>0 ET promo<prix` » et le framing Kolenda
(`'amount'` si `savings/100 >= savingsPct`, sinon `'percent'`) ne sont donc
**jamais dupliqués**. Conséquence directe (et voulue) :

- Un coupon qui ramène le prix à **0** (montant fixe = prix exact, ou percent=100)
  → candidat `0` → `computePromo` refuse (`promo>0` faux) → **`active:false`**,
  `effectivePriceCents = priceCents` (le prix de base, PAS zéro).
- Un coupon de valeur nulle (montant fixe 0, ou percent=0) → candidat = prix →
  `promo<prix` faux → **`active:false`**, `effectivePriceCents = priceCents`.
- Un montant fixe supérieur au prix → candidat brut négatif → planché à `0` →
  même issue que « ramène à 0 » → **`active:false`**.

> **Pourquoi `active:false` plutôt que « gratuit » ?** Phase 1 ne vend pas de kit
> gratuit. Un coupon mal saisi (>= prix) doit dégrader silencieusement vers le
> prix plein, jamais offrir le produit ni planter la page. C'est le comportement
> hérité de `computePromo` et on l'assume tel quel.

---

## (b) Contrats I/O

### Signature

```ts
interface ApplyCouponInput {
  /** Sous-ensemble strictement nécessaire au calcul pur. */
  valueKind: 'fixed_amount' | 'percent';
  /** Centimes si fixed_amount ; points de % (0..100) si percent. */
  valueAmount: number;
}

function applyCoupon(
  priceCents: number,
  coupon: ApplyCouponInput,
): PromoComputation; // type réexporté de lib/utils/promo.ts
```

> `applyCoupon` n'a besoin que de `valueKind` + `valueAmount`. Elle accepte une
> `CouponRow` complète (structurellement compatible) mais ne lit RIEN d'autre :
> ni `status`, ni fenêtre, ni `eligibility` (ce sont les responsabilités de
> `resolveCoupon`, CPN-03). Cette frontière est un invariant testable.

### Type de sortie (rappel `PromoComputation`)

| Champ | Type | Sens |
|---|---|---|
| `active` | `boolean` | Remise valide et affichable |
| `effectivePriceCents` | `number` | Prix payé = candidat si actif, sinon `priceCents` (planché ≥ 0, arrondi) |
| `originalPriceCents` | `number` | `max(0, round(priceCents))` quel que soit l'état |
| `savingsCents` | `number` | `original - candidat` si actif, sinon `0` |
| `savingsPct` | `number` | `round(savings/original*100)` si actif, sinon `0` |
| `framing` | `'amount' \| 'percent'` | Kolenda #34 ; `'percent'` quand inactif |

### Invariants (vérifiables par propriété)

- **INV-1 (pureté)** : aucune mutation de `coupon`, aucun effet de bord, déterministe (mêmes entrées → même sortie).
- **INV-2 (délégation)** : `applyCoupon(p, c)` ≡ `computePromo(p, candidat(p,c))`. La garde/framing ne sont jamais recodés ici.
- **INV-3 (plancher)** : `effectivePriceCents >= 0` toujours ; le candidat passé à `computePromo` est `>= 0`.
- **INV-4 (jamais d'exception)** : toute entrée (NaN, Infinity, négatif, percent>100) renvoie un `PromoComputation`, jamais un throw.
- **INV-5 (cohérence prix)** : si `active`, alors `effectivePriceCents < originalPriceCents` ET `effectivePriceCents > 0`.
- **INV-6 (idempotence d'inactivité)** : si `active:false`, alors `effectivePriceCents === originalPriceCents` et `savingsCents === 0` et `savingsPct === 0`.

---

## (c) Points de vérification par axe

**Backend (logique pure)**
- Calcul candidat exact pour `fixed_amount` et `percent` (cf. table de vérité).
- Arrondi `percent` conforme `Math.round` (demi-entier vers le haut JS : 0.5 → 1).
- Plancher `max(0,…)` appliqué AVANT délégation.
- Délégation vérifiée par équivalence avec un appel direct `computePromo`.

**Frontend** — *non applicable directement* : `applyCoupon` est consommée en
amont (CPN-06/07). On vérifie ici uniquement que le `PromoComputation` produit
est consommable tel quel par `<PriceDisplay>` (forme identique à la promo legacy).

**Data**
- `valueAmount` lu en centimes pour `fixed_amount`, en points de % pour `percent`
  (pas de double interprétation).
- Aucune lecture de champ DB hors `valueKind`/`valueAmount` (INV frontière CPN-03).

**Sécurité**
- Pas d'entrée externe non bornée : un `valueAmount` hostile (négatif, énorme,
  NaN) ne crée jamais prix négatif ni exception (INV-3/4) → pas de DoS ni de prix
  exploitable.

**Performance**
- O(1), pas d'allocation hors objet retour. Budget < 0.01 ms/appel (négligeable).

**Observabilité**
- Fonction pure : pas de log interne. La traçabilité se fait au niveau appelant
  (CPN-04/09). On documente que `applyCoupon` n'émet aucun événement.

**i18n / a11y** — *non applicable* (pas de rendu).

---

## (d) Edge cases & matrice d'états

| État | Entrée (prix=28900) | Candidat | `active` | `effectivePriceCents` | Notes |
|---|---|---|---|---|---|
| Nominal fixed | fixed_amount 9000 | 19900 | `true` | 19900 | savings 9000, pct 31, framing amount |
| Nominal percent | percent 10 | 26010 | `true` | 26010 | savings 2890, pct 10, framing amount |
| Limite : fixe = prix | fixed_amount 28900 | 0 | `false` | 28900 | candidat 0 → garde `promo>0` refuse |
| Limite : fixe > prix | fixed_amount 40000 | max(0,-11100)=0 | `false` | 28900 | plancher → 0 → inactif |
| Limite : percent 100 | percent 100 | 0 | `false` | 28900 | candidat 0 → inactif |
| Limite : percent 0 | percent 0 | 28900 | `false` | 28900 | candidat = prix → `promo<prix` faux |
| Limite : fixe 0 | fixed_amount 0 | 28900 | `false` | 28900 | candidat = prix → inactif |
| Vide : valueAmount manquant | percent NaN | NaN→computePromo→null | `false` | 28900 | computePromo neutralise NaN |
| Invalide : valueAmount négatif | fixed_amount -5000 | 28900-(-5000)=33900 | `false` | 28900 | candidat > prix → `promo<prix` faux (pas de majoration) |
| Invalide : percent > 100 | percent 150 | round(28900*-0.5)=-14450→0 | `false` | 28900 | plancher + inactif |
| Invalide : prix Infinity | percent 10, prix=Infinity | — | `false` | 0 | computePromo : prix non fini → original 0 |
| Invalide : prix négatif | fixed_amount 5000, prix=-100 | — | `false` | 0 | original `max(0,…)`=0 |
| Arrondi : percent 33 | percent 33 | round(28900*0.67)=19363 | `true` | 19363 | savings 9537, pct 33, framing amount |
| Arrondi : percent 12.5 | percent 12.5 | round(28900*0.875)=25288 | `true` | 25288 | demi-centime géré par round |
| Concurrence | — | — | — | — | **N/A** : fonction pure, pas d'état partagé |
| Cache | — | — | — | — | **N/A** : pas de cache interne (résultat memoïsable côté appelant si besoin) |

---

## (e) Risques

| ID | Risque | Impact | Mitigation testée |
|---|---|---|---|
| R-02-1 | Duplication de la garde `promo>0/<prix` dans `applyCoupon` | Divergence avec computePromo, double maintenance | Test d'équivalence INV-2 + revue |
| R-02-2 | Prix candidat négatif transmis sans plancher | Prix négatif facturé / savings>prix | Cas fixe>prix, percent>100 → effective=prix |
| R-02-3 | Mauvaise unité de `valueAmount` (centimes vs %) | Remise 100× trop grande/petite | Table de vérité fixed vs percent |
| R-02-4 | Arrondi non maîtrisé sur percent | Écart 1 centime affichage↔caisse | Cas percent 33 / 12.5 oracle exact |
| R-02-5 | Exception sur saisie incohérente | Page /kit cassée (SSR throw) | Cas NaN/Infinity/négatif → jamais throw |
| R-02-6 | Coupon « gratuit » involontaire (effective=0) | Kit offert | Cas candidat=0 → active:false, effective=prix |

---

## (f) Critères d'acceptation testables

- **AC-02-1** : `applyCoupon(28900,{fixed_amount,9000})` → `{active:true, effectivePriceCents:19900, originalPriceCents:28900, savingsCents:9000, savingsPct:31, framing:'amount'}`.
- **AC-02-2** : `applyCoupon(28900,{percent,10})` → `effectivePriceCents:26010, savingsCents:2890, savingsPct:10`.
- **AC-02-3** : montant fixe = prix (28900) → `active:false`, `effectivePriceCents:28900` (jamais 0).
- **AC-02-4** : montant fixe > prix (40000) → `active:false`, `effectivePriceCents:28900` (jamais négatif).
- **AC-02-5** : percent=100 → `active:false`, `effectivePriceCents:28900`. percent=0 → `active:false`, `effectivePriceCents:28900`.
- **AC-02-6** : pour tout `(prix, coupon)`, `applyCoupon(prix,coupon)` est strictement égal à `computePromo(prix, candidat)` (équivalence prouvée par échantillonnage de propriété).
- **AC-02-7** : aucune entrée (NaN, Infinity, négatifs, percent>100) ne lève d'exception ; toujours un `PromoComputation` valide.
- **AC-02-8** : `applyCoupon` ne lit que `valueKind`/`valueAmount` (un coupon `status:'archived'` produit le MÊME résultat qu'un `status:'active'` — la sélection n'est pas son rôle).
- **AC-02-9** : 100 % statements/branches/functions sur le module (gate engine).
