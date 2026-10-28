-- Livraison payante (28/10/2026) : retire « Livraison offerte » de la ligne
-- de réassurance CMS du hero /kit (`kit-hero-produit.trustRow`, fr publié).
-- Version incrémentée + ligne d'historique, comme 2026-10-kit-ar-fusha.sql.
-- Usage : psql -v ON_ERROR_STOP=1 -d femiglow -f 2026-10-kit-livraison-payante.sql

BEGIN;

CREATE TEMP TABLE kit_livraison (
  component_key text,
  field_key text,
  locale text,
  new_value jsonb,
  PRIMARY KEY (component_key, field_key, locale)
) ON COMMIT DROP;

INSERT INTO kit_livraison (component_key, field_key, locale, new_value) VALUES
  ('kit-hero-produit', 'trustRow', 'fr', '["Livraison partout au Maroc", "Paiement à la livraison", "Retour 30 jours"]'::jsonb),
  ('kit-hero-produit', 'trustRow', 'ar', '["توصيل إلى كل مدن المغرب", "الدفع عند الاستلام"]'::jsonb),
  ('kit-hero-produit', 'trustRow', 'en', '["Delivery across Morocco", "Cash on delivery"]'::jsonb);

WITH updated AS (
  UPDATE component_field_bindings b
  SET value = k.new_value,
      version = b.version + 1,
      published_at = now(),
      updated_at = now(),
      notes = 'kit-livraison-payante 2026-10'
  FROM kit_livraison k, site_components sc
  WHERE sc.id = b.component_id AND sc.key = k.component_key
    AND b.field_key = k.field_key AND b.locale = k.locale
    AND b.status = 'published' AND b.value IS DISTINCT FROM k.new_value
  RETURNING b.*
), history AS (
  INSERT INTO component_field_history
    (id, binding_id, component_id, field_key, locale, version, value, status, actor_id, action, notes, created_at)
  SELECT 'cfh_' || substr(md5(random()::text || u.id), 1, 16),
         u.id, u.component_id, u.field_key, u.locale, u.version, u.value, u.status, NULL, 'publish',
         'kit-livraison-payante 2026-10', now()
  FROM updated u
  RETURNING field_key, locale
)
SELECT field_key || ':' || locale AS champ_mis_a_jour FROM history;

COMMIT;
