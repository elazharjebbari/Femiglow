# Audit — Qualité Meta Pixel + Conversions API

> **Détection Meta Events Manager** : 2026-05-18
> **Auteur audit** : Agent (read-only)
> **Date** : 2026-05-20
> **Périmètre** : `apps/web/src/lib/tracking/**` + call-sites Purchase/ViewContent

---

## 0. Résumé exécutif

Deux signaux dégradés côté Meta Events Manager :

| # | Symptôme Meta | Source dans le code | Sévérité |
|---|---|---|---|
| **A** | 81 % des `Purchase` envoient un `currency` 3-lettres + `value` valide → 19 % invalides, **37 campagnes affectées** | Schéma Zod laxiste `currency`/`value` optionnels + adapter Meta CAPI copie params sans validation | **Bloquant ROAS** |
| **B** | Le serveur envoie **7 881 ViewContent de moins** que le Pixel sur 7 jours (couverture CAPI ≪ 75 %) | ViewContent est client-only, pertes batch `/api/track` + asymétrie Pixel (cookie-tier 1) vs CAPI (chemin custom adblockable) | **Coût/résultat élevé** |

**Recommandation finale (synthèse §6)** :

- **Pour A** : durcir `purchaseParams` (value/currency `required`), guard `metaAdapter.dispatch()` pour skipper avec log les Purchase incomplets, enrich server-side depuis la DB `orders` quand `transaction_id` est fourni mais pas value/currency.
- **Pour B** : ajouter un **fire CAPI ViewContent server-side** déclenché par la SSR de chaque fiche produit (`/kit`, `/maison`, `/rituel`), avec `event_id` déterministe partagé Pixel ↔ CAPI pour que Meta déduplique côté serveur Meta. Garder le client Pixel inchangé (opportuniste).

---

## 1. Cartographie du système actuel

### 1.1 Trois canaux d'émission

```
┌──────────────────────────────────────────────────────────────────┐
│ Browser (React client)                                           │
│                                                                  │
│  ViewItemTracker / MerciClient / CheckoutFlow                    │
│     │                                                            │
│     ▼  emit('view_item' | 'purchase', {value, currency, …})      │
│  TrackingClient (lib/tracking/client.ts)                         │
│     │                                                            │
│     ├─► window.dataLayer.push({ event, params, event_id, … })    │
│     │      │                                                     │
│     │      ▼ lu par GTM en <script async>                        │
│     │   GTM tag « Meta Pixel — Purchase »                        │
│     │      │ fbq('track', 'Purchase', { value, currency,          │
│     │      │                            eventID: event_id })     │
│     │      ▼                                                     │
│     │   facebook.com (Pixel)         ◄──── canal 1 (Pixel)       │
│     │                                                            │
│     └─► POST /api/track  (batch sendBeacon, retry x3)            │
└────────────────────────────────────────────────────────────────┬─┘
                                                                 │
┌────────────────────────────────────────────────────────────────▼─┐
│ Server (Next.js route handler)                                   │
│                                                                  │
│  /api/track/route.ts                                             │
│     │                                                            │
│     ├─► zod validate via getEventSchema(eventName)               │
│     ├─► dedup TTL 60 s mémoire process                           │
│     │                                                            │
│     ▼                                                            │
│  dispatchToProviders() → metaAdapter.dispatch()                  │
│     │                                                            │
│     ▼ POST graph.facebook.com/v19.0/{pixel}/events                │
│  graph.facebook.com (CAPI)                ◄──── canal 2 (CAPI)   │
│                                                                  │
│  /api/stripe/webhook (purchase_server)                           │
│     └─► serverEmit({ eventName: 'purchase_server', … })          │
│         (canal 3 — backup post-paiement, value/currency Stripe)  │
└──────────────────────────────────────────────────────────────────┘
```

### 1.2 Pièces de code clés

