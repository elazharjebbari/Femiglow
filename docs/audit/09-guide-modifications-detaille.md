# Guide détaillé des modifications de contenu — page par page, élément par élément

Ce document est la **feuille de route opérationnelle** d'alignement du site sur le brief du 11 mai 2026. Il complète le plan général (`08-plan-correction-contenu.md`) en descendant au niveau de chaque page, chaque section, chaque chaîne de caractères. Pour chaque modification, on indique l'état actuel, la cible, le pourquoi (référence Kolenda + logique business), le fichier concerné, et — quand utile — la mécanique UX à conserver.

À la fin du document figure une **proposition de douze articles** à rédiger pour le journal, calibrés sur le produit (manucure japonaise halal, paste + powder + polissoir Step 4, Souheila à Rabat) et alignés sur les heuristiques Kolenda.

## 0. Préambule

### 0.1 Arbitrages confirmés (11 mai 2026)

| Décision | Valeur retenue |
| --- | --- |
| Prix | **199 dh** affiché en grand, **390 dh** affiché comme prix complet en seconde ligne (option B du plan § 2.1) — anchoring assumé |
| Livraison | **« Livraison offerte au Maroc »** par défaut, pas de seuil |
| Domaine site | **`femiglow-maroc.com`** (le site bascule, `femiglow.ma` reste tout au plus un alias à rediriger) |
| Email | **`info@femiglow-maroc.com`** |
| Téléphone | **+212 630-035905** |
| Adresse maison | **25 bis avenue Patrice Lumumba, Rabat** |
| Fondatrice | **Souheila** — master en biologie, formations en fabrication cosmétique, anime des formations dans l'atelier, possède plusieurs marques de cosmétiques naturels |
| Produit | **Pack FemiGlow** — coffret manucure japonaise halal, deux gestes (1 paste, 2 powder) + polissoir « Step 4 Polish & Shine » |

### 0.2 Principes Kolenda les plus mobilisés

| Référence | Principe | Source Kolenda |
| --- | --- | --- |
| K-ATT-01 | Une seule zone saillante par écran ; le contraste dirige l'œil | Attention |
| K-ATT-02 | Indice spatial discret (filet, alignement, regard) vers la zone décisionnelle | Attention |
| K-COL-01 | 60-30-10 strictement appliqué, accent rare | Color |
| K-COP-01 | CTA = verbe + objet, jamais « En savoir plus » | Copywriting |
| K-COP-02 | Phonèmes doux (m, l, n, ou) pour la promesse, secs pour la décision | Copywriting |
| K-COP-03 | Imagerie sensorielle concrète plutôt qu'adjectif générique | Copywriting |
| K-ECO-01 | Réassurances regroupées sous le CTA primaire | Ecommerce |
| K-ECO-02 | Un seul CTA primaire par écran ; tout autre lien en secondaire visuellement faible | Ecommerce |
| K-ECO-03 | Le prix de référence ancré au-dessus, le prix payé en grand juste après | Ecommerce |
| K-LUX-01 | Espace blanc = +23 % premium perçu (Sevilla & Townsend 2016) | Luxury |
| K-LUX-02 | Slow motion (300–400 ms) = luxe ; pas de mouvement répété | Luxury |
| K-LUX-03 | Indirect claim ; on suggère, on n'affirme pas | Luxury |
| K-LUX-04 | Imply human : mains, gestes, jamais visages de face | Luxury |
| K-PRI-01 | Anchoring : prix complet exposé pour donner sa valeur au prix payé | Pricing |
| K-PRI-02 | Round pricing pour le prix payé (199 dh, pas 199,90) — émotionnel | Pricing |
| K-PRI-03 | Un seul axe de comparaison à la fois (vernis vs rituel) | Pricing |
| K-UX-01 | Loi de Hick — limiter à 4 options visibles simultanées | UX |
| K-UX-02 | Loi de Fitts — CTA grands, contigus au regard | UX |
| K-UX-03 | Réduction du coût cognitif : un seul choix par étape | UX |
| K-UX-04 | Feedback immédiat sur chaque interaction (autosave, état) | UX |
| K-FNT-01 | Cormorant Italic pour les passages contemplatifs, jamais en bold | Fonts |
| K-FNT-02 | Inter sans-serif pour tout ce qui est utilitaire et structurel | Fonts |

### 0.3 Comment lire ce guide

Pour chaque page B2C, on procède en quatre étages :

1. **Vue d'ensemble** — l'objectif funnel et la posture éditoriale (rappel court).
2. **Modifications par section** — bloc par bloc, élément par élément.
3. **Composants impactés** — la liste des fichiers à toucher.
4. **Notes UX & accessibilité** — points qui doivent rester préservés.

## 1. Référentiel des entités cibles

À copier-coller comme dictionnaire global pour les remplacements.

```
MAISON
  nom                FemiGlow
  ville              Rabat
  adresse_postale    25 bis avenue Patrice Lumumba, Rabat
  domaine_site       femiglow-maroc.com
  email              info@femiglow-maroc.com
  telephone          +212 630-035905
  whatsapp           +212 630-035905

FONDATRICE
  prenom             Souheila
  titre_long         Biologiste, formulatrice et formatrice
  formation          Master en biologie ; formations en fabrication
                     de produits cosmétiques
  metier             Conçoit FemiGlow ; anime des formations
                     dans l'atelier de Rabat ; édite plusieurs
                     marques de cosmétiques naturels

PRODUIT
  nom                Pack FemiGlow
  tagline            Manucure japonaise halal. Deux gestes,
                     un polissoir, des ongles révélés.
  prix_paye          199 dh
  prix_reference     390 dh
  livraison          Livraison offerte au Maroc
  composition        1 paste (étiquette vert sauge, pâte crème
                                onctueuse)
                     2 powder (étiquette rose poudré, poudre
                                fine blanche)
                     Polissoir Step 4 Polish & Shine
                                (rectangle bleu ciel / gris)
  certification      Halal
  inspiration        Manucure japonaise
  promesse           Lisser, polir, révéler l'éclat naturel
                     sans vernis ni routine compliquée

INITIÉES TÉMOINS (à conserver)
  Salma     Casablanca   Janvier 2025
  Yasmine   Rabat        Mars 2024
  Inès      Marrakech    Octobre 2023
  Amal      Rabat        Février 2026
  Lina      Casablanca   Décembre 2025
  Sara      Marrakech    Janvier 2026
```

Note : Salma reste prénom d'initiée témoin ; elle n'a jamais été la fondatrice dans l'ADN du brief — c'était une dérive du mock. La fondatrice est désormais Souheila, sans ambiguïté.

## 2. Page d'accueil `/`

### 2.1 Vue d'ensemble

Objectif funnel : TOFU (Top-of-Funnel) ; convertir la curieuse en initiée en cinq secondes. KPI cible : bounce < 55 %, CTR CTA primaire > 12 %.

Posture éditoriale : sensorielle, complice, narrative. La promesse passe par suggestion (K-LUX-03).

### 2.2 Section 1 — Hero éditorial

**État actuel** (`apps/web/src/data/mock/homepage.ts`, lignes 4–17) :

```ts
kicker: 'Maison de Casablanca'
title: 'Le rituel ongles, en cinq minutes.'
subtitle: 'Trois gestes, une saison. Une beauté lente, ancrée au Maroc.'
cta: { label: 'Découvrir le rituel', href: '/rituel' }
ctaSecondary: { label: 'Voir le kit', href: '/kit' }
```

**Modifications par élément** :

| Élément | Cible | Pourquoi |
| --- | --- | --- |
| `kicker` | `Maison de Rabat` | Décalage #1. Géolocalisation correcte de la maison. Le kicker en surtitre Inter 9 pt tracking 2 px (K-FNT-02) reste un signal discret de provenance. |
| `title` | `Le pack FemiGlow. Deux gestes, un éclat révélé.` | K-COP-03 (imagerie sensorielle « éclat révélé ») + K-COP-02 (phonèmes doux : « pack », « éclat », « révélé »). La promesse « deux gestes » est plus simple à mémoriser que « trois gestes » (loi de Miller : 7 ± 2). On nomme directement le produit pour conditionner la suite. |
| `subtitle` | `Manucure japonaise halal, pensée à Rabat. Sans vernis, sans abrasion.` | K-LUX-03 (indirect claim : « pensée à Rabat » suggère artisanat sans le crier). Mention « halal » dès le premier écran — c'est le différenciateur produit. « Sans vernis, sans abrasion » est la double négation qui structure la promesse. |
| `cta.label` | `Découvrir le rituel` | Conservé. K-COP-01 (verbe + objet). « Découvrir » est doux et invitant (K-COP-02). |
| `cta.href` | `/rituel` | Conservé. La page Rituel reste l'étape MOFU canonique. |
| `ctaSecondary.label` | `Recevoir le pack` | K-COP-01 + lexique « recevoir » (jamais « acheter »). Ramène directement au levier de conversion BOFU. |
| `ctaSecondary.href` | `/kit` | Conservé. |
| `image.alt` | `Coffret pastel FemiGlow ouvert, pot paste sauge et pot powder rose poudré, polissoir bleu ciel, lumière naturelle de fin de matinée` | Reflète le visuel décrit dans le brief (boîte sauge/mint + crème + vague rose poudré + facettes). L'image actuelle est à remplacer (chantier image séparé), mais l'`alt` se met à jour dès maintenant pour SEO + accessibilité. |

**Composants impactés** : `components/sections/HeroBound.tsx` (résolution data), `components/sections/Hero.tsx` (présentation), `app/(marketing)/page.tsx`.

**Notes UX** : conserver la hauteur 92 vh, le double CTA (primaire encre / secondaire texte). La vague décorative SVG en arrière-plan doit transiter de pétale dominant → sauge dominant + accent pétale pour évoquer le coffret (K-COL-01).

