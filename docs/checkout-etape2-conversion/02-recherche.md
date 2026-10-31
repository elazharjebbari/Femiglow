# 02 — Recherche et principes

## 1. Sources et niveau de confiance

| Source | Accès | Fiabilité pour ce projet |
|---|---|---|
| Kolenda, 8 PDF dans `docs/kolenda/` | Lus en entier, texte et OCR des figures | Texte original, études citées non recontrôlées |
| Baymard, NN/g, web.dev, MDN, W3C | Pages lues ou extraits, précisé plus bas | Bonnes sur les formulaires, surtout occidentaux, paiement par carte |
| Blogs sur le paiement à la livraison au Maroc | Extraits | Faible : chiffres sans source |

**Convention :** les pages citées sont celles du fichier PDF, pas le numéro imprimé. T = tactique.

Kolenda ne prescrit ni couleur, ni forme, ni ombre de CTA de formulaire. Les choix de ce dossier sont des **déductions** à partir de ses principes, et sont marqués comme tels.

## 2. Principes Kolenda retenus

### CTA

| Principe | Référence | Application |
|---|---|---|
| Un bouton bas et proche donne envie d'agir | `Copywriting.pdf` p. 22, T10 | Barre d'action en bas d'écran |
| Placer un élément derrière le bouton le met en avant | `Copywriting.pdf` p. 22, T10 | Ombre douce (déduction) |
| Un bouton d'achat doit être beau | `Copywriting.pdf` p. 27, T14 | Soin du dégradé et de l'icône |
| Première personne, ton naturel, pas d'exclamation | `Copywriting.pdf` p. 23, T11 | « Confirmer ma commande » (déduction) |
| Cible d'au moins 40 × 40 px | `UX.pdf` p. 14, T7 | Bouton de 56 px |
| Agrandir prix et bouton accélère l'achat, sans effet significatif | `Pricing.pdf` p. 14, T5 | La taille seule ne suffit pas |
| Les flèches captent l'attention | `Attention.pdf` p. 37 | Icône non décorative |
| Une pulsation discrète capte l'attention | `Attention.pdf` p. 17 | Reflet espacé |
| Bouton désactivé et état visible après le tap | `UX.pdf` p. 24, T12 ; p. 9, T3 | État d'envoi |
| Le rond évoque le doux et le féminin | `Fonts.pdf` p. 7, T3 | Coins arrondis (déduction) |

### Couleur

| Principe | Référence | Application |
|---|---|---|
| Neutres dominants, touches ciblées | `Color.pdf` p. 17, T8 | Une seule couleur d'action |
| Le noir pur est trop fort hors petit texte | `Color.pdf` p. 17, T8 | Argument contre l'encre, à nuancer : `#2C2A28` n'est pas pur |
| Chaud : action et immédiat. Froid : calme et plus tard | `Color.pdf` p. 4, T1 | Grenat chaud |
| Le luxe appelle une saturation plus basse | `Color.pdf` p. 10, T4 | Rose brûlé plutôt que rose vif |
| Luminosité et saturation pèsent plus que la teinte | `Color.pdf` p. 8, T3 | Grenat foncé, pas seulement « rouge » |
| Une couleur qui tranche attire ; désaturer autour | `Attention.pdf` p. 13 ; `UX.pdf` p. 57, T28 | Le reste de l'écran reste neutre |
| Éviter le rouge pour les erreurs d'une marque rouge ; bleu avec icône possible | `Color.pdf` p. 17, T8 | Erreurs en bleu |

### Typographie

| Principe | Référence | Application |
|---|---|---|
| Police simple, donc lecture fluide | `Fonts.pdf` p. 8, T4 | Cormorant limité au titre |
| Graisse moyenne la plus lisible | `Fonts.pdf` p. 11, T6 | Inter 400 et 500 |
| Casse mixte plus lisible | `Fonts.pdf` p. 13, T7 | Pas de capitales sur le CTA |
| L'italique suggère l'urgence et l'instabilité | `Fonts.pdf` p. 17, T9 | Jamais sur un prix |
| Chiffres plutôt que mots | `Copywriting.pdf` p. 46, T23 | « 24h », « 19 MAD » |
| « MAD » plus petit et distinct | `Pricing.pdf` p. 17, T7 | Déjà prévu dans la barre |

### Formulaire