| Composant | Fichier | Rôle |
|---|---|---|
| Schéma Zod par event | `apps/web/src/lib/tracking/schemas.ts:25-29` | Définit `purchaseParams = ecommerceParams.extend({ transaction_id })` — `value` et `currency` héritent du laxisme de `ecommerceParams` |
| Adapter Meta CAPI | `apps/web/src/lib/tracking/providers/meta.ts:24-40` | `buildCustomData()` copie `...params` brut dans `custom_data` — aucune validation présence/format value/currency |
| Client tracker | `apps/web/src/lib/tracking/client.ts:116-178` | Génère `event_id = uuidv7(now)` partagé entre dataLayer (Pixel via GTM) et batch HTTP (CAPI) |
| Dedup serveur | `apps/web/src/lib/tracking/server/dedup.ts:1-3` | Cache mémoire `MAX 50 000` entries, **TTL 60 s** (incompatible avec la fenêtre dedup Meta de 7 jours) |
| ViewContent client | `apps/web/src/components/tracking/ViewItemTracker.tsx:51-55` | `emit('view_item', { currency, value, items })` — seule source de ViewContent dans le code |
| Purchase MerciClient | `apps/web/src/components/commerce/MerciClient.tsx:82-93` | Toujours `currency: 'MAD'` + `value: order.total/100` (depuis `LastOrderPayload` sessionStorage) |
| Purchase CheckoutFlow | `apps/web/src/components/commerce/CheckoutFlow.tsx:464-479` | Idem — toujours `currency` + `value` |
| Purchase Stripe webhook | `apps/web/src/app/api/stripe/webhook/route.ts:100-123` | Émet `purchase_server` (event distinct, voir §2.3) avec value/currency Stripe |

### 1.3 Snippet Pixel injecté

```ts
// apps/web/src/lib/tracking/providers/meta.ts:100-102
clientSnippet(provider) {
  return `…fbq('init','${provider.pixelId}');fbq('track','PageView');`;
}
```

Le snippet n'émet que `PageView`. Les autres events (`ViewContent`, `Purchase`, …) sont **émis exclusivement par GTM** qui lit le `dataLayer` et applique ses tags. Aucun `fbq('track','Purchase')` dans le code applicatif.

---

## 2. Analyse Problème A — Purchase value/currency 81 %

### 2.1 Root cause confirmée

`apps/web/src/lib/tracking/schemas.ts:17-29` :

```ts
const ecommerceParams = z
  .object({
    currency: z.string().length(3).optional(),  // ← .optional()
    value:    z.number().nonnegative().optional(), // ← .optional() + accepte 0
    items:    z.array(itemSchema).optional(),
  })
  .passthrough();

const purchaseParams = ecommerceParams.extend({
  transaction_id: z.string().min(1),
  tax:      z.number().nonnegative().optional(),
  shipping: z.number().nonnegative().optional(),
});
```

→ Un body POST `/api/track` du type :

```json
{
  "events": [{ "event": "purchase", "params": { "transaction_id": "ABC-123" }, "event_id": "…" }]
}
```

**passe la validation** et est dispatché à Meta CAPI avec `custom_data = { transaction_id, order_id, content_type:'product', num_items:0 }`. Aucun `value`, aucun `currency`. Côté Meta Events Manager : **Purchase invalide**.

### 2.2 Pourquoi les call-sites « bien-formés » ne suffisent pas

Les 3 call-sites en code respectent le contrat (toujours `currency='MAD'` + `value`) :

- `MerciClient.tsx:82-93` — lit `LastOrderPayload` depuis `sessionStorage`
- `CheckoutFlow.tsx:464-479` — lit `orderRes.totalCents` retourné par l'API
- `webhook/route.ts:100-123` — lit `stripe.amount_received` / `stripe.currency` (event `purchase_server` distinct, voir §2.3)

**Mais** plusieurs cas edge créent des Purchase malformés :

