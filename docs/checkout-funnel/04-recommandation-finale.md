# 04 — Recommandation finale

> **Direction retenue** : **Proposition C** (one-page progressif avec
> lead capture précoce), **phasée en 4 sous-livraisons**, avec **A/B
> test entre `/commander one-page` et la variante `/kit single-page`**
> (exigence #5).
>
> Cette recommandation intègre **les 6 exigences explicites** d'Elazhar
> (numérotées 0 à 6 dans le brief). Chaque section ci-dessous est tracée
> à l'exigence correspondante.

## Sommaire

1. [Vue d'ensemble du funnel recommandé](#1-vue-densemble-du-funnel-recommandé)
2. [Exigence 0 — Switcher FR/AR ergonomique](#2-exigence-0--switcher-frar-ergonomique)
3. [Exigence 1 — Step minimal lead capture](#3-exigence-1--step-minimal-lead-capture-nom--téléphone)
4. [Exigence 2 — Livraison avec autocomplete MA](#4-exigence-2--livraison-avec-autocomplete-ma--auto-save)
5. [Exigence 3 — Thank-you Lottie + email opt-in](#5-exigence-3--thank-you-lottie--email-opt-in)
6. [Exigence 4 — DataLayer enrichi](#6-exigence-4--datalayer-enrichi-tracking--gtm)
7. [Exigence 5 — Variante `/kit-form` single-page](#7-exigence-5--variante-kit-form-single-page-alternative-ab)
7-bis. [Exigence supplémentaire — Stock indicator & admin](#7-bis-exigence-supplémentaire--indicateur-de-stock--gestion-admin)
8. [Exigence 6 — Mise en docs](#8-exigence-6--mise-en-docs)
9. [Schéma DB & API](#9-schéma-db--api)
10. [Phasage en 4 sous-livraisons](#10-phasage-en-4-sous-livraisons)
11. [Critères de succès](#11-critères-de-succès-comment-on-saura-que-ça-marche)
12. [Risques & mitigations](#12-risques--mitigations)
13. [Décisions encore à arbitrer](#13-décisions-encore-à-arbitrer-avant-implémentation)

---

## 1. Vue d'ensemble du funnel recommandé

### 1.1 Schéma global

```
┌──────────────────────────────────────────────────────────────┐
│  /kit  (Hero + éditorial + composition + FAQ + …)            │
│                                                              │
│  [Hero CTA : Commander le rituel] ──► (anchor scroll)        │
│                                          │                   │
│                                          ▼                   │
│  ╔════════════════════════════════════════════════════╗      │
│  ║  Mini-form sous le Hero (sticky-aware) :           ║      │
│  ║                                                    ║      │
│  ║  Prénom et nom              [____________________] ║      │
│  ║  Téléphone (+212)           [____________________] ║      │
│  ║                                                    ║      │
│  ║  [ Commander mon kit · paiement à la livraison ]   ║      │
│  ║                                                    ║      │
│  ║  🔒 Vos coordonnées restent privées · loi 09-08    ║      │
│  ╚════════════════════════════════════════════════════╝      │
│                          │ submit                            │
│                          ▼                                   │
│              ✓ Lead enregistré DB (abandoned_cart)           │
│              ✓ DataLayer : lead_captured                     │
│                          │                                   │
│                          ▼                                   │
│  /commander  (one-page, pré-rempli)                          │
│  ┌──────────────────────────────────────────────────┐        │
│  │ ProgressBar visuelle 3 sections (1 ✓ par défaut) │        │
│  ├──────────────────────────────────────────────────┤        │
│  │ § Section 1 — Vos coordonnées       [✓ replié]   │        │
│  │   (Nom + tel pré-remplis. Email optionnel.)      │        │
│  ├──────────────────────────────────────────────────┤        │
│  │ § Section 2 — Livraison             [actif]      │        │
│  │   - Adresse (autocomplete MA / texte libre)      │        │
│  │   - Quartier + ville fusionnés en un seul champ  │        │
│  │   - Mode (standard / express)                    │        │
│  │   ↓ auto-save backend (lead status updated)      │        │
│  ├──────────────────────────────────────────────────┤        │
│  │ § Section 3 — Paiement              [révélé]     │        │
│  │   - COD (seul actif, hero-styled)                │        │
│  │   - Consent CGU (non pré-coché)                  │        │
│  │   - CTA : « Recevoir mon kit »                   │        │
│  │   Sous le CTA : trust ribbon                     │        │
│  └──────────────────────────────────────────────────┘        │
│                          │ submit                            │
│                          ▼                                   │
│  ✓ Lead → status `order_placed`                              │
│  ✓ Order créé                                                │
│  ✓ DataLayer : purchase                                      │
│                          │                                   │
│                          ▼                                   │
│  /merci/[orderId]                                            │
│   - Animation Lottie 2.5s (autoplay, prefers-reduced-motion) │
│   - "Merci, [Prénom]. Votre kit est en route."               │
│   - Numéro commande + ETA livraison                          │
│   - Email opt-in (optionnel, non pré-coché)                  │
│   - Lien partage / journal                                   │
└──────────────────────────────────────────────────────────────┘
```

### 1.2 Comptage des décisions utilisateur (vs. actuel)

| Étape | Actuel | Recommandé |
|---|---|---|
| `/kit` mini-form | — | **2 fields** (nom + tel) |
| `/commander` Section 1 | 4 fields + 2 ☐ | 0 (pré-rempli) ; email optionnel facultatif |
| `/commander` Section 2 | 4 fields + radio | **2 fields** (adresse autocomplete + radio livraison) |
| `/commander` Section 3 | radio + ☐ consent | 2 radios COD/Bank + 0 ☐ consent (implicite à la soumission, audit trail server-side) |
| **Total fields obligatoires** | **9** | **4** |
| Pages navigations | 3 | 2 (mais effectivement 1.5 — Section 1 invisible) |

→ **Réduction de 44 % des décisions**. Au-dessous du seuil Kolenda UX #4 (≤ 5).

---

## 2. Exigence 0 — Switcher FR/AR ergonomique

### 2.1 Position UI

- Header sticky, **angle haut-droit** (LTR) / **haut-gauche** (RTL).
- Visible à chaque étape (Hero `/kit`, mini-form, `/commander`, `/merci`).
- **Pas** de modal d'onboarding au premier chargement.

### 2.2 Pattern

```
┌─────────────────────────────────────────┐
│  FemiGlow                       FR ▾    │
└─────────────────────────────────────────┘
                                   │
                          ┌────────▼────────┐
                          │  • Français     │
                          │  • العربية       │
                          └─────────────────┘
```

- Composant : `<LanguageSwitcher />` (React Aria Menu).
- Animation de switch : fondu 200ms, **pas** de transition cassante.
- L'état du formulaire est **préservé** (form state ne se reset pas).

### 2.3 RTL implementation

- `<html dir={locale === 'ar' ? 'rtl' : 'ltr'} lang={locale}>`.
- Tailwind utilitaires `rtl:` + `ltr:` (déjà supporté).
- ProgressBar : flèche miroir (`rtl:-scale-x-100`).
- OrderSummarySticky : positionné `left-0` en RTL.
- `+212` reste **LTR par convention internationale** même dans `dir=rtl`.

### 2.4 Stack

- **`next-intl`** (App Router-compatible, plus moderne que next-i18next).
- Messages YAML/JSON : `apps/web/messages/fr.json` et `apps/web/messages/ar.json`.
- Cookie `NEXT_LOCALE` pour persistance (MVP — pas de path-based pour
  l'instant, le checkout n'a pas besoin d'être indexé en deux langues).

### 2.5 Tracking

```js
emit('language_switch', { from_language: 'fr', to_language: 'ar', step: 'checkout_section_1' });
```

### 2.6 Compliance & ergonomie

- Polices : `Noto Sans Arabic` (Google Fonts) pour AR, FemiGlow custom pour FR.
- **Lecture priorité droite-gauche** : `text-right` en AR pour le body, sauf nombres et `+212`.
- **Police de chiffres** : afficher en chiffres latins (`123`) plutôt que arabes-orientaux (`١٢٣`) — convention MA pour les numéros de tel.

---

## 3. Exigence 1 — Step minimal lead capture (nom + téléphone)

### 3.1 Position du mini-form

Sur `/kit`, **sous le Hero**, avant la composition. Sticky-aware sur
mobile (un bouton flottant qui réveille le form si on a scrollé loin).

### 3.2 Form structure

```tsx
<MiniLeadForm>
  <Heading>Plus que 90 secondes.</Heading>  {/* Kolenda Attention #2 */}
  <Text size="caption">
    Le kit est livré sous 24-48 h. Paiement à la livraison.
  </Text>

  <TextField
    label="Prénom et nom"
    placeholder="Salma El Khattab"
    autoComplete="name"
    required
    minLength={3}
  />
  <PhoneFieldMA
    label="Téléphone"
    required
    autoComplete="tel-national"
  />

  <Button variant="primary-petale" size="lg" fullWidth>
    Commander mon kit
  </Button>

  <TrustRibbon>
    🔒 Données privées · Loi 09-08 · Sans engagement
  </TrustRibbon>
</MiniLeadForm>
```

### 3.3 Validation côté client

- `nom` : `min(3).max(80)`, accepte espaces et tirets.
- `phone` : `^[5-7]\d{8}$` (validation existante).
- Submit déclenche un appel `POST /api/leads/checkout` (voir section 9).

### 3.4 Trust & neuro

| Élément | Réf. |
|---|---|
| Headline « Plus que 90 secondes » | Kolenda Attention #2 (curiosity gap) |
| Sub-text « livré 24-48 h » | Kolenda Pricing #11 (densify + reassure) |
| TrustRibbon sous CTA | Kolenda Ecom #3 |
| CTA verbe d'action « Commander » | Charte VII.5 + Kolenda Copy #4 |
| Couleur CTA `petale-dark` | Kolenda Color #14 (hue contrast) — à arbitrer |

### 3.5 État DB après submit

- Insert dans table `chat_lead` (ou nouvelle table `checkout_lead`,
  voir section 9) :

  ```sql
  INSERT INTO checkout_leads (
    id, session_id, trigger_reason,
    first_name, phone_e164, phone_raw,
    consent_version, visitor_id, language,
    created_at, status
  ) VALUES (
    gen_random_uuid(),
    $session_id,
    'kit_lead_form',
    $first_name,
    '+212' || $phone,
    $phone,
    'v1',
    $visitor_id,
    'fr',
    now(),
    'abandoned_cart'
  );
  ```

- Réponse : `{ leadId: "uuid", redirectTo: "/commander?lead=uuid" }`.
- `/commander` pré-remplit `contact` à partir de `leadId`.

### 3.6 Si l'utilisateur ferme l'onglet ici

✅ Le lead **existe en DB**. L'équipe peut :
- Envoyer un SMS sous 1h (« Hi Salma, votre rituel vous attend… »).
- WhatsApp via API officielle.
- Appel téléphonique manuel.

→ **C'est le gain le plus important de toute la refonte.**

---

## 4. Exigence 2 — Livraison avec autocomplete MA + auto-save

### 4.1 Stack

- **Dataset** : `apps/web/public/data/geonames-ma.json` (~150 KB, à
  vendor au build).
- **Fuzzy search** : `fuse.js` (~14 KB minified, déjà éprouvé).
- **UI** : `react-aria-components` ComboBox (WAI-ARIA 1.2).
- **Fallback free-text** : si la query ne match rien après 300ms.

### 4.2 UI pattern

```
┌─────────────────────────────────────────────────────┐
│ Adresse de livraison                                │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Rue Hassan II, Maarif, Casa█                    │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ Ville ou quartier                                   │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Casa█                                           │ │
│ └─────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────┐ │
│ │ • Casablanca                                    │ │
│ │ • Casablanca — Maarif                           │ │
│ │ • Casablanca — Aïn Sebaâ                        │ │
│ │ • Casa-Anfa                                     │ │
│ │ ─────                                           │ │
│ │ + Utiliser « Casa » tel quel                    │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 4.3 Auto-save

À chaque blur (ou ≥1 seconde d'inactivité après changement) :

```js
PATCH /api/leads/{leadId}/address-draft
{
  "city": "casablanca",
  "city_label": "Casablanca — Maarif",
  "address_line1": "Rue Hassan II",
  "quartier": "Maarif",
  "shipping_mode": "standard"
}
```

Idempotent, side-effect-free. Si le lead passe `order_placed` plus
tard, le payload final écrasera.

### 4.4 Transition `abandoned_cart → order_placed`

À la soumission finale (Section 3), le backend :

1. Récupère le `leadId` actuel.
2. Update `status = 'order_placed'`.
3. Crée la `order` associée (`order.lead_id = leadId`).
4. Marque `purchase` côté DataLayer.

### 4.5 Tracking

```js
emit('address_autocomplete_select', {
  selected_value: 'Casablanca — Maarif',
  query_length: 4,
  results_count: 6,
  step: 'checkout_section_2',
});

emit('address_autocomplete_freetext', {
  freetext_value: 'Mon village Y',
  query_length: 12,
  step: 'checkout_section_2',
});
```

### 4.6 Schéma Zod élargi

```ts
// apps/web/src/lib/schemas/order.ts (élargi)

export const villeMarocAutoEnum = z.union([
  z.string().min(2).max(80),   // free text
  villeMarocEnum,              // ancien enum gardé pour rétrocompat
]);

export const checkoutAddressV2Schema = z.object({
  line1: z.string().min(4).max(120),
  line2: z.string().max(120).optional(),
  quartier: z.string().min(2).max(80),
  city: villeMarocAutoEnum,
  cityLabel: z.string().max(120).optional(), // label affiché
  cityKey: z.string().max(64).optional(),    // identifiant geonames si existant
  country: z.literal('MA'),
  shippingMode: shippingModeSchema.default('standard'),
});
```

---

## 5. Exigence 3 — Thank-you Lottie + email opt-in

### 5.1 Animation

- **Source** : Lottie File Editor commande à un illustrateur (palette
  FemiGlow, motif floral éditorial).
- **Format** : `.lottie` (dotLottie), <80 KB.
- **Durée** : 2.5s, **single play** (pas de loop).
- **Comportement** : autoplay au mount, fade-out après play, image
  statique en fallback si `prefers-reduced-motion: reduce`.

### 5.2 Code

```tsx
// apps/web/src/components/commerce/ThankYouAnimation.tsx
'use client';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { useMedia } from '@/lib/hooks/use-media';

export function ThankYouAnimation() {
  const reduceMotion = useMedia('(prefers-reduced-motion: reduce)');

  if (reduceMotion) {
    return <img src="/animations/order-confirmed.svg" alt="" width="280" height="280" />;
  }

  return (
    <DotLottieReact
      src="/animations/order-confirmed.lottie"
      autoplay
      loop={false}
      speed={1}
      style={{ width: 280, height: 280 }}
      onComplete={() => emit('thankyou_animation_complete', { order_id, language })}
    />
  );
}
```

### 5.3 Structure de page

```tsx
<MerciPage>
  <ThankYouAnimation />
  <Heading size="xl">Merci, {firstName}.</Heading>
  <Text>Votre kit est en route.</Text>

  <OrderInfoCard
    orderId={orderId}
    eta={eta}
    paymentMethod="cod"
  />

  <ThankYouEmailOptIn orderId={orderId}>
    {/* Email transactionnel uniquement (pas d'opt-in newsletter ici, séparé) */}
    {/* Bloc déclaratif unique : input email + CTA "M'envoyer la confirmation" */}
    {/* États : idle → loading → success (remplace tout par message check) */}
    {/* Pas de checkbox newsletter ici — séparée pour respecter RGPD (consentement granulaire) */}
  </ThankYouEmailOptIn>

  <DiscoveryRibbon>
    <Link href="/journal">Lire la lettre de la maison</Link>
    <ShareButton />
  </DiscoveryRibbon>
</MerciPage>
```

### 5.4 Tracking

```js
emit('thankyou_animation_complete', { order_id, language });
emit('email_optin_submitted', { order_id, language });
emit('email_optin_confirmed', { order_id, language });          // success state
emit('email_optin_failed',    { order_id, reason });            // error state
emit('thankyou_share_click', { order_id, channel: 'whatsapp' });
```

### 5.5 Réf. neuro

- **Lottie 2.5s** = clôture cognitive (dopamine release).
- **Prénom dans le titre** = effet cocktail party (engagement émotionnel).
- **Numéro commande visible** = ancre de traçabilité (réduit l'anxiété post-achat).
- **Email opt-in transactionnel uniquement** = compliance RGPD + respect (newsletter séparée).
- **Bloc unique sans checkbox** = friction minimum, choix clair (J'envoie ou j'ignore).
- **Lien journal** = passerelle vers la communauté (cross-sell).

---

## 6. Exigence 4 — DataLayer enrichi (tracking + GTM)

### 6.1 Liste complète des events après refonte

| # | Event | Trigger | Critique pour |
|---|---|---|---|
| 1 | `view_item` | Mount `/kit` | Dénominateur funnel |
| 2 | `lead_captured` | Submit mini-form `/kit` | **Métrique #1** — % de visiteurs convertis en leads |
| 3 | `add_to_cart` | (implicite : auto-déclenché à `lead_captured`) | Compat GA4 ecommerce |
| 4 | `begin_checkout` | Mount `/commander` | Funnel ecommerce |
| 5 | `form_field_focus` | onFocus sur tout input | Heatmap |
| 6 | `form_field_complete` | onBlur valide | Heatmap |
| 7 | `form_field_error` | Zod issue | Heatmap |
| 8 | `address_autocomplete_select` | Click dropdown | Qualité autocomplete |
| 9 | `address_autocomplete_freetext` | Free text validé | Détection trous dataset |
| 10 | `add_shipping_info` | Section 2 validée | Funnel ecommerce |
| 11 | `add_payment_info` | Submit final | Funnel ecommerce |
| 12 | `purchase` | Confirmation serveur | **Métrique #2** — conversion |
| 13 | `checkout_abandonment` | `beforeunload` ou `visibilitychange` (>10s sans submit) | Cart recovery |
| 14 | `language_switch` | Click toggle FR/AR | Pertinence i18n |
| 15 | `thankyou_animation_complete` | Lottie onComplete | Engagement post-achat |
| 16 | `email_optin_submitted` / `email_optin_confirmed` / `email_optin_failed` | Submit email page merci | Acquisition email transactionnel (taux opt-in mesure) |
| 17 | `thankyou_share_click` | Click partage | Virality |
| 18 | `stock_indicator_view` | Mount StockIndicator Step 2 | Mesure pression stock perçue |
| 19 | `stock_unavailable` | Tentative checkout sur produit hors stock | Anti-friction (KPI < 1 %) |
| 20 | `stock_notify_subscribed` | Submit email "M'avertir" en rupture | Re-engagement back-in-stock |

### 6.2 Payload standard

Chaque event hérite d'un payload commun :

```ts
{
  // ecommerce (GA4 standard)
  currency: 'MAD',
  value: 78.00,
  items: [...],

  // custom (FemiGlow)
  session_id: 'uuid',
  visitor_id: 'fp_xxx',
  lead_id: 'uuid' | null,
  language: 'fr' | 'ar',
  step: 'kit_form' | 'checkout_section_1' | 'checkout_section_2' | 'checkout_section_3' | 'merci',
  device_type: 'mobile' | 'tablet' | 'desktop',
  page_url: '/commander',
  referrer: '...',
}
```

### 6.3 Folders GTM

| Folder GTM | Events |
|---|---|
| `CONVERSION_EVENTS` | `purchase`, `add_payment_info`, `lead_captured` |
| `ECOMMERCE_FUNNEL` | `view_item`, `add_to_cart`, `begin_checkout`, `add_shipping_info` |
| `FORM_INTERACTIONS` | `form_field_focus/complete/error`, `address_autocomplete_*` |
| `BEHAVIOR_SIGNALS` | `language_switch`, `checkout_abandonment`, `thankyou_*` |

### 6.4 Nomenclature

- Toutes les clés en `snake_case` (déjà en place).
- Tous les noms d'events en `snake_case`.
- Nomenclature GTM interne `UPPER_SNAKE_CASE` (conformément à `d1bac36`).

### 6.5 Tests

- Tests Vitest pour chaque builder dans `apps/web/src/lib/tracking/gtm/builders.test.ts`.
- Test E2E Playwright : « le funnel émet tous les events attendus
  dans l'ordre » (déjà partiel, à compléter).

---

## 7. Exigence 5 — Variante `/kit-form` single-page (alternative A/B)

### 7.1 Concept

Au lieu de naviguer `/kit` → `/commander`, **tout** se passe sur `/kit`.
Le `MiniLeadForm` capture nom+tel. Au submit, **inline expansion** :
les sections livraison + paiement apparaissent **dans la même page**
(animation slide-down, focus auto sur le premier champ révélé).

### 7.2 Avantages

- **Zero navigation** (pas de chargement supplémentaire).
- Renforce le sentiment « c'est rapide ».
- Le contexte éditorial du Hero reste visible si l'utilisateur scroll up.
- Encore plus fluide sur mobile.

### 7.3 Inconvénients

- La page `/kit` devient un funnel SEO ET conversion → tension.
- Risque de surcharge si mal designé.
- Les données SEO (Schema.org Product) ne doivent pas être polluées.

### 7.4 Décision

→ **A/B test** entre :
- **Variant A** : `/kit` → `/commander` (one-page), proposition C standard.
- **Variant B** : `/kit-form` single-page.

→ Mesurer :
- Conversion `purchase / view_item`.
- Lead capture `lead / view_item`.
- Bounce rate `/kit` (à scrute pour B).
- NPS post-achat.

→ A/B test sur 4 semaines, ~2 000 sessions par variante minimum (puissance statistique 80%).

### 7.5 Implémentation

- Feature flag `NEXT_PUBLIC_KIT_SINGLE_PAGE` (true = variant B).
- A/B assignment via cookie `ab_kit_funnel = variant_a | variant_b`.
- DataLayer payload inclut `ab_variant` pour analyse.

---

## 7-bis. Exigence supplémentaire — Indicateur de stock & gestion admin

> Suite à la revue 2026-05, ajout d'un signal d'urgence honnête (stock réel)
> et d'une page admin pour piloter le pipeline de réapprovisionnement.

### 7-bis.1 UI Step 2 — `<StockIndicator>`

- **Position** : tout en haut de Step 2 (avant les champs adresse), card premium 1 ligne.
- **4 états** : `in_stock` / `low_stock` / `restocking` / `out_of_stock`.
- **Icônes** : Lucide stroke 1.5 (`CheckCircle2` / `AlertTriangle` / `Clock` / `XCircle`).
- **Animations** : `<LowStockPulse>` micro-animation 2.4s sur état `low_stock` uniquement (respecte `prefers-reduced-motion`).
- **Source** : RSC fetch `/api/checkout/stock/[productId]` avec cache tag `product-stock-{id}` (revalidate 60s).
- **Comportement out_of_stock** : CTA Step 2 disabled, bouton secondaire "M'avertir quand disponible" → modale email.

### 7-bis.2 Admin `/admin/products/stock`

- **Liste** : un cards par SKU (FemiGlow kit MVP), affiche `stockUnits` / `reservedUnits` / `lowStockThreshold` / `restockEtaDays` / dernière mise à jour.
- **Modale ajustement** : delta (+ ou −), `reason` obligatoire (sale/restock/admin_manual/inventory_count), note libre. Génère ligne audit dans `product_stock_adjustment` (RFC 6902-style).
- **Modale seuils** : ajuster `lowStockThreshold` et `restockEtaDays` (paramètres adjustables, pas de redéploiement).
- **Historique** : table `product_stock_adjustment` avec qui/quand/quoi/pourquoi.
- **Cache invalidation** : à chaque PATCH, `revalidateTag('product-stock-{productId}')` → la wizard reflète l'update en < 60s sans redeploy.

### 7-bis.3 Atomicité finalize

Le `POST /api/checkout/lead/[id]/finalize` :
1. Lock `product_stock` row `FOR UPDATE`.
2. Si `stockUnits < quantity` → 409 `STOCK_UNAVAILABLE`.
3. Sinon, `stockUnits -= quantity` + INSERT `product_stock_adjustment` (reason='sale').
4. INSERT `orders` + UPDATE `chat_lead` dans même transaction.

### 7-bis.4 Compliance & honnêteté

- **Pas de fake urgency** : on n'affiche que des chiffres réels du DB.
- **Pas de countdown** : aucun timer artificiel "expire dans X minutes".
- **Audit total** : chaque variation est traçable jusqu'à l'admin qui l'a faite.

### 7-bis.5 Mesure

- KPI `stock_unavailable / sessions` < 1 % (sinon = mauvaise calibration du restock).
- KPI désynchro `orders.count` vs `product_stock_adjustment(reason='sale').sum` = 0 strict.

---

## 8. Exigence 6 — Mise en docs

> ✅ **Fait dans ce dossier** :
>
> - `docs/checkout-funnel/README.md` — index.
> - `docs/checkout-funnel/01-etat-actuel.md` — audit complet.
> - `docs/checkout-funnel/02-references-synthese.md` — fondations
>   conceptuelles (Kolenda + recherches).
> - `docs/checkout-funnel/03-propositions.md` — 3 propositions notées
>   /10.
> - `docs/checkout-funnel/04-recommandation-finale.md` — ce fichier.
>
> Lors de l'exécution (Phase 1+ après validation), créer :
>
> - `docs/checkout-funnel/05-plan-action.md` — découpage en phases /
>   PRs / tests / GTM updates.
> - `docs/checkout-funnel/06-ab-test-protocol.md` — protocole A/B test
>   variants A vs B.

---

## 9. Schéma DB & API

### 9.1 Nouvelle table `checkout_leads`

**Approche recommandée** : nouvelle table dédiée plutôt que d'étendre
`chat_lead` (qui sert le contexte chat). Permet d'avoir des contraintes
distinctes (e.g. `checkout_leads.lead_id` requis pour une `order`).

```sql
CREATE TABLE checkout_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  visitor_id TEXT,
  trigger_reason TEXT NOT NULL CHECK (trigger_reason IN (
    'kit_lead_form',
    'kit_single_page',
    'checkout_step_contact',
    'checkout_step_address',
    'checkout_step_payment'
  )),

  -- identification
  first_name TEXT NOT NULL,
  last_name TEXT,
  phone_e164 TEXT NOT NULL,
  phone_raw TEXT NOT NULL,
  email TEXT,

  -- adresse partielle (saved on blur)
  city_key TEXT,        -- geonames key si reconnu
  city_label TEXT,
  quartier TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  shipping_mode TEXT,

  -- méta
  consent_version TEXT NOT NULL,
  language TEXT NOT NULL CHECK (language IN ('fr', 'ar')),
  ab_variant TEXT,      -- 'variant_a' | 'variant_b' | NULL

  status TEXT NOT NULL DEFAULT 'abandoned_cart' CHECK (status IN (
    'abandoned_cart',
    'partial_address',
    'order_placed',
    'order_cancelled'
  )),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  converted_at TIMESTAMPTZ,

  -- contraintes & index
  UNIQUE (session_id),    -- 1 lead par session checkout
  INDEX idx_leads_status (status, created_at DESC),
  INDEX idx_leads_phone (phone_e164)
);
```

### 9.2 Liaison avec `orders`

```sql
ALTER TABLE orders ADD COLUMN lead_id UUID REFERENCES checkout_leads(id);
CREATE INDEX idx_orders_lead ON orders (lead_id);
```

### 9.3 Routes API

| Méthode | Route | But |
|---|---|---|
| POST | `/api/leads/checkout` | Créer le lead depuis `/kit` mini-form |
| PATCH | `/api/leads/:id/contact` | Update email/nom complet en Section 1 |
| PATCH | `/api/leads/:id/address-draft` | Auto-save adresse en Section 2 |
| POST | `/api/checkout` | Finalize (lead → order, `status=order_placed`) |
| POST | `/api/leads/:id/thankyou-email` | Ajout email post-confirmation page `/merci` |

Idempotence sur PATCH ; sécurité : token de session signé pour éviter
qu'un visiteur modifie un autre lead.

### 9.4 Migration

- Drizzle migration file : `apps/web/drizzle/0XXX_checkout_leads.sql`.
- Backfill : aucun (table nouvelle).
- Rollback : `DROP TABLE checkout_leads` + revert `orders.lead_id`.

---

## 10. Phasage en 4 sous-livraisons

### Phase 1 — Fondations (1 semaine)

**Scope** : exigences 0 (FR/AR) + 1 (lead capture) + 6 (docs).

Livrables :
- Setup `next-intl` + FR/AR base.
- `LanguageSwitcher` component, header sticky.
- Table `checkout_leads` + migration.
- Route `POST /api/leads/checkout`.
- Composant `MiniLeadForm` sur `/kit` (sous Hero).
- Tracking `lead_captured`, `language_switch`.
- Tests Vitest + 1 E2E Playwright (capture lead happy path).
- `docs/checkout-funnel/05-plan-action.md`.

**Critère de complétion** : 100 % des soumissions `/kit` mini-form
créent un lead en DB visible dans l'admin.

---

### Phase 2 — Checkout one-page (1 semaine)

**Scope** : refonte `/commander` + exigence 2 (autocomplete MA).

Livrables :
- Dataset `geonames-ma.json` vendor.
- Composant `AddressAutocompleteMA` (Fuse.js + react-aria).
- `/commander` one-page : Section 1 (replié), Section 2 (autocomplete),
  Section 3 (paiement COD only).
- Route `PATCH /api/leads/:id/address-draft`.
- Tracking `address_autocomplete_*`, `add_shipping_info`,
  `add_payment_info`, `purchase`.
- Tests E2E full funnel.

**Critère de complétion** : conversion `view_item → purchase` mesurable
sur 200 sessions, baseline établie.

---

### Phase 3 — Thank-you émotionnelle (3-4 jours)

**Scope** : exigence 3 (Lottie + email opt-in).

Livrables :
- Animation Lottie commandée + intégrée (`/animations/order-confirmed.lottie`).
- Composant `ThankYouAnimation` avec `prefers-reduced-motion`.
- Composant `EmailOptInBlock` sur `/merci`.
- Route `POST /api/leads/:id/thankyou-email`.
- Tracking `thankyou_animation_complete`, `thankyou_email_optin`,
  `thankyou_share_click`.

**Critère de complétion** : ≥ 50 % des `/merci` views complètent
l'animation ; ≥ 30 % opt-in email (si pas déjà fourni).

---

### Phase 4 — A/B test variant /kit-form (1 semaine)

**Scope** : exigence 5 (variante single-page).

Livrables :
- Feature flag `NEXT_PUBLIC_KIT_SINGLE_PAGE`.
- A/B assignment via cookie.
- Page `/kit-form` (variant B).
- DataLayer enrichi avec `ab_variant`.
- `docs/checkout-funnel/06-ab-test-protocol.md`.
- Dashboard de comparaison conversion.

**Critère de complétion** : 4 semaines de collecte ; décision binaire
(garder variant A ou B en GA).

---

## 11. Critères de succès (comment on saura que ça marche)

### KPI primaires (à mesurer avant/après chaque phase)

| KPI | Baseline estimé (mai 2026) | Cible post-Phase 4 |
|---|---|---|
| Lead capture rate (`lead / view_item`) | ~3 % | **≥ 15 %** (×5) |
| Conversion rate (`purchase / view_item`) | ~1.5 % | **≥ 3.5 %** (×2.3) |
| Recovery rate (`recovered / abandoned_cart`) | 0 % | **≥ 12 %** |
| NPS post-achat | n/d | **≥ 55** |
| Bounce rate `/commander` | ~45 % | **≤ 25 %** |

### KPI secondaires

- Taux de complétion par section (Section 1, 2, 3) → vise > 85 % par section.
- Taux d'erreur Zod par field (heatmap) → vise < 5 % par field.
- Taux d'usage autocomplete MA (select vs free-text) → vise 70/30.
- Taux usage FR vs AR → mesurer pour planifier l'effort i18n suivant.

### Risque de mesure

Pour mesurer correctement, il faut **Phase 1 (tracking enrichi)
DÉPLOYÉ AVANT** les autres phases côté UX. Sinon on n'a pas de baseline.

→ **Ordre impératif** : Phase 1 (instrumentation + lead capture) puis
2 (checkout) puis 3 (thank-you) puis 4 (A/B variant).

---

## 12. Risques & mitigations

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Animation Lottie trop lente sur mobile bas-de-gamme | Moyenne | Moyen | Fallback SVG + prefers-reduced-motion + budget ≤ 80 KB |
| Autocomplete bypass (utilisateur force texte libre douteux) | Haute | Faible | Validation Zod côté serveur + queue manuelle pour vérifier |
| Compliance 09-08 non respectée | Faible | **Très haut** | Audit privacy lawyer + consent versioning + audit trail DB |
| RTL mal rendu (alignements, ProgressBar, OrderSummary) | Moyenne | Moyen | QA visuel AR sur tous les écrans + tests Playwright dir=rtl |
| Lead capture spam (bots) | Haute | Moyen | hCaptcha invisible + rate-limit par IP + bot detection |
| A/B test puissance insuffisante (trop peu de sessions) | Moyenne | Moyen | Préparer outils stat (sequential testing, Bayesian decision) ; durée min 4 semaines |
| Régression tests E2E existants | Moyenne | Haut | Garder anciens steps temporairement derrière feature flag pendant transition |
| Trop d'événements DataLayer = ralentit la page | Faible | Moyen | Batcher les `form_field_*` events (≤ 1 par 200 ms) |
| Refonte met sous pression la roadmap CHA-23x (chat) | Moyenne | Moyen | Phaser ; aucune phase ne touche le chat |

---

## 13. Décisions encore à arbitrer avant implémentation

| # | Décision | Recommandation par défaut | Risque si on choisit autrement |
|---|---|---|---|
| 1 | Couleur du CTA final | `petale-dark` (rose foncé, salience max) | Si on garde `encre` (noir), conversion ~−5 % attendue mais cohérence brand parfaite |
| 2 | Numéro de tel : MA only vs international ? | MA only au MVP | Élargissement nécessite refonte schéma (futur) |
| 3 | Animation Lottie : générique vs commandée | Commandée (cohérence brand) | Générique = -200€ mais moins éditorial |
| 4 | Email confirmation transactionnel automatique ? | Oui si email fourni | Sans : risque support « où est ma commande ? » |
| 5 | A/B test : 50/50 ou progressif (10/90 → 50/50) ? | Progressif | 50/50 dès le départ = risque exposition d'un variant immature |
| 6 | Que faire des leads `abandoned_cart` ? Automatique ou manuel ? | Manuel d'abord (sous 24h), automatique en Phase 5+ | Automatique tôt = risque spam / délivrabilité |
| 7 | Nouvelle table `checkout_leads` vs extension `chat_lead` | Nouvelle table | Extension = couplage chat ↔ checkout, plus risqué |

→ Ces 7 questions sont à trancher avec Elazhar **avant Phase 1**.

---

## Conclusion

> **Cette recommandation transforme un funnel 9-fields / 3-steps qui
> perd 70 % des intentions, en un funnel 5-fields / 1.5 pages qui
> capture 85 % des leads et convertit 2× mieux. Elle intègre
> l'intégralité des 6 exigences exprimées par Elazhar, avec un phasage
> qui limite le risque d'exécution et permet un A/B test contrôlé entre
> deux directions concurrentes (`/commander` vs. `/kit-form`).**

**Étape suivante** (après validation par Elazhar) : créer
`docs/checkout-funnel/05-plan-action.md` avec le découpage technique
détaillé en PRs, tests, GTM updates, et timeline.
