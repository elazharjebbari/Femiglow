# 8. Phase 2 — Gate d'attribution serveur (CAPI selectif)

> **Statut** : ✅ Livrée
> **Date** : 2026-05-15

## Pourquoi

La phase 1 filtre les conversions **côté navigateur** (GTM conditions
sur la DLV `attribution.channel`). Mais FemiGlow envoie aussi des
événements de conversion **côté serveur** via les CAPI :

- **Meta Conversions API** (déjà branché, `lib/tracking/providers/meta.ts`)
- Google Ads OCI (phase 3, à brancher)
- TikTok Events API (phase 4)
- Snap/Pinterest Conversions APIs (phase 5)

Sans gate serveur, le CAPI Meta envoie toutes les conversions à Meta,
peu importe l'attribution. Conséquence :

- Un visiteur Google Ads convertit → GTM client skippe Meta (phase 1
  marche), mais Meta CAPI envoie quand même la conversion → Meta crédite
  la vente → double-comptage cross-canal réapparaît.
- Un ad blocker bloque GTM → aucun pixel client ne fire → mais le CAPI
  serveur enverrait quand même la conversion à Meta pour TOUS les
  visiteurs (y compris Google Ads / TikTok), polluant les bidding
  algos.

La phase 2 corrige ces deux trous.

## Architecture

### Gate centralisé

Plutôt que de patcher chaque adapter CAPI individuellement, le gate
est implanté dans le **dispatcher serveur**
(`lib/tracking/server/dispatcher.ts`). Tous les adapters (Meta
aujourd'hui, Google Ads OCI / TikTok / Snap / Pinterest demain)
passent par le dispatcher → un seul point d'application.

```
                    ┌──────────────────────────┐
                    │ dispatcher.ts            │
                    │                          │
event arrive ──────►│ for each provider:       │
                    │   ┌────────────────────┐ │
                    │   │ consent allowed?   │ │ no → skip:consent_denied
                    │   └─────────┬──────────┘ │
                    │             │ yes        │
                    │             ▼            │
                    │   ┌────────────────────┐ │
                    │   │ event enabled?     │ │ no → skip:event_disabled
                    │   └─────────┬──────────┘ │
                    │             │ yes        │
                    │             ▼            │
                    │   ┌────────────────────┐ │ no → skip:attribution_skip
                    │   │ ★ attribution gate │ │       (new in phase 2)
                    │   └─────────┬──────────┘ │
                    │             │ yes        │
                    │             ▼            │
                    │   ┌────────────────────┐ │
                    │   │ adapter.dispatch() │ │ → sent / failed
                    │   └────────────────────┘ │
                    └──────────────────────────┘
```

### Fonction `shouldDispatchByAttribution`

```ts
// lib/tracking/attribution/dispatch-gate.ts
export async function shouldDispatchByAttribution(input: {
  visitorId: string;
  providerKind: TrackingProviderKind;
  eventName: string;
}): Promise<AttributionGateResult>;
```

### Logique de décision (ordre)

1. **Provider neutre** (`google_ga4`, `gtm`, `custom`) → toujours
   allowed. Reason : `provider_neutral`.
2. **Event d'audience** (isConversion=false dans event-catalog :
   `page_view`, `view_item`, `add_to_cart`, …) → toujours allowed
   (alimente Lookalike + Custom Audiences). Reason : `audience_event`.
3. **Stratégie broadcast** → allow tout (déconseillé mais possible).
   Reason : `broadcast_strategy`.
4. **Pas de snapshot serveur** (visiteur très récent, pas encore
   POSTé `/api/track/attribution`) → fallback allow (best-effort
   conservatif). Reason : `no_snapshot_broadcast`.
5. **Canal résolu = canal attendu par le provider** → allow.
   Reason : `match:<strategy>`.
6. **Canal résolu = direct/organic/social_organic/unknown** →
   fallback allow (broadcast partiel). Reason : `fallback:<channel>`.
7. **Sinon** (canal payant différent identifié) → **SKIP**.
   Reason : `attribution_skip:<resolved>_vs_<expected>`.

## Implémentation

### Fichier `dispatch-gate.ts`

Deux fonctions :

- `shouldDispatchByAttribution(input)` — avec I/O (lit `tracking_settings`
  + `visitor_attribution`)
- `decideAttribution(input)` — pure (sans I/O, prend les inputs déjà
  résolus). Utilisée par les tests + la simulation UI.

