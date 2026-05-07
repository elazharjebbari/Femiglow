# 03 — Variables GTM

> *Built-in, dataLayer, constantes, lookup tables, JS, RegEx*

---

## 1. Vue d'ensemble

| Catégorie               | Quantité   | Rôle                                                                   |
| ----------------------- | ---------- | ---------------------------------------------------------------------- |
| Built-in                | 14         | Page URL, Click Element, Form Element, etc.                             |
| Constants               | 18         | Pixel IDs / Measurement IDs par environnement                           |
| DataLayer Variables     | 32         | Lecture des champs `event_id`, `consent.*`, `params.*`, `ecommerce.*` |
| Lookup Tables           | 6          | Routage par environnement / par page                                    |
| RegEx Lookup Tables     | 2          | Page type par path                                                       |
| Custom JavaScript        | 8          | Hashing, anti-bot, advanced matching                                    |

## 2. Variables Built-in (à activer)

À activer dans **Variables → Configure** :

- [x] **Page URL** (`{{Page URL}}`)
- [x] **Page Hostname**
- [x] **Page Path**
- [x] **Referrer**
- [x] **Click Element**
- [x] **Click Classes**
- [x] **Click ID**
- [x] **Click URL**
- [x] **Click Text**
- [x] **Form Element**
- [x] **Form Classes**
- [x] **Form ID**
- [x] **Form Text**
- [x] **Event** (le nom du Custom Event courant)
- [ ] **Container ID** / **Container Version** — non requis V1

## 3. Constantes

```
CONST - GA4 ID Prod              = 'G-XXXXXXX1'
CONST - GA4 ID Stage             = 'G-XXXXXXX2'
CONST - GA4 ID Preview           = 'G-XXXXXXX3'
CONST - Meta Pixel ID Prod       = '11111111111'
CONST - Meta Pixel ID Stage      = '22222222222'
CONST - Meta Pixel ID Preview    = '33333333333'
CONST - TikTok Pixel ID Prod     = 'CXXXXXXX'
CONST - Snap Pixel ID Prod       = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
CONST - Pinterest Tag ID Prod    = '0123456789'
CONST - Google Ads Customer Prod = '123-456-7890'
CONST - Google Ads Conv Label Purchase = 'AW-XXX/abc123'
CONST - Google Ads Conv Label Lead     = 'AW-XXX/def456'
CONST - Google Ads Conv Label Signup   = 'AW-XXX/ghi789'
CONST - Google Ads Conv Label InitCheckout = 'AW-XXX/jkl000'
CONST - Default Currency         = 'MAD'
CONST - Currency Display         = 'MAD'
CONST - Schema Version           = '1'
CONST - Cookie Domain            = 'auto'
```

> En **développement local** ou si une constante est vide
> (ex. `CONST - GA4 ID Dev = ''`), les tags qui en dépendent
> ne se déclenchent pas (cf. `LUT - GA4 Measurement ID by Env`
> retourne chaîne vide).

## 4. DataLayer Variables

Toutes les variables DLV utilisent **dataLayer Version 2** et
**Set Default Value : "(none)"** sauf indication contraire.

### 4.1 Identité de l'event

| Variable                       | Path dans dataLayer                  |
| ------------------------------ | ------------------------------------ |
| `DLV - event_id`               | `event_id`                           |
| `DLV - event`                  | `event` (équivalent à Built-in `Event`) |
| `DLV - timestamp`              | `timestamp`                          |
| `DLV - schema_version`         | `schema_version`                     |

### 4.2 Consentement

| Variable                                  | Path                                       |
| ----------------------------------------- | ------------------------------------------ |
| `DLV - consent.analytics_storage`         | `consent.analytics_storage`                 |
| `DLV - consent.ad_storage`                | `consent.ad_storage`                        |
| `DLV - consent.ad_user_data`              | `consent.ad_user_data`                      |
| `DLV - consent.ad_personalization`        | `consent.ad_personalization`                |

### 4.3 Page

| Variable                | Path                |
| ----------------------- | ------------------- |
| `DLV - page.url`        | `page.url`          |
| `DLV - page.path`       | `page.path`         |
| `DLV - page.title`      | `page.title`        |
| `DLV - page.referrer`   | `page.referrer`     |
| `DLV - page.locale`     | `page.locale`       |

### 4.4 User

| Variable                  | Path                  |
| ------------------------- | --------------------- |
| `DLV - user.anonymous_id` | `user.anonymous_id`   |
| `DLV - user.session_id`   | `user.session_id`     |
| `DLV - user.user_id`      | `user.user_id`        |

### 4.5 E-commerce (champ `ecommerce.*` — sera ajouté au DLV)

