-- ===========================================================================
-- Migration 0023 — delivery_cities
-- ---------------------------------------------------------------------------
-- DELIV-CITIES — Catalogue de villes de livraison (MA, future-proof multi-pays).
--
-- Pourquoi cette table ?
-- ----------------------
-- Avant CHA-231 phase finale, la liste des villes était hardcodée côté code
-- (`apps/web/src/lib/checkout/data/moroccan-cities.ts`, ~30 entrées). Pour :
--   - enrichir la couverture (500 records sendit → 429 villes uniques),
--   - exposer dynamiquement le délai de livraison (`delais`) au client,
--   - tarifer correctement la livraison par ville (MAD),
--   - permettre à l'admin d'ajouter / modifier / désactiver une ville sans
--     redéploiement,
--   - servir une autocomplétion API-driven (ILIKE FR + match AR),
-- on introduit une table dédiée alimentée par seed et éditable via /admin.
--
-- Source initiale : fixture export Django sendit
-- (`apps/web/data/seeds/delivery-cities-sendit.json`, 500 records, 429 villes
--  uniques après dedup par slug — règle métier validée : on garde le `pk`
--  le plus petit, considéré comme la source canonique côté legacy).
--
-- Champs métier
-- -------------
--   slug              : clé ASCII stable (lookup principal — slugify(name_fr))
--   name_fr / name_ar : libellés bilingues (Latin / Arabe)
--   country_code      : ISO 3166-1 alpha-2 (défaut 'MA')
--   delivery_price_mad: prix livraison en MAD entier (PAS centimes — règle
--                       produit ; on n'expose jamais MAD avec centimes côté UI)
--   delivery_eta      : bucket SLA libre (ex. "24h", "24h - 48h",
--                       "24h - 72h", "48h - 96h") — affiché tel quel côté UI
--   is_active         : flag soft de visibilité (admin peut masquer)
--   source            : provenance ('sendit' | 'manual' | 'custom') — pour
--                       savoir si une réimportation l'écraserait
--   external_ref      : clé externe (ex. "sendit:617" pour le `pk` Django) —
--                       audit / réconciliation
--   aliases           : JSONB array — alias supplémentaires matchables
--                       (ex. ["Casa", "Anfa"] pour Casablanca)
--   metadata          : JSONB libre (pour évolutions sans migration)
--   position          : ordre manuel (admin peut « épingler » Casablanca en 1er)
--
-- Indexes
-- -------
--   - UNIQUE(slug)              : lookup principal + upsert
--   - (is_active, name_fr)      : listing trié par nom (filtre actif)
--   - (country_code, is_active) : multi-pays
--   - lower(name_fr) text_pattern_ops : autocomplete préfixe FR insensible casse
--   - lower(name_ar)            : recherche AR insensible casse (où non-NULL)
--
-- Pas de pg_trgm en v1 (429 lignes — ILIKE direct suffit). À envisager si
-- volume × 10 ou requêtes substring loin du préfixe.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "delivery_cities" (
  "id" text PRIMARY KEY,
  "slug" text NOT NULL,
  "name_fr" text NOT NULL,
  "name_ar" text,
  "country_code" text NOT NULL DEFAULT 'MA',
  "delivery_price_mad" integer NOT NULL,
  "delivery_eta" text NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "source" text NOT NULL DEFAULT 'sendit',
  "external_ref" text,
  "aliases" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "position" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "created_by" text,
  "updated_by" text,
  CONSTRAINT "delivery_cities_price_nonneg" CHECK ("delivery_price_mad" >= 0),
  CONSTRAINT "delivery_cities_slug_nonempty" CHECK (length("slug") > 0),
  CONSTRAINT "delivery_cities_name_fr_nonempty" CHECK (length("name_fr") > 0),
  CONSTRAINT "delivery_cities_country_format" CHECK ("country_code" ~ '^[A-Z]{2}$'),
  CONSTRAINT "delivery_cities_source_enum"
    CHECK ("source" IN ('sendit', 'manual', 'custom'))
);

--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "delivery_cities_slug_unique"
  ON "delivery_cities" ("slug");

CREATE INDEX IF NOT EXISTS "delivery_cities_active_name_idx"
  ON "delivery_cities" ("is_active", "name_fr");

CREATE INDEX IF NOT EXISTS "delivery_cities_country_active_idx"
  ON "delivery_cities" ("country_code", "is_active");

-- Expression index pour autocomplétion FR sensible/insensible à la casse.
-- `text_pattern_ops` débloque l'utilisation de l'index pour `LIKE 'x%'`
-- même en collation non-C.
CREATE INDEX IF NOT EXISTS "delivery_cities_lower_name_idx"
  ON "delivery_cities" (lower("name_fr") text_pattern_ops);

-- Index partiel : ne couvre que les lignes avec name_ar renseigné.
CREATE INDEX IF NOT EXISTS "delivery_cities_lower_name_ar_idx"
  ON "delivery_cities" (lower("name_ar") text_pattern_ops)
  WHERE "name_ar" IS NOT NULL;

--> statement-breakpoint

COMMENT ON TABLE "delivery_cities" IS
  'Catalogue de villes de livraison (DELIV-CITIES). Seed initial sendit (MA).';
COMMENT ON COLUMN "delivery_cities"."slug" IS
  'Clé ASCII stable (slugify du nom FR). Identifiant métier durable.';
COMMENT ON COLUMN "delivery_cities"."delivery_price_mad" IS
  'Prix de livraison en MAD (entier, PAS centimes — règle produit).';
COMMENT ON COLUMN "delivery_cities"."delivery_eta" IS
  'Bucket SLA texte : ex. "24h", "24h - 48h", "24h - 72h", "48h - 96h".';
COMMENT ON COLUMN "delivery_cities"."source" IS
  'Provenance : sendit (import auto) | manual (admin UI) | custom (autre).';
COMMENT ON COLUMN "delivery_cities"."external_ref" IS
  'Référence externe : ex. "sendit:617" pour traçabilité.';
COMMENT ON COLUMN "delivery_cities"."aliases" IS
  'JSONB array<string> — alias additionnels matchables côté autocomplete.';
