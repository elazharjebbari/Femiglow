# 07 — Catalogue d'événements

Source de vérité : [data.ga4spy.com/ga4-events-parameters](https://data.ga4spy.com/ga4-events-parameters)
+ extensions FemiGlow (préfixe `fg_`).

Chaque event est :

- conservé en **constante TS typée** (`src/lib/tracking/event-catalog.ts`),
- inséré en BDD au seed (`tracking_event_definitions`),
- associé à un schéma Zod (paramètres requis vs optionnels),
- mappé vers les noms propriétaires des providers (cf
  [08-providers-pixels.md](08-providers-pixels.md)).

## 1. Convention

```ts
type EventDef = {
  name: string;
  category: 'page' | 'engagement' | 'ecommerce' | 'lead' | 'media' | 'admin' | 'custom';
  scope: 'web' | 'server' | 'both';
  isConversion: boolean;
  description: string;       // FR
  params: Record<string, ParamDef>;
  applicableCategories: ComponentCategory[];
  defaultProviders: ProviderKind[];
};

type ParamDef = {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  description: string;
  example?: unknown;
};
```

## 2. Events page (1)

### `page_view`
- **catégorie** : page
- **scope** : both
- **conversion** : non
- **description** : Visite d'une page (rendu + hydration ou changement
  de route SPA).
- **params requis** : `page_location` (string), `page_path` (string),
  `page_title` (string).
- **params optionnels** : `page_referrer` (string), `language` (string).
- **providers** : meta (PageView), tiktok (Pageview), google_ga4
  (page_view auto), snap (PAGE_VIEW), pinterest (pagevisit).

## 3. Events engagement (10)

### `scroll_depth`
- **catégorie** : engagement
- **scope** : web
- **description** : profondeur de scroll par bucket (25/50/75/90).
- **params requis** : `percent_scrolled` (25 | 50 | 75 | 90).
- **providers** : google_ga4.

### `click`
- **catégorie** : engagement
- **scope** : web
- **description** : click générique sur lien externe ou élément
  trackable sans event spécifique.
- **params requis** : `link_url` (string).
- **params optionnels** : `link_domain`, `link_id`, `outbound`
  (boolean).
- **providers** : google_ga4.

### `select_content`
- **catégorie** : engagement
- **scope** : web
- **description** : sélection d'un contenu non-commerce (lien menu,
  toc, accordion).
- **params requis** : `content_type` (string), `content_id` (string).
- **providers** : google_ga4.

### `share`
- **catégorie** : engagement
- **scope** : web
- **description** : partage social.
- **params requis** : `method` (`facebook` | `twitter` | `linkedin` |
  `whatsapp` | `email` | `copy_link`), `content_type`, `item_id`.
- **providers** : google_ga4, meta (custom event), tiktok.

### `search`
- **catégorie** : engagement
- **scope** : web
- **description** : recherche interne.
- **params requis** : `search_term` (string).
- **providers** : google_ga4, meta (Search), tiktok (Search).

### `view_search_results`
- **catégorie** : engagement
- **description** : vue de la page résultats.
- **params requis** : `search_term`.
- **providers** : google_ga4.

### `video_start`, `video_progress`, `video_complete`
- **catégorie** : engagement
- **scope** : web
- **params requis** : `video_title` (string), `video_provider`
  (string), `video_duration` (number, sec), `video_current_time`
  (number, sec), `video_percent` (0..100).
- **providers** : google_ga4.

### `file_download`
- **catégorie** : engagement
- **description** : téléchargement (PDF guide, etc.).
- **params requis** : `file_name`, `file_extension`, `link_url`.
- **providers** : google_ga4.

### `form_start`, `form_submit`, `form_field_focus`, `form_field_complete`, `form_error` (custom)
- **catégorie** : engagement
- **scope** : web
- **description** : étapes d'interaction avec un formulaire.
- **params requis** : `form_id`, `form_destination`.
- **providers** : google_ga4.

## 4. Events e-commerce (12) — selon GA4 Enhanced E-commerce

### `view_item_list`
- **scope** : both
- **params requis** : `item_list_id`, `item_list_name`, `items[]`.
- **items[]** : tableau d'`Item` (cf §6).
- **providers** : meta (ViewContent batch), tiktok, google_ga4.

### `select_item`
- **scope** : both
- **params requis** : `item_list_id`, `item_list_name`, `items[]`.
- **providers** : google_ga4.

### `view_item`
- **scope** : both
- **conversion** : non (mais signal fort).
- **params requis** : `currency` (ISO 4217), `value` (number),
  `items[]`.
