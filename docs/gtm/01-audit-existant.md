# 01 — Audit de l'existant

> *Inventaire des 38 events, structure du dataLayer, mapping providers*

---

## 1. État du tracking côté code

| Composant                                       | Fichier                                                                          | État    |
| ----------------------------------------------- | -------------------------------------------------------------------------------- | ------- |
| DataLayer custom                                 | `apps/web/src/lib/tracking/datalayer.ts`                                          | en place |
| Catalogue d'events typés                         | `apps/web/src/lib/tracking/event-catalog.ts`                                      | 38 events |
| Schémas Zod                                      | `apps/web/src/lib/tracking/schemas.ts`                                            | partiel |
| Mapping events ↔ providers                       | `apps/web/src/lib/tracking/providers/event-mapping.ts`                             | en place |
| Adapters providers                               | `apps/web/src/lib/tracking/providers/{meta,tiktok,snap,pinterest,google,gtm}.ts`   | en place |
| Hashing PII (SHA-256)                            | `apps/web/src/lib/tracking/providers/hashing.ts` + tests                          | testé   |
| Server emit + dédup                              | `apps/web/src/lib/tracking/server/{server-emit,dedup,dispatcher}.ts`              | testé   |
| Endpoint d'ingestion                             | `app/api/track/route.ts` (présumé)                                                | présumé en place |
| Provider snippet GTM                             | `apps/web/src/lib/tracking/providers/gtm.ts`                                      | minimal |
| CSP hosts                                        | `apps/web/src/lib/tracking/providers/csp-hosts.ts`                                | en place |
| Inventory scanner                                | `apps/web/src/lib/tracking/inventory/{scanner,diff}.ts`                            | en place |
| Console admin /admin/tracking                    | (cf. `docs/tracking/`)                                                            | présumé en place |

## 2. Structure du DataLayer

L'objet poussé dans `window.femiglowDataLayer` (et miroité dans
`window.dataLayer`) est typé comme suit (extrait de
`apps/web/src/lib/tracking/datalayer.ts:3`) :

```ts
interface DataLayerEntry {
  event: string;             // nom canonique GA4-like
  event_id: string;          // UUIDv4, pour dédup CAPI
  timestamp: string;         // ISO 8601
  schema_version: number;    // 1 pour V1
  consent: {
    analytics_storage: 'granted' | 'denied';
    ad_storage: 'granted' | 'denied';
    ad_user_data?: 'granted' | 'denied';
    ad_personalization?: 'granted' | 'denied';
    functionality_storage?: 'granted' | 'denied';
    personalization_storage?: 'granted' | 'denied';
    security_storage?: 'granted' | 'denied';
  };
  page: {
    url: string;
    path: string;
    title: string;
    referrer: string;
    locale: string;
  };
  user: {
    anonymous_id: string;
    session_id: string;
    user_id?: string;
  };
  source?: {
    component_id?: string;
    component_name?: string;
    page_id?: string;
  };
  context?: Record<string, unknown>;
  params?: Record<string, unknown>;
}
```

**Implications GTM** :

- Les **données métier** (montant panier, items, etc.) vivent dans
  `params`, pas à la racine.
- Pour qu'un tag GA4 lise `params.value` dans GTM, on déclare une
  variable dataLayer **`DLV - params.value`** qui pointe sur
  `params.value`.
- L'`event_id` doit être passé au tag Meta (`event_id` paramètre
  Pixel) et au tag GA4 (`event_id` parameter) pour dédup.
- `consent` doit être lu par les tags pour ne s'exécuter que si
  `consent.analytics_storage = 'granted'` (sauf Consent Mode v2
  qui gère cela nativement).

## 3. Inventaire des 48 events

Source : `apps/web/src/lib/tracking/event-catalog.ts` (1 = page,
20 = engagement, 12 = ecommerce, 5 = lead, 3 = admin, 7 = custom
`fg_*`) + **10 events chat** `fg_chat_*` issus de
`docs/chat-assistant/` (cf. doc [13](13-events-chat.md)).

### 3.1 Page (1)

| Nom         | Scope | Conv | Providers cibles                                         |
| ----------- | ----- | ---- | -------------------------------------------------------- |
| `page_view` | web   | non  | meta, tiktok, ga4, ads, snap, pinterest                   |

### 3.2 Engagement (20)

