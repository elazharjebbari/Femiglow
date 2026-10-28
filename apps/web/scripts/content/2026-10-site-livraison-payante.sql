-- Livraison payante (28/10/2026) — suite de 2026-10-kit-livraison-payante.sql,
-- hors /kit : barre promo, chatbot (FAQ, réponses-types, consigne système) et
-- valeurs par défaut du registre CMS. Tarifs : 19 à 45 MAD selon la ville.
-- Usage : psql -v ON_ERROR_STOP=1 -d femiglow -f 2026-10-site-livraison-payante.sql

BEGIN;

-- 1. Barre promo : retire le tag « Livraison gratuite » (versionné + historique).
WITH updated AS (
  UPDATE component_field_bindings b
  SET value = (SELECT coalesce(jsonb_agg(t), '[]'::jsonb)
               FROM jsonb_array_elements(b.value) t WHERE t <> '"free_shipping"'::jsonb),
      version = b.version + 1,
      published_at = now(),
      updated_at = now(),
      notes = 'site-livraison-payante 2026-10'
  FROM site_components sc
  WHERE sc.id = b.component_id AND sc.key = 'global-promo-slide-header'
    AND b.field_key = 'tagOrder' AND b.status = 'published'
    AND b.value @> '["free_shipping"]'::jsonb
  RETURNING b.*
)
INSERT INTO component_field_history
  (id, binding_id, component_id, field_key, locale, version, value, status, actor_id, action, notes, created_at)
SELECT 'cfh_' || substr(md5(random()::text || u.id), 1, 16),
       u.id, u.component_id, u.field_key, u.locale, u.version, u.value, u.status, NULL, 'publish',
       'site-livraison-payante 2026-10', now()
FROM updated u;

-- 2. Valeurs par défaut du registre (formulaire admin).
UPDATE site_components
SET fields = replace(replace(fields::text, '"Livraison offerte"', '"Livraison partout au Maroc"'),
                     '"discount", "free_shipping", ', '"discount", ')::jsonb,
    updated_at = now()
WHERE key IN ('kit-hero-produit', 'global-promo-slide-header')
  AND fields::text ~ '("Livraison offerte"|"free_shipping")';

-- 3. FAQ chatbot.
UPDATE chat_faq_entry SET scripted_reply = replace(scripted_reply,
    'Livraison offerte dès 199 dh d''achat.',
    'Livraison selon la ville, dès 19 dh, réglée à la réception.'), updated_at = now()
WHERE key = 'price-pack-fr';
UPDATE chat_faq_entry SET scripted_reply = replace(scripted_reply,
    'التوصيل مجاني من 199 درهم.',
    'التوصيل حسب المدينة ابتداءً من 19 درهمًا، ويُدفع عند الاستلام.'), updated_at = now()
WHERE key = 'price-pack-ar';
UPDATE chat_faq_entry SET scripted_reply =
    'Les frais de livraison dépendent de votre ville : 19 dh à Casablanca, 35 dh à Rabat, Marrakech, Tanger ou Agadir, jusqu''à 45 dh ailleurs. Le montant exact s''affiche dans le formulaire dès que vous saisissez votre ville, et se règle à la livraison.',
    updated_at = now()
WHERE key = 'shipping-cost-fr';

-- 4. Réponses-types (servies depuis scripted_reply_*).
UPDATE chat_canned_pair SET
  scripted_reply_fr = replace(scripted_reply_fr, '**+ livraison offerte au Maroc**', '(livraison selon la ville, dès 19 dh)'),
  scripted_reply_ar = replace(scripted_reply_ar, '+ توصيل مجاني في المغرب', '(التوصيل حسب المدينة، ابتداءً من 19 درهمًا)'),
  scripted_reply_ar_ma = replace(scripted_reply_ar_ma, '+ l-livraison b''lach f l-Maghrib', '(l-livraison 3la 7sab l-mdina, mn 19 dh)'),
  updated_at = now()
