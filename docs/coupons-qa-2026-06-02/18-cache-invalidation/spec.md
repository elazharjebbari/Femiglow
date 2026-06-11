# CPN-18 — Cache & invalidation des coupons

> Périmètre : la couche de **mise en cache de la DÉFINITION** des coupons
> (`apps/web/src/lib/coupons/repo.ts` → lecture cachée via `unstable_cache`
> avec tag `'coupons'`), son **invalidation** (`revalidateTag('coupons')` sur
> mutation admin, CPN-10/11), et son **interaction** avec :
> - l'ISR de `kit/page.tsx` (`export const revalidate = 1800`),
> - le cache produit `getKitProductCached` (tag `'products'`),
> - le cache config `getSection('flags')` (tag `'app-config'`),
> - la **décision de bucket** (CPN-19) qui **n'est JAMAIS cachée**.
> Criticité **P0** : un coupon expiré/pausé servi par un cache figé, ou un bucket
> figé partagé entre visiteurs, casse l'invariant maître (prix affiché == facturé)
> et l'isolation entre visiteurs.

---

## (a) Fonctionnement optimal

**Principe de séparation cache / décision** :

1. **La DÉFINITION du coupon est cachée** (lecture repo enveloppée dans
   `unstable_cache(..., { tags: ['coupons'] })`). C'est une donnée **stable entre
   visiteurs** (la définition ne dépend pas du visiteur) → cacheable.
2. **La VALIDITÉ TEMPORELLE est ré-évaluée à chaque résolution** avec `ctx.now`
   (CPN-03 §fenêtre). Le cache stocke `startsAt`/`endsAt` **bruts**, pas un
   booléen « actif maintenant » figé. Donc un coupon dont `endsAt` est passé
   **n'est pas servi**, même si sa définition est encore dans le cache : la
   comparaison `now <= endsAt` est faite **après** lecture, à chaque requête.
3. **La DÉCISION DE BUCKET n'est JAMAIS cachée** (CPN-19) : c'est une fonction
   pure `hash(visitorKey + couponId) % 100` appliquée **après** lecture de la
   définition cachée, sur le `visitorKey` du cookie de la requête courante. Ainsi
   deux visiteurs partageant la même entrée de cache « définition » obtiennent des
   buckets distincts → **pas de fuite entre visiteurs**.

**Invalidation sur mutation admin** :

4. Toute mutation admin qui change la définition/le statut d'un coupon
   (création, édition, activation, pause, archivage — CPN-10/11) appelle
   `revalidateTag('coupons')`. La prochaine lecture sert la **nouvelle** valeur.
5. **Activation** : `draft|paused → active` puis `revalidateTag('coupons')` →
   `/kit` reflète le coupon **sous le délai d'invalidation** (au plus le prochain
   render / lecture ; pas besoin d'attendre l'ISR 1800 s).
6. **Pause / archivage** : `active → paused|archived` puis `revalidateTag('coupons')`
   → la résolution suivante ne sélectionne plus ce coupon (CPN-03 §statut) →
   **fallback immédiat** sur la promo classique (CPN-04 fallback). Le prix retombe
   à `computePromo(price, promo)` dès l'invalidation.

**Interaction ISR `revalidate = 1800`** :

7. L'ISR régénère la page au plus toutes les 1800 s **en l'absence d'invalidation
   ciblée**. `revalidateTag('coupons')` est **plus prioritaire/rapide** : il
   purge l'entrée taguée sans attendre la fenêtre ISR. Une page servie depuis le
   cache ISR mais dont le tag `'coupons'` a été invalidé doit refléter la nouvelle
   définition au prochain rendu déclenché par l'invalidation. (Le scénario à
   éviter : un coupon expiré servi 1800 s « par inertie ISR » — empêché par la
   ré-évaluation de validité au point 2, qui s'applique même sur une page ISR si
   la lecture passe par la résolution ; la stratégie privilégie une **résolution
   au rendu** plutôt qu'un prix figé dans le HTML statique.)

**Indépendance des tags** : invalider `'coupons'` ne purge pas `'products'` ni
`'app-config'` et réciproquement. Chaque tag a sa responsabilité.

---

## (b) Contrats I/O

```ts
// lecture cachée de la définition (stable entre visiteurs)
const getActiveCouponsCached = unstable_cache(
  async () => loadCandidateCouponsFromDb(),  // définitions brutes
  ['coupons:candidates'],
  { tags: ['coupons'] },
);

// décision NON cachée (par requête, dépend du cookie)
function decideBucket(visitorKey: string | null, couponId: string, holdoutPct: number): 'treatment' | 'holdout';

// mutation admin -> invalidation
async function onCouponMutation(...) {
  await persist(...);
  revalidateTag('coupons');   // purge la définition cachée
}
```

