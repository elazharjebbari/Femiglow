# F20 — Cycle de vie du crédit fidélité : activation différée + unicité + validité 60 j

## Rôle & surface
Verrouiller les **règles métier** du crédit de fidélité (grant) émis après une commande : **quand** le
code devient utilisable (activation différée selon la ville de livraison), **combien** de codes une
cliente peut détenir (un seul actif par téléphone, un seul par commande), et **jusqu'à quand** il vaut
(60 j après activation). Couche `I` (intégration, Vitest + `memoryStore` + `now` injecté, **aucun**
`Date.now()` dans les oracles), mais chaque règle a une **conséquence vécue par la cliente** :
- le code reçu en fin de commande affiche « utilisable à partir du JJ/MM » (`not_yet_active`) ;
- saisir le code trop tôt → message « pas encore actif » ; trop tard → « expiré » ;
- repasser commande avec le **même téléphone** → on lui rend **le même code** (pas de farming).

Surface logique : `apps/web/src/lib/coupons/delivery-delay.ts` (`maxDeliveryDays`, `computeActivatesAt`,
`DEFAULT_MAX_DELIVERY_DAYS`, `ACTIVATION_BUFFER_DAYS`) + `apps/web/src/lib/db/queries/coupon-grant-repo.ts`
(`issueGrant`, `findActiveGrantByPhone`, `findGrantBySourceOrder`, `validateGrant`,
`generateMemorableGrantCode`, `GRANT_VALIDITY_DAYS`). Point d'orchestration observé :
`apps/web/src/app/api/checkout/order/route.ts` (Phase 3 : `searchDeliveryCities` → `computeActivatesAt`
→ `issueGrant`, idempotent, best-effort, renvoie `loyalty.{code,valueCents,activatesAt}`).

Fichier de test : `src/lib/db/queries/coupon-grant-repo.activation.test.ts`.

## Fonctionnement optimal (ce qui DOIT se passer)
1. **Calcul d'activation (INV-ACTIVATION).** `computeActivatesAt(orderDate, eta)` =
   `orderDate + maxDeliveryDays(eta) + ACTIVATION_BUFFER_DAYS (1 j)`. `maxDeliveryDays` extrait la borne
   HAUTE du libellé admin et la convertit en jours : « 48 à 72 h » → ceil(72/24)=**3** ; « 24h » → 1 ;
   « 24-48h » → 2 ; « 3-5 jours » → 5 ; libellé non parsable / null → `DEFAULT_MAX_DELIVERY_DAYS` = **4**.
   Donc « 48 à 72 h » → activation = commande + 3 + 1 = **+4 jours**.
2. **Émission (Phase 3).** À la création de commande réussie (non rejouée), on émet un grant `issued`,
   code MÉMORABLE, `valueCents` du template `post_purchase`, `phoneE164` du lead, `activatesAt` calculé,
   `expiresAt = activatesAt + 60 j`. Best-effort : toute panne ⇒ pas de grant, jamais de crash commande.
3. **Format de code mémorable.** `generateMemorableGrantCode` → `FG-<MOT>-<NNNN>` (4 chiffres,
   zero-paddés), MOT ∈ liste maison. Dictable au téléphone, sans caractères ambigus.
4. **Idempotence par commande (INV-IDEMP-ORDER).** Deux `issueGrant` avec le même `sourceOrderId` →
   le **même** grant (même `id`, même `code`). Un re-jeu de la route ne crée pas de doublon.
5. **Unicité par téléphone (INV-IDEMP-PHONE, anti-farming).** Si un grant `issued` (actif) existe déjà
   pour ce `phoneE164`, une émission depuis une **autre** commande renvoie le grant **existant** (même
   code). Une cliente ne cumule pas plusieurs codes actifs.
6. **Validité & états (INV-VALIDITY).** `validateGrant(code, now)` est NON mutante (prévisualisation) :
   - `now < activatesAt` → `{ valid:false, reason:'not_yet_active', activatesAt }` ;
   - `activatesAt ≤ now ≤ expiresAt` → `{ valid:true, valueCents }` ;
   - `now > expiresAt` (= activatesAt + 60 j) → `{ valid:false, reason:'expired' }` ;
   - code inconnu → `not_found` ; déjà consommé → `already_redeemed`. Insensible à la casse + trim.

## Contrat I/O
- `maxDeliveryDays(eta: string|null|undefined): number` — borne haute en jours, défaut 4.
- `computeActivatesAt(orderDate: Date, eta): Date` — `orderDate + maxDeliveryDays + 1 j`.
- `issueGrant(input): Promise<CouponGrantRow|null>` — idempotent par `sourceOrderId` puis par
  `phoneE164` actif ; `expiresAt = activatesAt + GRANT_VALIDITY_DAYS (60) j`.
