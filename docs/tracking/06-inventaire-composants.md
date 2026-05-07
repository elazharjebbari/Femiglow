# 06 — Inventaire des composants & événements applicables

Source : scan du codebase (`apps/web/src`) au 2026-05-03.

Convention : pour chaque composant, on liste les **événements
pertinents** (selon GA4 / data.ga4spy.com + extensions FemiGlow) et
on indique la **priorité d'instrumentation** :

- **P0** : critique (conversion ou pré-conversion). À activer day-1.
- **P1** : engagement de qualité (lecture, lecture vidéo, scroll).
- **P2** : nice-to-have (vues passives, exposition).

## 1. Catégories de composants & events applicables

| Catégorie | Events applicables (GA4 + FG) |
|---|---|
| `cta_primary` | `select_promotion`, `add_to_cart`, `begin_checkout`, `generate_lead`, `cta_click` (custom) |
| `cta_secondary` | `select_content`, `cta_click` |
| `cta_ghost` | `select_content` |
| `navigation` | `select_content`, `nav_click` (custom) |
| `form_input` | `form_field_focus`, `form_field_complete` |
| `form_submit` | `generate_lead`, `sign_up`, `form_submit`, `form_error` |
| `media_image` | `view_promotion` (si bannière), `select_promotion` (si cliquable) |
| `media_video` | `video_start`, `video_progress` (25/50/75/100), `video_complete` |
| `media_audio` | `audio_start`, `audio_progress`, `audio_complete` |
| `list_item` | `select_item` |
| `card` | `view_item` (impression), `select_item` |
| `pricing` | `view_item`, `select_item`, `select_promotion` |
| `filter` | `view_search_results`, `filter_apply` (custom) |
| `search` | `search`, `view_search_results` |
| `social_share` | `share` |
| `newsletter` | `generate_lead` (`method=newsletter`), `sign_up` |
| `modal` | `modal_open`, `modal_close`, `modal_action` (custom) |
| `accordion` | `select_content` (open) |
| `tab` | `select_content` |
| `carousel` | `view_promotion` (slide visible), `select_promotion` |
| `progress` | `engagement_progress` (custom) |
| `banner` | `view_promotion`, `select_promotion`, `dismiss_promotion` |
| `section_hero` | `view_promotion`, `select_promotion`, `scroll_depth` |
| `section_content` | `scroll_depth`, `fg_section_view` (custom) |
| `section_testimonial` | `view_item_list` (testimonials), `select_item` |
| `section_faq` | `select_content` (open question), `fg_faq_view` |
| `commerce_cart` | `view_cart`, `remove_from_cart`, `quantity_change` |
| `commerce_checkout` | `begin_checkout`, `add_shipping_info`, `add_payment_info`, `purchase`, `refund` |
| `admin` | (no public tracking — admin events go to audit_events) |

## 2. Inventaire détaillé par dossier

### 2.1 `src/components/sections/` (54 composants)

#### Article & Journal

| Composant | Catégorie | Events P0 | Events P1 | Events P2 |
|---|---|---|---|---|
| `ArticleCard` | card | `select_item` | `view_item_list` | – |
| `ArticleGrid` | list_item | – | `view_item_list` | – |
| `ArticleHero` | section_hero | – | `view_promotion`, `scroll_depth` | – |
| `ArticleMeta` | section_content | – | – | `select_content` (auteur) |
| `ArticleProse` | section_content | – | `scroll_depth`, `fg_journal_read_75` (custom) | – |
| `JournalExtraits` | carousel | – | `view_promotion`, `select_promotion` | – |
| `JournalGrid` | list_item | – | `view_item_list` | – |
| `JournalHero` | section_hero | – | `view_promotion` | – |
| `FeaturedArticle` | card | `select_item` | `view_item` | – |
| `ReadingProgress` | progress | – | `fg_journal_read_75` (75%), `fg_journal_read_100` | – |
| `RelatedArticles` | list_item | – | `view_item_list`, `select_item` | – |
| `TableOfContents` | navigation | – | `select_content` (toc_click) | – |
| `ShareButtons` | social_share | – | `share` | – |
| `AuthorCard` | card | – | – | `select_content` |