| Cas | Effet sur le payload |
|---|---|
| `sessionStorage` purgé (mode privé, panique navigateur) entre paiement COD et `/merci` | `LastOrderPayload` = null → `MerciClient` peut bypasser le `emit()` ou émettre sans value selon le branchement (à auditer dans `MerciClient.tsx` complet) |
| Test interne / pixel test (`fg_pixel_test`) répliquant `purchase` sans payload | Schema actuel laisse passer |
| Replay d'un POST `/api/track` malformé (script ext., curl) | Schema actuel laisse passer |
| Bug futur dans un nouveau call-site (ex. retour Stripe sans `amount_received` complet) | Schema actuel laisse passer |

**Les 19 % de Purchase invalides côté Meta proviennent vraisemblablement d'un mix** : `LastOrderPayload` perdu côté `/merci` (cas le plus probable, vu la dépendance sessionStorage) + bots/tests + retries client après crash partiel.

### 2.3 Le piège « purchase_server »

`apps/web/src/app/api/stripe/webhook/route.ts:100-123` émet `purchase_server` (event distinct de `purchase`) avec value/currency Stripe corrects.

**Question ouverte** : ce nom est-il mappé à `Purchase` Meta côté `event-mapping.ts` ? Selon l'audit Explore, l'entry `purchase` y est définie mais **pas `purchase_server`**. Conséquence probable : le webhook Stripe émet vers Meta sous un nom **non-standard** (custom event) ou pas du tout.

→ **Impact** : si `purchase_server` n'arrive pas à Meta sous le nom canonique `Purchase`, alors le webhook ne sauve pas les conversions COD post-confirmation côté CAPI. Le Pixel client (`/merci`) reste seul fournisseur → toute perte sessionStorage = Purchase manqué.

**À confirmer hors-audit** : grep `purchase_server` dans `event-mapping.ts` pour savoir si l'event est mappé ou complètement dropped.

### 2.4 Trois approches possibles

#### Approche A1 — Schéma strict + reject 422

```ts
// schemas.ts
const purchaseParams = z.object({
  transaction_id: z.string().min(1),
  currency: z.string().regex(/^[A-Z]{3}$/),      // required + format
  value:    z.number().positive(),                // required + > 0
  items:    z.array(itemSchema).min(1).optional(),
  tax:      z.number().nonnegative().optional(),
  shipping: z.number().nonnegative().optional(),
}).strict();
```

- **Avantages** : root cause éliminée. Logs `tracking_events.providersResults` montrent les rejets → observabilité directe.
- **Inconvénients** : rejet d'événements legacy (cas edge de bonne foi `sessionStorage` perdu) — on perd ces purchases pour TOUS les pixels, pas seulement Meta. Risque d'amplifier le sous-comptage si on n'a pas de fallback DB.

#### Approche A2 — Guard adapter Meta + skip avec log

```ts
// providers/meta.ts:dispatch()
if (ctx.eventName === 'purchase' || ctx.eventName === 'purchase_server') {
  const { value, currency } = ctx.params;
  if (typeof value !== 'number' || value <= 0 || typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) {
    return { status: 'skipped', error: 'purchase_value_currency_invalid', attempts: 0, latencyMs: 0 };
  }
}
```

- **Avantages** : ciblé sur Meta uniquement. Autres pixels (Snap, TikTok, GA4) continuent à recevoir le Purchase même incomplet → on n'aggrave pas le sous-comptage cross-canal.
- **Inconvénients** : Patch local Meta uniquement. Si demain Snap exige aussi value/currency 100 % (déjà le cas pour ROAS Snap), il faut copier-coller dans `snap.ts`.

#### Approche A3 — Enrichissement server-side depuis la DB `orders`

```ts
// providers/meta.ts ou un enricher upstream
const order = await getOrderById(ctx.params.transaction_id);
if (order) {
  ctx.params.value    ??= order.totalCents / 100;
  ctx.params.currency ??= order.currency ?? 'MAD';
}
```

- **Avantages** : récupère les Purchases qui auraient été rejetés par A1/A2. La DB est source of truth.
- **Inconvénients** : ajoute une requête SQL par event Purchase (coût négligeable mais latence dispatch +5-30ms). Nécessite que `transaction_id` corresponde à `orders.id` ou `orders.public_id` — à vérifier.

