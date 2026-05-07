# FemiGlow — Architecture du site

> **Maison d'Éclat · Volume II · Mai 2026**
> Cartographie des pages, composants, et tactiques de conversion.
> *Document complémentaire à la charte graphique.*

---

## Sommaire

| §     | Section                       | Détail                                                                  |
| :---- | :---------------------------- | :---------------------------------------------------------------------- |
| **I**   | Préambule & méthode           | Objectif · méthode Kolenda · comment lire                               |
| **II**  | Vision globale du site        | Manifeste de l'expérience                                               |
| **III** | Cartographie complète         | Sitemap B2C · B2B · transverses                                         |
| **IV**  | Principes transverses         | Grille · Header · Footer · Mobile                                       |
| **V**   | Univers Particulier · B2C     | Accueil · Rituel · Kit · Journal · Maison · Panier · Commande · Merci   |
| **VI**  | Univers Partenaire · B2B      | Landing · Programme · Échantillon · Espace Pro                          |
| **VII** | Pages transverses             | Contact · FAQ · Légales                                                 |
| **VIII**| Parcours utilisateur          | Funnel B2C · Funnel B2B                                                 |
| **IX**  | Synthèse & matrice            | Tactiques Kolenda × Pages · Sources                                     |

---

## I — Préambule & méthode

### Pourquoi ce document existe

La charte graphique définit les éléments visuels (palette, typographie, logo, motifs). Mais elle ne dit pas **où** ni **comment** les appliquer page par page. Ce document fait ce travail : il cartographie chaque page du site, décrit son rôle, ordonne ses composants, et justifie chaque choix par la psychologie cognitive.

### La méthode Kolenda

Chaque décision repose sur l'œuvre de Nick Kolenda (`kolenda.io/guides`) — synthèse de la recherche académique en consumer psychology, neuromarketing, UX, copywriting, pricing et luxury branding. **Six guides ont été dépouillés** : Ecommerce, UX, Copywriting, Pricing, Visual Attention, Luxury Branding. Les tactiques retenues sont signalées en `code inline` dans les sections de pages.

### Comment l'utiliser

Ce document n'est pas une maquette pixel-perfect. C'est une **carte stratégique**. Lisez-le linéairement pour comprendre l'architecture globale, ou par section pour creuser une page particulière. Une fois la structure validée, chaque page sera ensuite détaillée individuellement (wireframes, copy, micro-interactions).

> *« Le design n'est pas une opinion. C'est une décision, et toute décision a une raison. »*

---

## II — Vision globale du site

Trois principes régissent toute décision d'interface.

### 01. Une maison, deux portes

Le visiteur entre par `/accueil` (B2C) ou `/partenaires` (B2B), jamais en limbo. Aucun choix « êtes-vous client ou pro ? » — la signalétique fait le tri toute seule. Une cliente B2C ne voit jamais une marge salon. Un institut B2B ne voit jamais un post Instagram lifestyle.

### 02. Le rituel comme grammaire

Chaque page raconte un fragment du rituel — préparation, geste, patience, éclat. Pas de transactionnalité brute. Le panier lui-même est un moment du rituel : *« Vous ajoutez le rituel à votre maison »*, pas *« Ajouter au panier »*. Le copy n'est jamais commercial — il est **complice**.

### 03. L'absence comme signature

Plus d'espace blanc qu'il n'en faut. Plus de silence que de cris. Le luxe se signale par ce qu'il refuse — pas d'emoji, pas de countdown, pas de pop-up. *Tactique : Sevilla & Townsend (2016) — +23% de premium perçu avec un padding généreux.*

> *Le site n'est pas un catalogue.*
> *C'est l'extension digitale d'un rituel.*

---

## III — Cartographie complète

```
                          femiglow.ma
                              │
              ┌───────────────┴───────────────┐
              │                               │
      B2C — Particulier               B2B — Partenaire
              │                               │
   ┌──────────┼──────────┐         ┌──────────┼──────────┐
   /          /rituel    /kit ★    /partenaires /programme
   /journal   /maison              /echantillon ★
   /panier    /commander ★         /espace-pro
   /merci

  ─────────────── transverse ───────────────
  /contact   /faq   /legal/cgv   /legal/mentions
```

**Légende** : `★ pages pivot de conversion` (Kit, Checkout, Échantillon B2B) — soin particulier requis.

| Zone           | Couleur d'ancrage | Voix         | Pages                                                        |
| :------------- | :---------------- | :----------- | :----------------------------------------------------------- |
| **B2C**        | Sauge dominante   | Sensorielle  | Accueil, Rituel, Kit, Journal, Maison, Panier, Checkout, Merci |
| **B2B**        | Crème dominante   | Factuelle    | Landing, Programme, Échantillon, Espace Pro                  |
| **Transverse** | Neutre            | Utilitaire   | Contact, FAQ, Légales                                        |

---

## IV — Principes transverses

### Header (commun B2C + B2B)

**Mockup**
```
┌─────────────────────────────────────────────────────────────────┐
│  FemiGlow      RITUEL  JOURNAL  KIT  MAISON  PARTENAIRES   [Panier·1] │
└─────────────────────────────────────────────────────────────────┘
```

| Composant      | Spécification                                                                                       |
| :------------- | :-------------------------------------------------------------------------------------------------- |
| **Wordmark**   | Pinyon Script à gauche, cliquable, retour vers `/`. Pas de baseline « MAISON D'ÉCLAT » sur mobile.  |
| **Menu**       | 4 entrées B2C (Rituel · Journal · Kit · Maison) + 1 pivot B2B (Partenaires) en ton plus sourd.      |
| **CTA panier** | Persistant en haut-droite. Compteur visible. Sticky scroll.                                         |

`KOLENDA · 4 OPTIONS MAX (Gallivan 2011)` — au-delà de 4, le cerveau passe en mode comptage.
`KOLENDA · ENTRY POINT FOCAL` — le wordmark Pinyon ancre le regard.
`KOLENDA · GROUP SIMILAR ITEMS` — menu en bloc unique, pas de sous-niveaux visibles.

### Footer (commun, dense)

