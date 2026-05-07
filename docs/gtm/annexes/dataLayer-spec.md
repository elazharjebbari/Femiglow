# DataLayer FemiGlow — spécification

> Référence rapide pour développeurs et configurateurs GTM.

---

## 1. Objet poussé

Tout `push()` dans `window.femiglowDataLayer` produit un objet
typé. La copie miroir `window.dataLayer` reçoit le même objet.

```ts
{
  event: 'purchase',                              // nom canonique GA4-like
  event_id: '7c4b8c2a-1d3f-4f9c-9a02-...',          // UUIDv4 (dedup CAPI)
  timestamp: '2026-05-06T14:21:09.182Z',
  schema_version: 1,

  consent: {
    analytics_storage: 'granted',
    ad_storage:        'granted',
    ad_user_data:      'granted',
    ad_personalization:'granted',
    functionality_storage: 'granted',
    personalization_storage: 'granted',
    security_storage:  'granted',
  },

  page: {
    url: 'https://femiglow.ma/merci?order=ORD-2026-12345',
    path: '/merci',
    title: 'Merci — FemiGlow',
    referrer: 'https://femiglow.ma/commander',
    locale: 'fr-MA',
  },

  user: {
    anonymous_id: 'anon_xxx',
    session_id: 'sess_xxx',
    user_id: 'user_xxx',                          // si compte (rare V1)
  },

  user_data: {                                     // pour conversions seulement
    email_sha256: 'a1b2c3...',
    phone_sha256: 'd4e5f6...',
    first_name_sha256: '...',
    last_name_sha256: '...',
    country: 'MA',
    city_sha256: '...',
  },

  source: {
    component_id: 'cta-checkout-final',
    component_name: 'CTAFinalRecevoirRituel',
    page_id: 'page_kit',
  },

  ecommerce: {                                     // events e-commerce
    currency: 'MAD',
    value: 320,
    transaction_id: 'ORD-2026-12345',
    coupon: undefined,
    tax: 0,
    shipping: 0,
    items: [
      {
        item_id: 'kit-001',
        item_name: 'Kit Rituel d\'Éclat',
        item_brand: 'FemiGlow',
        item_category: 'rituel',
        price: 320,
        quantity: 1,
        currency: 'MAD',
        index: 0,
      },
    ],
  },

  params: {                                        // events non-ecommerce
    percent_scrolled: 75,                          // exemple scroll_depth
  },
}
```

## 2. Champs racine

| Champ            | Type     | Toujours présent ? | Notes                                                     |
| ---------------- | -------- | ------------------ | --------------------------------------------------------- |
| `event`          | string   | oui                | Nom du catalogue (`event-catalog.ts`)                     |
| `event_id`       | string   | oui                | UUID v4, partagé client/server pour dédup                 |
| `timestamp`      | string   | oui                | ISO 8601                                                  |
| `schema_version` | number   | oui                | `1` actuellement                                           |
| `consent`        | object   | oui                | Snapshot du consent au moment de l'event                  |
| `page`           | object   | oui                | URL / path / title / referrer / locale                    |
| `user`           | object   | oui                | anonymous_id (cookie 1y), session_id (sessionStorage)     |
| `user_data`      | object   | non                | Présent uniquement pour `purchase`, `generate_lead`, `sign_up` |
| `source`         | object   | non                | component / page d'origine                                |
| `ecommerce`      | object   | conditionnel       | Présent pour events `ecommerce.*`                          |
| `params`         | object   | conditionnel       | Présent pour events non-ecommerce                          |

## 3. Conventions de nommage

