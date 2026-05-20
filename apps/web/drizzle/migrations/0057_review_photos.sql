-- ---------------------------------------------------------------------------
-- Migration 0057 — `product_review_photos`
-- ---------------------------------------------------------------------------
-- Photos clientes affichées dans la galerie hero produit (cf. HeroGallery /
-- docs/kit-hero-optim/02-architecture.md §2.2).
--
-- Chaque ligne représente une photo :
--   - soit liée à une review (`review_id` rempli) — alimentée par le futur
--     workflow d'avis avec upload,
--   - soit orpheline (`review_id` null) — alimentée par le seed CLI qui
--     scanne `/public/reviews/*.jpg`. C'est le mode V1 (data déjà présente).
--
-- L'admin peut réordonner via `display_order`, masquer via `status='archived'`
-- et ajuster la metadata d'attribution (`reviewer_initials`, `reviewer_city`).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS product_review_photos (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  review_id TEXT,
  src TEXT NOT NULL,
  alt TEXT NOT NULL DEFAULT 'Photo cliente',
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  blur_data_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft', 'published', 'archived')),
  reviewer_initials TEXT,
  reviewer_city TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_photos_product
  ON product_review_photos (product_id, status, display_order);

CREATE INDEX IF NOT EXISTS idx_review_photos_review
  ON product_review_photos (review_id)
  WHERE review_id IS NOT NULL;