| Colonne          | Contenu                                                                |
| :--------------- | :--------------------------------------------------------------------- |
| **Le Rituel**    | Le rituel · Le kit · Journal · Maison                                  |
| **Partenaires**  | Le programme · Marges salon · Demander un échantillon · Espace Pro     |
| **Assistance**   | Contact · FAQ · Livraison · Retours                                    |
| **Légal**        | Mentions légales · CGV · Cookies · Confidentialité                     |

Footer sur fond **encre** dense — contraste fort avec le crème du body. Marque la fin du parcours. **Newsletter sur `/journal` uniquement, jamais en footer global** (ne dilue pas la valeur du Journal).

### Grille & breakpoints

| Breakpoint           | Layout                                          | Audience                              |
| :------------------- | :---------------------------------------------- | :------------------------------------ |
| **Desktop ≥ 1280px** | 12 col · gutter 24 · max-width 1280 · marges fluides | 60% B2C cible                         |
| **Tablet 768–1279**  | 8 col · gutter 20 · padding section 64–80       | Comportement intermédiaire            |
| **Mobile < 768px**   | 4 col · gutter 16 · padding section 40          | 40% B2C — rituel matinal au café      |

**Règles de respiration** :
- Padding section : **96–128px** (`KOLENDA · EMPTY SPACE +23% PREMIUM PERCEIVED`)
- Padding card : 24–32px (jamais moins)
- Line-height body : **1.5** — lecture confortable
- Max line-length : **65–75 caractères** — lisibilité optimale

> **Mobile-first.** Au Maroc, 78% des sessions e-commerce viennent du mobile (HCP 2024).

---

## V — Univers Particulier · B2C

### V.1 — `/` Accueil

> **Rôle** : Hero éditorial · **Audience** : Visiteur découverte (femme 28-45 ans, Maroc urbain) · **Funnel** : TOFU — Awareness

**Objectif.** Convertir une cliente curieuse en cliente *initiée*. Trois choses se jouent en 5 secondes : (1) elle comprend que c'est une **maison**, pas un produit, (2) elle saisit le rituel en 4 gestes, (3) elle est invitée — pas vendue.

#### Anatomie de la page (du haut vers le bas)

**01. Hero éditorial** — *au-dessus de la pliure*

- **Copy** : *« Le rituel d'éclat. Quatre gestes. Une main qui retrouve sa lumière, sans vernis ni abrasion. »*
- **Design** : vague pétale + sauge en superposition asymétrique (motif packaging). Wordmark Pinyon centré-haut.
- **CTA double** : primaire `Découvrir le rituel` (encre, pleine), secondaire `Lire le manifeste →` (texte seul).
- `KOLENDA · INDIRECT CLAIM` *« Le rituel d'éclat »* est métaphore — le cerveau infère le bénéfice (McQuarrie 2005).
- `KOLENDA · VERB OF OPENING` — verbe d'ouverture, pas d'achat.
- `KOLENDA · DUAL PATH FUNNEL` — un chemin émotionnel, un chemin rationnel.

**02. Les 4 gestes**

- **Copy** : *« Quatre minutes. Quatre gestes. Le rituel se transmet, jamais ne se complique. »*
- **Design** : 4 cartes côte à côte. Étiquettes circulaires (sauge / pétale / ciel / sauge). Numéro serif, mot italique, icône suggestive — **pas de photo**. Hover : la carte révèle 1 phrase descriptive.
- `KOLENDA · VISUAL SEQUENCE` — gauche-droite, brightness ascending.
- `KOLENDA · 4 OPTIONS MAX` — parallel individuation, pas de surcharge.

**03. Le manifeste**

- **Copy** : *« Pas une marque. Une maison. Pas un produit. Un rituel. Pas une cliente. Une initiée. »*
- **Design** : bandeau pleine largeur, fond sauge pâle. Cormorant Italic 28pt centré. Fleuron champagne avant la première ligne. **Aucun CTA** — c'est une respiration éditoriale.
- `KOLENDA · EMPTY SPACE` — le luxe respire.
- `KOLENDA · INDIRECT CLAIM` — la définition par négation amplifie le sens.

**04. Avis clientes**

- **Copy** : *« Mes ongles n'avaient pas eu cette lumière depuis des années. »* — Salma, Casablanca.
- **Design** : 3 témoignages courts (max 25 mots). **Pas de photo de visage** (Lu 2023). À la place : photo des mains qui tiennent un pot, ou un détail de la table de soin. Pas d'étoiles — mention « cliente initiée » avec date d'achat.
- `KOLENDA · IMPLY HUMAN PRESENCE` — Poirier 2024 : la trace humaine, plus efficace que le visage.
- `KOLENDA · AUTHENTICITY` — le détail concret > la louange générique.

**05. Le Journal — extraits**

- **Copy** : 3 derniers articles, tagline éditoriale en italique.
- **Design** : grille asymétrique (1 grande carte + 2 petites). Photo lifestyle floutée + titre Cormorant + date discrète. Pas de bouton « Lire » — la carte est cliquable entière.
- `KOLENDA · F-PATTERN BREAK` — l'asymétrie casse le scroll automatique.
- `KOLENDA · STORYTELLING` — la profondeur éditoriale comme preuve.

**06. Newsletter de fin**