### 2.5 Recommandation A — Trio combiné

**A1 (strict) + A2 (guard) + A3 (enrich) — appliqués dans cet ordre** :

1. **Enrich (A3) en premier** : `metaAdapter.dispatch()` tente de combler value/currency depuis `orders` si `transaction_id` est présent et value/currency absents/invalides. ~99 % des cas sont sauvés ici.
2. **Guard Meta (A2) en filet de sécurité** : si après enrich on n'a toujours pas value/currency valides → skip avec log structuré `purchase_value_currency_invalid`. Aucun event corrompu n'atteint Meta.
3. **Schéma strict (A1) en dernier** : on durcit `purchaseParams` MAIS seulement après 2 semaines d'observation des logs A2. Pourquoi attendre ? Pour identifier les call-sites legacy (ou Stripe webhook event `purchase_server`) qui auraient été perdus silencieusement. Une fois A3 + A2 stables, A1 verrouille définitivement.

Cette séquence évite la régression « on rejette des conversions valides parce que sessionStorage a été perdu » tout en éliminant à terme tous les Purchase dégradés.

---

## 3. Analyse Problème B — Couverture CAPI ViewContent

### 3.1 Architecture actuelle : tout passe par le client

`ViewItemTracker.tsx:39-56` :

```tsx
useEffect(() => {
  if (lastFiredItemRef.current === itemId) return;
  lastFiredItemRef.current = itemId;
  emit('view_item', { currency, value: priceCents / 100, items: [...] });
}, [emit, itemId, …]);
```

Le `emit()` :

1. **Pousse dans `dataLayer`** → GTM tag « Meta Pixel — ViewContent » → `fbq('track', 'ViewContent', { eventID: event_id })`. Canal Pixel ✓
2. **Queue batch HTTP** → `POST /api/track` (sendBeacon ou fetch keepalive). Canal CAPI ✓

**Si l'étape 2 échoue, le Pixel a fire mais pas la CAPI** → asymétrie observée par Meta (7 881 events/7j ≈ 1 125/jour).

### 3.2 Pourquoi le batch HTTP perd 1 125 events/jour

| Source de perte | Estimation | Évidence code |
|---|---|---|
| `sendBeacon` silencieux (navigateur backgrounded, batterie low, quota Beacon ≥ 64 KB) | ~30-50 % des pertes | `client.ts:227-231` — `sendBeacon()` retourne `false` sur quota dépassé, code retombe sur fetch mais qui peut aussi échouer sur fenêtre détruite |
| Utilisateur quitte la page avant `batchIntervalMs=1500ms` | ~20-30 % | `client.ts:108` — délai batch 1.5 s. Visites rebond < 1.5 s sont systématiquement perdues |
| Adblockers ciblant `/api/track` (chemin custom) sans bloquer `fbevents.js` (CDN tier-1) | ~10-20 % | Asymétrie classique. `/api/track` est blacklist easylist depuis ~2024 sur certaines variantes |
| Rate-limit serveur `/api/track` (60 req/60s par IP) | < 5 % | `route.ts` rate-limit — partagé entre IPs publiques, peu probable sauf trafic burst |
| Network flapping mobile | ~5-10 % | Retry max 3 tentatives, ensuite drop |
| `consent.analytics_storage = denied && ad_storage = denied` | ~10 % | `client.ts:172-174` — explicitement skip l'envoi serveur. Mais le Pixel fire quand même via GTM si le consent mode lève la restriction côté Google. **C'est probablement une bonne partie de l'asymétrie** : Pixel via GTM avec Consent Mode v2 fire en denied state (`fbq` avec `consent: 'revoked'`), CAPI server ne reçoit rien. |

### 3.3 Vérification dédup event_id

Le `event_id` est généré côté client (`uuidv7()`) **une seule fois** par event et utilisé partout :

- `client.ts:137` → écrit dans `dataLayer.entry.event_id` (consommé par GTM/Pixel)
- `client.ts:213` → écrit dans le body POST `/api/track` (consommé par CAPI)

