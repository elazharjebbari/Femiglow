# CPN-05 — Construction du contexte coupon (`buildCouponContext`)

> Périmètre : `apps/web/src/lib/coupons/context.ts` → `buildCouponContext(...)`.
> **server-only**. Extrait, depuis les en-têtes/cookies de la requête, le
> `CouponContext` consommé par `resolveCoupon` (CPN-03) et `resolveProductPricing`
> (CPN-04). Deux points d'appel : **Server Component** (`/kit`, via `headers()`/
> `cookies()` de Next) et **API checkout** (`/api/checkout/**`, via `req.headers`).
> Criticité **P0** : si les deux points construisent un **`visitorKey` divergent**,
> le bucket diffère → prix affiché ≠ prix facturé → `PriceMismatchError` 422.
> C'est le **garant d'amont** de l'invariant maître.

---

## (a) Fonctionnement optimal

`buildCouponContext` est une **fonction d'extraction pure** (au sens : aucun I/O,
aucune décision de prix) qui transforme une source d'en-têtes + cookies en
`CouponContext`. Champs dérivés :

1. **`trafficSource`** — déterminé par priorité :
   1. `utm_source` (query param propagé / cookie d'attribution) si présent et
      mappé (`facebook|ig|instagram` → `paid_social`, `email|newsletter|klaviyo`
      → `email`, etc.) ;
   2. sinon classification du `referer` (host social → `social_organic`, moteur
      → `organic_search`, host interne/absent → `direct`) ;
   3. défaut `'direct'` (jamais `null` pour la source : un trafic non identifié
      est `direct`, pas inconnu — évite un faux no-match d'éligibilité).
2. **`device`** — depuis `user-agent` : regex mobile → `'mobile'`, tablette
   connue → `'tablet'`, sinon `'desktop'`. UA absent/illisible → `'desktop'`
   (défaut conservateur).
3. **`visitorType`** — `'returning'` si un cookie de session/visite récurrente
   est présent (ex. `_fg_seen`/cookie session existant), sinon `'first'`.
   Absence de cookie → `'first'`.
4. **`visitorKey`** — **hash anonyme stable** dérivé d'un identifiant de session
   ou du `_fbp` (cookie Meta). Règles :
   - on lit la **même source canonique** des deux côtés (ordre de préférence
     identique : `session cookie` puis `_fbp`) ;
   - on applique le **même hash** (ex. sha256 tronqué) → `visitorKey` **stable**
     pour un même visiteur entre SC et API ;
   - **jamais de PII** : pas d'email, pas de téléphone, pas d'IP brute en clair
     dans la clé ;
   - **cookie absent / source vide → `visitorKey = null`** (en aval : CPN-04 →
     `bucket = 'treatment'`).
5. **`now`** — **injectable** pour les tests ; en prod = `new Date()` capturé
   une fois en entrée (jamais `Date.now()` disséminé dans le pipeline aval).
6. **`currency`** — portée depuis la variante/contexte produit (MAD en Phase 1).

### Équivalence SC ↔ API (cœur de la feature)

Le **même visiteur** (mêmes cookies, mêmes en-têtes pertinents) doit produire
le **même `visitorKey`**, donc le même `trafficSource/device/visitorType` *dans
la mesure où les en-têtes sont présents des deux côtés*. La fonction expose donc
une **forme normalisée d'entrée** (`HeaderSource`) que **les deux adaptateurs**
(`fromServerComponent()` lisant `headers()/cookies()` et `fromApiRequest(req)`
lisant `req.headers`) remplissent à l'identique. Le cœur d'extraction est
**partagé** (une seule implémentation), seuls les adaptateurs diffèrent →
divergence structurellement impossible si les deux passent la même `HeaderSource`.

---

## (b) Contrats I/O

### Signature

```ts
interface HeaderSource {
  get(name: string): string | null;          // en-têtes (referer, user-agent, …)
  getCookie(name: string): string | null;    // cookies (_fbp, session, _fg_seen…)
  getQuery?(name: string): string | null;    // utm_source si propagé
}

interface CouponContext {
  now: Date;
  currency: string;
  trafficSource: string;                      // jamais null : 'direct' par défaut
  visitorType: 'first' | 'returning';
  device: 'mobile' | 'desktop' | 'tablet';
  visitorKey: string | null;                  // null si aucune source -> treatment
}

function buildCouponContext(src: HeaderSource, opts: { now: Date; currency: string }): CouponContext;

// adaptateurs (server-only)
function couponContextFromServerComponent(opts): CouponContext; // headers()/cookies()
function couponContextFromApiRequest(req: Request, opts): CouponContext; // req.headers
```

### Invariants

- **INV-1 (équivalence SC/API)** : pour une `HeaderSource` équivalente (mêmes
  cookies/en-têtes), `couponContextFromServerComponent` et
  `couponContextFromApiRequest` produisent un **`visitorKey` identique**.
- **INV-2 (stabilité)** : `visitorKey` est stable dans le temps pour un même
  cookie source (le hash ne dépend que de l'identifiant, pas de `now`).
- **INV-3 (anonymat)** : `visitorKey` ne contient aucune PII et n'est pas
  inversible trivialement (hash) ; jamais l'IP brute ou l'email.
- **INV-4 (cookie absent → null)** : aucune source d'identité → `visitorKey === null`.
- **INV-5 (trafficSource jamais null)** : défaut `'direct'`.
- **INV-6 (device défaut desktop)** : UA absent/illisible → `'desktop'`.
- **INV-7 (visitorType défaut first)** : pas de cookie récurrence → `'first'`.
- **INV-8 (pas d'exception)** : en-têtes manquants/malformés/UA exotique → valeurs
  par défaut, jamais throw.
- **INV-9 (now injecté)** : `now` provient de `opts.now`, jamais `Date.now()` interne.

---

## (c) Points de vérification par axe

**Backend**
- Ordre de priorité `trafficSource` : `utm_source` > `referer` > `'direct'`.
- Mapping `utm_source`/`referer` → catégories canoniques (table de mapping testée).
- `device` : regex mobile/tablet/desktop sur un panel d'UA réels.
- `visitorKey` : même source canonique + même hash des deux côtés.
- Cœur d'extraction **partagé** par les deux adaptateurs (pas de double impl).

**Frontend** — *non applicable* (server-only). En aval, le contexte alimente
`/kit` (CPN-06) sans flash et le checkout (CPN-08) sans 422.

**UI/UX & Design/charte** — *non applicable* (pas de rendu).

**Data**
- `_fbp`/cookie session lus en lecture seule ; aucune écriture de cookie ici.
- `visitorKey` est un dérivé (hash), pas la valeur brute du cookie → pas de
  fuite de l'identifiant Meta tel quel.

**Sécurité**
- **PII** : assertion explicite qu'aucune entrée PII (email/téléphone/IP brute)
  ne transite dans `visitorKey` ni dans `CouponContext`.
- server-only : pas d'exposition au bundle client.
- En-têtes **forgés** (`x-forwarded-*`, referer spoofé) ne peuvent que changer
  `trafficSource`/`device` (qui ne donnent une remise que si l'éligibilité du
  coupon l'autorise — pas d'escalade de prix au-delà du coupon).
- `utm_source` attaquant arbitraire → mappé sinon ignoré ; pas d'injection
  (valeur traitée comme donnée, pas exécutée).

**Performance**
- Extraction O(1) par champ ; hash unique ; budget p95 < 1 ms.

**Accessibilité** — *non applicable*.

**i18n (fr/ar)**
- `currency` portée (MAD) ; aucune chaîne localisée produite ici. Les en-têtes
  `accept-language` ne modifient pas `visitorKey` (pas de dépendance locale au bucket).

**Observabilité**
- Le contexte construit peut être journalisé (debug) **sans PII** ; `visitorKey`
  loggable car anonyme. Pas de log bloquant.

---

## (d) Edge cases & matrice d'états

| État | Situation | Attendu |
|---|---|---|
| Nominal | cookie _fbp présent, UA mobile, utm_source=facebook | `visitorKey!=null`, `device:'mobile'`, `trafficSource:'paid_social'` |
| Vide | aucun cookie, aucun referer, aucun UA | `visitorKey:null`, `device:'desktop'`, `trafficSource:'direct'`, `visitorType:'first'` |
| Source utm prioritaire | utm_source=email ET referer social | `trafficSource:'email'` (utm gagne) |
| Source referer fallback | pas d'utm, referer = instagram.com | `trafficSource:'social_organic'` |
| Source inconnue | utm_source=xyz non mappé, pas de referer | `trafficSource:'direct'` |
| Device tablet | UA iPad | `device:'tablet'` |
| Device UA exotique | UA = chaîne aléatoire/vide | `device:'desktop'` (défaut), pas de throw |
| visitorType returning | cookie récurrence présent | `visitorType:'returning'` |
| Cookie absent | pas de session ni _fbp | `visitorKey:null` |
| Limite | _fbp présent mais chaîne vide | traité comme absent → `visitorKey:null` |
| Invalide | _fbp malformé (non-fb.x.y.z) | hash quand même la valeur OU null ; **jamais throw** ; comportement identique SC/API |
| Erreur réseau | n/a (pas d'I/O) | — |
| Concurrence | deux requêtes même visiteur en parallèle | même `visitorKey` (déterministe sur la source) |
| Cache | contexte jamais caché (dépend cookie) | recalculé à chaque requête (cf. CPN-18 bucket non caché) |
| **Équivalence SC↔API** | mêmes cookies/en-têtes via les 2 adaptateurs | **`visitorKey` strictement identique** |
| Divergence en-têtes | API reçoit _fbp mais pas le referer (utm absent des 2) | `visitorKey` identique (dérivé du _fbp uniquement) ; `trafficSource` peut différer → mais le bucket ne dépend QUE de visitorKey+couponId → prix stable |
| i18n | accept-language ar vs fr | `visitorKey` inchangé |
| a11y | n/a | — |

---

## (e) Risques

| ID | Risque | Impact | Mitigation testée |
|---|---|---|---|
| R-05-1 | `visitorKey` divergent SC vs API | Bucket différent → mismatch 422 | INV-1 + test d'équivalence dédié |
| R-05-2 | `visitorKey` instable dans le temps (dépend de now) | Bucket change entre affichage et checkout | INV-2 + hash ne dépend pas de now |
| R-05-3 | PII dans `visitorKey`/contexte | Fuite RGPD / cookie Meta exposé | INV-3 + assert anti-PII |
| R-05-4 | Cookie absent mis en holdout/treatment incohérent | Bucket instable pour anonymes | INV-4 (visitorKey null) + CPN-04 INV-8 (null→treatment) |
| R-05-5 | `trafficSource` null casse l'éligibilité | Faux no-match → promo non servie | INV-5 (défaut 'direct') |
| R-05-6 | Exception sur en-têtes malformés | Page /kit ou checkout 500 | INV-8 + cas UA exotique/_fbp vide |
| R-05-7 | Double implémentation extraction (SC vs API divergent) | Divergence structurelle | cœur partagé + test que les 2 adaptateurs appellent le même core |
| R-05-8 | utm_source forgé donne une remise non méritée | Abus éligibilité ciblée | éligibilité tranchée par CPN-03 ; ici on vérifie juste le mapping data |
| R-05-9 | Fuite server-only vers client | Logique d'attribution exposée | test garde `server-only` |

---

## (f) Critères d'acceptation testables

- **AC-05-1** : `HeaderSource` équivalente passée aux deux adaptateurs →
  `couponContextFromServerComponent(src).visitorKey === couponContextFromApiRequest(src).visitorKey`.
- **AC-05-2** : pour un `_fbp` donné, `visitorKey` est **identique** quel que soit
  `opts.now` (stabilité temporelle) → hash indépendant de l'horloge.
- **AC-05-3** : aucun cookie d'identité (`_fbp` et session absents/vides) →
  `visitorKey === null`.
- **AC-05-4** : `utm_source=facebook` → `trafficSource==='paid_social'` ;
  `utm_source=klaviyo` → `'email'` ; utm absent + referer instagram →
  `'social_organic'` ; rien → `'direct'`.
- **AC-05-5** : UA iPhone → `device==='mobile'` ; UA iPad → `'tablet'` ;
  UA Windows Chrome → `'desktop'` ; UA vide/exotique → `'desktop'` sans throw.
- **AC-05-6** : cookie de récurrence présent → `visitorType==='returning'` ;
  absent → `'first'`.
- **AC-05-7** : `utm_source` ET `referer` présents et discordants → `utm_source`
  l'emporte (priorité).
- **AC-05-8** : `visitorKey` ne contient ni l'email, ni le téléphone, ni l'IP
  brute, ni la valeur `_fbp` en clair (assert que la sortie ≠ entrée brute et
  ne matche aucun pattern PII).
- **AC-05-9** : en-têtes/cookies manquants ou malformés →
  `expect(()=>buildCouponContext(...)).not.toThrow()` et valeurs par défaut
  (`direct`/`desktop`/`first`/`visitorKey:null`).
- **AC-05-10** : `now` rendu === `opts.now` (jamais `new Date()` interne sous test).
- **AC-05-11** : `trafficSource` n'est jamais `null`/`undefined` (toujours une
  chaîne canonique).
- **AC-05-12** : `accept-language` (ar vs fr) ne change pas `visitorKey`.
