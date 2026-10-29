-- Chat : offre GLOW99 + livraison payante + contenus alignés sur la fiche produit (29/10/2026).
-- Doc : docs/chat-assistant/23-promo-glow99-livraison.md.
-- Les jetons {{promo_code}} {{promo_price}} {{list_price}} {{promo_end}} sont rendus en direct
-- depuis le coupon (src/lib/chat/promo-offer.ts) ; sans offre active, l'entrée est écartée.
-- Usage : psql -v ON_ERROR_STOP=1 -d femiglow -f 2026-10-chat-promo-glow99.sql

BEGIN;

-- ─── 1. FAQ (servies telles quelles, avant le LLM) ────────────────────────────
CREATE TEMP TABLE faq_new (key text PRIMARY KEY, reply text, enabled boolean) ON COMMIT DROP;
INSERT INTO faq_new (key, reply, enabled) VALUES
('price-pack-fr', 'Le Pack FemiGlow est à {{list_price}} dh. Avec le code {{promo_code}}, il passe à {{promo_price}} dh, jusqu''au {{promo_end}}. Il réunit la paste (15 g), la powder (8 g) et le polissoir Step 4 : environ six mois de soins, à raison d''une fois par semaine. La livraison s''ajoute, à un tarif doux selon votre ville. Je vous réserve le Pack à {{promo_price}} dh ? Laissez-moi votre prénom et votre numéro.', true),
('price-pack-ar', 'طقم FemiGlow بـ {{list_price}} درهم. وبالرمز {{promo_code}} يصبح بـ {{promo_price}} درهم، إلى غاية {{promo_end}}. يضمّ العجينة (15 غ) والبودرة (8 غ) ومبرد التلميع Step 4 : حوالي ستة أشهر من العناية، مرّة في الأسبوع. يُضاف التوصيل بثمن مناسب حسب مدينتك. هل أحجز لكِ الطقم بـ {{promo_price}} درهم؟ اتركي لي اسمك ورقم هاتفك.', true),
('price-pack-ar-ma', 'L-Pack FemiGlow b {{list_price}} dh. B l-code {{promo_code}} kayweli b {{promo_price}} dh, htal {{promo_end}}. Fih l-paste (15 g), l-powder (8 g) w l-polissoir Step 4 : 9rib 6 chhour dyal s-soin, mra f s-simana. L-livraison katzad b taman mzyan 3la 7sab l-mdina dyalk. N-hjz lik l-pack b {{promo_price}} dh ? Khalli liya smitk w r-ra9m dyalk.', true),
-- Prix « à l'unité » d'un ancien produit de soin de la peau : n'existe pas pour le kit.
('price-unit-fr', NULL, false),
('shipping-cost-fr', 'Avec le code {{promo_code}}, le Pack est à {{promo_price}} dh. La livraison s''ajoute : elle n''est pas offerte, mais son tarif est très doux. Il dépend de votre ville, et une conseillère vous le confirme avec votre commande. Laissez-moi votre prénom et votre numéro : elle vous rappelle dans la journée.', true),
('shipping-time-fr', 'Rabat : livraison en 24 h. Reste du Maroc : 48 à 72 h. Vous payez à la réception, après avoir ouvert et vérifié le colis.', true),
('shipping-time-ar', 'الرباط : التوصيل خلال 24 ساعة. باقي المغرب : من 48 إلى 72 ساعة. تدفعين عند الاستلام، بعد فتح الطرد والتحقّق منه.', true),
('shipping-time-ar-ma', 'Rabat : l-livraison f 24 sa3a. Ba9i l-maghrib : 48 l 72 sa3a. Katkhelssi 3and l-istilam, mn b3d ma t7elli l-colis w tchoufih.', true),
('payment-fr', 'Paiement à la livraison, en espèces, au livreur : vous ouvrez et vérifiez le colis avant de payer. Aucune avance, aucun acompte, aucune carte à donner.', true),
('payment-ar', 'الدفع عند الاستلام نقدًا للموزّع : تفتحين الطرد وتتحقّقين منه قبل الدفع. بدون أيّ دفع مسبق ولا عربون ولا بطاقة.', true),
('payment-ar-ma', 'Katkhelssi 3and l-istilam, cash, l l-livreur : t7elli l-colis w tchoufih 9bel ma tkhelssi. Bla khalss msbe9, bla 3arboun, bla carte.', true),
('composition-fr', 'Le Pack réunit trois pièces : la paste « 1 Paste » (15 g, cire d''abeille, huile de jojoba, tocophérol), la powder « 2 Powder » (8 g, talc, poudre de riz, silice) et le polissoir « Step 4 » trois faces au kaolin. Formule halal, sans alcool dénaturé. Elle contient de la cire d''abeille : elle n''est pas végétalienne. INCI complet sur la page produit.', true),
('halal-fr', 'Oui, la formule est halal : pas d''alcool dénaturé, pas de dérivé animal non conforme (gélatine, carmin). Elle contient de la cire d''abeille.', true),
('results-time-fr', 'La brillance se voit dès le premier soin et tient jusqu''à trois semaines. Le rituel : quatre gestes, cinq minutes, une fois par semaine. Avec la régularité, l''ongle naturel gagne en tenue.', true),
('results-time-ar-ma', 'L-lme3a katban mn awwel soin w kat-b9a htal 3 simanat. R-rituel : 4 harakat, 5 d9aye9, mra f s-simana. M3a l-istimrar, l-dfer kayweli s7i7 ktar.', true),
('return-policy-fr', 'Oui : vous avez trente jours pour nous retourner le Pack, même entamé. Deux lignes à info@femiglow-maroc.com suffisent, et le remboursement arrive sous cinq jours ouvrés.', true),
('side-effects-fr', 'La formule est d''origine naturelle et s''applique sur l''ongle, pas sur la peau. En cas d''allergie connue (par exemple à la cire d''abeille), vérifiez l''INCI complet sur la page produit et demandez l''avis de votre médecin avant le premier soin.', true),
('contact-care-fr', 'Écrivez-nous à info@femiglow-maroc.com, ou laissez ici votre prénom et votre numéro : une conseillère vous rappelle dans la journée.', true);

