# Conventions de nommage

## 1. Events canoniques FemiGlow

**Snake case, présent, verbe d'action.**

✓ `lead_form_submit`, `add_to_cart`, `purchase`, `chat_open`
✗ `LeadFormSubmit`, `addToCart`, `Purchased`, `chatOpened`

## 2. Mapping vers GA4

GA4 a une [liste d'events recommandés](https://developers.google.com/analytics/devguides/collection/ga4/reference/events). Quand un event FemiGlow correspond à un event GA4 recommandé, on utilise le nom GA4 :

| FemiGlow | GA4 mapped | isCustom |
|---|---|---|
| `lead_form_submit` | `generate_lead` | false |
| `add_to_cart` | `add_to_cart` | false |
| `purchase` | `purchase` | false |
| `chat_open` | `chat_open` | **true** (event custom) |
| `wizard_step_complete` | `wizard_step_complete` | **true** |

Pour les events custom, on garde le nom snake_case FemiGlow.

## 3. Mapping vers Meta

Meta a une [liste d'events standard](https://developers.facebook.com/docs/meta-pixel/reference#standard-events) : `ViewContent`, `AddToCart`, `Purchase`, `Lead`, etc.

**PascalCase pour standard events.**

| FemiGlow | Meta mapped | isStandard |
|---|---|---|
| `lead_form_submit` | `Lead` | true |
| `add_to_cart` | `AddToCart` | true |
| `purchase` | `Purchase` | true |
| `chat_open` | `ChatOpen` | **false** (custom event) |

Pour custom events, FemiGlow utilise `fbq('trackCustom', 'ChatOpen', ...)` (PascalCase aussi).

## 4. Mapping vers Google Ads

Google Ads identifie une conversion par `label`. Le label est défini DANS Google Ads UI, pas par FemiGlow.

**Format suggéré :** `<event-short-name>-<currency>` ou `<event-short-name>-<segment>`.

| FemiGlow | Ads label | type |
|---|---|---|
| `lead_form_submit` | `lead-form-MAD` | lead |
| `purchase` | `purchase-MAD` | purchase |
| `add_to_cart` | (pas une conversion → null) | — |

## 5. Paramètres / payload

**Snake case, descriptif court.**

✓ `transaction_id`, `currency`, `value`, `items`, `customer_email_hash`
✗ `txID`, `c`, `v`, `prods`, `email`

**Standard params GA4 :** suivre [la liste officielle](https://developers.google.com/analytics/devguides/collection/ga4/reference/events) (`value`, `currency`, `items`, `transaction_id`, etc.).

**Custom params :** préfixer `fg_` pour éviter collision (`fg_form_mode`, `fg_variant_key`).

## 6. PII et hashing

**Jamais d'email/téléphone en clair dans le payload event.**

| Champ original | Champ payload |
|---|---|
| `email` | `customer_email_hash` (SHA-256 lowercased) |
| `phone` | `customer_phone_hash` (SHA-256 E.164 lowercased) |
| `first_name` | `customer_fn_hash` |
| `last_name` | `customer_ln_hash` |

Le hashing est fait côté server avant envoi à Meta CAPI / GA4 MP.

Côté client (gtag → GTM), on ne pousse PAS de PII (pas même hashé) pour respecter la politique GA4.

## 7. Versionning de schéma

Si un event change ses params requis (ex: `purchase` requiert dorénavant `shipping_country`), bump `plan.meta.schemaVersion` minor (1.0.0 → 1.1.0). Si un event change de nom canonique : bump major.

## 8. Deprecation

Pour retirer un event :
1. Marquer `events[name].enabled = false` dans le plan (le tag n'est plus exporté).
2. Garder l'entrée pendant 30 jours en `enabled: false` (au cas où rollback).
3. Supprimer l'entrée du plan après 30 jours.

Pas de breaking change : un client qui appelle `trackEvent('old_event')` n'a pas d'effet si l'event est désactivé (warning log côté server uniquement).
