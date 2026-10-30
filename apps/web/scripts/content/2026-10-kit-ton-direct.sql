-- Kit CRO v2 §4 — ton direct (30/10/2026) : « paste / powder » → « pâte /
-- poudre » dans le texte VISIBLE en français des champs CMS publiés.
-- Les clés techniques, slugs, SKU, noms de fichiers et les locales AR/EN ne
-- changent pas.
--
-- Champs publiés connus pour contenir ces mots (scripts précédents) :
--   - kit-hero-produit / description / fr (2026-10-kit-coherence-bindings.sql) :
--     « Une paste qui lisse, une powder qui lustre »
--   - home-avis-strip / reviews / fr (même script) : « La paste a une finition »
-- On remplace ces seules phrases dans la valeur publiée (le reste du texte,
-- éventuellement retouché dans l'admin, est conservé). Version incrémentée +
-- ligne d'historique, comme 2026-10-kit-hero-promesse.sql. Rejouable sans
-- effet (seules les valeurs qui changent sont réécrites).
--
-- En fin de script : liste des AUTRES champs FR publiés qui contiennent encore
-- « paste » ou « powder » (à relire et corriger dans l'admin, phrase par phrase).
--
-- Usage : psql -v ON_ERROR_STOP=1 -d femiglow -f 2026-10-kit-ton-direct.sql
-- Cache : comme pour les autres scripts, vider `.next/cache/fetch-cache` ou
-- republier un champ depuis l'admin pour que le site lise la nouvelle valeur.

BEGIN;

CREATE TEMP TABLE kit_ton_direct (
  component_key text,
  field_key text,
  locale text,
  old_text text,
  new_text text,
  PRIMARY KEY (component_key, field_key, locale, old_text)
) ON COMMIT DROP;

INSERT INTO kit_ton_direct (component_key, field_key, locale, old_text, new_text) VALUES
  ('kit-hero-produit', 'description', 'fr',
    'Une paste qui lisse, une powder qui lustre',
    'Une pâte qui lisse, une poudre qui lustre'),
  ('home-avis-strip', 'reviews', 'fr',
    'La paste a une finition',
    'La pâte a une finition');

-- Valeur cible = valeur publiée avec toutes les phrases du champ remplacées.
CREATE TEMP TABLE kit_ton_direct_target ON COMMIT DROP AS
WITH RECURSIVE pairs AS (
  SELECT k.*, row_number() OVER (PARTITION BY k.component_key, k.field_key, k.locale ORDER BY k.old_text) AS n
  FROM kit_ton_direct k
), current_values AS (
  SELECT b.id AS binding_id, sc.key AS component_key, b.field_key, b.locale, b.value::text AS txt
  FROM component_field_bindings b
  JOIN site_components sc ON sc.id = b.component_id
  WHERE b.status = 'published'
    AND (sc.key, b.field_key, b.locale) IN (SELECT component_key, field_key, locale FROM kit_ton_direct)
), replaced AS (
  SELECT c.binding_id, c.component_key, c.field_key, c.locale, c.txt, 0::bigint AS n
  FROM current_values c
  UNION ALL
  SELECT r.binding_id, r.component_key, r.field_key, r.locale,
         replace(r.txt, p.old_text, p.new_text), p.n
  FROM replaced r
  JOIN pairs p ON p.component_key = r.component_key AND p.field_key = r.field_key
    AND p.locale = r.locale AND p.n = r.n + 1
)
SELECT DISTINCT ON (binding_id) binding_id, txt::jsonb AS new_value
FROM replaced
ORDER BY binding_id, n DESC;

WITH updated AS (
  UPDATE component_field_bindings b
  SET value = t.new_value,
      version = b.version + 1,
      published_at = now(),
      updated_at = now(),
      notes = 'kit-ton-direct 2026-10'
  FROM kit_ton_direct_target t
  WHERE b.id = t.binding_id
    AND b.status = 'published' AND b.value IS DISTINCT FROM t.new_value
  RETURNING b.*
), history AS (
  INSERT INTO component_field_history
    (id, binding_id, component_id, field_key, locale, version, value, status, actor_id, action, notes, created_at)
  SELECT 'cfh_' || substr(md5(random()::text || u.id), 1, 16),
         u.id, u.component_id, u.field_key, u.locale, u.version, u.value, u.status, NULL, 'publish',
         'kit-ton-direct 2026-10', now()
  FROM updated u
  RETURNING field_key, locale
)
SELECT field_key || ':' || locale AS champ_mis_a_jour FROM history;

COMMIT;

-- Relecture : champs FR publiés qui contiennent encore « paste » ou « powder »
-- (hors noms de fichiers d'image). Lecture seule.
SELECT sc.key AS composant, b.field_key AS champ, left(b.value::text, 200) AS extrait
FROM component_field_bindings b
JOIN site_components sc ON sc.id = b.component_id
WHERE b.status = 'published' AND b.locale = 'fr'
  AND b.value::text ~* '\m(paste|powder)\M'
  AND b.value::text !~* '(paste|powder)[^"]*\.(png|jpe?g|webp|svg|avif)'
ORDER BY sc.key, b.field_key;