UPDATE chat_faq_entry f
SET scripted_reply = coalesce(n.reply, f.scripted_reply),
    enabled = n.enabled,
    updated_at = now()
FROM faq_new n
WHERE f.key = n.key
  AND (f.scripted_reply IS DISTINCT FROM coalesce(n.reply, f.scripted_reply) OR f.enabled IS DISTINCT FROM n.enabled);

-- ─── 2. Questions rapides ──────────────────────────────────────────────────────
-- 2a. Nouvelle question « code promo », en tête sur /kit et sur l'accueil.
INSERT INTO chat_canned_pair
  (id, key, page_pattern, audience, "order", enabled, label_fr, label_ar, label_ar_ma,
   scripted_reply_fr, scripted_reply_ar, scripted_reply_ar_ma, allow_followup_llm,
   triggers_lead_form, lead_form_copy_key, status)
SELECT 'cnp_' || substr(md5(random()::text || k.key), 1, 16), k.key, k.page, 'all', 0, true,
  'Le code promo {{promo_code}} ?',
  'الرمز الترويجي {{promo_code}}؟',
  'Code promo {{promo_code}} ?',
  'Oui ! Avec le code {{promo_code}}, le Pack FemiGlow passe de {{list_price}} dh à {{promo_price}} dh, jusqu''au {{promo_end}}. Paste, powder et polissoir Step 4 : environ six mois de soins. Laissez-moi votre prénom et votre numéro : une conseillère vous réserve le Pack à {{promo_price}} dh et vous confirme la livraison.',
  'نعم! بالرمز {{promo_code}} يصبح طقم FemiGlow بـ {{promo_price}} درهم بدل {{list_price}} درهم، إلى غاية {{promo_end}}. العجينة والبودرة ومبرد التلميع Step 4 : حوالي ستة أشهر من العناية. اتركي لي اسمك ورقم هاتفك : تحجز لكِ المستشارة الطقم بـ {{promo_price}} درهم وتؤكّد معكِ التوصيل.',
  'Iyeh ! B l-code {{promo_code}}, l-Pack FemiGlow kayweli b {{promo_price}} dh f blast {{list_price}} dh, htal {{promo_end}}. Paste, powder w polissoir Step 4 : 9rib 6 chhour dyal s-soin. Khalli liya smitk w r-ra9m dyalk : l-mostachara kat-hjz lik l-pack b {{promo_price}} dh w kat-2akked m3ak l-livraison.',
  true, true, 'purchase-intent', 'published'
FROM (VALUES ('promo-glow99', '/kit'), ('home-promo-glow99', '/')) AS k(key, page)
ON CONFLICT (key) DO UPDATE SET
  page_pattern = EXCLUDED.page_pattern, "order" = 0, enabled = true, status = 'published',
  label_fr = EXCLUDED.label_fr, label_ar = EXCLUDED.label_ar, label_ar_ma = EXCLUDED.label_ar_ma,
  scripted_reply_fr = EXCLUDED.scripted_reply_fr, scripted_reply_ar = EXCLUDED.scripted_reply_ar,
  scripted_reply_ar_ma = EXCLUDED.scripted_reply_ar_ma, triggers_lead_form = true,
  lead_form_copy_key = 'purchase-intent', updated_at = now();