| Nom                       | Scope | Conv | Providers cibles      |
| ------------------------- | ----- | ---- | --------------------- |
| `scroll_depth`            | web   | non  | ga4                   |
| `click`                   | web   | non  | ga4                   |
| `select_content`          | web   | non  | ga4                   |
| `share`                   | web   | non  | ga4                   |
| `search`                  | web   | non  | ga4, meta, tiktok, pinterest |
| `video_start`             | web   | non  | ga4, meta             |
| `video_progress`          | web   | non  | ga4                   |
| `video_complete`          | web   | non  | ga4, meta             |
| `video_user_play`         | web   | non  | ga4, meta             |
| `video_autoplay_view`     | web   | non  | ga4                   |
| `video_transcript_open`   | web   | non  | ga4                   |
| `file_download`           | web   | non  | ga4                   |
| `form_start`              | web   | non  | ga4                   |
| `form_submit`             | web   | non  | ga4                   |
| `form_field_focus`        | web   | non  | ga4                   |
| `form_field_blur`         | web   | non  | ga4                   |
| `form_validation_error`   | web   | non  | ga4                   |
| `form_abandon`            | web   | non  | ga4                   |
| `cta_impression`          | web   | non  | ga4                   |
| `mini_cart_open`          | web   | non  | ga4                   |
| `mini_cart_close`         | web   | non  | ga4                   |

### 3.3 E-commerce (12)

| Nom                  | Scope  | Conv | Providers cibles                                                          |
| -------------------- | ------ | ---- | ------------------------------------------------------------------------- |
| `view_item_list`     | web    | non  | ga4, meta                                                                 |
| `select_item`        | web    | non  | ga4                                                                       |
| `view_item`          | both   | non  | ga4, meta, tiktok, snap, pinterest                                        |
| `add_to_cart`        | both   | non  | ga4, meta, tiktok, snap, pinterest                                         |
| `remove_from_cart`   | web    | non  | ga4                                                                       |
| `view_cart`          | web    | non  | ga4                                                                       |
| `begin_checkout`     | both   | **oui** | ga4, meta, tiktok, snap, pinterest                                     |
| `add_shipping_info`  | both   | non  | ga4                                                                       |
| `add_payment_info`   | both   | non  | ga4, meta, tiktok, snap                                                   |
| `purchase`           | both   | **oui** | ga4, meta, tiktok, ads, snap, pinterest                                |
| `refund`             | server | non  | ga4, meta                                                                 |
| `view_promotion`     | web    | non  | ga4                                                                       |
| `select_promotion`   | web    | non  | ga4                                                                       |

### 3.4 Lead (5)

| Nom                  | Scope | Conv | Providers cibles                                              |
| -------------------- | ----- | ---- | ------------------------------------------------------------- |
| `generate_lead`      | both  | **oui** | ga4, meta, ads, tiktok, snap, pinterest                    |
| `contact_submit`     | web   | non  | ga4                                                           |
| `newsletter_submit`  | web   | non  | ga4                                                           |
| `sign_up`            | both  | **oui** | ga4, meta, tiktok                                          |
| `login`              | web   | non  | ga4                                                           |

### 3.5 Custom FemiGlow (7) — préfixe `fg_`

| Nom                       | Scope | Description                                              |
| ------------------------- | ----- | -------------------------------------------------------- |
| `fg_journal_read_75`      | web   | Article journal lu à 75 %                                 |
| `fg_journal_read_100`     | web   | Article lu jusqu'à la fin                                 |
| `fg_section_view`         | web   | Section vue (IO ≥ 50 %)                                   |
| `fg_faq_view`             | web   | Question FAQ ouverte                                     |
| `fg_composition_open`     | web   | Composition produit dépliée                              |
| `fg_pixel_test`           | both  | Event de test depuis console admin (`dry_run`)           |
| `fg_consent_change`       | web   | Changement de consentement (transition `from`→`to`)      |

### 3.6 Admin (1 supplémentaire, non-tracking)

- `fg_admin_action` (server uniquement) — audit interne, **ne
  doit pas** déclencher de tag GTM.

### 3.7 Chat assistant (10) — préfixe `fg_chat_*`

Issus de `docs/chat-assistant/02-data.md §2.8` et
`docs/chat-assistant/annexes/payloads-exemples.md §14`. Détail
complet dans [13-events-chat.md](13-events-chat.md).

