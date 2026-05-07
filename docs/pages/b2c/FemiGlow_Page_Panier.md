# Page Panier — `/panier`

> **Univers Particulier · B2C · Page-charnière du funnel** — Document de spécification détaillée
> *Volume IX · Mai 2026 · Complémentaire à la charte graphique et au document d'architecture.*
> *Page de transition critique entre `/kit` (inspiration) et `/commander` (transaction).*

---

## Sommaire

1. [Identité de la page](#1--identité-de-la-page)
2. [Contexte stratégique](#2--contexte-stratégique)
3. [Architecture verticale globale](#3--architecture-verticale-globale)
4. [Header — élément persistant](#4--header--élément-persistant)
5. [Section 01 — Hero du panier (titre + état)](#5--section-01--hero-du-panier-titre--état)
6. [Section 02 — Liste des articles](#6--section-02--liste-des-articles)
7. [Section 03 — Récapitulatif & CTA principal](#7--section-03--récapitulatif--cta-principal)
8. [Section 04 — Trust signals & FAQ courte](#8--section-04--trust-signals--faq-courte)
9. [Section 05 — Cross-link contextuel](#9--section-05--cross-link-contextuel)
10. [Section 06 — État panier vide](#10--section-06--état-panier-vide)
11. [Footer — élément persistant](#11--footer--élément-persistant)
12. [Comportements transverses](#12--comportements-transverses)
13. [Adaptation responsive](#13--adaptation-responsive)
14. [Performance technique](#14--performance-technique)
15. [SEO & métadonnées](#15--seo--métadonnées)
16. [Accessibilité (a11y)](#16--accessibilité-a11y)
17. [Microcopy & états](#17--microcopy--états)
18. [Persistance & synchronisation](#18--persistance--synchronisation)
19. [Synthèse — checklist de validation](#19--synthèse--checklist-de-validation)

---

## 1 — Identité de la page

| Attribut             | Valeur                                                                  |
| :------------------- | :---------------------------------------------------------------------- |
| **URL**              | `femiglow.ma/panier`                                                    |
| **Type**             | Page-charnière · transition pré-checkout                                  |
| **Audience**         | Cliente avec intention d'achat — un kit (ou plusieurs) ajouté au panier  |
| **Profil cognitif**  | Réflexion finale avant engagement — vérification rationnelle              |
| **Pouvoir d'achat**  | Confirmé en intention — pas encore en action                              |
| **Funnel**           | **BOFU+ / Pré-conversion** — étape critique du tunnel commercial          |
| **Position parcours**| Toujours après `/kit` (clic ATC) — avant `/commander` (clic Commander)    |
| **Durée d'attention**| 30 secondes à 2 minutes — courte, mais décisive                           |
| **Device split**     | Mobile 60% · Desktop 35% · Tablet 5%                                      |
| **Update frequency** | Statique fonctionnellement, configuration en CMS                          |
| **Indexation SEO**   | **`noindex, nofollow`** — page transactionnelle, jamais en SERP           |

### Ce que la page **doit** faire

1. **Confirmer la décision sans friction.** La cliente vient d'ajouter un kit ; elle veut **vérifier** ce qu'elle achète et **passer rapidement** à la commande.
2. **Permettre l'ajustement de quantité** sans rechargement de page (mise à jour dynamique du total).
3. **Afficher la valeur totale en transparence** — sous-total, frais à venir, total estimé.
4. **Rassurer une dernière fois** avec quelques trust signals discrets (livraison, retour, paiement sécurisé).
5. **Préserver la voix éditoriale** — c'est un panier, pas une page Shopify standard.

### Ce que la page **ne doit pas** faire

1. **Faire des upsells agressifs.** Pas de « Vous pourriez aussi aimer... » avec 6 produits qui distraient. La cliente est concentrée sur ce qu'elle achète.
2. **Afficher des urgency timers** (« Plus que 3 articles ! », « Offre expire dans 04:23 »). Ces tactiques **détruisent la confiance** construite par tout le reste du site.
3. **Forcer la création de compte avant le checkout.** Le guest checkout reste possible, comme sur `/commander`.
4. **Cacher des frais.** Si la livraison sera Gratuit ou 30 MAD, c'est visible **dès cette page** (estimation transparente).
5. **Rediriger ailleurs sans raison.** Tout clic doit avoir un sens — modifier, supprimer, continuer, commander.

---

## 2 — Contexte stratégique

### Position dans l'écosystème B2C

```
[ARRIVÉE]                       [PAGE PANIER /panier]              [SUITE]
    │                                   │                             │
/kit (clic ATC) ─────────────►   1. Hero du panier             ──►  /commander (Commander)
Header (clic icône panier) ──►   2. Liste des articles          ──►  /kit (Continuer mes achats)
Email recovery (clic lien) ──►   3. Récap + CTA principal       ──►  /journal (lecture, retour panier)
Sticky panier (mobile) ─────►    4. Trust signals               ──►  /maison (lecture, retour panier)
                                 5. Cross-link
                                 6. État vide (si applicable)
                                   │
                                   ↓
                              Vérification (~30s à 2min)
                                   ↓
                              Commander → /commander (succès)
                              Quitter sans commander → recovery email 24h après
```

### La règle de la transparence finale

> Le panier est le **dernier moment** où la cliente peut **vérifier** ce qu'elle achète sans encore s'engager dans le checkout. Cette transparence est l'**inverse** des paniers qui cachent les frais ou imposent une création de compte.

Cette **transparence finale** est cohérente avec le reste du site : la maison n'a rien à cacher.

### Tension stratégique fondamentale

`/panier` vit dans une triple tension :

#### Tension 1 — Réassurance vs précipitation

> Le panier doit **rassurer** (la cliente vérifie son choix) sans pour autant **freiner** (trop d'éléments distraient et laissent place au doute).

**Résolution** : un layout **épuré** avec juste l'essentiel — articles, récap, CTA. Les trust signals sont **après** le CTA principal, pour ne pas distraire la décision.

#### Tension 2 — Modification vs validation

> La cliente doit pouvoir **modifier** (quantité, suppression) sans pour autant être **incitée à hésiter**.

**Résolution** : les contrôles de modification sont **discrets** (boutons `─` et `+` sobres), pas des CTA tape-à-l'œil. La modification est possible, mais elle n'est pas **suggérée**.

#### Tension 3 — Page transactionnelle vs voix éditoriale

> Le panier est **fonctionnel** par essence (chiffres, boutons). Mais il appartient à une maison qui parle avec poésie partout ailleurs.

**Résolution** : le **fonctionnel domine** (lisibilité, rapidité), mais le **microcopy** garde la voix de la maison (« Votre panier vous attend », « Une commande qui vous ressemble »).

### Architecture émotionnelle

| Étape                          | Émotion d'entrée    | Émotion de sortie       | Mouvement intérieur                  |
| :----------------------------- | :------------------ | :---------------------- | :----------------------------------- |
| Arrivée sur `/panier`          | Intention nouvelle  | Confirmation visuelle    | « Voici ce que j'ai choisi »         |
| Vérification de l'article       | Curiosité           | Validation                | « C'est bien le kit que je voulais »  |
| Lecture du récap                | Calcul              | Acceptation du montant    | « Le prix est clair »                 |
| Clic « Commander »              | Décision            | Engagement                | « Je vais finaliser »                 |

> **Note** : si la cliente **n'a pas encore décidé**, elle peut quitter par « Continuer mes achats » sans culpabilité (vers `/kit`). Le panier ne **piège** jamais.

### KPIs cibles

| Métrique                                          | Cible                            | Source                       |
| :------------------------------------------------ | :------------------------------- | :--------------------------- |
| **Taux de conversion panier → checkout**           | **> 75%** (très haut)            | GA4 funnel                   |
| Taux d'abandon panier (sans tentative checkout)   | < 25%                             | GA4 + recovery emails        |
| Temps moyen sur la page                           | 30s à 2min (médiane ~45s)         | GA4                          |
| Taux de modification de quantité                   | < 15% (la plupart valident sans toucher) | GA4 events           |
| Taux de suppression d'article                      | < 5%                              | GA4 events                   |
| Taux de clic « Continuer mes achats »              | < 10% (la majorité va commander)   | GA4 events                   |
| Récupération via email recovery 24h               | > 12% des paniers abandonnés      | Email automation analytics   |
| LCP                                               | < 1.8s                           | Web Vitals                   |
| CLS                                               | < 0.05                           | Web Vitals                   |
| INP                                               | < 150ms                          | Web Vitals                   |

> **Pourquoi un taux de conversion > 75% est la cible ?** Parce qu'à ce stade, la cliente a déjà cliqué « Ajouter au panier ». Son intention est **maximale**. Tout ce qui dépasse 25% d'abandon est un signal de **friction** dans la page panier.

### Le profil unique de la visiteuse `/panier`

| Caractéristique                   | Valeur                                                           |
| :-------------------------------- | :--------------------------------------------------------------- |
| **Intention**                     | Forte — elle a cliqué ATC sur `/kit`                              |
| **Connaissance produit**          | Forte — vient juste de lire la page produit                       |
| **Patience**                      | Moyenne — elle veut vérifier, pas s'éterniser                      |
| **Tolérance aux erreurs**         | Moyenne — un récap incohérent peut faire abandonner               |
| **Distractions environnantes**    | Variables — souvent un moment volé dans la journée                |
| **Réseau internet**               | Variable — peut perdre connexion entre `/kit` et `/panier`         |
| **Modification potentielle**      | Faible — la plupart valident la quantité par défaut (1)           |

> **La cliente sur `/panier` n'est pas la même** que sur `/kit` (encore en réflexion) ni sur `/commander` (déjà engagée). Elle est dans un **moment de basculement**, ni avant, ni après.

### Spécificités du panier dans le e-commerce marocain

| Spécificité                  | Implication design                                                  |
| :--------------------------- | :------------------------------------------------------------------ |
| **Confiance encore en construction** | Trust signals utiles ici (sécurité, retour, livraison)        |
| **Mobile dominant**          | Layout single column mobile, pas de side-by-side complexe            |
| **Prix unique dans le kit**  | Pas de logique de promo complexe à afficher en V1                    |
| **Frais de livraison estimés**| Affichage transparent : « Frais calculés à l'étape suivante » ou estimation |
| **Pas de wishlist V1**       | Pas de fonctionnalité « Sauver pour plus tard » en MVP               |

### Les trois fonctions de `/panier`

#### Fonction 1 — Vérification (objectif premier)

Permettre à la cliente de **vérifier** ce qu'elle achète avant de s'engager dans le checkout. Cette fonction de vérification **augmente la conversion** car elle désamorce le doute.

#### Fonction 2 — Ajustement (modification fluide)

Permettre l'ajustement de quantité (rare en V1 où il n'y a qu'un seul kit) ou la suppression. La fluidité de cette modification **construit la confiance**.

#### Fonction 3 — Engagement (CTA principal vers checkout)

Le bouton « Commander » est l'aboutissement de la page. Il doit être **visible**, **clair**, et **engageant** sans être agressif.

### Différence avec un panier Shopify standard

| Élément standard Shopify          | FemiGlow `/panier` choix                              |
| :-------------------------------- | :---------------------------------------------------- |
| Upsells « Vous pourriez aussi aimer » | Pas en V1 (focus sur la décision)                  |
| Code promo visible en grand        | Code promo dans `/commander` (pas ici)               |
| Estimation frais avec API ZIP      | Pas de calcul ZIP (Maroc — pas standard)             |
| Compteur de stock urgent           | **Jamais** — pas d'urgency factice                   |
| Pop-up d'incitation à compléter    | **Jamais** — pas de pression                         |
| Newsletter signup en bas           | Pas en checkout funnel — réservé à `/journal`        |
| Cross-sell « Pack avec »           | Pas en V1                                             |
| Reviews aperçu                     | Pas ici (déjà sur `/kit`)                            |

> **La sobriété est stratégique** : moins d'éléments = plus de focus sur la décision. La conversion bénéficie de cette discipline.

---

## 3 — Architecture verticale globale

### Vue d'ensemble — desktop ≥ 1024px

```
┌─────────────────────────────────────────────────────────────────────┐
│  [HEADER — sticky · 80px · icône panier active avec compteur]       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  01. HERO DU PANIER                                                 │
│      Titre « Votre panier » + nombre d'articles                     │
│      Hauteur : 200px                                                │
│                                                                     │
├──────────────────────────────────────────┬──────────────────────────┤
│                                          │                          │
│  02. LISTE DES ARTICLES (60% largeur)    │  03. RÉCAPITULATIF        │
│                                          │  (40% largeur, sticky)   │
│  ┌────────────────────────────────────┐ │                          │
│  │  [📦] Kit Rituel d'Éclat            │ │  Sous-total              │
│  │       Le rituel complet             │ │  Livraison (estimation)  │
│  │                                     │ │  Total                   │
│  │       ─ 1 +    500 MAD       [×]    │ │                          │
│  └────────────────────────────────────┘ │  ┌────────────────────┐  │
│                                          │  │   Commander →      │  │
│  Continuer mes achats                    │  └────────────────────┘  │
│                                          │                          │
│                                          │  Trust signals brefs      │
└──────────────────────────────────────────┴──────────────────────────┘
                                                  │
┌─────────────────────────────────────────────────────────────────────┐
│  04. TRUST SIGNALS & FAQ COURTE (3 colonnes)                        │
│      Livraison · Retour · Paiement sécurisé                          │
│      Hauteur : 240px                                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  05. CROSS-LINK CONTEXTUEL                                          │
│      Vers /journal (lecture pendant la réflexion)                    │
│      Hauteur : 280px                                                 │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  [FOOTER — encre · 320px]                                           │
└─────────────────────────────────────────────────────────────────────┘
```

### Vue d'ensemble — mobile < 768px

```
┌────────────────────────────┐
│  [HEADER — 64px]           │
├────────────────────────────┤
│                            │
│  01. HERO PANIER COMPACT   │
│      Titre + nb articles   │
│                            │
├────────────────────────────┤
│                            │
│  02. LISTE ARTICLES        │
│  ┌──────────────────────┐ │
│  │  [📦]                 │ │
│  │  Kit Rituel d'Éclat   │ │
│  │  Le rituel complet    │ │
│  │                       │ │
│  │  ─ 1 +  500 MAD  [×]  │ │
│  └──────────────────────┘ │
│                            │
│  Continuer mes achats      │
│                            │
├────────────────────────────┤
│                            │
│  03. RÉCAPITULATIF         │
│  Sous-total      500 MAD  │
│  Livraison       Estimée   │
│  Total           500 MAD  │
│                            │
│  ┌──────────────────────┐ │
│  │  Commander →         │ │
│  └──────────────────────┘ │
│                            │
├────────────────────────────┤
│                            │
│  04. TRUST SIGNALS         │
│  3 blocs empilés           │
│                            │
├────────────────────────────┤
│                            │
│  05. CROSS-LINK            │
│                            │
├────────────────────────────┤
│  [FOOTER]                  │
└────────────────────────────┘
```

### Hauteur totale approximative

- **Desktop (1440×900)** : ~1 200-1 400px (1.4-1.6 viewport — page moyenne, scroll modéré)
- **Tablet (768×1024)** : ~1 400-1 600px
- **Mobile (390×844)** : ~1 800-2 200px (en V1 avec 1 kit unique, plus si plusieurs articles ajoutés)

### Le modèle « Articles + Récap sticky »

> **Pattern UX standard** des paniers e-commerce premium (Aesop, Le Labo, Cult Beauty) : zone articles à gauche (60%), récap commande sticky à droite (40%) sur desktop. Sur mobile, le récap apparaît **après** la liste des articles (pas en accordéon — la page panier est plus courte que le checkout).

| Avantage                                       | Justification                                      |
| :--------------------------------------------- | :------------------------------------------------- |
| Récap toujours visible (desktop)               | La cliente voit le total à chaque modification      |
| CTA « Commander » accessible                    | Sticky → toujours à portée de clic                  |
| Hiérarchie claire                               | Articles à gauche = focus, récap à droite = synthèse |
| Mobile : flux linéaire                          | Liste → Récap → CTA (rythme naturel)                |

### Pas d'accordéon récap mobile

> **Différence avec `/commander`** : sur le checkout, le récap est en **accordéon** (fermé par défaut) car la page est longue (3 étapes). Sur `/panier`, la page est **courte** — le récap peut s'afficher **en entier**, juste après la liste des articles.

### Pas de section « Suggestions »

> Pas de « Vous pourriez aussi aimer », pas de « Pack avec », pas de « Récemment vus ». La page reste **focalisée**.

> **Justification** : les études (Baymard 2023) montrent que les suggestions en panier **augmentent l'AOV** (Average Order Value) mais **réduisent légèrement la conversion**. À l'échelle FemiGlow MVP V1 (1 seul produit), les suggestions n'ont pas de sens. En V2 (multi-produits), à reconsidérer avec design éditorial discret.

### Flow d'erreur

Si le panier devient vide (ex: la cliente supprime le seul article) :

- Animation de transition fluide (200ms)
- Affichage de l'**état panier vide** (section 06 — page de récupération)
- CTA principal : « Découvrir le rituel » → vers `/kit`

> **Principe** : ne jamais laisser la cliente devant une page **vide et muette**. Toujours offrir une **continuation**.

---

## 4 — Header — élément persistant

### Comportement spécifique sur `/panier`

Le header est globalement **identique** à celui des autres pages — élément global du site. Cette page n'a **pas** de header simplifié (vs `/commander` qui a un header simplifié strict).

> **Pourquoi pas de header simplifié ici ?** Parce que la cliente n'est pas encore engagée dans le checkout. Elle peut légitimement vouloir **explorer le site** depuis le panier (revoir le rituel, lire un article du Journal). Le header complet **respecte cette liberté**.

### Spécificités sur `/panier`

| Différence                  | Spécification                                                              |
| :-------------------------- | :------------------------------------------------------------------------- |
| **Item actif**              | Aucun item du menu n'est marqué actif — `/panier` n'est pas dans la navigation principale |
| **Icône panier**            | Visuellement marquée : badge avec compteur (ex: `[Panier · 1]`) en sauge dark, plus visible que sur les autres pages |
| **Compteur en sauge dark**  | `#A8C4A6` au lieu de l'encre — signal subtil que la cliente est sur cette page |
| **Hover icône panier**      | Pas de tooltip "Voir le panier" (la cliente y est déjà)                    |
| **Mention sécurité**         | Aucune mention "Commande sécurisée" ici — réservée au header simplifié de `/commander` |

### Comportement de l'icône panier dans le header

Sur les autres pages, cliquer sur l'icône panier dans le header **ouvre un mini-panier dropdown**. Sur `/panier`, ce comportement est **désactivé** — la cliente est déjà sur la page complète.

> **Mais l'icône reste visible et active** : elle reste un point de repère visuel pour la cliente, et signale le nombre d'articles.

### Sticky behavior

Identique aux autres pages : `position: sticky; top: 0`. Au scroll au-delà de 80px, le header se compresse (hauteur 64px) avec ombre subtile.

### Tactiques héritées

Toutes les tactiques héritées (`4 OPTIONS MAX`, `ENTRY POINT FOCAL`, `GROUP SIMILAR ITEMS`, `FRIENDLY COLD`, `STICKY MOMENTUM`) restent en place — `/panier` n'introduit pas de spécificité au-delà du compteur visible.

---

## 5 — Section 01 — Hero du panier (titre + état)

### 5.1 — Wireframe complet

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│                                                                            │
│  Votre panier.                                                             │
│                                                                            │
│  1 article · 500 MAD                                                       │
│                                                                            │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 — Composition générale

| Propriété              | Valeur                                                          |
| :--------------------- | :-------------------------------------------------------------- |
| Fond                   | `#FBF8F1` (Crème) — uni                                          |
| Hauteur                | 200px (desktop) · 160px (tablet) · 140px (mobile)                |
| Padding vertical       | 64px (haut) · 32px (bas)                                         |
| Padding latéral        | 96px (desktop) · 64px (tablet) · 24px (mobile)                  |
| Alignement contenu     | Aligné à gauche (pas centré comme `/maison`)                     |
| Largeur max contenu    | 1200px (cohérent avec le reste de la page)                       |

### 5.3 — Pourquoi un hero **simple et court** ?

> Le panier n'est pas une page éditoriale (`/journal`, `/maison`) ni une page de découverte (`/kit`, `/rituel`). C'est une **page fonctionnelle**. Son hero doit **informer rapidement** sans cérémonie.

| Page         | Hero contient...                            | Justification                                           |
| :----------- | :------------------------------------------ | :------------------------------------------------------ |
| `/accueil`   | Vagues décoratives + texte                  | Première rencontre, signature graphique                  |
| `/rituel`    | Photo lifestyle pleine largeur              | Récit incarné                                            |
| `/kit`       | Photo contextuelle produit                  | Décision d'achat                                         |
| `/journal`   | Aucune photo — typographie pure             | Magazine littéraire                                      |
| `/maison`    | Aucune photo — phrase d'accroche longue      | Page institutionnelle                                    |
| **`/panier`**| **Titre court + état**                       | **Page fonctionnelle, accès rapide au contenu**          |
| `/commander` | (header simplifié, pas de hero)              | Tunnel transactionnel pur                                |

### 5.4 — Titre principal

```
Votre panier.
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Light                                     |
| Taille          | 36pt (desktop) · 30pt (tablet) · 26pt (mobile)               |
| Style           | Regular (pas italic — affirmation simple, pas méditation)    |
| Line-height     | 1.2                                                          |
| Letter-spacing  | -0.3px                                                        |
| Couleur         | `#2C2A28` (Encre)                                            |
| Alignement      | Aligné à gauche                                               |
| Espacement haut | 0 (le padding vertical du container suffit)                  |

> **« Votre panier. »** — possessif simple, point final. Pas « Votre panier d'achat » (jargon e-commerce), pas « Mon panier » (Amazon copying), pas « Cart » (anglophone). Juste le mot **français**, possessif **inclusif**, **point final**.

> **Le point final** est important : il **clôt** l'idée. Pas de « ! » qui crierait. La sobriété typographique signale la maturité de la marque.

### 5.5 — Sous-titre — état du panier

```
1 article · 500 MAD
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Regular Italic                            |
| Taille          | 16pt (desktop) · 15pt (tablet) · 14pt (mobile)                |
| Couleur         | `#6B6863` (Brume)                                            |
| Espacement haut | 12px sous le titre                                            |
| Alignement      | Aligné à gauche                                               |

#### Variantes selon l'état

| État                              | Sous-titre                                          |
| :-------------------------------- | :------------------------------------------------- |
| 1 article                         | « 1 article · 500 MAD »                             |
| 2 articles (V2)                   | « 2 articles · 1 000 MAD »                          |
| 1 article + quantité 2            | « 2 unités · 1 000 MAD »                            |
| Plusieurs articles avec quantités  | « 3 articles · 1 500 MAD »                          |
| Panier vide                        | (le hero est masqué, voir section 06)               |

> **Pourquoi inclure le total ici ?** Parce que la cliente cherche **immédiatement** le montant total. Le mettre dans le hero **élimine la friction de la recherche** et confirme la transparence.

> **Pourquoi en italic Brume ?** Parce que c'est une **information secondaire** (le total exact apparaît dans le récap). L'italic + la couleur Brume signalent ce statut subordonné.

### 5.6 — Pas de fleuron

Contrairement aux pages éditoriales (`/journal`, `/maison`), **pas de fleuron champagne** sur le hero du panier. Cohérent avec :
- `/accueil` (pas de fleuron en hero)
- `/rituel` (pas de fleuron en hero)
- `/kit` (pas de fleuron en hero)
- `/commander` (pas de hero du tout)

> **Règle confirmée** : le fleuron champagne est réservé aux **pages éditoriales nobles** (Journal et Maison). Les pages fonctionnelles s'en passent.

### 5.7 — Pas de breadcrumb

> Pas de breadcrumb « Accueil > Panier » sur cette page. Pourquoi ?
> - La cliente vient de `/kit` ou du header — elle sait d'où elle vient
> - Un breadcrumb suggère une **arborescence à explorer**, ce qui n'est pas l'esprit du panier
> - La sobriété typographique du hero suffit

### 5.8 — Tokens design

```css
/* ─── Hero du panier — tokens ─── */
--panier-hero-bg: #FBF8F1;
--panier-hero-padding-top-desktop: 64px;
--panier-hero-padding-bottom-desktop: 32px;
--panier-hero-padding-x-desktop: 96px;
--panier-hero-padding-x-mobile: 24px;
--panier-hero-content-max-width: 1200px;

--panier-title-font: 'Cormorant Garamond', serif;
--panier-title-weight: 300;
--panier-title-size-desktop: 36pt;
--panier-title-line-height: 1.2;
--panier-title-color: #2C2A28;

--panier-state-font: 'Cormorant Garamond', serif;
--panier-state-style: italic;
--panier-state-size: 16pt;
--panier-state-color: #6B6863;
--panier-state-margin-top: 12px;
```

### 5.9 — Comportements UX

#### Animation au chargement

```
[t=0ms]      → HTML loaded, fond crème visible
[t=200ms]    → Titre fade-in (400ms)
[t=400ms]    → Sous-titre (état) fade-in + translate-up 8px (500ms)
[t=900ms]    → Animations terminées
```

> **Animation rapide** : 900ms total (vs 1.9s sur le hero `/maison`). Le panier est **fonctionnel**, pas méditatif. La cliente veut accéder rapidement au contenu.

#### Pas de parallaxe, pas de hover

Le hero est **statique**. Aucune interaction.

#### Mise à jour dynamique du compteur

Si la cliente modifie la quantité ou supprime un article, le sous-titre se met à jour **instantanément** :

```
[Avant]  1 article · 500 MAD
[Après]  2 unités · 1 000 MAD
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Animation       | Fade-out 200ms / Fade-in 300ms                                |
| Annonce ARIA    | « Total mis à jour : 2 unités, 1 000 dirhams marocains. »    |

### 5.10 — Psychologie

#### 1. Confirmation immédiate (Norman 1988)

> *« System feedback at the entry of a flow reduces user anxiety. »*

Voir « 1 article · 500 MAD » dans les **2 premières secondes** confirme à la cliente qu'elle est au bon endroit, avec le bon contenu, au bon prix.

#### 2. Sobriété = maturité (signal de marque)

> Un titre court + un sous-titre simple, sans décor superflu, signale une **marque mature** qui ne cherche pas à impressionner. Elle informe.

#### 3. Pas de marketing speak

> Pas de « Votre voyage commence ici », pas de « Récapitulatif de votre commande personnalisée ». La cliente vient pour vérifier — la maison **n'en rajoute pas**.

#### 4. Le possessif « Votre »

> Le mot « Votre » crée une **micro-appropriation** symbolique. Ce panier est **à elle**, pas à la maison. Cette nuance, répétée tout au long du tunnel (« Vos informations », « Votre commande »), construit une **complicité commerciale**.

### 5.11 — Émotion à provoquer

| Étape       | Émotion                                                          |
| :---------- | :--------------------------------------------------------------- |
| Arrivée     | Confirmation visuelle (« Je suis bien sur le panier »)             |
| 2 secondes  | Vérification du montant total (« 500 MAD, c'est bien ça »)         |
| 4 secondes  | Premier scroll vers la liste des articles                          |

### 5.12 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| Photo de fond derrière le titre                     | Casse la sobriété fonctionnelle, distrait                           |
| Titre « Mon panier d'achat » ou « Cart »            | Vocabulaire e-commerce générique                                    |
| Phrase d'accroche poétique « Votre voyage commence ici » | Hors registre fonctionnel                                       |
| Pas d'indication de l'état (juste le titre)         | La cliente cherche le total                                          |
| Compteur clignotant pour attirer l'attention        | Manipulation — pas la voix de la maison                              |
| Bouton « Vider le panier » dans le hero             | Détruit la confiance, suggère que la maison veut décourager           |
| Banner promo « Économisez 10% sur votre première commande ! » | Cassure de la voix éditoriale                              |
| Sub-text long (« Vous avez ajouté X articles à votre panier... ») | Bavardage — l'information tient en une ligne              |
| Hero plein viewport                                 | Trop grand pour une page fonctionnelle                                |
| Animation parallaxe                                  | Hors registre                                                         |

---

## 6 — Section 02 — Liste des articles

### 6.1 — Wireframe complet

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                                                                      │  │
│  │  ┌──────────────┐                                                    │  │
│  │  │              │   Kit Rituel d'Éclat                                │  │
│  │  │              │   Le rituel complet — quatre matières, quatre      │  │
│  │  │   [PHOTO]    │   gestes.                                           │  │
│  │  │   [120×120]  │                                                    │  │
│  │  │              │   ─                                                  │  │
│  │  │              │                                                    │  │
│  │  │              │   ┌─────────────┐                                  │  │
│  │  │              │   │  ─   1   +  │              500 MAD       [×]   │  │
│  │  └──────────────┘   └─────────────┘                                  │  │
│  │                                                                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│   ← Continuer mes achats                                                    │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 — Composition générale

| Propriété              | Valeur                                                          |
| :--------------------- | :-------------------------------------------------------------- |
| Fond                   | `#FBF8F1` (Crème) — uni                                          |
| Padding vertical       | 32px (haut) · 64px (bas)                                         |
| Padding latéral        | Hérite du container parent                                        |
| Largeur                | 60% de la grille checkout (desktop) · 100% (mobile)              |

### 6.3 — Container article (card)

#### Disposition

| Propriété         | Valeur                                                          |
| :---------------- | :-------------------------------------------------------------- |
| Fond              | `#FFFFFF` (Crème pure)                                           |
| Border            | 1px solid `#E8E0D2` (Ligne)                                     |
| Border-radius     | 0                                                                |
| Padding           | 24px (desktop) · 16px (mobile)                                  |
| Hauteur           | Auto                                                              |
| Espacement entre cards | 16px (si plusieurs articles — V2)                            |

> **Pourquoi un fond crème pure dans une page crème ?** Pour **différencier visuellement** la zone-article du reste de la page. Cette différenciation discrète crée un **focus visuel** sur ce qui compte — le contenu du panier.

#### Layout interne

| Breakpoint | Layout                                                                |
| :--------- | :-------------------------------------------------------------------- |
| Desktop    | Photo à gauche (120×120px) · contenu à droite (flex 1) · gap 24px      |
| Tablet     | Photo à gauche (96×96px) · contenu à droite · gap 20px                 |
| Mobile     | Photo à gauche (80×80px) · contenu à droite · gap 16px                 |

> **Toujours en row, jamais empilé** : même sur mobile, la photo reste à gauche et le contenu à droite. Cette cohérence de layout préserve la **lisibilité** et la **rapidité de scan**.

### 6.4 — Photo de l'article

| Propriété         | Valeur                                                                |
| :---------------- | :-------------------------------------------------------------------- |
| Sujet             | Kit complet vu de face (les 4 pots alignés ou la boîte)                |
| Format            | Carré (1:1)                                                            |
| Dimensions        | 120×120px (desktop) · 96×96px (tablet) · 80×80px (mobile)              |
| Object-fit        | `cover`                                                                |
| Border            | Aucun                                                                   |
| Border-radius     | 0                                                                      |
| Background fallback| `#F5F0E5` si l'image ne se charge pas                                |

> **Pourquoi cette photo précise ?** Parce que la cliente vient de la voir sur `/kit` — elle doit **reconnaître immédiatement** l'objet. Cohérence avec la photo principale de `/kit` (la même image ou très proche).

### 6.5 — Bloc info à droite de la photo

#### Composition

```
Kit Rituel d'Éclat
Le rituel complet — quatre matières, quatre gestes.

─

┌─────────────┐
│  ─   1   +  │              500 MAD       [×]
└─────────────┘
```

#### Nom du produit

```
Kit Rituel d'Éclat
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Light                                     |
| Taille          | 22pt (desktop) · 19pt (tablet) · 17pt (mobile)               |
| Couleur         | `#2C2A28` (Encre)                                            |
| Lien            | Vers `/kit` (la cliente peut cliquer pour revoir le produit)  |
| Hover           | Underline 1px sauge dark, offset 4px                          |
| Espacement bas  | 8px                                                           |

> **Le nom est cliquable** : si la cliente veut **revoir** le kit (refresh sa mémoire), un clic sur le nom la ramène à `/kit`. Le panier reste **préservé** (pas de perte d'état).

#### Description courte

```
Le rituel complet — quatre matières, quatre gestes.
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Regular Italic                            |
| Taille          | 14pt (desktop) · 13pt (mobile)                                |
| Couleur         | `#4A4844` (Encre claire)                                     |
| Line-height     | 1.5                                                          |
| Espacement bas  | 16px                                                          |
| Largeur max     | 480px                                                         |

> **Pourquoi cette phrase ?** C'est le **tagline** récurrent du kit (apparaît aussi sur `/kit` dans la fiche produit). Sa **répétition** crée une signature mnémotechnique du produit.

#### Filet séparateur

| Propriété      | Valeur                                |
| :------------- | :------------------------------------ |
| Type           | Em-dash horizontal                    |
| Largeur        | 32px                                  |
| Hauteur        | 1px                                   |
| Couleur        | `#A8C4A6` (Sauge dark)                |
| Espacement haut| 0                                     |
| Espacement bas | 16px                                   |

> **Pourquoi ce filet ?** Il **sépare** l'identité du produit (nom + tagline) de la zone fonctionnelle (quantité + prix + supprimer). Hiérarchie visuelle claire.

### 6.6 — Zone fonctionnelle (quantité + prix + supprimer)

#### Layout

| Breakpoint | Layout                                                                |
| :--------- | :-------------------------------------------------------------------- |
| Desktop    | Selector à gauche · Prix au centre · Bouton supprimer à droite          |
| Mobile     | Selector à gauche · Prix à droite · Bouton supprimer en bas (ou inline si large) |

#### Selector de quantité

```
┌─────────────┐
│  ─   1   +  │
└─────────────┘
```

| Propriété          | Valeur                                                          |
| :----------------- | :-------------------------------------------------------------- |
| Container          | Border 1px solid `#E8E0D2`, fond crème pure, hauteur 40px        |
| Largeur container  | 120px                                                              |
| Border-radius      | 0                                                                  |
| Layout             | 3 zones égales (boutons `─` et `+` + valeur centrée)              |
| Bouton `─`         | Texte Inter Regular 14pt, couleur Encre, padding 8px              |
| Bouton `+`         | Idem                                                                |
| Valeur centrale    | Inter Medium 14pt, couleur Encre, alignée centrée                  |
| Hover boutons      | Background `#F5F0E5` (Crème teintée légère)                        |
| Active boutons     | Background `#F0EAD8` (Crème teintée plus marquée)                   |
| Disabled bouton `─`| Si quantité = 1, le bouton `─` reste **actif** (clic = suppression confirmation modal) |
| Touch target       | Chaque bouton ≥ 40px hauteur, ≥ 40px largeur                      |

> **Pourquoi le bouton `─` reste actif à quantité 1 ?** Parce que la cliente peut vouloir **supprimer** l'article. Plutôt que désactiver le bouton (frustrant), un clic à quantité 1 ouvre un **modal de confirmation** : « Supprimer cet article ? »

#### Validation des limites

| Limite              | Comportement                                                |
| :------------------ | :---------------------------------------------------------- |
| Quantité minimale   | 1 (clic `─` à 1 → modal suppression)                        |
| Quantité maximale   | 10 par article (limite de stock V1)                          |
| Au-delà de 10       | Bouton `+` désactivé · message : « Contactez-nous pour les commandes plus grandes. » |

#### Prix unitaire (×quantité)

```
500 MAD
```

| Propriété          | Valeur                                                          |
| :----------------- | :-------------------------------------------------------------- |
| Police             | Inter Medium                                                     |
| Taille             | 16pt (desktop) · 15pt (mobile)                                   |
| Couleur            | `#2C2A28` (Encre)                                                |
| Affichage          | Total ligne (prix unitaire × quantité)                           |
| Animation update   | Fade-out 200ms / fade-in + scale 0.95 → 1.0 (300ms)              |

> **Affichage = total ligne** : si quantité = 2, affichage `1 000 MAD` (pas `500 MAD ×2`). Plus simple à comprendre, moins de calcul mental.

> **Si V2 ajoute des promos** : afficher le prix barré + le prix actuel. En V1, pas de promo, donc juste le prix net.

#### Bouton supprimer `[×]`

| Propriété          | Valeur                                                          |
| :----------------- | :-------------------------------------------------------------- |
| Icône              | `×` (croix simple, SVG ou caractère typographique × U+00D7)     |
| Police             | Inter Regular 18pt                                                |
| Couleur            | `#A8A8A6` (Brume claire)                                          |
| Hover              | Couleur `#9C5B5B` (rouge feutré), tooltip « Supprimer cet article » |
| Touch target       | ≥ 40×40px (zone tactile)                                          |
| Position desktop   | Aligné à droite, centré verticalement avec le selector            |
| Position mobile    | Idem                                                                |

#### Modal de confirmation suppression

Au clic sur `[×]` :

```
┌────────────────────────────────────────────────────┐
│                                                    │
│  Supprimer cet article ?                            │
│                                                    │
│  Kit Rituel d'Éclat                                │
│  500 MAD                                            │
│                                                    │
│   ┌──────────────────┐   ┌──────────────────┐     │
│   │  Supprimer       │   │  Annuler         │     │
│   └──────────────────┘   └──────────────────┘     │
│                                                    │
└────────────────────────────────────────────────────┘
```

| Élément             | Spécifications                                              |
| :------------------ | :---------------------------------------------------------- |
| Titre               | « Supprimer cet article ? » Cormorant Light 22pt            |
| Sous-titre          | Nom du kit + prix (rappel)                                  |
| CTA primaire        | « Supprimer » outline rouge feutré, hover plein               |
| CTA secondaire      | « Annuler » outline encre — focus par défaut                 |
| Backdrop            | `rgba(44, 42, 40, 0.4)` — fond sombre éclairé                |
| Fermeture           | Click outside, Escape, ou clic sur « Annuler »               |

> **Pourquoi un modal de confirmation ?** Parce qu'une suppression accidentelle (mauvais clic mobile) serait **frustrante**. Le modal ajoute 1 seconde de friction qui **protège l'état**.

> **Focus sur « Annuler » par défaut** : si la cliente appuie Enter par réflexe, elle annule (pas confirme). Le **biais conservatif** est volontaire.

### 6.7 — Lien « Continuer mes achats »

```
← Continuer mes achats
```

| Propriété          | Valeur                                                          |
| :----------------- | :-------------------------------------------------------------- |
| Police             | Inter Medium 13pt                                                 |
| Couleur            | `#4A4844` (Encre claire)                                         |
| Hover              | `#2C2A28` (Encre), underline 1px sauge dark, offset 4px          |
| Action             | Navigation vers `/kit` (préservation du panier)                  |
| Position desktop   | Sous le dernier article, aligné à gauche                          |
| Position mobile    | Idem                                                                |
| Espacement haut    | 24px sous la card article                                         |

> **Pourquoi « Continuer mes achats » et pas « Retour aux produits » ?** Parce que :
> - « Continuer » suggère **progression** (la cliente est dans un parcours)
> - « Retour » suggère **régression** (psycho négative)
> - Cohérence avec le bouton « Continuer →» du checkout

### 6.8 — Tokens design

```css
/* ─── Liste des articles — tokens ─── */
--articles-bg: #FBF8F1;
--articles-padding-top: 32px;
--articles-padding-bottom: 64px;

/* Container article (card) */
--article-card-bg: #FFFFFF;
--article-card-border: 1px solid #E8E0D2;
--article-card-padding-desktop: 24px;
--article-card-padding-mobile: 16px;
--article-card-gap: 16px;

/* Photo */
--article-photo-size-desktop: 120px;
--article-photo-size-tablet: 96px;
--article-photo-size-mobile: 80px;
--article-photo-bg-fallback: #F5F0E5;

/* Layout interne */
--article-content-gap-desktop: 24px;
--article-content-gap-mobile: 16px;

/* Nom produit */
--article-name-font: 'Cormorant Garamond', serif;
--article-name-weight: 300;
--article-name-size-desktop: 22pt;
--article-name-color: #2C2A28;
--article-name-margin-bottom: 8px;

/* Description */
--article-desc-font: 'Cormorant Garamond', serif;
--article-desc-style: italic;
--article-desc-size: 14pt;
--article-desc-color: #4A4844;
--article-desc-line-height: 1.5;
--article-desc-margin-bottom: 16px;
--article-desc-max-width: 480px;

/* Filet séparateur */
--article-divider-width: 32px;
--article-divider-color: #A8C4A6;
--article-divider-margin-bottom: 16px;

/* Selector quantité */
--qty-selector-bg: #FFFFFF;
--qty-selector-border: 1px solid #E8E0D2;
--qty-selector-width: 120px;
--qty-selector-height: 40px;
--qty-button-padding: 8px;
--qty-button-hover-bg: #F5F0E5;
--qty-button-active-bg: #F0EAD8;
--qty-value-font: 'Inter', sans-serif;
--qty-value-weight: 500;
--qty-value-size: 14pt;

/* Prix */
--article-price-font: 'Inter', sans-serif;
--article-price-weight: 500;
--article-price-size-desktop: 16pt;
--article-price-color: #2C2A28;

/* Bouton supprimer */
--remove-button-color: #A8A8A6;
--remove-button-hover-color: #9C5B5B;
--remove-button-size: 18pt;

/* Lien continuer */
--continue-link-font: 'Inter', sans-serif;
--continue-link-weight: 500;
--continue-link-size: 13pt;
--continue-link-color: #4A4844;
--continue-link-hover-color: #2C2A28;
--continue-link-margin-top: 24px;
```

### 6.9 — Comportements UX critiques

#### Animation au chargement de la page

```
[t=0ms]      → HTML loaded, structure visible
[t=300ms]    → Card article fade-in + translate-up 12px (500ms)
[t=800ms]    → Animation terminée
```

> **Animation discrète** : la card apparaît rapidement. La cliente ne doit pas attendre.

#### Modification de quantité — flux complet

```
[t=0ms]      → Click sur bouton + ou ─
[t=0-100ms]  → Bouton scale 0.95 (feedback tactile)
[t=100ms]    → Valeur centrale fade-out 200ms
[t=300ms]    → Nouvelle valeur fade-in
[t=300ms]    → API call backend (mise à jour panier serveur)
[t=300-800ms]→ Pendant l'API call : prix ligne en italic discret + spinner mini
[t=500-800ms]→ Réponse API → prix ligne mis à jour avec animation (fade-out / fade-in)
[t=500-800ms]→ Récap (sidebar) recalcule en parallèle
[t=800ms]    → Animation terminée, état stable
```

> **Optimistic UI** : l'interface se met à jour **immédiatement** (sans attendre la réponse serveur). Si l'API échoue, on affiche un message d'erreur et on **rollback** la valeur.

#### Suppression d'article — flux complet

```
[t=0ms]      → Click sur [×]
[t=0-240ms]  → Modal de confirmation s'ouvre (fade-in + scale 0.95 → 1.0)
[t=...]      → Cliente clique « Supprimer » ou « Annuler »
            → Si Annuler : modal se ferme, rien ne change
            → Si Supprimer :
[t=0-200ms]  → Modal se ferme
[t=200-700ms]→ Card article slide-up + fade-out 500ms
[t=700ms]    → Card retirée du DOM
[t=700-900ms]→ Cards suivantes (si V2) remontent (transition layout 200ms)
[t=900ms]    → Si panier devient vide → transition vers état panier vide (section 06)
```

#### Update du récap en parallèle

À chaque modification de quantité ou suppression, le **récap** (sidebar desktop ou bloc mobile) se met à jour **en synchrone** :

- Sous-total recalculé
- Total recalculé
- Hero du panier (compteur d'articles + total) mis à jour

#### Navigation vers `/kit` (lien continuer)

Click sur « Continuer mes achats » → navigation directe vers `/kit`. **Aucun modal de confirmation** (la cliente garde son panier intact via localStorage).

#### Navigation vers `/kit` (clic sur le nom du produit)

Click sur le nom « Kit Rituel d'Éclat » → idem, vers `/kit`. Différence :
- Lien sur le nom : « envie de **revoir** le produit »
- Lien « Continuer mes achats » : « envie de **chercher** autre chose »

> En V1, les deux mènent au même endpoint (`/kit`). En V2 (multi-produits), le premier mènera à la page produit spécifique, le second au catalogue.

### 6.10 — Persistance du panier

À chaque modification de la liste (ajout, retrait, quantité), l'état du panier est **immédiatement sauvegardé** :

- **localStorage** (`femiglow_cart`) — pour la cliente non connectée
- **Backend session** — pour la cliente connectée
- **TTL (Time To Live)** — 30 jours pour localStorage, illimité pour compte connecté

> Voir section 18 pour les détails complets de persistance et synchronisation.

### 6.11 — Cas d'usage complexes

#### Cas 1 — La cliente revient 2 jours après

Le panier est **restauré** depuis localStorage. Affichage normal, sans message particulier.

> Pas de bandeau « Votre ancien panier a été restauré ! » — la cliente s'attend à retrouver son panier (UX standard e-commerce).

#### Cas 2 — Le prix a changé entre l'ajout et le retour

Si le prix du kit a évolué depuis l'ajout au panier :

```
┌──────────────────────────────────────────────────────────┐
│  ⓘ Le prix de ce kit a été ajusté depuis votre dernier   │
│  passage. Nouveau prix : 520 MAD (au lieu de 500 MAD).   │
└──────────────────────────────────────────────────────────┘
```

| Propriété          | Valeur                                                          |
| :----------------- | :-------------------------------------------------------------- |
| Container          | Padding 16px, fond `#FBF5E5` (crème teintée chaude)              |
| Border-left        | 3px solid `#C8A876` (Champagne) — signal d'attention              |
| Icône ⓘ             | Couleur Champagne                                                  |
| Texte              | Cormorant Italic 14pt, couleur Encre claire                       |
| Position           | En haut de la liste, avant la card article                          |
| Action             | Le prix affiché dans la card est **automatiquement** le nouveau prix |

> **Cette transparence proactive** est rare en e-commerce. Elle **construit la confiance** durablement.

#### Cas 3 — Le produit n'est plus disponible

Si le kit est en rupture de stock entre l'ajout et le retour :

```
┌──────────────────────────────────────────────────────────┐
│  ⓘ Ce kit est actuellement indisponible. Il sera de      │
│  retour bientôt. Vous serez prévenue si vous souhaitez. │
│  [Me prévenir] · [Supprimer]                             │
└──────────────────────────────────────────────────────────┘
```

| Élément              | Spécifications                                                |
| :------------------- | :------------------------------------------------------------ |
| Container            | Padding 16px, fond `#F5F0E5` (Crème teintée légère)            |
| Border-left          | 3px solid `#A8C4A6` (Sauge dark)                              |
| Texte                | Cormorant Regular 14pt, couleur Encre claire                  |
| CTA « Me prévenir »   | Lien outline, ouvre un mini-modal avec champ email            |
| CTA « Supprimer »     | Lien underline, supprime de la liste                          |

> **V1** : ce cas est **rare** (atelier petit, contrôle de stock manuel). **V2** : à intégrer si le volume de vente impose des ruptures occasionnelles.

#### Cas 4 — Coupe de réseau pendant modification

Si l'API échoue pendant un update de quantité :

```
┌──────────────────────────────────────────────────────────┐
│  ⚠ La modification n'a pas pu être sauvegardée.          │
│  Vérifiez votre connexion et réessayez.                  │
└──────────────────────────────────────────────────────────┘
```

| Comportement       | Description                                                       |
| :----------------- | :---------------------------------------------------------------- |
| Optimistic UI      | La quantité affichée **rollback** vers la valeur précédente        |
| Bandeau d'erreur   | Apparaît en haut de la card article                                |
| Auto-retry         | Tentative de retry après 3 secondes (silencieuse si succès)         |
| Manual retry        | Si l'utilisatrice modifie à nouveau, nouvelle tentative              |

### 6.12 — Psychologie

#### 1. Visibilité du contenu acheté (Norman 1988)

> *« System feedback at the moment of decision reduces uncertainty. »*

Voir la **photo + nom + prix** clairement affichés à un moment-clé désamorce le doute (« Est-ce bien ce que je voulais ? »).

#### 2. Optimistic UI = sentiment de fluidité

L'interface qui se met à jour **immédiatement** (avant la réponse serveur) crée un sentiment de **fluidité**. La cliente ne sent pas le délai réseau.

#### 3. Modal de confirmation suppression = filet protecteur

> *« Reversibility prevents user errors and builds confidence. »* (Nielsen 1994 — heuristics)

Le modal n'est pas une friction inutile : c'est une **protection** contre les actions accidentelles, particulièrement importantes sur mobile (mauvais clics fréquents).

#### 4. Le filet sauge dark sépare identité et action

> Le filet de 32px entre la description et la zone fonctionnelle (selector + prix + supprimer) crée une **hiérarchie visuelle**. La cliente perçoit inconsciemment : « ceci est l'identité, ceci est l'action ».

#### 5. Lien « Continuer mes achats » sans agressivité

> En V2 multi-produits, ce lien sera **plus important** (cliente peut aller chercher d'autres produits). En V1 (1 seul produit), il est **discret** mais présent — il signale que la cliente n'est **pas piégée**.

### 6.13 — Émotion à provoquer

| Étape       | Émotion                                                          |
| :---------- | :--------------------------------------------------------------- |
| Vue de la card | Reconnaissance immédiate du produit (« C'est bien ça »)        |
| Vérification du prix | Acceptation rationnelle (« 500 MAD, OK »)                  |
| Pas envie de modifier | Prêt à passer au récap → CTA « Commander »                   |

### 6.14 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| Card article sans photo                              | La reconnaissance visuelle est essentielle                          |
| Photo trop petite (< 80px) sur desktop               | Manque de présence visuelle                                          |
| Pas de filet séparateur entre identité et action     | Hiérarchie confuse                                                    |
| Bouton supprimer trop visible (rouge plein, gros)    | Suggère une action que la maison **veut** que la cliente fasse        |
| Quantité maximum non gérée                           | Risque commande absurde (10 000 kits)                                  |
| Pas de modal de confirmation suppression             | Suppressions accidentelles fréquentes                                  |
| Optimistic UI sans rollback en cas d'erreur          | État incohérent entre client et serveur                                |
| Animation de suppression > 1 seconde                  | Friction perçue                                                       |
| Pas de feedback à la modification de quantité         | Cliente doute d'avoir bien cliqué                                      |
| Affichage prix unitaire séparé du total ligne         | Calcul mental requis (charge cognitive inutile)                       |
| Lien « Continuer mes achats » trop visible            | Distrait du CTA principal                                             |
| Bandeau « Vous bénéficiez de la livraison gratuite ! » | Peut sembler manipulatoire — préférer une info neutre dans le récap |

---

## 7 — Section 03 — Récapitulatif & CTA principal

### 7.1 — Wireframe complet

```
┌────────────────────────────────────────┐
│                                        │
│  Récapitulatif                          │
│                                        │
│  Sous-total                  500 MAD   │
│  Livraison                   Estimée    │
│                                        │
│  ─────                                  │
│                                        │
│  Total                       500 MAD   │
│                                        │
│  ┌──────────────────────────────────┐ │
│  │  Commander →                      │ │
│  └──────────────────────────────────┘ │
│                                        │
│  🔒 Paiement sécurisé                   │
│  Livraison sous 3-5 jours               │
│                                        │
│  ─                                       │
│                                        │
│  Avez-vous un code promo ? À          │
│  appliquer à l'étape suivante.         │
│                                        │
└────────────────────────────────────────┘
```

### 7.2 — Position et comportement

| Propriété              | Valeur                                                          |
| :--------------------- | :-------------------------------------------------------------- |
| Position desktop ≥ 1024px | Sticky à droite, top 96px (sous le header)                     |
| Position mobile / tablet < 1024px | Bloc statique en dessous de la liste articles            |
| Largeur                | 360px fixe (40% de la grille checkout)                            |
| Padding                | 32px (desktop) · 24px (mobile)                                   |
| Background             | `#F5F0E5` (Crème teintée légère) — différencie du fond crème    |
| Border                 | Aucun                                                              |
| Border-radius          | 0                                                                  |
| Sticky                 | `position: sticky; top: 96px` (desktop uniquement)                |

> **Pourquoi sticky desktop ?** Pour que le **CTA « Commander »** soit **toujours accessible** sans scroll, peu importe où la cliente est dans la page. C'est le bouton le plus important de la page — il ne doit jamais être hors de portée.

### 7.3 — Titre

```
Récapitulatif
```

| Propriété      | Valeur                                              |
| :------------- | :-------------------------------------------------- |
| Police         | Cormorant Garamond Light                            |
| Taille         | 22pt                                                |
| Couleur        | `#2C2A28` (Encre)                                   |
| Espacement bas | 24px                                                |

> **Différence avec `/commander`** : sur le checkout, le titre du récap est « Votre commande ». Sur `/panier`, c'est « Récapitulatif ». Pourquoi ?
> - « Votre commande » suppose que la commande est en cours de **création** (étape de checkout)
> - « Récapitulatif » est neutre — c'est une **synthèse** du panier, pas encore une commande

### 7.4 — Bloc montants

#### Layout

```
Sous-total                  500 MAD
Livraison                   Estimée

─────

Total                       500 MAD
```

| Élément              | Spécifications                                                |
| :------------------- | :------------------------------------------------------------ |
| Layout chaque ligne  | Flex space-between (label gauche, montant droite)              |
| Espacement entre lignes | 12px                                                       |
| Font label           | Inter Regular 13pt, couleur Encre claire                       |
| Font montant         | Inter Medium 13pt, couleur Encre                               |
| Filet avant Total    | Largeur 100% (du container interne), 1px sauge dark, espacement 16px haut + 16px bas |
| Font Total label     | Inter Medium 14pt, couleur Encre                               |
| Font Total montant   | Inter SemiBold 16pt, couleur Encre                            |

#### Affichage de la livraison

| Cas                              | Affichage                                          |
| :------------------------------- | :------------------------------------------------- |
| Pas d'adresse renseignée (V1)    | « Estimée » (italic Brume)                          |
| Adresse renseignée (compte ou recovery) | « Gratuit » (sauge dark) ou « 30 MAD » selon ville |
| Pas de calcul possible           | « Estimée à l'étape suivante »                      |

> **Pourquoi « Estimée » et non « Calculée à l'étape suivante » ?** Parce que :
> - « Estimée » est plus court (moins de bruit)
> - Le mot évoque une **valeur incertaine** (la cliente comprend qu'il faudra finaliser)
> - Pas de friction à la lecture

#### Le total ne ment pas

> **Principe** : le **Total** affiché est **honnête**. Si la livraison sera 30 MAD, le total reflète cette estimation (520 MAD au lieu de 500). En V1 sans adresse renseignée, le total affiche le **sous-total** seul, et la livraison apparaît comme « Estimée ».

#### Pseudo-code de calcul

```javascript
function calculatePanierTotal(cart, knownShippingCity = null) {
  const subtotal = cart.items.reduce((sum, item) =>
    sum + item.price * item.quantity, 0
  );

  // Si on connaît la ville (compte connecté ou recovery),
  // on peut estimer la livraison
  const shipping = knownShippingCity
    ? getShippingCost(knownShippingCity, 'standard')
    : null;

  const total = subtotal + (shipping || 0);

  return {
    subtotal,
    shipping, // null si non calculable
    total,
    shippingDisplay: shipping !== null
      ? formatCurrency(shipping)
      : 'Estimée',
  };
}
```

### 7.5 — CTA principal « Commander »

```
┌──────────────────────────────────────┐
│  Commander →                          │
└──────────────────────────────────────┘
```

| Propriété          | Valeur                                                                |
| :----------------- | :-------------------------------------------------------------------- |
| Police             | Inter Medium                                                          |
| Taille             | 16pt                                                                  |
| Letter-spacing     | 0.5px                                                                 |
| Texte              | `#FBF8F1` (Crème pure)                                                |
| Fond               | `#2C2A28` (Encre)                                                     |
| Padding            | 18px 32px                                                             |
| Border-radius      | 0                                                                      |
| Hauteur            | 60px                                                                  |
| Largeur            | 100% du container récap                                                |
| Hover              | Fond `#4A4844`, flèche se déplace de 6px à droite (300ms)             |
| Active             | Scale 0.98                                                             |
| Focus              | Ring 2px sauge dark, offset 4px                                        |
| Action             | Navigation vers `/commander?step=1`                                    |
| Espacement haut    | 24px sous le bloc Total                                                |

> **Pourquoi un CTA de 60px (vs 56px sur les boutons d'étape checkout) ?** Parce que c'est le **bouton-pivot** de toute la page. Sa taille communique son **importance**. Cohérent avec le bouton « Confirmer la commande » (60px aussi) — les deux moments les plus engageants du tunnel ont les boutons les plus présents.

### 7.6 — Trust signals brefs (sous le CTA)

```
🔒 Paiement sécurisé
Livraison sous 3-5 jours
```

| Propriété          | Valeur                                                          |
| :----------------- | :-------------------------------------------------------------- |
| Police             | Inter Regular 11pt + Cormorant Italic 12pt                       |
| Couleur            | `#6B6863` (Brume)                                                |
| Layout             | Empilés (1 par ligne)                                              |
| Icône cadenas      | SVG inline 12×12px, couleur Brume                                  |
| Espacement haut    | 16px sous le CTA                                                   |
| Espacement entre lignes | 6px                                                            |

> **Pourquoi 2 trust signals seulement ?** Parce que la section 04 (juste en dessous) **développe** les trust signals (Livraison, Retour, Paiement). Ici, c'est juste un **rappel discret** pour rassurer au moment du clic CTA.

### 7.7 — Mention code promo

```
─

Avez-vous un code promo ? À appliquer à l'étape suivante.
```

| Propriété          | Valeur                                                          |
| :----------------- | :-------------------------------------------------------------- |
| Filet              | 32px de large, 1px ligne, espacement 24px haut + 16px bas         |
| Police             | Cormorant Garamond Regular Italic                                |
| Taille             | 13pt                                                              |
| Couleur            | `#6B6863` (Brume)                                                 |
| Lien               | « à l'étape suivante » underline subtle                            |
| Action lien        | (Pas de lien — pure information textuelle)                          |

> **Pourquoi pas de champ code promo sur le panier ?** Parce que :
> 1. Le champ code promo sur `/panier` **invite à chercher des codes** (la cliente quitte la page pour Google « FemiGlow code promo »)
> 2. Le déplacement vers `/commander` simplifie l'UX du panier
> 3. La concentration sur le panier reste sur la **vérification**, pas sur la **chasse aux promos**

### 7.8 — Tokens design

```css
/* ─── Récapitulatif & CTA — tokens ─── */
--recap-bg: #F5F0E5;
--recap-padding-desktop: 32px;
--recap-padding-mobile: 24px;
--recap-width-desktop: 360px;
--recap-sticky-top: 96px;

--recap-title-font: 'Cormorant Garamond', serif;
--recap-title-weight: 300;
--recap-title-size: 22pt;
--recap-title-color: #2C2A28;
--recap-title-margin-bottom: 24px;

--recap-subtotal-line-gap: 12px;
--recap-subtotal-label-font: 'Inter', sans-serif;
--recap-subtotal-label-size: 13pt;
--recap-subtotal-label-color: #4A4844;
--recap-subtotal-value-font: 'Inter', sans-serif;
--recap-subtotal-value-weight: 500;
--recap-subtotal-value-size: 13pt;
--recap-subtotal-value-color: #2C2A28;

--recap-shipping-estimated-style: italic;
--recap-shipping-estimated-color: #6B6863;
--recap-shipping-free-color: #A8C4A6;

--recap-divider-color: #A8C4A6;
--recap-divider-margin: 16px 0;

--recap-total-label-weight: 500;
--recap-total-label-size: 14pt;
--recap-total-value-weight: 600;
--recap-total-value-size: 16pt;

/* CTA Commander */
--cta-commander-bg: #2C2A28;
--cta-commander-text: #FBF8F1;
--cta-commander-hover-bg: #4A4844;
--cta-commander-padding: 18px 32px;
--cta-commander-height: 60px;
--cta-commander-font-size: 16pt;
--cta-commander-margin-top: 24px;

/* Trust signals brefs */
--trust-mini-color: #6B6863;
--trust-mini-size: 11pt;
--trust-mini-margin-top: 16px;
--trust-mini-line-gap: 6px;

/* Mention code promo */
--promo-mention-divider-margin: 24px 0 16px;
--promo-mention-font: 'Cormorant Garamond', serif;
--promo-mention-style: italic;
--promo-mention-size: 13pt;
--promo-mention-color: #6B6863;
```

### 7.9 — Comportements UX

#### Animation au chargement de la page

```
[t=0ms]      → HTML loaded
[t=400ms]    → Récap fade-in (500ms) — apparaît après la card article
[t=900ms]    → Animation terminée
```

#### Mise à jour automatique des montants

À chaque modification du panier (quantité, suppression) :
- Sous-total recalculé instantanément (animation fade-out 200ms / fade-in 300ms)
- Total recalculé idem
- Pas d'API call (calcul côté client à partir de l'état du panier)

#### Hover et focus sur le CTA

| État               | Comportement                                                  |
| :----------------- | :------------------------------------------------------------ |
| Repos              | Fond Encre, flèche immobile                                    |
| Hover              | Fond Encre claire, flèche translate-x 6px (300ms)              |
| Active (clic)      | Scale 0.98 (feedback tactile)                                   |
| Focus clavier      | Ring sauge dark 2px, offset 4px                                 |
| Disabled           | (jamais désactivé sur cette page — sauf panier vide → état dédié) |

#### Sticky behavior desktop

Au scroll dans la page :
- Récap reste collé à `top: 96px`
- Si la fin du body articles est atteinte avant la fin du récap → le récap **se relâche** (pour ne pas dépasser dans le footer)

```css
.recap {
  position: sticky;
  top: 96px;
  align-self: start;
}
```

> **Bonus mobile** : sur mobile, le récap est **statique** (pas sticky). Il apparaît après la liste des articles. Pas de bouton flottant (qui distrairait dans la page panier — différent de `/kit` BOFU où le sticky CTA est justifié).

### 7.10 — Psychologie

#### 1. Récap = preuve transactionnelle (Cialdini 1984)

> *« Visible commitment increases follow-through. »*

Voir le **total** affiché clairement crée un **engagement cognitif**. La cliente intériorise : « Je vais payer 500 MAD ». Cet engagement réduit l'abandon ultérieur.

#### 2. Sticky CTA = accessibilité de l'action

> Sur desktop, le sticky récap garantit que le CTA « Commander » est **toujours à 1 clic**. Même si la cliente scrolle jusqu'aux trust signals ou au cross-link, le bouton reste visible.

#### 3. « Estimée » plutôt que « Calculée à l'étape suivante »

> La concision **réduit la charge cognitive**. Un mot suffit à signaler l'information.

#### 4. Trust signals discrets sous le CTA

> Le « 🔒 Paiement sécurisé » est juste sous le bouton — au moment où la cliente s'apprête à cliquer, elle voit le **rappel de sécurité**. C'est un **trust signal contextuel**.

#### 5. Mention code promo non-intrusive

> Pas de champ code promo qui invite à **chercher** un code. Une mention textuelle sobre qui dit : « Si vous en avez un, vous pourrez l'appliquer plus tard. » Aucune incitation à la chasse aux promos.

### 7.11 — Émotion à provoquer

| Étape       | Émotion                                                          |
| :---------- | :--------------------------------------------------------------- |
| Vue du récap | Synthèse claire (« Je sais ce que je paie »)                      |
| Vue du Total | Acceptation finale du montant                                    |
| Vue du CTA  | Engagement → clic → checkout                                     |

### 7.12 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| Récap qui n'est pas sticky desktop                   | CTA hors de portée si scroll long                                    |
| CTA caché par le sticky header (mauvais top offset)  | Inaccessible sans scroll                                              |
| Total sans filet de séparation                       | Hiérarchie visuelle confuse                                          |
| Affichage du prix barré (« 600 MAD ~~500 MAD~~ »)    | Si pas de promo réelle, manipulation                                  |
| Bandeau « Économisez 50 MAD » sans code appliqué    | Mensonge UX                                                            |
| Mention code promo en gros, en couleur               | Détourne le focus du CTA                                              |
| Trust signals avec logos (Visa, Mastercard, Norton)   | Casse la palette signature (les logos colorés détonnent)              |
| Bouton « Vider le panier »                            | Suggère que la maison veut décourager                                  |
| Champ code promo ouvert et visible                   | Invite à chercher un code → quitte la page                            |
| CTA outline (pas plein)                               | Manque d'autorité visuelle                                             |
| Texte CTA « Procéder au paiement »                    | Trop fonctionnel — préférer « Commander »                             |
| CTA sans flèche                                       | Casse la signature de navigation                                       |
| CTA avec total inclus (« Commander · 500 MAD »)      | Réservé à `/commander` (bouton final) — ici, redondant avec le récap   |

---

## 8 — Section 04 — Trust signals & FAQ courte

### 8.1 — Wireframe complet

```
┌════════════════════════════════════════════════════════════════════════════┐
║                                                                            ║
║  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐║
║  │                     │  │                     │  │                     │║
║  │  Livraison          │  │  Paiement           │  │  Support             │║
║  │  ─                  │  │  sécurisé           │  │                     │║
║  │                     │  │  ─                  │  │  ─                  │║
║  │  Standard gratuite  │  │                     │  │                     │║
║  │  pour Casablanca,   │  │  Carte bancaire     │  │  Une question ?      │║
║  │  Rabat, Salé,       │  │  via CMI ou         │  │  Écrivez-nous à     │║
║  │  Mohammedia.         │  │  paiement à la       │  │  contact@femiglow.ma │║
║  │                     │  │  livraison.          │  │                     │║
║  │  Express disponible │  │                     │  │  Réponse sous 24h.   │║
║  │  selon ville.        │  │  Données chiffrées,  │  │                     │║
║  │                     │  │  jamais stockées.    │  │                     │║
║  │                     │  │                     │  │                     │║
║  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘║
║                                                                            ║
└════════════════════════════════════════════════════════════════════════════┘
                            (fond sauge pâle, pleine largeur)
```

### 8.2 — Pourquoi un fond sauge pâle ?

Cohérent avec **toutes les sections d'engagement** du site :
- `/rituel` pivot vers `/kit` → fond sauge pâle
- `/kit` bandeau CTA final → fond sauge pâle
- `/journal` newsletter → fond sauge pâle
- `/maison` engagements → fond sauge pâle
- **`/panier` trust signals → fond sauge pâle**

> **La règle confirmée** : tout **moment d'engagement** ou de **promesse formelle** apparaît sur fond sauge pâle. La cohérence absolue à travers le site.

### 8.3 — Composition générale

| Propriété              | Valeur                                                          |
| :--------------------- | :-------------------------------------------------------------- |
| Fond                   | `#E8EFE7` (Sauge pâle) — pleine largeur                          |
| Hauteur                | 240px (desktop) · auto (mobile)                                  |
| Padding vertical       | 64px                                                              |
| Padding latéral        | 96px (desktop) · 24px (mobile)                                  |
| Largeur max contenu    | 1200px                                                            |

### 8.4 — Disposition de la grille

| Breakpoint | Layout                                    |
| :--------- | :---------------------------------------- |
| Desktop    | 3 colonnes égales, gap 32px                |
| Tablet     | 3 colonnes égales, gap 24px                |
| Mobile     | 1 colonne (empilés), gap 32px              |

### 8.5 — Spécifications de chaque carte trust

#### Container

| Propriété         | Valeur                                                          |
| :---------------- | :-------------------------------------------------------------- |
| Fond              | Transparent (le sauge pâle de la section transparait)             |
| Border            | Aucun                                                              |
| Padding           | 16px                                                                |
| Hauteur           | Auto                                                              |

> **Pas de fond blanc sur les cartes** : cohérent avec les engagements de `/maison`. Les cartes sont **dans** la section, pas posées dessus. Sobriété maximale.

#### Header — titre

```
Livraison
─
```

| Élément              | Spécifications                                                   |
| :------------------- | :--------------------------------------------------------------- |
| Titre                | Cormorant Garamond Light 18pt, couleur Encre                      |
| Filet sous header    | Largeur 32px, hauteur 1.5px, couleur sauge dark, espacement 12px |

#### Body — texte

| Propriété      | Valeur                                                  |
| :------------- | :------------------------------------------------------ |
| Police         | Cormorant Garamond Regular                              |
| Taille         | 14pt (desktop) · 13pt (mobile)                          |
| Couleur        | `#2C2A28` (Encre)                                       |
| Line-height    | 1.6                                                     |
| Espacement haut| 12px (sous le filet)                                    |

### 8.6 — Les trois trust signals — copy intégral

#### Carte 1 — Livraison

```
Livraison
─
Standard gratuite pour Casablanca, Rabat, Salé, Mohammedia.

Express disponible selon ville.
```

#### Carte 2 — Paiement sécurisé

```
Paiement sécurisé
─
Carte bancaire via CMI ou paiement à la livraison.

Données chiffrées, jamais stockées.
```

#### Carte 3 — Support

```
Support
─
Une question ? Écrivez-nous à contact@femiglow.ma

Réponse sous 24h.
```

### 8.7 — Décomposition stratégique

| Carte             | Fonction stratégique                                       |
| :---------------- | :--------------------------------------------------------- |
| Livraison         | **Réassure** sur les frais (gratuité possible) et la disponibilité |
| Paiement sécurisé | **Réassure** sur la sécurité (CMI + chiffrement) et la flexibilité (COD aussi) |
| Support           | **Humanise** la marque — un contact direct, pas une FAQ algorithmique |

> **Pourquoi ces 3 trust signals précisément ?** Parce qu'ils répondent aux **3 inquiétudes principales** de la cliente avant de cliquer Commander :
> 1. Combien me coûtera la livraison ?
> 2. Mon paiement sera-t-il en sécurité ?
> 3. Si quelque chose ne va pas, qui contacter ?

### 8.8 — Pas de logos

Pas de logos Visa, Mastercard, CMI, ou autre. Pourquoi ?
- La palette signature serait cassée
- Les logos colorés sont déjà sur `/commander` étape 3 (logos monochromes)
- La carte « Paiement sécurisé » suffit à transmettre la confiance

### 8.9 — Tokens design

```css
/* ─── Trust signals — tokens ─── */
--trust-signals-bg: #E8EFE7;
--trust-signals-padding-vertical: 64px;
--trust-signals-padding-x-desktop: 96px;
--trust-signals-padding-x-mobile: 24px;
--trust-signals-content-max-width: 1200px;

--trust-grid-gap-desktop: 32px;
--trust-grid-gap-mobile: 32px;

--trust-card-padding: 16px;

--trust-title-font: 'Cormorant Garamond', serif;
--trust-title-weight: 300;
--trust-title-size: 18pt;
--trust-title-color: #2C2A28;

--trust-divider-width: 32px;
--trust-divider-height: 1.5px;
--trust-divider-color: #A8C4A6;
--trust-divider-margin: 12px 0;

--trust-text-font: 'Cormorant Garamond', serif;
--trust-text-weight: 400;
--trust-text-size-desktop: 14pt;
--trust-text-line-height: 1.6;
--trust-text-color: #2C2A28;
```

### 8.10 — Comportements UX

#### Animation au scroll

```
[atteint 80% viewport]   → fond sauge pâle fade-in (subtil — opacité 0.5 → 1.0, 600ms)
[atteint 70%]             → 3 cartes fade-in en cascade (200ms entre chaque, 500ms chacune)
                            ordre : 1 → 2 → 3 (lecture occidentale)
```

#### Pas d'interaction

Les cartes sont **statiques**. Aucun hover, aucun click. Ce sont des **affirmations** — pas des CTAs.

> **Sauf** : le mail `contact@femiglow.ma` est un lien `mailto:` — un clic ouvre le client de mail de la cliente.

#### Hover sur le mail

| État               | Comportement                                                  |
| :----------------- | :------------------------------------------------------------ |
| Repos              | Texte couleur Encre, pas de soulignement                       |
| Hover              | Underline 1px sauge dark, offset 4px                            |
| Click              | Ouverture client mail avec destinataire pré-rempli              |

### 8.11 — Psychologie

#### 1. Trust signal au moment opportun

> **Cialdini (1984)** : *« Trust signals work best when placed at decision moments. »*

La cliente vient de **scroller au-delà** du CTA principal. Si elle est arrivée jusqu'ici, c'est qu'elle **hésite** ou **vérifie**. Les trust signals à ce moment précis la **rassurent**.

#### 2. Le « tiers humain » (Support)

> Mentionner « Réponse sous 24h » et un email **humain** (`contact@femiglow.ma`, pas `support@`, pas `noreply@`) crée la sensation d'un **contact réel possible**. C'est l'inverse des FAQ algorithmiques qui frustrent.

#### 3. Symétrie des 3 cartes

> Trois cartes de même format = **équilibre visuel**. La cliente perçoit que les 3 sujets ont la **même importance** : livraison, paiement, support. C'est le **triangle de confiance** classique en e-commerce.

#### 4. Pas de bandeaux marketing

> Pas de « Plus de 1000 clientes satisfaites », pas de « Note moyenne 4.9/5 », pas de témoignages. Pourquoi ?
> - Les social proofs sont déjà sur `/kit` (BOFU avec témoignages)
> - Les ajouter ici **distrairait** du focus
> - Le ton sobre **est** le trust signal

### 8.12 — Émotion à provoquer

| Étape       | Émotion                                                          |
| :---------- | :--------------------------------------------------------------- |
| Lecture rapide des 3 cartes | Synthèse rationnelle (« Tout est en ordre »)         |
| Vue du mail support | Humanisation (« Quelqu'un peut m'aider »)                  |
| Retour vers le CTA principal | Confiance renforcée → clic Commander               |

### 8.13 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| Plus de 3 cartes                                     | Surcharge — 3 est le nombre cognitif optimal                          |
| Cartes avec icônes / illustrations                    | Banalise — préférer typographie pure                                  |
| Texte > 30 mots par carte                            | Trop bavard, casse la sobriété                                        |
| Logos cartes bancaires                               | Casse la palette                                                       |
| Note moyenne / nombre de clientes                    | Cassure de la voix éditoriale                                          |
| « Garantie satisfait ou remboursé 100% »             | Promesse exagérée si non documentée                                    |
| Téléphone du support visible                          | Dépend de la disponibilité d'une équipe — V1 = email seulement         |
| FAQ étendue ici                                       | Réservée à une page FAQ dédiée (V2)                                    |
| Cartes avec bouton « En savoir plus »                 | Suggère que l'info est incomplète                                       |
| Email support en bouton plein                         | Trop CTA — la maison ne **veut** pas que la cliente écrive avant commander |

---

## 9 — Section 05 — Cross-link contextuel

### 9.1 — Wireframe

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│  ┌────────────────────────────────┐    ┌──────────────────────────────┐  │
│  │                                │    │                              │   │
│  │                                │    │  AVANT DE COMMANDER          │   │
│  │                                │    │                              │   │
│  │   [PHOTO LIFESTYLE             │    │  Quelques minutes pour       │   │
│  │   "PAUSE ÉDITORIALE"]          │    │  ralentir.                    │   │
│  │                                │    │                              │   │
│  │   [Tasse de thé, livre,        │    │  Le journal de la maison —    │   │
│  │   carnet, lumière douce]       │    │  des fragments écrits depuis │   │
│  │                                │    │  l'atelier.                   │   │
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

### 9.2 — Pourquoi un cross-link sur la page panier ?

> Étrange paradoxe : la cliente est sur la page panier — son objectif est de **commander**. Pourquoi lui proposer un cross-link vers `/journal` qui pourrait la **distraire** ?

Justification :
1. **La cliente qui hésite**. Si elle scrolle au-delà du CTA principal, elle **prend du temps**. C'est un signal d'hésitation. Plutôt que la **forcer** à décider, lui offrir une **respiration éditoriale** peut paradoxalement augmenter la conversion (différée).
2. **La cliente qui veut prendre du recul**. Plutôt qu'elle quitte le site **vers l'extérieur** (Google, Instagram), lui proposer une lecture **interne** la garde dans l'écosystème.
3. **Cohérence avec la voix éditoriale**. La maison ne **piège** jamais. Même sur le panier, la cliente reste libre de ralentir.
4. **Recovery email à 24h**. Si la cliente quitte sans commander, l'email recovery sera plus efficace si elle a **lu** quelque chose du Journal entre-temps (engagement intermédiaire).

### 9.3 — Position et composition

| Propriété              | Valeur                                                          |
| :--------------------- | :-------------------------------------------------------------- |
| Fond                   | `#FBF8F1` (Crème) — uni                                          |
| Hauteur                | 280px (desktop) · auto (mobile)                                  |
| Padding vertical       | 64px                                                              |
| Padding latéral        | 96px (desktop) · 24px (mobile)                                  |
| Layout desktop         | Photo 50% gauche / Bloc info 50% droite — gap 64px                 |
| Layout mobile          | Empilés (photo dessus, info dessous) — gap 24px                   |

### 9.4 — Photo

| Propriété         | Valeur                                                                |
| :---------------- | :-------------------------------------------------------------------- |
| Sujet             | Tasse de thé, livre ouvert, carnet — ambiance « pause »                |
| Composition       | Lifestyle macro, lumière naturelle de fin d'après-midi                |
| Format            | 4:3 (paysage) sur desktop · 4:3 sur tablet · 3:2 sur mobile           |
| Hauteur affichage | 240px (desktop) · auto (mobile)                                        |

> **Différence avec la photo cross-link `/maison`** : ici, l'ambiance est **plus contemplative** (la cliente prend le temps de respirer). Sur `/maison`, la photo était plus **studieuse** (carnet + plume + atelier). Petite distinction qui ancre le message.

### 9.5 — Bloc info — copy intégral

#### Surtitre

```
AVANT DE COMMANDER
```

| Propriété      | Valeur                                              |
| :------------- | :-------------------------------------------------- |
| Police         | Inter SemiBold 7.5pt                                |
| Letter-spacing | 2.5px                                               |
| Couleur        | `#6B6863` (Brume)                                   |
| Position       | Aligné à gauche                                     |

> **« AVANT DE COMMANDER »** : ce surtitre **reconnaît le contexte** (la cliente est sur le panier) tout en proposant une respiration. Il ne dit pas « Vous pourriez aussi aimer » (suggestion forcée) — il dit « Avant ce moment d'engagement, prenez peut-être un moment ».

#### Titre

```
Quelques minutes pour ralentir.
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Light Italic                              |
| Taille          | 28pt (desktop) · 22pt (mobile)                                |
| Couleur         | `#2C2A28` (Encre)                                            |
| Espacement haut | 12px sous le surtitre                                         |

> **« Ralentir »** est le mot pivot. La maison **invite** à ralentir, pas à se précipiter — ce qui est l'inverse de la pression e-commerce standard.

#### Description

```
Le journal de la maison — des fragments écrits depuis l'atelier.
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Regular                                   |
| Taille          | 15pt (desktop) · 14pt (mobile)                                |
| Couleur         | `#4A4844` (Encre claire)                                     |
| Line-height     | 1.6                                                          |
| Espacement haut | 16px                                                          |

> Phrase identique à celle du cross-link de `/maison` — **cohérence narrative** absolue. Le Journal est défini par cette même phrase à chaque mention.

#### Filet séparateur

| Propriété      | Valeur                                |
| :------------- | :------------------------------------ |
| Largeur        | 32px                                  |
| Hauteur        | 1.5px                                 |
| Couleur        | `#A8C4A6` (Sauge dark)                |
| Espacement     | 24px haut, 24px bas                   |

#### CTA

```
Visiter le journal →
```

| Propriété          | Valeur                                                                |
| :----------------- | :-------------------------------------------------------------------- |
| Police             | Inter Medium 14pt                                                     |
| Texte              | `#2C2A28` (Encre)                                                     |
| Fond               | Transparent                                                              |
| Border             | 1.5px solid `#2C2A28` (Encre)                                          |
| Padding            | 12px 24px                                                               |
| Hover              | Fond Encre, texte Crème pure, flèche translate 4px                     |
| Action             | Navigation vers `/journal` (ouvre dans le **même onglet**)              |

> **Pourquoi le même onglet (vs nouvel onglet) ?** Parce que le panier est **persistant** (localStorage + session). La cliente peut revenir sur `/panier` à tout moment depuis le header. Pas besoin de fragmenter l'expérience.

> **Pourquoi un CTA outline (vs plein) ?** Parce que le CTA principal de la page (« Commander ») est **plein**. Ce CTA secondaire est **outline** pour respecter la hiérarchie visuelle. Iyengar 2000 — le choix principal doit dominer visuellement.

### 9.6 — Tokens design

```css
/* ─── Cross-link Journal — tokens ─── */
--crosslink-bg: #FBF8F1;
--crosslink-padding-vertical: 64px;
--crosslink-grid-gap-desktop: 64px;
--crosslink-photo-aspect: 4/3;
--crosslink-photo-height-desktop: 240px;

--crosslink-kicker-font: 'Inter', sans-serif;
--crosslink-kicker-weight: 600;
--crosslink-kicker-size: 7.5pt;
--crosslink-kicker-tracking: 2.5px;
--crosslink-kicker-color: #6B6863;

--crosslink-title-font: 'Cormorant Garamond', serif;
--crosslink-title-style: italic;
--crosslink-title-weight: 300;
--crosslink-title-size-desktop: 28pt;
--crosslink-title-color: #2C2A28;

--crosslink-description-size: 15pt;
--crosslink-description-color: #4A4844;
--crosslink-description-line-height: 1.6;

--crosslink-divider-width: 32px;
--crosslink-divider-color: #A8C4A6;
--crosslink-divider-margin: 24px 0;

--crosslink-cta-bg: transparent;
--crosslink-cta-text: #2C2A28;
--crosslink-cta-border: 1.5px solid #2C2A28;
--crosslink-cta-padding: 12px 24px;
--crosslink-cta-hover-bg: #2C2A28;
--crosslink-cta-hover-text: #FBF8F1;
```

### 9.7 — Comportements UX

#### Animation au scroll

```
[atteint 80% viewport]   → photo fade-in 700ms
[atteint 70%]             → bloc info fade-in séquentiel (200ms entre éléments)
```

#### Click sur la photo OU la card complète

Toute la zone gauche (photo) **et** la zone droite (info) sont cliquables et mènent à `/journal`. Maximise l'affordance.

### 9.8 — Pas de second cross-link

> Volontairement, **un seul cross-link** sur la page panier. Pas de « Découvrir notre histoire → /maison ». Pourquoi ?
> - Multiplier les cross-links = multiplier les portes de sortie
> - Un seul lien clair = invitation forte (Iyengar 2000 — choix limité augmente l'engagement)
> - `/journal` est plus complémentaire que `/maison` à ce stade (lecture rapide vs lecture longue institutionnelle)

### 9.9 — Émotion à provoquer

| Étape       | Émotion                                                          |
| :---------- | :--------------------------------------------------------------- |
| Vue du surtitre | « La maison reconnaît mon hésitation »                          |
| Vue du titre | Détente — autorisation à ralentir                                |
| Vue du CTA   | Curiosité éditoriale → soit clic vers `/journal`, soit retour vers le récap pour Commander |

### 9.10 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| Multiple cross-links                                 | Multiplie les portes de sortie                                       |
| Lien vers `/kit` ici                                 | Redondant avec « Continuer mes achats » + détruit le focus           |
| Lien vers `/maison`                                  | Trop institutionnel — `/journal` est plus complémentaire              |
| Cross-link en pop-up modal                            | Manipulation, casse la fluidité                                       |
| Cross-link sticky sur la page                         | Distrait constamment du CTA principal                                  |
| Surtitre « VOUS POURRIEZ AUSSI AIMER »                | Vocabulaire e-commerce générique                                       |
| Texte « Profitez de quelques minutes pour explorer ! »| Tonalité trop directive                                                |
| CTA plein (au lieu d'outline)                         | Détruit la hiérarchie visuelle vs CTA principal Commander              |
| Plusieurs photos dans le cross-link                    | Surcharge                                                              |
| Animation excessive (parallaxe, etc.)                  | Casse la sobriété                                                       |

---

## 10 — Section 06 — État panier vide

### 10.1 — Pourquoi une section dédiée pour le panier vide ?

> Le panier vide est l'**état d'arrivée par défaut** pour une cliente qui :
> 1. N'a jamais ajouté d'article (clic sur l'icône panier en navigation)
> 2. Vient de supprimer son seul article (panier vidé sur cette page)
> 3. Revient longtemps après (panier expiré, articles retirés)

**Cet état est crucial** : c'est la dernière chance de **récupérer** la cliente avant qu'elle ne quitte le site.

### 10.2 — Wireframe

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│                                                                            │
│                                                                            │
│                                ╱──╲                                        │
│                               ╱ ◆ ╲     ← fleuron champagne                │
│                                ╲╱                                          │
│                                                                            │
│                          Votre panier est vide.                            │
│                                                                            │
│                                                                            │
│                  Pas de précipitation. Le rituel est                       │
│                  toujours là, prêt à être découvert.                       │
│                                                                            │
│                                                                            │
│                                                                            │
│                  ┌──────────────────────────────┐                          │
│                  │  Découvrir le rituel →        │                          │
│                  └──────────────────────────────┘                          │
│                                                                            │
│                                                                            │
│                                                                            │
│                          Lire le journal · Visiter la maison              │
│                                                                            │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 10.3 — Composition

| Propriété              | Valeur                                                          |
| :--------------------- | :-------------------------------------------------------------- |
| Fond                   | `#FBF8F1` (Crème) — uni                                          |
| Hauteur                | 100% de l'espace disponible (entre header et footer) · min 600px |
| Padding vertical       | 96px                                                              |
| Padding latéral        | 96px (desktop) · 24px (mobile)                                  |
| Alignement contenu     | Centré horizontalement et verticalement                            |
| Largeur max contenu    | 720px                                                             |

### 10.4 — Pourquoi un fleuron champagne ?

> **Exception éditoriale** : sur les pages fonctionnelles, le fleuron champagne est absent. Mais sur l'état **panier vide**, il **réapparaît**. Pourquoi ?

- L'état panier vide est un **moment éditorial** (pas fonctionnel — la cliente ne fait rien)
- Le fleuron donne une **noblesse contemplative** à un moment qui pourrait être frustrant
- Cohérence avec les heros éditoriaux (`/journal`, `/maison`)
- Le moment du « rien » devient une **invitation** plutôt qu'une **erreur**

#### Spécifications

| Propriété         | Valeur                                                          |
| :---------------- | :-------------------------------------------------------------- |
| Type              | Losange champagne entre filets fins                              |
| Couleur           | `#C8A876` (Champagne)                                            |
| Largeur           | 80px                                                             |
| Hauteur           | 12px                                                             |
| Position          | Centré, 32px au-dessus du titre                                   |

### 10.5 — Titre

```
Votre panier est vide.
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Light                                     |
| Taille          | 32pt (desktop) · 26pt (mobile)                                |
| Couleur         | `#2C2A28` (Encre)                                            |
| Alignement      | Centré                                                        |
| Espacement haut | 32px sous le fleuron                                           |

> **« Votre panier est vide. »** — affirmation simple, point final. Pas « Oups, votre panier est vide ! » (over-friendly), pas « Aucun article dans votre panier » (techno-administratif), pas « Cart is empty ». Juste l'état, sobrement énoncé.

### 10.6 — Phrase d'accompagnement

```
Pas de précipitation. Le rituel est toujours là,
prêt à être découvert.
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Regular Italic                            |
| Taille          | 18pt (desktop) · 16pt (mobile)                                |
| Couleur         | `#4A4844` (Encre claire)                                     |
| Line-height     | 1.5                                                          |
| Alignement      | Centré                                                        |
| Espacement haut | 24px sous le titre                                            |
| Largeur max     | 540px                                                         |

> **« Pas de précipitation. »** — c'est la signature de la maison. Reformuler la maison du **prendre son temps** même au moment de l'absence d'achat. Cette phrase **désamorce la culpabilité** et **prolonge la confiance**.

### 10.7 — CTA principal

```
┌──────────────────────────────────┐
│  Découvrir le rituel →            │
└──────────────────────────────────┘
```

| Propriété          | Valeur                                                                |
| :----------------- | :-------------------------------------------------------------------- |
| Police             | Inter Medium 14pt                                                     |
| Texte              | `#FBF8F1` (Crème pure)                                                |
| Fond               | `#2C2A28` (Encre)                                                     |
| Padding            | 14px 28px                                                             |
| Hauteur            | 48px                                                                  |
| Hover              | Fond `#4A4844`, flèche se déplace de 4px à droite                     |
| Action             | Navigation vers `/kit`                                                  |
| Espacement haut    | 48px sous la phrase d'accompagnement                                    |

> **« Découvrir le rituel »** — verbe « découvrir » plutôt que « voir » ou « acheter ». Cohérent avec la voix éditoriale. La cliente est invitée à **redécouvrir**, pas à acheter.

### 10.8 — Liens secondaires

```
Lire le journal · Visiter la maison
```

| Propriété          | Valeur                                                          |
| :----------------- | :-------------------------------------------------------------- |
| Police             | Cormorant Garamond Regular Italic                                |
| Taille             | 14pt                                                              |
| Couleur            | `#6B6863` (Brume)                                                |
| Hover              | `#2C2A28` (Encre), underline 1px sauge dark, offset 4px          |
| Séparateur `·`     | Middle dot, espacement 12px                                       |
| Alignement         | Centré                                                            |
| Espacement haut    | 48px sous le CTA                                                   |
| Action             | Liens vers `/journal` et `/maison` respectivement                   |

> **Deux portes secondaires** : la cliente qui a vidé son panier mais n'est pas prête à racheter peut s'orienter vers les pages éditoriales. La maison **ne piège jamais**.

### 10.9 — Tokens design

```css
/* ─── État panier vide — tokens ─── */
--empty-bg: #FBF8F1;
--empty-min-height: 600px;
--empty-padding-vertical: 96px;
--empty-content-max-width: 720px;

--empty-fleuron-color: #C8A876;
--empty-fleuron-width: 80px;
--empty-fleuron-margin-bottom: 32px;

--empty-title-font: 'Cormorant Garamond', serif;
--empty-title-weight: 300;
--empty-title-size-desktop: 32pt;
--empty-title-color: #2C2A28;

--empty-text-font: 'Cormorant Garamond', serif;
--empty-text-style: italic;
--empty-text-size-desktop: 18pt;
--empty-text-color: #4A4844;
--empty-text-line-height: 1.5;
--empty-text-margin-top: 24px;
--empty-text-max-width: 540px;

--empty-cta-bg: #2C2A28;
--empty-cta-text: #FBF8F1;
--empty-cta-padding: 14px 28px;
--empty-cta-margin-top: 48px;

--empty-secondary-links-font: 'Cormorant Garamond', serif;
--empty-secondary-links-style: italic;
--empty-secondary-links-size: 14pt;
--empty-secondary-links-color: #6B6863;
--empty-secondary-links-margin-top: 48px;
```

### 10.10 — Comportements UX

#### Animation au chargement

```
[t=0ms]      → HTML loaded
[t=200ms]    → Fleuron fade-in + scale-up (0.85 → 1.0) en 600ms
[t=400ms]    → Titre fade-in (500ms)
[t=700ms]    → Phrase d'accompagnement fade-in + translate-up 8px (700ms)
[t=1100ms]   → CTA fade-in (500ms)
[t=1400ms]   → Liens secondaires fade-in (500ms)
[t=1900ms]   → Animations terminées
```

#### Transition depuis liste articles vers état vide

Si la cliente vide son panier (suppression du dernier article) :

```
[t=0ms]      → Confirmation suppression
[t=0-500ms]  → Card article slide-up + fade-out
[t=500-700ms]→ Hero du panier (titre + état) fade-out 200ms
[t=500-700ms]→ Récap fade-out 200ms
[t=500-700ms]→ Trust signals fade-out 200ms
[t=500-700ms]→ Cross-link fade-out 200ms
[t=700-1500ms]→ État panier vide fade-in (séquence ci-dessus)
[t=1500ms]   → URL update (pas de modification — toujours /panier)
```

> **L'animation est plus longue qu'une simple transition** car elle marque un **changement d'état** majeur de la page. La cliente perçoit que la page a basculé.

### 10.11 — Pas de message « bouton retour vers le panier précédent »

> Pas de « Annuler la suppression » avec timer (« Action annulable dans 5 secondes »). Pourquoi ?
> - Sur `/commander`, on documente bien les UX patterns de protection contre les actions accidentelles (modal de confirmation)
> - Mais sur `/panier`, après confirmation explicite (modal), la suppression est **assumée**
> - Un message d'undo en plus serait **trop protecteur** et insécuriserait la cliente sur ses propres décisions

### 10.12 — Psychologie

#### 1. Recovery éditorial (vs commercial)

> La plupart des paniers vides en e-commerce affichent : « Votre panier est vide. **Découvrez nos meilleures ventes !** » + grille produits.
>
> FemiGlow refuse cette logique. Le panier vide est une **respiration**, pas une opportunité de cross-sell forcé.

#### 2. Désamorcer la frustration

> *« Pas de précipitation. »* est une phrase **anti-stress**. Elle reconnaît que la cliente a peut-être supprimé volontairement, ou qu'elle vient juste découvrir le site. Aucun jugement.

#### 3. Le fleuron champagne = noblesse même dans l'absence

> Marquer le panier vide avec un **élément noble** (fleuron champagne, normalement réservé aux pages éditoriales) signale que la maison **respecte** ce moment. Ce n'est pas un échec — c'est une étape.

#### 4. Trois portes (pas une seule)

> CTA principal vers `/kit` + liens vers `/journal` et `/maison`. La cliente choisit son **rythme**.

### 10.13 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| « Votre panier est vide. Découvrez nos best-sellers ! » + grille produits | Cassure totale de la voix éditoriale          |
| Image illustrative (panier dessiné, point d'exclamation) | Banal — typographie pure suffit                                  |
| « Oups ! »                                           | Cassure du ton                                                       |
| Pop-up de retention (« Êtes-vous sûr de vouloir partir ? ») | Manipulation                                                |
| Code promo offert (« 10% de réduction si vous revenez ! ») | Manipulation, casse la confiance                            |
| Newsletter signup forcé                              | Hors registre du panier                                              |
| Compte à rebours « Votre panier expire dans... »      | Faux pour un système où le panier persiste                            |
| Une seule porte (CTA unique)                         | Limite la liberté de la cliente                                       |
| Phrase « Vous avez quitté sans terminer »             | Culpabilisant                                                          |
| Image grande (illustration, mascotte)                  | Cassure de la palette                                                  |

---

## 11 — Footer — élément persistant

### 11.1 — Structure héritée

Le footer de `/panier` est **identique** à celui des autres pages — élément global du site (vs `/commander` qui a un footer simplifié).

> **Pourquoi pas de footer simplifié ici ?** Parce que `/panier` n'est pas dans le tunnel transactionnel strict. La cliente peut légitimement vouloir explorer le site depuis le footer (lire un article, consulter les CGV, etc.). Le footer complet **respecte cette liberté**.

### 11.2 — Spécificités sur `/panier`

| Différence              | Spécification                                                       |
| :---------------------- | :------------------------------------------------------------------ |
| **Item « Panier »**      | Pas dans la navigation principale du footer — pas marqué actif      |
| **Pas de re-affichage newsletter** | La newsletter n'apparaît pas dans le footer (réservée à `/journal`) |
| **Espacement avec Cross-link** | 64px de padding vertical entre la fin de la section 05 et le début du footer |

### 11.3 — Comportement avec panier vide

Si la cliente est sur l'**état panier vide** (section 06), le footer reste **standard**. Pas de modification du footer.

> **Cohérence** : même en panier vide, la cliente accède aux mêmes ressources que partout ailleurs. Le footer est **invariable** quel que soit l'état.

---

## 12 — Comportements transverses

### 12.1 — Smooth scroll

`scroll-behavior: smooth` activé en CSS, désactivé si :
- L'utilisateur a `prefers-reduced-motion: reduce` activé
- Sur les ancres rapides (modification quantité → scroll vers récap) : scroll instantané sur Cmd/Ctrl+click

### 12.2 — Lazy loading des images

| Type d'image                         | Stratégie                                            |
| :----------------------------------- | :--------------------------------------------------- |
| Hero (pas d'image)                   | N/A — fond crème uni                                  |
| Photo article(s) liste              | `loading="eager"`, **preload critique pour LCP**     |
| Photo cross-link Journal            | `loading="lazy"`                                     |
| Footer                               | (aucune image)                                       |

#### Preload de la photo article (LCP element)

```html
<link rel="preload" as="image"
      href="/images/kit/kit-thumb-120.webp"
      media="(min-width: 1024px)"
      fetchpriority="high">
<link rel="preload" as="image"
      href="/images/kit/kit-thumb-80.webp"
      media="(max-width: 1023px)"
      fetchpriority="high">
```

> **LCP element** : la photo de l'article dans la liste est l'élément image visible le plus tôt. Elle est l'élément LCP.

### 12.3 — State management du panier

Le panier maintient un **état centralisé** synchronisé entre :
- L'UI visible (liste articles + récap)
- localStorage (persistance non connectée)
- Backend session (persistance connectée)
- Header (compteur d'articles)

#### Structure de l'état

```typescript
interface CartState {
  items: CartItem[];
  subtotal: number;
  shipping: number | null; // null si non calculable (pas d'adresse connue)
  total: number;
  lastUpdated: number; // timestamp
  ui: {
    isModifying: boolean; // true pendant un update API
    pendingItem: string | null; // ID de l'item en cours de modification
    error: string | null;
  };
}

interface CartItem {
  id: string; // SKU produit
  name: string;
  description: string;
  imageUrl: string;
  unitPrice: number;
  quantity: number;
  linkPdp: string; // URL produit (/kit en V1)
}
```

### 12.4 — Mise à jour optimiste UI

À chaque modification (quantité, suppression), l'UI se met à jour **immédiatement** sans attendre la réponse serveur.

```javascript
async function updateQuantity(itemId, newQuantity) {
  // 1. Sauvegarde de l'ancienne valeur (pour rollback)
  const previousQty = cart.items.find(i => i.id === itemId).quantity;

  // 2. Optimistic UI : update immédiat
  setCart(prev => ({
    ...prev,
    items: prev.items.map(i =>
      i.id === itemId ? { ...i, quantity: newQuantity } : i
    ),
    ui: { ...prev.ui, isModifying: true, pendingItem: itemId }
  }));

  // 3. API call
  try {
    await api.updateCartItem(itemId, newQuantity);
    setCart(prev => ({ ...prev, ui: { ...prev.ui, isModifying: false, pendingItem: null } }));
  } catch (error) {
    // 4. Rollback en cas d'erreur
    setCart(prev => ({
      ...prev,
      items: prev.items.map(i =>
        i.id === itemId ? { ...i, quantity: previousQty } : i
      ),
      ui: { ...prev.ui, isModifying: false, pendingItem: null, error: 'La modification n\'a pas pu être sauvegardée.' }
    }));
  }
}
```

### 12.5 — Synchronisation localStorage ↔ backend

#### Cliente non connectée

- Toute modification → sauvegarde dans `localStorage` (clé `femiglow_cart`)
- TTL : 30 jours

#### Cliente connectée

- Toute modification → sauvegarde dans `localStorage` ET appel API backend
- Réconciliation au login : si localStorage et backend divergent, **fusion** des deux paniers (pas perte d'articles)

```javascript
async function reconcileCartOnLogin() {
  const localCart = JSON.parse(localStorage.getItem('femiglow_cart') || '{"items":[]}');
  const backendCart = await api.getCart();

  // Fusion : conserver tous les items, prendre la quantité maximale
  const mergedItems = [...backendCart.items];
  localCart.items.forEach(localItem => {
    const existing = mergedItems.find(i => i.id === localItem.id);
    if (existing) {
      existing.quantity = Math.max(existing.quantity, localItem.quantity);
    } else {
      mergedItems.push(localItem);
    }
  });

  // Sauvegarde côté backend
  await api.replaceCart(mergedItems);

  // Mise à jour localStorage
  localStorage.setItem('femiglow_cart', JSON.stringify({ items: mergedItems }));

  return mergedItems;
}
```

### 12.6 — Recovery email (panier abandonné)

#### Trigger

Si la cliente a ajouté au panier et n'a **pas commandé** dans les **24 heures**, un email automatique est envoyé.

#### Conditions

- Email connu (donné lors d'une session précédente, newsletter, ou compte)
- Pas de commande passée pendant cette période (filtrer les achats récents)
- Maximum 1 email recovery par cycle (pas de spam)

#### Contenu de l'email

**Sujet** : `Votre kit vous attend toujours`

**Corps** : voir section 17.13 du document `/commander` pour le copy intégral.

> Lien CTA dans l'email : `https://femiglow.ma/panier?recovery=token_unique` → restaure le panier dans la session.

### 12.7 — Header — sync compteur

À chaque modification du panier, le compteur d'articles dans le header se met à jour :

```html
<a href="/panier" aria-label="Panier (1 article, 500 dirhams marocains)">
  Panier · <span class="cart-count">1</span>
</a>
```

| Animation update    | Fade-out 150ms / fade-in + scale 0.9 → 1.0 (200ms)             |
| :------------------ | :--------------------------------------------------------------- |
| Annonce ARIA        | « Panier mis à jour : 2 articles, 1 000 dirhams marocains. »     |

### 12.8 — Animation timing — règle générale

| Type d'animation              | Durée            | Easing                              |
| :---------------------------- | :--------------- | :---------------------------------- |
| Hero fade-in                  | 400-500ms        | `cubic-bezier(0.4, 0, 0.2, 1)`      |
| Card article fade-in          | 500ms            | `cubic-bezier(0.16, 1, 0.3, 1)`     |
| Récap fade-in                 | 500ms            | `cubic-bezier(0.16, 1, 0.3, 1)`     |
| Modification quantité (UI)    | 200ms fade-out + 300ms fade-in | `cubic-bezier(0.4, 0, 0.2, 1)` |
| Modal de confirmation         | 240ms            | `cubic-bezier(0.4, 0, 0.2, 1)`      |
| Suppression card (slide-up + fade-out) | 500ms   | `cubic-bezier(0.4, 0, 0.2, 1)`      |
| Trust signals cascade         | 200ms entre, 500ms chacune | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Cross-link fade-in             | 700ms            | `cubic-bezier(0.4, 0, 0.2, 1)`      |
| État panier vide — entrée séquentielle | 1.9s total | `cubic-bezier(0.16, 1, 0.3, 1)`     |
| Hover button                  | 220ms            | `cubic-bezier(0.4, 0, 0.2, 1)`      |
| Header sync compteur          | 200ms            | `cubic-bezier(0.4, 0, 0.2, 1)`      |

### 12.9 — Reduced motion

Pour les utilisateurs avec `prefers-reduced-motion: reduce` :

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }

  /* Cards et récap : apparition instantanée */
  .article-card, .recap, .trust-card {
    opacity: 1 !important;
    transform: none !important;
  }

  /* Suppression : pas de slide-up — disparition simple */
  .article-card.removing {
    opacity: 0 !important;
    transition: opacity 100ms !important;
  }

  /* État panier vide : apparition globale, pas séquentielle */
  .empty-state > * {
    opacity: 1 !important;
    transform: none !important;
  }

  /* Hover : pas de zoom-in */
  .article-card:hover {
    transform: none !important;
  }
}
```

### 12.10 — État de chargement initial

```
[t=0ms]      → HTML loaded, fond crème visible
[t=100ms]    → Police Inter chargée
[t=300ms]    → Police Cormorant chargée
[t=500ms]    → Police Pinyon Script chargée (header uniquement)
[t=600ms]    → Hero fade-in (titre + état)
[t=900ms]    → FCP atteint
[t=1200ms]   → Photo article chargée (LCP)
[t=1500ms]   → Récap fade-in
[t=2000ms]   → Reste de la page (trust signals, cross-link) chargé en lazy
```

### 12.11 — Pas de skeleton screen

Comme sur les autres pages, **pas de skeleton screen**. La page est pré-rendue (SSR ou SSG) — le HTML arrive avec le contenu.

### 12.12 — Comportement clavier

| Touche                | Comportement                                          |
| :-------------------- | :---------------------------------------------------- |
| Tab                   | Navigation séquentielle dans les éléments interactifs  |
| Shift+Tab             | Navigation inverse                                     |
| Enter (sur card article) | Click sur le nom du produit → vers /kit             |
| Enter (sur bouton + ou ─) | Modifie la quantité                                |
| Enter (sur bouton ×)  | Ouvre le modal de confirmation                         |
| Enter (sur CTA Commander) | Navigation vers /commander                          |
| Escape (modal ouvert) | Ferme le modal sans suppression                        |

### 12.13 — Auto-save trigger

L'état est sauvé dans localStorage à chaque :
- Modification de quantité (`+` / `─`)
- Suppression d'article (après confirmation modal)
- Ajout d'article (depuis `/kit` clic ATC) — sauvegardé avant arrivée sur `/panier`

### 12.14 — Browser auto-fill

Pas applicable directement sur `/panier` (pas de formulaire). Les champs auto-fillés interviennent à `/commander`.

### 12.15 — Pas de tracking côté cliente avant consentement

Avant que la cliente accepte les cookies, **aucun tracking analytics** ne se déclenche. Le panier fonctionne **sans GA4 actif** si la cliente refuse les cookies.

### 12.16 — Détection de retour panier abandonné

Si la cliente revient via le lien email recovery :

```
URL : https://femiglow.ma/panier?recovery=TOKEN_UNIQUE
```

Le backend valide le token et **restaure le panier** dans la session. Affichage normal, sans message particulier (la cliente comprend qu'elle est revenue à son panier).

> **Tracking** : événement `cart_recovered_from_email` envoyé à GA4 (avec consentement).

### 12.17 — Comportement si stock épuisé pendant la session

Si la cliente a un kit dans son panier et qu'entre `/panier` et `/commander` le stock devient épuisé :

- Bandeau d'avertissement sur `/panier` : « Ce kit est devenu indisponible. »
- CTA Commander **désactivé** + tooltip : « Le kit est en rupture de stock. »
- Lien « Me prévenir du retour » + email signup

> **V1** : ce cas est rare (stock contrôlé manuellement). **V2** : à intégrer si volume de vente impose des ruptures.

---

## 13 — Adaptation responsive

### 13.1 — Breakpoints officiels

| Nom         | Min-width | Max-width | Layout principal                       |
| :---------- | :-------- | :-------- | :------------------------------------- |
| **Mobile**  | 0         | 767px     | 1 colonne, récap après articles        |
| **Tablet**  | 768px     | 1023px    | 1 colonne, récap après articles        |
| **Desktop** | 1024px    | -         | 2 colonnes (60% articles / 40% récap sticky) |

> **Note** : passage 2 colonnes à **1024px** (vs 1280px pour les pages éditoriales). Cohérent avec `/commander` — quand la sidebar est **fonctionnellement précieuse**, l'optimum apparaît plus tôt.

### 13.2 — Adaptations par section

#### Hero du panier

| Propriété              | Desktop          | Tablet          | Mobile         |
| :--------------------- | :--------------- | :-------------- | :------------- |
| Hauteur                | 200px            | 160px           | 140px          |
| Padding latéral        | 96px             | 64px            | 24px           |
| Titre size             | 36pt             | 30pt            | 26pt           |
| Sous-titre size        | 16pt             | 15pt            | 14pt           |

#### Liste articles

| Propriété              | Desktop          | Tablet          | Mobile         |
| :--------------------- | :--------------- | :-------------- | :------------- |
| Largeur                | 60% grille        | 100%             | 100%           |
| Card padding           | 24px             | 20px             | 16px           |
| Photo size             | 120×120px        | 96×96px          | 80×80px        |
| Gap photo/contenu      | 24px             | 20px             | 16px           |
| Nom produit size       | 22pt             | 19pt             | 17pt           |
| Description size       | 14pt             | 14pt             | 13pt           |
| Selector quantité width | 120px            | 120px            | 120px          |
| Hauteur selector       | 40px             | 40px             | 40px           |
| Prix size              | 16pt             | 15pt             | 15pt           |

#### Récapitulatif

| Propriété              | Desktop ≥ 1024   | Tablet < 1024   | Mobile         |
| :--------------------- | :--------------- | :-------------- | :------------- |
| Position               | Sticky droite, top 96px | Statique après articles | Statique après articles |
| Largeur                | 360px fixe       | 100%             | 100%           |
| Padding                | 32px             | 24px             | 24px           |
| Titre size             | 22pt             | 22pt             | 22pt           |
| CTA Commander hauteur  | 60px             | 60px             | 60px           |
| CTA Commander font     | 16pt             | 16pt             | 16pt           |
| Trust signals brefs    | Empilés          | Empilés           | Empilés        |

#### Trust signals & FAQ courte

| Propriété              | Desktop          | Tablet          | Mobile         |
| :--------------------- | :--------------- | :-------------- | :------------- |
| Layout                 | 3 colonnes       | 3 colonnes        | 1 colonne      |
| Gap                    | 32px             | 24px             | 32px           |
| Card padding           | 16px             | 16px             | 16px           |
| Titre size             | 18pt             | 17pt             | 17pt           |
| Texte size             | 14pt             | 13pt             | 13pt           |

#### Cross-link Journal

| Propriété              | Desktop          | Tablet          | Mobile         |
| :--------------------- | :--------------- | :-------------- | :------------- |
| Layout                 | 50% / 50%        | 50% / 50%        | Empilés        |
| Gap                    | 64px             | 48px             | 24px           |
| Photo height           | 240px            | 200px            | 200px          |
| Titre size             | 28pt             | 24pt             | 22pt           |
| CTA padding            | 12px 24px        | 12px 24px        | 12px 24px      |

#### État panier vide

| Propriété              | Desktop          | Tablet          | Mobile         |
| :--------------------- | :--------------- | :-------------- | :------------- |
| Min-height             | 600px            | 500px            | 480px          |
| Padding vertical       | 96px             | 80px             | 64px           |
| Fleuron size           | 80×12px          | 80×12px           | 64×10px        |
| Titre size             | 32pt             | 28pt              | 26pt           |
| Texte accompagnement   | 18pt             | 17pt              | 16pt           |
| CTA padding            | 14px 28px        | 14px 28px         | 14px 28px      |

### 13.3 — Comportements mobile spécifiques

#### Header

- Burger menu : drawer slide-in 280ms depuis la droite
- Icône panier badge avec compteur visible
- Pas d'item "Panier" dans le menu burger (la cliente y est déjà)

#### Pas de sticky CTA mobile

Contrairement à `/kit` (BOFU avec sticky CTA), **pas de sticky CTA flottant** sur `/panier` mobile. Pourquoi ?
- Le récap (avec son CTA Commander) apparaît juste après la liste d'articles
- La page est suffisamment courte pour que le scroll vers le récap soit rapide
- Un sticky CTA distrairait du focus sur la card article

#### Layout récap après articles (pas en accordéon)

> **Différence avec `/commander` mobile** : le checkout a un récap **accordéon** (fermé par défaut) en haut de page. `/panier` mobile a un récap **statique** après la liste d'articles. Pourquoi ?
> - Sur `/commander`, la page est longue (3 étapes) → accordéon évite le scroll long
> - Sur `/panier`, la page est courte → le récap peut s'afficher en entier

#### Touch targets minimum

| Élément                       | Hauteur tactile minimum                |
| :---------------------------- | :------------------------------------- |
| Boutons selector quantité     | 40×40px chacun                          |
| Bouton supprimer ×            | 40×40px (zone tactile élargie)         |
| Lien nom produit              | Zone label complète ≥ 44px              |
| Lien Continuer mes achats     | ≥ 44px                                  |
| CTA Commander                 | 60px hauteur                            |
| Lien email contact (trust)    | Zone tactile ≥ 44px                     |
| CTA cross-link Journal        | 48px hauteur                            |
| CTA Découvrir le rituel (vide)| 48px hauteur                            |

### 13.4 — Texte minimum sur mobile

Aucun texte en dessous de **14px** sur mobile (lisibilité WCAG AA). Exceptions contextuelles :
- Microcopy trust signals brefs : 11pt acceptable car contextuel
- Mention code promo : 13pt acceptable car secondaire
- Surtitre cross-link : 7.5pt acceptable car uppercase tracked

### 13.5 — Optimisations spécifiques mobile

| Optimisation                         | Justification                                      |
| :----------------------------------- | :------------------------------------------------- |
| Pas d'animation parallax              | Coûteux                                              |
| Lazy loading agressif                  | Bande passante limitée                             |
| Auto-save fréquent                    | Connexion fluctuante                               |
| Pré-chargement photo article          | LCP element                                        |
| Désactivation hover styles             | Évite états bloqués sur écran tactile              |
| Polices système fallback               | Si polices web tardent, texte lisible immédiatement |
| Compression images WebP                | Économie ~30% bande passante                       |

---

## 14 — Performance technique

### 14.1 — Web Vitals — cibles

| Métrique | Cible    | Justification                                      |
| :------- | :------- | :------------------------------------------------- |
| **LCP**  | **< 1.8s** | Photo article = LCP element                       |
| **CLS**  | **< 0.05** | Très strict — page transactionnelle                |
| **INP**  | **< 150ms** | Interactions doivent être instantanées            |
| **FCP**  | < 0.9s   | Hero typographique simple, visible vite             |
| **TBT**  | < 200ms  | JS de validation + state management léger           |

> **Cibles strictes** : `/panier` est la **page-charnière** du tunnel. Sa performance est **directement** liée à la conversion. Cohérence avec `/commander` (cibles équivalentes).

### 14.2 — Stratégie de chargement

#### Critical CSS

CSS critique inline dans le `<head>` — uniquement les styles de :
- Header
- Hero du panier
- Liste articles (premier item visible)
- Récap (sticky desktop)

Le reste en CSS externe.

#### Preload des polices critiques

```html
<link rel="preload" href="/fonts/Inter-Regular.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/Inter-Medium.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/Inter-SemiBold.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/CormorantGaramond-Light.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/CormorantGaramond-Italic.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/PinyonScript-Regular.woff2" as="font" type="font/woff2" crossorigin>
```

> **Cormorant Italic preloaded** : utilisé dans le hero (« 1 article · 500 MAD »), description card, mention code promo, etc.

#### Preload de la photo article (LCP element)

```html
<link rel="preload" as="image"
      href="/images/kit/kit-thumb-120.webp"
      media="(min-width: 1024px)"
      fetchpriority="high">
<link rel="preload" as="image"
      href="/images/kit/kit-thumb-80.webp"
      media="(max-width: 1023px)"
      fetchpriority="high">
```

#### Defer du JavaScript

```html
<!-- Scripts critiques (cart state + UI updates) -->
<script src="/js/cart-core.js" defer></script>

<!-- Scripts non-critiques (animations, analytics) -->
<script src="/js/animations.js" defer></script>
<script src="/js/analytics.js" async></script>
```

> **Pas de JS « payment » sur cette page** — réservé à `/commander`. Économie ~80 KB par rapport au checkout.

### 14.3 — Budget de performance

| Ressource                       | Budget          |
| :------------------------------ | :-------------- |
| HTML initial                    | < 30 KB gzip    |
| CSS critique inline             | < 10 KB         |
| CSS externe                     | < 40 KB gzip    |
| JS total                        | < 50 KB gzip    |
| Photo article (kit thumb)       | < 12 KB (80×80 ou 120×120 WebP) |
| Photo cross-link Journal        | < 80 KB (lazy)  |
| Polices                         | < 140 KB total  |
| **Total page initiale**         | **< 280 KB**    |

> **Léger** : la page-charnière est volontairement **mince**. Pas d'images lourdes, pas de JS payment SDK.

### 14.4 — CDN & cache

| Ressource                      | Cache-Control                          |
| :----------------------------- | :------------------------------------- |
| HTML                           | `no-cache, must-revalidate, no-store`  |
| CSS / JS versionnés            | `public, max-age=31536000, immutable`  |
| Images photo kit               | `public, max-age=2592000` (30 jours)   |
| Polices                        | `public, max-age=31536000, immutable`  |

> **HTML en `no-store`** : critique pour la sécurité — le HTML peut contenir des données partielles de session.

### 14.5 — Optimisations spécifiques

| Optimisation                              | Justification                                      |
| :---------------------------------------- | :------------------------------------------------- |
| **SSR** (Server-Side Rendering)           | HTML pré-rendu avec contenu du panier               |
| Pas d'images lourdes (juste 1 photo article) | LCP < 1.8s atteignable                          |
| State management vanilla / Zustand        | Pas de Redux complet                                |
| Optimistic UI                              | Sentiment de fluidité                                |
| Auto-save throttlé (500ms max)            | Évite saturation localStorage                        |
| Polices `font-display: swap`               | Texte visible immédiatement                          |

### 14.6 — Stratégie de rendu — recommandation

#### Approche recommandée — SSR + hydration

`/panier` est **idéalement** rendue en :
- **SSR** au moment de la requête (Next.js, Remix, Astro avec SSR)
- HTML envoyé avec l'état initial du panier (récupéré depuis cookie session ou localStorage côté client)
- JavaScript hydrate la page progressivement

**Avantages** :
- LCP rapide (HTML pré-rendu visible avant JS)
- Sécurité (validation côté serveur native pour les modifications)
- SEO crawlable (mais on est `noindex`, donc pas critique)

### 14.7 — Métriques de référence

| Site (e-commerce premium)     | LCP    | CLS   | INP    |
| :--------------------------- | :----- | :---- | :----- |
| Aesop panier                  | 1.4s   | 0.03  | 110ms  |
| Le Labo panier                | 1.6s   | 0.04  | 130ms  |
| Glossier panier               | 1.3s   | 0.03  | 95ms   |
| **FemiGlow `/panier` cible**  | **< 1.8s** | **< 0.05** | **< 150ms** |

### 14.8 — Monitoring en production

| Outil                      | Métrique surveillée                                    |
| :------------------------- | :----------------------------------------------------- |
| Web Vitals (real user monitoring) | LCP, CLS, INP                                    |
| Sentry                     | Erreurs JavaScript (notamment optimistic UI rollback)   |
| GA4 funnel reports         | Conversion panier → checkout, drop-off rate             |
| Hotjar                     | Heatmaps mobile + recordings d'abandon                  |

> **Alerting** : si le taux de conversion panier → checkout chute de plus de 10% sur 24h, alerte critique.

---

## 15 — SEO & métadonnées

### 15.1 — Principe directeur — `noindex, nofollow` strict

> **`/panier` n'a aucune raison d'apparaître dans les résultats de recherche.** C'est une page transactionnelle, accessible uniquement par flux logique (depuis `/kit` clic ATC, ou clic icône panier dans le header).

#### Conséquences techniques

- Pas d'optimisation de title/description pour SERP
- Pas d'image Open Graph
- Pas de Schema.org
- Pas de hreflang nécessaire
- Pas dans le sitemap.xml
- `Disallow: /panier` dans robots.txt

### 15.2 — Robots meta

```html
<meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex">
```

### 15.3 — Title minimal

```html
<title>Votre panier · FemiGlow</title>
```

> Title court avec compteur dynamique — utile pour s'y retrouver entre plusieurs onglets ouverts.

#### Variantes selon l'état

| État               | Title                                    |
| :----------------- | :--------------------------------------- |
| 1 article          | `Votre panier · FemiGlow`                 |
| Plusieurs articles  | `Votre panier (3 articles) · FemiGlow`   |
| Panier vide         | `Votre panier · FemiGlow`                 |

> **Pourquoi le compteur dynamique uniquement à partir de 2+ articles ?** Pour ne pas surcharger l'affichage onglet en V1 (1 seul kit ≈ toujours 1 article).

### 15.4 — Meta description (réduite)

```html
<meta name="description" content="Récapitulatif de votre panier FemiGlow.">
```

> Courte. La page n'apparaîtra pas en SERP.

### 15.5 — Pas d'Open Graph

```html
<!-- Pas de balises og:* sur cette page -->
```

> **Pourquoi pas d'OG ?** Pour éviter qu'un partage involontaire de l'URL `/panier` génère un beau preview Facebook/WhatsApp.

### 15.6 — Pas de canonical SEO actif

```html
<link rel="canonical" href="https://femiglow.ma/panier">
```

> Optionnel — gestion interne propre.

### 15.7 — Pas de Schema.org

Aucune structure Schema sur la page panier.

### 15.8 — Pas dans le sitemap

```xml
<!-- Sitemap.xml ne contient PAS /panier -->
```

### 15.9 — Robots.txt

```
User-agent: *
Disallow: /panier
Disallow: /panier?
Disallow: /commander
Disallow: /commander?
Disallow: /merci
Disallow: /espace-pro/
```

### 15.10 — Sécurité contre l'indexation involontaire

5 couches identiques à `/commander` :

1. ✅ Meta robots `noindex`
2. ✅ HTTP header `X-Robots-Tag: noindex, nofollow`
3. ✅ Robots.txt `Disallow`
4. ✅ Pas dans sitemap.xml
5. ✅ Liens internes vers `/panier` avec `rel="nofollow"`

### 15.11 — Tracking analytics

Bien que noindex, `/panier` est **fortement trackée** en interne :

| Événement                           | Outil                       |
| :---------------------------------- | :-------------------------- |
| `cart_viewed`                       | GA4 ecommerce event         |
| `cart_quantity_updated`             | GA4 events                  |
| `cart_item_removed`                 | GA4 events                  |
| `cart_continue_shopping_clicked`    | GA4 events                  |
| `cart_checkout_clicked`             | GA4 funnel event             |
| `cart_recovered_from_email`         | GA4 + email automation       |
| `cart_emptied`                      | GA4 events                   |

### 15.12 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| Pas de `noindex`                                    | Risque que Google indexe une page transactionnelle                   |
| Title SEO optimisé (« Mon panier - Acheter en ligne FemiGlow ») | Inutile (noindex) et casse le ton interne              |
| Open Graph image fancy                              | Génère un preview attractif → favorise le partage involontaire      |
| Schema Cart sur cette page                           | Inutile (noindex) et complexité gratuite                            |
| URL avec données sensibles (ex: `?email=xxx`)       | Données fuitent dans Referer, logs serveurs                          |
| Tracking actif **avant** consentement cookies        | Violation RGPD                                                       |

---

## 16 — Accessibilité (a11y)

### 16.1 — Conformité visée

**WCAG 2.2 niveau AA strict** sur tous les composants — page transactionnelle, l'accessibilité est **obligatoire** légalement et critique éthiquement.

**Niveau AAA** visé sur :
- Contraste de tous les éléments (textes critiques, boutons)
- Navigation clavier complète (chaque card, bouton, lien atteignable)
- Annonces dynamiques (aria-live) pour modifications du panier
- Modal de confirmation accessible (focus trap, escape, lecture du titre)

### 16.2 — Contraste — vérifications

| Combinaison                                        | Ratio   | Niveau WCAG   |
| :------------------------------------------------- | :------ | :------------ |
| Encre `#2C2A28` sur Crème `#FBF8F1`                | 14.2:1  | AAA           |
| Encre claire `#4A4844` sur Crème                   | 9.1:1   | AAA           |
| Brume `#6B6863` sur Crème                          | 5.6:1   | AA            |
| Encre sur Crème pure `#FFFFFF` (card article)      | 14.6:1  | AAA           |
| Encre sur Crème teintée `#F5F0E5` (récap)          | 12.4:1  | AAA           |
| Encre sur Sauge pâle `#E8EFE7` (trust signals)     | 12.8:1  | AAA           |
| Sauge dark `#A8C4A6` sur Crème (filets, focus)     | 2.8:1   | (graphique non textuel — OK pour focus ring) |
| Crème pure sur Encre (CTA Commander)               | 14.2:1  | AAA           |
| Champagne `#C8A876` sur Crème (fleuron empty)      | 2.7:1   | (décoratif — OK) |
| Brume claire `#A8A8A6` sur Crème (bouton supprimer) | 3.9:1   | AA Large only — icône acceptable |
| Rouge feutré `#9C5B5B` sur Crème (hover supprimer) | 5.2:1   | AA            |

### 16.3 — Navigation clavier — séquence Tab

#### Cas — panier avec article

| Ordre | Élément                                              |
| :---- | :--------------------------------------------------- |
| 1     | Skip links (« Aller au contenu », « Aller au récap ») |
| 2     | Wordmark (header)                                     |
| 3     | Items du menu principal (header)                      |
| 4     | Icône panier (header)                                 |
| 5     | Lien sur le nom du produit (card article)              |
| 6     | Bouton selector quantité `─`                           |
| 7     | Bouton selector quantité `+`                           |
| 8     | Bouton supprimer `×`                                   |
| 9     | Lien « Continuer mes achats »                          |
| 10    | CTA « Commander → »                                    |
| 11    | Lien email contact (trust signals)                    |
| 12    | CTA cross-link « Visiter le journal »                  |
| 13    | Liens du footer                                       |

#### Cas — panier vide

| Ordre | Élément                                              |
| :---- | :--------------------------------------------------- |
| 1-4   | (Identique au cas avec article)                      |
| 5     | CTA « Découvrir le rituel → »                         |
| 6     | Lien « Lire le journal »                              |
| 7     | Lien « Visiter la maison »                            |
| 8     | Liens du footer                                       |

#### Cas — modal de confirmation suppression ouvert

| Ordre | Élément                                              |
| :---- | :--------------------------------------------------- |
| 1     | Bouton « Annuler » (focus par défaut)                  |
| 2     | Bouton « Supprimer »                                   |
| Escape| Ferme le modal sans suppression                        |

> **Focus trap** : tant que le modal est ouvert, Tab/Shift+Tab boucle entre « Annuler » et « Supprimer ». Aucun élément hors du modal n'est focusable.

### 16.4 — Focus ring

| Propriété     | Valeur                                          |
| :------------ | :---------------------------------------------- |
| Couleur       | `#A8C4A6` (Sauge dark)                          |
| Épaisseur     | 2px                                             |
| Offset        | 4px                                             |
| Border-radius | Hérite de l'élément (0)                          |
| Outline-style | `solid`                                         |
| Visible       | Sur focus clavier uniquement (`:focus-visible`) |

### 16.5 — ARIA labels & landmarks

```html
<header role="banner" aria-label="En-tête principal">
  <nav aria-label="Navigation principale">...</nav>
  <a href="/panier" aria-label="Panier (1 article, 500 dirhams marocains)">
    Panier · <span class="cart-count">1</span>
  </a>
</header>

<main role="main" aria-label="Votre panier FemiGlow">

  <section aria-labelledby="panier-hero-title" class="panier-hero">
    <h1 id="panier-hero-title">Votre panier.</h1>
    <p class="state-info" aria-label="État du panier">
      <span aria-live="polite">1 article · 500 MAD</span>
    </p>
  </section>

  <section aria-labelledby="articles-list-title" class="articles-list">
    <h2 id="articles-list-title" class="visually-hidden">Articles dans votre panier</h2>

    <article aria-labelledby="article-1-name" class="article-card">
      <figure>
        <img src="..." alt="Kit Rituel d'Éclat — quatre pots alignés sur fond crème">
      </figure>

      <div class="article-content">
        <h3 id="article-1-name">
          <a href="/kit">Kit Rituel d'Éclat</a>
        </h3>
        <p class="description">
          <em>Le rituel complet — quatre matières, quatre gestes.</em>
        </p>

        <hr aria-hidden="true">

        <div class="article-actions">
          <div class="qty-selector" role="group" aria-label="Quantité">
            <button type="button" aria-label="Diminuer la quantité">−</button>
            <span aria-live="polite" aria-atomic="true">1</span>
            <button type="button" aria-label="Augmenter la quantité">+</button>
          </div>

          <span class="price" aria-label="Prix total : 500 dirhams marocains">500 MAD</span>

          <button type="button" class="remove-btn" aria-label="Supprimer Kit Rituel d'Éclat du panier">
            <span aria-hidden="true">×</span>
          </button>
        </div>
      </div>
    </article>

    <a href="/kit" class="continue-shopping">
      <span aria-hidden="true">←</span> Continuer mes achats
    </a>
  </section>

  <aside aria-labelledby="recap-title" class="order-recap">
    <h2 id="recap-title">Récapitulatif</h2>

    <dl>
      <div class="recap-line">
        <dt>Sous-total</dt>
        <dd aria-live="polite">500 MAD</dd>
      </div>
      <div class="recap-line">
        <dt>Livraison</dt>
        <dd><em>Estimée</em></dd>
      </div>
    </dl>

    <hr aria-hidden="true">

    <dl class="recap-total">
      <div class="recap-line">
        <dt>Total</dt>
        <dd aria-live="polite">500 MAD</dd>
      </div>
    </dl>

    <a href="/commander" class="cta cta-commander" aria-label="Commander, total 500 dirhams marocains">
      Commander <span aria-hidden="true">→</span>
    </a>

    <p class="trust-mini">
      <span aria-hidden="true">🔒</span>
      <span>Paiement sécurisé</span>
      <br>
      <span>Livraison sous 3-5 jours</span>
    </p>

    <hr aria-hidden="true">

    <p class="promo-mention">
      <em>Avez-vous un code promo ? À appliquer à l'étape suivante.</em>
    </p>
  </aside>

  <section aria-labelledby="trust-title" class="trust-signals">
    <h2 id="trust-title" class="visually-hidden">Informations rassurantes</h2>

    <article class="trust-card">
      <h3>Livraison</h3>
      <hr aria-hidden="true">
      <p>Standard gratuite pour Casablanca, Rabat, Salé, Mohammedia.</p>
      <p>Express disponible selon ville.</p>
    </article>

    <article class="trust-card">
      <h3>Paiement sécurisé</h3>
      <hr aria-hidden="true">
      <p>Carte bancaire via CMI ou paiement à la livraison.</p>
      <p>Données chiffrées, jamais stockées.</p>
    </article>

    <article class="trust-card">
      <h3>Support</h3>
      <hr aria-hidden="true">
      <p>Une question ? Écrivez-nous à <a href="mailto:contact@femiglow.ma">contact@femiglow.ma</a></p>
      <p>Réponse sous 24h.</p>
    </article>
  </section>

  <section aria-labelledby="crosslink-title" class="crosslink">
    <article>
      <figure>
        <img src="..." alt="Tasse de thé tiède, livre ouvert et carnet sur une table en bois, lumière naturelle">
      </figure>
      <span class="kicker">AVANT DE COMMANDER</span>
      <h2 id="crosslink-title">Quelques minutes pour ralentir.</h2>
      <p>Le journal de la maison — des fragments écrits depuis l'atelier.</p>
      <hr aria-hidden="true">
      <a href="/journal" class="cta-secondary">
        Visiter le journal <span aria-hidden="true">→</span>
      </a>
    </article>
  </section>
</main>

<footer role="contentinfo" aria-label="Pied de page">...</footer>
```

### 16.6 — Annonces dynamiques (aria-live)

#### 1. Modification de quantité

```html
<span aria-live="polite" aria-atomic="true">2</span>
```

À chaque update, le lecteur d'écran annonce : *« 2 »* (la nouvelle valeur).

#### 2. Mise à jour du prix ligne et du total

```html
<dd aria-live="polite">1 000 MAD</dd>
```

Annonce : *« 1 000 MAD »*

#### 3. Confirmation de suppression d'article

```html
<div role="status" aria-live="assertive" class="visually-hidden">
  Kit Rituel d'Éclat a été supprimé de votre panier.
</div>
```

Annonce immédiate après confirmation : *« Kit Rituel d'Éclat a été supprimé de votre panier. »*

#### 4. Erreur de modification

```html
<div role="alert" aria-live="assertive" class="error-message">
  La modification n'a pas pu être sauvegardée. Vérifiez votre connexion.
</div>
```

#### 5. Compteur du header (sync)

```html
<a href="/panier" aria-label="Panier mis à jour : 2 articles, 1 000 dirhams marocains">
  Panier · <span class="cart-count" aria-live="polite">2</span>
</a>
```

### 16.7 — Modal de confirmation suppression — accessibilité

```html
<div role="dialog"
     aria-modal="true"
     aria-labelledby="modal-title"
     aria-describedby="modal-desc">
  <h2 id="modal-title">Supprimer cet article ?</h2>
  <p id="modal-desc">
    Kit Rituel d'Éclat<br>
    500 MAD
  </p>
  <button type="button" autofocus>Annuler</button>
  <button type="button">Supprimer</button>
</div>
```

| Propriété              | Comportement                                          |
| :--------------------- | :---------------------------------------------------- |
| `role="dialog"`        | Identifie comme modal dialog                            |
| `aria-modal="true"`    | Annonce le contenu en arrière-plan inaccessible         |
| Focus trap             | Tab cycle entre les 2 boutons uniquement                 |
| Escape                 | Ferme le modal sans suppression (action conservatrice)   |
| `autofocus` sur Annuler| La cliente appuie Enter par réflexe → annule (sécurité) |
| Click outside           | Ferme le modal sans suppression                          |

### 16.8 — Skip links

```html
<a href="#main" class="skip-link">Aller au panier</a>
<a href="#order-recap" class="skip-link">Aller au récapitulatif</a>
<a href="#cta-commander" class="skip-link">Aller au bouton Commander</a>
```

### 16.9 — Réduction du mouvement

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }

  /* Cards : apparition instantanée */
  .article-card, .recap, .trust-card {
    opacity: 1 !important;
    transform: none !important;
  }

  /* Suppression : disparition simple, pas de slide-up */
  .article-card.removing {
    transition: opacity 100ms !important;
  }

  /* État panier vide : pas de cascade */
  .empty-state > * {
    opacity: 1 !important;
    transform: none !important;
  }

  /* Modal : ouverture instantanée */
  .modal {
    transition: none !important;
  }
}
```

### 16.10 — Lecture par lecteur d'écran — flux

#### Pour une utilisatrice avec lecteur d'écran sur `/panier` (avec article)

```
1. « En-tête principal »
2. « Navigation principale, liste de 5 éléments... »
3. « Lien : Panier (1 article, 500 dirhams marocains) »
4. « Votre panier FemiGlow, contenu principal »
5. « Votre panier. Heading 1 »
6. « État du panier : 1 article · 500 MAD »
7. « Articles dans votre panier, heading 2 (visually hidden) »
8. « Article. Image : Kit Rituel d'Éclat — quatre pots alignés sur fond crème »
9. « Lien : Kit Rituel d'Éclat, heading 3 »
10. « Le rituel complet — quatre matières, quatre gestes. »
11. « Groupe : Quantité »
12. « Bouton : Diminuer la quantité »
13. « 1 »
14. « Bouton : Augmenter la quantité »
15. « Prix total : 500 dirhams marocains »
16. « Bouton : Supprimer Kit Rituel d'Éclat du panier »
17. « Lien : Continuer mes achats »
18. « Récapitulatif, heading 2 »
19. « Sous-total : 500 MAD »
20. « Livraison : Estimée »
21. « Total : 500 MAD »
22. « Lien CTA : Commander, total 500 dirhams marocains »
23. ... etc.
```

> **Note** : la séquence est **complète et cohérente**. Tous les éléments importants sont annoncés dans l'ordre logique de lecture.

### 16.11 — Test d'accessibilité — checklist

| Outil                | Usage                                                       |
| :------------------- | :---------------------------------------------------------- |
| **axe DevTools**     | Audit automatique sur chaque déploiement                     |
| **WAVE**             | Audit visuel en complément                                  |
| **Lighthouse**       | Score d'accessibilité ≥ 95/100                              |
| **NVDA + Firefox**   | Test lecteur d'écran Windows                                |
| **VoiceOver + Safari** | Test lecteur d'écran macOS/iOS                            |
| **TalkBack**         | Test lecteur d'écran Android                                |
| **Keyboard-only**    | Test complet : modifier quantité, supprimer (modal), passer au checkout |
| **Modal a11y**       | Vérification focus trap, escape, autofocus                   |
| **Empty state a11y** | Naviguer en empty state au clavier + lecteur d'écran        |
| **Color contrast**   | WebAIM Contrast Checker                                      |

> **Test critique** : compléter une **modification de panier** (changer quantité) **et** une **suppression** (avec modal) au clavier + lecteur d'écran.

---

## 17 — Microcopy & états

### 17.1 — Principe directeur

> Le panier est plein **d'états dynamiques** : modification de quantité, suppression, prix qui change, produit indisponible, code promo mention, panier vide. Chaque état nécessite un **microcopy soigné** qui respecte la voix éditoriale.

Tonalité globale : **paisible, claire, jamais alarmiste, jamais commerciale.**

### 17.2 — États du selector de quantité

#### Bouton `+`

| État                          | Microcopy + comportement                                          |
| :---------------------------- | :--------------------------------------------------------------- |
| Repos                         | Symbole `+`, couleur Encre                                          |
| Hover                         | Background Crème teintée légère, scale 1.0                        |
| Active (clic)                 | Background Crème teintée plus marquée, scale 0.95                  |
| Pendant API call              | Spinner mini remplace `+` (dans le bouton, taille 12×12px)         |
| Réussite                      | Retour à `+` + animation fade sur la valeur centrale               |
| Échec                         | Retour à `+` + bandeau d'erreur en haut de la card                  |
| Disabled (quantité = 10 max) | Couleur Brume claire, cursor `not-allowed`, tooltip : « Quantité maximale atteinte. Pour des commandes plus grandes, écrivez-nous. » |

#### Bouton `─`

| État                          | Microcopy + comportement                                          |
| :---------------------------- | :--------------------------------------------------------------- |
| Repos (quantité ≥ 2)          | Symbole `─`, couleur Encre — diminue la quantité                    |
| Repos (quantité = 1)          | Symbole `─`, couleur Encre — clic = ouvre modal suppression          |
| Hover                         | Idem                                                                |
| Active                         | Idem                                                                |

#### Annonce ARIA à la modification

```
[utilisatrice clique sur +]
→ Annonce : « 2 »

[ensuite l'API met à jour le prix ligne et le total]
→ Annonce : « Prix total : 1 000 MAD » (sur le span price)
→ Annonce : « Sous-total : 1 000 MAD » (sur le récap)
→ Annonce : « Total : 1 000 MAD » (sur le récap)
```

> **Trois annonces successives** sont normales : la cliente lecteur d'écran perçoit les trois mises à jour en cascade. Pas trop bavard car les annonces sont brèves.

### 17.3 — Modal de confirmation suppression

#### Composition

```
Supprimer cet article ?

Kit Rituel d'Éclat
500 MAD

[Supprimer]   [Annuler]
```

#### Microcopy

| Élément              | Texte                                                  |
| :------------------- | :----------------------------------------------------- |
| Titre                | « Supprimer cet article ? »                              |
| Sous-titre           | (Nom du produit)                                        |
| Sous-sous-titre      | (Prix)                                                  |
| CTA primaire         | « Supprimer »                                            |
| CTA secondaire       | « Annuler » (focus par défaut)                          |

> **Pourquoi pas « Voulez-vous vraiment supprimer cet article ? »** Trop directif. Pourquoi pas « Êtes-vous sûre ? » : trop dramatique. Une question simple suffit.

#### Annonce ARIA à l'ouverture du modal

```
[modal s'ouvre]
→ Lecteur d'écran : « Supprimer cet article ? Dialog. Kit Rituel d'Éclat, 500 MAD. Bouton Annuler, focus. »
```

#### Annonce ARIA après confirmation

```
[utilisatrice clique « Supprimer »]
[card slide-up + fade-out]
→ Lecteur d'écran : « Kit Rituel d'Éclat a été supprimé de votre panier. »

[Si panier devient vide]
→ État panier vide s'affiche
→ Lecteur d'écran : « Votre panier est vide. Pas de précipitation. Le rituel est toujours là, prêt à être découvert. »
```

#### Annonce ARIA après annulation

```
[utilisatrice clique « Annuler » ou Escape]
[modal se ferme]
→ Aucune annonce — le focus retourne sur le bouton supprimer
```

### 17.4 — États du bouton supprimer `[×]`

| État                          | Microcopy + comportement                                          |
| :---------------------------- | :--------------------------------------------------------------- |
| Repos                         | Symbole `×`, couleur Brume claire                                  |
| Hover                         | Couleur rouge feutré, tooltip : « Supprimer cet article »            |
| Focus clavier                 | Focus ring sauge dark + tooltip visible                             |
| Active (clic)                 | Scale 0.95 + ouverture modal                                         |
| Pendant traitement            | (le modal gère le délai — pas d'état pendant)                       |

### 17.5 — États du CTA « Commander »

| État                          | Microcopy + apparence                                          |
| :---------------------------- | :------------------------------------------------------------- |
| Repos                         | Fond Encre, texte « Commander → »                                |
| Hover                         | Fond Encre claire, flèche translate-x 6px                        |
| Active                        | Scale 0.98                                                       |
| Focus clavier                 | Ring sauge dark 2px offset 4px                                   |
| Disabled (cas rupture stock)  | Fond Brume claire, texte « Indisponible » + tooltip explicatif     |
| Loading (clic en cours)       | Spinner mini à gauche de « Commander » + désactivation 600ms      |

### 17.6 — États du Récapitulatif

#### Sous-total

| État                          | Affichage                                          |
| :---------------------------- | :------------------------------------------------- |
| Cas standard                  | « Sous-total · 500 MAD »                            |
| Pendant update (API call)     | (Affichage fade-out 200ms / fade-in 300ms du nouveau montant) |
| Erreur de calcul (rare)       | « Sous-total · — » (tiret simple) — la cliente est invitée à recharger |

#### Livraison

| État                          | Affichage                                          |
| :---------------------------- | :------------------------------------------------- |
| Pas d'adresse (V1 par défaut) | « Livraison · *Estimée* » (italic Brume)             |
| Adresse Casablanca connue     | « Livraison · *Gratuit* » (italic sauge dark)        |
| Adresse hors Casablanca       | « Livraison · *30 MAD* » (italic Brume)              |
| Adresse rurale                | « Livraison · *50 MAD* » (italic Brume)              |

#### Total

| État                          | Affichage                                          |
| :---------------------------- | :------------------------------------------------- |
| Cas standard                  | « Total · 500 MAD » (Inter SemiBold)               |
| Pendant update                | Fade animation                                      |
| Avec frais livraison connus   | « Total · 530 MAD » (incluant 30 MAD livraison)     |

### 17.7 — États des Trust Signals

Les 3 cartes sont **statiques** — pas d'états dynamiques. Microcopy fixe :

| Carte             | Texte                                                                       |
| :---------------- | :-------------------------------------------------------------------------- |
| Livraison         | « Standard gratuite pour Casablanca, Rabat, Salé, Mohammedia. Express disponible selon ville. » |
| Paiement sécurisé | « Carte bancaire via CMI ou paiement à la livraison. Données chiffrées, jamais stockées. » |
| Support           | « Une question ? Écrivez-nous à contact@femiglow.ma. Réponse sous 24h. »   |

### 17.8 — États du Cross-link Journal

Le cross-link est **statique**. Microcopy fixe :

| Élément          | Texte                                                                       |
| :--------------- | :-------------------------------------------------------------------------- |
| Surtitre         | « AVANT DE COMMANDER »                                                      |
| Titre            | « Quelques minutes pour ralentir. »                                          |
| Description      | « Le journal de la maison — des fragments écrits depuis l'atelier. »        |
| CTA              | « Visiter le journal → »                                                     |

### 17.9 — États du panier vide

#### Cas 1 — Arrivée directe sur `/panier` sans rien ajouter

```
Votre panier est vide.

Pas de précipitation. Le rituel est toujours là, prêt à être découvert.

[Découvrir le rituel →]

Lire le journal · Visiter la maison
```

#### Cas 2 — Vidage en cours de session (depuis avoir un kit)

Identique à Cas 1, mais après animation de transition (la card article slide-up + fade-out, puis l'état vide apparaît).

#### Cas 3 — Retour très tardif (panier expiré localStorage > 30 jours)

Identique à Cas 1, sans message particulier (la cliente comprend que c'est normal).

> **Pas de message « Votre panier a expiré » ou « Nous avons effacé votre ancien panier »** : ce serait techno-administratif. La cliente arrive sur un panier vide, c'est tout.

### 17.10 — États d'erreur réseau

#### Erreur lors d'une modification de quantité

```
┌──────────────────────────────────────────────────────────┐
│  ⚠ La modification n'a pas pu être sauvegardée.          │
│  Vérifiez votre connexion et réessayez.                  │
└──────────────────────────────────────────────────────────┘
```

| Propriété          | Valeur                                                          |
| :----------------- | :-------------------------------------------------------------- |
| Container          | Padding 16px, fond `#FBE5E5` (rouge feutré très pâle)            |
| Border-left        | 3px solid `#9C5B5B` (rouge feutré)                              |
| Icône ⚠             | Couleur `#9C5B5B`, 16×16px                                      |
| Texte              | Cormorant Italic 13pt, couleur Encre claire                     |
| Position           | En haut de la card article concernée                              |
| Auto-dismiss        | Disparaît après 5s OU après nouvelle tentative réussie            |

> **Tonalité paisible** : « semble », « pas pu », « réessayez » — pas « ERREUR », pas « ECHEC ». La maison **excuse l'incident** sans dramatiser.

#### Erreur lors d'une suppression

```
┌──────────────────────────────────────────────────────────┐
│  ⚠ La suppression n'a pas pu être effectuée.              │
│  Vérifiez votre connexion et réessayez.                  │
└──────────────────────────────────────────────────────────┘
```

#### Erreur lors du clic « Commander »

```
┌──────────────────────────────────────────────────────────┐
│  ⚠ Impossible d'accéder au paiement pour le moment.      │
│  Vérifiez votre connexion. Si le problème persiste,      │
│  écrivez-nous à contact@femiglow.ma                      │
└──────────────────────────────────────────────────────────┘
```

> **Inclure le contact email** dans l'erreur du CTA Commander : c'est un point critique. Si la cliente ne peut pas accéder au paiement, elle doit pouvoir **contacter quelqu'un**.

### 17.11 — États du code promo (mention textuelle)

```
Avez-vous un code promo ? À appliquer à l'étape suivante.
```

| État                          | Affichage                                          |
| :---------------------------- | :------------------------------------------------- |
| Cas standard                  | Texte intégral                                     |
| Cas connecté avec code déjà appliqué | (V2 — pas en V1)                              |

> **V1** : pas de gestion de code promo dans l'UI panier. Tout passe à `/commander`.

### 17.12 — Tonalité globale — règles éditoriales

**Toujours paisible. Toujours claire. Jamais alarmiste, jamais commerciale.**

| À éviter                                 | À préférer                                              |
| :--------------------------------------- | :------------------------------------------------------ |
| « ERREUR : Modification échouée »         | « La modification n'a pas pu être sauvegardée. »         |
| « Voulez-vous vraiment supprimer ? »      | « Supprimer cet article ? »                              |
| « Cliquez ici pour vider votre panier »   | (pas de bouton « Vider le panier »)                     |
| « Vous avez 0 articles dans votre panier »| « Votre panier est vide. »                               |
| « Désolé, votre panier est vide »         | « Votre panier est vide. Pas de précipitation. »         |
| « Profitez-en, livraison gratuite ! »     | « Livraison · Gratuit » (factuel)                        |
| « Votre commande de 500 MAD »             | « Total · 500 MAD »                                       |
| « Procéder au paiement »                  | « Commander → »                                            |
| « Votre voyage commence ici ! »            | (pas de phrase commerciale exaltée)                     |
| « Continue Shopping »                     | « Continuer mes achats »                                  |

### 17.13 — État 404 spécifique au panier

Si une cliente arrive sur `/panier/etape-x` ou autre URL invalide :

```
┌────────────────────────────────────────────────────┐
│                                                    │
│      Cette page s'est égarée du panier.            │
│                                                    │
│   Mais votre panier vous attend.                   │
│                                                    │
│   ┌──────────────────────┐                         │
│   │  Voir mon panier →   │                         │
│   └──────────────────────┘                         │
│                                                    │
└────────────────────────────────────────────────────┘
```

### 17.14 — Email transactionnel — recovery panier abandonné

#### Trigger

24 heures après l'ajout au panier sans commande.

#### Sujet

```
Votre kit vous attend toujours
```

#### Corps de l'email (intégral)

```
Bonjour,

Vous avez laissé un kit dans votre panier hier.
Si vous souhaitez finaliser votre commande, voici un lien
direct vers le checkout — toutes vos informations sont
préservées.

[Bouton : Reprendre ma commande]

Si vous avez changé d'avis, c'est normal.

Avec soin,
La maison FemiGlow
```

> **Tonalité douce, pas pressante** : « Si vous avez changé d'avis, c'est normal. » désamorce toute pression marketing. La cliente sent qu'elle est respectée.

> **Lien CTA dans l'email** : `https://femiglow.ma/panier?recovery=TOKEN_UNIQUE` → restaure le panier dans la session.

### 17.15 — Email transactionnel — produit indisponible (V2)

Si la cliente s'inscrit pour être prévenue d'un retour stock, l'email final :

#### Sujet

```
Le kit FemiGlow est de retour
```

#### Corps

```
Bonjour,

Bonne nouvelle : le Kit Rituel d'Éclat est à nouveau
disponible. Il vous attend dans votre panier.

[Bouton : Voir mon panier]

Avec soin,
La maison FemiGlow
```

### 17.16 — Cookies banner

Identique à toutes les pages :

```
┌────────────────────────────────────────────────────────────────┐
│  Nous utilisons des cookies pour comprendre votre visite       │
│  et améliorer votre expérience. Aucun partage commercial.      │
│                                                                │
│  [Tout accepter]  [Personnaliser]  Refuser                     │
└────────────────────────────────────────────────────────────────┘
```

> Si la cliente refuse, le panier fonctionne sans tracking. Pas de blocage UX.

---

## 18 — Persistance & synchronisation

### 18.1 — Principe directeur

> Le panier doit **survivre** à toutes les interruptions : fermeture du navigateur, perte de connexion, changement d'appareil (pour les comptes connectés). C'est un **état précieux** qui représente l'intention d'achat de la cliente.

### 18.2 — Architecture de persistance

#### Cliente non connectée (guest)

```
┌────────────────┐         ┌────────────────┐
│  Navigateur     │  Save   │  localStorage   │
│  (cliente)      │ ──────► │  femiglow_cart  │
│                 │         │  TTL : 30 jours │
│                 │ ◄────── │                 │
└────────────────┘  Read   └────────────────┘
```

#### Cliente connectée

```
┌────────────────┐  Save   ┌────────────────┐  Sync  ┌────────────────┐
│  Navigateur     │ ──────► │  localStorage   │ ─────► │  Backend DB    │
│  (cliente)      │         │  femiglow_cart  │        │  (compte)      │
│                 │ ◄────── │                 │ ◄───── │                │
└────────────────┘  Read   └────────────────┘  Sync  └────────────────┘
```

> **Double persistance** pour les comptes connectés : localStorage (rapidité d'accès) + Backend (synchronisation cross-device).

### 18.3 — Structure de l'état du panier

```typescript
interface PanierState {
  // Identifiant unique du panier (UUID v4)
  cartId: string;

  // Items du panier
  items: PanierItem[];

  // Métadonnées
  createdAt: number; // timestamp ms
  lastUpdatedAt: number; // timestamp ms
  expiresAt: number; // timestamp ms (createdAt + 30 jours pour guest)

  // Compteur calculé (pour optimisation header)
  totalItemCount: number;
  subtotalAmount: number; // en MAD

  // Token de recovery (pour email)
  recoveryToken?: string; // généré à l'abandon

  // Statut
  status: 'active' | 'abandoned' | 'converted' | 'expired';
}

interface PanierItem {
  id: string; // SKU produit
  name: string;
  description: string;
  imageUrl: string;
  unitPrice: number; // en MAD
  quantity: number;
  addedAt: number; // timestamp
  pdpUrl: string; // /kit en V1
}
```

### 18.4 — Persistance localStorage

#### Clé et structure

```javascript
const STORAGE_KEY = 'femiglow_cart';
const TTL_DAYS = 30;

function saveCart(state) {
  const payload = {
    state,
    timestamp: Date.now(),
    expiresAt: Date.now() + (TTL_DAYS * 24 * 60 * 60 * 1000),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadCart() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const payload = JSON.parse(raw);

    // Vérification de l'expiration
    if (Date.now() > payload.expiresAt) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return payload.state;
  } catch (error) {
    // localStorage corrompu — purge
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}
```

#### Throttling

L'auto-save est **throttlé à 500ms** pour éviter la saturation :

```javascript
import { throttle } from 'lodash';

const throttledSave = throttle(saveCart, 500);

// À chaque modification de l'état :
function updateCart(newState) {
  setCart(newState);
  throttledSave(newState);
}
```

### 18.5 — Synchronisation backend (compte connecté)

#### À chaque modification

```javascript
async function syncCartToBackend(state) {
  if (!user.isAuthenticated) return; // Pas de sync si guest

  try {
    await api.post('/api/cart/sync', {
      cartId: state.cartId,
      items: state.items,
      lastUpdatedAt: state.lastUpdatedAt,
    });
  } catch (error) {
    // Erreur silencieuse — localStorage est la source de vérité côté client
    // Re-essai automatique au prochain update
    console.warn('Cart sync failed, will retry on next update', error);
  }
}
```

> **Stratégie « silent fail »** : si la sync backend échoue, l'expérience cliente n'est **pas dégradée**. Le panier reste fonctionnel via localStorage. La sync se fera au prochain succès.

#### Au login

```javascript
async function reconcileCartOnLogin() {
  // 1. Charger le panier local (du navigateur)
  const localCart = loadCart();

  // 2. Charger le panier backend (du compte)
  const backendCart = await api.get('/api/cart/current');

  if (!localCart && !backendCart) {
    return null; // Aucun panier — situation normale
  }

  if (!localCart) {
    // Cliente connectée sans panier local — utiliser backend
    saveCart(backendCart);
    return backendCart;
  }

  if (!backendCart) {
    // Cliente connectée avec panier local seulement — pousser vers backend
    await syncCartToBackend(localCart);
    return localCart;
  }

  // 3. Fusion intelligente : conserver tous les items, max quantité
  const mergedItems = [...backendCart.items];

  localCart.items.forEach(localItem => {
    const existing = mergedItems.find(i => i.id === localItem.id);
    if (existing) {
      // Item présent dans les deux — prendre la quantité maximale
      existing.quantity = Math.max(existing.quantity, localItem.quantity);
    } else {
      // Item présent uniquement local — ajouter
      mergedItems.push(localItem);
    }
  });

  // 4. Création du panier réconcilié
  const reconciledCart = {
    ...backendCart,
    items: mergedItems,
    lastUpdatedAt: Date.now(),
  };

  // 5. Sauvegarde des deux côtés
  saveCart(reconciledCart);
  await syncCartToBackend(reconciledCart);

  return reconciledCart;
}
```

> **Pourquoi cette logique de fusion ?** Parce que la cliente peut avoir :
> - Ajouté un kit en mode guest depuis son téléphone
> - Ajouté un autre kit en mode connecté depuis son ordi
> - Au login depuis le téléphone, **les deux articles** doivent être préservés

> **Pas de modal de réconciliation** type « Vous avez deux paniers, lequel garder ? » : trop complexe pour la cliente. La fusion automatique avec maximum quantité est un **bon compromis par défaut**.

### 18.6 — Recovery via token URL

#### Génération du token

Quand la cliente quitte sans commander, un **token unique** est généré :

```javascript
function generateRecoveryToken(cartId) {
  // UUID v4 + signature HMAC pour anti-tampering
  const token = crypto.randomUUID();
  const signature = hmacSha256(`${cartId}:${token}`, SECRET_KEY);
  return `${token}.${signature}`;
}
```

#### Email recovery (24h après abandon)

URL incluse dans l'email :

```
https://femiglow.ma/panier?recovery=TOKEN_UNIQUE.SIGNATURE
```

#### Validation du token côté backend

```javascript
async function validateRecoveryToken(tokenWithSignature) {
  const [token, signature] = tokenWithSignature.split('.');

  // Recherche du panier associé à ce token
  const cart = await db.carts.findOne({ recoveryToken: token });
  if (!cart) {
    throw new Error('Token invalide ou expiré.');
  }

  // Vérification de la signature
  const expectedSignature = hmacSha256(`${cart.cartId}:${token}`, SECRET_KEY);
  if (signature !== expectedSignature) {
    throw new Error('Token corrompu.');
  }

  // Vérification de l'expiration (7 jours après génération)
  const TOKEN_TTL_DAYS = 7;
  const tokenAge = Date.now() - cart.recoveryTokenCreatedAt;
  if (tokenAge > TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000) {
    throw new Error('Token expiré.');
  }

  return cart;
}
```

#### Restauration sur `/panier`

```javascript
// Sur la page panier, si query param `recovery` présent
async function handleRecoveryUrl() {
  const params = new URLSearchParams(window.location.search);
  const recoveryToken = params.get('recovery');

  if (!recoveryToken) return;

  try {
    const recoveredCart = await api.post('/api/cart/recover', {
      token: recoveryToken,
    });

    saveCart(recoveredCart);
    setCart(recoveredCart);

    // Tracking
    analytics.event('cart_recovered_from_email');

    // Nettoyage URL (sans tracker dans GA4 le param)
    window.history.replaceState({}, '', '/panier');
  } catch (error) {
    // Token invalide — ignorer silencieusement
    console.warn('Recovery token invalid', error);
    window.history.replaceState({}, '', '/panier');
  }
}
```

> **Affichage** : pas de bandeau « Votre panier a été restauré ! ». La cliente arrive sur son panier comme si rien ne s'était passé. La continuité est **invisible**.

### 18.7 — Persistance cross-device (compte connecté)

Pour une cliente connectée sur compte FemiGlow :

| Action sur device A      | Conséquence sur device B (au prochain login)        |
| :----------------------- | :-------------------------------------------------- |
| Ajout d'un kit            | Le kit apparaît dans le panier (synchronisé)         |
| Modification quantité     | Quantité synchronisée                                |
| Suppression               | Suppression synchronisée                              |
| Vidage du panier           | Panier vide synchronisé                              |
| Conversion (commande)     | Panier vidé sur tous les devices                      |

> **Synchronisation en temps réel ?** En V1, **non** — la sync se fait au login uniquement. En V2, considérer WebSocket ou polling pour une vraie sync temps réel.

### 18.8 — RGPD — données panier

| Donnée                    | Catégorie       | Justification                                |
| :------------------------ | :-------------- | :------------------------------------------- |
| Items du panier (SKU + qté)| Transactionnelle | Contenu de la commande potentielle            |
| Timestamps (createdAt, etc.) | Technique     | Logique métier (TTL, recovery)                |
| recoveryToken             | Technique        | Email recovery — supprimé après 7 jours       |
| cartId                    | Technique        | Identifiant unique pour debugging/sync        |

#### Données NON collectées (côté panier)

- Email (collecté à `/commander` étape 1, pas avant)
- Données personnelles (collectées à `/commander` étape 2)
- Données carte bancaire (jamais sur `/panier`)

> **Principe** : la page panier collecte **uniquement** les données nécessaires à la fonction panier. Pas de profilage marketing avant consentement.

### 18.9 — Pas de tracking avant consentement

Avant que la cliente accepte les cookies analytics :
- **Pas d'événement GA4** lié au panier (pas de `cart_viewed`, etc.)
- **Pas de pixel Facebook** ni de tag Google Ads
- localStorage `femiglow_cart` est considéré comme **technique nécessaire** (essentiel au fonctionnement) — donc **pas de consentement requis** pour cette donnée

> **Distinction RGPD** : les cookies/storage techniques nécessaires à la fonction (panier persistant) sont exemptés de consentement. Seuls les trackings analytics/marketing nécessitent l'opt-in.

### 18.10 — Durées de rétention

| Donnée                              | Durée                                            |
| :---------------------------------- | :----------------------------------------------- |
| Panier guest (localStorage)         | 30 jours après dernière modification             |
| Panier compte connecté (backend)    | Illimité tant que le compte est actif             |
| Panier compte connecté inactif      | Purge à 12 mois d'inactivité (avec email préalable) |
| recoveryToken                        | 7 jours après génération                          |
| Logs de modification panier (audit)  | 12 mois                                           |

### 18.11 — Encryption at rest

| Donnée                    | Encryption                                       |
| :------------------------ | :----------------------------------------------- |
| Panier backend (Postgres) | Encryption AES-256 at rest                        |
| Backups                   | Encryption AES-256 + clés rotées tous les 90 jours |
| recoveryToken             | Stocké en clair (pas sensible — signature HMAC le protège) |

### 18.12 — Sécurité contre tampering

#### Tampering du sous-total / total côté client

> Un utilisateur malveillant pourrait tenter de **modifier le prix** dans son DOM/localStorage pour payer moins.

**Protection** : le prix unitaire est **toujours revérifié côté serveur** au passage à `/commander`. Le frontend ne fait que **calculer un affichage** — le serveur fait foi.

```javascript
// Côté serveur, à chaque appel /api/checkout/initiate
async function initiateCheckout(cartFromClient) {
  // 1. Charger les prix actuels depuis la base produits
  const items = await Promise.all(
    cartFromClient.items.map(async item => {
      const product = await db.products.findOne({ id: item.id });
      return {
        ...item,
        unitPrice: product.currentPrice, // Le prix serveur écrase le prix client
      };
    })
  );

  // 2. Recalculer le total côté serveur
  const subtotal = items.reduce((sum, item) =>
    sum + item.unitPrice * item.quantity, 0
  );

  // 3. Si le client avait un total différent → log + alerte sécurité
  if (Math.abs(cartFromClient.subtotalAmount - subtotal) > 0.01) {
    securityLogger.warn('Cart tampering detected', {
      cartId: cartFromClient.cartId,
      clientTotal: cartFromClient.subtotalAmount,
      serverTotal: subtotal,
    });
  }

  // 4. Créer la commande avec les valeurs serveur
  return createOrder({ items, subtotal });
}
```

#### Tampering de la quantité

| Limite                | Validation côté serveur                                  |
| :-------------------- | :------------------------------------------------------- |
| Min : 1 par item      | Reject si < 1                                            |
| Max : 10 par item     | Reject si > 10 (V1)                                      |
| Stock disponible       | Reject si stock < quantité demandée                      |

### 18.13 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| Stocker le prix unitaire **uniquement** en localStorage | Tampering trivial                                              |
| Faire confiance au sous-total/total côté client      | Sécurité catastrophique                                              |
| Pas de TTL sur le panier guest                       | Données qui s'accumulent sans limite                                  |
| Pas de fusion au login                               | Perte d'articles ajoutés en mode guest                                |
| Modal de réconciliation au login                     | UX trop complexe                                                      |
| Synchronisation en temps réel forcée                  | Coûteux en infrastructure pour bénéfice marginal en V1               |
| Token de recovery non signé                          | Attaque CSRF possible (vol de panier)                                  |
| Token de recovery sans expiration                    | Vol de session permanent                                              |
| Stocker carte bancaire dans le panier                | Violation PCI-DSS — la carte est uniquement à `/commander` step 3       |
| Tracking GA4 actif avant consentement                | Violation RGPD                                                         |

---

## 19 — Synthèse — checklist de validation

Avant mise en production, vérifier que chaque élément ci-dessous est validé.

### 19.1 — Identité & voix éditoriale (page-charnière)

- [ ] Wordmark Pinyon Script présent en header (lien retour `/accueil`)
- [ ] Header standard (PAS simplifié comme `/commander`)
- [ ] Footer standard (PAS simplifié comme `/commander`)
- [ ] Compteur d'articles dans l'icône panier du header (visible)
- [ ] Couleur compteur en sauge dark `#A8C4A6` (signal subtil page active)
- [ ] Mini-panier dropdown désactivé sur cette page
- [ ] Palette signature respectée (encre + crème + sauge dark + sauge pâle)
- [ ] Pas d'emoji sauf cadenas 🔒 (trust signal récap)
- [ ] Pas de countdown, pas d'urgency, pas de FOMO
- [ ] Pas d'upsell, pas de cross-sell, pas de social proof factice
- [ ] **Fleuron champagne réservé à l'état panier vide** (exception éditoriale documentée)

### 19.2 — Copy & ton (paisible même en page fonctionnelle)

- [ ] Hero : « Votre panier. » Cormorant Light 36pt avec point final
- [ ] Sous-titre hero : « 1 article · 500 MAD » Brume italic 16pt
- [ ] Card article : nom Cormorant Light 22pt cliquable vers `/kit`
- [ ] Description article : « Le rituel complet — quatre matières, quatre gestes. » italic
- [ ] Selector quantité : `─` `1` `+` Inter 14pt
- [ ] Bouton supprimer : `×` Brume claire, hover rouge feutré
- [ ] Lien « Continuer mes achats » avec flèche, Inter Medium 13pt
- [ ] Récap titre : « Récapitulatif » (différent de « Votre commande » /commander)
- [ ] Récap : sous-total, livraison « Estimée » italic Brume, total
- [ ] CTA principal : « Commander → » Inter Medium 16pt, fond Encre, hauteur 60px
- [ ] Trust signals brefs : 🔒 Paiement sécurisé · Livraison sous 3-5 jours
- [ ] Mention code promo : « Avez-vous un code promo ? À appliquer à l'étape suivante. » sobre
- [ ] Trust signals 3 cartes : Livraison · Paiement sécurisé · Support
- [ ] Fond sauge pâle pleine largeur sur trust signals (règle moments d'engagement)
- [ ] Cross-link Journal : surtitre « AVANT DE COMMANDER » + titre « Quelques minutes pour ralentir. »
- [ ] CTA cross-link : « Visiter le journal → » outline (pas plein) — hiérarchie respectée
- [ ] État panier vide : « Votre panier est vide. » + « Pas de précipitation. »
- [ ] CTA panier vide : « Découvrir le rituel → » + 2 liens secondaires Journal · Maison
- [ ] Microcopy d'erreur : « semble », « pas pu », jamais « ERREUR »
- [ ] Apostrophes typographiques courbes ' partout
- [ ] Modal suppression : « Supprimer cet article ? » + Annuler focus par défaut

### 19.3 — Tactiques Kolenda — minimum 4 par section

- [ ] **Hero** : `CONFIRMATION VISUELLE (Norman 1988)` `SOBRIÉTÉ = MATURITÉ` `TOTAL VISIBLE IMMEDIATEMENT` `POSSESSIF VOTRE`
- [ ] **Liste articles** : `VISIBILITY OF SYSTEM STATE (Norman)` `OPTIMISTIC UI = FLUIDITÉ` `MODAL CONFIRMATION = FILET PROTECTEUR (Nielsen 1994)` `FILET SAUGE DARK HIÉRARCHIE` `LIEN CONTINUER NON AGRESSIF`
- [ ] **Récap** : `PREUVE TRANSACTIONNELLE (Cialdini 1984)` `STICKY ACCESSIBILITÉ ACTION` `ESTIMÉE > CALCULÉE À ÉTAPE SUIVANTE (concision)` `TRUST SIGNALS CONTEXTUELS` `MENTION CODE PROMO NON-INTRUSIVE`
- [ ] **Trust signals** : `TIMING DE CONFIANCE (Cialdini)` `TIERS HUMAIN SUPPORT` `SYMÉTRIE TRIANGLE 3 CARTES` `SOBRIÉTÉ = TRUST SIGNAL`
- [ ] **Cross-link Journal** : `RECOVERY ÉDITORIAL (vs commercial)` `RECONNAISSANCE DE L'HÉSITATION` `COHÉRENCE NARRATIVE PHRASE` `CTA OUTLINE = HIÉRARCHIE PROTÉGÉE` `MÊME ONGLET = PANIER PERSISTE`
- [ ] **État vide** : `RECOVERY ÉDITORIAL (Sevilla & Townsend 2016 espace premium)` `DÉSAMORCER FRUSTRATION` `CHAMPAGNE NOBLESSE MÊME DANS ABSENCE` `3 PORTES = LIBERTÉ (Iyengar 2000 inversé)`

### 19.4 — Performance (cibles strictes)

- [ ] **LCP < 1.8s** sur 4G simulé Maroc (photo article = LCP element)
- [ ] **CLS < 0.05** (très strict)
- [ ] **INP < 150ms** (très strict)
- [ ] FCP < 0.9s (hero typographique simple)
- [ ] TBT < 200ms
- [ ] Page weight initiale < 280 KB
- [ ] **JS payment NON chargé ici** (économie ~80KB vs `/commander`)
- [ ] Photo article preloadée avec `fetchpriority="high"`
- [ ] Polices critiques preloaded (Inter Regular/Medium/SemiBold + Cormorant Light/Italic + Pinyon)
- [ ] CSS critique inline (header + hero + première card + récap)
- [ ] CDN configuré + cache strict (HTML `no-store`, assets immutable)
- [ ] **SSR recommandé** (Next.js, Remix, Astro avec SSR)
- [ ] HTTP `Cache-Control: no-store` sur le HTML

### 19.5 — Mécaniques dynamiques

- [ ] **State management TypeScript** (CartState complet : items, subtotal, shipping, total, ui)
- [ ] **Optimistic UI** avec rollback automatique en cas d'erreur API
- [ ] Auto-save throttlé (500ms max)
- [ ] Persistance localStorage 30 jours (clé `femiglow_cart`)
- [ ] Synchronisation backend pour comptes connectés
- [ ] **Réconciliation au login** : fusion paniers avec max quantité par item
- [ ] Recovery email 24h trigger conditions et copy
- [ ] Token URL recovery avec signature HMAC + expiration 7 jours
- [ ] Validation token côté backend
- [ ] Restauration silencieuse (pas de bandeau "Votre panier a été restauré")
- [ ] Header sync compteur animation 200ms scale 0.9→1 avec aria-live
- [ ] Modification quantité optimistic + spinner mini si tardif
- [ ] Modal de confirmation suppression avec focus trap + autofocus Annuler + escape
- [ ] Animation suppression card slide-up + fade-out 500ms
- [ ] Update récap + hero + header en parallèle à chaque modification
- [ ] Cas complexes gérés : retour 2 jours OK silencieux, prix changé bandeau champagne ⓘ, produit indisponible bandeau sauge avec « Me prévenir/Supprimer », coupe réseau rollback + bandeau erreur + auto-retry 3s

### 19.6 — Responsive (mobile-first 60%)

- [ ] Mobile 375px, 390px, 414px testés
- [ ] Tablet 768px, 1024px testés
- [ ] Desktop 1280px, 1440px, 1920px testés
- [ ] **Passage 2 colonnes à 1024px** (cohérent avec `/commander`)
- [ ] Aucun débordement horizontal à aucune taille
- [ ] **Touch targets ≥ 40-44px** sur tout élément interactif (selector qty, supprimer, CTAs)
- [ ] **Texte ≥ 14px** (exceptions contextuelles documentées)
- [ ] Récap statique mobile **après** articles (pas accordéon — page courte)
- [ ] **PAS de sticky CTA mobile** (différence avec `/kit` BOFU)
- [ ] Photo article : 120px desktop / 96px tablet / 80px mobile
- [ ] Card article toujours en row (photo gauche + contenu droite) même mobile

### 19.7 — SEO (noindex strict — 5 couches)

- [ ] **Meta robots `noindex, nofollow, noarchive, nosnippet, noimageindex`**
- [ ] HTTP header `X-Robots-Tag: noindex, nofollow`
- [ ] Robots.txt : `Disallow: /panier`
- [ ] **Pas d'Open Graph image** (volontaire — éviter previews attractifs)
- [ ] Title : « Votre panier · FemiGlow » avec compteur dynamique 2+ articles
- [ ] Meta description courte : « Récapitulatif de votre panier FemiGlow. »
- [ ] **Pas de Schema.org** sur cette page
- [ ] Pas dans le sitemap.xml
- [ ] Liens internes vers `/panier` avec `rel="nofollow"`
- [ ] Tracking GA4 events (cart_viewed, quantity_updated, item_removed, checkout_clicked, recovered_from_email, emptied)
- [ ] Aucun tracking actif avant consentement cookies

### 19.8 — Accessibilité (WCAG 2.2 AA strict)

- [ ] WCAG 2.2 AA validé via axe-core
- [ ] Lighthouse Accessibility score ≥ 95/100
- [ ] Contrastes vérifiés (textes critiques en AAA — sauf brume AA et sauge dark focus ring)
- [ ] Navigation clavier complète (séquence Tab cohérente : avec article + vide + modal ouvert)
- [ ] Focus ring sauge dark 2px offset 4px sur `:focus-visible`
- [ ] **ARIA landmarks** : banner / main / section article / aside récap / section trust / section crosslink / contentinfo
- [ ] `role="group"` sur selector quantité avec aria-label "Quantité"
- [ ] `aria-live="polite"` + `aria-atomic="true"` sur valeur quantité, prix ligne, sous-total, total
- [ ] `aria-live="assertive"` + `role="alert"` sur erreurs de modification + confirmation suppression
- [ ] **Modal de confirmation suppression** : `role="dialog"` + `aria-modal="true"` + focus trap + autofocus sur Annuler + escape ferme + click outside ferme
- [ ] **3 skip links** : main / récap / cta-commander
- [ ] `prefers-reduced-motion` respecté pour cards, suppression, empty state, modal
- [ ] Test NVDA, VoiceOver, TalkBack
- [ ] **Test critique** : modification quantité + suppression complète au clavier + lecteur d'écran

### 19.9 — Sécurité & confidentialité

- [ ] **HTTPS uniquement** + HSTS
- [ ] CSP strict configuré
- [ ] **Validation côté serveur** des prix unitaires au passage à `/commander` (anti-tampering)
- [ ] Logging des tentatives de tampering détectées
- [ ] Validation min 1 / max 10 par item côté serveur
- [ ] Validation stock disponible côté serveur
- [ ] Token de recovery signé HMAC-SHA256 + expiration 7 jours
- [ ] Encryption AES-256 at rest (database + backups)
- [ ] **RGPD** :
  - [ ] Données panier minimum nécessaire (SKU + qté + timestamps)
  - [ ] Pas d'email/données personnelles avant `/commander`
  - [ ] localStorage `femiglow_cart` exempté consentement (technique nécessaire)
  - [ ] Tracking analytics conditionné au consentement
  - [ ] Durée rétention 30 jours guest, illimité connecté avec purge 12 mois inactivité
- [ ] Pas de données carte bancaire sur cette page (réservé `/commander` étape 3)

---

> *« Le panier-charnière. Pas un sas administratif, mais une dernière respiration. La maison ne piège jamais — elle accompagne, elle clarifie, elle propose même de ralentir. Et quand le panier est vide, le fleuron champagne réapparaît : noblesse même dans l'absence. »*

**FIN · FemiGlow · Spécification de la page Panier v1.0 · Mai 2026**

*Prochaines spécifications (B2C) à produire : `/merci` (post-achat — confirmation, suivi commande, partage social, retour incitatif Journal), `/journal/[slug]` (page article — TOC, scroll-spy, partage, related articles).*

*B2B à venir : `/partenaires`, `/programme`, `/echantillon ★`, `/espace-pro`.*