#### Homepage

| Composant | Catégorie | Events P0 | Events P1 | Events P2 |
|---|---|---|---|---|
| `Hero` | section_hero | `select_promotion` | `view_promotion`, `scroll_depth` | – |
| `GestesGrid` | carousel | – | `view_promotion`, `select_promotion` | – |
| `Manifeste` | section_content | – | `scroll_depth` | – |
| `AvisStrip` | section_testimonial | – | `view_item_list` | – |
| `NewsletterBlock` | newsletter | `generate_lead` (`method=newsletter`) | – | – |
| `CrossLinks` | navigation | `select_content` | – | – |
| `CategoryPills` | filter | – | `filter_apply` (custom) | – |
| `CrossLinkBanner` | banner | – | `view_promotion`, `select_promotion` | – |
| `CrossLinkCard` | card | – | `select_item` | – |
| `CrossLinkTriptyque` | carousel | – | `view_promotion`, `select_promotion` | – |

#### Maison

| Composant | Catégorie | Events P0 | Events P1 | Events P2 |
|---|---|---|---|---|
| `HeroMaison` | section_hero | – | `view_promotion`, `scroll_depth` | – |
| `SectionNarrative` | section_content | – | `scroll_depth` | – |
| `MatiereCard` | card | – | `select_item` | – |
| `MatieresGrid` | list_item | – | `view_item_list` | – |
| `EngagementsGrid` | list_item | – | `view_item_list` | – |
| `EngagementCard` | card | – | `select_item` | – |
| `AtelierGallery` | carousel | – | `view_promotion`, `select_promotion` | – |

#### Commerce (sections)

| Composant | Catégorie | Events P0 | Events P1 | Events P2 |
|---|---|---|---|---|
| `HeroProduit` | section_hero | `view_item` (impression) | `view_promotion`, `scroll_depth` | – |
| `CompositionReveal` | accordion | – | `select_content`, `fg_composition_open` | – |
| `IngredientsDetails` | accordion | – | `select_content` | – |
| `IngredientsTable` | section_content | – | `select_content` | – |
| `ComparatifSection` | section_content | – | `scroll_depth`, `fg_comparatif_view` | – |
| `ComparatifTable` | section_content | – | `select_content` | – |
| `FAQContextuelle` | section_faq | – | `select_content`, `fg_faq_view` | – |
| `FAQAccordion` | accordion | – | `select_content` | – |
| `HandsTestimonials` | section_testimonial | – | `view_item_list` | – |
| `HandsTestimonialCarousel` | carousel | – | `select_item` | – |
| `PivotBanner` | banner | `select_promotion` | `view_promotion` | – |
| `PivotFinal` | banner | `select_promotion` | `view_promotion` | – |

#### Rituel

| Composant | Catégorie | Events P0 | Events P1 | Events P2 |
|---|---|---|---|---|
| `HeroLifestyle` | section_hero | – | `view_promotion`, `scroll_depth` | – |
| `SciencesDuSoin` | section_content | – | `scroll_depth` | – |
| `VideoPlayer4Gestes` | media_video | `video_complete` | `video_start`, `video_progress` | – |
| `PreparationGesture` | section_content | – | `scroll_depth` | – |
| `TimelineSteps` | section_content | – | `select_content`, `fg_timeline_step` | – |

#### Cart / Order

| Composant | Catégorie | Events P0 | Events P1 | Events P2 |
|---|---|---|---|---|
| `CartHero` | section_hero | – | `view_promotion` | – |
| `TrustSignals` | banner | – | – | `view_promotion` |
| `JournalCrossLink` | banner | – | `select_promotion` | – |
| `OrderHero` | section_hero | – | `view_promotion` | – |
| `OrderRecap` | section_content | – | `view_item_list` | – |

#### Contact

| Composant | Catégorie | Events P0 | Events P1 | Events P2 |
|---|---|---|---|---|
| `ContactHero` | section_hero | – | `view_promotion` | – |
| `ContactCrossLinks` | navigation | – | `select_content` | – |
| `DirectContactBlock` | banner | – | `select_content` | – |
| `EditorialLetter` | section_content | – | `scroll_depth` | – |