| Nom                              | Scope | Conv | Description                                                  |
| -------------------------------- | ----- | ---- | ------------------------------------------------------------ |
| `fg_chat_widget_open`            | web   | non  | Visiteur ouvre le widget                                      |
| `fg_chat_widget_close`           | web   | non  | Visiteur ferme                                                |
| `fg_chat_message_sent`           | web   | non  | Message envoyé (role: user) ou reçu (role: assistant)         |
| `fg_chat_suggestion_clicked`     | web   | non  | Clic sur une suggestion contextuelle                          |
| `fg_chat_feedback`               | web   | non  | Pouce vert/rouge sur une réponse                              |
| `fg_chat_language_switch`        | web   | non  | Bascule de langue (FR/AR/Darija)                              |
| `fg_chat_error`                  | web   | non  | Erreur visible (provider down, timeout, modération)           |
| `fg_chat_rate_limit_hit`         | web   | non  | Visiteur dépasse le rate-limit                                |
| `fg_chat_lead_email_captured`    | both  | OUI  | Capture d'email opt-in (reprise par email)                    |
| `fg_chat_conversion_attributed`  | both  | non  | Signal d'attribution chat → commande (audience-builder)       |

## 4. Inventaire des conversions

Sur les 48 events, **5 sont des conversions** au sens stratégique
(les 4 historiques + `fg_chat_lead_email_captured`, qui est
double-émis comme `generate_lead` standard avec
`method='chat_email'`) :

| Event             | GA4              | Meta               | Google Ads                      | TikTok            | Snap            | Pinterest |
| ----------------- | ---------------- | ------------------ | ------------------------------- | ----------------- | --------------- | --------- |
| `begin_checkout`  | mark_as_conv      | InitiateCheckout    | conversion `cart_initiated`     | InitiateCheckout  | START_CHECKOUT  | checkout  |
| `purchase`        | **mark_as_conv** | **Purchase** (CAPI) | **conversion `purchase`** (CAPI) | CompletePayment   | PURCHASE        | checkout  |
| `generate_lead`   | mark_as_conv      | Lead                | conversion `lead`               | SubmitForm        | LEAD            | lead      |
| `sign_up`         | mark_as_conv      | CompleteRegistration | conversion `signup`            | CompleteRegistration | SIGN_UP       | signup    |

> **`purchase`** et **`generate_lead`** sont les deux conversions
> métier majeures. Elles doivent être dédupliquées via `event_id`
> entre tag client (Pixel) et server (CAPI).

## 5. Provider config en base

Source : `tracking_providers` (cf. `docs/tracking/02-data.md`).
Schéma simplifié :

```sql
tracking_providers
  id              text primary key  -- 'tpr_xxx'
  kind            text              -- 'meta'|'tiktok'|'google_ga4'|'google_ads'|'snap'|'pinterest'|'gtm'
  pixel_id        text
  capi_token_enc  text              -- chiffré
  status          text              -- 'enabled'|'paused'|'disabled'
  egress_allowed  bool
  test_event_code text              -- pour Meta test events
  consent_required jsonb            -- ['analytics_storage','ad_storage']
  ...
```

**L'admin /admin/tracking** permet de manipuler ces lignes. Le
GTM y consomme via `DLV - tracking.providers` (variable JS qui
lit l'état depuis l'API publique `/api/tracking/providers/active`).

## 6. Ce qui passe par GTM vs ce qui passe par le server

Le code FemiGlow a déjà un **server-side dispatcher**
(`apps/web/src/lib/tracking/server/dispatcher.ts`) qui envoie
events vers Meta CAPI, GA4 Measurement Protocol, TikTok Events
API, etc. **GTM n'est donc pas la seule voie**.

### Stratégie hybride recommandée

| Event                | Voie principale                    | Voie complémentaire (dédup)            |
| -------------------- | ---------------------------------- | -------------------------------------- |
| `page_view`          | GTM client (GA4 + Meta Pixel)      | server (rare, on évite double-counting) |
| Engagement (scroll, click, video, fg_*) | GTM client (GA4 only) | aucun                                   |
| `view_item`, `add_to_cart`, `view_cart` | GTM client (GA4 + Meta + TikTok + Snap + Pinterest) | aucun |
| `begin_checkout`     | GTM client + server CAPI Meta      | dédup par `event_id`                    |
| `purchase`           | GTM client (GA4 + Meta) + server CAPI (Meta + GA4 MP + Ads) | **dédup obligatoire** par `event_id` |
| `generate_lead`      | GTM client + server CAPI Meta + Ads | dédup par `event_id`                    |
| `refund`             | server only (déclenché par webhook Stripe) | aucun                          |
| `fg_admin_action`    | server only                        | jamais GTM                              |

