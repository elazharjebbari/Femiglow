# CPN-17 — Bascule promo → source coupon (avec fallback `promoPriceCents`)

> Feature_id : **CPN-17** · Couche : **data + backend** · Criticité : **P0**
> Risque principal (feature-inventory) : *Double remise / perte de la promo / rollback impossible*.
> INVARIANT MAÎTRE : **prix AFFICHÉ == prix FACTURÉ**. La résolution doit produire le même `effectivePriceCents` à l'affichage (`/kit`), au snapshot panier (CPN-07) et au repricing (`order-repo.ts`, CPN-08).
> Dépendances : `computePromo()` (`apps/web/src/lib/utils/promo.ts`), `resolveProductPricing` (CPN-04), `resolveCoupon` (CPN-03), `applyCoupon` (CPN-02).

---

## (a) Fonctionnement optimal — comportement attendu détaillé

### État de départ (legacy, avant bascule)
La variante kit porte `priceCents=28900` (289 MAD) et `promoPriceCents=19900` (199 MAD). Tout le système (PriceBlock, cart-snapshot, order-repo) lit `effectivePrice = promoPriceCents ?? priceCents`, donc **199 MAD**.

### État cible (Phase 1, après bascule)
Le coupon `welcome_auto` (-9000 centimes, soit -90 MAD) devient la **SOURCE** de la promo affichée à 199. `promoPriceCents=19900` est conservé en base mais **rétrogradé au rang de FALLBACK de sécurité** : il n'est consommé QUE si aucun coupon actif applicable n'est résolu.

### Ordre de résolution (déterministe, identique partout)
`resolveProductPricing(variant, context)` applique strictement :

1. **Résolution coupon** via `resolveCoupon(context)` → renvoie au plus **un** coupon applicable (actif, fenêtre valide, éligible, non en holdout, montant cohérent).
2. **Si un coupon est résolu** : `effectivePriceCents = applyCoupon(priceCents, coupon)`.
   - `fixed_amount` : `effective = priceCents − valueAmount` (clamp ≥ 0).
   - `percent` : `effective = round(priceCents × (1 − valueAmount/100))`.
   - Le coupon **OVERRIDE** entièrement `promoPriceCents` : **pas d'empilement**. On NE soustrait JAMAIS le coupon d'un prix déjà promu.
3. **Sinon (aucun coupon résolu)** : fallback `computePromo(priceCents, promoPriceCents)` → comportement legacy strictement identique.
4. **Garde-fou cohérence** : un coupon dont le prix résultant n'est PAS strictement `< priceCents` est traité comme **inapplicable** (mêmes règles que `computePromo`/`hasPromo` : promo < prix), et on retombe sur le fallback. Cela bloque la « double remise » négative et les montants absurdes.

### Sortie normalisée
`resolveProductPricing` renvoie une forme `PromoComputation` enrichie (mêmes champs : `active`, `effectivePriceCents`, `originalPriceCents`, `savingsCents`, `savingsPct`, `framing`) + métadonnées de provenance (`source: 'coupon' | 'promoPrice' | 'none'`, `couponId?`). Cette forme unique est consommée à l'identique par l'affichage, le snapshot et le repricing → garantit l'INVARIANT MAÎTRE.

### Rollback trivial
Passer le coupon en `status='paused'` (ou `archived`) → `resolveCoupon` ne le renvoie plus → fallback `promoPriceCents=19900` → **199 MAD** sans aucun déploiement. Si `promoPriceCents` est aussi retiré (null) → prix nu **289 MAD**.

---

## (b) Contrats I/O

### Entrée
```ts
resolveProductPricing(
  variant: { priceCents: number; promoPriceCents: number | null },
  context: CouponContext  // visitorKey, trafficSource, device, now, ... (CPN-05)
): ResolvedPricing
```

