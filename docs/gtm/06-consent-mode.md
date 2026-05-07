# 06 — Consent Mode v2

> *Default consent, granted/denied, Meta LDU, TikTok LDU, Pinterest*

---

## 1. Pourquoi Consent Mode v2

Depuis mars 2024, Google **exige** Consent Mode v2 pour les
campagnes Ads servies à des audiences EU/EEA. Le module gère :

- **`ad_storage`** — stockage de cookies marketing
- **`analytics_storage`** — stockage analytics
- **`ad_user_data`** — partage des données user pour Ads
- **`ad_personalization`** — personnalisation publicitaire
- **`functionality_storage`**, **`personalization_storage`**,
  **`security_storage`** — secondaires (V2 demande tous les 7)

Le but : permettre aux pixels Google (GA4, Ads, Floodlight) de
**continuer à modeler** le trafic même quand l'utilisateur a refusé
les cookies, via des **pings sans cookie** (consent signals).

Pour Meta, TikTok, Snap, Pinterest, Google Consent Mode n'est
pas natif — il faut compléter par :

- Meta : **Limited Data Use (LDU)** — 6e argument du `fbq` ;
- TikTok : **Limited Data Use (LDU)** — paramètre `limited_data_use` ;
- Pinterest : ignorer si `ad_storage = denied`.

## 2. Architecture du flux de consentement

```
┌─────────────────────┐
│ Page boot           │
│ (avant GTM script)  │
│                     │
│ window.dataLayer    │
│   .push({           │
│     'gtag.consent', │
│     ...defaults     │
│   });               │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ GTM script charge   │
│ INIT trigger fires  │
│ → CMP Cfg — Default │
│   Denied (priority  │
│   100)              │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Bandeau s'affiche   │
│ Si user clique      │
│ "Accepter"          │
│                     │
│ window.dataLayer    │
│   .push({           │
│     event:          │
│     'fg_consent_    │
│     change',        │
│     consent: {...}  │
│   });               │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ CE — fg_consent_    │
│ change fires        │
│ → CMP Cfg — Update  │
│   From Banner       │
│ → Group — Init After│
│   Consent Granted   │
│   (Meta, TikTok…)   │
└─────────────────────┘
```

## 3. Pré-snippet avant GTM (à ajouter dans `<head>`)

**Ce code doit s'exécuter AVANT le snippet GTM** :

```html
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }

  // Defaults — denied par défaut, conformes RGPD
  gtag('consent', 'default', {
    ad_storage: 'denied',
    analytics_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    functionality_storage: 'denied',
    personalization_storage: 'denied',
    security_storage: 'granted',
    wait_for_update: 500
  });

  // Marker pour debug
  window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
</script>

<!-- snippet GTM ici -->
```

> **Côté FemiGlow** : à intégrer dans
> `apps/web/src/app/layout.tsx` (ou `app/(public)/layout.tsx`) en
> tant que `<Script strategy="beforeInteractive">`.

## 4. Tag GTM `CMP Cfg — Default Denied`

Si on préfère piloter le default depuis GTM (alternative au
pré-snippet) :

```
Name        : CMP Cfg — Default Denied
Type        : Consent Mode (Google Tags) → Default
Settings :
  ad_storage              : Denied
  analytics_storage       : Denied
  ad_user_data            : Denied
  ad_personalization      : Denied
  functionality_storage   : Denied
  personalization_storage : Denied
  security_storage        : Granted
  wait_for_update         : 500

Trigger : INIT — Consent Default
Tag firing priority : 100
```

> Le tag template officiel **Consent Mode (Google Tags)** est
> apparu en 2024 ; il évite le Custom HTML.

## 5. Tag GTM `CMP Cfg — Update From Banner`

```
Name        : CMP Cfg — Update From Banner
Type        : Consent Mode (Google Tags) → Update
Settings :
  ad_storage              : {{DLV - consent.ad_storage}}
  analytics_storage       : {{DLV - consent.analytics_storage}}
  ad_user_data            : {{DLV - consent.ad_user_data}}
  ad_personalization      : {{DLV - consent.ad_personalization}}

Trigger : CE — fg_consent_change
Tag firing priority : 90
```

> Cette mise à jour est lue par GA4, Google Ads, Floodlight
> automatiquement (pas besoin de redéclencher leurs tags).

## 6. Côté code — émettre `fg_consent_change`

Dans le handler du bandeau de consentement :

```ts
// apps/web/src/lib/tracking/consent.ts (à étendre)
import { trackEmit } from './client';

export function applyConsent(state: ConsentState) {
  // 1. Sauvegarder le state localement
  saveConsentLocal(state);

  // 2. Pousser au datalayer (lu par GTM)
  trackEmit('fg_consent_change', {
    ad_storage: state.ad ? 'granted' : 'denied',
    analytics_storage: state.analytics ? 'granted' : 'denied',
    ad_user_data: state.ad ? 'granted' : 'denied',
    ad_personalization: state.ad ? 'granted' : 'denied',
    source: 'banner',
  });

  // 3. Pousser un gtag('consent', 'update', ...) explicite
  // (sécurité au cas où le tag GTM CMP Update ne serait pas câblé)
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('consent', 'update', {
      ad_storage: state.ad ? 'granted' : 'denied',
      analytics_storage: state.analytics ? 'granted' : 'denied',
      ad_user_data: state.ad ? 'granted' : 'denied',
      ad_personalization: state.ad ? 'granted' : 'denied',
    });
  }
}
```