- `event` : `snake_case`, sans espace.
- `event_id` : UUID v4 généré côté client à la création de l'event.
- Champs ecommerce : strict GA4 Enhanced Ecommerce (cf.
  [developers.google.com/analytics/devguides/collection/ga4/ecommerce](https://developers.google.com/analytics/devguides/collection/ga4/ecommerce)).

## 4. Récupération côté GTM

### 4.1 Variables DLV — racine

```
DLV - event_id              → event_id
DLV - timestamp             → timestamp
DLV - schema_version        → schema_version
```

### 4.2 Variables DLV — sous-objets

GTM accepte la notation pointée :

```
DLV - page.path             → page.path
DLV - consent.ad_storage    → consent.ad_storage
DLV - ecommerce.value       → ecommerce.value
DLV - ecommerce.items       → ecommerce.items     (Array)
DLV - user_data.email_sha256 → user_data.email_sha256
```

### 4.3 Built-in `Event`

`{{Event}}` (Built-in) pointe sur la valeur de `event` à la racine.

## 5. Push d'un event depuis le code

```ts
// apps/web/src/lib/tracking/client.ts (présent)
import { trackEmit } from '@/lib/tracking/client';

trackEmit('purchase', {
  ecommerce: {
    currency: 'MAD',
    value: 320,
    transaction_id: 'ORD-2026-12345',
    items: [{ item_id: 'kit-001', item_name: 'Kit Rituel d\'Éclat', price: 320, quantity: 1 }],
  },
  user_data: {
    email_sha256: '...',
    phone_sha256: '...',
  },
});
```

L'helper `trackEmit` :

1. Génère un `event_id` UUID v4.
2. Capture `timestamp`, `schema_version`, `consent`, `page`,
   `user`.
3. Valide le payload contre le schéma Zod.
4. Push dans `window.femiglowDataLayer`.
5. Push miroir dans `window.dataLayer` (lu par GTM).
6. Optionnel : POST à `/api/track` pour persistance + CAPI server.

## 6. Tests automatisés

Le DataLayer est testé par :

- `apps/web/src/lib/tracking/datalayer.ts` (unit) — buffer, push, flush.
- `apps/web/src/lib/tracking/use-form-tracking.test.tsx` — events form.
- Playwright e2e : vérifie `window.dataLayer` post-action.

## 7. Anti-patterns à éviter

| Anti-pattern                                         | Pourquoi                                                 |
| ---------------------------------------------------- | -------------------------------------------------------- |
| Push direct `window.dataLayer.push({ event: 'foo' })`| Bypass de la validation Zod et du `event_id`             |
| Mettre la valeur monétaire dans `params.value` au lieu de `ecommerce.value` | Casse la conformité GA4 Enhanced Ecommerce |
| Push d'event admin (`fg_admin_action`) côté navigateur | Ces events sont server-only                              |
| Inclure email / phone non hashé                      | Violation RGPD + filtres pixel                            |
| Ne pas inclure `event_id` sur `purchase`             | Pas de dédup CAPI                                         |

## 8. Quand le DLV est vide / absent

- Si `consent.analytics_storage = 'denied'`, le DLV est **toujours
  poussé** (côté code). Mais les tags Pixel non-Consent-Mode-aware
  sont bloqués par exception trigger.
- Si l'utilisateur active un adblocker, le DLV existe toujours
  côté navigateur, mais GTM peut ne pas charger. C'est l'argument
  pour sGTM Phase 2 (cf. doc 08).

## 9. Events chat — payloads de référence

Cf. [docs/gtm/13-events-chat.md](../13-events-chat.md) pour le
catalogue complet. Quelques exemples canoniques :

```jsonc
// fg_chat_widget_open
{
  "event": "fg_chat_widget_open",
  "event_id": "uuid",
  "params": {
    "page_path": "/kit",
    "language": "fr",
    "chat_session_id": "cs_xxxx",
    "trigger_source": "user_click"
  }
}

// fg_chat_message_sent (rôle = user)
{
  "event": "fg_chat_message_sent",
  "event_id": "uuid",
  "params": {
    "chat_session_id": "cs_xxxx",
    "message_id": "cm_user321",
    "role": "user",
    "language": "fr",
    "message_index": 0
  }
}

// fg_chat_message_sent (rôle = assistant)
{
  "event": "fg_chat_message_sent",
  "event_id": "uuid",
  "params": {
    "chat_session_id": "cs_xxxx",
    "message_id": "cm_uVzAk987",
    "role": "assistant",
    "language": "fr",
    "message_index": 1,
    "first_token_ms": 720,
    "has_rag_sources": true
  }
}

// fg_chat_lead_email_captured  (+ doublon generate_lead method='chat_email')
{
  "event": "fg_chat_lead_email_captured",
  "event_id": "uuid",
  "user_data": {
    "email_sha256": "a1b2c3..."
  },
  "params": {
    "chat_session_id": "cs_xxxx",
    "consent_marketing": true
  }
}

// fg_chat_conversion_attributed
{
  "event": "fg_chat_conversion_attributed",
  "event_id": "uuid",
  "params": {
    "chat_session_id": "cs_xxxx",
    "order_id": "ORD-2026-12345",
    "attribution_window_days": 14,
    "messages_in_session": 6,
    "intent_dominant": "product_question"
  }
}
```