- **providers** : meta (ViewContent), tiktok (ViewContent), google_ga4,
  snap (VIEW_CONTENT), pinterest (pagevisit + view_category).

### `add_to_cart`
- **scope** : both
- **conversion** : non (mais critique pour audiences).
- **params requis** : `currency`, `value`, `items[]`.
- **providers** : meta (AddToCart), tiktok (AddToCart), google_ga4,
  snap (ADD_CART), pinterest (addtocart).

### `remove_from_cart`
- **scope** : web
- **params requis** : `currency`, `value`, `items[]`.
- **providers** : google_ga4.

### `view_cart`
- **scope** : web
- **params requis** : `currency`, `value`, `items[]`.
- **providers** : google_ga4, meta (ViewContent).

### `begin_checkout`
- **scope** : both
- **conversion** : ✓
- **params requis** : `currency`, `value`, `items[]`.
- **params optionnels** : `coupon`.
- **providers** : meta (InitiateCheckout), tiktok (InitiateCheckout),
  google_ga4, snap (START_CHECKOUT), pinterest (checkout).

### `add_shipping_info`
- **scope** : both
- **params requis** : `currency`, `value`, `items[]`, `shipping_tier`.
- **providers** : google_ga4, meta (AddShippingInfo).

### `add_payment_info`
- **scope** : both
- **params requis** : `currency`, `value`, `items[]`, `payment_type`.
- **providers** : google_ga4, meta (AddPaymentInfo), tiktok
  (AddPaymentInfo).

### `purchase`
- **scope** : both
- **conversion** : ✓
- **params requis** : `transaction_id`, `currency`, `value`, `items[]`.
- **params optionnels** : `tax`, `shipping`, `coupon`, `affiliation`.
- **providers** : meta (Purchase), tiktok (CompletePayment),
  google_ga4, snap (PURCHASE), pinterest (checkout).

### `refund`
- **scope** : server
- **params requis** : `transaction_id`, `currency`, `value`.
- **providers** : google_ga4.

### `view_promotion`
- **scope** : web
- **params requis** : `promotion_id`, `promotion_name`.
- **params optionnels** : `creative_name`, `creative_slot`,
  `location_id`.
- **providers** : google_ga4.

### `select_promotion`
- **scope** : web
- **params requis** : `promotion_id`, `promotion_name`.
- **providers** : google_ga4.

## 5. Events leads (3)

### `generate_lead`
- **scope** : both
- **conversion** : ✓
- **description** : prospect identifié (newsletter, contact, RDV).
- **params requis** : `method` (`newsletter` | `contact` |
  `appointment` | `download`).
- **params optionnels** : `value`, `currency`, `lead_id`,
  `email_sha256`, `phone_sha256`, `first_name_sha256`,
  `last_name_sha256`.
- **providers** : meta (Lead), tiktok (Contact), google_ga4
  (`generate_lead`), snap (LEAD), pinterest (lead), google_ads
  (conversion lead).

### `sign_up`
- **scope** : both
- **conversion** : ✓ (compte créé).
- **params requis** : `method`.
- **providers** : meta (CompleteRegistration), tiktok
  (CompleteRegistration), google_ga4.

### `login`
- **scope** : both
- **params requis** : `method`.
- **providers** : google_ga4.

## 6. Schéma `Item` (e-commerce)

```ts
type Item = {
  item_id: string;            // SKU
  item_name: string;
  affiliation?: string;
  coupon?: string;
  currency?: string;
  discount?: number;
  index?: number;             // position dans la liste
  item_brand?: string;
  item_category?: string;
  item_category2?: string;
  item_list_id?: string;
  item_list_name?: string;
  item_variant?: string;
  location_id?: string;
  price: number;
  quantity: number;
};
```

## 7. Events FemiGlow custom (préfixe `fg_`) (10)

| Nom | Catégorie | Description | Params requis |
|---|---|---|---|
| `fg_journal_read_75` | engagement | Article lu à 75% | `article_id`, `article_slug`, `reading_time_seconds` |
| `fg_journal_read_100` | engagement | Article lu jusqu'à la fin | idem |
| `fg_section_view` | engagement | Section "vue" (visible IO ≥ 50%) | `page_path`, `section_id`, `section_name` |
| `fg_faq_view` | engagement | FAQ ouverte | `question_id`, `question_text` |
| `fg_composition_open` | engagement | Composition produit dépliée | `item_id` |
| `fg_comparatif_view` | engagement | Section comparatif vue | `item_id` |
| `fg_timeline_step` | engagement | Étape du rituel cliquée | `step_id`, `step_index` |
| `fg_pixel_test` | admin | Event de test envoyé depuis console | `provider`, `dry_run` (boolean) |
| `fg_admin_action` | admin | Action admin (audit complémentaire) | `action`, `resource_type`, `resource_id` |
| `fg_consent_change` | admin | Changement de consentement | `from_state`, `to_state`, `source` |