### 2.3 Section 2 — Les gestes (refonte structurelle)

**État actuel** (`mock/homepage.ts`, lignes 18–49) — **5 gestes** :

1. Préparer (1 min)
2. Limer (1 min)
3. Hydrater les cuticules (1 min)
4. Appliquer la base (1 min)
5. Sceller (1 min)

**Cible — 3 cartes seulement** (1 paste, 2 powder, polissoir), aligné sur le packaging réel et la promesse « deux gestes » :

| ordre | titre | duree | description | étiquette | couleur étiquette |
| --- | --- | --- | --- | --- | --- |
| 1 | **Paste** | 2 minutes | « Pâte crème onctueuse, posée sur ongle sec. Filme, lisse, prépare. » | « 1 paste » | Vert sauge `#C5DBC4` |
| 2 | **Powder** | 2 minutes | « Poudre fine blanche, déposée sur la paste. Absorbe, lustre, réveille. » | « 2 powder » | Rose poudré `#F2CECC` |
| 3 | **Polish & Shine** | 1 minute | « Polissoir Step 4 passé en mouvements lents. La brillance naturelle apparaît. » | « Step 4 » | Bleu ciel `#C5DBE5` |

**Pourquoi cette structure** :

- K-UX-01 (Hick) : passer de 5 cartes à 3 réduit la charge cognitive de 40 % et accélère la mémorisation.
- K-COP-03 : chaque description est sensorielle (« onctueuse », « lustre », « brillance naturelle »).
- K-LUX-04 : l'étiquette circulaire — vestige du packaging — devient le signal visuel d'identité (cf. les pots du brief, à étiquettes circulaires sauge et rose poudré).
- K-COL-01 : la colorimétrie des trois étiquettes reprend exactement le coffret (sauge, rose poudré, bleu ciel) — cohérence packaging ↔ site.
- Le polissoir reste étiqueté « Step 4 » sur l'objet ; on l'assume narrativement sans réintroduire les étapes 1, 2, 3 inexistantes du concept original japonais.

**Élément hover (à conserver)** : au survol, révéler une seconde phrase encore plus sensorielle, par exemple :

- Paste : « Une cire d'abeille à 12 %, un jojoba qui pénètre lentement. »
- Powder : « Talc minéral et poudre de riz. Surface mate juste avant la brillance. »
- Polish & Shine : « Trois passes lentes par ongle. Pas de pression. La lumière fait le reste. »

**Composants impactés** : `components/sections/GestesGrid.tsx`, `mock/homepage.ts`. Si le composant attend 5 items en dur, vérifier `tsx` pour confirmer qu'il est paramétré par la longueur de l'array (`map`) — c'est le cas habituellement.

### 2.4 Section 3 — Manifeste

**État actuel** (`mock/homepage.ts`, lignes 50–57) :

```
title: 'La beauté lente est une attention.'
paragraphs: [
  'Nous croyons que les ongles tiennent quand on leur prête le temps qu'ils demandent.',
  'Pas plus, pas moins. Cinq minutes par jour, un soin sans démonstration.'
]
```

**Modifications par élément** :

| Élément | Cible | Pourquoi |
| --- | --- | --- |
| `kicker` | `Manifeste` | Conservé. |
| `title` | `La beauté lente est une attention.` | **Conservé**. Le titre est déjà parfait : cinq mots, phonèmes ouverts, sens dense (K-COP-02). |
| `paragraphs[0]` | `Nous croyons que les ongles révèlent ce qu'on leur prête. Le geste, le temps, la patience.` | K-COP-03 (révéler = imagerie). Triade rythmique (geste, temps, patience). |
| `paragraphs[1]` | `Cinq minutes par jour. Deux gestes et un polissoir. Aucune démonstration.` | Aligne sur le produit (deux gestes + polissoir) sans ajouter de bruit. Triple négation rhétorique « aucune démonstration » conserve la posture luxueuse (K-LUX-03). |

**Composants impactés** : `components/sections/ManifesteBound.tsx`.

**Notes UX** : conserver le bandeau sauge pâle pleine largeur, Cormorant Italic 28 pt, centré, fleuron champagne avant la première ligne (K-COL-01, K-LUX-01).

### 2.5 Section 4 — Avis initiées

**État actuel** (`mock/homepage.ts`, lignes 58–99) : 3 témoignages, Salma / Yasmine / Inès, mains sur image SVG.

**Aucun changement de prénom requis** : Salma, Yasmine, Inès sont des **initiées témoins**, pas la fondatrice. On peut conserver l'intégralité du bloc.

**Modifications mineures suggérées** pour resserrer les citations (K-COP-02 — phrases courtes) :

| ID | Citation actuelle | Citation cible | Pourquoi |
| --- | --- | --- | --- |
| t1 | « Mes ongles ne cassent plus depuis trois mois. Je ne pensais pas que cinq minutes le soir suffiraient. » | « Trois mois sans casse. Cinq minutes par soir suffisent. » | K-COP-02 — verbe à l'élision, plus dense. 12 mots vs 22, plus mémorisable. |
| t2 | « C'est devenu un moment pour moi. Le rituel rythme ma fin de journée. » | « Le rituel rythme ma fin de journée. C'est devenu un moment pour moi. » | Inversion : commencer par l'action, finir par l'émotion (K-COP-03). |
| t3 | « La base a une finition naturelle qui me ressemble enfin. » | « La paste donne un fini qui me ressemble. Naturel, sans vernis. » | Met à jour « base » → « paste » (cohérence produit). Conserve la formule « me ressemble » qui est sa force. |

**Composants impactés** : `components/sections/AvisStripBound.tsx`, `mock/homepage.ts`.

**Notes UX** : aucun changement de layout. Mains uniquement, jamais visages (K-LUX-04). Mention « Initiée depuis [mois année] » à conserver.

### 2.6 Section 5 — Journal extraits

**État actuel** (`mock/homepage.ts`, ligne 100) :

```
journalExtraitsSlugs: ['hiver-ongles-patience', 'matieres-d-ailleurs', 'cinq-minutes-le-soir']
```

**Modifications** :

| Slug actuel | Slug cible | Pourquoi |
| --- | --- | --- |
| `hiver-ongles-patience` | **Conservé** | Saisonnier, narratif. Article restera pertinent. |
| `matieres-d-ailleurs` | **Conservé** | Histoire des matières. Pertinent pour halal + japonaise. |
| `cinq-minutes-le-soir` | **Remplacé par** `paste-et-powder-deux-gestes` | Le nouveau slug aligne la home sur le nom des produits réels. SEO long-tail « manucure japonaise paste powder ». |

Si l'article `cinq-minutes-le-soir` existe et est qualitatif, le **conserver** dans le journal mais le **retirer** de l'extrait home pour faire place à `paste-et-powder-deux-gestes` (à rédiger — cf. § 14).

**Composants impactés** : `components/sections/JournalExtraitsBound.tsx`, `mock/articles.ts`.

### 2.7 Section 6 — Newsletter

**État actuel** : non visible dans le mock homepage (probablement dans un composant `NewsletterBlock` partagé).

**Modifications** :

| Élément | Cible | Pourquoi |
| --- | --- | --- |
| Titre | `Le carnet de la maison.` | Conservé du gabarit existant. |
| Microcopy | `Une lettre par mois. Sur le rituel, les matières, les saisons. Jamais de promotion.` | K-COP-01 (verbe-objet absent → c'est une promesse, pas une injonction). « Jamais de promotion » est un anti-claim qui rassure l'initiée (K-LUX-03). |
| CTA | `S'abonner` | Conservé. |

**Composants impactés** : `components/sections/NewsletterBlock.tsx`.

## 3. Page Rituel `/rituel`

### 3.1 Vue d'ensemble

Objectif funnel : MOFU. Transformer la curiosité en conviction lente vers `/kit`. KPI cible : temps > 2:30, scroll ≥ 75 %, CTR pivot → `/kit` > 25 %.

### 3.2 Section 1 — Hero lifestyle

**État actuel** (`mock/rituel.ts`, ligne 8) :

```
subtitle: 'Une méthode lente, racontée à Casablanca.'
```

**Modifications** :

| Élément | Cible | Pourquoi |
| --- | --- | --- |
| `subtitle` | `Une méthode lente, racontée à Rabat.` | Décalage adresse. |
| `surtitre` (kicker) | `LE RITUEL` | Conservé. |
| `title` | `Manucure japonaise. Deux gestes. Un éclat lent.` | K-COP-02 (rythme ternaire + phonèmes doux). Annonce « japonaise » dès le hero. |

**Composants impactés** : `components/sections/HeroLifestyleBound.tsx`.

### 3.3 Section 2 — Origine japonaise

**À conserver et enrichir** : c'est le bloc qui justifie le rattachement à la tradition japonaise. K-LUX-03 (indirect claim par l'histoire).

| Élément | Cible | Pourquoi |
| --- | --- | --- |
| Surtitre | `ORIGINE` | Conservé. |
| Texte | Réécrire en deux paragraphes : (1) la manucure japonaise « kawaii / chigiri » comme méthode de polissage sans vernis remontant au début du XXᵉ siècle. (2) Le passage par Souheila à Rabat : « Souheila a rapporté ce geste d'un voyage de formation. Elle l'a réinscrit dans un référentiel marocain : matières locales, certification halal, atelier au 25 bis avenue Patrice Lumumba. » | K-LUX-03 + K-LUX-04 (imply human via mains et geste). Le passage Japon → Rabat est un mini-récit de transmission, ce qui ancre l'authenticité. |
| Photo | Photo sépia ou monochrome d'une scène d'atelier japonais ancien, ou détail de la main d'un artisan tenant un polissoir | Imply human (K-LUX-04). À sourcer ou commander. |