| Principe | Référence | Application |
|---|---|---|
| Activer une fonction quand elle devient pertinente, sans rupture | `UX.pdf` p. 24, T12 ; p. 50, T24 | Adresse après la ville |
| Villes probables en tête, suggestions en direct | `UX.pdf` p. 27, T13 | Déjà en place, à renforcer |
| Quatre options maximum, sauf recherche précise | `UX.pdf` p. 5-6, T1 | Trois suggestions au clavier |
| Labels visibles et proches | `UX.pdf` p. 31, T15 ; p. 55, T27 | Label au-dessus |
| Montrer un exemple du format attendu | `UX.pdf` p. 37, T17 | Exemple d'adresse |
| Retirer les instructions évidentes | `UX.pdf` p. 53, T26 | Aide bilingue retirée |
| Erreur précise, sans accuser la personne | `UX.pdf` p. 16-17, T8 ; p. 50-51, T24 | « Indiquez votre quartier » |
| Conserver la saisie | `UX.pdf` p. 29, T14 | Brouillon conservé |
| Signaler la validité avant l'envoi | `UX.pdf` p. 46, T22 | Coche discrète |
| Montrer l'étape 1 comme acquise | `Copywriting.pdf` p. 41, T21 ; `UX.pdf` p. 34, T16 | « Salma » et coche |
| Barre fine, proche de la fin | `Copywriting.pdf` p. 25, T13 | Progression à 66 %, puis 90 % |
| Réduire le processus visible | `Copywriting.pdf` p. 59, T31 | Un champ à l'arrivée |

### Prix et réassurance

| Principe | Référence | Application |
|---|---|---|
| Bloc paiement compact | `Pricing.pdf` p. 25-27, T11 | Barre sobre |
| Rappeler le produit avant le prix | `Pricing.pdf` p. 70, T32 | Limite à arbitrer, voir 03 §6 |
| Ne pas animer le prix | `Pricing.pdf` p. 33, T14 | Total fixe |
| Mettre l'assurance au plus près du CTA | `Copywriting.pdf` p. 17, T8 | « Rien à payer maintenant » |
| Cadrage positif, pas de peur évoquée | `Copywriting.pdf` p. 9, T3 | Pas de mot « risque » |
| Pas de « 100 % » creux | `Copywriting.pdf` p. 48, T24 | Formule concrète |
| Annoncer la suite | `UX.pdf` p. 41, T19 | « Nous vous appelons pour confirmer » |
| Prénom sur la commande | `Copywriting.pdf` p. 44, T22 | Utilisé dans la progression |
| En fin de parcours, parler de faisabilité | `Ecommerce.pdf` p. 38, T17 | Textes concrets |

### Luxe

| Principe | Référence | Application |
|---|---|---|
| Ni emoji ni exclamation | `Luxury.pdf` p. 7, T2 | Ton calme |
| Lenteur et fondus longs | `Luxury.pdf` p. 18-19, T7 | Reflet lent |

**Réserve (déduction) :** à 199 MAD, le guide Luxury ne s'applique que partiellement.

## 3. Tensions et arbitrages

| Tension | Sources | Arbitrage |
|---|---|---|
| CTA saturé contre saturation basse | `Attention.pdf` p. 13, `Color.pdf` p. 10 | Grenat foncé : chaud et saillant, sans être vif |
| Bouton conditionnel contre bouton toujours net | `UX.pdf` p. 24 | Jamais terne : il guide vers le champ manquant |
| Espace généreux contre écran compact | `Luxury.pdf` p. 12, `Copywriting.pdf` p. 31 | Peu d'éléments, mais aérés |
| Sauge : positif contre froid | `UX.pdf` p. 39, `Color.pdf` p. 4 | Sauge pour la validation, grenat pour l'action |
| Capitales premium contre lisibilité | `Luxury.pdf` p. 12, `Fonts.pdf` p. 13 | Casse mixte |
| Mouvement captateur contre prix stable | `Attention.pdf` p. 17, `Pricing.pdf` p. 33 | Bouton animé, prix fixe |

## 4. Autres sources

**Lu** : page ouverte. **Extrait** : résumé de moteur de recherche seulement.

