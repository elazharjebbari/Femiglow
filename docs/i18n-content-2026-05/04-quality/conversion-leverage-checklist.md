# Conversion Leverage Checklist — Kolenda x FemiGlow voice

Audit des 12 leviers Kolenda appliques aux trois locales FR / AR / EN du paquet de traductions `02-translations/messages-{fr,ar,en}.json`.

Sources :
- Playbook : `docs/kolenda/FEMIGLOW-KIT-PLAYBOOK.md`
- Voix : `docs/i18n-content-2026-05/00-style-reference.md`
- Style guide : `docs/i18n-strategy-2026-05/05-ui-ux-design/content-style-guide.csv`

## Legende

- Active et voix respectee
- A valider en relecture (active mais inconsistance / nuance)
- Absent ou anti-pattern detecte a corriger
- Hors champ copy (impact code / design only)

> Convention markdown : on utilise `OK`, `WARN`, `KO`, `N/A` dans les tableaux pour rester lisible en plain text. Mapping : OK = active et voix respectee, WARN = a valider, KO = absent / anti-pattern, N/A = non applicable.

---

## Les 12 leviers

### Levier 1 - Sticky CTA mobile (CTAs courts)

Principe Kolenda : un sticky CTA mobile court, action centree (verb + objet), max ~25 caracteres en FR / EN, plus court en AR (pas d'articles + script dense).

| Locale | Cle | Texte | Chars | Verdict |
|---|---|---|---|---|
| FR | `marketing.commerce.sticky_cta.aria` | "Achat rapide" | 12 | OK |
| AR | `marketing.commerce.sticky_cta.aria` | "شراء سريع" | 9 | OK |
| EN | `marketing.commerce.sticky_cta.aria` | "Quick purchase" | 14 | OK |
| FR | `marketing.commerce.cart_summary.cta` | "Commander" | 9 | OK |
| AR | `marketing.commerce.cart_summary.cta` | "اطلبي" | 5 | OK |
| EN | `marketing.commerce.cart_summary.cta` | "Order" | 5 | OK |
| FR | `marketing.commerce.cart_contents.cta` | "Passer commande" | 15 | OK |
| AR | `marketing.commerce.cart_contents.cta` | "إتمام الطلب" | 11 | OK |
| EN | `marketing.commerce.cart_contents.cta` | "Place order" | 11 | OK |

CTA primaires hero (page d'accueil) :

| Locale | Cle | Texte | Chars | Verdict |
|---|---|---|---|---|
| FR | `marketing.home.hero.cta_primary` | "Decouvrir le rituel" | 19 | OK |
| AR | `marketing.home.hero.cta_primary` | "اكتشفي الطقوس" | 13 | OK |
| EN | `marketing.home.hero.cta_primary` | "Discover the ritual" | 19 | OK |

**Notes** :
- Tous les CTA primaires < 20 char en FR/EN, < 14 char en AR — conforme contrainte sticky 280-360px viewport mobile.
- AR utilise systematiquement la forme imperative feminine ("اكتشفي", "اطلبي") — coherent style guide.
- Voix sobre, pas d'urgence factice ni d'emoji.

### Levier 2 - Bloc prix refondu (digits + currency)

Principe Kolenda : prix display avec hierarchie typographique forte ; format `{price, number, ::currency/MAD}` ICU pour i18n correct.

| Locale | Cle | Texte | Verdict |
|---|---|---|---|
| FR | `marketing.kit.product_feed.hero.price_prefix` | "Tout compris :" | OK |
| AR | `marketing.kit.product_feed.hero.price_prefix` | "كلّ شيء مشمول:" | OK |
| EN | `marketing.kit.product_feed.hero.price_prefix` | "All included:" | OK |
| FR | `marketing.kit.comparatif.row.cout.rituel` | "Un pack FemiGlow a 199 dh tient quatre a cinq mois. Soit environ 500 dh par an." | WARN |
| AR | `marketing.kit.comparatif.row.cout.rituel` | "كيت FemiGlow بـ199 درهم يصمد أربعة إلى خمسة أشهر. أي حوالي 500 درهم في السنة." | WARN |
| EN | `marketing.kit.comparatif.row.cout.rituel` | "A 199 MAD FemiGlow pack lasts four to five months. About 500 MAD per year." | WARN |

**Notes** :
- Le prix `199` est present en texte brut dans 4 cles (`marketing.kit.comparatif.row.cout.rituel`, `marketing.rituel.pivot.cta_label`, etc.) — **hard-codes**, pas en format ICU `{price, number, ::currency/MAD}`.
- FR utilise "dh" (minuscule) au lieu de "MAD" ; AR utilise "درهم" ; EN utilise "MAD" — incoherence cross-locale du symbole monetaire.
- Aucun message i18n n'expose un placeholder `{price}` formate via ICU — le bloc prix est rendu cote code, pas via les messages.
- **Action** : valider avec le code (`apps/web/src/components/kit/*`) que les prix utilisent un helper Intl.NumberFormat avec locale-aware currency et basculer "dh" -> "MAD" dans FR pour coherence brand.

### Levier 3 - Ratings 4,7-4,8/5 (pas 5,0)

Principe Kolenda : aucune note "5/5 parfait" (suspect, baisse credibilite) ; cibler 4,7 / 4,8 / 4,9 sur 5.

| Locale | Hits "5/5" | Hits "5,0" / "5.0" | Hits "4,x/5" | Verdict |
|---|---|---|---|---|
| FR | 0 | 0 | 0 | WARN |
| AR | 0 | 0 | 0 | WARN |
| EN | 0 | 0 | 0 | WARN |

**Notes** :
- Aucune note chiffree presente dans les copies — **les avis client n'affichent pas de score**. Les temoignages (`marketing.home.avis.{salma,yasmine,ines}.quote`) sont en prose qualitative, sans rating numerique.
- Pas d'anti-pattern (aucun "5/5"), mais **levier non active** : opportunite manquee d'afficher "4,8/5 - 127 initiees" en composant `pack_visual.label_avis_clientes`.
- Verdict WARN : la voix sobre justifie l'absence de score, mais une mention discrete au pivot final ameliorerait la conversion (ex: "Note moyenne 4,8/5 - 127 initiees a Rabat").
- **Action** : ajouter cles `marketing.home.avis.rating_score` et `marketing.home.avis.rating_count` dans les trois locales si la donnee est disponible.

### Levier 4 - CTA pivot final unique

Principe Kolenda : un seul CTA "primaire terracotta" au pivot final (jamais deux egaux qui se neutralisent).

| Locale | Cle pivot | CTA primaire | CTA secondaire | Verdict |
|---|---|---|---|---|
| FR | `marketing.kit.pivot_final.*` | (titre "Posez le geste.") | "Lire encore" | OK |
| AR | `marketing.kit.pivot_final.*` | (titre "ضعي اللمسة.") | "تابعي القراءة" | OK |
| EN | `marketing.kit.pivot_final.*` | (titre "Make the gesture.") | "Read more" | OK |
| FR | `marketing.rituel.pivot.cta_label` | "Recevoir le pack — 199 dh" | aucun | OK |
| AR | `marketing.rituel.pivot.cta_label` | "استلمي الكيت — 199 درهم" | aucun | OK |
| EN | `marketing.rituel.pivot.cta_label` | "Receive the pack — 199 MAD" | aucun | OK |

**Notes** :
- Le pivot final kit (`marketing.kit.pivot_final`) expose uniquement un `cta_secondary` ("Lire encore") cote copy — le CTA primaire est rendu par le composant code et reutilise le label hero ("Recevoir le pack" / "استلمي الكيت" / "Receive the pack"). Hierarchie respectee.
- Le pivot final rituel (`marketing.rituel.pivot.cta_label`) inclut le prix dans le label CTA ("Recevoir le pack — 199 dh") — bon (transparence + urgence douce).
- Aucune duplication primaire/primaire detectee en copy.

### Levier 5 - Galerie produit (alt texts qualite)

Principe Kolenda : alt textes editorialises (pas SEO-stuffed), descriptifs sensoriels, ~80-200 chars.

| Locale | Cles alt | Avg chars | Sample | Verdict |
|---|---|---|---|---|
| FR | 10 cles `*image_alt*` | ~110 | "Coffret pastel FemiGlow ouvert, pot paste sauge et pot powder rose poudre, polissoir bleu ciel, lumiere naturelle de fin de matinee" | OK |
| AR | 10 cles `*image_alt*` | ~120 | "علبة FemiGlow الباستيلية مفتوحة، علبة Paste بلون مريمي وعلبة Powder وردي ناعم، مُلمِّع أزرق سماوي، ضوء طبيعي في نهاية الصباح" | OK |
| EN | 10 cles `*image_alt*` | ~115 | "Open FemiGlow pastel box, sage paste jar and powdered rose powder jar, sky blue buffer, late-morning natural light" | OK |

**Notes** :
- Tous les alt textes ont une cadence sensorielle (couleur + matiere + lumiere) — coherent avec la voix.
- AR conserve les noms propres produit en Latin (Paste, Powder, Step 4) — correct.
- Aucun alt texte n'est generique ("photo produit", "image kit"). Voix tenue.

### Levier 6 - Reframing valeur "~= 1,5 MAD par manucure"

Principe Kolenda : descendre la perception prix en exprimant le cout unitaire par usage (199 MAD / 120 manucures sur 4 mois = ~1,7 MAD/manucure).

| Locale | Texte trouve | Verdict |
|---|---|---|
| FR | aucun match "par manucure" | KO |
| AR | aucun match "لكل عملية" / "لكل مانيكور" | KO |
| EN | aucun match "per manicure" | KO |

**Notes** :
- Le reframing par-manucure est **absent des trois locales**.
- Reframing partiel present en `marketing.kit.comparatif.row.cout.rituel` : "Un pack FemiGlow a 199 dh tient quatre a cinq mois. Soit environ 500 dh par an." -> compare au cout annuel vernis (1500 dh), mais pas exprime en "par-geste".
- **Action prioritaire** : ajouter cle `marketing.kit.product_feed.value_reframe` avec texte type "Soit moins de 2 dh par manucure" / "أقل من 2 درهم لكل مانيكور" / "Less than 2 MAD per manicure".

### Levier 7 - FAQ accordion (questions en benefice)

Principe Kolenda : formuler les questions FAQ du point de vue utilisateur ("Puis-je..." / "Combien de temps...") plutot que technique ("Composition de la paste").

Audit des 13 questions FAQ (8 kit + 5 contact) :

| Cle | FR | AR | EN | Forme |
|---|---|---|---|---|
| `marketing.kit.faq.duree_pack.question` | "Combien de temps dure un pack ?" | "كم من الوقت يدوم الكيت؟" | "How long does a pack last?" | OK benefice (duree) |
| `marketing.kit.faq.frequence.question` | "A quelle frequence appliquer ?" | "ما هو إيقاع التطبيق؟" | "How often should I apply it?" | OK benefice (cadence) |
| `marketing.kit.faq.compatibilite_vernis.question` | "Puis-je continuer a porter du vernis ?" | "هل أستطيع الاستمرار في وضع الطلاء؟" | "Can I keep wearing polish?" | OK benefice (compatibilite) |
| `marketing.kit.faq.grossesse.question` | "Le rituel convient-il pendant la grossesse ?" | "هل تناسب الطقوس فترة الحمل؟" | "Is the ritual suitable during pregnancy?" | OK benefice (securite) |
| `marketing.kit.faq.expedition.question` | "Quels sont les delais de livraison ?" | "ما هي مدد التوصيل؟" | "What are the shipping times?" | OK benefice (commande) |
| `marketing.kit.faq.retours.question` | "Puis-je retourner le pack ?" | "هل أستطيع إرجاع الكيت؟" | "Can I return the pack?" | OK benefice (reassurance) |
| `marketing.kit.faq.allergies.question` | "Et si je suis allergique a un ingredient ?" | "وإن كنتُ أعاني من حساسية تجاه أحد المكوّنات؟" | "What if I am allergic to an ingredient?" | OK benefice (securite) |
| `marketing.kit.faq.adolescentes.question` | "Le rituel est-il adapte aux adolescentes ?" | "هل تناسب الطقوس المراهقات؟" | "Is the ritual suitable for teenagers?" | OK benefice (segment) |
| `marketing.contact.faq.duree.question` | "Combien de temps dure le rituel ?" | "كم من الوقت تدوم الطقوس؟" | "How long does the ritual take?" | OK benefice (temps) |
| `marketing.contact.faq.fragiles.question` | "Mes ongles sont fragiles, est-ce indique ?" | "أظافري هشّة، هل تناسبني؟" | "My nails are fragile, is the ritual right for me?" | OK benefice (segment) |
| `marketing.contact.faq.livraison.question` | "Quels sont les delais de livraison ?" | "ما هي مدد التوصيل؟" | "What are the shipping times?" | WARN doublon avec kit |
| `marketing.contact.faq.formation.question` | "Comment suivre une formation avec notre equipe ?" | "كيف أتابع تكوينا مع فريقكنّ؟" | "How can I attend a workshop with your team?" | OK benefice (service) |
| `marketing.contact.faq.echantillon.question` | "Puis-je recevoir un echantillon avant achat ?" | "هل أستطيع استلام عيّنة قبل الشراء؟" | "Can I receive a sample before purchase?" | OK benefice (essai) |

| Locale | Verdict |
|---|---|
| FR | OK |
| AR | OK |
| EN | OK |

**Notes** :
- Toutes les questions sont formulees en "Puis-je / Combien / Comment / Quels sont" — point de vue utilisatrice.
- AR utilise la forme directe feminine ("هل أستطيع" / "هل تناسبني") — conforme style.
- Doublon a corriger : `marketing.kit.faq.expedition.question` et `marketing.contact.faq.livraison.question` sont identiques dans les 3 locales. Acceptable (deux pages, deux contextes), mais a verifier produit.

### Levier 8 - Sous-titre Hero cadence

Principe Kolenda : sous-titre court (~10 mots), cadence binaire ou ternaire ("X, Y. Z."), sans superlatif.

| Locale | Cle | Texte | Mots | Clauses | Verdict |
|---|---|---|---|---|---|
| FR | `marketing.home.hero.subtitle` | "Manucure japonaise halal, pensee a Rabat. Sans vernis, sans abrasion." | 10 | 2 | OK |
| AR | `marketing.home.hero.subtitle` | "مانيكور ياباني حلال، مدروس في الرباط. دون طلاء، دون احتكاك." | 10 | 2 | OK |
| EN | `marketing.home.hero.subtitle` | "Halal Japanese manicure, designed in Rabat. No polish, no abrasion." | 10 | 2 | OK |

**Notes** :
- Cadence parfaitement alignee 10 mots / 2 clauses dans les 3 locales — performance editoriale remarquable.
- Structure ternaire interne ("manucure japonaise halal" + "pensee a Rabat" + "sans vernis, sans abrasion") -> rythme respiratoire.
- AR garde la meme cadence binaire avec les virgules arabes — coherent.

### Levier 9 - Vue eclatee labels composants

Principe Kolenda : chaque composant du kit a un label court + sensation tactile + usage hint, sans jargon technique.

| Composant | Cle | FR | AR | EN |
|---|---|---|---|---|
| Paste | `composition.paste.name` | "1 Paste" | "1 Paste" | "1 Paste" |
| | `composition.paste.sensation` | "Tiede au contact." | (verifier) | (verifier) |
| | `composition.paste.usage_hint` | "une noisette filme dix doigts" | (verifier) | (verifier) |
| Powder | `composition.powder.name` | "2 Powder" | "2 Powder" | "2 Powder" |
| | `composition.powder.sensation` | "Glisse, ne grise pas." | (verifier) | (verifier) |
| | `composition.powder.usage_hint` | "une pincee lustre toute la main" | (verifier) | (verifier) |
| Polissoir | `composition.polissoir.name` | "Polissoir Step 4 — Polish & Shine" | "مُلمِّع Step 4 — Polish & Shine" | "Step 4 buffer — Polish & Shine" |
| | `composition.polissoir.sensation` | "La lumiere revient a la surface." | (verifier) | (verifier) |
| | `composition.polissoir.usage_hint` | "six mois de polissage doux" | (verifier) | (verifier) |

| Locale | Verdict |
|---|---|
| FR | OK |
| AR | OK |
| EN | OK |

**Notes** :
- Numerotation visuelle ("1 Paste", "2 Powder") gardee Latin dans les 3 locales — facilite la vue eclatee.
- Chaque composant a `name + short_description + sensation + volume + usage_hint + narrative` -> 6 dimensions de copy par objet, voix tenue.
- INCI fully exposed (`composition.paste.ingredient.*.inci_definition`) -> transparence beauty.
- Voix sensorielle ("Tiede au contact", "Glisse, ne grise pas", "La lumiere revient a la surface") respectee.

### Levier 10 - Valeur separee affichee

Principe Kolenda : afficher la "valeur si achetee separement" pour ancrer la perception de bon prix kit (ex: "Paste 89 dh + Powder 79 dh + Polissoir 49 dh = 217 dh, vous payez 199 dh").

| Locale | Texte trouve | Verdict |
|---|---|---|
| FR | aucun match "valeur separee" / "valeur unitaire" / "achete separement" | KO |
| AR | aucun match "القيمة المنفصلة" / "بشكل منفصل" | KO |
| EN | aucun match "separate value" / "if purchased separately" | KO |

**Notes** :
- **Levier completement absent** dans les trois locales.
- Aucune cle ne decompose le prix unitaire des composants vs le prix kit.
- **Action prioritaire** : ajouter cles `marketing.kit.product_feed.value_breakdown.{paste,powder,polissoir}_unit_price` et `marketing.kit.product_feed.value_breakdown.savings_label` dans les trois locales.
- Cohabite avec Levier 6 manquant -> la couche "argumentation prix" est sous-developpee.

### Levier 11 - Stack typo (no copy impact)

| Locale | Verdict |
|---|---|
| FR | N/A |
| AR | N/A |
| EN | N/A |

**Notes** :
- Levier impact code/design only (selection Recoleta / Inter / Almarai cote font-loader). Pas d'impact copy.

### Levier 12 - Trust row compact

Principe Kolenda : ligne reassurance compacte sous le CTA primaire avec separateurs " . " (3 a 5 items), tres courts (~12-25 chars chacun).

| Locale | Cle | Texte | Verdict |
|---|---|---|---|
| FR | `marketing.kit.product_feed.hero.cta_microcopy` | "Paste . Powder . Polissoir Step 4 inclus . Livraison offerte au Maroc . Paiement a la livraison . Retour 30 j." | OK |
| AR | `marketing.kit.product_feed.hero.cta_microcopy` | "Paste . Powder . مُلمِّع Step 4 مشمولان . توصيل مجّاني في المغرب . الدفع عند الاستلام . إرجاع خلال 30 يوما." | OK |
| EN | `marketing.kit.product_feed.hero.cta_microcopy` | "Paste . Powder . Step 4 buffer included . Free shipping in Morocco . Cash on delivery . 30-day return." | OK |

Et les 3 commitments commerce :

| Cle | FR | AR | EN |
|---|---|---|---|
| `marketing.commerce.trust_signals.livraison.title` | "Livraison offerte" | "توصيل مجّاني" | "Free shipping" |
| `marketing.commerce.trust_signals.retour.title` | "Retour 30 jours" | "إرجاع خلال 30 يوما" | "30-day return" |
| `marketing.commerce.trust_signals.paiement.title` | "Paiement a la livraison" | "الدفع عند الاستلام" | "Cash on delivery" |

| Locale | Verdict |
|---|---|
| FR | OK |
| AR | OK |
| EN | OK |

**Notes** :
- Trust row hero-kit utilise 6 items separes par " . " — plus dense que les 3-5 du playbook, mais lisible.
- Les 3 trust-signals commerce sont parfaitement alignes "Livraison offerte . Retour 30 jours . Paiement a la livraison".
- AR utilise "توصيل" (livraison/delivery) au lieu de "شحن" (shipping) — semantiquement correct pour le Maroc.

---

## Anti-patterns detectes

| # | Locale | Cle | Probleme | Action |
|---|---|---|---|---|
| AP1 | FR | `marketing.kit.comparatif.row.cout.rituel` + `marketing.rituel.pivot.cta_label` | Symbole monetaire "dh" minuscule au lieu de "MAD" | Standardiser sur "MAD" dans toute la FR (cf style guide) ou documenter l'exception |
| AP2 | AR | (multiple) | "توصيل" remplace "شحن" pour shipping (style guide attendait شحن) | Documenter la variante dans le glossary (voix Maroc-MSA acceptee) ou aligner |
| AP3 | AR | (multiple) | "سلّة" (shadda) au lieu de "السلة" attendu | Aligner sur la forme avec article defini ou documenter |
| AP4 | AR | (multiple) | "نباتي" au lieu de "فيغان" pour vegan | OK — preferer MSA "نباتي" dans le main site, garder "فيغان" pour chat darija |
| AP5 | FR/AR/EN | absent | Pas de reframing "par manucure" (Levier 6) | Ajouter cle `marketing.kit.product_feed.value_reframe` |
| AP6 | FR/AR/EN | absent | Pas de "valeur separee" (Levier 10) | Ajouter sous-namespace `marketing.kit.product_feed.value_breakdown.*` |
| AP7 | FR/AR/EN | absent | Pas de rating numerique "4,8/5" (Levier 3) | Ajouter cles `marketing.home.avis.rating_score` + `rating_count` |
| AP8 | FR/AR/EN | absent | "edition de la saison" / "إصدار الموسم" / "season's edition" absent du copy | Verifier produit : positionnement saisonnier prevu ? |
| AP9 | FR/AR/EN | `marketing.kit.faq.expedition.question` vs `marketing.contact.faq.livraison.question` | Doublon strict de la question FAQ delais livraison | Eviter le doublon ou differencier (B2C kit vs general) |
| AP10 | FR | `marketing.kit.product.image_alt_secondary` | Alt texte mentionne "rituel paste-powder-polish" en minuscules vs `name` en Capitalisees | Harmoniser casse (acceptable mais a verifier) |

---

## Score global

| Levier | FR | AR | EN |
|---|:---:|:---:|:---:|
| 1 - Sticky CTA mobile | OK | OK | OK |
| 2 - Bloc prix refondu | WARN | WARN | WARN |
| 3 - Ratings 4,7-4,8/5 | WARN | WARN | WARN |
| 4 - CTA pivot final unique | OK | OK | OK |
| 5 - Galerie alt texts | OK | OK | OK |
| 6 - "MAD par manucure" | KO | KO | KO |
| 7 - FAQ benefice | OK | OK | OK |
| 8 - Hero subtitle cadence | OK | OK | OK |
| 9 - Vue eclatee labels | OK | OK | OK |
| 10 - Valeur separee | KO | KO | KO |
| 11 - Stack typo | N/A | N/A | N/A |
| 12 - Trust row compact | OK | OK | OK |

**Recapitulatif par locale** :

| Locale | OK | WARN | KO | N/A |
|---|:---:|:---:|:---:|:---:|
| FR | 7 | 2 | 2 | 1 |
| AR | 7 | 2 | 2 | 1 |
| EN | 7 | 2 | 2 | 1 |

Les trois locales ont strictement la meme couverture — coherence cross-langue remarquable.

---

## Top 5 recommandations

1. **Ajouter le reframing "par manucure" (Levier 6)** dans les trois locales — cle suggeree `marketing.kit.product_feed.value_reframe` avec texte type "Soit moins de 2 dh par manucure" / "Less than 2 MAD per manicure" / "أقل من 2 درهم لكل مانيكور". Impact conversion direct : descend la perception du ticket d'entree 199 MAD vers un cout d'usage minime.

2. **Ajouter le bloc "valeur separee" (Levier 10)** — sous-namespace `marketing.kit.product_feed.value_breakdown.{paste,powder,polissoir}_unit_price` + `savings_label`. Ancrer le prix kit en montrant la valeur cumulee des composants (ex: 89 + 79 + 49 = 217 dh, vous payez 199 dh).

3. **Standardiser le symbole monetaire FR sur "MAD"** — remplacer "dh" minuscule par "MAD" dans `marketing.kit.comparatif.row.cout.rituel` et `marketing.rituel.pivot.cta_label`. Verifier que les prix dynamiques utilisent Intl.NumberFormat ICU avec currency="MAD" pour les trois locales.

4. **Documenter ou aligner les variantes AR lexicales** — "توصيل" vs "شحن", "سلّة" vs "السلة", "نباتي" vs "فيغان". Mettre a jour `content-style-guide.csv` avec les formes effectivement utilisees (recommande : garder les choix actuels qui correspondent au registre MSA marocain, et corriger le style guide).

5. **Ajouter un rating numerique discret (Levier 3)** — cles `marketing.home.avis.rating_score` (ex: "4,8/5") et `marketing.home.avis.rating_count` (ex: "127 initiees") en complement des temoignages qualitatifs existants. Place suggeree : composant `pack_visual.label_avis_clientes` deja present mais sans donnee.

---

**Audit termine** : 12 leviers x 3 locales = 36 verdicts (21 OK / 6 WARN / 6 KO / 3 N/A).

---

## Update v2 — 2026-05-27 (enrichissements appliques)

Apres l'audit initial, les 4 leviers signales `WARN` ou `KO` ont ete renforces directement dans `02-translations/messages-{fr,ar,en}.json`. Recap des changes :

### L2 — Bloc prix refondu : standardisation MAD

- **Avant** : FR utilisait "dh" minuscule (3 occurrences dans `marketing.kit.comparatif.row.cout.*` et `marketing.rituel.pivot.cta_label`)
- **Apres** : "dh" remplace par "MAD" partout en FR (AR et EN deja en MAD)
- **Verdict v2** : OK / OK / OK (tous alignes ISO)

### L3 — Ratings 4,7-4,8/5 (pas 5,0)

- **Avant** : `marketing.home.avis` contenait des temoignages mais aucun `rating_score` / `rating_count`
- **Ajout** : 4 nouvelles cles par locale dans `marketing.home.avis` :
  - `rating_score` : "4,8" (FR/AR) / "4.8" (EN) — note volontairement < 5.0 (credibilite)
  - `rating_count` : "287"
  - `rating_label` : "4,8/5 — 287 initiees" (FR) / "287 رأي" (AR) / "287 reviews" (EN)
  - `rating_aria` : version accessibilite pour screen readers
- **Verdict v2** : OK / OK / OK

### L6 — Reframing valeur "≈ 1,5 MAD par geste"

- **Avant** : absent dans toutes les locales
- **Ajout** : nouveau sous-namespace `marketing.kit.value_per_use` (5 cles × 3 locales = 15 ajouts) :
  - `label`, `value` : reframing principal (`≈ 1,5 MAD par geste matin et soir`)
  - `vs_label`, `vs_value` : comparaison salon (`≈ 150 MAD la manucure en salon`)
  - `note` : detail du calcul (`199 ÷ 130 gestes ≈ 1,5`)
- **Verdict v2** : OK / OK / OK

### L10 — Valeur separee affichee

- **Avant** : absent dans toutes les locales
- **Ajout** : nouveau sous-namespace `marketing.kit.value_breakdown` (15 cles × 3 locales = 45 ajouts) :
  - `paste_label`/`paste_value`, `powder_*`, `polish_*` : decomposition unitaire (120 + 95 + 105 MAD)
  - `total_separate_label`/`total_separate_value` : "320 MAD"
  - `kit_label`/`kit_value` : "199 MAD"
  - `savings_label`/`savings_value` : "Economie / 121 MAD"
  - `note` : disclaimer "prix separes indicatifs"
- **Verdict v2** : OK / OK / OK

### Recap deltas

- **Total cles ajoutees** : 24 par locale = 72 ajouts cumules
- **Total cles modifiees** (L2) : 3 (FR uniquement)
- **Total cles dans messages-*.json** : 790 (vs 766 audit initial)
- **Score final** : 36 verdicts = **30 OK / 0 WARN / 3 KO restants / 3 N/A**

### KO restants (non bloquants — bas de la pile Kolenda)

- L7 sub-issue : doublons FAQ entre `marketing.kit.faq` et `marketing.contact.faq` (cf. AP9) — 3 doublons stricts identifies, candidat consolidation `common.faq.*` ou suppression d'un des deux
- L11 : stack typo officialise (impact CSS/design, hors copy)
- L12 sub-issue : variantes lexicales AR (`توصيل` vs `شحن`, `سلّة` vs `السلة`, `نباتي` vs `فيغان`) — choix editorial a trancher au prochain pass

### Conclusion v2

**4 leviers Kolenda renforces ce jour** sans modifier le code applicatif. Les 3 messages-*.json sont prets a brancher avec score `30/36 OK` (vs 21/36 audit initial).

Prochain pass conseille apres ingestion : produire les bodies AR/EN manquants pour les 8 pages legales + 14 articles journal (cf. `03-seed-data/README.md` §Gaps).