- **Copy** : *« Le journal du rituel. Une lettre par mois. Lente, comme le rituel. »*
- **Design** : bloc sauge pâle pleine largeur, juste avant le footer. Champ email + bouton encre `S'abonner`. **Pas de promesse de réduction** (pas dans l'ADN). Promesse : **contenu rare**.
- `KOLENDA · CONTENT > DISCOUNT` — le luxe ne brade pas.
- `KOLENDA · VALUE BEFORE ASK` — donner avant de demander.

#### Mesures de succès
- Bounce rate < 55%
- Scroll depth > 60%
- CTR sur CTA primaire > 12%

---

### V.2 — `/rituel` Le Rituel

> **Rôle** : Page éditoriale longue · **Audience** : Curieuse en phase de considération · **Funnel** : MOFU — mid-funnel

**Objectif.** Transformer la curiosité en conviction. La cliente arrive avec une question — *« C'est quoi ce rituel japonais ? »*. Elle repart avec une réponse incarnée, et le sentiment qu'elle *fait déjà partie* de la maison.

| #   | Section                        | Description                                                                                                            | Tactiques Kolenda                          |
| :-- | :----------------------------- | :--------------------------------------------------------------------------------------------------------------------- | :----------------------------------------- |
| 01. | **Origine**                    | L'histoire du P-Shine japonais en deux paragraphes Cormorant. Pas une légende romancée — une vérité historique sobre.  | `INDIRECT CLAIM` `STORYTELLING`            |
| 02. | **Les 4 gestes — vidéo**       | Vidéo 90s en slow motion (300–400ms). Mains anonymes (Lu 2023). Voix off rare. Sous-titres FR + AR. Plein écran possible. | `SLOW MOTION = LUXURY` `IMPLY HUMAN`       |
| 03. | **Sciences du soin**           | Pourquoi le soin sans vernis. 3 paragraphes max, 1 visuel scientifique, sources en bas de page. Audience rationnelle.   | `CREDIBILITY` `RISK REDUCTION`             |
| 04. | **Témoignage initiée**         | Une longue interview écrite avec une cliente. Format Q/R, 5 questions max. Photo « implied » (mug, ongles posés).      | `AUTHENTICITY` `MIRROR EFFECT`             |
| 05. | **Pivot vers le kit**          | Bloc sauge en sortie : *« Maintenant que vous savez. Recevoir le kit. »* — CTA encre vers `/kit`.                       | `P.A.S. FRAMEWORK`                          |
| 06. | **Cross-link Journal**         | 3 articles connexes : « Pourquoi la patine », « Hiver et ongles », « Mon premier rituel ».                              | `DEEP ENGAGEMENT`                           |

---

### V.3 — `/kit` Le Kit ★ *pivot de conversion*

> **Rôle** : Fiche produit unique — pivot de conversion · **Audience** : Cliente en phase de décision · **Funnel** : BOFU — Conversion

**Objectif.** C'est ICI que se joue la vente. Tout doit être aligné : **photo qui inspire confiance**, **copy qui rassure**, **prix qui ne crie pas**, **preuve sociale discrète**. Pas d'up-sell agressif. Une seule décision : *recevoir le kit, ou pas*.

#### Au-dessus de la pliure

**01. Photo produit — contextuelle**
Composition réelle (kit + main + marbre + café). **Pas de photo isolée fond blanc** — les femmes préfèrent le contextuel (González 2021, +sales).
`KOLENDA · CONTEXT > ISOLATION` `KOLENDA · FEMALE PROCESSING`

**02. Titre + sous-titre**
Titre Cormorant 32pt : *Kit Rituel d'Éclat*. Sous-titre italique : *« Le rituel complet — 4 étapes. »*
`KOLENDA · INDIRECT CLAIM`

**03. Prix — rond, pas de promo**
**320 dh.** Prix rond (luxe émotionnel — Wadhwa & Zhang 2015). Pas de barré, pas de « 319,99 », pas de countdown.
`KOLENDA · ROUND PRICING` `KOLENDA · EMPTY SPACE`

**04. CTA — verbe d'ouverture**
`Recevoir le rituel` — pas `Acheter`, pas `Ajouter au panier`. Encre sur crème, taille moyenne. Hover : sauge.
`KOLENDA · VERB CHOICE` `KOLENDA · FRICTIONLESS`

**05. Réassurances en filets**
Trois lignes sous le CTA : **livraison 48h Casa**, **retour 14j**, **paiement 3× sans frais**. Inter caption 8.5pt, brume.
`KOLENDA · RISK REDUCTION` `KOLENDA · CHECKOUT PRIMING`

**06. Composition — slow reveal**
Sous le pli : zoom-in successifs sur les 4 pots (paste, powder, shine, polish), photographie lente type packshot. Suggéré au scroll, pas en clic.
`KOLENDA · SLOW MOTION = LUXURY`

#### Sous la pliure

| #   | Section                        | Description                                                                                            | Tactiques                                  |
| :-- | :----------------------------- | :----------------------------------------------------------------------------------------------------- | :----------------------------------------- |
| 07. | **Vidéo des 4 gestes**         | 90s slow motion. Lecture déclenchée au scroll (intersection observer 50%). Autoplay sans son.          | `SLOW MOTION` `AUTOPLAY ETHICS`            |
| 08. | **Composition détaillée**      | Liste des ingrédients par pot, avec leur fonction. Aucun mot scientifique sans traduction sensorielle.  | `TRANSPARENCY` `RISK REDUCTION`            |
| 09. | **Comparatif vernis vs rituel**| Tableau 3 colonnes : Vernis classique / Vernis semi / Rituel FemiGlow. Le rituel gagne sans le crier.   | `FRAMING` `COMPETITIVE ANCHOR`             |
| 10. | **FAQ contextuelle**           | 8–10 questions accordéon : combien de fois, durée totale, ongles fragiles, kit cadeau, réassort.         | `EFFORT REDUCTION` `OBJECTION HANDLING`    |
| 11. | **Témoignages photos-mains**   | 3 avis longs (60–100 mots). Photo des mains uniquement. Mention « initiée depuis avril 2026 ».          | `IMPLY HUMAN` `AUTHENTICITY`               |
| 12. | **CTA final dupliqué**         | Le même `Recevoir le rituel`, en sortie de page après l'absorption complète.                            | `DECISION FATIGUE` `CTA REPETITION`        |

---

### V.4 — `/journal` Le Journal

> **Rôle** : Hub éditorial + page article · **Audience** : Cliente ou prospect en phase d'intimité avec la marque · **Funnel** : MOFU + Loyalty

**Objectif.** Le Journal n'est pas un blog — c'est **la voix de la maison**. Il sert deux audiences : (1) la prospect qui doute encore et lit pour se rassurer, (2) la cliente initiée qui revient pour le plaisir. Il monétise indirectement.

| #   | Section                        | Description                                                                                                                                              | Tactiques                                  |
| :-- | :----------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------- |
| 01. | **Index — page liste**         | Grille asymétrique. 1 article hero, 4 articles équilibrés, 6 archivés compacts. Filtres minimalistes : Rituel · Histoire · Conseils · Maison (4 max).     | `4 OPTIONS MAX` `F-PATTERN`                |
| 02. | **Article — page lecture**     | Largeur lecture max 65–75 car. Cormorant Light 22pt titre, Inter Regular 17pt corps, leading 1.6. **Pas de pub, pas de pop-up, pas de related intrusif.** | `LINE LENGTH OPT.` `LUXURY MINIMALISM`     |
| 03. | **Engagement subtil**          | À la fin : 3 articles connexes (jamais 6+, jamais aléatoire). Newsletter : *« Recevoir le journal »*. **Pas de like, pas de commentaire**.                | `NO SOCIAL FRICTION` `EMPTY SPACE`         |

**Exemples de titres — la voix éditoriale**
- *« Pourquoi nous ne posons pas de vernis. »*
- *« La main qui sait — entretien avec une initiée. »*
- *« Hiver, ongles, et patience. »*
- *« Le rituel, raconté en quatre minutes. »*

---

### V.5 — `/maison` La Maison

> **Rôle** : Page narrative — qui sommes-nous · **Audience** : Curieuse de la fondatrice + B2B en pré-pitch · **Funnel** : Trust + Authenticity (toute étape)

**Objectif.** Construire la confiance par l'histoire. Une cliente qui connaît **qui** fait sa marque achète différemment. La page est aussi consultée par les futurs partenaires B2B — elle doit servir les deux audiences sans changer de ton.

| #   | Section                        | Description                                                                                                                                                | Tactiques                                |
| :-- | :----------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------- |
| 01. | **L'histoire courte**          | Trois paragraphes Cormorant. **Pas de** *« Tout a commencé en… »* — le cliché tue. Plutôt : un détail concret (une grand-mère, un voyage, un pot trouvé). | `INDIRECT CLAIM` `STORYTELLING`          |
| 02. | **Photo de la fondatrice**     | **Pas un portrait de face.** Photo de profil au travail — concentrée, mains visibles. Format 3:4, fond marbre crème.                                       | `IMPLY PRESENCE` `ZOOM-OUT`              |
| 03. | **Manifeste développé**        | Les 3 lignes du manifeste, chacune avec un paragraphe d'explication. Cormorant Italic 28pt, leading 1.5, paragraphe en Inter 11pt sous chaque ligne.       | `TYPOGRAPHIC LUXURY` `EMPTY SPACE`       |
| 04. | **Engagement maison**          | 5 engagements concrets : sans paraben, sans test animal, packaging recyclé, livraison locale, partenariat instituts marocains. **Pas de greenwashing.**     | `TRANSPARENCY` `RISK REDUCTION`          |
| 05. | **Pivot subtil B2B**           | En bas : *« Vous représentez un institut ? Découvrir notre programme partenaires. »* Lien fin, pas un bouton.                                              | `DUAL-PATH` `NO PUSH`                    |
| 06. | **CTA — pas de vente**         | Un seul lien : *« Le journal — pour rester en contact. »* **Pas de** *« Acheter le kit »* ici. La page Maison est un don, pas un push.                    | `VALUE BEFORE ASK`                       |

---

### V.6 — `/panier` Le Panier

> **Rôle** : Récapitulatif avant checkout · **Audience** : Cliente prête à commander · **Funnel** : BOFU — Conversion

**Objectif.** Réduire la friction au minimum, sans paraître transactionnel. Le panier conserve l'esthétique éditoriale. **Aucune surprise de prix.** Une seule action visible : passer commande.

| #   | Section                        | Description                                                                                                                                          | Tactiques                                |
| :-- | :----------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------- |
| 01. | **Récapitulatif sobre**        | Photo miniature, nom, prix. **Pas de « vous économisez X »**. Pas d'icône poubelle violente — un `retirer` texte sobre.                              | `EMPTY SPACE` `GENTLE REMOVAL`           |
| 02. | **Up-sell éditorial discret**  | *Si applicable* : un seul produit complémentaire (recharge powder), avec une phrase narrative : *« Pour prolonger le rituel : la recharge. »*       | `SOFT UP-SELL` `STORYTELLING`            |
| 03. | **Code partenaire**            | Champ « Code partenaire » **replié par défaut**. Si la cliente a un code, elle clique pour révéler. Pas de tentation chez ceux qui n'en ont pas.   | `HIDE PROMO FIELD`                       |
| 04. | **Total — typo claire**        | Sous-total / Livraison / Total. Total en Cormorant 22pt, encre. **Round price** (320 dh, pas 319,99). Frais visibles en transparence.                | `ROUND PRICING` `FULL TRANSPARENCY`      |
| 05. | **CTA primaire — passage**     | `Passer la commande` (verbe d'action douce). Encre, pleine largeur. **Aucun autre CTA visible** — la décision est unique.                            | `SINGLE ACTION` `DECISION FATIGUE`       |
| 06. | **Réassurances en pied**       | 3 lignes : livraison 48h Casa · retour 14j · paiement sécurisé CMI. Inter caption brume — présent sans crier.                                          | `RISK REDUCTION` `TRUST SIGNALS`         |

---

### V.7 — `/commander` Checkout ★ *pivot de conversion*

> **Rôle** : Tunnel de paiement en 3 étapes · **Audience** : Cliente en phase de validation · **Funnel** : BOFU final — la vente se gagne ou se perd

**Objectif.** Minimiser l'abandon. Trois étapes maximum : **livraison · paiement · validation**. Progress bar visible. Aucun champ optionnel demandé. **Pas de création de compte forcée** — guest checkout par défaut, compte facultatif après confirmation.

#### Tunnel à 3 étapes

```
[01. Livraison] ───→ [02. Paiement] ───→ [03. Validation]
```

| Étape   | Contenu                                                                                              |
| :------ | :--------------------------------------------------------------------------------------------------- |
| **01. Livraison**   | Nom, prénom, adresse, téléphone, ville. Email pour confirmation. **Pas de mot de passe.** Auto-complétion ville Maroc. |
| **02. Paiement**    | CMI / Carte / Virement. Paiement 3× sans frais option. Pas de carte enregistrée. Logo banque marocaine.                |
| **03. Validation**  | Récapitulatif final + bouton `Confirmer la commande`. Une dernière chance de modifier avant l'irrévocable.             |

**Principes appliqués**

- `KOLENDA · GUEST CHECKOUT BY DEFAULT`
- `KOLENDA · MIN 3 STEPS`
- `KOLENDA · PROGRESS VISIBLE`
- `KOLENDA · NO HIDDEN FIELDS`
- `KOLENDA · MOBILE FIRST`
- `KOLENDA · SINGLE PAYMENT GATEWAY (CMI)`
- `KOLENDA · AUTOSAVE EVERY FIELD`

> **Source** : Baymard Institute — taux d'abandon panier 70% en moyenne. Chaque étape évitée = +5% conversion.

---

### V.8 — `/merci` Bienvenue dans la maison

> **Rôle** : Page de confirmation post-achat · **Audience** : Nouvelle initiée — première commande validée · **Funnel** : Post-purchase — onboarding émotionnel

**Objectif.** **Le moment le plus précieux du parcours.** La cliente vient de payer — elle est dans un état d'anticipation positive. Cette page transforme un achat en *initiation*. Elle n'est pas transactionnelle — elle est rituelle.

| #   | Section                        | Description                                                                                                                                          | Tactiques                                  |
| :-- | :----------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------- |
| 01. | **Accueil chaleureux**         | *« Bienvenue dans la maison. »* — Cormorant 38pt. **Pas** *« Merci pour votre commande »*. Le langage du rituel.                                     | `LANGUAGE OF RITUAL` `EMOTIONAL HIGH`      |
| 02. | **Récapitulatif visuel**       | Mini photo du kit + n° de commande + adresse + délai. **Pas de prix répété** — la cliente vient de payer, lui rappeler le montant la sort de l'émotion. | `MOMENTUM PROTECT.` `POST-PURCHASE COG.`  |
| 03. | **Vidéo des 4 gestes**         | Lecture automatique **en silence** (autoplay sans son). 90s slow motion. La cliente entre déjà dans le rituel par les yeux.                          | `SLOW MOTION` `PRE-EXPERIENCE PRIMING`     |
| 04. | **Compte à rebours doux**      | *« Votre rituel arrive dans 48h. »* — pas un timer numérique stressant, juste une phrase + une illustration discrète.                                | `ANTICIPATION` `NO STRESS`                 |
| 05. | **Bonus inattendu**            | Newsletter exclusive pour les **initiées seulement** : *« Le journal des initiées »*. Email envoyé après confirmation de livraison.                  | `RECIPROCITY` `EXCLUSIVITY`                |
| 06. | **Partage subtil**             | **Pas de** *« Partagez sur Facebook »*. Plutôt : *« Une amie aimerait découvrir ? »* avec un mini lien à transférer (pas un widget social).         | `NO SOCIAL FRICTION` `WORD-OF-MOUTH`       |

---

## VI — Univers Partenaire · B2B

### VI.1 — `/partenaires` Landing

> **Rôle** : Landing dédiée univers Pro · **Audience** : Gérante de salon ou institut · prospect B2B · **Funnel** : TOFU B2B

**Objectif.** Basculer la voix sensorielle vers la voix factuelle **sans changer de maison**. L'interlocutrice n'est plus une cliente qui cherche un rituel — c'est une professionnelle qui calcule sa marge. Trois chiffres en moins de 5 secondes : **marge salon, MOQ, délai contrat**.

| #   | Section                        | Description                                                                                                                                                | Tactiques                                  |
| :-- | :----------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------- |
| 01. | **Hero épuré — chiffres**      | *« Le rituel japonais en kit revente. »* Sous-titre : *« Marge salon 38%. MOQ 12 unités. Livraison 5 jours. »* **Aucune vague colorée** — l'épure crème = code B2B. | `BIG DIGITS` `FACTUAL VOICE`               |
| 02. | **3 chiffres-clés**            | Disposition 3 colonnes : **38%** · **12 u.** · **6 mois**. Cormorant 32pt. Sous chaque chiffre, une ligne de précision Inter caption.                       | `BIG DIGITS = CONFIDENCE` `PARALLEL INDIV.` |
| 03. | **CTA — voix d'expert**        | `Demander un échantillon Pro` (pas `Découvrir` — la pro veut *tester*). Encre, taille moyenne, ancré à droite des chiffres.                                 | `VERB CHOICE` `PROFESSIONAL TONE`          |
| 04. | **Témoignage institut**        | Un seul témoignage long d'une gérante nommée. **Avec photo de profil et nom de salon** — la confiance B2B passe par l'identifiable. **Inverse du B2C.**     | `AUTHENTICITY` `SOCIAL PROOF B2B`          |
| 05. | **Tableau comparatif**         | Tableau 3 colonnes : Vernis classique / Soin extension cils / Rituel FemiGlow. Critères : ticket moyen, marge, durée prestation, fidélisation.              | `FRAMING` `COMPETITIVE ANCHOR`             |
| 06. | **Pied — pivot vers B2C**      | En tout petit : *« Vous êtes une particulière ? Découvrir le rituel. »* Lien crème sur encre. Permet la sortie sans la suggérer.                            | `DUAL-PATH`                                |

---

### VI.2 — `/programme` Le Programme

> **Rôle** : Détail du modèle économique B2B · **Audience** : Pro en phase de comparaison · **Funnel** : MOFU B2B

**Objectif.** Présenter **3 paliers** (jamais 4+, jamais 2). Le palier du milieu est conçu pour gagner — *center stage effect*. **Anchoring** : afficher d'abord le palier le plus cher pour rendre le central abordable.

| Palier        | MOQ      | Marge       | Position commerciale          |
| :------------ | :------- | :---------- | :---------------------------- |
| **Starter**   | 12 u.    | marge 32%   | 1ère commande — *decoy*        |
| **Salon ★**   | 24 u.    | marge 38%   | **Le plus choisi** — center stage |
| **Institut**  | 48 u.    | marge 42%   | + formation — *anchor haut*    |

**Principes de pricing**

| Principe         | Application                                                                              |
| :--------------- | :--------------------------------------------------------------------------------------- |
| **Anchoring**    | Le palier Institut (le plus cher) ancre. Le palier Salon paraît raisonnable.            |
| **Decoy effect** | Le Starter est le decoy. Sa marge plus faible pousse vers Salon.                         |
| **Center stage** | Le Salon est central — visuellement et tarifairement. C'est la cible.                    |
| **Three charms** | 3 options inspirent confiance. 4+ déclenchent la fatigue de décision (Iyengar 2000).     |

`KOLENDA · 3 OPTIONS MAX` `KOLENDA · ANCHORING` `KOLENDA · DECOY EFFECT` `KOLENDA · CENTER STAGE`

---

### VI.3 — `/echantillon` Échantillon Pro ★ *pivot conversion B2B*

> **Rôle** : Formulaire de demande d'échantillon professionnel · **Audience** : Pro qualifiée prête à tester · **Funnel** : BOFU B2B

**Objectif.** **Capturer une qualification, pas un lead.** Le formulaire filtre intentionnellement : il demande un n° d'ICE et un nom de salon. Une vraie pro répond. Une simple curieuse abandonne. Le coût de cet échantillon est assumé — c'est un investissement.

| #   | Section                        | Description                                                                                                                                                | Tactiques                                |
| :-- | :----------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------- |
| 01. | **Promesse — dans le titre**   | *« Recevez le rituel chez vous, dans 5 jours. »* Cormorant 28pt, sobre. **Pas** *« Demandez votre échantillon gratuit »* — la gratuité dévalue.            | `VALUE FRAMING` `NO « FREE »`            |
| 02. | **Champs minimaux — 5 max**    | Nom · Salon · Ville · Téléphone · ICE. **Pas d'email d'abord** (le pro met son téléphone). Pas de checkbox newsletter, pas de questions ouvertes.          | `EFFORT REDUCTION` `PROGRESSIVE PROFILING` |
| 03. | **Champ qualifiant ICE**       | ICE (Identifiant Commun Entreprise) — propre au Maroc. **Filtre les non-pros.** Validé en temps réel via API GREFFE.                                       | `LEAD QUALIFICATION` `RISK REDUCTION`    |
| 04. | **Promesse délai**             | Sous le bouton, en italique : *« Vous recevrez un appel sous 24h, puis le kit sous 5 jours ouvrés. »* La temporalité est précise.                          | `TIME SPECIFICITY` `TRUST BUILDING`      |
| 05. | **Réassurance confidentialité**| Mention discrète : *« Vos données restent chez nous. Aucun partenaire commercial. »* RGPD respecté sans le crier.                                          | `TRANSPARENCY`                           |
| 06. | **Page de remerciement**       | Après envoi → `/echantillon/recu`. *« Nous vous appelons. »* avec photo Salma fondatrice (visible côté B2B). Personnalisation immédiate.                    | `PERSONAL FOLLOW-UP` `FOUNDER PRESENCE`  |

---

### VI.4 — `/espace-pro` Espace Pro

> **Rôle** : Espace authentifié partenaire · **Audience** : Salon partenaire actif (post-onboarding) · **Funnel** : LOYALTY B2B

**Objectif.** Faire en sorte que **passer une commande de réassort soit aussi simple qu'un message WhatsApp**. L'espace pro n'est pas un dashboard data-heavy — c'est un comptoir digital sobre. La pro doit y accéder en 2 clics.

| #   | Section                        | Description                                                                                                                       | Tactiques                                  |
| :-- | :----------------------------- | :-------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------- |
| 01. | **Login — sobre**              | Téléphone + code SMS (pas mot de passe). Le pro perd ses mots de passe — pas son téléphone. **Auth 2FA légère.**                 | `FRICTIONLESS AUTH` `TRUST`                |
| 02. | **Dashboard — 4 cartes**       | Cartes : **Réassort express**, **Mes commandes**, **Supports marketing**, **Mon contact**. 4 max — parallel individuation.       | `4 OPTIONS MAX` `FOCUS`                    |
| 03. | **Réassort express**           | Un bouton `Réassort identique` qui rejoue la dernière commande en 2 clics. Le pro confirme, point. **Pas d'ajout produit forcé.** | `FRICTION ZERO` `MOMENTUM`                 |
| 04. | **Supports marketing**         | Téléchargements : photos HD packshot, vidéo 4 gestes (sans logo), affiches A4 PDF, post Instagram template. **Brand asset library.** | `BRAND CONSISTENCY` `DELEGATED MARKETING` |
| 05. | **Mon contact**                | Photo + nom + WhatsApp direct du commercial dédié (pas un bot). Réponse < 4h ouvrées garantie. **Le pro a un humain**, pas un ticket. | `HUMAN CONTACT` `B2B LOYALTY`              |
| 06. | **Statistiques discrètes**     | Onglet caché par défaut : ventes du salon, taux de réassort, panier moyen. **Visibles à la demande**, pas en façade.              | `DATA ON DEMAND` `NO OVERWHELM`            |

---

## VII — Pages transverses

Les pages utilitaires — présentes dans les deux univers, sobres, fonctionnelles, jamais bâclées.

### VII.1 — `/contact` Contact

| Composant      | Spécification                                                               |
| :------------- | :-------------------------------------------------------------------------- |
| **Photo**      | Salma fondatrice, taille moyenne, profil au travail.                         |
| **Formulaire** | Nom · Email · Sujet (3 options) · Message. Validation en temps réel.        |
| **Direct**     | WhatsApp business cliquable. Adresse Casablanca. Horaires 9h–18h.           |
| **Délai**      | *« Réponse sous 24h ouvrées »* — **pas de chatbot**. Promesse humaine.      |

`KOLENDA · HUMAN CONTACT` `KOLENDA · TIME SPECIFIC` `KOLENDA · NO BOT`

### VII.2 — `/faq` FAQ

| Composant            | Spécification                                                                              |
| :------------------- | :----------------------------------------------------------------------------------------- |
| **Filtres**          | Deux onglets en haut : *Particulier · Partenaire*. Mémorisé en cookie.                     |
| **Format**           | Accordéons. Une question, un déroulé. Cliquable, jamais hover.                             |
| **8 questions B2C**  | Composition · Allergies · Durée d'un kit · Livraison · Retour · Cadeau · Réassort · Pro.   |
| **6 questions B2B**  | MOQ · Marges · Délais · Formation · Supports · ICE.                                        |

`KOLENDA · DUAL-PATH` `KOLENDA · EFFORT REDUCTION` `KOLENDA · OBJECTION HANDLING`

### VII.3 — `/legal/*` Pages légales

| URL                            | Contenu                                                            |
| :----------------------------- | :----------------------------------------------------------------- |
| `/legal/mentions`              | Éditeur, hébergeur, contact RGPD.                                  |
| `/legal/cgv`                   | Conditions de vente, livraison, retour, garantie.                  |
| `/legal/confidentialite`       | Données collectées, durée, droits.                                 |
| `/legal/cookies`               | Politique cookies, banner discrète au premier accès.               |

> **Les pages légales sont rédigées en français accessible** — pas de jargon juridique gratuit. Le ton de la maison persiste, même dans les CGV.

`KOLENDA · TRANSPARENCY` `KOLENDA · CLEAR LANGUAGE` `KOLENDA · RGPD`

---

## VIII — Parcours utilisateur

### VIII.1 — Funnel B2C

```
[Découverte]──→[Considération]──→[Décision]──→[Initiation]
   TOFU            MOFU              BOFU         POST
```

| Étape           | Pages                                              | Émotion              | Action stratégique                                                       | Métrique de succès                          |
| :-------------- | :------------------------------------------------- | :------------------- | :----------------------------------------------------------------------- | :------------------------------------------ |
| **Découverte**  | `/accueil`                                         | Curiosité, scepticisme | Capturer l'attention — Hero éditorial, manifeste 3 lignes, 5 sec décisives | Bounce rate < 55%, scroll depth > 60%       |
| **Considération** | `/rituel · /journal · /maison`                    | Intérêt, comparaison  | Construire la conviction — Le Rituel raconte, Journal montre, Maison incarne | Pages/session ≥ 3, temps moyen > 2:30       |
| **Décision**    | `/kit`                                             | Désir, hésitation     | Réduire le doute — photo contextuelle, prix rond, réassurances, FAQ       | Add-to-cart rate > 8%                       |
| **Initiation**  | `/commander · /merci`                              | Anticipation, fierté  | Transformer en initiation — Checkout 3 étapes, *« Bienvenue »* à `/merci` | Conversion checkout > 35%, NPS > 50         |

### VIII.2 — Funnel B2B

```
[Prospection]──→[Évaluation]──→[Test]──→[Partenariat]
    TOFU            MOFU         BOFU       ACTIVE
```

| Étape           | Pages                                          | Émotion                | Action stratégique                                       | Métrique de succès                                    |
| :-------------- | :--------------------------------------------- | :--------------------- | :------------------------------------------------------- | :---------------------------------------------------- |
| **Prospection** | `/partenaires`                                 | Calcul, analyse        | Démontrer le ROI — 3 chiffres en 5 secondes              | Demandes échantillon/mois ≥ 8                         |
| **Évaluation**  | `/programme` + témoignages                     | Comparaison, doute     | Ancrer le palier Salon — center stage + decoy            | Taux conversion test → contrat > 60%                  |
| **Test**        | `/echantillon` + appel humain                  | Validation pratique    | Qualifier (ICE) + livrer + appeler dans la journée       | Délai test → première commande < 30j                  |
| **Partenariat** | `/espace-pro` + WhatsApp dédié                 | Confiance, routine     | Réassort 2 clics + commercial humain                     | Taux de réassort > 80%, churn < 10%/an                |

### Différences B2B vs B2C

| Dimension     | B2C                              | B2B                                                          |
| :------------ | :------------------------------- | :----------------------------------------------------------- |
| **Voix**      | Sensorielle, métaphorique         | **Factuelle**, pas sensorielle. Les chiffres avant les adjectifs. |
| **Photos**    | Mains anonymes, gestes, ambiances | **Identifiables** : portraits, salons reconnus.              |
| **Pricing**   | Prix unique rond (320 dh)         | **Modèle économique** — marges, MOQ, délais.                  |
| **Suivi**     | Newsletter mensuelle              | **Humain dédié.** WhatsApp direct. Le pro a un nom et un visage. |

---

## IX — Synthèse & matrice

### IX.1 — Matrice tactiques Kolenda × Pages

Légende : ● = tactique appliquée · — = non applicable

#### Partie 1 — Tactiques fondamentales

| Tactique Kolenda                | Acc. | Rit. | Kit | Jrn. | Mais. | Pan. | Chk. | Mer. ‖ Land. | Prog. | Ech. | Pro |
| :------------------------------ | :--: | :--: | :-: | :--: | :---: | :--: | :--: | :--: ‖ :---: | :---: | :--: | :-: |
| Indirect claims                 |  ●   |  ●   |  ●  |  ●   |   ●   |  —   |  —   |  —   ‖   ●   |   —   |  —   |  —  |
| Round pricing (luxe émo.)       |  —   |  —   |  ●  |  —   |   —   |  ●   |  ●   |  —   ‖   —   |   —   |  —   |  —  |
| 4 options max (Gallivan)        |  ●   |  ●   |  ●  |  ●   |   ●   |  —   |  ●   |  —   ‖   ●   |   ●   |  —   |  ●  |
| Empty space (+23% premium)      |  ●   |  ●   |  ●  |  ●   |   ●   |  ●   |  ●   |  ●   ‖   ●   |   ●   |  ●   |  ●  |
| Imply human (mains)             |  ●   |  ●   |  ●  |  ●   |   —   |  —   |  —   |  ●   ‖   —   |   —   |  —   |  —  |
| F-pattern eye flow              |  —   |  ●   |  ●  |  ●   |   ●   |  —   |  —   |  —   ‖   —   |   —   |  —   |  —  |
| Z-pattern eye flow              |  ●   |  —   |  —  |  —   |   —   |  ●   |  ●   |  ●   ‖   ●   |   ●   |  ●   |  ●  |
| Big digits = confidence         |  —   |  —   |  —  |  —   |   —   |  —   |  —   |  —   ‖   ●   |   ●   |  —   |  —  |

#### Partie 2 — Tactiques avancées

| Tactique Kolenda                | Acc. | Rit. | Kit | Jrn. | Mais. | Pan. | Chk. | Mer. ‖ Land. | Prog. | Ech. | Pro |
| :------------------------------ | :--: | :--: | :-: | :--: | :---: | :--: | :--: | :--: ‖ :---: | :---: | :--: | :-: |
| Hook before solution            |  ●   |  ●   |  ●  |  ●   |   —   |  —   |  —   |  —   ‖   ●   |   —   |  —   |  —  |
| P.A.S. framework                |  —   |  ●   |  ●  |  ●   |   —   |  —   |  —   |  —   ‖   ●   |   ●   |  ●   |  —  |
| Benefits before features        |  ●   |  ●   |  ●  |  —   |   ●   |  —   |  —   |  —   ‖   ●   |   ●   |  —   |  —  |
| Risk reduction (9 types)        |  ●   |  ●   |  ●  |  —   |   ●   |  ●   |  ●   |  —   ‖   ●   |   ●   |  ●   |  ●  |
| Anchoring                       |  —   |  —   |  ●  |  —   |   —   |  —   |  —   |  —   ‖   —   |   ●   |  —   |  —  |
| Decoy effect                    |  —   |  —   |  —  |  —   |   —   |  —   |  —   |  —   ‖   —   |   ●   |  —   |  —  |
| Social proof (testimonials)     |  ●   |  ●   |  ●  |  ●   |   ●   |  —   |  —   |  ●   ‖   ●   |   ●   |  —   |  —  |
| Slow motion = luxury            |  ●   |  ●   |  ●  |  —   |   —   |  —   |  —   |  ●   ‖   —   |   —   |  —   |  —  |
| Friendly cold (no emoji)        |  ●   |  ●   |  ●  |  ●   |   ●   |  ●   |  ●   |  ●   ‖   ●   |   ●   |  ●   |  ●  |
| Single-action focus             |  ●   |  —   |  ●  |  —   |   —   |  ●   |  ●   |  ●   ‖   ●   |   —   |  ●   |  —  |
| Progressive disclosure          |  ●   |  ●   |  ●  |  ●   |   ●   |  ●   |  ●   |  —   ‖   ●   |   ●   |  ●   |  ●  |
| Time specificity                |  —   |  —   |  ●  |  —   |   —   |  ●   |  ●   |  ●   ‖   ●   |   ●   |  ●   |  ●  |
| Center stage effect             |  —   |  —   |  —  |  —   |   —   |  —   |  —   |  —   ‖   —   |   ●   |  —   |  —  |
| Three charms, four alarms       |  —   |  —   |  —  |  —   |   —   |  —   |  —   |  —   ‖   —   |   ●   |  —   |  —  |
| Eye flow control                |  ●   |  ●   |  ●  |  ●   |   ●   |  ●   |  ●   |  ●   ‖   ●   |   ●   |  ●   |  ●  |
| Founder presence (B2B)          |  —   |  —   |  —  |  —   |   ●   |  —   |  —   |  —   ‖   ●   |   ●   |  ●   |  ●  |
| Verb of opening (CTA)           |  ●   |  ●   |  ●  |  ●   |   —   |  ●   |  ●   |  —   ‖   ●   |   —   |  ●   |  ●  |

> **Cette grille est un audit, pas une obligation** : certaines tactiques se contredisent. L'intelligence est de choisir lesquelles activer par page. **Règle minimale** : chaque page doit cocher au moins **4 tactiques** pour être validée.

### IX.2 — Glossaire architectural

| Terme            | Définition                                                                       |
| :--------------- | :------------------------------------------------------------------------------- |
| **ATF / BTF**    | Above the fold / below the fold — au-dessus / sous la pliure.                    |
| **BOFU**         | Bottom of funnel — phase de décision, conversion.                                |
| **CTA**          | Call to action — bouton ou lien d'action principale.                             |
| **Funnel**       | Entonnoir de conversion — du visiteur à l'initiée.                               |
| **Initiée**      | Cliente ayant complété sa première commande. Statut, pas marketing.              |
| **MOFU**         | Middle of funnel — phase de considération, comparaison.                          |
| **MOQ**          | Minimum order quantity — quantité minimale B2B.                                  |
| **Pivot**        | Page-clé du funnel — Kit, Checkout, Échantillon B2B.                             |
| **Round price**  | Prix rond (320 dh) — pour achats émotionnels luxe.                                |
| **Sticky**       | Élément qui reste visible lors du scroll (header, CTA).                          |
| **TOFU**         | Top of funnel — phase de découverte, awareness.                                  |
| **Wireframe**    | Schéma fil-de-fer d'une page — structure sans style.                             |

### IX.3 — Sources Kolenda — 11 guides

| Guide              | URL                                          | Apport principal                              |
| :----------------- | :------------------------------------------- | :-------------------------------------------- |
| Ecommerce          | `kolenda.io/guides/ecommerce`                | Photos, prix, codes promo.                    |
| Copywriting        | `kolenda.io/guides/copywriting`              | Indirect claims, frameworks (P.A.S., A.I.D.A.). |
| User Experience    | `kolenda.io/guides/user-experience`          | 5 guidelines : focus, understanding, effort, errors, compatibility. |
| Pricing            | `kolenda.io/guides/pricing`                  | Charm vs round, anchoring, decoy.             |
| Visual Attention   | `kolenda.io/guides/visual-attention`         | F/Z-patterns, eye flow.                       |
| Luxury Branding    | `kolenda.io/guides/luxury-branding`          | Empty space, distance, tall fonts.            |
| Color              | `kolenda.io/guides/color`                    | Désaturation, luxe.                           |
| Fonts              | `kolenda.io/guides/fonts`                    | Serif old-style = élégance.                   |
| Packaging          | `kolenda.io/guides/packaging`                | Vu pour la charte graphique.                  |
| Advertising        | `kolenda.io/guides/advertising`              | Tactiques publicitaires.                      |
| Negotiation        | `kolenda.io/guides/negotiation`              | Pertinent pour B2B.                           |

---

> *Cette architecture appelle ses prochaines productions. Page par page, en détail.*

**FIN · FemiGlow · Architecture du site v1.0 · Mai 2026**