## 7. Meta Limited Data Use (LDU)

Le Pixel Meta accepte un 6e argument pour LDU :

```js
fbq('dataProcessingOptions', ['LDU'], 0, 0);
```

Ou par event :

```js
fbq('track', 'Purchase', payload, { eventID: '...', dataProcessingOptions: ['LDU'] });
```

### 7.1 Tag GTM `Aux JS — Meta LDU on Denied`

```
Type : Custom HTML
Code :
<script>
if ({{DLV - consent.ad_storage}} !== 'granted') {
  if (window.fbq) {
    fbq('dataProcessingOptions', ['LDU'], 0, 0);
  }
}
</script>

Trigger : Group — Init After Consent Granted (et CE — fg_consent_change)
```

> En LDU, Meta ne traite pas les events à des fins de
> personnalisation publicitaire. C'est le mode RGPD-friendly.

## 8. TikTok Limited Data Use

```js
ttq.setLimitedDataUse({ limited_data_use: true });
```

Tag GTM analogue, déclenché si `ad_storage = denied`.

## 9. Pinterest

Pinterest n'a pas de LDU. La règle est : **ne pas charger le tag
si `ad_storage = denied`**.

```
Trigger    : Group — Init After Consent Granted
Exception  : EX — Consent Denied (Ad)
```

> En clair : Pinterest ne charge **pas du tout** sans consent
> ad. C'est l'approche la plus prudente.

## 10. Snap

Idem Pinterest : pas de LDU officiel, on ne charge pas sans consent.

## 11. Tableau récapitulatif

| Provider     | Sans consent (`denied`)                                         | Avec consent (`granted`)                |
| ------------ | --------------------------------------------------------------- | --------------------------------------- |
| GA4 (analytics) | Pings cookieless via Consent Mode v2 (modélisation)            | Tracking complet                        |
| Google Ads (ad) | Pings cookieless si `analytics_storage` granted                 | Conversions + remarketing complets      |
| Meta         | Pixel chargé en LDU (6e arg) — events traités sans personnalisation | Tracking + custom audiences        |
| TikTok       | `setLimitedDataUse(true)` — events traités sans personnalisation | Tracking complet                       |
| Snap         | Tag **non chargé**                                              | Tag chargé + events                     |
| Pinterest    | Tag **non chargé**                                              | Tag chargé + events                     |

## 12. Tests Consent Mode

### 12.1 Côté navigateur

1. Ouvrir la console.
2. Charger la page sans cookie de consent.
3. Vérifier `window.dataLayer` contient le push `consent default denied`.
4. Vérifier que `gtag.consent: default` figure dans GTM Preview.
5. Cliquer « Accepter » au bandeau.
6. Vérifier `gtag.consent: update` ; les tags Meta, TikTok, Snap, Pinterest
   doivent maintenant être en train de fire.

### 12.2 Tag Assistant + Consent Mode Debug

`tagassistant.google.com` propose un onglet **Consent** qui montre
les states `default` et `update` au cours du temps.

### 12.3 GA4 DebugView

Avec `?gtm_debug=x&debug_mode=true`, GA4 DebugView montre les
events reçus en mode consenti / non-consenti (paramètre
`consent_state`).

## 13. Audit RGPD (à signer)

| Question                                                                  | Réponse FemiGlow                                                   |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Le bandeau s'affiche-t-il sur la première visite ?                         | Oui, avant tout pixel (sauf Consent Mode pings)                     |
| Les pixels marketing chargent-ils sans consent ?                           | Non, Meta en LDU, Snap/Pinterest non chargés                        |
| Le visiteur peut-il refuser sans friction ?                                | Oui, deux boutons équivalents (Accepter / Refuser)                  |
| Le visiteur peut-il revenir sur son choix ?                                | Oui, lien dans le footer "Cookies"                                  |
| Les données envoyées (purchase, lead) sont-elles hashées ?                 | Oui (cf. `tracking/providers/hashing.ts`)                           |
| Les données sont-elles transférées hors UE ?                               | Oui (Meta, TikTok). Justifié par DPA (Data Processing Agreement)    |
| Un audit log existe-t-il ?                                                 | Oui (`tracking_consent` table)                                      |
| La durée de conservation est-elle définie ?                                | 14 mois (alignée GA4) — cf. `tracking/02-data.md`                  |

## 14. Lecture suivante

- [07 — Conversions & mapping](07-conversions-mapping.md)
- [11 — Tests & debug](11-tests-debug.md)
