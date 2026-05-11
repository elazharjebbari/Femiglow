# Bonnes pratiques Kolenda — Synthèse appliquée à FemiGlow

Ce document condense les huit guides marketing de Nick Kolenda (Attention, Color, Copywriting, Ecommerce, Fonts, Luxury, Pricing, UX) en règles actionnables pour la maison FemiGlow. Chaque section restitue la thèse de l'auteur, les principes les plus opératoires, leur traduction concrète sur le site, puis les écueils à éviter. La voix « maison / rituel / initiée » est maintenue de bout en bout : pas d'urgence factice, pas de superlatif publicitaire, registre soutenu.

---

## 1. Attention

### Thèse centrale
L'attention humaine est captée par huit familles de signaux : saillance perceptive, mouvement, agents vivants, indices spatiaux, éveil élevé, inattendu, pertinence personnelle, pertinence du but. Toute interface efficace alterne ces déclencheurs sans en abuser, sous peine de bruit visuel.

### Principes clés
- Concentrer la saillance (contraste, taille, isolation) sur un seul élément par écran ; un signal partout équivaut à aucun signal.
- Préférer le mouvement subtil et bref (apparition, micro-transition) au mouvement répété, qui devient mobilier visuel.
- Utiliser un visage ou une main, dont le regard ou le geste pointe l'objet à observer ; l'œil suit toujours un regard humain.
- Aligner un indice spatial discret (flèche fine, ligne, point) sur la zone décisionnelle ; la trajectoire visuelle doit converger vers l'action attendue.
- Réserver l'éveil émotionnel à des moments rares (annonce d'une nouveauté, page rituel) pour conserver son pouvoir d'arrêt.
- Introduire un détail légèrement inattendu (texture, mot, asymétrie maîtrisée) pour rompre la prédiction sans rompre l'élégance.
- Personnaliser l'adresse au moment juste : prénom dans la confirmation, peau et teinte évoquées dans la recommandation.
- Rappeler le but de la cliente au sommet de chaque page (« Composer son rituel », « Reprendre où vous en étiez »).

### Application à FemiGlow
La homepage repose sur une image unique en grande taille, regard dirigé vers le module « Composer votre rituel ». Les pages de kit isolent un produit par bloc, avec un filet sage très fin qui dirige l'œil vers le prix puis vers le bouton. Les transitions de la barre panier sont brèves (250 ms), sans pulsation. Les bandeaux promotionnels clignotants et compteurs sont proscrits. Une mention personnalisée discrète (« Votre rituel en cours ») apparaît dans l'espace cliente pour activer la pertinence du but.

### Pièges à éviter
- Multiplier les zones saillantes (rouge, gras, majuscules, bordures) jusqu'à saturer la page.
- Animer en boucle un élément non critique (icône, badge), ce qui détourne durablement l'attention.
- Recourir à un visage générique de banque d'images sans cohérence avec la voix maison.
- Utiliser l'inattendu comme un gag : la rupture doit rester de l'ordre du détail soigné.

---

## 2. Color

### Thèse centrale
La couleur agit par trois dimensions perceptives (teinte, saturation, luminosité) et par une couche symbolique culturelle. Le choix juste découle d'un signal voulu (chaleur, calme, prestige, naturel) puis d'une mise en système, et non d'un goût personnel.

### Principes clés
- Choisir une teinte dominante qui code la promesse (vert sauge pour soin, naturel, apaisement) et l'isoler dans 70 % de la surface.
- Tenir la saturation basse pour la masse, élevée pour le seul point d'action ; le contraste sémantique nait de la rareté.
- Travailler la luminosité plutôt que la teinte pour créer la hiérarchie (sage profond, sage clair, crème).
- Stabiliser un neutre chaud (crème) plutôt qu'un blanc pur, qui éteint les nuances minérales.
- Réserver une couleur d'accent unique (encre, terre cuite très douce) pour la signalisation forte (prix, état, lien).
- Tester chaque combinaison en thème clair et en thème sombre : la même palette doit signifier la même chose.
- Vérifier les contrastes (WCAG AA minimum, AAA sur les corps de texte) ; l'élégance ne se paie pas au prix de la lisibilité.
- Documenter la palette en tokens sémantiques (`surface`, `text`, `accent`, `price`) pour éviter les dérives.

