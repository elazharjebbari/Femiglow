# 07 — Conversions & mapping

> *Quels events sont des conversions, comment les pousser à chaque ad platform*

---

## 1. Définition

Une **conversion** au sens stratégique FemiGlow est un event qui
matérialise un objectif business mesurable. Les 5 conversions V1 :

| Event                          | Objectif business                                       | Valeur monétaire ?       |
| ------------------------------ | ------------------------------------------------------- | ------------------------ |
| `purchase`                     | Achat finalisé                                            | Oui — `value` requis     |
| `generate_lead`                | Lead qualifié (newsletter, contact, RDV, **chat email**)  | Optionnelle              |
| `sign_up`                      | Création de compte                                        | Optionnelle (V2)          |
| `begin_checkout`               | Démarrage tunnel (signal d'intention forte)              | Oui — `value` requis     |
| `fg_chat_lead_email_captured`  | Capture email opt-in via chat (sous-cas de `generate_lead`) | Optionnelle              |

> `fg_chat_lead_email_captured` est **double-émis** : en tant
> qu'event chat (signal d'audience interne) ET en tant que
> `generate_lead` standard avec `method = 'chat_email'`. Le
> mapping multi-providers utilise `generate_lead`. Cf.
> [13-events-chat.md](13-events-chat.md).

Les **autres events** (page_view, view_item, add_to_cart, etc.)
sont des **événements de tunnel** — pas des conversions, mais
des signaux pour les audiences et l'optimisation algorithmique.

### 1.1 Custom dimension d'attribution chat

`chat_attributed` est une **custom dimension event-scoped GA4**
attachée à **tous** les events. Elle vaut `true` quand le
visiteur a une `chat_session_id` dans son `localStorage`. Permet
d'analyser tous les `purchase` segmentés par « ayant chatté »
sans event séparé. Détail : [13-events-chat.md §8](13-events-chat.md).

## 2. Mapping multi-plateformes des conversions

### 2.1 `purchase`

| Plateforme        | Event name natif        | Identifiant conversion                         | Value | Currency | Dedup ID                  |
| ----------------- | ----------------------- | ---------------------------------------------- | ----- | -------- | ------------------------- |
| GA4               | `purchase`              | (mark as conversion in GA4 UI)                 | ✓     | ✓        | `event_id` (custom param) |
| Meta              | `Purchase`              | (auto, dans Pixel)                             | ✓     | ✓        | `eventID` (3rd arg)       |
| Google Ads        | `purchase`              | `Conversion ID` + `Conversion Label`            | ✓     | ✓        | `transaction_id`          |
| TikTok            | `CompletePayment`       | (auto)                                         | ✓     | ✓        | `event_id`                |
| Snap              | `PURCHASE`              | (auto)                                         | ✓     | ✓        | `client_dedup_id`         |
| Pinterest         | `checkout`              | (auto)                                         | ✓     | ✓        | `event_id`                |

### 2.2 `generate_lead`

| Plateforme  | Event natif             | Notes                                             |
| ----------- | ----------------------- | ------------------------------------------------- |
| GA4         | `generate_lead`         | Marquer comme conversion                          |
| Meta        | `Lead`                  | Champ `value` optionnel ; `eventID` requis        |
| Google Ads  | `lead`                  | Conversion action séparée (pas la même que purchase) |
| TikTok      | `SubmitForm`            | (alternativement `Contact`)                       |
| Snap        | `LEAD`                  | —                                                 |
| Pinterest   | `lead`                  | —                                                 |

### 2.3 `sign_up`

| Plateforme  | Event natif               | Notes                                  |
| ----------- | ------------------------- | -------------------------------------- |
| GA4         | `sign_up`                 | Marquer comme conversion               |
| Meta        | `CompleteRegistration`    | Method = `email` ou `oauth`            |
| TikTok      | `CompleteRegistration`    | —                                      |
| Snap        | `SIGN_UP`                 | —                                      |
| Pinterest   | `signup`                  | —                                      |
| Google Ads  | (optionnel, conversion `signup`) | À configurer si valeur business |

