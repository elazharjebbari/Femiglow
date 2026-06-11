-- ===========================================================================
-- Migration 0076 — i18n locales + catalog (optionnel V2)
-- ---------------------------------------------------------------------------
-- Sprint : docs/i18n-strategy-2026-05
-- Auteur  : Claude (étude i18n)
-- Date    : 2026-05-27
-- ---------------------------------------------------------------------------
-- Périmètre :
--   1. i18n_locales              -> Configuration par locale (fr, ar, en)
--   2. i18n_translation_keys     -> Catalog des clés UI (V2, optionnel V1)
--   3. i18n_translation_values   -> Valeurs par locale (V2, optionnel V1)
--   4. Triggers updated_at, contraintes, indexes
--   5. RLS policies (lecture publique, écriture admin)
--   6. Backfill des tables existantes (component_field_bindings, legal_pages)
-- ---------------------------------------------------------------------------
-- Notes :
--   - Compatible Drizzle ORM (drizzle-kit generate:pg)
--   - Compatible PostgreSQL 14+ (Neon prod, Postgres 16 local)
--   - Idempotent (re-run safe sur la même DB)
-- ---------------------------------------------------------------------------
-- Pour générer ce fichier depuis Drizzle :
--   pnpm drizzle-kit generate:pg --name=i18n_locales
-- Puis copier-coller le SQL dans drizzle/migrations/0076_i18n_locales.sql
-- ===========================================================================


-- ===========================================================================
-- 1. TABLE i18n_locales — Configuration de chaque locale active
-- ===========================================================================
-- Pilotable depuis /admin/i18n/languages sans deploy.
-- Permet d'activer/désactiver une locale, configurer la fallback chain, etc.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "i18n_locales" (
  -- Identifiant BCP-47 (ex: 'fr', 'ar', 'en', 'es', 'ar-MA')
  -- Source : https://www.rfc-editor.org/info/bcp47
  "code" TEXT PRIMARY KEY,

  -- Nom affiché dans l'admin en anglais (langue de référence projet)
  -- Exemples : 'French', 'Arabic', 'English'
  "display_name" TEXT NOT NULL,

  -- Nom affiché aux visiteurs DANS la langue elle-même
  -- Exemples : 'Français', 'العربية', 'English'
  "display_name_native" TEXT NOT NULL,

  -- Direction d'écriture (Tailwind utilise cette valeur sur <html dir>)
  "direction" TEXT NOT NULL DEFAULT 'ltr'
    CHECK ("direction" IN ('ltr', 'rtl')),

  -- Drapeau emoji pour le locale switcher (optionnel, UI hint)
  "flag_emoji" TEXT,

  -- Fallback locale (FK vers cette même table) :
  -- si une traduction manque, on tente celle-ci avant DEFAULT_LOCALE
  "fallback_locale" TEXT REFERENCES "i18n_locales"("code")
    ON DELETE SET NULL,

  -- Format de date Intl par défaut (ex: 'dd MMM yyyy', 'yyyy/MM/dd')
  "date_format" TEXT NOT NULL DEFAULT 'dd MMM yyyy',

  -- Format de nombres BCP-47 (utilisé par Intl.NumberFormat)
  "number_format" TEXT NOT NULL DEFAULT 'fr-FR',

  -- Devise par défaut affichée (ISO 4217)
  -- En V1 toutes les locales utilisent MAD (boutique Maroc only)
  "currency_code" TEXT NOT NULL DEFAULT 'MAD',

  -- Activation/désactivation côté UI (toggle sans deploy)
  "enabled" BOOLEAN NOT NULL DEFAULT false,

  -- Une seule locale a `is_default = true` (cf. unique index plus bas)
  "is_default" BOOLEAN NOT NULL DEFAULT false,

  -- Ordre d'affichage dans le locale switcher
  "sort_order" INTEGER NOT NULL DEFAULT 100,

  -- Métadonnées
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "created_by" TEXT,
  "updated_by" TEXT
);

-- Contrainte : exactement 1 seule locale default
CREATE UNIQUE INDEX IF NOT EXISTS "idx_i18n_locales_one_default"
  ON "i18n_locales" ("is_default") WHERE "is_default" = true;

