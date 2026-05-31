# Spécification composants (frontend)

> Nommage volontairement agnostique (vanilla JS / HTMX / Alpine / Stimulus). À adapter.

## 1) ReviewsWallDrawer
- Props:
  - roomSlug
  - contextProductKey? (optionnel)
- State:
  - view: "list" | "form" | "how_verified"
  - filters: { hasPhotos?, rating?, tags[], productKey? }
  - sort: "recommended" | "recent" | "helpful" | "rating_desc"
  - cursor
  - loadedCount
  - totalCount
  - reviews[]
  - summary
- Events:
  - open
  - close
  - filter_change
  - load_more
  - open_product
  - open_lightbox
  - start_review_submit

## 2) ReviewsSummaryHeader
- affiche note, count, histogramme
- histogramme cliquable

## 3) FilterChipsBar
- chips scroll horizontal
- état actif visible

## 4) ReviewsList
- render ReviewCard
- skeleton loader
- empty state

## 5) ReviewCard
- head: avatar + name + city + date
- rating stars
- body
- tags
- thumbs
- CTA "Voir le produit" si productKey

## 6) LoadMore
- bouton + compteur
- disabled pendant loading

## 7) ReviewSubmitWizard
- multi-step
- inline validation
- upload photo

## 8) PhotoLightbox
- modal accessible
- swipe mobile

## Data-testid (recommandé)
- data-testid="reviews-wall"
- data-testid="reviews-summary"
- data-testid="reviews-filter-chip"
- data-testid="review-card"
- data-testid="review-photo-thumb"
- data-testid="reviews-load-more"
- data-testid="reviews-open-product"
- data-testid="review-form"
- data-testid="review-form-submit"
