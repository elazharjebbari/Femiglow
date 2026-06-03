# CPN-09 — Journalisation des événements coupon (`coupon_events`)

> Périmètre : table `coupon_events` (`apps/web/src/lib/db/schema.ts`) + son repo
> (à créer, ex. `apps/web/src/lib/coupons/coupon-events-repo.ts`) + les points
> d'émission : affichage `/kit` (`exposed`/`applied`) et succès commande
> (`converted`, dans `apps/web/src/app/api/checkout/order/route.ts`).
> Criticité **P1** — gate `G-IDEMPOTENCE`. Risque maître : **double comptage**
> (incrémentalité faussée, CPN-12) **ou log qui bloque la commande**.

---

## (a) Fonctionnement optimal

`coupon_events` est un **journal append-only** servant à mesurer
l'incrémentalité (treatment vs holdout). Trois phases :

| Phase | Émise quand | Où | Bloquant ? |
|---|---|---|---|
| `exposed` | le coupon est *vu* (candidat sélectionné, affiché ou retenu holdout) | affichage `/kit` (CPN-06) | non |
| `applied` | la remise est *appliquée* au prix affiché (treatment) | affichage `/kit` (le cas échéant) | non |
| `converted` | la commande aboutit (201) | route order, après succès | **non — fire-and-forget** |

### Règles d'or

1. **`converted` émis uniquement si la commande réussit** (201). Un 422/409/400
   n'émet **jamais** de `converted`.
2. **Idempotence par `orderId`** : un seul `converted` par commande, garanti par
   l'index partiel unique `coupon_events_order_converted_unique`
   (`WHERE phase = 'converted' AND order_id IS NOT NULL`). Une 2e tentative
   d'insert est **absorbée** (conflit silencieux), pas une 2e ligne.
3. **Émis seulement si `!result.replayed`** : un replay idempotent de la commande
   (même Idempotency-Key) ne ré-émet pas l'event. Double filet : le code n'émet
   pas si `replayed`, ET l'index protège même si on émettait par erreur.
4. **Fire-and-forget, jamais bloquant** : l'insert de l'event est `void …catch(…)`.
   Si l'insert échoue (DB down, conflit, timeout), la **commande reste 201**.
   Un échec de log ne perd JAMAIS une commande.
5. **Pas de PII** : `visitorKey` est un hash anonyme. Aucune colonne ne stocke
   d'email / téléphone / nom. `amountCents` (remise), `bucket`, `trafficSource`,
   `device`, `orderId`, `couponId` uniquement.
6. **Cohérence de `bucket`** : le `bucket` (`treatment`/`holdout`) émis dans
   `converted` doit être le MÊME que celui émis dans `exposed`/`applied` pour le
   même `visitorKey`+`couponId` (déterminisme CPN-19).

### Forme de l'event `converted`

```ts
{
  id,
  couponId,                 // coupon réellement appliqué (ou retenu en holdout)
  phase: 'converted',
  bucket: 'treatment' | 'holdout',
  visitorKey,               // hash anonyme, == celui de exposed
  orderId,                  // FK orders, sert de clé d'idempotence
  amountCents: 9000,        // REMISE effective au moment de la conversion (pas le total payé)
  trafficSource, device,
  createdAt,
}
```

> **Précision `amountCents`** : c'est la **remise** (`savingsCents`), pas le total
> payé. Pour le kit welcome_auto : `amountCents = 9000` (le -90 MAD). En holdout,
> la remise coupon n'est pas servie → `amountCents = 0` (le visiteur a payé le
> prix de repli, l'attribution garde `couponId` + `bucket:'holdout'`).

---

## (b) Contrats I/O

### API du repo (à créer)

```ts
couponEventsRepo.record(event: {
  couponId: string | null;
  phase: 'exposed' | 'applied' | 'converted';
  bucket: 'treatment' | 'holdout';
  visitorKey: string | null;
  orderId?: string | null;
  amountCents?: number | null;
  trafficSource?: string | null;
  device?: string | null;
}): Promise<{ inserted: boolean }>;
```

