# 02 — Architecture GTM

> *Conteneurs, workspaces, folders, environnements, naming*

---

## 1. Vue d'ensemble

```
Compte GTM "FemiGlow"                       (gtm.account: AAAAAAA)
└── Container "Web" GTM-FEMIGLOW             (gtm.container: GTM-XXXXXXX)
    ├── Workspaces
    │   ├── Default Workspace (production active)
    │   ├── feature/<branche>  (un par PR significative)
    │   └── hotfix/<incident>
    ├── Environments
    │   ├── Live (prod)             auth: ENV-1
    │   ├── Stage                   auth: ENV-2
    │   ├── Preview                 auth: ENV-3
    │   └── Dev / Local             auth: ENV-4
    ├── Folders (dossiers)
    │   ├── 00 — Configuration
    │   ├── 01 — Page & Engagement
    │   ├── 02 — E-commerce
    │   ├── 03 — Lead & Form
    │   ├── 04 — Conversions
    │   ├── 05 — FemiGlow custom
    │   ├── 06 — Consent Mode
    │   ├── 07 — Helpers (Custom JS, lookup)
    │   └── 99 — Test / sandbox
    ├── Variables
    │   ├── Built-in (Page URL, Click Element, etc.)
    │   ├── User-Defined (DLV, Constants, Lookup, JS, RegEx)
    ├── Triggers
    │   ├── Page View / DOM Ready / Window Loaded
    │   ├── Custom Event (1 par event du catalogue ou par groupe)
    │   ├── Click triggers (rares — préférer DLV)
    │   └── Trigger groups
    └── Tags
        ├── 1 GA4 Configuration
        ├── 1 GA4 Event par event applicable
        ├── 1 Meta init + N events
        ├── 1 TikTok init + N events
        ├── 1 Snap init + N events
        ├── 1 Pinterest init + N events
        ├── N Google Ads Conversion + 1 Remarketing
        └── 1 Consent Default + 1 Consent Update
```

> En **Phase 2**, on ajoute un **container Server-side**
> `GTM-SERVER` (cloud sGTM ou Stape) qui réceptionne les events
> via Measurement Protocol et les redistribue (Meta CAPI, TikTok
> Events API, etc.) — cf. `08-server-side-gtm.md`.

## 2. Conventions de nommage

### 2.1 Tags

```
<type abrégé> — <nom de l'event ou de l'objet> — <variant facultatif>
```

| Préfixe       | Type de tag                      | Exemple                                                          |
| ------------- | -------------------------------- | ---------------------------------------------------------------- |
| `GA4 Cfg`     | GA4 Configuration                 | `GA4 Cfg — Production`                                           |
| `GA4 Evt`     | GA4 Event                         | `GA4 Evt — purchase`, `GA4 Evt — fg_journal_read_75`             |
| `Meta Init`   | Meta Pixel Init                   | `Meta Init — production`                                         |
| `Meta Evt`    | Meta Pixel Event                  | `Meta Evt — Purchase`, `Meta Evt — InitiateCheckout`             |
| `TikTok Init` | TikTok Pixel Init                 | `TikTok Init — production`                                       |
| `TikTok Evt`  | TikTok Pixel Event                | `TikTok Evt — CompletePayment`                                   |
| `Snap Init`   | Snap Pixel Init                   | `Snap Init — production`                                         |
| `Snap Evt`    | Snap Pixel Event                  | `Snap Evt — PURCHASE`                                            |
| `Pin Init`    | Pinterest Tag Init                | `Pin Init — production`                                          |
| `Pin Evt`     | Pinterest Tag Event               | `Pin Evt — checkout`                                             |
| `Ads Conv`    | Google Ads Conversion             | `Ads Conv — purchase`, `Ads Conv — generate_lead`               |
| `Ads RMK`     | Google Ads Remarketing            | `Ads RMK — global`                                               |
| `CMP Cfg`     | Consent (Default / Update)         | `CMP Cfg — Default Denied`, `CMP Cfg — Update From Banner`      |
| `Aux JS`      | Custom HTML / JS auxiliaire       | `Aux JS — Hash Email Helper`                                     |

### 2.2 Triggers

