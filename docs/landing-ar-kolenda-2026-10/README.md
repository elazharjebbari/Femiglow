# Landing `/ar/kit` — audit des textes et réécriture (cadre Kolenda)

Date : 28 octobre 2026 · Page analysée : https://femiglow-maroc.com/ar/kit (prod, commit `95cdc1f2`)
Trafic visé : publicités Meta en **darija** (vidéos A–E), offre **GLOW99 → 99 DH**, paiement à la livraison.

Sources des textes : `apps/web/messages/ar.json` (namespace `marketing.kit.*`), `apps/web/src/data/mock/kit.ar.ts` (tagline produit), `apps/web/src/lib/rituals/seed-data.ts` (avis, en base, **français uniquement**).

---

## 1. Diagnostic global

| Constat | Effet sur la conversion | Principe Kolenda |
|---|---|---|
| **Fossé de langue** : les pubs parlent darija (« طلبيها دابا، وخلّصي ملّي توصلك »), la page parle un arabe standard littéraire, traduit mot à mot du français (« تُغلِّف اللوحة دون أن تخنقها », « يُرسي بطأه »). | Rupture de « message match » au premier écran ; lecture lente ; la visiteuse ne « s'entend » pas. | *Write Button Text That Feels Natural to Say* / lecture en voix intérieure ; *Use informal pronouns for warm brands*. |
| **Avis clients en français** sur la page arabe (bloc « أصوات الدار »). | La preuve sociale la plus forte devient illisible pour une partie de l'audience. | Preuve sociale ; fluidité. |
| **Mots étrangers** : « Paste / Powder / Step 4 » dans les chapitres vidéo, « g / mm », « INCI ». | Friction, sensation de traduction. | Fluidité ; concret. |
| **Copie abstraite et poétique** (« اللوحة تتنفّس », « يعود الضوء إلى السطح ») là où la visiteuse COD cherche du concret : combien, comment, quand ça arrive, est-ce que ça marche sur moi. | Moins d'imagerie mentale du résultat et de l'achat. | *Write Copy That Is Easy to Imagine* (concret > vague) ; *Help Customers Imagine the Purchase*. |
| **Négations en rafale** (« دون طلاء، دون أشعة، دون أسيتون… لا أسيتون، لا فثالات، لا تولوين »). | Chaque négation fait d'abord imaginer le négatif (acétone, produits chimiques). | *Avoid Negative Frames* (préférer « خالي من » / image positive) ; garder 1 négation-slogan forte (*negations feel powerful*). |
| **Passé** dans la preuve sociale (« شاركن », « جرّبن »). | Bénéfice perçu comme terminé. | *List Good Actions in the Present Tense*. |
| **Allégation « حلال »** dans la tagline. | Risque légal/Meta si non certifié ; et c'est moins concret que « rien à retirer avant le woudou ». | Concret > label. **À valider par toi.** |
| **Bloc prix** : « 90 درهم هدية… غير قابل للجمع » alors que GLOW99 se cumule ; prix par séance précis (≈ 7,96). | Confusion au moment clé ; le chiffre précis n'aide pas ici. | *Separate your discounts* (coupon visible = mieux) ; *Discount by amount off* ; *Reframe into smaller base values* (« أقل من 4 دراهم »). |
| **Sorties de page** (« ثلاث قراءات », « اقرئي المجلّة ») au milieu d'une landing COD. | Fuite de trafic avant commande. | *End ads by illustrating the next step* ; un seul chemin. |
| Points forts à garder : rassurances COD/retour/livraison visibles dès le hero, transparence INCI, 51 avis + 42 réachats, FAQ courte et vérifiable, avant/après réels. | — | *Keep positive words near actions* (assurances près du CTA). |

**Choix de langue recommandé (appliqué dans la proposition finale)** : *darija écrite claire* pour tout ce qui vend (titres, sous-titres, CTA, prix, rassurances, avis, formulaire) — même voix que les vidéos ; *arabe standard simple* pour ce qui doit inspirer la rigueur (ingrédients/INCI, réponses FAQ techniques). Kolenda : copie émotionnelle pour l'émotionnel, rationnelle pour le rationnel (*Align copy with brand emotionality*).

---