### Wiring dans le dispatcher

```ts
// lib/tracking/server/dispatcher.ts
const gate = await shouldDispatchByAttribution({
  visitorId: ctx.anonymousId,
  providerKind: provider.kind,
  eventName: ctx.eventName,
}).catch((err) => {
  // Fallback safe : si la gate plante, on autorise (best-effort)
  logger.warn('tracking.dispatch.attribution_gate_degraded', { ... });
  return null;
});
if (gate && !gate.allowed) {
  logger.debug('tracking.dispatch.attribution_skip', {
    kind: provider.kind,
    event_name: ctx.eventName,
    reason: gate.reason,
    attributed_channel: gate.attributedChannel,
    strategy: gate.strategy,
  });
  return [provider.kind, {
    status: 'skipped',
    error: `attribution_skip:${gate.attributedChannel}`,
  }];
}
```

### Politique safe-by-default

Le gate est **conservateur** :
- Si la lecture `getAttributionStrategy()` plante → fallback
  `last_paid_touch`
- Si la lecture `findAttributionByVisitor()` plante → on continue avec
  null snapshot
- Si pas de snapshot → on autorise (best-effort : mieux vaut envoyer
  une conversion potentiellement double-comptée qu'en perdre une)
- Si le gate jette en l'air → fallback allow (logged en warn)

**Aucun risque** de perdre des conversions à cause d'une panne du gate.

## Tests

### `dispatch-gate.test.ts` (24 tests)

Couvre :
- Providers neutres (GA4, GTM, custom) toujours allowed
- Audience events toujours allowed
- Conversions match → allowed
- Conversions mismatch → skipped
- Fallback direct/organic/unknown → allowed
- Stratégie broadcast → tout allowed
- Matrice complète providers × canaux (last_paid_touch)
- Stratégie first_paid_touch avec historique multi-touch

### `dispatcher.attribution.test.ts` (5 tests)

Tests d'intégration sur `dispatchToProviders` complet :
- Visiteur Meta + purchase → Meta dispatched
- Visiteur Google Ads + purchase → Meta skipped (le cas critique)
- Visiteur Google Ads + page_view → Meta dispatched (audience)
- Visiteur sans snapshot → Meta dispatched (fallback)
- Visiteur direct → Meta dispatched (broadcast partiel)

### Total phase 2

29 nouveaux tests. 609/609 tracking tests verts.

## Effets observables

### Avant la phase 2

```
Visiteur Google Ads convertit
  ├ GTM client : seul Ads Conv tag fire ✓
  └ Meta CAPI : envoie l'event quand même
       → Meta Ads Manager affiche la conversion
       → Meta crédite la vente dans son algo
       → ROAS Meta gonflé artificiellement
```

### Après la phase 2

```
Visiteur Google Ads convertit
  ├ GTM client : seul Ads Conv tag fire ✓
  └ Meta CAPI : SKIPPED (attribution_skip:google_ads_vs_meta)
       → Meta Ads Manager n'affiche pas la conversion
       → Meta n'a aucun signal sur cette vente
       → ROAS Meta reflète vraiment ses conversions
```

## Logs / observabilité

Chaque skip produit un log structuré :

```json
{
  "level": "debug",
  "event": "tracking.dispatch.attribution_skip",
  "kind": "meta",
  "event_name": "purchase",
  "reason": "attribution_skip:google_ads_vs_meta",
  "attributed_channel": "google_ads",
  "strategy": "last_paid_touch"
}
```

Chaque résultat est aussi tracé dans `tracking_events_log` (table
existante) via `providersResults`. Tu peux requêter :

```sql
SELECT event_name, providers_results->'meta'->>'error' AS meta_err
FROM tracking_events_log
WHERE providers_results->'meta'->>'error' LIKE 'attribution_skip:%'
ORDER BY received_at DESC
LIMIT 50;
```

→ Tu vois exactement quelles conversions ont été skipped par le gate.

## Pas de breaking change

Le gate est **additif** :
- Visiteurs sans snapshot continuent à recevoir le dispatch (fallback)
- Audience events ne changent pas de comportement
- Providers neutres (GA4) ne changent pas
- Seuls les visiteurs avec un canal payant identifié + event de
  conversion + provider non-correspondant sont skipped

## Pièges courants à l'import GTM

### 0. `customEventFilter` limité à 1 seul entry — REJETÉ par GTM

Un trigger `CUSTOM_EVENT` ne peut avoir qu'**UN SEUL** filtre dans
`customEventFilter` (le matching du nom d'event). Si on en met
plusieurs, GTM rejette à l'import avec :

```
Un déclencheur d'événement personnalisé doit comporter un seul filtre
d'événement personnalisé.
```

**Pourquoi ça arrivait** : nos triggers attribution-gated avaient
2 entries dans `customEventFilter` (EQUALS event_name + MATCH_REGEX
attribution.channel).

**Fix appliqué** : le filtre MATCH_REGEX a été déplacé dans le champ
`filter` (séparé). Format final :

```json
{
  "type": "CUSTOM_EVENT",
  "customEventFilter": [
    { "type": "EQUALS", "parameter": [...event_name...] }
  ],
  "filter": [
    { "type": "MATCH_REGEX", "parameter": [...attribution.channel...] }
  ]
}
```

**Régression-proof** : test exporter qui scanne tous les triggers
CUSTOM_EVENT et fail si l'un d'eux a >1 entry dans `customEventFilter`.

### 1. Caractère `:` dans les noms — REJETÉ par GTM

GTM refuse l'import si un nom de **tag**, **trigger** ou **variable** contient
les caractères `:`, `,` ou `;`. Message d'erreur :

```
The name contains invalid character: ":"
```

**Pourquoi ça arrivait** : les triggers attribution-gated étaient nommés
`CE — purchase [attr:meta]` avec un `:`. GTM rejetait l'import complet.

**Fix appliqué** : l'exporter remplace `:` par ` / ` →
`CE — purchase [attr / meta]`. Compatible GTM, toujours lisible.

**Régression-proof** : test exporter `aucun nom (tag/trigger/variable) ne
contient des caractères refusés par l'import GTM` qui scanne le JSON
complet et fail si un nom contient `[:,;]`.

### 2. Conversion label vide → tag awct skipped

Si un event-conversion FemiGlow n'a pas de label Google Ads rempli dans
l'admin, l'exporter **n'émet pas** le tag `awct` correspondant. C'est
intentionnel — sinon GTM importerait un tag avec un label vide qui
n'enverrait aucune conversion mais consommerait un slot.

### 3. Built-in variable `AD_STORAGE` / `ANALYTICS_STORAGE` — REJETÉ

Ce sont des **consent storage keys**, pas des `BuiltInVariableType`.
L'exporter ne les inclut plus dans `builtInVariable`.

### 4. Trigger type `pageview` (lowercase) — REJETÉ

GTM exige `PAGEVIEW` en SCREAMING_SNAKE_CASE. L'exporter émet la bonne
casse.

### 5. Community templates `cvt_meta` / `cvt_tiktok` — KO sans setup préalable

L'exporter utilise des tags `html` natifs (avec snippet fbq/ttq) pour
Meta et TikTok, plutôt que des templates communautaires qui exigent
d'être installés dans le workspace cible.

### 6a. CSP `script-src-elem` bloque view-through conversions Google Ads

Erreur observée dans Tag Assistant :

```
CSP script-src-elem a bloqué une requête vers
https://googleads.g.doubleclick.net/pagead/viewthroughconversion/18136327114/
```

L'endpoint **view-through conversion** (mesure les conversions des
impressions Display sans clic direct) charge du script depuis
`googleads.g.doubleclick.net`. Différent de `pagead2.googlesyndication.com`
qui ne porte que les `connect-src` pings.

**Fix appliqué** : `googleads.g.doubleclick.net` + `*.doubleclick.net`
ajoutés à `script-src` ET `connect-src` pour Google Ads dans
`csp-hosts.ts`.

### 6b. Double préfixe `AW-AW-<id>` — Google Ads ne compte RIEN

Le tag template GTM `awct` (Google Ads Conversion Tracking) attend le
paramètre `conversionId` **sous forme numérique uniquement** (ex.
`18136327114`), pas avec le préfixe `AW-`. GTM re-applique le préfixe
en interne au moment de construire le ping :

```
ping URL = https://pagead2.googlesyndication.com/pagead/conversion/AW-<conversionId>/<conversionLabel>
```

Si on passe `AW-18136327114` au tag, le ping devient
`AW-AW-18136327114/...` → Google Ads ne reconnaît pas l'ID, aucune
conversion comptée.

**Symptôme visible dans Tag Assistant** : un container fantôme
nommé `AW-AW-18136327114` apparaît dans la liste des conteneurs
détectés.

**Fix appliqué** :

  - Form admin continue à exiger `AW-18136327114` (lisibilité user)
  - L'exporter strip automatiquement `^AW-` avant injection dans la
    CONST GTM (cf. `exporter.ts` ligne ~230)
  - Test régression : « CONST - Google Ads Conversion ID strip le
    préfixe AW- (sinon double prefix AW-AW-) »

### 7. Warning « Hits différés » dans Tag Assistant

Message complet :
> Certains hits ne seront pas envoyés tant qu'une commande de
> configuration ne sera pas fournie par le biais d'un appel
> `gtag('config')` ou d'une balise Google dans Tag Manager.

**Cause** : gtag a reçu une commande `event` pour une destination
(ex. `AW-XXXXXXX`) sans avoir vu de `gtag('config', 'AW-XXXXXXX', …)`
préalable. Le hit est mis en file d'attente. Si aucun config ne vient,
le hit est perdu.

**Causes typiques chez FemiGlow** :

1. **Container fantôme `AW-AW-<id>`** — un mauvais préfixe (cf. piège
   6b) crée une fausse destination, des events sont envoyés à
   `send_to: 'AW-AW-…/<label>'`, mais aucun config n'existe pour
   cette destination → tous les hits AW-AW-* sont différés.

2. **Multiple comptes Google Ads** dans le même tag — si on fait
   pointer plusieurs `awct` tags vers différentes Conversion ID
   sans tag Google Ads de config initial, GTM différe.

3. **GA4 désactivé mais Ads actif** — si seul `gaawc` (GA4 config)
   est désactivé mais `awct` (Ads conv) est actif, gtag n'a aucun
   config Google chargé → les events Ads sont différés.

**Fix** : s'assurer qu'il existe AU MOINS UN tag « Google Tag » (gaawc)
qui appelle `gtag('config', 'G-XXXX', ...)` au PageView. Notre exporter
émet déjà `GA4 Cfg` (gaawc) sur le trigger All Pages → pour FemiGlow
la cause est presque toujours le container fantôme AW-AW-.

**Solution pour le visiteur actuel** : re-télécharger le JSON GTM
fixé (avec le AW- strippé, cf. piège 6b) et ré-importer dans GTM
→ le `AW-AW-` disparaît, le warning Hits différés aussi.

### 6. CSP `connect-src` bloque les conversion pings Google Ads — SILENCIEUX

Le navigateur bloque les pings de conversion avec une erreur du type :

```
La directive Content Security Policy connect-src de la page a bloqué
une requête vers https://pagead2.googlesyndication.com/pagead/conversion/AW-…
```

**Conséquence sournoise** : la conversion **n'est pas comptée** par
Google Ads alors que tout le reste (DataLayer, GA4, GTM) marche
normalement → tu ne vois pas l'erreur si tu ne regardes pas Tag
Assistant ou la console DevTools.

**Hosts à whitelist dans `connect-src` pour Google Ads** :

  - `https://pagead2.googlesyndication.com` ← endpoint conversion ping
  - `https://www.googleadservices.com` ← redirect intermédiaire
  - `https://www.google.com`, `https://www.google.fr`, `https://www.google.ma`
  - `https://googleads.g.doubleclick.net`
  - `https://www.googletagmanager.com`

**Fix appliqué** dans `lib/tracking/providers/csp-hosts.ts` et
`google-ads.ts`. Le middleware Edge construit la CSP dynamiquement
depuis ces hôtes → la mise à jour se propage automatiquement.

**Validation** : Tag Assistant ne doit plus afficher de container
fantôme `AW-AW-…` ni d'erreurs CSP dans son onglet « Système ».

## Limites + futurs travaux

- Le gate utilise `ctx.anonymousId` (= visitorId) pour le lookup.
  Si ton visiteur a un `userId` connu (login admin), tu peux étendre
  pour faire un OR-lookup. Pas implémenté en phase 2 (cas rare sur
  le site public).
- Le `getAttributionStrategy()` est lu à chaque dispatch (~1 query
  cachée par tracking_settings). Si le volume devient critique,
  ajouter un cache LRU 30s sur la stratégie.
- Phase 3 (Google Ads OCI) tirera parti du gate sans modification.