```
<type> — <event ou condition>
```

| Préfixe         | Type de trigger                                   | Exemple                                          |
| --------------- | ------------------------------------------------- | ------------------------------------------------ |
| `PV`            | Page View                                          | `PV — All Pages`, `PV — Kit Page`               |
| `CE`            | Custom Event                                       | `CE — purchase`, `CE — fg_section_view`         |
| `CE Group`      | Custom Event regroupé (regex)                     | `CE Group — All E-commerce`, `CE Group — fg_*`  |
| `EX`            | Exception (à brancher en blocking)                | `EX — Bot User-Agent`, `EX — Admin Pages`        |
| `IF`            | Trigger conditionnel sur Built-in                  | `IF — Consent granted`                           |

### 2.3 Variables

```
<type abrégé> - <chemin>
```

| Préfixe         | Type                          | Exemple                                  |
| --------------- | ----------------------------- | ---------------------------------------- |
| `DLV -`         | DataLayer Variable            | `DLV - event_id`, `DLV - params.value`   |
| `CONST -`       | Constante                     | `CONST - GA4 Measurement ID`             |
| `LUT -`         | Lookup Table                  | `LUT - GA4 Measurement ID by Env`        |
| `RLT -`         | RegEx Lookup Table            | `RLT - Page Type by Path`                |
| `JS -`          | Custom JavaScript              | `JS - Hashed Email`                      |
| `BUILT -`       | Built-in (renommé pour clarté) | (utilisé tel quel — pas de préfixe)     |
| `URL -`         | URL Variable                  | `URL - Pathname`                         |

### 2.4 Folders

Numérotés pour ordre stable :

- `00 — Configuration`
- `01 — Page & Engagement`
- `02 — E-commerce`
- `03 — Lead & Form`
- `04 — Conversions`
- `05 — FemiGlow custom`
- `06 — Consent Mode`
- `07 — Helpers`
- `99 — Test / sandbox`

## 3. Workspaces — workflow recommandé

| Workspace                | Rôle                                               | Cycle de vie             |
| ------------------------ | -------------------------------------------------- | ------------------------ |
| Default Workspace        | Toutes les modifications validées en production    | permanent                 |
| `feature/<slug>`         | Une PR Git = un workspace GTM                       | merge en Default puis suppression |
| `hotfix/<incident>`      | Correction urgente, hors workflow standard         | merge express              |

> **Règle** : un seul workspace Default actif en production. Tous
> les autres sont des branches en cours.

## 4. Environnements

### 4.1 Définition

| Env       | Domaine                          | Auth GTM      | Pixel IDs                 |
| --------- | -------------------------------- | ------------- | ------------------------- |
| **Prod**  | `femiglow.ma`                    | ENV-LIVE      | IDs réels                 |
| **Stage** | `stage.femiglow.ma`              | ENV-STAGE     | IDs Stage                  |
| **Preview** (Vercel)| `*.vercel.app`         | ENV-PREVIEW   | IDs Preview / Sandbox     |
| **Dev local**| `localhost:3000`              | ENV-DEV       | IDs Dev (factice ou test) |

### 4.2 Variable de routage

`LUT - Environment` :

```
Input variable : URL - Hostname
Mapping :
  femiglow.ma                 → 'production'
  www.femiglow.ma             → 'production'
  stage.femiglow.ma           → 'stage'
  *.vercel.app                → 'preview'
  localhost                   → 'dev'
Default : 'unknown'
```

### 4.3 Pixel IDs par environnement

`LUT - GA4 Measurement ID by Env` :

```
production → CONST - GA4 ID Prod
stage      → CONST - GA4 ID Stage
preview    → CONST - GA4 ID Preview
dev        → ''
```

> En Dev, on **ne tire pas** les pixels prod. Le tag GA4 ne se
> déclenche qu'à condition que `LUT - GA4 ID by Env != ''`.

## 5. Stratégie « 1 trigger Custom Event par event »

Pour 38 events, on a **38 triggers Custom Event** distincts. C'est
volontaire :

- chaque tag est routé sans ambiguïté ;
- on peut désactiver un trigger d'un seul clic ;
- les conditions de filtre (consent, env, page) sont uniformes ;
- la lisibilité prévaut sur la concision.