| Variable                          | Path                        |
| --------------------------------- | --------------------------- |
| `DLV - ecommerce.value`           | `ecommerce.value`           |
| `DLV - ecommerce.currency`        | `ecommerce.currency`        |
| `DLV - ecommerce.items`           | `ecommerce.items`           |
| `DLV - ecommerce.transaction_id`  | `ecommerce.transaction_id`  |
| `DLV - ecommerce.coupon`          | `ecommerce.coupon`          |
| `DLV - ecommerce.tax`             | `ecommerce.tax`             |
| `DLV - ecommerce.shipping`        | `ecommerce.shipping`        |
| `DLV - ecommerce.payment_type`    | `ecommerce.payment_type`    |
| `DLV - ecommerce.shipping_tier`   | `ecommerce.shipping_tier`   |

### 4.6 Params (events non-ecommerce)

Pour les events qui utilisent encore `params.*` (engagement, lead,
custom), DLV génériques :

| Variable                          | Path                        |
| --------------------------------- | --------------------------- |
| `DLV - params.percent_scrolled`   | `params.percent_scrolled`   |
| `DLV - params.video_title`        | `params.video_title`        |
| `DLV - params.video_percent`      | `params.video_percent`      |
| `DLV - params.video_duration`     | `params.video_duration`     |
| `DLV - params.method`             | `params.method`             |
| `DLV - params.search_term`        | `params.search_term`        |
| `DLV - params.form_id`            | `params.form_id`            |
| `DLV - params.field_name`         | `params.field_name`         |
| `DLV - params.section_id`         | `params.section_id`         |
| `DLV - params.article_id`         | `params.article_id`         |
| `DLV - params.faq_id`             | `params.faq_id`             |

### 4.7 User data (advanced matching, conversions)

```
DLV - user_data.email_sha256       (path: user_data.email_sha256)
DLV - user_data.phone_sha256       (path: user_data.phone_sha256)
DLV - user_data.first_name_sha256  (path: user_data.first_name_sha256)
DLV - user_data.last_name_sha256   (path: user_data.last_name_sha256)
DLV - user_data.country            (path: user_data.country)
DLV - user_data.city_sha256        (path: user_data.city_sha256)
```

> Ces valeurs sont **déjà hashées** côté serveur via
> `apps/web/src/lib/tracking/providers/hashing.ts` avant d'arriver
> dans le dataLayer. GTM ne hash pas — il consomme.

## 5. Lookup Tables

### 5.1 `LUT - Environment`

| Input variable    | Output  |
| ----------------- | ------- |
| `Page Hostname` (Built-in) |   |
| `femiglow.ma`              | `production` |
| `www.femiglow.ma`          | `production` |
| `stage.femiglow.ma`        | `stage`     |
| matches RegExp `\.vercel\.app$` | `preview` |
| `localhost`                | `dev`       |
| Default                    | `unknown`   |

### 5.2 `LUT - GA4 Measurement ID by Env`

| Input             | Output                       |
| ----------------- | ---------------------------- |
| `LUT - Environment` |                              |
| `production`      | `{{CONST - GA4 ID Prod}}`     |
| `stage`           | `{{CONST - GA4 ID Stage}}`    |
| `preview`         | `{{CONST - GA4 ID Preview}}`  |
| `dev`             | `''`                          |
| Default           | `''`                          |

### 5.3 `LUT - Meta Pixel ID by Env`

Idem (Prod / Stage / Preview / Dev → `''`).

### 5.4 `LUT - TikTok Pixel ID by Env`

```
production → {{CONST - TikTok Pixel ID Prod}}
stage      → ''
preview    → ''
dev        → ''
```

> TikTok n'est activé qu'en prod V1.

### 5.5 `LUT - Snap Pixel ID by Env`, `LUT - Pin Tag ID by Env`

Pareil — prod uniquement V1.

### 5.6 `LUT - Currency by Locale`

| Input         | Output |
| ------------- | ------ |
| `DLV - page.locale` |   |
| `fr-MA`       | `MAD`  |
| `ar-MA`       | `MAD`  |
| `fr-FR`       | `EUR`  |
| Default       | `MAD`  |

## 6. RegEx Lookup Tables

### 6.1 `RLT - Page Type by Path`

```
Input variable : DLV - page.path

^/$                      → home
^/rituel                 → rituel
^/kit                    → kit
^/journal/[^/]+$         → journal_article
^/journal/?$             → journal_index
^/maison                 → maison
^/panier                 → panier
^/commander              → commander
^/merci                  → merci
^/contact                → contact
^/admin                  → admin
Default                  → other
```

Utilisé dans triggers, audiences GA4, exclusions admin.

### 6.2 `RLT - Funnel Step by Event`