- Pour `converted` : insert avec `ON CONFLICT DO NOTHING` (index partiel) →
  `inserted: false` si un `converted` existe déjà pour cet `orderId`.
- L'appel ne **throw jamais** côté appelant commande (wrappé `try/catch` + `void`).

### Point d'émission `converted` (route order)

Inséré dans le bloc succès de `route.ts`, à côté de `markPurchased` /
`dispatchOrderWebhook`, **conditionné par `!result.replayed`** :

```ts
if (result.resourceId && result.body && !('error' in result.body) && !result.replayed) {
  void couponEventsRepo.record({
    couponId, phase: 'converted', bucket,
    visitorKey: input.couponContext?.visitorKey ?? null,
    orderId: result.resourceId,
    amountCents: savingsCents, // remise
    trafficSource: input.couponContext?.trafficSource ?? null,
    device: input.couponContext?.device ?? null,
  }).catch((err) => logger.error('coupon.event.converted.failed', { orderId, error: String(err) }));
}
```

### Agrégation (lecture, CPN-12)

`countByPhaseAndBucket(couponId)` → `{ exposed:{treatment,holdout}, applied:{…}, converted:{…} }`.
Sert au calcul d'incrémentalité. Doit refléter **un seul** converted par order.

---

## (c) Points de vérification par axe

**Backend**
- `converted` émis après 201, jamais sur 422/409/400.
- Émis seulement si `!result.replayed`.
- `amountCents` = remise (savings), pas le total ; en holdout `amountCents=0`.
- `bucket` cohérent avec la décision pricing (treatment/holdout).

