# Frontend - Component tree

## Reviews wall (drawer)
- ReviewsWallDrawer
  - ReviewsHeader
  - ReviewsSummary
    - RatingStars
    - RatingCount
    - RatingHistogram
    - TagInsightsBars
  - ReviewsControls
    - FilterChipsBar
    - SortSelect
  - ReviewsList
    - ReviewCard*
      - ReviewMeta
      - ReviewBody
      - ReviewTags
      - ReviewPhotosThumbs
      - ReviewProductCTA
    - LoadMore
  - ReviewsFooterSticky
    - CTAWriteReview
    - CTAOpenProduct

## Review form
- ReviewSubmitWizard
  - StepRatingAndBody
  - StepOptionalDetails
  - StepIdentity
  - Submit
  - Confirmation

## Lightbox
- PhotoLightbox
