# CPN-03 — Moteur `resolveCoupon` (sélection)

> Périmètre : `apps/web/src/lib/coupons/engine.ts` → `resolveCoupon(ctx)`.
> **server-only**. Choisit AU PLUS un coupon applicable parmi les candidats, ou
> renvoie `null`. Ne calcule aucun prix (c'est `applyCoupon`, CPN-02) : elle
> tranche uniquement *quel* coupon s'applique. Criticité **P0** : une mauvaise
> sélection produit un mismatch prix affichage↔caisse.

---

## (a) Fonctionnement optimal

`resolveCoupon` est un **filtre + tri déterministe** appliqué à une liste de
coupons candidats (issus du repo / cache). Pipeline, dans cet ordre exact :

1. **Statut** : ne retenir que `status === 'active'`. `draft`, `paused`,
   `archived` sont éliminés (jamais sélectionnables).
2. **Fenêtre de validité** (bornes incluses, temps = `ctx.now` injecté) :
   - retenir si `(startsAt == null || startsAt <= now)` ET `(endsAt == null || now <= endsAt)`.
   - `startsAt`/`endsAt` à `null` = borne ouverte de ce côté.
3. **Cible/devise** : `target === 'product_price'` (Phase 1) et `currency`
   compatible avec le contexte (garde-fou — un coupon EUR ne s'applique pas à un
   prix MAD).
4. **Éligibilité** (`eligibility` JSONB) :
   - `{}` (vide) → **tout le trafic** éligible.
   - sinon, pour chaque clé présente (`trafficSource`, `visitorType`, `device`),
     la valeur du contexte doit appartenir à la liste autorisée. Une clé absente
     de `eligibility` n'est pas contrainte. **ET logique** entre clés présentes.
5. **Non-cumul** : Phase 1 n'applique **jamais** deux coupons. Quel que soit
   `stackable`, la sélection renvoie un seul coupon. `stackable=false` est le
   défaut ; s'il reste plusieurs candidats, on départage par tri.
6. **Tri de sélection** :
   - **priorité décroissante** (`priority` desc) ;
   - **tie-break déterministe** sur égalité de priorité : `createdAt` croissant
     (le plus ancien gagne), puis `id` croissant (lexicographique) comme
     ultime départage stable.
7. **Résultat** : le premier candidat après tri, ou `null` si la liste filtrée
   est vide.

> Le **bucket holdout** N'EST PAS décidé ici : `resolveCoupon` choisit le coupon ;
> le bucketing (`treatment`/`holdout`) est appliqué par `resolveProductPricing`
> (CPN-04) / le déterminisme du bucket (CPN-19). `resolveCoupon` est neutre vis-à-vis
> du holdout — elle renvoie le coupon « gagnant » indépendamment du bucket.

---

## (b) Contrats I/O

### Signature

```ts
interface CouponContext {
  now: Date;                 // temps injecté, jamais Date.now()
  currency: string;          // devise de la variante (ex. 'MAD')
  trafficSource?: string | null;  // ex. 'paid_social', 'email', 'social_organic', 'direct'
  visitorType?: 'first' | 'returning' | null;
  device?: 'mobile' | 'desktop' | 'tablet' | null;
  visitorKey?: string | null;     // clé stable (passée à CPN-19 en aval)
  candidates: CouponRow[];   // coupons connus (repo/cache) à filtrer
}

interface CouponEligibility {
  trafficSource?: string[];
  visitorType?: Array<'first' | 'returning'>;
  device?: Array<'mobile' | 'desktop' | 'tablet'>;
}

function resolveCoupon(ctx: CouponContext): CouponRow | null;
```

> `candidates` peut être fourni directement (test pur) ou chargé en amont par le
> contexte server. La fonction reste déterministe pour une liste + un `now` donnés.

### Invariants

- **INV-1 (déterminisme)** : même `candidates` (même ordre ou non) + même `ctx`
  → même coupon retourné. Le tie-break garantit l'indépendance vis-à-vis de
  l'ordre d'entrée.
- **INV-2 (au plus un)** : retourne un `CouponRow` ou `null`, jamais un tableau.
- **INV-3 (statut)** : un coupon retourné a forcément `status === 'active'`.
- **INV-4 (fenêtre, bornes incluses)** : `startsAt <= now <= endsAt` accepté aux bornes exactes.
- **INV-5 (éligibilité ouverte)** : `eligibility === {}` ne filtre rien.
- **INV-6 (pas de holdout ici)** : le résultat ne dépend pas de `holdoutPct` ni de `visitorKey`.
- **INV-7 (pas d'exception)** : `eligibility` malformée ou contexte partiel → coupon ignoré, jamais throw.

---

## (c) Points de vérification par axe

**Backend**
- Ordre du pipeline respecté (statut → fenêtre → cible/devise → éligibilité → tri).
- Bornes de fenêtre inclusives à la milliseconde près sur `ctx.now`.
- `eligibility {}` = passe-tout ; clés multiples = ET logique ; clé absente = non contrainte.
- Tie-break stable : permuter l'ordre de `candidates` ne change pas le gagnant.

**Frontend** — *non applicable* (server-only). On vérifie en aval (CPN-06) que la
sélection alimente le prix public sans flash.

**Data**
- `eligibility` lu comme JSONB ; valeur inattendue (non-objet, listes vides)
  traitée sans crash (liste vide = aucun match → coupon écarté, à confirmer par AC-03-11).
- `priority`/`createdAt`/`id` présents pour un tri stable.

**Sécurité**
- server-only : `resolveCoupon` ne doit jamais fuir vers le bundle client
  (import garde `server-only`). Un contexte forgé (trafficSource arbitraire) ne
  peut sélectionner un coupon que si `eligibility` l'autorise — pas d'escalade.

**Performance**
- Filtrage + tri O(n log n) sur un n petit (<100 coupons actifs attendus).
  Budget p95 < 5 ms (lecture cachée des candidats — cf. CPN-18).

**Observabilité**
- `resolveCoupon` peut exposer la raison d'exclusion (debug) sans log bloquant.
  La journalisation `exposed` est faite en aval (CPN-09).

**i18n / a11y** — *non applicable*.

---

## (d) Edge cases & matrice d'états

| État | Situation | Attendu |
|---|---|---|
| Nominal | 1 coupon active, fenêtre ouverte, eligibility {} | ce coupon |
| Vide | `candidates: []` | `null` |
| Vide (filtré) | tous draft/paused/archived | `null` |
| Statut | 1 active + 1 paused mêmes critères | l'active |
| Fenêtre avant | `now < startsAt` | écarté |
| Fenêtre borne start | `now === startsAt` | retenu (inclusif) |
| Fenêtre pendant | `startsAt < now < endsAt` | retenu |
| Fenêtre borne end | `now === endsAt` | retenu (inclusif) |
| Fenêtre après | `now > endsAt` | écarté |
| Fenêtre ouverte | `startsAt=null, endsAt=null` | retenu (toujours dans la fenêtre) |
| Éligibilité ouverte | `eligibility {}` quel que soit le trafic | retenu |
| Éligibilité match | `trafficSource:['paid_social']`, ctx paid_social | retenu |
| Éligibilité no-match | `trafficSource:['paid_social']`, ctx email | écarté |
| Éligibilité visitorType | `visitorType:['first']`, ctx first | retenu ; returning → écarté |
| Éligibilité device | `device:['mobile']`, ctx desktop | écarté |
| Éligibilité ET multi-clés | source match mais device no-match | écarté (ET) |
| Éligibilité clé absente | eligibility ne contraint pas device, ctx device any | non contraint → retenu |
| Contexte partiel | eligibility exige trafficSource, ctx.trafficSource null | écarté (pas de match) |
| Non-cumul | 2 active non-stackables, priorités 10 vs 5 | priorité 10 |
| Tie-break priorité | 2 active, priorité 10 vs 10, createdAt distinct | le plus ancien |
| Tie-break createdAt égal | priorité + createdAt identiques | id lexicographique min |
| Invalide eligibility | eligibility = `{trafficSource: []}` (liste vide) | aucun match → écarté |
| Concurrence | candidates muté pendant l'appel | snapshot en entrée ; pas d'état partagé interne |
| Cache | candidats servis périmés | géré en amont (CPN-18) ; resolveCoupon prend la liste telle quelle |

---

## (e) Risques

| ID | Risque | Impact | Mitigation testée |
|---|---|---|---|
| R-03-1 | Coupon non-active sélectionnable | Promo fantôme / mismatch prix | INV-3 + cas statut |
| R-03-2 | Bornes de fenêtre exclusives par erreur | Coupon coupé une ms trop tôt/tard | Cas bornes exactes start/end |
| R-03-3 | `eligibility {}` interprété comme « personne » | Aucune promo servie | Cas éligibilité ouverte |
| R-03-4 | ET/OU inversé sur clés multiples | Mauvais ciblage trafic | Cas ET multi-clés |
| R-03-5 | Tie-break non déterministe (ordre d'entrée) | Bucket/prix instable entre requêtes | INV-1 + permutation candidates |
| R-03-6 | Deux coupons cumulés | Double remise / kit quasi gratuit | INV-2 + cas non-cumul |
| R-03-7 | Exception sur eligibility malformée | Page /kit cassée | INV-7 + cas liste vide/non-objet |
| R-03-8 | Fuite server-only vers client | Logique/donnée exposée | Test d'import `server-only` |

---

## (f) Critères d'acceptation testables

- **AC-03-1** : `candidates:[]` → `null`. Tous non-active → `null`.
- **AC-03-2** : seul un coupon `status:'active'` peut être retourné (les 3 autres statuts sont écartés, vérifié individuellement).
- **AC-03-3** : `now === startsAt` → retenu ; `now === endsAt` → retenu ; `now = startsAt-1ms` → écarté ; `now = endsAt+1ms` → écarté.
- **AC-03-4** : `startsAt=null && endsAt=null` → toujours dans la fenêtre.
- **AC-03-5** : `eligibility {}` → retenu quel que soit `trafficSource/visitorType/device`.
- **AC-03-6** : `eligibility {trafficSource:['paid_social']}` → retenu si ctx paid_social, écarté sinon (email, direct, social_organic, null).
- **AC-03-7** : `eligibility {visitorType:['first']}` → first retenu, returning écarté.
- **AC-03-8** : `eligibility {device:['mobile']}` → mobile retenu, desktop écarté.
- **AC-03-9** : éligibilité multi-clés = ET (un seul no-match suffit à écarter).
- **AC-03-10** : 2 coupons actifs non-stackables → un seul retourné, priorité desc gagne.
- **AC-03-11** : priorités égales → tie-break `createdAt` croissant puis `id` ; permuter l'ordre d'entrée ne change pas le gagnant (déterminisme).
- **AC-03-12** : `eligibility` malformée ou contexte partiel → jamais d'exception ; coupon écarté.
- **AC-03-13** : résultat indépendant de `holdoutPct`/`visitorKey` (mêmes candidats, holdoutPct 0 vs 100 → même coupon gagnant).
