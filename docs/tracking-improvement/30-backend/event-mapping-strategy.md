# 30.3 — Event mapping strategy

## Principe

Chaque event canonique (catalog) est mappé vers un nom spécifique par
provider. La table de mapping vit dans
`lib/tracking/providers/event-mapping.ts`.

## Mapping cible (extrait pertinent au chantier)

| Event canonique | Meta | GA4 | Google Ads | TikTok | Snap | Pinterest |
|---|---|---|---|---|---|---|
| `page_view` | `PageView` | `page_view` | — | — | — | — |
| `form_start` ✨ | `CustomEvent:form_start` | `form_start` | — | — | — | — |
| `view_item` | `ViewContent` | `view_item` | — | `ViewContent` | — | `pagevisit` |
| `add_to_cart` | `AddToCart` | `add_to_cart` | — | `AddToCart` | — | `addtocart` |
| `begin_checkout` ⚠ | `CustomEvent:checkout_intent` | `begin_checkout` | — | `InitiateCheckout` | — | `checkout` |
| `lead_capture` ✅ | `Lead` | `lead_capture` | `lead_capture` | `SubmitForm` | — | — |
| `generate_lead` | `Lead` | `generate_lead` | `generate_lead` | `SubmitForm` | — | — |
| `purchase` ✨ | `Purchase` | `purchase` | `purchase` ✨ | `CompletePayment` | `PURCHASE` | `checkout` |
| `contact_form_submit` ✨ | `Contact` | `contact` | `contact` ✨ | — | — | — |
| `phone_call_initiated` | — | `phone_call` | `phone_call_initiated` ✨ | — | — | — |
| `sign_up` | `CompleteRegistration` | `sign_up` | `sign_up` | `CompleteRegistration` | — | — |

Légende :
- ✨ NEW (chantier en cours)
- ⚠ REVISED — mapping changé pour éviter pollution Meta
- ✅ FIX — mapping correct mais event manquait dans CONVERSION_EVENTS Set

## Custom Events Meta

Quand on déclare `CustomEvent:<nom>`, le tag fbq côté client doit appeler :
```javascript
fbq('trackCustom', '<nom>', { /* params */ });
```

Au lieu de l'event standard :
```javascript
fbq('track', 'Purchase', { /* params */ });
```

Le serveur (Meta CAPI) doit aussi adapter :
- `event_name: 'Purchase'` pour standard
- `event_name: '<nom_custom>'` + `custom_data` pour custom event

## Règle de décision : event standard vs custom

| Cas | Choix |
|---|---|
| Conversion business critique (purchase, lead) | Event Meta standard |
| Engagement intermédiaire (form_start, scroll) | Custom Event |
| Action peu standardisée (clic spécifique) | Custom Event |
| Conversion qui pourrait être confondue avec page view | Custom Event (ex : `begin_checkout` au mount) |

## Détail `form_start`

### Quand fire ?
- Premier `onFocus` d'un champ INPUT/TEXTAREA/SELECT à l'intérieur d'un wizard
- Une fois par session (use `sessionStorage` flag)
- Throttle 500ms pour éviter double-fire au tab rapide

### Params
```typescript
{
  form_id: 'wizard_kit' | 'wizard_commander' | 'contact_form',
  form_name: 'Wizard Kit' | 'Wizard Commander' | 'Contact',
  first_field: 'firstName' | 'phone' | 'email',
}
```

### Mapping détaillé

**Meta** (`CustomEvent:form_start`) :
- Pas une conversion Meta standard
- Permet de créer Custom Audience "Started form, didn't finish"
- Visible dans Events Manager → Custom Events

**GA4** (`form_start`) :
- Event GA4 standard (depuis 2023)
- Compté dans engagement, pas dans conversions
- Visible dans Realtime → Events

**Google Ads** : pas de mapping. `form_start` n'est pas une conversion Google Ads.

## Détail `begin_checkout` (révisé)

### Avant
```typescript
'begin_checkout': {
  meta: 'InitiateCheckout',
  google_ga4: 'begin_checkout',
  google_ads: null,
  tiktok: 'InitiateCheckout',
}
```
Problème : `InitiateCheckout` Meta est un signal très fort. Quand le tag
fire au mount du composant `CheckoutFlow` sur `/commander`, il devient un
faux signal d'intent élevé.

### Après
```typescript
'begin_checkout': {
  meta: 'CustomEvent:checkout_intent',  // ✨ custom, plus faible sémantiquement
  google_ga4: 'begin_checkout',          // standard GA4, OK
  google_ads: null,
  tiktok: 'InitiateCheckout',           // OK car TikTok n'a pas le même
                                         // poids dans le bidding
}
```

### Quand fire ?

Au lieu du mount, fire sur **interaction explicite** :
- Sur `/kit` : au clic du bouton "Continuer" du step 1 du wizard embarqué
- Sur `/commander` : au clic du bouton "Commencer" (s'il existe) OU au premier focus du wizard (= équivalent `form_start` ? Voir trade-off ci-dessous)

### Trade-off `begin_checkout` vs `form_start` sur /commander

`/commander` est une page dédiée checkout. L'arrivée sur la page peut être
considérée comme un `begin_checkout` valide. MAIS pour cohérence avec /kit,
on adopte :
- `page_view` au mount
- `form_start` au premier focus
- `begin_checkout` au clic "Continuer" du step 1 (= "j'ai rempli mes infos
  de base, je veux finaliser")
- `add_shipping_info` au step 2 complete
- `add_payment_info` au step 3 complete
- `purchase` après création order

## Détail `purchase` avec Google Ads

```typescript
'purchase': {
  meta: 'Purchase',
  google_ga4: 'purchase',
  google_ads: 'purchase',  // ✨ NEW server-side
  tiktok: 'CompletePayment',
  snap: 'PURCHASE',
  pinterest: 'checkout',
}
```

Le mapping `google_ads: 'purchase'` déclenche le serveur à appeler
`googleAdsAdapter.dispatch()`. L'adapter résout ensuite la
`conversion_action_label` pour la catégorie `purchase` via
`provider.config.googleAdsConversionActions['purchase'].actionLabel`.

## Fichier modifié

```
apps/web/src/lib/tracking/providers/event-mapping.ts
  - Ligne 64-152 : ajouter form_start
  - Ligne 86 : changer mapping Meta de begin_checkout
  - Ligne 95-110 : ajouter google_ads mappings pour lead_capture, contact_form_submit, phone_call_initiated
```
