# CPN-19 — Déterminisme du holdout & bucketing

> Périmètre : la fonction de bucketing déterministe utilisée par
> `resolveProductPricing` (CPN-04) pour assigner un visiteur à `treatment`
> (coupon appliqué) ou `holdout` (groupe contrôle, prix plein). Implémentation
> attendue : `apps/web/src/lib/coupons/engine.ts` (ou `holdout.ts`) →
> `assignBucket(visitorKey, couponId, holdoutPct)`.
> Criticité **P0**. Porte le gate **G-HOLDOUT-DETERMINISM** (bloquant) : *même
> `visitorKey` → même bucket à l'affichage ET au checkout, 100 % du temps*.

---

## (a) Fonctionnement optimal

Le bucket mesure l'incrémentalité du coupon : une fraction `holdoutPct` des
visiteurs éligibles est privée du coupon (prix plein) pour comparer leur taux de
conversion à celui des traités. La règle :

```
bucket = (hash(visitorKey + ':' + couponId) % 100) < holdoutPct
         ? 'holdout'
         : 'treatment'
```

Propriétés **non négociables** :

1. **Déterminisme** : la fonction est pure. `(visitorKey, couponId, holdoutPct)`
   identiques → bucket identique, à chaque appel, sur n'importe quel processus
   (affichage SSR, route order-repo). Aucune dépendance à l'horloge, au hasard,
   à l'ordre, à un état partagé.
2. **Stabilité affichage↔checkout** : c'est le cœur de l'invariant prix.
   `resolveProductPricing` est appelée côté affichage (`/kit`) ET côté order-repo
   (repricing). Le **même `visitorKey`** doit produire le **même bucket**, donc
   le **même prix**, sinon `PriceMismatchError 422`.
3. **`holdoutPct = 0` → toujours `treatment`** : `n % 100 < 0` est toujours faux.
4. **`holdoutPct = 100` → toujours `holdout`** (si `visitorKey` présent) :
   `n % 100 < 100` est toujours vrai (`n` ∈ [0,99]).
5. **`visitorKey` absent / vide → `treatment` par défaut** : jamais de holdout
   sans clé stable. Un visiteur sans clé ne doit pas être privé du coupon sur la
   base d'un hash instable.
6. **Distribution** : pour `holdoutPct = p`, sur un grand échantillon de
   `visitorKey` distincts, la proportion en holdout ≈ `p %` (le hash répartit
   uniformément le `% 100`).

> **Choix de hash** : implémentation-définie (ex. SHA-256 tronqué, FNV-1a,
> djb2…). La spec ne fige PAS l'algorithme, mais fige le **contrat** : stable,
> uniforme sur `%100`, identique entre surfaces. Les fixtures testent le contrat
> (stabilité, distribution, bornes), pas un mapping clé→bucket précis — sauf les
> trois cas absolus (pct=0, pct=100, no-key) qui sont indépendants du hash.

---

## (b) Contrats I/O

### Signature

```ts
type Bucket = 'treatment' | 'holdout';

function assignBucket(
  visitorKey: string | null | undefined,
  couponId: string,
  holdoutPct: number, // 0..100 (clampé)
): Bucket;
```

### Invariants