### 2.2 `src/components/commerce/` (33 composants)

| Composant | Catégorie | Events P0 | Events P1 | Events P2 |
|---|---|---|---|---|
| `CheckoutPage` | commerce_checkout | `begin_checkout` | – | – |
| `CheckoutFlow` | commerce_checkout | `begin_checkout`, `add_shipping_info`, `add_payment_info` | – | – |
| `InfoStep` | form_input | – | `form_field_focus`, `form_field_complete` | – |
| `AddressStep` | form_input | `add_shipping_info` | `form_field_focus` | – |
| `PaymentStep` | form_input | `add_payment_info` | `form_field_focus` | – |
| `CartLayout` | commerce_cart | `view_cart` | – | – |
| `CartContents` | commerce_cart | – | `view_item_list` | – |
| `CartItem` | commerce_cart | – | `select_item` | – |
| `CartSummary` | commerce_cart | – | – | `view_cart` |
| `CartButton` | cta_primary | – | `select_content` | – |
| `CartSkeleton` | – | – | – | – |
| `EmptyCartState` | banner | – | – | `view_promotion` |
| `MiniCartSlideOver` | modal | – | `modal_open`, `modal_close` | – |
| `PaymentMethodSelector` | form_input | – | `form_field_complete` | – |
| `ShippingModeSelector` | form_input | `add_shipping_info` | `form_field_complete` | – |
| `PromoCodeInput` | form_input | – | `select_promotion` (apply) | – |
| `QuantitySelector` | form_input | – | `quantity_change` (custom) | – |
| `TermsCheckbox` | form_input | – | `form_field_complete` | – |
| `OrderSummaryAccordion` | accordion | – | `select_content` | – |
| `OrderSummarySticky` | banner | – | `view_promotion` | – |
| `ProgressBar3Steps` | progress | – | `engagement_progress` | – |
| `MobileCheckoutBar` | banner | – | – | `view_promotion` |
| `LeaveCheckoutModal` | modal | – | `modal_open`, `modal_close`, `dismiss_promotion` | – |
| `PaymentLoadingOverlay` | – | – | – | – |
| `ErrorBanner` | banner | – | `form_error` (custom) | – |
| `ProductCard` | card | – | `view_item`, `select_item` | – |
| `AddToCartButton` | cta_primary | `add_to_cart` | – | – |
| `MerciOrchestrator` | commerce_checkout | `purchase` | – | – |

### 2.3 `src/components/admin/`

Pas de tracking publique. Tracking interne via `audit_events` (déjà
existant). Cependant, on peut tracker des **events admin** pour
mesurer l'usage de la console (events `fg_admin_*`) :

| Composant | Events potentiels |
|---|---|
| `AdminShell` | `fg_admin_nav` |
| `LoginForm` | `fg_admin_login_attempt`, `fg_admin_login_success` |
| `MediaUploadForm` | `fg_admin_media_upload` |
| `WebhookCreateForm` | `fg_admin_webhook_create` |
| `LeadStatusMenu` | `fg_admin_lead_status_change` |

Optionnel — Phase 7.

### 2.4 `src/components/forms/`

| Composant | Catégorie | Events P0 | Events P1 |
|---|---|---|---|
| `Field` | form_input | – | `form_field_focus` |
| `NewsletterForm` | newsletter | `generate_lead` (`method=newsletter`) | – |
| `ContactForm` | form_submit | `generate_lead` (`method=contact`) | `form_field_complete`, `form_error` |
| `FormTypeSelector` | form_input | – | `form_field_complete` |
| `ErrorState` | banner | – | `form_error` |
| `SuccessState` | banner | – | `form_submit_success` (custom) |

### 2.5 `src/components/layout/`

