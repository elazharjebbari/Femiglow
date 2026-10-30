-- Kit CRO v2 §3 — titres du hero /kit par angle publicitaire (30/10/2026).
-- Publie les textes du composant CMS `kit-hero-angles` en FR et en AR (arabe
-- classique, comme le hero actuel de /ar/kit — pas de darija). L'EN n'est pas
-- publié : sans texte publié, /en/kit garde le titre habituel (les valeurs
-- par défaut du registre sont en français et ne s'appliquent qu'au FR).
--
-- Prérequis : le composant doit exister en base
--   pnpm --filter @femiglow/web sync:components
-- Limites du registre : sur-titre ≤ 60, ligne 1 ≤ 80, ligne 2 ≤ 90 caractères.
--
-- N'insère que les champs SANS valeur publiée (rejouable sans effet, et ne
-- réécrit jamais un texte déjà modifié dans l'admin). Valeurs encodées comme
-- l'admin ({"v": "…"}). Une ligne d'historique par champ publié.
-- Usage : psql -v ON_ERROR_STOP=1 -d femiglow -f 2026-10-kit-hero-angles.sql

BEGIN;

CREATE TEMP TABLE kit_hero_angles (
  field_key text,
  locale text,
  new_text text,
  PRIMARY KEY (field_key, locale)
) ON COMMIT DROP;

INSERT INTO kit_hero_angles (field_key, locale, new_text) VALUES
  -- A — « ça brille, pas du vernis »
  ('a_kicker', 'fr', 'Manucure japonaise · sans vernis'),
  ('a_titleCategory', 'fr', 'Kit de manucure japonaise,'),
  ('a_titlePromise', 'fr', 'ça brille, et ce n’est pas du vernis'),
  ('a_kicker', 'ar', 'مانيكور ياباني · بلا طلاء'),
  ('a_titleCategory', 'ar', 'كيت المانيكور الياباني،'),
  ('a_titlePromise', 'ar', 'لمعانٌ حقيقي، وليس طلاءً'),

  -- B — « zéro vernis et ça brille »
  ('b_kicker', 'fr', 'Zéro vernis · zéro lampe UV'),
  ('b_titleCategory', 'fr', 'Kit de manucure japonaise,'),
  ('b_titlePromise', 'fr', 'zéro vernis, et vos ongles brillent'),
  ('b_kicker', 'ar', 'بلا طلاء · بلا مصباح UV'),
  ('b_titleCategory', 'ar', 'كيت المانيكور الياباني،'),
  ('b_titlePromise', 'ar', 'بلا أيّ طلاء، وأظافركِ تلمع'),

  -- C — « fini le semi-permanent »
  ('c_kicker', 'fr', 'Une pause avec le semi-permanent'),
  ('c_titleCategory', 'fr', 'Kit de manucure japonaise,'),
  ('c_titlePromise', 'fr', 'des ongles nus qui brillent'),
  ('c_kicker', 'ar', 'استراحة من الطلاء شبه الدائم'),
  ('c_titleCategory', 'ar', 'كيت المانيكور الياباني،'),
  ('c_titlePromise', 'ar', 'أظافر طبيعية تلمع'),

  -- D — « rien à retirer avant le woudou »
  ('d_kicker', 'fr', 'Compatible woudou'),
  ('d_titleCategory', 'fr', 'Kit de manucure japonaise,'),
  ('d_titlePromise', 'fr', 'des ongles soignés, rien à retirer avant le woudou'),
  ('d_kicker', 'ar', 'متوافق مع الوضوء'),
  ('d_titleCategory', 'ar', 'كيت المانيكور الياباني،'),
  ('d_titlePromise', 'ar', 'أظافر مُعتنى بها، ولا شيء يُزال قبل الوضوء'),

  -- E — « salon ou 99 DH ». Aucun prix dans le titre : il dépend du code
  -- promo (199 DH sans code), le prix réel est affiché par le bouton.
  ('e_kicker', 'fr', 'Sans rendez-vous · sans vernis'),
  ('e_titleCategory', 'fr', 'Kit de manucure japonaise,'),
  ('e_titlePromise', 'fr', 'le soin du salon, chez vous, sans rendez-vous'),
  ('e_kicker', 'ar', 'دون موعد · بلا طلاء'),
  ('e_titleCategory', 'ar', 'كيت المانيكور الياباني،'),
  ('e_titlePromise', 'ar', 'عناية الصالون في بيتكِ، دون موعد'),

  -- Témoin — « manucure japonaise à la maison »
  ('temoin_kicker', 'fr', 'La manucure japonaise à la maison'),
  ('temoin_titleCategory', 'fr', 'Kit de manucure japonaise,'),
  ('temoin_titlePromise', 'fr', 'des ongles qui brillent en cinq minutes'),
  ('temoin_kicker', 'ar', 'المانيكور الياباني في البيت'),
  ('temoin_titleCategory', 'ar', 'كيت المانيكور الياباني،'),
  ('temoin_titlePromise', 'ar', 'أظافر تلمع في خمس دقائق');

-- Garde-fous : composant synchronisé, limites de longueur du registre.
DO $$
DECLARE too_long int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM site_components WHERE key = 'kit-hero-angles') THEN
    RAISE EXCEPTION 'Composant kit-hero-angles absent : lancer sync:components d''abord — rien n''est modifié';
  END IF;
  SELECT count(*) INTO too_long
  FROM kit_hero_angles
  WHERE (field_key LIKE '%\_kicker' AND char_length(new_text) > 60)
     OR (field_key LIKE '%\_titleCategory' AND char_length(new_text) > 80)
     OR (field_key LIKE '%\_titlePromise' AND char_length(new_text) > 90);
  IF too_long > 0 THEN
    RAISE EXCEPTION '% texte(s) au-delà de la limite du registre — rien n''est modifié', too_long;
  END IF;
END $$;

WITH inserted AS (
  INSERT INTO component_field_bindings
    (id, component_id, field_key, locale, value, status, version, published_at, notes, author_id, created_at, updated_at)
  SELECT 'cfb_' || substr(md5(random()::text || k.field_key || k.locale), 1, 20),
         sc.id, k.field_key, k.locale, jsonb_build_object('v', k.new_text), 'published', 1, now(),
         'kit-hero-angles 2026-10', NULL, now(), now()
  FROM kit_hero_angles k
  JOIN site_components sc ON sc.key = 'kit-hero-angles'
  WHERE NOT EXISTS (
    SELECT 1 FROM component_field_bindings b
    WHERE b.component_id = sc.id AND b.field_key = k.field_key
      AND b.locale = k.locale AND b.status = 'published')
  RETURNING *
), history AS (
  INSERT INTO component_field_history
    (id, binding_id, component_id, field_key, locale, version, value, status, actor_id, action, notes, created_at)
  SELECT 'cfh_' || substr(md5(random()::text || i.id), 1, 16),
         i.id, i.component_id, i.field_key, i.locale, i.version, i.value, i.status, NULL, 'publish',
         'kit-hero-angles 2026-10', now()
  FROM inserted i
  RETURNING field_key, locale
)
SELECT field_key || ':' || locale AS champ_publie FROM history;

COMMIT;

-- Après exécution : le cache des champs (tag `components:fields:kit-hero-angles`)
-- n'est pas invalidé par SQL. Republier un champ depuis l'admin le purge ; sinon
-- vider `.next/cache/fetch-cache` puis redémarrer (cf. 2026-10-switch-prod.sh).