| Principe | Application | Source | Preuve |
|---|---|---|---|
| Compter les champs affichés, viser 8 sur tout le parcours | Étape 2 limitée à 2 champs | [Baymard](https://baymard.com/blog/checkout-flow-average-form-fields), Lu | Forte |
| Cacher tout complément d'adresse derrière un lien | Note repliée | Même source, Lu | Forte |
| Afficher seulement l'utile, progression visible | Révélation progressive | [NN/g](https://www.nngroup.com/articles/4-principles-reduce-cognitive-load/), Lu | Moyenne à forte |
| Champ d'adresse unique, caractères Unicode acceptés | Adresse libre en arabe | [web.dev](https://web.dev/learn/forms/address), Lu | Moyenne |
| Autocomplétion plutôt que longue liste | Combobox conservée | [Baymard](https://baymard.com/research-articles/mobile-ecommerce-checkout-forms), Lu, données 2015 sur pays et région | Moyenne |
| `street-address` sans la ville, `address-level2` pour la ville | Attributs de champ | [MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/autocomplete), Lu | Forte |
| L'autofill réduit fortement les abandons | Bon sens confirmé, ampleur à ne pas transposer | [Chrome](https://developer.chrome.com/blog/autofill-insights-2024), Lu, corrélation | Moyenne |
| Label visible hors du champ | Label au-dessus | [NN/g](https://www.nngroup.com/articles/form-design-placeholders/), Lu | Forte |
| Valider à la sortie du champ | Erreur au `blur` ou au tap | [Baymard](https://baymard.com/research-articles/inline-form-validation), Extrait | Forte |
| Message adapté à la règle non respectée | Erreurs précises | [Baymard](https://baymard.com/research-articles/adaptive-validation-error-messages), Extrait | Forte |
| `visualViewport` fonctionne partout, avec risque de retard sur iOS | Barre au-dessus du clavier | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport), Lu ; [WebKit](https://bugs.webkit.org/show_bug.cgi?id=265578), Extrait | Forte |
| `interactive-widget` ne suffit pas sur Safari | Ne pas s'y limiter | [caniuse](https://caniuse.com/mdn-html_elements_meta_name_viewport_interactive-widget_resizes-content), Extrait | Moyenne |
| Un élément collant ne doit pas masquer le focus | `scroll-padding` | [WCAG 2.4.11](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html), Lu | Forte |
| 16 px minimum sur les champs, sans bloquer le zoom | Conservé | [West Wind](https://weblog.west-wind.com/posts/2023/Apr/17/Preventing-iOS-Textbox-Auto-Zooming-and-ViewPort-Sizing), Extrait | Moyenne |
| Tout mouvement sous `prefers-reduced-motion` | Reflet coupé | [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion), Lu | Forte |
| Pas de `letter-spacing` sur l'arabe | Interlettrage nul | [W3C](https://www.w3.org/International/track/issues/354), Extrait | Moyenne |
| L'arabe paraît plus petit à taille égale | +1 px, à valider à l'œil | [Commentaire d'expert](https://alexstrick.com/personal/2017-03-12-why-are-arabic-fonts-so-small.html), Extrait | Faible |
| Effet positif de « mon » sur « votre » | Hypothèse | [SiteTuners](https://sitetuners.com/blog/me-vs-you-how-pronouns-affect-click-conversion-rates/), Extrait, chiffres secondaires | Faible |
| Icône dans un CTA | **Aucune preuve trouvée** | — | Absente |

## 5. Corrections de la documentation existante

`docs/checkout-funnel/02-references-synthese.md` et le code citent des principes attribués à Kolenda. Vérifiés dans les 8 PDF, ceux-ci sont **introuvables tels quels** :

| Affirmation | Résultat |
|---|---|
| Contraste de teinte supérieur à celui de luminosité | Introuvable. `Color.pdf` p. 8 va plutôt dans l'autre sens |
| « Recevoir » bat « Acheter », étude Stripe | Introuvable, Stripe n'y figure pas |
| Une colonne : +15 % | Introuvable |
| 5 décisions maximum par écran | Introuvable. Kolenda parle de 4 options par choix |
| Halos contrastés | Introuvable |
| Couleur de marque préférable pour le CTA | Introuvable |
| Essai de 14 jours | Introuvable |
| Pas de minuteur dans le luxe | Introuvable tel quel |
| Micro-coches vertes par champ | Introuvable tel quel |

`docs/kolenda/FEMIGLOW-KIT-PLAYBOOK.md` contient aussi des valeurs absentes des PDF, comme un pulse à `1.02`, 400-600 ms, ou les lois de Hick et de Fitts.

**Ce dossier n'utilise aucune de ces affirmations.** Il est recommandé de corriger ces documents.
