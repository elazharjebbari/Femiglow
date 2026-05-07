# 04 — Triggers GTM

> *Page View, Custom Event, exception triggers, blocking triggers*

---

## 1. Stratégie

| Type                          | Quantité     | Rôle                                                  |
| ----------------------------- | ------------ | ----------------------------------------------------- |
| Initialization triggers       | 1            | Consent default avant tout autre tag                  |
| Page View triggers            | 3            | All Pages, Public Pages only, Kit Page                |
| Custom Event triggers (1 par event applicable) | 38 | un par event du catalogue                            |
| Custom Event Group triggers    | 4            | Regex regroupé pour réduire la duplication            |
| Exception triggers (blocking) | 4            | Admin, Bot, No consent, Dev local                    |

## 2. Initialization triggers

### 2.1 `INIT — Consent Default`

```
Type     : Consent Initialization - All Pages
Fires on : Initialization Stage (avant gtm.js processing)
Block on : (aucun)
```

Utilisé **uniquement** par le tag `CMP Cfg — Default Denied`.

## 3. Page View triggers

### 3.1 `PV — All Pages`

```
Type     : Page View
Fires on : All Page Views
Block on : EX — Admin Pages, EX — Bot User-Agent
```

### 3.2 `PV — Public Pages`

```
Type     : Page View
Conditions : DLV - page.path does not match ^/admin
Block on   : EX — Bot User-Agent
```

### 3.3 `PV — Kit Page`

```
Type     : Page View
Conditions : DLV - page.path equals /kit
Block on   : EX — Bot User-Agent
```

(Utile pour Google Ads Remarketing audience « visite fiche kit ».)

## 4. Custom Event triggers (38)

Le DLV pousse `event: '<name>'` à chaque event. On crée un trigger
**Custom Event** par event applicable.

### 4.1 Pattern standard

```
Type        : Custom Event
Event name  : <name>
Conditions  : (aucune ou « JS - Is Bot returns false »)
Block on    : EX — Admin Pages, EX — Bot User-Agent
```

### 4.2 Liste exhaustive

```
CE — page_view
CE — scroll_depth
CE — click
CE — select_content
CE — share
CE — search
CE — view_search_results
CE — video_start
CE — video_progress
CE — video_complete
CE — video_user_play
CE — video_autoplay_view
CE — video_transcript_open
CE — file_download
CE — form_start
CE — form_submit
CE — form_field_focus
CE — form_field_blur
CE — form_validation_error
CE — form_abandon
CE — cta_impression
CE — view_item_list
CE — select_item
CE — view_item
CE — add_to_cart
CE — remove_from_cart
CE — view_cart
CE — begin_checkout
CE — add_shipping_info
CE — add_payment_info
CE — purchase
CE — refund                  (rare côté web — server only V1)
CE — view_promotion
CE — select_promotion
CE — generate_lead
CE — sign_up
CE — login
CE — contact_submit
CE — newsletter_submit
CE — mini_cart_open
CE — mini_cart_close
CE — fg_journal_read_75
CE — fg_journal_read_100
CE — fg_section_view
CE — fg_faq_view
CE — fg_composition_open
CE — fg_pixel_test
CE — fg_consent_change
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

(58 triggers Custom Event au total — 48 events historiques + 10
events chat. Le générateur les produit automatiquement à partir
d'`event-catalog.ts`. Cf. [13-events-chat.md](13-events-chat.md)
pour le détail des events chat et triggers conditionnels « 1re
occurrence par session ».)

## 5. Custom Event Group triggers

Pour réduire la duplication sur les tags qui doivent se déclencher
sur **plusieurs events similaires** :

### 5.1 `CE Group — All E-commerce`

```
Type       : Custom Event
Event name : matches RegExp ^(view_item_list|select_item|view_item|add_to_cart|remove_from_cart|view_cart|begin_checkout|add_shipping_info|add_payment_info|purchase|refund|view_promotion|select_promotion)$
```

### 5.2 `CE Group — All FemiGlow Custom`

```
Event name : matches RegExp ^fg_
```

### 5.3 `CE Group — All Forms`

```
Event name : matches RegExp ^form_
```

### 5.4 `CE Group — All Video`

```
Event name : matches RegExp ^video_
```

### 5.5 `CE Group — All Chat Events`

```
Event name : matches RegExp ^fg_chat_
```

> Permet aux dashboards GA4 et aux audiences Meta de capter
> l'ensemble du signal chat en une seule règle.

## 6. Exception triggers (blocking)

À utiliser dans le panneau **Exceptions** des tags.

### 6.1 `EX — Admin Pages`

```
Type           : Custom Event
Event name     : matches RegExp .*
Trigger fires when:
  - DLV - page.path matches RegExp ^/admin
