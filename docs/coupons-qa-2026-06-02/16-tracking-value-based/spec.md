# CPN-16 — Tracking value-based : non-régression de la valeur de conversion

> Périmètre : la **valeur monétaire** propagée aux providers publicitaires
> (Meta CAPI/pixel, Google Ads) à travers la bascule coupon. Surfaces :
> `apps/web/src/lib/products/public.ts` (`getKitLeadValue`),
> `apps/web/src/app/[locale]/kit/page.tsx` (`view_item`),
> `apps/web/src/app/api/chat/lead/contact/route.ts` (`generate_lead`),
> snapshot panier (`add_to_cart`/`begin_checkout`) et la commande (`purchase`).
> Criticité **P0**. Porte le gate **G-TRACKING-VALUE** (impact direct ROAS) :
> *aucune surface n'expose 289 comme valeur payée quand le coupon ramène à 199.*

---

## (a) Fonctionnement optimal

Le bidding value-based de Meta/Google optimise sur la `value` envoyée. En
Phase 1, le coupon `welcome_auto` ramène le prix payé à **199 MAD** : toutes les
conversions doivent porter `value = 199`, pas `289` (prix barré) ni `19900`
(centimes). La bascule « promo statique → coupon » ne doit **rien changer** à la
valeur de conversion : c'est une **non-régression** pure.

Règles non négociables :

1. **Valeur = prix effectif (payé)**, jamais le prix barré. `getKitLeadValue` =
   `effectivePriceCents/100`. Source unique server-authoritative.
2. **Unité majeure (MAD)** dans `dataLayer.params.value` : `199`, jamais `19900`.
   Le format `value` est aligné sur le checkout (`total/100`).
3. **Cohérence inter-événements** : `view_item`, `add_to_cart`,
   `begin_checkout`, `generate_lead`, `purchase` portent la **même** valeur
   pour le même contexte (199 si coupon actif, 289 si désactivé).
4. **Invariance à la source de la promo** : que les 199 viennent du coupon
   (`coupon.effectivePriceCents=19900`) ou d'une promo statique de fallback
   (`promoPriceCents=19900`), la `value` est **identiquement 199**.
5. **Cohérence avec le bucket holdout** : un visiteur `treatment` → value 199 ;
   un visiteur `holdout` (prix plein) → value 289. La value suit le prix
   réellement facturé à CE visiteur (sinon ROAS faussé). En Phase 1 holdout=0 →
   tout le monde à 199.
6. **Désactivation totale** : si tout le système coupon est OFF → fallback
   `computePromo` → 289 (ou 199 si la promo statique persiste). Le tracking
   reste **cohérent** avec ce que le client paie.

> **Risque ROAS** : si `view_item`/`purchase` envoient 289 alors que le client
> paie 199, Meta sur-évalue chaque conversion → bid trop agressif → CPA réel
> dégradé. Inversement envoyer 19900 (centimes) gonfle la value ×100. Les deux
> sont des incidents G-TRACKING-VALUE bloquants.

---

## (b) Contrats I/O

### Source server-authoritative

```
getKitLeadValue() -> { value: number /* MAD, /100 */, currency: string }
// coupon actif  -> { value: 199, currency: 'MAD' }
// coupon OFF    -> { value: 289, currency: 'MAD' }
```

### Événements et leur `value` (contexte coupon actif, treatment)

| Événement | Surface | `value` attendu | `currency` |
|---|---|---|---|
| `view_item` | `/kit` page.tsx | `199` | `MAD` |
| `add_to_cart` | snapshot panier (CPN-07) | `199` | `MAD` |
| `begin_checkout` | wizard | `199` | `MAD` |
| `generate_lead` | chat / contact route | `199` | `MAD` |
| `purchase` | confirmation commande | `199` | `MAD` |

Tous : `value` en **unité majeure** (`effectivePriceCents/100`). Jamais `289`,
jamais `19900`.

### dataLayer (GTM)

```
dataLayer.push({ event: '<ga4_event>', value: 199, currency: 'MAD', items: [...] })
// params.value = unité majeure ; PAS ecommerce.* en centimes
```

---

## (c) Points de vérification par axe

**Backend**
- `getKitLeadValue` = `effectivePriceCents/100` (coupon-aware via CPN-06).
- `purchase`/order value = `totalCents/100` cohérent avec le reprice (CPN-08).
- Aucune surface ne lit `originalPriceCents` comme `value`.

**Frontend**
- `view_item` dans `page.tsx` : `value = kitPromo.effectivePriceCents/100`.
- Les events client (`add_to_cart`, `begin_checkout`) dérivent du snapshot
  (totalCents/100), pas d'une constante.

