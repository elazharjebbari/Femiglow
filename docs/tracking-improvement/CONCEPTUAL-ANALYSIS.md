# Phase 1 — Analyse conceptuelle des correctifs

> Objectif : pour chacun des 4 chantiers issus de l'audit, présenter **3 approches
> conceptuelles** (forces / faiblesses / pertinence) puis recommander une
> **proposition finale** intégrant backend / frontend / UX / UI / wizard.
>
> Niveau : conceptuel et prototypal — pas de code, pas de schéma SQL détaillé.
> Référence audit : `docs/tracking-audit/AUDIT-tracking-gtm-google-ads.md`.

---

## Table des matières

| # | Chantier | Sévérité | Effort | Priorité |
|---|---|---|---|---|
| 1 | [Pipeline de conversion](#chantier-1--pipeline-de-conversion) — Google Ads server-side + `begin_checkout` + bug `CONVERSION_EVENTS` | 🔴 Critique | XL | P0 |
| 2 | [GTM Editor — UX & cohérence](#chantier-2--gtm-editor-ux--cohérence) — pré-remplissage, édition versions, per-env | 🟠 Élevée | L | P1 |
| 3 | [Catégorisation conversions](#chantier-3--catégorisation-conversions) — Google Ads categories, event taxonomy | 🟡 Moyenne | M | P2 |
| 4 | [Observabilité & Consent](#chantier-4--observabilité--consent) — dashboards par provider, Consent Mode v2 sync | 🟡 Moyenne | M | P2 |

Notation : XL > 16h · L = 8–16h · M = 4–8h · S < 4h.

---

# Chantier 1 — Pipeline de conversion

## Problème

Trois défauts s'enchaînent :

1. **Google Ads ne reçoit aucune conversion serveur** — l'adapter `dispatch()`
   est no-op. Toute attribution dépend du tag `gtag.js` côté client.
   → Conversions perdues si ad-blocker / consent denied / JS planté.

2. **`begin_checkout` est mal positionné** — sur `/commander` il fire au mount
   du composant, donc devient un `page_view` déguisé pour Meta (mapping
   `InitiateCheckout` sur-déclenché). Sur `/kit`, il ne fire jamais alors que
   le formulaire est visible immédiatement.

3. **Bug `CONVERSION_EVENTS`** — `lead_capture` est `isConversion: true`
   dans le catalogue mais absent du Set côté `/api/track`, donc ne remonte pas
   dans `tracking_events_log.is_conversion`.

---

## Approche A — « Pure server-side conversions »

**Idée** : tout pipeline conversion passe par le serveur. Le client n'envoie
qu'un signal `event:fired` minimal au `/api/track` ; le serveur dispatche
ensuite vers GA4 (MP), Meta (CAPI), TikTok (CAPI), Snap (CAPI), Pinterest (CAPI)
ET Google Ads (Enhanced Conversions API ou Offline Conversions API).

Les snippets `gtag.js` / `fbevents.js` ne sont gardés que pour la collecte
client-side passive (page_view automatique, scroll, etc.).

```
┌─────────────────────────────────────────────────────────────────────┐
│  Browser                                                            │
│   ├─ user achète → POST /api/checkout/order                        │
│   ├─ order créé OK → POST /api/track {event:"purchase", ...}       │
│   └─ pas de gtag.send côté client                                  │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────────┐
│  /api/track → dispatcher                                            │
│    ├─ Meta CAPI                                                     │
│    ├─ GA4 MP                                                        │
│    ├─ Google Ads Enhanced Conversions API (NEW) ✅                  │
│    └─ logs tracking_events_log                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Forces
- **Bypass ad-blockers** : 100% des conversions attribuées (server reach Google direct)
- **Single source of truth** : un seul code path → moins de bugs de duplication
- **Conformité** : consent vérifié serveur, audit log centralisé
- **gclid storage** : capturé au landing, stocké en cookie session, attaché à la conversion serveur

### Faiblesses
- **Complexité Google Ads API** : OAuth Customer ID, refresh tokens, quota management. Implémentation lourde.
- **Latence ajoutée** : un round-trip serveur pour chaque event vs feu-et-oublie navigateur
- **Pas de Real-Time côté GA4 UI** : MP arrive avec ~5min de délai vs gtag immédiat
- **Migration risquée** : si CAPI rate, on perd TOUT (pas de fallback client)

### Pertinence
- ⭐⭐⭐⭐⭐ Idéal pour shop e-commerce avec ad-blocker fort
- ⚠ Effort prohibitif si Google Ads OAuth pas déjà setup
- 💸 Coût Google Ads API gratuit, mais maintenance OAuth = couvre les coûts indirects

---

## Approche B — « Dual-track : client + server avec dédup »

**Idée** : on garde `gtag.js` côté client (Google Ads ad detection, scroll, etc.)
ET on AJOUTE le dispatch serveur. Les deux envoient la même conversion à Google
mais avec un `event_id` unique → Google déduplique automatiquement.

```
┌─────────────────────────────────────────────────────────────────────┐
│  Browser                                                            │
│   ├─ achat → gtag('event', 'conversion', { transaction_id: "X" })   │
│   └─ achat → POST /api/track { event_id: "X", ... }                 │
│                                                              │       │
│                            ┌─────────────────────────────────┘       │
│                            ▼                                         │
│                  /api/track → dispatcher                             │
│                    └─ Google Ads Enhanced Conv (event_id: "X")       │
│                                                                      │
│                  Google reçoit 2 events avec event_id="X"            │
│                  → garde le premier arrivé, drop le doublon          │
└─────────────────────────────────────────────────────────────────────┘
```

Le `event_id` est généré côté client (UUID) et propagé serveur via le payload.

### Forces
- **Résilience maximale** : si CAPI rate, le client a déjà fire. Si ad-blocker, le serveur prend le relais.
- **Migration douce** : on peut activer le serveur sans toucher au client
- **Cohabitation avec GTM Tag Assistant** : les tags client visibles dans le test mode
- **Real-time GA4** : le tag client garde la latence faible perçue

### Faiblesses
- **Risque dedup foireuse** : si `event_id` mal généré (oubli côté client OU serveur) → conversions doublées
- **Double maintenance** : il faut updater les events des deux côtés
- **Coût double** : deux POST pour chaque conversion (négligeable mais existe)

### Pertinence
- ⭐⭐⭐⭐⭐ **Le standard recommandé par Google et Meta** pour CAPI
- ✅ Compatible avec le code existant
- ✅ Permet de migrer Google Ads progressivement

---

## Approche C — « Client-only (statu quo amélioré) »

**Idée** : on garde l'architecture actuelle, on n'implémente PAS le dispatch
serveur Google Ads. À la place :
- On fixe `event_id` côté client pour la dédup native gtag
- On améliore le snippet `gtag('config', 'AW-…', { allow_enhanced_conversions: true })`
- On capture l'email/téléphone via Enhanced Conversions JS (`gtag('set', 'user_data', {...})`) au moment du purchase
- On ajoute des fallbacks si le tag ne se charge pas

### Forces
- **Effort minimal** : ~2h de dev, pas de migration DB, pas d'OAuth
- **Tag Assistant compatible** : le test mode Google fonctionne nativement
- **Google Ads support natif** : Enhanced Conversions JS est la voie standard

### Faiblesses
- **Ad-blockers cassent tout** : aucune mitigation server-side
- **Consent denied = zéro attribution** : pas de fallback CAPI
- **Limite scale** : si plus tard on veut Offline Conversions (matching lead → order après plusieurs jours), il faudra refondre

### Pertinence
- ⭐⭐ Pertinent SEULEMENT si le coût serveur est inacceptable
- ❌ Ne résout pas les conversions perdues — juste la couverture qui marche

---

## 🏆 Recommandation finale Chantier 1

**Approche B (dual-track avec dédup)** pour Google Ads + **Approche A (pure server)**
pour les autres providers déjà serveur (Meta, GA4, TikTok, Snap, Pinterest).

Le client génère un `event_id` (UUID) par conversion, l'envoie au serveur via
`/api/track`. Le serveur dispatche à Google Ads via Enhanced Conversions API
avec ce même `event_id`. Google déduplique entre le tag client et le serveur.

### Conséquences design

**Backend** :
- Nouvelle implémentation `googleAdsAdapter.dispatch()` qui POSTe à
  `https://googleads.googleapis.com/v17/customers/{customer_id}:uploadClickConversions`
- Schéma DB enrichi : `tracking_providers.config.googleAdsConversionLabels`
  typé (au lieu de JSONB libre)
- Variable d'env `GOOGLE_ADS_DEVELOPER_TOKEN` + token OAuth par admin
- Nouveau champ `tracking_events_log.event_id` pour dédup tracing

**Frontend** :
- Hook `useTrackingClient()` génère un `event_id` UUID v4 par event
- `gtag('event', 'conversion', { transaction_id, event_id, ... })` côté snippet
- POST `/api/track` inclut `event_id` dans payload
- Pas de changement UX visible

**UX admin** :
- Onglet « Google Ads » dans `/admin/tracking/providers/google_ads`
  - Customer ID
  - Conversion Action Labels (purchase, lead, contact, signup) avec autocomplete
  - Boutons « Tester cette conversion » → POST /api/admin/tracking/test-event
  - Status badge : ✅ CAPI active · ❌ Token expired · ⚠ Quota usage 87%

**Wizard d'onboarding Google Ads CAPI** (nouveau) :

```
Step 1: Customer ID
  ┌────────────────────────────────────────────────────┐
  │ Renseigne ton Customer ID Google Ads               │
  │ ┌──────────────────────────────────────────────┐   │
  │ │ 7082602195                                    │   │
  │ └──────────────────────────────────────────────┘   │
  │ Format : 10 chiffres, trouvable en haut à droite  │
  │ de l'interface Google Ads.                         │
  └────────────────────────────────────────────────────┘

Step 2: Authentification OAuth
  ┌────────────────────────────────────────────────────┐
  │ Cliquez pour autoriser FemiGlow à envoyer vos      │
  │ conversions à Google Ads.                          │
  │                                                    │
  │ [ Se connecter avec Google Ads ]                   │
  │                                                    │
  │ Permissions demandées :                            │
  │  • ads_conversions:write (uploader des conversions)│
  │  • Lecture seule des Customer Actions              │
  └────────────────────────────────────────────────────┘

Step 3: Mapping des conversions
  ┌────────────────────────────────────────────────────┐
  │ FemiGlow événement       →  Google Ads action      │
  │ ──────────────────────────────────────────────────│
  │ purchase                 →  [Purchase ▼] AbCdEf… │
  │ lead_capture             →  [Lead     ▼] XyZ789  │
  │ generate_lead            →  [Lead     ▼] XyZ789  │
  │ contact                  →  [Contact  ▼] +Add… │
  │                                                    │
  │ ⓘ Les actions sont récupérées automatiquement     │
  │   depuis ton compte Google Ads.                    │
  └────────────────────────────────────────────────────┘

Step 4: Test
  ┌────────────────────────────────────────────────────┐
  │ Envoi d'une conversion test...                     │
  │ ████████████ 100%                                  │
  │                                                    │
  │ ✅ Test purchase envoyée                            │
  │ ✅ Reçu dans Google Ads (latence: 1.2s)            │
  │                                                    │
  │ [ Activer en production ]                          │
  └────────────────────────────────────────────────────┘
```

### Sous-fix associés au chantier 1

- **`CONVERSION_EVENTS` bug** : `api/track/route.ts:22` → ajout de
  `lead_capture`, `begin_checkout`, `add_to_cart`, `add_shipping_info`,
  `add_payment_info` selon le `isConversion` flag du catalogue. **Trivial : 1 ligne.**
- **`begin_checkout` placement** : remplacer le mapping Meta
  `begin_checkout → InitiateCheckout` par un mapping vers le custom event
  `form_start` (à créer dans le catalogue) ; garder `begin_checkout → GA4 / Google Ads`.
- **`form_start`** : nouveau custom event qui fire au **premier focus** d'un champ
  du wizard (sur `/kit` ET `/commander`). Cohérent, précis, ne pollue pas Meta.

---

# Chantier 2 — GTM Editor — UX & cohérence

## Problème

- `/admin/tracking/pixels` (tracking_providers) et `/admin/tracking/gtm`
  (tracking_settings.gtm.config_versions) sont **désynchronisés**.
- Le formulaire GTM ne pré-remplit pas depuis les providers existants.
- Pas d'édition d'une version sauvegardée : il faut repartir d'un template
  ou copier-coller le JSON.

## Approche A — « Source of truth unique : Providers + dérivation auto »

**Idée** : `tracking_providers` est la source de vérité pour TOUS les pixel IDs.
La page GTM affiche un container **dérivé automatiquement** des providers
enabled. L'export GTM devient un read-only snapshot. Aucun champ pixel
n'est éditable dans le formulaire GTM.

```
tracking_providers  (SSOT)
       │
       ▼
  GTM Container Generator (pure function)
       │
       ▼
  Tracking Settings (gtm.config_versions)
       └─ stocke uniquement les overrides (per-env, conv labels, customHTML)
```

### Forces
- **Cohérence garantie** : impossible de désaligner Meta Pixel ID dans deux endroits
- **UX simplifié** : un seul lieu pour changer un pixel
- **Audit clair** : modification d'un provider → impact tracé sur les versions GTM

### Faiblesses
- **Perte de flexibilité** : impossible d'avoir un pixel test différent par env GTM
- **Migration douloureuse** : les versions existantes doivent être réconciliées
- **Risque** : un admin modifie un provider et casse une version GTM en prod

### Pertinence
- ⭐⭐⭐ Pertinent si l'org veut un setup tracking « simple et carré »
- ⚠ Pas adapté si on a des envs très différents (dev/stage/preview)

---

## Approche B — « Pré-remplissage à la création + édition libre ensuite »

**Idée** : à la création d'une nouvelle version GTM, on **pré-remplit** les
champs depuis `tracking_providers`. L'admin peut ensuite éditer librement
(override par version). Un diff visuel signale les divergences.

```
┌────────────────────────────────────────────────────┐
│ Créer une nouvelle version GTM                     │
│                                                    │
│ Nom: v2 — Black Friday 2026                        │
│ Partir de: [● Providers actuels  ○ Template  ○ Vide]│
│                                                    │
│ ┌─ Production ──────────────────────────────────┐ │
│ │ Meta Pixel ID    [2179682406197934  ] ⚡        │ │
│ │                   Provider: same value ✅        │ │
│ │                                                  │ │
│ │ GA4 Measurement  [G-5VHP17SDZM     ] ⚡         │ │
│ │                   Provider: same value ✅        │ │
│ │                                                  │ │
│ │ Google Ads CID   [7082602195       ] ⚠           │ │
│ │                   Provider: 7082602196 ≠ value   │ │
│ │                   [Use provider value]           │ │
│ │ ...                                              │ │
│ └────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────┘
```

### Forces
- **Best-of-both-worlds** : commodité du pré-remplissage + flexibilité override
- **Diff visuel** : l'admin voit immédiatement les divergences
- **Migration douce** : pas de breaking change sur les versions existantes
- **Audit** : la version stockée garde son snapshot, indépendamment des providers futurs

### Faiblesses
- **Encore deux sources** : un admin peut toujours désaligner en oubliant de re-sync
- **Complexité UX** : 4 envs × 8 pixels × diff visuel = beaucoup d'info à digérer
- **Resync manuel** : si un pixel change dans Providers, les versions GTM ne se mettent pas à jour automatiquement

### Pertinence
- ⭐⭐⭐⭐⭐ **Le sweet spot pragmatique**
- ✅ Pas de migration data
- ✅ UX intuitive (« Reprendre depuis Providers » est un pattern connu)

---

## Approche C — « Editor type Notion : édition in-place + history »

**Idée** : abandonner le pattern "version sauvegardée séparée" pour aller vers
une édition collaborative type Notion. Chaque champ a un historique, un
état brouillon vs publié, un système de commentaires.

```
┌────────────────────────────────────────────────────┐
│ Production · Active                          🔄    │
│                                                    │
│ Meta Pixel ID    [2179682406197934           ]   │
│                   ↳ modifié il y a 3 j par Sara   │
│                   ↳ commentaire: "ID prod final"  │
│                                                    │
│ GA4 Measurement  [G-5VHP17SDZM               ]   │
│                                                    │
│ [Voir l'historique] [Publier les modifications]   │
└────────────────────────────────────────────────────┘
```

### Forces
- **UX très moderne** : édition fluide, pas de "create new version" friction
- **Audit complet par champ** : on sait qui a modifié quoi quand
- **Collaboration** : plusieurs admins peuvent éditer en parallèle (CRDTs ou OT)

### Faiblesses
- **Complexité énorme** : OT/CRDT, conflits, merge, drafts
- **Overkill** : 99% du temps un seul admin édite
- **Effort prohibitif** : 40h+ de dev pour quelque chose qui dérive du besoin

### Pertinence
- ⭐⭐ Beau sur le papier, hors-scope dans la réalité de cet outil interne

---

## 🏆 Recommandation finale Chantier 2

**Approche B (pré-remplissage + édition libre + diff visuel)**.

### Conséquences design

**Backend** :
- Nouvelle route `GET /api/admin/tracking/providers/snapshot` qui retourne
  un objet `{ metaPixelId, ga4MeasurementId, tiktokPixelId, ... }` agrégé
  depuis `tracking_providers` enabled
- Méthode `gtmConfigStore.clone(versionId, { newName })` qui duplique une
  version existante pour permettre l'édition

**Frontend** :
- `GtmConfigForm` accepte un prop `seedFrom: 'providers' | 'version' | 'template' | 'empty'`
- Bouton `[Importer depuis Providers]` qui appelle la nouvelle route et hydrate
  le form
- Bouton `[Modifier]` sur chaque version dans la liste → ouvre le form pré-rempli
- Indicateur visuel ⚡ (sync) ou ⚠ (divergence) à côté de chaque champ pixel

**UX wizard de modification** :

```
LISTE VERSIONS
┌──────────────────────────────────────────────────────────┐
│ Version            Active    Créée par      Actions      │
├──────────────────────────────────────────────────────────┤
│ v3 — Mai 2026  ●  ACTIVE   Sara · 2j     [Modifier] [⋮] │
│ v2 — BF 2026                Mike · 6m     [Modifier] [⋮] │
│ v1 — initial                Sara · 1a     [Modifier] [⋮] │
└──────────────────────────────────────────────────────────┘

[Modifier] (sur v2) →

WIZARD MODIFICATION
Étape 1: Confirmation
  ┌────────────────────────────────────────────────────┐
  │ Modifier la version "v2 — Black Friday 2026"       │
  │                                                    │
  │ La modification créera une NOUVELLE version        │
  │ (audit trail préservé). L'ancienne version reste   │
  │ accessible.                                        │
  │                                                    │
  │ Nom nouvelle version: [v2.1 — patch              ] │
  │                                                    │
  │ [Annuler]              [Continuer]                │
  └────────────────────────────────────────────────────┘

Étape 2-5: Édition par env (Prod/Stage/Preview/Dev)
  Chaque champ avec son indicateur de sync vs Providers

Étape 6: Récap diff
  ┌────────────────────────────────────────────────────┐
  │ Changements détectés                               │
  │                                                    │
  │ Production:                                        │
  │   • Meta Pixel ID: 2179...934 → 9876...123        │
  │   • Conv label purchase: ABC123 → XYZ789          │
  │                                                    │
  │ Stage: aucun changement                           │
  │ Preview: aucun changement                          │
  │ Dev: aucun changement                              │
  │                                                    │
  │ [Annuler]   [Sauvegarder v2.1]                    │
  └────────────────────────────────────────────────────┘

Étape 7: Activation (optionnelle)
  ┌────────────────────────────────────────────────────┐
  │ ✅ v2.1 sauvegardée                                 │
  │                                                    │
  │ Souhaites-tu activer cette version maintenant ?   │
  │ (La version active est exportée vers GTM)         │
  │                                                    │
  │ [Plus tard]            [Activer v2.1]              │
  └────────────────────────────────────────────────────┘
```

---

# Chantier 3 — Catégorisation conversions

## Problème

Google Ads attend des conversions classées par catégorie business
(purchase / lead / contact / signup / view-content). Aujourd'hui :
- Pas de champ `googleAdsCategory` dans l'event-catalog
- Pas d'UI admin pour mapper `event_name × category → conversion_action_label`
- Smart Bidding de Google Ads sous-performe

## Approche A — « Hardcoded categories dans l'event-catalog »

**Idée** : enrichir chaque event de l'event-catalog avec un champ
`googleAdsCategory: 'purchase' | 'lead' | 'contact' | 'signup' | 'view_content' | null`.
Le mapping vers Conversion Action Label est ensuite fait dans la config GTM
(`googleAdsConvLabels.<category>: 'AbCdEf'`).

### Forces
- **Simple** : un champ statique TS, validé au compile-time
- **Aucune UI à construire** côté event-catalog
- **Audit clair** : on voit dans le code source quelle catégorie un event a

### Faiblesses
- **Rigidité** : impossible d'override la catégorie depuis l'admin (sans deploy)
- **Couplage code-config** : l'admin ne contrôle pas la sémantique business
- **Évolution lente** : ajouter un event → modifier le code → déployer

### Pertinence
- ⭐⭐⭐⭐ Bon pour stabilité long terme
- ⚠ Mauvais pour itération rapide marketing

---

## Approche B — « Catégorie éditable en admin par event »

**Idée** : l'event-catalog devient partiellement éditable. Ajout d'une table
`tracking_event_overrides` (event_name + googleAdsCategory + custom mappings).
L'UI admin permet de définir la catégorie de chaque event manuellement.

```
/admin/tracking/events
┌──────────────────────────────────────────────────────────────────┐
│ Event               isConversion   Google Ads Category           │
├──────────────────────────────────────────────────────────────────┤
│ purchase            ✅             [Purchase   ▼]                │
│ lead_capture        ✅             [Lead       ▼]                │
│ generate_lead       ✅             [Lead       ▼]                │
│ form_start          ❌             [— None     ▼]                │
│ chat_lead_form_submit ✅           [Lead       ▼]                │
│ begin_checkout      ✅             [— None     ▼]                │
│ ...                                                              │
└──────────────────────────────────────────────────────────────────┘
```

### Forces
- **Flexibilité maximale** : marketing peut ajuster sans deploy
- **Visibilité claire** : un seul tableau pour voir l'intention business
- **Réversibilité** : on peut tester différentes catégorisations

### Faiblesses
- **Risque erreur humaine** : un admin peut casser le mapping de prod
- **Schema DB ajouté** : `tracking_event_overrides`
- **Validation manquante** : aucun garde-fou que tous les `isConversion` events soient catégorisés

### Pertinence
- ⭐⭐⭐⭐ Bonne flexibilité pour équipe marketing
- ⚠ Demande une bonne discipline éditoriale

---

## Approche C — « Hybride : default code + override admin »

**Idée** : combinaison de A et B. L'event-catalog définit une catégorie
**par défaut**. L'admin peut overrider si nécessaire via `tracking_event_overrides`.
La résolution finale est `override ?? catalog.googleAdsCategory`.

### Forces
- **Bonne base par défaut** : nouvel event = bonne catégorie sans rien faire
- **Override possible** : marketing peut ajuster cas par cas
- **Pas de panique** : si l'admin n'a rien fait, le système marche

### Faiblesses
- **2 sources** : il faut vérifier dans le code ET dans la DB
- **UX un peu confuse** : pourquoi cet event a catégorie X dans l'UI mais Y dans le mapping résolu ?

### Pertinence
- ⭐⭐⭐⭐⭐ **Le bon compromis**
- ✅ Sécurité du code + flexibilité de l'admin

---

## 🏆 Recommandation finale Chantier 3

**Approche C (hybride code + override admin)**.

### Conséquences design

**Backend** :
- `event-catalog.ts` enrichi : chaque event a un champ
  `googleAdsCategory?: 'purchase' | 'lead' | 'contact' | 'signup' | 'view_content'`
- Nouvelle table `tracking_event_overrides` : `(event_name, google_ads_category, updated_by, updated_at)`
- Fonction `resolveEventCategory(eventName): GoogleAdsCategory | null` qui lit
  override puis fallback catalogue

**Frontend** :
- Nouvelle page `/admin/tracking/events/categorization`
- Liste tabulaire de tous les events `isConversion: true`
- Pour chaque ligne :
  - Default depuis catalogue (texte grisé)
  - Override actuel (dropdown éditable)
  - Bouton « Reset » pour revenir au default

**UI/UX** :

```
/admin/tracking/events/categorization
┌──────────────────────────────────────────────────────────────────────────┐
│ Catégorisation des événements pour Google Ads                            │
│                                                                          │
│ Cette page définit la catégorie Google Ads (Purchase, Lead, Contact…)    │
│ pour chaque événement de conversion. Les Conversion Actions de ton       │
│ compte Google Ads sont mappées à ces catégories.                         │
│                                                                          │
│ ┌──────────────────────────────────────────────────────────────────────┐ │
│ │ Événement              Catégorie                Action               │ │
│ ├──────────────────────────────────────────────────────────────────────┤ │
│ │ purchase               [Purchase     ▼]  default                     │ │
│ │                        ⓘ "Conversion d'achat e-commerce"              │ │
│ │                                                                      │ │
│ │ lead_capture           [Lead         ▼]  default                     │ │
│ │                        ⓘ "Formulaire de lead capturé"                 │ │
│ │                                                                      │ │
│ │ generate_lead          [Lead         ▼]  default                     │ │
│ │                                                                      │ │
│ │ form_start             [— None       ▼]  default                     │ │
│ │                        ⓘ "Premier focus dans un formulaire — pas une │ │
│ │                          conversion."                                 │ │
│ │                                                                      │ │
│ │ chat_lead_form_submit  [Lead         ▼]  default                     │ │
│ │                                                                      │ │
│ │ phone_call_initiated   [Contact      ▼]  ✏ override (par Sara, 3j)   │ │
│ │                        ⓘ Default: None — override en Contact         │ │
│ │                        [Reset au default]                            │ │
│ │                                                                      │ │
│ │ stock_notify_subscribe [— None       ▼]  default                     │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│ Configuration Google Ads associée                                        │
│ ┌──────────────────────────────────────────────────────────────────────┐ │
│ │ Catégorie    →  Conversion Action Label   (gestion GTM)              │ │
│ ├──────────────────────────────────────────────────────────────────────┤ │
│ │ Purchase     →  AbCdEf123ABc   [Editer dans GTM ▸]                  │ │
│ │ Lead         →  XyZ789xyZ123   [Editer dans GTM ▸]                  │ │
│ │ Contact      →  + Ajouter                                            │ │
│ │ Signup       →  + Ajouter                                            │ │
│ │ View Content →  + Ajouter                                            │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

---

# Chantier 4 — Observabilité & Consent

## Problème

- Pas de dashboards par provider (count, success rate, latency P50/P95)
- Consent Mode v2 : `gtag('consent','update', state)` après granted, mais
  risque de désync sur Google Ads (loaded séparément)
- `tracking_events_log` a tous les attributs nécessaires mais aucune
  visualisation

## Approche A — « Built-in dashboards Next.js »

Pages `/admin/tracking/analytics/conversions` et `/admin/tracking/analytics/providers`
avec Recharts (déjà dans le projet) tirant directement de
`tracking_events_log` agrégé.

### Forces
- ✅ Pas de dépendance externe
- ✅ Cohérent avec le reste de l'admin
- ✅ Temps réel < 1min

### Faiblesses
- ❌ Limites perf si > 1M events / jour
- ❌ Pas d'alerting / threshold

### Pertinence
- ⭐⭐⭐⭐ Le bon choix pour MVP
---

## Approche B — « Export vers Grafana / Sentry / Datadog »

Pipe `tracking_events_log` vers Prometheus exporter ou Datadog metrics.
Dashboard hébergé externe.

### Forces
- ✅ Outillage mature : alerting, anomaly detection
- ✅ Échelle illimitée

### Faiblesses
- ❌ Coût mensuel ($)
- ❌ Setup et auth externe
- ❌ Hors-scope pour outil interne

### Pertinence
- ⭐⭐ Justifié seulement à très haute échelle

---

## Approche C — « Hybride : built-in basique + export OTLP optionnel »

Built-in dashboards (Approche A) + endpoint OpenTelemetry exporter optionnel
si l'admin veut brancher Grafana plus tard.

### Forces
- ✅ MVP rapide
- ✅ Évolution possible sans refonte

### Faiblesses
- ⚠ Pas pertinent maintenant (overhead OTLP pour 100 events/jour)

---

## 🏆 Recommandation finale Chantier 4

**Approche A (built-in dashboards)** + fix Consent Mode v2 sync.

### UI cible

```
/admin/tracking/analytics/providers (NEW)
┌─────────────────────────────────────────────────────────────────────┐
│ Performance des providers · 7 derniers jours                        │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │  Provider     Total   Success   Latency P50    Errors 24h       │ │
│ ├─────────────────────────────────────────────────────────────────┤ │
│ │  meta         1247    98.2%     245ms          2 (graph.fb…)    │ │
│ │  google_ga4   1247    99.7%     180ms          0                │ │
│ │  google_ads   1247    97.1%     350ms          1 (quota)        │ │
│ │  tiktok       1247    96.8%     420ms          5 (timeout)      │ │
│ │  ...                                                             │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ┌─── Conversions par jour ─────────────────────────────────────────┐│
│ │   ▆▆▆                                                            ││
│ │  ▆▆▆▆      ▆▆▆▆▆                                                 ││
│ │  ▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆                                                ││
│ │  L M M J V S D                                                   ││
│ └──────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

Plus :
- Fix `consent.update` propagation : appel explicite `gtag('consent','update', state)`
  ET re-fire de l'event si Google Ads a été loaded entre temps
- Audit log dédié : `audit_events.action = 'tracking.consent.changed'`

---

# Synthèse globale

| Chantier | Approche retenue | Effort | Impact business |
|---|---|---|---|
| 1 — Pipeline conversion | B (dual-track) + fix bugs | **XL (16-24h)** | 🔴 Critique — récupérer 10-25% de conversions perdues |
| 2 — GTM Editor UX | B (préremplissage + édition) | **L (8-12h)** | 🟠 Élevé — productivité admin × 3 |
| 3 — Catégorisation conv. | C (hybride code + admin) | **M (4-6h)** | 🟡 Moyen — meilleure attribution Google Ads |
| 4 — Observabilité | A (built-in dashboards) | **M (6-8h)** | 🟡 Moyen — meilleure visibilité ROI tracking |

**Effort total : 34-50h** (~ 1 semaine dev focus).

---

# Wireframes haute-niveau — récap

## Architecture cible

```
┌────────────────────────────────────────────────────────────────────┐
│                       FRONTEND (browser)                           │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │  gtag.js     │  │ fbevents.js  │  │  TrackingClient        │  │
│  │ (GA4+Ads+GTM)│  │ (Meta Pixel) │  │ (batched POST /api/track)│  │
│  └──────┬───────┘  └──────┬───────┘  └────────────┬───────────┘  │
│         │  event_id        │  event_id             │              │
└─────────┼──────────────────┼───────────────────────┼──────────────┘
          │                  │                       │
          │ Google           │ Meta Pixel            │
          │ Tag Assistant    │ Helper                │
          ▼                  ▼                       ▼
┌─────────────┐    ┌─────────────────┐    ┌────────────────────────┐
│ Google      │    │ Meta            │    │  /api/track            │
│ Ads gtag    │    │ Pixel           │    │      │                 │
└─────────────┘    └─────────────────┘    │      ▼                 │
                                          │  Dispatcher            │
                                          │   ├ Meta CAPI          │
                                          │   ├ GA4 MP             │
                                          │   ├ Google Ads CAPI ★  │
                                          │   ├ TikTok CAPI        │
                                          │   ├ Snap CAPI          │
                                          │   ├ Pinterest CAPI     │
                                          │   └ log_event DB       │
                                          └────────────────────────┘
                                                  │
                                                  ▼
                              ┌─────────────────────────────────┐
                              │ tracking_events_log + dashbds   │
                              └─────────────────────────────────┘

★ NEW (chantier 1)
```

## Wireframe — `/admin/tracking` (refresh)

```
┌──────────────────────────────────────────────────────────────────┐
│  TRACKING                                                        │
│                                                                  │
│  Vue d'ensemble    Providers    Pixels    Events    GTM Config  │
│  ────────────                                                    │
│                                                                  │
│  KPIs 24h                                                        │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐               │
│  │  847    │ │  23     │ │  98.4%  │ │  220ms  │               │
│  │ Events  │ │ Conv.   │ │ Success │ │ Latency │               │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘               │
│                                                                  │
│  Providers santé                                                 │
│  ✅ meta · ga4 · gtm · google_ads · tiktok                       │
│  ⚠  snap (5 errors)                                              │
│  ❌ pinterest (token expired)                                    │
│                                                                  │
│  [Voir tous les events ▸]    [Analytics détaillées ▸]            │
└──────────────────────────────────────────────────────────────────┘
```

---

# Fin de la Phase 1

La Phase 2 (technical dossier multi-formats) commence immédiatement après.
