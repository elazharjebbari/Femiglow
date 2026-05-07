# 08 — Providers & pixels publicitaires

## 1. Vue d'ensemble

5 providers natifs + GTM optionnel + custom :

| Provider | Client (pixel) | Server (CAPI) | Activation phase |
|---|---|---|---|
| Meta (Facebook/Instagram) | Pixel `fbq` | Conversions API | Phase 4 |
| TikTok | Pixel `ttq` | Events API | Phase 4 |
| Google Ads + GA4 | gtag.js | Measurement Protocol | Phase 4 |
| Snap | Pixel `snaptr` | Conversions API | Phase 5 |
| Pinterest | Pixel `pintrk` | Conversions API | Phase 5 |
| GTM (option) | container `gtm.js` | – | Phase 4 |
| Custom (snippets) | code custom head/body | – | Phase 5 |

Tous les pixels client passent par notre datalayer. La fondatrice
peut activer/désactiver chaque provider depuis `/admin/tracking/providers`.

## 2. Architecture provider

```
src/lib/tracking/providers/
  types.ts              ← interfaces communes
  registry.ts           ← liste & lookup
  dispatcher.ts         ← orchestration server-side
  event-mapping.ts      ← table mapping name → name natif
  meta.ts               ← MetaAdapter (mapEvent + dispatch CAPI)
  tiktok.ts             ← idem
  google.ts             ← idem (gestion combinée Ads + GA4)
  snap.ts               ← idem
  pinterest.ts          ← idem
  gtm.ts                ← simple injection GTM tag
  custom.ts             ← injection HTML head/body sandboxé
```

Interface commune :

```ts
export interface ProviderAdapter {
  kind: ProviderKind;
  // Côté client : retourne le code à exécuter pour init et track
  buildClientInit(config: ProviderClientConfig): string;
  buildClientTrack(event: TrackingEvent, config: ProviderClientConfig): string;
  // Côté server : map + dispatch CAPI
  mapEventServer(event: EnrichedEvent): unknown;
  dispatchServer(payload: unknown, config: ProviderServerConfig): Promise<ProviderResult>;
  // Tests
  testEvent(config: ProviderConfig): Promise<ProviderResult>;
}
```

## 3. Meta (Facebook / Instagram)

### 3.1 Côté client (Pixel)

Snippet officiel inlined avec CSP nonce :

```html
<script nonce="…">
!function(f,b,e,v,n,t,s){…}(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '{PIXEL_ID}');
</script>
```

Tracking :

```js
fbq('track', 'AddToCart', {
  value: 39.0,
  currency: 'EUR',
  content_ids: ['kit'],
  content_type: 'product',
  contents: [{ id: 'kit', quantity: 1, item_price: 39.0 }],
}, { eventID: 'evt_01h9c…' });
```

`eventID` est notre `event_id` UUID v7 — utilisé pour la déduplication
client/server.

### 3.2 Côté server (Conversions API)

Endpoint : `https://graph.facebook.com/v22.0/{PIXEL_ID}/events`

Payload :

```json
{
  "data": [{
    "event_name": "AddToCart",
    "event_time": 1714400000,
    "event_id": "01H9C…",
    "event_source_url": "https://femiglow.ma/kit",
    "action_source": "website",
    "user_data": {
      "client_ip_address": "1.2.3.0",
      "client_user_agent": "Mozilla/…",
      "em": "<sha256(email)>",
      "ph": "<sha256(phone)>",
      "fbp": "fb.1.1714400000.123",
      "fbc": "fb.1.1714400000.click_id"
    },
    "custom_data": {
      "currency": "EUR",
      "value": 39.0,
      "content_ids": ["kit"],
      "content_type": "product",
      "contents": [{"id":"kit","quantity":1,"item_price":39.0}]
    }
  }],
  "test_event_code": "TEST12345"
}
```

Headers :

```
Authorization: Bearer {CAPI_TOKEN}
Content-Type: application/json
```

### 3.3 User data (CAPI)

Hashage SHA-256 (lowercase, trim) avant envoi :

- `em` : email
- `ph` : téléphone E.164 sans `+`
- `fn`, `ln` : prénom, nom
- `ct` : ville
- `st` : région
- `zp` : code postal
- `country` : ISO-2 lowercase
- `client_ip_address` : adresse IP (Meta accepte la dernière octet
  zéro mais préfère la vraie pour matching).

### 3.4 Mapping events

```ts
export const META_EVENT_MAP = {
  page_view: 'PageView',
  view_item: 'ViewContent',
  view_item_list: null, // pas envoyé à Meta
  add_to_cart: 'AddToCart',
  remove_from_cart: null,
  view_cart: 'ViewContent', // discutable
  begin_checkout: 'InitiateCheckout',
  add_shipping_info: 'AddShippingInfo',
  add_payment_info: 'AddPaymentInfo',
  purchase: 'Purchase',
  generate_lead: 'Lead',
  sign_up: 'CompleteRegistration',
  search: 'Search',
  // events sans mapping → ignorés
} as const;
```

### 3.5 Test events