**Data**
- `value` numérique, unité majeure (199, 289), jamais string, jamais centimes.
- `currency` toujours `'MAD'` (ou devise produit), jamais vide.

**Sécurité**
- `value` calculée serveur (`getKitLeadValue`, reprice), pas dérivée d'un input
  client manipulable.

**Performance** — n/a (lecture pure).

**Accessibilité / UI/UX** — n/a (événements non visibles).

**i18n fr/ar**
- La `value` (199) est **identique** entre fr et ar ; seul l'affichage devise
  diffère (CPN-06). Le tracking n'est pas localisé en montant.

**Observabilité / tracking** (cœur)
- Cohérence inter-événements : tous portent la même value pour un même contexte.
- Aucune duplication / aucun double comptage induit par la bascule coupon.
- Cohérence avec le bucket : treatment→199, holdout→289.

---

## (d) Edge cases & matrice d'états

| État | Source prix | `getKitLeadValue` | `view_item` | `purchase` | `generate_lead` |
|---|---|---|---|---|---|
| Coupon actif (treatment) | coupon -90 → 19900 | 199 | 199 | 199 | 199 |
| Holdout (prix plein) | coupon, bucket holdout | 289 | 289 | 289 | 289 |
| Coupon OFF + promo statique 19900 | fallback computePromo | 199 | 199 | 199 | 199 |
| Tout désactivé | base 28900 | 289 | 289 | 289 | 289 |
| Devise produit MAD | coupon actif | 199 MAD | 199 MAD | 199 MAD | 199 MAD |
| Locale ar | coupon actif | 199 (MAD) | 199 | 199 | 199 |
| Anti-pattern centimes | bug | 199 (PAS 19900) | 199 | 199 | 199 |
| Anti-pattern prix barré | bug | 199 (PAS 289 quand coupon actif) | 199 | 199 | 199 |
| qty 2 (purchase) | coupon actif | n/a | n/a | 398 (39800/100) | n/a |

---

## (e) Risques

| ID | Risque | Impact | Mitigation testée |
|---|---|---|---|
| R-16-1 | `value` = 289 (prix barré) quand client paie 199 | Meta sur-évalue → bid trop haut → CPA réel pire | Oracle value===199 sur toutes surfaces |
| R-16-2 | `value` en centimes (19900) | value ×100 → ROAS faux | value===199 strict, !==19900 |
| R-16-3 | Bascule coupon casse la value (régression) | ROAS dégrade silencieusement | Parité avant/après bascule |
| R-16-4 | Incohérence inter-événements (view 199, purchase 289) | Funnel value incohérent, attribution faussée | Cohérence cross-events |
| R-16-5 | Holdout reçoit value 199 alors qu'il paie 289 | Mesure incrémentalité faussée | treatment→199, holdout→289 |
| R-16-6 | Value localisée différemment en ar | Doublon / valeur divergente par locale | value identique fr/ar |
| R-16-7 | `purchase` value ≠ totalCents/100 | Désalignement avec montant facturé | purchase value === total/100 |
| R-16-8 | Double comptage lead+purchase (pont CPN-09) | Conversions gonflées | Dédup événements (réf. lead-as-purchase) |

---

## (f) Critères d'acceptation testables

- **AC-16-1** : coupon actif → `getKitLeadValue()` = `{ value: 199, currency: 'MAD' }`.
- **AC-16-2** : `view_item` émis sur `/kit` porte `params.value === 199` et `currency === 'MAD'`.
- **AC-16-3** : `purchase`/order pour qty=1 porte `value === 199` (= totalCents/100).
- **AC-16-4** : `generate_lead` (chat/contact) porte `value === 199`.
- **AC-16-5** : pour un même contexte, `view_item.value === purchase.value === generate_lead.value` (199).
- **AC-16-6** : AUCUN événement ne porte `value === 289` ni `value === 19900`
  quand le coupon est actif (treatment).
- **AC-16-7** : coupon OFF + promo statique 19900 → value reste `199` (invariance source).
- **AC-16-8** : tout désactivé (base 28900) → `value === 289` sur toutes surfaces (cohérent).
- **AC-16-9** : visiteur `holdout` (prix plein) → `value === 289` ; visiteur
  `treatment` → `value === 199` (cohérence bucket).
- **AC-16-10** : `dataLayer.params.value` est en unité majeure (199), jamais en centimes.
- **AC-16-11** : E2E `/kit` → `view_item` value=199 ; E2E checkout → `purchase`
  value=199 ; la bascule coupon ne casse pas le gate G-TRACKING-VALUE.