## 2. Bloc par bloc : rôle, diagnostic, propositions, évaluation

Notation : **Conv.** = impact attendu sur la conversion · **Marque** = cohérence avec la voix FemiGlow · **Risque**.

### B1 — Hero (titre, tagline, puces, prix, CTA, rassurances)
**Rôle** : confirmer en 2 secondes que la visiteuse est au bon endroit (même promesse que la pub), afficher l'offre, donner le premier clic.
**Actuel** : « كيت FemiGlow » / « مانيكور ياباني حلال. أربع حركات، دون طلاء. يبقى الوضوء سليمًا. » / puces « دون طلاء · دون أشعة فوق بنفسجية · دون أسيتون · متوافق مع الوضوء » / CTA « اطلبي الكيت ».
**Forces** : promesse woudou présente ; prix barré + COD visibles. **Faiblesses** : titre = nom produit (aucun bénéfice) ; « حلال » non concret et risqué ; 3 négations ; CTA neutre.

| Option | Tagline | Puces | CTA | Conv. | Marque | Risque |
|---|---|---|---|---|---|---|
| H-A (standard simple) | مانيكور ياباني في البيت: أظافر طبيعية لامعة في 5 دقائق، دون أن تُزيلي شيئًا قبل الوضوء. | خالٍ من الطلاء · خالٍ من الأسيتون · بلا مصباح UV · متوافق مع الوضوء | اطلبي الكيت الآن | ++ | ++ | faible |
| H-B (darija, message match pub) | المانيكور اليابانية فدارك: ظفار نقيين وكيلمعو ف5 دقايق، وما كاين ما يتحيّد قبل الوضوء. | بلا فيرني · بلا لامبة · بلا أسيطون · مناسب للوضوء | طلبي دابا وخلّصي ملّي يوصلك | +++ | ++ | faible |
| H-C (levier prix en tête) | 99 درهم عوض 199 بالكود GLOW99 — المانيكور اليابانية فدارك. | idem B | استافدي من 99 درهم | +++ (court terme) | + (agressif) | moyen : prix dans le texte statique ≠ prix réel si code absent |

**Choix** : H-B. Kolenda — voix intérieure naturelle, verbe d'action + assurance collée au CTA (« وخلّصي ملّي يوصلك »), 1 négation-slogan (« ما كاين ما يتحيّد ») plutôt que 3. Le prix reste dynamique (déjà calculé par le code).

### B2 — Bande de rassurance sous le hero
**Rôle** : lever les 3 freins COD (délai, risque, paiement). **Actuel** : « توصيل مجّاني الرباط 24 ساعة — المغرب 48 إلى 72 ساعة » / « إرجاع خلال 30 يوما حتى المفتوح » / « الدفع عند الاستلام تحقّقي قبل الدفع ».
**Faiblesses** : « حتى المفتوح » est agrammatical ; « تحقّقي قبل الدفع » est une très bonne idée mais formulée sèchement.

| Option | Textes | Évaluation |
|---|---|---|
| R-A | التوصيل فابور: الرباط ف24 ساعة، باقي المغرب ف2 حتى 3 أيام · 30 يوم باش ترجعيه، حتى إلا تحلّ · خلّصي غير ملّي يوصلك وتشوفيه | darija claire, concret (« 2 حتى 3 أيام » au lieu de 48–72 h), image positive. **Choix.** |
| R-B | توصيل مجاني خلال 24 إلى 72 ساعة · إرجاع خلال 30 يومًا حتى لو كان مفتوحًا · الدفع عند الاستلام بعد المعاينة | standard correct, moins chaleureux |

Kolenda : *Keep waiting periods within a bracket* → « 2 حتى 3 أيام » sonne plus court que « 48 إلى 72 ساعة ».

