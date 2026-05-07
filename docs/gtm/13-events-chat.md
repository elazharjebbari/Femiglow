# 13 — Events chat dans GTM

> *Intégration des events de l'assistant conversationnel
> (`docs/chat-assistant/`) dans la couche GTM.*

---

## 1. Vue d'ensemble

L'assistant conversationnel FemiGlow (`docs/chat-assistant/`)
émet **deux familles d'événements** :

| Famille                                         | Destination                              | Visibilité GTM |
| ----------------------------------------------- | ---------------------------------------- | -------------- |
| Events `chat_conversation_event` (BDD)           | Postgres `chat_conversation_event`        | non — server only |
| Events DataLayer `fg_chat_*`                     | `window.dataLayer` → GTM → providers     | OUI             |

Ce document décrit la couche **DLV → GTM** : 10 events publics
mappés en GTM avec triggers, tags, et une **custom dimension
d'attribution** sur `purchase`.

> Référence amont :
> - `docs/chat-assistant/02-data.md §2.8` (table `chat_conversation_event`)
> - `docs/chat-assistant/annexes/payloads-exemples.md §14` (payloads dataLayer)

## 2. Catalogue des 10 events chat (DLV)

À ajouter dans `apps/web/src/lib/tracking/event-catalog.ts`.
Tous portent le préfixe `fg_chat_*` pour cohérence avec le
préfixe FemiGlow custom existant (`fg_*`).

| Event                            | Catégorie  | Conv | Scope | Providers cibles                | Description                                                  |
| -------------------------------- | ---------- | ---- | ----- | ------------------------------- | ------------------------------------------------------------ |
| `fg_chat_widget_open`            | engagement | non  | web   | google_ga4, meta (1re ouv./session) | Visiteur ouvre le widget                                  |
| `fg_chat_widget_close`           | engagement | non  | web   | google_ga4                      | Visiteur ferme le widget                                     |
| `fg_chat_message_sent`           | engagement | non  | web   | google_ga4, meta (1er msg user) | Message envoyé (role: user) ou reçu (role: assistant)        |
| `fg_chat_suggestion_clicked`     | engagement | non  | web   | google_ga4                      | Clic sur une suggestion contextuelle                         |
| `fg_chat_feedback`               | engagement | non  | web   | google_ga4                      | Pouce vert/rouge sur une réponse agent                       |
| `fg_chat_language_switch`        | engagement | non  | web   | google_ga4                      | Changement de langue (FR / AR / Darija)                     |
| `fg_chat_error`                  | engagement | non  | web   | google_ga4                      | Erreur visible (provider down, timeout, modération)          |
| `fg_chat_rate_limit_hit`         | engagement | non  | web   | google_ga4                      | Visiteur dépasse le rate-limit                               |
| `fg_chat_lead_email_captured`    | lead       | OUI  | both  | google_ga4, meta, google_ads    | Capture d'email opt-in (reprise par email)                   |
| `fg_chat_conversion_attributed`  | custom     | non  | both  | google_ga4                      | Signal d'attribution chat → commande (signal d'audience)     |

> **Note** : `fg_chat_lead_email_captured` est aussi émis comme
> `generate_lead` standard (avec `method = 'chat_email'`) pour
> bénéficier du mapping conversions tous-providers existant. C'est
> la convention « chat_event = signal métier interne ;
> `generate_lead` = conversion business standard ».

## 3. Schémas Zod

À ajouter dans `apps/web/src/lib/tracking/schemas.ts` :

