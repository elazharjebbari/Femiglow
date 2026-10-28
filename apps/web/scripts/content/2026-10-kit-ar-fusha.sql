-- Réécriture arabe classique (فصحى) du hero /ar/kit — 28/10/2026.
-- Met à jour les champs CMS publiés du composant `kit-hero-produit` en locale `ar`,
-- dans les limites du registre (tagline ≤ 140, description ≤ 600,
-- attributeChips ≤ 6 × 24, trustRow ≤ 4 × 40). Aligné sur `src/data/mock/kit.ar.ts`.
-- Seuls les champs déjà publiés sont modifiés ; les autres retombent sur le fallback du code.
-- Chaque modification incrémente la version et laisse une ligne d'historique.
-- Usage : psql -v ON_ERROR_STOP=1 -d femiglow -f 2026-10-kit-ar-fusha.sql

BEGIN;

CREATE TEMP TABLE kit_ar_fusha (
  component_key text,
  field_key text,
  locale text,
  new_value jsonb,
  PRIMARY KEY (component_key, field_key, locale)
) ON COMMIT DROP;

INSERT INTO kit_ar_fusha (component_key, field_key, locale, new_value) VALUES
  ('kit-hero-produit', 'tagline', 'ar', to_jsonb('مانيكور ياباني حلال في البيت: أظافر طبيعية لامعة في 5 دقائق، ولا طبقة تُزال قبل الوضوء.'::text)),
  ('kit-hero-produit', 'description', 'ar', to_jsonb('يضمّ كيت FemiGlow عجينة تُغذّي الظفر، وبودرة تمنحه اللمعان، ومبرد تلميع بثلاثة أوجه. بلا طلاء ولا مصباح UV ولا أسيتون. 4 حركات في 5 دقائق، مرة واحدة في الأسبوع، فيستعيد ظفرك لمعانه الطبيعي. ولأنّ لا طبقة تُغطّي الظفر، يبقى وضوؤكِ سليمًا.'::text)),
  ('kit-hero-produit', 'attributeChips', 'ar', '["بلا طلاء", "بلا مصباح UV", "خالٍ من الأسيتون", "متوافق مع الوضوء"]'::jsonb),
  ('kit-hero-produit', 'trustRow', 'ar', '["توصيل مجاني", "الدفع عند الاستلام"]'::jsonb);

WITH updated AS (
  UPDATE component_field_bindings b
  SET value = k.new_value,
      version = b.version + 1,
      published_at = now(),
      updated_at = now(),
      notes = 'kit-ar-fusha 2026-10'
  FROM kit_ar_fusha k, site_components sc
  WHERE sc.id = b.component_id AND sc.key = k.component_key
    AND b.field_key = k.field_key AND b.locale = k.locale
    AND b.status = 'published' AND b.value IS DISTINCT FROM k.new_value
  RETURNING b.*
), history AS (
  INSERT INTO component_field_history
    (id, binding_id, component_id, field_key, locale, version, value, status, actor_id, action, notes, created_at)
  SELECT 'cfh_' || substr(md5(random()::text || u.id), 1, 16),
         u.id, u.component_id, u.field_key, u.locale, u.version, u.value, u.status, NULL, 'publish',
         'kit-ar-fusha 2026-10', now()
  FROM updated u
  RETURNING field_key
)
SELECT field_key AS champ_mis_a_jour FROM history;

COMMIT;