- `findActiveGrantByPhone(phone): Promise<CouponGrantRow|null>` — grant `issued` du téléphone.
- `validateGrant(code, now=new Date()): GrantValidity` — `{valid:true,grant,valueCents}` ou
  `{valid:false, reason:'not_found'|'already_redeemed'|'expired'|'not_yet_active', activatesAt?}`.
- `generateMemorableGrantCode(): string` — `FG-<MOT>-<NNNN>`.
- Constantes : `GRANT_VALIDITY_DAYS=60`, `DEFAULT_MAX_DELIVERY_DAYS=4`, `ACTIVATION_BUFFER_DAYS=1`.
- Route Phase 3 (observée) : réponse `{ ..., loyalty: { code, valueCents, activatesAt } }`.

## Cas limites & non-happy-path
- **ETA en heures vs jours** : « 48 à 72 h » → 3 (heures) ; « 3-5 jours » → 5 (jours) ; piège : un
  libellé contenant `h` ET `jour` est traité en heures (cf. garde `isDays && !isHours`).
- **ETA null / non parsable** (« express », « ») → `DEFAULT_MAX_DELIVERY_DAYS=4` → activation +5 j.
- **Frontière activation** : `now === activatesAt` → **valide** (borne incluse, `now < activatesAt`
  est strict) ; à `activatesAt - 1 ms` → `not_yet_active`.
- **Frontière expiration** : `now === expiresAt` → **valide** ; à `expiresAt + 1 ms` → `expired`.
- **`activatesAt` null** (grant sans délai) → jamais `not_yet_active` ; `expiresAt` null → jamais
  `expired` (le code reste valide tant que `issued`).
- **Idempotence ordre** : même `sourceOrderId`, valeurs différentes → renvoie l'existant inchangé.
- **Unicité téléphone** : 2 commandes même phone → 1 seul grant ; `listGrants({phoneE164})` length 1.
- **Téléphone null** → pas de garde phone (l'idempotence ne tient que par `sourceOrderId`).
- **Code consommé puis revalidé** → `already_redeemed` (a priorité sur expired/not_yet_active).
- **Casse / espaces** : `validateGrant(' fg-atlas-0042 ')` matche `FG-ATLAS-0042`.

## Invariants couverts
- **INV-ACTIVATION** : `activatesAt = orderDate + maxDeliveryDays(eta) + 1 j` ; avant ⇒ `not_yet_active`.
- **INV-VALIDITY** : `expiresAt = activatesAt + 60 j` ; après ⇒ `expired`.
- **INV-IDEMP-ORDER** : un `sourceOrderId` ⇒ au plus un grant (réémission renvoie l'existant).
- **INV-IDEMP-PHONE** : un téléphone ⇒ au plus un grant `issued` actif (anti-farming).
- Lacune d'audit : le **couplage** délai-ville → `activatesAt` → états `validateGrant` n'est pas testé
  en intégration (les briques le sont isolément) ; les frontières inclusives activation/expiration et
  la priorité des `reason` ne sont pas verrouillées.

## Critères d'acceptation (observables)
- `maxDeliveryDays('48 à 72 h')===3` ; `maxDeliveryDays('3-5 jours')===5` ; `maxDeliveryDays(null)===4`.
- `computeActivatesAt(d, '48 à 72 h')` === `d + 4 j` (3 livraison + 1 buffer).
- `issueGrant` → `code` matche `/^FG-[A-Z]+-\d{4}$/` ; `status==='issued'`.
- `expiresAt - activatesAt` === 60 j (arrondi jour).
- `validateGrant` avant `activatesAt` → `reason==='not_yet_active'` + `activatesAt` fourni.
- `validateGrant` à `now===activatesAt` → `valid===true` (borne incluse).
- `validateGrant` après `activatesAt+60 j` → `reason==='expired'`.
- Même `sourceOrderId` deux fois → même `id`.
- Même `phoneE164`, deux `sourceOrderId` → même `code` ; `listGrants({phoneE164}).length===1`.
- Code consommé → `validateGrant` → `reason==='already_redeemed'`.

## Points à vérifier — tous points de vue
- Backend : route Phase 3 calcule `activatesAt` depuis `searchDeliveryCities(...).deliveryEta`,
  best-effort (fallback `computeActivatesAt(now, null)`), idempotent ordre+téléphone.
- Frontend : `LoyaltyCodeCard` affiche le code + date d'activation (`loyalty.activatesAt`) — testé F11.
- UI/UX/design : code mémorable dictable ; message « utilisable à partir du … » ; pas de `%`/`!`/emoji.
- Data : `expiresAt` dérivé, jamais saisi ; `phoneE164` E.164 ; unicité garantie repo.
- A11y : hors scope (couche I) ; états restitués à l'UI en F11/F18.
- i18n : date d'activation localisée FR/AR en aval ; logique d'activation indépendante de la langue.
- Sécurité/PII : `phoneE164` sert l'unicité mais n'apparaît jamais en clair côté admin (masqué, cf. F04).
