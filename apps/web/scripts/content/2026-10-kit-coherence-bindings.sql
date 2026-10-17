-- Cohérence produit (fiche de référence, 17/10/2026) — contenus CMS en base.
-- Aligne les champs publiés qui contredisaient `src/lib/products/kit-facts.ts`
-- et pose l'angle woudou/halal dans le hero /kit (phase 4).
-- Chaque modification incrémente la version et laisse une ligne d'historique.
-- Usage : psql -v ON_ERROR_STOP=1 -d femiglow -f 2026-10-kit-coherence-bindings.sql

BEGIN;

CREATE TEMP TABLE kit_coherence (
  component_key text,
  field_key text,
  locale text,
  new_value jsonb,
  PRIMARY KEY (component_key, field_key, locale)
) ON COMMIT DROP;

INSERT INTO kit_coherence (component_key, field_key, locale, new_value) VALUES
  -- Accueil : nombre de gestes, couleur de la powder
  ('home-hero', 'subtitle', 'fr', to_jsonb('Quatre gestes, une fois par semaine. Une beauté lente, ancrée au Maroc.'::text)),
  ('home-hero', 'title', 'en', to_jsonb('The FemiGlow ritual. Four gestures, a quiet glow.'::text)),
  ('home-hero', 'title', 'ar', to_jsonb('طقس FemiGlow. أربع حركات، إشراقة هادئة.'::text)),
  ('home-hero', 'image_alt', 'en', to_jsonb('Open FemiGlow pastel box, sage-label paste jar and powder jar with a powder-pink label, sky blue buffer, late-morning natural light'::text)),
  ('home-hero', 'image_alt', 'ar', to_jsonb('علبة FemiGlow الباستيلية مفتوحة، علبة Paste بملصق مريمي وعلبة Powder بملصق وردي ناعم، مُلمِّع أزرق سماوي، ضوء طبيعي في نهاية الصباح'::text)),

  -- Comparatif : durée du pack, certification, fréquence
  ('kit-comparatif', 'row__cout__rituel', 'en', to_jsonb('A 199 MAD FemiGlow pack lasts about six months. About 400 MAD per year.'::text)),
  ('kit-comparatif', 'row__cout__rituel', 'ar', to_jsonb('كيت FemiGlow بـ199 درهم يكفي حوالي ستة أشهر. أي حوالي 400 درهم في السنة.'::text)),
  ('kit-comparatif', 'row__impact__rituel', 'en', to_jsonb('Beeswax, jojoba, mineral talc, rice, kaolin.'::text)),
  ('kit-comparatif', 'row__impact__rituel', 'ar', to_jsonb('شمع نحل، جوجوبا، طلق معدني، أرزّ، كاولين.'::text)),
  ('kit-comparatif', 'row__temps__rituel', 'en', to_jsonb('Five minutes once a week, a slow gesture, no forced drying.'::text)),
  ('kit-comparatif', 'row__temps__rituel', 'ar', to_jsonb('خمس دقائق مرة واحدة في الأسبوع، حركة بطيئة، دون تجفيف قسري.'::text)),
  ('kit-comparatif', 'row__temps__axis', 'en', to_jsonb('Time per ritual'::text)),
  ('kit-comparatif', 'row__temps__axis', 'ar', to_jsonb('وقت الطقس'::text)),

  -- Hero /kit : quatre gestes + angle woudou/halal (phase 4)
  ('kit-hero-produit', 'tagline', 'fr', to_jsonb('Manucure japonaise halal. Quatre gestes, sans vernis. Le woudou reste intact.'::text)),
  ('kit-hero-produit', 'attributeChips', 'fr', '["Sans vernis", "Sans UV", "Sans acétone", "Compatible woudou"]'::jsonb),
  ('kit-hero-produit', 'description', 'fr', to_jsonb('Le pack FemiGlow associe deux soins et un polissoir, pensés pour la manucure japonaise halal. Une paste qui lisse, une powder qui lustre, un polissoir Step 4 Polish & Shine. Sans vernis, sans lampe UV, sans acétone. Quatre gestes, cinq minutes, une fois par semaine. L’ongle nu retrouve sa lumière. Rien ne recouvre l’ongle : le woudou reste intact.'::text)),
  ('kit-hero-produit', 'description', 'en', to_jsonb('The FemiGlow pack brings together two care jars and a buffer, designed for the halal Japanese manicure. A paste that smooths, a powder that polishes, a Step 4 Polish & Shine buffer. No polish, no UV lamp, no acetone. Four gestures, five minutes, once a week. The bare nail regains its light. Nothing covers the nail: your wudu remains intact.'::text)),
  -- Avis de l'accueil : le pack ne contient pas de « base » (paste)
  ('home-avis-strip', 'reviews', 'fr', NULL),
  ('home-avis-strip', 'reviews', 'en', NULL),
  ('home-avis-strip', 'reviews', 'ar', NULL),

  ('kit-hero-produit', 'description', 'ar', to_jsonb('يجمع كيت FemiGlow علبتَي عناية ومُلمِّعًا، مصمَّمة للمانيكور الياباني الحلال. عجينة تُملِّس، وبودرة تُلمِّع، ومُلمِّع الخطوة 4 للصقل واللمعان. دون طلاء، دون مصباح الأشعة فوق البنفسجية، دون أسيتون. أربع حركات، خمس دقائق، مرة واحدة في الأسبوع. يستعيد الظفر العاري نوره. لا شيء يغطي الظفر: يبقى الوضوء سليمًا.'::text));

-- Avis : on ne réécrit que le mot « base » dans la valeur publiée existante.
UPDATE kit_coherence k
SET new_value = replace(replace(replace(b.value::text,
      'La base a une finition', 'La paste a une finition'),
      'The base has a natural finish', 'The paste has a natural finish'),
      'تمنح القاعدة', 'تمنح العجينة')::jsonb
FROM component_field_bindings b
JOIN site_components sc ON sc.id = b.component_id
WHERE k.new_value IS NULL AND sc.key = k.component_key
  AND b.field_key = k.field_key AND b.locale = k.locale AND b.status = 'published';

-- Garde-fou : tous les champs ciblés doivent exister et être publiés.
DO $$
DECLARE missing int;
BEGIN
  SELECT count(*) INTO missing
  FROM kit_coherence k
  WHERE NOT EXISTS (
    SELECT 1 FROM component_field_bindings b
    JOIN site_components sc ON sc.id = b.component_id
    WHERE sc.key = k.component_key AND b.field_key = k.field_key
      AND b.locale = k.locale AND b.status = 'published');
  IF missing > 0 THEN
    RAISE EXCEPTION '% champ(s) introuvable(s) ou non publié(s) — rien n''est modifié', missing;
  END IF;
END $$;

WITH updated AS (
  UPDATE component_field_bindings b
  SET value = k.new_value,
      version = b.version + 1,
      published_at = now(),
      updated_at = now(),
      notes = 'kit-coherence 2026-10'
  FROM kit_coherence k, site_components sc
  WHERE sc.id = b.component_id AND sc.key = k.component_key
    AND b.field_key = k.field_key AND b.locale = k.locale
    AND b.status = 'published' AND b.value IS DISTINCT FROM k.new_value
  RETURNING b.*
)
INSERT INTO component_field_history
  (id, binding_id, component_id, field_key, locale, version, value, status, actor_id, action, notes, created_at)
SELECT 'cfh_' || substr(md5(random()::text || u.id), 1, 16),
       u.id, u.component_id, u.field_key, u.locale, u.version, u.value, u.status, NULL, 'publish',
       'kit-coherence 2026-10', now()
FROM updated u;

COMMIT;
