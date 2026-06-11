# CPN-06 — Affichage du prix public coupon-aware (`buildKitPublicProduct` + `getKitLeadValue`)

> Périmètre : `apps/web/src/lib/products/public.ts`
> (`buildKitPublicProduct()`, `getKitLeadValue()`, `getKitProductCached()`),
> branchés sur le rendu public `apps/web/src/components/commerce/PriceDisplay.tsx`
> + `apps/web/src/components/sections/PriceBlock.tsx` et la page
> `apps/web/src/app/[locale]/kit/page.tsx`.
> Criticité **P0**. Porte deux gates : **G-PRICE-PARITY** (le prix affiché EST le
> prix résolu par le moteur) et **G-TRACKING-VALUE** (la valeur de conversion
> = prix effectif, jamais le prix barré).

---

## (a) Fonctionnement optimal

`buildKitPublicProduct()` est la **source de vérité du prix public** de `/kit`.
En Phase 1, la promo 289→199 MAD ne vient plus d'une valeur figée mais du
**coupon `welcome_auto` (-90 MAD, AUTO, holdout=0)** résolu par
`resolveProductPricing`. `buildKitPublicProduct` doit refléter ce prix effectif
dans `promoPriceCents` afin que **tout l'aval** (PriceBlock, PriceDisplay,
JSON-LD, tracking `view_item`, snapshot panier) consomme une valeur unique et
cohérente.

Comportement attendu, par cas :

1. **Coupon actif (treatment, holdout=0)** : le prix effectif résolu = `19900`.
   `buildKitPublicProduct` expose `priceCents = 28900` (barré) et
   `promoPriceCents = 19900`. `<PriceDisplay>`/`<PriceBlock>` rendent **199**
   en prix actif, **289** barré, et la mention **« Économisez 90 MAD »**
   (framing montant : `90 >= 31`, cf. `computePromo`). `getKitLeadValue()` = `199`.

2. **Pas de coupon / coupon inactif (`promoPriceCents = null`)** : `289` seul,
   **pas de prix barré**, pas de mention « Économisez ». `getKitLeadValue()` = `289`.

3. **Garde promo ≥ prix** : une valeur DB incohérente (`rawPromo >= basePrice`,
   `0`, négatif) est **ignorée silencieusement** → `promoPriceCents = null` →
   affichage plein tarif (jamais de crash, jamais de prix barré inférieur).

4. **Fallback mock** : DB indisponible / produit non publié (`status !== 'published'`)
   → retour intégral `mockKit` (prix éditorial mock), sans throw.

5. **Devise non supportée** : `primary.currency` hors `SUPPORTED_CURRENCIES`
   → fallback `mockKit.currency` (jamais de devise libre exposée au public).

6. **i18n** : locale `fr` → suffixe `MAD` ; locale `ar` → suffixe `درهم`, RTL.
   Le **montant numérique** (199 / 289 / 90) est identique entre locales ; seul
   le suffixe devise et la direction changent.

> **Invariant n°1** : la valeur de `promoPriceCents` produite ici doit être
> **identique** à `effectivePriceCents` calculé par le moteur côté snapshot
> (CPN-07) et côté repricing (CPN-08). Si `buildKitPublicProduct` affiche 199
> mais que le moteur facture 289 → `PriceMismatchError 422`. C'est le risque
> maître protégé par ce dossier.

---

## (b) Contrats I/O

### `buildKitPublicProduct(): Promise<PublicProduct>`

| Champ produit | Source | Règle coupon-aware |
|---|---|---|
| `priceCents` | `primary.priceCents ?? mockKit.priceCents` | prix barré régulier = `28900` |
| `promoPriceCents` | prix effectif résolu (coupon) | `19900` si coupon actif & `<priceCents` ; sinon `null` |
| `currency` | `primary.currency` whitelisté | fallback `mockKit.currency` si hors enum |
| `inStock` | `primary.inventoryStatus !== 'out_of_stock'` | inchangé |
| (autres) | merge `mockKit` | éditorial mock |