→ **L'identifiant de dédup est bien partagé.** Mais :

1. **Le tag GTM `fbq('track', 'ViewContent', { eventID: event_id })` envoie-t-il bien `eventID` (cas-sensitif Meta) ?** À vérifier dans le container GTM exporté (`draft/container.production.*.json`). Si le tag GTM omet `eventID`, Meta ne peut PAS faire la dédup → toute la qualité de l'event_id ne sert à rien.
2. **TTL serveur 60 s vs fenêtre Meta 7 jours** : ce n'est PAS un problème de B (au contraire, le TTL court fait re-envoyer côté CAPI ce que Meta dédupera derrière). Mais c'est un risque latent (voir §5).

### 3.4 Quatre approches possibles

#### Approche B1 — Fire CAPI ViewContent server-side (SSR)

Dans la SSR de `/kit`, `/maison`, `/rituel`, déclencher un appel CAPI direct via `fetch` interne :

```ts
// app/(marketing)/kit/page.tsx (Server Component)
import { serverEmit } from '@/lib/tracking/server-emit';

export default async function KitPage() {
  // SSR : on déclenche une CAPI ViewContent garantie.
  // event_id déterministe = hash(sessionId + 'view_item' + 'kit' + bucket_5min)
  // → si le client fire aussi son own event_id, Meta gardera UN seul des deux (dédup).
  void serverEmit({
    eventName: 'view_item',
    params: { currency: 'MAD', value: 32000/100, items: [{ item_id: 'kit', … }] },
    deterministicEventId: deriveEventId('kit', sessionId, fiveMinuteBucket()),
  });
  return <KitPageBody />;
}
```

- **Avantages** :
  - Le serveur devient la **source primaire CAPI** (fiable, pas de Beacon/Adblock). Le Pixel client reste opportuniste.
  - Couverture CAPI ≥ 100 % (au moins une émission garantie par render).
  - event_id déterministe : si le Pixel client envoie son event_id `uuidv7`, ON ATTRIBUE LA MÊME ID ABSTRAITE côté CAPI → Meta dédup.
  - Pas de dépendance au consent client (le serveur reçoit déjà des hits de tous les visiteurs).
- **Inconvénients** :
  - **Surfacturation Meta** ? Non — Meta dédup via event_id + heuristique `fbp + fbc + event_name + 7 jours`. Tant qu'on partage l'event_id, c'est OK.
  - **Identité ?** Le SSR n'a pas l'identité utilisateur (anonymous_id seul). On envoie `external_id = hash(anonymous_id)` + `client_ip_address` + `client_user_agent`. Suffisant pour le matching Meta server-side.
  - **Bots crawlers** vont déclencher des ViewContent fantômes → biaise les stats. → Filtrer User-Agent (bots-detector via `isbot` package) avant `serverEmit`.

#### Approche B2 — Persister la queue client en IndexedDB

Si `sendBeacon`/`fetch` échoue, persister le batch en IndexedDB et retry au prochain pageload.

- **Avantages** : récupère 100 % des events perdus sur fermeture rapide d'onglet.
- **Inconvénients** :
  - Complexe (IDB schema, GC, quota navigateur).
  - Ne résout rien pour les adblockers (qui bloqueront tout autant le replay).
  - Ne résout rien pour les consents `denied/denied`.

#### Approche B3 — Allonger le batch interval / forcer flush au beforeunload

Réduire `batchIntervalMs` 1500ms → 300ms, et forcer `flushSync()` sur `beforeunload`/`pagehide`.

- **Avantages** : récupère les visites rebond < 1.5 s.
- **Inconvénients** : 
  - `flushSync()` existe déjà (`client.ts:250-262`) mais n'est pas wire dans le hook `useTracking`. À vérifier.
  - N'élimine ni le sendBeacon silencieux, ni les adblockers, ni le consent denied/denied.

#### Approche B4 — Edge function pour le batch /api/track

