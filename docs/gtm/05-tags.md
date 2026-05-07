# 05 — Tags GTM

> *GA4 Configuration & events, Meta, TikTok, Snap, Pinterest, Google Ads, Custom HTML*

---

## 1. Inventaire des tags

| Catégorie                | Quantité | Nommage                                |
| ------------------------ | -------- | -------------------------------------- |
| Configuration            | 3        | GA4 Cfg, CMP Cfg ×2                    |
| Pixel inits              | 4        | Meta, TikTok, Snap, Pinterest          |
| GA4 events               | 48       | un par event applicable (38 historiques + 10 chat) |
| Meta events              | ~14      | mappés `meta` + 2 chat (Engagement, Contact) |
| TikTok events            | ~10      | seulement les events mappés `tiktok`   |
| Snap events              | ~7       | seulement les events mappés `snap`     |
| Pinterest events         | ~6       | seulement les events mappés `pinterest`|
| Google Ads conversions   | 4        | purchase, lead, signup, begin_checkout |
| Google Ads remarketing   | 1        | global                                  |
| Custom HTML helpers      | 2        | exemple : early gtag()                  |

**Total approximatif : ~ 100 tags** (90 historiques + 10 chat
événementiels + 2 chat Meta). Cf.
[13-events-chat.md](13-events-chat.md) pour les tags chat
spécifiques.

> Le générateur (`scripts/gtm-generate.ts`) crée tous ces tags
> automatiquement à partir d'`event-catalog.ts` et
> `event-mapping.ts`.

## 2. GA4 Configuration tag

```
Name        : GA4 Cfg — Production
Type        : Google Tag (gtag.js) — Configuration
Tag ID      : {{LUT - GA4 Measurement ID by Env}}
Configuration parameters :
  - send_page_view             : false   (on émet manuellement via CE — page_view)
  - allow_ad_personalization_signals : (laissé géré par Consent Mode v2)
  - cookie_domain              : {{CONST - Cookie Domain}}
User-provided data :
  - email                      : {{DLV - user_data.email_sha256}}
  - phone_number               : {{DLV - user_data.phone_sha256}}
  - first_name                 : {{DLV - user_data.first_name_sha256}}
  - last_name                  : {{DLV - user_data.last_name_sha256}}
Custom dimensions (event-scoped) :
  - schema_version             : {{DLV - schema_version}}
  - locale                     : {{DLV - page.locale}}
  - utm_source                 : {{URL - utm_source}}
  - utm_medium                 : {{URL - utm_medium}}
  - utm_campaign               : {{URL - utm_campaign}}
  - environment                : {{LUT - Environment}}

Trigger : PV — All Pages
Exceptions : EX — Admin Pages, EX — Bot User-Agent
Tag firing priority : 80
Tag firing options : Once per page
```

> `send_page_view: false` — on contrôle nous-même les page_views
> pour les SPA (changements de route). Le code émet
> `page_view` après chaque navigation.

## 3. GA4 Event tags (1 par event)

Pattern type, ici pour `purchase` :

```
Name        : GA4 Evt — purchase
Type        : Google Analytics: GA4 Event
Configuration tag : {{GA4 Cfg — Production}}     (référence directe)
Event Name  : purchase

Event Parameters :
  - currency               : {{DLV - ecommerce.currency}}
  - value                  : {{DLV - ecommerce.value}}
  - transaction_id         : {{DLV - ecommerce.transaction_id}}
  - tax                    : {{DLV - ecommerce.tax}}
  - shipping               : {{DLV - ecommerce.shipping}}
  - coupon                 : {{DLV - ecommerce.coupon}}
  - items                  : {{JS - GA4 Items Mapper}}
  - event_id               : {{DLV - event_id}}     (pour dedup serveur)

User Properties :
  - locale                 : {{DLV - page.locale}}

Trigger    : CE — purchase
Exceptions : EX — Admin Pages, EX — Bot User-Agent
```

### 3.1 GA4 Items Mapper tag pattern (e-commerce)

Pour tous les events e-commerce (`view_item`, `add_to_cart`,
`view_cart`, `begin_checkout`, `purchase`, etc.), on réutilise
**`{{JS - GA4 Items Mapper}}`** dans le champ `items` du tag.