### Sortie `ResolvedPricing`
```ts
interface ResolvedPricing extends PromoComputation {
  source: 'coupon' | 'promoPrice' | 'none';
  couponId: string | null;
  // active, effectivePriceCents, originalPriceCents, savingsCents, savingsPct, framing
}
```

### Invariants
- `originalPriceCents === priceCents` quel que soit l'état.
- `effectivePriceCents <= originalPriceCents` toujours.
- `active === (effectivePriceCents < originalPriceCents)`.
- `savingsCents === originalPriceCents − effectivePriceCents`.
- Quand `source='coupon'` : `couponId !== null`.
- **Idempotence de résolution** : pour un même `(variant, context)`, deux appels renvoient un résultat identique (déterminisme, pré-requis du repricing).
- **Non-empilement** : `effectivePriceCents` issu d'un coupon ne dépend JAMAIS de `promoPriceCents`.

### Matrice de référence (les 5 scénarios critiques)

| # | Coupon | promoPriceCents | effectivePriceCents | source | active |
|---|--------|-----------------|---------------------|--------|--------|
| 1 | actif -9000 | 19900 | **19900** (199) | coupon | true |
| 2 | actif -9000 | null | **19900** (199) | coupon | true |
| 3 | paused | 19900 | **19900** (199) | promoPrice | true |
| 4 | paused | null | **28900** (289) | none | false |
| 5 | actif incohérent (≥ prix) | 19900 | **19900** (199) | promoPrice (fallback) | true |

Scénario #1 prouve l'**absence de double remise** : 28900 − 9000 = 19900, et NON 19900 − 9000 = 10900.

---

## (c) Points de vérification PAR AXE

### Backend
- `resolveProductPricing` applique l'ordre coupon-prime → fallback → garde-fou.
- `applyCoupon` n'utilise jamais `promoPriceCents` comme base (base = `priceCents`).
- Le repricing `order-repo.ts` consomme la MÊME résolution que l'affichage (pas de chemin divergent qui lirait `promoPriceCents ?? priceCents` en dur). Sinon → `PriceMismatchError` 422.
- Coupon incohérent (montant ≥ prix, ou % ≥ 100) → traité inapplicable, pas de prix négatif/zéro silencieux.

### Frontend
- PriceBlock affiche `effectivePriceCents` de `resolveProductPricing`, jamais un calcul local concurrent.
- Le prix barré reste `originalPriceCents` (289) dans les états promus.