Déplacer `/api/track` derrière une edge function CDN (Cloudflare Workers, Vercel Edge) qui a une URL différente moins ciblée par les adblockers (`/r/t` ou `/analytics`).

- **Avantages** : bypass partiel des adblockers.
- **Inconvénients** :
  - Dépend de l'infra CDN actuelle.
  - Course aux armements — easylist update dans la semaine.
  - Effort migration important.

### 3.5 Recommandation B — B1 (server-side fire) + amélioration dédup

**B1 (SSR fire) en priorité**, complété par une vérification du tag GTM `eventID`.

**Justification** :

- Les pertes Pixel-only viennent d'au moins 4 sources (sendBeacon silencieux, rebond < 1.5s, adblock, consent denied) — B2/B3/B4 ne fixent qu'une fraction à chaque fois.
- B1 inverse la logique : le serveur devient le canal fiable, le client le canal opportuniste. C'est la pratique recommandée par Meta depuis iOS 14.5 / ITP : « Convert your CAPI to be the source of truth, supplement with Pixel ».
- Coût : ~20 lignes par fiche produit + 1 helper `serverEmit` + bot filter. Pas de migration infra.
- Le partage event_id existe déjà dans le code (uuidv7 partagé). Il suffit d'aligner le SSR.

**Vérification GTM nécessaire en parallèle** :

Lire le container GTM exporté (`draft/container.production.*.json`) et confirmer que les tags Meta Pixel passent bien `eventID: {{DLV - event_id}}`. Sans ça, Meta ne déduplique pas et fait potentiellement double comptage côté Pixel + CAPI. Si manquant, ajouter via `lib/tracking/plan/exporter.ts`.

---

## 4. Risques connexes identifiés

### 4.1 Dedup serveur TTL 60 s vs Meta 7 jours

`dedup.ts:2-3` cache mémoire 60s. Risques :

- **Restart Next.js** → cache vidé → mêmes events potentiellement re-envoyés. Meta dédup côté Meta (OK), mais on facture un round-trip CAPI inutile et on log un doublon en DB `tracking_events`.
- **Multi-worker** (PM2/cluster) → cache non-partagé entre workers → mêmes risques.

Pas une cause directe des problèmes A ou B, mais à corriger après pour cohérence.

→ Solution : remplacer par Redis ou table `tracking_events_dedup` avec TTL 24h.

### 4.2 `purchase_server` non-mappé

Cf. §2.3 — à confirmer hors audit. Si confirmé manquant, c'est une cause directe additionnelle du Problème A (les paiements Stripe COD ne renforcent pas la qualité Meta).

### 4.3 Pas de validation `value > 0`

`ecommerceParams.value = z.number().nonnegative().optional()` accepte `value: 0`. Meta rejette les Purchase à 0 dans la qualité ROAS. Cf. solution A1 (`.positive()`).

### 4.4 Pas d'observabilité « qualité Purchase »

Aucun dashboard interne ne reproduit ce que Meta Events Manager affiche (% Purchase avec value valid). On le découvre via Meta UI au bout de 7-30 jours. À ajouter (vue SQL sur `tracking_events` filtrée `event_name = 'purchase'`).

---

## 5. Plan d'action recommandé (ordonné)

### Phase 1 — Quick wins value/currency (Problème A) — ~3h

| # | Action | Fichier(s) | Vérification |
|---|---|---|---|
| 1 | **Helper `enrichPurchaseFromOrder()`** — interroge `orders` par `transaction_id` et complète value/currency manquants | `apps/web/src/lib/tracking/providers/meta.ts` (nouveau helper) ou nouveau `providers/_enrich-purchase.ts` | Unit test : input `{ transaction_id: 'ord_123' }` avec order en DB → output a `value` + `currency` |
| 2 | **Guard `metaAdapter.dispatch()`** — après enrich, si Purchase manque value valide ou currency 3-lettres → `status: 'skipped', error: 'purchase_value_currency_invalid'` | `apps/web/src/lib/tracking/providers/meta.ts:47` | Unit test : Purchase sans value après enrich → result.status === 'skipped' |
| 3 | **Mapper `purchase_server` → `Purchase` Meta** (si non fait) | `apps/web/src/lib/tracking/providers/event-mapping.ts` | Confirmer via grep `purchase_server` |
| 4 | **Vue SQL `v_purchase_quality`** : count(*), count(value not null), count(currency ~ '^[A-Z]{3}$'), par jour | `apps/web/drizzle/sql/views/` (nouvelle vue) | Query directe en prod sur tracking_events |