`test_event_code` : visible uniquement dans Events Manager →
"Test events". Permet de valider en prod sans polluer le pixel.

## 4. TikTok

### 4.1 Pixel client

```js
!function(w,d,t){w.TiktokAnalyticsObject=t;…}(window, document, 'ttq');
ttq.load('{PIXEL_ID}');
ttq.page();
ttq.track('AddToCart', {
  contents: [{ content_id: 'kit', content_name: 'Kit FemiGlow', quantity: 1, price: 39.0 }],
  value: 39.0, currency: 'EUR',
}, { event_id: 'evt_01h9c…' });
```

### 4.2 Events API (server)

Endpoint : `https://business-api.tiktok.com/open_api/v1.3/event/track/`

Headers :
```
Access-Token: {CAPI_TOKEN}
Content-Type: application/json
```

Payload :
```json
{
  "event_source": "web",
  "event_source_id": "{PIXEL_ID}",
  "data": [{
    "event": "AddToCart",
    "event_time": 1714400000,
    "event_id": "01H9C…",
    "user": {
      "email": "<sha256>",
      "phone": "<sha256>",
      "external_id": "<sha256>",
      "ttp": "tt-cookie",
      "ip": "1.2.3.0",
      "user_agent": "…"
    },
    "page": { "url": "https://femiglow.ma/kit" },
    "properties": {
      "currency": "EUR",
      "value": 39.0,
      "contents": [{"content_id":"kit","content_name":"Kit","price":39,"quantity":1}]
    }
  }],
  "test_event_code": "TEST12345"
}
```

### 4.3 Mapping

```ts
export const TIKTOK_EVENT_MAP = {
  page_view: 'Pageview',
  view_item: 'ViewContent',
  add_to_cart: 'AddToCart',
  begin_checkout: 'InitiateCheckout',
  add_payment_info: 'AddPaymentInfo',
  purchase: 'CompletePayment',
  generate_lead: 'Contact',
  sign_up: 'CompleteRegistration',
  search: 'Search',
};
```

## 5. Google (Ads + GA4)

### 5.1 gtag.js (client)

```html
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXX" nonce="…"></script>
<script nonce="…">
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('consent', 'default', { ad_storage: 'denied', analytics_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', wait_for_update: 500 });
gtag('config', 'G-XXXXXX', { send_page_view: false });
gtag('config', 'AW-YYYYYY');  // Google Ads
</script>
```

Tracking :

```js
gtag('event', 'add_to_cart', {
  currency: 'EUR',
  value: 39.0,
  items: [{ item_id: 'kit', item_name: 'Kit FemiGlow', price: 39, quantity: 1 }],
});
```

GA4 utilise les **mêmes noms d'events** que notre catalogue → pas de
mapping nécessaire (sauf pour les events `fg_*` qui sont autorisés
en custom).

### 5.2 Conversions Google Ads

Pour chaque event de conversion, on déclenche aussi :

```js
gtag('event', 'conversion', {
  send_to: 'AW-YYYYYY/abcdEFGH', // conversion label
  transaction_id: 'order_123',
  value: 39.0,
  currency: 'EUR',
});
```

Le label de conversion est configuré dans la console
(`tracking_providers.config.google.conversionLabels = { purchase: 'abcdEFGH', generate_lead: 'wxyzIJKL' }`).

### 5.3 Measurement Protocol (server-side GA4)

Endpoint :
`https://www.google-analytics.com/mp/collect?measurement_id=G-XXX&api_secret=SECRET`

Payload :
```json
{
  "client_id": "<gtag.js cid OR our anonymousId>",
  "user_id": "<user_id si connu>",
  "events": [{
    "name": "purchase",
    "params": {
      "transaction_id": "order_123",
      "currency": "EUR",
      "value": 39.0,
      "items": [{...}]
    }
  }],
  "user_properties": {
    "email_sha256": { "value": "..." }
  },
  "consent": {
    "ad_user_data": "GRANTED",
    "ad_personalization": "GRANTED"
  }
}
```

Méthode : POST. Pas de réponse parseable (204).

## 6. Snap

### 6.1 Pixel client

```js
(function(e,t,n){…}(window, document, 'snaptr'));
snaptr('init', '{PIXEL_ID}', { user_email: '<sha256>' });
snaptr('track', 'PAGE_VIEW');
snaptr('track', 'ADD_CART', { currency: 'EUR', price: 39.0, item_ids: ['kit'] });
```

### 6.2 CAPI

Endpoint : `https://tr.snapchat.com/v3/conversion`

(Plus complexe : OAuth2 + Conversion API token. Détails dans le
runbook §11-runbook.md§4.)

### 6.3 Mapping

```ts
export const SNAP_EVENT_MAP = {
  page_view: 'PAGE_VIEW',
  view_item: 'VIEW_CONTENT',
  add_to_cart: 'ADD_CART',
  begin_checkout: 'START_CHECKOUT',
  purchase: 'PURCHASE',
  generate_lead: 'LEAD',
  sign_up: 'SIGN_UP',
};
```

## 7. Pinterest

### 7.1 Pixel client