WHERE key = 'home-best-price';
UPDATE chat_canned_pair SET
  scripted_reply_fr = replace(replace(scripted_reply_fr,
      'La livraison est offerte dès 199 dh d''achat.', 'Les frais de livraison dépendent de la ville, dès 19 dh.'),
      'Livraison gratuite dès 199 dh.', 'Frais de livraison selon la ville, dès 19 dh.'),
  scripted_reply_ar = replace(scripted_reply_ar, 'التوصيل مجاني من 199 درهم.', 'رسوم التوصيل حسب المدينة، ابتداءً من 19 درهمًا.'),
  scripted_reply_ar_ma = replace(scripted_reply_ar_ma, 'Lev''ya majania mn 199 dh.', 'L-livraison 3la 7sab l-mdina, mn 19 dh.'),
  updated_at = now()
WHERE key IN ('city-eta', 'home-shipping');

-- 5. Consigne système : nouvelle version (copie de l'active, corrigée), puis
--    bascule en deux temps (index unique « une seule active par scope »).
CREATE TEMP TABLE new_instruction (id text) ON COMMIT DROP;
WITH active AS (
  SELECT * FROM chat_instruction_version WHERE scope = 'default' AND enabled
), next AS (
  INSERT INTO chat_instruction_version (id, version, scope, body, body_ar, body_ar_ma, notes, enabled, created_by)
  SELECT 'ci_' || substr(md5(random()::text || a.id), 1, 16),
         (SELECT max(version) + 1 FROM chat_instruction_version WHERE scope = 'default'),
         a.scope,
         replace(replace(a.body,
           '- Livraison offerte partout au Maroc. Rabat : 24 h. Reste du Maroc :',
           E'- Livraison partout au Maroc, frais selon la ville (de 19 à 45 MAD,\n  affichés dans le formulaire avant validation). Rabat : 24 h. Reste du Maroc :'),
           '  livraison offerte. International', '  frais de livraison selon la ville. International'),
         replace(replace(a.body_ar,
           '- توصيل مجّاني في كلّ المغرب.',
           E'- توصيل إلى كلّ مدن المغرب، برسوم حسب المدينة (من 19 إلى 45 درهمًا،\n  تظهر في الاستمارة قبل التأكيد).'),
           '  توصيل مجّاني. خارج', '  رسوم التوصيل حسب المدينة. خارج'),
         replace(replace(a.body_ar_ma,
           '- Livraison b lalsh f koll l-maghrib.',
           E'- Livraison l koll l-mdoun dyal l-maghrib, l-taman 3la 7sab l-mdina\n  (mn 19 l 45 dh, kayban f l-formulaire 9bel t2kid).'),
           '  livraison b lalsh. Khariji', '  l-livraison 3la 7sab l-mdina. Khariji'),
         'Livraison payante au tarif de la ville (2026-10-28), copie de v' || a.version,
         false, a.created_by
  FROM active a
  WHERE a.body ~ 'Livraison offerte partout au Maroc'
  RETURNING id
)
INSERT INTO new_instruction SELECT id FROM next;
UPDATE chat_instruction_version SET enabled = false
WHERE scope = 'default' AND enabled AND EXISTS (SELECT 1 FROM new_instruction);
UPDATE chat_instruction_version SET enabled = true
WHERE id IN (SELECT id FROM new_instruction);

-- Contrôle : plus aucune mention active.
SELECT 'faq' AS src, count(*) FROM chat_faq_entry WHERE enabled AND scripted_reply ~* '(livraison (offerte|gratuite)|توصيل مجاني|التوصيل مجاني)'
UNION ALL SELECT 'canned', count(*) FROM chat_canned_pair
  WHERE (scripted_reply_fr || scripted_reply_ar || scripted_reply_ar_ma) ~* '(livraison (offerte|gratuite)|توصيل مجاني|majania|b''lach f l-Maghrib)'
UNION ALL SELECT 'instruction', count(*) FROM chat_instruction_version
  WHERE enabled AND (body || coalesce(body_ar, '') || coalesce(body_ar_ma, '')) ~* '(livraison offerte|مجّاني في كلّ|b lalsh)'
UNION ALL SELECT 'promo', count(*) FROM component_field_bindings b JOIN site_components sc ON sc.id = b.component_id
  WHERE sc.key = 'global-promo-slide-header' AND b.status = 'published' AND b.value @> '["free_shipping"]'::jsonb;

COMMIT;