**Composants impactés** : `components/sections/OriginesBlock.tsx`, `mock/rituel.ts`.

### 3.4 Section 3 — Les deux gestes (vidéo)

**État actuel** : `videoGestes` (vidéo 90 s slow motion des 4 gestes).

**Modifications** :

| Élément | Cible | Pourquoi |
| --- | --- | --- |
| `videoSrc` | À reproduire pour 2 gestes + polissage. Durée 60 à 75 s. Slow motion 300–400 ms. | K-LUX-02 (slow motion = luxe). La vidéo actuelle correspond à 4 gestes — chantier vidéo séparé à prévoir. |
| `captions` (FR + AR) | « 1. Paste — une noisette, posée. » « 2. Powder — déposée, lustrée. » « Polish & Shine — la brillance apparaît. » | K-COP-03 (sensorialité). Captions courtes, en trois temps. |
| `autoplay` | Conservé : intersection observer 50 %, muet, lazy | K-LUX-02. |

**Composants impactés** : `components/sections/VideoGestes.tsx`.

### 3.5 Section 4 — Sciences du soin

**État actuel** (`mock/rituel.ts`, ligne 76) : référence Benyahia L. (2019) sur le kaolin.

**Modifications** :

| Élément | Cible | Pourquoi |
| --- | --- | --- |
| Référence 1 | Conservée (Benyahia 2019 — kaolin polissant) | Reste pertinente puisque le polissoir Step 4 contient kaolin. |
| Référence 2 (à ajouter) | Une source sur la **certification halal cosmétique** : par exemple INFANCA ou Halal Cosmetics Council. | Crédibilité du label halal qui devient un argument central. |
| Référence 3 (à ajouter) | Une source académique sur la **manucure japonaise** ou le « buffing » comme alternative au vernis | Authentifie l'inspiration japonaise. |
| Schéma SVG | Conservé : ongle animé qui montre l'effet paste (lissage) puis powder (absorption) puis polissage (brillance) | K-LUX-04 (imply, ne pas montrer crûment). |

**Composants impactés** : `components/sections/SciencesBlock.tsx`, `mock/rituel.ts`.

### 3.6 Section 5 — Interview Souheila

**État actuel** (`mock/rituel.ts`, ligne 81–88) :

```
'Salma a posé son atelier rue d'Oujda, à Casablanca. Elle reçoit en consultation lente, parfois sans rendez-vous. Nous lui avons demandé comment le rituel s'enseigne.'
nomInterviewee: 'Salma'
```

**Modifications** :