### 3.2 GA4 Event tags génériques (engagement, lead, custom)

Pour `scroll_depth` :

```
Event Name  : scroll
Event Parameters :
  - percent_scrolled : {{DLV - params.percent_scrolled}}
  - event_id         : {{DLV - event_id}}
Trigger : CE — scroll_depth
```

Pour `fg_section_view` :

```
Event Name  : fg_section_view
Event Parameters :
  - section_id  : {{DLV - params.section_id}}
  - page_path   : {{DLV - page.path}}
  - event_id    : {{DLV - event_id}}
Trigger : CE — fg_section_view
```

> **Règle de génération** : si `event-catalog.ts` déclare un event
> avec un `provider = 'google_ga4'`, alors le générateur produit
> automatiquement un tag GA4 Event avec les params déclarés.

## 4. Meta Pixel tags

### 4.1 Meta Init

```
Name : Meta Init — production
Type : Custom HTML

Code :
<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');

fbq('init', {{LUT - Meta Pixel ID by Env}});

// External_id si user identifié
var advancedMatching = {};
if ({{DLV - user_data.email_sha256}}) advancedMatching.em = {{DLV - user_data.email_sha256}};
if ({{DLV - user_data.phone_sha256}}) advancedMatching.ph = {{DLV - user_data.phone_sha256}};
if ({{DLV - user.user_id}}) advancedMatching.external_id = {{DLV - user.user_id}};
if (Object.keys(advancedMatching).length > 0) {
  fbq('init', {{LUT - Meta Pixel ID by Env}}, advancedMatching);
}
</script>

Trigger : Group — Init After Consent Granted
Exceptions : EX — Bot User-Agent, EX — Consent Denied (Ad)
Tag firing priority : 70
Tag firing options : Once per page
```

### 4.2 Meta Pixel Event — Purchase

```
Name : Meta Evt — Purchase
Type : Custom HTML

Code :
<script>
fbq('track', 'Purchase', {
  currency: {{DLV - ecommerce.currency}},
  value: {{DLV - ecommerce.value}},
  content_ids: {{JS - Meta Items Mapper}}.content_ids,
  contents: {{JS - Meta Items Mapper}}.contents,
  content_type: 'product',
  num_items: {{JS - Items Length}}
}, {
  eventID: {{DLV - event_id}}
});
</script>

Trigger : CE — purchase
Exceptions : EX — Admin Pages, EX — Bot User-Agent, EX — Consent Denied (Ad)
Setup tag : Meta Init — production
```

> Le `eventID` (3e argument) est **clé** : c'est le même que
> celui envoyé via Meta CAPI server-side, et permet à Meta de
> dédupliquer les deux signaux.

### 4.3 Liste complète des tags Meta à générer

| Event FemiGlow      | Meta event name           |
| ------------------- | ------------------------- |
| `page_view`         | `PageView`                |
| `view_item_list`    | `ViewContent` (batch)     |
| `view_item`         | `ViewContent`             |
| `add_to_cart`       | `AddToCart`               |
| `view_cart`         | `ViewContent` (cart)       |
| `begin_checkout`    | `InitiateCheckout`         |
| `add_shipping_info` | `AddShippingInfo`          |
| `add_payment_info`  | `AddPaymentInfo`           |
| `purchase`          | `Purchase`                 |
| `generate_lead`     | `Lead`                     |
| `sign_up`           | `CompleteRegistration`     |
| `search`            | `Search`                   |
| `video_start`       | (Custom event — facultatif) |
| `video_complete`    | (Custom event — facultatif) |

## 5. TikTok Pixel tags

### 5.1 TikTok Init