- **INV-1 (pureté/déterminisme)** : `assignBucket(k, c, p)` constant pour entrées constantes.
- **INV-2 (pct=0)** : `assignBucket(k, c, 0) === 'treatment'` pour tout `k`, `c`.
- **INV-3 (pct=100 avec clé)** : `assignBucket(k, c, 100) === 'holdout'` pour tout `k != null/''`, `c`.
- **INV-4 (no-key)** : `visitorKey` `null`/`undefined`/`''` → `'treatment'` quel que soit `holdoutPct` (y compris 100).
- **INV-5 (dépendance couponId)** : le bucket dépend de `couponId` ; un même visiteur peut être holdout sur un coupon et treatment sur un autre.
- **INV-6 (cross-surface)** : la valeur calculée côté affichage == la valeur côté order-repo pour `(visitorKey, couponId, holdoutPct)` identiques.
- **INV-7 (clamp)** : `holdoutPct < 0` traité comme 0 ; `> 100` traité comme 100 (pas d'exception).
- **INV-8 (uniformité)** : sur N≥10000 clés distinctes, |proportion_holdout − holdoutPct/100| < tolérance (ex. ±3 points).

---

## (c) Points de vérification par axe

**Backend**
- Bornes : pct=0 (0/N holdout), pct=100 (N/N holdout si clé présente).
- Stabilité : même `(visitorKey, couponId)` sur 10000 appels → 0 variation.
- Dépendance `couponId` : changer le couponId peut changer le bucket.
- Clamp pct hors [0,100] sans throw.

**Frontend** — *indirect* : le prix affiché reflète le bucket (treatment = prix
remisé, holdout = prix plein). Vérifié au niveau cross-surface (CPN-06/08) plutôt
qu'ici.

**Data**
- `holdoutPct` lu depuis `coupons.holdout_pct` (integer, défaut 0).
- `visitorKey` = hash anonyme (PAS de PII) — cohérent avec `coupon_events.visitor_key`.
- Le bucket enregistré dans `coupon_events.bucket` doit égaler le bucket calculé
  à l'affichage et au checkout (traçabilité).

**Sécurité**
- `visitorKey` ne contient pas de PII ; le hash n'est pas réversible vers une
  identité. Un visiteur ne peut pas « forcer » treatment en manipulant sa clé de
  façon prévisible sans connaître l'algo — mais la sécurité ne repose pas là-dessus
  (le holdout est une mesure analytique, pas un contrôle d'accès).

**Performance**
- O(longueur clé) pour le hash, négligeable. Doit rester < 0.05 ms/appel ; pas de
  mise en cache nécessaire (la décision NE doit PAS être cachée par requête —
  cf. CPN-18, le bucket se recalcule de façon stable, jamais figé par un cache HTTP).

**Observabilité**
- Le bucket est journalisé une fois (phase `exposed`/`converted`, CPN-09) ; le
  recalcul doit redonner la même valeur (auditabilité).

**i18n / a11y** — *non applicable* (pas de rendu).

---

## (d) Edge cases & matrice d'états

| État | Entrée | Attendu |
|---|---|---|
| Nominal pct=50 | clé stable, couponId fixe | bucket déterministe constant |
| Limite pct=0 | toute clé | `treatment` (0 % holdout) |
| Limite pct=100 + clé | clé présente | `holdout` |
| Limite pct=100 sans clé | `visitorKey=null` | `treatment` (INV-4 prime sur pct) |
| Vide visitorKey null | null, pct=50 | `treatment` |
| Vide visitorKey '' | chaîne vide, pct=50 | `treatment` |
| Stabilité | même (clé, couponId) × 10000 | 1 seule valeur de bucket |
| Distribution pct=50 | 10000 clés distinctes | ~50 % holdout (±3 pts) |
| Distribution pct=10 | 10000 clés distinctes | ~10 % holdout (±3 pts) |
| Dépendance couponId | même clé, 2 couponId | buckets potentiellement différents |
| Invalide pct=-5 | clampé à 0 | `treatment`, pas de throw |
| Invalide pct=150 | clampé à 100 | `holdout` si clé, pas de throw |
| Cross-surface | même (clé, couponId, pct) côté affichage & order-repo | buckets égaux (gate) |
| Concurrence | appels parallèles affichage/checkout | pas d'état partagé → cohérent |
| Cache | bucket recalculé après revalidateTag | inchangé pour mêmes entrées (jamais figé/incohérent) |

---

## (e) Risques

| ID | Risque | Impact | Mitigation testée |
|---|---|---|---|
| R-19-1 | Hash non déterministe (Math.random, ordre, env) | Bucket instable → 422 mismatch | INV-1 + 10000 appels stables |
| R-19-2 | Bucket différent affichage vs checkout | Prix affiché ≠ facturé → 422 | INV-6 + test cross-surface (gate) |
| R-19-3 | Holdout sans visitorKey (clé instable) | Visiteur privé de coupon arbitrairement | INV-4 : no-key → treatment |
| R-19-4 | pct=100 ne donne pas holdout / pct=0 donne holdout | Mesure d'incrémentalité fausse | INV-2/3 |
| R-19-5 | Distribution biaisée (hash mal réparti) | Groupes contrôle non comparables | INV-8 distribution ±3 pts |
| R-19-6 | Bucket figé par cache HTTP/`unstable_cache` | Visiteur collé au mauvais bucket | CPN-18 : décision non cachée ; recalcul stable |
| R-19-7 | Oubli de couponId dans le hash | Tous coupons partagent le même split | INV-5 dépendance couponId |
| R-19-8 | Exception sur pct hors bornes / clé exotique | Page /kit cassée | INV-7 clamp + caractères unicode |

---

## (f) Critères d'acceptation testables

- **AC-19-1** : `assignBucket(k, c, 0) === 'treatment'` pour 1000 clés aléatoires.
- **AC-19-2** : `assignBucket(k, c, 100) === 'holdout'` pour 1000 clés non vides.
- **AC-19-3** : `assignBucket(null|undefined|'', c, p) === 'treatment'` pour tout `p` y compris 100.
- **AC-19-4** : pour un `(visitorKey, couponId)` fixe, 10000 appels renvoient une seule valeur de bucket (set de taille 1).
- **AC-19-5** : pour 10000 `visitorKey` distincts, `pct=50` → proportion holdout ∈ [47 %, 53 %] ; `pct=10` → ∈ [7 %, 13 %].
- **AC-19-6** : le bucket calculé par `resolveProductPricing` côté affichage == celui côté order-repo pour le même contexte (test cross-surface, gate G-HOLDOUT-DETERMINISM).
- **AC-19-7** : `holdoutPct=-5` → treatment ; `holdoutPct=150` (clé présente) → holdout ; aucun throw.
- **AC-19-8** : changer uniquement `couponId` (même clé, même pct) peut changer le bucket — au moins une clé démontre la dépendance.
- **AC-19-9** : aucune dépendance à `Date.now()`/`Math.random()` (espionnés, jamais appelés pendant `assignBucket`).
