# Review Notes — décisions à valider founder

> Document produit en parallèle de `02-translations/messages-fr.json` (FR canonical).
> Date : 2026-05-27. Périmètre : 766 strings i18n FemiGlow.
>
> Toute valeur "drift" listée ici a été conservée TELLE QUELLE dans le JSON canonical pour ne pas devancer une décision founder. Les normalisations stylistiques (emoji, CAPS, "!" marketing) ont été appliquées sans changement de sens.

## 1. Drifts détectés dans le code source (à corriger côté code)

### 1.1 Drift géographique : Casablanca vs Rabat

L'organisation est éditée à **Rabat** (audit 08/09 — `25 bis avenue Patrice Lumumba`). Mais plusieurs sources émettent encore "Casablanca" ou "France" :

| Fichier | Ligne | Valeur source | Clé inventory |
|---|---|---|---|
| `src/lib/seo/defaults.ts` | 46 | `addressLocality: 'Casablanca'` | `seo.json_ld.organization.address_locality` |
| `src/lib/seo/defaults.ts` | 71 | `"...éditée à Casablanca..."` | `seo.settings.default_description` |
| `src/data/mock/articles.ts` | 275 | `"Le soleil casablancais reprend sa hauteur."` | `marketing.journal.article.excerpt.avril_soleil` (legitimement contextuel — article saisonnier sur Casablanca) |
| `src/lib/products/feed/kit-feed.ts` | 243 | `"{count} maisons en France"` | `marketing.kit.product_feed.social_proof.count_label_geo` |
| `src/data/mock/homepage.ts` | 56 | `"Casablanca"` (Salma testimonial) | `marketing.home.avis.salma.context` (legitime — résidence d'une initiée) |
| `src/data/mock/kit.ts` | 289 | `"Casablanca"` (Lina testimonial) | `marketing.kit.hands_testimonials.lina.city` (legitime — résidence) |

**Décision attendue** : confirmer Rabat partout dans la maison-éditrice. Les références "Casablanca" en testimonials sont legitimes (résidence des initiées). Le `count_label_geo "maisons en France"` est un vrai bug : on est au Maroc.

### 1.2 Drift gestes : 3 vs 4 vs 5

Le nombre de gestes du rituel varie selon les fichiers. Source unique à trancher :

| Fichier | Ligne | Valeur | Clé |
|---|---|---|---|
| `src/components/sections/GestesGrid.tsx` | 16 | `"Cinq gestes, cinq minutes."` (mais liste de 3 gestes — paste/powder/polish) | `marketing.home.gestes.title` |
| `src/lib/seo/defaults.ts` | 38 | `"...en quatre gestes."` | `seo.json_ld.organization.description` |
| `src/lib/seo/defaults.ts` | 71 | `"...quatre gestes : pâte, poudre, brillance, polissage."` | `seo.settings.default_description` |
| `src/lib/products/feed/kit-feed.ts` | 174 | `"Quatre gestes lents, une fois par semaine."` | `marketing.kit.product_feed.steps.header.lead` |
| `src/data/mock/rituel.ts` | 11 | `"Manucure japonaise. Deux gestes. Un éclat lent."` | `marketing.rituel.hero.title` |
| `src/data/mock/homepage.ts` | 11 | `"Deux gestes, un éclat révélé."` | `marketing.home.hero.title` |
| `src/lib/menu-descriptions.ts` | 14 | `"Deux gestes, un polissoir."` | `navigation.menu.rituel_description` |
| `src/lib/menu-descriptions.ts` | 20 | `"Paste, powder, polissoir Step 4. Cinq minutes par soir."` | `navigation.menu.kit_description` |

**Décision attendue** : la source officielle dans `00-style-reference.md` (§3.2) dit "deux gestes, un polissoir". Recommandation : harmoniser sur **"deux gestes, un polissoir"** ou **"trois gestes"** (paste + powder + polissoir). Les "quatre gestes" et "cinq gestes" semblent abandonnés.

### 1.3 Drift sur le nom du produit (Pack vs Kit)

| Valeur | Sources |
|---|---|
| `Pack FemiGlow` | `src/data/mock/product.ts:11`, `src/data/mock/kit.ts:180` (comparatif), `src/lib/products/feed/kit-feed.ts` |
| `Le pack` | `src/lib/menu-descriptions.ts:19`, `src/components/layout/Footer.tsx` columns kit, mocks |
| `Le kit` | `src/components/layout/Footer.tsx:15` (route.kit label) |
| `Le Kit` (capitalisé) | `src/lib/seo/known-pages.ts:10` |

**Décision attendue** : choisir entre `Pack FemiGlow` (officiel commercial) et `Le pack` (sobre). Et arbitrer la cohabitation avec "Le kit" (footer.tsx + known-pages.ts) qui crée un drift visible.

### 1.4 Drift sur la fondatrice (anonymisation incomplète)

Le commit récent `1d3a8c5 fix(legal-v2): finaliser anonymisation marketing` semble avoir anonymisé les mocks, mais d'autres sources nomment encore la fondatrice :

| Valeur | Sources | Clé |
|---|---|---|
| `Yasmine Jebbari` | `src/lib/seo/defaults.ts:42` | `seo.json_ld.organization.founder_name` |
| `Salma Jebbari` | `src/app/(marketing)/mentions-legales/page.tsx:51` | `legal.mentions_legales.editor.director` |
| `notre fondatrice` (anonyme) | majorité des mocks (`maison.ts`, `rituel.ts`, `EditorialLetter.tsx`) | `marketing.maison.*`, `marketing.rituel.interview.*`, `marketing.commerce.merci.letter.*` |
| `Notre fondatrice` (capitalisé) | `src/data/mock/rituel.ts:104` | `marketing.rituel.interview.nom_interviewee` |

**Décision attendue** : confirmer la politique d'anonymisation. Si oui, retirer Yasmine Jebbari de `defaults.ts:42` et remplacer Salma Jebbari par "notre fondatrice" dans mentions-legales (ou inversement si le founder veut signer le legal de son vrai nom). Légalement, la directrice de publication doit être nommée — peut-être garder le nom uniquement en legal et anonymiser le marketing.

### 1.5 Drift volumes packshots

| Composant | Source 1 (kit.ts) | Source 2 (kit-feed.ts) | Drift |
|---|---|---|---|
| Paste | `15 g` (L24) | `1 Paste · 30 ml` (L294) | unité (g vs ml) ET valeur (15 vs 30) |
| Powder | `8 g` (L75) | `2 Powder · 30 g` (L294) | valeur (8 vs 30) |

**Décision attendue** : volumes officiels du packshot. Pertinent pour les fiches techniques INCI et la certification halal.

### 1.6 Typo : "Hémisphage" probablement incorrect

- `src/data/mock/kit.ts:48` : `"Hémisphage des cuticules"` → clé `marketing.kit.composition.paste.ingredient.jojoba.function`

Le mot "hémisphage" n'existe pas en français cosmétique. Probable typo pour :
- `Émollient` (assouplit les cuticules) — terme cosmétique standard
- `Adoucissant` 
- `Hydratant`

**Décision attendue** : confirmer la correction. Valeur conservée telle quelle dans le JSON.

### 1.7 Drift "5 minutes le soir" vs "une fois par semaine"

- `marketing.kit.product_feed.steps.header.total_duration` : `"5 minutes le soir"` (kit-feed.ts:173)
- `marketing.kit.product_feed.steps.header.lead` : `"Quatre gestes lents, une fois par semaine."` (kit-feed.ts:174)

Sur la même section product feed, deux fréquences incompatibles cohabitent. La voix éditoriale principale dit "cinq minutes par jour" (homepage hero, FAQ, manifeste).

**Décision attendue** : trancher la fréquence officielle (quotidien ou hebdomadaire).

### 1.8 Drift "trois lectures" pour journal cross

- `marketing.rituel.journal_cross.title` : `"Trois lectures de la maison."` 
- `marketing.commerce.journal_cross_panier.description` : `"Trois lettres par saison. Aucune urgence."`

Lecture vs lettre, à uniformiser.

### 1.9 Pages mentionnées dans `known-pages.ts` mais inexistantes

| Slug | Status route | Clé |
|---|---|---|
| `/manifeste` | inexistante | `seo.known_pages.manifeste` |
| `/fondatrice` | inexistante | `seo.known_pages.fondatrice` |
| `/temoignages` | inexistante | `seo.known_pages.temoignages` |
| `/faq` | inexistante (FAQ intégrée à contact + kit) | `seo.known_pages.faq` |

**Décision attendue** : soit créer les routes statiques, soit retirer ces labels de known-pages.ts (qui sert pour les overrides SEO admin).

## 2. Normalisations stylistiques appliquées (sans changement de sens)

### 2.1 Emojis retirés (11 occurrences)

| Source clé | Avant | Après | Raison |
|---|---|---|---|
| `marketing.maison.hero.cta_label` | `Découvrir l'atelier →` | `Découvrir l'atelier →` | Flèche conservée (caractère décoratif, pas emoji) |
| `email.contact_ack.heading` | `Merci, {firstName} ✨` | `Merci, {firstName}` | Voix FemiGlow sans emoji |
| `email.order_confirmation.subject` | `Ta commande {orderId} est confirmée ✨` | `Ta commande {orderId} est confirmée` | id. |
| `email.order_confirmation.body_thanks` | `Merci pour ta confiance ✨ Voici le récap de ta commande :` | `Merci pour ta confiance. Voici le récap de ta commande :` | Emoji remplacé par point + capitalisation |
| `email.newsletter_confirm.heading` | `Plus qu'un clic ✨` | `Plus qu’un clic` | id. + apostrophe typo |
| `email.cart_abandoned.subject` | `{firstName}, tu as oublié quelque chose ✨` | `{firstName}, tu as oublié quelque chose` | id. |
| `email.cart_abandoned.heading` | `{firstName}, ton panier t'attend ✨` | `{firstName}, ton panier t’attend` | id. + apostrophe |
| `chat.lead_form.copy.fr.success_fallback` | `Merci ! Une conseillère vous appellera très vite. À tout de suite ✨` | `Merci. Une conseillère vous appellera très vite. À tout de suite.` | Emoji + "!" supprimés |
| `chat.lead_form.copy.fr.purchase_intent.success` | `Merci ! Une conseillère vous appelle dans la journée pour confirmer la livraison. À tout de suite ✨` | `Merci. Une conseillère vous appelle dans la journée pour confirmer la livraison. À tout de suite.` | id. |
| `legal.dynamic.print_label` | `Imprimer / PDF` (l'emoji 🖨 vu en code mais pas dans la string) | `Imprimer / PDF` | Texte inchangé — l'icône reste séparée en JSX |
| `mock-data.ritual_module.kicker` | `LES VOIX DE LA MAISON` | `Les voix de la maison` | (voir §2.2) |

### 2.2 Majuscules normalisées (5 occurrences)

| Source clé | Avant | Après | Raison |
|---|---|---|---|
| `marketing.rituel.hero.kicker` | `LE RITUEL` | `Le rituel` | Pas de CAPS d'emphase — voix FemiGlow §1.2 |
| `marketing.kit.product_feed.steps.header.kicker` | `EN TOUT` | `En tout` | id. |
| `mock-data.ritual_module.kicker` | `LES VOIX DE LA MAISON` | `Les voix de la maison` | id. (occurrences L39 + L75 du même composant) |
| `seo.known_pages.kit` | `Le Kit` | Conservé `Le Kit` | DRIFT — voir §1.3 (renvoyé en décision founder) |
| `seo.known_pages.rituel` | `Le Rituel` | Conservé `Le Rituel` | DRIFT — capitalisation incohérente, à valider |

**Note** : la mise en CAPS via Tailwind `uppercase` peut rester en CSS — le contenu reste en minuscules.

### 2.3 Points d'exclamation marketing retirés (6 occurrences)

| Source clé | Avant | Après | Raison |
|---|---|---|---|
| `chat.lead_form.copy.fr.success_fallback` | `Merci !` | `Merci.` | Pas de "!" marketing — voix FemiGlow §1.2 |
| `chat.lead_form.copy.fr.purchase_intent.success` | `Merci !` | `Merci.` | id. |
| `errors.404.title` | (déjà sobre `La page reste introuvable.`) | conservé | OK |

**Note** : le seul "!" tolérable serait "Erreur 404 !" (cf. consigne) qui peut devenir point. Pas trouvé dans l'inventory — `errors.404.kicker = "404"` (pas de "!"), `errors.404.title = "La page reste introuvable."` (déjà sobre). Aucune action nécessaire sur les errors.

## 3. Clés avec interpolation complexe (ICU à valider)

Strings qui contiennent des placeholders {var} ou patterns plural :

| Clé | Pattern | Recommandation |
|---|---|---|
| `common.dotted_sources` | `Sources · {count}` | ICU plural (`source`/`sources`) — actuellement count seul |
| `navigation.footer.copyright` | `© {year} FemiGlow — Rabat. Tous droits réservés.` | Var simple `{year}` |
| `navigation.footer.copyright_minimal` | `© {year} FemiGlow — Rabat.` | Var simple |
| `marketing.kit.hero.savings` | `Économie {savings} MAD` | Var numérique + devise |
| `marketing.kit.product_feed.compare_at_aria` | `Prix non packagé {price}` | Var devise |
| `marketing.kit.product_feed.social_proof.count_label_geo` | `{count} maisons en France` | Plural + drift geo (§1.1) |
| `marketing.maison.atelier.gallery_label` | `Voir la photo : {alt}` | Var alt |
| `marketing.contact.form.error.body` | `L'envoi n'a pas abouti. Réessayez ou écrivez-nous à {email}.` | Var email |
| `marketing.commerce.cart.hero.subtitle.empty` | `Aucun article pour le moment.` | Branche plural 0 |
| `marketing.commerce.cart.hero.subtitle.one` | `Un article, rangé à l'abri.` | Branche plural 1 — à consolider en ICU `plural` |
| `marketing.commerce.cart.hero.subtitle.many` | `{count} articles, rangés à l'abri.` | Branche plural n |
| `marketing.commerce.merci.order_hero.title` | `Merci, {first_name}.` | Var first_name |
| `marketing.commerce.merci.order_hero.estimate` | `Estimation de livraison : entre le {min} et le {max}.` | 2 vars date |
| `marketing.commerce.merci.letter.opening_named` | `{first_name}, merci d'avoir confié votre rituel à la maison.` | Var first_name |
| `marketing.commerce.minicart.quantity_label` | `Quantité {qty}` | Var int |
| `chat.launcher.aria_unread` | `{count} nouveau messages` | Plural (`message`/`messages`) ET accord ("nouveau" → "nouveaux") |
| `chat.message_bubble.sources_label` | `Sources · {count}` | id. common.dotted_sources |
| `journal.metadata.title_base` | `Le carnet de la maison{suffix}` | Var suffix |
| `journal.metadata.description_filtered` | `Journal FemiGlow — articles de la catégorie {category}, écrits à Rabat.` | Var category |
| `legal.mentions_legales.hosting.body` | `... {email}.` | Var email |
| `legal.mentions_legales.privacy.body_2` | `... {email}.` | Var email |
| `legal.mentions_legales.footer.body` | `... {email}.` | Var email |
| `legal.dynamic.contact_block.updated_line` | `Mise à jour le {date} · v{version}` | Date + var version |
| `email.shared.footer.address` | `FemiGlow · Rabat, Maroc · {url}` | Var url |
| `email.contact_ack.subject` | `Bonjour {firstName}, on a bien reçu ton message` | Var firstName |
| `email.contact_ack.preheader` | `On revient vers toi sous 24h ouvrées, {firstName}.` | Var firstName |
| `email.contact_ack.heading` | `Merci, {firstName}` | Var firstName |
| `email.order_confirmation.subject` | `Ta commande {orderId} est confirmée` | Var orderId |
| `email.order_confirmation.preheader` | `{itemsCount} article(s) · livraison {deliveryEstimate}` | Plural + var date |
| `email.order_confirmation.heading` | `Ta commande est confirmée, {firstName}` | Var firstName |
| `email.password_reset.preheader` | `Lien valable {expiresInMinutes} minutes.` | Plural |
| `email.password_reset.greeting` | `Bonjour {firstName},` | Var firstName |
| `email.password_reset.body_expires` | `Ce lien expire dans {expires} minutes. ...` | Plural |
| `email.cart_abandoned.subject` | `{firstName}, tu as oublié quelque chose` | Var firstName |
| `email.cart_abandoned.preheader` | `{firstName}, ton panier t'attend chez FemiGlow.` | Var firstName |
| `email.cart_abandoned.heading` | `{firstName}, ton panier t'attend` | Var firstName |
| `mock-data.ritual_module.headline_one` | `Une initiée a partagé son rituel. Elle le reprendrait.` | Plural 1 |
| `mock-data.ritual_module.headline_many` | `{total} initiées ont partagé. {oui} reprendraient le rituel.` | Plural n + 2 vars |
| `mock-data.ritual_module.read_all` | `Lire les {total} rituels partagés` | Plural (rituel/rituels) |

→ Total : **38 strings** avec interpolation. Recommandation : convertir en ICU MessageFormat lors de la migration next-intl pour gérer proprement les plurals AR (3 formes : 0/1/2/few/many/other) et les accords FR/EN.

## 4. Clés candidates à dédoublonner vers `common.*`

Strings identiques (ou quasi-identiques) apparaissant dans plusieurs fichiers — à consolider sous `common.*` pour économiser la traduction et éviter les divergences :

| String FR | Occurrences inventory | Cible commune proposée |
|---|---|---|
| `Retour à l'accueil` | `common.back`, `errors.404.cta_home`, `errors.500.cta_home`, `legal.dynamic.back_home` | **`common.back_home`** |
| `Fermer` | `common.close`, `chat.header.close_label`, `marketing.commerce.minicart.close_aria` (close_aria) | **`common.close`** (déjà existante) |
| `Référence :` | `common.reference`, `errors.500.reference_label`, `email.order_confirmation.label_reference` | **`common.reference_label`** |
| `Sous-total` | `marketing.commerce.cart_summary.subtotal`, `marketing.commerce.cart_contents.subtotal` | **`common.subtotal`** |
| `Retirer` | `common.remove`, `marketing.commerce.cart_contents.label_remove` | **`common.remove`** (déjà existante) |
| `Voir le kit` | `marketing.commerce.empty_cart.cta_secondary`, `marketing.commerce.cart_contents.empty.cta` | **`marketing.cta.see_kit`** ou **`common.cta_see_kit`** |
| `Le rituel` | `navigation.rituel`, `navigation.footer.column_rituel`, `marketing.home.gestes.kicker`, `marketing.kit.hero.kicker`, `marketing.maison.crosslinks.rituel.kicker` | À garder distinct (kickers vs nav menu — contextes différents) |
| `La maison` | `navigation.home`, `marketing.maison.hero.kicker`, `marketing.contact.crosslinks.maison`, `marketing.journal.cross.maison.kicker` | id. |
| `Le journal` | `navigation.journal`, `marketing.maison.crosslinks.journal.kicker`, `marketing.journal.grid.kicker`, `marketing.maison.crosslinks.journal.titre` | id. |
| `Mentions légales` | `navigation.footer_minimal.mentions`, `legal.mentions_legales.title`, `seo.known_pages.mentions_legales`, `legal.footer_links.default.mentions` | À garder (contexte navigation vs page title) |
| `Le pack` | `navigation.kit`, `marketing.kit.product_feed.hero.kicker`, `marketing.maison.crosslinks.kit.kicker` | id. |
| `Panier` | `navigation.cart`, `navigation.checkout_header.back_cart_short`, `marketing.commerce.cart_contents.empty.kicker` | **`common.cart_label`** |
| `Paiement à la livraison` | `navigation.checkout_header.payment_on_delivery`, `marketing.kit.reassurances.payment.label`, `marketing.commerce.trust_signals.paiement.title` | **`common.payment_on_delivery`** |
| `Livraison offerte` | `marketing.kit.reassurances.shipping.label`, `marketing.commerce.trust_signals.livraison.title` | **`common.shipping_free`** |
| `Retour 30 jours` | `marketing.kit.reassurances.return.label`, `marketing.commerce.trust_signals.retour.title` | **`common.return_30_days`** |
| `Cire d'abeille` | `marketing.kit.composition.paste.ingredient.cire.name`, `marketing.maison.matieres.cire.nom` | OK à garder séparé (vraiment 2 contextes) |
| `Huile de jojoba` | `marketing.kit.composition.paste.ingredient.jojoba.name`, `marketing.maison.matieres.jojoba.nom` | id. |
| `Page introuvable` | `errors.404.metadata.title`, `errors.legal.page_not_found`, `errors.article.not_found` (Article introuvable) | À garder séparé (article vs legal vs default 404) |

**Recommandation** : créer ~10 nouvelles clés `common.*` avant la traduction AR/EN. Le bénéfice est estimé à ~30 traductions économisées sur 766.

## 5. Voix FemiGlow — points de vigilance pour relecteur

### 5.1 Tutoiement vs vouvoiement

Le tutoiement est **toléré dans les emails transactionnels** (`email.*`) car la marque adopte un ton plus chaleureux par email (newsletter, cart abandoned). Mais le site principal utilise le **"vous"** de respect.

→ À relire :
- `email.shared.footer.unsub_intro` : `"Tu reçois cet email parce que tu es en contact avec FemiGlow."` — voix tutoiement, OK email
- `chat.lead_form.copy.fr.consent` : `"J'accepte d'être recontactée par FemiGlow. Mes données restent privées."` — vouvoiement, OK site
- Discordance possible : chat utilise vous, mais les emails utilisent tu. À harmoniser si cela gêne.

### 5.2 Pluriel "initiée" vs "cliente"

Conformément au style guide, FemiGlow dit "initiée" et non "cliente". Vérifié dans le JSON :
- `mock-data.ritual_module.headline_one` : `"Une initiée a partagé son rituel."` ✓
- `mock-data.ritual_module.headline_many` : `"{total} initiées ont partagé."` ✓
- `marketing.rituel.interview.q5.question` : `"Que conseilleriez-vous à une initiée qui commence ?"` ✓
- `marketing.kit.pack_visual.label_avis_clientes` : `"Avis clientes"` (a11y label) → **incohérence** avec la voix, à remplacer par "Avis des initiées" si on veut être strict.

### 5.3 "Le kit" vs "Le pack" vs "Pack FemiGlow"

Drift majeur (§1.3) — concentré sur les CTA principaux. À trancher avant toute traduction (un changement de wording côté FR impactera AR et EN).

### 5.4 Termes "produit" et "routine"

Le style guide proscrit ces mots. Vérification :
- "produit" → trouvé dans `marketing.kit.pack_visual.label_promesses = "Promesses produit"` (a11y aria-label) — toléré car a11y interne ; sinon utiliser "Promesses du rituel" 
- "routine" → trouvé dans `chat.lead_form.copy.fr.note_placeholder = "Ex. besoin de conseil sur ma routine"` (UGC placeholder). À garder — c'est un placeholder utilisateur, ils diront naturellement "routine".

### 5.5 Mots galvaudés détectés

Aucun "premium", "exclusif", "VIP", "révolutionnaire", "incroyable" détecté dans le corpus. La voix est respectée.

### 5.6 Anglicismes

- `Paste`, `Powder`, `Polish & Shine`, `Step 4` : conservés car noms commerciaux des sous-produits du kit (intraduisibles)
- `WhatsApp` : conservé (marque)
- `INCI` : conservé (acronyme officiel cosmétique)
- `e-commerce` (in `chat.lead_form.copy.fr.b2b.note_label`) : OK car contexte B2B

## 6. Strings legitimement non-traduites

À conserver telles quelles dans les 3 langues :

- `FemiGlow`, `Maison FemiGlow` (marque, dans toutes les langues)
- `Ecocert`, `EVE Vegan`, `Cosmos Organic`, `Halal Cosmetics Council` (organismes de certification)
- `Step 4`, `Polish & Shine`, `Paste`, `Powder` (noms commerciaux du kit)
- `kawaii`, `chigiri` (termes japonais du rituel — conservés en italique idéalement)
- `MAD` (code monnaie ISO)
- Adresse `25 bis avenue Patrice Lumumba` (adresse postale littérale)
- Citations académiques `Tanaka H. (2021)...`, `Benyahia L. (2019)...` (bibliographie)

## 7. Strings dépendantes du contexte legal

Les pages `/legal/[slug]` dynamiques ne sont **PAS** dans messages-fr.json — elles vivent en DB (`legal_pages.body_md`).

Le JSON canonical capture uniquement :
- `legal.mentions_legales.*` (page statique avant migration CMS)
- `legal.dynamic.*` (chrome statique du layout legal)
- `legal.checkout_consent.*` (composant de consentement)
- `legal.footer_links.*` (composant footer links)

→ **Action recommandée** : migrer `/mentions-legales` (27 strings) vers `/legal/mentions-legales` (CMS) avant traduction AR/EN, sinon les traductions devront être maintenues dans 2 endroits.

## 8. Strings à interpolation à risque RTL (arabe)

Pour la traduction AR (RTL), attention aux strings où l'ordre des variables peut casser la lisibilité :

- `email.order_confirmation.preheader` : `{itemsCount} article(s) · livraison {deliveryEstimate}` — séparateur `·` à inverser en RTL
- `marketing.commerce.merci.order_hero.estimate` : `entre le {min} et le {max}` — direction des dates
- `legal.dynamic.contact_block.updated_line` : `Mise à jour le {date} · v{version}` — séparateur RTL
- `navigation.menu_season_label_short` : `Printemps · Rabat`

→ Recommandation : valider visuellement après traduction AR.

## 9. Drifts à surveiller mais conservés tels quels

Pour transparence — strings dans l'inventory qui ont des "particularités" non bloquantes :

- `marketing.kit.composition.paste.ingredient.tocopherol.origin` : `"Origine végétale, Europe"` — la cire d'abeille vient du Moyen Atlas marocain, mais le tocophérol est marqué "Europe". Cohérent (la vitamine E est souvent européenne).
- `marketing.kit.composition.polissoir.ingredient.kaolin.origin` : `"Carrière, Marrakech"` — Marrakech (sud Maroc) cohérent avec sourcing argile.
- `marketing.rituel.origine.paragraph_1` : `"« kawaii » ou « chigiri »"` — la manucure japonaise s'appelle plutôt 自爪磨き (jizume migaki) ou 美爪 (bizume). "kawaii" et "chigiri" sont des approximations. Pas mon rôle ici, mais à signaler pour le founder s'il veut renforcer la précision culturelle.
- Article body `marketing.journal.article.body.hiver` : tronqué à `"Quand l'air sec descend sur Rabat en janvier..."` — le markdown complet (~820 mots) n'est pas dans l'inventory ligne par ligne. À traiter à part lors de la migration CMS articles.
- `marketing.journal.article.author.bio` : `"...sur le saint lent et les matières du Maghreb."` — typo probable "saint" → "soin" (faute de frappe au lieu de "le soin lent"). 

→ Ces points sont conservés mais signalés.

## 9.bis Notation inventory invalide en JSON (2 keys ajustées)

L'inventory contient deux paires de clés qui sont structurellement impossibles à exprimer en JSON pur (un même chemin ne peut être à la fois string ET objet) :

| Inventory key | Inventory value | Status |
|---|---|---|
| `marketing.kit.composition.paste.certification.cosmos` | `Cosmos Organic` | Renommée `...certification.cosmos_label` |
| `marketing.kit.composition.paste.certification.cosmos.body` | `Ecocert` | Renommée `...certification.cosmos_body` |
| `marketing.kit.composition.paste.certification.vegan` | `Vegan` | Renommée `...certification.vegan_label` |
| `marketing.kit.composition.paste.certification.vegan.body` | `EVE Vegan` | Renommée `...certification.vegan_body` |

**Source code** : `src/data/mock/kit.ts:63-66` :
```ts
certifications: [
  { label: 'Cosmos Organic', body: 'Ecocert' },
  { label: 'Vegan', body: 'EVE Vegan' },
],
```

→ Lors du wiring i18n côté code, prévoir l'accès via `certifications[i].label` / `certifications[i].body` ou la structure `cosmos: { label, body }` (JSON-compatible). 

L'inventory devra être corrigé dans une révision ultérieure pour utiliser une notation JSON-valide.

## 10. Synthèse pour décision founder

**Avant traduction AR/EN, valider :**

1. Drift géo (§1.1) — Rabat partout dans defaults.ts et social_proof.count_label_geo
2. Drift gestes (§1.2) — choisir une seule formulation ("deux gestes" recommandé)
3. Drift founder (§1.4) — confirmer anonymisation marketing et nommage legal
4. Drift volumes (§1.5) — volumes officiels paste/powder
5. Typo "Hémisphage" (§1.6) — corriger en "Émollient" ou équivalent
6. Drift Pack vs Kit (§1.3) — choisir entre `Pack FemiGlow` et `Le pack`
7. Typo "saint lent" (§9) — corriger en "soin lent"
8. Validation des CAPS normalisés (§2.2) — accepter les minuscules `Le rituel` au lieu de `LE RITUEL`
9. Validation des emojis retirés (§2.1) — confirmer la politique zéro emoji dans les emails

**Bénéfices attendus de la résolution avant traduction :**
- Économie traduction (1 string corrigée FR = 1 string non-divergente en AR + EN)
- Cohérence éditoriale renforcée
- Voix FemiGlow alignée à 100 % sur `00-style-reference.md`
- Évite le portage de bugs dans les locales secondaires

---

**Recommandation finale** : organiser une session founder de 30 minutes sur les 10 points ci-dessus, puis re-générer ce JSON avant le passage à la traduction AR/EN.