Règle de promo (existante, à préserver) :
`promoPriceCents = (rawPromo !== null && rawPromo > 0 && rawPromo < basePrice) ? rawPromo : null`.
En Phase 1, `rawPromo` provient du prix effectif coupon-aware (et non plus d'une
colonne `promo_price_cents` statique). Le **contrat de garde reste identique**.

### `getKitLeadValue(): Promise<{ value: number; currency: string }>`

```
effectiveCents = kit.promoPriceCents ?? kit.priceCents
value = effectiveCents / 100   // UNITÉ MAJEURE (MAD), pas centimes
```

- Coupon actif → `{ value: 199, currency: 'MAD' }`.
- Pas de coupon → `{ value: 289, currency: 'MAD' }`.
- **Server-authoritative** : jamais recalculée côté client ; alimente
  `generate_lead` (chat / formulaires) pour le bidding value-based.

### Rendu `<PriceDisplay>` (promo active, MAD)

| Élément | Oracle exact (fr) | Oracle exact (ar) |
|---|---|---|
| Prix actif | `199 MAD` | `199 درهم` |
| Prix barré (`line-through`, `aria-hidden`) | `289 MAD` | `289 درهم` |
| Mention savings | `Économisez 90 MAD` | `Économisez 90 درهم` |
| `aria-label` wrapper | `Prix : 199 MAD, prix initial 289 MAD` | locale ar |

### Rendu `<PriceBlock>` (`/kit`)

- `data-testid="pack-price-line"` → contient `199` + `currencyDisplay`.
- `data-testid="pack-price-compare-at"` → `hero.priceCompareAt` (289, barré).
- CTA `priceCents = promo.effectivePriceCents = 19900`.

---

## (c) Points de vérification par axe

**Backend**
- `promoPriceCents` = `19900` quand coupon actif ; `null` si garde déclenchée.
- Garde `rawPromo >= basePrice` / `0` / négatif → `null`.
- Fallback mock si `data === null` ou `status !== 'published'` (pas de throw).
- `getKitLeadValue` retourne unité majeure (`/100`), jamais des centimes.