### Invariants

- **INV-1 (définition cachée, tag coupons)** : la lecture des candidats passe par
  `unstable_cache` taggé `'coupons'` ; deux lectures rapprochées sans mutation
  servent la même valeur (hit cache) sans toucher la DB.
- **INV-2 (validité ré-évaluée)** : un coupon dont `endsAt < now` n'est jamais
  sélectionné, même si sa définition est en cache (validité comparée à `ctx.now`
  à chaque résolution, pas figée).
- **INV-3 (invalidation effective)** : après `revalidateTag('coupons')`, la
  prochaine lecture sert la nouvelle valeur (lit la DB / régénère l'entrée).
- **INV-4 (bucket non caché)** : `decideBucket` est appelée par requête ; deux
  visiteurs (visitorKey distincts) sur la même définition cachée peuvent obtenir
  des buckets différents. Le bucket n'apparaît dans aucune entrée de cache.
- **INV-5 (isolation visiteurs)** : aucune donnée dérivée du visiteur (bucket,
  visitorKey) n'est stockée dans le cache partagé `'coupons'`.
- **INV-6 (tags indépendants)** : `revalidateTag('coupons')` n'affecte pas
  `'products'`/`'app-config'`.
- **INV-7 (priorité invalidation > ISR)** : une invalidation ciblée prend effet
  sans attendre la fenêtre ISR 1800 s.
- **INV-8 (jamais d'exception)** : un cache miss / échec de lecture → fallback
  (CPN-04 INV-7), pas d'exception remontée à la page.

---

## (c) Points de vérification par axe

**Backend**
- La lecture repo des candidats est bien enveloppée par `unstable_cache` tag `'coupons'`.
- Chaque mutation admin (create/update/activate/pause/archive) appelle
  `revalidateTag('coupons')` exactement une fois après persistance réussie.
- La validité (`startsAt/endsAt`) est comparée à `ctx.now` à la résolution, pas
  pré-calculée et mise en cache comme booléen.
- `decideBucket` n'est jamais mémoïsée par `unstable_cache`.

**Frontend** — *indirect* : `/kit` (CPN-06) reflète l'état après invalidation
sans flash ; le module welcome-note (CPN-14) apparaît/disparaît cohéremment.

**UI/UX / Design / charte** — *non applicable directement* (couche cache). La
charte est vérifiée en aval ; ici on garantit juste la cohérence d'état servi.

**Data**
- Les définitions cachées sont les valeurs brutes (statut, startsAt, endsAt,
  eligibility, priority…), pas un agrégat figé.
- Une mutation concurrente + invalidation ne laisse pas une valeur périmée servie.

**Sécurité**
- Le cache `'coupons'` ne contient aucune donnée visiteur (pas de visitorKey,
  pas de bucket, pas de PII) → pas de fuite inter-visiteurs via cache partagé.
- `revalidateTag` n'est appelable que depuis les mutations admin authentifiées
  (RBAC, CPN-13) — pas d'invalidation déclenchable par un visiteur.

**Performance**
- Hit cache : lecture sans round-trip DB (budget p95 lecture < 2 ms).
- Invalidation : coût borné ; pas de purge globale (seul le tag `'coupons'`).
- ISR 1800 s : la page reste servie depuis le cache statique entre invalidations.

**Accessibilité** — *non applicable*.

**i18n (fr/ar)** — la langue ne fait pas partie de la clé de cache des coupons
(la définition est neutre en langue) ; invalidation indépendante de la locale.

**Observabilité**
- Journaliser (debug) les invalidations (`revalidateTag('coupons')`) et les
  cache hit/miss sans bloquer. Mesurer la latence affichage→effet après
  activation/pause.

---

## (d) Edge cases & matrice d'états

| État | Situation | Attendu |
|---|---|---|
| Nominal | coupon actif en cache, /kit lu 2x sans mutation | même valeur servie (hit), pas de double hit DB |
| Vide | aucun coupon en base | cache d'une liste vide ; /kit en fallback promo |
| Limite | coupon dont `endsAt === now` exact | encore valide (borne incluse, CPN-03), servi |
| Limite | coupon `endsAt = now - 1ms` mais définition encore cachée | **non sélectionné** (validité ré-évaluée) → fallback |
| Invalide | mutation persiste mais `revalidateTag` échoue/oublié | détecté : test que l'invalidation est bien émise (anti-régression) |
| Erreur réseau | lecture DB échoue au moment d'un cache miss | fallback silencieux (CPN-04 INV-7), pas d'exception |
| Concurrence | 2 admins activent/pausent quasi simultanément | dernière mutation + invalidation gagne ; pas de valeur périmée figée |
| Concurrence | activation pendant lecture en cours | la lecture en cours peut servir l'ancienne ; la suivante sert la nouvelle |
| **Cache (activation)** | draft→active + revalidate | /kit reflète le coupon sous le délai d'invalidation (sans attendre 1800 s) |
| **Cache (pause)** | active→paused + revalidate | fallback promo immédiat à la prochaine résolution |
| **Cache (expiration)** | coupon expiré encore en cache | jamais servi (validité re-vérifiée) |
| **Bucket non caché** | 2 visiteurs même définition cachée, visitorKey distincts | buckets indépendants ; aucune fuite |
| Tags croisés | revalidate('coupons') | `'products'`/`'app-config'` intacts |
| ISR vs tag | page en cache ISR + invalidation tag | nouvelle définition au prochain rendu post-invalidation |
| i18n | invalidation en contexte ar | identique fr (langue hors clé de cache) |
| a11y | n/a | — |

---

## (e) Risques

| ID | Risque | Impact | Mitigation testée |
|---|---|---|---|
| R-18-1 | Coupon expiré servi par cache figé | Promo fantôme / mismatch caisse | INV-2 + cas expiration (validité re-vérifiée) |
| R-18-2 | Pause/archivage sans effet (cache non invalidé) | Remise persistante non voulue | INV-3 + test `revalidateTag` émis sur mutation |
| R-18-3 | Bucket caché/partagé entre visiteurs | Fuite expérience / mismatch | INV-4/INV-5 + test 2 visiteurs même définition |
| R-18-4 | Données visiteur (visitorKey) dans le cache partagé | Fuite RGPD inter-visiteurs | INV-5 + assert contenu cache sans PII |
| R-18-5 | ISR 1800 s masque une invalidation | Effet admin différé jusqu'à 30 min | INV-7 + test priorité invalidation > ISR |
| R-18-6 | `revalidateTag` purge trop (tags croisés) | Sur-invalidation perf | INV-6 + test tags indépendants |
| R-18-7 | Cache miss lève une exception | Page /kit 500 | INV-8 + fallback silencieux |
| R-18-8 | `revalidateTag` déclenchable hors admin | Invalidation malveillante / DoS cache | RBAC (CPN-13) + test que seules les mutations admin l'émettent |

---

## (f) Critères d'acceptation testables

- **AC-18-1** : deux lectures rapprochées des candidats sans mutation → **un seul**
  accès DB (hit cache) ; spy sur `loadCandidateCouponsFromDb` appelé 1 fois.
- **AC-18-2** : un coupon dont `endsAt < ctx.now` présent dans la définition
  cachée → `resolveCoupon` renvoie `null` (validité ré-évaluée), donc /kit en
  fallback promo. (cache figé n'empêche pas l'expiration)
- **AC-18-3** : après `revalidateTag('coupons')`, la lecture suivante reflète la
  nouvelle définition (spy : DB ré-interrogée, nouvelle valeur servie).
- **AC-18-4** : activation `draft→active` + `revalidateTag('coupons')` → la
  résolution suivante **sélectionne** le coupon (effet sous le délai
  d'invalidation, pas après 1800 s).
- **AC-18-5** : pause `active→paused` + `revalidateTag('coupons')` → la
  résolution suivante ne sélectionne **plus** le coupon → prix retombe à
  `computePromo(price, promo)` (fallback immédiat).
- **AC-18-6** : deux visiteurs `visitorKey` distincts résolus sur la **même**
  définition cachée → `decideBucket` peut renvoyer des buckets distincts ; le
  bucket n'apparaît dans aucune entrée de cache (`decideBucket` non
  `unstable_cache`).
- **AC-18-7** : l'entrée de cache `'coupons'` ne contient ni `visitorKey`, ni
  `bucket`, ni PII (assert sur le contenu sérialisé caché).
- **AC-18-8** : `revalidateTag('coupons')` n'invalide pas `'products'` ni
  `'app-config'` (spy : ces tags non touchés).
- **AC-18-9** : chaque mutation admin réussie (create/update/activate/pause/
  archive) émet **exactement un** `revalidateTag('coupons')` après persistance ;
  une mutation **échouée** n'émet **aucune** invalidation.
- **AC-18-10** : un cache miss avec lecture DB en échec → fallback (pas
  d'exception remontée) ; `expect(render /kit).not.toThrow()`.
- **AC-18-11** : `revalidateTag('coupons')` n'est invoqué que depuis un contexte
  admin authentifié (aucune route visiteur ne peut le déclencher) — vérifié par
  inspection des points d'appel + test RBAC (lien CPN-13).