```
Name : TikTok Init — production
Type : Custom HTML

Code :
<script>
!function (w, d, t) {
  w.TiktokAnalyticsObject = t;
  var ttq = w[t] = w[t] || [];
  ttq.methods = ["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];
  ttq.setAndDefer = function(t, e) { t[e] = function() { t.push([e].concat(Array.prototype.slice.call(arguments, 0))); }};
  for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
  ttq.instance = function(t) { for (var e = ttq._i[t] || [], n = 0; n < ttq.methods.length; n++) ttq.setAndDefer(e, ttq.methods[n]); return e };
  ttq.load = function(e, n) { var i = "https://analytics.tiktok.com/i18n/pixel/events.js";
    ttq._i = ttq._i || {}; ttq._i[e] = []; ttq._i[e]._u = i;
    ttq._t = ttq._t || {}; ttq._t[e] = +new Date;
    ttq._o = ttq._o || {}; ttq._o[e] = n || {};
    var o = document.createElement("script"); o.type = "text/javascript"; o.async = !0;
    o.src = i + "?sdkid=" + e + "&lib=" + t;
    var a = document.getElementsByTagName("script")[0]; a.parentNode.insertBefore(o, a);
  };
  ttq.load({{LUT - TikTok Pixel ID by Env}});
  ttq.identify({
    email: {{DLV - user_data.email_sha256}},
    phone_number: {{DLV - user_data.phone_sha256}},
    external_id: {{DLV - user.user_id}}
  });
  ttq.page();
}(window, document, 'ttq');
</script>

Trigger : Group — Init After Consent Granted
Exceptions : EX — Bot User-Agent, EX — Consent Denied (Ad)
```

### 5.2 TikTok Event — CompletePayment

```
Type : Custom HTML
Code :
<script>
ttq.track('CompletePayment', {
  value: {{DLV - ecommerce.value}},
  currency: {{DLV - ecommerce.currency}},
  contents: {{JS - TikTok Contents Mapper}},
  content_type: 'product'
}, { event_id: {{DLV - event_id}} });
</script>

Trigger : CE — purchase
Setup tag : TikTok Init — production
```

## 6. Snap Pixel tags

### 6.1 Snap Init

```
<script>
(function(e,t,n){if(e.snaptr)return;var a=e.snaptr=function(){a.handleRequest?a.handleRequest.apply(a,arguments):a.queue.push(arguments)};
a.queue=[];var s='script';r=t.createElement(s);r.async=!0;r.src=n;var u=t.getElementsByTagName(s)[0];u.parentNode.insertBefore(r,u);})(window,document,'https://sc-static.net/scevent.min.js');

snaptr('init', {{LUT - Snap Pixel ID by Env}}, {
  user_email: {{DLV - user_data.email_sha256}},
  user_phone_number: {{DLV - user_data.phone_sha256}}
});
snaptr('track', 'PAGE_VIEW');
</script>
```

### 6.2 Snap Event — PURCHASE

```
<script>
snaptr('track', 'PURCHASE', {
  price: {{DLV - ecommerce.value}},
  currency: {{DLV - ecommerce.currency}},
  transaction_id: {{DLV - ecommerce.transaction_id}},
  item_ids: {{JS - Meta Items Mapper}}.content_ids,
  number_items: {{JS - Items Length}},
  client_dedup_id: {{DLV - event_id}}
});
</script>
```

## 7. Pinterest Tag

### 7.1 Pin Init

```
<script>
!function(e){if(!window.pintrk){window.pintrk=function(){window.pintrk.queue.push(Array.prototype.slice.call(arguments))};var n=window.pintrk;n.queue=[],n.version="3.0";var t=document.createElement("script");t.async=!0,t.src=e;var r=document.getElementsByTagName("script")[0];r.parentNode.insertBefore(t,r)}}("https://s.pinimg.com/ct/core.js");

pintrk('load', {{LUT - Pin Tag ID by Env}}, {
  em: {{DLV - user_data.email_sha256}},
  external_id: {{DLV - user.user_id}}
});
pintrk('page');
</script>
```

### 7.2 Pin Event — checkout

```
<script>
pintrk('track', 'checkout', {
  value: {{DLV - ecommerce.value}},
  order_quantity: {{JS - Items Length}},
  currency: {{DLV - ecommerce.currency}},
  order_id: {{DLV - ecommerce.transaction_id}},
  line_items: {{JS - GA4 Items Mapper}},
  event_id: {{DLV - event_id}}
});
</script>
```

## 8. Google Ads — Conversions

Pour chaque conversion, un **tag Google Ads Conversion Tracking** :

### 8.1 Ads Conv — purchase

