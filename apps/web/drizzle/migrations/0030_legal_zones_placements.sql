-- ===========================================================================
-- Migration 0030 — Legal zones + placements
-- ---------------------------------------------------------------------------
-- Crée le catalogue fermé des zones (footer, cookie banner, checkout, ...)
-- et la matrice (page × zone) avec ordre + visibilité + label override.
-- Inclut le seed des 7 zones par défaut.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "legal_zones" (
  "key"                    text PRIMARY KEY
    CHECK (key ~ '^[a-z0-9-]+$' AND length(key) BETWEEN 2 AND 50),
  "label"                  text NOT NULL,
  "description"            text,
  "max_items_recommended"  integer NOT NULL DEFAULT 5
    CHECK (max_items_recommended BETWEEN 1 AND 20),
  "is_required"            boolean NOT NULL DEFAULT FALSE,
  "display_order"          integer NOT NULL DEFAULT 0,
  "created_at"             timestamp with time zone NOT NULL DEFAULT now()
);

INSERT INTO "legal_zones"
  ("key", "label", "description", "max_items_recommended", "is_required", "display_order")
VALUES
  ('footer-main',         'Footer — colonne légale',   'Liens légaux dans la colonne dédiée du footer principal',                                  8, TRUE,  1),
  ('footer-bottom-bar',   'Footer — ligne en bas',     'Ligne © FemiGlow · Mentions légales · CGV',                                                 3, FALSE, 2),
  ('cookie-banner-links', 'Bannière cookies — liens',  'Liens vers politique cookies + confidentialité dans la bannière de consentement',          2, FALSE, 3),
  ('checkout-consent',    'Checkout — acceptation',    'Liens "J''accepte les CGV et la politique de retour" au checkout',                          2, TRUE,  4),
  ('signup-consent',      'Signup — acceptation',      'Lien vers politique de confidentialité au formulaire d''inscription',                       1, FALSE, 5),
  ('mobile-menu',         'Menu burger mobile',        'Pages affichées dans le menu hamburger mobile',                                            5, FALSE, 6),
  ('chat-disclaimer',     'Chat — disclaimer pied',    'Lien CGU ou politique de confidentialité au pied du chat widget',                          1, FALSE, 7)
ON CONFLICT ("key") DO NOTHING;


CREATE TABLE IF NOT EXISTS "legal_page_placements" (
  "page_slug"      text NOT NULL REFERENCES "legal_pages"("slug")
                     ON UPDATE CASCADE ON DELETE CASCADE,
  "zone_key"       text NOT NULL REFERENCES "legal_zones"("key")
                     ON UPDATE CASCADE ON DELETE RESTRICT,
  "display_order"  integer NOT NULL DEFAULT 0,
  "is_visible"     boolean NOT NULL DEFAULT TRUE,
  "label_override" text
                     CHECK (label_override IS NULL OR length(label_override) BETWEEN 1 AND 80),
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"     timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("page_slug", "zone_key")
);

CREATE INDEX IF NOT EXISTS "idx_placements_zone_order"
  ON "legal_page_placements" ("zone_key", "display_order")
  WHERE "is_visible" = TRUE;