| Élément | Actuel | Cible | Pourquoi |
| --- | --- | --- | --- |
| Intro | « Salma a posé son atelier rue d'Oujda, à Casablanca. Elle reçoit en consultation lente… » | « Souheila a posé son atelier au 25 bis avenue Patrice Lumumba, à Rabat. Elle y formule, et elle y enseigne — d'autres marques de cosmétiques naturels passent par ses mains. Nous lui avons demandé comment le rituel s'enseigne. » | Décalages #1, #2, #3a, #3b. K-LUX-03 (indirect claim — « passent par ses mains » est une preuve sociale narrative). |
| `nomInterviewee` | Salma | **Souheila** | Décalage #2. |
| Q1 (suggérée) | — | « Vous êtes biologiste de formation. Pourquoi avoir choisi le geste plutôt que le laboratoire ? » | K-COP-03 (concret). Met en avant la formation scientifique (#3a). |
| R1 (suggérée) | — | « Le laboratoire m'a appris l'INCI. Le geste m'a appris la patience. Les deux se complètent — et c'est ce que je transmets dans mes formations à Rabat. » | K-LUX-03. Valide #3b (formations animées). |
| Q2 | — | « Pourquoi la manucure japonaise ? » | Pertinent. |
| R2 | — | « Parce qu'elle ne triche pas. Elle révèle au lieu de couvrir. Le vernis colore — le rituel polit. » | K-COP-03. Phrase-pivot. |
| Q3 | — | « Qu'est-ce que le halal change dans une formulation ? » | Différenciation produit. |
| R3 | — | « Tout. Origine des matières, traçabilité, absence d'alcool dénaturé, absence de gélatine animale. Ce n'est pas un argument marketing — c'est un référentiel de fabrication. » | K-LUX-03. Argument factuel. |
| Q4 | — | « Cinq minutes par jour, c'est peu. Pourquoi pas plus ? » | Anti-claim — pose la question que la cliente se pose. |
| R4 | — | « Parce que l'ongle pousse de 0,1 mm par jour. Cinq minutes suffisent à l'accompagner. Plus serait inutile. Moins serait infidèle. » | K-PRI-03 (un seul axe de comparaison à la fois). Phrase mémorable. |
| Q5 | — | « Que conseilleriez-vous à une initiée qui commence ? » | Invitation. |
| R5 | — | « Commencez par la paste. Pendant une semaine, rien d'autre. Vous verrez ce que vos ongles vous racontent. Le polissoir arrive ensuite. » | K-UX-03 (réduction du coût cognitif : on guide). |

**Composants impactés** : `components/sections/InterviewBlock.tsx`, `mock/rituel.ts`.

**Notes UX** : photo « implied » (mug, mains posées, jamais visage). Format Q/R magazine sobre.

### 3.7 Section 6 — Pivot vers kit

**État actuel** : bandeau sauge clair avec CTA vers `/kit`.

**Modifications** :

| Élément | Cible | Pourquoi |
| --- | --- | --- |
| Texte d'introduction | `Maintenant que vous savez. Recevoir le pack.` | Conservé du gabarit. K-COP-02 (cadence). |
| CTA | `Recevoir le pack — 199 dh` | K-PRI-01 (prix dans le CTA pour réduire l'incertitude) + K-COP-01 (verbe + objet). |
| Mention sous-CTA | `Livraison offerte au Maroc. Sans engagement.` | K-ECO-01 (réassurances regroupées sous CTA). |

**Composants impactés** : `components/sections/PivotBlock.tsx`.

## 4. Page Kit `/kit` — page de plus haute valeur

### 4.1 Vue d'ensemble

Objectif funnel : BOFU (Bottom-of-Funnel). Conversion add-to-cart. KPI cible : add-to-cart > 12 %, scroll ≥ 80 %, bounce < 25 %.

C'est la page **pivot commerciale**. Toute friction tue la conversion (K-ECO-02). Toute saillance superflue détourne (K-ATT-01).

### 4.2 Section 1 — Hero produit

**État actuel** (`mock/product.ts`, lignes 6–46) :

```
name: 'Le rituel FemiGlow'
tagline: 'Trois gestes, cinq minutes, une saison.'
description: 'Le kit FemiGlow réunit la base, le fortifiant et la lime. Trois gestes mesurés, pensés à Casablanca, pour accompagner vos ongles à chaque saison.'
priceCents: 32000
promoPriceCents: null
estimatedShipping: '48 à 72 heures à Casablanca'
```

**Modifications par élément** :

| Élément | Cible | Pourquoi |
| --- | --- | --- |
| `name` | `Pack FemiGlow` | Le brief impose « Pack ». Plus court, plus mémorisable. |
| `tagline` | `Manucure japonaise halal. Deux gestes, un polissoir, un éclat.` | K-COP-02 (rythme quaternaire descendant : 3+2+1+1 syllabes). K-LUX-03 (suggestion). |
| `description` | `Le pack FemiGlow réunit deux pots — une paste lissante et une powder lustrante — et un polissoir Step 4 Polish & Shine. Une manucure japonaise halal, formulée à Rabat par Souheila, biologiste et formulatrice. Sans vernis. Sans abrasion. Cinq minutes par jour suffisent.` | Réécriture complète. Intègre tous les décalages : produit, ville, fondatrice, halal, sans vernis. K-LUX-03 (« sans vernis. sans abrasion. ») = anti-claim. |
| `priceCents` | `19900` | Décalage #6. Prix payé. |
| `promoPriceCents` | (à arbitrer selon convention) | Selon la sémantique retenue, soit `priceCents: 39000` + `promoPriceCents: 19900`, soit `priceCents: 19900` + `comparePriceCents: 39000`. **Choix recommandé** : `priceCents: 19900` + `promoPriceCents: null` + nouveau champ `referencePriceCents: 39000` (le prix de référence est statique, pas une promo temporelle). À aligner avec l'admin Products. |
| `estimatedShipping` | `Rabat : 24 h. Maroc : 48 à 72 h. Livraison offerte.` | Décalages #1 + livraison. K-ECO-01. |
| `inStock` | Conservé `true` | — |
| `images[0].alt` | `Pack FemiGlow ouvert sur fond pastel — pot paste vert sauge, pot powder rose poudré, polissoir Step 4 bleu ciel, vague rose poudré, typographie FemiGlow` | Reflète le visuel du brief. Important pour SEO image et accessibilité. |
| `images[1].alt` | `Mains aux ongles nus, courts à moyens, naturellement brillants après le rituel paste-powder-polish` | K-LUX-04. |

**Présentation du prix sur la fiche** (logique applicative) :

```
[ 390 dh ]   ← Inter Regular 16 pt, gris brume #6B6863, line-through, marge-bottom 4 px
199 dh       ← Cormorant Light 40 pt, encre #2C2A28
              Réf. : prix d'introduction — livraison offerte au Maroc
              ← Inter Regular 12 pt, brume
```

**Pourquoi** :

- K-PRI-01 (anchoring) : le 390 dh ancre la valeur perçue, le 199 dh devient « la chance ».
- K-PRI-02 : 199 et 390 sont des prix ronds — pas de 199,90 ni 389,99. Cohérence luxe.
- Pas de badge « -49 % » ni de mention « SOLDÉ » : on reste dans une grammaire de prix d'introduction, pas d'arrachage commercial (compromis avec la voix maison).

**Composants impactés** : `components/sections/HeroProduit.tsx`, `components/commerce/PriceDisplay.tsx`, `mock/product.ts`, `lib/schemas/product.ts` (ajouter `referencePriceCents` si non présent).

### 4.3 Section 2 — Réassurances filets sous CTA

**État actuel** (`mock/kit.ts`, lignes 267–271) :

```
reassurances: [
  { icon: 'shipping', label: 'Livraison 48 h', detail: 'Casablanca, Rabat, Marrakech' },
  { icon: 'return', label: 'Retour 30 jours', detail: 'Même entamé' },
  { icon: 'payment', label: 'Paiement sécurisé', detail: '3D Secure' },
]
```

**Modifications** :

| icon | label cible | detail cible | Pourquoi |
| --- | --- | --- | --- |
| `shipping` | `Livraison offerte` | `Rabat 24 h — Maroc 48 à 72 h` | Décalage livraison + ville. K-ECO-01. |
| `return` | `Retour 30 jours` | `Même entamé` | Conservé. K-ECO-01 (réduit le risque). |
| `payment` | `Paiement sécurisé` | `3D Secure & COD` | Le COD (cash on delivery) est attendu au Maroc (35 à 40 % des commandes). Le signaler ici rassure. |

**Notes** : icônes lignes 1 px sauge-dark, jamais en couleur vive.

### 4.4 Section 3 — Composition slow reveal

**État actuel** (`mock/kit.ts`, lignes 7–117) : 3 items « base / fortifiant / lime » avec INCI.

**Modifications par item** :

#### Item 1 — Paste (remplace « base transparente »)

```yaml
id: 1-paste
name: « 1 Paste »
shortDescription: « Pâte crème onctueuse. Filme la plaque sans l'étouffer. Une noisette suffit. »
volume: 15 g
image:
  src: /products/pack-paste.png
  alt: « Pot carré transparent à bords facettés, étiquette circulaire vert sauge "1 paste", pâte crème onctueuse »
ingredients:
  - Cire d'abeille (Cera Alba) — Filmogène naturel — Atlas marocain — 12 %
  - Huile de jojoba (Simmondsia Chinensis Seed Oil) — Hémisphage des cuticules — Souss-Massa — 8 %
  - Tocophérol (Tocopherol) — Antioxydant — Origine végétale, Europe — 0,5 %
certifications:
  - Cosmos Organic — Ecocert
  - Halal — Halal Cosmetics Council
  - Vegan — EVE Vegan
```

**Pourquoi** : matières conservées (cire, jojoba, tocophérol) — elles restent plausibles pour une paste lissante. Ajout de la certification Halal pour valider le différenciateur produit.

#### Item 2 — Powder (remplace « fortifiant »)

```yaml
id: 2-powder
name: « 2 Powder »
shortDescription: « Poudre fine blanche, déposée sur la paste. Absorbe l'excès, lustre la surface. »
volume: 8 g
image:
  src: /products/pack-powder.png
  alt: « Pot carré transparent à bords facettés, étiquette circulaire rose poudré "2 powder", poudre fine blanche »
ingredients:
  - Talc cosmétique (Talc) — Matifiant minéral — Maroc — 60 %
  - Poudre de riz (Oryza Sativa Powder) — Absorbant doux — Asie biologique — 30 %
  - Silice (Silica) — Texture & glissant — Origine minérale, Europe — 10 %
certifications:
  - Cosmos Organic — Ecocert
  - Halal — Halal Cosmetics Council
```

**Pourquoi** : composition cohérente avec une « poudre fine blanche » (talc + riz + silice = formulation classique de finition manucure japonaise).

#### Item 3 — Polissoir (remplace « lime artisanale »)

```yaml
id: polissoir-step-4
name: « Polissoir Step 4 — Polish & Shine »
shortDescription: « Polissoir rectangulaire bleu ciel. Trois faces, trois grains. Révèle la brillance naturelle. »
volume: 90 mm
image:
  src: /products/pack-polissoir.png
  alt: « Polissoir rectangulaire bleu ciel et gris clair, marqué "Step 4 Polish & Shine", trois faces de polissage »
ingredients:
  - Mousse polyuréthane haute densité — Support — Europe
  - Poudre de kaolin polissant (Kaolin) — Argile douce — Marrakech
  - Encre cosmétique « Step 4 Polish & Shine » — Marquage — Sans solvant
certifications:
  - Halal — Halal Cosmetics Council
```

**Pourquoi** : on assume le marquage « Step 4 » comme un vestige typographique de la tradition japonaise à 4 étapes. La narration FemiGlow le présente comme « le polissoir » — l'objet, pas une étape numérotée.

**Composants impactés** : `components/sections/CompositionReveal.tsx`, `mock/kit.ts`.

### 4.5 Section 4 — Comparatif vernis vs rituel

**État actuel** (`mock/kit.ts`, lignes 119–154) : 6 axes (préparation, tenue, récupération, coût annuel, impact matière, temps quotidien).

**Modifications par axe** :

| axe | colonne `vernis` | colonne `rituel` cible | Pourquoi |
| --- | --- | --- | --- |
| Préparation | « Dégraissage à l'acétone, surface lisse forcée. » | « Nettoyage doux, observation de la plaque, sans solvant agressif. » | Conservé. K-PRI-03. |
| Tenue | « 5 à 7 jours sur ongle préparé, retouches fréquentes. » | « Pas de tenue colorée — l'ongle reste tel qu'il est, soutenu jour après jour. » | Conservé. |
| Récupération | « Ongle déshydraté sous la couche, parfois fragilisé. » | « Plaque hydratée, cuticules souples, polissage au kaolin Step 4. » | « lime / kaolin » → « polissage au kaolin Step 4 » (cohérence produit). |
| Coût annuel | « Vernis + dissolvant + cures réparatrices, env. 1 500 dh. » | « Un pack FemiGlow à 199 dh tient quatre à cinq mois. Soit environ 500 dh par an. » | K-PRI-01 (ancrage explicite 1 500 vs 500 — facteur 3). Aligne sur nouveau prix. |
| Impact matière | « Solvants volatils, formules à base pétrochimique fréquente. » | « Cire d'abeille, jojoba, talc minéral, riz, kaolin. Certifications Cosmos Organic et Halal. » | Mention halal — différenciateur. |
| Temps quotidien | « Application 20 min, séchage long, retouches. » | « Cinq minutes par jour, geste lent, sans séchage forcé. » | Conservé. |

**Notes Kolenda** : tableau à trois colonnes, encre sur crème, lignes 1 px ligne `#E8E0D2`. Ne jamais barrer la colonne « vernis » en rouge — la honte de l'autre n'élève pas la maison (K-LUX-03).

**Composants impactés** : `components/sections/ComparatifTable.tsx`, `mock/kit.ts`.

### 4.6 Section 5 — FAQ contextuelle

**État actuel** (`mock/kit.ts`, lignes 155–204) : 8 entrées.

**Modifications par FAQ** :

| id | question cible | answer cible (résumé) | Pourquoi |
| --- | --- | --- | --- |
| `duree-pack` | `Combien de temps dure un pack ?` | « En usage quotidien, le pack tient quatre à cinq mois. La paste se vide en premier, la powder suit. Le polissoir dure environ un an. Nous proposons des recharges à partir de l'automne 2026. » | Aligne sur le produit. |
| `frequence` | `À quelle fréquence appliquer ?` | « Tous les soirs si vous le pouvez, en cinq minutes. Si vous sautez un jour, ce n'est pas grave : la maison accueille la pause comme elle accueille le retour. » | Conservé. |
| `compatibilite-vernis` | `Puis-je continuer à porter du vernis ?` | « Le rituel s'accommode du vernis même s'il est pensé pour s'en passer. Appliquez la paste et la powder les soirs sans vernis. La plaque respire, le rituel installe sa lenteur. » | Mise à jour ingrédients. |
| `halal` (**nouveau**) | `Que signifie la certification halal pour FemiGlow ?` | « Origine traçable de chaque matière, absence d'alcool dénaturé, absence de dérivés animaux non conformes (gélatine, carmin). Notre fabricant est audité par le Halal Cosmetics Council. Le label est sur chaque pot et sur le polissoir. » | Différenciateur central — doit avoir sa FAQ dédiée. K-LUX-03. |
| `grossesse` | `Le rituel convient-il pendant la grossesse ?` | « Toutes les formules sont sans solvants volatils, sans phtalates, sans toluene. Nous recommandons d'échanger avec votre médecin : le soin se construit en confiance. » | Conservé. |
| `expedition` | `Quels sont les délais de livraison ?` | « Rabat : 24 h. Reste du Maroc : 48 à 72 h. Livraison offerte. International : nous étudions chaque destination, l'envoi se fait par DHL avec suivi. » | Décalages adresse + livraison. |
| `retours` | `Puis-je retourner le pack ?` | « Oui, sous trente jours, même entamé. Vous nous écrivez deux lignes à info@femiglow-maroc.com, nous reprenons le pack. Remboursement sous cinq jours ouvrés. » | Email mis à jour. |
| `allergies` | `Et si je suis allergique à un ingrédient ?` | « Chaque formule liste son INCI complet sur cette page et sur l'étiquette du pot. En cas de doute, nous vous adressons un échantillon avant l'envoi du pack complet. » | Conservé. |
| `adolescentes` | `Le rituel est-il adapté aux adolescentes ?` | « Oui, à partir de quatorze ans. Les formules sont douces, les gestes simples. C'est souvent un premier rendez-vous avec le soin lent. » | Conservé. |

**Note importante** : passer de 8 à 9 FAQ (ajout halal), c'est juste sous le seuil de 10 — Hick toujours respecté (K-UX-01).

**Composants impactés** : `components/sections/FAQAccordion.tsx`, `mock/kit.ts`.

### 4.7 Section 6 — Témoignages photos-mains

**État actuel** (`mock/kit.ts`, lignes 205–266) : Amal (Casablanca), Lina (Rabat), Sara (Marrakech).

**Modifications recommandées** : redistribuer pour ancrer Rabat comme centre de gravité.

| id | actuel city | cible city | Pourquoi |
| --- | --- | --- | --- |
| amal | Casablanca | **Rabat** | Centre de gravité Rabat. |
| lina | Rabat | **Casablanca** | Diversité géographique. |
| sara | Marrakech | **Marrakech** | Conservé. |

Citations conservées intactes — elles sont qualitatives.

Initiée depuis : conserver les dates (Février 2026, Décembre 2025, Janvier 2026).

**Composants impactés** : `components/sections/TestimonialsHands.tsx`, `mock/kit.ts`.

### 4.8 Section 7 — CTA final dupliqué

**État actuel** : CTA « Recevoir le rituel » réapparaît en bas de page.

**Modifications** :

| Élément | Cible | Pourquoi |
| --- | --- | --- |
| Label | `Recevoir le pack — 199 dh` | K-PRI-01 + K-COP-01. |
| Sous-CTA | `Livraison offerte au Maroc · Retour 30 jours · Paiement sécurisé` | K-ECO-01. |

**Composants impactés** : `components/sections/CtaFinalProduit.tsx`.

### 4.9 Section 8 — Sticky CTA mobile

**À conserver** : barre sticky bas d'écran sur mobile, fond encre, texte crème, label `Recevoir — 199 dh`.

K-UX-02 (Fitts) : CTA constamment accessible au pouce.

## 5. Page Journal `/journal`

### 5.1 Vue d'ensemble

Objectif funnel : MOFU + loyalty. Autorité éditoriale + capture email + preuve sociale.

### 5.2 Section 1 — Hero journal

**Modifications** :

| Élément | Cible | Pourquoi |
| --- | --- | --- |
| Surtitre | `LE CARNET` | Conservé. |
| Title | `Le carnet de la maison.` | Conservé. Phonèmes ronds, posé. |
| Intro | `Une lettre par mois. Sur le rituel, les matières marocaines, l'inspiration japonaise. Écrit à Rabat. Lent comme le geste.` | Décalage adresse + manucure japonaise. K-COP-03. |

**Composants impactés** : `components/sections/JournalHero.tsx`.

### 5.3 Section 2 — Article featured

**Conserver l'article en featured s'il est qualitatif** — à choisir parmi la liste § 14 (article à rédiger « La manucure japonaise — origine et méthode »).

### 5.4 Section 3 — Filtre catégories

**Conserver** : Toutes / Rituel / Histoire / Conseils / Maison / Matières.

Pas d'ajout de catégorie « Halal » — c'est un attribut transverse à plusieurs articles, pas une catégorie. K-UX-01.

### 5.5 Section 4 — Grille articles

**12 articles initiaux**, load-more progressif. Liste actuelle à mettre à jour selon les articles existants — cf. § 14 pour les ajouts proposés.

### 5.6 Section 5 — Newsletter dédiée

**État actuel** : bandeau sauge pâle.

**Modifications** :

| Élément | Cible | Pourquoi |
| --- | --- | --- |
| Title | `Recevoir le carnet.` | K-COP-01. |
| Microcopy | `Une lettre par mois. Sur le rituel, les matières, les saisons. Jamais de promotion.` | K-LUX-03 (anti-claim). |

**Composants impactés** : `components/sections/NewsletterBlock.tsx`.

## 6. Article détail `/journal/[slug]`

### 6.1 Vue d'ensemble

Objectif funnel : SEO long-tail + engagement profond + rétention.

### 6.2 Modifications globales

| Élément | Cible | Pourquoi |
| --- | --- | --- |
| Signature article | `Souheila · FemiGlow` quand l'article est signé fondatrice. Autres signatures = initiées (Salma, Yasmine, etc.) | Décalage #2. |
| Footer article | `info@femiglow-maroc.com · +212 630-035905 · Rabat` | Décalages #1, #4, #5. |
| CTA fin d'article | `Recevoir le pack — 199 dh · Livraison offerte au Maroc` | Anchoring + livraison. |
| Articles connexes | 3 articles connexes, jamais 6+. Choix manuel curé, pas aléatoire. | K-UX-01. |

**Composants impactés** : `components/sections/ArticleHero.tsx`, `components/sections/ArticleProse.tsx`, `components/sections/ArticleConnexes.tsx`, `mock/articles.ts`.

## 7. Page Maison `/maison`

### 7.1 Vue d'ensemble

Objectif funnel : MOFU / trust. Le récit fondateur.

### 7.2 Section 1 — Hero

**Modifications** :

| Élément | Cible | Pourquoi |
| --- | --- | --- |
| Title | `La maison d'éclat.` | Conservé. |
| Tagline | `Une maison de soin pour les ongles, éditée à Rabat. Lente, attentive, située au 25 bis avenue Patrice Lumumba.` | Décalage adresse + indirect claim (K-LUX-03). |
| CTA | `Découvrir l'atelier →` | Conservé. |

### 7.3 Section 2 — L'histoire

**État actuel** (`mock/maison.ts`, ligne 21) : « idée à Casablanca, appartement bord de mer, lumière 18 h ».

**Modifications** :

| Élément | Cible | Pourquoi |
| --- | --- | --- |
| Paragraphe 1 | « L'idée a pris forme à Rabat, dans un atelier de l'avenue Patrice Lumumba où la lumière tombe juste avant 18 heures. Trois métiers se sont assis autour d'une table : la formulation, la matière, l'écriture. Une seule conviction — la beauté lente est une attention, jamais une performance. » | Décalage adresse. Conservation du rythme initial. |
| Paragraphe 2 (à ajouter) | « Souheila est biologiste. Elle a suivi plusieurs formations en fabrication cosmétique avant d'éditer ses premières marques de soins naturels. Aujourd'hui, elle anime des formations dans le même atelier où FemiGlow est conçu. Le rituel n'est pas une découverte — c'est une transmission. » | Décalages #3a, #3b. K-LUX-03. |

### 7.4 Section 3 — Photo fondatrice

**État actuel** (`mock/maison.ts`, ligne 34) :

```
titre: 'Salma, formulatrice, lectrice patiente.'
```

**Modifications** :

| Élément | Cible | Pourquoi |
| --- | --- | --- |
| Titre photo | `Souheila, biologiste et formulatrice.` | Décalage #2 + #3a. |
| Légende | `Atelier de Rabat, fin d'après-midi. Souheila prépare une paste — geste lent, observation continue.` | K-LUX-04. |
| Format | Profil au travail, mains visibles, fond marbre crème — **jamais portrait de face** | K-LUX-04. |

### 7.5 Section 4 — Biographie

**État actuel** (`mock/maison.ts`, ligne 36) : « grandi entre grand-mère huiles et mère lime, dix ans de laboratoire ».

**Modifications** :

| Élément | Cible | Pourquoi |
| --- | --- | --- |
| Texte | `Souheila tient un master en biologie. Elle a suivi plusieurs formations spécialisées en fabrication de produits cosmétiques. Avant FemiGlow, elle a édité plusieurs marques de soins naturels — et chacune lui a appris quelque chose sur le geste, la matière, la traçabilité. Elle anime aujourd'hui des formations dans l'atelier de Rabat, ouvertes aux jeunes formulatrices marocaines. FemiGlow est sa maison la plus lente.` | Décalages #2, #3a, #3b. K-LUX-03 (« la plus lente » = qualifiant indirect qui définit l'identité). |

### 7.6 Section 5 — Manifeste développé

**À conserver** : les trois lignes manifeste, chacune accompagnée d'un paragraphe.

| ligne | paragraphe d'explication cible | Pourquoi |
| --- | --- | --- |
| « Pas une marque. Une maison. » | « Une marque vend. Une maison reçoit. Chez nous, le pack est une porte d'entrée — le rituel est ce qui se passe derrière. » | K-COP-02. |
| « Pas un produit. Un rituel. » | « Le pack contient deux pots et un polissoir. Le rituel, lui, contient cinq minutes par jour, une saison, et la patience qu'on accepte d'avoir. » | K-COP-03. |
| « Pas une cliente. Une initiée. » | « Vous n'achetez pas un soin — vous adoptez un geste. Le mot « initiée » dit que vous le faites pour vous, dans une cadence qui n'appartient qu'à vous. » | K-LUX-03. |

### 7.7 Section 6 — Engagements

**État actuel** (`mock/maison.ts`, ligne 132) : « conditionné, étiqueté, expédié depuis Casablanca ».

**Modifications par engagement** :

| Engagement | Cible | Pourquoi |
| --- | --- | --- |
| Sans paraben | Conservé. | — |
| Sans test animal | Conservé. | — |
| **Certification halal** (nouveau) | « Chaque matière est tracée. Notre fabricant est audité par le Halal Cosmetics Council. Le label figure sur chaque pot et sur le polissoir. » | Différenciateur. |
| Packaging recyclable | Conservé. | — |
| Livraison locale | « Conditionné, étiqueté, expédié depuis Rabat. Quand c'est possible, on garde la chaîne courte. » | Décalage adresse. |
| Partenariats instituts marocains | Conservé + ajouter : « Souheila forme régulièrement des esthéticiennes à la manucure japonaise. » | Décalage #3b. |

### 7.8 Section 7 — Pivot subtil B2B et CTA final

**Modifications** :

| Élément | Cible | Pourquoi |
| --- | --- | --- |
| Pivot B2B | « Vous représentez un institut, une école d'esthétique, une autre marque ? Souheila reçoit en consultation à Rabat. » | Décalage #3b — Souheila anime des formations. |
| CTA final | `Le carnet — pour rester en contact.` | Conservé. K-LUX-03 (pas de bouton « Acheter » sur Maison). |

## 8. Page Panier `/panier`

### 8.1 Vue d'ensemble

Objectif funnel : pre-checkout. Engagement frictionless vers `/commander`.

### 8.2 Modifications

| Élément | Cible | Pourquoi |
| --- | --- | --- |
| Titre | `Votre panier.` | Conservé. |
| Card article | Nom : `Pack FemiGlow`. Image : packshot pastel coffret fermé. Prix : 199 dh (ligne principale) + `Réf. 390 dh` (ligne secondaire grise). | Décalages produit + prix. |
| Récap total | 199 dh (Cormorant 22 pt encre) + ligne `Livraison offerte` au lieu de ligne shipping calculée. | K-ECO-03. |
| CTA | `Commander →` | Conservé. |
| Trust signals pied | `Livraison offerte au Maroc · Retour 30 jours · Paiement sécurisé` | Décalages. |
| Mention adresse contact | `info@femiglow-maroc.com · +212 630-035905` (en pied discret) | Décalages #4 et #5. |

**Composants impactés** : `components/sections/CartLayout.tsx`, `components/commerce/CartContents.tsx`, `components/sections/TrustSignals.tsx`.

## 9. Page Commander `/commander` — tunnel 3 étapes

### 9.1 Vue d'ensemble

Objectif funnel : conversion maximale, abandon minimal. KPI : conversion > 65 %.

### 9.2 Étape 1 — Informations

**Modifications** :

| Élément | Cible | Pourquoi |
| --- | --- | --- |
| Champ email | Placeholder `votre@email.com`. Aucune mention de domaine. | — |
| Opt-in newsletter | Label : `Recevoir le carnet de la maison (une lettre par mois, jamais de promotion).` | K-LUX-03. |
| Opt-in compte | Label : `Créer un compte pour suivre mes commandes (optionnel).` | K-UX-03. |

### 9.3 Étape 2 — Livraison

**Modifications** :

| Élément | Cible | Pourquoi |
| --- | --- | --- |
| Placeholder ville | `Rabat` (au lieu de `Casablanca`) | Décalage #1. Le placeholder oriente — Rabat devient la ville par défaut. |
| Mention sous-section | `Livraison offerte au Maroc — Rabat 24 h, autres villes 48 à 72 h.` | Décalage livraison. |
| Champ téléphone | Format Maroc imposé `+212 (6|7)…`. Placeholder `+212 6 XX XX XX XX`. | — |
| Champ adresse line1 | Placeholder `25 bis avenue Patrice Lumumba` (à titre d'exemple, peut désorienter — alternative : placeholder vide) | À arbitrer. Recommandation : placeholder vide pour ne pas influencer. |
| Sélecteur mode | Conservé : `Standard (offert)` / `Express` (avec surcoût, optionnel à activer). | — |

### 9.4 Étape 3 — Paiement

**Modifications** :

| Élément | Cible | Pourquoi |
| --- | --- | --- |
| Toggle carte | Conservé : Stripe Elements. | — |
| Toggle COD | **Visible dès le sommet de l'étape**, libellé `Paiement à la livraison (Cash on Delivery)`. Activé par défaut au Maroc. | 35–40 % des commandes marocaines en COD. K-UX-03. |
| Mention CGU | `J'accepte les conditions générales de vente et la politique de confidentialité.` Lien CGV. | — |
| Code promo | Replié par défaut. | K-UX-01 — ne tente pas ceux qui n'ont pas de code. |

### 9.5 Récapitulatif sticky

**Modifications** :

| Élément | Cible | Pourquoi |
| --- | --- | --- |
| Item | `Pack FemiGlow — 199 dh` (ligne secondaire `Réf. 390 dh`) | Anchoring. |
| Sous-total | 199 dh | — |
| Livraison | `Offerte` | Décalage livraison. |
| Total | 199 dh | Round. K-PRI-02. |

**Composants impactés** : `components/commerce/CheckoutFlow.tsx`, `components/commerce/OrderSummary.tsx`, `components/commerce/steps/AddressStep.tsx`, `components/commerce/steps/PaymentStep.tsx`.

## 10. Page Merci `/merci` — bascule transaction → relation

### 10.1 Vue d'ensemble

Objectif : désamorcer le buyer's remorse. KPI : retour J+7 > 30 %, buyer's remorse < 1,5 %.

### 10.2 Modifications

| Élément | Cible | Pourquoi |
| --- | --- | --- |
| Hero | `Merci, [Prénom]. Votre pack est en bonnes mains.` | Conservé adapté (« pack » remplace « commande »). |
| Numéro | `FG-2026-XXXXX` | Conservé. |
| Livraison estimée | `Rabat : 24 h. Autres villes : 48 à 72 h.` | Décalage. |
| Récap commande | `Pack FemiGlow — 199 dh — Livraison offerte` | Décalages. |
| Timeline | `Préparation à Rabat → Expédition → Livraison` | Décalage. |
| Lettre éditoriale | Signée `Souheila · FemiGlow`. Texte : « Vos ongles découvrent le rituel en ce moment. Cinq minutes par soir. Patience. La paste prépare, la powder révèle, le polissoir lustre. L'éclat reviendra doucement. » | Décalage #2 + cohérence produit. |
| Préparation au geste | « Avant votre premier rituel — une serviette propre, une bonne lumière, cinq minutes sans téléphone. Le pack fera le reste. » | K-COP-03. |
| Cross-links | 2 cards : `/journal/manucure-japonaise-origine-methode` + `/maison`. | Pertinent. |
| Footer mention | `info@femiglow-maroc.com · +212 630-035905 · 25 bis avenue Patrice Lumumba, Rabat` | Décalages complets. |

**Composants impactés** : `components/sections/HeroMerci.tsx`, `components/sections/EditorialLetter.tsx`, `components/sections/TimelineSteps.tsx`, `components/sections/OrderRecap.tsx`.

## 11. Page Contact `/contact`

### 11.1 Vue d'ensemble

Objectif : pont conversationnel B2C avant/après achat + B2B.

### 11.2 Modifications

| Section | Élément | Cible | Pourquoi |
| --- | --- | --- | --- |
| Hero | Email cliquable | `info@femiglow-maroc.com` | Décalage #5. |
| Hero | Téléphone cliquable | `+212 630-035905` (WhatsApp prioritaire) | Décalage #4. |
| Coordonnées | Adresse atelier | `25 bis avenue Patrice Lumumba, Rabat — 10 000` | Décalage #1. |
| Coordonnées | Mention sous-adresse | `Sur rendez-vous. Souheila reçoit le mardi et le jeudi.` | Décalage #3b — Souheila reçoit pour formations / consultations. |
| Formulaire | Sélecteur type | `Question` / `Commande` / `Partenariat ou formation` | Décalage #3b — capter les leads B2B / écoles. |
| Formulaire | Champs adaptatifs « partenariat ou formation » | `Type d'organisation`, `Ville`, `Nature de la demande (formation, distribution, B2B)` | Précis pour Souheila. |
| FAQ | 4 entrées contextuelles | Conservées + adapter une entrée à « Comment suivre une formation avec Souheila ? » | Décalage #3b. |
| États succès | « Votre message est arrivé. Souheila ou un membre de la maison répondra sous trois jours. » | Décalage #2. |

**Composants impactés** : `components/sections/ContactHero.tsx`, `components/sections/DirectContactBlock.tsx`, `components/forms/ContactForm.tsx`.

## 12. Composants transverses

### 12.1 Header

**Aucun changement structurel**. 4 entrées : RITUEL / JOURNAL / KIT / MAISON.

À vérifier : si le wordmark est lié à `/`, conservé. Compteur panier conservé.

### 12.2 Footer

**Modifications** :

| Élément | Cible | Pourquoi |
| --- | --- | --- |
| Mention copyright | `© 2026 FemiGlow — Rabat. Tous droits réservés.` | Décalage #1. |
| Colonne Assistance | `Contact · FAQ · Livraison · Retours` (inchangé en structure). Lien `Contact` mène à `/contact`. | — |
| Adresse complète (bloc bas) | `FemiGlow · 25 bis avenue Patrice Lumumba, Rabat · info@femiglow-maroc.com · +212 630-035905` | Décalages complets. |

**Composants impactés** : `components/layout/Footer.tsx`, `components/layout/FooterMinimal.tsx`.

### 12.3 Widget chat (visible sur toutes pages B2C)

**Modifications** :

| Élément | Cible | Pourquoi |
| --- | --- | --- |
| Salutation par défaut | `Bonjour. Je suis l'assistante de FemiGlow, à Rabat. Posez-moi vos questions sur le pack, le rituel, ou la livraison.` | Décalage #1. |
| Instructions LLM (DB) | Persona « assistante FemiGlow ». Toujours mentionner Rabat si on parle de localisation. Toujours mentionner « pack FemiGlow » et non « kit ». Connaître les ingrédients halal. | Cohérence produit. |
| Lead capture | Téléphone collecté → push vers `+212 630-035905` (WhatsApp interne via webhook). | Décalage #4. |

**Composants impactés** : `components/chat/ChatWidget.tsx`, `lib/chat/services/orchestrator.ts`, table `chat_instruction_version.body`, contenu `chat-knowledge/*.md`.

### 12.4 TrustSignals (réutilisé sur kit, panier, commander, merci)

**Modifications** :

| Trust | Label cible | Detail cible |
| --- | --- | --- |
| Livraison | `Livraison offerte` | `Rabat 24 h — Maroc 48 à 72 h` |
| Retour | `Retour 30 jours` | `Même entamé` |
| Paiement | `Paiement sécurisé` | `3D Secure & COD` |
| Halal | `Certifié halal` (**nouveau, optionnel**) | `Halal Cosmetics Council` |

**Notes** : si TrustSignals est limité à 3 items, ajouter Halal au 4ᵉ devient un choix. Recommandation : remplacer `Paiement sécurisé` par `Certifié halal` sur la fiche `/kit` (où le différenciateur compte), conserver `Paiement sécurisé` sur `/panier` et `/commander` (où la confiance paiement compte).

**Composants impactés** : `components/sections/TrustSignals.tsx`.

## 13. Feeds, SEO, knowledge chat

### 13.1 Feed Google Merchant (`lib/products/feed/kit-feed.ts`)

| Élément | Cible | Pourquoi |
| --- | --- | --- |
| `<title>` | `Pack FemiGlow — Manucure japonaise halal` | SEO produit. |
| `<description>` | « Coffret de manucure japonaise halal en deux gestes — paste, powder et polissoir Step 4. Pensé à Rabat par Souheila, biologiste et formulatrice. Sans vernis, sans abrasion. Cinq minutes par jour. Livraison offerte au Maroc. » | Décalages tous. |
| `<price>` | `390.00 MAD` | Prix de référence. |
| `<sale_price>` | `199.00 MAD` | Prix payé. |
| `<sale_price_effective_date>` | Dates ouvertes (sans expiration) | Le prix d'introduction n'expire pas. |
| `<brand>` | `FemiGlow` | — |
| `<gtin>` ou `<mpn>` | À renseigner par Souheila | — |
| `<availability>` | `in stock` | — |
| `<condition>` | `new` | — |
| `<shipping>` price | `0 MAD` pour `MA` | Livraison offerte. |
| `<custom_label_0>` | `manucure-japonaise` | Segmentation campagnes. |
| `<custom_label_1>` | `halal` | Segmentation. |

**Composants impactés** : `lib/products/feed/kit-feed.ts`, snapshots `__snapshots__/*.snap`.

### 13.2 JSON-LD (`lib/seo/json-ld.tsx`)

| Élément | Cible | Pourquoi |
| --- | --- | --- |
| `Organization.name` | `FemiGlow` | — |
| `Organization.email` | `info@femiglow-maroc.com` | Décalage #5. |
| `Organization.telephone` | `+212 630-035905` | Décalage #4. |
| `Organization.address.streetAddress` | `25 bis avenue Patrice Lumumba` | Décalage #1. |
| `Organization.address.addressLocality` | `Rabat` | Décalage #1. |
| `Organization.address.addressCountry` | `MA` | — |
| `Organization.url` | `https://femiglow-maroc.com` | Décalage domaine. |
| `Organization.founder.name` | `Souheila` | Décalage #2. |
| `Organization.founder.jobTitle` | `Biologiste, formulatrice et formatrice` | Décalages #3a, #3b. |
| `Product.name` | `Pack FemiGlow` | — |
| `Product.description` | (cf. description Hero produit) | — |
| `Product.offers.price` | `199.00` | — |
| `Product.offers.priceCurrency` | `MAD` | — |
| `Product.aggregateRating` | À retirer si présent (pas de système d'étoiles dans la voix maison) | K-LUX-03. |

**Composants impactés** : `lib/seo/json-ld.tsx`.

### 13.3 Sitemap, robots, OG, canonical

| Fichier | Modification | Pourquoi |
| --- | --- | --- |
| `app/sitemap.ts` | URL racine `https://femiglow-maroc.com` | Décalage domaine. |
| `app/robots.ts` | URL sitemap `https://femiglow-maroc.com/sitemap.xml` | — |
| OG images | Régénérer avec nom `Pack FemiGlow` et adresse Rabat | Décalages. Chantier OG séparé. |
| Canonical | `https://femiglow-maroc.com/...` | — |

### 13.4 Knowledge chat (`content/chat-knowledge/`)

**13 fichiers**. Modifications par fichier :

| Fichier | Modification principale | Pourquoi |
| --- | --- | --- |
| `01-kit-overview.md` | Réécriture intégrale : « Pack FemiGlow, coffret manucure japonaise halal en deux gestes. Paste vert sauge, powder rose poudré, polissoir Step 4 bleu ciel. 199 dh, livraison offerte au Maroc. » | Cohérence produit. |
| `02-pricing-shipping-maroc.md` | Prix 199 dh (référence 390 dh). Rabat 24 h. Autres villes 48–72 h. Livraison offerte au Maroc. | Décalages. |
| `03-ingredients.md` | Réécriture : 3 paragraphes (Paste / Powder / Polissoir) avec INCI complet. Mention halal. | Cohérence produit. |
| `04-rituel-soir.md` | Réécriture : « 1. Paste — 2 minutes. 2. Powder — 2 minutes. Polish & Shine — 1 minute. Total 5 minutes. » | Cohérence produit. |
| `05-rituel-matin.md` | Si distinction matin/soir conservée : « Le matin est facultatif. Polish & Shine seul, en finition, suffit. » | Simplification. |
| `06-objection-pas-medical.md` | Conserver structure. Ajouter mention halal comme preuve de rigueur. | — |
| `07-objection-trop-cher.md` | Réécriture avec nouveau prix : « 199 dh pour un pack qui tient quatre à cinq mois, soit environ 40 dh par mois. Un seul rendez-vous en institut coûte plus cher. » | K-PRI-01 (anchoring : comparaison institut). |
| `08-objection-ca-marche.md` | Conserver. Mettre à jour les 4 gestes → 2 gestes + polissoir. | — |
| `09-shipping-delais.md` | Rabat 24 h. Casablanca, Salé 24–48 h. Autres villes 48–72 h. Toutes destinations Maroc : livraison offerte. | Décalages. |
| `10-retour-garantie.md` | Email retour `info@femiglow-maroc.com`. Adresse retour `25 bis avenue Patrice Lumumba, Rabat`. | Décalages. |
| `11-contact-info.md` | Format téléphone canonique `+212 630-035905`. Ajouter email. Adresse Rabat. | Décalage format. |
| `12-confirmation-commande.md` | Mention « pack » au lieu de « kit ». Mention Souheila. Mention Rabat pour expédition. | Décalages. |
| `13-avis-clients.md` | Mettre à jour citations. Salma reste initiée témoin. Ajouter un témoignage Rabat (cohérent avec base initiées). | — |

**Composants impactés** : `apps/web/content/chat-knowledge/*.md`, table `chat_knowledge_item` (re-seed après modification fichiers, via script `seed:chat-knowledge`). Embeddings pgvector à régénérer pour cohérence RAG.

## 14. Propositions d'articles à rédiger pour le journal

Douze articles cadrés pour : (1) couvrir les piliers SEO long-tail du produit, (2) nourrir le maillage interne `/journal → /kit`, (3) respecter la voix « maison / rituel / initiée », (4) appliquer les heuristiques Kolenda.

Format de fiche : **titre**, **angle**, **mots-clés SEO**, **longueur cible**, **catégorie**, **promesse de valeur**, **lien produit**, **tactique Kolenda**.

### Article 1 — « La manucure japonaise — origine et méthode »

| Champ | Valeur |
| --- | --- |
| Slug | `manucure-japonaise-origine-methode` |
| Angle | Récit historique : origine à l'ère Meiji (fin XIXᵉ), passage par les artisanats traditionnels, transmission au geste moderne. Pas d'académisme pesant — un récit. |
| Mots-clés | manucure japonaise, ongles polis sans vernis, soin ongles tradition |
| Longueur | 1 200 à 1 500 mots |
| Catégorie | Histoire |
| Promesse | Comprendre d'où vient le geste pour mieux l'adopter. |
| Lien produit | Conclure sur le pack FemiGlow comme héritier marocain de cette méthode. |
| Kolenda | K-LUX-03 (indirect claim par l'histoire), K-COP-03 (sensorialité narrative). |

### Article 2 — « Paste et powder — deux gestes, un éclat »

| Champ | Valeur |
| --- | --- |
| Slug | `paste-et-powder-deux-gestes` |
| Angle | Tutorial sensoriel détaillé. Décrire la matière de la paste (cire d'abeille onctueuse), de la powder (talc et riz très fin), le mouvement (lent, pas appuyé), le ressenti après. |
| Mots-clés | paste powder ongles, manucure deux gestes, soin ongles méthode japonaise |
| Longueur | 900 à 1 100 mots |
| Catégorie | Rituel |
| Promesse | Vivre les deux gestes par procuration avant de les pratiquer. |
| Lien produit | Présenter chaque pot et sa fonction. |
| Kolenda | K-COP-03 (imagerie sensorielle dense), K-LUX-04 (mains imagées). |

### Article 3 — « Le polissoir Step 4 — un objet, trois faces »

| Champ | Valeur |
| --- | --- |
| Slug | `polissoir-step-4-trois-faces` |
| Angle | Récit de l'objet : pourquoi rectangulaire, pourquoi trois grains, pourquoi le marquage japonais « Step 4 », comment le passer (trois passes lentes par ongle). |
| Mots-clés | polissoir ongles, buffer japonais, ongles brillants sans vernis |
| Longueur | 800 à 1 000 mots |
| Catégorie | Matières |
| Promesse | L'objet le plus discret du pack est aussi le plus signature. |
| Lien produit | Centré sur le polissoir comme finition. |
| Kolenda | K-LUX-04, K-COP-03. |

### Article 4 — « Qu'est-ce qu'un cosmétique halal ? »

| Champ | Valeur |
| --- | --- |
| Slug | `qu-est-ce-qu-un-cosmetique-halal` |
| Angle | Pédagogie factuelle : ce que la certification halal vérifie (origine matières, absence d'alcool dénaturé, absence de dérivés animaux non conformes, traçabilité audit), ce qu'elle ne fait pas, pourquoi ça compte au Maroc. |
| Mots-clés | cosmétique halal, ingrédients halal Maroc, certification halal soin |
| Longueur | 1 000 à 1 200 mots |
| Catégorie | Maison |
| Promesse | Comprendre une certification pour mieux choisir. |
| Lien produit | Mentionner FemiGlow et son partenariat Halal Cosmetics Council. |
| Kolenda | K-LUX-03 (factualité). |

### Article 5 — « Pourquoi le rituel ne contient pas de vernis »

| Champ | Valeur |
| --- | --- |
| Slug | `pourquoi-pas-de-vernis` |
| Angle | Argumentaire en trois temps : (1) ce que fait le vernis (couvrir), (2) ce que fait le rituel (révéler), (3) pourquoi la cliente n'a pas à choisir — elle peut faire les deux. |
| Mots-clés | manucure sans vernis, ongles nus naturels, alternative vernis semi-permanent |
| Longueur | 900 à 1 100 mots |
| Catégorie | Conseils |
| Promesse | Lever l'idée que « manucure = vernis ». |
| Lien produit | Comparatif léger en pied — sans tableau dur (le tableau dur est sur `/kit`). |
| Kolenda | K-LUX-03, K-PRI-03 (un axe à la fois). |

### Article 6 — « Souheila — biologiste, formulatrice, formatrice »

| Champ | Valeur |
| --- | --- |
| Slug | `souheila-fondatrice-portrait` |
| Angle | Portrait. Parcours biologie → laboratoires → édition de plusieurs marques de cosmétiques naturels → fondation de FemiGlow et atelier de formation à Rabat. Format Q/R magazine. |
| Mots-clés | Souheila FemiGlow, fondatrice cosmétique naturel Maroc, formatrice cosmétique Rabat |
| Longueur | 1 200 à 1 500 mots |
| Catégorie | Maison |
| Promesse | Connaître la personne derrière la maison. |
| Lien produit | Aucun bouton kit — c'est un portrait, pas une vente. |
| Kolenda | K-LUX-03, K-LUX-04 (photos mains + profil au travail). |

### Article 7 — « Cinq minutes par soir — pourquoi pas plus »

| Champ | Valeur |
| --- | --- |
| Slug | `cinq-minutes-par-soir` |
| Angle | Réponse à l'objection inverse de « c'est trop long » : pourquoi cinq minutes suffisent, qu'est-ce qu'on perdrait à en faire plus, science de la pousse de l'ongle (0,1 mm par jour). |
| Mots-clés | rituel ongles 5 minutes, soin ongles quotidien, manucure rapide |
| Longueur | 700 à 900 mots |
| Catégorie | Rituel |
| Promesse | Désamorcer la peur du temps demandé. |
| Lien produit | CTA discret en pied. |
| Kolenda | K-LUX-03, K-COP-02 (rythme court). |

### Article 8 — « Cire d'abeille, kaolin, poudre de riz — origines marocaines et au-delà »

| Champ | Valeur |
| --- | --- |
| Slug | `matieres-d-ailleurs` |
| Angle | Récit des matières : cire d'abeille Atlas, kaolin Marrakech, poudre de riz Asie biologique. Géographie + métier + traçabilité. |
| Mots-clés | ingrédients cosmétique Maroc, cire abeille Atlas, kaolin Marrakech |
| Longueur | 1 000 à 1 200 mots |
| Catégorie | Matières |
| Promesse | Connaître la provenance pour adopter le pack en confiance. |
| Lien produit | Tableau des matières du pack en pied. |
| Kolenda | K-COP-03 (sensorialité géographique). |

### Article 9 — « L'ongle est une plaque vivante »

| Champ | Valeur |
| --- | --- |
| Slug | `l-ongle-est-une-plaque-vivante` |
| Angle | Vulgarisation scientifique signée Souheila : kératine, mélanine, vascularisation du lit, vitesse de pousse, sensibilité aux solvants. Argument biologique pour la patience. |
| Mots-clés | structure ongle, pousse ongle, kératine ongle |
| Longueur | 1 100 à 1 300 mots |
| Catégorie | Conseils |
| Promesse | Comprendre la matière de l'ongle pour mieux l'accompagner. |
| Lien produit | Mention de la paste comme protectrice de la plaque. |
| Kolenda | K-LUX-03 (crédibilité biologie). |

### Article 10 — « Hiver, ongles, patience » (article existant — conserver)

À conserver tel quel si le contenu est qualitatif. Si réécriture : mettre Rabat à la place de Casablanca dans la mention géographique. Mots-clés : `ongles hiver`, `ongles secs froid`.

### Article 11 — « Ranger son rituel — l'étagère de la maison »

| Champ | Valeur |
| --- | --- |
| Slug | `ranger-son-rituel-etagere` |
| Angle | Lifestyle : où poser ses pots, à quelle hauteur, sous quelle lumière, à quelle température. Le rituel commence par sa place dans la salle de bain ou sur la table. |
| Mots-clés | ranger soin cosmétique, étagère salle de bain, organisation soin |
| Longueur | 700 à 900 mots |
| Catégorie | Rituel |
| Promesse | Le rituel commence avant le geste. |
| Lien produit | Mention discrète du pack comme objet à honorer. |
| Kolenda | K-COP-03. |

### Article 12 — « La formation de Souheila — ouvrir l'atelier »

| Champ | Valeur |
| --- | --- |
| Slug | `formation-souheila-ouvrir-atelier` |
| Angle | Annonce des formations animées par Souheila au 25 bis avenue Patrice Lumumba, à Rabat. Public visé (esthéticiennes, formulatrices, écoles), format, cadence, inscription via `info@femiglow-maroc.com`. |
| Mots-clés | formation cosmétique Maroc, formation manucure japonaise, atelier formulation Rabat |
| Longueur | 800 à 1 000 mots |
| Catégorie | Maison |
| Promesse | La maison s'ouvre, le savoir circule. |
| Lien produit | Aucun. C'est un article B2B / formation. |
| Kolenda | K-LUX-03. |

### Synthèse stratégique articles

- **Maillage interne** : chaque article (sauf le portrait Souheila et la formation) renvoie vers `/kit` en CTA discret. Toujours « Recevoir le pack — 199 dh · Livraison offerte au Maroc ».
- **Auteur** : Souheila signe les articles techniques (4, 6, 9, 12) ; les autres peuvent être signés `La maison FemiGlow` pour préserver la voix collective.
- **Cadence publication recommandée** : 1 article par semaine pendant 12 semaines, soit ~3 mois pour constituer l'index complet du carnet. Article 1 (manucure japonaise) en featured pendant 2 semaines.
- **Newsletter** : mensuelle. Chaque édition reprend le meilleur article du mois + un fragment inédit.

## 15. Récapitulatif Kolenda — heuristiques les plus mobilisées dans le projet

Trois principes structurent la cohérence du site et doivent guider toute itération future :

1. **K-LUX-01 (espace blanc) + K-COL-01 (60-30-10)** — la maison se signale par sa retenue. Tout ajout doit être justifié par ce qu'il rend visible, pas par ce qu'il occupe.
2. **K-LUX-03 (indirect claim)** — on suggère, on n'affirme pas. La voix maison est asymétrique : factualité dense + métaphore parcimonieuse. Le halal, la formation, la biologie de Souheila sont des arguments factuels qui se tiennent seuls. Pas besoin d'adjectifs.
3. **K-PRI-01 (anchoring 199/390)** — le levier commercial assumé. Le prix de référence (390 dh) ancre la valeur ; le prix payé (199 dh) devient l'opportunité. À encadrer typographiquement comme une fiche, jamais comme un solde.

## 16. Synthèse — feuille de route compacte

```
LOT A — Fixtures produit (priorité 1)
  mock/product.ts        → Pack FemiGlow, 199/390, paste+powder+polissoir, Rabat
  mock/kit.ts            → composition refondue, comparatif ajusté, FAQ +halal
  lib/schemas/product.ts → ajouter referencePriceCents si non présent

LOT B — Identité maison (priorité 1)
  mock/homepage.ts       → kicker Rabat, gestes 5→3 (paste/powder/polish)
  mock/maison.ts         → Souheila + 25 bis av Patrice Lumumba
  mock/rituel.ts         → Souheila + Rabat + interview refondue
  mock/articles.ts       → signatures Souheila pour articles fondatrice
  layout/Footer.tsx      → Rabat, email, téléphone
  layout/FooterMinimal.tsx → idem
  sections/DirectContactBlock.tsx → email + téléphone + Rabat
  sections/EditorialLetter.tsx → signature Souheila
  sections/TrustSignals.tsx → Livraison offerte, +halal
  lib/seo/json-ld.tsx    → email + adresse + fondatrice
  lib/menu-descriptions.ts, lib/utils/shipping.ts → Rabat priorité

LOT C — Feed + chat knowledge (priorité 1)
  lib/products/feed/kit-feed.ts → nom, description, 199/390, free shipping MA
  content/chat-knowledge/*.md → 13 fichiers à mettre à jour

LOT D — Tests + snapshots (auto)
  pnpm test -u && pnpm test:e2e && pnpm typecheck && pnpm lint

LOT E — Docs source (priorité 3, non bloquant)
  docs/pages/, docs/preparation/, docs/audit/00→07
  docs/audit/00-rapport-executif.md : note de mise à jour

LOT F — Articles journal (chantier éditorial, 12 semaines)
  12 articles selon § 14
```

Ce guide est la **source de vérité opérationnelle** pour le programme qui exécute les modifications. À chaque ambiguïté (« faut-il aussi changer X ? »), revenir ici plutôt que d'extrapoler.