**Sécurité / vie privée**
- Aucune PII en base : pas d'email, téléphone, nom dans `coupon_events`.
- `visitorKey` = hash anonyme uniquement.
- `orderId`/`couponId` sont des FK avec `onDelete: 'set null'` (pas d'orphelin bloquant).

**Data / intégrité**
- Index partiel `coupon_events_order_converted_unique` empêche 2 `converted` par orderId.
- L'index est partiel (`phase='converted' AND order_id IS NOT NULL`) → n'impacte PAS `exposed`/`applied` (qui peuvent être multiples par visiteur).
- `phase`, `bucket` contraints par enums (`couponEventPhase`, `couponBucket`).

**Performance**
- Insert O(1). Index `coupon_events_coupon_phase_idx` pour l'agrégation.
- L'émission ne rallonge pas le temps de réponse de la commande (fire-and-forget).

**Idempotence**
- Double POST commande (même Idempotency-Key) → 1 seul `converted` (via `!replayed` + index).
- Retry interne / double appel `record` même orderId → `inserted:false`, pas de doublon.

**Observabilité / logs**
- Échec d'insert event loggé `logger.error('coupon.event.converted.failed', …)` SANS faire échouer la commande.
- L'event lui-même EST l'observabilité de l'incrémentalité (source de CPN-12).

**Frontend (via E2E)**
- `exposed` émis au chargement `/kit` quand un coupon est candidat.
- `applied` émis quand le prix coupon est effectivement affiché (treatment).
- Le parcours complet jusqu'à la commande produit exactement 1 `converted`.

---

## (d) Edge cases & matrice d'états

| # | État | Déclencheur | Attendu |
|---|---|---|---|
| 1 | **Nominal converted** | commande 201 (coupon treatment) | 1 ligne `converted` { orderId, amountCents=9000, bucket='treatment' } |
| 2 | **Idempotent replay** | 2e POST même Idempotency-Key | PAS de 2e `converted` (un seul) |
| 3 | **Double appel record même orderId** | record('converted', orderId X) appelé 2× | 1 seule ligne ; 2e `inserted:false` |
| 4 | **Échec commande 422** | price_mismatch | AUCUN `converted` |
| 5 | **Échec commande 409** | stock_insufficient | AUCUN `converted` |
| 6 | **Échec commande 400** | SKU inconnu | AUCUN `converted` |
| 7 | **Insert event échoue** | DB event en erreur lors de l'émission | commande reste **201** ; erreur loggée ; pas de throw remonté |
| 8 | **Holdout converted** | commande 201 en bucket holdout (Phase ≥2) | `converted` { bucket='holdout', amountCents=0 } |
| 9 | **exposed à l'affichage** | chargement /kit avec coupon candidat | ≥1 `exposed` { bucket, visitorKey } |
| 10 | **applied à l'affichage** | prix coupon affiché (treatment) | `applied` émis ; bucket=treatment |
| 11 | **Cohérence bucket exposed↔converted** | même visitorKey+couponId au funnel | bucket identique sur les 2 phases |
| 12 | **Pas de PII** | toute émission | colonnes ne contiennent ni email ni téléphone ni nom |
| 13 | **Agrégation** | N exposed, M applied, 1 converted | counts exacts par phase/bucket ; converted=1 |
| 14 | **visitorKey null (anonyme)** | pas de cookie visiteur | event émis avec `visitorKey:null`, pas de crash |
| 15 | **Concurrence converted** | 2 émissions converted concurrentes même orderId | 1 seule gagne (index), l'autre `inserted:false` |
| 16 | **Coupon supprimé après event** | `couponId` FK delete | `set null` (event conservé pour l'historique) |
| 17 | **Cache** | bucket recalculé (jamais figé) | bucket de l'event = bucket recalculé, cohérent affichage |

---

## (e) Risques

| ID | Risque | Impact | Mitigation testée |
|---|---|---|---|
| R-09-1 | Double `converted` (replay ou retry) | Incrémentalité (CPN-12) surcomptée, ROAS faux | Cas 2/3/15 : index partiel + `!replayed` |
| R-09-2 | Émission event bloque/échoue la commande | Commande perdue à cause d'un log | Cas 7 : commande 201 même si insert échoue |
| R-09-3 | `converted` émis sur échec (422/409) | Conversions fantômes | Cas 4/5/6 : aucun event sur erreur |
| R-09-4 | PII en clair dans `coupon_events` | Fuite RGPD | Cas 12 : aucune colonne PII |
| R-09-5 | `amountCents` = total payé au lieu de la remise | Stats d'économie fausses | Cas 1/8 : amountCents = savings (9000 / 0 holdout) |
| R-09-6 | Bucket divergent exposed↔converted | Attribution treatment/holdout faussée | Cas 11 : déterminisme CPN-19 |
| R-09-7 | Index unique total (pas partiel) bloque exposed/applied multiples | Perte d'events d'exposition | Vérifier index partiel `phase='converted'` |
| R-09-8 | Event émis sur replay idempotent | Double comptage silencieux | Cas 2 : `!result.replayed` |

---

## (f) Critères d'acceptation testables

- **AC-09-1** : commande 201 (treatment) → exactement **1** ligne `converted`, `{ orderId, amountCents:9000, bucket:'treatment', phase:'converted' }`.
- **AC-09-2** : double POST même Idempotency-Key → **1 seul** `converted` (count===1).
- **AC-09-3** : `record('converted', orderId=X)` appelé 2× → 1 ligne ; 2e appel `inserted:false`.
- **AC-09-4** : commande 422 `price_mismatch` → **0** `converted`.
- **AC-09-5** : commande 409 `stock_insufficient` → **0** `converted`.
- **AC-09-6** : si l'insert de l'event throw, la réponse commande reste **201** ; `logger.error('coupon.event.converted.failed', …)` appelé ; aucune exception remontée au client.
- **AC-09-7** : converted en holdout (Phase ≥2) → `{ bucket:'holdout', amountCents:0 }`.
- **AC-09-8** : aucune valeur d'email/téléphone/nom présente dans une ligne `coupon_events` (assert sur les colonnes + valeurs).
- **AC-09-9** : pour un même `visitorKey`+`couponId`, le `bucket` de `exposed` == `bucket` de `converted`.
- **AC-09-10** (E2E) : parcours /kit → commande → la base contient ≥1 `exposed` ET exactement 1 `converted` pour cet `orderId`, avec `amountCents===9000`.
- **AC-09-11** : `countByPhaseAndBucket` retourne `converted.treatment===1` après une commande, et n'est pas affecté par un replay.
- **AC-09-12** : `visitorKey:null` (anonyme) → event inséré sans erreur.