```ts
export const fgChatWidgetOpenSchema = z.object({
  page_path: z.string(),
  language: z.enum(['fr', 'ar', 'ar-MA']),
  chat_session_id: z.string().min(1).max(40),
  trigger_source: z.enum(['user_click', 'auto_greeting', 'restored']).optional(),
});

export const fgChatMessageSentSchema = z.object({
  chat_session_id: z.string(),
  message_id: z.string(),
  role: z.enum(['user', 'assistant']),
  language: z.enum(['fr', 'ar', 'ar-MA']),
  message_index: z.number().int().nonnegative(),  // ordinal dans la conv
  first_token_ms: z.number().int().optional(),     // pour role=assistant
  has_rag_sources: z.boolean().optional(),
});

export const fgChatSuggestionClickedSchema = z.object({
  chat_session_id: z.string(),
  suggestion_label: z.string().max(120),
  suggestion_index: z.number().int().min(0).max(2),
});

export const fgChatFeedbackSchema = z.object({
  chat_session_id: z.string(),
  message_id: z.string(),
  value: z.union([z.literal(1), z.literal(-1)]),
  has_note: z.boolean().optional(),
});

export const fgChatLanguageSwitchSchema = z.object({
  chat_session_id: z.string(),
  from_language: z.enum(['fr', 'ar', 'ar-MA']),
  to_language: z.enum(['fr', 'ar', 'ar-MA']),
  trigger: z.enum(['auto_detect', 'user_request']),
});

export const fgChatErrorSchema = z.object({
  chat_session_id: z.string(),
  error_code: z.enum([
    'rate_limited', 'moderation_blocked_input', 'moderation_blocked_output',
    'provider_unavailable', 'quota_exceeded', 'timeout', 'internal',
  ]),
  message_id: z.string().optional(),
});

export const fgChatRateLimitHitSchema = z.object({
  chat_session_id: z.string(),
  scope: z.enum(['ip', 'session', 'visitor']),
  retry_after_seconds: z.number().int().nonnegative(),
});

export const fgChatLeadEmailCapturedSchema = z.object({
  chat_session_id: z.string(),
  email_sha256: z.string().regex(/^[a-f0-9]{64}$/),  // hashé côté serveur
  consent_marketing: z.boolean(),
});

export const fgChatConversionAttributedSchema = z.object({
  chat_session_id: z.string(),
  order_id: z.string(),
  attribution_window_days: z.number().int().min(1).max(30),
  messages_in_session: z.number().int().nonnegative(),
  intent_dominant: z.string().optional(),
});
```

## 4. Variables DLV à créer côté GTM

À ajouter dans `03-variables.md §4` (DataLayer Variables) :

```
DLV - chat.session_id           → params.chat_session_id  (ou racine si pousse à plat)
DLV - chat.message_id           → params.message_id
DLV - chat.role                 → params.role
DLV - chat.language             → params.language
DLV - chat.message_index        → params.message_index
DLV - chat.first_token_ms       → params.first_token_ms
DLV - chat.has_rag_sources      → params.has_rag_sources
DLV - chat.suggestion_label     → params.suggestion_label
DLV - chat.suggestion_index     → params.suggestion_index
DLV - chat.feedback_value       → params.value
DLV - chat.from_language        → params.from_language
DLV - chat.to_language          → params.to_language
DLV - chat.error_code           → params.error_code
DLV - chat.scope                → params.scope
DLV - chat.retry_after_seconds  → params.retry_after_seconds
DLV - chat.attribution_window   → params.attribution_window_days
DLV - chat.messages_in_session  → params.messages_in_session
DLV - chat.intent_dominant      → params.intent_dominant
DLV - chat.trigger_source       → params.trigger_source
DLV - chat.consent_marketing    → params.consent_marketing
```

## 5. Triggers Custom Event

À ajouter dans `04-triggers.md §4.2` :

```
CE — fg_chat_widget_open
CE — fg_chat_widget_close
CE — fg_chat_message_sent
CE — fg_chat_suggestion_clicked
CE — fg_chat_feedback
CE — fg_chat_language_switch
CE — fg_chat_error
CE — fg_chat_rate_limit_hit
CE — fg_chat_lead_email_captured
CE — fg_chat_conversion_attributed
```

### 5.1 Trigger Group dédié

```
CE Group — All Chat Events
  Type       : Custom Event
  Event name : matches RegExp ^fg_chat_
```

Permet aux dashboards GA4 et aux audiences Meta de capter
l'ensemble du signal chat en une seule règle.

### 5.2 Triggers conditionnels (1re occurrence)