```

> Tous les events qui partent depuis `/admin` sont bloqués.

### 6.2 `EX — Bot User-Agent`

```
Type           : Custom Event
Event name     : matches RegExp .*
Trigger fires when:
  - JS - Is Bot User-Agent equals true
```

### 6.3 `EX — Consent Denied (Analytics)`

```
Trigger fires when:
  - DLV - consent.analytics_storage equals denied
```

> Utilisé uniquement par les tags **non Consent-Mode-aware**
> (TikTok, Snap, Pinterest si on veut être strict). GA4 et
> Google Ads gèrent le consent nativement.

### 6.4 `EX — Consent Denied (Ad)`

```
Trigger fires when:
  - DLV - consent.ad_storage equals denied
```

> Utilisé par Meta, Google Ads pour l'envoi de signaux marketing.

### 6.5 `EX — Dev Local Pixel Skip`

```
Trigger fires when:
  - LUT - Environment equals dev
```

> Utile pour skipper les pixels en local.

## 7. Trigger groups

Des groupes pour les inits qui dépendent de **plusieurs**
conditions :

### 7.1 `Group — Init After Consent Granted`

Combine :

- `PV — All Pages`
- `CE — fg_consent_change` (sur transition vers granted)

Conditions :
- `JS - Has Analytics Consent` returns `true`

> Permet aux tags `Meta Init`, `TikTok Init`, etc. de partir
> dès qu'on a le consentement, même rétroactivement.

## 8. Tableau de routage tag → trigger

Un extrait — vue exhaustive dans `05-tags.md`.

| Tag                                | Trigger principal                         | Exceptions                                     |
| ---------------------------------- | ----------------------------------------- | ---------------------------------------------- |
| GA4 Cfg — Production                | PV — All Pages                            | EX — Admin, EX — Bot                            |
| GA4 Evt — purchase                 | CE — purchase                             | EX — Admin, EX — Bot                            |
| Meta Init                          | Group — Init After Consent Granted        | EX — Bot, EX — Consent Denied (Ad)              |
| Meta Evt — Purchase                | CE — purchase                             | EX — Admin, EX — Bot, EX — Consent Denied (Ad)  |
| TikTok Init                        | Group — Init After Consent Granted        | idem                                            |
| TikTok Evt — CompletePayment       | CE — purchase                             | idem                                            |
| Ads Conv — purchase                | CE — purchase                             | EX — Admin, EX — Bot                            |
| Ads RMK — global                   | PV — Public Pages                         | EX — Bot, EX — Consent Denied (Ad)              |
| CMP Cfg — Default Denied           | INIT — Consent Default                     | (aucun)                                         |
| CMP Cfg — Update From Banner       | CE — fg_consent_change                    | (aucun)                                         |

## 9. Triggers à éviter

| Anti-pattern                                | Pourquoi                                                       |
| ------------------------------------------- | -------------------------------------------------------------- |
| Click — All Elements                        | Pollue le datalayer ; on émet des events typés depuis le code   |
| Form Submission auto                        | Idem — on émet `form_submit` depuis le code                     |
| YouTube Video auto                          | On a notre propre player, on émet `video_*` typés                |
| Element Visibility auto                     | On a `IntersectionObserver` côté code, on émet `fg_section_view` |

> **Règle FemiGlow** : tout event part du **code** typé, pas
> d'un trigger automatique. GTM ne fait que **router**.

## 10. Lecture suivante

- [05 — Tags](05-tags.md)
- [06 — Consent Mode v2](06-consent-mode.md)