```js
!function(e){…}('pintrk');
pintrk('load', '{PIXEL_ID}', { em: '<email>' });
pintrk('page');
pintrk('track', 'addtocart', { value: 39.0, currency: 'EUR', line_items: [{...}] });
```

### 7.2 CAPI

Endpoint : `https://api.pinterest.com/v5/ad_accounts/{ad_account_id}/events`
Bearer token requis.

### 7.3 Mapping

```ts
export const PINTEREST_EVENT_MAP = {
  page_view: 'pagevisit',
  view_item: 'pagevisit',
  add_to_cart: 'addtocart',
  begin_checkout: 'checkout',
  purchase: 'checkout',
  generate_lead: 'lead',
  sign_up: 'signup',
  search: 'search',
};
```

## 8. GTM

GTM est un **conteneur** : on ajoute le snippet, ensuite la fondatrice
configure tout depuis tagmanager.google.com.

```html
<script nonce="…">(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-XXXX');</script>
```

Notre datalayer est compatible : on alimente aussi
`window.dataLayer.push(event)` à chaque emit (cf §04 Frontend §3).

GTM permet à la fondatrice d'ajouter d'autres pixels (Mailchimp, etc.)
sans toucher au code.

## 9. Code custom

`tracking_providers` peut contenir :

- `customHead` : injecté dans `<head>` via `<Script>` Next.js.
- `customBody` : injecté avant `</body>`.

Sécurité :

- Validation regex stricte : interdiction `<iframe`, `eval(`,
  `Function(`, `document.write(`, `innerHTML`.
- Sandboxé via CSP nonce.
- Annoncé par audit log.

Cas d'usage : un script de partenaire (Hotjar, partenaire affiliation)
non géré nativement.

## 10. Déduplication CAPI

Mécanisme :

1. Le client génère `event_id` UUID v7 lors de l'emit.
2. Le client envoie `event_id` au pixel (`fbq(…, {eventID})`,
   `ttq.track(…, {event_id})`).
3. Le client envoie `event_id` au server via `/api/track`.
4. Le server appelle CAPI avec le même `event_id`.
5. Meta/TikTok reçoit le même event 2 fois (client + server) →
   dédup automatique sur `event_id` (10 minutes window).

Cible : **dedup match rate ≥ 95 %** dans Events Manager Meta /
Events Manager TikTok.

## 11. Limitations / cas particuliers

- **Adblockers** : ~30 % des visiteurs ont uBlock. Le pixel ne
  charge pas → seul CAPI server compte. La dédup ne s'applique pas
  (events server-only) — Meta sait gérer.
- **iOS 14.5+ App Tracking Transparency** : limite le pixel client
  pour les utilisateurs iOS Safari. CAPI mitige.
- **Cookieless** : si `consent.ad_storage = denied`, on n'envoie
  rien aux pixels client. CAPI peut envoyer **avec** un objet
  `consent` indiquant `denied` (Consent Mode v2 = modeling).
- **Sessions cross-device** : `external_id` (notre `anonymousId`)
  permet à Meta de stitcher.

## 12. Configuration JSON par provider

Schéma stocké dans `tracking_providers.config` :

```ts
type MetaConfig = {
  pixelId: string;
  capiVersion: 'v22.0';
  // capiToken stocké chiffré dans capiToken/Iv/Tag (colonnes séparées)
  testEventCode?: string;
  enabledEvents?: string[]; // override de defaults
};

type TikTokConfig = {
  pixelId: string;
  capiVersion: 'v1.3';
  testEventCode?: string;
  enabledEvents?: string[];
};

type GoogleConfig = {
  ga4MeasurementId: string;
  ga4ApiSecret: string; // chiffré
  adsConversionId?: string;
  adsConversionLabels?: Record<string, string>;
  enabledEvents?: string[];
};
```

## 13. Routes API admin

- `GET /api/admin/tracking/providers` — liste avec status.
- `GET /api/admin/tracking/providers/:id` — détail.
- `PATCH /api/admin/tracking/providers/:id` — update config.
- `POST /api/admin/tracking/providers/:id/enable`
- `POST /api/admin/tracking/providers/:id/disable`
- `POST /api/admin/tracking/providers/:id/test` — envoie un event
  de test (avec `testEventCode`).

Toutes audit-loggées.

## 14. Console UI (rappel)

Voir [05-ui-ux-design.md §7](05-ui-ux-design.md). Une carte par
provider, formulaire avec sections (identifiants, code custom,
mapping events, test).

## 15. Ajout d'un nouveau provider

Procédure :

1. Ajouter le kind dans `trackingProviderKindEnum` (migration).
2. Créer `src/lib/tracking/providers/{kind}.ts` implémentant
   `ProviderAdapter`.
3. Enregistrer dans `registry.ts`.
4. Ajouter le mapping events dans `event-mapping.ts`.
5. Ajouter à la CSP middleware (host de chargement + endpoint CAPI).
6. Seed une row dans `tracking_providers` (status: `disabled`).
7. Ajouter un test (mock fetch CAPI) dans `providers/{kind}.test.ts`.
8. Documenter dans ce fichier (section provider).

Les sections existantes ne changent pas.