Pour mapper vers Meta uniquement les **signaux forts** (1re
ouverture par session, 1er message user), créer deux triggers
conditionnels :

```
CE — fg_chat_widget_open (first per session)
  Type       : Custom Event
  Event name : equals fg_chat_widget_open
  Condition  : DLV - chat.message_index equals 0
              OR JS - Is First Widget Open returns true

CE — fg_chat_message_sent (first user msg)
  Type       : Custom Event
  Event name : equals fg_chat_message_sent
  Condition  : DLV - chat.role equals user
              AND DLV - chat.message_index equals 0
```

### 5.3 Custom JS — `JS - Is First Widget Open`

```javascript
function() {
  try {
    var key = 'fg_chat_first_open_' + (new Date()).toDateString();
    if (sessionStorage.getItem(key)) return false;
    sessionStorage.setItem(key, '1');
    return true;
  } catch (e) {
    return false;
  }
}
```

> Idem pour `JS - Is First Message`.

## 6. Tags GA4

À ajouter dans `05-tags.md §3.2` (1 tag par event chat) :

| Tag                                            | Trigger                              | Event Name (GA4)                     |
| ---------------------------------------------- | ------------------------------------ | ------------------------------------ |
| `GA4 Evt — fg_chat_widget_open`                | CE — fg_chat_widget_open             | `fg_chat_widget_open`                |
| `GA4 Evt — fg_chat_widget_close`               | CE — fg_chat_widget_close            | `fg_chat_widget_close`               |
| `GA4 Evt — fg_chat_message_sent`               | CE — fg_chat_message_sent            | `fg_chat_message_sent`               |
| `GA4 Evt — fg_chat_suggestion_clicked`         | CE — fg_chat_suggestion_clicked      | `fg_chat_suggestion_clicked`         |
| `GA4 Evt — fg_chat_feedback`                   | CE — fg_chat_feedback                | `fg_chat_feedback`                   |
| `GA4 Evt — fg_chat_language_switch`            | CE — fg_chat_language_switch         | `fg_chat_language_switch`            |
| `GA4 Evt — fg_chat_error`                      | CE — fg_chat_error                   | `fg_chat_error`                      |
| `GA4 Evt — fg_chat_rate_limit_hit`             | CE — fg_chat_rate_limit_hit          | `fg_chat_rate_limit_hit`             |
| `GA4 Evt — fg_chat_lead_email_captured`        | CE — fg_chat_lead_email_captured     | `fg_chat_lead_email_captured`        |
| `GA4 Evt — fg_chat_conversion_attributed`      | CE — fg_chat_conversion_attributed   | `fg_chat_conversion_attributed`      |

### 6.1 Pattern de paramètres GA4

Pour chaque tag GA4, transmettre les params spécifiques :

```
GA4 Evt — fg_chat_message_sent :
  - chat_session_id  : {{DLV - chat.session_id}}
  - role             : {{DLV - chat.role}}
  - language         : {{DLV - chat.language}}
  - message_index    : {{DLV - chat.message_index}}
  - first_token_ms   : {{DLV - chat.first_token_ms}}
  - has_rag_sources  : {{DLV - chat.has_rag_sources}}
  - event_id         : {{DLV - event_id}}
```

## 7. Tags Meta — signaux forts

Mapping vers Meta **limité à 2 events** (signaux d'engagement
fort, pas le bruit conversationnel) :

### 7.1 `Meta Evt — Chat Engagement` (sur 1re ouverture)

```
Type : Custom HTML
Code :
<script>
fbq('trackCustom', 'ChatEngagement', {
  page_path: {{DLV - page.path}},
  language: {{DLV - chat.language}},
  chat_session_id: {{DLV - chat.session_id}}
}, { eventID: {{DLV - event_id}} });
</script>

Trigger : CE — fg_chat_widget_open (first per session)
Setup tag : Meta Init
Exceptions : EX — Admin, EX — Bot, EX — Consent Denied (Ad)
```

### 7.2 `Meta Evt — Chat Contact` (sur 1er message user)

