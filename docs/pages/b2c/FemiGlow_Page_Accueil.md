# Page d'accueil — `/`

> **Univers Particulier · B2C** — Document de spécification détaillée
> *Volume III · Mai 2026 · Complémentaire à la charte graphique et au document d'architecture.*

---

## Sommaire

1. [Identité de la page](#1--identité-de-la-page)
2. [Contexte stratégique](#2--contexte-stratégique)
3. [Architecture verticale globale](#3--architecture-verticale-globale)
4. [Header — élément persistant](#4--header--élément-persistant)
5. [Section 01 — Hero éditorial](#5--section-01--hero-éditorial)
6. [Section 02 — Les quatre gestes](#6--section-02--les-quatre-gestes)
7. [Section 03 — Le manifeste](#7--section-03--le-manifeste)
8. [Section 04 — Avis clientes](#8--section-04--avis-clientes)
9. [Section 05 — Le Journal · extraits](#9--section-05--le-journal--extraits)
10. [Section 06 — Newsletter de fin](#10--section-06--newsletter-de-fin)
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

| Attribut             | Valeur                                                                |
| :------------------- | :-------------------------------------------------------------------- |
| **URL**              | `femiglow.ma/`                                                        |
| **Type**             | Hero éditorial · landing principale                                   |
| **Audience**         | Femme 28–45 ans, urbaine (Casablanca, Rabat, Marrakech, Tanger)       |
| **Profil cognitif**  | Curieuse, sceptique, scanneuse                                        |
| **Pouvoir d'achat**  | CSP B / B+ — peut payer 320 dh sans réfléchir                         |
| **Funnel**           | TOFU — Top of Funnel · Awareness                                      |
| **Position parcours**| Premier contact ou retour de campagne (Instagram, recherche organique) |
| **Durée d'attention**| 3 à 8 secondes avant décision rester / partir                         |
| **Device split**     | Mobile 78% · Desktop 18% · Tablet 4%                                  |

### Ce que la page **doit** faire

1. **Capturer en 5 secondes** l'attention d'une visiteuse qui arrive d'Instagram ou Google.
2. **Communiquer une catégorie** : ce n'est pas un vernis, ce n'est pas un institut, c'est un *rituel*.
3. **Inspirer une émotion** : douceur, lenteur, désir d'éclat — sans agressivité commerciale.
4. **Déclencher une exploration** : clic sur le CTA primaire `Découvrir le rituel` ou scroll continu.
5. **Capter l'email** en sortie de page, sans dévaluer la marque par une promotion.

### Ce que la page **ne doit pas** faire

1. **Vendre directement.** L'accueil n'est pas une fiche produit. Aucun prix, aucun panier, aucun bouton « Acheter ».
2. **Surcharger.** Maximum 6 sections verticales, jamais plus de 4 éléments parallèles.
3. **Crier.** Pas d'emoji, pas d'urgence, pas de countdown, pas de pop-up modal.
4. **Imiter le e-commerce conventionnel.** Pas de carrousel produit, pas de « Top ventes », pas de bandeau promo.
5. **Distraire.** Pas de chat-bot intrusif, pas d'auto-play vidéo bruyant, pas de notification push.

---

## 2 — Contexte stratégique

### Position dans le parcours utilisateur B2C

```
[ARRIVÉE EXTERNE]                  [PAGE D'ACCUEIL /]                [EXPLORATION]
       │                                    │                              │
   Instagram ────────────────►       Hero éditorial            ────►   /rituel
   Recherche Google                  Manifeste                 ────►   /kit ★
   Bouche à oreille                  Avis clientes             ────►   /journal
   Newsletter                        Journal extraits          ────►   /maison
   Bookmark                                                    ────►   /panier (si revisite)
```

### La règle des 5 secondes

À l'arrivée, la visiteuse doit pouvoir répondre à **trois questions** en moins de 5 secondes :

1. **« Qu'est-ce que c'est ? »** — Une maison de soin pour les ongles.
2. **« Pour qui ? »** — Pour moi (femme, attention à mes mains).
3. **« Pourquoi je continuerais ? »** — Parce que c'est *différent* (rituel, pas vernis).

Si l'une de ces trois réponses n'est pas instantanée, la visiteuse rebondit. Le hero est conçu pour les délivrer en parallèle, pas en séquence.

### Tension stratégique fondamentale

> Le luxe accessible vit dans une tension : **être désirable** sans être inaccessible, **être chaleureux** sans être commercial, **être moderne** sans renier l'artisanat. Chaque section de l'accueil est un arbitrage de cette tension.

### KPIs cibles

| Métrique                                  | Cible                            | Source de mesure              |
| :---------------------------------------- | :------------------------------- | :---------------------------- |
| Bounce rate                               | < 55%                            | GA4 / Plausible               |
| Scroll depth ≥ 50%                        | > 60% des sessions               | Hotjar / Microsoft Clarity    |
| Scroll depth ≥ 90%                        | > 25% des sessions               | Hotjar                        |
| Temps moyen sur la page                   | > 1:30 (90s)                     | GA4                           |
| Click-through rate sur CTA primaire       | > 12%                            | Event tracking                |
| Click-through rate sur CTA secondaire     | > 4%                             | Event tracking                |
| Taux de conversion newsletter             | > 3% des visiteurs               | Mailchimp / Brevo             |
| LCP (Largest Contentful Paint)            | < 2.5s                           | Web Vitals / PageSpeed        |
| CLS (Cumulative Layout Shift)             | < 0.1                            | Web Vitals                    |
| INP (Interaction to Next Paint)           | < 200ms                          | Web Vitals                    |

---

## 3 — Architecture verticale globale

### Vue d'ensemble — desktop ≥ 1280px

```
┌─────────────────────────────────────────────────────────────────────┐
│  [HEADER — sticky · 80px · sauge transparent au scroll]            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  01. HERO ÉDITORIAL                                                 │
│      Vague pétale + sauge                                           │
│      Titre · Tagline · CTA double                                   │
│      Hauteur : 92vh sur desktop, 88vh sur mobile                    │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  02. LES QUATRE GESTES                                              │
│      Quatre cartes parallèles                                       │
│      Étiquettes circulaires (paste · powder · shine · polish)       │
│      Hauteur : 480px (auto sur mobile)                              │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  03. LE MANIFESTE                                                   │
│      Bandeau pleine largeur fond sauge pâle                         │
│      Trois lignes Cormorant Italic                                  │
│      Hauteur : 360px                                                │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  04. AVIS CLIENTES                                                  │
│      Trois témoignages courts                                       │
│      Photos « implied » (mains, détails)                            │
│      Hauteur : 520px                                                │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  05. LE JOURNAL — EXTRAITS                                          │
│      Grille asymétrique (1 grand + 2 petits)                        │
│      Hauteur : 600px                                                │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  06. NEWSLETTER                                                     │
│      Bandeau sauge pâle avant footer                                │
│      Champ email + bouton encre                                     │
│      Hauteur : 280px                                                │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  [FOOTER — encre · 320px · 4 colonnes]                              │
└─────────────────────────────────────────────────────────────────────┘
```

### Hauteur totale approximative

- **Desktop (1440×900)** : ~2700px (3.0 viewports)
- **Tablet (768×1024)** : ~3100px (3.0 viewports)
- **Mobile (390×844)** : ~3400px (4.0 viewports)

### Rythme de lecture intentionnel

| Section          | Densité visuelle | Rythme               | Émotion ciblée            |
| :--------------- | :--------------- | :------------------- | :------------------------ |
| 01. Hero         | Aérée            | Suspension           | Curiosité, désir          |
| 02. 4 gestes     | Structurée       | Compréhension rapide | Confiance, lisibilité     |
| 03. Manifeste    | Très aérée       | Pause éditoriale     | Émotion, identification   |
| 04. Avis         | Moyenne          | Rythme conversationnel | Réassurance, mimétisme  |
| 05. Journal      | Asymétrique      | Curiosité éditoriale | Profondeur, intelligence  |
| 06. Newsletter   | Concentrée       | Décision finale      | Engagement doux           |

> **Principe d'alternance** : une section dense est toujours suivie d'une section aérée. Le scroll devient une respiration. La visiteuse n'a jamais l'impression d'être bombardée.

---

## 4 — Header — élément persistant

### Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  FemiGlow      RITUEL  JOURNAL  KIT  MAISON  PARTENAIRES        [Panier · 1]│
│   ↑              ↑                                                  ↑       │
│   wordmark       menu (5 entrées)                                CTA panier │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Spécifications visuelles

| Propriété              | Valeur                                                       |
| :--------------------- | :----------------------------------------------------------- |
| Hauteur                | 80px (desktop) · 64px (mobile)                               |
| Position               | `sticky` top: 0                                              |
| Fond initial           | `transparent` (au-dessus du hero)                            |
| Fond après scroll      | `rgba(251, 248, 241, 0.92)` (crème) avec `backdrop-filter: blur(12px)` |
| Trigger transition     | `scrollY > 80px`                                             |
| Durée transition       | 240ms · `cubic-bezier(0.4, 0, 0.2, 1)`                       |
| Padding horizontal     | 5% (fluide) ou 80px max                                      |
| Z-index                | 100                                                          |

### Wordmark (gauche)

| Propriété         | Valeur                                                  |
| :---------------- | :------------------------------------------------------ |
| Police            | Pinyon Script Regular                                   |
| Taille            | 28pt (desktop) · 22pt (mobile)                          |
| Couleur           | `#2C2A28` (Encre)                                       |
| Comportement      | Cliquable, retour vers `/`                              |
| Hover             | Aucune transformation — le luxe ne tremble pas          |
| Active            | Cursor `pointer`, focus ring sauge dark 2px             |
| Pas de baseline   | « Maison d'Éclat » uniquement sur la page Maison        |

### Menu (centré)

```
RITUEL    JOURNAL    KIT    MAISON    PARTENAIRES
```

| Propriété         | Valeur                                                              |
| :---------------- | :------------------------------------------------------------------ |
| Police            | Inter Medium                                                        |
| Taille            | 13pt (desktop) · masqué mobile                                      |
| Letter-spacing    | 2.5px (tracking 250)                                                |
| Transformation    | `text-transform: uppercase`                                          |
| Couleur normale   | `#6B6863` (Brume)                                                   |
| Couleur hover     | `#2C2A28` (Encre) — transition 180ms                                 |
| Couleur active    | `#2C2A28` avec underline 1px sauge dark, offset 6px                  |
| Espace entre items| 32px (desktop)                                                       |
| Mobile            | Burger menu (icon 24px stroke 1.5px) — drawer plein écran           |

#### Différenciation B2B

L'item **`PARTENAIRES`** est rendu en `#A8A6A2` (Brume claire) — légèrement plus sourd que les 4 items B2C. C'est un signal subliminal : *« cet endroit existe, mais n'est pas pour vous. »* La pro reconnaît. La cliente ignore.

### CTA panier (droite)

| Propriété         | Valeur                                                            |
| :---------------- | :---------------------------------------------------------------- |
| Forme             | Pill — `border-radius: 999px`                                     |
| Padding           | 10px 20px                                                         |
| Fond              | `#C5DBC4` (Sauge)                                                 |
| Texte             | `#2C2A28` (Encre)                                                 |
| Police            | Inter Medium 13pt                                                 |
| Compteur          | Petit point pétale `#F2CECC` 6px à droite si items > 0            |
| Hover             | Fond `#A8C4A6` (Sauge dark) — transition 180ms                    |
| État vide         | Affiché « Panier » sans nombre — toujours présent                 |
| Active            | Compresse 0.96 scale 100ms                                        |

### Comportement au scroll

```
[scrollY = 0]      → Header transparent, wordmark blanc cassé crème pure
[scrollY > 80]     → Header crème blur, wordmark encre, ombre légère
[scroll up rapide] → Header reste visible (sticky)
[scroll down 200+] → Header se rétracte (slide -100% en 240ms)
[scroll up à nouveau] → Header réapparaît instantanément
```

### Tactiques psychologiques appliquées

| Tactique                                  | Application                                                         |
| :---------------------------------------- | :------------------------------------------------------------------ |
| `KOLENDA · 4 OPTIONS MAX (Gallivan 2011)` | 4 entrées B2C principales — le 5ème (Partenaires) est désaturé.    |
| `KOLENDA · ENTRY POINT FOCAL`              | Wordmark Pinyon = point d'entrée. Aucun autre élément ne le concurrence. |
| `KOLENDA · GROUP SIMILAR ITEMS`            | Le menu est groupé par proximité visuelle, sans séparateurs visuels. |
| `KOLENDA · FRIENDLY COLD`                  | Pas d'emoji panier, pas de « Mon compte 👤 ». Texte sobre.          |
| `KOLENDA · STICKY MOMENTUM`                | Le CTA panier reste accessible — la cliente peut acheter à tout moment. |

---

## 5 — Section 01 — Hero éditorial

### 5.1 — Wireframe complet

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│                                                                            │
│                                                                            │
│                                                                            │
│         Le rituel                       ╱╲╲                                │
│                                       ╱╱╱ ╲                                │
│         d'éclat.                    ╱╱╱╱╲ ╲                                │
│                                  ╱╱╱╱╱╱  ╲╲╲   ← vague pétale               │
│         Quatre gestes.            ╱╱╱     ╲╲╲                              │
│         Une main qui retrouve sa lumière,                                  │
│         sans vernis ni abrasion.                                           │
│                                                                            │
│         ┌────────────────────┐                                             │
│         │ Découvrir le rituel│  → Lire le manifeste                       │
│         └────────────────────┘                                             │
│                                                                            │
│  ╲╲╲╲╲╲                                                                    │
│   ╲╲╲╲                                                                     │
│    ╲╲   ← vague sauge                                                      │
│     ╲                                                                      │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 — Composition visuelle

#### Vagues — élément signature

Les vagues sont **directement issues du carton du packaging réel**. Elles ne sont pas décoratives — elles sont la signature graphique de la maison. Leur présence dans le hero pose immédiatement le code visuel.

##### Vague pétale (haut-droite)

| Propriété          | Valeur                                                        |
| :----------------- | :------------------------------------------------------------ |
| Position           | Haut-droite, occupant 50% de la largeur, 60% de la hauteur    |
| Couleur            | `#F2CECC` (Pétale) — opacité 100%                             |
| Forme              | Courbe organique asymétrique, type Bézier                     |
| Origine            | Coin supérieur droit, descend vers le centre                  |
| Animation entrée   | `clip-path` reveal 1.2s · `ease-out` · délai 200ms            |
| Animation parallaxe| `translateY(scrollY × 0.15)` — léger décalage au scroll       |
| Z-index            | 0 (fond)                                                      |

##### Vague sauge (bas-gauche)

| Propriété          | Valeur                                                        |
| :----------------- | :------------------------------------------------------------ |
| Position           | Bas-gauche, occupant 35% de la largeur, 45% de la hauteur     |
| Couleur            | `#C5DBC4` (Sauge) — opacité 100%                              |
| Forme              | Courbe miroir de la vague pétale, plus discrète                |
| Animation entrée   | `clip-path` reveal 1.0s · `ease-out` · délai 400ms            |
| Animation parallaxe| `translateY(scrollY × -0.10)` — sens opposé à la pétale       |
| Z-index            | 0 (fond)                                                      |

#### Fond du hero

| Propriété     | Valeur                                                |
| :------------ | :---------------------------------------------------- |
| Couleur       | `#FBF8F1` (Crème) — base                              |
| Texture       | Aucune — l'aplat est la signature                     |
| Hauteur       | `92vh` desktop · `88vh` mobile (laisse deviner section suivante) |

> **Pourquoi laisser 8% de la section suivante visible ?** Pour suggérer le scroll. Une visiteuse qui voit le bord d'une section suivante comprend qu'il y a *plus* — sans qu'on doive lui dire. C'est l'application du principe de **continuité gestaltique**.

### 5.3 — Copy — texte exact

#### Titre principal

```
Le rituel
d'éclat.
```

| Propriété       | Valeur                                                        |
| :-------------- | :------------------------------------------------------------ |
| Police          | Cormorant Garamond Light                                      |
| Taille          | 96pt (desktop) · 64pt (tablet) · 48pt (mobile)                |
| Line-height     | 1.0 (serré, signature éditoriale)                             |
| Letter-spacing  | -1.5px (legère condensation)                                  |
| Couleur         | `#2C2A28` (Encre)                                             |
| Disposition     | Deux lignes — coupure intentionnelle                          |
| Position        | Aligné à gauche, padding-left 96px desktop, 24px mobile       |

##### Pourquoi cette coupure ?

La coupure entre `Le rituel` et `d'éclat.` n'est pas un accident typographique. Elle ralentit la lecture, accentue le mot **éclat** comme révélation. C'est exactement la même mécanique que les coupures de vers en poésie — la pause crée le sens.

> **Variante explicite** :
> *« Le rituel d'éclat. »* (sur une ligne) → lecture rapide, claim direct.
> *« Le rituel / d'éclat. »* (deux lignes) → lecture lente, claim méditatif. **Cette version est retenue.**

#### Sous-tagline

```
Quatre gestes.
Une main qui retrouve sa lumière,
sans vernis ni abrasion.
```

| Propriété       | Valeur                                                        |
| :-------------- | :------------------------------------------------------------ |
| Police          | Cormorant Garamond Light Italic                               |
| Taille          | 22pt (desktop) · 18pt (tablet) · 16pt (mobile)                |
| Line-height     | 1.5                                                           |
| Couleur         | `#4A4844` (Encre claire)                                      |
| Disposition     | Trois lignes — décompose la promesse en trois temps            |
| Espacement haut | 32px (desktop) sous le titre principal                        |

##### Décomposition stratégique de la sous-tagline

| Ligne                                       | Fonction stratégique                                              |
| :------------------------------------------ | :---------------------------------------------------------------- |
| **« Quatre gestes. »**                      | Promesse de simplicité — calme l'objection « c'est compliqué ».   |
| **« Une main qui retrouve sa lumière, »**   | Bénéfice émotionnel + indirect claim (*sa* lumière, pas *une*).   |
| **« sans vernis ni abrasion. »**            | Différenciateur — répond à l'objection silencieuse comparative.   |

#### CTA primaire

```
Découvrir le rituel
```

| Propriété          | Valeur                                                                |
| :----------------- | :-------------------------------------------------------------------- |
| Police             | Inter Medium                                                          |
| Taille             | 14pt                                                                  |
| Letter-spacing     | 0.5px                                                                 |
| Texte              | `#FBF8F1` (Crème pure)                                                |
| Fond               | `#2C2A28` (Encre)                                                     |
| Padding            | 18px 36px                                                             |
| Border-radius      | 0 (carré — distinction du CTA panier qui est pill)                    |
| Hover              | Fond `#4A4844`, légère élévation `box-shadow: 0 4px 16px rgba(44,42,40,0.12)`, transition 220ms |
| Active             | Scale 0.97, transition 100ms                                          |
| Focus              | Ring 2px sauge dark, offset 4px                                       |
| Action             | Navigation vers `/rituel`                                             |
| Espacement haut    | 56px sous la sous-tagline (respiration)                               |

#### CTA secondaire

```
Lire le manifeste →
```

| Propriété          | Valeur                                                            |
| :----------------- | :---------------------------------------------------------------- |
| Police             | Inter Medium 14pt                                                 |
| Couleur            | `#6B6863` (Brume)                                                 |
| Décoration         | Pas de soulignement par défaut · soulignement au hover            |
| Position           | À droite du CTA primaire, espacement 32px                         |
| Flèche             | Caractère unicode `→` U+2192 — pas un SVG                          |
| Animation flèche   | Au hover, `transform: translateX(4px)` 200ms                      |
| Action             | Scroll smooth jusqu'à la section 03 (Manifeste)                   |

##### Pourquoi un CTA double ?

| Profil de visiteuse           | Chemin emprunté                       | Page cible        |
| :---------------------------- | :------------------------------------ | :---------------- |
| **Émotionnelle / impulsive**  | CTA primaire `Découvrir le rituel`    | `/rituel`         |
| **Rationnelle / sceptique**   | CTA secondaire `Lire le manifeste`    | Scroll vers § 03  |
| **Curieuse non-conversionnelle** | Scroll naturel sans clic            | Section suivante  |

Le CTA double crée un **funnel à deux paths** sans fragmenter la page. Personne n'est laissé sans option.

### 5.4 — Tokens design — récapitulatif

```css
/* ─── Hero — tokens ─── */
--hero-bg: #FBF8F1;              /* Crème */
--hero-wave-petal: #F2CECC;      /* Pétale */
--hero-wave-sage: #C5DBC4;       /* Sauge */
--hero-title-color: #2C2A28;     /* Encre */
--hero-tagline-color: #4A4844;   /* Encre claire */
--hero-cta-bg: #2C2A28;          /* Encre */
--hero-cta-text: #FBF8F1;        /* Crème pure */
--hero-cta2-text: #6B6863;       /* Brume */

--hero-title-font: 'Pinyon Script', 'Cormorant Garamond', serif;
--hero-title-size-desktop: 96pt;
--hero-title-size-mobile: 48pt;
--hero-title-line-height: 1.0;

--hero-padding-x-desktop: 96px;
--hero-padding-x-mobile: 24px;
--hero-height-desktop: 92vh;
--hero-height-mobile: 88vh;
```

### 5.5 — Comportements UX

#### Animations d'entrée

```
[t=0ms]     → Page chargée, fond crème visible
[t=100ms]   → Vague pétale entre par clip-path (1200ms ease-out)
[t=300ms]   → Vague sauge entre par clip-path (1000ms ease-out)
[t=500ms]   → Titre `Le rituel d'éclat.` fade-in + translate-up 16px (800ms)
[t=900ms]   → Sous-tagline fade-in (600ms)
[t=1200ms]  → CTA double fade-in (400ms)
[t=1500ms]  → Animations terminées, page interactive
```

> **Règle d'or** : pas d'animation après 1500ms. Au-delà, c'est de la friction.

#### Comportement au scroll dans le hero

```
[0% scrolled]    → État initial
[10% scrolled]   → Vague pétale parallaxe descend de 12px
[10% scrolled]   → Vague sauge parallaxe monte de 8px
[20% scrolled]   → Header passe en mode crème blur
[30% scrolled]   → Hero quitte le viewport, section 02 prend le relais
```

#### Interactions souris

| Élément                        | Interaction                                          |
| :----------------------------- | :--------------------------------------------------- |
| Survol vague pétale            | Aucune (élément décoratif, pas interactif)           |
| Survol titre                   | Aucune (pas un lien)                                 |
| Survol CTA primaire            | Fond plus clair + élévation                          |
| Survol CTA secondaire          | Soulignement + flèche translate                      |
| Click extérieur sur la zone hero | Aucune action (pas de capture parasite)            |

### 5.6 — Psychologie & neuromarketing

#### Tactique 1 — Indirect claims (McQuarrie & Phillips, 2005)

> *« Direct claims are explicit. Indirect claims require interpretation. We infer meaning. And that's key. By making an inference, WE generate the meaning. WE become the source. So your brain places more trust in the information. »*
> — Nick Kolenda, *The Psychology of Copywriting*

**Application** : *« Le rituel d'éclat »* est une métaphore. Le cerveau de la lectrice doit décoder : qu'est-ce qu'un *rituel* ? qu'est-ce que l'*éclat* ? Cette inférence active fait que la promesse est **construite par la lectrice**, pas reçue passivement. Elle devient sa propriétaire. La confiance est intrinsèque.

**Comparaison directe vs. indirecte** :

| Direct (à éviter)                              | Indirect (retenu)                          |
| :--------------------------------------------- | :----------------------------------------- |
| « Le meilleur soin pour ongles abîmés »        | « Le rituel d'éclat. »                     |
| « Ongles brillants en 4 minutes »              | « Quatre gestes. »                         |
| « Sans produits chimiques nocifs »             | « sans vernis ni abrasion. »               |

#### Tactique 2 — Hook before solution

> *« Once you hook them in, THEN reveal your solution. »*

**Application** : la sous-tagline ne dit pas *quoi acheter*. Elle dit *à quoi ça ressemble*. La solution (le kit) n'apparaît qu'à la section 02 (les gestes) puis vraiment qu'à la page `/kit`. Le hero crée le désir, pas la transaction.

#### Tactique 3 — Dual path funnel

| Personality type      | Trigger          | Cognitive load           |
| :-------------------- | :--------------- | :----------------------- |
| Hot decision-maker    | CTA primaire     | Faible (action immédiate) |
| Cold decision-maker   | CTA secondaire   | Faible (exploration)     |
| Window-shopper        | Scroll naturel   | Aucun (pas d'engagement) |

Aucune visiteuse n'est laissée sans une voie qui lui correspond.

#### Tactique 4 — Empty space (Sevilla & Townsend, 2016)

> *« Online products seem more expensive when surrounded by more padding, even though this space doesn't cost anything. »*

**Application** : le hero occupe **92vh**. Le titre prend 30% de cette hauteur. Le reste est vide (avec les vagues comme respiration colorée). Cette quantité de vide est ce qui distingue *femiglow.ma* de *amazon.fr/ongles*. Le luxe est ce que la marque **refuse de poser** dans cet espace.

**Étude citée** : Sevilla, J., & Townsend, C. (2016). *The space-to-product ratio effect*. JCR. **+23% de premium perçu** avec un padding doublé.

#### Tactique 5 — Z-pattern eye flow (visual attention)

```
[1] WORDMARK ──→──→──→──→──→──→ [2] PANIER
       ╲                            ╱
        ╲                          ╱
         ╲                        ╱
          ╲                      ╱
           ↓                    ↓
[3] LE RITUEL ──→──→──→──→──→──→──→──→──→──→ (regard descend en diagonale)
            ╲                             
             ╲                            
              ↓                           
        [4] CTA primaire « Découvrir le rituel »
```

L'œil parcourt le hero en Z, pas en F. Pourquoi ? Parce que c'est une page **graphique**, pas text-heavy. La structure des éléments dirige l'œil : titre en haut-gauche → tagline → CTA en bas-gauche, juste où le regard atterrit naturellement.

#### Tactique 6 — Verb of opening

> Le verbe **« Découvrir »** appartient à la famille des verbes d'ouverture (à découvrir, à explorer, à révéler). Il s'oppose aux verbes de transaction (acheter, commander, réserver).

| Verbe              | Famille       | Effet psychologique                            |
| :----------------- | :------------ | :--------------------------------------------- |
| **Découvrir**      | Ouverture     | Curiosité, exploration, faible engagement     |
| Explorer           | Ouverture     | Idem                                           |
| Acheter            | Transaction   | Engagement immédiat, friction élevée           |
| Commander          | Transaction   | Idem                                           |
| Recevoir           | Réception     | Engagement modéré, sensation de cadeau         |

Le CTA primaire utilise un verbe d'ouverture car la visiteuse n'est pas prête à acheter. La fiche produit `/kit` utilisera **« Recevoir »** — verbe de réception — qui est l'étape suivante.

#### Tactique 7 — Friendly cold (Park, Im & Kim, 2020)

> *« You are too friendly! »* — Étude sur le luxe : un ton trop amical *réduit* la valeur perçue.

**Application** : le hero ne dit pas *« Bienvenue ! »*, ne dit pas *« Salut ! »*, n'utilise aucune émoticône, aucun point d'exclamation. La tonalité est **professionnelle et chaleureuse** — pas familière. La maison vous accueille, mais elle ne vous tape pas dans le dos.

### 5.7 — Émotion à provoquer

| Étape       | Émotion                                                          |
| :---------- | :--------------------------------------------------------------- |
| Arrivée     | **Surprise** — *« Ce n'est pas un site de vernis. »*             |
| 2 secondes  | **Curiosité** — *« C'est quoi un rituel d'éclat ? »*             |
| 3 secondes  | **Apaisement** — *« C'est doux, c'est calme. »*                  |
| 5 secondes  | **Désir** — *« Je veux savoir comment. »*                        |
| 7 secondes  | **Action** — Click sur CTA OU scroll vers section suivante       |

### 5.8 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| Vidéo auto-play en background du hero               | Bruite le silence éditorial, distrait du titre                     |
| « Bienvenue chez FemiGlow ! » comme titre            | Cliché, faible, transactionnel                                     |
| Bouton « Acheter maintenant »                       | Trop direct pour le funnel TOFU                                     |
| Carrousel produit                                   | Ce n'est pas un e-commerce conventionnel                           |
| Pop-up newsletter à l'arrivée                       | Brutal, casse l'émotion, dévalue la marque                         |
| Témoignages dans le hero                            | Réservés à la section 04 — la preuve ne vient pas avant la promesse |
| Animation excessive (>3 éléments simultanés)        | Bruit visuel, confusion, baisse de conversion                      |
| Police titre en gras                                | Cormorant **Light** — le luxe est fin, pas épais                   |

---

## 6 — Section 02 — Les quatre gestes

### 6.1 — Wireframe

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│                  Quatre minutes. Quatre gestes.                            │
│                  Le rituel se transmet, jamais ne se complique.            │
│                                                                            │
│                                                                            │
│   ╔═════════╗     ╔═════════╗     ╔═════════╗     ╔═════════╗              │
│   ║   ╭─╮   ║     ║   ╭─╮   ║     ║   ╭─╮   ║     ║   ╭─╮   ║              │
│   ║  │ 1 │  ║     ║  │ 2 │  ║     ║  │ 3 │  ║     ║  │ 4 │  ║              │
│   ║   ╰─╯   ║     ║   ╰─╯   ║     ║   ╰─╯   ║     ║   ╰─╯   ║              │
│   ║  paste  ║     ║ powder  ║     ║  shine  ║     ║ polish  ║              │
│   ║FemiGlow ║     ║FemiGlow ║     ║FemiGlow ║     ║FemiGlow ║              │
│   ╚═════════╝     ╚═════════╝     ╚═════════╝     ╚═════════╝              │
│   Préparer.       Lisser.         Polir.          Révéler.                 │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 — Composition

#### Surtitre (kicker)

```
LE RITUEL EN QUATRE TEMPS
```

| Propriété      | Valeur                                  |
| :------------- | :-------------------------------------- |
| Police         | Inter SemiBold                          |
| Taille         | 7.5pt                                   |
| Letter-spacing | 2.5px (tracking 250)                    |
| Couleur        | `#C8A876` (Champagne) — usage rare      |
| Transformation | uppercase                               |
| Position       | Centré, 96px du haut de la section      |

#### Titre de section

```
Quatre minutes.
Quatre gestes.
Le rituel se transmet, jamais ne se complique.
```

| Propriété      | Valeur                                                    |
| :------------- | :-------------------------------------------------------- |
| Police         | Cormorant Garamond Light                                  |
| Taille         | 32pt (desktop) · 26pt (tablet) · 22pt (mobile)           |
| Line-height    | 1.3                                                       |
| Couleur        | `#2C2A28` (Encre)                                         |
| Position       | Centré                                                    |

#### Les quatre cartes

##### Disposition

| Breakpoint | Layout                                                      |
| :--------- | :---------------------------------------------------------- |
| Desktop    | 4 cartes côte à côte, gap 24px, max-width container 1080px  |
| Tablet     | 4 cartes côte à côte, gap 16px, padding latéral 32px        |
| Mobile     | 2 × 2 (grille), gap 16px, padding latéral 24px              |

##### Spécifications de chaque carte

| Propriété          | Valeur                                                            |
| :----------------- | :---------------------------------------------------------------- |
| Largeur            | ~240px desktop · auto sur mobile                                  |
| Hauteur            | 220px (uniforme)                                                  |
| Fond               | `#FFFFFF` (Crème pure)                                            |
| Border             | 1px solid `#E8E0D2` (Ligne)                                       |
| Border-radius      | 0 (carré, fidèle au packaging)                                     |
| Padding            | 32px 24px                                                         |
| Alignement         | Texte centré, étiquette circulaire centrée verticalement          |

##### Étiquette circulaire (au centre de la carte)

| Propriété         | Valeur                                                       |
| :---------------- | :----------------------------------------------------------- |
| Forme             | Cercle parfait                                               |
| Diamètre          | 96px                                                         |
| Couleurs          | Carte 1 : `#C5DBC4` Sauge / Carte 2 : `#F2CECC` Pétale / Carte 3 : `#FBF8F1` Crème / Carte 4 : `#C5DBE5` Ciel |
| Numéro            | Cormorant Garamond Regular 28pt, couleur `#2C2A28` Encre, centré |
| Mot italique      | Cormorant Garamond Italic 11pt, couleur Encre, sous le numéro |
| Wordmark sous     | Pinyon Script 8pt « FemiGlow », `#6B6863` Brume               |

##### Verbe d'action (sous l'étiquette)

| Étape | Verbe       | Police                  | Couleur          |
| :---- | :---------- | :---------------------- | :--------------- |
| 1     | Préparer.   | Cormorant Light 16pt    | Encre `#2C2A28`  |
| 2     | Lisser.     | Cormorant Light 16pt    | Encre `#2C2A28`  |
| 3     | Polir.      | Cormorant Light 16pt    | Encre `#2C2A28`  |
| 4     | Révéler.    | Cormorant Light 16pt    | Encre `#2C2A28`  |

> **Pourquoi le 4ème verbe est « Révéler » ?** Parce que c'est le climax narratif. Le rituel ne *finit* pas — il *révèle*. C'est une promesse, pas une étape.

### 6.3 — Interactions

#### Hover sur une carte

```
[état initial]    → Étiquette circulaire colorée, verbe en bas
[hover 200ms]     → Carte translate-y -4px, ombre subtile apparaît
[hover 400ms]     → Phrase descriptive fade-in sous le verbe (1 ligne max)
[mouse leave]     → Inversion fluide, retour à l'état initial 240ms
```

#### Phrases descriptives au hover (1 ligne par geste)

| Étape | Phrase au hover                                  |
| :---- | :----------------------------------------------- |
| 1     | *« Une pâte qui prépare la surface. »*           |
| 2     | *« Une poudre qui lisse les irrégularités. »*    |
| 3     | *« Le geste qui éveille la matière. »*           |
| 4     | *« Le voile final, brillance révélée. »*         |

#### Comportement mobile

Sur mobile, pas de hover possible. Les phrases descriptives sont **toujours visibles** sous chaque verbe, en Inter Regular 11pt brume.

### 6.4 — Tokens design

```css
/* ─── Section 4 gestes — tokens ─── */
--gestes-bg: #FBF8F1;
--gestes-card-bg: #FFFFFF;
--gestes-card-border: #E8E0D2;
--gestes-card-padding: 32px 24px;

--label-1-bg: #C5DBC4;  /* Sauge — paste */
--label-2-bg: #F2CECC;  /* Pétale — powder */
--label-3-bg: #FBF8F1;  /* Crème — shine */
--label-4-bg: #C5DBE5;  /* Ciel — polish */

--label-size: 96px;
--label-number-size: 28pt;
--label-word-size: 11pt;
--label-wordmark-size: 8pt;
```

### 6.5 — Psychologie

#### Parallel individuation (Gallivan et al., 2011)

> *« Humans possess this ability up to 4 items, but it collapses with 5 items. Therefore, choices feel difficult with 5+ options. »*

**Application** : exactement 4 gestes. Pas 3 (insuffisant pour structurer un rituel). Pas 5 (le cerveau passe en mode comptage). Les 4 cartes sont **perçues comme un tout instantanément**, sans effort cognitif. C'est la traduction visuelle exacte de la promesse *« Quatre gestes. »*

#### Visual sequence — gauche-droite, brightness ascending

> Huang et al. (2022) : *« Customers prefer products arranged in ascending visual sequences (e.g., from dull to bright). »*

**Application** : la séquence chromatique des étiquettes va de **Sauge** (le plus saturé, début du rituel) à **Pétale**, puis **Crème** (le plus pâle, transition), puis **Ciel** (revival léger). Le geste 4 « Révéler » utilise le ciel — sensation de lumière retrouvée. La progression chromatique mime la progression du soin.

#### Fidélité au packaging réel

Les étiquettes circulaires reproduisent **exactement** la maquette du carton physique. Cette continuité est fondamentale : la cliente qui voit le kit IRL après l'avoir vu en ligne reconnaît immédiatement. **Aucune dissonance entre le digital et le physique.**

### 6.6 — Émotion

| Avant la section | Pendant | Après |
| :--------------- | :------ | :---- |
| Curiosité (« c'est quoi ? ») | Compréhension (« 4 étapes simples ») | Confiance (« je peux le faire ») |

### 6.7 — Erreurs à éviter

- **Ajouter une 5ème étape** — détruit la parallel individuation.
- **Utiliser des photos réelles dans les cartes** — concurrence l'étiquette circulaire signature.
- **Animer les cartes en boucle** — devient hypnotique et distrait.
- **Pluraliser ou dramatiser les verbes** (« Préparation intense ! ») — casse la sobriété.
- **Numéroter en chiffres arabes seuls (1, 2, 3, 4)** — trop banal. La présence du mot italique (`paste`, `powder`...) sous le chiffre est ce qui distingue.

---

## 7 — Section 03 — Le manifeste

### 7.1 — Wireframe

```
┌════════════════════════════════════════════════════════════════════════════┐
║                                                                            ║
║                                                                            ║
║                                                                            ║
║                                ╱──╲                                        ║
║                               ╱ ◆ ╲    ← fleuron champagne                 ║
║                                ╲╱                                          ║
║                                                                            ║
║                                                                            ║
║         Pas une marque. Une maison.                                        ║
║         Pas un produit. Un rituel.                                         ║
║         Pas une cliente. Une initiée.                                      ║
║                                                                            ║
║                                                                            ║
║                                                                            ║
└════════════════════════════════════════════════════════════════════════════┘
                            (fond sauge pâle pleine largeur)
```

### 7.2 — Composition

#### Fond

| Propriété     | Valeur                                  |
| :------------ | :-------------------------------------- |
| Couleur       | `#E8EFE7` (Sauge pâle)                  |
| Largeur       | 100% (déborde du container max-width)   |
| Hauteur       | 360px (desktop) · 320px (tablet) · 280px (mobile) |
| Padding vertical | 96px                                |

#### Fleuron (au-dessus du texte)

| Propriété       | Valeur                                                        |
| :-------------- | :------------------------------------------------------------ |
| Forme           | Losange champagne entre deux filets fins                      |
| Couleur         | `#C8A876` (Champagne)                                         |
| Taille          | Largeur ~80px, hauteur ~12px                                  |
| Position        | Centré, 32px au-dessus du texte                               |
| Stroke          | 0.6px                                                          |

> **Pourquoi un fleuron ici ?** Parce que cette section est une **pause éditoriale**. Le fleuron signale *« ce qui suit n'est pas une information utilitaire, c'est une déclaration. »* C'est le code typographique des manifestes du XIXe — Aragon, Breton, les surréalistes utilisaient le fleuron pour marquer le passage du discours à la profession de foi.

#### Texte du manifeste

```
Pas une marque. Une maison.
Pas un produit. Un rituel.
Pas une cliente. Une initiée.
```

| Propriété      | Valeur                                                         |
| :------------- | :------------------------------------------------------------- |
| Police         | Cormorant Garamond Light Italic                                |
| Taille         | 28pt (desktop) · 22pt (tablet) · 18pt (mobile)                 |
| Line-height    | 1.6 (généreux, contemplatif)                                   |
| Letter-spacing | 0 (laisser la police respirer naturellement)                   |
| Couleur        | `#2C2A28` (Encre)                                              |
| Alignement     | Centré                                                         |
| Disposition    | 3 lignes, séparées par 12px (line-height suffisant)            |

#### Aucun CTA, aucun lien, aucun bouton

C'est volontaire. Cette section n'invite à rien. Elle énonce. La visiteuse la lit, l'absorbe, et continue son scroll. **Le silence après ces trois lignes est le moment le plus précieux de la page.**

### 7.3 — Tokens design

```css
/* ─── Section Manifeste — tokens ─── */
--manifesto-bg: #E8EFE7;
--manifesto-text-color: #2C2A28;
--manifesto-fleuron-color: #C8A876;

--manifesto-font: 'Cormorant Garamond', serif;
--manifesto-style: italic;
--manifesto-weight: 300; /* Light */
--manifesto-size-desktop: 28pt;
--manifesto-line-height: 1.6;

--manifesto-padding-vertical: 96px;
--manifesto-fleuron-margin-bottom: 32px;
```

### 7.4 — Psychologie

#### Indirect claim — par négation

La structure *« Pas X. Y. »* est l'une des plus puissantes constructions rhétoriques. Elle :

1. **Reconnaît** la catégorie habituelle (X) — donc parle au cerveau du lecteur dans son langage initial.
2. **Refuse** cette catégorie — crée une rupture cognitive.
3. **Propose** une catégorie supérieure (Y) — résolution de la tension.

| Phrase                              | X (refusé)  | Y (proposé)  | Effet                          |
| :---------------------------------- | :---------- | :----------- | :----------------------------- |
| Pas une marque. Une maison.         | marque      | maison       | Familial > commercial          |
| Pas un produit. Un rituel.          | produit     | rituel       | Culturel > transactionnel      |
| Pas une cliente. Une initiée.       | cliente     | initiée      | Statut > rôle                  |

Chaque ligne fait passer la lectrice d'un cadre marchand à un cadre **anthropologique**. Elle n'est plus dans une transaction — elle est dans une appartenance.

#### Empty space (Sevilla & Townsend, 2016)

Le manifeste fait 3 lignes de texte. Le bandeau fait 360px de haut. Le rapport texte/espace est d'environ **15% de texte / 85% d'espace vide**. C'est dramatiquement aéré. C'est exactement ce qui crée la sensation de luxe.

#### Color psychology — sauge pâle

Le fond `#E8EFE7` (Sauge pâle, 30% de saturation par rapport au sauge dominant) est :

- **Suffisamment distinct** du crème de fond pour signaler une rupture éditoriale.
- **Suffisamment doux** pour ne pas crier — c'est une *respiration*, pas une *interruption*.
- **Cohérent** avec la palette signature — pas une couleur d'emprunt.

### 7.5 — Émotion

> Cette section doit créer un **moment d'arrêt**. La visiteuse, qui scrolle peut-être en automatique, doit ralentir. Lire. Hocher imperceptiblement la tête. Et ressentir une **identification** : *« oui, je suis ce genre de personne qui veut un rituel et pas un produit. »*

C'est la section qui **convertit le visiteur en croyant**. Pas en client — en croyant. Le client viendra plus tard.

### 7.6 — Erreurs à éviter

| Erreur                                       | Pourquoi c'est faux                                       |
| :------------------------------------------- | :-------------------------------------------------------- |
| Ajouter un CTA « Découvrir nos valeurs »     | Le manifeste n'invite à rien. C'est sa force.             |
| Mettre le manifeste en gras                  | Cormorant Light Italic, jamais bold. La fragilité = force. |
| Centrer le fleuron sous le texte             | Il vient AVANT — il ouvre, ne referme pas.                |
| Réduire le padding vertical                  | L'espace vide EST le manifeste autant que les mots.       |
| Ajouter une 4ème ligne                       | La trinité est un format sacré. 4 = liste, 3 = manifeste. |

---

## 8 — Section 04 — Avis clientes

### 8.1 — Wireframe

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│                  ELLES ONT ESSAYÉ LE RITUEL                                │
│                                                                            │
│                                                                            │
│  ┌──────────┐         ┌──────────┐         ┌──────────┐                   │
│  │          │         │          │         │          │                    │
│  │  [main   │         │  [pot    │         │  [table  │                    │
│  │   tenant │         │   et     │         │   marbre │                    │
│  │   pot]   │         │   tasse] │         │   crème] │                    │
│  └──────────┘         └──────────┘         └──────────┘                    │
│                                                                            │
│  « Mes ongles n'avaient    « Le geste m'a appris    « Je n'aurais jamais  │
│  pas eu cette lumière      la patience que je       cru qu'un soin        │
│  depuis des années. »      n'avais plus. »          puisse devenir        │
│                                                     un moment à moi. »    │
│                                                                            │
│  Salma, Casablanca         Khadija, Rabat           Yasmine, Marrakech    │
│  initiée depuis avril 2026 initiée depuis mars 2026 initiée depuis fév 2026│
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 — Composition

#### Surtitre

```
ELLES ONT ESSAYÉ LE RITUEL
```

| Propriété      | Valeur                                  |
| :------------- | :-------------------------------------- |
| Police         | Inter SemiBold 7.5pt                    |
| Letter-spacing | 2.5px                                   |
| Couleur        | `#C8A876` (Champagne)                   |
| Position       | Centré                                  |

#### Trois cartes témoignages

##### Disposition

| Breakpoint | Layout                                                  |
| :--------- | :------------------------------------------------------ |
| Desktop    | 3 cartes côte à côte, gap 32px                          |
| Tablet     | 3 cartes côte à côte, gap 20px                          |
| Mobile     | Carrousel horizontal swipe, 1 carte visible + aperçu     |

##### Composition d'une carte

```
┌──────────────────────────────────┐
│                                  │
│    ┌──────────────────────┐      │
│    │                      │      │
│    │     [PHOTO MAINS]    │      │
│    │     ratio 4:3        │      │
│    │                      │      │
│    └──────────────────────┘      │
│                                  │
│    « Citation italique. »        │
│    Cormorant 18pt italic         │
│                                  │
│    Prénom, Ville                 │
│    initiée depuis [date]         │
│                                  │
└──────────────────────────────────┘
```

#### Photo — le détail crucial

| Propriété         | Valeur                                                                    |
| :---------------- | :------------------------------------------------------------------------ |
| Ratio             | 4:3 (portrait paysage)                                                    |
| Sujet             | **Mains tenant un objet** ou **détail de la table de soin** — JAMAIS un visage |
| Composition       | Naturelle, peu apprêtée, lumière naturelle douce                          |
| Tonalité          | Calibrage chaud, ombres terreuses, hautes lumières crème                  |
| Filter            | Aucun filtre Instagram visible — esthétique éditoriale, pas réseaux sociaux |
| Format            | WebP, optimisé, lazy-loaded                                               |
| Border-radius     | 0 (carré, comme tout dans la maison)                                       |

##### Pourquoi pas de visage ?

> **Lu, Z. Y., Jung, S., & Peck, J. (2023). *It Looks Like "Theirs"***. Étude sur 10k+ photos Instagram : les destinations touristiques avec une personne dans la photo reçoivent **moins** de likes et génèrent **moins** de ventes que les mêmes destinations sans personne.

Le visage humain est un **distracteur** :

1. **Lack of ownership** — le visage signale *« cette expérience est la sienne, pas la mienne ».*
2. **Distracts from products** — les yeux fixent le visage, pas le produit (Kalkstein 2020).
3. **Contamination** — le produit semble *touché* par quelqu'un d'autre (Argo 2006).

**MAIS** : selon Hassanein & Head (2005), pour les produits beauté, la présence humaine **peut** booster la conversion *si elle convey la qualité*. La solution Kolenda : **imply human presence**, ne pas la **show** directement.

D'où le choix : **mains qui touchent un pot, ombre d'une silhouette, table de soin avec une tasse encore tiède**. La présence humaine est *suggérée* sans concurrencer le produit.

#### Citation

| Propriété      | Valeur                                                          |
| :------------- | :-------------------------------------------------------------- |
| Police         | Cormorant Garamond Light Italic                                  |
| Taille         | 18pt                                                            |
| Line-height    | 1.5                                                             |
| Couleur        | `#2C2A28` (Encre)                                               |
| Guillemets     | Français typographiques `« »` avec espaces insécables            |
| Longueur       | 12 à 25 mots maximum                                             |

#### Signature

| Élément                | Style                                                 |
| :--------------------- | :---------------------------------------------------- |
| Prénom + Ville         | Inter Medium 12pt, couleur Encre                      |
| « initiée depuis [mois année] » | Inter Regular 10pt italic, couleur Brume `#6B6863` |

> **Pourquoi pas de note 5/5 étoiles ?** Parce que les étoiles sont le code des plateformes (TripAdvisor, Amazon). FemiGlow n'est pas une plateforme. La mention *« initiée depuis avril 2026 »* est plus puissante : elle implique **une trajectoire**, pas une **évaluation**.

### 8.3 — Tokens design

```css
/* ─── Section Avis — tokens ─── */
--avis-bg: #FBF8F1;
--avis-card-gap-desktop: 32px;
--avis-card-gap-mobile: 16px;

--avis-quote-font: 'Cormorant Garamond', serif;
--avis-quote-style: italic;
--avis-quote-weight: 300;
--avis-quote-size: 18pt;
--avis-quote-line-height: 1.5;

--avis-signature-font: 'Inter', sans-serif;
--avis-signature-name-weight: 500;
--avis-signature-date-weight: 400;
--avis-signature-date-style: italic;
--avis-signature-date-color: #6B6863;
```

### 8.4 — Trois citations — texte exact

| # | Citation                                                                | Prénom    | Ville       | Initiée depuis  |
| :- | :--------------------------------------------------------------------- | :-------- | :---------- | :-------------- |
| 1 | *« Mes ongles n'avaient pas eu cette lumière depuis des années. »*     | Salma     | Casablanca  | avril 2026      |
| 2 | *« Le geste m'a appris la patience que je n'avais plus. »*              | Khadija   | Rabat       | mars 2026       |
| 3 | *« Je n'aurais jamais cru qu'un soin puisse devenir un moment à moi. »* | Yasmine   | Marrakech   | février 2026    |

#### Critères d'écriture des citations

1. **Personnelle**, pas marketing — la cliente parle de son expérience, pas du produit.
2. **Sensorielle ou émotionnelle**, pas fonctionnelle — *« lumière »*, *« patience »*, *« moment à moi »*.
3. **12 à 25 mots** — assez court pour être lu, assez long pour être incarné.
4. **Sans superlatif** — pas de *« incroyable »*, *« génial »*, *« le meilleur »*.
5. **Avec un détail concret** — *« des années »*, *« le geste »*, *« un moment »*.

### 8.5 — Psychologie

#### Imply human presence (Poirier et al., 2024)

> *« Imply the presence of a human. Nearby Traces. A blender next to sliced fruit. »*

L'application FemiGlow : *« Mains tenant le pot, table avec tasse encore tiède, livre ouvert à côté. »* La présence humaine est partout — sans visage.

#### Mirror effect (mimétisme cognitif)

Les trois prénoms (Salma, Khadija, Yasmine) sont **typiquement marocains**. Les villes (Casa, Rabat, Marrakech) sont les hubs urbains. La cible (femme 28-45 marocaine urbaine) **se reconnaît immédiatement** dans l'une des trois. Effet miroir : *« si Salma de Casa l'a fait, je peux le faire. »*

#### Authenticity > rating

Une note 4.8/5 sur 247 avis dit : *« beaucoup de gens ont validé. »*
Une mention *« initiée depuis avril 2026 »* dit : *« cette personne fait partie d'une lignée. »*

Le second est rare. Le second est mémorable. Le second est le luxe.

### 8.6 — Émotion

| Avant | Pendant | Après |
| :---- | :------ | :---- |
| Désir naissant | Identification (mimétisme) | Confiance (« d'autres l'ont fait, sans regret ») |

### 8.7 — Erreurs à éviter

- Photos de visages (raison expliquée plus haut).
- Étoiles 5/5 — code de plateforme, dévalue la marque.
- Citations trop longues (>30 mots) — l'œil décroche.
- Citations marketing (*« j'ai adoré ! »*) — perçues comme fausses.
- Plus de 3 témoignages — au-delà de 3, l'œil saute, la confiance baisse paradoxalement.
- Pas d'accent local marocain — la cliente cherche des modèles locaux, pas génériques.

---

## 9 — Section 05 — Le Journal · extraits

### 9.1 — Wireframe

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│  LE JOURNAL DE LA MAISON                                                   │
│                                                                            │
│  ┌──────────────────────────────────┐  ┌──────────────────────┐            │
│  │                                  │  │                      │            │
│  │                                  │  │   [photo lifestyle]  │            │
│  │   [grande photo lifestyle]       │  │                      │            │
│  │                                  │  │  Pourquoi nous ne    │            │
│  │   article en vedette             │  │  posons pas de       │            │
│  │                                  │  │  vernis.             │            │
│  │   « Hiver, ongles, et            │  │  ─                   │            │
│  │   patience. »                    │  │  Le 12 avril 2026    │            │
│  │   ─                              │  └──────────────────────┘            │
│  │   Le 28 avril 2026 · 6 min       │  ┌──────────────────────┐            │
│  │                                  │  │                      │            │
│  │                                  │  │   [photo lifestyle]  │            │
│  └──────────────────────────────────┘  │                      │            │
│                                        │  La main qui sait —  │            │
│                                        │  entretien avec une  │            │
│                                        │  initiée.            │            │
│                                        │  ─                   │            │
│                                        │  Le 5 avril 2026     │            │
│                                        └──────────────────────┘            │
│                                                                            │
│                          Tout lire dans le Journal →                       │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 9.2 — Composition

#### Surtitre

```
LE JOURNAL DE LA MAISON
```

Inter SemiBold 7.5pt, tracking 2.5px, couleur Champagne `#C8A876`.

#### Grille asymétrique

| Élément          | Position                | Taille                                 |
| :--------------- | :---------------------- | :------------------------------------- |
| **Article hero** | Gauche, occupe 60%      | Hauteur 480px                          |
| **Article B**    | Droite-haut             | Hauteur 230px                          |
| **Article C**    | Droite-bas              | Hauteur 230px                          |

> **Pourquoi cette asymétrie ?** Une grille 3×1 régulière est lisible mais ennuyeuse. Une grille asymétrique (1 large + 2 petits) crée une **hiérarchie visuelle** qui guide le regard. L'article hero est implicitement « celui à lire en premier ».

#### Article hero — composition

| Élément       | Spécifications                                                              |
| :------------ | :-------------------------------------------------------------------------- |
| Photo         | Lifestyle, ratio 16:9, qualité éditoriale (pas Instagram-style)             |
| Overlay       | Gradient `linear-gradient(transparent 50%, rgba(44,42,40,0.6))` au bas      |
| Titre         | Cormorant Light 24pt, blanc cassé `#FBF8F1`, sur l'overlay                  |
| Métadonnée    | Inter Regular 10pt, blanc cassé opacité 0.8                                 |
| Catégorie     | (Optionnel) Pill mini en haut-gauche : « Saison »                            |
| Hover         | Photo zoom-in 1.04 scale, transition 600ms ease-out                          |
| Cursor        | `pointer` — la carte entière est cliquable                                  |

#### Articles B et C — composition

| Élément       | Spécifications                                                              |
| :------------ | :-------------------------------------------------------------------------- |
| Photo         | Lifestyle, ratio 4:3, hauteur 130px                                          |
| Titre         | Cormorant Light 16pt, couleur Encre, sous la photo                          |
| Métadonnée    | Inter Regular 9pt, couleur Brume, sous le titre, séparé par un filet `─`    |
| Hover         | Photo zoom-in 1.04 scale + titre underline                                  |

#### CTA de fin

```
Tout lire dans le Journal →
```

Inter Medium 14pt, couleur `#6B6863` Brume, alignement centré, espacement haut 48px.

### 9.3 — Trois articles — exemples concrets

| # | Type     | Titre                                                       | Catégorie  | Date          |
| :- | :------- | :---------------------------------------------------------- | :--------- | :------------ |
| Hero | Saisonnier | *« Hiver, ongles, et patience. »*                         | Saison     | 28 avril 2026 |
| B    | Manifeste  | *« Pourquoi nous ne posons pas de vernis. »*              | Maison     | 12 avril 2026 |
| C    | Interview  | *« La main qui sait — entretien avec une initiée. »*      | Voix       | 5 avril 2026  |

### 9.4 — Tokens design

```css
/* ─── Section Journal — tokens ─── */
--journal-bg: #FBF8F1;
--journal-grid-gap: 24px;

--journal-hero-height: 480px;
--journal-secondary-height: 230px;

--journal-title-hero-size: 24pt;
--journal-title-secondary-size: 16pt;
--journal-title-color: #2C2A28;
--journal-title-color-overlay: #FBF8F1;

--journal-meta-color: #6B6863;
--journal-meta-size: 9pt;

--journal-overlay-gradient: linear-gradient(transparent 50%, rgba(44,42,40,0.6));
--journal-card-hover-scale: 1.04;
--journal-card-hover-duration: 600ms;
```

### 9.5 — Psychologie

#### F-pattern break

L'asymétrie casse le F-pattern habituel des pages text-heavy. L'œil est forcé de **scanner activement** au lieu de glisser.

#### Storytelling > selling

Cette section vend **l'autorité éditoriale** de la maison, pas un produit. Une cliente qui lit un article du Journal est convaincue par la **profondeur** — elle ne se sentira plus jamais en train d'être *vendue*.

#### Asymétrie dominante (Gestalt)

> Selon les principes Gestalt, l'élément **plus grand** parmi des éléments similaires est perçu comme **plus important**. La hiérarchie est implicite, pas imposée.

### 9.6 — Émotion

| Avant | Pendant | Après |
| :---- | :------ | :---- |
| Confiance | Profondeur intellectuelle | Loyauté implicite (« cette maison sait écrire ») |

### 9.7 — Erreurs à éviter

- Plus de 3 articles — l'œil décroche.
- Grille régulière 3×1 — banale, perd le bénéfice asymétrique.
- Titres SEO-bourrés — *« 10 astuces pour des ongles parfaits ! »* tue la marque.
- Boutons « Lire l'article » individuels — la carte entière est cliquable, le bouton est friction.
- Dates trop précises (« 28/04/2026 ») — préférer le format littéraire « Le 28 avril 2026 ».

---

## 10 — Section 06 — Newsletter de fin

### 10.1 — Wireframe

```
┌════════════════════════════════════════════════════════════════════════════┐
║                          ╱──╲                                              ║
║                         ╱ ◆ ╲     ← fleuron champagne                      ║
║                          ╲╱                                                ║
║                                                                            ║
║                Le journal du rituel.                                       ║
║                                                                            ║
║                Une lettre par mois. Lente, comme le rituel.                ║
║                                                                            ║
║                                                                            ║
║                ┌────────────────────────────┐  ┌────────────┐              ║
║                │  votre email               │  │ S'abonner  │              ║
║                └────────────────────────────┘  └────────────┘              ║
║                                                                            ║
║                                                                            ║
└════════════════════════════════════════════════════════════════════════════┘
                            (fond sauge pâle pleine largeur)
```

### 10.2 — Composition

#### Fond

| Propriété      | Valeur                              |
| :------------- | :---------------------------------- |
| Couleur        | `#E8EFE7` (Sauge pâle)              |
| Hauteur        | 280px (desktop) · 320px (mobile)    |
| Padding vertical | 64px                              |

#### Fleuron

Identique à celui du manifeste (section 03) — taille 80×12px, couleur champagne.

#### Titre

```
Le journal du rituel.
```

Cormorant Garamond Light 32pt, couleur Encre, centré.

#### Sous-titre / promesse

```
Une lettre par mois. Lente, comme le rituel.
```

Cormorant Light Italic 16pt, couleur Encre claire `#4A4844`, centré, espacement haut 12px.

#### Formulaire

##### Champ email

| Propriété         | Valeur                                                       |
| :---------------- | :----------------------------------------------------------- |
| Largeur           | 320px (desktop) · 100% (mobile)                              |
| Hauteur           | 48px                                                         |
| Border            | 1px solid `#E8E0D2` (Ligne)                                  |
| Border-radius     | 0                                                            |
| Padding           | 0 16px                                                       |
| Police            | Inter Regular 14pt                                           |
| Placeholder       | « votre email » — en italique, couleur Brume                 |
| Fond              | `#FBF8F1` (Crème pure)                                       |
| Focus ring        | 2px sauge dark, offset 0                                     |
| Espacement droit  | 16px (avec le bouton)                                        |

##### Bouton « S'abonner »

| Propriété      | Valeur                                                       |
| :------------- | :----------------------------------------------------------- |
| Largeur        | 132px                                                         |
| Hauteur        | 48px (aligné au champ)                                        |
| Fond           | `#2C2A28` (Encre)                                            |
| Texte          | `#FBF8F1` (Crème pure)                                       |
| Police         | Inter Medium 14pt                                            |
| Border-radius  | 0                                                            |
| Hover          | Fond `#4A4844`, transition 220ms                             |

#### Texte de réassurance (sous le formulaire)

```
Pas de promotion. Aucune publicité. Vous pouvez vous désabonner à tout moment.
```

Inter Regular 11pt, couleur Brume, centré, espacement haut 16px, opacité 0.7.

> **Pourquoi cette ligne explicite ?** Parce que la cible marocaine urbaine a été **traumatisée** par les newsletters spam. Cette ligne n'est pas un dégagement légal — c'est une **promesse de respect**.

### 10.3 — États du formulaire

| État          | Visuel                                                     | Message                              |
| :------------ | :--------------------------------------------------------- | :----------------------------------- |
| **Initial**   | Champ vide + bouton                                        | (placeholder)                        |
| **Focus**     | Champ ring sauge dark                                      | (placeholder masqué)                 |
| **Erreur**    | Champ ring `#C57B7B` (rouge poudré), shake animation        | « Cet email semble incorrect. »      |
| **Loading**   | Bouton avec spinner, désactivé                             | « Envoi en cours... »                |
| **Succès**    | Champ et bouton remplacés par texte sauge pâle             | « Bienvenue dans le journal. »       |

#### Animation succès

```
[t=0ms]      → Bouton cliqué, état loading
[t=400ms]    → Réponse serveur OK
[t=400-700ms]→ Champ + bouton fade-out
[t=700-1200ms]→ Message succès fade-in avec mini fleuron
[t=1200ms+]  → État stable « Bienvenue dans le journal. »
```

### 10.4 — Tokens design

```css
/* ─── Section Newsletter — tokens ─── */
--newsletter-bg: #E8EFE7;
--newsletter-padding: 64px 0;

--newsletter-title-size: 32pt;
--newsletter-title-color: #2C2A28;

--newsletter-subtitle-size: 16pt;
--newsletter-subtitle-style: italic;
--newsletter-subtitle-color: #4A4844;

--newsletter-input-bg: #FBF8F1;
--newsletter-input-border: #E8E0D2;
--newsletter-input-focus: #A8C4A6;

--newsletter-button-bg: #2C2A28;
--newsletter-button-text: #FBF8F1;

--newsletter-reassurance-color: #6B6863;
--newsletter-reassurance-opacity: 0.7;
```

### 10.5 — Psychologie

#### Value before ask (réciprocité — Cialdini, 1984)

> *« People feel obligated to give back to those who give to them. »*

Le sous-titre *« Une lettre par mois. Lente, comme le rituel. »* **promet une valeur** avant de demander quoi que ce soit. La promesse est :

- **Rare** : une fois par mois (pas un spam quotidien).
- **Calme** : *« Lente »* est un mot rare en marketing — il rassure.
- **Cohérente** : *« comme le rituel »* — la newsletter est un fragment du rituel, pas un canal commercial.

#### Content > discount (Kolenda)

> Pour le luxe : *« Customers who see the final price while shopping often fixate on how much they're paying. »*

L'inverse : ne JAMAIS promettre une réduction en échange de l'email. *« -10% sur votre première commande »* dévalue brutalement la marque. La newsletter de FemiGlow promet du **contenu**, jamais du prix.

### 10.6 — Émotion

| Avant | Pendant | Après |
| :---- | :------ | :---- |
| Loyauté implicite | Légère hésitation (« je donne mon email ? ») | Engagement doux (« cette lettre, oui, je veux la recevoir ») |

### 10.7 — Erreurs à éviter

- Promesse de réduction → tue la marque.
- Pop-up newsletter à l'arrivée → traumatisant, bounce immédiat.
- Champs supplémentaires (prénom, ville) → friction inutile pour un soft opt-in.
- Texte « *Inscrivez-vous à notre newsletter !* » → cliché commercial.
- CTA « *S'inscrire* » → préférer *« S'abonner »* (sens d'appartenance).

---

## 11 — Footer — élément persistant

### 11.1 — Structure

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│  FemiGlow      LE RITUEL       PARTENAIRES      ASSISTANCE      LÉGAL     │
│  MAISON D'ÉCLAT  Le rituel     Le programme     Contact         Mentions   │
│  CASABLANCA      Le kit        Marges salon     FAQ             CGV        │
│                  Journal       Échantillon      Livraison       Cookies    │
│                  Maison        Espace Pro       Retours         Confid.    │
│                                                                            │
│                                                                            │
│  ────────────────────────────────────────────────────────────────────      │
│                                                                            │
│  © 2026 FemiGlow. Casablanca, Maroc.        IG · LinkedIn · WhatsApp Pro   │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
                              (fond encre)
```

### 11.2 — Spécifications

| Propriété      | Valeur                                                |
| :------------- | :---------------------------------------------------- |
| Hauteur        | 320px (desktop) · auto (mobile, accordion)            |
| Fond           | `#2C2A28` (Encre)                                     |
| Padding        | 64px 96px (desktop) · 48px 24px (mobile)              |
| Layout         | Grid 5 colonnes (1 wordmark + 4 liens)                 |

### 11.3 — Wordmark + adresse (colonne gauche)

```
FemiGlow
MAISON D'ÉCLAT · CASABLANCA
```

| Élément          | Spécifications                                    |
| :--------------- | :------------------------------------------------ |
| Wordmark         | Pinyon Script 28pt, couleur `#FBF8F1` Crème pure  |
| Tagline          | Inter SemiBold 7pt, tracking 2.5px, couleur `#A8A6A2` |

### 11.4 — Colonnes de liens

#### Surtitre de chaque colonne

Inter SemiBold 7.5pt, tracking 2.5px, couleur `#C5DBC4` Sauge.

#### Liens

| Propriété        | Valeur                                              |
| :--------------- | :-------------------------------------------------- |
| Police           | Inter Regular 11pt                                  |
| Couleur normale  | `#E8E0D2` (Ligne, sur fond sombre = lisible)        |
| Couleur hover    | `#FBF8F1` Crème pure                                |
| Espacement       | 8px entre liens                                     |
| Décoration       | Aucune (pas de soulignement)                        |

### 11.5 — Filet séparateur + ligne basse

#### Filet

Largeur 100% du container interne, hauteur 1px, couleur `#4A4844` (Encre claire), opacité 0.4.

#### Ligne basse (gauche)

```
© 2026 FemiGlow. Casablanca, Maroc.
```

Inter Regular 10pt, couleur `#A8A6A2`.

#### Liens sociaux (droite)

```
Instagram · LinkedIn · WhatsApp Pro
```

Inter Regular 10pt, couleur `#A8A6A2`. Hover : `#FBF8F1`.

> **Pas de logos sociaux colorés** (Instagram dégradé violet/orange, LinkedIn bleu). Texte simple. Le luxe ne porte pas de marques tierces.

### 11.6 — Pas de newsletter dans le footer

Volontairement. La newsletter est dans la section 06 (Journal), unique, valorisée. La répéter dans le footer la dévaluerait. C'est un **opt-out architectural** : si la visiteuse n'a pas voulu s'abonner après la section 06, elle ne le fera pas en footer.

### 11.7 — Adaptation mobile

Sur mobile, les 4 colonnes deviennent **4 accordéons** repliés par défaut :

```
┌─────────────────────────────────┐
│ FemiGlow                        │
│ MAISON D'ÉCLAT · CASABLANCA     │
│                                 │
│ LE RITUEL                  ▾    │
│ ─                               │
│ PARTENAIRES                ▾    │
│ ─                               │
│ ASSISTANCE                 ▾    │
│ ─                               │
│ LÉGAL                      ▾    │
│ ─                               │
│ © 2026 FemiGlow                 │
│ IG · LinkedIn · WhatsApp Pro   │
└─────────────────────────────────┘
```

Tap sur une colonne → expand de la liste. Une seule colonne ouverte à la fois (accordion behavior).

---

## 12 — Comportements transverses

### 12.1 — Smooth scroll

`scroll-behavior: smooth` activé en CSS. **Sauf** :

- Quand l'utilisateur a `prefers-reduced-motion: reduce` activé.
- Sur les ancres rapides (jump links) : scroll instantané sur Cmd/Ctrl+click.

### 12.2 — Lazy loading des images

| Type d'image       | Stratégie                                        |
| :----------------- | :----------------------------------------------- |
| Hero (above fold)  | `loading="eager"`, preload                       |
| 4 gestes           | `loading="eager"` (visible en 1er scroll)         |
| Avis clientes      | `loading="lazy"`, intersection observer          |
| Journal extraits   | `loading="lazy"`                                 |
| Footer             | (aucune image dans le footer)                    |

### 12.3 — Format d'image

| Format primaire | Format fallback | Compression |
| :-------------- | :-------------- | :---------- |
| WebP            | JPEG            | Qualité 80, profil sRGB |
| AVIF (futur)    | WebP, JPEG      | Qualité 75  |

### 12.4 — Animation timing — règle générale

| Type d'animation       | Durée            | Easing                              |
| :--------------------- | :--------------- | :---------------------------------- |
| Hover button           | 220ms            | `cubic-bezier(0.4, 0, 0.2, 1)`      |
| Hover photo card       | 600ms            | `cubic-bezier(0.4, 0, 0.2, 1)`      |
| Header transition      | 240ms            | `cubic-bezier(0.4, 0, 0.2, 1)`      |
| Page load (hero entry) | 800-1200ms       | `cubic-bezier(0.16, 1, 0.3, 1)`     |
| Section reveal scroll  | 600ms            | `cubic-bezier(0.4, 0, 0.2, 1)`      |
| Modal fade-in          | 320ms            | `cubic-bezier(0, 0, 0.2, 1)`        |

> **Règle d'or** : aucune animation > 1.2s. Aucune animation en boucle infinie (sauf spinner de loading). Le luxe est calme, pas vibrant.

### 12.5 — Reduced motion

Pour les utilisateurs avec `prefers-reduced-motion: reduce` :

- Toutes les animations d'entrée passent à 0ms (apparition instantanée).
- Les animations parallaxe sont désactivées.
- Les hovers gardent leur transition (220ms ou moins) pour le feedback.
- Le smooth scroll est désactivé.

### 12.6 — État de chargement initial

```
[t=0ms]      → HTML loaded, fond crème visible
[t=100ms]    → Police Inter chargée (woff2 preload)
[t=300ms]    → Police Cormorant chargée
[t=500ms]    → Police Pinyon Script chargée
[t=600ms]    → Hero image principale chargée
[t=800ms]    → FCP (First Contentful Paint) atteint
[t=1500ms]   → LCP (Largest Contentful Paint) atteint — cible
[t=2000ms]   → Page interactive complète, animations terminées
```

### 12.7 — Skeleton vs. pas de skeleton ?

**Pas de skeleton screen.** Le luxe ne montre pas son squelette. À la place : `font-display: swap` configuré pour que le texte apparaisse immédiatement avec la police fallback (Georgia pour Cormorant, system-ui pour Inter), puis le swap est imperceptible quand la vraie police arrive.

---

## 13 — Adaptation responsive

### 13.1 — Breakpoints officiels

| Nom         | Min-width | Max-width | Layout principal                |
| :---------- | :-------- | :-------- | :------------------------------ |
| **Mobile**  | 0         | 767px     | 1 colonne, vertical             |
| **Tablet**  | 768px     | 1279px    | 2 colonnes mixtes               |
| **Desktop** | 1280px    | -         | Multi-colonnes, max-width 1280px |

### 13.2 — Adaptations par section

#### Hero (Section 01)

| Propriété            | Desktop          | Tablet          | Mobile         |
| :------------------- | :--------------- | :-------------- | :------------- |
| Hauteur              | 92vh             | 90vh            | 88vh           |
| Padding latéral      | 96px             | 64px            | 24px           |
| Titre size           | 96pt             | 64pt            | 48pt           |
| Tagline size         | 22pt             | 18pt            | 16pt           |
| CTA double           | Côte à côte      | Côte à côte     | Empilés vertic. |
| Vague pétale         | 50% × 60%        | 60% × 55%       | 70% × 50%      |
| Vague sauge          | 35% × 45%        | 40% × 40%       | 50% × 45%      |

#### 4 gestes (Section 02)

| Propriété     | Desktop          | Tablet          | Mobile          |
| :------------ | :--------------- | :-------------- | :-------------- |
| Layout        | 4 cartes en ligne | 4 cartes en ligne | 2×2 grille     |
| Carte width   | 240px            | ~180px          | 50% - 8px       |
| Carte height  | 220px            | 200px           | 200px           |
| Étiquette     | 96px             | 80px            | 72px            |

#### Manifeste (Section 03)

Adapatation simple : la taille du texte passe de 28pt à 22pt à 18pt. Tout le reste est conservé.

#### Avis clientes (Section 04)

| Propriété     | Desktop          | Tablet          | Mobile                        |
| :------------ | :--------------- | :-------------- | :---------------------------- |
| Layout        | 3 cartes en ligne | 3 cartes serrées | Carrousel swipe horizontal    |
| Photo height  | 220px            | 180px           | 220px (1 visible + aperçu)    |

#### Journal (Section 05)

| Propriété     | Desktop          | Tablet          | Mobile                |
| :------------ | :--------------- | :-------------- | :-------------------- |
| Layout        | Asymétrique 1+2  | Asymétrique 1+2 | 3 articles empilés    |
| Hero width    | 60%              | 55%             | 100%                  |
| Hero height   | 480px            | 400px           | 320px                 |

#### Newsletter (Section 06)

| Propriété          | Desktop      | Tablet       | Mobile                          |
| :----------------- | :----------- | :----------- | :------------------------------ |
| Champ + bouton     | Côte à côte  | Côte à côte  | Empilés (champ pleine largeur, bouton dessous) |

### 13.3 — Comportements mobile spécifiques

- **Header** : burger menu drawer plein écran, avec animation slide-in 280ms depuis la droite.
- **CTA panier** : compteur uniquement (icone discrète + nombre), pas le mot « Panier ».
- **Carrousel avis** : indicateurs (3 dots) sous le carrousel, sans flèches navigation visibles.
- **Sticky CTA** : sur mobile, après scroll au-delà du hero, un mini-CTA flottant `Découvrir le rituel →` apparaît en bas-droite (FAB style — 80% opacité, pill).

---

## 14 — Performance technique

### 14.1 — Web Vitals — cibles

| Métrique | Cible    | Justification                                      |
| :------- | :------- | :------------------------------------------------- |
| **LCP**  | < 2.5s   | Hero image chargée rapidement, expérience luxe     |
| **CLS**  | < 0.1    | Pas de saut visuel — le luxe ne tremble pas        |
| **INP**  | < 200ms  | Réactivité des interactions (CTA, hover, scroll)   |
| **FCP**  | < 1.0s   | Premier contenu (texte hero) visible vite          |
| **TBT**  | < 200ms  | JS minimal, pas de blocage du thread principal     |

### 14.2 — Stratégie de chargement

#### Critical CSS

CSS critique inline dans le `<head>` — uniquement les styles du hero et du header. Le reste en CSS externe `<link>`.

#### Preload des polices

```html
<link rel="preload" href="/fonts/Inter-Regular.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/CormorantGaramond-Light.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/PinyonScript-Regular.woff2" as="font" type="font/woff2" crossorigin>
```

#### Preload de l'image hero

```html
<link rel="preload" as="image" href="/images/hero-vague.webp" media="(min-width: 768px)">
<link rel="preload" as="image" href="/images/hero-vague-mobile.webp" media="(max-width: 767px)">
```

#### Defer du JavaScript non-critique

```html
<script src="/js/animations.js" defer></script>
<script src="/js/analytics.js" defer></script>
```

### 14.3 — Budget de performance

| Ressource        | Budget          |
| :--------------- | :-------------- |
| HTML initial     | < 30 KB gzip    |
| CSS critique     | < 8 KB inline   |
| CSS externe      | < 40 KB gzip    |
| JS total         | < 80 KB gzip    |
| Images hero      | < 200 KB total  |
| Polices          | < 120 KB total  |
| **Total page**   | **< 600 KB**    |

### 14.4 — CDN & cache

| Ressource          | Cache-Control                          |
| :----------------- | :------------------------------------- |
| HTML               | `no-cache, must-revalidate`            |
| CSS / JS versionnés | `public, max-age=31536000, immutable`  |
| Images             | `public, max-age=2592000` (30 jours)   |
| Polices            | `public, max-age=31536000, immutable`  |

CDN : Cloudflare ou équivalent, avec optimisation Polish + Mirage activée.

---

## 15 — SEO & métadonnées

### 15.1 — Title

```html
<title>FemiGlow — Le rituel d'éclat. Maison de soin pour les ongles.</title>
```

| Critère                 | Valeur                                                          |
| :---------------------- | :-------------------------------------------------------------- |
| Longueur                | 65 caractères (≤ 60 affichables sur SERP, légèrement tronqué OK) |
| Mot-clé principal       | « rituel d'éclat » (peu disputé, identité de marque)            |
| Mot-clé secondaire      | « soin pour les ongles » (catégorie)                            |
| Marque en tête          | « FemiGlow » (autorité de marque)                               |

### 15.2 — Meta description

```html
<meta name="description" content="Une maison de soin pour les ongles. Quatre gestes, une lumière retrouvée — sans vernis ni abrasion. Découvrez le rituel.">
```

| Critère       | Valeur                                                  |
| :------------ | :------------------------------------------------------ |
| Longueur      | 142 caractères (≤ 155 affichables sur SERP)             |
| Hook          | « Une maison de soin » (catégorie distinctive)          |
| Bénéfice      | « lumière retrouvée »                                   |
| Différenciat. | « sans vernis ni abrasion »                             |
| CTA           | « Découvrez le rituel »                                 |

### 15.3 — Open Graph (réseaux sociaux)

```html
<meta property="og:type" content="website">
<meta property="og:url" content="https://femiglow.ma/">
<meta property="og:title" content="FemiGlow — Le rituel d'éclat.">
<meta property="og:description" content="Une maison de soin pour les ongles. Quatre gestes, une lumière retrouvée.">
<meta property="og:image" content="https://femiglow.ma/og/og-default.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="fr_MA">
<meta property="og:site_name" content="FemiGlow">
```

#### Image OG

- Dimensions : 1200×630px (ratio 1.91:1 — standard Facebook)
- Composition : wordmark Pinyon centré + vagues pétale/sauge subtiles + tagline « Le rituel d'éclat »
- Fond crème, lisible en miniature
- Format JPEG qualité 85, < 200 KB

### 15.4 — Twitter Card

```html
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@femiglow">
<meta name="twitter:title" content="FemiGlow — Le rituel d'éclat.">
<meta name="twitter:description" content="Une maison de soin pour les ongles. Quatre gestes, une lumière retrouvée.">
<meta name="twitter:image" content="https://femiglow.ma/og/twitter-card.jpg">
```

### 15.5 — Schema.org JSON-LD

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "FemiGlow",
  "alternateName": "FemiGlow Maison d'Éclat",
  "url": "https://femiglow.ma",
  "logo": "https://femiglow.ma/logo.png",
  "description": "Maison de soin pour les ongles, basée à Casablanca. Le rituel japonais en kit.",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Casablanca",
    "addressCountry": "MA"
  },
  "sameAs": [
    "https://www.instagram.com/femiglow",
    "https://www.linkedin.com/company/femiglow"
  ]
}
```

### 15.6 — Canonical & hreflang

```html
<link rel="canonical" href="https://femiglow.ma/">
<link rel="alternate" hreflang="fr-MA" href="https://femiglow.ma/">
<link rel="alternate" hreflang="ar-MA" href="https://femiglow.ma/ar/">
<link rel="alternate" hreflang="x-default" href="https://femiglow.ma/">
```

### 15.7 — Robots & sitemap

```html
<meta name="robots" content="index, follow, max-image-preview:large">
```

Sitemap.xml généré automatiquement, déposé à `/sitemap.xml` et déclaré dans `robots.txt`.

---

## 16 — Accessibilité (a11y)

### 16.1 — Conformité visée

**WCAG 2.2 niveau AA** sur tous les composants critiques. Niveau AAA visé sur le contraste texte et la navigation clavier.

### 16.2 — Contraste — vérifications

| Combinaison                                | Ratio   | Niveau WCAG   |
| :----------------------------------------- | :------ | :------------ |
| Encre `#2C2A28` sur Crème `#FBF8F1`        | 14.2:1  | AAA           |
| Encre claire `#4A4844` sur Crème           | 9.1:1   | AAA           |
| Brume `#6B6863` sur Crème                  | 5.6:1   | AA            |
| Brume sur Sauge pâle `#E8EFE7`             | 5.2:1   | AA            |
| Crème pure `#FBF8F1` sur Encre             | 14.2:1  | AAA (footer)  |
| Champagne `#C8A876` sur Crème              | 2.7:1   | AA Large only — réserver à kickers ≥ 14pt |

### 16.3 — Navigation clavier

| Élément                | Comportement clavier                            |
| :--------------------- | :---------------------------------------------- |
| Wordmark               | Tab focus, Enter active                          |
| Menu items             | Tab navigation séquentielle                      |
| Burger menu mobile     | Enter ouvre, Escape ferme                        |
| CTA primaire / secondaire | Tab + Enter                                   |
| Cards Avis             | Tab si lien (sinon ignore)                       |
| Cards Journal          | Tab focus + Enter ouvre l'article               |
| Champ newsletter       | Tab focus, Enter envoie le formulaire            |
| Footer liens           | Tab navigation                                   |

### 16.4 — Focus ring

| Propriété     | Valeur                                          |
| :------------ | :---------------------------------------------- |
| Couleur       | `#A8C4A6` (Sauge dark)                          |
| Épaisseur     | 2px                                             |
| Offset        | 4px                                             |
| Border-radius | Hérite de l'élément (0 ou 999px selon)         |
| Outline-style | `solid`                                         |
| Visible       | Sur focus clavier uniquement (`:focus-visible`) |

### 16.5 — ARIA labels & landmarks

```html
<header role="banner" aria-label="En-tête principal">
  <nav aria-label="Navigation principale">...</nav>
  <a href="/" aria-label="FemiGlow, retour à l'accueil">FemiGlow</a>
</header>

<main role="main" aria-label="Page d'accueil">
  <section aria-labelledby="hero-title">
    <h1 id="hero-title">Le rituel d'éclat.</h1>
  </section>

  <section aria-labelledby="gestes-title">
    <h2 id="gestes-title">Quatre minutes. Quatre gestes.</h2>
  </section>

  <section aria-label="Manifeste de la maison">
    <p>Pas une marque. Une maison.</p>
  </section>

  <section aria-labelledby="avis-title">
    <h2 id="avis-title" class="visually-hidden">Avis de nos clientes</h2>
  </section>

  <section aria-labelledby="journal-title">
    <h2 id="journal-title">Le journal de la maison</h2>
  </section>

  <section aria-labelledby="newsletter-title">
    <h2 id="newsletter-title">Le journal du rituel</h2>
    <form role="form" aria-label="Inscription à la newsletter">...</form>
  </section>
</main>

<footer role="contentinfo" aria-label="Pied de page">...</footer>
```

### 16.6 — Images & alt texts

| Image                      | Alt text                                                       |
| :------------------------- | :------------------------------------------------------------- |
| Vagues du hero             | `alt=""` (décoratives, role="presentation")                    |
| Étiquettes circulaires     | `alt=""` (les mots à côté servent d'étiquette texte)            |
| Photos avis (mains)        | « Une main tenant un pot de crème, sur une table marbre »      |
| Photo article hero Journal | « Hiver à Casablanca — détail d'une fenêtre embuée »           |
| Photo article B Journal    | « Mains qui appliquent le rituel »                             |
| Photo article C Journal    | « Salma, fondatrice, en pleine préparation d'un kit »          |

### 16.7 — Skip link

```html
<a href="#main" class="skip-link">Aller au contenu principal</a>
```

Visible uniquement au focus clavier (premier tab de la page). Style sobre : fond encre, texte crème, position absolute top:0 quand visible.

### 16.8 — Réduction du mouvement

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### 16.9 — Mode sombre ?

**Pas de mode sombre.** La marque est ancrée sur un fond clair (crème). Un mode sombre détruirait la palette signature et la perception de luxe. En revanche, respect de `prefers-color-scheme` pour éventuellement ajuster les meta theme-color :

```html
<meta name="theme-color" content="#FBF8F1" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#2C2A28" media="(prefers-color-scheme: dark)">
```

---

## 17 — Microcopy & états

### 17.1 — Textes utilitaires

| Contexte                          | Microcopy                                                       |
| :-------------------------------- | :-------------------------------------------------------------- |
| Loading initial                   | (aucun — `font-display: swap` invisible)                        |
| Erreur 404                        | « Cette page s'est égarée du rituel. » + lien retour `/`        |
| Erreur 500                        | « Un instant — la maison réajuste sa table de soin. »          |
| Cookies banner                    | « Nous utilisons des cookies pour comprendre votre visite. »     |
| Cookies CTA                       | « Accepter » / « Refuser » / « Personnaliser »                   |
| Newsletter erreur email           | « Cet email semble incorrect. »                                  |
| Newsletter erreur serveur         | « Un instant. Veuillez réessayer. »                              |
| Newsletter succès                 | « Bienvenue dans le journal. »                                   |
| Mobile menu fermé (aria)          | « Ouvrir le menu de navigation »                                 |
| Mobile menu ouvert (aria)         | « Fermer le menu de navigation »                                 |

### 17.2 — Tonalité des messages d'erreur

**Jamais agressif.** Jamais *« ERREUR »* en majuscule. Jamais d'emoji ⚠️. Toujours **paisible et orientant** :

| À éviter                            | À préférer                                          |
| :---------------------------------- | :-------------------------------------------------- |
| « Email invalide ! »                | « Cet email semble incorrect. »                     |
| « Erreur serveur, réessayez »       | « Un instant. Veuillez réessayer. »                 |
| « 404 — Page non trouvée »          | « Cette page s'est égarée du rituel. »              |
| « Champ obligatoire »               | « Ce champ est nécessaire pour vous répondre. »     |

### 17.3 — Cookies banner

```
┌────────────────────────────────────────────────────────────────┐
│  Nous utilisons des cookies pour comprendre votre visite       │
│  et améliorer votre expérience. Aucun partage commercial.      │
│                                                                │
│  [Tout accepter]  [Personnaliser]  Refuser                     │
└────────────────────────────────────────────────────────────────┘
                  (au bas de l'écran, fond crème)
```

| Élément             | Spécifications                                          |
| :------------------ | :------------------------------------------------------ |
| Position            | Sticky bottom, max-width 720px, marge 24px              |
| Fond                | `#FBF8F1` Crème pure, ombre légère                      |
| Police texte        | Inter Regular 12pt                                      |
| Boutons             | « Tout accepter » primaire encre, « Personnaliser » secondaire, « Refuser » texte seul |
| Apparition          | Slide-up 320ms après chargement complet (delay 1.5s)    |

> **Pas de pop-up modal** qui bloque la page. Un cookie banner discret, en bas, qui n'interrompt pas l'exploration.

---

## 18 — Synthèse — checklist de validation

Avant mise en production, vérifier que chaque élément ci-dessous est validé. C'est l'audit final de la page d'accueil.

### 18.1 — Identité de marque

- [ ] Wordmark Pinyon Script présent en header et footer
- [ ] Aucune substitution de police pour le wordmark
- [ ] Palette signature respectée (sauge dominante, crème support, encre tranche)
- [ ] Champagne ≤ 5% de la composition totale
- [ ] Vagues pétale et sauge présentes dans le hero, fidèles au packaging
- [ ] Pas d'emoji nulle part sur la page
- [ ] Pas de pop-up newsletter à l'arrivée

### 18.2 — Copy & ton

- [ ] Titre hero : « Le rituel d'éclat. » (deux lignes, point final)
- [ ] Sous-tagline en trois lignes Cormorant Italic
- [ ] CTA primaire : verbe « Découvrir »
- [ ] CTA secondaire : « Lire le manifeste → »
- [ ] Manifeste en trois lignes (« Pas X. Y. ») avec fleuron champagne
- [ ] Avis : 3 témoignages, prénoms marocains, mention « initiée depuis... »
- [ ] Journal : 3 articles, asymétrie 1+2, dates en format littéraire
- [ ] Newsletter : promesse de contenu, jamais de réduction
- [ ] Microcopy d'erreur : tonalité paisible, jamais agressive
- [ ] Apostrophes typographiques courbes ' partout (pas de droites ')
- [ ] Guillemets français « » avec espaces insécables

### 18.3 — Tactiques Kolenda — minimum 4 par section

- [ ] Hero : `INDIRECT CLAIM` `EMPTY SPACE` `Z-PATTERN` `VERB OF OPENING` `DUAL PATH`
- [ ] 4 gestes : `4 OPTIONS MAX` `VISUAL SEQUENCE` `IMPLY HUMAN` `EMPTY SPACE`
- [ ] Manifeste : `INDIRECT CLAIM` `EMPTY SPACE` `TYPOGRAPHIC LUXURY`
- [ ] Avis : `IMPLY HUMAN` `MIRROR EFFECT` `AUTHENTICITY`
- [ ] Journal : `F-PATTERN BREAK` `STORYTELLING` `DEEP ENGAGEMENT`
- [ ] Newsletter : `VALUE BEFORE ASK` `CONTENT > DISCOUNT` `RECIPROCITY`

### 18.4 — Performance

- [ ] LCP < 2.5s sur 4G simulé
- [ ] CLS < 0.1
- [ ] INP < 200ms
- [ ] Page weight total < 600 KB
- [ ] Images en WebP avec fallback JPEG
- [ ] Polices preloaded
- [ ] Lazy loading sur images below the fold
- [ ] CSS critique inline dans `<head>`
- [ ] JavaScript non-critique en defer

### 18.5 — Responsive

- [ ] Mobile 375px, 390px, 414px testés
- [ ] Tablet 768px, 1024px testés
- [ ] Desktop 1280px, 1440px, 1920px testés
- [ ] Aucun débordement horizontal à aucune taille
- [ ] Touch targets ≥ 44×44px sur mobile
- [ ] Texte minimum 14px sur mobile (pas en dessous)

### 18.6 — SEO

- [ ] Title 60-65 caractères, mot-clé en tête
- [ ] Meta description 140-155 caractères, CTA inclus
- [ ] Open Graph image 1200×630
- [ ] Twitter Card configurée
- [ ] Schema.org Organization JSON-LD
- [ ] Canonical URL en HTTPS
- [ ] Hreflang fr-MA + ar-MA si applicable
- [ ] Sitemap.xml à jour
- [ ] Tous les `<h1>`, `<h2>`, `<h3>` hiérarchisés correctement (1 seul h1)

### 18.7 — Accessibilité

- [ ] WCAG 2.2 AA validé via axe-core ou WAVE
- [ ] Contrastes vérifiés sur toutes les combinaisons texte/fond
- [ ] Navigation clavier complète et logique (Tab, Enter, Escape)
- [ ] Focus ring visible et cohérent partout
- [ ] ARIA landmarks et labels en place
- [ ] Alt texts descriptifs sur images informatives
- [ ] Alt vide sur images décoratives (`role="presentation"`)
- [ ] Skip link en haut de page
- [ ] `prefers-reduced-motion` respecté
- [ ] Test lecteur d'écran NVDA ou VoiceOver

### 18.8 — Émotion & cohérence

- [ ] La règle des 5 secondes passe (catégorie / cible / différence comprises)
- [ ] La page respire — aucune section sur-chargée
- [ ] Le scroll est un rythme, pas une corvée
- [ ] La page peut être consultée sans scroll horizontal à aucun moment
- [ ] La marque tient debout SANS le packaging physique à côté
- [ ] Un visiteur sans contexte préalable comprend le positionnement luxe accessible

---

> *« La page d'accueil est la porte. Une porte se reconnaît à ce qu'elle laisse deviner — pas à ce qu'elle impose. »*

**FIN · FemiGlow · Spécification de la page d'accueil v1.0 · Mai 2026**

*Prochaines spécifications à produire (B2C) : `/rituel`, `/kit ★`, `/journal`, `/maison`, `/panier`, `/commander ★`, `/merci`.*
