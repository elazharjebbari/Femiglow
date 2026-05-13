# ADR-003 — Refonte event taxonomy

> **Statut** : Proposed
> **Date** : 2026-05-13

## Contexte

Trois problèmes dans la taxonomie actuelle :

1. `begin_checkout` mappé sur Meta `InitiateCheckout` fire au mount de
   `/commander` → faux positif Meta (page view déguisé).
2. `lead_capture` est `isConversion: true` dans catalog mais absent de
   `CONVERSION_EVENTS` Set côté API.
3. Pas de catégorisation Google Ads (purchase/lead/contact/signup) au niveau
   event-catalog.

## Options évaluées

### Option 1 — Renommer `begin_checkout` partout
- Renommer en `checkout_initiated` partout pour clarifier la sémantique
- ❌ Casse les conventions GA4/Meta standards
- ❌ Migration data complexe (events historiques)

### Option 2 — Nouveau custom event `form_start` + garder `begin_checkout`
- Créer `form_start` qui fire au premier focus du wizard
- Le mapping Meta de `begin_checkout` devient `CustomEvent:checkout_intent`
- `form_start` mappe à Meta `CustomEvent:form_start`
- `begin_checkout` continue de mapper sur GA4 `begin_checkout` + Google Ads
- ✅ Préserve les conventions
- ✅ Signal différencié par canal

### Option 3 — Map `begin_checkout` sur tous mais fire au first interaction
- Garder mapping standards Meta `InitiateCheckout`
- Changer le point de fire : `first_field_focus` au lieu de mount
- ✅ Aligne avec spec GA4 native
- ⚠ Comportement subtilement différent entre /kit (wizard inline) et /commander
- ⚠ Pas de event distinct pour "page chargée vs interaction"

## Décision

**Option 2 — Nouveau `form_start` custom event + harmonisation**.

Détails :
- **`form_start`** *(NEW custom event)* : fire au premier focus d'un champ du
  wizard. Mapping :
  - Meta : `CustomEvent:form_start`
  - GA4 : `form_start` (event GA4 standard recommandé)
  - Google Ads : pas de mapping (pas une conversion)
  - TikTok / Snap / Pinterest : pas de mapping
- **`begin_checkout`** : reste un signal "intent élevé". Fire MANUELLEMENT
  via bouton "Commander" (clic explicite). Mapping :
  - Meta : `CustomEvent:checkout_intent` (NOT `InitiateCheckout` standard)
  - GA4 : `begin_checkout` (standard)
  - Google Ads : pas de mapping (pas une conversion)
  - TikTok : `InitiateCheckout`
- **`lead_capture`** : ajouter au `CONVERSION_EVENTS` Set. Catégorie Google
  Ads : `lead`.

## Conséquences

### Positives
- Audience Meta Lookalike plus précise (pas de `InitiateCheckout` sur page
  view)
- Signal `form_start` exploitable séparément pour optim funnel
- `lead_capture` correctement compté comme conversion

### Négatives
- Nouvel event à documenter, à tester
- Si admin oublie de configurer `form_start` dans Meta, les Custom Events
  perdent leur valeur
- Petite régression historique : les graphs GA `begin_checkout` ne seront pas
  comparables si le point de fire change

### Mitigations
- Documenter la nouvelle taxonomie dans le glossary
- Email d'annonce aux stakeholders avec date de bascule
- Garder `begin_checkout` comme event GA4 standard (pas casser GA reporting)

## Implementation notes

- `event-catalog.ts` : ajouter
  ```typescript
  {
    name: 'form_start',
    category: 'engagement',
    scope: 'shared',
    isConversion: false,
    description: "Premier focus d'un champ du wizard de commande.",
    defaultProviders: ['google_ga4', 'meta'],
    paramsSchema: z.object({
      form_id: z.string(),
      form_name: z.string().optional(),
      first_field: z.string(),
    }),
  }
  ```
- `event-mapping.ts` : mettre à jour les mappings de `begin_checkout` et
  `form_start`.
- Composants wizard (`WizardShell`, `CheckoutFlow`) : émettre `form_start`
  au premier `onFocus` de champ. Émettre `begin_checkout` au clic
  « Commander » explicite.

## Catégorisation Google Ads (champ ajouté)

Chaque event `isConversion: true` reçoit un champ `googleAdsCategory` :
- `purchase` → `purchase`
- `lead_capture`, `generate_lead`, `chat_lead_form_submit` → `lead`
- `phone_call_initiated` → `contact`
- `sign_up` → `sign_up`
- `begin_checkout` → `null` (pas un Conversion Action distinct)
- `form_start` → `null`