```
Name : Ads Conv — purchase
Type : Google Ads Conversion Tracking
Conversion ID    : (extrait de CONST - Google Ads Conv Label Purchase, partie avant /)
Conversion Label : (partie après /)
Conversion Value : {{DLV - ecommerce.value}}
Currency Code    : {{DLV - ecommerce.currency}}
Transaction ID   : {{DLV - ecommerce.transaction_id}}

Enhanced Conversions :
  - Email   : {{DLV - user_data.email_sha256}}
  - Phone   : {{DLV - user_data.phone_sha256}}
  - First   : {{DLV - user_data.first_name_sha256}}
  - Last    : {{DLV - user_data.last_name_sha256}}

Trigger : CE — purchase
Exceptions : EX — Admin Pages, EX — Bot User-Agent
```

> **Enhanced Conversions** est crucial pour la qualité du
> matching côté Ads. Les hashes proviennent du serveur (déjà
> implémenté dans `tracking/providers/hashing.ts`).

### 8.2 Autres conversions

| Tag                        | Trigger              | Conversion Label                   |
| -------------------------- | -------------------- | ---------------------------------- |
| Ads Conv — generate_lead   | CE — generate_lead   | CONST - Google Ads Conv Label Lead |
| Ads Conv — sign_up         | CE — sign_up         | CONST - Google Ads Conv Label Signup |
| Ads Conv — begin_checkout  | CE — begin_checkout  | CONST - Google Ads Conv Label InitCheckout |

### 8.3 Ads Remarketing

```
Name : Ads RMK — global
Type : Google Ads Remarketing
Conversion ID    : (sans label)
Custom Parameters :
  - ecomm_pagetype : {{RLT - Page Type by Path}}
  - ecomm_prodid   : {{JS - Meta Items Mapper}}.content_ids
  - ecomm_totalvalue : {{DLV - ecommerce.value}}

Trigger    : PV — Public Pages
Exceptions : EX — Bot User-Agent, EX — Consent Denied (Ad)
```

## 9. Tags d'aide (Custom HTML)

### 9.1 `Aux JS — Early gtag()`

À placer **avant** `GA4 Cfg` pour s'assurer que `gtag` existe :

```
<script>
window.dataLayer = window.dataLayer || [];
window.gtag = window.gtag || function(){ window.dataLayer.push(arguments); };
</script>

Trigger : INIT — Consent Default (priority 99)
```

### 9.2 `Aux JS — Page Type` (pour analytics)

Tag qui pousse une variable `page_type` au datalayer pour
faciliter les segments GA4 :

```
<script>
window.dataLayer.push({ page_type: '{{RLT - Page Type by Path}}' });
</script>

Trigger : PV — All Pages (priority 75, après GA4 Cfg)
```

## 10. Tags à ne **pas** créer

| Anti-pattern                                        | Pourquoi                                                                  |
| --------------------------------------------------- | ------------------------------------------------------------------------- |
| Tag GA4 sur `fg_admin_action`                       | Event interne, jamais public                                              |
| Tag Meta sur `scroll_depth`                          | Trop verbeux, dégrade la qualité du signal Meta                            |
| Tag Pinterest sur `view_item_list`                   | Pinterest n'a pas de mapping standard                                      |
| Tag pour `fg_pixel_test`                             | Event de test admin — `defaultProviders: []`                              |

> Le générateur respecte ces règles **automatiquement** : il ne
> crée un tag que si le couple (event, provider) existe dans
> `event-mapping.ts`.

## 11. Récapitulatif tags par provider

| Provider     | Tags init | Tags event | Total |
| ------------ | --------- | ---------- | ----- |
| GA4           | 1 (Cfg)   | 48 (38 + 10 chat) | 49 |
| Meta          | 1         | 14 (12 + 2 chat) | 15    |
| TikTok        | 1         | 10         | 11    |
| Snap          | 1         | 7          | 8     |
| Pinterest     | 1         | 6          | 7     |
| Google Ads    | 1 (RMK)   | 4 (Conv)   | 5     |
| Consent / Aux | 0         | 4          | 4     |
| **Total**     |           |            | **~ 99** |

> Les 12 tags chat (10 GA4 + 2 Meta) sont décrits dans
> [13-events-chat.md §6 et §7](13-events-chat.md).

## 12. Lecture suivante

- [06 — Consent Mode v2](06-consent-mode.md)
- [07 — Conversions & mapping](07-conversions-mapping.md)
- [10 — Automatisation](10-automatisation.md) — comment générer
  ces ~ 87 tags par script.