-- Index pour filtrer rapidement les locales actives par ordre
CREATE INDEX IF NOT EXISTS "idx_i18n_locales_enabled_sort"
  ON "i18n_locales" ("enabled", "sort_order")
  WHERE "enabled" = true;

-- Index sur fallback_locale (pour cascade lookups)
CREATE INDEX IF NOT EXISTS "idx_i18n_locales_fallback"
  ON "i18n_locales" ("fallback_locale")
  WHERE "fallback_locale" IS NOT NULL;

-- Commentaire applicatif
COMMENT ON TABLE "i18n_locales" IS
  'Configuration des locales i18n FemiGlow (V1: fr, ar, en). Pilotable admin.';
COMMENT ON COLUMN "i18n_locales"."code" IS
  'Code BCP-47, ex: fr, ar, en. PK utilisée par toutes les tables locale-aware.';
COMMENT ON COLUMN "i18n_locales"."fallback_locale" IS
  'Si une clé manque dans cette locale, on essaie celle-ci. NULL = pas de fallback (DEFAULT_LOCALE final).';


-- ===========================================================================
-- 2. TABLE i18n_translation_keys (V2 — optionnel V1)
-- ===========================================================================
-- Catalog en DB des clés de traduction utilisées dans messages/[locale].json.
-- Permet :
--   - Tracking coverage par locale (% de clés traduites)
--   - Détection des "orphan keys" (en DB mais jamais utilisées)
--   - Admin UI pour piloter les clés sans toucher au code (V2)
--   - Audit : qui a ajouté la clé, quand, pourquoi
-- ---------------------------------------------------------------------------
-- NOTE V1 : cette table peut rester vide en V1, on sync depuis JSON files.
--           En V2, devient source of truth si on bascule TMS.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "i18n_translation_keys" (
  -- Clé canonique au format namespace.section.element
  -- Exemples : 'marketing.hero.title', 'common.back', 'wizard.step_1.title'
  "key" TEXT PRIMARY KEY,

  -- Namespace (premier segment de la clé) — duplication pour requêtes rapides
  "namespace" TEXT NOT NULL
    CHECK ("namespace" IN (
      'common', 'navigation', 'marketing', 'wizard',
      'legal', 'admin', 'email', 'errors', 'seo'
    )),

  -- Description / hint pour le traducteur (contexte, ton, audience)
  -- Exemple : 'CTA principal de la page d''accueil — ton sobre, action courte'
  "description" TEXT,

  -- Page / composant qui utilise la clé (pour debug + dead-key detection)
  -- Exemple : 'src/app/(marketing)/page.tsx' ou 'components/hero/Hero.tsx'
  "context" TEXT,

  -- Type de message ICU
  --   static       -> string simple
  --   pluralized   -> {count, plural, ...}
  --   rich         -> contient des tags HTML safe (t.rich)
  "type" TEXT NOT NULL DEFAULT 'static'
    CHECK ("type" IN ('static', 'pluralized', 'rich')),

  -- Valeur dans la locale source (FR) — référence pour traducteur
  "source_value" TEXT NOT NULL,

  -- Priorité métier : P0 critical path, P1 important, P2 nice-to-have
  "priority" TEXT NOT NULL DEFAULT 'P1'
    CHECK ("priority" IN ('P0', 'P1', 'P2')),

  -- Statut d'extraction (workflow de migration historique)
  --   pending      -> extraite mais pas encore validée par founder
  --   approved     -> validée, prête pour traduction
  --   in_review    -> en revue traducteur
  --   translated   -> traduite dans toutes les locales actives
  --   deprecated   -> marquée à supprimer (suite à rename ou suppression UI)
  "extraction_status" TEXT NOT NULL DEFAULT 'pending'
    CHECK ("extraction_status" IN (
      'pending', 'approved', 'in_review', 'translated', 'deprecated'
    )),

  -- Activation : false = clé déprécée mais conservée pour historique
  "is_active" BOOLEAN NOT NULL DEFAULT true,

  -- Métadonnées
  "added_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "added_by" TEXT,
  "last_used_at" TIMESTAMPTZ,           -- mis à jour par job hebdomadaire scan
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index par namespace (filtrage admin)
CREATE INDEX IF NOT EXISTS "idx_i18n_keys_namespace"
  ON "i18n_translation_keys" ("namespace");

-- Index pour filtrer les clés actives uniquement
CREATE INDEX IF NOT EXISTS "idx_i18n_keys_active"
  ON "i18n_translation_keys" ("is_active") WHERE "is_active" = true;

-- Index priorité (P0 first dans workflow translateur)
CREATE INDEX IF NOT EXISTS "idx_i18n_keys_priority"
  ON "i18n_translation_keys" ("priority", "namespace");

-- Index pour détecter les orphan keys (jamais used)
CREATE INDEX IF NOT EXISTS "idx_i18n_keys_last_used"
  ON "i18n_translation_keys" ("last_used_at");

-- Commentaires applicatifs
COMMENT ON TABLE "i18n_translation_keys" IS
  'Catalog des clés UI (V2 — optionnel V1). Source : messages/[locale].json sync via CLI.';


-- ===========================================================================
-- 3. TABLE i18n_translation_values (V2 — optionnel V1)
-- ===========================================================================
-- Valeurs traduites par clé + locale, miroir de messages/[locale].json.
-- En V1 : optionnel (JSON files restent source of truth).
-- En V2 : si bascule TMS, peut devenir source of truth.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "i18n_translation_values" (
  -- FK vers le catalog
  "key" TEXT NOT NULL
    REFERENCES "i18n_translation_keys"("key") ON DELETE CASCADE,

  -- FK vers la locale (must be enabled in i18n_locales)
  "locale" TEXT NOT NULL
    REFERENCES "i18n_locales"("code") ON DELETE CASCADE,

  -- Valeur traduite (string, plurals ICU, rich text)
  "value" TEXT NOT NULL,

  -- Statut workflow traduction
  --   draft        -> brouillon (traduction en cours)
  --   in_review    -> revue par founder
  --   approved     -> validé, prêt à publier
  --   published    -> en prod
  "status" TEXT NOT NULL DEFAULT 'draft'
    CHECK ("status" IN ('draft', 'in_review', 'approved', 'published')),

  -- Audit traducteur
  "translated_by" TEXT,                 -- email/identifier traducteur
  "translated_at" TIMESTAMPTZ,

  -- Audit reviewer (founder)
  "reviewed" BOOLEAN NOT NULL DEFAULT false,
  "reviewed_by" TEXT,
  "reviewed_at" TIMESTAMPTZ,

  -- Notes (commentaires entre traducteur et founder)
  "notes" TEXT,

  -- Confidence score (machine translation V2+)
  "confidence" NUMERIC(3,2),

  -- Métadonnées
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY ("key", "locale")
);

-- Index par locale (export par langue)
CREATE INDEX IF NOT EXISTS "idx_i18n_values_locale"
  ON "i18n_translation_values" ("locale");

-- Index par statut (review queue)
CREATE INDEX IF NOT EXISTS "idx_i18n_values_status"
  ON "i18n_translation_values" ("status", "locale");

-- Index pour identifier les unreviewed
CREATE INDEX IF NOT EXISTS "idx_i18n_values_reviewed"
  ON "i18n_translation_values" ("reviewed", "locale")
  WHERE "reviewed" = false;

-- Commentaires
COMMENT ON TABLE "i18n_translation_values" IS
  'Valeurs traduites — miroir des JSON files (V1) ou source of truth (V2 si TMS).';


-- ===========================================================================
-- 4. TRIGGERS — updated_at automatique
-- ===========================================================================

CREATE OR REPLACE FUNCTION "fn_i18n_set_updated_at"()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updated_at" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_i18n_locales_updated_at" ON "i18n_locales";
CREATE TRIGGER "trg_i18n_locales_updated_at"
  BEFORE UPDATE ON "i18n_locales"
  FOR EACH ROW EXECUTE FUNCTION "fn_i18n_set_updated_at"();

DROP TRIGGER IF EXISTS "trg_i18n_translation_keys_updated_at" ON "i18n_translation_keys";
CREATE TRIGGER "trg_i18n_translation_keys_updated_at"
  BEFORE UPDATE ON "i18n_translation_keys"
  FOR EACH ROW EXECUTE FUNCTION "fn_i18n_set_updated_at"();

DROP TRIGGER IF EXISTS "trg_i18n_translation_values_updated_at" ON "i18n_translation_values";
CREATE TRIGGER "trg_i18n_translation_values_updated_at"
  BEFORE UPDATE ON "i18n_translation_values"
  FOR EACH ROW EXECUTE FUNCTION "fn_i18n_set_updated_at"();


-- ===========================================================================
-- 5. SEED INITIAL — les 3 locales V1 (fr, ar, en)
-- ===========================================================================
-- Idempotent : ON CONFLICT DO NOTHING. Re-run safe.
-- Pour seed plus complet (avec env-aware), cf. scripts/seed-i18n.ts.
-- ---------------------------------------------------------------------------

INSERT INTO "i18n_locales" (
  "code", "display_name", "display_name_native", "direction",
  "flag_emoji", "fallback_locale", "date_format", "number_format",
  "currency_code", "enabled", "is_default", "sort_order"
)
VALUES
  -- FR — default, LTR, pas de fallback (c'est la fallback de tout le monde)
  ('fr', 'French', 'Français', 'ltr',
   '🇫🇷', NULL, 'dd MMM yyyy', 'fr-FR',
   'MAD', true, true, 10),

  -- AR — RTL, fallback vers FR si missing key
  ('ar', 'Arabic', 'العربية', 'rtl',
   '🇲🇦', 'fr', 'dd MMM yyyy', 'ar-MA',
   'MAD', true, false, 20),

  -- EN — LTR, fallback vers FR
  ('en', 'English', 'English', 'ltr',
   '🇬🇧', 'fr', 'MMM dd, yyyy', 'en-US',
   'MAD', false, false, 30)
ON CONFLICT ("code") DO NOTHING;


-- ===========================================================================
-- 6. BACKFILL — Tables existantes locale-aware
-- ===========================================================================
-- Les tables `component_field_bindings`, `legal_pages`, `seo_overrides` ont
-- déjà un champ `locale`. Vérifions qu'aucune entrée n'a NULL ou ''.
-- ---------------------------------------------------------------------------

-- 6.1 component_field_bindings — déjà multilingue, force locale='fr' si manquante
UPDATE "component_field_bindings"
   SET "locale" = 'fr'
 WHERE "locale" IS NULL OR "locale" = '';

-- 6.2 legal_pages — idem
UPDATE "legal_pages"
   SET "locale" = 'fr'
 WHERE "locale" IS NULL OR "locale" = '';

-- 6.3 seo_overrides — idem
UPDATE "seo_overrides"
   SET "locale" = 'fr'
 WHERE "locale" IS NULL OR "locale" = '';


-- ===========================================================================
-- 7. FK locale -> i18n_locales (cohérence référentielle)
-- ===========================================================================
-- Une fois seed effectué, on ajoute la contrainte FK sur les tables existantes.
-- À exécuter APRÈS le seed initial (sinon FK violation sur fr/ar/en).
-- ---------------------------------------------------------------------------

-- 7.1 component_field_bindings.locale FK i18n_locales(code)
DO $$ BEGIN
  ALTER TABLE "component_field_bindings"
    ADD CONSTRAINT "fk_cfb_locale"
    FOREIGN KEY ("locale") REFERENCES "i18n_locales"("code")
    ON UPDATE CASCADE ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN invalid_foreign_key THEN
    RAISE NOTICE 'Skipping FK fk_cfb_locale: invalid data';
END $$;

-- 7.2 legal_pages.locale FK
DO $$ BEGIN
  ALTER TABLE "legal_pages"
    ADD CONSTRAINT "fk_legal_pages_locale"
    FOREIGN KEY ("locale") REFERENCES "i18n_locales"("code")
    ON UPDATE CASCADE ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN invalid_foreign_key THEN
    RAISE NOTICE 'Skipping FK fk_legal_pages_locale: invalid data';
END $$;

-- 7.3 seo_overrides.locale FK
DO $$ BEGIN
  ALTER TABLE "seo_overrides"
    ADD CONSTRAINT "fk_seo_overrides_locale"
    FOREIGN KEY ("locale") REFERENCES "i18n_locales"("code")
    ON UPDATE CASCADE ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN invalid_foreign_key THEN
    RAISE NOTICE 'Skipping FK fk_seo_overrides_locale: invalid data';
END $$;


-- ===========================================================================
-- 8. ROW LEVEL SECURITY (RLS) — Lecture publique, écriture admin only
-- ===========================================================================
-- Pattern utilisé par FemiGlow : RLS activée par défaut, policies explicites.
-- ---------------------------------------------------------------------------

-- 8.1 i18n_locales — lecture publique (tous les visiteurs), écriture admin
ALTER TABLE "i18n_locales" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "i18n_locales_read" ON "i18n_locales";
CREATE POLICY "i18n_locales_read"
  ON "i18n_locales"
  FOR SELECT
  USING (true);

-- Écriture : pas de policy → seul le rôle de service (Drizzle SDK) peut écrire
-- En pratique : passe par Server Actions admin qui utilisent un client
-- privilégié (service_role) plutôt que par auth utilisateur.

-- 8.2 i18n_translation_keys — idem
ALTER TABLE "i18n_translation_keys" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "i18n_keys_read" ON "i18n_translation_keys";
CREATE POLICY "i18n_keys_read"
  ON "i18n_translation_keys"
  FOR SELECT
  USING ("is_active" = true);

-- 8.3 i18n_translation_values — lecture publique uniquement si published
ALTER TABLE "i18n_translation_values" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "i18n_values_read_published" ON "i18n_translation_values";
CREATE POLICY "i18n_values_read_published"
  ON "i18n_translation_values"
  FOR SELECT
  USING ("status" = 'published');


-- ===========================================================================
-- 9. VUES utilitaires
-- ===========================================================================

-- 9.1 Vue coverage par locale
DROP VIEW IF EXISTS "v_i18n_coverage";
CREATE OR REPLACE VIEW "v_i18n_coverage" AS
SELECT
  l."code" AS "locale",
  l."display_name_native",
  l."enabled",
  COUNT(DISTINCT k."key") AS "total_active_keys",
  COUNT(DISTINCT v."key") FILTER (WHERE v."status" = 'published') AS "translated_published",
  COUNT(DISTINCT v."key") FILTER (WHERE v."status" = 'draft') AS "translated_draft",
  CASE
    WHEN COUNT(DISTINCT k."key") = 0 THEN 0
    ELSE ROUND(
      (COUNT(DISTINCT v."key") FILTER (WHERE v."status" = 'published'))::numeric
      / COUNT(DISTINCT k."key")::numeric * 100,
      2
    )
  END AS "coverage_pct"
FROM "i18n_locales" l
CROSS JOIN "i18n_translation_keys" k
LEFT JOIN "i18n_translation_values" v
  ON v."key" = k."key" AND v."locale" = l."code"
WHERE k."is_active" = true
GROUP BY l."code", l."display_name_native", l."enabled"
ORDER BY l."sort_order";

COMMENT ON VIEW "v_i18n_coverage" IS
  'Coverage % de traduction par locale (count published vs total active keys).';


-- 9.2 Vue des clés non traduites par locale (pour le translation queue)
DROP VIEW IF EXISTS "v_i18n_pending_keys";
CREATE OR REPLACE VIEW "v_i18n_pending_keys" AS
SELECT
  l."code" AS "locale",
  k."key",
  k."namespace",
  k."priority",
  k."source_value",
  k."description"
FROM "i18n_locales" l
CROSS JOIN "i18n_translation_keys" k
LEFT JOIN "i18n_translation_values" v
  ON v."key" = k."key" AND v."locale" = l."code"
WHERE l."enabled" = true
  AND l."is_default" = false   -- pas la locale source
  AND k."is_active" = true
  AND (v."key" IS NULL OR v."status" != 'published')
ORDER BY k."priority", k."namespace", k."key";

COMMENT ON VIEW "v_i18n_pending_keys" IS
  'Clés non encore publiées par locale — alimente le translator queue.';


-- ===========================================================================
-- 10. FONCTIONS utilitaires
-- ===========================================================================

-- Récupère la locale active avec fallback chain expansée
-- Utilisée par les services Drizzle pour résoudre la chaîne de fallback
CREATE OR REPLACE FUNCTION "fn_i18n_resolve_chain"(
  "p_locale" TEXT
)
RETURNS TABLE("locale" TEXT, "depth" INTEGER) AS $$
DECLARE
  "v_current" TEXT;
  "v_depth" INTEGER := 0;
  "v_max_depth" INTEGER := 5;
BEGIN
  "v_current" := "p_locale";
  WHILE "v_current" IS NOT NULL AND "v_depth" < "v_max_depth" LOOP
    "locale" := "v_current";
    "depth" := "v_depth";
    RETURN NEXT;
    SELECT "fallback_locale" INTO "v_current"
      FROM "i18n_locales"
      WHERE "code" = "v_current";
    "v_depth" := "v_depth" + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION "fn_i18n_resolve_chain"(TEXT) IS
  'Retourne la chaîne de fallback locale -> parent -> ... (max 5 niveaux).';


-- ===========================================================================
-- 11. ROLLBACK plan (à exécuter manuellement si problème)
-- ===========================================================================
-- ATTENTION : ne PAS inclure ce bloc dans le fichier de migration prod.
-- Le laisser ici comme reference. Copier dans 0076_DOWN_i18n_locales.sql
-- si besoin de rollback.
-- ---------------------------------------------------------------------------
--
-- -- Drop FK contraintes
-- ALTER TABLE "component_field_bindings" DROP CONSTRAINT IF EXISTS "fk_cfb_locale";
-- ALTER TABLE "legal_pages" DROP CONSTRAINT IF EXISTS "fk_legal_pages_locale";
-- ALTER TABLE "seo_overrides" DROP CONSTRAINT IF EXISTS "fk_seo_overrides_locale";
--
-- -- Drop vues
-- DROP VIEW IF EXISTS "v_i18n_coverage" CASCADE;
-- DROP VIEW IF EXISTS "v_i18n_pending_keys" CASCADE;
--
-- -- Drop functions
-- DROP FUNCTION IF EXISTS "fn_i18n_resolve_chain"(TEXT);
-- DROP FUNCTION IF EXISTS "fn_i18n_set_updated_at"();
--
-- -- Drop tables (ordre inverse de creation pour FK)
-- DROP TABLE IF EXISTS "i18n_translation_values" CASCADE;
-- DROP TABLE IF EXISTS "i18n_translation_keys" CASCADE;
-- DROP TABLE IF EXISTS "i18n_locales" CASCADE;


-- ===========================================================================
-- 12. CHECKLIST POST-MIGRATION
-- ===========================================================================
--
-- [ ] Migration appliquée :
--       pnpm drizzle-kit push:pg
--       OU
--       psql $DATABASE_URL -f drizzle/migrations/0076_i18n_locales.sql
--
-- [ ] Vérifier que la table existe et que le seed FR/AR/EN est en DB :
--       SELECT code, display_name_native, enabled, is_default FROM i18n_locales;
--
-- [ ] Vérifier qu'aucune autre table n'a `locale=NULL/''` :
--       SELECT COUNT(*) FROM component_field_bindings WHERE locale IS NULL OR locale='';
--       SELECT COUNT(*) FROM legal_pages WHERE locale IS NULL OR locale='';
--       SELECT COUNT(*) FROM seo_overrides WHERE locale IS NULL OR locale='';
--
-- [ ] Vérifier les FK ajoutées :
--       \d component_field_bindings
--       (chercher fk_cfb_locale)
--
-- [ ] Vérifier les triggers updated_at fonctionnent :
--       UPDATE i18n_locales SET sort_order = 99 WHERE code='en';
--       SELECT code, updated_at FROM i18n_locales WHERE code='en';
--
-- [ ] Tester la fonction fallback :
--       SELECT * FROM fn_i18n_resolve_chain('ar');
--       Expected output:
--         ar | 0
--         fr | 1
--
-- [ ] Tester la vue coverage (vide si pas encore de keys/values seedées) :
--       SELECT * FROM v_i18n_coverage;
--
-- [ ] RLS active sur les 3 tables :
--       SELECT tablename, rowsecurity FROM pg_tables
--        WHERE tablename IN ('i18n_locales','i18n_translation_keys','i18n_translation_values');
--
-- ===========================================================================
-- FIN DE LA MIGRATION 0076
-- ===========================================================================
