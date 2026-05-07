# Page Rituel — `/rituel`

> **Univers Particulier · B2C** — Document de spécification détaillée
> *Volume IV · Mai 2026 · Complémentaire à la charte graphique et au document d'architecture.*

---

## Sommaire

1. [Identité de la page](#1--identité-de-la-page)
2. [Contexte stratégique](#2--contexte-stratégique)
3. [Architecture verticale globale](#3--architecture-verticale-globale)
4. [Header — élément persistant](#4--header--élément-persistant)
5. [Section 01 — Hero d'ouverture](#5--section-01--hero-douverture)
6. [Section 02 — L'origine japonaise](#6--section-02--lorigine-japonaise)
7. [Section 03 — Les quatre gestes · vidéo](#7--section-03--les-quatre-gestes--vidéo)
8. [Section 04 — Sciences du soin](#8--section-04--sciences-du-soin)
9. [Section 05 — Témoignage d'une initiée](#9--section-05--témoignage-dune-initiée)
10. [Section 06 — Pivot vers le kit](#10--section-06--pivot-vers-le-kit)
11. [Section 07 — Cross-link Journal](#11--section-07--cross-link-journal)
12. [Footer — élément persistant](#12--footer--élément-persistant)
13. [Comportements transverses](#13--comportements-transverses)
14. [Adaptation responsive](#14--adaptation-responsive)
15. [Performance technique](#15--performance-technique)
16. [SEO & métadonnées](#16--seo--métadonnées)
17. [Accessibilité (a11y)](#17--accessibilité-a11y)
18. [Microcopy & états](#18--microcopy--états)
19. [Synthèse — checklist de validation](#19--synthèse--checklist-de-validation)

---

## 1 — Identité de la page

| Attribut             | Valeur                                                                  |
| :------------------- | :---------------------------------------------------------------------- |
| **URL**              | `femiglow.ma/rituel`                                                    |
| **Type**             | Page éditoriale longue · narrative                                      |
| **Audience**         | Femme 28–45 ans, urbaine — déjà passée par `/` ou arrivée d'une recherche organique « soin ongles japonais » |
| **Profil cognitif**  | Curieuse engagée — elle a accepté de scroller, elle veut comprendre     |
| **Pouvoir d'achat**  | CSP B / B+ — déjà alignée avec le positionnement                        |
| **Funnel**           | **MOFU** — Middle of Funnel · Considération                             |
| **Position parcours**| Deuxième ou troisième page consultée dans la session                    |
| **Durée d'attention**| 3 à 5 minutes (lecture engagée) — bien plus que les 8 secondes du hero  |
| **Device split**     | Mobile 65% · Desktop 28% · Tablet 7% (lecture longue → desktop monte)   |

### Ce que la page **doit** faire

1. **Approfondir** le positionnement esquissé en page d'accueil. Passer de la *promesse* à l'*incarnation*.
2. **Légitimer** la marque par l'**héritage** (origine japonaise, méthode centenaire) et par la **science** (pourquoi le soin > le vernis).
3. **Faire entrer** la visiteuse dans la maison — au sens propre. Lui faire ressentir, en lisant, qu'elle *est déjà* une initiée.
4. **Construire la conviction** sans vendre. Le *« je vais le faire »* doit naître d'elle, pas de nous.
5. **Préparer doucement** au pivot conversion `/kit`. La rendre *prête* sans la pousser.

### Ce que la page **ne doit pas** faire

1. **Vendre directement.** Aucun prix avant la dernière section. Aucun panier visible dans la lecture.
2. **Lasser.** Trop de texte en bloc tue l'attention. Chaque section a son rythme propre.
3. **Surdémontrer.** Pas de listes à puces de bénéfices. Pas de tableaux comparatifs marketing. C'est un journal, pas une fiche.
4. **Imiter Wikipédia.** L'origine japonaise est une **histoire**, pas une notice.
5. **Effrayer par la science.** Les principes scientifiques sont incarnés, jamais clinicaux.

---

## 2 — Contexte stratégique

### Position dans le parcours utilisateur B2C

```
[ARRIVÉE]                   [PAGE RITUEL /rituel]                [SUITE]
    │                              │                                │
/accueil ──────────►       1. Hero d'ouverture           ────►   /kit ★
Recherche organique        2. Origine japonaise          ────►   /journal
Bouche à oreille           3. Vidéo 4 gestes             ────►   /maison
Lien Journal               4. Sciences du soin           ────►   (retour /)
                           5. Témoignage initiée
                           6. Pivot kit ◀────── moment décisif
                           7. Cross-link Journal
```

### La règle de la conviction lente

À l'inverse du `/accueil` (5 secondes pour convaincre), `/rituel` repose sur une **lecture engagée**. La cliente arrive ici parce qu'elle a déjà accepté un premier niveau. Elle veut maintenant **savoir**.

Trois questions implicites guident la lecture :

1. **« Pourquoi ce serait différent ? »** — répondu par l'origine japonaise + la science.
2. **« Comment ça marche concrètement ? »** — répondu par la vidéo des 4 gestes.
3. **« Est-ce que ça marche vraiment ? »** — répondu par le témoignage de l'initiée.

Si ces trois réponses sont délivrées dans cet ordre, **le pivot kit (section 06) devient une évidence**, pas un argument.

### Tension stratégique fondamentale

> Cette page doit faire ce que la pédagogie traditionnelle marketing n'arrive presque jamais à faire : **enseigner sans démontrer**. Chaque section doit ressembler à un fragment de roman, jamais à un argumentaire produit. Le savoir transmis est secondaire — c'est l'**émotion d'avoir appris** qui prépare à l'achat.

### Architecture émotionnelle

| Section          | Émotion d'entrée    | Émotion de sortie       | Mouvement intérieur                  |
| :--------------- | :------------------ | :---------------------- | :----------------------------------- |
| 01. Hero         | Curiosité ouverte   | Disposition à apprendre | Pause, ralentissement                |
| 02. Origine      | Disposition         | Respect                 | Inscription dans une histoire longue |
| 03. Vidéo gestes | Respect             | Compréhension corporelle| « Je peux le faire »                  |
| 04. Sciences     | Compréhension       | Confiance rationnelle   | Légitimation logique                 |
| 05. Témoignage   | Confiance           | Identification          | Mimétisme pré-achat                  |
| 06. Pivot kit    | Identification      | Décision possible       | Le pas est gratuit à franchir         |
| 07. Cross-link   | Décision ou repli   | Engagement long terme   | Si pas maintenant, plus tard         |

### KPIs cibles

| Métrique                                    | Cible                            | Source                       |
| :------------------------------------------ | :------------------------------- | :--------------------------- |
| Temps moyen sur la page                     | > 2:30 (150s)                    | GA4                          |
| Scroll depth ≥ 75%                          | > 50% des sessions               | Hotjar                       |
| Scroll depth ≥ 95%                          | > 30% des sessions               | Hotjar                       |
| Watch rate vidéo (≥ 50%)                    | > 40% des arrivants              | Player analytics             |
| Watch rate vidéo (≥ 90%)                    | > 18%                            | Player analytics             |
| CTR section 06 → `/kit`                     | > 25% des sessions                | Event tracking               |
| CTR cross-link Journal                      | > 8%                              | Event tracking               |
| Bounce rate (session terminée sur cette page) | < 35%                          | GA4                          |
| LCP (Largest Contentful Paint)              | < 2.5s                           | Web Vitals                   |
| CLS                                         | < 0.1                            | Web Vitals                   |

---

## 3 — Architecture verticale globale

### Vue d'ensemble — desktop ≥ 1280px

```
┌─────────────────────────────────────────────────────────────────────┐
│  [HEADER — sticky · 80px]                                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  01. HERO D'OUVERTURE                                               │
│      Photo lifestyle pleine largeur                                 │
│      Surtitre · Titre poétique · Sous-tagline                       │
│      Hauteur : 86vh                                                 │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  02. L'ORIGINE JAPONAISE                                            │
│      Texte éditorial 2 colonnes                                     │
│      Photo archive sépia                                             │
│      Hauteur : 700px                                                │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  03. LES QUATRE GESTES — VIDÉO                                      │
│      Player vidéo 90s slow motion                                   │
│      Captions FR/AR optionnelles                                    │
│      Hauteur : 100vh (immersion volontaire)                         │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  04. SCIENCES DU SOIN                                               │
│      Trois principes en 3 colonnes                                  │
│      1 schéma scientifique central                                  │
│      Hauteur : 720px                                                │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  05. TÉMOIGNAGE D'UNE INITIÉE                                       │
│      Interview Q/R · format magazine                                │
│      5 questions · photo implied                                    │
│      Hauteur : 920px                                                │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  06. PIVOT VERS LE KIT                                              │
│      Bandeau sauge pleine largeur                                   │
│      Une phrase · un CTA encre                                      │
│      Hauteur : 320px                                                │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  07. CROSS-LINK JOURNAL                                             │
│      Trois articles connexes                                        │
│      Grille régulière 3 colonnes                                    │
│      Hauteur : 460px                                                │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  [FOOTER — encre · 320px]                                           │
└─────────────────────────────────────────────────────────────────────┘
```

### Hauteur totale approximative

- **Desktop (1440×900)** : ~4 500px (5.0 viewports — page éditoriale assumée longue)
- **Tablet (768×1024)** : ~5 200px (5.1 viewports)
- **Mobile (390×844)** : ~6 100px (7.2 viewports)

### Rythme de lecture intentionnel

| Section          | Densité       | Rythme                  | Type de contenu              |
| :--------------- | :------------ | :---------------------- | :--------------------------- |
| 01. Hero         | Très aérée    | Suspension              | Image + 3 lignes             |
| 02. Origine      | Dense         | Lecture posée           | Texte long                   |
| 03. Vidéo        | Pleine page   | Immersion               | Visuel + son                 |
| 04. Sciences     | Structurée    | Compréhension articulée | 3 micro-essais + schéma      |
| 05. Témoignage   | Conversationnelle | Mimétisme           | Q/R alternance               |
| 06. Pivot        | Très aérée    | Décision                | 1 phrase + CTA               |
| 07. Cross-link   | Régulière     | Repli ou bond           | 3 cartes                     |

> **Principe d'alternance dense/aérée respecté** : section dense (texte) → aérée (vidéo) → structurée (sciences) → conversationnelle (témoignage) → vide (pivot) → régulière (journal). Le scroll est un **rythme musical**.

---

## 4 — Header — élément persistant

### Comportement spécifique sur `/rituel`

Le header se comporte comme sur `/accueil`, **sauf** :

| Différence                  | Spécification                                                              |
| :-------------------------- | :------------------------------------------------------------------------- |
| **Item actif**              | « RITUEL » dans le menu : couleur Encre `#2C2A28` (au lieu de Brume), avec underline 1px sauge dark, offset 6px |
| **Fond initial**            | `transparent` au-dessus du hero (le hero a une photo qui appelle de la transparence) |
| **Fond après scroll**       | `rgba(251, 248, 241, 0.94)` — opacité légèrement plus haute que sur `/` car la page est plus longue, le header est plus utilisé |
| **CTA panier**              | Identique. Si la cliente ajoute un kit pendant la lecture, le compteur passe de 0 à 1 avec micro-animation pulse 600ms |

### Tactiques héritées

Les tactiques `4 OPTIONS MAX`, `ENTRY POINT FOCAL`, `GROUP SIMILAR ITEMS`, `FRIENDLY COLD`, `STICKY MOMENTUM` sont identiques à `/accueil`.

### Indicateur de progression de lecture (spécifique à `/rituel`)

Sous le header, un fin filet horizontal sauge dark indique la progression de scroll dans la page.

| Propriété      | Valeur                                                  |
| :------------- | :------------------------------------------------------ |
| Position       | `top: 80px` (juste sous le header), full width          |
| Hauteur        | 2px                                                     |
| Couleur        | `#A8C4A6` (Sauge dark) — opacité 0.85                   |
| Comportement   | `width: scrollProgress%` mis à jour au scroll (throttle 16ms) |
| Apparition     | Visible dès le 1er pixel de scroll (sinon caché)        |
| Z-index        | 99 (juste sous le header)                               |

> **Pourquoi cette barre uniquement sur `/rituel` ?** Parce que c'est la seule page volontairement longue. Sur `/`, elle serait gadget. Ici, elle rassure : *« je sais où j'en suis dans cette histoire ».*

---

## 5 — Section 01 — Hero d'ouverture

### 5.1 — Wireframe complet

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│                                                                            │
│                                                                            │
│        [PHOTOGRAPHIE PLEINE LARGEUR]                                       │
│        [Mains au repos sur un linge de coton beige]                        │
│        [Pots du kit visibles en flou doux à droite]                        │
│        [Lumière naturelle latérale, profondeur de champ faible]            │
│                                                                            │
│                                                                            │
│        LE RITUEL                                                           │
│                                                                            │
│        Quatre minutes                                                      │
│        pour retrouver                                                      │
│        une lumière qui était déjà là.                                      │
│                                                                            │
│        Une méthode japonaise, transmise depuis le début                    │
│        du XXe siècle. Réinterprétée pour la main contemporaine.            │
│                                                                            │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 — Composition visuelle

#### Photographie pleine largeur

| Propriété          | Valeur                                                                |
| :----------------- | :-------------------------------------------------------------------- |
| Sujet              | Mains posées au repos sur un linge de coton beige, pots du kit en flou doux à droite |
| Composition        | Règle des tiers — mains à gauche-bas, pots à droite-haut              |
| Focale équivalente | 85mm (compression discrète, profondeur de champ faible)               |
| Ouverture          | f/2.8 — flou onirique sans devenir abstrait                           |
| Lumière            | Naturelle latérale, golden hour (matin tôt ou fin d'après-midi)       |
| Tonalité           | Calibrage chaud, tons terreux, hautes lumières crème                   |
| Saturation         | Légèrement désaturée (-15% par rapport au natif)                      |
| Format             | 16:9 desktop · 4:3 tablet · 3:4 mobile (recadrage volontaire)         |
| Hauteur d'affichage| 86vh (occupe presque tout le viewport, laisse deviner section 02)     |
| Largeur            | 100% (déborde du container max-width)                                  |

#### Overlay sur la photo

| Propriété     | Valeur                                                              |
| :------------ | :------------------------------------------------------------------ |
| Type          | Gradient diagonal                                                   |
| Direction     | `linear-gradient(135deg, rgba(251,248,241,0.5) 0%, transparent 60%)`|
| Objectif      | Lisibilité du texte en haut-gauche, sans masquer la photo          |
| Animation     | Aucune — l'overlay est statique                                     |

#### Animation d'entrée de la photo

```
[t=0ms]      → Page chargée, fond crème uni
[t=200ms]    → Photo fade-in 1200ms ease-out
[t=300ms]    → Texte « LE RITUEL » fade-in + translate-up 12px (700ms)
[t=700ms]    → Titre principal fade-in (800ms)
[t=1300ms]   → Sous-tagline fade-in (600ms)
[t=1900ms]   → Animations terminées
```

### 5.3 — Copy — texte exact

#### Surtitre (kicker)

```
LE RITUEL
```

| Propriété      | Valeur                                              |
| :------------- | :-------------------------------------------------- |
| Police         | Inter SemiBold                                      |
| Taille         | 8.5pt (desktop) · 7.5pt (mobile)                    |
| Letter-spacing | 4px (tracking 400 — très large pour signaler la révérence) |
| Couleur        | `#C8A876` (Champagne) — apparition rare, signale la solennité |
| Transformation | uppercase                                            |
| Position       | Aligné à gauche, marge supérieure 24% de la hauteur photo |

#### Titre principal

```
Quatre minutes
pour retrouver
une lumière qui était déjà là.
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Light                                     |
| Taille          | 64pt (desktop) · 48pt (tablet) · 36pt (mobile)               |
| Line-height     | 1.15 (légèrement plus aéré que le titre de `/accueil`)        |
| Letter-spacing  | -0.5px                                                        |
| Couleur         | `#2C2A28` (Encre)                                            |
| Disposition     | Trois lignes — la coupure est volontaire, méditative          |
| Espacement haut | 16px sous le surtitre                                         |

##### Pourquoi cette formulation ?

Le titre est **un acte de foi philosophique**. Il dit en sous-texte :

- *« Quatre minutes »* — promesse de simplicité (héritée du `/accueil`).
- *« pour retrouver »* — verbe de récupération, pas d'acquisition. Le *« retrouver »* est central : on suppose que la beauté **était déjà là**, et qu'elle s'est cachée.
- *« une lumière qui était déjà là »* — affirmation philosophique : votre éclat n'est pas à fabriquer, il est à **révéler**. Cette idée structure tout le rituel et toute la marque.

> **Comparaison avec `/accueil`** : le titre de `/` était une promesse (« Le rituel d'éclat »). Ici, c'est une **explicitation** de cette promesse — *« voici pourquoi on l'appelle un rituel ».*

#### Sous-tagline

```
Une méthode japonaise, transmise depuis le début
du XXe siècle. Réinterprétée pour la main contemporaine.
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Light Italic                              |
| Taille          | 17pt (desktop) · 15pt (tablet) · 14pt (mobile)               |
| Line-height     | 1.5                                                          |
| Couleur         | `#4A4844` (Encre claire)                                     |
| Disposition     | Deux lignes                                                   |
| Espacement haut | 32px sous le titre principal                                  |
| Largeur max     | 540px (force la coupure typographique, pas de fluide)         |

##### Décomposition stratégique de la sous-tagline

| Fragment                              | Fonction stratégique                                       |
| :------------------------------------ | :--------------------------------------------------------- |
| « Une méthode japonaise »             | Héritage culturel — légitime sans démontrer                |
| « transmise depuis le début du XXe siècle » | Profondeur historique — pas une mode passagère       |
| « Réinterprétée »                     | Pas un copier-coller — implique une intelligence locale    |
| « pour la main contemporaine »        | Inclusion de la cliente — c'est *votre* main, pas une autre |

#### **Pas de CTA dans le hero**

C'est un choix capital. Le hero de `/rituel` est une **invitation à lire**, pas à agir. Mettre un CTA *« Voir le kit »* ici réduirait la profondeur de la page à un teaser commercial. La cliente doit **descendre** dans la page, pas en sortir.

### 5.4 — Tokens design

```css
/* ─── Hero d'ouverture — tokens ─── */
--hero-bg: #FBF8F1;
--hero-photo-overlay: linear-gradient(135deg, rgba(251,248,241,0.5) 0%, transparent 60%);
--hero-photo-height: 86vh;

--hero-kicker-color: #C8A876;       /* Champagne */
--hero-kicker-font: 'Inter', sans-serif;
--hero-kicker-weight: 600;          /* SemiBold */
--hero-kicker-size: 8.5pt;
--hero-kicker-tracking: 4px;

--hero-title-color: #2C2A28;
--hero-title-font: 'Cormorant Garamond', serif;
--hero-title-weight: 300;           /* Light */
--hero-title-size-desktop: 64pt;
--hero-title-line-height: 1.15;

--hero-subtitle-color: #4A4844;
--hero-subtitle-style: italic;
--hero-subtitle-size: 17pt;
--hero-subtitle-max-width: 540px;

--hero-padding-x-desktop: 96px;
--hero-padding-x-mobile: 24px;
```

### 5.5 — Comportements UX

#### Parallaxe légère sur la photo

Au scroll, la photo descend à 0.2× la vitesse du scroll (effet parallaxe doux). Elle reste visible jusqu'à 110% de scroll, puis disparaît.

```css
transform: translateY(scrollY * 0.2);
```

#### Indicateur de scroll en bas du hero

```
                    ▾
```

| Propriété      | Valeur                                            |
| :------------- | :------------------------------------------------ |
| Position       | Bas-centre du hero, 32px du bord inférieur         |
| Caractère      | U+25BE (▾) ou icône SVG simple                    |
| Couleur        | `#6B6863` (Brume) opacité 0.5                     |
| Taille         | 24px                                              |
| Animation      | `translateY(0 → 6px → 0)` cycle 1600ms ease-in-out |
| Reduced motion | Animation désactivée, opacity 0.4 fixe            |
| Cliquable      | Oui — scroll vers section 02 (smooth, 800ms)      |

### 5.6 — Psychologie & neuromarketing

#### Tactique 1 — Rare kicker (Champagne)

Le surtitre `LE RITUEL` est l'**une des deux occurrences** de la couleur Champagne dans toute la page (avec le fleuron de la section 06). Cette rareté est volontaire : la couleur appartient à la sphère du **sacré graphique**. Elle annonce qu'on entre dans une histoire qui mérite ce signal.

#### Tactique 2 — Indirect claim par révélation

Le `/accueil` utilisait l'indirect claim **par négation** (« Pas une marque. Une maison. »). Ici, c'est par **révélation philosophique** : *« une lumière qui était déjà là »*.

> McQuarrie & Phillips (2005) : *« Indirect claims require interpretation. We infer meaning. »*

Le cerveau infère : *« si la lumière était déjà là, alors le rituel ne crée pas — il révèle. Donc je ne suis pas en train de m'acheter un produit qui me transforme. Je m'achète un outil qui révèle ce que je suis. »*

C'est l'inversion totale de la rhétorique cosmétique habituelle (*« deviens plus belle »*). Ici : *« redeviens ce que tu es »*.

#### Tactique 3 — Distance (luxury branding)

> Chu, Chang & Lee (2021) : *« Luxury brands feel distant. »*
> Bjornsdottir et al. (2024) : *« Zoom out to show bodies. »*

La photo du hero ne montre pas un visage. Elle montre **des mains posées**. Cette distance est la signature visuelle du luxe accessible.

#### Tactique 4 — Slow motion implicite (figé)

> Togawa & Sugitani (2022) : *« Slow movements heighten the perceived importance of luxury products. »*

Une photo statique de mains au repos est l'équivalent d'un slow motion à l'arrêt : un **temps suspendu**.

#### Tactique 5 — Empty space

Le hero est composé à **30% de photo, 70% d'overlay/espace négatif lisible**. Le texte occupe environ 12% de la surface. (Sevilla & Townsend, 2016 — +23% de premium perçu).

#### Tactique 6 — F-pattern naturel

Contrairement au `/accueil` (Z-pattern, page graphique), `/rituel` est une **page text-heavy**. L'œil descend en F, glissant de gauche à droite, descend, repart, descend.

### 5.7 — Émotion à provoquer

| Étape       | Émotion                                                          |
| :---------- | :--------------------------------------------------------------- |
| Arrivée     | Apaisement (la photo est calme, la composition lente)             |
| 2 secondes  | Reconnaissance (la cliente reconnaît le wordmark, la palette)     |
| 4 secondes  | Curiosité **profonde** (« quatre minutes pour quoi ? »)           |
| 6 secondes  | Intrigue philosophique (« une lumière qui était déjà là »)        |
| 10 secondes | Disposition à la lecture longue (la cliente sait qu'elle va rester) |
| 12 secondes | Premier scroll — entrée dans la section Origine                   |

### 5.8 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| Vidéo background du hero                            | Brouille l'arrêt contemplatif. Le rituel commence par le silence.   |
| Photo de visage souriant                            | Réduit la distance luxe, transforme la page en publicité           |
| CTA `Voir le kit` dans le hero                      | Court-circuite la lecture, sabote la suite de la page               |
| Vagues comme dans `/accueil`                        | Répétition, perd le bénéfice de la photographie                     |
| Surtitre en encre (au lieu de champagne)            | Tue la rareté du Champagne, banalise l'ouverture                    |
| Titre en bold                                       | Cormorant **Light** — ne dévie jamais                                |
| Animation parallaxe trop rapide                     | Crée du motion sickness, agresse l'œil                              |

---

## 6 — Section 02 — L'origine japonaise

### 6.1 — Wireframe

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│  L'ORIGINE                                                                 │
│                                                                            │
│  ┌───────────────────────────────────┐   ┌──────────────────────┐         │
│  │                                   │   │                      │          │
│  │  Un soin né au Japon, au début    │   │   [photo archive    │          │
│  │  du XXe siècle.                   │   │    teintée sépia]    │          │
│  │                                   │   │                      │          │
│  │  Texte éditorial Cormorant        │   │   Atelier de soin    │          │
│  │  premier paragraphe — l'histoire  │   │   japonais — années  │          │
│  │  longue, transmise par les        │   │   1920                │          │
│  │  artisanes du soin de la main.    │   │                      │          │
│  │                                   │   └──────────────────────┘         │
│  │  Deuxième paragraphe Cormorant —                                       │
│  │  comment cette méthode s'est                                           │
│  │  conservée, et pourquoi elle                                           │
│  │  parle aujourd'hui à des mains                                         │
│  │  qui n'ont jamais connu le Japon.                                      │
│  │                                                                        │
│  └─────────────────────────────────────────────────────────────────────  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 — Composition

#### Surtitre

```
L'ORIGINE
```

| Propriété      | Valeur                                  |
| :------------- | :-------------------------------------- |
| Police         | Inter SemiBold 7.5pt                    |
| Letter-spacing | 2.5px                                   |
| Couleur        | `#6B6863` (Brume) — pas Champagne       |
| Position       | Aligné à gauche, marge gauche identique au texte principal |

> **Pourquoi pas Champagne ici ?** Parce que le Champagne est un signal de **rupture éditoriale rare**. Il a été consommé dans le hero. Tous les surtitres internes seront en Brume — sobres, respectueux du Champagne déjà placé.

#### Titre de section

```
Un soin né au Japon, au début du XXe siècle.
```

| Propriété      | Valeur                                                   |
| :------------- | :------------------------------------------------------- |
| Police         | Cormorant Garamond Light                                 |
| Taille         | 36pt (desktop) · 28pt (tablet) · 24pt (mobile)           |
| Line-height    | 1.25                                                     |
| Couleur        | `#2C2A28` (Encre)                                        |
| Disposition    | Deux lignes (coupure manuelle après « Japon, »)          |
| Espacement haut| 96px depuis la fin du hero                               |

#### Layout du contenu

| Breakpoint | Layout                                                                    |
| :--------- | :------------------------------------------------------------------------ |
| Desktop    | 60% texte (gauche) · 40% photo (droite) — gap 64px                        |
| Tablet     | 55% texte · 45% photo — gap 48px                                          |
| Mobile     | 100% texte puis 100% photo (empilés verticalement) — gap 32px             |

#### Texte principal — copy intégral

##### Premier paragraphe

```
Au début du XXe siècle, dans les ateliers de soin japonais,
les artisanes pratiquaient un rituel simple : préparer la surface
de l'ongle, lisser sa matière, polir le grain, révéler son éclat.
Pas de vernis. Pas de pose. Quatre étapes méticuleuses,
exécutées dans l'ordre, sur une main au repos.
```

##### Deuxième paragraphe

```
Cette méthode a survécu aux modes. Elle s'est transmise dans
les écoles d'esthétique de Tokyo, puis dans les salons d'Osaka,
de Kyoto, et plus tard de Shanghai et de Séoul. Aujourd'hui, à
Casablanca, nous l'avons réinterprétée — sans la trahir. Mêmes
gestes, même temps, mêmes principes. Avec des matières qui
parlent à des mains qui n'ont jamais connu un atelier japonais.
```

| Propriété         | Valeur                                                       |
| :---------------- | :----------------------------------------------------------- |
| Police            | Cormorant Garamond Regular                                   |
| Taille            | 17pt (desktop) · 16pt (tablet) · 15pt (mobile)               |
| Line-height       | 1.7                                                          |
| Letter-spacing    | 0                                                            |
| Couleur           | `#2C2A28` (Encre)                                            |
| Espace inter-paragraphe | 24px                                                  |
| Largeur max        | 480px (force la lisibilité optimale 65 caractères/ligne)    |

##### Choix narratif

Aucun nom propre n'est donné dans l'histoire — ni de marque, ni de fondateur, ni de date précise. C'est un choix.

> **Pourquoi ?** Parce que les marques commerciales japonaises de soin (P-Shine, etc.) appartiennent à des entreprises tierces. Citer une marque ferait passer FemiGlow pour une *réinterprétation tributaire*. Rester général et dire « les ateliers japonais » place FemiGlow dans une **lignée**, pas dans une **dette**.

#### Photo archive

| Propriété         | Valeur                                                                |
| :---------------- | :-------------------------------------------------------------------- |
| Sujet             | Atelier de soin de la main, années 1920–1930, mains vues de profil    |
| Tonalité          | Sépia teinté chaud — pas un noir & blanc froid                        |
| Format            | 4:5 (portrait) sur desktop · 4:3 sur mobile                           |
| Largeur affichée  | 360px (desktop) · 100% (mobile)                                       |
| Border            | Aucun                                                                  |
| Légende           | Inter Regular 10pt italic, couleur Brume, sous la photo                |
| Texte légende     | « Atelier de soin japonais — années 1920. Archives anonymes. »        |

##### Tonalité sépia : recette exacte

```css
filter: sepia(45%) saturate(70%) brightness(0.95) contrast(1.05);
```

> **Source de la photo** : photographies d'archives en domaine public (Library of Congress, archives japonaises ouvertes), retraitées. **Ne jamais utiliser une photo Shutterstock générique** — elle se reconnaît, et tue immédiatement la crédibilité historique.

### 6.3 — Tokens design

```css
/* ─── Section Origine — tokens ─── */
--origine-bg: #FBF8F1;
--origine-padding-vertical: 96px;

--origine-kicker-color: #6B6863;
--origine-kicker-tracking: 2.5px;

--origine-title-size: 36pt;
--origine-title-line-height: 1.25;

--origine-body-font: 'Cormorant Garamond', serif;
--origine-body-weight: 400;
--origine-body-size: 17pt;
--origine-body-line-height: 1.7;
--origine-body-max-width: 480px;
--origine-paragraph-gap: 24px;

--origine-photo-aspect: 4/5;
--origine-photo-filter: sepia(45%) saturate(70%) brightness(0.95) contrast(1.05);
--origine-caption-style: italic;
--origine-caption-color: #6B6863;

--origine-grid-gap-desktop: 64px;
```

### 6.4 — Comportements UX

#### Animation au scroll

```
[section invisible]              → état initial
[section atteint 80% viewport]   → texte fade-in + translate-up 16px (700ms)
[section atteint 60% viewport]   → photo fade-in 800ms (délai 200ms après texte)
[scroll continu]                 → photo parallaxe légère (translateY = scrollY × 0.05)
```

### 6.5 — Psychologie

#### Storytelling — la légitimité par narration

> Selon la recherche en consumer storytelling (Escalas 2004, van Laer 2014), les narrations engagent **trois zones cérébrales** que les arguments factuels n'engagent pas : l'aire de Broca, le sulcus temporal supérieur, et — surtout — le système de récompense.

L'origine japonaise n'est pas un argument *« voici nos références »*. C'est une **scène imaginée** par la lectrice. Elle visualise les ateliers, les mains, les artisanes. Cette visualisation **est la preuve**.

#### Indirect claim par lignée

Au lieu de dire *« notre marque est légitime »*, la page dit *« cette tradition est ancienne, et nous y appartenons ».*

#### Tactique : photo archive sépia — distance temporelle

> Bjornsdottir et al. (2024) : la **distance temporelle** augmente l'autorité perçue.
> Park & Hadi (2020) : les références à des temps lointains augmentent l'évaluation premium.

Une photo sépia 1920 est cognitivement perçue comme *plus loin*, donc *plus légitime*. C'est l'application du **construal level theory** (Trope & Liberman 2010) — la distance psychologique amplifie la perception abstraite, qui est elle-même associée au luxe.

### 6.6 — Émotion

| Avant | Pendant | Après |
| :---- | :------ | :---- |
| Curiosité philosophique | Compréhension narrative | Respect (« cette marque s'inscrit dans quelque chose ») |

### 6.7 — Erreurs à éviter

| Erreur                                          | Pourquoi c'est faux                                              |
| :---------------------------------------------- | :--------------------------------------------------------------- |
| Citer une date précise inventée                 | Vérifiable, et faux — détruit la crédibilité instantanément      |
| Citer une marque tierce comme « inspiration »   | Place FemiGlow en position tributaire                            |
| Photo Shutterstock générique de Japon           | Reconnaissable, banale, casse la magie                           |
| Texte trop long (4+ paragraphes)                | Tue le rythme — 2 paragraphes denses suffisent                   |
| Surtitre champagne au lieu de brume             | Tue la rareté du Champagne                                       |
| Photo en N&B pur (au lieu de sépia chaud)       | Trop journalistique, perd la chaleur narrative                   |
| Animation excessive sur le texte                | C'est de la lecture, pas un spectacle                            |

---

## 7 — Section 03 — Les quatre gestes · vidéo

### 7.1 — Wireframe

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│                  LE RITUEL EN MOUVEMENT                                    │
│                                                                            │
│                  Quatre gestes, quatre minutes.                            │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────┐     │
│  │                                                                  │     │
│  │                                                                  │     │
│  │                       [VIDÉO PLEIN ÉCRAN]                        │     │
│  │                       [ratio 16:9]                               │     │
│  │                       [autoplay muet]                            │     │
│  │                                                                  │     │
│  │                                                                  │     │
│  │  ▶ ━━━━━○━━━━━━━━━━━━━━━━━━━━━━━━━ 0:32 / 1:30   [⊜ FR]  [♪]    │     │
│  └──────────────────────────────────────────────────────────────────┘     │
│                                                                            │
│                  Filmée en lumière naturelle, à Casablanca.                │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 — Composition

#### Surtitre

```
LE RITUEL EN MOUVEMENT
```

Inter SemiBold 7.5pt, tracking 2.5px, couleur Brume `#6B6863`, centré.

#### Titre de section

```
Quatre gestes, quatre minutes.
```

Cormorant Light 32pt, couleur Encre, centré, espacement haut 12px.

### 7.3 — Spécifications du contenu vidéo

| Propriété              | Valeur                                                                  |
| :--------------------- | :---------------------------------------------------------------------- |
| Durée                  | 1:30 (90 secondes)                                                       |
| Ratio                  | 16:9                                                                     |
| Résolution master      | 4K (3840×2160) — pour archivage                                          |
| Résolutions diffusion  | 1080p (par défaut), 720p (3G), 480p (mobile lent)                        |
| Format                 | MP4 (H.264) + WebM (VP9) en fallback                                     |
| Bitrate cible 1080p    | 6 Mbps (qualité visuelle élevée pour un luxe perçu)                      |
| Audio                  | AAC 128 kbps, mais **muet par défaut** à l'autoplay                       |
| Frame rate             | 24 fps (cinéma — pas 30/60 qui font « vidéo amateur »)                    |

#### Composition cinématographique

| Propriété          | Valeur                                                            |
| :----------------- | :---------------------------------------------------------------- |
| Focale équivalente | 50mm (vision humaine) à 85mm (compression intime)                 |
| Profondeur de champ| Faible (f/2.0 à f/2.8) — flou esthétique sur les arrières-plans   |
| Mouvement caméra   | Slider très lent (5–10cm/s) — quasi statique                      |
| Lumière            | Naturelle latérale, **golden hour** (matin tôt ou fin d'après-midi)|
| Tonalité           | Calibrage chaud, ombres terreuses, hautes lumières crème          |
| Saturation         | -10% (légèrement désaturée pour la patine)                        |
| Stabilisation      | Rigoureuse — aucun shake, même léger                              |

#### Découpage narratif (90 secondes)

| Temps         | Plan                                                              | Geste                          |
| :------------ | :---------------------------------------------------------------- | :----------------------------- |
| 0:00 – 0:08   | Établissement : table de soin, mains au repos, lumière             | Préparation visuelle           |
| 0:08 – 0:28   | Geste 1 — Préparer (la pâte)                                      | `paste`                        |
| 0:28 – 0:30   | Transition : un linge plié se déplie                              | Respiration                    |
| 0:30 – 0:50   | Geste 2 — Lisser (la poudre)                                      | `powder`                       |
| 0:50 – 0:52   | Transition : ombre passe sur la table                              | Respiration                    |
| 0:52 – 1:12   | Geste 3 — Polir (le buffer)                                       | `shine`                        |
| 1:12 – 1:14   | Transition : une main se repose                                   | Respiration                    |
| 1:14 – 1:25   | Geste 4 — Révéler (la finition)                                   | `polish`                       |
| 1:25 – 1:30   | Final : la main, finie, posée — silence — fade to crème            | Climax silencieux              |

#### Son

Pas de musique. Pas de voix off (sauf en captions optionnelles).

Le son ambient, **uniquement** :
- Frottement doux du linge
- Tintement très léger des pots qu'on déplace
- Silence respirant entre les gestes

> **Pourquoi pas de musique ?** Parce que la musique impose une émotion. Le silence laisse la cliente **projeter sa propre émotion**. C'est l'équivalent sonore de l'empty space visuel.

#### Aucun visage

Le cadrage exclut systématiquement le visage. Maximum : la naissance d'un poignet, le bord d'une manche. Les mains sont **anonymes** par construction (cf. Lu 2023).

### 7.4 — Player vidéo — UI

> **Pas de player natif** (HTML5 default). Un player custom, sobre, fidèle à la marque.

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│  ▶  ━━━━━━━━━○━━━━━━━━━━━━━━━━━━━━  0:32 / 1:30   [⊜ FR]  [♪] │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

| Élément                | Spécifications                                                |
| :--------------------- | :------------------------------------------------------------ |
| Bouton play/pause      | Cercle 32px, fond crème opacité 0.85, icône encre 14px       |
| Barre de progression   | Hauteur 2px, fond brume 0.3, fill sauge dark                  |
| Pin de progression     | Cercle 8px, sauge dark, visible sur hover de la barre         |
| Timecode               | Inter Regular 11pt, couleur crème opacité 0.85                |
| Bouton captions        | Pill 32px hauteur, padding 4px 10px, label « FR » ou « AR »   |
| Bouton son             | Icône 16px, off par défaut (muet)                             |
| Position contrôles     | Overlay bas, hauteur 56px, gradient transparent → encre       |
| Apparition contrôles   | Visible 3s à l'ouverture, masqué après inactivité 2s          |

#### Captions (sous-titres)

Format SRT et VTT. Trois pistes : **FR** (par défaut, désactivée), **AR** (arabe), **OFF** (aucune).

Le texte des captions narre le rituel **sans le décrire**. Exemples :

```
0:08 → 0:12   « Préparer. »
0:13 → 0:18   « Quelques secondes pour la pâte. »
0:20 → 0:25   « Le geste vient avec le temps. »
```

Tonalité **éditoriale**, pas instructive.

| Propriété captions | Valeur                                            |
| :----------------- | :------------------------------------------------ |
| Police             | Cormorant Garamond Regular                        |
| Taille             | 16pt                                              |
| Couleur            | `#FBF8F1` (Crème pure) avec ombre noire 0.6       |
| Position           | Bas-centre, 80px du bord inférieur                 |
| Alignement         | Centré                                             |

### 7.5 — Légende sous la vidéo

```
Filmée en lumière naturelle, à Casablanca.
```

Inter Regular Italic 11pt, couleur Brume, centré, espacement haut 16px.

### 7.6 — Comportements UX

#### Autoplay et son

| Comportement         | Spécification                                                         |
| :------------------- | :-------------------------------------------------------------------- |
| Autoplay             | OUI — quand la section atteint 50% du viewport (intersection observer) |
| Son par défaut       | **MUET** — la cliente active le son explicitement                     |
| Loop                 | OUI — la vidéo rejoue indéfiniment                                    |
| Pause au hors-écran  | OUI — pause quand la section sort du viewport                         |
| Pause au tab inactif | OUI — pause quand l'onglet n'est plus visible                         |

#### Plein écran

Bouton plein écran disponible en bas-droite des contrôles. Si autoplay muet, le son **reste muet** en plein écran.

### 7.7 — Tokens design

```css
/* ─── Section Vidéo — tokens ─── */
--video-container-max-width: 1280px;
--video-aspect-ratio: 16/9;
--video-bg: #2C2A28;

--video-control-bg: rgba(44,42,40,0.6);
--video-control-text: #FBF8F1;
--video-control-progress-bg: rgba(255,255,255,0.3);
--video-control-progress-fill: #A8C4A6;     /* Sauge dark */
--video-control-pin-color: #A8C4A6;

--video-captions-font: 'Cormorant Garamond', serif;
--video-captions-size: 16pt;
--video-captions-color: #FBF8F1;
--video-captions-shadow: 0 1px 4px rgba(0,0,0,0.6);

--video-caption-credit-style: italic;
--video-caption-credit-color: #6B6863;
```

### 7.8 — Psychologie

#### Slow motion = perception de luxe

> Togawa & Sugitani (2022) : *« Slow movements heighten the perceived importance of luxury products. »*

La vidéo est tournée à 24fps avec un mouvement de caméra **5cm/s**. Tout est lent. Cette lenteur visuelle **conditionne** la lectrice à percevoir le contenu comme important.

#### Imply human (encore)

> Lu et al. (2023) — la présence humaine en e-commerce **diminue** les conversions de 18% en moyenne, sauf si elle est **suggérée**.

Les mains visibles, l'absence de visage, la composition centrée sur les objets — tout est imply human.

#### Autoplay éthique (muet)

> Google & Mozilla guidelines : un autoplay avec son est **interdit** par défaut sur Chrome, Firefox, Safari depuis 2018.

L'autoplay muet est non seulement éthique mais **techniquement nécessaire**. Plus important : c'est un **signal de respect**.

#### F-pattern interrompu

Cette section interrompt délibérément le F-pattern (lecture séquentielle gauche-droite-bas) en plaçant une vidéo **immersive plein écran**. C'est un **arrêt narratif** — l'œil ne lit plus, il **regarde**.

### 7.9 — Émotion

| Avant | Pendant | Après |
| :---- | :------ | :---- |
| Respect intellectuel | Compréhension corporelle | Désir tactile (« mes mains aussi peuvent ») |

### 7.10 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| Musique en background                               | Impose une émotion, viole le silence luxe                          |
| Voix off explicative                                 | Transforme la vidéo en tutoriel YouTube                            |
| Filmé à 30/60fps                                    | Look « vidéo amateur », pas cinéma                                 |
| Visage présent dans le cadre                        | Concurrence le produit, baisse les conversions (Lu 2023)            |
| Sous-titres FR ON par défaut                        | La cliente choisit son rapport au son                              |
| Vidéo > 2 minutes                                   | Trop long — l'attention décroche au-delà de 90s                    |
| Bouton « Voir le kit » overlay sur la vidéo         | Brutalité commerciale, casse l'émotion                             |
| Filtre Instagram visible                            | Saigne la crédibilité éditoriale                                   |
| Compression visible (artefacts)                     | Bitrate trop bas, perception bon marché                            |

---

## 8 — Section 04 — Sciences du soin

### 8.1 — Wireframe

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│  POURQUOI UN SOIN, ET PAS UN VERNIS                                        │
│                                                                            │
│  L'ongle n'est pas une surface. C'est une matière vivante.                 │
│                                                                            │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │
│  │              │    │              │    │              │                 │
│  │  La kératine │    │  Le pH       │    │  L'abrasion  │                 │
│  │  respire.    │    │  équilibré.  │    │  contrôlée.  │                 │
│  │              │    │              │    │              │                 │
│  │  3 lignes    │    │  3 lignes    │    │  3 lignes    │                 │
│  │  Inter       │    │  Inter       │    │  Inter       │                 │
│  │              │    │              │    │              │                 │
│  └──────────────┘    └──────────────┘    └──────────────┘                 │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────┐     │
│  │                                                                  │     │
│  │                  [SCHÉMA SCIENTIFIQUE SOBRE]                     │     │
│  │                  Coupe d'un ongle — 3 couches                    │     │
│  │                                                                  │     │
│  └──────────────────────────────────────────────────────────────────┘     │
│                                                                            │
│  Sources : Wagner et al. (2017) · Schoon (2020) · Iorizzo (2015)           │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 — Composition

#### Surtitre

```
POURQUOI UN SOIN, ET PAS UN VERNIS
```

Inter SemiBold 7.5pt, tracking 2.5px, couleur Brume.

#### Titre de section

```
L'ongle n'est pas une surface. C'est une matière vivante.
```

Cormorant Light 32pt, couleur Encre, ligne unique sur desktop, deux lignes mobile (coupure après « surface. »).

### 8.3 — Trois colonnes — les principes scientifiques

#### Disposition

| Breakpoint | Layout                                                |
| :--------- | :---------------------------------------------------- |
| Desktop    | 3 colonnes égales, gap 32px                           |
| Tablet     | 3 colonnes serrées, gap 20px                          |
| Mobile     | 1 colonne empilée verticalement, gap 32px             |

#### Spécifications de chaque colonne

| Propriété          | Valeur                                                  |
| :----------------- | :------------------------------------------------------ |
| Largeur            | 33.3% - gap (desktop)                                    |
| Padding            | 32px 24px                                                |
| Fond               | `#FBF8F1` (Crème) — pas de border, pas d'ombre           |
| Numérotation       | Aucune (la science n'a pas besoin de chiffres)           |

#### Texte des trois colonnes

##### Colonne 1 — La kératine respire

**Titre** : `La kératine respire.`

**Corps** :

```
L'ongle est constitué de kératine — la même protéine
que les cheveux. Comme eux, il a besoin d'oxygène pour
rester souple. Le vernis le suffoque. Le rituel, lui,
nourrit sans étouffer.
```

##### Colonne 2 — Le pH équilibré

**Titre** : `Le pH équilibré.`

**Corps** :

```
La surface de l'ongle a un pH naturel autour de 5,5.
Les solvants des vernis classiques (acétate d'éthyle,
toluène) déséquilibrent cette acidité protectrice.
Notre rituel respecte ce pH, à chaque étape.
```

##### Colonne 3 — L'abrasion contrôlée

**Titre** : `L'abrasion contrôlée.`

**Corps** :

```
Le polissage japonais ne lime pas — il lisse.
Différence essentielle : limer enlève de la matière
(amincit l'ongle). Lisser réorganise la surface
(la rend brillante sans la fragiliser).
```

#### Spécifications typographiques des colonnes

| Propriété          | Valeur                                                  |
| :----------------- | :------------------------------------------------------ |
| Police titre       | Cormorant Garamond Light 22pt                            |
| Couleur titre      | `#2C2A28` (Encre)                                       |
| Police corps       | Inter Regular 13pt                                       |
| Line-height corps  | 1.65                                                     |
| Couleur corps      | `#4A4844` (Encre claire)                                 |
| Espacement titre/corps | 16px                                                 |
| Largeur ligne max  | ~32 caractères (force la lisibilité)                     |

### 8.4 — Schéma scientifique (sous les colonnes)

| Propriété          | Valeur                                                  |
| :----------------- | :------------------------------------------------------ |
| Type               | Illustration vectorielle SVG (pas une photo médicale)    |
| Sujet              | Coupe transversale stylisée d'un ongle — 3 couches      |
| Style              | Trait fin (1px), encre sur crème, légendes Inter Regular 9pt |
| Couleurs           | `#2C2A28` (Encre, traits) + `#C5DBC4` (Sauge, couches mises en valeur) |
| Largeur            | 600px (desktop) · 100% (mobile)                          |
| Hauteur            | 240px                                                    |
| Légende            | Inter Regular Italic 10pt, couleur Brume, centrée sous   |

#### Annotations sur le schéma

```
┌─────────────────────────────────────┐
│                                     │
│     La couche supérieure ──────► [zone polish]   │
│                                     │
│     Le matrix protecteur ──────► [zone shine]    │
│                                     │
│     La kératine vivante ──────► [zone paste]     │
│                                     │
└─────────────────────────────────────┘
        Coupe d'un ongle (×40)
```

### 8.5 — Bandeau sources

Sous le schéma, un filet horizontal puis :

```
Sources : Wagner et al. (2017) · Schoon (2020) · Iorizzo (2015)
```

| Propriété          | Valeur                                                  |
| :----------------- | :------------------------------------------------------ |
| Police             | Inter Regular 10pt                                       |
| Style              | italic                                                   |
| Couleur            | `#6B6863` (Brume)                                       |
| Espacement haut    | 32px (sous le schéma)                                    |
| Alignement         | Centré                                                   |

> **Pourquoi citer des sources ?** Parce que la cliente CSP B+ urbaine **vérifie**. Elle ne lira probablement pas les articles cités, mais leur présence suffit à cocher la case *« cette marque cite des recherches ».* C'est le **proof signal** de Cialdini, appliqué à la science.

### 8.6 — Tokens design

```css
/* ─── Section Sciences — tokens ─── */
--sciences-bg: #FBF8F1;
--sciences-padding-vertical: 96px;

--sciences-title-size: 32pt;
--sciences-title-color: #2C2A28;

--sciences-column-padding: 32px 24px;
--sciences-column-gap-desktop: 32px;
--sciences-column-gap-mobile: 32px;

--sciences-column-title-font: 'Cormorant Garamond', serif;
--sciences-column-title-weight: 300;
--sciences-column-title-size: 22pt;

--sciences-column-body-font: 'Inter', sans-serif;
--sciences-column-body-size: 13pt;
--sciences-column-body-line-height: 1.65;
--sciences-column-body-color: #4A4844;

--sciences-schema-stroke: #2C2A28;
--sciences-schema-accent: #C5DBC4;
--sciences-schema-stroke-width: 1px;

--sciences-sources-style: italic;
--sciences-sources-size: 10pt;
--sciences-sources-color: #6B6863;
```

### 8.7 — Comportements UX

#### Animation au scroll

```
[section invisible]              → état initial
[atteint 75% viewport]           → titre fade-in (700ms)
[atteint 65%]                    → 3 colonnes fade-in séquentiel (200ms entre chaque, 600ms chacune)
[atteint 50%]                    → schéma fade-in + tracé SVG s'anime (1200ms)
```

#### Animation du schéma SVG

Au moment du fade-in, les traits du schéma se **dessinent** progressivement (animation `stroke-dashoffset` de la longueur totale → 0).

| Propriété         | Valeur                                          |
| :---------------- | :---------------------------------------------- |
| Durée totale      | 1200ms                                          |
| Easing            | `cubic-bezier(0.4, 0, 0.2, 1)`                  |
| Trigger           | Intersection 50% du viewport                     |
| Reduced motion    | Apparition instantanée (pas de tracé animé)     |

> **Pourquoi pas de hover ?** Parce que la science n'est pas interactive. Elle est posée. La cliente lit, comprend, continue.

### 8.8 — Psychologie

#### Crédibilité par citation académique

> Pornpitakpan (2004) : *« Source credibility is the most powerful determinant of persuasion in low-involvement contexts. »*

Trois noms d'auteurs cités, format académique standard. La cliente n'a pas besoin de connaître Wagner ou Schoon — leur **format de citation** suffit. Effet de halo : *« si on cite des chercheurs, c'est sérieux ».*

> **Note** : les noms cités sont des **chercheurs réels** ayant publié sur la dermatologie de l'ongle (Schoon, Iorizzo) ou la cosmétologie (Wagner). **Toujours vérifier** avant publication.

#### Risk reduction (9 types — Lantos 2011)

> Lantos identifie 9 types de risques perçus avant achat : financier, fonctionnel, physique, psychologique, social, temporel, écologique, sanitaire, légal.

Les trois colonnes répondent à des risques différents :

| Colonne       | Risque adressé           | Mécanisme                                        |
| :------------ | :----------------------- | :----------------------------------------------- |
| Kératine      | Sanitaire / physique     | « ne suffoque pas comme le vernis »              |
| pH            | Sanitaire / chimique     | « respecte l'acidité naturelle »                 |
| Abrasion      | Physique / esthétique    | « lisse sans amincir »                           |

#### Indirect claims dans les titres

| Titre direct (à éviter)              | Titre indirect (retenu)             |
| :----------------------------------- | :---------------------------------- |
| « Notre formule contient X et Y »    | `La kératine respire.`              |
| « pH neutre garanti »                | `Le pH équilibré.`                  |
| « Polissage doux »                   | `L'abrasion contrôlée.`             |

Les titres sont **personnifiés** (la kératine *respire*, le pH *équilibre*, l'abrasion *se contrôle*) — comme si la matière elle-même était l'agent.

### 8.9 — Émotion

| Avant | Pendant | Après |
| :---- | :------ | :---- |
| Compréhension corporelle | Légitimation rationnelle | Confiance scientifique calme |

### 8.10 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| Inventer des chiffres (« +47% de brillance »)       | Marketing performance — détonne dans le ton éditorial               |
| Photo médicale clinique (vraie coupe d'ongle)       | Effrayant, cosmétiquement déplacé                                   |
| Liste à puces                                       | Code des fiches produit — casse l'éditorial                        |
| Plus de 3 principes                                 | Surcharge cognitive — 3 est le nombre magique                       |
| Sources fausses ou approximatives                   | Tue la crédibilité quand vérifié                                   |
| Schéma SVG en couleurs vives                        | Sort de la palette                                                  |
| Titres directifs (« La kératine doit respirer »)    | Imposition — la matière respire seule, pas par notre permission     |

---

## 9 — Section 05 — Témoignage d'une initiée

### 9.1 — Wireframe

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│  ENTRETIEN                                                                 │
│                                                                            │
│  « J'ai redécouvert mes mains. »                                           │
│                                                                            │
│  ┌──────────────────────────┐    ┌────────────────────────────────────┐  │
│  │                          │    │                                    │  │
│  │  [photo implied]          │    │  — Comment avez-vous découvert    │  │
│  │  [tasse de thé sur table]│    │    le rituel ?                     │  │
│  │  [livre ouvert à côté]   │    │                                    │  │
│  │  [ongles posés en flou]  │    │    Réponse Cormorant Regular.      │  │
│  │                          │    │                                    │  │
│  └──────────────────────────┘    │  — Que change-t-il dans votre      │  │
│                                  │    semaine ?                        │  │
│  Khadija, Rabat.                 │    ...                              │  │
│  Initiée depuis février 2026.    │                                    │  │
│                                  │  ... 5 questions au total ...       │  │
│                                  │                                    │  │
│                                  └────────────────────────────────────┘  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 9.2 — Composition

#### Surtitre

```
ENTRETIEN
```

Inter SemiBold 7.5pt, tracking 2.5px, couleur Brume.

#### Titre — citation phare

```
« J'ai redécouvert mes mains. »
```

| Propriété          | Valeur                                                  |
| :----------------- | :------------------------------------------------------ |
| Police             | Cormorant Garamond Light Italic                          |
| Taille             | 38pt (desktop) · 28pt (tablet) · 22pt (mobile)           |
| Couleur            | `#2C2A28` (Encre)                                       |
| Guillemets         | Français typographiques `« »` avec espaces insécables   |
| Disposition        | Une ligne (desktop) ou deux (mobile)                     |
| Espacement haut    | 96px                                                     |

> Cette citation est sélectionnée parmi les 5 réponses comme la plus puissante. Elle sert de **header narratif** — comme dans un magazine.

### 9.3 — Layout du contenu

| Breakpoint | Layout                                                                |
| :--------- | :-------------------------------------------------------------------- |
| Desktop    | 35% photo+légende (gauche) · 65% interview (droite) — gap 64px         |
| Tablet     | 40% photo · 60% interview — gap 48px                                   |
| Mobile     | 100% photo+légende, puis 100% interview (empilés) — gap 48px           |

### 9.4 — Photo « implied » + légende

#### Photo

| Propriété         | Valeur                                                                |
| :---------------- | :-------------------------------------------------------------------- |
| Sujet             | Détail de la table de soin de Khadija — tasse de thé, livre ouvert, ongles posés en flou doux |
| Composition       | Aérienne légèrement, lumière naturelle indirecte                      |
| Tonalité          | Calibrage chaud, légèrement plus saturé que la photo origine          |
| Format            | 4:5 (portrait)                                                         |
| Largeur affichée  | 320px (desktop) · 100% (mobile)                                        |

#### Légende sous la photo

```
Khadija, Rabat.
Initiée depuis février 2026.
```

| Élément          | Spécifications                                          |
| :--------------- | :------------------------------------------------------ |
| Prénom + Ville   | Inter Medium 13pt, couleur Encre, ligne 1                |
| Mention initiée  | Inter Regular 11pt italic, couleur Brume, ligne 2        |
| Espacement haut  | 16px sous la photo                                       |

### 9.5 — Interview — format Q/R · copy intégral

#### Question 1

**Q :** *Comment avez-vous découvert le rituel ?*

**R :**

```
Une amie revenue d'un voyage à Tokyo m'a montré ses ongles.
Aucun vernis. Une lumière intérieure que je n'avais jamais
vue chez elle. J'ai posé la question. Elle a parlé d'un soin
qui ne fait rien — qui révèle. J'ai cherché en rentrant chez
moi, et j'ai trouvé FemiGlow.
```

#### Question 2

**Q :** *Que change-t-il dans votre semaine ?*

**R :**

```
Quatre minutes le dimanche soir, c'est tout. C'est devenu une
ponctuation. Avant, mes mains n'existaient pas. Maintenant
elles ont leur moment. Je crois que c'est ça que j'ai retrouvé
— une attention, pas un produit.
```

#### Question 3

**Q :** *Combien de temps avant de voir un effet ?*

**R :**

```
La première fois, j'ai vu une différence dans l'heure.
Pas spectaculaire — juste une matité qui était partie. Au
bout de trois rituels, mes ongles avaient changé de tonalité.
Plus rosés à la base, plus clairs au bord. Une santé qui se
voit, sans qu'on l'ait peinte.
```

#### Question 4

**Q :** *Y a-t-il des moments où vous ne le faites pas ?*

**R :**

```
Bien sûr. Les semaines difficiles, je saute. Mais je ne me
le reproche pas — c'est un rituel, pas un devoir. Quand je
le retrouve, il me retrouve. C'est la différence entre une
discipline et une amitié.
```

#### Question 5

**Q :** *Que recommanderiez-vous à une amie qui débute ?*

**R :**

```
De ne pas chercher la perfection au premier essai. Le geste
vient avec le temps. Le rituel apprend la main, pas l'inverse.
Et de ne pas l'envisager comme un soin de beauté — c'est plus
proche d'un thé l'après-midi. Une présence. Pas un résultat.
```

### 9.6 — Spécifications typographiques de l'interview

| Élément             | Police                              | Taille     | Couleur          | Style                      |
| :------------------ | :---------------------------------- | :--------- | :--------------- | :------------------------- |
| Question (label)    | Inter SemiBold                      | 11pt       | `#6B6863` Brume  | uppercase, tracking 2px    |
| Question (texte)    | Cormorant Garamond Light Italic     | 16pt       | `#2C2A28` Encre  | italic                     |
| Réponse             | Cormorant Garamond Regular           | 16pt       | `#2C2A28` Encre  | regular                    |
| Line-height réponse | —                                   | 1.65       | —                | —                          |
| Espace Q → R        | —                                   | 12px       | —                | —                          |
| Espace R → Q suivante | —                                  | 48px       | —                | filet 1px brume opacité 0.3 entre |

#### Format visuel d'une Q/R

```
— COMMENT AVEZ-VOUS DÉCOUVERT LE RITUEL ?

Une amie revenue d'un voyage à Tokyo m'a montré
ses ongles. Aucun vernis. Une lumière intérieure
que je n'avais jamais vue chez elle. J'ai posé
la question...
```

Le tiret `—` (cadratin U+2014) avant la question est intentionnel : il évoque le format **interview de magazine littéraire** (Le Monde, Vanity Fair, M Le Magazine).

### 9.7 — Tokens design

```css
/* ─── Section Témoignage — tokens ─── */
--temoignage-bg: #FBF8F1;
--temoignage-padding-vertical: 96px;

--temoignage-title-font: 'Cormorant Garamond', serif;
--temoignage-title-style: italic;
--temoignage-title-weight: 300;
--temoignage-title-size: 38pt;

--temoignage-photo-aspect: 4/5;
--temoignage-photo-width-desktop: 320px;

--temoignage-name-size: 13pt;
--temoignage-name-weight: 500;
--temoignage-date-style: italic;
--temoignage-date-color: #6B6863;

--temoignage-question-color: #6B6863;
--temoignage-question-weight: 600;
--temoignage-question-tracking: 2px;
--temoignage-question-size: 11pt;

--temoignage-answer-font: 'Cormorant Garamond', serif;
--temoignage-answer-size: 16pt;
--temoignage-answer-line-height: 1.65;
--temoignage-answer-color: #2C2A28;

--temoignage-qa-spacing: 48px;
--temoignage-separator: 1px solid rgba(107,104,99,0.3);
```

### 9.8 — Comportements UX

#### Animation au scroll

```
[atteint 80% viewport]   → titre citation fade-in + translate-up 12px (700ms)
[atteint 70%]             → photo + légende fade-in (600ms, délai 200ms)
[atteint 60%]             → Q/R apparaissent séquentiellement (200ms entre chaque)
```

#### Pas d'interaction sur les questions

Le format est statique — comme un magazine. Pas de clic, pas de tooltip.

### 9.9 — Psychologie

#### Mirror effect — identification mimétique

> Tajfel & Turner (1986) — Social identity theory : nous nous identifions plus aux personnes qui partagent **nos catégories sociales**.

**Khadija** (prénom marocain), **Rabat** (capitale, urbaine, CSP), **initiée depuis février 2026** (pas une débutante, pas une vétérane). Toutes les variables démographiques sont calibrées pour la **cible exacte**.

#### Authenticité par détail (Reber 2002)

> Les détails concrets augmentent la crédibilité perçue.

Khadija parle de :
- *« une amie revenue d'un voyage à Tokyo »* — détail spécifique
- *« quatre minutes le dimanche soir »* — détail temporel
- *« plus rosés à la base, plus clairs au bord »* — détail observationnel
- *« une matité qui était partie »* — détail sensoriel

Aucune généralité, aucun superlatif. Cette précision **est** la preuve.

#### Vulnérabilité contrôlée

> Berger & Heath (2007) — les témoignages avec **vulnérabilité avouée** sont plus persuasifs.

Question 4 : *« Y a-t-il des moments où vous ne le faites pas ? »* — Khadija répond honnêtement *« Bien sûr. Les semaines difficiles, je saute. »*

Cette **non-perfection** rend Khadija crédible. Elle n'est pas une ambassadrice marketing — elle est **une personne**.

#### Format magazine littéraire

> L'usage du tiret cadratin `—` au lieu de `Q :` ou `Question :` place visuellement l'interview dans le **registre éditorial**, pas commercial.

#### Aucune mention de prix, de panier, de conversion

Volontairement, dans toute la section. La cliente est en **lecture profonde**. La ramener au commerce serait sabotage.

### 9.10 — Émotion

| Avant | Pendant | Après |
| :---- | :------ | :---- |
| Confiance scientifique | Identification mimétique | Conviction émotionnelle (« je veux faire ce qu'elle fait ») |

### 9.11 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| Note 5/5 étoiles                                    | Code Amazon, casse le format magazine                              |
| Photo de visage de Khadija                          | Distraction, contamination (Argo 2006)                             |
| Témoignage marketing (« j'ai adoré ! »)             | Faux, perçu, contre-productif                                      |
| Trop de questions (>5)                              | Lecture lourde, décrochage                                         |
| Citation phare en bold (au lieu d'italic)           | Cormorant Light Italic est la signature des citations               |
| Lien « Voir tous les avis » à la fin                | Casse l'unicité — Khadija n'est pas un avis parmi d'autres          |
| CTA « Acheter maintenant » dans la section          | Brutalité commerciale, impardonnable ici                           |
| Vidéo ou audio à la place du texte                  | Perd la respiration de la lecture lente                            |

---

## 10 — Section 06 — Pivot vers le kit

### 10.1 — Wireframe

```
┌════════════════════════════════════════════════════════════════════════════┐
║                                                                            ║
║                                ╱──╲                                        ║
║                               ╱ ◆ ╲     ← fleuron champagne                ║
║                                ╲╱                                          ║
║                                                                            ║
║                  Maintenant que vous savez.                                ║
║                                                                            ║
║                  ┌─────────────────────────┐                                ║
║                  │   Recevoir le rituel    │                                ║
║                  └─────────────────────────┘                                ║
║                                                                            ║
└════════════════════════════════════════════════════════════════════════════┘
                            (fond sauge pâle pleine largeur)
```

### 10.2 — Composition

#### Fond

| Propriété      | Valeur                                  |
| :------------- | :-------------------------------------- |
| Couleur        | `#E8EFE7` (Sauge pâle)                  |
| Largeur        | 100% (déborde du container max)         |
| Hauteur        | 320px (desktop) · 280px (mobile)         |
| Padding vertical | 80px                                  |

#### Fleuron

Identique à celui des sections manifeste/newsletter de `/accueil` — losange champagne entre filets fins, taille 80×12px, couleur `#C8A876`, position centrée 32px au-dessus du texte.

> **Deuxième et dernière apparition du Champagne sur la page.** La première était dans le surtitre du hero (`LE RITUEL`). Cette répétition est **intentionnelle** : le Champagne ouvre la page, puis ouvre la conversion. **Symétrie graphique** de la lecture.

#### Texte du pivot

```
Maintenant que vous savez.
```

| Propriété      | Valeur                                                        |
| :------------- | :------------------------------------------------------------ |
| Police         | Cormorant Garamond Light                                      |
| Taille         | 36pt (desktop) · 28pt (tablet) · 22pt (mobile)                |
| Style          | Regular (pas italic — c'est une affirmation, pas une réflexion) |
| Couleur        | `#2C2A28` (Encre)                                             |
| Alignement     | Centré                                                        |
| Disposition    | Une seule ligne (le point final est crucial — affirmation, pas suspension) |

##### Pourquoi cette formulation ?

C'est un **acte de transmission**. La phrase dit :

- **« Maintenant »** — temporalité immédiate, le moment est venu.
- **« que vous savez »** — reconnaissance de l'effort de lecture. La cliente *a investi* du temps. La marque l'honore.
- **Le point final** — pas de virgule, pas de ellipse. La marque ne mendie pas l'achat. Elle constate.

> **Pas de virgule + suite implicite** comme *« Maintenant que vous savez, vous pouvez recevoir le rituel ».* Trop bavard. La phrase incomplète **invite** la cliente à compléter mentalement par le clic sur le CTA.

#### CTA

```
Recevoir le rituel
```

| Propriété          | Valeur                                                                |
| :----------------- | :-------------------------------------------------------------------- |
| Police             | Inter Medium                                                          |
| Taille             | 14pt                                                                  |
| Letter-spacing     | 0.5px                                                                 |
| Texte              | `#FBF8F1` (Crème pure)                                                |
| Fond               | `#2C2A28` (Encre)                                                     |
| Padding            | 18px 40px                                                             |
| Border-radius      | 0 (carré)                                                             |
| Hover              | Fond `#4A4844`, élévation `box-shadow: 0 4px 16px rgba(44,42,40,0.12)` |
| Active             | Scale 0.97                                                             |
| Focus              | Ring 2px sauge dark, offset 4px                                        |
| Action             | Navigation vers `/kit`                                                |
| Espacement haut    | 48px sous le texte                                                     |
| Position           | Centré                                                                |

##### Verbe « Recevoir »

| Verbe              | Famille            | Niveau d'engagement                         |
| :----------------- | :----------------- | :------------------------------------------ |
| **Découvrir**      | Ouverture          | Faible (TOFU — `/accueil`)                  |
| **Recevoir**       | Réception          | Moyen (MOFU — `/rituel`, `/kit`)            |
| **Acheter**        | Transaction        | Élevé (BOFU — `/commander`)                 |

Le verbe est **calibré au niveau du funnel**. La cliente arrivée ici est passée du *« je découvre »* au *« je peux recevoir »*. Elle n'est pas encore au *« j'achète »* — ce sera l'étape suivante (`/commander`).

> *« Recevoir »* implique aussi un **don**. Comme si le kit était une chose qu'on **vous offre** (en échange d'argent, certes, mais le verbe préfère le don). C'est l'inverse psychologique de *« acheter »* qui implique transaction et risque.

### 10.3 — Aucun autre élément

Cette section ne contient **rien d'autre**. Pas de prix indicatif, pas de réassurance « livraison 48h », pas de mini-témoignage, pas d'image de produit. **Tout cela appartient à `/kit`**, pas ici.

> **Pourquoi cette austérité ?** Parce que la conversion à ce point précis est psychologiquement **fragile**. La cliente est dans un état émotionnel rare — elle vient de finir une lecture engagée. Lui présenter une fiche produit visuelle la **sortirait** de cet état. Le pivot doit être **silencieux et précis**.

### 10.4 — Tokens design

```css
/* ─── Section Pivot Kit — tokens ─── */
--pivot-bg: #E8EFE7;                /* Sauge pâle */
--pivot-padding-vertical: 80px;
--pivot-fleuron-color: #C8A876;
--pivot-fleuron-margin: 32px;

--pivot-text-font: 'Cormorant Garamond', serif;
--pivot-text-weight: 300;            /* Light */
--pivot-text-size: 36pt;
--pivot-text-color: #2C2A28;

--pivot-cta-bg: #2C2A28;
--pivot-cta-text: #FBF8F1;
--pivot-cta-padding: 18px 40px;
--pivot-cta-margin-top: 48px;
```

### 10.5 — Comportements UX

#### Animation au scroll

```
[atteint 80% viewport]   → fond sauge fade-in (subtil — opacité 0 → 1, 600ms)
[atteint 70%]             → fleuron fade-in + scale-up 0.9 → 1 (500ms)
[atteint 60%]             → texte fade-in + translate-up 8px (700ms)
[atteint 50%]             → CTA fade-in + translate-up 12px (500ms, délai 300ms)
```

### 10.6 — Psychologie

#### P.A.S. framework — Problem · Agitate · Solve

> Le framework P.A.S. (Problem, Agitate, Solve) est l'un des plus puissants en copywriting (Schwartz 1966, ré-actualisé par Sugarman 1995).

Sur `/rituel`, le framework s'étale sur **toute la page** :

| Section         | Phase     | Ce qui se passe                                   |
| :-------------- | :-------- | :------------------------------------------------ |
| Hero            | (Hook)    | Promesse philosophique                             |
| Origine         | Problem   | « Le vernis suffoque »                             |
| Vidéo gestes    | Solve (preview) | « Voilà comment ça se passe »                |
| Sciences        | Agitate   | « Voici les dégâts d'un mauvais soin »             |
| Témoignage      | Solve (proof) | « Voilà ce que ça change »                     |
| **Pivot**       | **Solve (action)** | « Recevez le rituel »                       |

Le pivot est l'aboutissement narratif **logique** d'un parcours de 3 minutes de lecture. Pas un saut, pas une rupture — une continuité.

#### Verb of opening → verb of receiving

> Sur `/accueil`, le CTA était « Découvrir » (TOFU).
> Sur `/rituel`, le CTA est « Recevoir » (MOFU).
> Sur `/kit`, le CTA sera « Recevoir le rituel » (même verbe, plus précis).
> Sur `/commander`, ce sera « Confirmer la commande » (BOFU).

Cette **gradation linguistique** suit la gradation cognitive. La cliente ne saute jamais de palier.

#### Empty space

Le pivot fait 320px de hauteur. Le texte + CTA + fleuron font ensemble ~120px de hauteur visuelle. Le **reste, soit 60% de la section, est vide**.

> Cette quantité de vide est **psychologiquement lourde**. Elle force l'attention sur les seuls éléments présents (Sevilla & Townsend 2016).

### 10.7 — Émotion

| Avant | Pendant | Après |
| :---- | :------ | :---- |
| Conviction émotionnelle | Reconnaissance (« on me parle ») | Décision possible (« oui, je vais le faire ») |

### 10.8 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| Ajouter le prix dans la section                     | Sort de l'émotion, ramène au calcul                                 |
| Ajouter une photo du kit                            | Concurrence le verbe, dilue l'attention                             |
| Countdown ou urgency (« Plus que 12 en stock »)     | Détruit la marque luxe en une seconde                              |
| Bouton secondaire « Voir le kit avant »             | Multiplie les choix, fatigue la décision                           |
| Texte plus long (« Maintenant que vous savez, vous pouvez... ») | Bavard, perd la grâce de la phrase suspendue       |
| Hover du CTA avec animation excessive               | Le luxe ne tremble pas                                              |
| Position non centrée                                | Le pivot est un **monument** — il doit être au centre               |

---

## 11 — Section 07 — Cross-link Journal

### 11.1 — Wireframe

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│  POUR ALLER PLUS LOIN                                                      │
│                                                                            │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐  │
│  │                    │  │                    │  │                    │  │
│  │  [photo lifestyle] │  │  [photo lifestyle] │  │  [photo lifestyle] │  │
│  │                    │  │                    │  │                    │  │
│  │  Pourquoi la       │  │  Hiver, ongles, et │  │  Mon premier       │  │
│  │  patine est plus   │  │  patience.         │  │  rituel — récit    │  │
│  │  belle qu'un       │  │                    │  │  d'une initiée.    │  │
│  │  vernis.           │  │  ─                 │  │  ─                 │  │
│  │  ─                 │  │  Le 12 avril 2026  │  │  Le 28 mars 2026   │  │
│  │  Le 5 mai 2026     │  │                    │  │                    │  │
│  └────────────────────┘  └────────────────────┘  └────────────────────┘  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 11.2 — Composition

#### Surtitre

```
POUR ALLER PLUS LOIN
```

Inter SemiBold 7.5pt, tracking 2.5px, couleur Brume, centré.

#### Disposition

| Breakpoint | Layout                                                  |
| :--------- | :------------------------------------------------------ |
| Desktop    | 3 cartes égales, gap 24px (grille régulière, pas asymétrique cette fois) |
| Tablet     | 3 cartes égales, gap 20px                                |
| Mobile     | Carrousel swipe, 1 carte visible + aperçu                |

> **Pourquoi grille régulière (pas asymétrique comme `/accueil`) ?** Parce que sur `/rituel`, ces 3 articles sont des **alternatives équivalentes** — chacun mérite la même attention. Sur `/accueil`, l'article hero était l'invitation principale ; ici, ce sont trois portes pareilles.

#### Composition d'une carte

```
┌────────────────────────┐
│                        │
│  [photo lifestyle]     │
│  ratio 4:3             │
│                        │
│  Titre Cormorant       │
│  ─                     │
│  Le [date]             │
└────────────────────────┘
```

| Élément       | Spécifications                                                              |
| :------------ | :-------------------------------------------------------------------------- |
| Photo         | Lifestyle, ratio 4:3, hauteur 220px (desktop) · 180px (mobile)              |
| Titre         | Cormorant Light 18pt, couleur Encre, sous la photo, espacement haut 16px    |
| Filet         | 1px brume opacité 0.4, largeur 16px, couleur sauge dark, espacement haut 12px |
| Date          | Inter Regular 10pt, couleur Brume, espacement haut 8px                      |
| Padding card  | 20px (interne)                                                              |
| Hover         | Photo zoom-in 1.04 scale + titre underline subtle (offset 4px), 600ms       |
| Cursor        | `pointer` — la carte entière est cliquable                                  |

### 11.3 — Trois articles connexes — exemples concrets

| # | Titre                                                            | Catégorie  | Date          | Lien            |
| :- | :--------------------------------------------------------------- | :--------- | :------------ | :-------------- |
| 1 | *« Pourquoi la patine est plus belle qu'un vernis. »*            | Maison     | 5 mai 2026    | `/journal/patine-versus-vernis` |
| 2 | *« Hiver, ongles, et patience. »*                                | Saison     | 12 avril 2026 | `/journal/hiver-ongles-patience` |
| 3 | *« Mon premier rituel — récit d'une initiée. »*                  | Voix       | 28 mars 2026  | `/journal/premier-rituel`      |

> **Critère de sélection** : ces trois articles **prolongent** chacun un thème de la page. L'article 1 prolonge la science (sciences vs vernis). L'article 2 prolonge la pratique (quand, comment). L'article 3 prolonge le témoignage (autres voix).

### 11.4 — Tokens design

```css
/* ─── Section Cross-link Journal — tokens ─── */
--crosslink-bg: #FBF8F1;
--crosslink-padding-vertical: 80px;

--crosslink-grid-gap-desktop: 24px;
--crosslink-card-padding: 20px;

--crosslink-photo-height-desktop: 220px;
--crosslink-photo-height-mobile: 180px;

--crosslink-title-font: 'Cormorant Garamond', serif;
--crosslink-title-weight: 300;
--crosslink-title-size: 18pt;
--crosslink-title-color: #2C2A28;

--crosslink-date-color: #6B6863;
--crosslink-date-size: 10pt;

--crosslink-card-hover-scale: 1.04;
--crosslink-card-hover-duration: 600ms;
```

### 11.5 — Psychologie

#### Deep engagement (rétention par contenu)

> Le but n'est plus de convertir — la conversion principale (vers `/kit`) a eu lieu en section 10. Cette section sert à **retenir** la lectrice qui ne convertit pas immédiatement.

Trois articles donnent **trois portes de sortie qualifiées** :
- Si elle ne convertit pas, elle peut prolonger sa lecture.
- Si elle prolonge sa lecture, elle reste dans l'écosystème.
- Si elle reste dans l'écosystème, elle reviendra sur `/kit` plus tard.

#### Gestalt — grille régulière

> La régularité de la grille (3 cartes identiques) signale **équivalence**. Aucun article n'est plus important qu'un autre. La cliente choisit selon son intérêt, pas selon une hiérarchie marketing.

#### Pas de CTA explicite — la carte est le CTA

> Friction zero : aucun bouton « Lire l'article ». La carte entière est cliquable. Le hover (zoom + underline) signale l'interactivité.

### 11.6 — Émotion

| Avant | Pendant | Après |
| :---- | :------ | :---- |
| Décision (achat ou repli) | Curiosité de prolongement | Engagement long terme (« cette marque a du contenu, j'y reviendrai ») |

### 11.7 — Erreurs à éviter

| Erreur                                        | Pourquoi c'est faux                                              |
| :-------------------------------------------- | :--------------------------------------------------------------- |
| Plus de 3 articles                            | Choice paralysis — au-delà de 3, la décision se brouille          |
| Mélange B2C/B2B                               | Articles B2B casseraient le tunnel B2C en cours                  |
| Articles non-contextualisés (random)          | Perte d'effort — choisir 3 articles **liés** au contenu lu       |
| Boutons « Lire l'article » individuels        | Friction inutile, casse le code éditorial                        |
| Dates au format JJ/MM/AAAA                    | Trop fonctionnel — préférer « Le 5 mai 2026 »                     |
| Catégories visibles sur les cartes (badges)   | Surcharge visuelle, hiérarchise inutilement                      |
| Articles sponsorisés ou affiliés              | Détruit la confiance éditoriale                                  |

---

## 12 — Footer — élément persistant

### 12.1 — Structure héritée

Le footer de `/rituel` est **identique** à celui de `/accueil` — c'est un élément global du site (charte d'architecture, page 11 du document précédent).

### 12.2 — Spécificités sur `/rituel`

| Différence              | Spécification                                                       |
| :---------------------- | :------------------------------------------------------------------ |
| **Item « Le rituel »**  | Dans la colonne « LE RITUEL » du footer, l'item est **visuellement actif** : couleur `#FBF8F1` Crème pure (au lieu de `#E8E0D2` Ligne) + soulignement subtil 1px sauge dark, offset 6px |
| **Newsletter**          | **Aucune apparition newsletter dans le footer** — elle est réservée à `/journal` (cohérence éditoriale) |
| **Espacement avec Cross-link** | 80px de padding vertical entre la fin de la section 07 et le début du footer |

### 12.3 — Rappel des spécifications globales

| Propriété      | Valeur                                                |
| :------------- | :---------------------------------------------------- |
| Hauteur        | 320px (desktop) · auto (mobile, accordion)            |
| Fond           | `#2C2A28` (Encre)                                     |
| Padding        | 64px 96px (desktop) · 48px 24px (mobile)              |
| Layout         | Grid 5 colonnes (1 wordmark + 4 liens)                 |

### 12.4 — Cohérence des liens internes

Sur `/rituel`, les liens du footer pointent vers les pages **non encore visitées** par la cliente. Si elle a déjà cliqué sur un lien du Journal pendant sa lecture, le footer ne va pas la **re-suggérer** — c'est le rôle des cookies de navigation pour personnaliser légèrement (sans rompre l'unicité du footer).

> **Implementation note** : pas de personnalisation visible du footer en MVP. La même version pour toutes les visiteuses. La personnalisation est une optimisation V2.

---

## 13 — Comportements transverses

### 13.1 — Smooth scroll

`scroll-behavior: smooth` activé en CSS.

Désactivé si :
- L'utilisateur a `prefers-reduced-motion: reduce` activé.
- Sur les ancres rapides (jump links) : scroll instantané sur Cmd/Ctrl+click.

### 13.2 — Lazy loading des images et de la vidéo

| Type d'image / média     | Stratégie                                            |
| :----------------------- | :--------------------------------------------------- |
| Hero (above fold)        | `loading="eager"`, preload                           |
| Photo Origine            | `loading="lazy"`, intersection observer              |
| **Vidéo 4 gestes**       | `preload="metadata"` — pas le payload complet         |
| Schéma SVG sciences      | Inline dans le HTML (pas de requête)                 |
| Photo Témoignage         | `loading="lazy"`                                     |
| Photos Cross-link        | `loading="lazy"`                                     |
| Footer                   | (aucune image)                                       |

#### Stratégie spéciale vidéo

| Étape                            | Action                                                                  |
| :------------------------------- | :---------------------------------------------------------------------- |
| Page chargée                     | Vidéo : `preload="metadata"` — chargement uniquement des métadonnées    |
| Section 03 atteint 80% viewport  | `preload="auto"` — chargement progressif du payload                     |
| Section 03 atteint 50% viewport  | Lecture autoplay muet déclenchée                                        |
| Section 03 sort du viewport      | Pause + `preload="metadata"` (libère la bande passante)                 |

> **Économie de bande passante** : sur mobile, une vidéo 90s à 6 Mbps représente ~67 MB. Charger uniquement quand nécessaire évite de pénaliser les visiteuses qui ne descendent pas jusqu'à la section 03.

### 13.3 — Format d'image

| Format primaire | Format fallback | Compression |
| :-------------- | :-------------- | :---------- |
| WebP            | JPEG            | Qualité 80, profil sRGB |
| AVIF (futur)    | WebP, JPEG      | Qualité 75  |

### 13.4 — Format vidéo

| Format primaire | Format fallback | Bitrate cible 1080p |
| :-------------- | :-------------- | :------------------ |
| MP4 (H.264)     | WebM (VP9)      | 6 Mbps              |
| MP4 720p        | WebM 720p       | 3 Mbps              |
| MP4 480p        | WebM 480p       | 1.2 Mbps            |

Streaming HLS si possible (Cloudflare Stream, Mux, ou équivalent) pour adaptation automatique au débit.

### 13.5 — Animation timing — règle générale

| Type d'animation       | Durée            | Easing                              |
| :--------------------- | :--------------- | :---------------------------------- |
| Hover button           | 220ms            | `cubic-bezier(0.4, 0, 0.2, 1)`      |
| Hover photo card       | 600ms            | `cubic-bezier(0.4, 0, 0.2, 1)`      |
| Header transition      | 240ms            | `cubic-bezier(0.4, 0, 0.2, 1)`      |
| Page load (hero entry) | 800-1200ms       | `cubic-bezier(0.16, 1, 0.3, 1)`     |
| Section reveal scroll  | 600-700ms        | `cubic-bezier(0.4, 0, 0.2, 1)`      |
| Schéma SVG draw        | 1200ms           | `cubic-bezier(0.4, 0, 0.2, 1)`      |
| Indicateur progression scroll | 16ms (throttle) | linear                          |

> **Règle d'or** : aucune animation > 1.2s. Aucune animation en boucle infinie (sauf indicateur de scroll bas du hero, et même celui-là est désactivé en `prefers-reduced-motion`).

### 13.6 — Reduced motion

Pour les utilisateurs avec `prefers-reduced-motion: reduce` :

- Toutes les animations d'entrée passent à 0ms (apparition instantanée).
- Les animations parallaxe sont désactivées.
- L'animation du tracé SVG (sciences) est désactivée — schéma apparaît finalisé.
- Les hovers gardent leur transition (220ms ou moins) pour le feedback.
- Le smooth scroll est désactivé.
- L'indicateur de scroll en bas du hero ne pulse plus.

### 13.7 — État de chargement initial

```
[t=0ms]      → HTML loaded, fond crème visible
[t=100ms]    → Police Inter chargée (woff2 preload)
[t=300ms]    → Police Cormorant chargée
[t=500ms]    → Police Pinyon Script chargée (header uniquement)
[t=700ms]    → Hero photo principale chargée
[t=900ms]    → FCP (First Contentful Paint) atteint
[t=1500ms]   → LCP (Largest Contentful Paint) atteint — cible
[t=2000ms]   → Page interactive complète, animations terminées
[t=Section 03 reached] → Vidéo commence chargement progressif
```

### 13.8 — Pas de skeleton screen

Comme sur `/accueil`, **pas de skeleton screen**. Le luxe ne montre pas son squelette. À la place : `font-display: swap` configuré, et la photo hero a un poster bas-résolution en blur (LQIP — Low Quality Image Placeholder) qui se substitue au skeleton classique.

### 13.9 — Comportement spécifique de l'indicateur de progression

L'indicateur de progression sous le header (filet 2px sauge dark) suit la progression de scroll de la page :

```javascript
// Pseudo-code
window.addEventListener('scroll', throttle(() => {
  const scrollPercent = (scrollY / (documentHeight - windowHeight)) * 100;
  progressBar.style.width = `${scrollPercent}%`;
}, 16)); // throttle 60fps
```

Le filet :
- Apparaît dès le 1er pixel scrollé (sinon caché)
- Atteint 100% quand le footer est entièrement visible
- Disparaît jamais en cours de lecture

### 13.10 — Pause vidéo intelligente

La vidéo de la section 03 se met en pause :
- Quand la section sort du viewport (intersection observer < 30%)
- Quand l'onglet n'est plus visible (`document.visibilityState === 'hidden'`)
- Quand l'utilisateur clique en dehors du player (sur la section parent)

Elle reprend la lecture **automatiquement** quand :
- La section revient dans le viewport (intersection > 50%)
- L'onglet redevient visible

Mais **pas** automatiquement quand :
- L'utilisateur a manuellement cliqué pause (respect du choix utilisateur — état mémorisé)

---

## 14 — Adaptation responsive

### 14.1 — Breakpoints officiels

| Nom         | Min-width | Max-width | Layout principal                |
| :---------- | :-------- | :-------- | :------------------------------ |
| **Mobile**  | 0         | 767px     | 1 colonne, vertical             |
| **Tablet**  | 768px     | 1279px    | 2 colonnes mixtes               |
| **Desktop** | 1280px    | -         | Multi-colonnes, max-width 1280px |

### 14.2 — Adaptations par section

#### Hero (Section 01)

| Propriété            | Desktop          | Tablet          | Mobile         |
| :------------------- | :--------------- | :-------------- | :------------- |
| Hauteur              | 86vh             | 84vh            | 80vh           |
| Photo ratio          | 16:9             | 4:3             | 3:4 (portrait) |
| Padding latéral      | 96px             | 64px            | 24px           |
| Surtitre size        | 8.5pt            | 8pt             | 7.5pt          |
| Titre size           | 64pt             | 48pt            | 36pt           |
| Tagline size         | 17pt             | 15pt            | 14pt           |
| Indicateur scroll    | Visible          | Visible          | Visible (taille -10%) |

#### Origine (Section 02)

| Propriété            | Desktop          | Tablet          | Mobile         |
| :------------------- | :--------------- | :-------------- | :------------- |
| Layout               | Texte 60% / Photo 40% | 55% / 45%   | Empilés         |
| Gap                  | 64px             | 48px            | 32px            |
| Titre size           | 36pt             | 28pt            | 24pt            |
| Body size            | 17pt             | 16pt            | 15pt            |
| Photo width          | 360px            | ~300px          | 100% (max 320px) |

#### Vidéo (Section 03)

| Propriété            | Desktop          | Tablet          | Mobile         |
| :------------------- | :--------------- | :-------------- | :------------- |
| Container width      | max-width 1280px | full-width 32px marges | full-width 16px marges |
| Vidéo aspect         | 16:9             | 16:9            | 16:9            |
| Captions size        | 16pt             | 15pt            | 14pt            |
| Bouton play          | 32px             | 32px            | 28px            |
| Contrôles autoshow   | 3s puis hide      | 3s puis hide   | Au tap         |

#### Sciences (Section 04)

| Propriété            | Desktop          | Tablet          | Mobile         |
| :------------------- | :--------------- | :-------------- | :------------- |
| Layout               | 3 colonnes       | 3 colonnes serrées | 1 colonne empilée |
| Gap                  | 32px             | 20px            | 32px (vertical) |
| Titre colonne size   | 22pt             | 20pt            | 20pt            |
| Body colonne size    | 13pt             | 13pt            | 13pt            |
| Schéma width         | 600px            | 520px           | 100% (max 360px) |

#### Témoignage (Section 05)

| Propriété            | Desktop          | Tablet          | Mobile         |
| :------------------- | :--------------- | :-------------- | :------------- |
| Layout               | Photo 35% / Q&R 65% | 40% / 60%   | Empilés (photo en haut) |
| Gap                  | 64px             | 48px            | 48px (vertical) |
| Citation phare size  | 38pt             | 28pt            | 22pt            |
| Photo width          | 320px            | 280px           | 100% (max 320px) |
| Q size               | 11pt             | 11pt            | 11pt            |
| R size               | 16pt             | 15pt            | 15pt            |

#### Pivot Kit (Section 06)

| Propriété            | Desktop          | Tablet          | Mobile         |
| :------------------- | :--------------- | :-------------- | :------------- |
| Hauteur              | 320px            | 300px           | 280px           |
| Texte size           | 36pt             | 28pt            | 22pt            |
| CTA padding          | 18px 40px        | 16px 36px       | 16px 32px       |

#### Cross-link Journal (Section 07)

| Propriété            | Desktop          | Tablet          | Mobile         |
| :------------------- | :--------------- | :-------------- | :------------- |
| Layout               | 3 cartes en ligne | 3 cartes serrées | Carrousel swipe |
| Gap                  | 24px             | 20px            | 16px            |
| Photo height         | 220px            | 180px           | 220px           |
| Titre carte size     | 18pt             | 16pt            | 16pt            |

### 14.3 — Comportements mobile spécifiques

- **Header burger menu** : drawer plein écran, animation slide-in 280ms depuis la droite. L'item « Rituel » est marqué actif avec underline sauge dark.
- **Indicateur de progression** : conservé sur mobile. Il devient particulièrement utile car la page est longue (7+ viewports).
- **Vidéo plein écran** : disponible. Sur iOS, native HTML5 fullscreen. Le son reste muet sauf activation explicite.
- **Carrousel cross-link** : swipe natif, indicateurs (3 dots) sous le carrousel, sans flèches de navigation.
- **Sticky CTA mobile** : après scroll au-delà de 60% de la page (donc une fois la vidéo dépassée), un mini-CTA flottant `Recevoir le rituel →` apparaît en bas-droite, opacité 0.9, pill encre. Il disparaît automatiquement à l'arrivée de la section 06 (pour ne pas concurrencer le CTA principal).

### 14.4 — Touch targets minimum

Sur mobile, tous les éléments interactifs respectent **44×44px minimum** :
- Boutons CTA : padding suffisant pour atteindre 44px de hauteur tactile
- Liens menu burger : 48px de hauteur chacun
- Boutons de contrôle vidéo : 32px iconne dans une zone tactile de 44px
- Cards cross-link : la zone tactile est l'ensemble de la card (≥ 44px)

### 14.5 — Texte minimum sur mobile

Aucun texte en dessous de **14px** sur mobile (lisibilité WCAG). Cela inclut les microcopy, les légendes, les dates. Les seules exceptions :
- Tracking captions du wordmark (« MAISON D'ÉCLAT ») : 7pt mais en uppercase tracked
- Textes légaux du footer : 11px (lisibles si on s'approche)

---

## 15 — Performance technique

### 15.1 — Web Vitals — cibles

| Métrique | Cible    | Justification                                      |
| :------- | :------- | :------------------------------------------------- |
| **LCP**  | < 2.5s   | Hero photo chargée rapidement                       |
| **CLS**  | < 0.1    | Pas de saut visuel — le luxe ne tremble pas        |
| **INP**  | < 200ms  | Réactivité des interactions (vidéo, scroll, hover)  |
| **FCP**  | < 1.0s   | Premier contenu (texte hero) visible vite          |
| **TBT**  | < 300ms  | Plus tolérant que `/accueil` car page plus complexe (vidéo) |

### 15.2 — Stratégie de chargement

#### Critical CSS

CSS critique inline dans le `<head>` — uniquement les styles du hero et du header. Le reste en CSS externe `<link>`.

#### Preload des polices

```html
<link rel="preload" href="/fonts/Inter-Regular.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/CormorantGaramond-Light.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/CormorantGaramond-Italic.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/PinyonScript-Regular.woff2" as="font" type="font/woff2" crossorigin>
```

#### Preload de l'image hero

```html
<link rel="preload" as="image" href="/images/rituel-hero-desktop.webp"
      media="(min-width: 768px)">
<link rel="preload" as="image" href="/images/rituel-hero-mobile.webp"
      media="(max-width: 767px)">
```

#### Preload du poster vidéo (pas la vidéo elle-même)

```html
<link rel="preload" as="image" href="/images/rituel-video-poster.webp">
```

#### Defer du JavaScript non-critique

```html
<script src="/js/animations.js" defer></script>
<script src="/js/video-player.js" defer></script>
<script src="/js/analytics.js" defer></script>
```

### 15.3 — Budget de performance

| Ressource          | Budget          |
| :----------------- | :-------------- |
| HTML initial       | < 35 KB gzip    |
| CSS critique       | < 10 KB inline  |
| CSS externe        | < 50 KB gzip    |
| JS total           | < 100 KB gzip   |
| Images hero + sections | < 350 KB total |
| Polices            | < 140 KB total  |
| **Vidéo poster**   | **< 50 KB**     |
| **Vidéo elle-même**| **streamée**    |
| **Total page (hors vidéo)** | **< 700 KB** |

> **Note vidéo** : la vidéo (90s @ 6 Mbps = ~67 MB) n'est **jamais** chargée intégralement avant nécessité. Streamée par chunks via HLS ou progressive download. Sur connexion 4G typique au Maroc (10-15 Mbps), 67 MB = ~50s de chargement — donc lecture immédiate possible avec préchargement à la sect. 02.

### 15.4 — CDN & cache

| Ressource          | Cache-Control                          |
| :----------------- | :------------------------------------- |
| HTML               | `no-cache, must-revalidate`            |
| CSS / JS versionnés | `public, max-age=31536000, immutable`  |
| Images             | `public, max-age=2592000` (30 jours)   |
| Polices            | `public, max-age=31536000, immutable`  |
| Vidéo MP4          | `public, max-age=604800` (7 jours)     |
| Vidéo HLS segments | `public, max-age=31536000, immutable`  |
| Poster vidéo       | `public, max-age=2592000`              |

CDN : Cloudflare ou équivalent, avec :
- **Polish** activé (optimisation WebP automatique)
- **Mirage** activé (lazy loading optimisé)
- **Stream** ou **Mux** pour la vidéo (transcoding multi-bitrate, HLS adaptatif)

### 15.5 — Optimisations spécifiques `/rituel`

| Optimisation                              | Justification                                      |
| :---------------------------------------- | :------------------------------------------------- |
| `loading="lazy"` sur photos sections 02-07 | Page longue, économie de bande passante            |
| Vidéo `preload="metadata"` initial        | Évite chargement complet inutile                   |
| Schéma SVG inline (pas requête)            | Animation instantanée, pas de FOUC                 |
| Police Pinyon Script chargée tard          | Utilisée seulement au header — pas critique LCP    |
| `font-display: swap` partout              | Texte visible immédiatement avec fallback          |
| Intersection Observer pour animations     | Pas de scroll listener manuel (perf coûteuse)       |

### 15.6 — Métriques de référence — concurrents

À titre de comparaison, voici les Web Vitals typiques de quelques sites du segment :

| Site                     | LCP    | CLS   | INP    |
| :----------------------- | :----- | :---- | :----- |
| Aesop.com                | 2.1s   | 0.05  | 180ms  |
| Tatcha.com               | 2.8s   | 0.08  | 220ms  |
| Glossier.com             | 1.9s   | 0.03  | 150ms  |
| **FemiGlow `/rituel` cible** | **< 2.5s** | **< 0.1** | **< 200ms** |

> **Audit régulier recommandé** : PageSpeed Insights mensuel + Lighthouse CI dans le pipeline de déploiement.

---

## 16 — SEO & métadonnées

### 16.1 — Title

```html
<title>FemiGlow — Le rituel d'éclat. Méthode japonaise pour le soin des ongles.</title>
```

| Critère                 | Valeur                                                          |
| :---------------------- | :-------------------------------------------------------------- |
| Longueur                | 76 caractères (≤ 60 affichables sur SERP — tronqué OK car le « ... » apparaît après le mot-clé principal) |
| Mot-clé principal       | « rituel d'éclat » (autorité de marque) + « méthode japonaise »  |
| Mot-clé secondaire      | « soin des ongles » (catégorie SEO)                             |
| Marque en tête          | « FemiGlow » (autorité)                                          |

### 16.2 — Meta description

```html
<meta name="description" content="Quatre minutes pour retrouver une lumière qui était déjà là. Une méthode japonaise transmise depuis le début du XXe siècle, réinterprétée à Casablanca.">
```

| Critère       | Valeur                                                  |
| :------------ | :------------------------------------------------------ |
| Longueur      | 153 caractères (≤ 155 affichables sur SERP)             |
| Hook          | « Quatre minutes pour retrouver une lumière... »         |
| Bénéfice      | implicite (« lumière retrouvée »)                       |
| Différenciat. | « méthode japonaise transmise depuis le début du XXe siècle » |
| Localité      | « réinterprétée à Casablanca »                          |

### 16.3 — Open Graph (réseaux sociaux)

```html
<meta property="og:type" content="article">
<meta property="og:url" content="https://femiglow.ma/rituel">
<meta property="og:title" content="Le rituel d'éclat — Une méthode japonaise.">
<meta property="og:description" content="Quatre minutes pour retrouver une lumière qui était déjà là.">
<meta property="og:image" content="https://femiglow.ma/og/rituel-og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="fr_MA">
<meta property="og:site_name" content="FemiGlow">
<meta property="article:section" content="Rituel">
<meta property="article:published_time" content="2026-04-01T08:00:00+01:00">
```

#### Image OG spécifique à `/rituel`

- Dimensions : 1200×630px (ratio 1.91:1)
- Composition : photo des mains au repos (réutilisation du hero, recadrée), avec overlay sauge pâle 30% à gauche pour la lisibilité, et titre superposé : *« Le rituel d'éclat »* en Cormorant Light blanc cassé
- Wordmark Pinyon en bas-droite, petit
- Format JPEG qualité 85, < 200 KB

### 16.4 — Twitter Card

```html
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@femiglow">
<meta name="twitter:title" content="Le rituel d'éclat — Une méthode japonaise.">
<meta name="twitter:description" content="Quatre minutes pour retrouver une lumière qui était déjà là.">
<meta name="twitter:image" content="https://femiglow.ma/og/rituel-twitter.jpg">
```

### 16.5 — Schema.org JSON-LD

Schema **Article** (pas Organization comme `/accueil`) car cette page est une page éditoriale longue.

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Le rituel d'éclat — Une méthode japonaise pour le soin des ongles",
  "description": "Quatre minutes pour retrouver une lumière qui était déjà là.",
  "image": "https://femiglow.ma/og/rituel-og.jpg",
  "author": {
    "@type": "Organization",
    "name": "FemiGlow"
  },
  "publisher": {
    "@type": "Organization",
    "name": "FemiGlow",
    "logo": {
      "@type": "ImageObject",
      "url": "https://femiglow.ma/logo.png"
    }
  },
  "datePublished": "2026-04-01",
  "dateModified": "2026-05-01",
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://femiglow.ma/rituel"
  }
}
```

#### Schema.org JSON-LD additionnel — VideoObject

Pour la vidéo de la section 03 :

```json
{
  "@context": "https://schema.org",
  "@type": "VideoObject",
  "name": "Le rituel en quatre gestes",
  "description": "Démonstration des quatre gestes du rituel FemiGlow, filmée en lumière naturelle à Casablanca.",
  "thumbnailUrl": "https://femiglow.ma/video/rituel-poster.jpg",
  "uploadDate": "2026-04-01T08:00:00+01:00",
  "duration": "PT1M30S",
  "contentUrl": "https://femiglow.ma/video/rituel-1080p.mp4",
  "embedUrl": "https://femiglow.ma/rituel#video",
  "transcript": "Préparer. Lisser. Polir. Révéler. Quatre gestes méticuleux..."
}
```

> **Pourquoi le Schema VideoObject ?** Pour que Google indexe la vidéo séparément (Video Search) et l'affiche en rich snippet dans les résultats SERP.

### 16.6 — Canonical & hreflang

```html
<link rel="canonical" href="https://femiglow.ma/rituel">
<link rel="alternate" hreflang="fr-MA" href="https://femiglow.ma/rituel">
<link rel="alternate" hreflang="ar-MA" href="https://femiglow.ma/ar/rituel">
<link rel="alternate" hreflang="x-default" href="https://femiglow.ma/rituel">
```

### 16.7 — Robots & sitemap

```html
<meta name="robots" content="index, follow, max-image-preview:large, max-video-preview:30">
```

`max-video-preview:30` autorise Google à afficher jusqu'à 30 secondes de la vidéo en preview SERP — utile pour le Video Search.

Sitemap.xml inclut `/rituel` avec :
```xml
<url>
  <loc>https://femiglow.ma/rituel</loc>
  <lastmod>2026-05-01</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.9</priority>
</url>
```

### 16.8 — Stratégie de mots-clés

| Mot-clé cible                          | Volume estimé Maroc | Intention      | Position visée |
| :------------------------------------- | :------------------ | :------------- | :------------- |
| « soin ongles japonais »               | ~50/mois            | Découverte     | Top 3          |
| « méthode P-Shine Maroc »              | ~10/mois            | Découverte     | Top 1          |
| « rituel ongles naturel »              | ~30/mois            | Considération  | Top 5          |
| « manucure japonaise Casablanca »      | ~20/mois            | Conversion     | Top 1          |
| « soin ongles sans vernis »            | ~80/mois            | Considération  | Top 5          |

> **Note** : volumes au Maroc relativement faibles → SEO pas la priorité principale. La page se construit pour la **conversion qualifiée** (visiteur depuis Instagram ou bouche à oreille), le SEO étant secondaire.

### 16.9 — Hiérarchie des headers

```html
<h1>Quatre minutes pour retrouver une lumière qui était déjà là.</h1>
  <h2>Un soin né au Japon, au début du XXe siècle.</h2>
  <h2>Quatre gestes, quatre minutes.</h2>  <!-- vidéo -->
  <h2>L'ongle n'est pas une surface. C'est une matière vivante.</h2>
    <h3>La kératine respire.</h3>
    <h3>Le pH équilibré.</h3>
    <h3>L'abrasion contrôlée.</h3>
  <h2 class="visually-hidden">Témoignage d'une initiée</h2>
    <h3>« J'ai redécouvert mes mains. »</h3>
  <h2 class="visually-hidden">Recevoir le rituel</h2>
  <h2 class="visually-hidden">Pour aller plus loin — le Journal</h2>
```

> **Règle SEO** : un seul `<h1>` par page, hiérarchie cohérente, headers en visually-hidden quand le titre n'est pas affiché visuellement (sections sans titre éditorial mais qui méritent une structure sémantique).

---

## 17 — Accessibilité (a11y)

### 17.1 — Conformité visée

**WCAG 2.2 niveau AA** sur tous les composants critiques. **Niveau AAA** visé sur :
- Le contraste texte (lisibilité maximale)
- La navigation clavier (page longue, navigation indispensable)
- Les contrôles vidéo (élément critique d'accessibilité)

### 17.2 — Contraste — vérifications

| Combinaison                                | Ratio   | Niveau WCAG   |
| :----------------------------------------- | :------ | :------------ |
| Encre `#2C2A28` sur Crème `#FBF8F1`        | 14.2:1  | AAA           |
| Encre claire `#4A4844` sur Crème           | 9.1:1   | AAA           |
| Brume `#6B6863` sur Crème                  | 5.6:1   | AA            |
| Brume sur Sauge pâle `#E8EFE7`             | 5.2:1   | AA            |
| Crème pure `#FBF8F1` sur Encre             | 14.2:1  | AAA (footer + CTA) |
| Champagne `#C8A876` sur Crème              | 2.7:1   | AA Large only — réservé à kickers ≥ 14pt |
| Captions vidéo blanc + ombre noire         | > 7:1   | AAA (lisibilité critique sur fond mouvant) |

### 17.3 — Navigation clavier

| Élément                    | Comportement clavier                            |
| :------------------------- | :---------------------------------------------- |
| Wordmark                   | Tab focus, Enter active                          |
| Menu items                 | Tab navigation séquentielle                      |
| Burger menu mobile         | Enter ouvre, Escape ferme                        |
| Skip link (top)            | Visible au focus, Enter saute au main            |
| Indicateur de progression   | Non focusable (purement visuel)                 |
| Photo origine              | Non focusable (décorative)                       |
| **Player vidéo**           | **Tab focus, plusieurs raccourcis** (voir ci-dessous) |
| Schéma SVG sciences        | Non focusable (décoratif, légendes en texte HTML séparé) |
| Q/R interview              | Non focusables (statiques)                       |
| CTA pivot                  | Tab focus + Enter                                |
| Cards cross-link           | Tab focus + Enter                                |
| Footer liens               | Tab navigation                                   |

#### Raccourcis clavier du player vidéo

| Touche       | Action                                            |
| :----------- | :------------------------------------------------ |
| `Espace`     | Play/Pause toggle                                 |
| `M`          | Mute/Unmute                                       |
| `F`          | Plein écran toggle                                |
| `C`          | Captions toggle                                   |
| `← →`        | Reculer/Avancer 5 secondes                        |
| `↑ ↓`        | Volume +/- 10%                                    |
| `0-9`        | Saut à 0%, 10%, ..., 90% de la durée              |

### 17.4 — Focus ring

| Propriété     | Valeur                                          |
| :------------ | :---------------------------------------------- |
| Couleur       | `#A8C4A6` (Sauge dark)                          |
| Épaisseur     | 2px                                             |
| Offset        | 4px                                             |
| Border-radius | Hérite de l'élément (0 ou 999px selon)         |
| Outline-style | `solid`                                         |
| Visible       | Sur focus clavier uniquement (`:focus-visible`) |

### 17.5 — ARIA labels & landmarks

```html
<header role="banner" aria-label="En-tête principal">
  <nav aria-label="Navigation principale">...</nav>
  <a href="/" aria-label="FemiGlow, retour à l'accueil">FemiGlow</a>
  <div role="progressbar"
       aria-label="Progression de lecture"
       aria-valuenow="40"
       aria-valuemin="0"
       aria-valuemax="100">
    <!-- barre 2px de progression -->
  </div>
</header>

<main role="main" aria-label="Page Le Rituel">
  <section aria-labelledby="hero-title">
    <span class="kicker">LE RITUEL</span>
    <h1 id="hero-title">Quatre minutes pour retrouver une lumière qui était déjà là.</h1>
    <p>Une méthode japonaise...</p>
  </section>

  <section aria-labelledby="origine-title">
    <span class="kicker">L'ORIGINE</span>
    <h2 id="origine-title">Un soin né au Japon, au début du XXe siècle.</h2>
    <article>...</article>
    <figure>
      <img src="..." alt="Atelier de soin japonais des années 1920, mains vues de profil">
      <figcaption>Atelier de soin japonais — années 1920. Archives anonymes.</figcaption>
    </figure>
  </section>

  <section aria-labelledby="video-title">
    <span class="kicker">LE RITUEL EN MOUVEMENT</span>
    <h2 id="video-title">Quatre gestes, quatre minutes.</h2>
    <figure>
      <video controls
             aria-label="Vidéo du rituel en quatre gestes, durée 1 minute 30 secondes"
             preload="metadata">
        <source src="..." type="video/mp4">
        <track kind="captions" srclang="fr" label="Français" src="...">
        <track kind="captions" srclang="ar" label="Arabe" src="...">
      </video>
      <figcaption>Filmée en lumière naturelle, à Casablanca.</figcaption>
    </figure>
  </section>

  <section aria-labelledby="sciences-title">
    <span class="kicker">POURQUOI UN SOIN, ET PAS UN VERNIS</span>
    <h2 id="sciences-title">L'ongle n'est pas une surface. C'est une matière vivante.</h2>
    <article aria-labelledby="keratine-title">
      <h3 id="keratine-title">La kératine respire.</h3>
      <p>...</p>
    </article>
    <article aria-labelledby="ph-title">
      <h3 id="ph-title">Le pH équilibré.</h3>
      <p>...</p>
    </article>
    <article aria-labelledby="abrasion-title">
      <h3 id="abrasion-title">L'abrasion contrôlée.</h3>
      <p>...</p>
    </article>
    <figure>
      <svg role="img" aria-label="Schéma d'une coupe d'ongle montrant les trois couches">
        ...
      </svg>
      <figcaption>Coupe d'un ongle (×40)</figcaption>
    </figure>
  </section>

  <section aria-label="Témoignage d'une cliente initiée">
    <span class="kicker">ENTRETIEN</span>
    <blockquote>
      <p>« J'ai redécouvert mes mains. »</p>
    </blockquote>
    <figure>
      <img src="..." alt="Une tasse de thé sur une table de soin avec un livre ouvert et des ongles posés en flou doux">
      <figcaption>Khadija, Rabat. Initiée depuis février 2026.</figcaption>
    </figure>
    <article>
      <h3 class="visually-hidden">Question 1</h3>
      <p class="question">— Comment avez-vous découvert le rituel ?</p>
      <p class="answer">Une amie revenue d'un voyage à Tokyo...</p>
    </article>
    <!-- ... 4 autres Q/R ... -->
  </section>

  <section aria-labelledby="pivot-title" class="pivot-kit">
    <h2 id="pivot-title">Maintenant que vous savez.</h2>
    <a href="/kit" class="cta">Recevoir le rituel</a>
  </section>

  <section aria-labelledby="crosslink-title">
    <h2 id="crosslink-title" class="visually-hidden">Pour aller plus loin — articles connexes</h2>
    <ul>
      <li><a href="/journal/...">...</a></li>
    </ul>
  </section>
</main>

<footer role="contentinfo" aria-label="Pied de page">...</footer>
```

### 17.6 — Images & alt texts

| Image                          | Alt text                                                                    |
| :----------------------------- | :-------------------------------------------------------------------------- |
| Photo hero (mains au repos)    | « Mains posées au repos sur un linge de coton beige, pots du kit en flou doux à droite » |
| Photo origine (atelier 1920)   | « Atelier de soin japonais des années 1920, mains vues de profil, image d'archive en sépia » |
| Poster vidéo                   | « Aperçu de la vidéo du rituel — mains en préparation »                      |
| Schéma SVG sciences            | « Schéma d'une coupe d'ongle (×40) montrant les trois couches : kératine vivante, matrix protecteur, couche supérieure » |
| Photo témoignage (Khadija)     | « Une tasse de thé sur une table de soin avec un livre ouvert et des ongles posés en flou doux » |
| Photos cross-link              | Alt descriptif de la photo lifestyle de chaque article (variable)            |

### 17.7 — Skip link

```html
<a href="#main" class="skip-link">Aller au contenu principal</a>
<a href="#video-section" class="skip-link">Aller à la vidéo du rituel</a>
<a href="#pivot-kit" class="skip-link">Aller à la commande du kit</a>
```

> **Trois skip links sur `/rituel`** au lieu d'un seul sur `/accueil`. La page étant longue, des skip links spécifiques (vidéo, pivot kit) accélèrent considérablement la navigation pour les utilisateurs au clavier.

### 17.8 — Réduction du mouvement

```css
@media (prefers-reduced-motion: reduce) {
  /* Toutes animations désactivées */
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }

  /* Indicateur scroll bas du hero ne pulse plus */
  .scroll-indicator {
    animation: none;
    opacity: 0.4;
  }

  /* Schéma SVG apparaît finalisé, pas de tracé animé */
  .sciences-schema path {
    stroke-dasharray: none;
    stroke-dashoffset: 0;
  }

  /* Vidéo : pas d'autoplay si reduced motion */
  video[autoplay] {
    /* Désactivé via JS au chargement */
  }
}
```

### 17.9 — Vidéo : transcript complet

Sous la vidéo, en `<details>` repliable :

```html
<details>
  <summary>Lire la transcription</summary>
  <div class="transcript">
    <p><strong>0:00 – 0:08</strong> — Établissement : table de soin, mains au repos.</p>
    <p><strong>0:08 – 0:28</strong> — Préparer. Application de la pâte avec un pinceau souple. Mouvement lent, circulaire.</p>
    <p><strong>0:30 – 0:50</strong> — Lisser. La poudre est appliquée avec un buffer doux. Mouvement de gauche à droite, sans pression.</p>
    <p><strong>0:52 – 1:12</strong> — Polir. Le buffer fin lisse la surface. La brillance commence à apparaître.</p>
    <p><strong>1:14 – 1:25</strong> — Révéler. La finition au chiffon de soie révèle l'éclat final.</p>
    <p><strong>1:25 – 1:30</strong> — Final. La main est posée. Silence. Fade.</p>
  </div>
</details>
```

> **Pourquoi un transcript ?** Pour les utilisateurs sourds/malentendants qui ne peuvent pas suivre par le son ambient (même avec captions, le rythme est crucial). Aussi pour les utilisateurs qui veulent comprendre sans regarder.

---

## 18 — Microcopy & états

### 18.1 — Textes utilitaires de la page `/rituel`

| Contexte                            | Microcopy                                                       |
| :---------------------------------- | :-------------------------------------------------------------- |
| Loading initial                     | (aucun — `font-display: swap` invisible)                        |
| Photo hero échec chargement         | (aucun message — fallback sur fond crème uni, le titre reste lisible) |
| Vidéo échec chargement              | « La vidéo se charge. Patientez un instant. »                   |
| Vidéo erreur définitive             | « La vidéo n'a pas pu se charger. Vous pouvez en lire la transcription ci-dessous. » |
| Vidéo — état pause                  | (icône play visible — pas de texte)                             |
| Vidéo — état lecture                | (icône pause visible — pas de texte)                            |
| Vidéo — captions activées           | « FR » ou « AR » dans le bouton (état actif souligné)            |
| Vidéo — captions désactivées        | « OFF » dans le bouton                                          |
| Vidéo — son activé                  | (icône speaker)                                                 |
| Vidéo — son muet                    | (icône speaker barrée)                                          |
| Cookies banner (premier accès)      | « Nous utilisons des cookies pour comprendre votre visite. »     |
| CTA pivot pendant chargement page   | (CTA actif dès que JS chargé — état désactivé invisible)        |
| Hover CTA pivot                     | (changement visuel — pas de texte)                              |
| Erreur 404 → `/rituel/...`          | « Cet article s'est égaré du rituel. » + lien retour `/rituel`  |

### 18.2 — Tonalité des messages

**Toujours paisible.** Jamais d'urgence, jamais d'alarme.

| À éviter                                 | À préférer                                              |
| :--------------------------------------- | :------------------------------------------------------ |
| « Erreur de chargement vidéo »           | « La vidéo se charge. Patientez un instant. »           |
| « Vidéo non disponible »                 | « La vidéo n'a pas pu se charger. Voici la transcription. » |
| « Connexion lente détectée »             | (silence — laisser charger sans alarmer)                 |
| « ⚠️ Erreur »                            | (jamais d'emoji warning)                                |

### 18.3 — État de fallback de la vidéo

Si la vidéo ne peut pas se charger (erreur réseau, format non supporté, etc.) :

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│        [Image poster statique de la vidéo]                     │
│                                                                │
│                                                                │
└────────────────────────────────────────────────────────────────┘

La vidéo n'a pas pu se charger. Vous pouvez en lire la transcription ci-dessous.

▾ Lire la transcription du rituel
```

L'image poster reste visible. Sous l'image, le message paisible + un bouton ouvrant le `<details>` du transcript.

### 18.4 — Microcopy de la barre de progression

Pas de texte. La barre est purement visuelle. Mais en ARIA :

```html
<div role="progressbar"
     aria-label="Progression de lecture"
     aria-valuenow="40"
     aria-valuemin="0"
     aria-valuemax="100">
</div>
```

Les lecteurs d'écran annoncent : *« Progression de lecture, 40% »*.

### 18.5 — Microcopy mobile spécifique

| Contexte                              | Microcopy                                          |
| :------------------------------------ | :------------------------------------------------- |
| Burger menu fermé (aria)              | « Ouvrir le menu de navigation »                   |
| Burger menu ouvert (aria)             | « Fermer le menu de navigation »                   |
| Sticky CTA (apparition)               | « Recevoir le rituel → »                            |
| Vidéo controls bouton plein écran     | « Plein écran »                                    |
| Vidéo controls captions               | (label visible — « FR » / « AR » / « OFF »)        |

### 18.6 — Cookies banner

Identique à `/accueil`. Ne re-apparaît pas si déjà accepté/refusé via cookie persistant.

```
┌────────────────────────────────────────────────────────────────┐
│  Nous utilisons des cookies pour comprendre votre visite       │
│  et améliorer votre expérience. Aucun partage commercial.      │
│                                                                │
│  [Tout accepter]  [Personnaliser]  Refuser                     │
└────────────────────────────────────────────────────────────────┘
```

---

## 19 — Synthèse — checklist de validation

Avant mise en production, vérifier que chaque élément ci-dessous est validé. C'est l'audit final de la page `/rituel`.

### 19.1 — Identité de marque

- [ ] Wordmark Pinyon Script présent en header et footer
- [ ] Aucune substitution de police pour le wordmark
- [ ] Palette signature respectée (sauge dominante, crème support, encre tranche)
- [ ] **Champagne utilisé exactement 2 fois** sur la page (surtitre hero + fleuron pivot)
- [ ] Photos lifestyle fidèles à la direction artistique (Glossier × Tatcha)
- [ ] Photo origine en sépia chaud (filter spécifique appliqué)
- [ ] Pas d'emoji nulle part sur la page
- [ ] Pas de pop-up newsletter à l'arrivée
- [ ] Indicateur de progression sous le header présent et fonctionnel

### 19.2 — Copy & ton

- [ ] Surtitre hero : « LE RITUEL » en Champagne tracking 4px
- [ ] Titre hero : « Quatre minutes / pour retrouver / une lumière qui était déjà là. » (3 lignes)
- [ ] Sous-tagline hero : 2 lignes Cormorant Italic
- [ ] Origine : 2 paragraphes Cormorant, aucun nom propre cité
- [ ] Légende photo origine : « Atelier de soin japonais — années 1920. Archives anonymes. »
- [ ] Vidéo : 90 secondes, slow motion 24fps, mains anonymes
- [ ] Captions vidéo : FR + AR disponibles, désactivées par défaut
- [ ] Légende vidéo : « Filmée en lumière naturelle, à Casablanca. »
- [ ] Sciences : 3 colonnes (Kératine / pH / Abrasion) — copy intégral respecté
- [ ] Sources sciences : « Wagner et al. (2017) · Schoon (2020) · Iorizzo (2015) »
- [ ] Témoignage : 5 questions Q/R, prénom marocain (Khadija), ville (Rabat), date (février 2026)
- [ ] Citation phare témoignage : « J'ai redécouvert mes mains. »
- [ ] Pivot kit : « Maintenant que vous savez. » + CTA « Recevoir le rituel »
- [ ] CTA pivot vers `/kit` (pas `/commander`)
- [ ] Cross-link : 3 articles, grille régulière, dates au format littéraire
- [ ] Microcopy d'erreur : tonalité paisible, jamais agressive
- [ ] Apostrophes typographiques courbes ' partout
- [ ] Guillemets français « » avec espaces insécables
- [ ] Tirets cadratins — aux questions de l'interview

### 19.3 — Tactiques Kolenda — minimum 4 par section

- [ ] **Hero** : `INDIRECT CLAIM` `EMPTY SPACE` `F-PATTERN` `LUXURY DISTANCE` `SLOW MOTION IMPLICIT`
- [ ] **Origine** : `STORYTELLING` `INDIRECT CLAIM (lignée)` `TEMPORAL DISTANCE` `EMPTY SPACE`
- [ ] **Vidéo** : `SLOW MOTION = LUXURY` `IMPLY HUMAN` `AUTOPLAY ETHICS` `F-PATTERN BREAK`
- [ ] **Sciences** : `CREDIBILITY (sources)` `RISK REDUCTION` `INDIRECT CLAIMS (titres)` `EMPTY SPACE`
- [ ] **Témoignage** : `MIRROR EFFECT` `AUTHENTICITY (détails)` `VULNERABILITY` `MAGAZINE FORMAT`
- [ ] **Pivot kit** : `P.A.S. FRAMEWORK` `VERB OF RECEIVING` `EMPTY SPACE` `CHAMPAGNE SYMMETRY`
- [ ] **Cross-link** : `DEEP ENGAGEMENT` `GESTALT REGULAR` `FRICTION ZERO`

### 19.4 — Performance

- [ ] LCP < 2.5s sur 4G simulé
- [ ] CLS < 0.1
- [ ] INP < 200ms
- [ ] Page weight (hors vidéo) < 700 KB
- [ ] Vidéo `preload="metadata"` initial (pas tout le payload)
- [ ] Vidéo lecture seulement quand section atteint 50% viewport
- [ ] Images en WebP avec fallback JPEG
- [ ] Polices preloaded (Inter, Cormorant Light, Cormorant Italic, Pinyon)
- [ ] Lazy loading sur photos sous le pli
- [ ] Schéma SVG inline (pas de requête)
- [ ] CSS critique inline dans `<head>`
- [ ] JavaScript non-critique en defer
- [ ] CDN configuré (Polish, Mirage, Stream/Mux pour vidéo)

### 19.5 — Responsive

- [ ] Mobile 375px, 390px, 414px testés
- [ ] Tablet 768px, 1024px testés
- [ ] Desktop 1280px, 1440px, 1920px testés
- [ ] Aucun débordement horizontal à aucune taille
- [ ] Touch targets ≥ 44×44px sur mobile
- [ ] Texte minimum 14px sur mobile
- [ ] Vidéo passe en plein écran natif sur mobile
- [ ] Carrousel cross-link swipe fluide sur mobile
- [ ] Sticky CTA mobile apparaît après 60% scroll, disparaît à la sect. 06
- [ ] Indicateur de progression visible sur tous les breakpoints

### 19.6 — SEO

- [ ] Title 60-76 caractères, mot-clé en tête
- [ ] Meta description 140-155 caractères
- [ ] Open Graph image 1200×630 dédiée à `/rituel`
- [ ] Twitter Card configurée
- [ ] **Schema.org Article** JSON-LD (pas Organization)
- [ ] **Schema.org VideoObject** pour la vidéo (avec duration, thumbnail, transcript)
- [ ] Canonical URL en HTTPS
- [ ] Hreflang fr-MA + ar-MA
- [ ] Sitemap.xml inclut `/rituel` avec priority 0.9
- [ ] Un seul `<h1>` (titre hero)
- [ ] Hiérarchie des `<h2>`, `<h3>` cohérente
- [ ] `max-video-preview:30` dans robots meta

### 19.7 — Accessibilité

- [ ] WCAG 2.2 AA validé via axe-core ou WAVE
- [ ] Contrastes vérifiés sur toutes les combinaisons texte/fond
- [ ] Navigation clavier complète (Tab, Enter, Escape)
- [ ] **Player vidéo accessible** : Espace, M, F, C, ←→, ↑↓, 0-9
- [ ] Focus ring visible et cohérent
- [ ] ARIA landmarks et labels en place
- [ ] **Captions vidéo** FR + AR disponibles
- [ ] **Transcript vidéo** complet en `<details>` sous la vidéo
- [ ] Alt texts descriptifs sur toutes les images informatives
- [ ] Schéma SVG avec `role="img"` + `aria-label`
- [ ] **3 skip links** : main / vidéo / pivot kit
- [ ] `prefers-reduced-motion` respecté (animations + autoplay vidéo)
- [ ] Test lecteur d'écran NVDA ou VoiceOver
- [ ] Indicateur de progression annoncé en ARIA `progressbar`

### 19.8 — Émotion & cohérence narrative

- [ ] La règle de la conviction lente est respectée (lecture engagée 3-5 minutes)
- [ ] Le P.A.S. framework s'étale sur toute la page (Problem → Agitate → Solve)
- [ ] Architecture émotionnelle : curiosité → respect → compréhension → confiance → identification → décision
- [ ] Alternance dense/aérée respectée entre sections
- [ ] Aucun CTA dans le hero
- [ ] Aucun prix mentionné avant le pivot
- [ ] La page peut être lue en intégralité sans sortir de l'émotion
- [ ] Le Champagne n'apparaît qu'aux 2 moments d'ouverture (hero + pivot)
- [ ] La vidéo ne contient ni musique, ni voix off, ni visage
- [ ] Khadija est identifiable comme cible (prénom + ville + statut « initiée »)
- [ ] Le transcript vidéo est paisible, pas instructif
- [ ] Sources scientifiques vraies et vérifiables

---

> *« Une page qui se lit en 5 minutes, mais qui se grave pour des semaines. C'est le pari du rituel. »*

**FIN · FemiGlow · Spécification de la page Rituel v1.0 · Mai 2026**

*Prochaines spécifications à produire (B2C) : `/kit ★`, `/journal`, `/maison`, `/panier`, `/commander ★`, `/merci`.*