-- 2b. /kit — « Je réserve mon Pack » au prix remisé, sans rareté inventée.
UPDATE chat_canned_pair SET
  label_fr = 'Je réserve mon Pack à {{promo_price}} dh',
  label_ar = 'أحجز طقمي بـ {{promo_price}} درهم',
  label_ar_ma = 'Nhjz l-pack dyali b {{promo_price}} dh',
  scripted_reply_fr = 'Avec plaisir. Avec le code {{promo_code}}, votre Pack est à {{promo_price}} dh au lieu de {{list_price}} dh, jusqu''au {{promo_end}}. Vous payez à la réception, après avoir vérifié le colis. Laissez-moi votre prénom et votre numéro : une conseillère confirme votre adresse et la livraison.',
  scripted_reply_ar = 'بكلّ سرور. بالرمز {{promo_code}} طقمك بـ {{promo_price}} درهم بدل {{list_price}} درهم، إلى غاية {{promo_end}}. تدفعين عند الاستلام بعد التحقّق من الطرد. اتركي لي اسمك ورقم هاتفك : تؤكّد المستشارة عنوانك والتوصيل.',
  scripted_reply_ar_ma = 'B koll farha. B l-code {{promo_code}}, l-pack dyalk b {{promo_price}} dh f blast {{list_price}} dh, htal {{promo_end}}. Katkhelssi 3and l-istilam mn b3d ma tchoufi l-colis. Khalli liya smitk w r-ra9m : l-mostachara kat-2akked l-adresse w l-livraison.',
  "order" = 1, updated_at = now()
WHERE key = 'kit-reserve-now';

-- 2c. Accueil — « Le Pack me convient-il ? » décrivait un soin de la peau.
UPDATE chat_canned_pair SET
  scripted_reply_fr = 'Le Pack est pensé pour l''ongle naturel, dès 14 ans : quatre gestes, cinq minutes, une fois par semaine, sans vernis ni lampe UV. La brillance tient jusqu''à trois semaines. Dites-moi en deux mots ce qui vous gêne (ongles cassants, ternes, qui se dédoublent…), ou laissez votre prénom et votre numéro : une conseillère vous répond.',
  scripted_reply_ar = 'الطقم مُعدّ للظفر الطبيعي، ابتداءً من 14 سنة : أربع حركات، خمس دقائق، مرّة في الأسبوع، بلا طلاء ولا مصباح UV. ويدوم اللمعان حتى ثلاثة أسابيع. أخبريني في كلمتين بما يزعجك (أظافر هشّة، باهتة، تتقشّر…)، أو اتركي اسمك ورقمك : تجيبك المستشارة.',
  scripted_reply_ar_ma = 'L-pack m-sawb l d-dfer t-tabi3i, mn 14 3am : 4 harakat, 5 d9aye9, mra f s-simana, bla vernis w bla lampe UV. L-lme3a kat-b9a htal 3 simanat. 9oul liya f jouj klmat ach kay-9l9ek (dfar kat-t9ssem, bla lme3a…), wla khalli smitk w r-ra9m : l-mostachara kat-jawbek.',
  "order" = 2, updated_at = now()
WHERE key = 'home-fit-check';

-- 2d. Archivées : témoignages et cas « peau » sans rapport avec le kit, et le
--     « meilleur prix » remplacé par la question code promo.
UPDATE chat_canned_pair SET status = 'archived', updated_at = now()
WHERE key IN ('home-impressive-result', 'home-best-price', 'kit-similar-case') AND status <> 'archived';

-- 2e. Ordre final : accueil = code promo, convient-il, rappel ;
--     /kit = code promo, réserver, sans avance, rappel.
UPDATE chat_canned_pair SET "order" = 3, updated_at = now() WHERE key IN ('home-callback', 'kit-callback-2min');
UPDATE chat_canned_pair SET "order" = 2, updated_at = now() WHERE key = 'kit-zero-risk';

-- ─── Contrôles ────────────────────────────────────────────────────────────────
SELECT 'faq_actives_peau_ou_offerte' AS check, count(*) FROM chat_faq_entry
 WHERE enabled AND scripted_reply ~* '(peau|centella|niacinamide|matin et soir|livraison (offerte|gratuite)|06XX|14 jours|majania|مجاني)'
UNION ALL
SELECT 'pills_publiees_kit', count(*) FROM chat_canned_pair WHERE status = 'published' AND enabled AND page_pattern = '/kit'
UNION ALL
SELECT 'pills_publiees_home', count(*) FROM chat_canned_pair WHERE status = 'published' AND enabled AND page_pattern = '/';

SELECT page_pattern, "order", key, label_fr FROM chat_canned_pair
 WHERE status = 'published' AND enabled AND page_pattern IN ('/', '/kit') ORDER BY page_pattern, "order";

COMMIT;