### UI/UX
- Bascule coupon→fallback invisible pour le visiteur tant que le prix final reste 199 (#1 et #3 affichent le même 199 DH).
- Aucun « double barré » ni double mention d'économie.

### Design / charte
- Pas de « -90 MAD » présenté comme un cumul de remises ; un seul prix final, un seul barré. Pas de countdown sur `endsAt`.

### Data
- `promoPriceCents=19900` conservé en base après bascule (rollback). La bascule ne modifie PAS la variante.
- Cohérence devise : coupon `currency='MAD'` aligné avec la variante.

### Sécurité / RBAC
- La résolution est server-authoritative ; le client ne peut pas forcer un `effectivePriceCents` plus bas (repricing recalcule). Tentative de total falsifié → 422.

### Performance
- Résolution O(1) (un coupon candidat principal en Phase 1) ; pas de N+1.
- Le fallback `computePromo` est pur, sans I/O.

### Accessibilité
- N/A direct (logique) ; vérifié en aval CPN-14.

### i18n (fr/ar, درهم, RTL)
- Le montant 19900 → « 199 درهم » / « 199 DH » selon locale ; la bascule ne change pas la valeur numérique donc le formatage RTL reste stable.

### Observabilité / logs
- `source` (coupon/promoPrice/none) et `couponId` loggables pour audit de la bascule.
- Un passage inattendu à `source='none'` (perte de promo) doit être détectable (alerte 289 affiché alors qu'on attend 199).

---

## (d) Edge cases & matrice d'états

| État | Cas | Attendu |
|---|---|---|
| Nominal | coupon actif + promoPriceCents=19900 | 19900 source=coupon (pas 10900) |
| Nominal | coupon paused + promoPriceCents=19900 | 19900 source=promoPrice |
| Vide | aucun coupon + promoPriceCents=null | 28900 source=none active=false |
| Vide | coupon actif + promoPriceCents=null | 19900 source=coupon |
| Limite | coupon -28900 (=prix) | inapplicable → fallback/nu |
| Limite | coupon -28901 (> prix) | inapplicable → fallback/nu (jamais négatif) |
| Limite | coupon percent=100 | inapplicable → fallback (effective=0 non < prix? 0<28900 vrai mais business=gratuit → traité inapplicable par garde-fou) |
| Limite | coupon -9000 exactement | 19900 |
| Invalide | coupon valueAmount négatif | inapplicable → fallback |
| Invalide | coupon currency != MAD | inapplicable (garde-fou devise) → fallback |
| Erreur | resolveCoupon throw | capturé → fallback promoPriceCents (jamais crash UI) |
| Concurrence | coupon passe paused entre affichage et checkout | repricing recalcule ; si bucket/cache stable → cohérent ; sinon documenté CPN-18/19 |
| Cache | coupon expiré servi depuis cache | invalidation requise (CPN-18) — ici on teste que la résolution NON-cachée donne le bon prix |
| i18n | rendu MAD ar | 199 درهم stable |
| a11y | N/A | — |
| Rollback | coupon archived | fallback 199 immédiat |

---

## (e) Risques

- **R-CPN-17-1** (= risque feature #1 « double remise ») : empilement coupon + promoPriceCents → 10900 au lieu de 19900 → écart caisse / marge. Couvert par U001/I001/E001.
- **R-CPN-17-2** : perte de la promo (source=none alors qu'on attend coupon ou fallback) → 289 affiché → choc prix / chute conversion. Couvert par U004/U007.
- **R-CPN-17-3** : chemin de repricing divergent (order-repo lit `promoPriceCents ?? priceCents` en dur, ignore le coupon) → mismatch affiché/facturé → 422. Couvert par C001/E002.
- **R-CPN-17-4** : rollback non trivial (la promo dépend du coupon de façon non réversible). Couvert par I003/E003.
- **R-CPN-17-5** : coupon incohérent produit un prix négatif/zéro ou ≥ prix accepté. Couvert par U005/U006/U008.

---

## (f) Critères d'acceptation testables

- [ ] Scénario #1 : coupon actif -9000 + promoPriceCents=19900 → `effectivePriceCents=19900`, `source='coupon'`, **et explicitement ≠ 10900** (preuve anti double-remise).
- [ ] Scénario #2 : coupon actif -9000 + promoPriceCents=null → `19900`, `source='coupon'`.
- [ ] Scénario #3 : coupon paused + promoPriceCents=19900 → `19900`, `source='promoPrice'`.
- [ ] Scénario #4 : coupon paused + promoPriceCents=null → `28900`, `source='none'`, `active=false`.
- [ ] Scénario #5 : coupon actif montant ≥ prix → inapplicable → fallback `19900` (ou nu 28900 si promoPriceCents null).
- [ ] `applyCoupon` calcule toujours depuis `priceCents` (28900), jamais depuis `promoPriceCents`.
- [ ] `originalPriceCents` reste 28900 dans tous les états.
- [ ] `effectivePriceCents` n'est jamais < 0 ni > `priceCents`.
- [ ] La résolution est déterministe : 2 appels = même résultat.
- [ ] Affichage, snapshot panier et repricing produisent un `effectivePriceCents` identique pour le même contexte (pas de `PriceMismatchError`).
- [ ] Une exception dans `resolveCoupon` est capturée et retombe sur le fallback (UI ne plante pas).
- [ ] Mettre le coupon en `paused` rétablit 199 (fallback) sans modification de la variante ni déploiement.
- [ ] La variante conserve `promoPriceCents=19900` après bascule (non muté).