**Frontend**
- `PriceDisplay.active=false` → un seul `<span>` prix, pas de `line-through`.
- `PriceDisplay.active=true` → 2 spans + mention, gap visuel (Kolenda #10).
- `PriceBlock` consomme `computePromo(product.priceCents, product.promoPriceCents)`
  → `effectivePriceCents` propagé au CTA et au prix XXL.

**UI/UX**
- Le prix actif (199) domine visuellement le barré (289 en `text-encre/50`).
- Mention « Économisez … » discrète (small caps), informe sans crier.

**Design / charte**
- Pas de rouge retail : prix barré en `text-encre/50` (brume), pas de `text-red-*`.
- Pas de countdown, pas d'emoji, pas du mot « SOLDE/PROMO ».
- Tokens crème/encre/sauge uniquement.

**Data**
- `currency` toujours dans `SUPPORTED_CURRENCIES` (sinon fallback mock).
- `priceCents`/`promoPriceCents` entiers (centimes), jamais flottants.

**Sécurité**
- Aucun prix négatif exposé. `getKitLeadValue` server-only (pas d'exposition
  client de la logique de valeur).

**Performance**
- `getKitProductCached` = `unstable_cache` taggué `products` + `product:le-kit`.
- Le prix coupon-aware **ne doit pas figer un bucket** par cache (cf. CPN-18/19) :
  holdout=0 en Phase 1 → toujours treatment, mais la résolution reste recalculée.

**Accessibilité**
- Prix barré `aria-hidden="true"` ; `aria-label` du wrapper porte les 2 prix
  en clair (lecteur d'écran annonce « Prix : 199 MAD, prix initial 289 MAD »).

**i18n fr/ar**
- fr → `MAD` ; ar → `درهم`, `dir="rtl"`. Montant identique entre locales.
- Le nombre `90` (savings) formaté sans décimales en MAD.

**Observabilité / tracking**
- `view_item` émis avec `value = effectivePriceCents/100 = 199` (PAS 289).
- `getKitLeadValue` → `generate_lead value = 199`.
- Cohérence : `params.value` en unité majeure (MAD) partout.

---

## (d) Edge cases & matrice d'états

| État | Entrée DB | `promoPriceCents` | Affichage | `getKitLeadValue` |
|---|---|---|---|---|
| Coupon actif (treatment) | base 28900, effectif 19900 | `19900` | 199 + 289 barré + « Économisez 90 MAD » | `199` |
| Pas de coupon | base 28900, effectif 28900 | `null` | 289 seul, pas barré | `289` |
| Promo = prix (garde) | base 28900, raw 28900 | `null` | 289 seul | `289` |
| Promo > prix (garde) | base 28900, raw 30000 | `null` | 289 seul | `289` |
| Promo = 0 (garde) | base 28900, raw 0 | `null` | 289 seul | `289` |
| Promo négative (garde) | base 28900, raw -100 | `null` | 289 seul | `289` |
| DB indisponible | `data === null` | mock | prix mock | mock effectif |
| Produit non publié | `status='draft'` | mock | prix mock | mock effectif |
| Devise hors enum | currency `'XYZ'` | (selon coupon) | fallback `mockKit.currency` | currency mock |
| Locale ar | coupon actif | `19900` | 199 درهم + 289 درهم barré, RTL | `199` MAD |
| Coupon -90 + holdout=0 | tout trafic | `19900` | 199 (jamais 289 facturé) | `199` |

---

## (e) Risques

| ID | Risque | Impact | Mitigation testée |
|---|---|---|---|
| R-06-1 | `promoPriceCents` ≠ prix résolu moteur | Affiché 199, facturé 289 → 422 | Parité prix affiché==résolu (U + I) |
| R-06-2 | `getKitLeadValue` renvoie 289 au lieu de 199 | Valeur conversion gonflée, ROAS faussé | AC-06-5 value=199 |
| R-06-3 | `getKitLeadValue` renvoie des centimes (19900) | Bid 100× faux | Oracle `value===199` strict |
| R-06-4 | Garde promo≥prix cassée → prix barré ≤ actif | UX absurde, prix négatif | Cas garde (4 sous-cas) |
| R-06-5 | DB down → page /kit crash | Indisponibilité commerciale | Fallback mock sans throw |
| R-06-6 | Devise libre exposée (donnée legacy) | Format prix cassé | Fallback `mockKit.currency` |
| R-06-7 | Suffixe MAD affiché sur /ar | Hors i18n | Locale ar → درهم |
| R-06-8 | Prix barré non `aria-hidden` → double lecture | A11y dégradée | A11y label unique |
| R-06-9 | Bucket/prix figé par cache | Visiteur collé à un mauvais prix | Recalcul non figé (CPN-18) |

---

## (f) Critères d'acceptation testables

- **AC-06-1** : coupon actif → `buildKitPublicProduct().promoPriceCents === 19900`
  et `.priceCents === 28900`.
- **AC-06-2** : pas de coupon → `.promoPriceCents === null`.
- **AC-06-3** : `rawPromo ∈ {28900, 30000, 0, -100}` → `.promoPriceCents === null`.
- **AC-06-4** : `data === null` OU `status !== 'published'` → retour `mockKit`
  (référence stricte ou égalité de prix), sans throw.
- **AC-06-5** : coupon actif → `getKitLeadValue()` ⇒ `{ value: 199, currency: 'MAD' }`.
- **AC-06-6** : pas de coupon → `getKitLeadValue()` ⇒ `{ value: 289, currency: 'MAD' }`.
- **AC-06-7** : `<PriceDisplay priceCents=28900 promoPriceCents=19900 currency="MAD" />`
  rend exactement `199 MAD`, `289 MAD` (barré), `Économisez 90 MAD`.
- **AC-06-8** : `<PriceDisplay priceCents=28900 promoPriceCents={null} />` rend
  `289 MAD` seul, **sans** élément `line-through`, **sans** mention « Économisez ».
- **AC-06-9** : devise `'XYZ'` (hors enum) → `.currency === mockKit.currency`.
- **AC-06-10** : sur `/ar/kit`, le prix actif affiche `199 درهم` et le conteneur
  est `dir="rtl"`.
- **AC-06-11** : E2E `/kit` (fr) → page montre 199 + 289 barré ; `view_item`
  émis avec `value === 199`.