### Application à FemiGlow
Le système couleur tient sur trois familles : sage (surface, navigation, blocs de contenu), crème (fond global, cartes produits), encre (texte, prix, liens). Aucune couleur tierce sur le site marchand, sauf en éditorial où une variation très désaturée peut accompagner une histoire produit. Les badges d'état (succès, erreur, info) sont dérivés du sage et de l'encre par variations de luminosité, sans vert vif ni rouge alarme. Le mode sombre conserve sage et crème inversés sans introduire de nouvelle teinte.

### Pièges à éviter
- Ajouter une couleur primaire vive (rouge, orange) pour les promotions : la voix maison ne supporte pas cette grammaire.
- Mélanger plusieurs accents (cuivre + or + ardoise) qui dilue la lecture du prix et de l'action.
- Utiliser le blanc pur comme fond : il refroidit le sage et casse l'atmosphère feutrée.
- Coder par couleur seule (information accessible aux daltoniens : doubler par forme, mot ou position).

---

## 3. Copywriting

### Thèse centrale
Les mots agissent à trois niveaux : sonorité (phonèmes ronds, plosifs, fricatifs), imagerie mentale (verbes concrets, scènes), cadrage (gain ou perte, certitude ou possibilité). Un texte juste choisit ces leviers en fonction de l'émotion exacte à induire.