### B3 — Stories vidéo (« اكتشفي بالفيديو »)
**Rôle** : preuve visuelle rapide. **Actuel** : titres de vidéos poétiques (« طقوس المساء »).
**Proposition** : titre « شوفي كيفاش كتدار » ; chapitres concrets : « 4 حركات ف5 دقايق » · « قبل / بعد » · « رأي كليانة » · « شنو كاين فالكيت » · « المكوّنات ». Kolenda : *Write copy that is easy to imagine* (nommer ce qu'on va voir). Option alternative standard : « شاهدي الطريقة ».

### B4 — Composition (« التركيبة — ثلاثة أغراض، أربع حركات »)
**Rôle** : rendre le kit tangible (quoi, combien, à quoi ça sert). **Faiblesses** : « تُغلِّف اللوحة دون أن تخنقها », « مكانها على طاولة السرير… في الموسم » : abstrait ; unités « g / mm ».

| Option | Titre / chapeau | Fiches | Évaluation |
|---|---|---|---|
| C-A (concret darija) | **شنو كاين فالكيت** — 3 حوايج صغار، كيدخلو فيدّك وكيكفيوك 6 شهور. | 1 الباسْت · 15 غرام — كريمة كتغذّي الظفر. قدّ حبّة لوز كتكفي لـ10 صوابع. / 2 البودرة · 8 غرام — كتشرب الزيادة وكتعطي اللمعة. / 3 اللّيمة ديال اللمعان · 9 سنتيم — 3 وجوه، من الخشن للرطب، كتبيّن اللمعة الطبيعية. | +++ concret, quantités en mots courants. **Choix.** |
| C-B (standard simple) | محتوى الكيت — ثلاث قطع تكفيك ستة أشهر. | عجينة 15 غ … / بودرة 8 غ … / مبرد تلميع … | ++ lisible, moins chaleureux |

Kolenda : *Replace grams with pieces* (« قدّ حبّة لوز »), *Show anatomical layers* (1-2-3).

### B5 — Vidéo « الحركات »
**Rôle** : simulation d'usage → réduire la peur du « je n'y arriverai pas ». **Faiblesses** : chapitres en anglais ; long texte « كلين غيرل… شيء يجب أن تعرفيه قطعا » + avertissement « إن كانت أظافرك متعَبة… النتيجة لن تكون في أفضل حالاتها » placé avant l'achat (frein).
**Proposition** : titre « 4 حركات، ف90 ثانية » ; chapitres « 1 الباسْت · 2 البودرة · 3 اللّيمة · 4 اللمعة » ; transcription raccourcie et positive : « المانيكور اليابانية ماشي فيرني: هي عناية كتغذّي الظفر بشمع النحل والجوجوبا وكتعطيه لمعة طبيعية حتى 3 سيمانات. إلا كانت ظفارك عيانين، كيتحسّنو مع كل حصة. » Kolenda : *Avoid negative frames* (on transforme l'avertissement en progression), concret.

### B6 — Bloc prix / commande (« product feed »)
**Rôle** : le moment de décision — ancrage, valeur, réduction, CTA. **Actuel** : « كلّ شيء مشمول: 199 درهم 289 » / « توفّرين 90 درهم · 31 % » / « لقد تم تطبيق هدية الترحيب… غير قابل للجمع » / « ≈ 7,96 درهم لكل جلسة، على مدى 25 جلسة » / « 51 دار في المغرب ».
**Faiblesses** : titre abstrait (« تستقرّ الطقوس… ») ; « غير قابل للجمع » contredit le cumul GLOW99 ; % et montant côte à côte ; « 51 دار » incompréhensible.

| Option | Titre | Lignes | Évaluation |
|---|---|---|---|
| P-A (valeur + petite base) | **الكيت كامل، بثمن سيانس وحدة فالصالون** | « كلشي داخل: {prix} درهم بلاصة {barré} » · « ربحتي {économie} درهم » · « أقل من 4 دراهم للحصة » (dynamique) · « 51 كليانة فالمغرب عطاو رأيهم » | +++ ancrage salon (150–250 DH), réduction en montant, base réduite. **Choix.** |
| P-B (rationnel) | ثمن الكيت | lignes actuelles corrigées | + |
| P-C (urgence) | العرض محدود | — | rejeté : Kolenda montre que la pression augmente les retours ; contraire à la charte |

Kolenda : *Discount high prices by amount off* (montant > % à ce niveau de prix), *Separate your discounts* (afficher la ligne GLOW99), *Reframe into smaller base values*, *Group small words near a price* (« غير »). **Note technique** : la phrase « غير قابل للجمع » vient du moteur de coupons (pas de `ar.json`) → à remplacer par « كيتزاد مع الكود GLOW99 » quand le code est présent.

### B7 — Timeline « خمس دقائق في المجموع » + 3 bénéfices
**Rôle** : rendre l'effort ridicule. **Proposition** : « 5 دقايق، مرة فالسيمانة » ; étapes à l'impératif darija : « نقّي ظفارك (30 ثانية) · حطّي الباسْت (1 دقيقة) · حطّي البودرة ولمّعي (2 دقايق) · كمّلي باللّيمة (1 دقيقة) ». Bénéfices reformulés en positif : « مكوّنات طبيعية: شمع النحل، الجوجوبا، الكاولين، بودرة الروز » · « تركيبة رطبة، خالية من الأسيطون » · « ظفار أقوى ولمعة طبيعية ». Kolenda : *Prime the motion* (verbes de geste), positif.

### B8 — Formulaire de commande (« أربع حركات، تُسلَّم إلى دارك »)
**Rôle** : réduire la friction et faire imaginer la réception. **Proposition** : titre « عمّري المعلومات، والكيت يوصلك حتى لدارك » ; sous-titre « سميتك، تيليفونك والعنوان — وخلّصي غير ملّي يوصلك. التوصيل فابور: الرباط ف24 ساعة، باقي المغرب ف2 حتى 3 أيام. » ; CTA « أكّدي الطلب — الخلاص عند الاستلام ». Kolenda : *Help customers imagine the purchase* (« ملّي يوصلك »), *Keep assurances near actions*, bouton = prochaine étape immédiate.

### B9 — Avant / après (« ثلاث أيادٍ، ثلاثة مواسم »)
**Rôle** : preuve de résultat. **Proposition** : titre « 3 كليانات، 3 نتائج حقيقية » ; chapeau « تصاور بلا تعديل، بعد شهور ديال الاستعمال. » ; citations au présent : « من بعد 3 شهور، ظفري ولّى صحيح. » (Amal, Rabat) · « 5 دقايق فالليل، ولّات عادة كتريّحني. » (Lina, Casablanca) · « ما بقيتش نرجع للفيرني. » (Sara, Marrakech). Kolenda : présent, concret, *Show imperfect reviews* (garder des formulations sobres).

### B10 — Ingrédients (« التركيبة مقروءة سطرا سطرا »)
**Rôle** : crédibilité / sécurité. On garde l'**arabe standard** (contenu rationnel) en simplifiant : titre « كلّ المكوّنات، بوضوح » ; chapeau « الاسم، الدور، المصدر والنسبة لكل مكوّن. ما كاين حتى حاجة مخبّية. » ; « لحظة قصيرة من التطبيق، اللمسة مطفأة » → « ينشف بسرعة وما كيخلّيش أثر. » Kolenda : *Align copy with brand emotionality* (rationnel ici), *Explain why science is necessary* (une phrase).

### B11 — Avis (« أصوات الدار »)
**Rôle** : preuve sociale n° 1. **Problème bloquant** : citations en français. **Proposition** : titre « 51 كليانة عطاو رأيهم، و42 غادي يعاودو » (présent/futur) ; tags traduits ; 3 citations traduites en darija fidèle (voir §3). Données en base (`seed-data.ts`) → migration de contenu ar nécessaire.

### B12 — FAQ
**Rôle** : lever les dernières objections. **Proposition** : titre « الأسئلة لي كتجينا بزاف » ; réponses gardées (elles sont bonnes) mais corrigées : « حتى المفتوح » → « حتى إلا تحلّ » ; ajout d'une question woudou : « واش خاصني نحيّدها قبل الوضوء؟ — لا. ما كتخلّي حتى طبقة على الظفر، الما كيوصل للظفر عادي. » (à valider sur le fond). Kolenda : réponses courtes, vérifiables (déjà le cas).

### B13 — « ثلاث قراءات » (liens journal)
**Rôle actuel** : contenu de marque, mais **sortie** au milieu du tunnel. **Proposition** : titre « بغيتي تعرفي كتر؟ » et déplacer après la FAQ (ou retirer de `/ar/kit` pour le trafic payant). Décision produit, hors texte.

### B14 — Barre collante (sticky)
**Proposition** : « كيت FemiGlow · {prix} درهم » + bouton « طلبي دابا ».

---

## 3. Proposition finale (darija claire pour la vente, standard simple pour la technique)

| Bloc | Clé(s) `ar.json` / source | Texte final |
|---|---|---|
| Hero — tagline | `kit.ar.ts > tagline` | المانيكور اليابانية فدارك: ظفار نقيين وكيلمعو ف5 دقايق، وما كاين ما يتحيّد قبل الوضوء. |
| Hero — puces | `marketing.kit.hero.chips.*` | بلا فيرني · بلا لامبة UV · بلا أسيطون · مناسب للوضوء |
| Hero — CTA | `marketing.kit.hero.cta_commander` | طلبي دابا |
| Hero — sous-CTA | `marketing.kit.hero.trust.*` | التوصيل فابور · الخلاص عند الاستلام |
| Rassurance — livraison | `marketing.kit.reassurances.shipping.*` | التوصيل فابور — الرباط ف24 ساعة، باقي المغرب ف2 حتى 3 أيام |
| Rassurance — retour | `marketing.kit.reassurances.return.*`, `faq.retours.answer`, `commerce.trust_signals.retour.body` | عندك 30 يوم باش ترجعيه، حتى إلا تحلّ |
| Rassurance — paiement | `marketing.kit.reassurances.payment.*` | خلّصي غير ملّي يوصلك وتشوفيه |
| Stories — titre | `marketing.kit.stories.heading` | شوفي كيفاش كتدار |
| Composition — titre / chapeau | `marketing.kit.composition.section.*` | شنو كاين فالكيت — 3 حوايج صغار كيكفيوك حوالي 6 شهور. |
| Composition — fiches | `marketing.kit.composition.paste|powder|polissoir.*` | الباسْت · 15 غرام — كريمة كتغذّي الظفر، قدّ حبّة لوز كتكفي لـ10 صوابع. / البودرة · 8 غرام — كتشرب الزيادة وكتعطي اللمعة. / اللّيمة ديال اللمعان — 3 وجوه، من الخشن للرطب، كتبيّن اللمعة الطبيعية. |
| Vidéo — titre / chapitres | `marketing.kit.video.*` | 4 حركات ف90 ثانية · 1 الباسْت · 2 البودرة · 3 اللّيمة · 4 اللمعة |
| Vidéo — transcription | données vidéo (transcription hors `ar.json`, à localiser) | المانيكور اليابانية ماشي فيرني: عناية كتغذّي الظفر بشمع النحل والجوجوبا، وكتعطيه لمعة طبيعية حتى 3 سيمانات. إلا كانت ظفارك عيانين، كيتحسّنو مع كل حصة. |
| Prix — titre | `marketing.kit.product_feed.hero.title` | الكيت كامل، بثمن سيانس وحدة فالصالون |
| Prix — chapeau | `marketing.kit.product_feed.hero.*` (sous-titre) | 3 حوايج فيدّك، 4 حركات ف5 دقايق. كلشي داخل، والتوصيل فابور. |
| Prix — par séance | `marketing.kit.product_feed.per_usage.phrase` | أقل من {n} دراهم للحصة (≈ 25 حصة) |
| Prix — preuve | `marketing.kit.product_feed.social_proof.count_label_geo` | {count} كليانة فالمغرب عطاو رأيهم |
| Prix — CTA | `marketing.kit.product_feed.hero.cta_label` | طلبي دابا — الخلاص عند الاستلام |
| Timeline | `marketing.kit.product_feed.steps.*` | 5 دقايق، مرة فالسيمانة · نقّي ظفارك · حطّي الباسْت · حطّي البودرة ولمّعي · كمّلي باللّيمة |
| Bénéfices | `marketing.kit.product_feed.claims.*` | مكوّنات طبيعية · تركيبة رطبة خالية من الأسيطون · ظفار أقوى ولمعة طبيعية |
| Formulaire — titre / sous-titre | `marketing.kit.commander.title_default`, `subtitle_default` | عمّري المعلومات، والكيت يوصلك حتى لدارك — سميتك، تيليفونك والعنوان، وخلّصي غير ملّي يوصلك. |
| Avant/après — titre / chapeau | `marketing.kit.hands.*` | 3 كليانات، 3 نتائج حقيقية — تصاور بلا تعديل، بعد شهور ديال الاستعمال. |
| Ingrédients — titre / chapeau | `marketing.kit.ingredients.section.*` | كلّ المكوّنات، بوضوح — الاسم، الدور، المصدر والنسبة لكل مكوّن. ما كاين حتى حاجة مخبّية. |
| Avis — titre | `marketing.kit.rituals.headline_plural` | {count} كليانة عطاو رأيهم، و{repeat} غادي يعاودو |
| Avis — Khadija (Salé) | `seed-data.ts` (base) | «عجبني بلّي الماركة صريحة: ما كيوعدوش بالمعجزات، كيرافقوك. الباسْت ريحتها ريحة عناية ماشي كيماويات، واللمعة رطبة ماشي قاسحة بحال الفيرني. بناتي سولوني علاش يدّيا كيلمعو.» |
| Avis — Souad (Casablanca) | idem | «ظفري كان كيتقشّر مع أي حركة. جرّبت بزاف ديال الحلول وما نفع والو. هاد الروتين علّمني نغذّي ماشي نغطّي. من بعد 6 سيمانات ولّا ظفري مستوي.» |
| Avis — Amal (Rabat) | idem | «من بعد 3 شهور رجع ظفري صحيح. الجلدة لي داير بيه تهدّنات بلا ما نحسّ. الصباح كنحك بالليمة، وفالليل كنلمّع: ولّات عادة.» |
| FAQ — titre | `marketing.kit.faq.section.title` | الأسئلة لي كتجينا بزاف |
| FAQ — nouvelle question | nouvelle clé `marketing.kit.faq.wudu` (à ajouter aussi en `fr`/`en` : test de parité) | واش خاصني نحيّدها قبل الوضوء؟ — لا. ما كتخلّي حتى طبقة فوق الظفر. *(à valider sur le fond)* |
| Lectures | `marketing.kit.journal_grid.title` | بغيتي تعرفي كتر؟ |
| Sticky | composant sticky | كيت FemiGlow · {prix} درهم — طلبي دابا |

### Points à valider avant la mise en prod
1. Retirer « حلال » de la tagline (ou le garder seulement si une certification existe).
2. L'affirmation woudou (« rien ne couvre le ongle ») est-elle validée techniquement ? Elle est déjà sur la page ; la FAQ la rend plus explicite.
3. Darija pour les blocs de vente : OK pour toi ?
4. Les avis (base de données) demandent une migration de contenu en plus du fichier `ar.json`.
5. Ne pas modifier les blocs `fr`/`en` (le test de parité des messages exige les mêmes **clés**, pas les mêmes textes).

---

## 4. Version retenue : arabe classique (فصحى) — 28/10/2026

À la demande, tout le contenu a été réécrit en **arabe classique clair** (pas de darija), en gardant les principes Kolenda : concret, présent, chiffres en chiffres, formulations positives, réduction en montant, assurances collées aux CTA. La structure des composants est respectée : mêmes clés, mêmes variables ICU, limites du registre CMS.

| Source | Fichier | Contenu |
|---|---|---|
| Libellés de tous les blocs | `apps/web/messages/ar.json` (`marketing.kit.*`) | 281 clés couvertes, 213 réécrites. Seul `product_feed.value_breakdown.savings_phrase` perd `{pct}` (montant seul). |
| Hero (fallback code) | `apps/web/src/data/mock/kit.ar.ts` | tagline + description |
| Hero publié (CMS) | `apps/web/scripts/content/2026-10-kit-ar-fusha.sql` | tagline, description, chips, trustRow (à exécuter en prod) |
| Note de bienvenue | `CouponWelcomeNote.tsx`, `WizardShell.tsx` | 4 libellés |
| Titres des stories | `apps/web/scripts/seed-stories.ts` | 4 titres + CTA (re-seed en prod) |
| Avis arabes | `apps/web/src/lib/rituals/seed-data.ts` | 3 avis reformulés. **Ils ne sont pas en base de prod** : la page retombe sur le français. À insérer lors de la mise en prod. |

« حلال » est conservé (angle posé volontairement le 17/10).