> Les 4 events de conversion partent **deux fois** (client +
> server) avec le **même `event_id`**, ce qui permet aux providers
> (Meta surtout) de dédupliquer eux-mêmes — le matching côté Meta
> n'en sera que meilleur.

## 7. Cohérence du dataLayer aujourd'hui — points d'attention

| Constat                                                                                    | Action requise                                                                                  |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `params` est un `Record<string, unknown>` à la racine — bien pour GTM (DLV pointable)       | **OK** — convention `DLV - params.<key>` claire                                                 |
| Les events GA4 e-commerce attendent `ecommerce.items[]` selon Enhanced Ecommerce           | **À vérifier** : si GA4 en mode tag standard, on déplace `params` en `ecommerce` au push      |
| `consent` est dans le DLV par event — Consent Mode v2 préfère que ce soit posé en `gtag('consent', ...)` au boot | À ajouter : un push `consent_default` au boot puis `consent_update` sur changement bandeau     |
| `event_id` est présent — bon pour Meta dédup                                                | **OK** — vérifier qu'on l'envoie bien au tag Meta (paramètre `event_id` du Pixel)               |
| Pas de `user_data` (email_sha256, phone_sha256) au niveau racine du DLV                     | À ajouter pour `purchase` / `generate_lead` (advanced matching côté Pixel)                       |
| `gtm.js` n'est pas encore chargé — l'adapter `gtm.ts` expose `clientSnippet()` mais pas câblé | **À faire** : injecter le snippet GTM dans `<head>` après vérif config provider `kind: 'gtm'`   |

## 8. Recommandations clés avant configuration GTM

1. **Pousser un `consent_default` au boot** avant le snippet GTM,
   pour que Consent Mode v2 démarre du bon pied.
2. **Pousser un `consent_update` à chaque changement** (bandeau).
3. **Réorganiser les events e-commerce** pour respecter la
   structure Enhanced Ecommerce GA4 :

   ```js
   window.dataLayer.push({
     event: 'add_to_cart',
     ecommerce: {
       currency: 'MAD',
       value: 320,
       items: [{ item_id: 'kit-001', item_name: 'Kit Rituel d\'Éclat', price: 320, quantity: 1 }],
     },
     event_id: '...',
   });
   ```

   GTM lira directement `ecommerce.items` sans mapper.
4. **Garder `params` pour les events non-ecommerce**, c'est le
   bon design.
5. **Ajouter `user_data` hashée** au DLV pour les conversions
   pures (`purchase`, `generate_lead`).

Ces 5 ajustements sont mineurs et préparent le terrain pour la
configuration GTM. Cf. [`02-architecture-gtm.md`](02-architecture-gtm.md).

## 9. Comparaison avec la cible

| Capacité                            | Aujourd'hui                | Cible V1                                              |
| ----------------------------------- | -------------------------- | ----------------------------------------------------- |
| DataLayer typé                      | ✓                          | ✓                                                     |
| 38 events catalogués                 | ✓                          | ✓                                                     |
| Consent Mode v2                     | partiel (DLV oui, gtag non) | ✓ avec `default denied` + update bandeau              |
| GA4 tag                              | ✗                          | 1 Configuration tag + 1 tag par event                 |
| Meta Pixel                          | ✗ (snippet pas posé)        | 1 init + tags par event + dédup CAPI                  |
| TikTok / Snap / Pinterest pixels     | ✗                          | 1 init + tags par event                                |
| Google Ads conversions              | ✗                          | 1 tag par conversion (purchase, lead, signup)         |
| Container versionné dans Git        | ✗                          | `container.json` source contrôlée                     |
| Generator depuis catalogue           | ✗                          | `pnpm tsx scripts/gtm-generate.ts`                    |
| GTM API push automatique             | ✗                          | `pnpm tsx scripts/gtm-push.ts`                        |
| Tests Playwright collecte            | partiel (`use-form-tracking.test.tsx`) | E2E sur 10 parcours clés                  |
| Lighthouse ≥ 90 avec GTM             | ✗ (pas mesuré avec GTM)     | ≥ 90                                                  |

## 10. Lecture suivante

- [02 — Architecture GTM](02-architecture-gtm.md) pour la
  structure cible.
- [03 — Variables](03-variables.md) pour les DLV et lookup
  tables.
