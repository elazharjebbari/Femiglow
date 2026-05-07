# Page Journal — `/journal`

> **Univers Particulier · B2C · Hub éditorial** — Document de spécification détaillée
> *Volume VI · Mai 2026 · Complémentaire à la charte graphique et au document d'architecture.*

---

## Sommaire

1. [Identité de la page](#1--identité-de-la-page)
2. [Contexte stratégique](#2--contexte-stratégique)
3. [Architecture verticale globale](#3--architecture-verticale-globale)
4. [Header — élément persistant](#4--header--élément-persistant)
5. [Section 01 — Hero du Journal](#5--section-01--hero-du-journal)
6. [Section 02 — Article featured](#6--section-02--article-featured)
7. [Section 03 — Filtre par catégories](#7--section-03--filtre-par-catégories)
8. [Section 04 — Grille des articles](#8--section-04--grille-des-articles)
9. [Section 05 — Newsletter](#9--section-05--newsletter)
10. [Section 06 — Cross-link maison](#10--section-06--cross-link-maison)
11. [Footer — élément persistant](#11--footer--élément-persistant)
12. [Comportements transverses](#12--comportements-transverses)
13. [Adaptation responsive](#13--adaptation-responsive)
14. [Performance technique](#14--performance-technique)
15. [SEO & métadonnées](#15--seo--métadonnées)
16. [Accessibilité (a11y)](#16--accessibilité-a11y)
17. [Microcopy & états](#17--microcopy--états)
18. [Synthèse — checklist de validation](#18--synthèse--checklist-de-validation)

---

## 1 — Identité de la page

| Attribut             | Valeur                                                                  |
| :------------------- | :---------------------------------------------------------------------- |
| **URL**              | `femiglow.ma/journal`                                                   |
| **Type**             | Hub éditorial · magazine de la maison                                   |
| **Audience**         | Femmes 28–50 ans intéressées par la beauté lente, la culture du soin    |
| **Profil cognitif**  | Curieuse littéraire — vient lire, pas acheter                           |
| **Pouvoir d'achat**  | Indifférent ici — l'achat viendra plus tard, ou peut-être jamais (et c'est OK) |
| **Funnel**           | **TOFU+ / Fidélisation** — acquisition organique + rétention             |
| **Position parcours**| Variable — entrée organique fréquente, retour de cliente fidèle, ou sortie de `/kit` |
| **Durée d'attention**| 3 à 15 minutes (lecture profonde possible si elle clique sur un article) |
| **Device split**     | Mobile 60% · Desktop 35% · Tablet 5% (lecture longue → desktop monte)   |
| **Update frequency** | 1 article tous les 14 jours (rythme calme, qualité > quantité)          |

### Ce que la page **doit** faire

1. **Construire l'autorité** de la maison comme **voix experte** sur le soin lent, la beauté révélée, la culture japonaise du soin. Une marque qui *écrit* est plus crédible qu'une marque qui *vend*.
2. **Fidéliser** les clientes existantes en leur offrant une raison de revenir — sans rien leur vendre. Ce qui crée la fidélité paradoxalement.
3. **Acquérir** organiquement par le SEO long-tail (« hiver et ongles cassants », « rituel du dimanche soir ») et par le partage social.
4. **Capturer les emails** via la newsletter — la seule page du site où la newsletter a sa propre section dédiée. C'est ici qu'elle a sa raison d'être.
5. **Préserver la voix éditoriale** absolument — aucun article ne doit ressembler à du contenu sponsorisé, à de la promotion déguisée, ou à du SEO industriel.

### Ce que la page **ne doit pas** faire

1. **Vendre directement.** Aucun CTA `Recevoir le rituel` sur cette page hub. Aucun prix. Aucun lien direct vers `/kit` qui ressemble à de la pub.
2. **Imiter Medium ou Substack.** Le Journal n'est pas une plateforme de blogging — c'est le **carnet d'une maison**. La forme doit le refléter (sobre, rare, soignée).
3. **Multiplier les articles vides.** Mieux vaut 1 article toutes les 2 semaines bien écrit que 3 articles par semaine creux. La lenteur est la signature.
4. **Sponsoriser ou accepter du contenu commercial externe.** Le Journal est **uniquement** la voix de la maison, jamais la voix d'un sponsor.
5. **Suivre les modes SEO.** Pas de listicle « 10 astuces pour de beaux ongles ». Pas de clickbait. Le Journal est un **magazine**, pas une ferme à clics.

---

## 2 — Contexte stratégique

### Position dans l'écosystème B2C

```
[ARRIVÉE]                       [PAGE JOURNAL /journal]              [SUITE]
    │                                   │                                │
Recherche organique ────────►   1. Hero du Journal           ────►   /journal/[article]
(« hiver et ongles »)           2. Article featured           ────►   /accueil
Newsletter clic ─────────────►  3. Filtre catégories          ────►   /maison
Footer site (lien Journal) ──►  4. Grille articles            ────►   /rituel
Cross-link /rituel /kit ────►   5. Newsletter signup          ────►   newsletter
Réseaux sociaux ────────────►   6. Cross-link maison
                                   │
                                   ↓
                              Lit un article (3-15 min)
                                   ↓
                              Repli OU continue sur autre article
```

### La règle de la lecture sans transaction

À l'inverse des trois pages précédentes (TOFU, MOFU, BOFU — toutes orientées vers la conversion), `/journal` est une **page de pause** dans le tunnel commercial. Aucun objectif de conversion immédiate. C'est une **respiration éditoriale** dans l'écosystème de la marque.

> **Pourquoi cette respiration est stratégique ?** Parce que les marques qui ne font que vendre **épuisent** leur audience. Celles qui offrent du **contenu gratuit, désintéressé, beau** créent une **dette de réciprocité** (Cialdini 1984) — la cliente sent qu'elle a reçu sans avoir donné. Elle voudra donner à son tour : par un achat, un partage, un email donné, un retour.

### Les trois fonctions du Journal

#### Fonction 1 — Autorité éditoriale

Une marque qui publie régulièrement des articles soignés sur son domaine **construit une expertise perçue**. Quand la cliente lira *« la kératine respire »* sur `/rituel`, elle pourra inconsciemment se référer à *« cette marque qui écrit des articles sur la kératine ».*

L'autorité **n'est pas démontrée par les bannières publicitaires** — elle est construite par la production éditoriale lente.

#### Fonction 2 — SEO long-tail

Les pages produits classiques (`/kit`, `/accueil`) ne peuvent pas se positionner sur **toutes** les requêtes. Mais des articles ciblés (« Pourquoi les ongles cassent en hiver », « Le rituel du dimanche soir ») captent un trafic SEO **diversifié** :

| Type de requête             | Page cible        | Volume estimé Maroc |
| :-------------------------- | :---------------- | :------------------ |
| « kit soin ongles »         | `/kit`            | ~50/mois            |
| « rituel ongles japonais »  | `/rituel`         | ~30/mois            |
| « pourquoi ongles cassent » | `/journal/...`    | ~120/mois           |
| « hydrater ongles naturellement » | `/journal/...` | ~80/mois          |
| « rituel beauté lente »     | `/journal/...`    | ~40/mois            |
| « hiver et soin ongles »    | `/journal/...`    | ~60/mois            |

Le Journal **multiplie par 3-4 le trafic organique** d'un site qui n'aurait que des pages produits.

#### Fonction 3 — Capture email (newsletter)

La cliente qui n'achète pas immédiatement peut malgré tout être **gagnée à la cause** par un email occasionnel. La newsletter du Journal :

- Est **opt-in volontaire** (jamais checkbox pré-cochée à la commande)
- Envoie **une fois toutes les 2-3 semaines** (rythme calme)
- Contient **un seul article** par envoi (pas de sélection multiple, pas de promotion)
- N'a **aucun lien d'achat** ni promotion — fidèle à la philosophie sans transaction

### Tension stratégique fondamentale

> Le Journal vit dans une tension : **soutenir le commerce** (sinon il ne serait pas financé), **sans devenir commercial** (sinon il perdrait son lecteur). La résolution de cette tension est dans la **discipline éditoriale** : chaque article doit pouvoir vivre **indépendamment** de la marque, comme un texte qu'on aimerait avoir lu même s'il n'était pas signé FemiGlow.

### Architecture émotionnelle

| Section                | Émotion d'entrée    | Émotion de sortie       | Mouvement intérieur                  |
| :--------------------- | :------------------ | :---------------------- | :----------------------------------- |
| 01. Hero du Journal    | Reconnaissance      | Disposition à lire      | Pause, ralentissement                |
| 02. Article featured   | Disposition         | Curiosité ciblée        | « Cet article m'intéresse »           |
| 03. Filtre catégories  | Curiosité            | Choix orienté          | Sélection                            |
| 04. Grille articles    | Choix orienté        | Lecture potentielle    | Picorage éditorial                   |
| 05. Newsletter         | Confiance acquise    | Engagement long terme  | Don d'email = don de présence        |
| 06. Cross-link maison  | Engagement           | Curiosité étendue       | « Que fait cette maison ? »           |

### KPIs cibles

| Métrique                                    | Cible                            | Source                       |
| :------------------------------------------ | :------------------------------- | :--------------------------- |
| Temps moyen sur la page hub `/journal`      | > 1:30 (90s)                     | GA4                          |
| Pages par session via `/journal`            | > 2.5                            | GA4                          |
| CTR sur un article (au moins un)            | > 45% des sessions               | Event tracking               |
| Newsletter signup rate                      | > 3% des sessions                | Form analytics               |
| Bounce rate                                 | < 50%                            | GA4                          |
| Visiteurs récurrents (returning)            | > 35% des sessions               | GA4                          |
| Partages sur réseaux sociaux                | > 5% des sessions                | Social tracking              |
| **Sur les articles individuels** (`/journal/[slug]`) | Voir spec article — TBD     | GA4                          |
| LCP                                         | < 2.2s                           | Web Vitals                   |
| CLS                                         | < 0.08                           | Web Vitals                   |
| INP                                         | < 180ms                          | Web Vitals                   |

> **Note sur les KPIs** : ce ne sont pas des cibles de conversion immédiate. Ce sont des cibles d'**engagement** et de **fidélisation**. Le ROI du Journal se mesure sur **3-6 mois**, pas sur la session.

### Les cinq catégories éditoriales

Les articles sont classés en cinq catégories permanentes :

| Catégorie    | Description                                                              | Exemples d'articles              |
| :----------- | :----------------------------------------------------------------------- | :------------------------------- |
| **Maison**   | La voix de la maison — philosophie, choix éditoriaux, engagements        | « Pourquoi nous ne posons pas de vernis », « Notre engagement matières » |
| **Saison**   | Articles liés aux saisons et aux moments de l'année                       | « Hiver, ongles, et patience », « Le rituel du printemps »  |
| **Voix**     | Témoignages d'initiées, interviews, voix invitées                         | « Mon premier rituel — récit d'une initiée », « Conversation avec une artisane japonaise » |
| **Matières** | Articles sur les ingrédients, leur origine, leur science                   | « La kératine, cette matière vivante », « Pourquoi le karité » |
| **Pratique** | Articles pratiques sur le rituel, les gestes, la fréquence                 | « Les quatre minutes du dimanche soir », « Quand commencer le rituel » |

> **Pourquoi cinq et pas dix ?** Parce que **trop de catégories tuent la lisibilité**. Cinq est le nombre maximum mémorisable au premier coup d'œil. Au-delà, la cliente ne sait plus où chercher.

---

## 3 — Architecture verticale globale

### Vue d'ensemble — desktop ≥ 1280px

```
┌─────────────────────────────────────────────────────────────────────┐
│  [HEADER — sticky · 80px · item Journal actif]                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  01. HERO DU JOURNAL                                                │
│      Titre éditorial + intro courte + fleuron champagne             │
│      Pas de photo de fond — fond crème noble                        │
│      Hauteur : 480px                                                │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  02. ARTICLE FEATURED                                               │
│      Article mis en avant éditorialement                            │
│      Layout asymétrique : photo grande gauche, texte droite         │
│      Hauteur : 560px                                                │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  03. FILTRE PAR CATÉGORIES                                          │
│      6 pills horizontales (Toutes + 5 catégories)                   │
│      Comportement : filtrage dynamique sans page reload             │
│      Hauteur : 100px                                                │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  04. GRILLE DES ARTICLES                                            │
│      12 articles en grille 3 colonnes                               │
│      Bouton « Voir plus » en bas (pagination élégante)              │
│      Hauteur : 1480px (12 articles)                                 │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  05. NEWSLETTER                                                     │
│      Bandeau sauge pâle pleine largeur                              │
│      Fleuron champagne + tagline + formulaire                       │
│      Hauteur : 380px                                                │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  06. CROSS-LINK MAISON                                              │
│      Vers /maison (à propos) ou /rituel (philosophie)               │
│      Bandeau éditorial avec photo + texte                           │
│      Hauteur : 320px                                                │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  [FOOTER — encre · 320px]                                           │
└─────────────────────────────────────────────────────────────────────┘
```

### Hauteur totale approximative

- **Desktop (1440×900)** : ~3 720px (4.1 viewports — page modérément longue)
- **Tablet (768×1024)** : ~4 200px (4.1 viewports)
- **Mobile (390×844)** : ~5 800px (6.9 viewports — articles empilés en mobile)

### Différences architecturales avec les pages précédentes

| Spécificité            | `/journal`                                       |
| :--------------------- | :----------------------------------------------- |
| **Pas de CTA d'achat** | Aucun bouton « Recevoir le rituel » sur cette page |
| **Newsletter centrale** | La seule page du site avec une section newsletter |
| **Filtrage dynamique** | Catégories filtrent sans rechargement de page    |
| **Pagination élégante** | « Voir plus » au lieu de pages numérotées        |
| **Update fréquent**    | Le contenu de la grille évolue tous les 14 jours  |

### Rythme de lecture intentionnel

| Section                | Densité       | Rythme                  | Type de contenu              |
| :--------------------- | :------------ | :---------------------- | :--------------------------- |
| 01. Hero               | Très aérée    | Suspension              | Titre + intro + fleuron      |
| 02. Article featured   | Modérée       | Lecture engagée         | Photo + texte                |
| 03. Filtre catégories  | Très aérée    | Choix rapide            | 6 pills                      |
| 04. Grille articles    | Dense         | Picorage éditorial      | 12 cartes                    |
| 05. Newsletter         | Aérée         | Décision d'engagement   | Formulaire + intro           |
| 06. Cross-link maison  | Aérée         | Curiosité étendue       | Bandeau éditorial            |

> **Principe** : alternance constante entre dense (grille) et aéré (sections de transition). La cliente n'est jamais saturée plus de 2 viewports d'affilée.

---

## 4 — Header — élément persistant

### Comportement spécifique sur `/journal`

Le header est globalement identique à celui des autres pages, **avec ces différences** :

| Différence                  | Spécification                                                              |
| :-------------------------- | :------------------------------------------------------------------------- |
| **Item actif**              | « JOURNAL » dans le menu : couleur Encre `#2C2A28`, underline 1px sauge dark, offset 6px |
| **Fond initial**            | `rgba(251, 248, 241, 0.94)` — opaque dès l'arrivée (pas de hero photo qui appellerait la transparence) |
| **CTA panier**              | Identique. Reste affiché (la cliente peut avoir un panier en cours d'achat sur d'autres pages) |
| **Pas de barre de progression** | Comme sur `/kit`, pas de barre de scroll progress (la page n'est pas longue lecture) |

### Tactiques héritées

Les tactiques `4 OPTIONS MAX`, `ENTRY POINT FOCAL`, `GROUP SIMILAR ITEMS`, `FRIENDLY COLD`, `STICKY MOMENTUM` sont identiques à `/accueil` et autres pages.

### Recherche dans le header — V1 vs V2

| Version | Comportement                                                              |
| :------ | :------------------------------------------------------------------------ |
| **V1 (MVP)** | Pas de recherche dans le header. Les catégories suffisent à orienter |
| **V2** | Icône loupe à côté du panier qui ouvre une mini-search overlay au-dessus du contenu |

> **Pourquoi pas de recherche en V1 ?** Parce que :
> 1. Avec ~20-30 articles maximum la première année, la recherche n'apporte rien de plus que la grille
> 2. Une barre de recherche **vide** est psychologiquement intimidante (suggère que la cliente devrait savoir quoi chercher)
> 3. Le filtre par catégories est plus **éditorial** que la recherche full-text — il guide vers une lecture, ne demande pas une intention précise

### Sticky behavior

Le header est sticky (`position: sticky; top: 0`). Au scroll au-delà de 80px :

| État du header                | Apparence                                                       |
| :---------------------------- | :-------------------------------------------------------------- |
| Top de page (scrollY = 0)     | Background `rgba(251, 248, 241, 0.94)`, hauteur 80px             |
| Scroll > 80px                 | Background `rgba(251, 248, 241, 0.97)`, hauteur 64px (compressé), ombre subtile `box-shadow: 0 1px 0 rgba(44,42,40,0.06)` |
| Transition entre les deux     | 240ms `cubic-bezier(0.4, 0, 0.2, 1)`                            |

---

## 5 — Section 01 — Hero du Journal

### 5.1 — Wireframe complet

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│                                                                            │
│                                                                            │
│                                ╱──╲                                        │
│                               ╱ ◆ ╲     ← fleuron champagne                │
│                                ╲╱                                          │
│                                                                            │
│                              LE JOURNAL                                    │
│                                                                            │
│                          Le carnet de la maison.                           │
│                                                                            │
│                  Des textes sur la beauté lente, la culture                 │
│                  du soin, et les matières qui nous tiennent.               │
│                                                                            │
│                                                                            │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 — Composition générale

| Propriété              | Valeur                                                          |
| :--------------------- | :-------------------------------------------------------------- |
| Fond                   | `#FBF8F1` (Crème) — uni, aucune photo                            |
| Hauteur                | 480px (desktop) · 420px (tablet) · 380px (mobile)                |
| Padding vertical       | 80px (haut) · 80px (bas)                                         |
| Padding latéral        | 96px (desktop) · 64px (tablet) · 24px (mobile)                  |
| Alignement contenu     | Centré horizontalement et verticalement                          |
| Largeur max contenu    | 720px (force la lisibilité du texte d'introduction)              |

### 5.3 — Pourquoi un hero **sans photo** ?

C'est un choix capital qui distingue `/journal` des trois pages précédentes.

| Page         | Hero contient...                            | Justification                                           |
| :----------- | :------------------------------------------ | :------------------------------------------------------ |
| `/accueil`   | Vagues décoratives + texte                  | Première rencontre, signature graphique forte           |
| `/rituel`    | Photo lifestyle pleine largeur (mains)       | Récit incarné, début d'histoire                          |
| `/kit`       | Photo contextuelle produit (kit + main + tasse) | Décision d'achat, le produit doit être vu               |
| **`/journal`** | **Aucune photo — fond crème uni**         | **Le Journal est un magazine. Un magazine a une couverture, mais sa couverture **n'est pas** une photo — c'est sa typographie.** |

> **Inspiration éditoriale** : les magazines littéraires de référence (*The Paris Review*, *Granta*, *Apartamento*) commencent toujours par une page typographique pure — le titre, l'intro, c'est tout. La photo arrive après.

### 5.4 — Fleuron champagne

#### Spécifications

```
                                ╱──╲
                               ╱ ◆ ╲
                                ╲╱
```

| Propriété         | Valeur                                                          |
| :---------------- | :-------------------------------------------------------------- |
| Type              | Losange champagne entre deux filets fins (signature graphique de la maison) |
| Couleur           | `#C8A876` (Champagne)                                            |
| Largeur           | 80px                                                             |
| Hauteur           | 12px                                                             |
| Position          | Centré, 32px au-dessus du surtitre                                |

> **Le Champagne sur `/journal`** : c'est l'une des deux apparitions du Champagne sur la page (avec le fleuron de la newsletter en section 05). Cette discipline graphique signale au regard que `/journal` appartient à la **sphère noble** de la maison, au même titre que les manifestes de `/accueil` et le hero de `/rituel`.

#### Animation d'entrée du fleuron

```
[t=0ms]      → Fond crème uni, page chargée
[t=200ms]    → Fleuron fade-in + scale-up (0.85 → 1.0) en 600ms ease-out
[t=600ms]    → Surtitre fade-in (500ms)
[t=900ms]    → Titre fade-in + translate-up 12px (700ms)
[t=1500ms]   → Intro paragraph fade-in (600ms)
[t=2100ms]   → Animations terminées
```

### 5.5 — Surtitre

```
LE JOURNAL
```

| Propriété      | Valeur                                              |
| :------------- | :-------------------------------------------------- |
| Police         | Inter SemiBold                                      |
| Taille         | 9pt (desktop) · 8pt (mobile)                         |
| Letter-spacing | 4px (tracking 400)                                  |
| Couleur        | `#C8A876` (Champagne) — pour appartenir à la sphère noble |
| Transformation | uppercase                                            |
| Position       | Centré, 24px sous le fleuron                         |

> **Pourquoi Champagne ici ?** Parce que la noblesse éditoriale du Journal est marquée par cette couleur précieuse — comme un sceau. Sur les autres pages, le surtitre des sections internes est en Brume (sobre). Ici, c'est exceptionnellement en Champagne.

### 5.6 — Titre principal

```
Le carnet de la maison.
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Light Italic                              |
| Taille          | 56pt (desktop) · 42pt (tablet) · 32pt (mobile)               |
| Style           | Italic — signature des titres méditatifs                      |
| Line-height     | 1.15                                                          |
| Letter-spacing  | -0.5px                                                        |
| Couleur         | `#2C2A28` (Encre)                                            |
| Disposition     | Une ligne (desktop, tablet) · une ou deux lignes (mobile)     |
| Espacement haut | 16px sous le surtitre                                         |
| Alignement      | Centré                                                       |

##### Pourquoi cette formulation ?

- **« Le carnet »** — pas « Le blog », pas « Le magazine », pas « Notre actualité ». Carnet est un objet **personnel**, **intime**, **manuscrit**. Le mot est délibérément intemporel et littéraire.
- **« de la maison »** — appartenance à FemiGlow sans dire FemiGlow. La cliente comprend que ce sont les mots de la maison qu'elle connaît déjà.
- **Le point final** — affirmation, pas suspension. Pas d'auto-promotion (« notre journal », « le journal de FemiGlow »). Juste : **c'est ce que c'est**.

### 5.7 — Intro paragraph

```
Des textes sur la beauté lente, la culture
du soin, et les matières qui nous tiennent.
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Regular                                   |
| Taille          | 18pt (desktop) · 16pt (tablet) · 15pt (mobile)               |
| Line-height     | 1.6                                                          |
| Couleur         | `#4A4844` (Encre claire)                                     |
| Disposition     | Deux lignes (coupure manuelle après « culture »)              |
| Espacement haut | 32px sous le titre principal                                  |
| Alignement      | Centré                                                       |
| Largeur max     | 540px (force la lisibilité, pas de fluide)                    |

##### Décomposition stratégique

| Fragment                              | Fonction stratégique                                       |
| :------------------------------------ | :--------------------------------------------------------- |
| « Des textes »                        | Pas « articles », pas « contenus » — vocabulaire littéraire |
| « sur la beauté lente »               | Positionnement éditorial clair (slow beauty)               |
| « la culture du soin »                | Élargit au-delà du produit FemiGlow (universel)            |
| « les matières qui nous tiennent »    | Personnalisation — « nous » inclut la cliente              |

> **« Les matières qui nous tiennent »** est délibérément ambigu : *qui nous tiennent par leur beauté ? par leur science ? par leur histoire ?* Le verbe **« tenir »** crée une affection — comme on tient à quelqu'un.

### 5.8 — Aucun CTA, aucun lien dans le hero

C'est un choix capital. Le hero du Journal ne contient :
- Pas de bouton « Lire les articles »
- Pas de bouton « S'inscrire à la newsletter »
- Pas de lien « Découvrir la maison »
- Pas d'indicateur de scroll en bas

> **Pourquoi cette austérité ?** Parce que la cliente **descend déjà naturellement** vers le contenu (les articles arrivent en section 02). Lui ajouter un CTA serait du bruit. La typographie + le fleuron suffisent.

### 5.9 — Tokens design

```css
/* ─── Hero du Journal — tokens ─── */
--journal-hero-bg: #FBF8F1;
--journal-hero-height-desktop: 480px;
--journal-hero-padding-vertical: 80px;
--journal-hero-padding-x-desktop: 96px;
--journal-hero-padding-x-mobile: 24px;
--journal-hero-content-max-width: 720px;

--journal-fleuron-color: #C8A876;
--journal-fleuron-width: 80px;
--journal-fleuron-height: 12px;
--journal-fleuron-margin-bottom: 32px;

--journal-kicker-color: #C8A876;
--journal-kicker-font: 'Inter', sans-serif;
--journal-kicker-weight: 600;
--journal-kicker-size: 9pt;
--journal-kicker-tracking: 4px;
--journal-kicker-margin-bottom: 16px;

--journal-title-font: 'Cormorant Garamond', serif;
--journal-title-style: italic;
--journal-title-weight: 300;
--journal-title-size-desktop: 56pt;
--journal-title-line-height: 1.15;
--journal-title-color: #2C2A28;

--journal-intro-font: 'Cormorant Garamond', serif;
--journal-intro-weight: 400;
--journal-intro-size: 18pt;
--journal-intro-line-height: 1.6;
--journal-intro-color: #4A4844;
--journal-intro-max-width: 540px;
--journal-intro-margin-top: 32px;
```

### 5.10 — Comportements UX

#### Pas de parallaxe

Contrairement aux heros avec photo (`/rituel`, `/kit`), le hero `/journal` est **statique**. Le scroll fait simplement défiler le contenu vers la section suivante.

#### Aucun hover, aucun click

Tout dans le hero est **non-interactif**. C'est un titre de magazine — on ne clique pas sur un titre.

### 5.11 — Psychologie & neuromarketing

#### Tactique 1 — Empty space (maximisé)

Le hero fait 480px de hauteur. Le contenu (fleuron + surtitre + titre + intro) occupe environ 220px. Soit **54% de la section est vide**. Cette quantité de vide est la signature graphique des magazines littéraires haut de gamme.

> **Sevilla & Townsend (2016)** : *« Empty space increases perceived premium by 23%. »* Sur une page éditoriale, cet effet est encore plus important — le vide signale que la marque a les moyens de ne **pas** remplir.

#### Tactique 2 — Indirect claim par sobriété

Au lieu de dire *« nous sommes une marque de luxe qui a son journal »*, la sobriété **prouve** la classe. La cliente infère : *« cette page est trop dépouillée pour être une marque ordinaire ».*

#### Tactique 3 — Magazine framing

Les magazines de référence (*The New Yorker*, *Apartamento*) ont des couvertures **typographiques pures**. Reproduire ce code visuel **place** instantanément le Journal dans cette catégorie cognitive.

#### Tactique 4 — Champagne signal

Le Champagne, vu pour la première fois sur cette page, signale à la cliente qu'elle est dans la **sphère noble** de la maison — celle qu'elle a connue sur le hero de `/rituel`, sur les manifestes de `/accueil`, dans le pivot kit. Continuité de marque.

#### Tactique 5 — Italic = méditation

Le titre est en italic. Sur les pages produits/conversion, les titres principaux sont en **regular** (affirmation). Ici, l'italic dit : *« je médite, je n'ordonne pas ».* La cliente est invitée à entrer dans la pensée, pas à acheter.

### 5.12 — Émotion à provoquer

| Étape       | Émotion                                                          |
| :---------- | :--------------------------------------------------------------- |
| Arrivée     | Apaisement (fond uni, typographie aérée)                         |
| 2 secondes  | Reconnaissance (le wordmark, la palette, le ton)                  |
| 4 secondes  | Compréhension (« c'est le journal de cette maison »)              |
| 6 secondes  | Disposition à lire (l'intro promet du contenu littéraire)         |
| 8 secondes  | Premier scroll — entrée dans l'article featured                   |

### 5.13 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| Photo de fond derrière le titre                     | Casse la pureté typographique du magazine littéraire                |
| Titre « Notre Journal » ou « Notre Blog »           | Possessif inutile, casse la sobriété                                |
| Surtitre en Brume au lieu de Champagne              | Détruit la noblesse éditoriale signalée                            |
| Titre en regular (au lieu d'italic)                 | Trop affirmatif pour une page de méditation                         |
| Intro trop longue (3+ lignes)                       | Casse la respiration — 2 lignes suffisent                          |
| CTA visible (« Lire les articles »)                 | Inutile — la cliente scrolle naturellement                          |
| Indicateur de scroll bas                            | Casse la sobriété                                                   |
| Animation parallaxe                                 | Le magazine ne bouge pas                                            |
| Compteur d'articles (« 27 articles publiés »)       | Vulgaire, code SaaS                                                 |

---

## 6 — Section 02 — Article featured

### 6.1 — Wireframe

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│  ┌──────────────────────────────────┐    ┌────────────────────────────┐  │
│  │                                  │    │                            │   │
│  │                                  │    │  À LA UNE                  │   │
│  │                                  │    │                            │   │
│  │                                  │    │  Hiver, ongles,            │   │
│  │                                  │    │  et patience.              │   │
│  │   [PHOTO LIFESTYLE PLEINE        │    │                            │   │
│  │   LARGEUR]                       │    │  Pourquoi le froid abîme   │   │
│  │                                  │    │  les mains, et comment le  │   │
│  │   [Ratio 4:5 portrait]           │    │  rituel répond — fragment  │   │
│  │   [Lumière douce d'hiver]        │    │  de saison.                │   │
│  │   [Mains détendues, livre fermé] │    │                            │   │
│  │                                  │    │  ─                         │   │
│  │                                  │    │                            │   │
│  │                                  │    │  Saison · 8 minutes        │   │
│  │                                  │    │  Le 12 avril 2026          │   │
│  │                                  │    │                            │   │
│  │                                  │    │  ┌────────────────────┐    │   │
│  │                                  │    │  │  Lire l'article →  │    │   │
│  │                                  │    │  └────────────────────┘    │   │
│  │                                  │    │                            │   │
│  └──────────────────────────────────┘    └────────────────────────────┘  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 — Disposition générale

| Breakpoint | Layout                                                                |
| :--------- | :-------------------------------------------------------------------- |
| Desktop    | 60% photo (gauche) · 40% bloc info (droite) — gap 64px                |
| Tablet     | 55% photo · 45% bloc info — gap 48px                                  |
| Mobile     | 100% photo (haut) · 100% bloc info (bas) — gap 32px                   |

Hauteur : **560px** desktop · auto mobile.

> **Pourquoi 60/40 ?** Parce que la photo de l'article featured est **très visuelle** (mode magazine couverture). Le bloc info est dense en information mais doit rester second visuellement. C'est l'inverse stratégique de `/kit` (où le bloc info dominait à 45%).

### 6.3 — Photo de l'article featured

#### Composition

| Propriété          | Valeur                                                                |
| :----------------- | :-------------------------------------------------------------------- |
| Sujet              | Photo lifestyle thématique de l'article (varie à chaque featured)     |
| Pour l'exemple     | Mains détendues posées, livre fermé à côté, lumière douce d'hiver     |
| Format             | 4:5 (portrait) sur desktop · 4:3 sur tablet · 3:4 sur mobile          |
| Hauteur affichage  | ~520px (desktop) · auto (mobile)                                       |
| Largeur            | 60% de la grille (desktop) · 100% (mobile)                            |
| Border             | Aucun                                                                  |
| Border-radius      | 0                                                                      |

#### Direction artistique

| Élément photographique     | Direction                                                       |
| :------------------------- | :-------------------------------------------------------------- |
| **Lumière**                | Naturelle, en accord avec l'article (hiver = lumière froide oblique, été = lumière chaude haute) |
| **Composition**            | Lifestyle — toujours un objet contextuel (livre, tasse, plante, plaid) |
| **Mains**                  | Visibles ou implicites, jamais de visage                         |
| **Tonalité**               | Calibrée selon la saison de l'article, mais palette toujours dans la sphère FemiGlow (chaud, terreux) |
| **Format de fichier**      | WebP 1200×1500 desktop / 800×600 mobile                          |

> **Important** : la photo de l'article featured **change** quand l'article featured change. C'est une variable éditoriale, pas une constante. Le système doit permettre à l'équipe éditoriale de changer la photo en CMS.

### 6.4 — Bloc info — copy intégral (exemple)

#### Surtitre — badge « À LA UNE »

```
À LA UNE
```

| Propriété      | Valeur                                              |
| :------------- | :-------------------------------------------------- |
| Police         | Inter SemiBold                                      |
| Taille         | 8.5pt                                               |
| Letter-spacing | 3px                                                 |
| Couleur        | `#C8A876` (Champagne) — signal d'exception           |
| Transformation | uppercase                                            |
| Position       | En haut du bloc info, alignement à gauche           |

> **Le Champagne sur cette section** : c'est la troisième apparition possible du Champagne sur la page (après le hero, et avant la newsletter). À cause de cette densité, le badge « À LA UNE » est **petit** (8.5pt) et **fin** — il signale sans crier.

#### Titre de l'article featured

```
Hiver, ongles,
et patience.
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Light                                     |
| Taille          | 42pt (desktop) · 32pt (tablet) · 28pt (mobile)               |
| Style           | Regular (pas italic — c'est un titre d'article, pas une méditation abstraite) |
| Line-height     | 1.15                                                          |
| Letter-spacing  | -0.5px                                                        |
| Couleur         | `#2C2A28` (Encre)                                            |
| Disposition     | Deux lignes (coupure manuelle après « ongles, »)              |
| Espacement haut | 16px sous le surtitre                                         |
| Alignement      | À gauche                                                     |

> **Pourquoi le titre en regular et pas italic ?** Parce que c'est un **titre d'article**, pas un titre de section. Sur `/journal`, l'italic est réservé au titre du Journal lui-même (« Le carnet de la maison. »). Les titres d'articles sont en regular — ils annoncent un contenu, pas une méditation.

#### Description courte

```
Pourquoi le froid abîme les mains,
et comment le rituel répond — fragment
de saison.
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Regular                                   |
| Taille          | 16pt (desktop) · 15pt (tablet) · 14pt (mobile)               |
| Line-height     | 1.6                                                          |
| Couleur         | `#4A4844` (Encre claire)                                     |
| Disposition     | Trois lignes maximum                                          |
| Espacement haut | 24px sous le titre                                            |
| Alignement      | À gauche                                                     |
| Largeur max     | 380px                                                        |

##### Décomposition stratégique

| Fragment                              | Fonction                                                  |
| :------------------------------------ | :-------------------------------------------------------- |
| « Pourquoi le froid abîme les mains » | Question implicite — pique la curiosité                   |
| « et comment le rituel répond »       | Promesse de réponse — sans nommer FemiGlow                 |
| « fragment de saison »                | Tonalité littéraire — le mot « fragment » signale magazine |

#### Filet séparateur

```
─
```

| Propriété      | Valeur                                |
| :------------- | :------------------------------------ |
| Type           | Em-dash horizontal                    |
| Largeur        | 32px                                  |
| Hauteur        | 1.5px                                 |
| Couleur        | `#A8C4A6` (Sauge dark)                |
| Espacement haut| 32px                                  |
| Espacement bas | 16px                                   |
| Alignement     | Aligné à gauche                       |

#### Métadonnées

```
Saison · 8 minutes
Le 12 avril 2026
```

| Élément              | Spécifications                                                |
| :------------------- | :------------------------------------------------------------ |
| Catégorie            | Inter Medium 11pt, couleur Encre, uppercase tracking 1.5px    |
| Séparateur `·`       | Middle dot, espacement 8px                                     |
| Durée de lecture     | Inter Regular 11pt italic, couleur Brume                      |
| Ligne 2 — Date       | Inter Regular 10pt italic, couleur Brume                      |
| Espace entre lignes  | 6px                                                            |

> **Format date** : « Le 12 avril 2026 » — formulation française littéraire, pas « 12/04/2026 » qui serait administratif.

#### CTA — Lire l'article

```
Lire l'article →
```

| Propriété          | Valeur                                                                |
| :----------------- | :-------------------------------------------------------------------- |
| Police             | Inter Medium                                                          |
| Taille             | 14pt                                                                  |
| Letter-spacing     | 0.5px                                                                 |
| Texte              | `#FBF8F1` (Crème pure)                                                |
| Fond               | `#2C2A28` (Encre)                                                     |
| Padding            | 14px 28px                                                             |
| Border-radius      | 0                                                                      |
| Largeur            | Auto (pas full-width)                                                  |
| Hover              | Fond `#4A4844`, flèche `→` se déplace de 4px à droite (300ms)         |
| Active             | Scale 0.97                                                             |
| Focus              | Ring 2px sauge dark, offset 4px                                        |
| Action             | Navigation vers `/journal/hiver-ongles-patience`                       |
| Espacement haut    | 32px sous les métadonnées                                              |

> **Différence avec le CTA `/kit`** : le CTA Journal a une **flèche → qui s'anime**. Pourquoi ? Parce que c'est un CTA de **navigation** (lien interne), pas de **transaction**. La flèche signale le mouvement vers une autre page. Sur `/kit`, le CTA est un acte d'achat — pas de flèche, juste l'action.

### 6.5 — Tokens design

```css
/* ─── Article featured — tokens ─── */
--featured-bg: #FBF8F1;
--featured-padding-vertical: 96px;
--featured-grid-gap-desktop: 64px;
--featured-grid-photo-ratio-desktop: 60%;

--featured-photo-aspect: 4/5;
--featured-photo-height-desktop: 520px;

--featured-kicker-color: #C8A876;
--featured-kicker-size: 8.5pt;
--featured-kicker-tracking: 3px;

--featured-title-font: 'Cormorant Garamond', serif;
--featured-title-weight: 300;
--featured-title-size-desktop: 42pt;
--featured-title-line-height: 1.15;
--featured-title-color: #2C2A28;

--featured-description-size: 16pt;
--featured-description-color: #4A4844;
--featured-description-max-width: 380px;

--featured-divider-width: 32px;
--featured-divider-color: #A8C4A6;

--featured-meta-category-size: 11pt;
--featured-meta-category-tracking: 1.5px;
--featured-meta-date-style: italic;
--featured-meta-date-size: 10pt;
--featured-meta-color: #6B6863;

--featured-cta-bg: #2C2A28;
--featured-cta-text: #FBF8F1;
--featured-cta-padding: 14px 28px;
```

### 6.6 — Comportements UX

#### Animation au scroll

```
[section invisible]              → état initial
[atteint 80% viewport]           → photo fade-in 800ms
[atteint 70%]                    → bloc info fade-in séquentiel :
                                    - surtitre (200ms)
                                    - titre (300ms)
                                    - description (400ms)
                                    - méta (500ms)
                                    - CTA (600ms)
```

#### Hover sur le CTA

```
[hover entry]   → Fond #2C2A28 → #4A4844 (220ms)
[hover entry]   → Flèche → se déplace de 4px à droite (300ms ease-out)
[hover continu] → État stable
[hover exit]    → Inversion fluide
```

#### Hover sur la photo (desktop)

```
[hover entry]   → Très subtil zoom-in 1.02× (800ms ease-out)
[hover continu] → État stable
```

#### Click sur la photo OU sur le titre

Toute la zone photo + titre + description + CTA est cliquable et mène à l'article. Le CTA visuel est principal mais la zone élargie respecte le pattern UX moderne (« card cliquable »).

> **Implementation** : `<a href="/journal/[slug]">` enveloppe toute la card, le bouton CTA est un span stylé en bouton (pas un `<a>` imbriqué qui invaliderait le HTML).

### 6.7 — Système de gestion (CMS)

#### Pour l'équipe éditoriale

L'article featured est **manuellement sélectionné** par l'équipe éditoriale via le CMS (Strapi, Sanity, ou équivalent). Champ booléen `is_featured` sur chaque article :

```typescript
interface Article {
  slug: string;
  title: string;
  description: string;
  category: 'maison' | 'saison' | 'voix' | 'matieres' | 'pratique';
  reading_time_minutes: number;
  published_at: Date;
  featured_image: string;
  is_featured: boolean;  // ← un seul article peut être featured à la fois
  // ...
}
```

#### Comportement si plusieurs articles `is_featured = true`

Le système prend **le plus récent** (ordre par `published_at` desc).

#### Comportement si aucun article `is_featured = true`

Fallback : prend l'article le plus récent toutes catégories confondues.

#### Rotation recommandée

Changer l'article featured **toutes les 1-2 semaines** pour que les visiteuses récurrentes voient quelque chose de nouveau.

### 6.8 — Psychologie

#### Featured = autorité éditoriale

> **Magazine framing** (Reber 2002) : l'existence d'une rubrique « À LA UNE » signale au lecteur que **quelqu'un a sélectionné**, qu'il y a une **intentionnalité éditoriale**. Ce n'est pas un flux automatique chronologique — c'est un **choix**.

Cette intentionnalité **renforce la perception d'autorité** : il existe quelqu'un, quelque part, qui choisit ce qui mérite d'être à la une. Cette personne **est** la maison.

#### Layout asymétrique = magazine premium

Les blogs amateurs ont des layouts symétriques (photo carrée + texte à droite, identiques pour chaque post). Les magazines premium (*The New Yorker*, *Apartamento*, *Cereal*) utilisent **systématiquement des layouts asymétriques** pour la couverture / featured.

> Cette asymétrie crée un **rythme visuel** qui distingue immédiatement la marque.

#### CTA avec flèche = navigation, pas pression

Sur les pages produits, les CTA sont **fermes** (`Recevoir le rituel`, `Confirmer la commande`). Pas de flèche, pas d'animation directionnelle.

Sur le Journal, les CTA sont **ouverts** (`Lire l'article →`). La flèche signale le mouvement, l'invitation. C'est un **lien**, pas une **action transactionnelle**.

### 6.9 — Émotion

| Avant | Pendant | Après |
| :---- | :------ | :---- |
| Disposition à lire | Curiosité ciblée sur un article précis | Désir de cliquer (lecture engagée) OU continuer à scroller pour voir d'autres articles |

### 6.10 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| Featured aléatoire (algorithmique)                  | Casse l'autorité éditoriale — le featured est un **choix**          |
| Plusieurs featured visibles simultanément            | Choix paralysie — un seul featured à la fois                       |
| Layout symétrique 50/50                             | Code blog amateur, sort du registre magazine premium                |
| Photo de visage souriant                            | Détruit l'imply human, transforme en publicité                     |
| Description > 4 lignes                              | Trop bavard, casse la promesse de rétention                         |
| « Article du jour », « Tendance »                   | Vocabulaire SaaS / réseau social, hors registre                    |
| CTA sans flèche                                     | Casse la signature de navigation                                    |
| CTA full-width                                      | Trop affirmatif, le Journal n'impose pas                            |
| Boutons « Like », « Save » dans le bloc info         | Code social media, hors registre éditorial                         |
| Compteur de vues ou de partages                     | Casse la sobriété                                                   |

---

## 7 — Section 03 — Filtre par catégories

### 7.1 — Wireframe

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│  EXPLORER PAR THÈME                                                        │
│                                                                            │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐│
│  │  Toutes    │ │  Maison    │ │  Saison    │ │  Voix      │ │  Matières  ││
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘ └────────────┘│
│                                                                  ┌────────┐│
│                                                                  │ Pratique││
│                                                                  └────────┘│
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 — Composition

#### Surtitre

```
EXPLORER PAR THÈME
```

| Propriété      | Valeur                                  |
| :------------- | :-------------------------------------- |
| Police         | Inter SemiBold                          |
| Taille         | 7.5pt                                   |
| Letter-spacing | 2.5px                                   |
| Couleur        | `#6B6863` (Brume) — pas Champagne       |
| Position       | Centré, 24px au-dessus des pills        |

> **Pourquoi pas Champagne ici ?** Parce que cette section est **fonctionnelle** (filtre), pas éditoriale. Le Champagne reste réservé aux moments nobles (hero du Journal, badge À LA UNE de l'article featured, fleuron newsletter).

#### Disposition

| Breakpoint | Layout                                                  |
| :--------- | :------------------------------------------------------ |
| Desktop    | 6 pills sur une ligne, centrées, gap 12px               |
| Tablet     | 6 pills sur une ligne (peut wrap si manque de place)    |
| Mobile     | Scroll horizontal — toutes les pills visibles par swipe |

Hauteur de la section : **100px** desktop · **120px** mobile (avec scroll).

### 7.3 — Spécifications de chaque pill

#### État repos

```
┌────────────┐
│  Saison    │
└────────────┘
```

| Propriété          | Valeur                                                          |
| :----------------- | :-------------------------------------------------------------- |
| Police             | Inter Medium                                                    |
| Taille             | 13pt                                                            |
| Couleur texte      | `#4A4844` (Encre claire)                                        |
| Fond               | Transparent                                                     |
| Border             | 1px solid `#E8E0D2` (Ligne)                                    |
| Border-radius      | 999px (pill ovale)                                              |
| Padding            | 10px 24px                                                        |
| Cursor             | `pointer`                                                       |
| Transition         | All 220ms `cubic-bezier(0.4, 0, 0.2, 1)`                        |

#### État hover

| Propriété          | Valeur                                                          |
| :----------------- | :-------------------------------------------------------------- |
| Border             | 1px solid `#A8C4A6` (Sauge dark)                                |
| Couleur texte      | `#2C2A28` (Encre)                                                |

#### État actif (sélectionné)

| Propriété          | Valeur                                                          |
| :----------------- | :-------------------------------------------------------------- |
| Fond               | `#2C2A28` (Encre)                                                |
| Border             | 1px solid `#2C2A28`                                              |
| Couleur texte      | `#FBF8F1` (Crème pure)                                          |

#### État focus (clavier)

| Propriété          | Valeur                                                          |
| :----------------- | :-------------------------------------------------------------- |
| Outline            | 2px solid `#A8C4A6` (Sauge dark)                                |
| Outline-offset     | 4px                                                              |

### 7.4 — Les six pills — copy exact

| Position | Label        | Filter value     | Compteur visible ?    |
| :------- | :----------- | :--------------- | :-------------------- |
| 1        | `Toutes`     | `all`            | Non (par défaut)      |
| 2        | `Maison`     | `maison`         | Non                   |
| 3        | `Saison`     | `saison`         | Non                   |
| 4        | `Voix`       | `voix`           | Non                   |
| 5        | `Matières`   | `matieres`       | Non                   |
| 6        | `Pratique`   | `pratique`       | Non                   |

> **Pas de compteur d'articles par catégorie** (« Maison (12) »). Pourquoi ? Parce que cela transforme la catégorie en **statistique** plutôt qu'en **invitation à la lecture**. Le code visuel d'un magazine n'affiche pas le nombre de pages par section.

### 7.5 — État par défaut

À l'arrivée sur `/journal`, **« Toutes »** est sélectionnée par défaut. Toutes les catégories sont visibles dans la grille de la section 04.

### 7.6 — Comportement de filtrage

#### Filtrage dynamique (sans rechargement de page)

Quand la cliente clique sur une pill (autre que « Toutes ») :

```
[t=0ms]      → Click sur la pill
[t=0-200ms]  → Pill clickée passe à l'état actif (animation transition)
[t=0-200ms]  → Pill précédente (« Toutes » par défaut) repasse à l'état repos
[t=200ms]    → URL mise à jour : /journal?cat=saison (sans reload, via History API)
[t=200ms]    → Articles filtrés : fade-out 300ms des articles non-correspondants
[t=500ms]    → Articles correspondants : reflow + fade-in 300ms (cascade 50ms entre chaque)
[t=900ms]    → Animation terminée
```

#### URL parameter

| Filtre actif    | URL                              |
| :-------------- | :------------------------------- |
| Toutes          | `/journal`                       |
| Maison          | `/journal?cat=maison`            |
| Saison          | `/journal?cat=saison`            |
| Voix            | `/journal?cat=voix`              |
| Matières        | `/journal?cat=matieres`          |
| Pratique        | `/journal?cat=pratique`          |

#### Deep link

Si la cliente arrive directement sur `/journal?cat=voix` (par exemple via un lien dans un email), la pill « Voix » est **automatiquement active** au chargement. La grille affiche directement les articles filtrés.

### 7.7 — Tokens design

```css
/* ─── Filtre catégories — tokens ─── */
--filter-bg: #FBF8F1;
--filter-padding-vertical: 32px;

--filter-kicker-color: #6B6863;
--filter-kicker-tracking: 2.5px;
--filter-kicker-margin-bottom: 24px;

--filter-pill-gap: 12px;
--filter-pill-padding: 10px 24px;
--filter-pill-border-radius: 999px;
--filter-pill-border-width: 1px;
--filter-pill-border-color: #E8E0D2;
--filter-pill-bg: transparent;
--filter-pill-text-color: #4A4844;
--filter-pill-font-size: 13pt;
--filter-pill-font-weight: 500;
--filter-pill-transition: all 220ms cubic-bezier(0.4, 0, 0.2, 1);

/* État actif */
--filter-pill-active-bg: #2C2A28;
--filter-pill-active-border-color: #2C2A28;
--filter-pill-active-text-color: #FBF8F1;

/* État hover */
--filter-pill-hover-border-color: #A8C4A6;
--filter-pill-hover-text-color: #2C2A28;
```

### 7.8 — Comportements UX

#### Animation au scroll

Pas d'animation d'entrée — les pills sont fonctionnelles, leur apparition discrète au moment du scroll suffit. Simple `opacity: 0 → 1` en 400ms.

#### Comportement clavier

| Touche                | Comportement                                          |
| :-------------------- | :---------------------------------------------------- |
| Tab                   | Focus sur la pill suivante                            |
| Shift+Tab             | Focus sur la pill précédente                          |
| Enter / Espace        | Active la pill focusée                                 |
| Flèches gauche/droite | (Optionnel V2) Navigation entre pills sans Tab        |

#### Comportement mobile — scroll horizontal

```css
.filter-container {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  scroll-snap-type: x proximity;
  scroll-padding: 24px;
  padding: 0 24px;
}

.filter-pill {
  scroll-snap-align: start;
  flex-shrink: 0;
}

/* Hide scrollbar */
.filter-container::-webkit-scrollbar {
  display: none;
}
.filter-container {
  scrollbar-width: none;
}
```

> **Indicateurs visuels mobile** : un léger **gradient de fade** sur les bords droite et gauche du container indique qu'il y a plus de contenu en dehors du viewport. Pas de flèches, pas de dots — la gestuelle naturelle suffit.

### 7.9 — Aucune indication de résultat

Volontairement, **pas d'indicateur** type *« 4 articles dans la catégorie Saison ».* Pourquoi ?

- Statistique = vulgaire (cf. argument du compteur dans pills)
- Si la catégorie a peu d'articles, l'indicateur **dévalue** la catégorie
- La grille **est** l'indicateur — la cliente voit directement les articles affichés

Si une catégorie n'a **aucun** article (cas rare), un message paisible apparaît à la place de la grille :

```
Aucun article dans cette catégorie pour l'instant.
La maison y travaille.
```

| Propriété      | Valeur                                                  |
| :------------- | :------------------------------------------------------ |
| Police         | Cormorant Garamond Light Italic                         |
| Taille         | 17pt                                                    |
| Couleur        | `#6B6863` (Brume)                                       |
| Alignement     | Centré                                                   |
| Hauteur section | 320px                                                   |

### 7.10 — Psychologie

#### Curation over choice (Iyengar 2000)

> **Iyengar's jam study** : *« Trop de choix paralyse. 6 options est l'optimum cognitif. »*

Six pills (Toutes + 5 catégories) — exactement le nombre optimal. Plus serait fatigue cognitive ; moins serait insuffisant pour structurer la diversité éditoriale.

#### Pills = code magazine moderne

Les pills (boutons ovales) sont le code visuel des **magazines numériques contemporains** (*The Atlantic*, *The Cut*, *Apartamento online*). Reproduire ce code place le Journal dans cette catégorie.

#### Filtrage dynamique = expérience moderne

> **Norman (1988)** — *« Visible state changes increase user confidence. »*

Le filtrage sans rechargement (instantané, fluide) **rassure** la cliente : elle voit que le système **répond**. Un rechargement de page complet créerait un moment d'incertitude (« est-ce que ça a marché ? »).

#### Pas de tags multi-sélection

Volontairement, la cliente ne peut sélectionner **qu'une catégorie à la fois**. Pourquoi ?

- Multi-sélection = complexité cognitive (UX SaaS)
- La cliente cherche **une atmosphère** (Saison, Voix, etc.), pas une intersection précise
- Le code magazine est mono-catégorie

### 7.11 — Émotion

| Avant | Pendant | Après |
| :---- | :------ | :---- |
| Curiosité ciblée (post-featured) | Choix éditorial orienté | Sélection apaisée OU défaut « Toutes » conservé |

### 7.12 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| Plus de 6 pills                                     | Choix paralysie (Iyengar 2000)                                     |
| Compteurs sur les pills (« Maison (8) »)            | Vulgaire, code SaaS, dévalue les catégories peu fournies            |
| Pills carrées (border-radius: 0)                    | Ne correspond pas au code magazine moderne                          |
| Pills colorées (chacune une couleur)                 | Casse la palette signature, code site enfant                        |
| Multi-sélection                                     | Complexité cognitive inutile                                        |
| Animation au hover : scale-up 1.1                    | Trop excessive, casse la sobriété                                   |
| Rechargement de page complet sur clic               | Expérience datée, casse le flux                                    |
| Indicateur « X articles trouvés »                   | Vulgaire, statistique                                               |

---

## 8 — Section 04 — Grille des articles

### 8.1 — Wireframe

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                      │
│  │              │  │              │  │              │                      │
│  │  [photo 4:3] │  │  [photo 4:3] │  │  [photo 4:3] │                      │
│  │              │  │              │  │              │                      │
│  │  Titre de    │  │  Titre de    │  │  Titre de    │                      │
│  │  l'article   │  │  l'article   │  │  l'article   │                      │
│  │  ─           │  │  ─           │  │  ─           │                      │
│  │  Maison · 6m │  │  Saison · 8m │  │  Voix · 12m  │                      │
│  │  Le 5 mai    │  │  Le 28 avril │  │  Le 12 avril │                      │
│  └──────────────┘  └──────────────┘  └──────────────┘                      │
│                                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                      │
│  │              │  │              │  │              │                      │
│  │  ...         │  │  ...         │  │  ...         │                      │
│  │              │  │              │  │              │                      │
│  └──────────────┘  └──────────────┘  └──────────────┘                      │
│                                                                            │
│  [9 cartes supplémentaires en grille 3 colonnes]                           │
│                                                                            │
│              ┌─────────────────────────────┐                               │
│              │    Voir d'autres articles    │                              │
│              └─────────────────────────────┘                               │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 — Disposition

| Breakpoint | Layout                                                                |
| :--------- | :-------------------------------------------------------------------- |
| Desktop    | Grille 3 colonnes, gap 32px (vertical) × 24px (horizontal), max-width 1200px |
| Tablet     | Grille 2 colonnes, gap 28px × 20px                                    |
| Mobile     | 1 colonne, gap 32px                                                   |

Hauteur section : ~**1480px** desktop avec 12 articles · auto mobile.

### 8.3 — Pagination — comportement « Voir plus »

#### État initial

Affichage de **12 articles** au chargement initial de la page. Si moins de 12 articles existent dans la catégorie filtrée, tous sont affichés.

#### Click sur « Voir plus »

```
[t=0ms]      → Click sur le bouton « Voir d'autres articles »
[t=0-200ms]  → Bouton scale 0.97 (feedback)
[t=200-400ms]→ Bouton fade-out + spinner mini visible
[t=400-600ms]→ API GET /api/journal/articles?cat=saison&offset=12&limit=9 (idéal < 200ms)
[t=600-900ms]→ 9 nouveaux articles apparaissent en cascade (50ms entre chaque, 400ms chacune)
[t=900ms]    → Bouton revient (« Voir d'autres articles ») si plus d'articles existent
[t=900ms]    → Bouton disparaît si tous les articles sont chargés (état final)
```

#### Pas de pagination chiffrée (1, 2, 3...)

Volontairement, **pas de page numérotée**. Pourquoi ?

- La pagination chiffrée est **fonctionnelle** (code admin)
- « Voir plus » est **éditorial** (le magazine se déroule, ne se feuillette pas)
- L'expérience est **fluide**, sans saut de scroll

> **Inspiration** : *Apartamento online*, *The New Yorker* — tous utilisent un load-more progressif, jamais des pages numérotées.

### 8.4 — Spécifications de chaque carte article

#### Container

| Propriété         | Valeur                                                          |
| :---------------- | :-------------------------------------------------------------- |
| Largeur           | 33.3% - gap (desktop)                                            |
| Padding           | 0 (pas de padding interne — la photo touche les bords)          |
| Border            | Aucun                                                            |
| Border-radius     | 0                                                                |
| Background        | Transparent                                                      |
| Cursor            | `pointer` — toute la carte est cliquable                         |

#### Photo

| Propriété         | Valeur                                                                |
| :---------------- | :-------------------------------------------------------------------- |
| Format            | 4:3 (paysage)                                                          |
| Hauteur affichée  | 240px (desktop) · 200px (tablet) · 220px (mobile)                     |
| Width             | 100% du container                                                      |
| Object-fit        | `cover`                                                                |
| Border            | Aucun                                                                  |
| Border-radius     | 0                                                                      |

#### Bloc info (sous la photo)

| Propriété         | Valeur                                                          |
| :---------------- | :-------------------------------------------------------------- |
| Padding top       | 16px                                                             |
| Padding bottom    | 0                                                                |
| Padding gauche/droite | 0                                                            |

#### Titre de l'article

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Light                                     |
| Taille          | 22pt (desktop) · 20pt (tablet) · 20pt (mobile)               |
| Style           | Regular (pas italic — code titre d'article)                   |
| Line-height     | 1.2                                                          |
| Couleur         | `#2C2A28` (Encre)                                            |
| Disposition     | Maximum 2 lignes (truncate avec `...` si plus long)           |

#### Filet séparateur

```
─
```

| Propriété      | Valeur                                |
| :------------- | :------------------------------------ |
| Largeur        | 24px                                  |
| Hauteur        | 1px                                   |
| Couleur        | `#A8C4A6` (Sauge dark)                |
| Espacement haut| 12px (sous le titre)                  |
| Espacement bas | 12px (au-dessus des méta)             |

#### Métadonnées

```
Maison · 6 minutes
Le 5 mai 2026
```

| Élément              | Spécifications                                                |
| :------------------- | :------------------------------------------------------------ |
| Catégorie            | Inter Medium 10pt, couleur Encre, uppercase tracking 1.5px    |
| Séparateur `·`       | Middle dot, espacement 6px                                     |
| Durée de lecture     | Inter Regular 10pt italic, couleur Brume                      |
| Ligne 2 — Date       | Inter Regular 10pt italic, couleur Brume                      |
| Espace entre lignes  | 4px                                                            |

### 8.5 — Bouton « Voir d'autres articles »

```
┌─────────────────────────────┐
│   Voir d'autres articles    │
└─────────────────────────────┘
```

| Propriété          | Valeur                                                                |
| :----------------- | :-------------------------------------------------------------------- |
| Police             | Inter Medium                                                          |
| Taille             | 13pt                                                                  |
| Letter-spacing     | 0.5px                                                                 |
| Texte              | `#2C2A28` (Encre)                                                     |
| Fond               | Transparent                                                            |
| Border             | 1px solid `#2C2A28`                                                   |
| Padding            | 14px 32px                                                             |
| Border-radius      | 0                                                                      |
| Largeur            | Auto                                                                   |
| Position           | Centré sous la grille, espacement 64px                                  |
| Hover              | Fond `#2C2A28`, texte `#FBF8F1` (inversion), transition 220ms          |
| Active             | Scale 0.97                                                             |
| Focus              | Ring 2px sauge dark, offset 4px                                        |

> **Pourquoi un CTA outline (et pas plein) ?** Parce que c'est un CTA de **continuation** (lecture), pas d'**action principale**. Le CTA plein est réservé aux moments de décision (achat, navigation vers article featured). Ici, le contour suffit — il invite sans imposer.

### 8.6 — Exemples de 12 articles — copy intégral

Pour la grille en V1, voici une sélection éditoriale concrète des 12 premiers articles :

#### Article 1 — Featured (déjà visible en section 02)

```
Hiver, ongles, et patience.
Saison · 8 minutes
Le 12 avril 2026
```

> **Note** : l'article featured **n'apparaît pas** dans la grille du 04 — pour éviter le doublon. La grille démarre avec les articles suivants.

#### Article 2

```
Pourquoi nous ne posons pas de vernis.
Maison · 6 minutes
Le 5 mai 2026
```

#### Article 3

```
Mon premier rituel — récit d'une initiée.
Voix · 12 minutes
Le 28 avril 2026
```

#### Article 4

```
La kératine, cette matière vivante.
Matières · 7 minutes
Le 21 avril 2026
```

#### Article 5

```
Les quatre minutes du dimanche soir.
Pratique · 5 minutes
Le 14 avril 2026
```

#### Article 6

```
Notre engagement matières.
Maison · 9 minutes
Le 31 mars 2026
```

#### Article 7

```
Quand commencer le rituel.
Pratique · 6 minutes
Le 24 mars 2026
```

#### Article 8

```
Conversation avec une artisane japonaise.
Voix · 14 minutes
Le 17 mars 2026
```

#### Article 9

```
Pourquoi le karité.
Matières · 8 minutes
Le 10 mars 2026
```

#### Article 10

```
Le rituel du printemps.
Saison · 7 minutes
Le 3 mars 2026
```

#### Article 11

```
Les mains que personne ne regarde.
Maison · 11 minutes
Le 24 février 2026
```

#### Article 12

```
Quand le rituel devient secret.
Voix · 9 minutes
Le 17 février 2026
```

#### Article 13

```
Pourquoi nos pots sont en verre teinté.
Matières · 6 minutes
Le 10 février 2026
```

### 8.7 — Tokens design

```css
/* ─── Grille articles — tokens ─── */
--grid-bg: #FBF8F1;
--grid-padding-vertical: 64px;
--grid-max-width: 1200px;
--grid-gap-desktop-vertical: 32px;
--grid-gap-desktop-horizontal: 24px;
--grid-gap-tablet-vertical: 28px;
--grid-gap-tablet-horizontal: 20px;
--grid-gap-mobile: 32px;

--card-photo-aspect: 4/3;
--card-photo-height-desktop: 240px;
--card-photo-height-tablet: 200px;
--card-photo-height-mobile: 220px;

--card-title-font: 'Cormorant Garamond', serif;
--card-title-weight: 300;
--card-title-size: 22pt;
--card-title-line-height: 1.2;
--card-title-color: #2C2A28;
--card-title-margin-top: 16px;

--card-divider-width: 24px;
--card-divider-color: #A8C4A6;
--card-divider-margin: 12px 0;

--card-meta-category-size: 10pt;
--card-meta-category-tracking: 1.5px;
--card-meta-date-style: italic;
--card-meta-date-size: 10pt;
--card-meta-color: #6B6863;

--card-hover-photo-scale: 1.04;
--card-hover-duration: 600ms;

/* Bouton Voir plus */
--more-button-bg: transparent;
--more-button-text: #2C2A28;
--more-button-border: 1px solid #2C2A28;
--more-button-padding: 14px 32px;
--more-button-margin-top: 64px;
--more-button-hover-bg: #2C2A28;
--more-button-hover-text: #FBF8F1;
```

### 8.8 — Comportements UX

#### Animation au scroll d'arrivée initial

```
[atteint 70% viewport]   → Cards apparaissent en cascade :
                            - Cards visibles dans le viewport en premier (50ms entre chaque, 400ms chacune)
                            - Cards en dessous du fold attendent leur tour au scroll
```

#### Hover sur une card (desktop)

```
[hover entry]   → Photo zoom-in 1.04× (600ms ease-out)
[hover entry]   → Titre se souligne subtilement (text-decoration underline, offset 4px, 220ms)
[hover continu] → État stable
[hover exit]    → Inversion fluide
```

#### Click sur la card

Toute la card est cliquable. Click → navigation vers `/journal/[slug]`.

```html
<a href="/journal/hiver-ongles-patience" class="article-card">
  <figure>
    <img src="..." alt="...">
  </figure>
  <article>
    <h3>Hiver, ongles, et patience.</h3>
    <hr>
    <p class="meta">
      <span class="category">Saison</span> · <span class="reading-time">8 minutes</span>
    </p>
    <p class="date">Le 12 avril 2026</p>
  </article>
</a>
```

#### Filtrage par catégorie — animation

Quand la cliente change de catégorie via le filtre (section 03) :

```
[t=0ms]      → Click sur la pill « Saison »
[t=0-200ms]  → URL update, état pill change
[t=0-300ms]  → Cards non-Saison : fade-out 300ms (toutes en parallèle)
[t=300-400ms]→ Reflow de la grille (CSS Grid auto-réorganise)
[t=400-700ms]→ Cards Saison restantes : fade-in + translate-up 8px (300ms, cascade 50ms)
[t=700ms]    → Animation terminée
```

> **Si moins de 12 articles dans la catégorie filtrée**, la grille s'adapte. Le bouton « Voir d'autres articles » disparaît s'il n'y a pas plus d'articles disponibles.

### 8.9 — Filtrage et état

#### State management

```typescript
interface JournalState {
  activeCategory: 'all' | 'maison' | 'saison' | 'voix' | 'matieres' | 'pratique';
  loadedArticles: Article[];          // Articles actuellement affichés
  totalArticlesInCategory: number;    // Total d'articles disponibles dans la catégorie
  hasMore: boolean;                    // True si « Voir plus » doit être affiché
  isLoading: boolean;                  // True pendant le chargement
}
```

#### URL-driven state

```javascript
// À l'arrivée sur la page
const urlParams = new URLSearchParams(window.location.search);
const initialCategory = urlParams.get('cat') || 'all';
setActiveCategory(initialCategory);
loadArticles(initialCategory, 0, 12);
```

### 8.10 — Psychologie

#### Visual rhythm — grid density

> **Cuyts & Vincent (2017)** : *« 3-column grids are perceived as 'magazine quality'. 4+ columns become 'list-like'. »*

3 colonnes desktop est l'optimum éditorial. Au-delà (4 colonnes), la perception bascule vers du e-commerce ou du listing.

#### Picorage éditorial

> Une grille d'articles n'est pas lue **séquentiellement** — elle est **picorée**. La cliente survole les titres, les photos, et clique sur 1-2 articles maximum.

Cette psychologie du picorage justifie :
- Photos **distinctives** (chaque photo doit raconter quelque chose en 0.5 seconde)
- Titres **directs** (pas de teasers énigmatiques façon clickbait)
- Catégories **visibles** (la cliente trie par humeur)

#### « Voir plus » > pagination = engagement

> **Bell, Lattin & Rajagopal (2017)** : *« Infinite scroll and load-more increase engagement by 40% vs. paginated lists. »*

Cliquer « Voir plus » est une **action intentionnelle** qui signale à la cliente qu'elle **choisit** de continuer. La pagination chiffrée est un acte **neutre** (changer de page) ; « Voir plus » est un acte **engagé** (« je veux découvrir d'autres »).

### 8.11 — Émotion

| Avant | Pendant | Après |
| :---- | :------ | :---- |
| Choix orienté (post-filtre) | Picorage éditorial | Lecture engagée (clic sur 1-2 articles) OU repli vers newsletter |

### 8.12 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| 4+ colonnes desktop                                 | Bascule vers une perception « liste » au lieu de « magazine »      |
| Cards avec ombre ou border épais                    | Trop e-commerce, casse la sobriété                                  |
| Excerpt / résumé sous le titre                      | Surcharge cognitive — le titre + la photo doivent suffire           |
| Auteur affiché (« Par Salma »)                       | Pas pertinent en V1 — la maison parle, pas un individu             |
| Pagination chiffrée (1, 2, 3...)                    | Code admin, casse le code éditorial                                 |
| Compteur global (« 27 articles disponibles »)       | Vulgaire, statistique                                               |
| Tags multiples par article                          | Surcharge — une seule catégorie suffit                              |
| Bouton « Lire l'article » sur chaque carte          | Redondant — toute la carte est cliquable                            |
| Animation hover trop excessive (scale 1.1)          | Casse la sobriété, crée du bruit visuel                            |

---

## 9 — Section 05 — Newsletter

### 9.1 — Wireframe

```
┌════════════════════════════════════════════════════════════════════════════┐
║                                                                            ║
║                                ╱──╲                                        ║
║                               ╱ ◆ ╲     ← fleuron champagne                ║
║                                ╲╱                                          ║
║                                                                            ║
║                  Recevoir le journal.                                      ║
║                                                                            ║
║                  Un texte tous les quinze jours.                           ║
║                  Pas de promotion. Aucune commande.                        ║
║                  Juste un fragment, déposé dans                            ║
║                  votre boîte.                                              ║
║                                                                            ║
║                  ┌──────────────────────────┐  ┌──────────────────┐        ║
║                  │  votre@email.com         │  │   M'inscrire     │        ║
║                  └──────────────────────────┘  └──────────────────┘        ║
║                                                                            ║
║                                                                            ║
└════════════════════════════════════════════════════════════════════════════┘
                            (fond sauge pâle pleine largeur)
```

### 9.2 — Position stratégique

#### Pourquoi cette section uniquement sur `/journal` ?

C'est une **règle absolue de la maison** : la newsletter n'apparaît **que** sur cette page. Pourquoi ?

1. **Cohérence éditoriale** — la newsletter est l'extension de l'écriture du Journal. Elle a sa raison d'être ici, pas ailleurs.
2. **Pas de pop-up** — jamais. Aucune apparition spontanée d'une newsletter sur les autres pages. La cliente la trouve seulement quand elle vient lire.
3. **Auto-sélection éditoriale** — celles qui s'inscrivent depuis `/journal` sont déjà des **lectrices**, pas des opportunistes attirées par une promo. Mailing list de **qualité** plutôt que de **volume**.
4. **Fidélité au principe « pas de transaction sur le Journal »** — capturer un email est la **seule transaction** acceptable sur cette page, et elle se fait avec un cadre éditorial fort.

### 9.3 — Composition générale

| Propriété              | Valeur                                                          |
| :--------------------- | :-------------------------------------------------------------- |
| Fond                   | `#E8EFE7` (Sauge pâle) — pleine largeur                          |
| Hauteur                | 380px (desktop) · auto (mobile)                                  |
| Padding vertical       | 80px                                                             |
| Padding latéral        | 96px (desktop) · 64px (tablet) · 24px (mobile)                  |
| Alignement contenu     | Centré horizontalement, alignement texte à gauche                |
| Largeur max contenu    | 720px                                                            |

### 9.4 — Fleuron champagne

Identique aux fleurons des sections nobles (`/accueil` manifeste, `/rituel` pivot kit, `/kit` comparatif star).

| Propriété         | Valeur                                                          |
| :---------------- | :-------------------------------------------------------------- |
| Type              | Losange champagne entre filets fins                              |
| Couleur           | `#C8A876` (Champagne)                                            |
| Largeur           | 80px                                                             |
| Hauteur           | 12px                                                             |
| Position          | Centré, 24px au-dessus du titre                                  |

> **Le Champagne sur la newsletter** : c'est la deuxième apparition principale du Champagne sur la page (après le hero). Cette apparition signale que la cliente entre dans un **moment de transmission** — comme l'ouverture d'une lettre.

### 9.5 — Titre

```
Recevoir le journal.
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Light                                     |
| Taille          | 32pt (desktop) · 26pt (tablet) · 24pt (mobile)               |
| Style           | Regular                                                       |
| Couleur         | `#2C2A28` (Encre)                                            |
| Alignement      | Centré                                                       |
| Espacement haut | 16px sous le fleuron                                          |

##### Pourquoi « Recevoir le journal » ?

- **« Recevoir »** — verbe de don (cohérent avec le verbe utilisé sur `/rituel` et `/kit`)
- **« le journal »** — la cliente sait ce qu'elle reçoit (pas une promo, pas une newsletter générique)
- **Le point final** — affirmation paisible, pas une question

### 9.6 — Description

```
Un texte tous les quinze jours.
Pas de promotion. Aucune commande.
Juste un fragment, déposé dans
votre boîte.
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Regular Italic                            |
| Taille          | 17pt (desktop) · 16pt (tablet) · 15pt (mobile)               |
| Line-height     | 1.6                                                          |
| Couleur         | `#4A4844` (Encre claire)                                     |
| Disposition     | Quatre lignes (coupures manuelles)                            |
| Espacement haut | 24px sous le titre                                            |
| Alignement      | Centré                                                       |
| Largeur max     | 480px                                                        |

##### Décomposition stratégique

| Phrase                              | Fonction stratégique                                       |
| :---------------------------------- | :--------------------------------------------------------- |
| « Un texte tous les quinze jours. » | **Fréquence transparente** — la cliente sait à quoi s'attendre |
| « Pas de promotion. »               | **Promesse négative** — désamorce l'objection « encore une newsletter qui me bombarde » |
| « Aucune commande. »                | **Promesse négative** — désamorce « ils vont essayer de me vendre » |
| « Juste un fragment, déposé dans votre boîte. » | **Promesse positive** — métaphore postale, intime, sans intrusion |

> **Le mot « fragment »** — emprunté au vocabulaire littéraire (« fragments d'un discours amoureux » — Roland Barthes). Place l'email dans le registre de la lecture, pas du marketing.

### 9.7 — Formulaire

#### Wireframe du formulaire

```
┌──────────────────────────┐  ┌──────────────────┐
│  votre@email.com         │  │   M'inscrire     │
└──────────────────────────┘  └──────────────────┘
```

#### Champ email

| Propriété          | Valeur                                                          |
| :----------------- | :-------------------------------------------------------------- |
| Type               | `email`                                                          |
| Placeholder        | `votre@email.com`                                                |
| Police             | Inter Regular                                                    |
| Taille             | 14pt                                                             |
| Couleur texte      | `#2C2A28` (Encre) au saisi                                       |
| Couleur placeholder| `#6B6863` (Brume)                                                |
| Fond               | `#FFFFFF` (Crème pure)                                           |
| Border             | 1px solid `#E8E0D2` (Ligne)                                     |
| Border-radius      | 0                                                                |
| Padding            | 14px 20px                                                        |
| Largeur            | 320px (desktop) · 100% du formulaire (mobile)                    |
| Hauteur            | 48px                                                             |
| Focus              | Border `#A8C4A6` (Sauge dark) + outline 2px sauge dark offset 2px|
| Required           | Oui (validation HTML5 + JS)                                       |

#### Bouton « M'inscrire »

| Propriété          | Valeur                                                          |
| :----------------- | :-------------------------------------------------------------- |
| Police             | Inter Medium                                                    |
| Taille             | 14pt                                                            |
| Letter-spacing     | 0.5px                                                            |
| Texte              | `#FBF8F1` (Crème pure)                                          |
| Fond               | `#2C2A28` (Encre)                                                |
| Padding            | 14px 28px                                                        |
| Border-radius      | 0                                                                |
| Hauteur            | 48px (alignée avec le champ)                                    |
| Hover              | Fond `#4A4844`, transition 220ms                                 |
| Active             | Scale 0.97                                                       |
| Disabled (champ vide) | Fond `#6B6863` (Brume), cursor `not-allowed`                  |
| Focus              | Ring 2px sauge dark, offset 4px                                  |

#### Disposition

| Breakpoint | Layout                                                          |
| :--------- | :-------------------------------------------------------------- |
| Desktop    | Champ + bouton sur une ligne, gap 12px, centré                  |
| Tablet     | Champ + bouton sur une ligne, gap 12px                          |
| Mobile     | Champ pleine largeur, bouton pleine largeur dessous, gap 12px   |

Espacement haut du formulaire : **40px** sous la description.

### 9.8 — Mention légale (RGPD)

Sous le formulaire, en très petit :

```
Vos données restent dans la maison. Désinscription en un clic à tout moment.
```

| Propriété      | Valeur                                                  |
| :------------- | :------------------------------------------------------ |
| Police         | Inter Regular                                            |
| Taille         | 10pt                                                    |
| Style          | italic                                                   |
| Couleur        | `#6B6863` (Brume)                                       |
| Alignement     | Centré                                                   |
| Espacement haut| 16px                                                     |

> **Pourquoi cette formulation ?** Parce que le RGPD impose une mention de gestion des données. Mais au lieu de la formuler en jargon juridique (« Conformément au RGPD, vos données seront traitées par X et conservées Y mois... »), on la formule **éditorialement** : *« Vos données restent dans la maison. »* — la cliente comprend l'engagement sans se sentir dans un contrat.

### 9.9 — Tokens design

```css
/* ─── Newsletter — tokens ─── */
--newsletter-bg: #E8EFE7;
--newsletter-padding-vertical: 80px;
--newsletter-padding-x-desktop: 96px;
--newsletter-padding-x-mobile: 24px;
--newsletter-content-max-width: 720px;

--newsletter-fleuron-color: #C8A876;
--newsletter-fleuron-margin-bottom: 16px;

--newsletter-title-font: 'Cormorant Garamond', serif;
--newsletter-title-weight: 300;
--newsletter-title-size-desktop: 32pt;
--newsletter-title-color: #2C2A28;

--newsletter-description-font: 'Cormorant Garamond', serif;
--newsletter-description-style: italic;
--newsletter-description-size: 17pt;
--newsletter-description-line-height: 1.6;
--newsletter-description-color: #4A4844;
--newsletter-description-max-width: 480px;
--newsletter-description-margin-top: 24px;

--newsletter-form-margin-top: 40px;
--newsletter-form-gap: 12px;

--newsletter-input-bg: #FFFFFF;
--newsletter-input-border: 1px solid #E8E0D2;
--newsletter-input-padding: 14px 20px;
--newsletter-input-width-desktop: 320px;
--newsletter-input-height: 48px;
--newsletter-input-font-size: 14pt;
--newsletter-input-text-color: #2C2A28;
--newsletter-input-placeholder-color: #6B6863;
--newsletter-input-focus-border: 1px solid #A8C4A6;

--newsletter-button-bg: #2C2A28;
--newsletter-button-text: #FBF8F1;
--newsletter-button-padding: 14px 28px;
--newsletter-button-height: 48px;
--newsletter-button-hover-bg: #4A4844;

--newsletter-disclaimer-style: italic;
--newsletter-disclaimer-size: 10pt;
--newsletter-disclaimer-color: #6B6863;
--newsletter-disclaimer-margin-top: 16px;
```

### 9.10 — États du formulaire

#### État 1 — Repos (par défaut)

Champ vide, placeholder visible, bouton actif.

#### État 2 — Saisie en cours

Champ contient du texte, bouton actif (validation côté client en cours).

#### État 3 — Validation client (au blur)

```javascript
// Pseudo-code
onBlur(emailField) {
  if (!isValidEmail(emailField.value)) {
    showInlineError(emailField, "Cet email semble incomplet.");
  }
}
```

| Erreur affichée    | « Cet email semble incomplet. »                              |
| :----------------- | :----------------------------------------------------------- |
| Style              | Inter Regular Italic 11pt, couleur `#9C5B5B` (rouge feutré)  |
| Position           | Sous le champ, espacement 6px                                 |
| Border du champ    | `#9C5B5B` (rouge feutré)                                     |

> **Pas de rouge vif** — un rouge feutré, presque terreux, qui s'intègre à la palette. La couleur d'erreur ne doit pas crier.

#### État 4 — Soumission en cours

```
[t=0ms]      → Click sur « M'inscrire »
[t=0-100ms]  → Bouton scale 0.97
[t=100-300ms]→ Bouton fade-out + spinner mini visible (cercle 16px, stroke 2px crème)
[t=200ms]    → Requête API POST /api/newsletter/subscribe
[t=400-700ms]→ Server response (idéal < 200ms)
                - Si succès → état 5
                - Si erreur → état 6
```

#### État 5 — Succès

```
┌────────────────────────────────────────┐
│                                        │
│  ✓  C'est noté.                        │
│                                        │
│  Vous recevrez le prochain texte       │
│  dans les quinze jours.                │
│                                        │
└────────────────────────────────────────┘
```

| Propriété      | Valeur                                                  |
| :------------- | :------------------------------------------------------ |
| Animation      | Le formulaire fade-out 320ms, le message succès fade-in 320ms |
| Icône ✓        | Caractère ✓ (U+2713), couleur `#A8C4A6` (Sauge dark)   |
| Titre          | Cormorant Light 22pt, couleur Encre                     |
| Description    | Cormorant Italic 15pt, couleur Encre claire             |
| Persistance    | Le message reste affiché pour le reste de la session     |

#### État 6 — Erreur serveur

```
Une erreur est survenue. Veuillez réessayer.
```

Affiché sous le bouton, sans replacer le formulaire. La cliente peut re-cliquer.

#### État 7 — Email déjà inscrit

```
Cet email est déjà inscrit. Merci d'être avec nous.
```

> **Tonalité particulière** : pas un message d'erreur, c'est un **message de bienvenue**. La cliente est rassurée sur la cohérence du système.

### 9.11 — Backend — Mailchimp / Sendgrid / autre

#### Stack recommandée

| Service                  | Usage                                              |
| :----------------------- | :------------------------------------------------- |
| **Mailchimp** (V1)       | Liste, double opt-in, automation, simple à intégrer |
| **Sendgrid Marketing**   | Alternative plus scalable                          |
| **Custom + AWS SES**     | V2 si la liste dépasse 10 000 abonnées             |

#### Double opt-in obligatoire

À l'inscription :
1. Email reçoit immédiatement un email de confirmation
2. Le lien dans l'email confirme l'abonnement
3. La cliente est ajoutée à la liste **uniquement après** ce clic

> **Pourquoi double opt-in ?** Pour la qualité de la liste (RGPD compliance + meilleur taux d'ouverture sur le long terme).

#### Email de confirmation — copy intégral

**Sujet** : `Confirmer votre inscription au journal FemiGlow`

**Corps** :

```
Bonjour,

Vous avez demandé à recevoir le journal de la maison.
Pour confirmer cette inscription, cliquez sur le lien ci-dessous :

[Confirmer mon inscription]

Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.
Vos données restent dans la maison.

— FemiGlow
```

### 9.12 — Comportements UX

#### Animation au scroll

```
[atteint 80% viewport]   → fond sauge pâle fade-in (subtil — opacité 0 → 1, 600ms)
[atteint 70%]             → fleuron fade-in + scale-up 0.9 → 1 (500ms)
[atteint 60%]             → titre + description fade-in (700ms, délai 300ms)
[atteint 50%]             → formulaire fade-in + translate-up 12px (500ms, délai 500ms)
```

#### Comportement clavier

| Touche                | Comportement                                              |
| :-------------------- | :-------------------------------------------------------- |
| Tab                   | Focus séquentiel : champ email → bouton                    |
| Enter (dans le champ) | Soumission du formulaire                                  |
| Enter (sur bouton)    | Soumission du formulaire                                  |

### 9.13 — Psychologie

#### Réciprocité (Cialdini 1984)

> *« When someone gives us something, we feel obligated to give back. »*

Le Journal **donne gratuitement** des textes. La cliente, qui a passé du temps à lire, **se sent en dette**. La newsletter est l'occasion pour elle de **rendre quelque chose** : pas un achat, juste son email.

> **Stratégie inversée** : au lieu de demander d'abord (« inscrivez-vous pour recevoir »), le Journal **donne d'abord** (les articles), puis propose la suite (« recevez la prochaine pièce »).

#### Promesse négative (Sugarman 1995)

> *« What you don't promise can be more powerful than what you promise. »*

Les phrases « Pas de promotion. Aucune commande. » **désamorcent les objections silencieuses** :
- *« Encore une newsletter qui va me spammer ? »* → Non
- *« Ils vont essayer de me vendre quelque chose ? »* → Non

Cette honnêteté préemptive **augmente la confiance** — l'inscription devient un acte serein.

#### Cadre éditorial = légitimation

Le formulaire d'inscription apparaît **après** que la cliente a vu :
- Un featured article soigné
- Une grille de 12 articles diversifiés
- Un système éditorial structuré

Cette **construction de légitimité** précède l'invitation. La cliente s'inscrit chez **un éditeur**, pas chez un marketeur.

#### Vocabulaire littéraire

> Les mots **« texte »**, **« fragment »**, **« déposé »**, **« quinze jours »** appartiennent à un **registre littéraire**. La newsletter n'est pas un produit numérique — c'est un **objet épistolaire**.

### 9.14 — Émotion

| Avant | Pendant | Après |
| :---- | :------ | :---- |
| Confiance acquise (post-articles lus) | Décision de s'inscrire OU non | Engagement long terme (don d'email = don de présence dans la maison) |

### 9.15 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| Pop-up à l'arrivée sur `/journal`                   | Casse la promesse « pas d'intrusion »                              |
| Réduction (« -15% à l'inscription »)                | Détruit le positionnement luxe + transactionnel                     |
| Promesse de « contenu exclusif »                    | Marketing — préférer la simplicité                                  |
| Champs additionnels (prénom, ville)                 | Friction — l'email seul suffit                                     |
| Pas de double opt-in                                | Risque RGPD + qualité liste                                         |
| Mention RGPD en jargon                              | Casse le ton, intimide                                              |
| Formulaire centré dans une boîte avec ombre         | Code SaaS, casse le code éditorial                                  |
| Animation excessive sur le succès (confettis, etc.) | Casse la sobriété                                                   |
| Référence à « notre liste de diffusion »            | Vocabulaire technique — préférer « le journal »                     |

---

## 10 — Section 06 — Cross-link maison

### 10.1 — Wireframe

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│  ┌────────────────────────────────┐    ┌──────────────────────────────┐  │
│  │                                │    │                              │   │
│  │                                │    │  POUR DÉCOUVRIR              │   │
│  │                                │    │                              │   │
│  │   [PHOTO LIFESTYLE             │    │  La maison.                  │   │
│  │   "PORTRAIT DE LA MAISON"]     │    │                              │   │
│  │                                │    │  L'histoire derrière les     │   │
│  │   [Atelier, mains, pots, table │    │  textes — qui nous sommes,    │   │
│  │   de soin]                     │    │  pourquoi le rituel.         │   │
│  │                                │    │                              │   │
│  │                                │    │  ─                           │   │
│  │                                │    │                              │   │
│  │                                │    │  ┌──────────────────────┐   │   │
│  │                                │    │  │ Visiter la maison →  │   │   │
│  │                                │    │  └──────────────────────┘   │   │
│  └────────────────────────────────┘    └──────────────────────────────┘  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 10.2 — Composition

| Propriété              | Valeur                                                          |
| :--------------------- | :-------------------------------------------------------------- |
| Fond                   | `#FBF8F1` (Crème)                                                |
| Hauteur                | 320px (desktop) · auto (mobile)                                  |
| Padding vertical       | 80px                                                             |
| Padding latéral        | 96px (desktop) · 24px (mobile)                                  |
| Layout                 | Photo 50% gauche / Bloc info 50% droite — gap 64px (desktop)     |
| Layout mobile          | Empilés (photo dessus, info dessous) — gap 24px                  |

### 10.3 — Photo

| Propriété         | Valeur                                                                |
| :---------------- | :-------------------------------------------------------------------- |
| Sujet             | « Portrait de la maison » — atelier de Casablanca, mains, pots, table de soin |
| Composition       | Lifestyle wide, lumière naturelle, plans larges                        |
| Format            | 4:3 (paysage) sur desktop · 4:3 sur tablet · 3:2 sur mobile           |
| Hauteur affichage | 280px (desktop) · auto (mobile)                                        |

### 10.4 — Bloc info — copy intégral

#### Surtitre

```
POUR DÉCOUVRIR
```

| Propriété      | Valeur                                              |
| :------------- | :-------------------------------------------------- |
| Police         | Inter SemiBold 7.5pt                                |
| Letter-spacing | 2.5px                                               |
| Couleur        | `#6B6863` (Brume)                                   |
| Position       | Aligné à gauche                                     |

#### Titre

```
La maison.
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Light Italic                              |
| Taille          | 32pt (desktop) · 26pt (mobile)                                |
| Couleur         | `#2C2A28` (Encre)                                            |
| Espacement haut | 12px sous le surtitre                                         |

#### Description

```
L'histoire derrière les textes — qui nous sommes,
pourquoi le rituel.
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Regular                                   |
| Taille          | 16pt (desktop) · 15pt (mobile)                                |
| Couleur         | `#4A4844` (Encre claire)                                     |
| Line-height     | 1.6                                                          |
| Espacement haut | 20px                                                          |

#### Filet séparateur

| Propriété      | Valeur                                |
| :------------- | :------------------------------------ |
| Largeur        | 32px                                  |
| Hauteur        | 1.5px                                 |
| Couleur        | `#A8C4A6` (Sauge dark)                |
| Espacement     | 32px haut, 32px bas                   |

#### CTA

```
Visiter la maison →
```

| Propriété          | Valeur                                                                |
| :----------------- | :-------------------------------------------------------------------- |
| Police             | Inter Medium 14pt                                                     |
| Texte              | `#FBF8F1` (Crème pure)                                                |
| Fond               | `#2C2A28` (Encre)                                                     |
| Padding            | 14px 28px                                                             |
| Hover              | Fond `#4A4844`, flèche se déplace de 4px à droite (300ms)             |
| Action             | Navigation vers `/maison`                                              |

### 10.5 — Tokens design

```css
/* ─── Cross-link maison — tokens ─── */
--crosslink-maison-bg: #FBF8F1;
--crosslink-maison-padding-vertical: 80px;
--crosslink-maison-grid-gap-desktop: 64px;
--crosslink-maison-photo-aspect: 4/3;
--crosslink-maison-photo-height-desktop: 280px;

--crosslink-maison-kicker-color: #6B6863;
--crosslink-maison-title-style: italic;
--crosslink-maison-title-size: 32pt;
--crosslink-maison-description-size: 16pt;
--crosslink-maison-description-color: #4A4844;
--crosslink-maison-divider-color: #A8C4A6;
--crosslink-maison-cta-bg: #2C2A28;
--crosslink-maison-cta-text: #FBF8F1;
```

### 10.6 — Comportements UX

#### Animation au scroll

```
[atteint 80% viewport]   → photo fade-in 700ms
[atteint 70%]             → bloc info fade-in séquentiel (200ms entre éléments)
```

#### Hover sur le CTA

Identique au CTA Lire l'article (section 02) — flèche se déplace de 4px à droite, transition 300ms.

#### Click sur la photo OU la card complète

Toute la zone est cliquable et mène à `/maison`.

### 10.7 — Pourquoi un seul cross-link (pas trois) ?

Sur les autres pages, le cross-link Journal contient **3 articles**. Ici, **un seul lien** vers `/maison`. Pourquoi ?

- À ce stade du parcours, la cliente vient de lire (ou survoler) plusieurs articles dans la grille
- Lui proposer 3 cross-links serait **redondant**
- `/maison` est la page **complémentaire** du Journal — le Journal raconte les textes, `/maison` raconte la marque
- Un seul lien clair = **invitation forte** plutôt que **liste de choix**

### 10.8 — Émotion

| Avant | Pendant | Après |
| :---- | :------ | :---- |
| Engagement (post-newsletter) | Curiosité étendue | Désir de connaître la maison qui produit ces textes |

### 10.9 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| Lien vers `/kit` ici                                | Brutalité commerciale — détruit la cohérence éditoriale             |
| Lien vers `/rituel` (déjà connu)                    | Redondant — la cliente a déjà ce contenu                           |
| Multiple cross-links                                | Surcharge à la sortie                                              |
| CTA sans flèche                                     | Casse la signature de navigation                                    |
| Photo de visage souriant                            | Détruit l'imply human                                              |

---

## 11 — Footer — élément persistant

### 11.1 — Structure héritée

Le footer de `/journal` est **identique** à celui des autres pages — élément global du site.

### 11.2 — Spécificités sur `/journal`

| Différence              | Spécification                                                       |
| :---------------------- | :------------------------------------------------------------------ |
| **Item « Le journal »** | Dans la colonne « LE RITUEL » du footer, l'item « Le journal » est visuellement actif : couleur Crème pure + soulignement subtil 1px sauge dark, offset 6px |
| **Pas de re-affichage newsletter** | La newsletter est en section 05 — ne pas la dupliquer en footer |
| **Espacement avec Cross-link maison** | 64px de padding vertical entre la fin de la section 06 et le début du footer |

### 11.3 — Liens internes — cohérence

Le footer mentionne les pages : `/accueil`, `/rituel`, `/kit`, `/journal` (actif), `/maison`, `/partenaires` (B2B). Pas de lien vers `/panier` ou `/commander` (transactionnels — pas dans le footer).

---

## 12 — Comportements transverses

### 12.1 — Smooth scroll

`scroll-behavior: smooth` activé en CSS, désactivé si :
- L'utilisateur a `prefers-reduced-motion: reduce` activé
- Sur les ancres rapides : scroll instantané sur Cmd/Ctrl+click

### 12.2 — Lazy loading des images

| Type d'image                         | Stratégie                                            |
| :----------------------------------- | :--------------------------------------------------- |
| Hero (pas d'image)                   | N/A — fond crème uni                                  |
| Photo article featured               | `loading="eager"`, preload critique pour LCP         |
| 12 photos articles grille            | `loading="lazy"`, intersection observer              |
| Articles ajoutés via « Voir plus »   | `loading="lazy"` à la création du DOM                |
| Photo cross-link maison              | `loading="lazy"`                                     |
| Footer                               | (aucune image)                                       |

#### Preload de la photo featured

```html
<link rel="preload" as="image"
      href="/images/journal/featured-current-desktop.webp"
      media="(min-width: 768px)"
      fetchpriority="high">
```

### 12.3 — Mécanique de filtrage par catégorie — détaillée

#### State management

```typescript
interface JournalPageState {
  activeCategory: 'all' | 'maison' | 'saison' | 'voix' | 'matieres' | 'pratique';
  loadedArticles: Article[];
  visibleArticles: Article[];      // Filtrés selon activeCategory
  totalInCategory: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  newsletter: 'idle' | 'submitting' | 'success' | 'error' | 'already_subscribed';
}
```

#### URL synchronization

À chaque changement de catégorie, l'URL est mise à jour via History API :

```javascript
function setCategory(cat) {
  state.activeCategory = cat;
  const url = cat === 'all' ? '/journal' : `/journal?cat=${cat}`;
  history.replaceState(null, '', url);
  filterArticles(cat);
}
```

#### Préservation du scroll

Au filtrage, **le scroll position est préservé** (la page ne se réinitialise pas en haut). La cliente reste à la position où elle était.

### 12.4 — Mécanique « Voir plus » — détaillée

```typescript
async function loadMoreArticles() {
  state.isLoadingMore = true;

  const offset = state.loadedArticles.length;
  const limit = 9; // Charge 9 articles supplémentaires

  try {
    const response = await fetch(
      `/api/journal/articles?cat=${state.activeCategory}&offset=${offset}&limit=${limit}`
    );
    const newArticles = await response.json();

    state.loadedArticles = [...state.loadedArticles, ...newArticles];
    state.hasMore = newArticles.length === limit; // Si on a reçu moins que limit, plus rien à charger

    animateNewArticlesIn(newArticles);
  } catch (error) {
    showErrorMessage('Une erreur est survenue. Veuillez réessayer.');
  } finally {
    state.isLoadingMore = false;
  }
}
```

#### Animation d'apparition des nouveaux articles

```javascript
function animateNewArticlesIn(articles) {
  articles.forEach((article, index) => {
    const element = document.querySelector(`[data-article-slug="${article.slug}"]`);
    setTimeout(() => {
      element.classList.add('visible');
    }, index * 50); // Cascade 50ms entre chaque
  });
}
```

### 12.5 — Format d'image

| Format primaire | Format fallback | Compression |
| :-------------- | :-------------- | :---------- |
| WebP            | JPEG            | Qualité 82, profil sRGB |
| AVIF (V2)       | WebP, JPEG      | Qualité 76  |

### 12.6 — Animation timing — règle générale

| Type d'animation              | Durée            | Easing                              |
| :---------------------------- | :--------------- | :---------------------------------- |
| Hover button                  | 220ms            | `cubic-bezier(0.4, 0, 0.2, 1)`      |
| Hover photo card              | 600ms            | `cubic-bezier(0.4, 0, 0.2, 1)`      |
| Header transition             | 240ms            | `cubic-bezier(0.4, 0, 0.2, 1)`      |
| Page load (hero entry)        | 600-1200ms       | `cubic-bezier(0.16, 1, 0.3, 1)`     |
| Section reveal scroll         | 600-700ms        | `cubic-bezier(0.4, 0, 0.2, 1)`      |
| **Filter pill change**        | **220ms**        | `cubic-bezier(0.4, 0, 0.2, 1)`      |
| **Article fade-out (filter)** | **300ms**        | `cubic-bezier(0.4, 0, 1, 1)`        |
| **Article fade-in (filter)**  | **300ms**        | `cubic-bezier(0.16, 1, 0.3, 1)`     |
| **Cascade between articles**  | **50ms**         | linear (delay between)              |
| **Voir plus loading**         | **400ms**        | `cubic-bezier(0.4, 0, 0.2, 1)`      |
| **Newsletter form success**   | **320ms** (fade) | `cubic-bezier(0.4, 0, 0.2, 1)`      |

### 12.7 — Reduced motion

Pour les utilisateurs avec `prefers-reduced-motion: reduce` :

- Animations d'entrée à 0ms (apparition instantanée)
- Filtrage : pas de fade-out/in, simplement masquage/affichage instantané
- « Voir plus » : nouveaux articles apparaissent directement, pas de cascade
- Newsletter form success : pas de fade transition, message remplace formulaire instantanément
- Hover transitions : conservées (220ms ou moins) pour le feedback

### 12.8 — État de chargement initial

```
[t=0ms]      → HTML loaded, fond crème visible
[t=100ms]    → Police Inter chargée
[t=300ms]    → Police Cormorant chargée
[t=500ms]    → Police Pinyon chargée (header uniquement)
[t=600ms]    → Hero typographique animé (fleuron + titre + intro)
[t=900ms]    → FCP atteint
[t=1500ms]   → Photo article featured chargée (LCP)
[t=2000ms]   → 12 cards de la grille chargées (lazy après FCP)
[t=2500ms]   → Page entièrement interactive
```

### 12.9 — Pas de skeleton screen

Comme sur les autres pages, **pas de skeleton screen**. La page est pré-rendue (SSR ou SSG) — le HTML arrive avec le contenu, pas avec un squelette.

### 12.10 — État du panier

Le compteur du panier dans le header est **toujours visible** sur `/journal` — la cliente peut avoir un kit dans son panier d'une session précédente, ou avoir ajouté un kit puis être revenue sur `/journal` pour lire avant de finaliser.

> **Implementation** : compteur lit le cookie `femiglow_cart` au chargement. Si > 0, affiche `[Panier · X]`.

---

## 13 — Adaptation responsive

### 13.1 — Breakpoints officiels

| Nom         | Min-width | Max-width | Layout principal                |
| :---------- | :-------- | :-------- | :------------------------------ |
| **Mobile**  | 0         | 767px     | 1 colonne, vertical             |
| **Tablet**  | 768px     | 1279px    | 2 colonnes mixtes               |
| **Desktop** | 1280px    | -         | Multi-colonnes, max-width 1200px |

### 13.2 — Adaptations par section

#### Hero du Journal (Section 01)

| Propriété              | Desktop          | Tablet          | Mobile         |
| :--------------------- | :--------------- | :-------------- | :------------- |
| Hauteur                | 480px            | 420px           | 380px          |
| Padding latéral        | 96px             | 64px            | 24px           |
| Fleuron taille         | 80×12px          | 80×12px         | 64×10px        |
| Surtitre size          | 9pt              | 8.5pt           | 8pt            |
| Titre size             | 56pt             | 42pt            | 32pt           |
| Intro size             | 18pt             | 16pt            | 15pt           |

#### Article featured (Section 02)

| Propriété              | Desktop          | Tablet          | Mobile         |
| :--------------------- | :--------------- | :-------------- | :------------- |
| Layout                 | 60% photo / 40% info | 55% / 45%   | Empilés        |
| Gap                    | 64px             | 48px            | 32px           |
| Photo height           | 520px            | 440px           | auto (ratio 3:4) |
| Titre size             | 42pt             | 32pt            | 28pt           |
| Description size       | 16pt             | 15pt            | 14pt           |
| CTA largeur            | Auto             | Auto            | Auto           |

#### Filtre catégories (Section 03)

| Propriété              | Desktop          | Tablet          | Mobile         |
| :--------------------- | :--------------- | :-------------- | :------------- |
| Layout                 | 6 pills sur une ligne | 6 pills, peut wrap | Scroll horizontal |
| Pill padding           | 10px 24px        | 10px 22px       | 10px 22px      |
| Pill font size         | 13pt             | 13pt            | 13pt           |

#### Grille articles (Section 04)

| Propriété              | Desktop          | Tablet          | Mobile         |
| :--------------------- | :--------------- | :-------------- | :------------- |
| Colonnes               | 3                | 2               | 1              |
| Gap vertical           | 32px             | 28px            | 32px           |
| Gap horizontal         | 24px             | 20px            | n/a            |
| Photo height           | 240px            | 200px           | 220px          |
| Titre size             | 22pt             | 20pt            | 20pt           |
| Méta size              | 10pt             | 10pt            | 10pt           |

#### Newsletter (Section 05)

| Propriété              | Desktop          | Tablet          | Mobile         |
| :--------------------- | :--------------- | :-------------- | :------------- |
| Hauteur                | 380px            | 360px           | auto           |
| Padding latéral        | 96px             | 64px            | 24px           |
| Titre size             | 32pt             | 26pt            | 24pt           |
| Description size       | 17pt             | 16pt            | 15pt           |
| Champ largeur          | 320px            | 280px           | 100% du formulaire |
| Form layout            | Champ + bouton sur ligne | Idem    | Champ pleine largeur, bouton dessous |

#### Cross-link maison (Section 06)

| Propriété              | Desktop          | Tablet          | Mobile         |
| :--------------------- | :--------------- | :-------------- | :------------- |
| Layout                 | 50% / 50%        | 50% / 50%       | Empilés        |
| Gap                    | 64px             | 48px            | 24px           |
| Photo height           | 280px            | 240px           | 220px          |
| Titre size             | 32pt             | 26pt            | 24pt           |

### 13.3 — Comportements mobile spécifiques

#### Header

- Burger menu : drawer slide-in 280ms depuis la droite
- Item « Journal » actif avec underline sauge dark
- CTA panier conservé en haut-droite

#### Filtre catégories — scroll horizontal

```css
.filter-container {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scroll-snap-type: x proximity;
  scroll-padding-left: 24px;
  padding: 0 24px 4px 24px; /* padding-bottom pour éviter coupure shadow focus */
}

.filter-pill {
  scroll-snap-align: start;
  flex-shrink: 0;
}

.filter-container::-webkit-scrollbar {
  display: none;
}
```

Indicateurs de fin de scroll : gradient subtle sur les bords gauche/droit qui suggère plus de contenu hors écran.

#### Grille articles mobile — 1 colonne

Sur mobile, la grille bascule en 1 colonne. Cela peut sembler long en scroll, mais :
- Les images en pleine largeur sont **plus impactantes** sur petit écran
- Le scroll vertical mobile est **naturel**
- Une grille 2 colonnes mobile rendrait les photos trop petites (< 180px)

#### Pas de sticky CTA mobile

Contrairement à `/kit`, **pas de sticky CTA flottant** sur `/journal`. Pourquoi ?
- Aucun objectif de conversion immédiate sur cette page
- Un sticky CTA suggérerait que la cliente doit faire quelque chose **maintenant** — l'inverse de la philosophie du Journal
- Le bouton « Voir d'autres articles » suffit pour la continuation de lecture

### 13.4 — Touch targets minimum

Sur mobile, tous les éléments interactifs respectent **44×44px minimum** :
- Pills filtre : padding 10px 22px → 44px hauteur tactile
- Cards articles : la zone tactile est l'ensemble de la carte (≥ 44px)
- Bouton « Voir d'autres articles » : padding suffisant
- Champ email + bouton newsletter : 48px hauteur (> 44px)

### 13.5 — Texte minimum sur mobile

Aucun texte en dessous de **14px** sur mobile (lisibilité WCAG). Exceptions :
- Méta articles : 10pt acceptable car contextuel (à côté d'un titre lisible)
- Mention RGPD newsletter : 10pt acceptable car juridique

---

## 14 — Performance technique

### 14.1 — Web Vitals — cibles

| Métrique | Cible    | Justification                                      |
| :------- | :------- | :------------------------------------------------- |
| **LCP**  | < 2.2s   | Photo article featured = LCP element                |
| **CLS**  | < 0.08   | Animations d'entrée fluides, pas de layout shift    |
| **INP**  | < 180ms  | Filtrage et « Voir plus » fluides                   |
| **FCP**  | < 1.0s   | Hero typographique visible vite (pas d'image)       |
| **TBT**  | < 300ms  | JS modéré (filtrage, newsletter, lazy loading)      |

> **Note** : les cibles sont **moins strictes que `/kit`** (BOFU) car `/journal` n'est pas une page de conversion. Mais elles restent dans les standards d'un site éditorial premium.

### 14.2 — Stratégie de chargement

#### Critical CSS

CSS critique inline dans le `<head>` — uniquement les styles du hero + header. Le reste en CSS externe `<link>`.

#### Preload des polices critiques

```html
<!-- Polices critiques pour le hero typographique -->
<link rel="preload" href="/fonts/Inter-SemiBold.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/CormorantGaramond-Light.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/CormorantGaramond-LightItalic.woff2" as="font" type="font/woff2" crossorigin>
<!-- Polices secondaires -->
<link rel="preload" href="/fonts/Inter-Regular.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/PinyonScript-Regular.woff2" as="font" type="font/woff2" crossorigin>
```

> **Pourquoi Cormorant Light Italic en preload critique ?** Parce que le titre du hero est en italic. Sans preload, FOUT (Flash Of Unstyled Text) pendant 200-400ms.

#### Preload de la photo article featured

```html
<link rel="preload" as="image"
      href="/images/journal/featured-current-desktop.webp"
      media="(min-width: 768px)"
      fetchpriority="high">
<link rel="preload" as="image"
      href="/images/journal/featured-current-mobile.webp"
      media="(max-width: 767px)"
      fetchpriority="high">
```

#### Defer du JavaScript non-critique

```html
<!-- Scripts critiques (interactions filtre + newsletter) -->
<script src="/js/journal.js" defer></script>

<!-- Scripts non-critiques -->
<script src="/js/animations.js" defer></script>
<script src="/js/analytics.js" async></script>
```

### 14.3 — Budget de performance

| Ressource                       | Budget          |
| :------------------------------ | :-------------- |
| HTML initial                    | < 50 KB gzip (avec 12 cards précompilées) |
| CSS critique inline             | < 10 KB         |
| CSS externe                     | < 50 KB gzip    |
| JS total                        | < 80 KB gzip    |
| Photo article featured          | < 150 KB        |
| 12 photos articles (lazy)       | < 80 KB chacune (total ~960 KB **différé**) |
| Polices                         | < 140 KB total  |
| **Total page initiale**         | **< 600 KB**    |

> **Lazy loading critique** : les 11 articles non-featured de la grille sont **chargés à la demande** (intersection observer). Le LCP ne dépend que de la photo featured + du HTML initial.

### 14.4 — CDN & cache

| Ressource                      | Cache-Control                          |
| :----------------------------- | :------------------------------------- |
| HTML                           | `no-cache, must-revalidate`            |
| CSS / JS versionnés            | `public, max-age=31536000, immutable`  |
| Images articles                | `public, max-age=2592000` (30 jours)   |
| Polices                        | `public, max-age=31536000, immutable`  |

CDN : Cloudflare ou équivalent, avec :
- **Polish** activé (optimisation WebP automatique)
- **Mirage** activé (lazy loading optimisé)
- **Argo Smart Routing** (acheminement réseau optimal Maroc)

### 14.5 — Optimisations spécifiques

| Optimisation                              | Justification                                      |
| :---------------------------------------- | :------------------------------------------------- |
| Pre-rendering / SSG                       | La page hub est **statique** → SSG idéal (Next.js, Astro, 11ty) |
| Articles paginés via API                  | « Voir plus » charge dynamiquement, pas SSR        |
| `loading="lazy"` sur 11/12 photos grille  | Économie majeure de bande passante                 |
| HTML gzip + brotli                        | Compression maximale du HTML pré-rendu             |
| Preload article featured uniquement       | Pas de preload des autres images (lazy)            |
| `font-display: swap` partout              | Texte visible immédiatement                        |
| Intersection Observer pour animations     | Pas de scroll listener manuel                      |

### 14.6 — Stratégie de rendu — recommandation

#### Approche recommandée — SSG + ISR

Le Journal est **idéalement** rendu en :
- **SSG** (Static Site Generation) au build pour les 12 derniers articles
- **ISR** (Incremental Static Regeneration) pour rafraîchir le contenu au fil des publications

**Avantages** :
- HTML pré-rendu ultra-rapide
- Pas de requête DB au chargement
- SEO optimal (contenu visible aux crawlers)
- Cache CDN agressif

**Implementation Next.js** :

```javascript
// pages/journal/index.tsx
export async function getStaticProps() {
  const articles = await fetchArticles({ limit: 12 });
  const featured = articles.find(a => a.is_featured) || articles[0];

  return {
    props: { articles, featured },
    revalidate: 3600 // Re-build toutes les heures
  };
}
```

#### Pour la pagination « Voir plus »

API endpoint dynamique qui charge les articles supplémentaires :

```
GET /api/journal/articles?cat=saison&offset=12&limit=9
```

### 14.7 — Métriques de référence

| Site (éditorial)             | LCP    | CLS   | INP    |
| :--------------------------- | :----- | :---- | :----- |
| Aesop journal                | 2.0s   | 0.05  | 160ms  |
| Glossier into the gloss       | 2.4s   | 0.08  | 200ms  |
| Cereal magazine              | 1.8s   | 0.04  | 140ms  |
| **FemiGlow `/journal` cible** | **< 2.2s** | **< 0.08** | **< 180ms** |

---

## 15 — SEO & métadonnées

### 15.1 — Title

```html
<title>Le journal — FemiGlow · Le carnet d'une maison de soin</title>
```

| Critère                 | Valeur                                                          |
| :---------------------- | :-------------------------------------------------------------- |
| Longueur                | 56 caractères (≤ 60 affichables sur SERP — pas tronqué)         |
| Mot-clé principal       | « journal » + « carnet d'une maison de soin »                   |
| Marque                  | « FemiGlow »                                                     |
| Tonalité                | Éditoriale, pas commerciale                                       |

### 15.2 — Meta description

```html
<meta name="description" content="Des textes sur la beauté lente, la culture du soin, et les matières qui nous tiennent. Le carnet de la maison FemiGlow, mis à jour tous les quinze jours.">
```

| Critère       | Valeur                                                  |
| :------------ | :------------------------------------------------------ |
| Longueur      | 154 caractères (≤ 155 sur SERP)                         |
| Hook          | « Des textes sur la beauté lente »                       |
| Différenciation | « la culture du soin, et les matières qui nous tiennent » |
| Fréquence     | « tous les quinze jours »                                 |
| Marque        | « FemiGlow »                                              |

### 15.3 — Open Graph

```html
<meta property="og:type" content="website">
<meta property="og:url" content="https://femiglow.ma/journal">
<meta property="og:title" content="Le journal — FemiGlow">
<meta property="og:description" content="Des textes sur la beauté lente, la culture du soin, et les matières qui nous tiennent.">
<meta property="og:image" content="https://femiglow.ma/og/journal-og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="fr_MA">
<meta property="og:site_name" content="FemiGlow">
```

#### Image OG spécifique au Journal

- Dimensions : 1200×630px
- Composition : photo de l'article featured du moment **OU** composition typographique (titre « Le carnet de la maison. » sur fond crème uni)
- Wordmark Pinyon en haut-gauche
- Pas de prix, pas de CTA visible
- Format JPEG qualité 85, < 200 KB

> **Recommandation** : générer l'image OG **dynamiquement** au moment du build, en réutilisant la photo de l'article featured. Cela permet à l'OG image de **changer** quand l'article featured change (cohérence éditoriale).

### 15.4 — Twitter Card

```html
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@femiglow">
<meta name="twitter:title" content="Le journal — FemiGlow">
<meta name="twitter:description" content="Des textes sur la beauté lente.">
<meta name="twitter:image" content="https://femiglow.ma/og/journal-twitter.jpg">
```

### 15.5 — Schema.org JSON-LD — Blog + CollectionPage

Schema **Blog** + **CollectionPage** + **ItemList** combinés pour décrire le hub éditorial.

```json
{
  "@context": "https://schema.org",
  "@type": ["Blog", "CollectionPage"],
  "@id": "https://femiglow.ma/journal",
  "name": "Le journal — FemiGlow",
  "description": "Des textes sur la beauté lente, la culture du soin, et les matières qui nous tiennent.",
  "url": "https://femiglow.ma/journal",
  "inLanguage": "fr-MA",
  "publisher": {
    "@type": "Organization",
    "name": "FemiGlow",
    "url": "https://femiglow.ma",
    "logo": {
      "@type": "ImageObject",
      "url": "https://femiglow.ma/logo.png"
    }
  },
  "mainEntity": {
    "@type": "ItemList",
    "numberOfItems": 12,
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "url": "https://femiglow.ma/journal/hiver-ongles-patience",
        "name": "Hiver, ongles, et patience."
      },
      {
        "@type": "ListItem",
        "position": 2,
        "url": "https://femiglow.ma/journal/pourquoi-pas-de-vernis",
        "name": "Pourquoi nous ne posons pas de vernis."
      },
      {
        "@type": "ListItem",
        "position": 3,
        "url": "https://femiglow.ma/journal/premier-rituel",
        "name": "Mon premier rituel — récit d'une initiée."
      }
      // ... 9 autres items
    ]
  },
  "breadcrumb": {
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Accueil",
        "item": "https://femiglow.ma/"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Journal",
        "item": "https://femiglow.ma/journal"
      }
    ]
  }
}
```

> **Note** : le schema Blog signale à Google que c'est une page de blog/magazine éditorial (différent d'un schema Product ou WebPage générique). Le ItemList permet à Google d'afficher potentiellement les articles directement dans les résultats SERP.

### 15.6 — Schema.org additionnel — Article (sur chaque page individuelle)

Cela ne s'applique pas à `/journal` (le hub) mais à chaque `/journal/[slug]` (les articles individuels). Pour mémoire :

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Hiver, ongles, et patience.",
  "description": "Pourquoi le froid abîme les mains, et comment le rituel répond.",
  "image": "https://femiglow.ma/journal/hiver-ongles/og.jpg",
  "datePublished": "2026-04-12",
  "dateModified": "2026-04-12",
  "author": {
    "@type": "Organization",
    "name": "FemiGlow"
  },
  "publisher": {
    "@type": "Organization",
    "name": "FemiGlow"
  },
  "mainEntityOfPage": "https://femiglow.ma/journal/hiver-ongles-patience"
}
```

> Spec détaillée à produire dans un document séparé pour la page article (`/journal/[slug]`).

### 15.7 — Canonical & hreflang

```html
<link rel="canonical" href="https://femiglow.ma/journal">
<link rel="alternate" hreflang="fr-MA" href="https://femiglow.ma/journal">
<link rel="alternate" hreflang="ar-MA" href="https://femiglow.ma/ar/journal">
<link rel="alternate" hreflang="x-default" href="https://femiglow.ma/journal">
```

#### Canonical avec paramètre de catégorie

Quand la cliente filtre par catégorie (`/journal?cat=saison`), le canonical reste pointé sur `/journal` (sans paramètre) :

```html
<link rel="canonical" href="https://femiglow.ma/journal">
```

> **Pourquoi ?** Pour éviter la duplication d'index par Google. Les filtres sont des **vues différentes** d'une même page hub, pas des pages distinctes.

### 15.8 — Robots & sitemap

```html
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
```

#### Sitemap.xml — entrée pour `/journal`

```xml
<url>
  <loc>https://femiglow.ma/journal</loc>
  <lastmod>2026-05-01</lastmod>
  <changefreq>weekly</changefreq>
  <priority>0.9</priority>
</url>
```

#### Sitemap.xml — entrées pour chaque article

```xml
<url>
  <loc>https://femiglow.ma/journal/hiver-ongles-patience</loc>
  <lastmod>2026-04-12</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.7</priority>
  <image:image>
    <image:loc>https://femiglow.ma/journal/hiver-ongles/cover.jpg</image:loc>
    <image:title>Hiver, ongles, et patience</image:title>
  </image:image>
</url>
```

### 15.9 — RSS Feed (optionnel V2)

Pour les lecteurs habitués aux flux RSS, fournir un feed `/journal/rss.xml` :

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Le journal — FemiGlow</title>
    <link>https://femiglow.ma/journal</link>
    <description>Des textes sur la beauté lente.</description>
    <language>fr-MA</language>
    <lastBuildDate>Sun, 05 May 2026 09:00:00 +0100</lastBuildDate>
    <atom:link href="https://femiglow.ma/journal/rss.xml" rel="self" type="application/rss+xml" />

    <item>
      <title>Hiver, ongles, et patience.</title>
      <link>https://femiglow.ma/journal/hiver-ongles-patience</link>
      <guid>https://femiglow.ma/journal/hiver-ongles-patience</guid>
      <pubDate>Sun, 12 Apr 2026 09:00:00 +0100</pubDate>
      <description>Pourquoi le froid abîme les mains, et comment le rituel répond.</description>
    </item>
    <!-- ... autres items ... -->
  </channel>
</rss>
```

Référence dans le `<head>` :

```html
<link rel="alternate" type="application/rss+xml" title="Le journal FemiGlow" href="/journal/rss.xml">
```

### 15.10 — Stratégie de mots-clés

#### Mots-clés cibles pour la page hub

| Mot-clé cible                          | Volume estimé Maroc | Intention      | Position visée |
| :------------------------------------- | :------------------ | :------------- | :------------- |
| « blog beauté lente »                  | ~30/mois            | Découverte     | Top 5          |
| « FemiGlow journal »                   | ~5/mois (croissant) | Brand search   | Top 1          |
| « culture du soin »                    | ~40/mois            | Considération  | Top 10         |
| « beauté lente Maroc »                 | ~20/mois            | Découverte     | Top 3          |
| « slow beauty blog français »          | ~50/mois            | Découverte     | Top 10         |

#### Mots-clés cibles pour les articles individuels

| Article                                              | Mot-clé cible                          | Volume |
| :-------------------------------------------------- | :------------------------------------- | :----- |
| Hiver, ongles, et patience.                         | « ongles cassent en hiver »            | 60/mois |
| Pourquoi nous ne posons pas de vernis.              | « vernis abîme ongles »                 | 80/mois |
| Mon premier rituel — récit d'une initiée.            | « rituel ongles avis »                 | 40/mois |
| La kératine, cette matière vivante.                  | « kératine ongles santé »              | 50/mois |
| Les quatre minutes du dimanche soir.                | « rituel beauté dimanche »              | 30/mois |

> **Stratégie SEO long-tail** : chaque article cible une requête spécifique avec moins de concurrence que les requêtes commerciales. Cumulés, les articles **multiplient le trafic organique**.

### 15.11 — Hiérarchie des headers

```html
<h1>Le carnet de la maison.</h1>          <!-- Hero -->

  <h2 class="visually-hidden">Article à la une</h2>
    <h3>Hiver, ongles, et patience.</h3>      <!-- Article featured -->

  <h2 class="visually-hidden">Filtre par catégories</h2>

  <h2 class="visually-hidden">Tous les articles</h2>
    <h3>Pourquoi nous ne posons pas de vernis.</h3>
    <h3>Mon premier rituel — récit d'une initiée.</h3>
    <!-- ... autres titres d'articles en h3 ... -->

  <h2>Recevoir le journal.</h2>             <!-- Newsletter -->

  <h2 class="visually-hidden">Pour découvrir la maison</h2>
    <h3>La maison.</h3>                     <!-- Cross-link -->
```

> **Règle SEO** : un seul `<h1>` par page (le titre du hero). Les titres d'articles dans la grille sont des `<h3>` car ce sont des sous-éléments d'une `<h2>` invisible (« Tous les articles »).

### 15.12 — Performance SEO — schema FAQ optionnelle

Sur les pages articles individuels (`/journal/[slug]`), si l'article contient des questions fréquentes, ajouter un schema FAQ. Pour le hub `/journal`, pas de FAQ.

### 15.13 — Indexation des articles individuels

Chaque page `/journal/[slug]` doit :
- Avoir son propre title, meta description, OG image, schema Article
- Être listée dans le sitemap.xml
- Être linkée depuis le hub `/journal` (lien dofollow)
- Avoir un `<link rel="canonical" href="...">` pointant vers elle-même

> Document de spécification séparé à produire pour la page article.

---

## 16 — Accessibilité (a11y)

### 16.1 — Conformité visée

**WCAG 2.2 niveau AA** sur tous les composants critiques. **Niveau AAA** visé sur :
- Contraste des textes critiques (titres, intro, descriptions articles)
- Navigation clavier complète (filtre + « Voir plus » + newsletter form)
- Annonce ARIA des changements d'état (filtrage dynamique, ajout d'articles)
- Lisibilité des photos d'articles (alt texts narratifs)

### 16.2 — Contraste — vérifications

| Combinaison                                        | Ratio   | Niveau WCAG   |
| :------------------------------------------------- | :------ | :------------ |
| Encre `#2C2A28` sur Crème `#FBF8F1`                | 14.2:1  | AAA           |
| Encre claire `#4A4844` sur Crème                   | 9.1:1   | AAA           |
| Brume `#6B6863` sur Crème                          | 5.6:1   | AA            |
| Champagne `#C8A876` sur Crème (kicker hero)        | 2.7:1   | AA Large only — réservé à élément ≥ 14pt (le kicker en SemiBold tracking 4px est OK) |
| Champagne sur Sauge pâle `#E8EFE7` (newsletter)    | 2.5:1   | AA Large only — fleuron décoratif, OK              |
| Encre sur Sauge pâle (titre newsletter)            | 12.8:1  | AAA           |
| Crème pure sur Encre (CTA Lire l'article)          | 14.2:1  | AAA           |
| Sauge dark `#A8C4A6` sur Crème (filets)            | 2.8:1   | (graphique non textuel, OK)                        |
| Encre claire sur Sauge pâle (description newsletter) | 8.4:1 | AAA           |
| Erreur form `#9C5B5B` sur Crème pure               | 5.1:1   | AA            |

### 16.3 — Navigation clavier

| Élément                       | Comportement clavier                            |
| :---------------------------- | :---------------------------------------------- |
| Wordmark                      | Tab focus, Enter active                          |
| Menu items                    | Tab navigation séquentielle                      |
| Burger menu mobile            | Enter ouvre, Escape ferme                        |
| Skip links (3)                | Visibles au focus, Enter saute à la cible       |
| Hero                          | Pas d'éléments focusables (typographie pure)    |
| **Card article featured**     | **Tab focus + Enter = navigation vers l'article** |
| **CTA Lire l'article**        | **Tab focus + Enter = navigation**              |
| **Pills filtre catégories**   | **Tab navigation séquentielle, Enter active**   |
| Cards articles grille         | Tab focus + Enter (navigation vers article)     |
| **Bouton « Voir plus »**      | **Tab focus + Enter = chargement articles**     |
| **Champ email newsletter**    | **Tab focus, saisie clavier**                    |
| **Bouton « M'inscrire »**     | **Tab focus + Enter = soumission**               |
| Cross-link maison             | Tab focus + Enter (navigation)                   |
| Footer liens                  | Tab navigation                                   |

### 16.4 — Focus management — filtrage dynamique

Quand la cliente filtre par catégorie, la **gestion du focus** doit être pensée :

```javascript
// Pseudo-code
function onCategoryChange(newCategory) {
  // 1. Update active pill (visual)
  updatePillState(newCategory);

  // 2. Filter articles (visual + animation)
  filterArticlesInGrid(newCategory);

  // 3. Focus reste sur la pill cliquée (ne pas le déplacer arbitrairement)
  // Exception : si le focus était sur un article qui a disparu (filtré),
  //   alors déplacer le focus vers le premier article visible
  if (focusedElementWasFiltered()) {
    moveFocusToFirstVisibleArticle();
  }

  // 4. ARIA live announcement
  announce(`Catégorie ${newCategory} sélectionnée. ${visibleCount} articles affichés.`);
}
```

### 16.5 — Focus management — newsletter form

Quand la cliente soumet le formulaire newsletter :

```javascript
// État succès
function onSubscribeSuccess() {
  // 1. Hide form, show success message
  formElement.classList.add('hidden');
  successMessage.classList.remove('hidden');

  // 2. Move focus to success message (announce success)
  successMessage.setAttribute('tabindex', '-1');
  successMessage.focus();

  // 3. ARIA live announcement
  announce('Inscription réussie. Vous recevrez le prochain texte dans les quinze jours.');
}

// État erreur
function onSubscribeError() {
  // 1. Show error message under form
  errorMessage.textContent = 'Une erreur est survenue. Veuillez réessayer.';
  errorMessage.classList.remove('hidden');

  // 2. Focus reste sur le bouton (pour permettre nouveau click)
  // Pas de déplacement automatique du focus

  // 3. ARIA live announcement
  announce('Une erreur est survenue. Veuillez réessayer.');
}
```

### 16.6 — Focus management — « Voir plus »

```javascript
// Quand la cliente clique « Voir plus » :
function onLoadMore() {
  // 1. Disable button, show loading state
  loadMoreButton.disabled = true;
  loadMoreButton.setAttribute('aria-busy', 'true');

  // 2. Fetch & inject new articles
  fetchAndInjectNewArticles().then((newArticles) => {

    // 3. Re-enable button (or hide if no more articles)
    loadMoreButton.disabled = false;
    loadMoreButton.setAttribute('aria-busy', 'false');

    if (!hasMore) {
      loadMoreButton.classList.add('hidden');
    }

    // 4. Focus moves to FIRST new article (helps keyboard users navigate)
    const firstNewArticle = newArticles[0];
    firstNewArticle.querySelector('h3').setAttribute('tabindex', '-1');
    firstNewArticle.querySelector('h3').focus();

    // 5. ARIA live announcement
    announce(`${newArticles.length} articles supplémentaires chargés.`);
  });
}
```

### 16.7 — Focus ring

| Propriété     | Valeur                                          |
| :------------ | :---------------------------------------------- |
| Couleur       | `#A8C4A6` (Sauge dark)                          |
| Épaisseur     | 2px                                             |
| Offset        | 4px                                             |
| Border-radius | Hérite de l'élément (0 ou 999px pour pills)    |
| Outline-style | `solid`                                         |
| Visible       | Sur focus clavier uniquement (`:focus-visible`) |

### 16.8 — ARIA labels & landmarks

```html
<header role="banner" aria-label="En-tête principal">
  <nav aria-label="Navigation principale">...</nav>
</header>

<main role="main" aria-label="Page Journal">

  <section aria-labelledby="journal-hero-title">
    <span class="kicker">LE JOURNAL</span>
    <h1 id="journal-hero-title">Le carnet de la maison.</h1>
    <p class="intro">Des textes sur la beauté lente...</p>
  </section>

  <section aria-label="Article à la une">
    <article aria-labelledby="featured-title">
      <figure>
        <img src="..." alt="Mains détendues posées sur un plaid, un livre fermé à côté, lumière douce d'hiver entrant par la fenêtre">
      </figure>
      <span class="kicker">À LA UNE</span>
      <h2 id="featured-title" class="visually-hidden">Article à la une : Hiver, ongles, et patience.</h2>
      <h3>Hiver, ongles, et patience.</h3>
      <p>Pourquoi le froid abîme les mains, et comment le rituel répond — fragment de saison.</p>
      <hr aria-hidden="true">
      <p class="meta">
        <span class="category">Saison</span> · <span class="reading-time">8 minutes</span>
      </p>
      <p class="date">Le 12 avril 2026</p>
      <a href="/journal/hiver-ongles-patience" class="cta">
        Lire l'article <span aria-hidden="true">→</span>
      </a>
    </article>
  </section>

  <section aria-label="Filtrer les articles par catégorie">
    <span class="kicker">EXPLORER PAR THÈME</span>
    <div role="tablist" aria-label="Catégories d'articles">
      <button role="tab"
              aria-selected="true"
              aria-controls="articles-grid"
              data-category="all">Toutes</button>
      <button role="tab"
              aria-selected="false"
              aria-controls="articles-grid"
              data-category="maison">Maison</button>
      <!-- ... autres pills ... -->
    </div>
  </section>

  <section aria-labelledby="articles-list-title">
    <h2 id="articles-list-title" class="visually-hidden">Tous les articles</h2>

    <div id="articles-grid" role="tabpanel" aria-live="polite">
      <article>
        <a href="/journal/pourquoi-pas-de-vernis">
          <figure>
            <img src="..." alt="Une main posée sur une table en bois, ongles non vernis, lumière naturelle">
          </figure>
          <h3>Pourquoi nous ne posons pas de vernis.</h3>
          <hr aria-hidden="true">
          <p class="meta">
            <span class="category">Maison</span> · <span class="reading-time">6 minutes</span>
          </p>
          <p class="date">Le 5 mai 2026</p>
        </a>
      </article>
      <!-- ... autres cards ... -->
    </div>

    <button id="load-more"
            aria-controls="articles-grid"
            aria-busy="false">
      Voir d'autres articles
    </button>
  </section>

  <section aria-labelledby="newsletter-title" class="newsletter">
    <h2 id="newsletter-title">Recevoir le journal.</h2>
    <p>Un texte tous les quinze jours...</p>

    <form aria-label="Inscription au journal" novalidate>
      <label for="newsletter-email" class="visually-hidden">
        Adresse email
      </label>
      <input type="email"
             id="newsletter-email"
             name="email"
             placeholder="votre@email.com"
             required
             aria-required="true"
             aria-describedby="newsletter-disclaimer">

      <button type="submit">M'inscrire</button>

      <p id="newsletter-disclaimer">
        Vos données restent dans la maison. Désinscription en un clic à tout moment.
      </p>
    </form>

    <!-- Message succès (caché par défaut, affiché après soumission) -->
    <div role="status"
         aria-live="polite"
         class="success-message hidden"
         tabindex="-1">
      <span class="check" aria-hidden="true">✓</span>
      <strong>C'est noté.</strong>
      <p>Vous recevrez le prochain texte dans les quinze jours.</p>
    </div>
  </section>

  <section aria-labelledby="crosslink-maison-title">
    <article>
      <figure>
        <img src="..." alt="Vue d'atelier de la maison FemiGlow à Casablanca, mains au travail, pots de soin sur une table en bois">
      </figure>
      <span class="kicker">POUR DÉCOUVRIR</span>
      <h2 id="crosslink-maison-title">La maison.</h2>
      <p>L'histoire derrière les textes...</p>
      <a href="/maison" class="cta">
        Visiter la maison <span aria-hidden="true">→</span>
      </a>
    </article>
  </section>
</main>

<!-- Annonces dynamiques globales -->
<div role="status" aria-live="polite" aria-atomic="true" id="announcer" class="visually-hidden">
  <!-- Texte injecté dynamiquement par JS -->
</div>

<footer role="contentinfo" aria-label="Pied de page">...</footer>
```

### 16.9 — Annonces dynamiques (ARIA Live Regions)

| Action                                           | Annonce ARIA                                                       |
| :----------------------------------------------- | :----------------------------------------------------------------- |
| Click sur une pill catégorie                     | « Catégorie [nom] sélectionnée. [N] articles affichés. »            |
| Click sur « Voir plus » — début                  | « Chargement de nouveaux articles. »                                |
| Click sur « Voir plus » — succès                 | « [N] articles supplémentaires chargés. »                           |
| Click sur « Voir plus » — erreur                 | « Une erreur est survenue. Veuillez réessayer. »                    |
| Filtre vide (catégorie sans articles)             | « Aucun article dans cette catégorie pour l'instant. »              |
| Newsletter — soumission en cours                 | « Inscription en cours. »                                            |
| Newsletter — succès                              | « Inscription réussie. Vous recevrez le prochain texte dans les quinze jours. » |
| Newsletter — email déjà inscrit                  | « Cet email est déjà inscrit. Merci d'être avec nous. »             |
| Newsletter — erreur validation                   | « Cet email semble incomplet. »                                      |
| Newsletter — erreur serveur                      | « Une erreur est survenue. Veuillez réessayer. »                    |

### 16.10 — Images & alt texts

| Image                             | Alt text                                                                    |
| :-------------------------------- | :-------------------------------------------------------------------------- |
| Photo article featured            | Alt narratif de la photo lifestyle (varie à chaque featured) — exemple : « Mains détendues posées sur un plaid, un livre fermé à côté, lumière douce d'hiver entrant par la fenêtre » |
| Photos articles grille            | Alt narratif descriptif spécifique à chaque article (varie) — exemples ci-dessous |
| Photo cross-link maison           | « Vue d'atelier de la maison FemiGlow à Casablanca, mains au travail, pots de soin sur une table en bois » |
| Fleurons décoratifs               | `aria-hidden="true"` (décoratif, pas informatif)                             |
| Filets séparateurs                | `aria-hidden="true"`                                                          |

#### Exemples de bons alt texts pour les articles

| Article                                              | Alt text                                                          |
| :-------------------------------------------------- | :---------------------------------------------------------------- |
| Pourquoi nous ne posons pas de vernis.              | « Une main posée sur une table en bois, ongles non vernis, lumière naturelle » |
| Mon premier rituel — récit d'une initiée.           | « Vue intérieure d'une chambre, table de soin avec pots et linge plié » |
| La kératine, cette matière vivante.                 | « Macro d'un ongle naturel sur fond crème, texture détaillée »    |
| Les quatre minutes du dimanche soir.                | « Mains au repos sur un coussin, fin de journée, lumière dorée »  |
| Notre engagement matières.                           | « Plan de travail d'atelier, ingrédients en pots, balance de précision » |

> **Règle d'or pour les alt texts** : décrire ce qu'on voit comme on le décrirait à quelqu'un qui ne peut pas voir, **sans interpréter** (ne pas dire « belle » ou « élégante »). L'utilisateur de lecteur d'écran fait sa propre interprétation.

### 16.11 — Skip links

```html
<a href="#main" class="skip-link">Aller au contenu principal</a>
<a href="#articles-grid" class="skip-link">Aller à la grille des articles</a>
<a href="#newsletter-title" class="skip-link">Aller à la newsletter</a>
```

> **Trois skip links** sur `/journal` :
> 1. Vers le main (saut du header)
> 2. Vers la grille (saut du hero + featured + filtre — pour les habituées)
> 3. Vers la newsletter (raccourci pour celles qui veulent juste s'inscrire)

### 16.12 — Réduction du mouvement

```css
@media (prefers-reduced-motion: reduce) {
  /* Toutes animations désactivées */
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }

  /* Hero : fleuron + titre apparaissent finalisés, pas d'animation séquentielle */
  .journal-hero > * {
    opacity: 1 !important;
    transform: none !important;
  }

  /* Filtrage : pas de fade-out/in, masquage instantané */
  .article-card.filtering-out {
    opacity: 0 !important;
    transition: none !important;
  }
  .article-card.filtering-in {
    opacity: 1 !important;
    transition: none !important;
  }

  /* « Voir plus » : nouveaux articles apparaissent finalisés */
  .article-card.new {
    opacity: 1 !important;
    transition: none !important;
  }

  /* Newsletter form success : pas de fade transition */
  .newsletter-form, .newsletter-success {
    transition: none !important;
  }

  /* Hover photo card : pas de zoom-in */
  .article-card:hover img {
    transform: none !important;
  }

  /* CTA flèche : pas d'animation */
  .cta:hover .arrow {
    transform: none !important;
  }
}
```

### 16.13 — Lecture par lecteur d'écran — flux

#### Pour une utilisatrice avec lecteur d'écran (NVDA, VoiceOver, TalkBack)

```
1. « En-tête principal »
2. « Navigation principale, liste de 5 éléments... »
3. « Page Journal, contenu principal »
4. « Le carnet de la maison. Heading 1 »
5. « Des textes sur la beauté lente, la culture du soin, et les matières qui nous tiennent. »
6. « Article à la une, région »
7. « Image : Mains détendues posées sur un plaid, un livre fermé à côté, lumière douce d'hiver entrant par la fenêtre »
8. « À LA UNE »
9. « Hiver, ongles, et patience. Heading 3 »
10. « Pourquoi le froid abîme les mains, et comment le rituel répond — fragment de saison. »
11. « Saison, 8 minutes »
12. « Le 12 avril 2026 »
13. « Lien : Lire l'article »
14. « Filtrer les articles par catégorie, région »
15. « EXPLORER PAR THÈME »
16. « Catégories d'articles, liste à onglets de 6 éléments »
17. « Toutes, onglet sélectionné, 1 sur 6 »
18. ... etc.
```

> **Note critique** : la séquence est cohérente, narrative, et ne contient pas de redondances. Les `aria-hidden` sont bien placés pour cacher les éléments décoratifs.

### 16.14 — Test d'accessibilité — checklist

| Outil                | Usage                                                       |
| :------------------- | :---------------------------------------------------------- |
| **axe DevTools**     | Audit automatique sur chaque déploiement                     |
| **WAVE**             | Audit visuel en complément                                  |
| **Lighthouse**       | Score d'accessibilité ≥ 95/100                              |
| **NVDA + Firefox**   | Test lecteur d'écran Windows                                |
| **VoiceOver + Safari** | Test lecteur d'écran macOS/iOS                            |
| **TalkBack**         | Test lecteur d'écran Android                                |
| **Tab order audit**  | Vérification manuelle de la séquence Tab                    |
| **Color contrast**   | WebAIM Contrast Checker                                      |
| **Filtrage clavier**  | Naviguer entre pills uniquement avec Tab + Enter             |
| **« Voir plus » clavier** | Activer + vérifier focus sur premier nouvel article       |
| **Newsletter form clavier** | Tab + saisie + Enter, vérifier annonces             |

---

## 17 — Microcopy & états

### 17.1 — Textes utilitaires de la page `/journal`

| Contexte                              | Microcopy                                                       |
| :------------------------------------ | :-------------------------------------------------------------- |
| Loading initial                       | (aucun — `font-display: swap` invisible)                        |
| Photo article featured échec          | (fallback sur fond crème uni, le bloc info reste fonctionnel)   |
| Photo article grille échec            | Placeholder discret en sauge pâle, sans message                  |
| Cookies banner (premier accès)        | « Nous utilisons des cookies pour comprendre votre visite. »     |
| Erreur 404 → `/journal/...`           | « Cet article s'est égaré du carnet. » + lien retour `/journal`  |
| Erreur 500 sur la page                | « La maison rencontre un trouble passager. Revenez dans quelques instants. » |

### 17.2 — Les 7 états du formulaire newsletter

#### État 1 — Repos (par défaut)

```
┌──────────────────────────┐  ┌──────────────────┐
│  votre@email.com         │  │   M'inscrire     │
└──────────────────────────┘  └──────────────────┘
```

Champ vide, placeholder visible, bouton actif.

#### État 2 — Saisie en cours

```
┌──────────────────────────┐  ┌──────────────────┐
│  ahmed@gmail.            │  │   M'inscrire     │
└──────────────────────────┘  └──────────────────┘
```

Champ contient du texte, bouton actif, validation différée jusqu'au blur.

#### État 3 — Validation client (au blur ou à la soumission)

##### 3a — Email invalide

```
┌──────────────────────────┐  ┌──────────────────┐
│  ahmed@gmail             │  │   M'inscrire     │
└──────────────────────────┘  └──────────────────┘
   Cet email semble incomplet.
```

| Style erreur     | Inter Regular Italic 11pt                              |
| :--------------- | :----------------------------------------------------- |
| Couleur          | `#9C5B5B` (rouge feutré)                                |
| Position         | Sous le champ, espacement 6px                           |
| Border du champ  | `#9C5B5B` au lieu de `#E8E0D2`                         |

##### 3b — Email vide à la soumission

```
   Veuillez entrer votre adresse email.
```

#### État 4 — Soumission en cours

```
┌──────────────────────────┐  ┌──────────────────┐
│  ahmed@gmail.com         │  │       ⟳          │
└──────────────────────────┘  └──────────────────┘
```

Bouton avec spinner (cercle 16px, stroke 2px crème pure, rotation 1 tour/800ms). Champ et bouton désactivés.

#### État 5 — Succès

```
┌────────────────────────────────────────┐
│                                        │
│  ✓                                     │
│                                        │
│  C'est noté.                           │
│                                        │
│  Vous recevrez le prochain texte       │
│  dans les quinze jours.                │
│                                        │
└────────────────────────────────────────┘
```

| Élément          | Style                                                  |
| :--------------- | :----------------------------------------------------- |
| Icône ✓          | Caractère ✓ (U+2713) couleur `#A8C4A6` (Sauge dark), taille 32pt |
| Titre            | Cormorant Light 24pt, couleur Encre                    |
| Description      | Cormorant Italic 15pt, couleur Encre claire            |
| Animation        | Le formulaire fade-out 320ms, le message fade-in 320ms |
| Persistance      | Le message reste affiché pour le reste de la session   |

> **Pourquoi pas de bouton « Fermer » ou « Continuer » sur le succès ?** Parce que la cliente n'a rien à fermer ni à continuer — elle a accompli son geste. Le message reste, témoignage paisible.

#### État 6 — Email déjà inscrit

```
┌────────────────────────────────────────┐
│                                        │
│  ◯                                     │
│                                        │
│  Cet email est déjà inscrit.           │
│                                        │
│  Merci d'être avec nous.               │
│                                        │
└────────────────────────────────────────┘
```

| Élément          | Style                                                  |
| :--------------- | :----------------------------------------------------- |
| Icône ◯          | Cercle vide (U+25CB) couleur `#C8A876` (Champagne)     |
| Titre            | Cormorant Light 22pt                                    |
| Description      | Cormorant Italic 15pt, couleur Encre claire            |

> **Tonalité particulière** : ce n'est pas un message d'erreur, c'est un **message de reconnaissance**. La cliente déjà inscrite est rassurée — elle n'a pas perdu ses données, elle est connue.

#### État 7 — Erreur serveur

```
   Une erreur est survenue. Veuillez réessayer.
```

Affiché sous le bouton, sans replacer le formulaire. Le formulaire reste actif, la cliente peut re-cliquer.

| Style            | Inter Regular Italic 12pt                              |
| :--------------- | :----------------------------------------------------- |
| Couleur          | `#9C5B5B` (rouge feutré)                                |
| Auto-disappear   | Après 6 secondes                                       |

### 17.3 — Les 4 états du bouton « Voir plus »

#### État 1 — Repos

```
┌─────────────────────────────┐
│   Voir d'autres articles    │
└─────────────────────────────┘
```

Bouton outline encre, pleine fonctionnalité.

#### État 2 — Loading

```
┌─────────────────────────────┐
│            ⟳                │
└─────────────────────────────┘
```

Spinner mini, bouton désactivé pendant le chargement.

#### État 3 — Pas d'autres articles (état final)

Le bouton **disparaît** simplement (animation fade-out 320ms). À la place, optionnellement, une mention paisible :

```
        Vous avez tout lu.
```

| Style            | Cormorant Light Italic 14pt                            |
| :--------------- | :----------------------------------------------------- |
| Couleur          | `#6B6863` (Brume)                                       |
| Alignement       | Centré                                                  |
| Apparition       | Fade-in 600ms après disparition du bouton              |

> **Variante éditoriale** : « Vous avez tout lu. » est paisible, presque mélancolique. Pas « Plus d'articles disponibles » (administratif), pas « C'est tout pour le moment ! » (excité).

#### État 4 — Erreur serveur

```
   Une erreur est survenue. Veuillez réessayer.
```

Affiché sous le bouton. Le bouton revient à l'état repos, ré-cliquable.

### 17.4 — Les 3 états du filtre catégories

#### État 1 — Toutes (défaut)

```
[ Toutes ●●● ]  [ Maison ]  [ Saison ]  [ Voix ]  [ Matières ]  [ Pratique ]
```

« Toutes » en état actif (fond encre, texte crème). Toutes les autres en état repos.

#### État 2 — Catégorie sélectionnée

```
[ Toutes ]  [ Maison ]  [ Saison ●●● ]  [ Voix ]  [ Matières ]  [ Pratique ]
```

Pill cliquée passe en état actif, « Toutes » repasse en état repos.

#### État 3 — Catégorie sans articles

Si une catégorie a **0 article** (cas rare, par exemple « Pratique » au début si pas encore d'article publié dans cette catégorie) :

```
┌────────────────────────────────────────────────────┐
│                                                    │
│         Aucun article dans cette catégorie         │
│                  pour l'instant.                    │
│                                                    │
│            La maison y travaille.                  │
│                                                    │
└────────────────────────────────────────────────────┘
```

| Style            | Cormorant Light Italic 17pt                            |
| :--------------- | :----------------------------------------------------- |
| Couleur          | `#6B6863` (Brume)                                       |
| Alignement       | Centré                                                  |
| Hauteur section  | 320px                                                   |

> **Tonalité paisible** : « La maison y travaille » — intime, narratif. Pas « Coming soon » (commercial), pas « Aucun résultat trouvé » (admin), pas « Cette catégorie est vide » (vide est un mot froid).

### 17.5 — Tonalité globale des messages — règles

**Toujours paisible. Toujours littéraire.** Jamais d'urgence, jamais d'alarme, jamais d'emoji exclamatif.

| À éviter                                 | À préférer                                              |
| :--------------------------------------- | :------------------------------------------------------ |
| « Erreur 404 ! Page non trouvée »        | « Cet article s'est égaré du carnet. »                  |
| « Plus d'articles disponibles »          | « Vous avez tout lu. »                                   |
| « Aucun résultat trouvé »                | « La maison y travaille. »                              |
| « Email invalide ! »                     | « Cet email semble incomplet. »                         |
| « Inscription confirmée ! »              | « C'est noté. »                                          |
| « Vous êtes déjà inscrit ! »             | « Merci d'être avec nous. »                              |
| « Chargement... »                        | (silencieux — spinner suffit)                           |
| « Cliquez ici pour voir plus »           | « Voir d'autres articles »                              |
| « Top articles »                         | (interdit — pas de notion de classement)                |
| « Article tendance »                     | (interdit — pas de viralité)                            |
| « Lecture rapide »                       | « 5 minutes » (factuel, pas qualifiant)                 |

### 17.6 — Microcopy mobile spécifique

| Contexte                              | Microcopy                                          |
| :------------------------------------ | :------------------------------------------------- |
| Burger menu fermé (aria-label)        | « Ouvrir le menu de navigation »                   |
| Burger menu ouvert (aria-label)       | « Fermer le menu de navigation »                   |
| Filtre scroll horizontal              | (aucun texte — gestuelle silencieuse)              |
| Carrousel témoignages (n/a — pas de carrousel ici) | n/a                                  |
| Newsletter form mobile                | (champ et bouton labels identiques desktop)        |

### 17.7 — Cookies banner

Identique à toutes les autres pages. Apparaît une seule fois, ne re-apparaît pas si déjà répondu.

```
┌────────────────────────────────────────────────────────────────┐
│  Nous utilisons des cookies pour comprendre votre visite       │
│  et améliorer votre expérience. Aucun partage commercial.      │
│                                                                │
│  [Tout accepter]  [Personnaliser]  Refuser                     │
└────────────────────────────────────────────────────────────────┘
```

### 17.8 — Email confirmation newsletter — copy intégral

#### Sujet

```
Confirmer votre inscription au journal FemiGlow
```

#### Pré-header (preview)

```
Un dernier clic, et le carnet vous parviendra tous les quinze jours.
```

#### Corps de l'email

```
Bonjour,

Vous avez demandé à recevoir le journal de la maison.

Pour confirmer cette inscription, cliquez sur le lien ci-dessous.
Si vous n'êtes pas à l'origine de cette demande, ignorez ce message —
nous ne ferons rien sans cette confirmation.

[Confirmer mon inscription au journal]

Vos données restent dans la maison.

— FemiGlow
femiglow.ma
```

| Élément              | Style                                                  |
| :------------------- | :----------------------------------------------------- |
| Police               | Cormorant Garamond + Inter (cohérent avec le site)     |
| Background           | Crème `#FBF8F1`                                        |
| Bouton CTA           | Encre `#2C2A28`, texte crème, padding 14px 32px        |
| Ton                  | Paisible, narratif                                      |

### 17.9 — Premier email newsletter envoyé après confirmation

#### Sujet

```
Bienvenue dans le carnet.
```

#### Corps

```
Bonjour,

Voilà. Vous êtes parmi celles qui recevront, tous les quinze jours,
un texte de la maison.

Pas de rythme imposé pour le lire. Pas de réponse attendue.
Juste un fragment, déposé dans votre boîte.

Le prochain texte arrivera le [date dans 15 jours].

D'ici là, si l'envie vous prend de feuilleter le carnet,
il est ici : femiglow.ma/journal

— FemiGlow
```

> **Tonalité critique** : c'est un email de bienvenue **sans transaction**, **sans up-sell**, **sans CTA d'achat**. La maison **honore** la promesse faite au moment de l'inscription. Cette cohérence est fondatrice de la confiance.

### 17.10 — Microcopy de désinscription

À la fin de chaque email envoyé, lien de désinscription :

```
Si vous ne souhaitez plus recevoir le carnet, vous pouvez vous désinscrire ici.
Vos données seront alors effacées de notre liste.
```

#### Page de désinscription `/desabonnement?email=...&token=...`

```
┌────────────────────────────────────────────────────┐
│                                                    │
│             Vous quittez le carnet ?               │
│                                                    │
│    Cliquez ci-dessous pour confirmer votre         │
│    désinscription. Vos données seront effacées.    │
│                                                    │
│         ┌──────────────────────────┐                │
│         │  Confirmer mon départ   │                │
│         └──────────────────────────┘                │
│                                                    │
│         Ou bien fermer cette page                   │
│         pour rester avec nous.                     │
│                                                    │
└────────────────────────────────────────────────────┘
```

#### Page de confirmation de désinscription

```
┌────────────────────────────────────────────────────┐
│                                                    │
│            C'est fait.                              │
│                                                    │
│   Vous ne recevrez plus le carnet de la maison.    │
│   Vos données ont été effacées.                     │
│                                                    │
│   Si l'envie revient un jour, le journal           │
│   reste ouvert sur femiglow.ma/journal.            │
│                                                    │
└────────────────────────────────────────────────────┘
```

> **Tonalité du départ** : aucun reproche, aucune tentative de rétention agressive. La cliente part — la maison **respecte** ce départ. C'est cette dignité dans la séparation qui maintient la marque.

---

## 18 — Synthèse — checklist de validation

Avant mise en production, vérifier que chaque élément ci-dessous est validé. C'est l'audit final de la page `/journal`.

### 18.1 — Identité de marque & voix éditoriale

- [ ] Wordmark Pinyon Script présent en header et footer
- [ ] Aucune substitution de police pour le wordmark
- [ ] Palette signature respectée (sauge dominante, crème support, encre tranche)
- [ ] **Champagne utilisé exactement 2-3 fois** sur la page (kicker hero, badge À LA UNE, fleuron newsletter)
- [ ] Photo article featured contextuelle (jamais isolée fond blanc)
- [ ] 12 photos articles dans la grille, chacune narrative
- [ ] Photo cross-link maison (atelier Casa)
- [ ] Pas d'emoji nulle part (sauf ✓ texte unicode dans newsletter succès)
- [ ] **Pas de pop-up newsletter** à l'arrivée — la newsletter n'apparaît qu'en section 05
- [ ] Pas de barre de progression de scroll
- [ ] Pas de sticky CTA d'achat
- [ ] **Pas de CTA d'achat sur cette page** (ni vers /kit, ni de prix)

### 18.2 — Copy & ton éditorial

- [ ] Hero kicker : « LE JOURNAL » Inter SemiBold tracking 4px **en Champagne**
- [ ] Hero titre : « Le carnet de la maison. » (italic)
- [ ] Hero intro : « Des textes sur la beauté lente, la culture du soin, et les matières qui nous tiennent. »
- [ ] Article featured kicker : « À LA UNE » en Champagne tracking 3px
- [ ] Article featured CTA : « Lire l'article → » avec flèche animée
- [ ] Filtre kicker : « EXPLORER PAR THÈME » en Brume (pas Champagne)
- [ ] 6 pills : Toutes / Maison / Saison / Voix / Matières / Pratique
- [ ] **Pas de compteur** sur les pills
- [ ] Bouton « Voir d'autres articles » (pas « Voir plus »)
- [ ] Newsletter titre : « Recevoir le journal. »
- [ ] Newsletter description : 4 lignes courtes avec promesses négatives Sugarman (« Pas de promotion. Aucune commande. »)
- [ ] Newsletter mention RGPD : « Vos données restent dans la maison. »
- [ ] Cross-link maison kicker : « POUR DÉCOUVRIR »
- [ ] Cross-link maison titre : « La maison. » (italic)
- [ ] Cross-link maison CTA : « Visiter la maison → »
- [ ] Tonalité paisible partout, jamais commerciale ni urgente
- [ ] Apostrophes typographiques courbes ' partout
- [ ] Guillemets français « » avec espaces insécables

### 18.3 — Tactiques Kolenda — minimum 4 par section

- [ ] **Hero du Journal** : `EMPTY SPACE MAX (54%)` `INDIRECT CLAIM PAR SOBRIETE` `MAGAZINE FRAMING` `CHAMPAGNE SIGNAL` `ITALIC = MEDITATION`
- [ ] **Article featured** : `MAGAZINE LAYOUT ASYMETRIQUE 60/40` `FEATURED = AUTHORITY` `IMPLY HUMAN` `CTA AVEC FLECHE = NAVIGATION`
- [ ] **Filtre catégories** : `CURATION OVER CHOICE (6 OPTIONS)` `PILLS = MAGAZINE MODERNE` `DYNAMIC FILTERING` `PAS MULTI-SELECT`
- [ ] **Grille articles** : `3-COLUMN MAGAZINE QUALITY` `PICORAGE EDITORIAL` `LOAD-MORE > PAGINATION (+40% engagement)` `IMPLY HUMAN`
- [ ] **Newsletter** : `RECIPROCITE CIALDINI (donner d'abord)` `PROMESSES NEGATIVES SUGARMAN` `CADRE EDITORIAL = LEGITIMATION` `VOCABULAIRE LITTERAIRE`
- [ ] **Cross-link maison** : `SINGLE STRONG LINK` `IMPLY HUMAN ATELIER`

### 18.4 — Performance (cibles)

- [ ] **LCP < 2.2s** sur 4G simulé Maroc
- [ ] **CLS < 0.08**
- [ ] **INP < 180ms**
- [ ] Page weight initiale (hors images lazy) < 600 KB
- [ ] Photo article featured preloadée avec `fetchpriority="high"`
- [ ] 11 photos grille en `loading="lazy"`
- [ ] Articles supplémentaires (« Voir plus ») chargés via API JSON
- [ ] Polices critiques preloaded (Inter SemiBold, Cormorant Light, Cormorant Light Italic)
- [ ] CSS critique inline dans `<head>`
- [ ] JavaScript en defer
- [ ] CDN configuré (Polish, Mirage)
- [ ] **Stratégie SSG + ISR** recommandée (Next.js, Astro)

### 18.5 — Mécaniques dynamiques

- [ ] Filtrage par catégorie sans rechargement de page (History API)
- [ ] URL synchronisée avec catégorie active (`/journal?cat=saison`)
- [ ] Deep link supporté (arrivée directe sur `/journal?cat=voix` active la pill)
- [ ] Animation filtrage : fade-out 300ms + reflow + fade-in 300ms cascade
- [ ] Scroll position préservé au filtrage (pas de reset top)
- [ ] « Voir plus » charge 9 articles supplémentaires via API
- [ ] Bouton « Voir plus » disparaît quand plus d'articles disponibles
- [ ] Mention « Vous avez tout lu. » optionnelle après dernière page
- [ ] **Newsletter — double opt-in obligatoire** (RGPD + qualité liste)
- [ ] Newsletter — 7 états gérés (repos, saisie, validation, loading, succès, erreur, déjà inscrit)
- [ ] Newsletter — animation de transition formulaire → succès (320ms)

### 18.6 — Responsive

- [ ] Mobile 375px, 390px, 414px testés
- [ ] Tablet 768px, 1024px testés
- [ ] Desktop 1280px, 1440px, 1920px testés
- [ ] Aucun débordement horizontal à aucune taille
- [ ] Touch targets ≥ 44×44px sur mobile
- [ ] Texte minimum 14px sur mobile
- [ ] **Hero mobile** : titre 32pt, intro 15pt, fond crème uni
- [ ] **Article featured mobile** : photo dessus, info dessous (empilage)
- [ ] **Filtre catégories mobile** : scroll horizontal avec scroll-snap
- [ ] **Grille articles mobile** : 1 colonne (pas 2)
- [ ] **Newsletter mobile** : champ pleine largeur, bouton dessous (pas en ligne)
- [ ] **Cross-link maison mobile** : photo dessus, info dessous

### 18.7 — SEO

- [ ] Title 56-60 caractères
- [ ] Meta description 140-155 caractères
- [ ] Open Graph image 1200×630 dédiée à `/journal` (avec photo featured ou typo)
- [ ] Twitter Card configurée
- [ ] **Schema.org Blog + CollectionPage + ItemList** JSON-LD complet
- [ ] **Schema.org BreadcrumbList** pour navigation
- [ ] Schema Article appliqué aux pages individuelles (`/journal/[slug]`)
- [ ] Canonical URL `https://femiglow.ma/journal` (sans paramètre `?cat=`)
- [ ] Hreflang fr-MA + ar-MA + x-default
- [ ] Sitemap.xml inclut `/journal` avec **priority 0.9**
- [ ] Sitemap.xml inclut chaque article avec **priority 0.7**
- [ ] Un seul `<h1>` (titre du hero « Le carnet de la maison. »)
- [ ] Hiérarchie `<h2>`, `<h3>` cohérente
- [ ] **RSS feed** optionnel V2 sur `/journal/rss.xml`
- [ ] `max-image-preview:large` dans robots meta

### 18.8 — Accessibilité (avec mécaniques dynamiques)

- [ ] WCAG 2.2 AA validé via axe-core ou WAVE
- [ ] Contrastes vérifiés sur toutes les combinaisons texte/fond
- [ ] Navigation clavier complète (Tab, Enter, Escape)
- [ ] Focus ring visible et cohérent
- [ ] ARIA landmarks et labels en place
- [ ] **Filtre par catégories** : `role="tablist"`, `role="tab"`, `aria-selected`
- [ ] **« Voir plus »** : `aria-controls`, `aria-busy`
- [ ] **Newsletter form** : labels visually-hidden, `aria-required`, `aria-describedby`
- [ ] **Annonces ARIA live** : changement catégorie, ajout articles, succès newsletter, erreurs
- [ ] **Focus management** : focus reste sur pill cliquée, focus déplacé vers premier nouvel article au load-more, focus sur message succès newsletter
- [ ] Alt texts narratifs sur toutes les images informatives
- [ ] **3 skip links** : main / articles-grid / newsletter-title
- [ ] `prefers-reduced-motion` respecté (animations + filtrage + load-more + newsletter)
- [ ] Test lecteur d'écran NVDA, VoiceOver, TalkBack
- [ ] Lighthouse Accessibility score ≥ 95/100

### 18.9 — Émotion & cohérence éditoriale

- [ ] **Le Journal est cohérent avec la voix de la maison** sur les autres pages
- [ ] **Aucune transaction directe** sur cette page hub
- [ ] **Aucun lien d'achat** vers `/kit` (sauf via le footer global, qui est neutre)
- [ ] L'autorité éditoriale se construit par la **régularité** (mention « tous les quinze jours »)
- [ ] Les 6 catégories couvrent tous les sujets nobles (Maison, Saison, Voix, Matières, Pratique)
- [ ] L'article featured est **manuellement sélectionné** (pas algorithmique)
- [ ] La rotation du featured est documentée (toutes les 1-2 semaines)
- [ ] La newsletter respecte le **principe de respect de la cliente** :
  - Pas d'intrusion (pas de pop-up)
  - Pas de promesse de promotion
  - Désinscription en un clic
  - Données « restent dans la maison »
- [ ] Le cross-link maison invite **doucement** vers `/maison`
- [ ] Aucun élément ne dévalue le **statut éditorial** de la page (pas de réseau social, pas de comments, pas de likes)
- [ ] Architecture émotionnelle : reconnaissance → disposition → curiosité ciblée → choix → picorage → engagement long terme

---

> *« Une page web qui se lit comme un magazine. Une newsletter qui s'inscrit comme une lettre. Un journal qui parle, mais ne vend pas — et c'est précisément ce qui le rend si fidèle. »*

**FIN · FemiGlow · Spécification de la page Journal v1.0 · Mai 2026**

*Prochaine spécification (B2C) à produire : `/journal/[slug]` (page article individuelle) — différentes mécaniques (TOC, partage, lecture longue, scroll-spy).*

*Puis : `/maison`, `/panier`, `/commander ★`, `/merci`.*

*B2B à venir : `/partenaires`, `/programme`, `/echantillon ★`, `/espace-pro`.*
