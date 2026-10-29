-- Titre-promesse du hero /kit (29/10/2026) : le kicker « Sans vernis ·
-- compatible woudou » et le titre « Kit de manucure japonaise, l'éclat sans
-- vernis » portent déjà ces deux arguments. On retire la répétition de la
-- tagline et des chips CMS (`kit-hero-produit`, publiés) pour un écran 1 sans
-- surcharge. Version incrémentée + ligne d'historique, comme
-- 2026-10-kit-livraison-payante.sql. Ne touche que les champs publiés qui
-- diffèrent (rejouable sans effet).
-- Usage : psql -v ON_ERROR_STOP=1 -d femiglow -f 2026-10-kit-hero-promesse.sql

BEGIN;

CREATE TEMP TABLE kit_hero_promesse (
  component_key text,
  field_key text,
  locale text,
  new_value jsonb,
  PRIMARY KEY (component_key, field_key, locale)
) ON COMMIT DROP;

INSERT INTO kit_hero_promesse (component_key, field_key, locale, new_value) VALUES
  ('kit-hero-produit', 'tagline', 'fr', to_jsonb('Halal, formulée à Rabat. Quatre gestes, cinq minutes, une fois par semaine.'::text)),
  ('kit-hero-produit', 'tagline', 'ar', to_jsonb('حلال، يُحضَّر في الرباط. 4 حركات، 5 دقائق، مرة واحدة في الأسبوع.'::text)),
  ('kit-hero-produit', 'tagline', 'en', to_jsonb('Halal, formulated in Rabat. Four gestures, five minutes, once a week.'::text)),
  ('kit-hero-produit', 'attributeChips', 'fr', '["Sans UV", "Sans acétone"]'::jsonb),
  ('kit-hero-produit', 'attributeChips', 'ar', '["بلا مصباح UV", "خالٍ من الأسيتون"]'::jsonb),
  ('kit-hero-produit', 'attributeChips', 'en', '["No UV", "No acetone"]'::jsonb);

WITH updated AS (
  UPDATE component_field_bindings b
  SET value = k.new_value,
      version = b.version + 1,
      published_at = now(),
      updated_at = now(),
      notes = 'kit-hero-promesse 2026-10'
  FROM kit_hero_promesse k, site_components sc
  WHERE sc.id = b.component_id AND sc.key = k.component_key
    AND b.field_key = k.field_key AND b.locale = k.locale
    AND b.status = 'published' AND b.value IS DISTINCT FROM k.new_value
  RETURNING b.*
), history AS (
  INSERT INTO component_field_history
    (id, binding_id, component_id, field_key, locale, version, value, status, actor_id, action, notes, created_at)
  SELECT 'cfh_' || substr(md5(random()::text || u.id), 1, 16),
         u.id, u.component_id, u.field_key, u.locale, u.version, u.value, u.status, NULL, 'publish',
         'kit-hero-promesse 2026-10', now()
  FROM updated u
  RETURNING field_key, locale
)
SELECT field_key || ':' || locale AS champ_mis_a_jour FROM history;

COMMIT;