```
fbq('track', 'Contact', {
  content_name: 'chat_first_message',
  language: {{DLV - chat.language}}
}, { eventID: {{DLV - event_id}} });
```

> `Contact` est un event standard Meta — bon signal d'intention
> d'achat pour les audiences Lookalike.

### 7.3 `Meta Evt — Lead` (sur lead email)

`fg_chat_lead_email_captured` déclenche aussi le tag `Meta Evt — Lead`
existant (via `generate_lead` standard avec `method='chat_email'`).
Pas de tag séparé.

## 8. Custom dimensions GA4

À ajouter dans `gtm-spec.yaml` puis dans GA4 → Admin → Custom
definitions :

```yaml
custom_dimensions:
  # ... existantes ...
  - { name: chat_session_id,    scope: event, source: 'DLV - chat.session_id' }
  - { name: chat_language,      scope: event, source: 'DLV - chat.language' }
  - { name: chat_attributed,    scope: event, source: 'JS - Chat Attributed' }
  - { name: chat_intent,        scope: event, source: 'DLV - chat.intent_dominant' }
```

### 8.1 `JS - Chat Attributed`

Custom JS qui retourne `true` si l'utilisateur a interagi avec
le chat dans la fenêtre d'attribution :

```javascript
function() {
  try {
    var raw = localStorage.getItem('fg.chat.v1');
    if (!raw) return false;
    var parsed = JSON.parse(raw);
    return !!(parsed && parsed.state && parsed.state.sessionId);
  } catch (e) {
    return false;
  }
}
```

> Cette dimension permet de **segmenter les `purchase` GA4** par
> « ayant chatté » vs « n'ayant pas chatté », sans event séparé.

## 9. Attribution chat → purchase

Trois mécanismes complémentaires :

### 9.1 Custom dimension `chat_attributed` (GA4)

Présente sur **tous** les events GA4. La cliente lit ses
analyses GA4 par segment.

### 9.2 Event `fg_chat_conversion_attributed` (GA4 + signal interne)

Émis par le code une fois la commande validée, avec le détail :

```js
trackEmit('fg_chat_conversion_attributed', {
  chat_session_id: 'cs_xxxx',
  order_id: 'ORD-2026-12345',
  attribution_window_days: 14,
  messages_in_session: 6,
  intent_dominant: 'product_question',
});
```

Permet à GA4 / BigQuery export de calculer un funnel chat →
conversion sans jointure.

### 9.3 Mapping serveur (BDD)

Côté server : `chat_session.converted_order_id = orderId`. Pour
les analyses fines admin (cf. `docs/chat-assistant/02-data.md`).

## 10. Audiences GA4 / Meta cibles

Recommandées une fois les events en place (Phase 2 acquisition) :

| Audience                                | Définition                                                                  | Plateforme cible      |
| --------------------------------------- | --------------------------------------------------------------------------- | --------------------- |
| Chat-engaged                            | A déclenché `fg_chat_message_sent` au moins 1 fois (28 j)                  | Meta, GA4              |
| Chat-darija                              | `chat.language = ar-MA`                                                     | Meta (audience locale)|
| Chat-interested-but-not-converted        | A chatté ≥ 3 messages, pas de `purchase` 14 j                              | Meta (remarketing)     |
| Chat-converted                           | `fg_chat_conversion_attributed` reçu                                        | Lookalike Meta         |
| Chat-objection-pricing                   | `chat.intent_dominant = objection_pricing`                                  | Remarketing soft       |

## 11. Impact sur le générateur

Le `gtm-generate.ts` lit `event-catalog.ts`. Une fois les 10 events
chat ajoutés, **le générateur produit automatiquement** :

- 10 nouveaux triggers `CE — fg_chat_*`
- 10 nouveaux tags GA4 Evt
- 1 nouveau Trigger Group `CE Group — All Chat Events` (à
  hardcoder dans `gtm-generate.ts`)
- 2 triggers conditionnels (1re ouv. / 1er msg) — à
  hardcoder
- 2 tags Meta — à hardcoder dans la liste `extra_tags` du
  `gtm-spec.yaml` ou directement dans le générateur