### 5.1 Exception — Trigger Group

On utilise des **Trigger Groups** dans deux cas :

1. **Tags initiate** (Meta Init, TikTok Init, etc.) qui doivent se
   déclencher **après page_view ET après consent_update granted**.
   On groupe les deux conditions.
2. **Tags GA4 e-commerce** qui ont besoin d'un init `view_item` ou
   `add_to_cart` ET d'un init GA4 Configuration.

### 5.2 Naming des triggers Custom Event

```
CE — <event name>
CE Group — <description>
```

Exemple :

```
CE — page_view
CE — view_item
CE — add_to_cart
CE — begin_checkout
CE — purchase
CE — generate_lead
CE — fg_section_view
CE — fg_journal_read_75
CE Group — All E-commerce      (regex sur event ^view_item|^add_to_cart|^view_cart|^remove_from_cart|^begin_checkout|^add_(shipping|payment)_info|^purchase|^view_promotion|^select_(item|promotion)$)
CE Group — All FemiGlow Custom (regex sur event ^fg_)
```

## 6. Stratégie de blocage (exception triggers)

Tous les tags ont une **exception trigger** systémique :

```
EX — Admin Pages           (URL Path matches RegExp ^/admin)
EX — Bot User-Agent        (JS - Is Bot returns true)
EX — Consent Denied        (DLV - consent.analytics_storage = 'denied') — pour les tags non Consent-Mode-aware
```

Cette exception s'applique à **tous les tags non-essentiels**.
Ainsi, l'admin et les bots ne polluent jamais GA4.

## 7. Stratégie de tag firing priority

| Priorité        | Tags                                                                                  |
| --------------- | ------------------------------------------------------------------------------------- |
| `100`           | `CMP Cfg — Default Denied` (firing: All Pages — Initialization)                        |
| `90`            | `CMP Cfg — Update From Banner` (firing: CE — fg_consent_change)                        |
| `80`            | `GA4 Cfg — Production` (firing: All Pages)                                              |
| `70`            | `Meta Init`, `TikTok Init`, `Snap Init`, `Pin Init` (firing: All Pages, après consent) |
| `0`             | Tags d'event individuels                                                                |

> GTM exécute les tags par priorité décroissante. Les inits
> doivent partir en premier.

## 8. Stratégie de chargement des pixels tiers

| Pixel          | Mode                                              | Justification                                                  |
| -------------- | ------------------------------------------------- | -------------------------------------------------------------- |
| GA4            | tag standard (`gtag.js` via Cfg tag)               | Officiel, performant                                           |
| Meta Pixel     | Custom HTML avec `async`, après consent            | Pas de tag-template officiel propre — Custom HTML est canonique |
| TikTok Pixel   | Custom HTML avec `async`                           | idem                                                            |
| Snap Pixel     | Custom HTML                                        | idem                                                            |
| Pinterest Tag  | Custom HTML                                        | idem                                                            |
| Google Ads     | Tag template Google Ads Conversion                  | Officiel                                                        |

Tous les pixels tiers ont :

- attribut `async` ;
- exception trigger `EX — Consent Denied` (au cas où Consent Mode
  v2 ne suffit pas — Snap et TikTok sont moins matures) ;
- timeout de retrait : si le pixel n'a pas chargé en 4 s, on
  log une erreur dans la console (debug only).

## 9. Container.json comme source de vérité

Le `container.json` exporté depuis GTM Admin > Export est
**checked-in** dans le repo à `docs/gtm/annexes/container-template.json`.

Le **vrai** container.json prod vit dans `infra/gtm/container.<env>.json`
(non commité — généré). Mais le **template** structurel est
versionné.

Convention :

```
infra/gtm/
├── container.production.json     (gitignored, généré)
├── container.stage.json          (gitignored)
├── container.preview.json        (gitignored)
└── container.template.json       (commité, ne contient pas d'IDs réels)
```

## 10. Lecture suivante

- [03 — Variables](03-variables.md)
- [04 — Triggers](04-triggers.md)
- [05 — Tags](05-tags.md)