### Principes clés
- Préférer les phonèmes doux et ronds (m, l, n, ou) dans les noms produits et accroches : ils signifient la douceur et la durée.
- Convoquer une image sensorielle précise plutôt qu'un adjectif générique (« le grain de la lime », « l'épaisseur d'un baume »).
- Écrire au présent et à la deuxième personne pour les invitations, au passé pour les preuves (« réfléchit la lumière », « a été pensé »).
- Cadrer en gain pour les pages d'entrée (ce que l'on cultive) et en certitude pour le rituel (ce que l'on installe).
- Raccourcir les boutons à un verbe et un objet (« Composer mon rituel », « Voir le kit »), éviter les formules vides (« en savoir plus »).
- Aligner la longueur de phrase au moment : longue et posée en présentation, brève à la décision.
- Nommer les choses avec leur mot propre (« huile », « lime cristal », « base ») plutôt que par des néologismes marketing.
- Éviter les marqueurs d'urgence (« vite », « dernières heures ») et les exclamations ; la maison n'élève pas la voix.

### Application à FemiGlow
Les fiches produits suivent une trame : nom (deux ou trois mots), geste (une phrase au présent), matière (sensoriel), résultat (verbe sobre), rituel (place dans la séquence). Les boutons utilisent « Composer », « Ajouter au rituel », « Recevoir le kit ». Les confirmations adoptent un ton de bibliothécaire bienveillante : « Votre rituel est en route. ». Les emails reprennent la même grammaire, sans capitalisation criée. Les libellés admin restent fonctionnels, mais ne contaminent pas la voix publique.

### Pièges à éviter
- Empiler les adjectifs flatteurs (« exceptionnel », « unique ») qui affaiblissent la confiance.
- Mélanger les registres (familier dans un email, soutenu sur une fiche).
- Traduire littéralement depuis l'anglais marketing (« game changer », « must-have »).
- Recourir aux capitales d'insistance et aux points d'exclamation pour suppléer une accroche faible.

---

## 4. Ecommerce

### Thèse centrale
Une expérience marchande efficace n'est pas une vitrine plus belle, mais une succession de choix simplifiés : densité du catalogue, posture de navigation, qualité d'image, micro-frictions. Les bonnes pratiques visent à réduire l'effort cognitif sans appauvrir le désir.

### Principes clés
- Augmenter le padding entre cartes produits pour signaler une sélection éditorialisée plutôt qu'un stock.
- Préférer un défilement vertical paginé à un mur infini : la lassitude est l'ennemi du choix.
- Encadrer chaque carte d'une bordure très discrète pour structurer le regard sans cloisonner.
- Alterner image isolée (fond crème) et image en contexte (main, table, lumière) pour parler à deux registres : objet et usage.
- Maintenir un ratio image stable (3/4 portrait pour les flacons, 1/1 pour les pinceaux) ; la régularité fait l'élégance.
- Afficher un seul prix, sans rature, sans pourcentage ; la valeur perçue se construit par le contexte.
- Limiter les filtres à quatre familles maximum (catégorie, peau, finition, format) et les regrouper par paire de quatre.
- Documenter une fiche par la séquence : visuel principal, geste, composition, rituel associé, kit recommandé.

### Application à FemiGlow
Le catalogue rituels affiche douze pièces maximum par page, avec une gouttière généreuse. Chaque carte mêle un visuel isolé en couverture et un visuel d'usage au survol (image fixe sur mobile). La fiche produit suit la séquence canonique ; un encart « rituel associé » remplace le classique « produits similaires ». Le panier indique le montant et la composition, sans contre-proposition agressive. Aucune fenêtre modale promotionnelle à l'arrivée.

### Pièges à éviter
- Charger des fonds blancs durs et des ombres dures qui rendent l'image catalogue clinique.
- Multiplier les badges (« nouveau », « bestseller », « -10 % ») qui transforment la grille en supermarché.
- Imposer une vidéo en autoplay sur fiche produit ; proposer un lecteur silencieux à clic.
- Demander la création de compte avant l'ajout au panier.

---

## 5. Fonts

### Thèse centrale
Une typographie communique avant d'être lue : sa classification (serif, sans, script), sa rondeur, sa complexité, sa largeur, sa graisse, sa casse, son interlettrage et son inclinaison émettent des signaux que le cerveau interprète comme un caractère. Le choix d'une fonte est un choix de personnalité.

### Principes clés
- Choisir un serif aux contrastes nets pour les titres : maturité, soin, héritage.
- Adjoindre un sans à dessin humaniste pour le corps : lisibilité prolongée sans froideur.
- Préférer les fontes étroites et étirées en très grandes tailles (couvertures, manifestes) pour le registre couture.
- Cultiver l'interlettrage généreux des titres en capitales ; serrer le corps pour la fluidité.
- Limiter la palette à deux familles maximum, en exploitant graisses et casses pour la hiérarchie.
- Bannir les italiques décoratifs et les scripts manuscrits : ils contredisent la rigueur de l'objet.
- Vérifier le rendu en moyenne taille (corps 16 à 20) : c'est là que la fonte vit le plus.
- Charger les seuls jeux de glyphes nécessaires (français étendu, ponctuation soignée) et préférer un format moderne (woff2 sous-typé).

### Application à FemiGlow
Le titrage repose sur un serif éditorial (contraste prononcé, capitales espacées sur les hero, bas de casse sur les sections). Le corps utilise un sans humaniste à empattements résiduels, en deux graisses (regular, medium). Les prix adoptent la même fonte que le corps, jamais une fonte décorative ; leur poids visuel vient de l'interlettrage et de la couleur encre. Le glyphe euro est aligné, sans décor.

### Pièges à éviter
- Mélanger un serif moderne et un serif géométrique : la collision affaiblit l'autorité.
- Utiliser des italiques systémiques en bouton ou en navigation, qui dégradent la lisibilité tactile.
- Recourir à une fonte gratuite mal hintée pour le corps : l'inconfort est immédiat.
- Choisir une fonte tendance datée (effet « 2020 ») qui vieillira plus vite que le produit.

---

## 6. Luxury

### Thèse centrale
Le luxe ne signale pas la qualité par l'abondance mais par la distance. Sept leviers en sont les supports : statut social, froideur perçue, hauteur et lointain, typographie fine et espacée, mise à distance du quotidien, exhibition du travail, ralentissement. Une marque feutrée joue ces sept cordes en sourdine.

### Principes clés
- Signaler un statut sans le revendiquer (mise en scène, choix des matières, voix maison).
- Préférer la fraîcheur à la chaleur dans la palette (sage légèrement bleuté plutôt que verdoyant).
- Travailler les angles de vue plongeants ou contre-plongeants doux, qui inscrivent l'objet dans une géographie élevée.
- Utiliser des fontes étroites, fines, en capitales espacées pour les manifestes et les pages racines.
- Isoler l'objet de la vie ordinaire : éviter les contextes domestiques bruyants au profit d'espaces dépouillés.
- Exhiber le geste du soin (la lime tenue, le coton replié) pour rendre visible le savoir-faire.
- Ralentir les rythmes : transitions plus longues sur les pages racines, pauses entre les sections.
- Tarir le langage : moins de phrases, plus d'espace ; la rareté du mot vaut l'objet.

### Application à FemiGlow
Les pages manifestes (À propos, Le rituel) adoptent un rythme lent : titres en capitales espacées, paragraphes brefs, intercalaires d'air. Les visuels privilégient une lumière fraîche, des fonds crème ou sage profond, des cadrages qui isolent. Les confirmations et états vides s'expriment en phrases courtes (« Votre rituel attend. »). Les transitions sur les pages racines durent 400 à 500 ms, contre 200 à 250 ms sur les pages opérationnelles (panier, compte).

### Pièges à éviter
- Imiter les codes du luxe par accumulation (or, marbre, sérifs gras) au lieu d'en pratiquer la sobriété.
- Insérer des compteurs d'abonnés ou de ventes : preuve sociale de masse, contraire à la mise à distance.
- Personnaliser à l'excès l'adresse (« Salut Sofia ! »), ce qui casse la verticalité de la voix.
- Multiplier les badges de récompense : la marque s'exhibe au lieu de se tenir.

---

## 7. Pricing

### Thèse centrale
Le prix est une information visuelle avant d'être un nombre. Son placement, sa taille, sa couleur, son voisinage, sa structure (entiers, centimes, devise) influencent la perception de la valeur autant que le montant lui-même. Une politique de prix soignée commence par la typographie du prix.

### Principes clés
- Placer le prix à gauche d'une référence comparative quand on souhaite la perception « moins cher », à droite quand on assume une position haute.
- Préférer un corps de prix de la même taille que le corps de texte : un prix énorme appelle la discussion.
- Tenir une couleur encre pour les prix : le rouge appartient à la liquidation, pas à la maison.
- Écrire le prix en chiffres pleins (« 420 MAD »), sans séparateur fantaisie ni virgule décimale inutile.
- Ordonner les références du plus engagé au plus accessible sur les pages rituels : la première lecture pose la valeur.
- Présenter un kit comme un tout dont la somme des parties est mentionnée discrètement, sans encart « économie ».
- Éviter les terminaisons charm pricing (49, 99) : elles signalent la grande distribution.
- Documenter les transitions de prix (édition limitée, série de saison) par un récit, jamais par un compteur.

### Application à FemiGlow
Les pages rituels présentent le kit complet en premier, puis ses pièces ; le prix du kit est mentionné en regard de la somme des unités, sans formulation d'économie. Les prix individuels tiennent en chiffres ronds (420, 380, 240 MAD), encre, fonte du corps, placés sous le nom du produit. Les soldes saisonnières, si elles existent, prennent la forme d'une page « Atelier d'archives » avec récit dédié, jamais d'un bandeau site.

### Pièges à éviter
- Afficher un prix barré rouge : il abîme le placement maison en deux interactions.
- Promettre un cadeau à partir d'un seuil : la transaction prime sur le rituel.
- Cacher les frais (port, douane) jusqu'au checkout : la confiance se construit en amont.
- Animer le prix au passage du curseur : aucun chiffre n'a besoin d'attirer l'œil.

---

## 8. UX

### Thèse centrale
Une interface honore l'effort cognitif de l'usager : elle limite les choix simultanés, raisonne en termes relatifs, accompagne les erreurs, autorise le retour en arrière, signale ce qui est interactif. Les vingt-neuf principes de Kolenda dessinent une éthique du soin appliquée à l'écran.

### Principes clés
- Présenter quatre options ou moins par décision ; regrouper les ensembles plus larges en sous-décisions.
- Communiquer en termes relatifs (« il y a deux jours », « au-dessus de la moyenne ») plutôt qu'absolus.
- Étendre les zones cliquables (44 pixels minimum) et maintenir les menus ouverts quelques centaines de millisecondes.
- Permettre l'annulation plutôt que la confirmation : un lien « Annuler » dans un toast vaut mieux qu'une fenêtre modale.
- Rédiger les messages d'erreur en instructions, pas en accusations (« Ajouter une adresse » plutôt que « Vous avez oublié »).
- Indiquer visuellement ce qui est interactif (soulignement au survol, curseur, halo discret) ; ne jamais cacher une action derrière l'esthétique.
- Donner un retour immédiat à chaque interaction : changement d'état, micro-animation, message inline.
- Aider à survoler le contenu : titres clairs, paragraphes courts, listes typées, ancres de section sur les pages longues.
- Réduire les calculs mentaux (afficher les totaux, mémoriser l'adresse, pré-remplir les champs).
- Adapter l'interface au but : compte client, panier, recherche doivent répondre à des intentions distinctes.

### Application à FemiGlow
Le menu principal regroupe quatre entrées (Rituels, Maison, Journal, Compte) ; chaque entrée déroule jusqu'à quatre sous-éléments. Les filtres catalogue obéissent à la même règle de quatre. Les boutons mesurent au minimum 44 pixels en hauteur. Les confirmations critiques (suppression de carte, désabonnement) sont annulables par toast pendant six secondes. Les erreurs de formulaire s'affichent inline, en encre sage, avec une phrase d'instruction. Les états vides (panier, journal) racontent une amorce de geste (« Votre rituel reste à composer. »).

### Pièges à éviter
- Empiler les confirmations modales pour des actions réversibles.
- Cacher la navigation derrière des icônes sans libellé (le burger seul sur desktop est une faute).
- Donner un retour d'action trop tardif (au-delà d'une seconde sans indicateur).
- Charger l'interface de tooltips : un libellé clair évite quatre infobulles.

---

## Heuristiques transverses

Quinze règles de conduite synthétisant les huit guides, à imposer comme grille de relecture sur chaque page, chaque composant, chaque ligne de copie.

1. Conserver un signal saillant unique par écran et tenir le reste en demi-teinte.
2. Réserver la couleur d'accent à l'action et à l'information critique ; tout le reste vit en sage et crème.
3. Bâtir la hiérarchie par luminosité et espace, jamais par accumulation de couleurs.
4. Choisir le mot propre plutôt que le superlatif ; nommer la matière, le geste, le résultat.
5. Écrire au présent pour inviter, au passé pour prouver, à l'imparfait pour évoquer la maison.
6. Bannir les marqueurs d'urgence, les compteurs, les bandeaux clignotants et les exclamations.
7. Présenter un seul prix, en encre, sans rature ni pourcentage ; raconter la valeur, ne pas la marteler.
8. Limiter chaque décision à quatre options visibles ; regrouper au-delà.
9. Étendre les zones cliquables au minimum tactile (44 pixels) et signaler l'interactivité visuellement.
10. Préférer l'annulation à la confirmation pour les actions réversibles.
11. Rédiger les erreurs en instruction calme, jamais en reproche.
12. Tenir un ratio image stable et une lumière fraîche cohérente sur tout le catalogue.
13. Ralentir les transitions sur les pages racines, accélérer sur les pages opérationnelles.
14. Personnaliser avec retenue : la deuxième personne convient, le prénom intempestif rompt la voix.
15. Documenter chaque décision (palette, fonte, copy, prix) en tokens et en guidelines pour préserver la cohérence dans la durée.