| Composant | Catégorie | Events P1 | Events P2 |
|---|---|---|---|
| `Header` | navigation | `select_content` (menu items) | – |
| `CommerceHeader` | navigation | `select_content` | – |
| `CheckoutHeader` | navigation | – | – |
| `Footer` | navigation | `select_content` | – |
| `FooterMinimal` | navigation | `select_content` | – |
| `SkipLink` | navigation | – | – |
| `SommaireOverlay` | modal | `modal_open`, `select_content` | – |

### 2.6 `src/components/ui/` (composants atomiques)

Pas de tracking direct sur les atomes (Button, Heading, etc.) sauf
via les composants qui les utilisent. Exceptions :

- `Toast` : `fg_toast_shown` (custom), pour mesurer feedbacks UX.
- `ConfirmationModal` : `modal_open`, `modal_action` (confirm/cancel).

### 2.7 `src/components/patterns/`

| Composant | Events P1 |
|---|---|
| `Reveal` | – (effet décoratif) |
| `ScrollProgress` | `scroll_depth` |
| `Footnote` | `select_content` |
| `SchemaSVG` | – |

### 2.8 `src/components/media/`

(Composants `<MediaImage>`, `<MediaVideo>`, `<MediaAudio>` du module
media — voir `docs/media/`.)

| Composant | Catégorie | Events P0 | Events P1 |
|---|---|---|---|
| `MediaImage` | media_image | – | – (l'event vient du composant englobant) |
| `MediaVideo` | media_video | `video_complete` | `video_start`, `video_progress` |
| `MediaAudio` | media_audio | `audio_complete` | `audio_start`, `audio_progress` |

## 3. Couverture par page

| Page | Components instrumentés (P0) | P0 actifs |
|---|---|---|
| `/` | NewsletterBlock, Hero(select_promotion), CrossLinkCard | 3 |
| `/journal` | – | 0 (engagement uniquement) |
| `/journal/[slug]` | ShareButtons, ReadingProgress | 1 |
| `/maison` | – | 0 |
| `/contact` | ContactForm | 1 |
| `/kit` | HeroProduit (view_item), AddToCartButton, PivotBanner, PivotFinal | 4 |
| `/rituel` | VideoPlayer4Gestes (video_complete), PivotBanner | 2 |
| `/panier` | CartLayout (view_cart), CartItem | 1 |
| `/commander` | CheckoutFlow (begin_checkout, add_shipping_info, add_payment_info) | 3 |
| `/merci` | MerciOrchestrator (purchase) | 1 |

**Funnel principal** :  
`/kit` view_item → `/kit` add_to_cart → `/panier` view_cart →  
`/commander` begin_checkout → add_shipping_info → add_payment_info →  
`/merci` purchase

→ 7 events critiques sur le chemin de conversion principal.

## 4. Heuristiques de catégorisation automatique

Le scanner catégorise via heuristiques (Phase 1) puis la fondatrice
peut affiner manuellement. Règles :

| Pattern dans nom/path | Catégorie inférée |
|---|---|
| `/Hero` | section_hero |
| `/Card$` | card |
| `/Grid$|/List$` | list_item |
| `/Form$` | form_submit |
| `/Button$` | cta_primary |
| `/Modal$` | modal |
| `/Carousel$` | carousel |
| `/Accordion$|Reveal$` | accordion |
| `/Banner$|Sticky$` | banner |
| `/FAQ` | section_faq |
| `/Testimonial|Avis` | section_testimonial |
| `/Cart` | commerce_cart |
| `/Checkout|Payment|Address` | commerce_checkout |
| `/Newsletter` | newsletter |
| `/Header|Footer|Nav|CrossLink` | navigation |
| `/Search|Filter` | search/filter |
| `/Share` | social_share |
| `/Video` | media_video |
| `/Audio` | media_audio |
| `/Section` | section_content |

Si aucune règle ne matche, fallback `section_content` + flag à
revoir manuellement.

## 5. Override manuel

Une convention permet d'override la catégorie en code :

```tsx
// HeroProduit.tsx
/** @tracking-category section_hero */
/** @tracking-events view_promotion select_promotion view_item */
export function HeroProduit({ … }) { … }
```

Le scanner lit ces JSDoc et privilégie la valeur déclarée.