Tous custom events ont **scope `web`**, **non-conversion**, et
**providers** par défaut **google_ga4** uniquement (les plateformes
pub n'ont pas de mapping natif et il vaut mieux ne pas spammer).

## 8. Mapping events → providers (extrait)

Tableau complet dans [08-providers-pixels.md](08-providers-pixels.md).

| GA4 event | Meta | TikTok | Snap | Pinterest |
|---|---|---|---|---|
| page_view | PageView | Pageview | PAGE_VIEW | pagevisit |
| view_item | ViewContent | ViewContent | VIEW_CONTENT | pagevisit |
| add_to_cart | AddToCart | AddToCart | ADD_CART | addtocart |
| begin_checkout | InitiateCheckout | InitiateCheckout | START_CHECKOUT | checkout |
| add_payment_info | AddPaymentInfo | AddPaymentInfo | – | – |
| purchase | Purchase | CompletePayment | PURCHASE | checkout |
| generate_lead | Lead | Contact / SubmitForm | LEAD | lead |
| sign_up | CompleteRegistration | CompleteRegistration | SIGN_UP | signup |
| search | Search | Search | – | search |
| share | (custom) | (custom) | – | – |

## 9. Schémas Zod (exemple pour deux events)

```ts
// src/lib/tracking/schemas.ts
import { z } from 'zod';

export const itemSchema = z.object({
  item_id: z.string().min(1).max(64),
  item_name: z.string().min(1).max(120),
  affiliation: z.string().max(60).optional(),
  coupon: z.string().max(40).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  discount: z.number().nonnegative().optional(),
  index: z.number().int().nonnegative().optional(),
  item_brand: z.string().max(60).optional(),
  item_category: z.string().max(60).optional(),
  item_category2: z.string().max(60).optional(),
  item_list_id: z.string().max(60).optional(),
  item_list_name: z.string().max(120).optional(),
  item_variant: z.string().max(60).optional(),
  location_id: z.string().max(60).optional(),
  price: z.number().nonnegative(),
  quantity: z.number().int().positive(),
});

export const purchaseParamsSchema = z.object({
  transaction_id: z.string().min(1).max(80),
  currency: z.string().regex(/^[A-Z]{3}$/),
  value: z.number().nonnegative(),
  items: z.array(itemSchema).min(1).max(50),
  tax: z.number().nonnegative().optional(),
  shipping: z.number().nonnegative().optional(),
  coupon: z.string().max(40).optional(),
  affiliation: z.string().max(60).optional(),
});

export const generateLeadParamsSchema = z.object({
  method: z.enum(['newsletter', 'contact', 'appointment', 'download']),
  value: z.number().nonnegative().optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  lead_id: z.string().max(80).optional(),
  email_sha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  phone_sha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
});
```

## 10. Validation côté serveur

`/api/track` :

1. Trouve la définition d'event par nom.
2. Charge le schéma Zod (cache LRU).
3. Valide `payload`.
4. Enregistre uniquement les events valides ; rejette le reste avec
   `skipped[]` dans la réponse.

Comportement strict : un event invalide ne fait pas échouer le batch
entier, il est simplement ignoré. Cela évite qu'un bug client casse
toute la collecte.

## 11. Ajout d'un event custom

Procédure :

1. Ajouter l'entrée dans `src/lib/tracking/event-catalog.ts`.
2. Ajouter le schéma Zod dans `src/lib/tracking/schemas.ts`.
3. Ajouter le mapping providers dans
   `src/lib/tracking/providers/event-mapping.ts`.
4. Ajouter un test dans `src/lib/tracking/event-catalog.test.ts`.
5. `pnpm tsx scripts/seed-tracking.ts` (idempotent).
6. Le composant qui doit l'émettre l'appelle via `useTracking().emit`.

Pas besoin de migration BDD : les events sont stockés comme JSON,
pas comme colonnes.

## 12. Versioning du schéma

Tous les events portent `schema_version: 1`. Si on doit casser le
schéma plus tard (ex : refactor d'`Item`), on bump à `2`. Le serveur
accepte les deux versions pendant une période de transition (3 mois
en pratique, le temps que tous les caches client expirent).