```
Input variable : Event (Built-in)

^view_item$              → product_seen
^add_to_cart$            → cart_added
^begin_checkout$         → checkout_started
^add_shipping_info$      → checkout_shipping
^add_payment_info$       → checkout_payment
^purchase$               → purchased
Default                  → not_funnel
```

## 7. Custom JavaScript

### 7.1 `JS - Is Bot User-Agent`

```javascript
function() {
  var ua = (navigator.userAgent || '').toLowerCase();
  var bots = [
    'googlebot', 'bingbot', 'yandexbot', 'duckduckbot',
    'baiduspider', 'slurp', 'facebot', 'twitterbot',
    'linkedinbot', 'whatsapp', 'telegrambot',
    'lighthouse', 'pagespeed', 'gtmetrix', 'pingdom',
    'headlesschrome', 'phantomjs', 'puppeteer', 'playwright'
  ];
  return bots.some(function(b) { return ua.indexOf(b) !== -1; });
}
```

### 7.2 `JS - Is Admin Path`

```javascript
function() {
  var p = {{Page Path}};
  return /^\/admin/.test(p);
}
```

### 7.3 `JS - Has Analytics Consent`

```javascript
function() {
  return {{DLV - consent.analytics_storage}} === 'granted';
}
```

### 7.4 `JS - Has Ad Consent`

```javascript
function() {
  return {{DLV - consent.ad_storage}} === 'granted';
}
```

### 7.5 `JS - Items Length`

Pour valider qu'`ecommerce.items` n'est pas vide avant
d'envoyer au tag (sécurité contre datalayer mal formé).

```javascript
function() {
  var items = {{DLV - ecommerce.items}};
  return Array.isArray(items) ? items.length : 0;
}
```

### 7.6 `JS - GA4 Items Mapper`

GA4 attend des items avec `item_id`, `item_name`, `quantity`,
`price`. Cette fonction normalise au cas où le DLV a évolué.

```javascript
function() {
  var items = {{DLV - ecommerce.items}};
  if (!Array.isArray(items)) return [];
  return items.map(function(it) {
    return {
      item_id: it.item_id || it.sku,
      item_name: it.item_name || it.name,
      item_brand: it.item_brand || 'FemiGlow',
      item_category: it.item_category,
      price: Number(it.price) || 0,
      quantity: Number(it.quantity) || 1,
      currency: it.currency || {{LUT - Currency by Locale}},
      index: it.index
    };
  });
}
```

### 7.7 `JS - Meta Items Mapper` (`content_ids` + `contents`)

```javascript
function() {
  var items = {{DLV - ecommerce.items}};
  if (!Array.isArray(items)) return { content_ids: [], contents: [] };
  return {
    content_ids: items.map(function(i) { return i.item_id || i.sku; }),
    contents: items.map(function(i) {
      return {
        id: i.item_id || i.sku,
        quantity: Number(i.quantity) || 1,
        item_price: Number(i.price) || 0
      };
    })
  };
}
```

### 7.8 `JS - TikTok Contents Mapper`

```javascript
function() {
  var items = {{DLV - ecommerce.items}};
  if (!Array.isArray(items)) return [];
  return items.map(function(i) {
    return {
      content_id: i.item_id || i.sku,
      content_name: i.item_name || i.name,
      content_type: 'product',
      quantity: Number(i.quantity) || 1,
      price: Number(i.price) || 0
    };
  });
}
```

## 8. URL Variables

```
URL - Pathname            (URL component: Path)
URL - Hostname            (URL component: Host)
URL - utm_source          (Query param: utm_source)
URL - utm_medium          (Query param: utm_medium)
URL - utm_campaign        (Query param: utm_campaign)
URL - utm_content         (Query param: utm_content)
URL - utm_term            (Query param: utm_term)
URL - gclid               (Query param: gclid)
URL - fbclid              (Query param: fbclid)
URL - ttclid              (Query param: ttclid)
URL - msclkid             (Query param: msclkid)
```

Utilisées dans GA4 Configuration tag (custom dimensions UTM) et
dans `JS - Items Mapper` si besoin.

## 9. 1st-party Cookies (rappel)

Les cookies suivants sont **lus** par les pixels (FBP, GA, etc.).
Aucune création manuelle nécessaire — les pixels les écrivent
eux-mêmes :

- `_fbp` — Meta browser ID
- `_fbc` — Meta click ID (depuis `fbclid`)
- `_ga` — GA4 client ID
- `_ga_<MEASUREMENT_ID>` — GA4 session
- `_ttp` — TikTok pixel ID
- `_pin_unauth` — Pinterest

Si on veut les lire dans GTM (cas avancé : passer `_fbp` à un tag
serveur), créer une variable `1st Party Cookie - _fbp`.

## 10. Lecture suivante

- [04 — Triggers](04-triggers.md)
- [05 — Tags](05-tags.md)