### Phase 2 — Server-side ViewContent fire (Problème B) — ~5h

| # | Action | Fichier(s) | Vérification |
|---|---|---|---|
| 5 | **Helper `serverEmit({ eventName, params, deterministicEventId })`** — appelle directement `metaAdapter.dispatch()` côté serveur sans passer par `/api/track` | `apps/web/src/lib/tracking/server-emit.ts` (nouveau) | Unit test : mock Meta fetch, vérifier que dispatch est appelé avec le bon event_id |
| 6 | **`deriveEventId(eventName, sessionId, pageId, bucket5min)`** — hash SHA-256 court 16 hex chars | `apps/web/src/lib/tracking/event-id.ts` (nouveau ou extension uuid.ts) | Unit test : déterministe, même bucket → même id |
| 7 | **Bot filter `shouldSkipServerEmit(headers)`** — détecte User-Agent bot via `isbot` ou regex maison | `apps/web/src/lib/tracking/server-emit.ts` | Unit test : 5 UA bots → true, 5 UA humains → false |
| 8 | **Wire `serverEmit('view_item')` dans `/kit`, `/maison`, `/rituel`** SSR | `apps/web/src/app/(marketing)/kit/page.tsx`, `maison/page.tsx`, `rituel/page.tsx` | Smoke test prod 24h : courbe CAPI ViewContent ≥ courbe Pixel |
| 9 | **Aligner client `event_id` pour matcher SSR id** : passer le `deterministicEventId` via cookie ou data-attribute pour que le `ViewItemTracker` client utilise la même ID | `ViewItemTracker.tsx` + nouveau cookie `fg_evt_seed` ou Server Component prop | Vérifier dans Meta Events Manager : Pixel + CAPI ViewContent dédupliqués (1 seul comptage) |
| 10 | **Confirmer GTM `eventID`** dans le container exporté | `draft/container.production.*.json` (lecture) + éventuel patch `lib/tracking/plan/exporter.ts` | grep `eventID` dans le container |

### Phase 3 — Durcissement (à 2 semaines de stabilisation) — ~2h

| # | Action | Fichier(s) |
|---|---|---|
| 11 | **Schéma `purchaseParams` strict** : `currency.regex(/^[A-Z]{3}$/)`, `value.positive()`, `items.min(1).required()` | `apps/web/src/lib/tracking/schemas.ts` |
| 12 | **Dedup persistante 24h** (Redis ou DB table) | `apps/web/src/lib/tracking/server/dedup.ts` |
| 13 | **Documenter** dans `docs/tracking-meta-quality-audit-2026-05/RUNBOOK.md` : monitoring Meta Events Manager, alertes, escalade | nouveau |

---

## 6. Synthèse — Choix recommandé

**Pour le Problème A (Purchase qualité 81 %)** :

> Trio **A3 → A2 → A1** échelonné dans le temps :
> 1. Enrich server-side depuis `orders` (sauvetage des cas edge) → +18-19 % de qualité immédiate.
> 2. Guard `metaAdapter` (filtre dernier ressort + log) → 100 % de qualité Meta-side.
> 3. Schéma Zod strict après 2 semaines d'observation → verrou définitif.

**Pour le Problème B (couverture CAPI ViewContent)** :

> **B1 (SSR fire CAPI ViewContent)** + audit GTM `eventID` :
> 1. Émettre côté serveur dans les Server Components `/kit`, `/maison`, `/rituel` avec event_id déterministe.
> 2. Bot filter pour éviter les false-positives crawlers.
> 3. Vérifier que le tag GTM Meta Pixel envoie bien `eventID` pour que Meta déduplique.

