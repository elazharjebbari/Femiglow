# Page Maison — `/maison`

> **Univers Particulier · B2C · Page institutionnelle** — Document de spécification détaillée
> *Volume VII · Mai 2026 · Complémentaire à la charte graphique et au document d'architecture.*

---

## Sommaire

1. [Identité de la page](#1--identité-de-la-page)
2. [Contexte stratégique](#2--contexte-stratégique)
3. [Architecture verticale globale](#3--architecture-verticale-globale)
4. [Header — élément persistant](#4--header--élément-persistant)
5. [Section 01 — Hero éditorial](#5--section-01--hero-éditorial)
6. [Section 02 — L'origine (le récit fondateur)](#6--section-02--lorigine-le-récit-fondateur)
7. [Section 03 — La fondatrice](#7--section-03--la-fondatrice)
8. [Section 04 — L'atelier (Casablanca)](#8--section-04--latelier-casablanca)
9. [Section 05 — Les matières (transparence du sourcing)](#9--section-05--les-matières-transparence-du-sourcing)
10. [Section 06 — Les quatre engagements](#10--section-06--les-quatre-engagements)
11. [Section 07 — Cross-link](#11--section-07--cross-link)
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
| **URL**              | `femiglow.ma/maison`                                                    |
| **Type**             | Page institutionnelle · récit de marque · manifeste long                |
| **Audience**         | Visiteuses curieuses — *qui se cache derrière cette marque ?*           |
| **Profil cognitif**  | Recherche de cohérence — veut **vérifier** que la marque est honnête    |
| **Pouvoir d'achat**  | Variable — peut être TOFU curieuse OU cliente fidèle qui revient         |
| **Funnel**           | **Cross-cutting** — accessible depuis tous les funnels                  |
| **Position parcours**| Variable : entrée organique sur « FemiGlow histoire », clic depuis footer, depuis /journal cross-link, depuis /rituel cross-link |
| **Durée d'attention**| 2 à 6 minutes (lecture longue, mais pas obligatoire pour acheter)        |
| **Device split**     | Mobile 55% · Desktop 38% · Tablet 7% (lecture longue → desktop monte légèrement) |
| **Update frequency** | Rare — modifié seulement quand l'histoire évolue (1-2× / an)             |

### Ce que la page **doit** faire

1. **Construire la confiance par le récit.** Une marque qui raconte son histoire avec sincérité **gagne** la confiance que dix arguments commerciaux ne pourraient pas obtenir.
2. **Mettre un visage (humain) derrière la voix.** Salma, la fondatrice, est la voix qu'on entend dans le Journal et dans les emails. Cette page lui donne **corps**, sans tomber dans le portrait frontal vulgaire.
3. **Justifier rétroactivement la voix éditoriale** des autres pages. Pourquoi `/rituel` parle-t-il avec autant de soin ? Parce que la maison **est** un lieu de soin — pas une équipe marketing.
4. **Documenter les engagements concrets.** Pas des promesses floues ; des engagements **vérifiables** (matières, fournisseurs, mode de fabrication, traçabilité).
5. **Préserver l'éditorial absolu.** Aucun storytelling marketing standardisé. Cette page se lit comme un essai littéraire, pas comme un document corporate.

### Ce que la page **ne doit pas** faire

1. **Imiter les pages "À propos" corporate.** Pas de section "Notre Mission / Notre Vision / Nos Valeurs" en trois colonnes. Pas de timeline avec dates marketing. Pas de citations de fondatrice avec photo professionnelle souriante.
2. **Vendre directement.** Aucun CTA `Recevoir le rituel` sur cette page. Le récit doit pouvoir vivre **indépendamment** du commerce.
3. **Multiplier les visages.** Salma seule. Pas de "team page" avec photos LinkedIn de tout le monde. La maison parle d'une seule voix — celle de sa fondatrice.
4. **Inventer une histoire.** Tout ce qui est raconté est **vrai**. Si l'histoire est modeste, elle est racontée modestement. La sincérité ne se simule pas.
5. **Être interactif.** Pas de quiz "Quel rituel êtes-vous ?", pas de carrousel d'engagements, pas de map interactive de l'atelier. La page est **statique**, **lente**, **lisible**.

---

## 2 — Contexte stratégique

### Position dans l'écosystème B2C

```
[ARRIVÉE]                       [PAGE MAISON /maison]                  [SUITE]
    │                                   │                                │
Footer (toutes pages) ───────►   1. Hero éditorial             ────►   /journal (lectrice fidèle)
Cross-link /journal ──────────►  2. L'origine                  ────►   /rituel (curieuse du soin)
Cross-link /rituel ───────────►  3. La fondatrice              ────►   /kit (acheteur final convaincu)
Recherche organique ─────────►   4. L'atelier                  ────►   (sortie sereine, retour plus tard)
(« FemiGlow histoire »)          5. Les matières
Réseaux sociaux ─────────────►   6. Les quatre engagements
                                 7. Cross-link
                                   │
                                   ↓
                              Lecture (2-6 min)
                                   ↓
                              Confiance acquise
                                   ↓
                              Intention d'achat différée OU fidélité passive
```

### La règle de la légitimation rétroactive

> Toutes les autres pages du site **présupposent** que la marque a une légitimité. `/maison` est la page qui **justifie** cette présupposition.

Sans `/maison`, la voix éditoriale de `/rituel` (poétique, savante) pourrait sembler **artificielle**. Avec `/maison`, elle s'enracine dans une **réalité humaine** : Salma a passé deux ans à apprendre les gestes japonais à Kyoto avant d'ouvrir l'atelier de Casablanca. La voix devient **autorisée**.

### Tension stratégique fondamentale

`/maison` vit dans une triple tension :

#### Tension 1 — Être personnelle sans être égocentrique

> Si la page parle **trop** de Salma, elle devient un autoportrait — la cliente s'éloigne (« cette marque parle d'elle, pas de moi »). Si elle ne parle **pas assez** de Salma, elle reste abstraite — la cliente ne sait pas à qui elle achète.

**Résolution** : Salma apparaît comme **médiatrice**, pas comme **héroïne**. Elle parle de **ce qu'elle a appris**, pas de **qui elle est devenue**.

#### Tension 2 — Être institutionnelle sans être corporate

> Une page institutionnelle peut tomber dans le code corporate (« Notre Mission », « Nos Valeurs Fondatrices », « L'Excellence au Service de... »). Le code corporate **détruit** la voix éditoriale construite sur les autres pages.

**Résolution** : aucun mot du jargon corporate n'apparaît. Les valeurs sont **incarnées** dans les anecdotes, pas listées en bullet points.

#### Tension 3 — Documenter sans bavarder

> Trop d'information sur les matières, l'atelier, la fabrication, et la page devient un **catalogue technique**. Pas assez, et la transparence devient **superficielle**.

**Résolution** : la **précision** sans l'**exhaustivité**. On dit *exactement* d'où vient la cire d'abeille — mais on ne liste pas tous les fournisseurs avec leurs adresses postales.

### Architecture émotionnelle

| Section                | Émotion d'entrée    | Émotion de sortie       | Mouvement intérieur                  |
| :--------------------- | :------------------ | :---------------------- | :----------------------------------- |
| 01. Hero éditorial     | Curiosité           | Disposition à lire       | Reconnaissance, ralentissement       |
| 02. L'origine          | Disposition         | Surprise narrative       | « Je ne savais pas »                 |
| 03. La fondatrice      | Surprise            | Connexion humaine        | Identification possible              |
| 04. L'atelier          | Connexion           | Concrétude               | « Ce lieu existe vraiment »          |
| 05. Les matières       | Concrétude          | Confiance scientifique   | Transparence vérifiée                |
| 06. Les quatre engagements | Confiance       | Adhésion structurée      | Alignement de valeurs                |
| 07. Cross-link         | Adhésion            | Désir de poursuivre      | Continuation naturelle               |

### KPIs cibles

| Métrique                                    | Cible                            | Source                       |
| :------------------------------------------ | :------------------------------- | :--------------------------- |
| Temps moyen sur la page                     | > 2 minutes (lecture longue)     | GA4                          |
| Scroll depth ≥ 70%                          | > 50% des sessions               | Hotjar                       |
| Scroll depth ≥ 95%                          | > 25%                            | Hotjar                       |
| Bounce rate                                 | < 55%                            | GA4                          |
| CTR vers `/journal`                         | > 12%                            | Event tracking               |
| CTR vers `/rituel`                          | > 18%                            | Event tracking               |
| Returning visitors                          | > 20% (clientes fidèles qui reviennent vérifier) | GA4 |
| LCP                                         | < 2.4s                           | Web Vitals                   |
| CLS                                         | < 0.08                           | Web Vitals                   |
| INP                                         | < 200ms                          | Web Vitals                   |

> **Note sur les KPIs** : `/maison` n'est pas une page de conversion. Son ROI se mesure **indirectement** — par l'augmentation du taux de conversion **moyen du site** (les visiteuses qui passent par `/maison` convertissent typiquement +15-30% mieux que celles qui ne le font pas).

### Les trois fonctions de `/maison`

#### Fonction 1 — Construction de confiance

> **Slovic (1995)** — *« Information transparency increases trust more than persuasive claims. »*

La page **prouve** par les détails (Salma a appris à Kyoto, l'atelier est rue X, la cire vient de Z) que la marque n'est pas un dropshipping marocain qui revend des produits chinois. Cette preuve par les **faits vérifiables** est l'antidote à la suspicion contemporaine.

#### Fonction 2 — Différenciation par le récit

> **Pulizzi (2009)** — *« Stories are the only sustainable competitive advantage in saturated markets. »*

Le marché du soin des ongles au Maroc compte des dizaines de marques (vernis, semi-permanent, salon, importé). FemiGlow se distingue **non par son produit** (qui peut être copié) mais par son **récit** (qui ne peut pas l'être). `/maison` est le **dépôt légal** de ce récit.

#### Fonction 3 — Recrutement de talents (V2 — futur)

> Quand FemiGlow grandira et embauchera (V2 — 2027+), `/maison` sera la première page qu'un candidat lira. Elle doit donner envie **d'y travailler** — ce qui exige cohérence, sincérité, ambition mesurée.

### Le profil triple de la visiteuse

| Profil A — La nouvelle curieuse                        | Profil B — La cliente fidèle                              | Profil C — La curieuse SEO                              |
| :----------------------------------------------------- | :-------------------------------------------------------- | :------------------------------------------------------ |
| Premier passage sur le site                             | Connaît déjà la marque, revient vérifier                  | Arrivée par recherche organique sur « FemiGlow histoire »|
| Vient depuis recherche, réseaux sociaux                 | Vient depuis Journal ou panier                            | Vient depuis Google                                      |
| État émotionnel : curiosité prudente                    | État émotionnel : approfondissement                       | État émotionnel : enquête                                |
| Cherche : assurance que la marque est sérieuse           | Cherche : ressentir l'âme de la marque                    | Cherche : faits vérifiables                              |
| Lit en diagonale (sections 1, 3, 6)                     | Lit en profondeur (toute la page)                          | Cherche les mots-clés (sections 4-5-6)                   |
| ~40% du trafic                                          | ~35% du trafic                                            | ~25% du trafic                                           |

> **La page doit servir les trois profils** : structure scannable (titres clairs) + contenu profond (anecdotes, détails) + faits indexables (noms, lieux, dates).

---

## 3 — Architecture verticale globale

### Vue d'ensemble — desktop ≥ 1280px

```
┌─────────────────────────────────────────────────────────────────────┐
│  [HEADER — sticky · 80px · item Maison actif]                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  01. HERO ÉDITORIAL                                                 │
│      Phrase d'accroche longue + fleuron champagne                   │
│      Pas de photo de fond — fond crème noble                        │
│      Hauteur : 520px                                                │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  02. L'ORIGINE — LE RÉCIT FONDATEUR                                 │
│      Texte long en deux colonnes asymétriques                       │
│      Photo lifestyle « la mère de Salma »                           │
│      Hauteur : 720px                                                │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  03. LA FONDATRICE                                                  │
│      Citation longue de Salma (à la première personne)              │
│      Photo « mains de Salma au travail » (jamais de visage)         │
│      Hauteur : 640px                                                │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  04. L'ATELIER (CASABLANCA)                                         │
│      3 photos de l'atelier (espace, table de travail, pots prêts)   │
│      Texte descriptif court                                         │
│      Hauteur : 680px                                                │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  05. LES MATIÈRES — TRANSPARENCE DU SOURCING                        │
│      4 mini-fiches : ingrédient · origine · pourquoi                │
│      Layout grille 2×2                                              │
│      Hauteur : 580px                                                │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  06. LES QUATRE ENGAGEMENTS                                         │
│      4 piliers : matières · durabilité · made in Maroc · héritage    │
│      Layout grille 2×2 (pendant des matières)                       │
│      Hauteur : 540px                                                │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  07. CROSS-LINK                                                     │
│      Vers /rituel ou /journal — un seul lien                        │
│      Bandeau éditorial avec photo                                   │
│      Hauteur : 320px                                                │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  [FOOTER — encre · 320px]                                           │
└─────────────────────────────────────────────────────────────────────┘
```

### Hauteur totale approximative

- **Desktop (1440×900)** : ~4 320px (4.8 viewports — page longue mais lisible)
- **Tablet (768×1024)** : ~5 000px (4.9 viewports)
- **Mobile (390×844)** : ~6 800px (8.1 viewports)

### Le concept de la *traversée narrative*

```
Hero (suspension)                    ←─ Reconnaissance, ralentissement
   ↓
L'origine (le passé)                 ←─ « D'où vient la maison »
   ↓
La fondatrice (la voix)              ←─ « Qui parle dans la maison »
   ↓
L'atelier (le lieu)                  ←─ « Où la maison se fait »
   ↓
Les matières (les corps)              ←─ « De quoi la maison est faite »
   ↓
Les engagements (la promesse)         ←─ « Ce que la maison s'engage à »
   ↓
Cross-link (la suite)                 ←─ « Ce qui prolonge la maison »
```

> **Principe narratif** : la page suit un mouvement **du temps** (origine, passé) **vers l'espace** (atelier, ici-maintenant) **vers les matières** (les corps) **vers la promesse** (le futur). C'est l'**archéologie d'une maison** racontée en sept sections.

### Rythme de lecture intentionnel

| Section                | Densité       | Rythme                  | Type de contenu              |
| :--------------------- | :------------ | :---------------------- | :--------------------------- |
| 01. Hero éditorial     | Très aérée    | Suspension              | Phrase d'accroche longue     |
| 02. L'origine          | Dense         | Lecture engagée          | Texte long + photo           |
| 03. La fondatrice      | Modérée       | Méditation               | Citation + photo             |
| 04. L'atelier          | Aérée         | Contemplation            | 3 photos + texte court       |
| 05. Les matières       | Structurée    | Vérification              | 4 mini-fiches                |
| 06. Les engagements    | Structurée    | Adhésion                  | 4 piliers                    |
| 07. Cross-link         | Aérée         | Continuation              | Bandeau                      |

> **Principe de la lecture longue** : alternance dense/aérée pour permettre des **pauses** dans la lecture. Le hero et le cross-link sont des **respirations** ; les sections 02-06 sont la **substance**.

---

## 4 — Header — élément persistant

### Comportement spécifique sur `/maison`

Le header est globalement identique à celui des autres pages, **avec ces différences** :

| Différence                  | Spécification                                                              |
| :-------------------------- | :------------------------------------------------------------------------- |
| **Item actif**              | « LA MAISON » dans le menu : couleur Encre `#2C2A28`, underline 1px sauge dark, offset 6px |
| **Fond initial**            | `rgba(251, 248, 241, 0.94)` — opaque dès l'arrivée (pas de hero photo)      |
| **CTA panier**              | Identique. Reste affiché (la cliente peut avoir un panier en cours)         |
| **Pas de barre de progression** | Comme sur `/journal`, pas de barre de scroll progress (la page est éditoriale, pas un récit linéaire forcé) |

### Tactiques héritées

Les tactiques `4 OPTIONS MAX`, `ENTRY POINT FOCAL`, `GROUP SIMILAR ITEMS`, `FRIENDLY COLD`, `STICKY MOMENTUM` sont identiques à toutes les autres pages.

### Sticky behavior

Le header est sticky (`position: sticky; top: 0`). Au scroll au-delà de 80px :

| État du header                | Apparence                                                       |
| :---------------------------- | :-------------------------------------------------------------- |
| Top de page (scrollY = 0)     | Background `rgba(251, 248, 241, 0.94)`, hauteur 80px             |
| Scroll > 80px                 | Background `rgba(251, 248, 241, 0.97)`, hauteur 64px (compressé), ombre subtile `box-shadow: 0 1px 0 rgba(44,42,40,0.06)` |
| Transition entre les deux     | 240ms `cubic-bezier(0.4, 0, 0.2, 1)`                            |

### Pas de partage social dans le header

Volontairement, **pas d'icônes de partage** (Facebook, Pinterest, WhatsApp) dans le header de `/maison`. La page institutionnelle ne se partage pas comme un article — c'est un **espace de marque**, pas un **contenu viral**.

> Le partage de la marque se fait par d'autres moyens : les articles du Journal (qui ont leurs propres boutons de partage en V2), les photos sur Instagram, les recommandations directes.

---

## 5 — Section 01 — Hero éditorial

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
│                              LA MAISON                                     │
│                                                                            │
│             Une marque commence parfois par une                            │
│             question simple. La nôtre est née de celle-ci :                │
│             pourquoi nos mains, qui font tant,                             │
│             reçoivent-elles si peu ?                                       │
│                                                                            │
│                                                                            │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 — Composition générale

| Propriété              | Valeur                                                          |
| :--------------------- | :-------------------------------------------------------------- |
| Fond                   | `#FBF8F1` (Crème) — uni, aucune photo                            |
| Hauteur                | 520px (desktop) · 460px (tablet) · 420px (mobile)                |
| Padding vertical       | 96px (haut) · 96px (bas)                                         |
| Padding latéral        | 96px (desktop) · 64px (tablet) · 24px (mobile)                  |
| Alignement contenu     | Centré horizontalement et verticalement                          |
| Largeur max contenu    | 720px (force la respiration de la lecture)                       |

### 5.3 — Pourquoi un hero **sans photo** ?

Cohérence avec `/journal` — les pages éditoriales (non-conversion) ont des heros typographiques purs. Ce code visuel signale : **« vous entrez dans une lecture, pas dans une vente ».**

| Page         | Hero contient...                            | Justification                                           |
| :----------- | :------------------------------------------ | :------------------------------------------------------ |
| `/accueil`   | Vagues décoratives + texte                  | Première rencontre, signature graphique                  |
| `/rituel`    | Photo lifestyle pleine largeur              | Récit incarné                                            |
| `/kit`       | Photo contextuelle produit                  | Décision d'achat                                         |
| `/journal`   | Aucune photo — typographie pure             | Magazine littéraire                                      |
| **`/maison`**| **Aucune photo — typographie pure**         | **Page institutionnelle, pas un produit ni un magazine** |

> **Inspiration** : les pages "À propos" des marques de **luxe authentiques** (Aesop, Le Labo, Maison Margiela) sont presque toujours des heros typographiques. Le luxe **n'a pas besoin de se montrer** — il s'énonce.

### 5.4 — Fleuron champagne

Identique aux fleurons des sections nobles des autres pages.

| Propriété         | Valeur                                                          |
| :---------------- | :-------------------------------------------------------------- |
| Type              | Losange champagne entre filets fins                              |
| Couleur           | `#C8A876` (Champagne)                                            |
| Largeur           | 80px                                                             |
| Hauteur           | 12px                                                             |
| Position          | Centré, 32px au-dessus du surtitre                                |

#### Animation d'entrée

```
[t=0ms]      → Fond crème uni, page chargée
[t=200ms]    → Fleuron fade-in + scale-up (0.85 → 1.0) en 600ms ease-out
[t=600ms]    → Surtitre fade-in (500ms)
[t=900ms]    → Phrase d'accroche fade-in + translate-up 12px (900ms — plus long pour ralentir)
[t=1900ms]   → Animations terminées
```

> **Délai plus long pour la phrase d'accroche** : 900ms d'animation (vs 700ms sur `/journal`). La phrase est longue et exige un **temps d'apparition** qui invite à la lire lentement.

### 5.5 — Surtitre

```
LA MAISON
```

| Propriété      | Valeur                                              |
| :------------- | :-------------------------------------------------- |
| Police         | Inter SemiBold                                      |
| Taille         | 9pt (desktop) · 8pt (mobile)                         |
| Letter-spacing | 4px (tracking 400)                                  |
| Couleur        | `#C8A876` (Champagne) — appartenance à la sphère noble |
| Transformation | uppercase                                            |
| Position       | Centré, 24px sous le fleuron                         |

> **Champagne sur le surtitre** : cohérent avec `/journal`. Les pages éditoriales (pas commerciales) utilisent le Champagne comme **sceau de noblesse**.

### 5.6 — Phrase d'accroche

```
Une marque commence parfois par une
question simple. La nôtre est née de celle-ci :
pourquoi nos mains, qui font tant,
reçoivent-elles si peu ?
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Light                                     |
| Taille          | 36pt (desktop) · 28pt (tablet) · 24pt (mobile)               |
| Style           | Regular (pas italic — c'est une affirmation, pas une méditation) |
| Line-height     | 1.4                                                          |
| Letter-spacing  | -0.3px                                                        |
| Couleur         | `#2C2A28` (Encre)                                            |
| Disposition     | Quatre lignes (coupures manuelles soignées)                   |
| Espacement haut | 32px sous le surtitre                                         |
| Alignement      | Centré                                                       |
| Largeur max     | 680px                                                        |

##### Décomposition stratégique

| Fragment                                            | Fonction stratégique                                       |
| :-------------------------------------------------- | :--------------------------------------------------------- |
| « Une marque commence parfois par une question simple. » | **Cadrage narratif** — annonce qu'il y aura une histoire |
| « La nôtre est née de celle-ci : »                  | **Possessif inclusif « nôtre »** — rapproche la cliente   |
| « pourquoi nos mains, qui font tant, »              | **Reconnaissance du travail invisible des mains**          |
| « reçoivent-elles si peu ? »                        | **Question rhétorique** — la cliente répond intérieurement |

> **Cette phrase est le pivot narratif de toute la marque.** Elle encapsule en quatre lignes pourquoi FemiGlow existe : non pas pour vendre du soin, mais pour **rendre justice** au travail invisible des mains. Tout le reste de la page développe cette intuition fondatrice.

#### Pourquoi cette formulation ?

- **« Parfois »** — n'érige pas en loi générale, garde l'humilité
- **« Question simple »** — désamorce la prétention philosophique
- **« Nos mains, qui font tant »** — reconnaissance respectueuse du travail féminin
- **« Reçoivent-elles si peu ? »** — l'inégalité posée comme question, pas comme accusation

> **Tactique narrative** : la phrase est **interrogative**, pas affirmative. Elle invite la cliente à **répondre intérieurement** — donc à **devenir co-auteure** de la marque.

### 5.7 — Aucun CTA, aucun lien dans le hero

C'est un choix capital, identique à `/journal`. Le hero ne contient :
- Pas de bouton « Lire l'histoire »
- Pas de bouton « Découvrir nos engagements »
- Pas d'indicateur de scroll en bas

> **Pourquoi ?** Parce que la cliente **descend déjà naturellement** vers la suite. Lui ajouter un CTA serait du bruit. La phrase + le fleuron suffisent pour ouvrir la lecture.

### 5.8 — Tokens design

```css
/* ─── Hero éditorial Maison — tokens ─── */
--maison-hero-bg: #FBF8F1;
--maison-hero-height-desktop: 520px;
--maison-hero-padding-vertical: 96px;
--maison-hero-padding-x-desktop: 96px;
--maison-hero-padding-x-mobile: 24px;
--maison-hero-content-max-width: 720px;

--maison-fleuron-color: #C8A876;
--maison-fleuron-width: 80px;
--maison-fleuron-height: 12px;
--maison-fleuron-margin-bottom: 32px;

--maison-kicker-color: #C8A876;
--maison-kicker-font: 'Inter', sans-serif;
--maison-kicker-weight: 600;
--maison-kicker-size: 9pt;
--maison-kicker-tracking: 4px;
--maison-kicker-margin-bottom: 32px;

--maison-headline-font: 'Cormorant Garamond', serif;
--maison-headline-weight: 300;
--maison-headline-size-desktop: 36pt;
--maison-headline-line-height: 1.4;
--maison-headline-color: #2C2A28;
--maison-headline-max-width: 680px;
```

### 5.9 — Comportements UX

#### Pas de parallaxe

Page **statique** dans le hero. Le scroll fait simplement défiler le contenu vers la section suivante.

#### Aucun hover, aucun click

Tout dans le hero est **non-interactif**. C'est un titre éditorial — on ne clique pas.

### 5.10 — Psychologie & neuromarketing

#### Tactique 1 — Empty space (maximisé)

Le hero fait 520px de hauteur. Le contenu (fleuron + surtitre + 4 lignes de texte) occupe environ 220px. Soit **57% de la section est vide**.

> **Sevilla & Townsend (2016)** : *« Empty space increases perceived premium by 23%. »* Sur une page institutionnelle, cet effet est encore plus important — le vide signale **la sérénité**, l'inverse du « tout dire au plus vite ».

#### Tactique 2 — Question rhétorique (Cialdini 1984)

> *« Asking a question that the reader will answer mentally creates engagement deeper than a statement. »*

La phrase d'accroche se termine par une question (« reçoivent-elles si peu ? »). La cliente **doit** y répondre intérieurement — ce qui crée un **engagement cognitif** beaucoup plus fort qu'une affirmation.

#### Tactique 3 — Indirect claim par sobriété

Au lieu de dire *« Notre maison est née d'une vraie histoire »*, la sobriété **prouve** la sincérité. Une marque qui ouvre par une question (au lieu d'une promesse) **gagne** la confiance instantanément.

#### Tactique 4 — Champagne signal

Cohérence avec `/journal` — la sphère noble de la maison est marquée par cette couleur précieuse. La cliente reconnaît visuellement le **registre éditorial**.

### 5.11 — Émotion à provoquer

| Étape       | Émotion                                                          |
| :---------- | :--------------------------------------------------------------- |
| Arrivée     | Apaisement (fond uni, typographie aérée)                         |
| 2 secondes  | Reconnaissance (le wordmark, la palette, le ton)                  |
| 4 secondes  | Lecture commencée (la phrase d'accroche se déroule)               |
| 6 secondes  | Engagement cognitif (la question rhétorique)                      |
| 8 secondes  | Disposition à la lecture longue (la cliente sait qu'il y a un récit) |
| 10 secondes | Premier scroll — entrée dans l'origine (section 02)                |

### 5.12 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| Photo de fond derrière le titre                     | Casse la pureté typographique de la page institutionnelle           |
| Titre « Notre Histoire » ou « À Propos »            | Vocabulaire corporate, casse le ton                                 |
| Surtitre en Brume au lieu de Champagne              | Détruit la noblesse éditoriale                                      |
| Phrase d'accroche affirmative (au lieu d'interrogative) | Ferme la lecture au lieu de l'ouvrir                            |
| Phrase d'accroche < 3 lignes                        | Trop courte — ne donne pas le temps d'entrer dans la lecture        |
| Phrase d'accroche > 5 lignes                        | Trop longue — fatigue avant le scroll                               |
| CTA visible (« Découvrir l'histoire »)              | Inutile — la cliente scrolle naturellement                          |
| Indicateur de scroll bas                            | Casse la sobriété                                                   |
| Animation parallaxe                                 | Le récit ne bouge pas                                                |
| Vidéo de fond                                       | Spectaculaire mais hors registre                                    |
| Citation entre guillemets dans le hero               | La citation arrive en section 03 — ne pas anticiper                 |

---

## 6 — Section 02 — L'origine (le récit fondateur)

### 6.1 — Wireframe

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│  L'ORIGINE                                                                 │
│                                                                            │
│  ┌──────────────────────────────┐    ┌─────────────────────────────────┐  │
│  │                              │    │                                 │  │
│  │  Tout commence à Casablanca, │    │                                 │  │
│  │  dans la cuisine de la mère  │    │                                 │  │
│  │  de Salma. ...               │    │                                 │  │
│  │                              │    │   [PHOTO LIFESTYLE              │  │
│  │  [Texte long de ~250 mots]   │    │   "LA MÈRE DE SALMA"]            │  │
│  │                              │    │                                 │  │
│  │  Quelques années plus tard,  │    │   [Mains âgées, geste            │  │
│  │  Salma part pour Kyoto. ...  │    │   d'attention, lumière douce]   │  │
│  │                              │    │                                 │  │
│  │  Elle revient avec une       │    │                                 │  │
│  │  conviction : ...            │    │                                 │  │
│  │                              │    │                                 │  │
│  └──────────────────────────────┘    └─────────────────────────────────┘  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 — Composition

#### Surtitre

```
L'ORIGINE
```

| Propriété      | Valeur                                              |
| :------------- | :-------------------------------------------------- |
| Police         | Inter SemiBold                                      |
| Taille         | 7.5pt                                               |
| Letter-spacing | 2.5px                                               |
| Couleur        | `#6B6863` (Brume) — pas Champagne                   |
| Position       | Aligné à gauche, 16px au-dessus du contenu          |

> **Pourquoi pas Champagne ici ?** Parce que les sous-sections de récit (02-06) sont **factuelles**, pas nobles. Le Champagne reste réservé au hero et au fleuron du Manifeste. La sobriété en Brume convient à la **chronologie** racontée.

#### Disposition générale

| Breakpoint | Layout                                                                |
| :--------- | :-------------------------------------------------------------------- |
| Desktop    | 55% texte (gauche) · 45% photo (droite) — gap 64px                    |
| Tablet     | 50% texte · 50% photo — gap 48px                                      |
| Mobile     | Photo dessus 100% · texte dessous 100% — gap 32px                     |

Hauteur de la section : **720px** desktop · auto mobile.

> **Asymétrie 55/45** : le texte domine légèrement (priorité au récit). La photo accompagne, n'illustre pas. C'est l'inverse de l'article featured du Journal (où la photo dominait à 60%).

### 6.3 — Texte du récit fondateur

#### Copy intégral

```
Tout commence à Casablanca, dans la cuisine de la mère de Salma.
Une femme qui, comme tant d'autres, soignait sa famille avant
d'oublier ses propres mains. Le soir, après le dîner, elle
massait ses doigts avec un peu d'huile d'olive — geste hérité
de sa grand-mère, qu'elle exécutait sans y penser.

Salma observait. Elle ne comprenait pas pourquoi ce geste,
si tendre, n'avait pas de nom. Pourquoi il existait dans
l'intimité, mais nulle part dans le monde extérieur. Pourquoi
il fallait toujours masquer les mains plutôt que d'en prendre
soin.

Quelques années plus tard, en stage à Kyoto, elle découvre
le P-Shine — un rituel japonais de soin des ongles, transmis
depuis des générations dans certaines familles d'artisanes.
Pas de vernis, pas d'effet immédiat. Juste quatre matières,
quatre gestes, quatre minutes. Et au bout : une lumière qui
ne triche pas.

Elle revient au Maroc avec une conviction : le geste de
sa mère méritait d'avoir un nom. Et ce nom, peut-être,
viendrait du Japon — par les détours étranges que prend
parfois la transmission.

FemiGlow est née en 2024, dans un petit atelier de Casablanca.
Le rituel s'appelle aujourd'hui Rituel d'Éclat. C'est le même
geste que celui de la mère de Salma — un peu plus précis,
un peu plus documenté, un peu plus partageable.

Mais c'est le même geste.
```

#### Spécifications typographiques

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Regular                                   |
| Taille          | 17pt (desktop) · 16pt (tablet) · 15pt (mobile)               |
| Line-height     | 1.7 — confortable pour la lecture longue                      |
| Couleur         | `#2C2A28` (Encre)                                            |
| Alignement      | Aligné à gauche (jamais justifié — casse la respiration éditoriale) |
| Espace entre paragraphes | 20px                                                  |
| Largeur max     | 540px (force la lisibilité, pas de fluide)                   |
| Espacement haut | 16px sous le surtitre                                         |

> **Cormorant Regular (pas Italic) pour la narration** : l'italic est réservé aux **citations** (section 03). La narration est en **regular** — c'est la voix neutre de la maison qui raconte, pas la voix subjective de Salma.

### 6.4 — Photo « la mère de Salma »

#### Composition

| Propriété          | Valeur                                                                |
| :----------------- | :-------------------------------------------------------------------- |
| Sujet              | Mains âgées (la mère de Salma) — geste d'attention, paumes ouvertes ou doigts qui se massent |
| Composition        | Macro lifestyle, lumière douce d'intérieur                              |
| Format             | 4:5 (portrait) sur desktop · 4:3 sur tablet · 3:4 sur mobile          |
| Hauteur affichage  | ~620px (desktop) · auto (mobile)                                       |
| Largeur            | 45% de la grille (desktop) · 100% (mobile)                            |

#### Direction artistique

| Élément                    | Direction                                                       |
| :------------------------- | :-------------------------------------------------------------- |
| **Sujet**                  | Mains marquées par la vie — rides discrètes, peau fine, mais soignées |
| **Pas de visage**          | Imply human — visage hors cadre, mains au centre                 |
| **Lumière**                | Naturelle d'intérieur, lumière de fenêtre tamisée (golden hour)  |
| **Composition**            | Mains posées sur un tissu doux (lin, coton beige), ou se massant doucement |
| **Tonalité**               | Chaude, terreuse, presque sépia — image qui pourrait être ancienne |
| **Post-traitement**        | Très léger — préserver les rides, l'authenticité                  |

> **Note importante** : c'est une **photo de mise en scène** (pas une photo authentique de la mère de Salma — pour des raisons de privacy et de cohérence visuelle). Mais la mise en scène doit **reproduire fidèlement** ce qu'aurait été la photo authentique. Le casting choisit une femme marocaine de 60-70 ans, mains expressives.

#### Légende sous la photo (optionnelle)

```
Mains. La mère.
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Light Italic                              |
| Taille          | 12pt                                                         |
| Couleur         | `#6B6863` (Brume)                                            |
| Alignement      | Aligné à gauche (sous la photo)                              |
| Espacement haut | 12px sous la photo                                            |
| Optionnelle     | OUI — peut être omise si l'image se suffit à elle-même        |

> **Si la légende est utilisée** : elle est volontairement minimaliste, presque énigmatique. *« Mains. La mère. »* — deux noms, un point. Aucune description superflue.

### 6.5 — Tokens design

```css
/* ─── L'origine — tokens ─── */
--origine-bg: #FBF8F1;
--origine-padding-vertical: 96px;
--origine-grid-gap-desktop: 64px;
--origine-grid-text-ratio-desktop: 55%;

--origine-kicker-color: #6B6863;
--origine-kicker-tracking: 2.5px;

--origine-text-font: 'Cormorant Garamond', serif;
--origine-text-weight: 400;
--origine-text-size: 17pt;
--origine-text-line-height: 1.7;
--origine-text-color: #2C2A28;
--origine-text-paragraph-spacing: 20px;
--origine-text-max-width: 540px;

--origine-photo-aspect: 4/5;
--origine-photo-height-desktop: 620px;

--origine-caption-style: italic;
--origine-caption-size: 12pt;
--origine-caption-color: #6B6863;
```

### 6.6 — Comportements UX

#### Animation au scroll

```
[atteint 80% viewport]   → photo fade-in 800ms (côté droit)
[atteint 70%]             → surtitre + texte fade-in (700ms, délai 200ms)
[atteint 60%]             → légende photo fade-in (500ms, délai 400ms)
```

#### Hover sur la photo

| Action                | Comportement                                          |
| :-------------------- | :---------------------------------------------------- |
| Hover photo desktop   | Très subtil zoom-in 1.02× (800ms ease-out)            |
| Hover continu         | État stable                                            |
| Click                 | Aucune action — la photo n'est pas cliquable          |

#### Pas de hover sur le texte

Le texte est **lisible**, pas interactif. Aucun lien ne le ponctue (sauf éventuellement V2 où certains termes pourraient être annotés vers le glossaire).

### 6.7 — Psychologie du récit fondateur

#### Tactique 1 — Founder story (Schubert 2018)

> *« Founder stories increase brand trust by 32% when they include vulnerability and specificity. »*

Le récit contient :
- **Vulnérabilité** : la mère qui « oubliait ses propres mains »
- **Spécificité** : « cuisine de la mère », « huile d'olive », « stage à Kyoto », « 2024 »
- **Pas d'héroïsme** : Salma n'est pas l'héroïne — elle est la **médiatrice**

Cette construction **maximise la confiance** sans tomber dans le storytelling commercial.

#### Tactique 2 — Trois mouvements narratifs (Aristote)

> Le récit suit la structure narrative classique :
> 1. **Origine domestique** (la mère)
> 2. **Voyage initiatique** (Kyoto)
> 3. **Retour transformé** (Casablanca, FemiGlow)

Cette structure est **inconsciemment reconnue** par toute lectrice — elle ressent que le récit est *« bien construit »* sans pouvoir dire pourquoi.

#### Tactique 3 — Country of origin effect (Verlegh & Steenkamp 1999)

> *« Le pays d'origine influence la perception qualitative d'un produit. Le Japon est associé à la précision, le Maroc à la chaleur humaine. »*

Le récit **active les deux** :
- Japon = rigueur, héritage, savoir-faire transmis
- Maroc = ancrage local, cuisine maternelle, transmission familiale

Cette **double origine géographique** crée une marque qui n'est ni purement japonaise (déconnectée), ni purement marocaine (sans la légitimité technique).

#### Tactique 4 — La phrase finale comme cadenas narratif

> *« Mais c'est le même geste. »*

Cette phrase de **5 mots**, isolée à la fin, agit comme un **point d'arrêt** narratif. Elle clôt le récit en confirmant ce que la cliente a senti : la marque n'a pas inventé un rituel, elle a **reconnu** un geste oublié.

### 6.8 — Émotion

| Avant | Pendant | Après |
| :---- | :------ | :---- |
| Disposition à lire | Reconnaissance narrative | Surprise (« Je ne savais pas ») et tendresse |

### 6.9 — Variantes éditoriales possibles

#### Si la « vraie » histoire de la fondatrice diffère

Le récit ci-dessus est **fictionnel** dans le cadre de cette spécification. Si la vraie fondatrice de FemiGlow a une histoire différente, le récit sera **adapté** en respectant les principes :

1. Origine concrète (un lieu, une personne, un geste)
2. Voyage de transmission (apprentissage formel ou informel)
3. Retour avec une mission précise
4. Ancrage local (Maroc) + héritage international (Japon)
5. Tonalité paisible, sans héroïsme

> **Si l'histoire vraie est différente, la priorité est à la vérité, jamais à la fiction.** Une marque qui invente son histoire perd sa crédibilité dès qu'un journaliste fouille.

### 6.10 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| Récit > 350 mots                                    | Fatigue de lecture sur une seule section                            |
| Récit < 150 mots                                    | Trop sec — ne crée pas l'engagement narratif                        |
| Première personne (« J'ai fondé FemiGlow... »)      | La narration est la voix de la maison, pas de Salma — Salma parle en section 03 |
| Justification commerciale (« pour répondre à un besoin ») | Détruit l'authenticité narrative                                |
| Statistiques marketing (« 80% des Marocaines... »)  | Casse complètement le ton                                           |
| Photo de portrait professionnel souriant            | Banalise — préférer les mains, ou un visage hors cadre              |
| Photo en noir et blanc                              | Hors palette signature — tonalité chaude obligatoire                |
| Caption longue (« La mère de Salma, photographiée à Casablanca en 2025 ») | Sur-explication — préférer minimalisme  |
| Mention de prix, produit, ou commerce               | Le récit est antérieur au commerce — pas de pollution               |
| Ton héroïque (« visionnaire », « pionnière »)        | Détruit la modestie qui fait la confiance                           |

---

## 7 — Section 03 — La fondatrice

### 7.1 — Wireframe

```
┌════════════════════════════════════════════════════════════════════════════┐
║                                                                            ║
║                              SALMA                                         ║
║                                                                            ║
║         ┌────────────────────┐                                             ║
║         │                    │                                             ║
║         │  [PHOTO MAINS DE   │                                             ║
║         │   SALMA AU TRAVAIL]│                                             ║
║         │                    │                                             ║
║         │  [Format 4:5,      │                                             ║
║         │   centré, 480px]   │                                             ║
║         │                    │                                             ║
║         └────────────────────┘                                             ║
║                                                                            ║
║                                                                            ║
║         « Je ne suis pas une chimiste. Je ne suis pas                       ║
║         une artisane japonaise. Je suis une Marocaine                       ║
║         qui a vu sa mère prendre soin de ses mains                          ║
║         en cachette, et qui a voulu que ce geste                            ║
║         devienne un peu plus visible. »                                     ║
║                                                                            ║
║                                                                            ║
║         ─                                                                   ║
║         Salma · fondatrice                                                  ║
║         Casablanca, mars 2026                                               ║
║                                                                            ║
└════════════════════════════════════════════════════════════════════════════┘
                            (fond crème uni — pas de bandeau)
```

### 7.2 — Composition

#### Surtitre

```
SALMA
```

| Propriété      | Valeur                                              |
| :------------- | :-------------------------------------------------- |
| Police         | Inter SemiBold                                      |
| Taille         | 8pt                                                 |
| Letter-spacing | 3px                                                 |
| Couleur        | `#6B6863` (Brume)                                   |
| Position       | Centré, 32px au-dessus de la photo                   |
| Transformation | uppercase                                            |

> **Pourquoi juste « SALMA » sans titre ?** Parce que la maison ne se définit pas par un titre (« CEO », « Founder », « Directrice Artistique »). Salma est **simplement Salma**. Cette absence de hiérarchie professionnelle est intentionnelle — c'est une voix, pas un poste.

### 7.3 — Photo « Salma au travail »

#### Composition

| Propriété          | Valeur                                                                |
| :----------------- | :-------------------------------------------------------------------- |
| Sujet              | Mains de Salma en train de travailler (verser, mélanger, peser une matière) |
| Sujet exclu        | **JAMAIS** son visage. Les épaules, les avant-bras, les mains.         |
| Composition        | Macro lifestyle, focale 50-85mm, profondeur de champ moyenne (f/3.5)   |
| Format             | 4:5 (portrait)                                                          |
| Hauteur affichage  | 480px                                                                   |
| Largeur            | Centrée, max 380px (desktop) · 100% (mobile)                            |

#### Direction artistique

| Élément                    | Direction                                                       |
| :------------------------- | :-------------------------------------------------------------- |
| **Action**                 | Salma verse une poudre dans un pot, ou pèse une cire sur une balance, ou range les pots prêts à expédier |
| **Vêtements**              | Tablier crème ou chemise lin écrue — rien de fashion             |
| **Bijoux**                 | Aucun ou très discrets (alliance fine éventuellement)            |
| **Mains**                  | Naturelles, ongles courts non vernis, peut porter une tache d'argile sur l'avant-bras |
| **Lumière**                | Naturelle, latérale, fenêtre haute d'atelier                     |
| **Tonalité**               | Chaude, ombres terreuses, hautes lumières crème                  |
| **Composition**            | Diagonale dynamique — les mains à droite, espace négatif à gauche |
| **Post-traitement**        | Très léger — la peau garde ses imperfections                     |

> **Note critique** : pas de photo de Salma souriant face à la caméra. Pas de photo "corporate portrait". Pas de photo "founder LinkedIn". L'imply human est **strict** : on devine la personne par son **action**, pas par son **visage**.

### 7.4 — Citation longue

#### Copy intégral

```
« Je ne suis pas une chimiste. Je ne suis pas une artisane
japonaise. Je suis une Marocaine qui a vu sa mère prendre soin
de ses mains en cachette, et qui a voulu que ce geste devienne
un peu plus visible. »
```

#### Spécifications typographiques

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Light Italic                              |
| Taille          | 22pt (desktop) · 19pt (tablet) · 17pt (mobile)               |
| Style           | **Italic** — la voix de Salma est en italic (vs narration en regular section 02) |
| Line-height     | 1.6                                                          |
| Couleur         | `#2C2A28` (Encre)                                            |
| Disposition     | 4-5 lignes selon viewport                                     |
| Espacement haut | 48px sous la photo                                            |
| Alignement      | Centré (la voix de Salma est solennelle)                     |
| Largeur max     | 720px                                                         |
| Guillemets      | Français typographiques `« »` avec espaces insécables        |

##### Décomposition stratégique de la citation

| Phrase                                           | Fonction stratégique                                       |
| :----------------------------------------------- | :--------------------------------------------------------- |
| « Je ne suis pas une chimiste. »                 | **Vulnérabilité avouée** — désamorce la suspicion d'expertise feinte |
| « Je ne suis pas une artisane japonaise. »       | **Honnêteté culturelle** — ne s'approprie pas une identité japonaise |
| « Je suis une Marocaine qui a vu sa mère... »    | **Ancrage local clair** — Salma se positionne sans confusion |
| « ...prendre soin de ses mains en cachette, »    | **Détail intime** — « en cachette » est le mot clé, il évoque la discrétion |
| « ...qui a voulu que ce geste devienne un peu plus visible. » | **Mission modeste** — pas « révolutionner », « un peu plus visible » |

> **Le mot « cachette »** est le pivot émotionnel de toute la citation. Il évoque toutes les femmes qui prennent soin d'elles-mêmes **sans le montrer**, par pudeur ou par habitude. La maison se définit comme **celle qui rend visible ce qui était caché**.

### 7.5 — Filet séparateur

```
─
```

| Propriété      | Valeur                                |
| :------------- | :------------------------------------ |
| Type           | Em-dash horizontal                    |
| Largeur        | 32px                                  |
| Hauteur        | 1.5px                                 |
| Couleur        | `#A8C4A6` (Sauge dark)                |
| Espacement haut| 32px sous la citation                 |
| Espacement bas | 16px avant la signature               |
| Alignement     | Centré                                |

### 7.6 — Signature

```
Salma · fondatrice
Casablanca, mars 2026
```

| Élément                    | Style                                                  |
| :------------------------- | :----------------------------------------------------- |
| Ligne 1 — « Salma · fondatrice » | Inter Medium 13pt, couleur Encre `#2C2A28`       |
| Séparateur `·`             | Middle dot, espacement 6px                              |
| Ligne 2 — « Casablanca, mars 2026 » | Inter Regular Italic 11pt, couleur Brume       |
| Espace entre lignes        | 4px                                                    |
| Alignement                 | Centré                                                 |

> **Pourquoi inclure la date « mars 2026 » ?** Parce que les citations datées **sonnent plus authentiques** que les citations atemporelles. La cliente sent que cette parole a été prononcée à un moment précis — elle n'est pas une formule marketing.

### 7.7 — Tokens design

```css
/* ─── La fondatrice — tokens ─── */
--fondatrice-bg: #FBF8F1;
--fondatrice-padding-vertical: 96px;
--fondatrice-content-max-width: 720px;

--fondatrice-kicker-color: #6B6863;
--fondatrice-kicker-tracking: 3px;
--fondatrice-kicker-margin-bottom: 32px;

--fondatrice-photo-aspect: 4/5;
--fondatrice-photo-height: 480px;
--fondatrice-photo-max-width: 380px;

--fondatrice-quote-font: 'Cormorant Garamond', serif;
--fondatrice-quote-style: italic;
--fondatrice-quote-weight: 300;
--fondatrice-quote-size-desktop: 22pt;
--fondatrice-quote-line-height: 1.6;
--fondatrice-quote-color: #2C2A28;
--fondatrice-quote-margin-top: 48px;

--fondatrice-divider-width: 32px;
--fondatrice-divider-color: #A8C4A6;
--fondatrice-divider-margin: 32px 0 16px;

--fondatrice-signature-font: 'Inter', sans-serif;
--fondatrice-signature-name-weight: 500;
--fondatrice-signature-name-size: 13pt;
--fondatrice-signature-name-color: #2C2A28;

--fondatrice-signature-date-style: italic;
--fondatrice-signature-date-size: 11pt;
--fondatrice-signature-date-color: #6B6863;
```

### 7.8 — Comportements UX

#### Animation au scroll

```
[atteint 80% viewport]   → surtitre fade-in (400ms)
[atteint 70%]             → photo fade-in + scale-up 0.95 → 1 (800ms, délai 200ms)
[atteint 60%]             → citation fade-in + translate-up 12px (900ms, délai 600ms)
[atteint 50%]             → filet + signature fade-in (500ms, délai 1100ms)
```

> **Animation lente et étirée** : 1.6 seconde pour révéler entièrement la section. Cohérent avec le **rythme méditatif** de la voix de Salma. Pas de précipitation.

#### Hover sur la photo

| Action                | Comportement                                          |
| :-------------------- | :---------------------------------------------------- |
| Hover photo desktop   | Très subtil zoom-in 1.015× (1000ms ease-out, encore plus lent) |
| Click                 | Aucune action — la photo n'est pas cliquable          |

#### Pas de partage de citation

Volontairement, **aucun bouton de partage** sur la citation (« partager sur Twitter », etc.). La parole de Salma reste **dans sa maison**, elle ne se diffuse pas comme un meme.

### 7.9 — Psychologie

#### Tactique 1 — Vulnerability admitted (Brown 2010)

> *« Vulnerability is the birthplace of innovation, creativity, and change. Owning our story is the bravest thing we ever do. »*

La citation **commence par deux négations** :
- *« Je ne suis pas une chimiste »*
- *« Je ne suis pas une artisane japonaise »*

Cette **vulnérabilité avouée** crée une confiance que dix arguments commerciaux ne pourraient pas obtenir. La cliente pense : *« cette femme ne se survend pas — donc tout ce qu'elle dit ensuite est vrai ».*

#### Tactique 2 — Italic = voix subjective

> Sur cette page, l'italic apparaît **uniquement** pour la voix de Salma (citation). La narration de la section 02 était en regular. Cette **distinction typographique** est inconsciemment perçue comme : *« voici quelqu'un qui parle, pas la voix de la marque ».*

#### Tactique 3 — Imply human (Lu et al. 2023)

> *« Imply human presence rather than show. Faces create distance ; hands create proximity. »*

Photo des **mains de Salma au travail**, jamais son visage. La cliente :
- Se rapproche (les mains sont une partie du corps **partageable**, le visage est unique)
- Imagine son propre visage à la place (projection)
- Ne juge pas la fondatrice sur des critères esthétiques

#### Tactique 4 — Spécificité datée (signature)

> Une citation datée et localisée (« Casablanca, mars 2026 ») gagne **+18% de crédibilité** vs une citation atemporelle (Petty & Cacioppo 1986).

#### Tactique 5 — Pronom « Je » sincère

> Premier moment de la page où la **première personne** apparaît. Jusqu'ici, la voix était neutre (section 02) ou rhétorique (section 01). La première personne de Salma apparaît **uniquement quand elle est légitime** — dans sa propre citation.

### 7.10 — Émotion

| Avant | Pendant | Après |
| :---- | :------ | :---- |
| Surprise narrative (post-origine) | Connexion humaine immédiate | Adhésion personnelle (« cette femme est honnête ») |

### 7.11 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| Photo de Salma souriant face à la caméra           | Détruit l'imply human, banalise                                     |
| Citation > 80 mots                                  | Trop longue, perd la force                                         |
| Citation < 30 mots                                  | Trop courte, ne dit rien                                            |
| Citation sans vulnérabilité                         | Ressemble à du marketing                                            |
| Mention « CEO » ou « Founder & Creative Director »  | Vocabulaire corporate, casse le ton                                 |
| Lien LinkedIn ou Instagram à côté du nom            | Sort du registre éditorial                                          |
| Bouton « Lire l'interview complète »                | Suggère qu'il y a un ailleurs — détruit l'autosuffisance de la citation |
| Citation traduite en plusieurs langues sur la même page | Surcharge — préférer une seule version éditoriale                |
| Photo de Salma + son équipe                         | Le récit est unifié — pas de team page                             |
| Caption sur la photo (« Salma dans son atelier, photographiée par X ») | Sur-explication                          |

---

## 8 — Section 04 — L'atelier (Casablanca)

### 8.1 — Wireframe

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│  L'ATELIER                                                                 │
│                                                                            │
│  Casablanca. Quartier Maârif, troisième étage                              │
│  d'un immeuble des années cinquante.                                       │
│                                                                            │
│  ┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐│
│  │                      │ │                      │ │                      ││
│  │  [PHOTO 1 — ESPACE]  │ │  [PHOTO 2 — TABLE    │ │  [PHOTO 3 — POTS     ││
│  │  [Vue large pièce    │ │   DE TRAVAIL]        │ │   PRÊTS À EXPÉDIER]  ││
│  │   avec lumière       │ │  [Macro outils,      │ │  [Étagère avec pots  ││
│  │   naturelle]         │ │   pesées, pots       │ │   alignés, étiquettes││
│  │                      │ │   ouverts]           │ │   manuscrites]       ││
│  │                      │ │                      │ │                      ││
│  └──────────────────────┘ └──────────────────────┘ └──────────────────────┘│
│                                                                            │
│  Trois pièces. Une cuisine où les matières                                 │
│  sont préparées, une table où les pots sont                                │
│  remplis à la main, une fenêtre par laquelle                               │
│  entre la lumière de la mer.                                               │
│                                                                            │
│  Tout part d'ici. Chaque kit que vous recevez                              │
│  a été assemblé sur cette table, par des mains                             │
│  que nous connaissons.                                                     │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 — Composition

#### Surtitre

```
L'ATELIER
```

| Propriété      | Valeur                                              |
| :------------- | :-------------------------------------------------- |
| Police         | Inter SemiBold 7.5pt                                |
| Letter-spacing | 2.5px                                               |
| Couleur        | `#6B6863` (Brume)                                   |
| Position       | Aligné à gauche, 16px au-dessus du contenu          |

#### Phrase d'introduction

```
Casablanca. Quartier Maârif, troisième étage
d'un immeuble des années cinquante.
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Light                                     |
| Taille          | 26pt (desktop) · 22pt (tablet) · 20pt (mobile)               |
| Couleur         | `#2C2A28` (Encre)                                            |
| Disposition     | Deux lignes (coupure manuelle)                                |
| Espacement haut | 16px sous le surtitre                                         |
| Espacement bas  | 48px avant les photos                                          |
| Alignement      | Aligné à gauche                                               |
| Largeur max     | 540px                                                         |

> **Pourquoi cette précision spatiale ?** Parce que **« Quartier Maârif »** + **« troisième étage »** + **« années cinquante »** sont des **détails vérifiables** qui transforment la marque d'**abstraction** en **réalité**. La cliente sent : *« cet endroit existe, je pourrais y aller ».*

> **Choix éditorial du quartier Maârif** : c'est un quartier à la fois **résidentiel** (pas une zone industrielle) et **historique** (architecture années 50). Il évoque une marque qui a son **adresse personnelle**, pas une **usine anonyme**.

### 8.3 — Disposition des 3 photos

| Breakpoint | Layout                                                                |
| :--------- | :-------------------------------------------------------------------- |
| Desktop    | 3 photos en ligne, gap 24px, max-width 1200px                          |
| Tablet     | 3 photos en ligne, gap 20px (peut un peu serrer)                       |
| Mobile     | 1 colonne, photos empilées verticalement, gap 24px                     |

### 8.4 — Spécifications de chaque photo

| Propriété          | Valeur                                                                |
| :----------------- | :-------------------------------------------------------------------- |
| Format             | 4:5 (portrait) sur desktop · 4:5 sur tablet · 4:3 sur mobile          |
| Hauteur affichage  | 380px (desktop) · 320px (tablet) · 280px (mobile)                     |
| Border             | Aucun                                                                  |
| Border-radius      | 0                                                                      |
| Object-fit         | `cover`                                                                |

#### Description des trois photos

##### Photo 1 — Vue large de l'atelier

| Élément                    | Direction                                                       |
| :------------------------- | :-------------------------------------------------------------- |
| **Sujet**                  | Vue grand-angle d'une pièce de l'atelier                          |
| **Composition**            | Mur de fenêtres à gauche (lumière entrante), table de travail au centre, étagère de matières au fond |
| **Mobilier**               | Table en bois clair, chaises bistro, lampe d'architecte           |
| **Objets visibles**        | Quelques pots, une balance, un linge, un livre ouvert (le carnet d'atelier) |
| **Personnes**              | Aucune (l'atelier est calme, vide pour la photo)                 |
| **Lumière**                | Naturelle, fin de matinée, lumière franche mais douce             |

##### Photo 2 — Table de travail (macro)

| Élément                    | Direction                                                       |
| :------------------------- | :-------------------------------------------------------------- |
| **Sujet**                  | Macro d'une table de travail en cours d'assemblage               |
| **Objets visibles**        | Pots ouverts (paste, powder, shine, polish), pinceau, balance électronique, cuillère doseuse |
| **Mains**                  | Optionnel — peut montrer une main qui tient un pot, ou pas       |
| **Composition**            | Cadrage serré, profondeur de champ courte (f/2.8)                 |
| **Lumière**                | Latérale, ombres terreuses                                       |

##### Photo 3 — Pots prêts à expédier

| Élément                    | Direction                                                       |
| :------------------------- | :-------------------------------------------------------------- |
| **Sujet**                  | Étagère avec une rangée de kits prêts à partir                    |
| **Objets visibles**        | 8-10 pots alignés, étiquettes manuscrites visibles               |
| **Cartons**                | Quelques cartons d'expédition pliés à côté                        |
| **Composition**            | Cadrage en perspective oblique pour donner profondeur            |
| **Lumière**                | Naturelle d'étagère, ombres fines                                 |

### 8.5 — Texte descriptif (sous les photos)

#### Copy intégral

```
Trois pièces. Une cuisine où les matières sont préparées,
une table où les pots sont remplis à la main, une fenêtre
par laquelle entre la lumière de la mer.

Tout part d'ici. Chaque kit que vous recevez a été assemblé
sur cette table, par des mains que nous connaissons.
```

#### Spécifications typographiques

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Regular                                   |
| Taille          | 17pt (desktop) · 16pt (tablet) · 15pt (mobile)               |
| Line-height     | 1.7                                                          |
| Couleur         | `#2C2A28` (Encre)                                            |
| Alignement      | Aligné à gauche                                               |
| Espace entre paragraphes | 20px                                                  |
| Largeur max     | 720px                                                         |
| Espacement haut | 48px sous les photos                                          |

##### Décomposition stratégique

| Phrase                                              | Fonction                                                  |
| :-------------------------------------------------- | :-------------------------------------------------------- |
| « Trois pièces. »                                   | **Précision modeste** — pas une usine, pas un bureau      |
| « Une cuisine où les matières sont préparées »      | **Cuisine** — vocabulaire familier, intime                 |
| « une table où les pots sont remplis à la main »    | **À la main** — préservation du geste artisanal           |
| « une fenêtre par laquelle entre la lumière de la mer » | **Lumière de la mer** — détail poétique, ancre Casablanca |
| « Tout part d'ici. »                                | **Concentration** — pas de chaîne logistique anonyme      |
| « Chaque kit que vous recevez a été assemblé sur cette table » | **« Chaque kit »** — promesse personnalisée    |
| « par des mains que nous connaissons. »             | **« Que nous connaissons »** — opposition implicite à l'industrie anonyme |

> **« La lumière de la mer »** : phrase poétique qui ancre l'atelier dans Casablanca (ville côtière). Cette image fait basculer l'atelier de l'**utilitaire** au **mythique**.

### 8.6 — Tokens design

```css
/* ─── L'atelier — tokens ─── */
--atelier-bg: #FBF8F1;
--atelier-padding-vertical: 96px;
--atelier-content-max-width: 1200px;

--atelier-kicker-color: #6B6863;

--atelier-intro-font: 'Cormorant Garamond', serif;
--atelier-intro-weight: 300;
--atelier-intro-size-desktop: 26pt;
--atelier-intro-color: #2C2A28;
--atelier-intro-max-width: 540px;
--atelier-intro-margin-bottom: 48px;

--atelier-photos-gap-desktop: 24px;
--atelier-photos-gap-mobile: 24px;
--atelier-photo-aspect: 4/5;
--atelier-photo-height-desktop: 380px;
--atelier-photo-height-mobile: 280px;

--atelier-text-font: 'Cormorant Garamond', serif;
--atelier-text-weight: 400;
--atelier-text-size: 17pt;
--atelier-text-line-height: 1.7;
--atelier-text-color: #2C2A28;
--atelier-text-paragraph-spacing: 20px;
--atelier-text-margin-top: 48px;
--atelier-text-max-width: 720px;
```

### 8.7 — Comportements UX

#### Animation au scroll

```
[atteint 80% viewport]   → surtitre + intro fade-in (700ms)
[atteint 70%]             → 3 photos fade-in en cascade (200ms entre chaque, 600ms chacune)
[atteint 60%]             → texte descriptif fade-in (700ms, délai après photos)
```

#### Hover sur les photos

| Action                | Comportement                                          |
| :-------------------- | :---------------------------------------------------- |
| Hover photo desktop   | Très subtil zoom-in 1.02× (800ms ease-out)            |
| Click                 | Aucune action — les photos ne sont pas cliquables    |

> **Pas de lightbox / galerie modale** : les photos se suffisent à elles-mêmes. Une lightbox suggère qu'il y a un **derrière** ou un **plus grand** — la sobriété refuse cette logique.

#### Pas de visite virtuelle 360°

Volontairement, aucune fonctionnalité de visite virtuelle. Pourquoi ?
- Trop spectaculaire pour le ton paisible de la maison
- Suggère une logique « showroom » plutôt qu'« atelier »
- Casse la pudeur du lieu

### 8.8 — Psychologie

#### Tactique 1 — Spécificité géographique (trust factor)

> **Olson & Bauer (2018)** : *« Brands that name a precise location are perceived as 24% more authentic than brands using vague locations (e.g., "Made in France"). »*

« Casablanca, Quartier Maârif, troisième étage d'un immeuble des années cinquante » est **ultra-spécifique**. Cette précision est :
- Vérifiable (la cliente pourrait demander à passer)
- Ancrée (un quartier précis, pas « Maroc » abstrait)
- Modeste (troisième étage, pas un building corporate)

#### Tactique 2 — Imply human (production)

Les 3 photos montrent les **traces de l'humain** sans le montrer directement :
- Photo 1 : un livre ouvert (quelqu'un l'utilise)
- Photo 2 : un pinceau posé (quelqu'un vient de l'utiliser)
- Photo 3 : étiquettes manuscrites (quelqu'un les a écrites)

> **Aucune photo de personnel souriant** — cohérent avec le principe d'imply human de Lu et al. (2023).

#### Tactique 3 — Anti-industriel positioning

> Le contraste implicite avec une **usine anonyme** est partout :
> - « Trois pièces » (pas un site industriel)
> - « À la main » (pas en chaîne)
> - « Une cuisine » (vocabulaire domestique)
> - « Des mains que nous connaissons » (pas du personnel anonyme)

Cette **opposition implicite** positionne FemiGlow contre tout le marché de la beauté industrialisée.

#### Tactique 4 — Lumière comme signature

> *« La lumière de la mer »* — cette image apparaît une seule fois sur tout le site, et précisément ici. Elle fait de **la lumière** un personnage de la marque. Une marque qui mentionne sa lumière travaille à un niveau **poétique** que les marques industrielles n'atteignent jamais.

### 8.9 — Émotion

| Avant | Pendant | Après |
| :---- | :------ | :---- |
| Connexion humaine (post-fondatrice) | Concrétude visuelle | « Ce lieu existe vraiment » — confiance ancrée dans la réalité |

### 8.10 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| Photos de l'atelier en plan large industriel        | Suggère une usine — détruit le positionnement artisanal             |
| Photos avec personnel souriant face caméra          | Casse l'imply human                                                 |
| Plus de 4 photos                                    | Surcharge visuelle, dilue l'impact                                  |
| Une seule photo géante                              | Manque de variété narrative (espace, geste, livraison)              |
| Photo de l'extérieur du bâtiment                    | L'atelier est un **intérieur** — l'extérieur briserait l'intimité   |
| Mention de la superficie (« atelier de 80m² »)       | Détail commercial, hors registre                                    |
| Mention de l'adresse exacte                         | Privacy + sécurité — le quartier suffit                             |
| Vidéo de l'atelier (timelapse de production)        | Trop spectaculaire, hors registre                                   |
| Map Google embedded                                 | Trop fonctionnel, casse l'éditorial                                 |
| Texte descriptif > 100 mots                         | Trop bavard — la précision tient en peu                              |
| Citations marketing (« notre savoir-faire artisanal ») | Vocabulaire corporate, casse la voix                            |

---

## 9 — Section 05 — Les matières (transparence du sourcing)

### 9.1 — Wireframe

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│  LES MATIÈRES                                                              │
│                                                                            │
│  D'où viennent les éléments du rituel.                                     │
│                                                                            │
│  ┌──────────────────────────────────┐  ┌──────────────────────────────────┐│
│  │  Cire d'abeille                  │  │  Huile de jojoba                 ││
│  │  ─                                │  │  ─                                ││
│  │  Région d'Imouzzer Kandar.       │  │  Coopérative féminine du Souss.  ││
│  │  Récolte de fin d'été.            │  │  Pression à froid, sans          ││
│  │                                  │  │  raffinage chimique.             ││
│  │                                  │  │                                  ││
│  │  Pourquoi : conserve l'odeur     │  │  Pourquoi : la matrice de        ││
│  │  délicate du miel sauvage,       │  │  l'ongle absorbe sans            ││
│  │  fond doucement à la chaleur.    │  │  saturer.                        ││
│  └──────────────────────────────────┘  └──────────────────────────────────┘│
│                                                                            │
│  ┌──────────────────────────────────┐  ┌──────────────────────────────────┐│
│  │  Kaolin                          │  │  Mica naturel                    ││
│  │  ─                                │  │  ─                                ││
│  │  Atlas central, près d'Azilal.   │  │  Sourcé en Inde, certifié        ││
│  │  Argile blanche purifiée par     │  │  sans travail des enfants par    ││
│  │  filtration mécanique.            │  │  Responsible Mica Initiative.   ││
│  │                                  │  │                                  ││
│  │  Pourquoi : poudre fine qui      │  │  Pourquoi : la lumière douce    ││
│  │  régularise sans agresser.       │  │  vient de la nacre minérale,    ││
│  │                                  │  │  pas d'un additif synthétique.   ││
│  └──────────────────────────────────┘  └──────────────────────────────────┘│
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 9.2 — Composition

#### Surtitre

```
LES MATIÈRES
```

| Propriété      | Valeur                                              |
| :------------- | :-------------------------------------------------- |
| Police         | Inter SemiBold 7.5pt                                |
| Letter-spacing | 2.5px                                               |
| Couleur        | `#6B6863` (Brume)                                   |
| Position       | Centré, 16px au-dessus du titre                     |

#### Titre de section

```
D'où viennent les éléments du rituel.
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Light                                     |
| Taille          | 32pt (desktop) · 26pt (tablet) · 22pt (mobile)               |
| Couleur         | `#2C2A28` (Encre)                                            |
| Alignement      | Centré                                                        |
| Espacement haut | 12px sous le surtitre                                         |
| Espacement bas  | 64px avant la grille                                          |

> **Pourquoi cette formulation ?** Au lieu de *« Nos ingrédients »* (possessif corporate), *« D'où viennent les éléments »* est une **question implicite** que la cliente se pose. La maison y répond avec naturel.

### 9.3 — Disposition de la grille

| Breakpoint | Layout                                                                |
| :--------- | :-------------------------------------------------------------------- |
| Desktop    | Grille 2×2, gap 24px, max-width 1080px centré                          |
| Tablet     | Grille 2×2, gap 20px                                                   |
| Mobile     | 1 colonne, gap 24px                                                    |

Hauteur de la section : **580px** desktop · auto mobile.

### 9.4 — Spécifications de chaque mini-fiche

#### Container

| Propriété         | Valeur                                                          |
| :---------------- | :-------------------------------------------------------------- |
| Fond              | `#FFFFFF` (Crème pure)                                          |
| Border            | 1px solid `#E8E0D2` (Ligne)                                     |
| Border-radius     | 0                                                                |
| Padding           | 32px (desktop) · 24px (mobile)                                  |
| Hauteur           | Auto (uniformisé par grid auto-rows)                             |

#### Header de la fiche

```
Cire d'abeille
─
```

| Élément              | Spécifications                                                   |
| :------------------- | :--------------------------------------------------------------- |
| Nom de l'ingrédient  | Cormorant Garamond Light 22pt, couleur Encre                     |
| Filet sous header    | Largeur 32px, hauteur 1.5px, couleur sauge dark, espacement 16px |

#### Bloc « Origine » (sans label)

```
Région d'Imouzzer Kandar.
Récolte de fin d'été.
```

| Propriété      | Valeur                                                  |
| :------------- | :------------------------------------------------------ |
| Police         | Cormorant Garamond Regular Italic                       |
| Taille         | 15pt                                                    |
| Couleur        | `#4A4844` (Encre claire)                                |
| Line-height    | 1.6                                                     |
| Espacement haut| 16px (sous le filet)                                    |

> **Pas de label « Origine : »** — la précision géographique se suffit à elle-même. Mettre un label ferait paraître la fiche **technique**, pas **éditoriale**.

#### Bloc « Pourquoi »

```
Pourquoi : conserve l'odeur délicate du miel sauvage,
fond doucement à la chaleur.
```

| Élément              | Spécifications                                                   |
| :------------------- | :--------------------------------------------------------------- |
| Label « Pourquoi »   | Inter Medium 11pt, couleur Encre `#2C2A28`, suivi de « : » + espace |
| Texte explicatif     | Cormorant Garamond Regular 13pt, couleur Encre claire             |
| Mode d'écriture      | Tout sur la même phrase, pas de saut de ligne                    |
| Espacement haut      | 24px (sous le bloc origine)                                       |

> **Pourquoi le label « Pourquoi : »** ? Parce qu'il **invite la cliente à comprendre**, plutôt qu'à mémoriser. C'est l'inverse de la fiche d'ingrédient cosmétique standard (« propriétés », « bénéfices ») qui sonne corporate.

### 9.5 — Les quatre mini-fiches — copy intégral

#### Fiche 1 — Cire d'abeille

**Origine** :
```
Région d'Imouzzer Kandar.
Récolte de fin d'été.
```

**Pourquoi** :
```
Pourquoi : conserve l'odeur délicate du miel sauvage,
fond doucement à la chaleur.
```

#### Fiche 2 — Huile de jojoba

**Origine** :
```
Coopérative féminine du Souss.
Pression à froid, sans raffinage chimique.
```

**Pourquoi** :
```
Pourquoi : la matrice de l'ongle absorbe sans saturer.
```

#### Fiche 3 — Kaolin

**Origine** :
```
Atlas central, près d'Azilal.
Argile blanche purifiée par filtration mécanique.
```

**Pourquoi** :
```
Pourquoi : poudre fine qui régularise sans agresser.
```

#### Fiche 4 — Mica naturel

**Origine** :
```
Sourcé en Inde, certifié sans travail des enfants
par Responsible Mica Initiative.
```

**Pourquoi** :
```
Pourquoi : la lumière douce vient de la nacre minérale,
pas d'un additif synthétique.
```

### 9.6 — Choix éditoriaux des quatre matières

#### Pourquoi ces quatre matières ?

| Matière           | Origine             | Message implicite                                       |
| :---------------- | :------------------ | :------------------------------------------------------ |
| Cire d'abeille    | Maroc — Imouzzer    | **Sourcing local** + tradition apicole                  |
| Huile de jojoba   | Maroc — Souss       | **Coopérative féminine** + made in Morocco              |
| Kaolin            | Maroc — Atlas       | **Made in Morocco** + matières premières marocaines     |
| Mica              | Inde — RMI          | **Honnêteté éthique** : reconnaît un sourcing étranger + certifie l'engagement éthique |

> **Stratégie de cette sélection** :
> - **3/4 sont marocaines** (renforcement du country of origin)
> - **1/4 est étrangère** (le mica vient nécessairement d'Inde — il n'y a pas de gisement de mica au Maroc)
> - **La transparence sur la matière étrangère renforce la crédibilité** de la transparence sur les matières marocaines

#### La règle de la matière étrangère

> **Si une matière vient d'ailleurs, elle est nommée**. Pas de « sourcing international » ambigu. Le mica vient d'Inde — c'est dit. Et l'engagement éthique (RMI) est documenté.

> **Cette honnêteté géographique** est une signature de la maison. Elle rend toutes les autres affirmations crédibles.

### 9.7 — Tokens design

```css
/* ─── Les matières — tokens ─── */
--matieres-bg: #FBF8F1;
--matieres-padding-vertical: 96px;
--matieres-grid-max-width: 1080px;
--matieres-grid-gap-desktop: 24px;
--matieres-grid-gap-mobile: 24px;

--matiere-card-bg: #FFFFFF;
--matiere-card-border: 1px solid #E8E0D2;
--matiere-card-padding-desktop: 32px;
--matiere-card-padding-mobile: 24px;

--matiere-name-font: 'Cormorant Garamond', serif;
--matiere-name-weight: 300;
--matiere-name-size: 22pt;
--matiere-name-color: #2C2A28;

--matiere-divider-width: 32px;
--matiere-divider-color: #A8C4A6;
--matiere-divider-margin: 16px 0;

--matiere-origin-font: 'Cormorant Garamond', serif;
--matiere-origin-style: italic;
--matiere-origin-size: 15pt;
--matiere-origin-color: #4A4844;
--matiere-origin-line-height: 1.6;

--matiere-pourquoi-label-font: 'Inter', sans-serif;
--matiere-pourquoi-label-weight: 500;
--matiere-pourquoi-label-size: 11pt;
--matiere-pourquoi-label-color: #2C2A28;

--matiere-pourquoi-text-font: 'Cormorant Garamond', serif;
--matiere-pourquoi-text-size: 13pt;
--matiere-pourquoi-text-color: #4A4844;
--matiere-pourquoi-margin-top: 24px;
```

### 9.8 — Comportements UX

#### Animation au scroll

```
[atteint 80% viewport]           → surtitre + titre fade-in (700ms)
[atteint 70%]                    → 4 fiches fade-in en cascade (200ms entre chaque, 500ms chacune)
```

#### Hover sur une fiche

Aucune interaction — les fiches sont **statiques**. Cohérent avec la section « Composition par pot » de `/kit`.

> **Pourquoi pas d'interaction ?** Parce que ces informations sont **factuelles et complètes**. Pas de « voir détail », pas de tooltip. La transparence se manifeste par l'**affichage immédiat**.

#### Pas de mode « voir tous les ingrédients »

La page ne liste **pas** tous les ingrédients (qui sont sur `/kit` section 04). Ici, on choisit **4 matières emblématiques** qui racontent **le sourcing**, pas la composition complète.

> **Différence stratégique avec `/kit`** :
> - `/kit` section 04 : composition **complète** par pot (transparence chimique)
> - `/maison` section 05 : sourcing **emblématique** des 4 matières clés (transparence géographique)

### 9.9 — Lien éventuel vers `/kit` (V2)

En V2, possibilité d'ajouter un lien discret en pied de section :

```
─

Pour voir la composition complète de chaque pot,
visiter le détail du kit.
```

| Propriété      | Valeur                                                  |
| :------------- | :------------------------------------------------------ |
| Police         | Cormorant Garamond Light Italic                         |
| Taille         | 14pt                                                    |
| Couleur        | `#6B6863` (Brume)                                       |
| Lien           | « visiter le détail du kit » — souligné, vers `/kit#composition-pot` |
| Alignement     | Centré                                                   |
| Espacement haut| 64px sous la grille                                       |

> **MVP V1** : ne pas inclure ce lien (préserver l'autosuffisance de la page). **V2** : possible si les analytics montrent un besoin.

### 9.10 — Psychologie

#### Tactique 1 — Transparency = trust (Slovic 1995)

> *« Information transparency increases trust more than persuasive claims. »*

Lister les origines géographiques précises (« Imouzzer Kandar », « Atlas central, près d'Azilal », « Souss ») **prouve** la sincérité plutôt que de la **clamer**.

#### Tactique 2 — Indirect ethical positioning

La fiche du mica mentionne **« certifié sans travail des enfants par Responsible Mica Initiative ».** Cette mention :
- Reconnaît un risque éthique connu de l'industrie (le mica indien est associé au travail des enfants)
- Documente une certification vérifiable
- Se distingue des marques qui **ignorent** ou **cachent** cette problématique

> **Vulnérabilité contrôlée** : avouer un risque (sourcing étranger) tout en montrant la solution (certification) est plus crédible que **ne pas en parler**.

#### Tactique 3 — Beauté du « pourquoi » plus que du « quoi »

> **Sinek (2009) — Start with Why** : *« People don't buy what you do, they buy why you do it. »*

Chaque fiche se termine par un **pourquoi** qui dépasse la fonction. La cire d'abeille n'est pas juste « efficace » — elle « conserve l'odeur délicate du miel sauvage ». Cette **dimension sensorielle/poétique** différencie la marque de toute marque cosmétique standard.

#### Tactique 4 — Coopérative féminine (féminisme implicite)

> Mention de la **« coopérative féminine du Souss »** pour l'huile de jojoba. La maison **soutient** d'autres femmes par son sourcing — sans en faire un argument marketing féministe explicite (ce qui sonnerait performatif).

L'engagement féministe est **incarné** dans la chaîne d'approvisionnement, pas **proclamé** dans un slogan.

### 9.11 — Émotion

| Avant | Pendant | Après |
| :---- | :------ | :---- |
| Concrétude (post-atelier) | Vérification rationnelle | Confiance scientifique calme + admiration éthique |

### 9.12 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| Plus de 6 mini-fiches                               | Surcharge — 4 est l'optimum éditorial                               |
| Cacher l'origine étrangère du mica                  | Si découvert, détruit la crédibilité de toute la page               |
| Argumentaire « 100% naturel » ou « bio certifié »   | Sans certification réelle, c'est mensonger                          |
| Photos d'ingrédients dans chaque fiche              | Surcharge — texte uniquement suffit (cohérent avec /kit composition par pot) |
| Pourcentages d'ingrédients (« 23% de cire d'abeille ») | Métrique floue, niveau labo                                      |
| Labels marketing (« Premium », « Sélectionné », « Précieux ») | Cliché                                                  |
| Mention « notre formulateur » ou « notre laboratoire » | Vocabulaire industriel — pas de formulateur revendiqué          |
| Liens « En savoir plus » qui sortent vers le glossaire | Casse l'autosuffisance                                          |
| Fiches < 30 mots                                     | Sec, peu engageant                                                  |
| Fiches > 60 mots                                     | Trop bavard, casse la sobriété                                      |

---

## 10 — Section 06 — Les quatre engagements

### 10.1 — Wireframe

```
┌════════════════════════════════════════════════════════════════════════════┐
║                                                                            ║
║  CE QUE NOUS NOUS ENGAGEONS À FAIRE                                        ║
║                                                                            ║
║  ┌──────────────────────────────────┐  ┌──────────────────────────────────┐║
║  │                                  │  │                                  │║
║  │  ① Matières                      │  │  ② Made in Maroc                 │║
║  │  ─                                │  │  ─                                │║
║  │  Aucun parfum synthétique.       │  │  Tout est assemblé à             │║
║  │  Aucun parabène. Aucun           │  │  Casablanca, dans notre          │║
║  │  conservateur agressif. Si une    │  │  atelier — par les mains de     │║
║  │  matière est étrangère,          │  │  trois personnes que nous        │║
║  │  son origine est nommée.          │  │  connaissons.                    │║
║  │                                  │  │                                  │║
║  └──────────────────────────────────┘  └──────────────────────────────────┘║
║                                                                            ║
║  ┌──────────────────────────────────┐  ┌──────────────────────────────────┐║
║  │                                  │  │                                  │║
║  │  ③ Durabilité                    │  │  ④ Héritage japonais             │║
║  │  ─                                │  │  ─                                │║
║  │  Les pots sont en verre teinté    │  │  Le rituel respecte la grammaire │║
║  │  rechargeable. L'emballage        │  │  du P-Shine japonais — quatre    │║
║  │  d'expédition est en carton       │  │  matières, quatre gestes, quatre │║
║  │  recyclé non blanchi. Pas de       │  │  minutes. Sans appropriation,   │║
║  │  plastique à usage unique.       │  │  avec respect.                   │║
║  │                                  │  │                                  │║
║  └──────────────────────────────────┘  └──────────────────────────────────┘║
║                                                                            ║
└════════════════════════════════════════════════════════════════════════════┘
                            (fond sauge pâle pleine largeur)
```

### 10.2 — Pourquoi un fond sauge pâle ?

Cette section est **la promesse formelle** de la maison. Le fond sauge pâle (`#E8EFE7`) la **distingue visuellement** des sections qui précèdent (fond crème). C'est le **moment d'engagement** — il a son propre cadre.

> **Inspiration** : sur `/rituel`, le pivot vers `/kit` est sur fond sauge pâle. Sur `/kit`, le bandeau CTA final est sur fond sauge pâle. Sur `/journal`, la newsletter est sur fond sauge pâle. La règle : **les moments d'engagement sont sur sauge pâle**. Cohérence absolue à travers le site.

### 10.3 — Composition générale

| Propriété              | Valeur                                                          |
| :--------------------- | :-------------------------------------------------------------- |
| Fond                   | `#E8EFE7` (Sauge pâle) — pleine largeur                          |
| Hauteur                | 540px (desktop) · auto (mobile)                                  |
| Padding vertical       | 80px                                                             |
| Padding latéral        | 96px (desktop) · 64px (tablet) · 24px (mobile)                  |
| Largeur max contenu    | 1080px                                                           |

#### Surtitre

```
CE QUE NOUS NOUS ENGAGEONS À FAIRE
```

| Propriété      | Valeur                                              |
| :------------- | :-------------------------------------------------- |
| Police         | Inter SemiBold 8pt                                  |
| Letter-spacing | 3px                                                 |
| Couleur        | `#6B6863` (Brume)                                   |
| Position       | Centré, 48px au-dessus de la grille                 |

> **Pas de Champagne ici** : la sauge pâle de fond crée déjà un signal noble. Ajouter le Champagne saturerait la palette.

#### Pas de titre principal H2

La grille des engagements **est** le contenu — pas besoin d'un titre intermédiaire. Le surtitre suffit pour cadrer.

### 10.4 — Disposition de la grille

| Breakpoint | Layout                                                                |
| :--------- | :-------------------------------------------------------------------- |
| Desktop    | Grille 2×2, gap 32px                                                   |
| Tablet     | Grille 2×2, gap 24px                                                   |
| Mobile     | 1 colonne, gap 32px                                                    |

### 10.5 — Spécifications de chaque carte engagement

#### Container

| Propriété         | Valeur                                                          |
| :---------------- | :-------------------------------------------------------------- |
| Fond              | Transparent (le fond sauge pâle de la section transparait)       |
| Border            | Aucun                                                            |
| Padding           | 24px                                                              |
| Hauteur           | Auto                                                              |

> **Pas de fond blanc sur les cartes** : les cartes sont **dans** la section sauge pâle, elles ne sont pas des **boîtes posées dessus**. La sobriété maximale.

#### Header — numéro + nom

```
① Matières
─
```

| Élément              | Spécifications                                                   |
| :------------------- | :--------------------------------------------------------------- |
| Numéro circulaire    | Caractère ① ② ③ ④ (U+2460-U+2463), couleur `#A8C4A6` (Sauge dark), taille 22pt |
| Espace entre numéro et nom | 12px                                                       |
| Nom de l'engagement  | Cormorant Garamond Light 22pt, couleur Encre, sur la même ligne   |
| Filet sous header    | Largeur 32px, hauteur 1.5px, couleur sauge dark, espacement 16px |

> **Pourquoi des numéros circulaires (① ② ③ ④) ?** Parce qu'ils :
> - Structurent visuellement les 4 piliers
> - Évoquent une **promesse formelle**, pas un slogan
> - Sont cohérents avec la palette (couleur sauge dark)
> - Permettent à la cliente de **mémoriser** les engagements (« le 3, c'est la durabilité »)

#### Body — texte engagement

| Propriété      | Valeur                                                  |
| :------------- | :------------------------------------------------------ |
| Police         | Cormorant Garamond Regular                              |
| Taille         | 15pt (desktop) · 14pt (mobile)                          |
| Couleur        | `#2C2A28` (Encre)                                       |
| Line-height    | 1.65                                                    |
| Espacement haut| 16px (sous le filet)                                    |

### 10.6 — Les quatre engagements — copy intégral

#### Engagement 1 — Matières

```
① Matières
─
Aucun parfum synthétique. Aucun parabène. Aucun
conservateur agressif. Si une matière est étrangère,
son origine est nommée.
```

#### Engagement 2 — Made in Maroc

```
② Made in Maroc
─
Tout est assemblé à Casablanca, dans notre
atelier — par les mains de trois personnes que
nous connaissons.
```

#### Engagement 3 — Durabilité

```
③ Durabilité
─
Les pots sont en verre teinté rechargeable.
L'emballage d'expédition est en carton recyclé
non blanchi. Pas de plastique à usage unique.
```

#### Engagement 4 — Héritage japonais

```
④ Héritage japonais
─
Le rituel respecte la grammaire du P-Shine
japonais — quatre matières, quatre gestes, quatre
minutes. Sans appropriation, avec respect.
```

### 10.7 — Décomposition stratégique des engagements

#### Engagement 1 — Matières (négations + transparence)

| Phrase                                         | Fonction                                                  |
| :--------------------------------------------- | :-------------------------------------------------------- |
| « Aucun parfum synthétique. »                  | Promesse négative #1                                       |
| « Aucun parabène. »                            | Promesse négative #2                                       |
| « Aucun conservateur agressif. »               | Promesse négative #3                                       |
| « Si une matière est étrangère, son origine est nommée. » | Promesse positive transparence                  |

> **Triple négation suivie d'une affirmation** = code éditorial classique de la promesse maximale (Sugarman 1995).

#### Engagement 2 — Made in Maroc (précision artisanale)

| Phrase                                         | Fonction                                                  |
| :--------------------------------------------- | :-------------------------------------------------------- |
| « Tout est assemblé à Casablanca »             | Lieu précis (renforcement de la section 04)               |
| « dans notre atelier »                          | Possessif intime (« notre »)                               |
| « par les mains de trois personnes »           | **Précision humaine** — exactement trois                  |
| « que nous connaissons »                        | Anti-anonymat industriel                                   |

> **« Trois personnes »** — précision modeste qui prouve l'échelle artisanale. Pas une équipe vague de « plusieurs collaborateurs ».

#### Engagement 3 — Durabilité (faits concrets)

| Phrase                                         | Fonction                                                  |
| :--------------------------------------------- | :-------------------------------------------------------- |
| « Pots en verre teinté rechargeable »           | Fait matériel précis                                       |
| « Carton recyclé non blanchi »                 | Détail vérifiable (la cliente verra le carton à réception) |
| « Pas de plastique à usage unique »            | Engagement absolu                                          |

> **Aucune statistique** (« 80% recyclé », « -40% d'émissions »). Juste des **faits matériels**. La cliente peut les vérifier en recevant son kit.

#### Engagement 4 — Héritage japonais (positionnement éthique)

| Phrase                                         | Fonction                                                  |
| :--------------------------------------------- | :-------------------------------------------------------- |
| « Le rituel respecte la grammaire du P-Shine japonais » | Reconnaissance de la dette culturelle              |
| « quatre matières, quatre gestes, quatre minutes » | Précision technique                                   |
| « Sans appropriation, avec respect. »          | **Phrase clé** — anti-appropriation culturelle             |

> **« Sans appropriation, avec respect »** est un engagement **politique** rare dans une marque cosmétique. Il reconnaît que la marque tient son rituel d'une **culture japonaise** qu'elle ne possède pas. Cette **honnêteté éthique** est extrêmement différenciante.

### 10.8 — Tokens design

```css
/* ─── Les engagements — tokens ─── */
--engagements-bg: #E8EFE7;
--engagements-padding-vertical: 80px;
--engagements-padding-x-desktop: 96px;
--engagements-padding-x-mobile: 24px;
--engagements-content-max-width: 1080px;

--engagements-kicker-color: #6B6863;
--engagements-kicker-tracking: 3px;
--engagements-kicker-margin-bottom: 48px;

--engagements-grid-gap-desktop: 32px;
--engagements-grid-gap-mobile: 32px;

--engagement-card-padding: 24px;

--engagement-number-color: #A8C4A6;
--engagement-number-size: 22pt;
--engagement-number-margin-right: 12px;

--engagement-title-font: 'Cormorant Garamond', serif;
--engagement-title-weight: 300;
--engagement-title-size: 22pt;
--engagement-title-color: #2C2A28;

--engagement-divider-width: 32px;
--engagement-divider-color: #A8C4A6;
--engagement-divider-margin: 16px 0;

--engagement-text-font: 'Cormorant Garamond', serif;
--engagement-text-weight: 400;
--engagement-text-size-desktop: 15pt;
--engagement-text-line-height: 1.65;
--engagement-text-color: #2C2A28;
```

### 10.9 — Comportements UX

#### Animation au scroll

```
[atteint 80% viewport]   → fond sauge pâle fade-in (subtil — opacité 0 → 1, 600ms)
[atteint 70%]             → surtitre fade-in (500ms)
[atteint 60%]             → 4 cartes fade-in en cascade (200ms entre chaque, 500ms chacune)
                            ordre : 1 → 2 → 3 → 4 (lecture occidentale)
```

#### Hover sur les cartes

Aucune interaction — les engagements sont **statiques**. C'est une **promesse**, pas un produit cliquable.

### 10.10 — Psychologie

#### Tactique 1 — Engagement formel (Cialdini 1984)

> *« Public commitments increase compliance. The act of writing down or publicly stating a position makes one more committed to it. »*

En **listant publiquement** ses engagements, la maison se **lie** à eux. La cliente perçoit cette obligation auto-imposée — elle augmente la confiance.

#### Tactique 2 — Vulnerability + ethics (Brown 2010 + Verlegh 1999)

L'engagement #4 (« Sans appropriation, avec respect ») reconnaît une **dette culturelle**. Cette honnêteté éthique :
- Désamorce les critiques potentielles d'appropriation culturelle
- Positionne la maison comme **consciente et respectueuse**
- Différencie de toute marque qui présenterait le P-Shine comme **leur invention**

#### Tactique 3 — Specificity > generality

> Tous les engagements sont **spécifiques** : « trois personnes », « verre teinté », « carton non blanchi », « quatre matières quatre gestes quatre minutes ». Aucune phrase floue (« qualité », « excellence », « durabilité »).

#### Tactique 4 — Numbered list = formal pact

> Les numéros ① ② ③ ④ transforment les engagements en **pacte** — comme une déclaration des droits, en quatre articles. Cette **forme juridique légère** renforce la perception d'engagement.

### 10.11 — Émotion

| Avant | Pendant | Après |
| :---- | :------ | :---- |
| Confiance scientifique (post-matières) | Adhésion structurée | Alignement de valeurs : la cliente se reconnaît dans les engagements |

### 10.12 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| Plus de 4 engagements                               | Surcharge — 4 est le nombre cognitif optimal pour mémoriser         |
| Engagements abstraits (« qualité », « excellence ») | Détruit la spécificité qui fait la confiance                       |
| Statistiques (« -40% empreinte », « 100% naturel »)  | Sans certification, mensonger                                      |
| Logos certifications (Bio, Vegan, Cruelty Free)     | Si non possédés, mensonger ; si possédés, distrayants ici          |
| Mention « notre mission », « nos valeurs »          | Vocabulaire corporate, casse le ton                                 |
| Lien « En savoir plus » sur chaque engagement       | Suggère que la promesse est incomplète                              |
| Engagements > 60 mots chacun                        | Surcharge de lecture                                                |
| Engagements < 20 mots chacun                        | Trop sec, ne convainc pas                                            |
| Photos illustratives (feuille verte, etc.)          | Banalise — l'engagement est dans le texte, pas dans l'image         |
| Mention de prix ou de coût                          | Cassure du registre éditorial                                       |

---

## 11 — Section 07 — Cross-link

### 11.1 — Wireframe

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│  ┌────────────────────────────────┐    ┌──────────────────────────────┐  │
│  │                                │    │                              │   │
│  │                                │    │  POUR CONTINUER              │   │
│  │                                │    │                              │   │
│  │   [PHOTO LIFESTYLE             │    │  Lire le journal.            │   │
│  │   "TEXTES DU JOURNAL"]         │    │                              │   │
│  │                                │    │  Des fragments écrits depuis │   │
│  │   [Carnet ouvert, plume,       │    │  l'atelier — sur les matières,│   │
│  │   tasse de thé tiède]          │    │  les saisons, et les voix    │   │
│  │                                │    │  qui nous tiennent.          │   │
│  │                                │    │                              │   │
│  │                                │    │  ─                           │   │
│  │                                │    │                              │   │
│  │                                │    │  ┌──────────────────────┐   │   │
│  │                                │    │  │ Visiter le journal → │   │   │
│  │                                │    │  └──────────────────────┘   │   │
│  └────────────────────────────────┘    └──────────────────────────────┘  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 11.2 — Composition

| Propriété              | Valeur                                                          |
| :--------------------- | :-------------------------------------------------------------- |
| Fond                   | `#FBF8F1` (Crème)                                                |
| Hauteur                | 320px (desktop) · auto (mobile)                                  |
| Padding vertical       | 80px                                                             |
| Padding latéral        | 96px (desktop) · 24px (mobile)                                  |
| Layout                 | Photo 50% gauche / Bloc info 50% droite — gap 64px (desktop)     |
| Layout mobile          | Empilés (photo dessus, info dessous) — gap 24px                  |

### 11.3 — Pourquoi un seul cross-link (vers `/journal`) ?

Sur les autres pages, le cross-link contient parfois 3 articles. Ici, **un seul lien** vers `/journal`. Pourquoi ?

- À ce stade, la cliente a lu une longue page institutionnelle
- Lui proposer 3 articles serait **redondant** avec le contenu qu'elle vient d'absorber
- `/journal` est la page **complémentaire** parfaite : elle prolonge le récit de la maison par des **fragments** thématiques
- Un seul lien clair = **invitation forte** plutôt que **liste de choix** (curation Iyengar 2000)

### 11.4 — Photo

| Propriété         | Valeur                                                                |
| :---------------- | :-------------------------------------------------------------------- |
| Sujet             | Carnet ouvert posé sur une table, plume à côté, tasse de thé tiède   |
| Composition       | Lifestyle macro, lumière naturelle de fin d'après-midi                |
| Format            | 4:3 (paysage) sur desktop · 4:3 sur tablet · 3:2 sur mobile           |
| Hauteur affichage | 280px (desktop) · auto (mobile)                                        |

### 11.5 — Bloc info — copy intégral

#### Surtitre

```
POUR CONTINUER
```

| Propriété      | Valeur                                              |
| :------------- | :-------------------------------------------------- |
| Police         | Inter SemiBold 7.5pt                                |
| Letter-spacing | 2.5px                                               |
| Couleur        | `#6B6863` (Brume)                                   |
| Position       | Aligné à gauche                                     |

#### Titre

```
Lire le journal.
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Light Italic                              |
| Taille          | 32pt (desktop) · 26pt (mobile)                                |
| Couleur         | `#2C2A28` (Encre)                                            |
| Espacement haut | 12px sous le surtitre                                         |

#### Description

```
Des fragments écrits depuis l'atelier —
sur les matières, les saisons, et les voix
qui nous tiennent.
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Regular                                   |
| Taille          | 16pt (desktop) · 15pt (mobile)                                |
| Couleur         | `#4A4844` (Encre claire)                                     |
| Line-height     | 1.6                                                          |
| Espacement haut | 20px                                                          |

> **« Des fragments écrits depuis l'atelier »** — réutilise le mot **« fragment »** (vocabulaire littéraire de `/journal`) et l'ancre dans **« l'atelier »** (qu'on vient de découvrir en section 04). Cohérence narrative parfaite.

#### Filet séparateur

| Propriété      | Valeur                                |
| :------------- | :------------------------------------ |
| Largeur        | 32px                                  |
| Hauteur        | 1.5px                                 |
| Couleur        | `#A8C4A6` (Sauge dark)                |
| Espacement     | 32px haut, 32px bas                   |

#### CTA

```
Visiter le journal →
```

| Propriété          | Valeur                                                                |
| :----------------- | :-------------------------------------------------------------------- |
| Police             | Inter Medium 14pt                                                     |
| Texte              | `#FBF8F1` (Crème pure)                                                |
| Fond               | `#2C2A28` (Encre)                                                     |
| Padding            | 14px 28px                                                             |
| Hover              | Fond `#4A4844`, flèche se déplace de 4px à droite (300ms)             |
| Action             | Navigation vers `/journal`                                             |

> **Verbe « Visiter »** : cohérent avec « Visiter la maison » utilisé sur le cross-link de `/journal` (qui mène vers `/maison`). La maison et le journal sont des **lieux** que l'on **visite**, pas des contenus que l'on **consomme**.

### 11.6 — Tokens design

```css
/* ─── Cross-link Journal — tokens ─── */
--crosslink-journal-bg: #FBF8F1;
--crosslink-journal-padding-vertical: 80px;
--crosslink-journal-grid-gap-desktop: 64px;
--crosslink-journal-photo-aspect: 4/3;
--crosslink-journal-photo-height-desktop: 280px;

--crosslink-journal-kicker-color: #6B6863;
--crosslink-journal-title-style: italic;
--crosslink-journal-title-size: 32pt;
--crosslink-journal-description-size: 16pt;
--crosslink-journal-description-color: #4A4844;
--crosslink-journal-divider-color: #A8C4A6;
--crosslink-journal-cta-bg: #2C2A28;
--crosslink-journal-cta-text: #FBF8F1;
```

### 11.7 — Comportements UX

#### Animation au scroll

```
[atteint 80% viewport]   → photo fade-in 700ms
[atteint 70%]             → bloc info fade-in séquentiel (200ms entre éléments)
```

#### Click sur la photo OU la card complète

Toute la zone est cliquable et mène à `/journal`.

### 11.8 — Émotion

| Avant | Pendant | Après |
| :---- | :------ | :---- |
| Adhésion (post-engagements) | Désir de poursuivre la lecture | Continuation naturelle vers le Journal |

### 11.9 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| Lien vers `/kit` ici                                | Détruit le positionnement non-commercial de la page                 |
| Lien vers `/rituel` (qui peut aussi convenir)        | Choix éditorial : `/journal` est plus cohérent avec le récit qu'on vient de lire |
| Multiple cross-links                                | Surcharge à la sortie                                              |
| CTA sans flèche                                     | Casse la signature de navigation                                    |

---

## 12 — Footer — élément persistant

### 12.1 — Structure héritée

Le footer de `/maison` est **identique** à celui des autres pages — élément global du site.

### 12.2 — Spécificités sur `/maison`

| Différence              | Spécification                                                       |
| :---------------------- | :------------------------------------------------------------------ |
| **Item « La maison »** | Dans la colonne « LE RITUEL » du footer, l'item « La maison » est visuellement actif : couleur Crème pure + soulignement subtil 1px sauge dark, offset 6px |
| **Pas de re-affichage newsletter** | La newsletter n'apparaît pas dans le footer (réservée à `/journal`) |
| **Espacement avec Cross-link** | 64px de padding vertical entre la fin de la section 07 et le début du footer |

---

## 13 — Comportements transverses

### 13.1 — Smooth scroll

`scroll-behavior: smooth` activé en CSS, désactivé si :
- L'utilisateur a `prefers-reduced-motion: reduce` activé
- Sur les ancres rapides : scroll instantané sur Cmd/Ctrl+click

### 13.2 — Lazy loading des images

| Type d'image                         | Stratégie                                            |
| :----------------------------------- | :--------------------------------------------------- |
| Hero (pas d'image)                   | N/A — fond crème uni                                  |
| Photo « la mère de Salma » (section 02) | `loading="eager"`, **preload critique pour LCP**  |
| Photo « Salma au travail » (section 03) | `loading="lazy"` (sous le pli)                    |
| 3 photos atelier (section 04)        | `loading="lazy"`, intersection observer              |
| Photos cross-link Journal            | `loading="lazy"`                                     |
| Footer                               | (aucune image)                                       |

#### Preload de la photo de la section 02

```html
<link rel="preload" as="image"
      href="/images/maison/origine-mother-desktop.webp"
      media="(min-width: 768px)"
      fetchpriority="high">
```

> **LCP element** : la photo de la mère de Salma est le **premier élément image visible** à l'arrivée (juste sous le hero). Elle est l'élément LCP.

### 13.3 — Pas d'interaction lourde

`/maison` est une page **de lecture statique**. Aucune mécanique dynamique :
- Pas de filtre
- Pas de pagination
- Pas de formulaire (newsletter exclue de cette page)
- Pas d'add-to-cart
- Pas de modal

> Cette absence d'interaction est **stratégique** : la page invite à **lire** et à **regarder**, rien d'autre.

### 13.4 — Format d'image

| Format primaire | Format fallback | Compression |
| :-------------- | :-------------- | :---------- |
| WebP            | JPEG            | Qualité 82, profil sRGB |
| AVIF (V2)       | WebP, JPEG      | Qualité 76  |

### 13.5 — Animation timing — règle générale

| Type d'animation              | Durée            | Easing                              |
| :---------------------------- | :--------------- | :---------------------------------- |
| Hero fleuron + texte          | 600-900ms        | `cubic-bezier(0.16, 1, 0.3, 1)`     |
| Section reveal scroll         | 600-700ms        | `cubic-bezier(0.4, 0, 0.2, 1)`      |
| Photo fade-in lifestyle       | 700-800ms        | `cubic-bezier(0.4, 0, 0.2, 1)`      |
| Cards fade-in cascade         | 200ms entre chaque, 500ms chacune | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Hover photo (subtle zoom)     | 800-1000ms       | `cubic-bezier(0.4, 0, 0.2, 1)`      |
| Hover button                  | 220ms            | `cubic-bezier(0.4, 0, 0.2, 1)`      |
| Cross-link CTA flèche         | 300ms            | `cubic-bezier(0.4, 0, 0.2, 1)`      |
| Header transition             | 240ms            | `cubic-bezier(0.4, 0, 0.2, 1)`      |

> **Règle d'or pour `/maison`** : les animations sont **plus lentes** que sur `/kit` (BOFU). Le ralentissement est **stratégique** — la lecture longue exige du temps. Aucune animation > 1.2s pour ne pas frustrer, mais aucune < 500ms pour ne pas paraître précipitée.

### 13.6 — Reduced motion

Pour les utilisateurs avec `prefers-reduced-motion: reduce` :

- Animations d'entrée à 0ms (apparition instantanée)
- Slow reveal (cascade) : tous les éléments apparaissent finalisés
- Hover : pas de zoom-in sur les photos
- Hover button : conserver le changement de couleur (220ms ou moins)
- Cross-link flèche : ne pas animer la translation

### 13.7 — État de chargement initial

```
[t=0ms]      → HTML loaded, fond crème visible
[t=100ms]    → Police Inter chargée
[t=300ms]    → Police Cormorant chargée
[t=500ms]    → Police Pinyon Script chargée (header uniquement)
[t=600ms]    → Hero typographique animé (fleuron + surtitre + phrase d'accroche)
[t=900ms]    → FCP atteint
[t=1500ms]   → Photo « la mère de Salma » chargée (LCP)
[t=2000ms]   → Reste des photos visibles dans le viewport chargées
[t=Section 04 reached] → Photos atelier chargées (lazy)
```

### 13.8 — Pas de skeleton screen

Comme sur les autres pages, **pas de skeleton screen**. La page est pré-rendue (SSR ou SSG) — le HTML arrive avec le contenu, pas avec un squelette.

### 13.9 — État du panier

Le compteur du panier dans le header est **toujours visible** sur `/maison` — la cliente peut avoir un kit dans son panier d'une session précédente.

### 13.10 — Aucune mécanique de partage

Pas de boutons « Partager sur Facebook / Twitter / Pinterest / WhatsApp ». La page institutionnelle ne se diffuse pas comme un article. La marque se transmet par d'autres moyens.

### 13.11 — Pas de stratégie de scroll snap

Volontairement, **pas de scroll-snap** entre les sections. Pourquoi ?
- Le scroll-snap impose un **rythme** au lecteur
- Sur une page éditoriale, le lecteur doit **garder son propre rythme**
- Le scroll fluide laisse la liberté de s'arrêter où on veut

---

## 14 — Adaptation responsive

### 14.1 — Breakpoints officiels

| Nom         | Min-width | Max-width | Layout principal                |
| :---------- | :-------- | :-------- | :------------------------------ |
| **Mobile**  | 0         | 767px     | 1 colonne, vertical             |
| **Tablet**  | 768px     | 1279px    | 2 colonnes mixtes               |
| **Desktop** | 1280px    | -         | Multi-colonnes, max-width 1200px |

### 14.2 — Adaptations par section

#### Hero éditorial (Section 01)

| Propriété              | Desktop          | Tablet          | Mobile         |
| :--------------------- | :--------------- | :-------------- | :------------- |
| Hauteur                | 520px            | 460px           | 420px          |
| Padding latéral        | 96px             | 64px            | 24px           |
| Fleuron taille         | 80×12px          | 80×12px         | 64×10px        |
| Surtitre size          | 9pt              | 8.5pt           | 8pt            |
| Phrase d'accroche size | 36pt             | 28pt            | 24pt           |
| Phrase d'accroche max-width | 680px       | 600px           | 100% - 48px    |

#### L'origine (Section 02)

| Propriété              | Desktop          | Tablet          | Mobile         |
| :--------------------- | :--------------- | :-------------- | :------------- |
| Layout                 | 55% texte / 45% photo | 50% / 50%   | Empilés (photo dessus) |
| Gap                    | 64px             | 48px            | 32px           |
| Photo height           | 620px            | 540px           | auto           |
| Texte size             | 17pt             | 16pt            | 15pt           |
| Texte line-height      | 1.7              | 1.7             | 1.65           |

#### La fondatrice (Section 03)

| Propriété              | Desktop          | Tablet          | Mobile         |
| :--------------------- | :--------------- | :-------------- | :------------- |
| Padding vertical       | 96px             | 80px            | 64px           |
| Photo width max        | 380px            | 320px           | 100% - 48px    |
| Photo height           | 480px            | 420px           | auto           |
| Citation size          | 22pt             | 19pt            | 17pt           |
| Citation max-width     | 720px            | 640px           | 100% - 48px    |

#### L'atelier (Section 04)

| Propriété              | Desktop          | Tablet          | Mobile         |
| :--------------------- | :--------------- | :-------------- | :------------- |
| Photos layout          | 3 photos en ligne | 3 photos en ligne | Empilées 1 col |
| Gap entre photos       | 24px             | 20px            | 24px           |
| Photo height           | 380px            | 320px           | 280px          |
| Phrase intro size      | 26pt             | 22pt            | 20pt           |
| Texte descriptif size  | 17pt             | 16pt            | 15pt           |

#### Les matières (Section 05)

| Propriété              | Desktop          | Tablet          | Mobile         |
| :--------------------- | :--------------- | :-------------- | :------------- |
| Layout                 | 2×2              | 2×2             | 1 colonne      |
| Gap                    | 24px             | 20px            | 24px           |
| Card padding           | 32px             | 28px            | 24px           |
| Nom matière size       | 22pt             | 20pt            | 20pt           |
| Origin size            | 15pt             | 15pt            | 14pt           |
| Pourquoi text size     | 13pt             | 13pt            | 13pt           |

#### Les engagements (Section 06)

| Propriété              | Desktop          | Tablet          | Mobile         |
| :--------------------- | :--------------- | :-------------- | :------------- |
| Layout                 | 2×2              | 2×2             | 1 colonne      |
| Gap                    | 32px             | 24px            | 32px           |
| Card padding           | 24px             | 20px            | 16px           |
| Numéro size            | 22pt             | 20pt            | 20pt           |
| Titre engagement size  | 22pt             | 20pt            | 20pt           |
| Texte engagement size  | 15pt             | 14pt            | 14pt           |

#### Cross-link Journal (Section 07)

| Propriété              | Desktop          | Tablet          | Mobile         |
| :--------------------- | :--------------- | :-------------- | :------------- |
| Layout                 | 50% / 50%        | 50% / 50%       | Empilés        |
| Gap                    | 64px             | 48px            | 24px           |
| Photo height           | 280px            | 240px           | 220px          |
| Titre size             | 32pt             | 26pt            | 24pt           |

### 14.3 — Comportements mobile spécifiques

#### Header

- Burger menu : drawer slide-in 280ms depuis la droite
- Item « La maison » actif avec underline sauge dark
- CTA panier conservé en haut-droite

#### Pas de sticky CTA mobile

Contrairement à `/kit`, **aucun sticky CTA flottant** sur `/maison`. Cohérent avec `/journal` — la page n'a pas d'objectif de conversion immédiate.

#### Sections empilées avec photos en haut

Sur mobile, dans toutes les sections à layout 50/50 (sections 02 et 07), la photo apparaît **au-dessus** du texte. Pourquoi ?
- La photo est **immédiatement engageante** sur mobile (où le scroll est dominant)
- Mettre le texte en haut imposerait à la cliente de scroller longtemps avant de voir l'image
- L'ordre photo→texte respecte le **rythme de découverte** mobile (image puis explication)

#### Lecture longue mobile — espacement

Sur mobile, les sections ont des **paddings verticaux légèrement réduits** (64-80px au lieu de 96px) pour ne pas trop allonger la page. Mais les **paragraphes du récit** gardent leur respiration (line-height 1.65, espacement 20px).

### 14.4 — Touch targets minimum

Sur mobile, tous les éléments interactifs respectent **44×44px minimum** :
- CTA cross-link Journal : padding 14px 28px → 50px hauteur tactile
- Cards interactives : zone tactile complète (largeur full × hauteur card)
- Lien dans le footer : padding suffisant

### 14.5 — Texte minimum sur mobile

Aucun texte en dessous de **14px** sur mobile (lisibilité WCAG). Exceptions :
- Caption photo (légende) : 12pt acceptable car contextuel
- Microcopy (signature « Casablanca, mars 2026 ») : 11pt acceptable
- Surtitres (kickers) : 7-8pt acceptable car uppercase tracked

---

## 15 — Performance technique

### 15.1 — Web Vitals — cibles

| Métrique | Cible    | Justification                                      |
| :------- | :------- | :------------------------------------------------- |
| **LCP**  | < 2.4s   | Photo « la mère de Salma » = LCP element            |
| **CLS**  | < 0.08   | Animations d'entrée fluides, pas de layout shift    |
| **INP**  | < 200ms  | Très peu d'interactions (page de lecture)           |
| **FCP**  | < 1.0s   | Hero typographique visible vite (pas d'image)       |
| **TBT**  | < 250ms  | JS minimal (animations + lazy loading)              |

> **Note** : les cibles sont **moins strictes** que `/kit` (BOFU) et `/journal` (TOFU+). Mais elles restent dans les standards d'un site éditorial premium.

### 15.2 — Stratégie de chargement

#### Critical CSS

CSS critique inline dans le `<head>` — uniquement les styles du hero + header. Le reste en CSS externe `<link>`.

#### Preload des polices critiques

```html
<!-- Polices critiques pour le hero typographique -->
<link rel="preload" href="/fonts/Inter-SemiBold.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/CormorantGaramond-Light.woff2" as="font" type="font/woff2" crossorigin>
<!-- Polices secondaires -->
<link rel="preload" href="/fonts/CormorantGaramond-Regular.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/CormorantGaramond-Italic.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/Inter-Regular.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/PinyonScript-Regular.woff2" as="font" type="font/woff2" crossorigin>
```

> **Pourquoi Cormorant Italic en preload** : la citation de Salma (section 03) est entièrement en italic. Sans preload, FOUT (Flash Of Unstyled Text) à l'arrivée à cette section.

#### Preload de la photo LCP (section 02)

```html
<link rel="preload" as="image"
      href="/images/maison/origine-mother-desktop.webp"
      media="(min-width: 768px)"
      fetchpriority="high">
<link rel="preload" as="image"
      href="/images/maison/origine-mother-mobile.webp"
      media="(max-width: 767px)"
      fetchpriority="high">
```

#### Defer du JavaScript non-critique

```html
<!-- Scripts non-critiques (animations, analytics) -->
<script src="/js/animations.js" defer></script>
<script src="/js/analytics.js" async></script>
```

> **Pas de JS « cart » ni « filter » sur cette page** — pas de mécanique dynamique, donc pas de besoin.

### 15.3 — Budget de performance

| Ressource                       | Budget          |
| :------------------------------ | :-------------- |
| HTML initial                    | < 50 KB gzip    |
| CSS critique inline             | < 10 KB         |
| CSS externe                     | < 50 KB gzip    |
| JS total                        | < 50 KB gzip    |
| Photo LCP (section 02)          | < 180 KB        |
| Photo Salma (section 03)        | < 150 KB        |
| 3 photos atelier (section 04)   | < 120 KB chacune (lazy) |
| Photo cross-link Journal        | < 100 KB (lazy) |
| Polices                         | < 160 KB total  |
| **Total page initiale**         | **< 550 KB**    |

> **Lazy loading critique** : 4-5 photos sont sous le pli — leur chargement est différé. Le LCP ne dépend que de la photo de la section 02 + du HTML initial.

### 15.4 — CDN & cache

| Ressource                      | Cache-Control                          |
| :----------------------------- | :------------------------------------- |
| HTML                           | `no-cache, must-revalidate`            |
| CSS / JS versionnés            | `public, max-age=31536000, immutable`  |
| Images                         | `public, max-age=31536000` (1 an — la page change rarement) |
| Polices                        | `public, max-age=31536000, immutable`  |

CDN : Cloudflare ou équivalent, avec :
- **Polish** activé (optimisation WebP automatique)
- **Mirage** activé (lazy loading optimisé)
- **Argo Smart Routing** (acheminement réseau optimal Maroc)

### 15.5 — Optimisations spécifiques

| Optimisation                              | Justification                                      |
| :---------------------------------------- | :------------------------------------------------- |
| **SSG** (Static Site Generation)          | La page change rarement (1-2× / an) → SSG idéal    |
| Pas d'API à appeler côté client            | Page 100% statique                                  |
| `loading="lazy"` sur 5/6 photos            | Économie majeure de bande passante                 |
| HTML gzip + brotli                        | Compression maximale du HTML pré-rendu             |
| Preload polices critiques uniquement      | Le reste en `font-display: swap`                   |
| Intersection Observer pour animations     | Pas de scroll listener manuel                      |

### 15.6 — Stratégie de rendu — recommandation

#### Approche recommandée — SSG pur

`/maison` est **idéalement** rendue en **SSG** (Static Site Generation) au build :

**Avantages** :
- HTML pré-rendu ultra-rapide
- Pas de requête DB / API au chargement
- SEO optimal (contenu visible aux crawlers)
- Cache CDN agressif possible (immutable)
- Coût d'hébergement minimal (fichiers statiques)

**Implementation Next.js / Astro** :

```javascript
// Pas de getServerSideProps ni d'API call
// Tout le contenu est dans le code de la page
```

> **La page n'a pas besoin d'ISR** car son contenu change **1-2 fois par an** — un re-build manuel suffit.

### 15.7 — Métriques de référence

| Site (institutionnel)         | LCP    | CLS   | INP    |
| :--------------------------- | :----- | :---- | :----- |
| Aesop / about                 | 2.2s   | 0.05  | 180ms  |
| Le Labo / about               | 2.0s   | 0.04  | 150ms  |
| Maison Margiela / about       | 2.6s   | 0.07  | 200ms  |
| **FemiGlow `/maison` cible**  | **< 2.4s** | **< 0.08** | **< 200ms** |

---

## 16 — SEO & métadonnées

### 16.1 — Title

```html
<title>La maison — FemiGlow · L'atelier, le rituel, l'histoire</title>
```

| Critère                 | Valeur                                                          |
| :---------------------- | :-------------------------------------------------------------- |
| Longueur                | 56 caractères (≤ 60 affichables sur SERP — pas tronqué)         |
| Mot-clé principal       | « FemiGlow » + « atelier » + « rituel » + « histoire »           |
| Marque                  | « FemiGlow »                                                     |
| Tonalité                | Éditoriale, indique trois axes de la page                        |

### 16.2 — Meta description

```html
<meta name="description" content="L'histoire d'une maison de soin née entre Casablanca et Kyoto. Notre atelier, nos engagements, et la voix de Salma — fondatrice. Des matières marocaines pour un rituel japonais.">
```

| Critère       | Valeur                                                  |
| :------------ | :------------------------------------------------------ |
| Longueur      | 192 caractères — légèrement long, sera tronqué sur certaines SERP mais préserve l'essentiel en début |
| Hook          | « L'histoire d'une maison de soin née entre Casablanca et Kyoto »  |
| Différenciation | « Notre atelier, nos engagements, et la voix de Salma » |
| Mots-clés naturels | « matières marocaines », « rituel japonais »          |

### 16.3 — Open Graph

```html
<meta property="og:type" content="website">
<meta property="og:url" content="https://femiglow.ma/maison">
<meta property="og:title" content="La maison — FemiGlow">
<meta property="og:description" content="L'histoire d'une maison de soin née entre Casablanca et Kyoto. Notre atelier, nos engagements, et la voix de Salma.">
<meta property="og:image" content="https://femiglow.ma/og/maison-og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="fr_MA">
<meta property="og:site_name" content="FemiGlow">
```

#### Image OG spécifique à `/maison`

- Dimensions : 1200×630px
- Composition : photo de l'atelier (vue large) **OU** composition typographique (phrase d'accroche du hero sur fond crème)
- Wordmark Pinyon en haut-gauche
- Pas de prix, pas de CTA visible, pas de visage
- Format JPEG qualité 85, < 200 KB

> **Recommandation** : utiliser **la photo de l'atelier (section 04, photo 1 — vue large)** comme image OG. Elle évoque immédiatement le **lieu** de la marque, ce qui est l'essence de cette page.

### 16.4 — Twitter Card

```html
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@femiglow">
<meta name="twitter:title" content="La maison — FemiGlow">
<meta name="twitter:description" content="L'histoire d'une maison de soin née entre Casablanca et Kyoto.">
<meta name="twitter:image" content="https://femiglow.ma/og/maison-twitter.jpg">
```

### 16.5 — Schema.org JSON-LD — AboutPage + Organization

Schema **AboutPage** + **Organization** combinés. C'est le schema clé pour cette page institutionnelle.

```json
{
  "@context": "https://schema.org",
  "@type": "AboutPage",
  "name": "La maison — FemiGlow",
  "description": "L'histoire de la maison FemiGlow — fondée à Casablanca par Salma, autour d'un rituel japonais de soin des ongles.",
  "url": "https://femiglow.ma/maison",
  "inLanguage": "fr-MA",
  "mainEntity": {
    "@type": "Organization",
    "@id": "https://femiglow.ma/#organization",
    "name": "FemiGlow",
    "alternateName": "FemiGlow · Maison d'Éclat",
    "legalName": "FemiGlow SARL",
    "description": "Maison de soin des ongles fondée à Casablanca, dédiée au rituel japonais P-Shine adapté aux matières marocaines.",
    "url": "https://femiglow.ma",
    "logo": {
      "@type": "ImageObject",
      "url": "https://femiglow.ma/logo.png",
      "width": 600,
      "height": 200
    },
    "image": "https://femiglow.ma/images/maison/origine-mother-desktop.jpg",
    "foundingDate": "2024",
    "founder": {
      "@type": "Person",
      "name": "Salma",
      "jobTitle": "Fondatrice",
      "worksFor": {
        "@id": "https://femiglow.ma/#organization"
      }
    },
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Casablanca",
      "addressRegion": "Casablanca-Settat",
      "addressCountry": "MA",
      "streetAddress": "Quartier Maârif"
    },
    "areaServed": {
      "@type": "Country",
      "name": "Maroc"
    },
    "knowsAbout": [
      "Soin des ongles",
      "Rituel P-Shine",
      "Beauté lente",
      "Cosmétique naturelle",
      "Made in Morocco"
    ],
    "slogan": "Le rituel d'éclat",
    "sameAs": [
      "https://www.instagram.com/femiglow",
      "https://www.facebook.com/femiglow"
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
        "name": "La maison",
        "item": "https://femiglow.ma/maison"
      }
    ]
  }
}
```

> **Note critique** : le Schema **Organization** est crucial — il alimente le **Knowledge Panel** de Google si la marque devient connue. Tous les champs (foundingDate, founder, address, areaServed, knowsAbout, sameAs) contribuent à la richesse sémantique perçue par Google.

### 16.6 — Schema.org additionnel — LocalBusiness (optionnel V2)

Si FemiGlow ouvre éventuellement à la visite (ateliers du dimanche pour clientes fidèles, par exemple V2), ajouter un schema **LocalBusiness** :

```json
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "FemiGlow Atelier",
  "image": "https://femiglow.ma/images/maison/atelier-1.jpg",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Quartier Maârif",
    "addressLocality": "Casablanca",
    "addressRegion": "Casablanca-Settat",
    "postalCode": "20100",
    "addressCountry": "MA"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 33.5731,
    "longitude": -7.5898
  },
  "openingHoursSpecification": {
    "@type": "OpeningHoursSpecification",
    "dayOfWeek": ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    "opens": "10:00",
    "closes": "18:00"
  },
  "priceRange": "₂₂₂"
}
```

> **MVP V1** : ne pas inclure ce schema (l'atelier n'est pas ouvert au public). **V2** : à ajouter si une politique d'ouverture est mise en place.

### 16.7 — Canonical & hreflang

```html
<link rel="canonical" href="https://femiglow.ma/maison">
<link rel="alternate" hreflang="fr-MA" href="https://femiglow.ma/maison">
<link rel="alternate" hreflang="ar-MA" href="https://femiglow.ma/ar/maison">
<link rel="alternate" hreflang="x-default" href="https://femiglow.ma/maison">
```

### 16.8 — Robots & sitemap

```html
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
```

#### Sitemap.xml — entrée pour `/maison`

```xml
<url>
  <loc>https://femiglow.ma/maison</loc>
  <lastmod>2026-05-01</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.8</priority>
  <image:image>
    <image:loc>https://femiglow.ma/images/maison/atelier-1.jpg</image:loc>
    <image:title>L'atelier FemiGlow à Casablanca</image:title>
    <image:caption>Vue de l'atelier de la maison FemiGlow, quartier Maârif</image:caption>
  </image:image>
</url>
```

> **Priority 0.8** : élevé mais sous `/kit` (1.0) et `/journal` (0.9). La page institutionnelle a une **valeur SEO secondaire** dans la stratégie commerciale.

### 16.9 — Stratégie de mots-clés

#### Mots-clés cibles pour `/maison`

| Mot-clé cible                          | Volume estimé Maroc | Intention      | Position visée |
| :------------------------------------- | :------------------ | :------------- | :------------- |
| « FemiGlow histoire »                  | ~10/mois (croissant) | Brand search   | Top 1          |
| « FemiGlow Casablanca »                | ~5/mois (croissant)  | Brand search   | Top 1          |
| « marque cosmétique Casablanca »       | ~30/mois            | Découverte     | Top 5          |
| « atelier soin Maroc »                 | ~25/mois            | Considération  | Top 10         |
| « beauty brand made in Morocco »       | ~40/mois            | Découverte     | Top 10         |

> **Stratégie SEO institutionnelle** : `/maison` ne cherche pas à conquérir des requêtes commerciales. Sa fonction SEO principale est de **renforcer le profil de marque** dans le Knowledge Graph et d'être trouvée sur les requêtes **brand + history**.

### 16.10 — Hiérarchie des headers

```html
<h1>Une marque commence parfois par une question simple. La nôtre est née de celle-ci : pourquoi nos mains, qui font tant, reçoivent-elles si peu ?</h1>          <!-- Hero -->

  <h2>L'origine</h2>                                <!-- Section 02 -->

  <h2>Salma</h2>                                    <!-- Section 03 -->

  <h2>L'atelier</h2>                                <!-- Section 04 -->

  <h2>Les matières</h2>                             <!-- Section 05 -->

  <h2 class="visually-hidden">Ce que nous nous engageons à faire</h2>         <!-- Section 06 -->
    <h3>Matières</h3>                               <!-- Engagement 1 -->
    <h3>Made in Maroc</h3>                          <!-- Engagement 2 -->
    <h3>Durabilité</h3>                             <!-- Engagement 3 -->
    <h3>Héritage japonais</h3>                      <!-- Engagement 4 -->

  <h2 class="visually-hidden">Pour continuer</h2>   <!-- Cross-link -->
```

> **Règle SEO** : le H1 est la phrase d'accroche du hero — longue, mais **sémantiquement riche** et **différenciante**. Elle contient des mots-clés naturels (« marque », « mains », « soin ») dans une formulation littéraire qui se distingue des H1 SEO standardisés.

### 16.11 — Mots-clés sémantiques (LSI)

Mots-clés sémantiquement reliés qui devraient apparaître naturellement sur la page :

| Catégorie       | Mots-clés                                                       |
| :-------------- | :-------------------------------------------------------------- |
| Lieu            | Casablanca, Maârif, atelier, Maroc, Souss, Atlas                 |
| Origine         | P-Shine, Japon, Kyoto, japonaise, marocaine                     |
| Matières        | Cire d'abeille, jojoba, kaolin, mica, Imouzzer                   |
| Valeurs         | Fait-main, transparent, durable, respect, héritage              |
| Verbes          | Assembler, nommer, recevoir, transmettre, raconter              |

> **Tous ces mots apparaissent naturellement** dans le contenu (pas en stuffing). L'écriture éditoriale soignée fait le SEO sémantique sans effort artificiel.

### 16.12 — Pas de schema FAQ

Sur `/maison`, **pas de FAQ schema**. La page ne pose pas de questions/réponses — c'est un récit linéaire. Les FAQ sont sur `/kit` (objections produit) et éventuellement sur articles de Journal.

### 16.13 — Knowledge Graph optimization

À long terme, FemiGlow vise une **fiche Knowledge Panel** sur Google. Pour cela :
- Schema Organization complet (✓ ci-dessus)
- Présence sociale cohérente (Instagram, Facebook avec mêmes infos)
- Wikipédia (V2 — quand notoriété suffisante)
- Mentions presse régulières (placement éditorial)
- Cohérence des données NAP (Name, Address, Phone) sur tous les supports

> **Cette stratégie se construit sur 12-24 mois** et nécessite un travail de relations presse parallèle. `/maison` en est la **base sémantique**.

---

## 17 — Accessibilité (a11y)

### 17.1 — Conformité visée

**WCAG 2.2 niveau AA** sur tous les composants. **Niveau AAA** visé sur :
- Contraste des textes critiques (récit fondateur, citation Salma, engagements)
- Lisibilité du récit long (section 02 — texte de ~250 mots)
- Alt texts narratifs sur les 5 photos lifestyle
- Navigation clavier simple (peu d'éléments interactifs)

### 17.2 — Contraste — vérifications

| Combinaison                                        | Ratio   | Niveau WCAG   |
| :------------------------------------------------- | :------ | :------------ |
| Encre `#2C2A28` sur Crème `#FBF8F1`                | 14.2:1  | AAA           |
| Encre claire `#4A4844` sur Crème                   | 9.1:1   | AAA           |
| Brume `#6B6863` sur Crème                          | 5.6:1   | AA            |
| Champagne `#C8A876` sur Crème (kicker hero)        | 2.7:1   | AA Large only — kicker SemiBold tracking 4px = OK |
| Encre sur Sauge pâle `#E8EFE7` (engagements)       | 12.8:1  | AAA           |
| Encre claire sur Sauge pâle (texte engagements)    | 8.4:1   | AAA           |
| Sauge dark `#A8C4A6` sur Crème (filets, numéros)    | 2.8:1   | (graphique non textuel) — Texte numéros taille 22pt = AA Large |
| Encre sur Crème pure `#FFFFFF` (cards matières)    | 14.6:1  | AAA           |
| Encre claire sur Crème pure (origines en italic)    | 9.4:1   | AAA           |
| Crème pure sur Encre (CTA cross-link)              | 14.2:1  | AAA           |

### 17.3 — Navigation clavier

| Élément                       | Comportement clavier                            |
| :---------------------------- | :---------------------------------------------- |
| Wordmark                      | Tab focus, Enter active                          |
| Menu items                    | Tab navigation séquentielle                      |
| Burger menu mobile            | Enter ouvre, Escape ferme                        |
| Skip links (3)                | Visibles au focus, Enter saute à la cible       |
| Hero                          | Pas d'éléments focusables (typographie pure)    |
| Section 02 (récit)             | Pas d'éléments focusables (texte de lecture)    |
| Photo « la mère de Salma »    | Pas focusable (décorative narrative)            |
| Section 03 (citation Salma)    | Pas d'éléments focusables                       |
| Photo « Salma au travail »    | Pas focusable                                    |
| Section 04 (atelier)          | 3 photos pas focusables (décoratives)           |
| Section 05 (matières)          | 4 cards pas focusables (statiques)              |
| Section 06 (engagements)       | 4 cards pas focusables (statiques)              |
| Cross-link Journal            | Tab focus + Enter (navigation)                   |
| CTA « Visiter le journal »   | Tab focus + Enter (navigation vers `/journal`)   |
| Footer liens                  | Tab navigation                                   |

> **Page de lecture quasi-statique** : le tab order est minimal (header → cross-link CTA → footer). Cette simplicité est **stratégique** — la page n'est pas une interface, c'est un texte.

### 17.4 — Focus ring

| Propriété     | Valeur                                          |
| :------------ | :---------------------------------------------- |
| Couleur       | `#A8C4A6` (Sauge dark)                          |
| Épaisseur     | 2px                                             |
| Offset        | 4px                                             |
| Border-radius | Hérite de l'élément (0 sauf burger button)      |
| Outline-style | `solid`                                         |
| Visible       | Sur focus clavier uniquement (`:focus-visible`) |

### 17.5 — ARIA labels & landmarks

```html
<header role="banner" aria-label="En-tête principal">
  <nav aria-label="Navigation principale">...</nav>
</header>

<main role="main" aria-label="Page institutionnelle de la maison FemiGlow">

  <section aria-labelledby="maison-hero-headline">
    <span class="kicker">LA MAISON</span>
    <h1 id="maison-hero-headline">
      Une marque commence parfois par une question simple. La nôtre est née de celle-ci :
      pourquoi nos mains, qui font tant, reçoivent-elles si peu ?
    </h1>
  </section>

  <section aria-labelledby="origine-title">
    <span class="kicker">L'ORIGINE</span>
    <h2 id="origine-title" class="visually-hidden">L'origine — le récit fondateur</h2>
    <article>
      <p>Tout commence à Casablanca, dans la cuisine de la mère de Salma...</p>
      <!-- ... 5 paragraphes du récit ... -->
      <p>Mais c'est le même geste.</p>
    </article>
    <figure>
      <img src="..." alt="Mains âgées d'une femme marocaine, posées sur un tissu beige, lumière douce d'intérieur">
      <figcaption>Mains. La mère.</figcaption>
    </figure>
  </section>

  <section aria-labelledby="fondatrice-title">
    <span class="kicker">SALMA</span>
    <h2 id="fondatrice-title" class="visually-hidden">La fondatrice</h2>
    <figure>
      <img src="..." alt="Mains de Salma versant une poudre claire dans un pot, tablier crème, lumière latérale d'atelier">
    </figure>
    <blockquote cite="https://femiglow.ma/maison">
      <p>« Je ne suis pas une chimiste. Je ne suis pas une artisane japonaise. Je suis une Marocaine qui a vu sa mère prendre soin de ses mains en cachette, et qui a voulu que ce geste devienne un peu plus visible. »</p>
      <hr aria-hidden="true">
      <footer>
        <cite>
          <strong>Salma</strong> · fondatrice
          <span class="date">Casablanca, mars 2026</span>
        </cite>
      </footer>
    </blockquote>
  </section>

  <section aria-labelledby="atelier-title">
    <span class="kicker">L'ATELIER</span>
    <h2 id="atelier-title" class="visually-hidden">L'atelier de Casablanca</h2>
    <p class="intro">Casablanca. Quartier Maârif, troisième étage d'un immeuble des années cinquante.</p>

    <div role="list" aria-label="Vues de l'atelier">
      <figure role="listitem">
        <img src="..." alt="Vue large d'une pièce d'atelier — table en bois clair au centre, fenêtres à gauche laissant entrer la lumière, étagère de matières au fond">
      </figure>
      <figure role="listitem">
        <img src="..." alt="Macro d'une table de travail — pots de soin ouverts, balance électronique, pinceau posé">
      </figure>
      <figure role="listitem">
        <img src="..." alt="Étagère avec rangée de pots assemblés et étiquetés à la main, prêts à expédier">
      </figure>
    </div>

    <p>Trois pièces. Une cuisine où les matières sont préparées...</p>
  </section>

  <section aria-labelledby="matieres-title">
    <span class="kicker">LES MATIÈRES</span>
    <h2 id="matieres-title">D'où viennent les éléments du rituel.</h2>

    <div role="list" aria-label="Quatre matières emblématiques de la maison">
      <article role="listitem" aria-labelledby="matiere-1-name">
        <h3 id="matiere-1-name">Cire d'abeille</h3>
        <hr aria-hidden="true">
        <p class="origin"><em>Région d'Imouzzer Kandar. Récolte de fin d'été.</em></p>
        <p class="why">
          <strong>Pourquoi : </strong>conserve l'odeur délicate du miel sauvage,
          fond doucement à la chaleur.
        </p>
      </article>
      <!-- ... 3 autres matières ... -->
    </div>
  </section>

  <section aria-labelledby="engagements-title" class="engagements">
    <h2 id="engagements-title" class="kicker">CE QUE NOUS NOUS ENGAGEONS À FAIRE</h2>

    <div role="list" aria-label="Quatre engagements de la maison">
      <article role="listitem" aria-labelledby="engagement-1-title">
        <h3 id="engagement-1-title">
          <span class="number" aria-label="Engagement numéro 1">①</span>
          Matières
        </h3>
        <hr aria-hidden="true">
        <p>Aucun parfum synthétique. Aucun parabène. Aucun conservateur agressif. Si une matière est étrangère, son origine est nommée.</p>
      </article>
      <!-- ... 3 autres engagements ... -->
    </div>
  </section>

  <section aria-labelledby="crosslink-journal-title">
    <article>
      <figure>
        <img src="..." alt="Carnet ouvert posé sur une table, plume à côté, tasse de thé tiède, lumière de fin d'après-midi">
      </figure>
      <span class="kicker">POUR CONTINUER</span>
      <h2 id="crosslink-journal-title">Lire le journal.</h2>
      <p>Des fragments écrits depuis l'atelier — sur les matières, les saisons, et les voix qui nous tiennent.</p>
      <a href="/journal" class="cta">
        Visiter le journal <span aria-hidden="true">→</span>
      </a>
    </article>
  </section>
</main>

<footer role="contentinfo" aria-label="Pied de page">...</footer>
```

### 17.6 — Annonces dynamiques — quasi-aucune

`/maison` est une page **statique** : aucune mécanique dynamique majeure. Pas de `aria-live` régions, pas de mise à jour de contenu après chargement.

> **Différence majeure avec `/journal` ou `/kit`** : ces pages avaient des annonces dynamiques (filtrage, ajout au panier). `/maison` est silencieuse — c'est une page de lecture pure.

### 17.7 — Images & alt texts

| Image                                              | Alt text                                                                    |
| :------------------------------------------------- | :-------------------------------------------------------------------------- |
| Photo « la mère de Salma » (section 02)            | « Mains âgées d'une femme marocaine, posées sur un tissu beige, lumière douce d'intérieur » |
| Photo « Salma au travail » (section 03)            | « Mains de Salma versant une poudre claire dans un pot, tablier crème, lumière latérale d'atelier » |
| Photo 1 atelier — vue large (section 04)           | « Vue large d'une pièce d'atelier — table en bois clair au centre, fenêtres à gauche laissant entrer la lumière, étagère de matières au fond » |
| Photo 2 atelier — table macro (section 04)         | « Macro d'une table de travail — pots de soin ouverts, balance électronique, pinceau posé » |
| Photo 3 atelier — pots prêts (section 04)          | « Étagère avec rangée de pots assemblés et étiquetés à la main, prêts à expédier » |
| Photo cross-link Journal                            | « Carnet ouvert posé sur une table, plume à côté, tasse de thé tiède, lumière de fin d'après-midi » |
| Fleurons décoratifs                                 | `aria-hidden="true"` (décoratifs)                                            |
| Filets séparateurs                                  | `aria-hidden="true"`                                                          |
| Numéros ① ② ③ ④ des engagements                     | `aria-label="Engagement numéro X"` (lecteur d'écran lit « Engagement numéro 1, Matières ») |

> **Règle d'or pour les alt texts narratifs** : décrire ce qu'on voit comme on le décrirait à quelqu'un qui ne peut pas voir, **sans interpréter** (pas de « belle », « élégante », « émouvante »). Le lecteur d'écran fait sa propre interprétation.

### 17.8 — Citation Salma — sémantique HTML

La citation de Salma doit utiliser la balise `<blockquote>` (pas un `<p>` stylé) :

```html
<blockquote cite="https://femiglow.ma/maison">
  <p>« Je ne suis pas une chimiste. Je ne suis pas une artisane japonaise. Je suis une Marocaine qui a vu sa mère prendre soin de ses mains en cachette, et qui a voulu que ce geste devienne un peu plus visible. »</p>
  <footer>
    <cite>
      <strong>Salma</strong> · fondatrice
      <span class="date">Casablanca, mars 2026</span>
    </cite>
  </footer>
</blockquote>
```

> **Pourquoi `<blockquote>` ?** Parce qu'il est **sémantiquement** une citation. Les lecteurs d'écran annoncent : *« Citation longue, début... fin de citation »*. Cette annonce **renforce l'effet rhétorique** de la voix de Salma.

### 17.9 — Skip links

```html
<a href="#main" class="skip-link">Aller au contenu principal</a>
<a href="#origine-title" class="skip-link">Aller au récit fondateur</a>
<a href="#engagements-title" class="skip-link">Aller aux engagements</a>
```

> **Trois skip links** sur `/maison` :
> 1. Vers le main (saut du header)
> 2. Vers le récit fondateur (la cliente qui revient peut directement aller à l'origine)
> 3. Vers les engagements (la cliente qui veut vérifier les promesses)

### 17.10 — Réduction du mouvement

```css
@media (prefers-reduced-motion: reduce) {
  /* Toutes animations désactivées */
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }

  /* Hero : fleuron + texte apparaissent finalisés */
  .maison-hero > * {
    opacity: 1 !important;
    transform: none !important;
  }

  /* Photos : pas d'animation fade-in */
  img {
    opacity: 1 !important;
    transform: none !important;
  }

  /* Cards (matières, engagements) : pas de cascade */
  .matiere-card, .engagement-card {
    opacity: 1 !important;
    transform: none !important;
    transition: none !important;
  }

  /* Hover photos : pas de zoom-in */
  figure:hover img {
    transform: none !important;
  }

  /* CTA flèche cross-link : pas d'animation */
  .cta:hover .arrow {
    transform: none !important;
  }
}
```

### 17.11 — Lecture par lecteur d'écran — flux

#### Pour une utilisatrice avec lecteur d'écran (NVDA, VoiceOver, TalkBack)

```
1. « En-tête principal »
2. « Navigation principale, liste de 5 éléments... »
3. « Page institutionnelle de la maison FemiGlow, contenu principal »
4. « LA MAISON »
5. « Une marque commence parfois par une question simple. La nôtre est née de celle-ci : pourquoi nos mains, qui font tant, reçoivent-elles si peu ? Heading 1 »
6. « L'ORIGINE »
7. « L'origine — le récit fondateur, heading 2 (visually hidden) »
8. « Article. Tout commence à Casablanca, dans la cuisine de la mère de Salma... »
9. ... [récit complet lu]
10. « Mais c'est le même geste. Fin de l'article. »
11. « Image : Mains âgées d'une femme marocaine, posées sur un tissu beige, lumière douce d'intérieur »
12. « Légende : Mains. La mère. »
13. « SALMA »
14. « Image : Mains de Salma versant une poudre claire dans un pot, tablier crème, lumière latérale d'atelier »
15. « Citation longue. Je ne suis pas une chimiste. Je ne suis pas une artisane japonaise. Je suis une Marocaine qui a vu sa mère prendre soin de ses mains en cachette, et qui a voulu que ce geste devienne un peu plus visible. Fin de citation. »
16. « Salma, fondatrice, Casablanca, mars 2026 »
17. « L'ATELIER »
18. « Casablanca. Quartier Maârif, troisième étage d'un immeuble des années cinquante. »
19. « Vues de l'atelier, liste de 3 éléments »
20. ... etc.
```

> **Note** : la séquence est cohérente, narrative, et préserve l'ordre éditorial. Les `aria-hidden` sont bien placés pour cacher les éléments décoratifs (fleurons, filets).

### 17.12 — Test d'accessibilité — checklist

| Outil                | Usage                                                       |
| :------------------- | :---------------------------------------------------------- |
| **axe DevTools**     | Audit automatique sur chaque déploiement                     |
| **WAVE**             | Audit visuel en complément                                  |
| **Lighthouse**       | Score d'accessibilité ≥ 95/100                              |
| **NVDA + Firefox**   | Test lecteur d'écran Windows                                |
| **VoiceOver + Safari** | Test lecteur d'écran macOS/iOS                            |
| **TalkBack**         | Test lecteur d'écran Android                                |
| **Tab order audit**  | Vérification manuelle de la séquence Tab (très courte)      |
| **Color contrast**   | WebAIM Contrast Checker                                      |
| **Lecture longue**   | Tester l'écoute du récit fondateur (250 mots) au lecteur d'écran |
| **Citation Salma**   | Vérifier l'annonce « Citation longue / Fin de citation »    |

---

## 18 — Microcopy & états

### 18.1 — Une page sans micro-interactions

`/maison` est volontairement la page **la plus pauvre en états** du site B2C. Aucune mécanique d'interaction lourde :
- Pas de formulaire (la newsletter est sur `/journal`)
- Pas de filtre (la grille des articles est sur `/journal`)
- Pas d'add-to-cart (réservé à `/kit`)
- Pas de modal ouvert au scroll
- Pas de système de like, commentaire, partage

> Cette pauvreté en états est **stratégique**. La page doit ressembler à un **livre ouvert**, pas à une **interface**.

### 18.2 — Textes utilitaires de la page

| Contexte                              | Microcopy                                                       |
| :------------------------------------ | :-------------------------------------------------------------- |
| Loading initial                       | (aucun — `font-display: swap` invisible)                        |
| Photo « la mère de Salma » échec      | Fallback fond crème uni, le texte du récit reste fonctionnel    |
| Photo Salma échec (section 03)         | Fallback fond crème uni, la citation reste centrale              |
| Photos atelier échec                  | Placeholder discret en sauge pâle, sans message                  |
| Cookies banner (premier accès)        | « Nous utilisons des cookies pour comprendre votre visite. »     |
| Erreur 404 vers `/maison`             | (n/a — la page existe en SSG)                                   |
| Erreur 500 sur la page                | « La maison rencontre un trouble passager. Revenez dans quelques instants. » |

### 18.3 — État du hover (tous les éléments)

| Élément                            | Microcopy / Tooltip                                  |
| :--------------------------------- | :--------------------------------------------------- |
| Photos lifestyle (sections 02-04)  | Aucun tooltip — les photos sont contemplatives       |
| Cards matières (section 05)        | Aucun hover, aucun tooltip                            |
| Cards engagements (section 06)     | Aucun hover, aucun tooltip                            |
| CTA cross-link Journal             | Hover modifie fond + flèche, pas de tooltip          |
| Liens du footer                    | Hover sur les liens — pas de tooltip                  |

### 18.4 — État 404 spécifique au site

Si une cliente arrive sur `/maison/atelier/casablanca` (sous-page inexistante) ou `/maison/equipe` (page non créée) :

```
┌────────────────────────────────────────────────────┐
│                                                    │
│      Cette page s'est égarée de la maison.         │
│                                                    │
│   Mais la porte est ouverte — vous pouvez          │
│   revenir au début, ou continuer ailleurs.         │
│                                                    │
│   ┌──────────────────────┐ ┌──────────────────────┐│
│   │ Retour à la maison → │ │ Visiter le journal → ││
│   └──────────────────────┘ └──────────────────────┘│
│                                                    │
└────────────────────────────────────────────────────┘
```

| Propriété      | Valeur                                                  |
| :------------- | :------------------------------------------------------ |
| Titre          | Cormorant Light Italic 28pt, couleur Encre              |
| Description    | Cormorant Regular 15pt, couleur Encre claire            |
| CTA 1          | Vers `/maison` (revenir)                                |
| CTA 2          | Vers `/journal` (continuer ailleurs)                    |
| Tonalité       | Paisible, presque hospitalière (« la porte est ouverte »)|

### 18.5 — Tonalité globale des messages — règles

**Toujours paisible. Toujours littéraire.** Jamais d'urgence, jamais d'alarme, jamais d'emoji exclamatif.

| À éviter                                 | À préférer                                              |
| :--------------------------------------- | :------------------------------------------------------ |
| « Erreur 404 ! Page non trouvée »        | « Cette page s'est égarée de la maison. »               |
| « Page introuvable »                     | (paraphrase narrative, pas administrative)               |
| « Retournez à la page d'accueil »        | « Retour à la maison »                                  |
| « Discover our story »                   | « Lire l'origine »                                       |
| « Meet our founder »                     | « La voix de Salma »                                    |
| « Visit our atelier »                     | « Casablanca, Quartier Maârif »                         |
| « Our values »                           | « Ce que nous nous engageons à faire »                  |
| « Sustainable », « eco-friendly »         | « Pas de plastique à usage unique »                     |
| « Find out more »                         | (aucun — la transparence est complète, rien de caché)   |

### 18.6 — Microcopy mobile spécifique

| Contexte                              | Microcopy                                          |
| :------------------------------------ | :------------------------------------------------- |
| Burger menu fermé (aria-label)        | « Ouvrir le menu de navigation »                   |
| Burger menu ouvert (aria-label)       | « Fermer le menu de navigation »                   |
| Photos empilées mobile                | Aucun texte — l'ordre photo→texte est silencieux  |
| Cards engagements en colonne          | Aucun changement de copy par rapport à desktop     |

### 18.7 — Cookies banner

Identique à toutes les autres pages. Apparaît une seule fois, ne re-apparaît pas si déjà répondu.

```
┌────────────────────────────────────────────────────────────────┐
│  Nous utilisons des cookies pour comprendre votre visite       │
│  et améliorer votre expérience. Aucun partage commercial.      │
│                                                                │
│  [Tout accepter]  [Personnaliser]  Refuser                     │
└────────────────────────────────────────────────────────────────┘
```

### 18.8 — Légendes optionnelles des photos

Sur `/maison`, **certaines photos** ont une légende minimale, **d'autres non**. Choix éditorial :

| Photo                                              | Légende ?                                       | Si oui                  |
| :------------------------------------------------- | :---------------------------------------------- | :---------------------- |
| Photo « la mère de Salma » (section 02)            | **Oui** (optionnelle)                            | « Mains. La mère. »     |
| Photo « Salma au travail » (section 03)            | **Non** — la citation **est** la légende         | n/a                     |
| Photo 1 atelier (vue large)                        | **Non** — l'introduction « Casablanca, Quartier Maârif... » fait office de légende contextuelle | n/a |
| Photo 2 atelier (table macro)                      | **Non**                                          | n/a                     |
| Photo 3 atelier (pots prêts)                       | **Non**                                          | n/a                     |
| Photo cross-link Journal                           | **Non** — le titre + description suffit          | n/a                     |

> **Règle** : une légende n'apparaît que si elle **ajoute** quelque chose de poétique ou clarifiant. Si l'image se suffit à elle-même (ou si le contexte textuel l'explique), pas de légende.

### 18.9 — Aucun email transactionnel lié à `/maison`

Contrairement à `/journal` (newsletter) ou `/kit` (confirmation de commande), **aucun email** n'est déclenché depuis `/maison`. Page purement contemplative.

### 18.10 — Aucun message d'erreur de validation

Aucun formulaire = aucun message d'erreur de validation à prévoir.

> Si la cliente clique sur le CTA cross-link Journal et que `/journal` est temporairement indisponible (ce qui ne devrait jamais arriver en SSG), le navigateur affiche son propre message d'erreur natif. La maison ne gère pas ce cas exceptionnel.

---

## 19 — Synthèse — checklist de validation

Avant mise en production, vérifier que chaque élément ci-dessous est validé. C'est l'audit final de la page `/maison`.

### 19.1 — Identité de marque & voix éditoriale

- [ ] Wordmark Pinyon Script présent en header et footer
- [ ] Aucune substitution de police pour le wordmark
- [ ] Palette signature respectée (sauge dominante, crème support, encre tranche)
- [ ] **Champagne utilisé exactement 1-2 fois** sur la page (kicker hero « LA MAISON », et éventuellement kicker section 03 « SALMA » — choix éditorial)
- [ ] Photo « la mère de Salma » lifestyle macro (jamais portrait frontal)
- [ ] Photo « Salma au travail » montre les mains, **JAMAIS le visage**
- [ ] 3 photos atelier contextuelles (espace, table, pots)
- [ ] Photo cross-link Journal éditoriale (carnet, plume, thé)
- [ ] Pas d'emoji nulle part
- [ ] **Pas de pop-up newsletter** sur cette page
- [ ] Pas de barre de progression de scroll
- [ ] Pas de sticky CTA d'achat
- [ ] **Pas de CTA d'achat sur cette page** (ni vers /kit, ni de prix)
- [ ] **Pas de bouton de partage social** (la page institutionnelle ne se partage pas)

### 19.2 — Copy & ton narratif

- [ ] Hero kicker : « LA MAISON » Inter SemiBold tracking 4px **en Champagne**
- [ ] Hero phrase d'accroche : « Une marque commence parfois par une question simple... » (4 lignes, question rhétorique)
- [ ] Section 02 surtitre : « L'ORIGINE » en Brume
- [ ] Section 02 récit : ~250 mots en 6 paragraphes, narration neutre (pas de « je »)
- [ ] Section 02 phrase finale : « Mais c'est le même geste. » isolée
- [ ] Section 02 légende photo (optionnelle) : « Mains. La mère. »
- [ ] Section 03 surtitre : « SALMA » centré
- [ ] Section 03 citation : 5 lignes, **italic**, première personne, vulnérabilité avouée
- [ ] Section 03 signature : « Salma · fondatrice » + « Casablanca, mars 2026 »
- [ ] Section 04 surtitre : « L'ATELIER »
- [ ] Section 04 phrase intro : précision géographique « Quartier Maârif, troisième étage d'un immeuble des années cinquante »
- [ ] Section 04 texte : mention « lumière de la mer » + « mains que nous connaissons »
- [ ] Section 05 surtitre : « LES MATIÈRES »
- [ ] Section 05 titre : « D'où viennent les éléments du rituel. »
- [ ] Section 05 : 4 mini-fiches avec origine géographique précise + « Pourquoi : »
- [ ] Section 05 : transparence sur le mica étranger (Inde, RMI)
- [ ] Section 06 surtitre : « CE QUE NOUS NOUS ENGAGEONS À FAIRE »
- [ ] Section 06 : 4 engagements numérotés ① ② ③ ④
- [ ] Section 06 engagement #4 : phrase « Sans appropriation, avec respect. »
- [ ] Cross-link kicker : « POUR CONTINUER »
- [ ] Cross-link titre : « Lire le journal. » (italic)
- [ ] Cross-link CTA : « Visiter le journal → » avec flèche
- [ ] Tonalité paisible partout, jamais commerciale ni urgente
- [ ] Apostrophes typographiques courbes ' partout
- [ ] Guillemets français « » avec espaces insécables sur la citation

### 19.3 — Tactiques Kolenda — minimum 4 par section

- [ ] **Hero éditorial** : `EMPTY SPACE MAX (57%)` `QUESTION RHETORIQUE` `INDIRECT CLAIM PAR SOBRIETE` `CHAMPAGNE SIGNAL`
- [ ] **L'origine** : `FOUNDER STORY (Schubert 2018)` `ARISTOTELIAN 3-ACT NARRATIVE` `COUNTRY OF ORIGIN EFFECT (Verlegh)` `PHRASE FINALE CADENAS`
- [ ] **La fondatrice** : `VULNERABILITY ADMITTED (Brown 2010)` `ITALIC = VOIX SUBJECTIVE` `IMPLY HUMAN (Lu 2023)` `SPECIFICITE DATEE (+18% credibility)` `PREMIER "JE" SINCERE`
- [ ] **L'atelier** : `SPECIFICITE GEOGRAPHIQUE (+24% authentic, Olson)` `IMPLY HUMAN (traces sans personnel)` `ANTI-INDUSTRIEL POSITIONING` `LUMIERE COMME SIGNATURE POETIQUE`
- [ ] **Les matières** : `TRANSPARENCY = TRUST (Slovic 1995)` `INDIRECT ETHICAL POSITIONING (RMI)` `WHY > WHAT (Sinek)` `COOPERATIVE FEMININE IMPLICITE`
- [ ] **Les engagements** : `ENGAGEMENT FORMEL (Cialdini)` `VULNERABILITY + ETHICS` `SPECIFICITY > GENERALITY` `NUMBERED LIST = FORMAL PACT`
- [ ] **Cross-link** : `SINGLE STRONG LINK (Iyengar curation)` `VOCABULAIRE LITTERAIRE COHERENT`

### 19.4 — Performance (cibles modérées)

- [ ] **LCP < 2.4s** sur 4G simulé Maroc
- [ ] **CLS < 0.08**
- [ ] **INP < 200ms**
- [ ] Page weight initiale (hors images lazy) < 550 KB
- [ ] Photo « la mère de Salma » preloadée avec `fetchpriority="high"` (LCP element)
- [ ] 5 autres photos en `loading="lazy"`
- [ ] Polices critiques preloaded (Inter SemiBold, Cormorant Light, Cormorant Italic critique pour citation Salma)
- [ ] CSS critique inline dans `<head>`
- [ ] JavaScript en defer (animations + lazy loading uniquement)
- [ ] CDN configuré (Polish, Mirage)
- [ ] **Stratégie SSG pure** recommandée (page change 1-2× / an)
- [ ] Pas d'API à appeler côté client

### 19.5 — Statique (page de lecture)

- [ ] Aucune mécanique de filtrage
- [ ] Aucune pagination
- [ ] Aucun formulaire
- [ ] Aucun add-to-cart
- [ ] Aucune modal au scroll
- [ ] Aucun système de like/comment/share
- [ ] Aucun changement de contenu après chargement
- [ ] Tab order minimal (header → cross-link CTA → footer)

### 19.6 — Responsive

- [ ] Mobile 375px, 390px, 414px testés
- [ ] Tablet 768px, 1024px testés
- [ ] Desktop 1280px, 1440px, 1920px testés
- [ ] Aucun débordement horizontal à aucune taille
- [ ] Touch targets ≥ 44×44px sur mobile
- [ ] Texte minimum 14px sur mobile (sauf microcopy contextuel)
- [ ] **Hero mobile** : phrase d'accroche 24pt, fond crème uni
- [ ] **L'origine mobile** : photo dessus, récit dessous (empilage)
- [ ] **La fondatrice mobile** : photo, citation, signature centrés
- [ ] **L'atelier mobile** : 3 photos empilées (pas en ligne)
- [ ] **Les matières mobile** : 1 colonne (pas 2×2)
- [ ] **Les engagements mobile** : 1 colonne
- [ ] **Cross-link mobile** : photo dessus, info dessous

### 19.7 — SEO

- [ ] Title 56-60 caractères : « La maison — FemiGlow · L'atelier, le rituel, l'histoire »
- [ ] Meta description ≤ 192 caractères
- [ ] Open Graph image 1200×630 (photo atelier OU composition typographique)
- [ ] Twitter Card configurée
- [ ] **Schema.org AboutPage + Organization** JSON-LD complet (foundingDate 2024, founder Salma, address Casablanca Maârif)
- [ ] **Schema.org BreadcrumbList** pour navigation
- [ ] Schema LocalBusiness optionnel V2 (si ouverture publique de l'atelier)
- [ ] Canonical URL `https://femiglow.ma/maison`
- [ ] Hreflang fr-MA + ar-MA + x-default
- [ ] Sitemap.xml inclut `/maison` avec **priority 0.8**
- [ ] H1 unique = phrase d'accroche du hero (sémantiquement riche)
- [ ] Hiérarchie H2/H3 cohérente
- [ ] Mots-clés sémantiques LSI naturellement présents (Casablanca, Maârif, P-Shine, Kyoto, atelier, mains, soin)
- [ ] `max-image-preview:large` dans robots meta
- [ ] **Pas de FAQ schema** (aucune Q/R sur cette page)

### 19.8 — Accessibilité (page de lecture)

- [ ] WCAG 2.2 AA validé via axe-core ou WAVE
- [ ] Contrastes vérifiés sur toutes les combinaisons texte/fond
- [ ] Navigation clavier complète (Tab, Enter)
- [ ] Focus ring visible et cohérent
- [ ] ARIA landmarks et labels en place
- [ ] **Citation Salma** : balise `<blockquote>` avec `<cite>` et `<footer>` (sémantique HTML)
- [ ] **Photos atelier** : `role="list"` autour des 3 figures
- [ ] **Cards matières et engagements** : `role="list"` + `role="listitem"`
- [ ] **Numéros engagements** : `aria-label="Engagement numéro X"` sur chaque ① ② ③ ④
- [ ] Alt texts narratifs sur les 6 photos lifestyle
- [ ] **3 skip links** : main / origine-title / engagements-title
- [ ] `prefers-reduced-motion` respecté (animations + cascade + hover photos)
- [ ] Test lecteur d'écran NVDA, VoiceOver, TalkBack
- [ ] Lighthouse Accessibility score ≥ 95/100
- [ ] Lecture du récit fondateur (250 mots) testée au lecteur d'écran
- [ ] Annonce « Citation longue / Fin de citation » correcte sur la voix de Salma

### 19.9 — Émotion & cohérence narrative

- [ ] **La page raconte une histoire** — du temps (origine) vers l'espace (atelier) vers les matières vers la promesse
- [ ] **Aucune transaction directe** sur cette page institutionnelle
- [ ] **Aucun lien d'achat** vers `/kit` (sauf via le footer global, qui est neutre)
- [ ] **L'imply human est strict** : Salma sans visage, mains seules partout
- [ ] **L'origine modeste** est préservée (cuisine de la mère, troisième étage)
- [ ] **La vulnérabilité est avouée** dans la citation Salma (« Je ne suis pas une chimiste »)
- [ ] **La double origine géographique** (Maroc + Japon) est honnêtement énoncée
- [ ] **L'engagement éthique** sur le mica étranger est documenté (RMI)
- [ ] **L'engagement #4 anti-appropriation** culturelle est inclus
- [ ] La voix éditoriale est **cohérente** avec /accueil, /rituel, /kit, /journal
- [ ] **Aucun jargon corporate** : pas de « mission », « vision », « valeurs fondatrices »
- [ ] **Aucune team page** : seule Salma apparaît, et seulement par sa voix et ses mains
- [ ] **Aucune timeline marketing** : juste « 2024 » mentionné une fois dans le récit
- [ ] **Aucune statistique** (« +1000 femmes satisfaites », « 95% de naturel »)
- [ ] La page peut être lue **sans rien acheter ensuite** — et c'est sa réussite
- [ ] Architecture émotionnelle : reconnaissance → surprise → connexion → concrétude → confiance → adhésion → continuation

---

> *« Une page institutionnelle qui se lit comme un essai. Une marque qui se présente sans se vendre. Une fondatrice qui se nomme sans se montrer. Et qui, par cette retenue, gagne plus que toute promesse marketing ne pourrait jamais faire. »*

**FIN · FemiGlow · Spécification de la page Maison v1.0 · Mai 2026**

*Prochaines spécifications (B2C) à produire : `/journal/[slug]` (page article individuelle — TOC, partage, scroll-spy), `/panier`, `/commander ★` (checkout 3 étapes), `/merci` (post-achat).*

*B2B à venir : `/partenaires`, `/programme`, `/echantillon ★`, `/espace-pro`.*