> **Pas de modification structurelle du générateur** — l'ajout
> est purement déclaratif via `event-catalog.ts` + entrées dans
> `gtm-spec.yaml`.

## 12. Tests E2E spécifiques chat

À ajouter dans `apps/web/e2e/tracking-gtm.spec.ts` (cf. doc 11) :

| Scénario                                                         | Attendu                                                          |
| ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| Visiteur ouvre le widget                                         | `fg_chat_widget_open` dans DLV                                   |
| Visiteur tape un message                                         | `fg_chat_message_sent` (role=user) dans DLV                      |
| Réponse agent                                                    | `fg_chat_message_sent` (role=assistant) avec `first_token_ms`     |
| Clic sur suggestion                                              | `fg_chat_suggestion_clicked`                                     |
| Pouce vert sur réponse                                           | `fg_chat_feedback` (value=1)                                     |
| Saisie en darija                                                  | `fg_chat_language_switch` (to=ar-MA) puis Meta Contact évent.    |
| 31 messages en 1 minute                                          | `fg_chat_rate_limit_hit`                                         |
| Visiteur quitte la conv puis purchase < 30 j                     | `fg_chat_conversion_attributed` au moment du purchase            |
| Visiteur capture son email pour reprise                          | `fg_chat_lead_email_captured` + `generate_lead` standard         |
| Custom dim `chat_attributed = true` sur le `purchase` post-chat   | Vérifié dans GA4 DebugView                                       |

## 13. Plan d'implémentation — tickets `GTM-CHAT-XXX`

Phase additionnelle dans le plan d'action GTM
(cf. `10-automatisation.md §11`).

### Phase 6 — Events chat (~ 12 tickets, 2 jours)

| ID            | Tâche                                                                             |
| ------------- | --------------------------------------------------------------------------------- |
| GTM-CHAT-001  | Ajouter les 10 events `fg_chat_*` dans `event-catalog.ts`                          |
| GTM-CHAT-002  | Ajouter les schémas Zod dans `schemas.ts`                                          |
| GTM-CHAT-003  | Étendre `event-mapping.ts` pour `fg_chat_widget_open`, `_message_sent`, `_lead_email_captured` (Meta) |
| GTM-CHAT-004  | Ajouter custom dimensions `chat_*` dans `gtm-spec.yaml`                            |
| GTM-CHAT-005  | Ajouter tag custom `Meta Evt — Chat Engagement` dans `extra_tags`                  |
| GTM-CHAT-006  | Ajouter tag custom `Meta Evt — Chat Contact` dans `extra_tags`                     |
| GTM-CHAT-007  | Ajouter trigger conditionnel `first per session` (Custom JS)                       |
| GTM-CHAT-008  | Ajouter Variable JS `Chat Attributed`                                              |
| GTM-CHAT-009  | Regénérer container.json + diff                                                    |
| GTM-CHAT-010  | Tests Playwright (10 scénarios chat)                                               |
| GTM-CHAT-011  | Configurer custom dimensions côté GA4 UI                                           |
| GTM-CHAT-012  | Audit consent : aucun event chat ne doit fuir si `analytics_storage = denied`     |

> Phase à insérer **après** Phase 3 du plan principal et **avant**
> Phase 4 (Pusher API) — les events chat sont des données, pas
> des changements d'infra.

## 14. Lecture suivante

- [01 — Audit de l'existant](01-audit-existant.md) — § 3.7 mis à
  jour avec les events chat.
- [05 — Tags](05-tags.md) — récap mis à jour (~ 100 tags désormais).
- [10 — Automatisation](10-automatisation.md) — Phase 5 bis ajoutée.
- [14 — Export depuis l'admin](14-admin-export.md) — visualiser
  et télécharger le container intégrant ces events.
- [annexes/mapping-conversions.csv](annexes/mapping-conversions.csv)
  — 10 lignes ajoutées.
- `docs/chat-assistant/02-data.md` — table source.
- `docs/chat-assistant/annexes/payloads-exemples.md §14` — payloads.