### 2.4 `begin_checkout`

| Plateforme  | Event natif               | Notes                                                    |
| ----------- | ------------------------- | -------------------------------------------------------- |
| GA4         | `begin_checkout`          | Marquer comme conversion (signal d'intention)             |
| Meta        | `InitiateCheckout`        | —                                                         |
| Google Ads  | (optionnel, conversion `cart_initiated`) | À considérer pour optimisation upper-funnel |
| TikTok      | `InitiateCheckout`        | —                                                         |
| Snap        | `START_CHECKOUT`          | —                                                         |
| Pinterest   | `checkout`                | (Pinterest n'a pas d'event séparé pour init vs purchase)  |

## 3. Stratégie de déduplication

### 3.1 Le problème

`purchase` part **deux fois** : une fois côté **client**
(GTM → Pixel JS) et une fois côté **server** (CAPI). Sans dédup,
Meta compte 2 conversions au lieu d'1.

### 3.2 La solution : `event_id`

L'`event_id` (UUID v4) est généré côté client au moment du push
DataLayer. Il est :

- inclus dans le **tag Pixel** (paramètre `eventID`) ;
- inclus dans le **payload CAPI** côté server.

Meta voit deux events avec le même `event_id` et n'en compte qu'un.

### 3.3 Implémentation côté code FemiGlow

```ts
// apps/web/src/lib/tracking/server/server-emit.ts
// (extrait — déjà partiellement implémenté)
export async function emitPurchaseServer(opts: {
  sessionId: string;
  orderId: string;
  items: Item[];
  value: number;
  currency: string;
  email_sha256: string;
  phone_sha256?: string;
  event_id: string;            // <-- partagé avec le client
}) {
  await dispatcher.send('meta', {
    event_name: 'Purchase',
    event_time: Math.floor(Date.now() / 1000),
    event_id: opts.event_id,
    action_source: 'website',
    user_data: {
      em: opts.email_sha256,
      ph: opts.phone_sha256,
      external_id: opts.sessionId,
      client_ip_address: opts.ip,
      client_user_agent: opts.ua,
      fbp: opts.fbp,           // depuis cookie _fbp
      fbc: opts.fbc,           // depuis cookie _fbc
    },
    custom_data: {
      currency: opts.currency,
      value: opts.value,
      content_ids: opts.items.map(i => i.item_id),
      contents: opts.items.map(i => ({ id: i.item_id, quantity: i.quantity, item_price: i.price })),
      order_id: opts.orderId,
    },
  });
}
```

### 3.4 Quel `event_id` côté client ?

Depuis le DataLayer :

```js
fbq('track', 'Purchase', payload, { eventID: {{DLV - event_id}} });
```

Le tag GTM utilise `{{DLV - event_id}}`. **C'est le même UUID** que
celui passé au server (relayé dans la requête `/api/orders/confirm`
qui déclenche le server emit).

## 4. GA4 — déclarer les conversions

Les events `purchase`, `generate_lead`, `sign_up` et
`begin_checkout` sont à **marquer comme conversion** dans
l'interface GA4 :

```
GA4 → Admin → Events → Mark as Conversion
```

Aucune config GTM particulière n'est nécessaire au-delà du tag
GA4 Event standard.

### 4.1 Custom dimensions à enregistrer

```
GA4 → Admin → Custom definitions → Custom dimensions
```

| Dimension              | Scope     | DLV source                          |
| ---------------------- | --------- | ----------------------------------- |
| `schema_version`       | Event     | `DLV - schema_version`              |
| `locale`               | User      | `DLV - page.locale`                 |
| `environment`          | Event     | `LUT - Environment`                 |
| `utm_source`           | Event     | `URL - utm_source`                  |
| `utm_medium`           | Event     | `URL - utm_medium`                  |
| `utm_campaign`         | Event     | `URL - utm_campaign`                |
| `event_id`             | Event     | `DLV - event_id`                    |
| `funnel_step`          | Event     | `RLT - Funnel Step by Event`        |

## 5. Google Ads — Conversion Actions

Créer **4 conversion actions** côté Ads UI :

| Conversion Action     | Category                  | Default value         | Count            |
| --------------------- | ------------------------- | --------------------- | ---------------- |
| `purchase`            | Purchase                  | Use transaction value | One              |
| `generate_lead`       | Lead → Submit lead form   | (vide ou statique)    | Every            |
| `sign_up`             | Sign-up                   | (vide)                 | Every            |
| `begin_checkout`      | Custom — Cart Initiated   | Use cart value         | One per session  |

Pour chaque, récupérer **Conversion ID** (`AW-XXXXXXX`) et
**Conversion Label** ; les saisir dans les `CONST -` GTM.

### 5.1 Enhanced Conversions (recommandé)

Activer **Enhanced Conversions** côté Ads pour matching renforcé.
Le tag GTM transmet déjà les hashes `email_sha256`, `phone_sha256`,
`first_name_sha256`, `last_name_sha256` (cf. `05-tags.md §8.1`).

Vérifier ensuite côté Ads UI que **« Diagnostic » montre des
matches** > 60 %.

## 6. Meta — Custom Conversions

Pour des objectifs spécifiques (ex. « Achat ≥ 320 MAD »), créer
une **Custom Conversion** côté Meta Events Manager qui filtre sur
`Purchase` + `value >= 320`. Pas de config GTM nécessaire.

## 7. TikTok — Conversion Setup

Les events standard (`Purchase`, `Lead`, `CompletePayment`,
`SubmitForm`) sont automatiquement reconnus.

Pour les campagnes Conversion Lift Studies, déclarer dans
TikTok Ads Manager les events de conversion à optimiser.

## 8. Pinterest — Conversion Tag

Pinterest mappe automatiquement `checkout`, `signup`, `lead` aux
catégories de conversion. Pas de config GTM.

## 9. Snap — Conversion Setup

Idem.

## 10. Server-side complément (CAPI)

Pour `purchase` et `generate_lead`, le server-side dispatcher
(`apps/web/src/lib/tracking/server/dispatcher.ts`) envoie en
parallèle :

| Provider       | Endpoint                                          | Auth                                            |
| -------------- | ------------------------------------------------- | ----------------------------------------------- |
| Meta CAPI      | `https://graph.facebook.com/v19.0/<pixel_id>/events` | Access Token (chiffré en DB)                  |
| GA4 MP         | `https://www.google-analytics.com/mp/collect`     | Measurement Protocol API Secret                  |
| Google Ads     | (offline conversion upload via API ou Sheet)      | (Phase 2)                                        |
| TikTok Events API | `https://business-api.tiktok.com/open_api/v1.3/event/track` | Access Token            |
| Snap CAPI      | (Phase 2)                                         | —                                                |

Les events `event_id` côté client et server sont identiques.

## 11. Audit qualité — Match Quality Score

| Plateforme   | Métrique                | Cible       | Comment améliorer                                                        |
| ------------ | ----------------------- | ----------- | ------------------------------------------------------------------------ |
| Meta         | Event Match Quality     | ≥ 7.0 / 10  | Ajouter `em`, `ph`, `external_id`, `fbp`, `fbc`, `client_ip_address`     |
| Google Ads   | Enhanced Conversions Match Rate | ≥ 60 % | Hash `email`, `phone`, `first_name`, `last_name`, `address`             |
| TikTok       | Diagnostic Score        | ≥ 80        | Ajouter `email`, `phone`, `external_id`, `ttp` (cookie)                  |
| Pinterest    | Conversion Health        | ≥ Good      | Ajouter `em`, `external_id`, `click_id`                                   |

## 12. Lecture suivante

- [08 — Server-side GTM](08-server-side-gtm.md)
- [09 — Environnements & versioning](09-environnements-versioning.md)
- [10 — Automatisation](10-automatisation.md)