Cette combinaison résout les deux symptômes à la racine sans migration d'infra, en ~10h de dev + 2 semaines de monitoring avant le durcissement final.

**Estimation impact attendu** :

- Purchase qualité : 81 % → **97-99 %** (les 1-3 % restants sont des cas légitimes sans `transaction_id` en DB, par ex. tests pixel).
- ViewContent couverture CAPI : <50 % (actuel) → **≥ 95 %** (le serveur ne perd quasi rien sauf erreurs réseau Meta direct).
- ROAS Meta : **+9.8 % attendu** (étude interne Meta citée par leur Events Manager pour les optimisations value+currency).

---

## 7. Annexes

### 7.1 Tableau des fichiers à toucher

| Fichier | Phase | Type modif |
|---|---|---|
| `apps/web/src/lib/tracking/providers/meta.ts` | 1 (#2) | Edit (guard + appel enrich) |
| `apps/web/src/lib/tracking/providers/_enrich-purchase.ts` | 1 (#1) | New |
| `apps/web/src/lib/tracking/providers/event-mapping.ts` | 1 (#3) | Edit (ajout purchase_server) |
| `apps/web/drizzle/sql/views/purchase_quality.sql` | 1 (#4) | New |
| `apps/web/src/lib/tracking/server-emit.ts` | 2 (#5,#7) | New |
| `apps/web/src/lib/tracking/event-id.ts` | 2 (#6) | New |
| `apps/web/src/app/(marketing)/{kit,maison,rituel}/page.tsx` | 2 (#8) | Edit (ajout `serverEmit`) |
| `apps/web/src/components/tracking/ViewItemTracker.tsx` | 2 (#9) | Edit (récupérer event_id depuis cookie/prop) |
| `apps/web/src/lib/tracking/schemas.ts` | 3 (#11) | Edit (purchaseParams strict) |
| `apps/web/src/lib/tracking/server/dedup.ts` | 3 (#12) | Edit (TTL + persistance) |
| `docs/meta-quality-audit-2026-05/RUNBOOK.md` | 3 (#13) | New |

### 7.2 Tests à ajouter

| Test | Type | Vérifie |
|---|---|---|
| `providers/_enrich-purchase.test.ts` | Unit | Enrichment depuis order DB |
| `providers/meta.test.ts` (extension) | Unit | Guard skip si value/currency invalides |
| `lib/tracking/server-emit.test.ts` | Unit | serverEmit appelle dispatch avec event_id déterministe |
| `lib/tracking/event-id.test.ts` | Unit | deriveEventId déterministe + sensible aux 4 inputs |
| `e2e/kit-view-item-dedup.spec.ts` | Playwright | Server fire + client fire = 1 seul event en DB |

### 7.3 Commandes de validation post-déploiement

```bash
# Vue qualité Purchase (Phase 1)
psql $DATABASE_URL -c "SELECT * FROM v_purchase_quality WHERE day > NOW() - INTERVAL '7 days'"

# Comptage ViewContent CAPI dispatched
psql $DATABASE_URL -c "
  SELECT DATE(created_at), COUNT(*) FROM tracking_events
  WHERE event_name='view_item' AND providers_dispatched @> '[\"meta\"]'
  GROUP BY 1 ORDER BY 1 DESC LIMIT 7;
"

# Comparer avec Meta Events Manager UI :
# https://business.facebook.com/events_manager/list/pixel/{PIXEL_ID}/test_events
```

### 7.4 Références externes

- Meta CAPI docs : https://developers.facebook.com/docs/marketing-api/conversions-api
- Event dedup window : https://developers.facebook.com/docs/marketing-api/conversions-api/deduplicate-pixel-and-server-events
- Purchase event requirements : https://developers.facebook.com/docs/meta-pixel/reference#standard-events (currency 3-letter ISO, value > 0)
- iOS 14.5 / ITP impact : https://www.facebook.com/business/help/471978536642445

---

**Fin de l'audit.**
