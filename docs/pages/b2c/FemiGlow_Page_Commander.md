# Page Commander — `/commander` ★

> **Univers Particulier · B2C · Funnel transactionnel** — Document de spécification détaillée
> *Volume VIII · Mai 2026 · Complémentaire à la charte graphique et au document d'architecture.*
> *★ Page critique du funnel commercial — la page la plus haute valeur du site.*

---

## Sommaire

1. [Identité de la page](#1--identité-de-la-page)
2. [Contexte stratégique](#2--contexte-stratégique)
3. [Architecture verticale globale](#3--architecture-verticale-globale)
4. [Header simplifié — élément persistant](#4--header-simplifié--élément-persistant)
5. [Section 01 — Étape 1 : Informations](#5--section-01--étape-1--informations)
6. [Section 02 — Étape 2 : Livraison](#6--section-02--étape-2--livraison)
7. [Section 03 — Étape 3 : Paiement](#7--section-03--étape-3--paiement)
8. [Section 04 — Récap commande (desktop sidebar)](#8--section-04--récap-commande-desktop-sidebar)
9. [Section 05 — Récap commande (mobile accordéon)](#9--section-05--récap-commande-mobile-accordéon)
10. [Section 06 — État de chargement du paiement](#10--section-06--état-de-chargement-du-paiement)
11. [Footer simplifié — élément persistant](#11--footer-simplifié--élément-persistant)
12. [Comportements transverses](#12--comportements-transverses)
13. [Adaptation responsive](#13--adaptation-responsive)
14. [Performance technique](#14--performance-technique)
15. [SEO & métadonnées](#15--seo--métadonnées)
16. [Accessibilité (a11y)](#16--accessibilité-a11y)
17. [Microcopy & états](#17--microcopy--états)
18. [Sécurité & confidentialité](#18--sécurité--confidentialité)
19. [Synthèse — checklist de validation](#19--synthèse--checklist-de-validation)

---

## 1 — Identité de la page

| Attribut             | Valeur                                                                  |
| :------------------- | :---------------------------------------------------------------------- |
| **URL**              | `femiglow.ma/commander`                                                 |
| **Type**             | Funnel transactionnel · checkout 3 étapes                                |
| **Audience**         | Cliente avec intention d'achat maximale — kit déjà dans le panier        |
| **Profil cognitif**  | Décision prise — cherche à finaliser **rapidement et sereinement**       |
| **Pouvoir d'achat**  | Confirmé (la cliente est dans le panier, donc elle assume les ~520 MAD)  |
| **Funnel**           | **BOFU+ / Conversion finale** — étape la plus haute valeur du site       |
| **Position parcours**| Toujours après `/kit` (ATC) ou `/panier`                                 |
| **Durée d'attention**| 2 à 5 minutes (transactionnel)                                            |
| **Device split**     | Mobile 65% · Desktop 30% · Tablet 5% — **mobile dominant**               |
| **Update frequency** | Statique fonctionnellement, configuration des modes/frais en CMS         |
| **Indexation SEO**   | **`noindex, nofollow`** — page transactionnelle, jamais en SERP          |

### Ce que la page **doit** faire

1. **Convertir l'intention en transaction** sans friction inutile. Chaque clic supplémentaire = conversion qui chute.
2. **Rassurer à chaque étape** par la transparence (sécurité paiement, frais affichés, RGPD).
3. **Supporter le paiement à la livraison** — réalité incontournable du e-commerce marocain (~40% des commandes).
4. **Gérer les erreurs avec élégance** — un échec de paiement ne doit pas faire perdre la cliente.
5. **Respecter la voix éditoriale** même dans le formulaire — tonalité paisible, pas mécanique.

### Ce que la page **ne doit pas** faire

1. **Imposer la création de compte.** Le **guest checkout** est l'option par défaut. Forcer la création de compte = -24% conversion (Baymard 2022).
2. **Afficher des urgency timers** (« Plus que 2 articles ! », « Offre expire dans 04:23 »). Ces tactiques détruisent la confiance construite par tout le reste du site.
3. **Faire des upsells de dernière minute** (« Ajoutez ce produit à votre commande »). À ce stade, l'upsell **distrait** et augmente l'abandon.
4. **Cacher des frais.** Tout doit être affiché **dès l'étape 2** (livraison) — pas de frais surprise à l'étape 3.
5. **Demander des informations non nécessaires.** Pas de date de naissance, pas de genre, pas de prénom de jeune fille. Le **strict minimum** pour livrer et facturer.

---

## 2 — Contexte stratégique

### Position dans l'écosystème B2C

```
[ARRIVÉE]                       [PAGE COMMANDER /commander]            [SUITE]
    │                                   │                                  │
/kit (clic CTA principal) ────►   ÉTAPE 1 : Informations          ──►  /merci (succès)
/panier (clic Commander) ─────►   ÉTAPE 2 : Livraison             ──►  /panier (retour si abandon)
                                  ÉTAPE 3 : Paiement                ──►  /kit (retour modif quantité)
                                   │                                  ──►  Email transactionnel envoyé
                                   ↓
                              Validation & paiement
                                   ↓
                              Succès → /merci
                              Échec → message d'erreur + retry
```

### La règle de l'invisibilité fonctionnelle

> Le meilleur checkout est celui que la cliente **ne remarque pas**. Elle remplit, paie, reçoit l'email — sans avoir l'impression d'avoir traversé une épreuve.

Cette **invisibilité fonctionnelle** est l'opposé de l'éditorial des autres pages (où la cliente est invitée à **savourer** la lecture). Sur `/commander`, la cliente doit pouvoir **finir vite et bien**.

### Tension stratégique fondamentale

`/commander` vit dans une triple tension :

#### Tension 1 — Fonctionnalité vs voix éditoriale

> Le checkout est un **formulaire** (champs, validations, erreurs). Mais ce formulaire appartient à une **maison** qui parle avec poésie partout ailleurs. Comment réconcilier ?

**Résolution** : la **structure** est fonctionnelle (single column, validation inline, progression claire) ; le **microcopy** reste de la maison (« Cette adresse semble incomplète » plutôt que « Erreur : adresse invalide »).

#### Tension 2 — Rapidité vs confiance

> Plus le checkout est rapide, plus la conversion monte. Mais une rapidité trop apparente peut **inquiéter** (« Pourquoi ne me demandent-ils pas X ? »).

**Résolution** : on demande **exactement ce qu'il faut** pour livrer et facturer — ni plus (friction), ni moins (inquiétude). Chaque champ est **justifié** par sa fonction visible.

#### Tension 3 — Standardisation vs spécificité Maroc

> Les CMS de checkout (Shopify, WooCommerce) proposent des standards **internationaux**. Mais le Maroc a ses spécificités : paiement à la livraison majeur, structure d'adresse différente (quartier vs ZIP), modes de paiement locaux (CMI).

**Résolution** : adaptation **complète** aux usages locaux. Pas un copier-coller du standard occidental.

### Architecture émotionnelle

| Étape                          | Émotion d'entrée    | Émotion de sortie       | Mouvement intérieur                  |
| :----------------------------- | :------------------ | :---------------------- | :----------------------------------- |
| Arrivée sur `/commander`        | Intention           | Engagement initial       | « C'est parti, je commande »         |
| Étape 1 — Informations          | Engagement          | Connexion identifiée     | Email donné = pacte symbolique       |
| Étape 2 — Livraison             | Connexion           | Précision logistique     | « La maison va m'envoyer le kit »     |
| Étape 3 — Paiement              | Précision           | Décision finale          | Moment de vérité                      |
| Confirmation paiement           | Décision            | Satisfaction             | Soulagement, anticipation             |

> **Note** : si l'arc émotionnel se brise (erreur de paiement, hésitation), la page doit **réparer** vite — pas laisser la cliente dans l'incertitude.

### KPIs cibles

| Métrique                                          | Cible                            | Source                       |
| :------------------------------------------------ | :------------------------------- | :--------------------------- |
| **Taux de conversion checkout** (atteint → terminé) | **> 65%** (vs ~30% e-commerce moyen) | GA4 + funnel events    |
| Taux de complétion étape 1 → étape 2              | > 90%                            | GA4 events                   |
| Taux de complétion étape 2 → étape 3              | > 85%                            | GA4 events                   |
| Taux de complétion étape 3 → succès               | > 80%                            | GA4 events                   |
| **Time to complete** (arrivée → succès)           | < 3 minutes (médiane)            | GA4 timing                   |
| Erreurs de validation par session                 | < 0.5 erreur en moyenne          | Form analytics               |
| Erreurs de paiement                               | < 3% des tentatives              | Stripe / CMI dashboard       |
| **Taux d'abandon panier global**                   | < 35%                            | GA4 funnel                   |
| Mobile completion rate                            | ≥ 95% du desktop rate             | GA4 par device               |
| LCP                                               | < 1.8s                           | Web Vitals                   |
| CLS                                               | < 0.05 (critique en checkout)    | Web Vitals                   |
| INP                                               | < 150ms                          | Web Vitals                   |

> **Pourquoi des cibles aussi strictes ?** Parce que c'est **la page la plus chère du site** en termes de coût d'acquisition. Chaque visiteuse arrivant sur `/commander` représente le coût cumulé de tous les efforts marketing en amont. Sa déperdition coûte directement de l'argent.

### Le profil unique de la visiteuse `/commander`

| Caractéristique                   | Valeur                                                           |
| :-------------------------------- | :--------------------------------------------------------------- |
| **Intention**                     | Maximale — elle a cliqué sur « Commander » volontairement         |
| **Connaissance produit**          | Forte — vient de `/kit` ou `/panier`                              |
| **Patience**                      | **Faible** — toute friction est punie par l'abandon                |
| **Tolérance aux erreurs**         | **Très faible** — une erreur de paiement = 50% de chance d'abandon |
| **Distractions environnantes**    | Élevées — souvent en mobilité, attention partagée                  |
| **Réseau internet**               | Variable — peut perdre connexion en pleine commande                |
| **Moyens de paiement préférés**   | Carte bancaire (60%) · Paiement à la livraison (35%) · Wallet (5%) |

> **La cliente sur `/commander` n'est pas la même** que sur `/maison` ou `/journal`. Elle veut **finir**, pas **lire**. Le design doit le respecter absolument.

### Spécificités du e-commerce marocain

| Spécificité                  | Implication design                                                  |
| :--------------------------- | :------------------------------------------------------------------ |
| **Paiement à la livraison**  | Mode de paiement majeur (~35-40% des commandes B2C au Maroc 2024-2026) — doit être **visible et égalité avec carte bancaire** |
| **Adresse non normalisée**   | Pas de code postal fiable, structure « quartier + ville » prédominante |
| **Téléphone obligatoire**    | Le livreur appelle systématiquement avant livraison                  |
| **Méfiance carte en ligne**  | Encore présente — le paiement à la livraison désamorce               |
| **CMI** (Centre Monétique Interbancaire) | Gateway local Maroc obligatoire pour cartes marocaines  |
| **Livraison hors Casablanca** | Frais et délais variables — affichage transparent essentiel          |
| **Mobile dominant**          | Tunnel optimisé mobile-first, pas adapté de desktop                  |
| **Connexion 3G/4G fluctuante**| Auto-save de l'état, recovery du formulaire en cas de coupure         |

### Les trois fonctions de `/commander`

#### Fonction 1 — Conversion (objectif premier)

Maximiser le passage `/kit` → commande validée. C'est la fonction commerciale absolue.

#### Fonction 2 — Confiance (préparation au post-achat)

La cliente qui paie pour la première fois sur le site doit **sortir rassurée**. La page prépare la qualité de la relation **post-achat** (livraison, support, fidélisation).

#### Fonction 3 — Conformité (RGPD + PCI-DSS)

Respect strict des cadres légaux : protection des données personnelles, sécurité PCI pour les paiements carte. Aucun compromis.

---

## 3 — Architecture verticale globale

### Vue d'ensemble — desktop ≥ 1280px

```
┌─────────────────────────────────────────────────────────────────────┐
│  [HEADER SIMPLIFIÉ — wordmark seul + cadenas + retour panier]       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──── BARRE DE PROGRESSION (3 étapes) ────┐                        │
│  │ ① Informations  →  ② Livraison  →  ③ Paiement                    │
│  └─────────────────────────────────────────┘                        │
│                                                                     │
├──────────────────────────────────────────┬──────────────────────────┤
│                                          │                          │
│  ZONE FORMULAIRE (60% largeur)           │  RÉCAP COMMANDE          │
│                                          │  (40% largeur, sticky)   │
│                                          │                          │
│  [Étape active : 01, 02, OU 03]          │  [Image kit]             │
│                                          │  [Nom · quantité]        │
│  Selon l'étape :                          │  [Sous-total]            │
│                                          │  [Frais livraison]       │
│  - Champs                                │  [Code promo (collapse)] │
│  - Validation inline                     │  [Total]                 │
│  - CTA « Continuer → »                   │                          │
│                                          │                          │
│                                          │                          │
│                                          │                          │
└──────────────────────────────────────────┴──────────────────────────┘
                                                  │
┌─────────────────────────────────────────────────────────────────────┐
│  [FOOTER SIMPLIFIÉ — mentions légales + contact + cadenas SSL]     │
└─────────────────────────────────────────────────────────────────────┘
```

### Vue d'ensemble — mobile < 768px

```
┌────────────────────────────┐
│  [HEADER SIMPLIFIÉ]        │
├────────────────────────────┤
│                            │
│  ① ✓  ②  ③                 │  ← barre progression compacte
│                            │
├────────────────────────────┤
│                            │
│  ▼ Récap (collapsable)     │  ← accordéon mobile, fermé par défaut
│                            │
├────────────────────────────┤
│                            │
│  [FORMULAIRE ÉTAPE ACTIVE] │
│                            │
│  Champs single column       │
│                            │
│  ┌─────────────────────┐   │
│  │   Continuer →       │   │  ← CTA pleine largeur
│  └─────────────────────┘   │
│                            │
├────────────────────────────┤
│  [FOOTER SIMPLIFIÉ]        │
└────────────────────────────┘
```

### Hauteur totale approximative

- **Desktop (1440×900)** : ~720-960px par étape (1.0-1.1 viewport — pas de scroll long)
- **Tablet (768×1024)** : ~840-1100px par étape
- **Mobile (390×844)** : ~960-1280px par étape avec accordéon récap fermé

> **Principe** : chaque étape doit tenir au maximum **1 viewport et demi** sur mobile. Au-delà, la cliente perd le sens du progrès et abandonne plus volontiers.

### Le modèle « Step + Sidebar »

> **Pattern UX standard** des checkouts haut de gamme (Apple, Aesop, Cult Beauty, Selfridges) : zone formulaire à gauche (60%), récap commande sticky à droite (40%) sur desktop. Sur mobile, le récap devient un accordéon collapsable en haut.

| Avantage                                       | Justification                                      |
| :--------------------------------------------- | :------------------------------------------------- |
| Récap toujours visible (desktop)               | La cliente voit ce qu'elle achète à chaque étape    |
| Vérification facile du total                    | Pas besoin de revenir au panier                     |
| Modification possible sans quitter le tunnel    | Lien « Modifier » dans le récap → ouvre modal       |
| Cohérence du design avec la promesse de transparence | Tout est affiché, rien de caché                |

### Pas de retour explicite « ← Retour à l'étape précédente »

Volontairement, **pas de bouton de retour** entre les étapes. Pourquoi ?

- Le bouton « Retour » suggère que la cliente pourrait avoir fait une erreur — il **mine la confiance**
- Si la cliente veut modifier l'étape précédente, elle peut **cliquer sur le numéro de l'étape** dans la barre de progression (déjà complétée → cliquable)
- Cette élégance discrète est cohérente avec le code des checkouts premium

### Flow d'erreur — pas de page d'erreur dédiée

Si une erreur survient (paiement refusé, timeout, etc.), **pas de redirection vers une page d'erreur**. À la place :

- Banner d'erreur **inline** sous le bouton de paiement
- Le formulaire **reste rempli** (sauf champs sensibles : CVV, numéro de carte)
- La cliente peut **retenter** sans recommencer

> **Principe** : ne jamais perdre la cliente. Toute erreur est traitée **dans la même page**, avec le maximum d'état préservé.

### Le numéro de commande (post-succès)

Après succès du paiement, la cliente est redirigée vers `/merci` avec un numéro de commande affiché. Ce numéro a la forme :

```
FG-2026-XXXXX
```

Où `XXXXX` est un compteur séquentiel à 5 chiffres avec padding (00001, 00002, …, 09999, 10000).

> **Pourquoi ce format ?** Parce qu'il est **lisible** (pas d'UUID), **mémorisable** (la cliente peut le citer au support sans le copier), et **discret** (le client ne voit pas qu'il s'agit de la commande #00037 — la maison vit ses débuts modestement).

---

## 4 — Header simplifié — élément persistant

### Pourquoi un header *simplifié* ?

Sur toutes les autres pages, le header contient la navigation complète (Accueil, Rituel, Kit, Journal, Maison, Espace pro). Sur `/commander`, **cette navigation disparaît**.

#### Justification — « tunnel sans fuite »

> **Baymard Institute (2022)** : *« Les liens de navigation sur une page de checkout réduisent le taux de conversion de 5 à 12% — chaque clic externe est un abandon potentiel. »*

Le header simplifié transforme `/commander` en **tunnel** : la cliente ne peut quitter que par :
1. **Validation** (succès → `/merci`)
2. **Retour panier** (lien explicite « Retour au panier »)
3. **Wordmark** (clic → retour `/accueil`, mais avec confirmation)

Tout autre lien est **supprimé**.

### Composition du header simplifié

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  FemiGlow            [Commande sécurisée 🔒]      ← Retour au panier│
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

| Élément                     | Position           | Comportement                                        |
| :-------------------------- | :----------------- | :-------------------------------------------------- |
| Wordmark Pinyon Script       | Gauche             | Clic → modal de confirmation « Quitter le checkout ? » |
| Mention « Commande sécurisée » | Centre (desktop) / cachée (mobile < 380px) | Avec icône cadenas, en sauge dark |
| Lien « ← Retour au panier »  | Droite             | Clic → `/panier` directement (l'état est sauvé)    |

#### Spécifications

| Propriété                | Valeur                                                          |
| :----------------------- | :-------------------------------------------------------------- |
| Hauteur                  | 72px (desktop) · 64px (mobile)                                  |
| Background               | `#FBF8F1` (Crème) — opaque                                       |
| Border-bottom            | 1px solid `#E8E0D2` (Ligne)                                     |
| Padding latéral          | 32px (desktop) · 16px (mobile)                                  |
| Sticky                   | `position: sticky; top: 0; z-index: 100`                        |
| Compression au scroll    | **Aucune** (différent des autres pages) — le header reste fixe   |

### Wordmark — comportement modifié

#### Spécifications

| Propriété      | Valeur                                              |
| :------------- | :-------------------------------------------------- |
| Police         | Pinyon Script Regular                                |
| Taille         | 28pt (desktop) · 24pt (mobile)                       |
| Couleur        | `#2C2A28` (Encre)                                    |
| Lien           | Vers `/accueil`                                      |

#### Modal de confirmation au clic

Cliquer sur le wordmark **n'ouvre pas directement** `/accueil` — cela ouvrirait un modal :

```
┌────────────────────────────────────────────────────┐
│                                                    │
│  Quitter le checkout ?                              │
│                                                    │
│  Votre panier sera conservé. Vous pourrez          │
│  reprendre votre commande à tout moment.           │
│                                                    │
│   ┌──────────────────┐   ┌──────────────────┐     │
│   │  Continuer       │   │  Quitter         │     │
│   │  ma commande     │   │                  │     │
│   └──────────────────┘   └──────────────────┘     │
│                                                    │
└────────────────────────────────────────────────────┘
```

| Élément             | Spécifications                                              |
| :------------------ | :---------------------------------------------------------- |
| Titre               | Cormorant Light 22pt, couleur Encre                         |
| Description         | Cormorant Italic 14pt, couleur Encre claire                 |
| CTA primaire        | « Continuer ma commande » (encre plein) — focus par défaut  |
| CTA secondaire      | « Quitter » (outline encre)                                  |
| Backdrop            | `rgba(44, 42, 40, 0.4)` — fond sombre éclairé                |
| Fermeture           | Click outside, Escape, ou clic sur « Continuer ma commande » |

> **Pourquoi un modal de confirmation ?** Parce qu'un clic accidentel sur le wordmark serait **désastreux** — la cliente perdrait son progrès. Le modal protège l'état.

### Mention « Commande sécurisée »

```
🔒 Commande sécurisée
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Inter Medium 11pt                                            |
| Letter-spacing  | 1px                                                          |
| Couleur         | `#A8C4A6` (Sauge dark) — couleur de confiance               |
| Icône cadenas   | SVG inline, taille 14×14px, couleur Sauge dark               |
| Visibilité      | Desktop + Tablet · cachée sur mobile < 380px                |
| Position        | Centrée horizontalement                                       |

> **Pourquoi cette mention ?** Trust signal classique en checkout. La cliente cherche inconsciemment des indicateurs de sécurité — cette mention discrète les fournit sans crier.

### Lien « ← Retour au panier »

```
← Retour au panier
```

| Propriété          | Valeur                                                          |
| :----------------- | :-------------------------------------------------------------- |
| Police             | Inter Medium 13pt                                                |
| Couleur            | `#4A4844` (Encre claire)                                         |
| Hover              | `#2C2A28` (Encre), underline 1px sauge dark, offset 4px          |
| Action             | Navigation directe vers `/panier`                                 |
| **Pas de modal**   | Contrairement au wordmark, le retour au panier est **assumé**    |

> **Différence avec le wordmark** : retourner au panier est une **action légitime** dans le tunnel (modifier la quantité, vérifier). Le clic est **direct**, sans modal de confirmation.

### Pas de barre de recherche, pas de panier

| Élément habituel | Sur `/commander` |
| :--------------- | :--------------- |
| Barre de recherche | **Supprimée** |
| Icône panier `[Panier · X]` | **Supprimée** (la cliente est déjà dans le tunnel) |
| Menu burger mobile | **Supprimé** |
| Sélecteur de langue | **Supprimé** |

### Tokens design

```css
/* ─── Header simplifié — tokens ─── */
--header-checkout-bg: #FBF8F1;
--header-checkout-border: 1px solid #E8E0D2;
--header-checkout-height-desktop: 72px;
--header-checkout-height-mobile: 64px;
--header-checkout-padding-x-desktop: 32px;
--header-checkout-padding-x-mobile: 16px;
--header-checkout-z-index: 100;

--header-checkout-wordmark-size-desktop: 28pt;
--header-checkout-wordmark-size-mobile: 24pt;
--header-checkout-wordmark-color: #2C2A28;

--header-checkout-secure-color: #A8C4A6;
--header-checkout-secure-size: 11pt;
--header-checkout-secure-tracking: 1px;
--header-checkout-secure-icon-size: 14px;

--header-checkout-back-color: #4A4844;
--header-checkout-back-hover-color: #2C2A28;
--header-checkout-back-size: 13pt;
```

### Tactiques psychologiques

#### 1. Tunnel without escape (Baymard 2022)

Suppression de tous les liens distractifs = +5 à +12% conversion.

#### 2. Trust signal subtle (Cialdini 1984)

La mention « Commande sécurisée 🔒 » est un **signal de confiance** discret mais constant. Toujours visible, jamais agressive.

#### 3. Reversibility préservée

Le lien « Retour au panier » garantit que la cliente **n'est jamais piégée**. Cette réversibilité paradoxalement **réduit l'abandon** (la cliente ne se sent pas forcée).

#### 4. Le modal de confirmation comme filet

Le modal au clic wordmark **prévient l'erreur fatale** sans empêcher l'action. La cliente garde le contrôle, mais avec une seconde chance.

---

## 5 — Section 01 — Étape 1 : Informations

### 5.1 — Wireframe complet

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  ┌─────────────────────────────────────────────────────┐             │
│  │ ① Informations    ··  ② Livraison    ··  ③ Paiement │             │
│  │   ───────                                            │             │
│  └─────────────────────────────────────────────────────┘             │
│                                                                      │
│  Vos informations.                                                   │
│                                                                      │
│  Nous avons besoin de votre email pour vous envoyer la confirmation │
│  de commande et le suivi de livraison.                              │
│                                                                      │
│  ┌──────────────────────────────────────────────┐                    │
│  │  Email                                        │                    │
│  │  ┌────────────────────────────────────────┐  │                    │
│  │  │  votre@email.com                        │  │                    │
│  │  └────────────────────────────────────────┘  │                    │
│  └──────────────────────────────────────────────┘                    │
│                                                                      │
│  ☐ Recevoir le journal de la maison                                  │
│  Un texte tous les quinze jours. Désinscription en un clic.         │
│                                                                      │
│  ☐ Créer un compte pour suivre mes commandes                          │
│  (Optionnel — vous pouvez commander sans compte)                    │
│                                                                      │
│                                                                      │
│  ┌──────────────────────────────────────────────┐                    │
│  │  Continuer →                                  │                    │
│  └──────────────────────────────────────────────┘                    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 5.2 — Barre de progression

#### Composition

```
┌─────────────────────────────────────────────────────────┐
│ ① Informations    ··  ② Livraison    ··  ③ Paiement     │
│   ───────                                                │
└─────────────────────────────────────────────────────────┘
```

| Élément                       | Spécifications                                              |
| :---------------------------- | :---------------------------------------------------------- |
| Numéro étape                  | Caractère ① ② ③ (U+2460-U+2462), 16pt                       |
| Label étape                   | Inter Medium 12pt, tracking 1px                             |
| Séparateur entre étapes       | `··` (deux points) en couleur Brume, espacement 16px        |
| Couleur étape active          | `#2C2A28` (Encre) — numéro + label + soulignement 1.5px sauge dark sous le label |
| Couleur étape complétée       | `#4A4844` (Encre claire) — numéro avec ✓ remplaçant le numéro · cliquable |
| Couleur étape future          | `#A8A8A6` (Brume claire) — non cliquable                     |
| Position                      | Au-dessus du formulaire, padding vertical 32px              |
| Mobile                        | Compactée — voir section 13                                  |

#### Comportement

- Étape 1 cliquée → si étape déjà complétée, retour à l'étape 1 (édition possible)
- Étape 2 cliquée → accessible **seulement** si étape 1 complétée (sinon non-cliquable)
- Étape 3 cliquée → accessible **seulement** si étapes 1 et 2 complétées

> **Pourquoi cette navigation ?** Parce que la cliente peut vouloir corriger une information (email, adresse) en avançant. Le retour libre **réduit l'abandon** par rapport à un tunnel rigide.

### 5.3 — Titre de l'étape

```
Vos informations.
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Light                                     |
| Taille          | 28pt (desktop) · 24pt (mobile)                                |
| Couleur         | `#2C2A28` (Encre)                                            |
| Espacement haut | 48px sous la barre de progression                              |
| Espacement bas  | 16px avant la phrase explicative                                |

> **« Vos informations. »** — possessif simple. Pas « Vos coordonnées personnelles » (jargon administratif), pas « Pour commencer, dites-nous qui vous êtes » (over-friendly). Juste : ce qu'on demande.

### 5.4 — Phrase explicative

```
Nous avons besoin de votre email pour vous envoyer la confirmation
de commande et le suivi de livraison.
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Regular                                   |
| Taille          | 15pt (desktop) · 14pt (mobile)                                |
| Couleur         | `#4A4844` (Encre claire)                                     |
| Line-height     | 1.6                                                          |
| Espacement bas  | 32px avant le champ                                           |

> **Justifier la demande** = principe Sugarman 1995 (« Tell them why you're asking »). En expliquant **pourquoi** on demande l'email, on **désamorce la résistance** à donner l'information.

### 5.5 — Champ Email

#### Spécifications

| Propriété          | Valeur                                                          |
| :----------------- | :-------------------------------------------------------------- |
| Type HTML          | `<input type="email" required autocomplete="email" inputmode="email">` |
| Label              | « Email » — Inter Medium 11pt, couleur Encre, position au-dessus |
| Placeholder        | `votre@email.com`                                                |
| Police champ       | Inter Regular 15pt                                                |
| Couleur saisie     | `#2C2A28` (Encre)                                                |
| Couleur placeholder| `#A8A8A6` (Brume claire)                                         |
| Fond               | `#FFFFFF` (Crème pure)                                           |
| Border             | 1px solid `#E8E0D2` (Ligne)                                     |
| Border-radius      | 0                                                                |
| Padding            | 14px 16px                                                        |
| Hauteur            | 48px (touch target ≥ 44px respecté)                              |
| Largeur            | 100% du container                                                 |

#### États du champ

| État                 | Spécifications                                              |
| :------------------- | :---------------------------------------------------------- |
| Repos                | Border `#E8E0D2`, fond crème pure                            |
| Focus                | Border `#A8C4A6` (Sauge dark), outline 2px sauge dark offset 2px |
| Validé (post-blur)   | Border `#A8C4A6` (Sauge dark) discrètement, ✓ icône 12px à droite |
| Erreur               | Border `#9C5B5B` (rouge feutré), message d'erreur sous le champ |
| Auto-rempli (browser)| Border standard repos (pas de couleur de fond jaune browser)  |

#### Validation inline

```javascript
function validateEmail(value) {
  // RegExp simple — la validation forte se fait côté serveur
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(value);
}

// Trigger : onBlur (pas onChange — pas de harcèlement de la cliente pendant la frappe)
input.addEventListener('blur', () => {
  if (input.value && !validateEmail(input.value)) {
    showError(input, "Cet email semble incomplet.");
  } else {
    clearError(input);
  }
});
```

#### Message d'erreur

```
Cet email semble incomplet.
```

| Propriété      | Valeur                                                  |
| :------------- | :------------------------------------------------------ |
| Police         | Inter Regular Italic 12pt                               |
| Couleur        | `#9C5B5B` (rouge feutré)                                |
| Position       | Sous le champ, espacement 6px                           |
| Animation      | Fade-in 200ms                                           |

### 5.6 — Opt-ins (cases à cocher)

#### Opt-in 1 — Newsletter

```
☐ Recevoir le journal de la maison
   Un texte tous les quinze jours. Désinscription en un clic.
```

| Propriété          | Valeur                                                          |
| :----------------- | :-------------------------------------------------------------- |
| **Pré-cochée ?**   | **NON** (RGPD strict)                                            |
| Checkbox           | 18×18px, border 1.5px sauge dark, fond crème pure                |
| Cochée             | Fond sauge dark, ✓ blanc                                         |
| Label principal    | Inter Medium 14pt, couleur Encre                                 |
| Sous-label         | Cormorant Italic 12pt, couleur Encre claire, line-height 1.5     |
| Espacement         | 24px entre checkbox et label, 4px entre label et sous-label      |
| Touch target       | Toute la zone label + sous-label cliquable (≥ 44px hauteur)      |
| Espacement bas     | 16px avant l'opt-in suivant                                       |

#### Opt-in 2 — Création de compte

```
☐ Créer un compte pour suivre mes commandes
   (Optionnel — vous pouvez commander sans compte)
```

| Propriété          | Valeur                                                          |
| :----------------- | :-------------------------------------------------------------- |
| **Pré-cochée ?**   | **NON** — guest checkout par défaut                              |
| Spécifications visuelles | Identiques à l'opt-in 1                                    |

#### Si opt-in 2 cochée — champ mot de passe apparaît

Animation : slide-down 320ms du champ password sous l'opt-in.

```
☑ Créer un compte pour suivre mes commandes
   (Optionnel — vous pouvez commander sans compte)

   ┌─────────────────────────────────────────┐
   │ Mot de passe                             │
   │ ┌─────────────────────────────────┐ ◉  │
   │ │ ••••••••••••                     │     │
   │ └─────────────────────────────────┘     │
   │ Au moins 8 caractères                    │
   └─────────────────────────────────────────┘
```

| Élément              | Spécifications                                                |
| :------------------- | :------------------------------------------------------------ |
| Type HTML            | `<input type="password" minlength="8" autocomplete="new-password">` |
| Bouton ◉ show/hide   | Toggle visibility, 32×32px, à droite du champ                  |
| Validation           | Min 8 caractères — message inline si moins                     |
| Texte d'aide          | « Au moins 8 caractères » sous le champ                        |
| Pas de complexity rule | (pas d'obligation majuscule/chiffre — réduit la friction)    |

### 5.7 — Bouton « Continuer »

```
┌──────────────────────────────────────────────┐
│  Continuer →                                  │
└──────────────────────────────────────────────┘
```

| Propriété          | Valeur                                                                |
| :----------------- | :-------------------------------------------------------------------- |
| Police             | Inter Medium                                                          |
| Taille             | 15pt                                                                  |
| Letter-spacing     | 0.5px                                                                 |
| Texte              | `#FBF8F1` (Crème pure)                                                |
| Fond               | `#2C2A28` (Encre)                                                     |
| Padding            | 16px 32px                                                             |
| Border-radius      | 0                                                                      |
| Hauteur            | 56px (touch target confortable)                                        |
| Largeur            | 100% du container desktop · 100% mobile                                |
| Hover              | Fond `#4A4844`, flèche se déplace de 4px à droite (300ms)             |
| Active             | Scale 0.98                                                             |
| Disabled (champ vide ou invalide) | Fond `#A8A8A6` (Brume claire), cursor `not-allowed`     |
| Focus              | Ring 2px sauge dark, offset 4px                                        |
| Espacement haut    | 32px sous les opt-ins                                                  |

> **Pleine largeur sur desktop aussi** : différence avec les CTA des autres pages (où ils sont auto-width). En checkout, le CTA pleine largeur **focalise l'attention** et **maximise l'affordance tactile** (mobile).

### 5.8 — Tokens design

```css
/* ─── Étape 1 : Informations — tokens ─── */
--checkout-step-bg: #FBF8F1;
--checkout-step-padding-vertical: 32px;
--checkout-step-max-width: 540px;

/* Barre de progression */
--progress-active-color: #2C2A28;
--progress-completed-color: #4A4844;
--progress-future-color: #A8A8A6;
--progress-active-underline-color: #A8C4A6;
--progress-separator-color: #A8A8A6;
--progress-step-size: 16pt;
--progress-label-size: 12pt;
--progress-label-tracking: 1px;

/* Titre étape */
--step-title-font: 'Cormorant Garamond', serif;
--step-title-weight: 300;
--step-title-size-desktop: 28pt;
--step-title-color: #2C2A28;
--step-title-margin-top: 48px;

/* Phrase explicative */
--step-explainer-font: 'Cormorant Garamond', serif;
--step-explainer-size: 15pt;
--step-explainer-color: #4A4844;
--step-explainer-line-height: 1.6;
--step-explainer-margin-bottom: 32px;

/* Champ form (générique) */
--input-bg: #FFFFFF;
--input-border: 1px solid #E8E0D2;
--input-border-focus: 1px solid #A8C4A6;
--input-border-error: 1px solid #9C5B5B;
--input-padding: 14px 16px;
--input-height: 48px;
--input-font-family: 'Inter', sans-serif;
--input-font-size: 15pt;
--input-text-color: #2C2A28;
--input-placeholder-color: #A8A8A6;

/* Label form */
--label-font: 'Inter', sans-serif;
--label-weight: 500;
--label-size: 11pt;
--label-color: #2C2A28;
--label-margin-bottom: 8px;

/* Message d'erreur */
--error-color: #9C5B5B;
--error-style: italic;
--error-size: 12pt;
--error-margin-top: 6px;

/* Checkbox */
--checkbox-size: 18px;
--checkbox-border: 1.5px solid #A8C4A6;
--checkbox-bg: #FFFFFF;
--checkbox-checked-bg: #A8C4A6;
--checkbox-checked-color: #FFFFFF;

/* Opt-in label */
--optin-main-label-font: 'Inter', sans-serif;
--optin-main-label-weight: 500;
--optin-main-label-size: 14pt;
--optin-sub-label-font: 'Cormorant Garamond', serif;
--optin-sub-label-style: italic;
--optin-sub-label-size: 12pt;
--optin-sub-label-color: #4A4844;

/* Bouton primary */
--primary-cta-bg: #2C2A28;
--primary-cta-text: #FBF8F1;
--primary-cta-hover-bg: #4A4844;
--primary-cta-disabled-bg: #A8A8A6;
--primary-cta-padding: 16px 32px;
--primary-cta-height: 56px;
--primary-cta-font-size: 15pt;
```

### 5.9 — Comportements UX critiques

#### Auto-save

À chaque blur d'un champ (et à chaque toggle d'opt-in), l'état est **automatiquement sauvé** dans `localStorage` (clé `femiglow_checkout_state`). Si la cliente quitte et revient dans les 24h, son progrès est **restauré**.

```javascript
const STORAGE_KEY = 'femiglow_checkout_state';
const TTL_HOURS = 24;

function saveCheckoutState(state) {
  const payload = {
    state,
    timestamp: Date.now(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function restoreCheckoutState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  const payload = JSON.parse(raw);
  const ageHours = (Date.now() - payload.timestamp) / (1000 * 60 * 60);

  if (ageHours > TTL_HOURS) {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }

  return payload.state;
}
```

> **Important** : ne **JAMAIS** sauver les données sensibles (CVV, numéro de carte complet, mot de passe) dans localStorage. Uniquement : email, opt-ins, adresse, mode de livraison choisi, mode de paiement choisi (sans détails carte).

#### Validation à la soumission

Avant de passer à l'étape 2 :
1. Email présent ET valide → ✓
2. Si compte créé : password présent ET ≥ 8 char → ✓
3. Si tout OK → animation transition vers étape 2

#### Animation de transition entre étapes

```
[t=0ms]      → Click sur « Continuer »
[t=0-100ms]  → Bouton scale 0.98 (feedback tactile)
[t=100-200ms]→ Spinner mini sur le bouton (« Chargement... »)
[t=200ms]    → URL update : /commander?step=2
[t=200-500ms]→ Étape 1 fade-out 300ms
[t=500-800ms]→ Étape 2 fade-in + translate-up 12px (300ms)
[t=800ms]    → Focus auto sur le premier champ de l'étape 2 (Prénom)
[t=900ms]    → Animation terminée
```

### 5.10 — Psychologie

#### 1. Single column form (Bachiega 2016)

> *« Single-column forms convert 15.4% better than multi-column forms. »*

Tout en une colonne, jamais de side-by-side (sauf prénom + nom en étape 2 sur desktop large — exception justifiée).

#### 2. Justification du email (Sugarman)

La phrase « Nous avons besoin de votre email pour vous envoyer la confirmation et le suivi » **justifie** la demande. Sans cette justification, la cliente résiste inconsciemment.

#### 3. Guest checkout par défaut (Baymard 2022)

> *« 24% of cart abandonments occur because the site forces account creation. »*

Opt-in compte **non pré-cochée** = la cliente passe sans compte par défaut.

#### 4. Pas d'opt-in newsletter pré-coché (RGPD + éthique)

Le RGPD interdit les checkboxes pré-cochées pour le marketing. Mais au-delà du légal : la **confiance** se construit par le **respect de la liberté de choisir**.

#### 5. Continue → vs Submit

Le label « Continuer » est plus engageant que « Suivant » ou « Valider ». Il évoque le **mouvement** sans la finalité (qui est réservée à l'étape 3 « Confirmer la commande »).

### 5.11 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| Demander email + confirm email                      | Friction inutile — autocomplete navigateur suffit                  |
| Champ téléphone à l'étape 1                         | Le téléphone est demandé à l'étape 2 (livraison) — séparation logique |
| Demander prénom/nom à l'étape 1                     | Idem — étape 2                                                      |
| Opt-in newsletter pré-cochée                        | Illégal RGPD + détruit la confiance                                |
| Opt-in compte pré-cochée                            | Force inutilement, augmente l'abandon                              |
| Champ « Comment nous avez-vous connus ? »           | Friction marketing inutile                                          |
| Captcha visible                                     | reCAPTCHA invisible OK, captcha visible = friction destructrice    |
| Animation excessive entre étapes (> 600ms)          | Donne l'impression de lenteur                                       |
| Pas d'auto-save                                     | Connexion fluctuante = perte du progrès = abandon                  |
| Validation onChange (pendant la frappe)             | Harcèlement — valider seulement onBlur                              |

---

## 6 — Section 02 — Étape 2 : Livraison

### 6.1 — Wireframe complet

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  ① ✓ Informations  ··  ② Livraison  ··  ③ Paiement                   │
│                            ───────                                   │
│                                                                      │
│  Livraison.                                                          │
│                                                                      │
│  Une seule adresse, un seul livreur, et un appel avant de venir.    │
│                                                                      │
│  ┌──────────────────────┐  ┌──────────────────────┐                  │
│  │ Prénom                │  │ Nom                   │                  │
│  │ ┌──────────────────┐ │  │ ┌──────────────────┐ │                  │
│  │ │                   │ │  │ │                   │ │                  │
│  │ └──────────────────┘ │  │ └──────────────────┘ │                  │
│  └──────────────────────┘  └──────────────────────┘                  │
│                                                                      │
│  ┌──────────────────────────────────────────────┐                    │
│  │  Téléphone                                    │                    │
│  │  ┌─────────┐ ┌──────────────────────────┐   │                    │
│  │  │ +212 ▾  │ │  6 12 34 56 78           │   │                    │
│  │  └─────────┘ └──────────────────────────┘   │                    │
│  │  Pour que le livreur puisse vous appeler.   │                    │
│  └──────────────────────────────────────────────┘                    │
│                                                                      │
│  ┌──────────────────────────────────────────────┐                    │
│  │ Adresse                                       │                    │
│  │ ┌────────────────────────────────────────┐  │                    │
│  │ │ Numéro et rue                           │  │                    │
│  │ └────────────────────────────────────────┘  │                    │
│  │ ┌────────────────────────────────────────┐  │                    │
│  │ │ Complément (étage, immeuble) — optionnel│  │                    │
│  │ └────────────────────────────────────────┘  │                    │
│  └──────────────────────────────────────────────┘                    │
│                                                                      │
│  ┌──────────────────────┐  ┌──────────────────────┐                  │
│  │ Quartier (optionnel)  │  │ Ville                 │                  │
│  │ ┌──────────────────┐ │  │ ┌──────────────────┐ │                  │
│  │ │                   │ │  │ │ Casablanca    ▾  │ │                  │
│  │ └──────────────────┘ │  │ └──────────────────┘ │                  │
│  └──────────────────────┘  └──────────────────────┘                  │
│                                                                      │
│  Mode de livraison                                                   │
│  ─                                                                    │
│  ◉ Standard        Livraison en 3 à 5 jours · Gratuit               │
│  ○ Express         Livraison en 24 à 48h · 50 MAD                   │
│                                                                      │
│  ┌──────────────────────────────────────────────┐                    │
│  │  Continuer →                                  │                    │
│  └──────────────────────────────────────────────┘                    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 6.2 — Titre de l'étape

```
Livraison.
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Light                                     |
| Taille          | 28pt (desktop) · 24pt (mobile)                                |
| Couleur         | `#2C2A28` (Encre)                                            |
| Espacement haut | 48px sous la barre de progression                              |

### 6.3 — Phrase explicative

```
Une seule adresse, un seul livreur, et un appel avant de venir.
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Regular Italic                            |
| Taille          | 15pt (desktop) · 14pt (mobile)                                |
| Couleur         | `#4A4844` (Encre claire)                                     |
| Espacement bas  | 32px avant les champs                                          |

> **Pourquoi cette formulation ?** Elle résume **toute la promesse logistique** en une phrase intime : une adresse (pas de saisie répétée), un livreur (pas une chaîne anonyme), un appel avant venue (réalité marocaine, attention au client). Cette **précision narrative** transforme un détail logistique en geste de la maison.

### 6.4 — Champs Prénom + Nom

#### Layout

| Breakpoint | Layout                                    |
| :--------- | :---------------------------------------- |
| Desktop    | Côte à côte (50/50, gap 16px)              |
| Tablet     | Côte à côte (50/50, gap 16px)              |
| Mobile     | Empilés (1 colonne, gap 16px)              |

> **Exception au single column** : en desktop, prénom + nom sont **côte à côte** car ce sont **un même bloc cognitif** (l'identité). Cette exception est documentée par Bachiega 2016.

#### Champ Prénom

| Propriété      | Valeur                                                          |
| :------------- | :-------------------------------------------------------------- |
| Type HTML      | `<input type="text" required autocomplete="given-name" autocapitalize="words">` |
| Label          | « Prénom »                                                       |
| Placeholder    | Aucun                                                            |
| Validation     | Required, min 2 caractères, max 50                                |
| Autocomplete   | `given-name` (Apple/Google contacts)                             |

#### Champ Nom

| Propriété      | Valeur                                                          |
| :------------- | :-------------------------------------------------------------- |
| Type HTML      | `<input type="text" required autocomplete="family-name" autocapitalize="words">` |
| Label          | « Nom »                                                          |
| Placeholder    | Aucun                                                            |
| Validation     | Required, min 2 caractères, max 50                                |
| Autocomplete   | `family-name`                                                    |

> **Pas de placeholder** sur ces champs : le label suffit, et un placeholder « Salma » ou « El Idrissi » serait **trop personnalisé** ou **biaisant culturellement**.

### 6.5 — Champ Téléphone

#### Composition

```
┌─────────┐ ┌──────────────────────────┐
│ +212 ▾  │ │  6 12 34 56 78           │
└─────────┘ └──────────────────────────┘
Pour que le livreur puisse vous appeler.
```

#### Spécifications du sélecteur d'indicatif

| Propriété      | Valeur                                                          |
| :------------- | :-------------------------------------------------------------- |
| Largeur        | 96px                                                             |
| Hauteur        | 48px                                                             |
| Style          | Identique à un input, avec chevron `▾` à droite                  |
| Valeur par défaut | `+212` (Maroc)                                                |
| Options        | +212 (Maroc), +33 (France), +1 (USA/Canada), +49 (Allemagne), +44 (UK), +971 (UAE), +213 (Algérie), +216 (Tunisie) |

> **Pourquoi limiter à ~8 indicatifs ?** Parce que la clientèle de FemiGlow est principalement marocaine + diaspora (France, Belgique, Émirats, États-Unis, Canada) + quelques voisins maghrébins. Un dropdown international complet serait un **bruit cognitif inutile**.

#### Spécifications du champ numéro

| Propriété      | Valeur                                                          |
| :------------- | :-------------------------------------------------------------- |
| Type HTML      | `<input type="tel" required autocomplete="tel-national" inputmode="numeric">` |
| Largeur        | Reste de l'espace                                                |
| Validation     | Maroc : 9 chiffres après le +212 (commence par 6 ou 7 — mobile)  |
| Format affichage| Auto-format : `6 12 34 56 78` au cours de la saisie              |
| Min            | Mobile virtual keyboard numérique (`inputmode="numeric"`)        |

#### Texte d'aide

```
Pour que le livreur puisse vous appeler.
```

| Propriété      | Valeur                                                          |
| :------------- | :-------------------------------------------------------------- |
| Police         | Cormorant Garamond Regular Italic                                |
| Taille         | 12pt                                                             |
| Couleur        | `#6B6863` (Brume)                                                |
| Espacement haut| 6px sous le champ                                                |

> **Justification visible** : le téléphone n'est pas demandé pour faire du marketing ; c'est un **outil logistique** explicitement justifié.

### 6.6 — Bloc Adresse

#### Composition

```
┌──────────────────────────────────────────────┐
│ Adresse                                       │
│ ┌────────────────────────────────────────┐  │
│ │ Numéro et rue                           │  │
│ └────────────────────────────────────────┘  │
│ ┌────────────────────────────────────────┐  │
│ │ Complément (étage, immeuble) — optionnel│  │
│ └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

#### Champ Numéro et rue

| Propriété      | Valeur                                                          |
| :------------- | :-------------------------------------------------------------- |
| Type HTML      | `<input type="text" required autocomplete="address-line1">`    |
| Label          | « Numéro et rue »                                                |
| Placeholder    | Aucun                                                            |
| Validation     | Required, min 5 caractères, max 100                               |
| Autocomplete   | `address-line1`                                                  |

#### Champ Complément

| Propriété      | Valeur                                                          |
| :------------- | :-------------------------------------------------------------- |
| Type HTML      | `<input type="text" autocomplete="address-line2">`              |
| Label          | « Complément (étage, immeuble) — optionnel »                     |
| Placeholder    | Aucun                                                            |
| Validation     | Optionnel, max 100                                                |
| Autocomplete   | `address-line2`                                                  |

> **Le mot « optionnel » dans le label** : signal explicite que la cliente peut sauter ce champ. Sans cette mention, certaines clientes se figent (« Dois-je remplir ? »). La transparence supprime la friction.

### 6.7 — Champs Quartier + Ville

#### Layout

| Breakpoint | Layout                                    |
| :--------- | :---------------------------------------- |
| Desktop    | Côte à côte (40/60, gap 16px)              |
| Tablet     | Côte à côte (40/60, gap 16px)              |
| Mobile     | Empilés (1 colonne, gap 16px)              |

#### Champ Quartier (texte libre, optionnel)

| Propriété      | Valeur                                                          |
| :------------- | :-------------------------------------------------------------- |
| Type HTML      | `<input type="text" autocomplete="address-level3">`             |
| Label          | « Quartier (optionnel) »                                         |
| Placeholder    | Aucun                                                            |
| Validation     | Optionnel, max 100                                                |
| Justification  | Au Maroc, le quartier est souvent crucial pour la livraison (ex : Maârif vs Sidi Belyout dans Casablanca) |

#### Champ Ville (select dropdown)

| Propriété      | Valeur                                                          |
| :------------- | :-------------------------------------------------------------- |
| Type HTML      | `<select required autocomplete="address-level2">`               |
| Label          | « Ville »                                                        |
| Valeur par défaut | « Sélectionnez une ville »                                    |
| Options        | Liste des villes marocaines principales (voir 6.8)               |
| Validation     | Required, doit être une option valide                            |

#### Liste des villes marocaines — V1

```
Ville (select)
─
Casablanca
Rabat
Salé
Marrakech
Tanger
Agadir
Fès
Meknès
Tétouan
Oujda
Kenitra
Mohammedia
Témara
El Jadida
Essaouira
Nador
Settat
Khouribga
Béni Mellal
Berkane
Larache
Khémisset
Taza
Safi
Ouarzazate
Ifrane
Asilah
Chefchaouen
Errachidia
Laâyoune
Dakhla
Autre — préciser dans l'adresse
```

> **Pourquoi un select et pas un input libre ?** Parce que le **calcul des frais de livraison** dépend de la ville. Un select garantit la **cohérence des données**.

> **L'option « Autre »** : pour les clientes en zone rurale ou en ville secondaire. Frais de livraison : 50 MAD par défaut, livraison 5-7 jours.

### 6.8 — Tokens design (champs livraison)

```css
/* ─── Étape 2 : Livraison — tokens spécifiques ─── */

/* Layout 2 colonnes */
--two-col-gap: 16px;

/* Sélecteur indicatif */
--phone-prefix-width: 96px;
--phone-prefix-bg: #FFFFFF;
--phone-prefix-border: 1px solid #E8E0D2;

/* Champ téléphone */
--phone-input-letter-spacing: 0.5px;

/* Texte d'aide sous champ */
--field-help-font: 'Cormorant Garamond', serif;
--field-help-style: italic;
--field-help-size: 12pt;
--field-help-color: #6B6863;
--field-help-margin-top: 6px;

/* Select dropdown */
--select-bg: #FFFFFF;
--select-border: 1px solid #E8E0D2;
--select-border-focus: 1px solid #A8C4A6;
--select-padding: 14px 40px 14px 16px; /* padding-right pour la flèche */
--select-height: 48px;
--select-arrow-size: 12px;
--select-arrow-color: #4A4844;
```

### 6.9 — Mode de livraison

#### Composition

```
Mode de livraison
─

◉ Standard        Livraison en 3 à 5 jours · Gratuit
○ Express         Livraison en 24 à 48h · 50 MAD
```

#### Spécifications

| Propriété         | Valeur                                                          |
| :---------------- | :-------------------------------------------------------------- |
| Surtitre          | Inter Medium 11pt, couleur Encre, uppercase tracking 1.5px      |
| Filet sous titre  | 32px de large, 1px sauge dark                                    |
| Espacement avant chaque option | 16px                                                |

#### Chaque option (radio button)

| Propriété          | Valeur                                                          |
| :----------------- | :-------------------------------------------------------------- |
| Type HTML          | `<input type="radio" name="shipping" required>`                 |
| Bouton radio       | 18×18px, border 1.5px sauge dark, fond crème pure                |
| Sélectionné        | Centre rempli sauge dark, anneau extérieur sauge dark            |
| Padding container  | 16px (toute la zone est cliquable)                                |
| Background hover   | `#F5F0E5` (Crème légèrement teintée) sur hover de la zone        |
| Background actif   | `#F0EAD8` (Crème teintée plus marquée) sur option sélectionnée   |
| Border-radius container | 0                                                            |
| Espacement entre options | 8px                                                          |

#### Texte de chaque option

```
Standard        Livraison en 3 à 5 jours · Gratuit
```

| Élément              | Spécifications                                                |
| :------------------- | :------------------------------------------------------------ |
| Nom du mode          | Inter Medium 14pt, couleur Encre — espacé de 16px du radio    |
| Description          | Cormorant Italic 13pt, couleur Encre claire                  |
| Layout               | Grid : nom à gauche, description à droite (desktop) · empilés (mobile) |

### 6.10 — Logique des frais de livraison (Maroc)

#### Tableau des frais

| Ville                        | Standard (3-5j)    | Express (24-48h)   |
| :--------------------------- | :----------------- | :----------------- |
| Casablanca                   | **Gratuit**         | 50 MAD             |
| Rabat, Salé, Mohammedia      | **Gratuit**         | 60 MAD             |
| Marrakech, Tanger, Agadir, Fès | 30 MAD            | 80 MAD             |
| Autres villes principales    | 30 MAD              | 80 MAD             |
| Villes secondaires (Autre)   | 50 MAD              | Non disponible     |

> **Pourquoi gratuit Casablanca ?** Parce que :
> 1. Casablanca = ~40-50% des commandes (population + pouvoir d'achat)
> 2. Coût logistique très bas (l'atelier y est)
> 3. Levier psychologique fort : « gratuit » est un mot magique (Ariely 2008)
> 4. Différenciation locale vs concurrence

#### Affichage des frais

Les frais s'affichent **dynamiquement** :

- À chaque changement de la ville sélectionnée → recalcul instantané
- À chaque changement du mode de livraison → recalcul instantané
- Le récap à droite (desktop) ou en haut (mobile) **reflète immédiatement** les frais

```javascript
// Logique de calcul
function getShippingCost(city, mode) {
  const rates = {
    casablanca: { standard: 0, express: 50 },
    rabat: { standard: 0, express: 60 },
    sale: { standard: 0, express: 60 },
    mohammedia: { standard: 0, express: 60 },
    marrakech: { standard: 30, express: 80 },
    tanger: { standard: 30, express: 80 },
    agadir: { standard: 30, express: 80 },
    fes: { standard: 30, express: 80 },
    // ...autres villes principales
    autre: { standard: 50, express: null }, // express non disponible
  };

  return rates[city.toLowerCase()]?.[mode] ?? 30;
}
```

### 6.11 — État de la disponibilité Express

Si la ville sélectionnée n'a **pas** d'option Express disponible :

- L'option Express apparaît **grisée** (couleur `#A8A8A6`)
- Texte modifié : `Express        Non disponible pour cette zone`
- Radio button désactivé (`disabled`)
- Description en dessous : `Disponible bientôt — restez avec nous.`

### 6.12 — Bouton « Continuer » (étape 2 → 3)

Identique au bouton de l'étape 1, sauf :
- Validation : tous les champs requis valides + ville sélectionnée + mode de livraison choisi
- Action : transition vers étape 3 (paiement)

### 6.13 — Comportements UX critiques

#### Auto-format du téléphone marocain

```javascript
function formatMoroccanPhone(value) {
  // Nettoie tout sauf chiffres
  const digits = value.replace(/\D/g, '');

  // Format : 6 12 34 56 78 ou 7 12 34 56 78
  if (digits.length <= 1) return digits;
  if (digits.length <= 3) return `${digits.slice(0, 1)} ${digits.slice(1)}`;
  if (digits.length <= 5) return `${digits.slice(0, 1)} ${digits.slice(1, 3)} ${digits.slice(3)}`;
  if (digits.length <= 7) return `${digits.slice(0, 1)} ${digits.slice(1, 3)} ${digits.slice(3, 5)} ${digits.slice(5)}`;
  return `${digits.slice(0, 1)} ${digits.slice(1, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`;
}
```

#### Validation téléphone Maroc

```javascript
function isValidMoroccanPhone(value) {
  const digits = value.replace(/\D/g, '');
  // Mobile marocain : 9 chiffres, commence par 6 ou 7
  return /^[67]\d{8}$/.test(digits);
}
```

#### Auto-fill via navigateur

Tous les champs ont des `autocomplete` HTML standards pour bénéficier de l'autofill du navigateur (Chrome, Safari, Firefox) :

| Champ          | Autocomplete            |
| :------------- | :---------------------- |
| Prénom         | `given-name`            |
| Nom            | `family-name`           |
| Téléphone      | `tel-national`          |
| Adresse        | `address-line1`         |
| Complément     | `address-line2`         |
| Quartier       | `address-level3`        |
| Ville          | `address-level2`        |

> **Test critique** : sur Chrome iOS et Safari iOS, vérifier que l'autofill remplit **correctement** les champs. C'est un gain de conversion énorme (-30% de temps de remplissage en mobile).

### 6.14 — Tokens design (modes de livraison)

```css
/* ─── Mode de livraison — tokens ─── */
--shipping-section-margin-top: 32px;

--shipping-title-font: 'Inter', sans-serif;
--shipping-title-weight: 500;
--shipping-title-size: 11pt;
--shipping-title-tracking: 1.5px;
--shipping-title-color: #2C2A28;

--shipping-divider-width: 32px;
--shipping-divider-color: #A8C4A6;
--shipping-divider-margin: 8px 0 24px;

--shipping-option-padding: 16px;
--shipping-option-gap: 8px;
--shipping-option-hover-bg: #F5F0E5;
--shipping-option-active-bg: #F0EAD8;

--shipping-option-name-font: 'Inter', sans-serif;
--shipping-option-name-weight: 500;
--shipping-option-name-size: 14pt;
--shipping-option-name-color: #2C2A28;

--shipping-option-desc-font: 'Cormorant Garamond', serif;
--shipping-option-desc-style: italic;
--shipping-option-desc-size: 13pt;
--shipping-option-desc-color: #4A4844;

--shipping-option-disabled-color: #A8A8A6;

/* Radio button */
--radio-size: 18px;
--radio-border: 1.5px solid #A8C4A6;
--radio-checked-bg: #FFFFFF;
--radio-checked-inner-bg: #A8C4A6;
--radio-checked-inner-size: 8px;
```

### 6.15 — Psychologie

#### 1. Justification des champs (Sugarman 1995)

Chaque champ qui pourrait sembler invasif est **justifié** :
- Téléphone : « Pour que le livreur puisse vous appeler. »
- (L'email a été justifié à l'étape 1 : « pour la confirmation et le suivi »)

#### 2. Optionnel marqué (transparence)

Champs « Complément (étage) » et « Quartier (optionnel) » : la mention **« optionnel »** est explicite. Évite la friction de l'incertitude.

#### 3. Décor géographique

> **Heuristique de la disponibilité** (Tversky & Kahneman) : la liste des villes marocaines (Casablanca → Dakhla) couvre **toute la géographie** du pays. La cliente reconnaît visuellement « ma ville est dedans » → sentiment d'inclusion.

#### 4. Gratuit Casablanca = ancrage psychologique (Ariely 2008)

> *« The price of FREE is irrationally attractive. »*

Quand la cliente sélectionne Casablanca et voit « Gratuit », elle ressent un **sentiment de gain** (vs « 30 MAD »). Ce sentiment **réduit l'abandon de panier de 5-8%**.

#### 5. Express en option, pas en push

L'option Standard (gratuit) est **par défaut**. Express est une **option** sans pression. Pas de bannière « Choisissez Express pour une livraison plus rapide ! ».

### 6.16 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| Champ « Code postal »                               | Inutile au Maroc (pas standardisé)                                  |
| Champ « État/Province »                             | Inutile au Maroc                                                    |
| Carte Google Maps embedded pour saisir l'adresse    | Surcharge — la saisie classique suffit en V1                        |
| Champ « Date de naissance »                         | Friction inutile, pas de pertinence pour la livraison                |
| Champ « Genre »                                     | Politiquement et logistiquement inutile                              |
| Pré-cocher Express par défaut                       | Surfacturation perçue                                                |
| Cacher les frais (« calculés à l'étape suivante ») | Détruit la confiance                                                |
| Bannière promo « Frais offerts dès 800 MAD »         | Manipulation — la maison ne fonctionne pas par paniers gonflés       |
| Indication « Livré en X jours selon votre adresse »  | Vague — préférer une fourchette claire (3-5j vs 24-48h)             |
| Liste des villes en ordre alphabétique pure          | Casablanca (40% des commandes) doit être en premier ou pré-sélectionnée |

---

## 7 — Section 03 — Étape 3 : Paiement

### 7.1 — Wireframe complet

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  ① ✓ Informations  ··  ② ✓ Livraison  ··  ③ Paiement                 │
│                                              ───────                 │
│                                                                      │
│  Paiement.                                                           │
│                                                                      │
│  Vos données bancaires ne sont jamais stockées chez nous.            │
│                                                                      │
│  Méthode de paiement                                                 │
│  ─                                                                    │
│  ◉ Carte bancaire                       [Visa] [MC] [CMI]            │
│  ○ Paiement à la livraison              + 20 MAD                     │
│                                                                      │
│  ┌──────────────────────────────────────────────┐                    │
│  │ Numéro de carte                               │                    │
│  │ ┌────────────────────────────────────────┐  │                    │
│  │ │ 1234 5678 9012 3456                     │  │                    │
│  │ └────────────────────────────────────────┘  │                    │
│  └──────────────────────────────────────────────┘                    │
│                                                                      │
│  ┌──────────────────────┐  ┌──────────────────────┐                  │
│  │ Expiration            │  │ CVV                   │                  │
│  │ ┌──────────────────┐ │  │ ┌─────────────┐  ⓘ  │                  │
│  │ │ MM / AA           │ │  │ │ 123          │     │                  │
│  │ └──────────────────┘ │  │ └─────────────┘     │                  │
│  └──────────────────────┘  └──────────────────────┘                  │
│                                                                      │
│  ┌──────────────────────────────────────────────┐                    │
│  │ Titulaire de la carte                         │                    │
│  │ ┌────────────────────────────────────────┐  │                    │
│  │ │ SALMA EL IDRISSI                        │  │                    │
│  │ └────────────────────────────────────────┘  │                    │
│  └──────────────────────────────────────────────┘                    │
│                                                                      │
│  ☐ Mémoriser cette carte pour mes prochaines commandes               │
│                                                                      │
│                                                                      │
│  ┌──────────────────────────────────────────────┐                    │
│  │  Confirmer la commande · 540 MAD              │                    │
│  └──────────────────────────────────────────────┘                    │
│                                                                      │
│  🔒 Paiement sécurisé via CMI · Vos données sont chiffrées            │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 7.2 — Titre de l'étape

```
Paiement.
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Light                                     |
| Taille          | 28pt (desktop) · 24pt (mobile)                                |
| Couleur         | `#2C2A28` (Encre)                                            |
| Espacement haut | 48px sous la barre de progression                              |

### 7.3 — Phrase explicative

```
Vos données bancaires ne sont jamais stockées chez nous.
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Regular Italic                            |
| Taille          | 15pt (desktop) · 14pt (mobile)                                |
| Couleur         | `#4A4844` (Encre claire)                                     |
| Espacement bas  | 32px avant les méthodes                                        |

> **Pourquoi cette phrase ?** Trust signal majeur. À l'étape paiement, la cliente est **sensible à la sécurité**. Énoncer **clairement** que les données ne sont pas stockées **chez la maison** rassure absolument.

### 7.4 — Sélecteur de méthode de paiement

#### Composition

```
Méthode de paiement
─

◉ Carte bancaire                       [Visa] [MC] [CMI]
○ Paiement à la livraison              + 20 MAD
```

#### Spécifications du surtitre

| Propriété      | Valeur                                              |
| :------------- | :-------------------------------------------------- |
| Police         | Inter Medium 11pt                                   |
| Letter-spacing | 1.5px                                               |
| Couleur        | `#2C2A28` (Encre)                                   |
| Transformation | uppercase                                            |

#### Filet sous le titre

| Propriété      | Valeur                                |
| :------------- | :------------------------------------ |
| Largeur        | 32px                                  |
| Hauteur        | 1px                                   |
| Couleur        | `#A8C4A6` (Sauge dark)                |
| Espacement     | 8px haut, 24px bas                    |

#### Options de paiement (radio)

| Propriété          | Valeur                                                          |
| :----------------- | :-------------------------------------------------------------- |
| Spécifications visuelles | Identiques aux radio modes de livraison (étape 2)         |
| Padding container  | 16px                                                              |
| Background hover   | `#F5F0E5`                                                         |
| Background actif   | `#F0EAD8`                                                         |
| Layout             | Nom à gauche, info/logos à droite                                  |

#### Option 1 — Carte bancaire

```
◉ Carte bancaire                       [Visa] [MC] [CMI]
```

| Élément              | Spécifications                                                |
| :------------------- | :------------------------------------------------------------ |
| Label                | « Carte bancaire » Inter Medium 14pt                          |
| Logos                | Visa, Mastercard, CMI — SVG monochromes couleur encre, 24×16px chacun, gap 8px |
| Logos container      | À droite, alignés avec le label                                |

> **Pourquoi des logos monochromes ?** Parce que les logos colorés (Visa bleu, Mastercard rouge/jaune) **détruisent la palette signature**. Les logos monochromes maintiennent la cohérence éditoriale tout en remplissant la fonction de trust signal.

#### Option 2 — Paiement à la livraison

```
○ Paiement à la livraison              + 20 MAD
```

| Élément              | Spécifications                                                |
| :------------------- | :------------------------------------------------------------ |
| Label                | « Paiement à la livraison » Inter Medium 14pt                 |
| Surcoût              | « + 20 MAD » Cormorant Italic 13pt couleur Encre claire        |

> **Pourquoi 20 MAD de surcoût pour cash on delivery ?** Parce que :
> 1. Couvre les frais de gestion espèces (le livreur doit retourner avec les fonds)
> 2. Léger incentive à la carte (qui est plus rapide pour la maison)
> 3. Reste raisonnable (~3-4% de la commande, vs 5-8% souvent pratiqué)

### 7.5 — Formulaire Carte bancaire (si option sélectionnée)

#### Animation au sélection

Quand la cliente sélectionne « Carte bancaire » → animation **slide-down 320ms** des champs carte.

Si elle bascule sur « Paiement à la livraison » → animation **slide-up 320ms** (les champs se replient) + apparition du bloc spécifique COD (voir partie 7).

#### Champ Numéro de carte

| Propriété          | Valeur                                                          |
| :----------------- | :-------------------------------------------------------------- |
| Type HTML          | `<input type="text" autocomplete="cc-number" inputmode="numeric" maxlength="19">` |
| Label              | « Numéro de carte »                                              |
| Placeholder        | Aucun                                                            |
| Format affichage   | Auto-format : `1234 5678 9012 3456` (groupes de 4)                |
| Validation         | Algorithme de Luhn côté client + side serveur                    |
| Détection type carte | Visa (commence par 4), Mastercard (5), Amex (3), CMI cards     |
| Logo détecté       | Apparaît à droite du champ une fois le type détecté (12-16px)    |

#### Champs Expiration + CVV

##### Layout

| Breakpoint | Layout                                    |
| :--------- | :---------------------------------------- |
| Desktop    | Côte à côte (50/50, gap 16px)              |
| Tablet     | Côte à côte (50/50, gap 16px)              |
| Mobile     | Côte à côte (50/50, gap 16px) — exception au single column |

> **Exception au single column** : Expiration et CVV sont **un même bloc cognitif** (les détails secondaires de la carte). Sur mobile, leur juxtaposition est conservée car les champs sont courts.

##### Champ Expiration

| Propriété          | Valeur                                                          |
| :----------------- | :-------------------------------------------------------------- |
| Type HTML          | `<input type="text" autocomplete="cc-exp" inputmode="numeric" maxlength="7">` |
| Label              | « Expiration »                                                   |
| Placeholder        | `MM / AA`                                                        |
| Format affichage   | Auto-format : `MM / AA` (slash auto)                              |
| Validation         | Mois 01-12, année ≥ année courante                                |

##### Champ CVV

| Propriété          | Valeur                                                          |
| :----------------- | :-------------------------------------------------------------- |
| Type HTML          | `<input type="text" autocomplete="cc-csc" inputmode="numeric" maxlength="4">` |
| Label              | « CVV »                                                           |
| Placeholder        | `123`                                                            |
| Validation         | 3 chiffres (Visa/MC) ou 4 chiffres (Amex)                         |
| Icône d'aide ⓘ     | À droite du label, tooltip au hover : « Les 3 derniers chiffres au dos de votre carte. » |

#### Champ Titulaire de la carte

| Propriété          | Valeur                                                          |
| :----------------- | :-------------------------------------------------------------- |
| Type HTML          | `<input type="text" autocomplete="cc-name" autocapitalize="characters">` |
| Label              | « Titulaire de la carte »                                        |
| Placeholder        | Aucun                                                            |
| Style affichage    | Texte saisi auto-converti en uppercase                            |
| Validation         | Min 3 caractères, lettres + espaces uniquement                    |

> **Pourquoi auto-uppercase ?** Cohérence avec l'embossage des cartes bancaires (qui est toujours en majuscules). La cliente reconnaît visuellement le style « comme sur ma carte ».

### 7.6 — Option « Mémoriser cette carte »

```
☐ Mémoriser cette carte pour mes prochaines commandes
```

| Propriété          | Valeur                                                          |
| :----------------- | :-------------------------------------------------------------- |
| **Visible si ?**   | **Uniquement si la cliente a coché « Créer un compte » à l'étape 1** |
| Pré-cochée ?       | Non (RGPD strict)                                                 |
| Spécifications     | Identiques aux opt-ins de l'étape 1                              |
| Espacement haut    | 24px sous le champ titulaire                                      |

> **Logique critique** : la mémorisation de la carte n'a de sens que si la cliente a un **compte** où mémoriser. Sans compte (guest checkout), cette option **n'apparaît pas**.

> **Données mémorisées** : pas le numéro complet ni le CVV (jamais stocké), mais un **token Stripe / CMI** + 4 derniers chiffres + nom titulaire + expiration. Conforme PCI-DSS.

### 7.7 — Intégration CMI (Maroc)

#### Pourquoi CMI ?

> **CMI** (Centre Monétique Interbancaire) est l'**organisme central** de gestion des paiements bancaires au Maroc. Toute marque vendant aux clients marocains avec cartes locales **doit** passer par CMI.

#### Cartes acceptées via CMI

| Type carte                | Acceptée via CMI ?                    |
| :------------------------ | :------------------------------------ |
| Visa internationale        | Oui                                   |
| Mastercard internationale  | Oui                                   |
| Visa marocaine            | Oui                                   |
| Mastercard marocaine      | Oui                                   |
| CMI propriétaire          | Oui                                   |
| Amex                      | Oui (avec compte Amex CMI activé)     |
| Cards bancaires marocaines | Oui (Crédit du Maroc, BMCE, BMCI, AWB, etc.) |

#### Architecture technique

```
┌────────────────┐         ┌────────────────┐         ┌────────────────┐
│  Frontend      │  HTTPS  │  Backend       │  HTTPS  │  CMI Gateway   │
│  /commander    │ ──────► │  Maison Server │ ──────► │  3D Secure     │
│  (formulaire)  │         │  (validation,  │         │  (auth banque) │
│                │ ◄────── │   création     │ ◄────── │                │
└────────────────┘  redir  │   transaction) │  redir  └────────────────┘
                           └────────────────┘
                                  │
                                  ▼
                           ┌────────────────┐
                           │  Database      │
                           │  (commande,    │
                           │   token, etc.) │
                           └────────────────┘
```

#### 3D Secure obligatoire

CMI impose le **3D Secure 2.0** pour toutes les transactions cartes au Maroc. Cela signifie :
- Au clic « Confirmer la commande » → redirection vers la page 3D Secure de la banque émettrice
- La cliente reçoit un OTP (SMS) ou pousse une notification dans l'app banque
- Validation → retour sur le site → page `/merci`
- Échec → retour sur le site → message d'erreur + retry

> **Implication UX** : la fenêtre 3D Secure est **hors du contrôle de la maison** (banque). Le design de cette page est **basique et hétérogène**. La maison doit communiquer clairement : « Vous allez être redirigée vers votre banque pour valider le paiement. »

### 7.8 — Tokens design (paiement)

```css
/* ─── Étape 3 : Paiement — tokens ─── */

/* Méthodes de paiement */
--payment-methods-margin-bottom: 32px;
--payment-method-padding: 16px;
--payment-method-hover-bg: #F5F0E5;
--payment-method-active-bg: #F0EAD8;

/* Logos cartes */
--card-logo-height: 16px;
--card-logo-color: #2C2A28;
--card-logos-gap: 8px;

/* Champ numéro carte */
--card-number-letter-spacing: 1px;
--card-number-font-feature: 'tnum'; /* Tabular numbers pour alignement */

/* Champ titulaire */
--cardholder-letter-spacing: 0.5px;
--cardholder-text-transform: uppercase;

/* Bouton « Confirmer la commande » */
--confirm-cta-bg: #2C2A28;
--confirm-cta-text: #FBF8F1;
--confirm-cta-padding: 18px 32px;
--confirm-cta-height: 60px; /* Plus haut que les boutons d'étape */
--confirm-cta-font-size: 16pt;
--confirm-cta-font-weight: 500;

/* Mention sécurité finale */
--secure-final-color: #6B6863;
--secure-final-size: 11pt;
--secure-final-margin-top: 16px;
```

### 7.9 — Bouton « Confirmer la commande »

#### Différence avec les boutons d'étape précédents

Le bouton final est **plus grand** et **plus engageant** :

| Propriété           | Valeur                                                          |
| :------------------ | :-------------------------------------------------------------- |
| Hauteur             | 60px (vs 56px sur étapes 1-2)                                   |
| Padding             | 18px 32px (vs 16px 32px)                                         |
| Taille texte        | 16pt (vs 15pt)                                                   |
| Texte               | « Confirmer la commande · 540 MAD »                              |
| Texte inclut prix    | OUI — le total est dans le bouton (ancrage final + transparence) |

#### Format du texte du bouton

```
Confirmer la commande · 540 MAD
```

| Élément              | Spécifications                                                |
| :------------------- | :------------------------------------------------------------ |
| Verbe                | « Confirmer » + « la commande » Inter Medium 16pt              |
| Séparateur `·`       | Middle dot, espacement 12px                                    |
| Prix total            | Inter Medium 16pt, **non gras**                                |
| Couleur              | Crème pure (toute la ligne)                                    |

> **Pourquoi le prix dans le bouton ?** Triple effet :
> 1. **Transparence** — la cliente voit ce qu'elle paie au moment de cliquer
> 2. **Ancrage final** — confirme le montant juste avant l'engagement
> 3. **Anti-erreur** — si le prix change (frais ajoutés à l'étape 2), la cliente le voit avant de payer

### 7.10 — Mention sécurité finale (sous le bouton)

```
🔒 Paiement sécurisé via CMI · Vos données sont chiffrées
```

| Propriété          | Valeur                                                          |
| :----------------- | :-------------------------------------------------------------- |
| Police             | Inter Regular 11pt                                                |
| Couleur            | `#6B6863` (Brume)                                                 |
| Icône cadenas      | SVG inline, taille 12×12px, couleur Brume                        |
| Position           | Centré sous le bouton, espacement 16px                            |
| Visibilité         | Toujours visible                                                  |

### 7.11 — Formulaire Paiement à la livraison (si option sélectionnée)

#### Animation au sélection

Quand la cliente sélectionne « Paiement à la livraison » → animation **slide-down 320ms** d'un bloc explicatif (pas de champs supplémentaires à remplir, mais un bloc d'info).

#### Composition

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  Comment ça fonctionne ?                                              │
│  ─                                                                    │
│                                                                      │
│  Le livreur vous appellera pour confirmer le rendez-vous.            │
│  À la livraison, vous payez le montant en espèces ou                 │
│  par carte sans contact (selon disponibilité du livreur).            │
│                                                                      │
│  Frais supplémentaires : 20 MAD                                       │
│  Pour couvrir les frais de gestion espèces.                           │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

| Élément              | Spécifications                                                |
| :------------------- | :------------------------------------------------------------ |
| Container            | Padding 24px, fond `#F5F0E5` (Crème teintée légère)            |
| Border               | Aucun                                                          |
| Border-radius        | 0                                                              |
| Titre « Comment ça fonctionne ? » | Inter Medium 13pt, couleur Encre, uppercase tracking 1.5px |
| Filet                | 32px de large, 1px sauge dark, espacement 8px haut + 16px bas  |
| Texte explicatif     | Cormorant Garamond Regular 14pt, couleur Encre claire, line-height 1.6 |
| Frais soulignés      | Inter Medium 13pt + Cormorant Italic 13pt couleur Brume        |

> **Pourquoi un bloc dédié pour COD ?** Parce que le paiement à la livraison est moins **standard** que la carte. La cliente a besoin de comprendre **comment ça se passe** pour s'engager sereinement.

### 7.12 — Bouton « Confirmer la commande » (cas COD)

Le bouton est identique au cas carte bancaire, **avec le même montant total** (incluant les 20 MAD de frais COD) :

```
Confirmer la commande · 560 MAD
```

> Le montant **inclut tous les frais** (kit + livraison + COD si applicable). Aucune surprise.

### 7.13 — Comportements UX critiques (étape 3)

#### Validation à la soumission carte bancaire

Avant l'envoi vers CMI :
1. Numéro de carte : algorithme de Luhn valide ✓
2. Expiration : date future ✓
3. CVV : 3-4 chiffres ✓
4. Titulaire : min 3 caractères ✓
5. Si tout OK → envoi vers CMI gateway

#### Désactivation du bouton pendant traitement

Au clic « Confirmer la commande » :
- Le bouton se désactive instantanément (évite les double-clics)
- Spinner mini sur le bouton (« Traitement en cours... »)
- Le formulaire **complet** est verrouillé (impossible de modifier les champs pendant le traitement)
- Si erreur : déverrouillage du formulaire + message d'erreur

#### Anti-fraude — fingerprinting léger

Stripe (ou CMI) génère un fingerprint du device et de la session. Si pattern suspect :
- Vérification 3D Secure forcée même si la banque ne l'exigeait pas
- Optionnel : challenge supplémentaire (vérification SMS via téléphone fourni)

> **Important** : ne pas afficher à la cliente qu'elle est suspectée. La vérification est **silencieuse** et **transparente**.

### 7.14 — États du paiement (post-soumission)

Voir section 17 pour le détail des microcopy. Vue d'ensemble :

| État                          | Action                                                       |
| :---------------------------- | :----------------------------------------------------------- |
| **Soumission en cours**       | Bouton désactivé + spinner                                    |
| **Redirection 3D Secure**     | Page de chargement intermédiaire (section 10)                |
| **Succès**                    | Redirection `/merci?order=FG-2026-XXXXX`                     |
| **Échec carte refusée**       | Message d'erreur + bouton réactivable                         |
| **Échec timeout réseau**      | Message d'erreur + auto-retry possible                        |
| **Échec 3D Secure**           | Message d'erreur + bouton réactivable                         |
| **COD soumission**            | Pas de 3D Secure — succès direct → `/merci`                  |

### 7.15 — Psychologie

#### 1. Trust signals multiples

À l'étape 3, **trois trust signals** convergent :
- Phrase « Vos données bancaires ne sont jamais stockées chez nous »
- Logos Visa/MC/CMI (familiarité)
- Mention finale « 🔒 Paiement sécurisé via CMI »

> **Cumulés**, ces signaux **réduisent l'abandon de paiement de 8-15%** par rapport à un checkout sans trust signals.

#### 2. Default bias (Thaler & Sunstein)

> *« People tend to stick with the default option. »*

Carte bancaire est l'option **par défaut** (pré-sélectionnée). C'est le mode plus rapide pour la maison (paiement immédiat, pas de gestion espèces). La cliente qui ne fait pas de choix actif **prend la carte**.

#### 3. Surcoût COD = nudge subtil vers la carte

Les 20 MAD de surcoût COD ne sont **pas** une punition (ils sont justifiés par les frais réels). Mais ils créent un **léger nudge** vers la carte sans agressivité.

#### 4. Pas de bouton « Mémoriser carte » en guest

Cohérent avec le principe RGPD : pas de stockage de données carte sans compte explicite. Cette discipline **construit la confiance** au-delà du checkout.

#### 5. Total dans le bouton (ancrage final)

> **Tversky & Kahneman** : *« People decide based on the most recent salient information. »*

Voir « 540 MAD » dans le bouton **juste avant** de cliquer → la cliente confirme avec **conscience claire** du montant. Pas de surprise post-clic.

### 7.16 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| Logos cartes en couleur                              | Casse la palette signature                                          |
| Champ « Adresse de facturation » différente          | Rare au Maroc — par défaut = adresse de livraison, ne pas demander en V1 |
| Surcoût COD > 5% (~25 MAD sur 500)                  | Punition perçue, augmente l'abandon                                  |
| Pré-cocher COD                                      | Détruit la stratégie carte par défaut                                |
| Mention « 100% sécurisé »                           | Cliché commercial — préférer « chiffré » + nom CMI                  |
| Pas de 3D Secure                                    | Illégal au Maroc                                                     |
| Bouton « Confirmer » sans le total                  | Manque de transparence finale                                        |
| Pop-up de confirmation après clic                    | Friction inutile — le bouton est déjà la confirmation               |
| Champs auto-fillés rouges (browser native styling)   | Casser le browser autofill style avec CSS personnalisé pour préserver le design |
| Demander le code postal pour vérifier la carte       | Pas appliqué au Maroc                                                |
| Captcha visible avant paiement                       | Friction destructrice — utiliser reCAPTCHA invisible                |

---

## 8 — Section 04 — Récap commande (desktop sidebar)

### 8.1 — Wireframe

```
┌────────────────────────────────────────┐
│  Votre commande                         │
│                                         │
│  ┌──────┐                               │
│  │      │  Kit Rituel d'Éclat           │
│  │ [📦] │  Quantité : 1                  │
│  │      │                                │
│  └──────┘  500 MAD            [Modifier]│
│                                         │
│  ─────                                   │
│                                         │
│  Sous-total                  500 MAD    │
│  Livraison                   Gratuit     │
│  ─                                       │
│  Total                       500 MAD    │
│                                         │
│  ─────                                   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  Avez-vous un code promo ?  ▾   │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ─────                                   │
│                                         │
│  🔒 Commande sécurisée                   │
│  Livraison sous 3-5 jours                │
│                                         │
└────────────────────────────────────────┘
```

### 8.2 — Position et comportement

| Propriété              | Valeur                                                          |
| :--------------------- | :-------------------------------------------------------------- |
| Position               | Sticky à droite du formulaire, top 96px (sous le header + barre progression) |
| Largeur                | 360px fixe (40% de la grille checkout)                            |
| Padding                | 32px                                                              |
| Background             | `#F5F0E5` (Crème teintée légère) — différencie du fond formulaire |
| Border                 | Aucun                                                              |
| Border-radius          | 0                                                                  |
| Visibilité             | Desktop ≥ 1024px uniquement                                        |
| Sticky                 | `position: sticky; top: 96px`                                      |

> **Pourquoi sticky ?** Pour que la cliente voit **toujours son total** et le contenu de sa commande, peu importe où elle est dans le formulaire. Réassurance constante.

### 8.3 — Titre

```
Votre commande
```

| Propriété      | Valeur                                              |
| :------------- | :-------------------------------------------------- |
| Police         | Cormorant Garamond Light                            |
| Taille         | 22pt                                                |
| Couleur        | `#2C2A28` (Encre)                                   |
| Espacement bas | 24px                                                |

### 8.4 — Bloc produit

#### Layout

```
┌──────┐
│      │  Kit Rituel d'Éclat
│ [📦] │  Quantité : 1
│      │
└──────┘  500 MAD            [Modifier]
```

| Élément              | Spécifications                                                |
| :------------------- | :------------------------------------------------------------ |
| Photo kit            | 80×80px, format carré, object-fit cover                       |
| Nom kit              | Cormorant Light 16pt, couleur Encre                           |
| Quantité             | Inter Regular Italic 12pt, couleur Brume                       |
| Prix unitaire        | Inter Medium 14pt, couleur Encre                              |
| Lien « Modifier »     | Inter Medium 12pt, couleur Sauge dark, underline, hover Encre  |
| Layout desktop        | Photo à gauche, infos à droite                                 |
| Gap entre photo et infos | 16px                                                       |

#### Lien « Modifier » — comportement

Click sur « Modifier » → ouvre **modal mini** :

```
┌────────────────────────────────────────┐
│  Modifier votre commande               │
│                                         │
│  Kit Rituel d'Éclat                    │
│  ┌─────────────────────────────────┐  │
│  │  Quantité  ─  1  +              │  │
│  └─────────────────────────────────┘  │
│                                         │
│  Pour ajouter d'autres articles, retour│
│  au panier.                              │
│                                         │
│   ┌──────────────────┐ ┌──────────────┐│
│   │  Mettre à jour   │ │  Annuler     ││
│   └──────────────────┘ └──────────────┘│
│                                         │
└────────────────────────────────────────┘
```

| Élément              | Spécifications                                                |
| :------------------- | :------------------------------------------------------------ |
| Modal taille         | 480px largeur, hauteur auto                                    |
| Selector quantité    | Boutons `─` et `+` autour d'une valeur centrée                |
| CTA primaire         | « Mettre à jour » → recalcul du total + fermeture modal        |
| CTA secondaire       | « Annuler »                                                    |
| Lien retour panier    | Cormorant Italic 13pt sous le selector                        |

> **Limitation** : depuis le récap checkout, on ne peut **modifier que la quantité** du kit déjà dans le panier. Pour ajouter d'autres articles, retour au panier nécessaire.

### 8.5 — Filet séparateur

```
─────
```

| Propriété      | Valeur                                |
| :------------- | :------------------------------------ |
| Largeur        | 100% du container interne              |
| Hauteur        | 1px                                   |
| Couleur        | `#E0D5BA` (Ligne tinted plus marquée) |
| Espacement     | 24px haut, 24px bas                   |

### 8.6 — Bloc Sous-total / Livraison / Total

#### Layout

```
Sous-total                  500 MAD
Livraison                   Gratuit
─
Total                       500 MAD
```

| Élément              | Spécifications                                                |
| :------------------- | :------------------------------------------------------------ |
| Layout chaque ligne  | Flex space-between (label gauche, montant droite)              |
| Espacement entre lignes | 12px                                                       |
| Font label           | Inter Regular 13pt, couleur Encre claire                       |
| Font montant         | Inter Medium 13pt, couleur Encre                               |
| Filet avant Total    | 16px de large, 1px sauge dark, espacement 16px                |
| Font Total label     | Inter Medium 14pt, couleur Encre                               |
| Font Total montant   | Inter SemiBold 16pt, couleur Encre                            |

#### Mise à jour dynamique

À chaque modification de la commande (quantité, ville, mode livraison, mode paiement) :
- Le sous-total se met à jour
- La livraison se met à jour (selon ville + mode)
- Frais COD apparaissent si applicable
- Le total se recalcule **instantanément**

```javascript
// Pseudo-code
function recalculateOrder(state) {
  const subtotal = state.items.reduce((sum, item) =>
    sum + item.price * item.quantity, 0
  );

  const shipping = getShippingCost(state.shipping.city, state.shipping.mode);

  const codFee = state.payment.method === 'cod' ? 20 : 0;

  const total = subtotal + shipping + codFee;

  updateOrderRecap({ subtotal, shipping, codFee, total });
}
```

### 8.7 — Tokens design (récap)

```css
/* ─── Récap commande sidebar — tokens ─── */
--recap-bg: #F5F0E5;
--recap-padding: 32px;
--recap-width-desktop: 360px;
--recap-sticky-top: 96px;

--recap-title-font: 'Cormorant Garamond', serif;
--recap-title-weight: 300;
--recap-title-size: 22pt;
--recap-title-color: #2C2A28;
--recap-title-margin-bottom: 24px;

--recap-item-photo-size: 80px;
--recap-item-gap: 16px;
--recap-item-name-font: 'Cormorant Garamond', serif;
--recap-item-name-weight: 300;
--recap-item-name-size: 16pt;
--recap-item-quantity-style: italic;
--recap-item-quantity-size: 12pt;
--recap-item-quantity-color: #6B6863;
--recap-item-price-font: 'Inter', sans-serif;
--recap-item-price-weight: 500;
--recap-item-price-size: 14pt;

--recap-modify-link-color: #A8C4A6;
--recap-modify-link-hover-color: #2C2A28;

--recap-divider-color: #E0D5BA;
--recap-divider-margin: 24px 0;

--recap-subtotal-line-gap: 12px;
--recap-subtotal-label-font: 'Inter', sans-serif;
--recap-subtotal-label-size: 13pt;
--recap-subtotal-label-color: #4A4844;
--recap-subtotal-value-font: 'Inter', sans-serif;
--recap-subtotal-value-weight: 500;
--recap-subtotal-value-size: 13pt;
--recap-subtotal-value-color: #2C2A28;

--recap-total-divider-width: 16px;
--recap-total-divider-color: #A8C4A6;
--recap-total-divider-margin: 16px 0;
--recap-total-label-weight: 500;
--recap-total-label-size: 14pt;
--recap-total-value-weight: 600;
--recap-total-value-size: 16pt;
```

### 8.8 — Bloc Code promo (collapsable)

#### État fermé (par défaut)

```
┌─────────────────────────────────────┐
│  Avez-vous un code promo ?  ▾       │
└─────────────────────────────────────┘
```

#### État ouvert

```
┌─────────────────────────────────────┐
│  Avez-vous un code promo ?  ▴       │
│                                      │
│  ┌──────────────────────┐ ┌────────┐│
│  │ CODE                  │ │Appliquer││
│  └──────────────────────┘ └────────┘│
└─────────────────────────────────────┘
```

| Propriété          | Valeur                                                          |
| :----------------- | :-------------------------------------------------------------- |
| Toggle             | Click sur la barre = toggle ouvert/fermé (animation 220ms)        |
| Champ              | Input texte uppercase auto, max 20 char, padding 12px 14px       |
| Bouton « Appliquer »| Outline encre, padding 12px 16px, hauteur 44px                  |
| Layout             | Champ et bouton côte à côte, gap 8px                              |

#### États code promo

| État                          | Microcopy                                          |
| :---------------------------- | :------------------------------------------------- |
| Vide                          | (aucun feedback)                                    |
| Saisie en cours               | (aucun feedback)                                    |
| Click Appliquer + valide       | Ligne ajoutée au récap : « Code MAISON10 · -50 MAD » couleur sauge dark |
| Click Appliquer + invalide     | Message sous le champ : « Ce code n'est plus valide. » couleur rouge feutré |
| Click Appliquer + déjà utilisé | « Ce code a déjà été utilisé. » |

> **Pourquoi un collapse fermé par défaut ?** Parce que **la majorité des clientes n'ont pas de code**. Un champ ouvert leur ferait penser qu'elles **manquent** quelque chose (FOMO inverse). Le collapse fermé respecte le profil majoritaire sans pénaliser celles qui ont un code.

### 8.9 — Mention finale du récap

```
🔒 Commande sécurisée
Livraison sous 3-5 jours
```

| Propriété      | Valeur                                                  |
| :------------- | :------------------------------------------------------ |
| Police         | Inter Regular 11pt + Cormorant Italic 12pt              |
| Couleur        | `#6B6863` (Brume)                                       |
| Espacement haut| 24px (sous le code promo)                               |
| Mise à jour    | « 3-5 jours » → « 24-48h » si Express choisi             |

### 8.10 — Comportements UX (récap)

#### Animation à la mise à jour

À chaque recalcul des montants :
- L'ancienne valeur fade-out 200ms
- La nouvelle valeur fade-in + scale 0.95 → 1.0 (300ms)
- Effet visuel **subtil** mais perceptible — la cliente voit que le montant a bougé

#### Pas de scroll à l'intérieur du récap

Si le récap dépasse la hauteur du viewport (cas rare avec 1 seul kit + frais), il **scroll avec la page** plutôt que d'avoir son propre scroll interne. Sticky relâche aux bords si dépasse.

### 8.11 — Erreurs à éviter (récap)

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| Récap caché par défaut sur desktop                   | La cliente perd la transparence                                     |
| Code promo affiché ouvert par défaut                 | FOMO inverse + suggère qu'on cache des promos                       |
| Pas de mise à jour dynamique du total                | Confusion sur le montant final                                      |
| « Économisez 50 MAD » en gros sur les codes valides  | Manipulation — l'affichage discret suffit                            |
| Image kit en très grande taille                      | Distrait du formulaire principal                                    |
| Lien « Modifier » invisible (texte gris très clair)  | La cliente doit pouvoir modifier facilement                         |

---

## 9 — Section 05 — Récap commande (mobile accordéon)

### 9.1 — Wireframe — état fermé (par défaut sur mobile)

```
┌────────────────────────────────────────┐
│                                        │
│   ▼  Votre commande         500 MAD   │
│                                        │
└────────────────────────────────────────┘
```

### 9.2 — Wireframe — état ouvert

```
┌────────────────────────────────────────┐
│                                        │
│   ▲  Votre commande         500 MAD   │
│                                        │
│  ┌──────┐                              │
│  │      │  Kit Rituel d'Éclat          │
│  │ [📦] │  Quantité : 1                 │
│  │      │                               │
│  └──────┘  500 MAD          [Modifier] │
│                                        │
│  ─────                                  │
│                                        │
│  Sous-total                  500 MAD   │
│  Livraison                   Gratuit    │
│  ─                                      │
│  Total                       500 MAD   │
│                                        │
│  ┌──────────────────────────────────┐ │
│  │  Avez-vous un code promo ?  ▾    │ │
│  └──────────────────────────────────┘ │
│                                        │
└────────────────────────────────────────┘
```

### 9.3 — Position et comportement

| Propriété              | Valeur                                                          |
| :--------------------- | :-------------------------------------------------------------- |
| Position               | Sticky au-dessus du formulaire, top du viewport (sous le header) |
| Largeur                | 100%                                                              |
| Padding                | 16px                                                              |
| Background             | `#F5F0E5` (Crème teintée légère)                                 |
| Border-bottom          | 1px solid `#E0D5BA`                                              |
| Sticky                 | `position: sticky; top: 64px` (sous header simplifié mobile)     |
| Visibilité             | Mobile + Tablet < 1024px                                          |
| État par défaut        | **Fermé**                                                         |
| Toggle                 | Click sur le header → toggle ouvert/fermé                         |

### 9.4 — Header de l'accordéon (toujours visible)

```
▼  Votre commande         500 MAD
```

| Élément              | Spécifications                                                |
| :------------------- | :------------------------------------------------------------ |
| Chevron `▼` / `▲`    | SVG icon 16×16px, couleur Encre, rotate 180° à l'ouverture (transition 220ms) |
| Label                | Cormorant Garamond Light 16pt, couleur Encre                  |
| Total                | Inter Medium 16pt, couleur Encre, aligné à droite             |
| Layout               | Flex space-between                                              |
| Touch target         | Toute la zone (≥ 56px hauteur)                                 |

### 9.5 — Animation toggle

```
[t=0ms]      → Click sur le header
[t=0-100ms]  → Chevron rotate 0° → 180°
[t=0-320ms]  → Body fade-in + slide-down (height 0 → auto)
[t=320ms]    → Animation terminée
```

### 9.6 — Body de l'accordéon (visible si ouvert)

Identique à la sidebar desktop (sections 8.4 à 8.10), mais avec :
- Padding 16px (au lieu de 32px)
- Tailles de texte légèrement réduites pour mobile
- Bouton « Modifier » plus large (touch target)

### 9.7 — Mise à jour automatique du total visible

Même si l'accordéon est **fermé**, le total reste **visible** dans le header. À chaque modification (ville, mode, etc.), le total dans le header se met à jour avec animation discrète (fade-out 150ms / fade-in 200ms).

> **Critique pour la confiance** : la cliente voit en permanence le montant qu'elle va payer, sans avoir à ouvrir le récap.

### 9.8 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| Accordéon **ouvert** par défaut sur mobile           | Cache le formulaire (focus prioritaire)                             |
| Total caché si accordéon fermé                       | La cliente perd la transparence                                      |
| Pas d'animation de toggle                            | Expérience saccadée                                                  |
| Toggle au scroll automatique                          | Comportement inattendu, casse la confiance                           |
| Total qui ne se met pas à jour si fermé               | Confusion sur le montant final                                       |

---

## 10 — Section 06 — État de chargement du paiement

### 10.1 — Pourquoi une page intermédiaire ?

Entre le clic « Confirmer la commande » et la redirection 3D Secure, il y a un délai (souvent 1-3 secondes) où :
- Le backend crée la transaction CMI
- CMI prépare la page 3D Secure
- La banque émettrice est contactée

Sans page intermédiaire, la cliente voit son écran **figé** et peut paniquer (recliquer, fermer la page).

### 10.2 — Wireframe

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│                                                                      │
│                                                                      │
│                            ⟳                                          │
│                                                                      │
│                                                                      │
│                  Préparation de votre paiement.                      │
│                                                                      │
│                  Vous allez être redirigée vers votre banque         │
│                  pour valider la transaction.                         │
│                                                                      │
│                                                                      │
│                                                                      │
│                  Ne fermez pas cette fenêtre.                        │
│                                                                      │
│                                                                      │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 10.3 — Composition

| Propriété              | Valeur                                                          |
| :--------------------- | :-------------------------------------------------------------- |
| Fond                   | `#FBF8F1` (Crème) — pleine page                                  |
| Hauteur                | 100vh (occupe tout l'écran)                                       |
| Alignement             | Centré horizontalement et verticalement                            |
| Pas de header           | **Le header est masqué** sur cette page                           |
| Pas de footer           | **Le footer est masqué** sur cette page                           |

> **Pourquoi masquer header + footer ?** Pour signaler clairement à la cliente qu'elle est dans **une transition critique** — pas une page normale. Elle ne doit pas avoir d'option de navigation distractrice.

### 10.4 — Spinner

| Propriété          | Valeur                                                          |
| :----------------- | :-------------------------------------------------------------- |
| Type               | Cercle SVG avec stroke partiel qui tourne                          |
| Taille             | 48×48px                                                            |
| Couleur            | `#A8C4A6` (Sauge dark)                                            |
| Stroke-width       | 3px                                                                |
| Rotation           | 1 tour par seconde (linear infinite)                              |
| Position           | Centré, 64px au-dessus du texte                                    |

> **Pourquoi pas un GIF ou un Loader animé fancy ?** Parce que :
> 1. SVG est plus performant et léger
> 2. La sobriété est plus rassurante qu'une animation criarde
> 3. Le sauge dark est cohérent avec la palette (vs un loader bleu standard)

### 10.5 — Texte principal

```
Préparation de votre paiement.
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Light                                     |
| Taille          | 28pt (desktop) · 24pt (mobile)                                |
| Couleur         | `#2C2A28` (Encre)                                            |
| Alignement      | Centré                                                        |
| Espacement haut | 64px sous le spinner                                          |

### 10.6 — Texte secondaire

```
Vous allez être redirigée vers votre banque
pour valider la transaction.
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Regular                                   |
| Taille          | 16pt (desktop) · 15pt (mobile)                                |
| Couleur         | `#4A4844` (Encre claire)                                     |
| Line-height     | 1.6                                                          |
| Alignement      | Centré                                                        |
| Espacement haut | 16px                                                           |

### 10.7 — Avertissement (en bas)

```
Ne fermez pas cette fenêtre.
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Inter Medium 12pt                                             |
| Letter-spacing  | 1px                                                          |
| Couleur         | `#6B6863` (Brume)                                            |
| Alignement      | Centré                                                        |
| Espacement haut | 64px                                                          |
| Position        | En dessous du texte secondaire, dans la moitié inférieure de l'écran |

### 10.8 — Comportements UX

#### Timeout + recovery

Si après **15 secondes**, aucune redirection 3D Secure n'a eu lieu :

```
Préparation plus longue que prévu.

Vérifiez votre connexion internet et restez sur cette page.

Si rien ne se passe d'ici 30 secondes, [retour au paiement].
```

| Propriété          | Valeur                                                          |
| :----------------- | :-------------------------------------------------------------- |
| Animation          | Fade-in du nouveau message à 15s                                  |
| Lien « retour au paiement » | Cormorant Italic 14pt, couleur sauge dark, underline      |
| Action             | Click → retour à `/commander?step=3` avec état préservé           |

#### Si timeout total (60s)

Redirection automatique vers `/commander?step=3` avec un message d'erreur :

```
Une erreur réseau est survenue. Votre paiement n'a pas été traité.
Aucun montant n'a été débité. Vous pouvez réessayer.
```

> **Critique** : préciser **« Aucun montant n'a été débité »** pour rassurer la cliente. La peur du double débit est l'un des plus gros freins en e-commerce.

### 10.9 — Tokens design

```css
/* ─── État de chargement paiement — tokens ─── */
--loading-bg: #FBF8F1;
--loading-min-height: 100vh;

--loading-spinner-size: 48px;
--loading-spinner-color: #A8C4A6;
--loading-spinner-stroke: 3px;
--loading-spinner-margin-bottom: 64px;

--loading-title-font: 'Cormorant Garamond', serif;
--loading-title-weight: 300;
--loading-title-size-desktop: 28pt;
--loading-title-color: #2C2A28;

--loading-subtitle-font: 'Cormorant Garamond', serif;
--loading-subtitle-size: 16pt;
--loading-subtitle-color: #4A4844;
--loading-subtitle-margin-top: 16px;

--loading-warning-font: 'Inter', sans-serif;
--loading-warning-weight: 500;
--loading-warning-size: 12pt;
--loading-warning-tracking: 1px;
--loading-warning-color: #6B6863;
--loading-warning-margin-top: 64px;
```

### 10.10 — Psychologie

#### 1. Reduce uncertainty

> **Norman (1988)** : *« System feedback reduces user anxiety. »*

Pendant un délai d'1-3 secondes, l'absence de feedback **paralyse** la cliente. Le spinner + le texte explicite **transforment l'attente en anticipation**.

#### 2. Annoncer la redirection

> *« Vous allez être redirigée vers votre banque pour valider la transaction. »*

Cette phrase **prépare** la cliente à l'expérience 3D Secure (page hétérogène, page banque). Sans cette annonce, la cliente pense que le site a planté.

#### 3. « Aucun montant n'a été débité »

En cas de timeout, cette phrase est **fondatrice de la confiance**. Elle désamorce la peur principale en e-commerce : payer **deux fois** ou **sans recevoir**.

#### 4. « Ne fermez pas cette fenêtre »

Avertissement court, en Inter (font fonctionnelle) — il sort du registre éditorial pour signaler l'**urgence**. C'est l'**unique moment** du site où la voix devient plus directive.

### 10.11 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| Pas de page intermédiaire                            | La cliente panique sur écran figé                                    |
| Spinner Material Design coloré                       | Casse la palette                                                     |
| Texte « Loading... » seul                            | Anxiogène, pas de contexte                                           |
| Pas de mention « Aucun débit »                       | Peur du double paiement non gérée                                    |
| Auto-refresh aggressif (toutes les 5s)                | Peut casser la session 3D Secure                                     |
| Bouton « Annuler » visible                           | Friction de doute — préférer un timeout passif                       |
| Compte à rebours visible (« 15s restantes »)         | Anxiogène                                                            |
| Header visible avec liens de navigation              | Distrait, suggère que la cliente peut quitter sans risque             |

---

## 11 — Footer simplifié — élément persistant

### 11.1 — Pourquoi un footer *simplifié* ?

Comme le header, le footer est **simplifié** sur `/commander`. Il ne contient ni les colonnes habituelles (Navigation, Le rituel, La maison, Espace pro), ni les réseaux sociaux, ni les newsletters.

#### Justification

> **Baymard Institute** : *« Footer links on checkout pages reduce conversion by 4-7%. »*

Tout lien externe dans le footer = porte de sortie potentielle. Le footer simplifié garde uniquement ce qui est **légalement obligatoire** ou **immédiatement utile**.

### 11.2 — Composition

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  © 2026 FemiGlow · Toutes les commandes sont sécurisées 🔒           │
│                                                                     │
│  Mentions légales · CGV · Politique de confidentialité · Contact   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

| Propriété              | Valeur                                                          |
| :--------------------- | :-------------------------------------------------------------- |
| Hauteur                | 96px (desktop) · auto (mobile, padding 32px)                     |
| Background             | `#F5F0E5` (Crème teintée légère) — pour différencier du body crème |
| Border-top             | 1px solid `#E8E0D2`                                              |
| Padding latéral        | 32px (desktop) · 16px (mobile)                                  |
| Alignement             | Centré horizontalement                                            |

### 11.3 — Ligne 1 : copyright + mention sécurité

```
© 2026 FemiGlow · Toutes les commandes sont sécurisées 🔒
```

| Propriété      | Valeur                                              |
| :------------- | :-------------------------------------------------- |
| Police         | Inter Regular 11pt                                  |
| Couleur        | `#6B6863` (Brume)                                   |
| Séparateur `·` | Middle dot, espacement 8px                          |
| Icône cadenas  | SVG inline, taille 12×12px, couleur Sauge dark      |
| Alignement     | Centré                                              |

### 11.4 — Ligne 2 : liens légaux

```
Mentions légales · CGV · Politique de confidentialité · Contact
```

| Élément              | Spécifications                                                |
| :------------------- | :------------------------------------------------------------ |
| Police               | Inter Regular 11pt                                             |
| Couleur              | `#4A4844` (Encre claire)                                       |
| Hover                | `#2C2A28` (Encre), underline 1px sauge dark, offset 4px        |
| Séparateur `·`       | Middle dot, couleur Brume, espacement 12px                     |
| Espacement haut      | 12px                                                            |
| Comportement liens    | Ouvrent dans un **nouvel onglet** (`target="_blank"`) — préserve la session checkout |

> **Pourquoi ouvrir dans un nouvel onglet ?** Pour que la cliente puisse **consulter** les CGV ou mentions légales **sans quitter** la page checkout. Crucial pour la conversion.

### 11.5 — Liens du footer — 4 entrées seulement

| Lien                          | URL                          | Justification                              |
| :---------------------------- | :--------------------------- | :----------------------------------------- |
| Mentions légales              | `/mentions-legales`          | Obligation légale                          |
| CGV                           | `/cgv`                       | Obligation légale + référence en checkout  |
| Politique de confidentialité  | `/confidentialite`           | RGPD obligatoire                           |
| Contact                       | `/contact` ou `mailto:`      | Support immédiat si problème               |

> **Pas de lien vers Journal, Maison, Rituel, Kit** : ces pages **distraient** du checkout. La cliente peut y revenir après.

### 11.6 — Tokens design (footer simplifié)

```css
/* ─── Footer simplifié — tokens ─── */
--footer-checkout-bg: #F5F0E5;
--footer-checkout-border: 1px solid #E8E0D2;
--footer-checkout-height-desktop: 96px;
--footer-checkout-padding-x-desktop: 32px;
--footer-checkout-padding-x-mobile: 16px;
--footer-checkout-padding-y-mobile: 32px;

--footer-checkout-line1-font: 'Inter', sans-serif;
--footer-checkout-line1-size: 11pt;
--footer-checkout-line1-color: #6B6863;

--footer-checkout-line2-font: 'Inter', sans-serif;
--footer-checkout-line2-size: 11pt;
--footer-checkout-line2-color: #4A4844;
--footer-checkout-line2-hover-color: #2C2A28;
--footer-checkout-line2-margin-top: 12px;
--footer-checkout-line2-separator-color: #6B6863;
```

---

## 12 — Comportements transverses

### 12.1 — State management global du checkout

Le checkout maintient un **état centralisé** synchronisé entre :
- Le formulaire visible (étape active)
- Le récap (sidebar desktop / accordéon mobile)
- Le localStorage (recovery)
- L'URL (deep linking par étape)

#### Structure de l'état

```typescript
interface CheckoutState {
  step: 1 | 2 | 3;
  step1: {
    email: string;
    optinNewsletter: boolean;
    createAccount: boolean;
    password?: string; // Hashé côté serveur, jamais stocké local
  };
  step2: {
    firstName: string;
    lastName: string;
    phonePrefix: string;
    phoneNumber: string;
    addressLine1: string;
    addressLine2: string;
    neighborhood: string;
    city: string;
    shippingMode: 'standard' | 'express';
  };
  step3: {
    paymentMethod: 'card' | 'cod';
    rememberCard: boolean;
    // Pas de stockage local des détails carte
  };
  promoCode: string | null;
  promoDiscount: number;
  cart: {
    items: CartItem[];
    subtotal: number;
    shippingCost: number;
    codFee: number;
    total: number;
  };
  ui: {
    isLoading: boolean;
    errors: Record<string, string>;
    recapOpenMobile: boolean;
  };
}
```

### 12.2 — Recovery du checkout (24h)

À chaque modification, l'état est sauvé dans `localStorage` (clé `femiglow_checkout_state`). À la prochaine visite (sous 24h), si la cliente revient sur `/commander`, elle est invitée à reprendre :

```
┌────────────────────────────────────────────────────┐
│                                                    │
│  Reprendre votre commande ?                         │
│                                                    │
│  Vous avez commencé une commande il y a [2h 30m].  │
│  Votre panier et vos informations sont conservés.  │
│                                                    │
│   ┌──────────────────┐ ┌──────────────────┐        │
│   │  Reprendre       │ │  Recommencer    │        │
│   └──────────────────┘ └──────────────────┘        │
│                                                    │
└────────────────────────────────────────────────────┘
```

| Bouton « Reprendre »   | Restaure l'état + redirige sur l'étape où la cliente s'était arrêtée |
| :--------------------- | :------------------------------------------------------------------- |
| Bouton « Recommencer » | Efface localStorage + démarre à l'étape 1                             |

> **Données préservées** : email, opt-ins, prénom/nom, téléphone, adresse, ville, mode livraison, mode paiement choisi.
> **Données NON préservées** : numéro de carte, CVV, expiration, mot de passe.

### 12.3 — Synchronisation URL ↔ étape

Chaque étape a son URL distincte pour permettre :
- Bouton retour navigateur (revient à l'étape précédente, pas à `/panier`)
- Sharing d'URL (cas rare, mais utile pour le support)
- Analytics propre par étape

```
/commander                 → étape 1 (par défaut)
/commander?step=1          → étape 1
/commander?step=2          → étape 2 (si étape 1 complétée)
/commander?step=3          → étape 3 (si étapes 1-2 complétées)
/commander?step=loading    → page de chargement paiement
```

> **Garde-fou** : si la cliente arrive directement sur `/commander?step=3` sans avoir complété 1-2, elle est **redirigée** vers `/commander?step=1` automatiquement.

### 12.4 — Deep linking depuis emails (cas de panier abandonné)

Email de relance panier abandonné → lien `https://femiglow.ma/commander?step=2&from=email&token=xxx`

À la réception, le backend valide le token et **pré-remplit** l'état du checkout avec les infos de la cliente (si compte) ou avec les infos du panier sauvegardé.

### 12.5 — Validation côté serveur (au moment du paiement)

Quoique tout soit validé côté client, le **backend revalide tout** au moment du paiement :
- Email format
- Téléphone format
- Adresse (au moins ligne 1 + ville présentes)
- Mode de livraison cohérent avec la ville (Express dispo ?)
- Total recalculé (anti-tampering — sécurité)

> Si une validation serveur échoue → réponse `400 Bad Request` avec détail → message d'erreur affiché à la cliente avec le champ concerné mis en surbrillance.

### 12.6 — Anti-fraude

#### reCAPTCHA invisible (V3)

Activé sur le bouton « Confirmer la commande » :
- Score < 0.5 → challenge supplémentaire (3D Secure forcé même si banque ne l'exige pas)
- Score < 0.2 → blocage de la transaction + message « Une vérification supplémentaire est requise. Veuillez contacter le support. »

#### Velocity check

Si un même IP tente > 3 commandes en 10 minutes → blocage temporaire 1h avec message « Trop de tentatives. Veuillez réessayer plus tard. »

### 12.7 — Lazy loading des images

| Image                          | Stratégie                                        |
| :----------------------------- | :----------------------------------------------- |
| Photo kit dans le récap        | `loading="eager"`, preload critique              |
| Logos cartes (étape 3)         | SVG inline (pas d'images)                         |
| Spinner page chargement        | SVG inline                                        |

### 12.8 — Animation timing — règle générale

| Type d'animation              | Durée            | Easing                              |
| :---------------------------- | :--------------- | :---------------------------------- |
| Transition entre étapes       | 600ms total (300ms fade-out + 300ms fade-in) | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Validation inline             | 200ms            | `cubic-bezier(0.4, 0, 0.2, 1)`      |
| Slide-down nouveau bloc        | 320ms            | `cubic-bezier(0.16, 1, 0.3, 1)`     |
| Hover button                  | 220ms            | `cubic-bezier(0.4, 0, 0.2, 1)`      |
| Toggle accordéon mobile        | 320ms            | `cubic-bezier(0.16, 1, 0.3, 1)`     |
| Update montant récap           | 200ms fade-out + 300ms fade-in | `cubic-bezier(0.4, 0, 0.2, 1)` |
| Modal open/close              | 240ms            | `cubic-bezier(0.4, 0, 0.2, 1)`      |
| Spinner page paiement          | 1s rotation linear | `linear infinite`                  |

### 12.9 — Reduced motion

Pour les utilisateurs avec `prefers-reduced-motion: reduce` :

- Transitions entre étapes : 0ms (saut direct)
- Slide-down de nouveaux blocs : 0ms (apparition instantanée)
- Toggle accordéon : 0ms
- Update récap : 0ms (changement direct)
- Spinner : conservé (essentiel pour le feedback) mais réduit à 0.6s par tour

### 12.10 — Pas de scroll lock pendant le formulaire

La cliente doit pouvoir **scroller librement**. Pas de scroll-snap, pas de section forcée à occuper le viewport entier.

### 12.11 — Comportement clavier

| Touche                | Comportement                                          |
| :-------------------- | :---------------------------------------------------- |
| Tab                   | Navigation séquentielle dans les champs                |
| Shift+Tab             | Navigation inverse                                     |
| Enter (dans un champ) | Soumission du formulaire de l'étape (= clic Continuer) |
| Enter (sur radio)     | Sélection du radio button                              |
| Espace                | Toggle checkbox / Sélection radio                      |
| Escape (modal ouvert) | Ferme le modal                                          |

### 12.12 — Auto-save trigger

L'état est sauvé dans localStorage à chaque :
- `blur` d'un champ texte
- `change` d'un select / radio / checkbox
- Toggle de l'accordéon récap mobile (pour préserver l'état UI)

### 12.13 — Browser auto-fill

Tous les champs ont des `autocomplete` HTML5 standard pour bénéficier de l'autofill des navigateurs (Chrome, Safari, Firefox, Edge). C'est **critique** pour la conversion mobile.

### 12.14 — Pas de tracking côté cliente avant consentement

Avant que la cliente accepte les cookies, **aucun tracking analytics** ne se déclenche. Le checkout fonctionne **sans GA4 actif** si la cliente refuse les cookies.

> **RGPD strict** : pas de pixel Facebook, pas de tag Google Ads avant consentement explicite.

---

## 13 — Adaptation responsive

### 13.1 — Breakpoints officiels

| Nom         | Min-width | Max-width | Layout principal                       |
| :---------- | :-------- | :-------- | :------------------------------------- |
| **Mobile**  | 0         | 767px     | 1 colonne, accordéon récap en haut     |
| **Tablet**  | 768px     | 1023px    | 1 colonne, accordéon récap en haut     |
| **Desktop** | 1024px    | -         | 2 colonnes (60% form / 40% sidebar)    |

> **Note importante** : le checkout passe en 2 colonnes à partir de **1024px** (vs 1280px pour les autres pages). Pourquoi ? Parce que la sidebar récap est **fonctionnellement précieuse** dès qu'on a la place — l'optimum apparaît à 1024px.

### 13.2 — Mobile-first design priority

| Métrique                     | Importance mobile        | Justification                                  |
| :--------------------------- | :----------------------- | :--------------------------------------------- |
| Touch targets ≥ 44×44px      | **Critique**              | 65% du trafic checkout = mobile                  |
| Inputs avec `inputmode`      | **Critique**              | Clavier numérique pour téléphone, carte, CVV    |
| Auto-fill compatible          | **Critique**              | Apple/Google Pay-like flow                      |
| Champs à 100% largeur         | **Critique**              | Pas de mini-champ difficile à viser              |
| Boutons à 100% largeur        | **Critique**              | CTA pleine largeur tactile                       |
| Pas de hover essentiel        | **Critique**              | Pas de hover sur mobile                         |
| Spacing généreux              | **Important**             | Évite les mis-clics                             |
| Texte ≥ 14px (sauf contextuel)| **Important**             | Lisibilité                                      |

### 13.3 — Adaptations par section

#### Header simplifié

| Propriété              | Desktop          | Tablet          | Mobile         |
| :--------------------- | :--------------- | :-------------- | :------------- |
| Hauteur                | 72px             | 72px            | 64px           |
| Wordmark size          | 28pt             | 26pt            | 24pt           |
| Mention « Sécurisée »   | Visible          | Visible         | Cachée < 380px |
| Lien retour panier     | Visible          | Visible         | Visible (icon) |

#### Barre de progression

| Propriété              | Desktop          | Tablet          | Mobile         |
| :--------------------- | :--------------- | :-------------- | :------------- |
| Layout                 | Horizontale complète | Horizontale | Compactée      |
| Numéros visibles       | Oui (① ② ③)      | Oui              | Oui (juste numéros, pas labels) |
| Labels visibles        | Oui              | Oui              | **Cachés** sur mobile < 480px |
| Hauteur container      | 64px             | 56px            | 48px           |

#### Sur mobile — barre compactée

```
① ──── ② ──── ③
✓
```

| Élément              | Spécifications mobile                                          |
| :------------------- | :------------------------------------------------------------- |
| Numéros              | Cercles 32×32px (étape complétée → ✓ centré)                  |
| Lignes entre étapes  | 2px hauteur, sauge dark si complétée, brume claire sinon       |
| Pas de labels        | Pour économiser l'espace                                        |
| Étape active          | Cercle plein encre + numéro blanc                                |

#### Étape 1 — Informations

| Propriété              | Desktop          | Tablet          | Mobile         |
| :--------------------- | :--------------- | :-------------- | :------------- |
| Padding latéral form   | 32px             | 24px            | 16px           |
| Champ email largeur    | 100% (max 540px) | 100%             | 100%           |
| Bouton « Continuer »   | 100% (max 540px) | 100%             | 100%           |
| Espacement entre éléments | 24px           | 20px            | 16px           |

#### Étape 2 — Livraison

| Propriété              | Desktop          | Tablet          | Mobile         |
| :--------------------- | :--------------- | :-------------- | :------------- |
| Prénom + Nom layout    | Côte à côte      | Côte à côte     | **Empilés**    |
| Quartier + Ville layout| Côte à côte      | Côte à côte     | **Empilés**    |
| Modes livraison layout | Empilés          | Empilés         | Empilés        |
| Texte option mode       | Nom + descr inline | Inline         | **Empilés** (nom dessus, descr dessous) |

#### Étape 3 — Paiement

| Propriété              | Desktop          | Tablet          | Mobile         |
| :--------------------- | :--------------- | :-------------- | :------------- |
| Méthodes paiement      | Empilées          | Empilées         | Empilées        |
| Numéro de carte        | 100% largeur      | 100%             | 100%           |
| Expiration + CVV       | 50/50 côte à côte | 50/50           | 50/50 (exception au single column) |
| Titulaire              | 100%             | 100%             | 100%           |
| Bouton « Confirmer »   | 100% (max 540px) | 100%             | 100%           |

#### Récap commande

| Propriété              | Desktop ≥ 1024   | Tablet < 1024   | Mobile         |
| :--------------------- | :--------------- | :-------------- | :------------- |
| Position               | Sidebar droite, sticky | Accordéon en haut, sticky | Accordéon en haut, sticky |
| Largeur                | 360px fixe       | 100%             | 100%           |
| État par défaut        | Visible (ouvert) | Fermé             | Fermé           |
| Photo kit size         | 80×80px          | 64×64px           | 64×64px        |
| Padding                | 32px             | 16px              | 16px           |

#### État de chargement paiement

| Propriété              | Desktop          | Tablet          | Mobile         |
| :--------------------- | :--------------- | :-------------- | :------------- |
| Spinner size           | 48px             | 48px             | 40px           |
| Titre size             | 28pt             | 24pt             | 22pt           |
| Sous-titre size        | 16pt             | 15pt             | 14pt           |
| Padding général        | Centré full screen | Centré full screen | Centré full screen |

#### Footer simplifié

| Propriété              | Desktop          | Tablet          | Mobile         |
| :--------------------- | :--------------- | :-------------- | :------------- |
| Hauteur                | 96px             | 80px             | auto (padding 32px) |
| Layout                 | 2 lignes centrées | 2 lignes         | 2 lignes ou plus si wrap |
| Liens légaux           | Inline           | Inline           | Wrap si nécessaire |

### 13.4 — Touch targets minimum mobile

| Élément                       | Hauteur tactile minimum                |
| :---------------------------- | :------------------------------------- |
| Champ input                   | 48px (padding 14px)                    |
| Checkbox / Radio              | Zone label complète ≥ 44px            |
| Bouton « Continuer »          | 56px                                    |
| Bouton « Confirmer »          | 60px                                    |
| Bouton accordéon récap        | 56px (zone complète)                    |
| Bouton « Modifier » récap      | 44px                                    |
| Lien « Retour au panier »      | Zone tactile ≥ 44px                    |

### 13.5 — Mobile keyboard - inputmode

```html
<!-- Email -->
<input type="email" inputmode="email" autocomplete="email">

<!-- Téléphone -->
<input type="tel" inputmode="numeric" autocomplete="tel-national">

<!-- Numéro carte -->
<input type="text" inputmode="numeric" autocomplete="cc-number">

<!-- CVV -->
<input type="text" inputmode="numeric" autocomplete="cc-csc">

<!-- Date expiration -->
<input type="text" inputmode="numeric" autocomplete="cc-exp">

<!-- Code postal (si ajouté V2) -->
<input type="text" inputmode="numeric" autocomplete="postal-code">
```

> **Pourquoi inputmode plutôt que type="number" ?** Parce que `type="number"` ajoute des spinners disgracieux et ne permet pas le formatage avec espaces (1234 5678 9012 3456). `inputmode="numeric"` ouvre le clavier numérique sans imposer le type number HTML.

### 13.6 — Pas de zoom forcé sur input focus

Sur iOS, si la taille de police d'un input est < 16px, Safari **zoome automatiquement** sur le champ. Très perturbant.

> **Solution** : tous les `<input>` ont **font-size ≥ 16px** (15pt = 20px, OK) sur mobile.

### 13.7 — Optimisations spécifiques mobile

| Optimisation                         | Justification                                      |
| :----------------------------------- | :------------------------------------------------- |
| Pas d'animation parallax              | Trop coûteux sur mobile                            |
| Lazy loading agressif                  | Bande passante limitée                             |
| Auto-save fréquent                    | Connexion fluctuante                               |
| Pré-chargement image kit récap        | LCP element                                        |
| Police système fallback               | Si polices web tardent, texte lisible immédiatement |
| Désactivation des `:hover` styles      | Évite les états bloqués sur écran tactile          |

---

## 14 — Performance technique

### 14.1 — Web Vitals — cibles strictes

| Métrique | Cible    | Justification                                      |
| :------- | :------- | :------------------------------------------------- |
| **LCP**  | **< 1.8s** (très strict) | Page critique de conversion, chaque ms compte |
| **CLS**  | **< 0.05** (très strict) | Pas de layout shift acceptable en checkout    |
| **INP**  | **< 150ms** (très strict) | Interactions doivent être instantanées        |
| **FCP**  | < 1.0s   | Header + barre progression visibles vite           |
| **TBT**  | < 200ms  | JS de validation + state management                 |

> **Pourquoi des cibles si strictes ?** Parce que `/commander` est la page la plus **chère** du site. Une perte de conversion de 1% peut représenter des dizaines de milliers de MAD par mois.

### 14.2 — Stratégie de chargement

#### Critical CSS

CSS critique inline dans le `<head>` — uniquement les styles du :
- Header simplifié
- Barre de progression
- Étape 1 (informations)
- Récap commande

Le reste en CSS externe.

#### Preload des polices critiques

```html
<link rel="preload" href="/fonts/Inter-Regular.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/Inter-Medium.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/Inter-SemiBold.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/CormorantGaramond-Light.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/PinyonScript-Regular.woff2" as="font" type="font/woff2" crossorigin>
```

> **Pas de Cormorant Italic preload** : utilisé moins fréquemment en checkout (juste dans les sub-labels), `font-display: swap` suffit.

#### Preload de la photo kit (récap)

```html
<link rel="preload" as="image"
      href="/images/kit/kit-thumb-80.webp"
      fetchpriority="high">
```

#### Defer du JavaScript

```html
<!-- Scripts critiques (form validation + state) -->
<script src="/js/checkout-core.js" defer></script>

<!-- Scripts lazy (CMI, Stripe, après interaction étape 3) -->
<script src="/js/checkout-payment.js" defer data-lazy="step3"></script>

<!-- Scripts analytics -->
<script src="/js/analytics.js" async></script>
```

> **Pattern** : le JS de paiement (CMI, Stripe SDK) n'est chargé qu'à l'arrivée à l'étape 3. Économie de ~80 KB sur les étapes 1-2.

### 14.3 — Budget de performance

| Ressource                       | Budget          |
| :------------------------------ | :-------------- |
| HTML initial                    | < 25 KB gzip    |
| CSS critique inline             | < 8 KB          |
| CSS externe                     | < 30 KB gzip    |
| JS core (validation + state)    | < 40 KB gzip    |
| JS paiement (CMI/Stripe SDK)    | < 80 KB gzip (lazy) |
| Photo kit récap                 | < 12 KB (80×80 WebP) |
| Logos cartes (SVG inline)       | < 4 KB          |
| Polices                         | < 120 KB total  |
| **Total page initiale (étape 1)** | **< 240 KB**  |
| **Total après step 3 chargé**    | **< 320 KB**  |

> **Très léger** comparé aux autres pages B2C — c'est intentionnel. Le checkout doit être **ultra-rapide** sur connexion mobile fluctuante.

### 14.4 — CDN & cache

| Ressource                      | Cache-Control                          |
| :----------------------------- | :------------------------------------- |
| HTML                           | `no-cache, must-revalidate, no-store`  |
| CSS / JS versionnés            | `public, max-age=31536000, immutable`  |
| Images logos cartes            | (SVG inline, pas de cache nécessaire)  |
| Photo kit                      | `public, max-age=2592000` (30 jours)   |
| Polices                        | `public, max-age=31536000, immutable`  |

> **HTML en `no-store`** : critique pour la sécurité — le HTML ne doit **jamais** être mis en cache (peut contenir des données partielles de session).

### 14.5 — Optimisations spécifiques

| Optimisation                              | Justification                                      |
| :---------------------------------------- | :------------------------------------------------- |
| **SSR** (Server-Side Rendering)           | HTML pré-rendu pour FCP rapide                      |
| Pas d'images lourdes (juste 1 thumb 80×80) | LCP < 1.8s atteignable                             |
| State management léger (pas Redux complet) | Vanilla JS / Zustand suffit                        |
| Validation côté client + serveur (double) | Sécurité + UX                                      |
| Auto-save throttlé (1 save / 500ms max)   | Évite saturation localStorage                       |
| Fetch des taux livraison statique          | JSON dans le bundle, pas d'appel API               |
| Polices `font-display: swap`               | Texte visible immédiatement                         |

### 14.6 — Stratégie de rendu — recommandation

#### Approche recommandée — SSR + interactivité progressive

`/commander` est **idéalement** rendue en :
- **SSR** au moment de la requête (Next.js, Remix, Astro avec adapter SSR)
- HTML envoyé avec l'état initial (étape 1 par défaut)
- JavaScript hydrate la page progressivement

**Avantages** :
- LCP rapide (HTML pré-rendu visible avant JS)
- SEO robot crawlable (mais on est `noindex`, donc pas critique)
- Sécurité (validation côté serveur native)

### 14.7 — Métriques de référence

| Site (e-commerce premium)     | LCP    | CLS   | INP    |
| :--------------------------- | :----- | :---- | :----- |
| Aesop checkout                | 1.6s   | 0.04  | 120ms  |
| Le Labo checkout              | 1.8s   | 0.05  | 140ms  |
| Glossier checkout             | 1.4s   | 0.03  | 100ms  |
| **FemiGlow `/commander` cible** | **< 1.8s** | **< 0.05** | **< 150ms** |

### 14.8 — Monitoring en production

| Outil                      | Métrique surveillée                                    |
| :------------------------- | :----------------------------------------------------- |
| Web Vitals (real user monitoring) | LCP, CLS, INP par étape                          |
| Sentry                     | Erreurs JavaScript en checkout                          |
| Stripe / CMI dashboard     | Taux d'échec paiement, latence transactions             |
| GA4 funnel reports         | Conversion par étape, drop-off rate                     |
| Hotjar                     | Heatmaps mobile + recordings d'abandon                  |

> **Alerting** : si le taux de conversion checkout chute de plus de 10% sur 24h, alerte critique au responsable produit.

---

## 15 — SEO & métadonnées

### 15.1 — Principe directeur — `noindex, nofollow` strict

> **`/commander` n'a aucune raison d'apparaître dans les résultats de recherche.** C'est une page transactionnelle, accessible uniquement par flux logique (depuis `/kit` ou `/panier`).

#### Conséquences techniques

- Pas d'optimisation de title/description pour SERP
- Pas d'image Open Graph
- Pas de Schema.org
- Pas de hreflang nécessaire
- Pas dans le sitemap.xml
- `Disallow: /commander` dans robots.txt

### 15.2 — Robots meta

```html
<meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex">
```

| Directive       | Effet                                                          |
| :-------------- | :------------------------------------------------------------- |
| `noindex`       | N'apparaît pas dans les résultats de recherche                  |
| `nofollow`      | Les liens de la page ne transmettent pas de PageRank             |
| `noarchive`     | Pas de version cache Google                                      |
| `nosnippet`     | Pas d'extrait dans les SERP                                      |
| `noimageindex`  | Aucune image de la page indexée                                  |

### 15.3 — Title minimal

```html
<title>Commander · FemiGlow</title>
```

> Title court et neutre. Pas de mot-clé SEO, pas de hook éditorial. La cliente voit juste « Commander · FemiGlow » dans son onglet — utile pour s'y retrouver entre plusieurs onglets ouverts.

### 15.4 — Meta description (réduite)

```html
<meta name="description" content="Finaliser votre commande FemiGlow.">
```

> Courte. La page n'apparaîtra pas en SERP, donc inutile d'optimiser. La meta sert juste de description par défaut si jamais un partage de lien (cas rare) génère un aperçu.

### 15.5 — Pas d'Open Graph

```html
<!-- Pas de balises og:* sur cette page -->
```

> **Pourquoi pas d'OG ?** Parce qu'on **ne veut pas** que l'URL `/commander` génère un beau preview Facebook/WhatsApp (la cliente partage parfois par erreur). Sans og:image et og:title, les previews sont ternes — c'est volontaire.

### 15.6 — Pas de canonical SEO

Le canonical n'a pas de sens sur une page noindex. Cependant, pour éviter les variations d'URL :

```html
<link rel="canonical" href="https://femiglow.ma/commander">
```

> Optionnel — surtout pour la gestion interne propre.

### 15.7 — Pas de Schema.org

Aucune structure Schema (pas Product, pas BreadcrumbList, pas WebPage). Les schémas servent au SEO ; sur une page noindex, ils sont inutiles voire nuisibles (ils peuvent tout de même être indexés via d'autres sites).

### 15.8 — Pas dans le sitemap

```xml
<!-- Sitemap.xml ne contient PAS /commander -->
```

> Si Google découvre la page via un lien interne, il respectera le `noindex`. Mais ne pas l'inclure dans le sitemap évite tout signal contradictoire.

### 15.9 — Robots.txt

```
User-agent: *
Disallow: /commander
Disallow: /commander?
Disallow: /panier
Disallow: /merci
Disallow: /espace-pro/
```

> **Tunnel transactionnel + post-achat exclus** des crawls. Cohérent avec la sécurité.

### 15.10 — Sécurité contre l'indexation involontaire

Plusieurs couches pour s'assurer que `/commander` ne fuite jamais en SERP :

1. ✅ Meta robots `noindex`
2. ✅ HTTP header `X-Robots-Tag: noindex, nofollow` côté serveur
3. ✅ Robots.txt `Disallow`
4. ✅ Pas dans sitemap.xml
5. ✅ Liens internes vers `/commander` avec `rel="nofollow"` (depuis `/kit` CTA, `/panier`)

### 15.11 — Tracking analytics

Bien que noindex, `/commander` est **fortement trackée** en interne :

| Événement                           | Outil                       |
| :---------------------------------- | :-------------------------- |
| `checkout_started`                  | GA4 ecommerce event         |
| `checkout_step_completed` (1, 2, 3) | GA4 funnel event            |
| `payment_initiated`                 | GA4 + Stripe/CMI dashboard  |
| `payment_succeeded` / `payment_failed` | GA4 + Stripe/CMI         |
| `cart_abandoned`                    | GA4 + email automation       |
| Erreurs de validation                | Form analytics (Hotjar)     |

> **Ces events alimentent les KPIs définis section 2** : taux de conversion, drop-off par étape, etc.

### 15.12 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| Pas de `noindex`                                    | Risque que Google indexe une page transactionnelle                   |
| Title SEO optimisé (« Commander en ligne FemiGlow ») | Inutile (noindex) et casse le ton interne                           |
| Open Graph image fancy                              | Génère un preview attractif → favorise le partage involontaire      |
| Schema Product sur cette page                        | Doublonne `/kit` qui a déjà ce schema, crée confusion                |
| Tracking actif **avant** consentement cookies        | Violation RGPD                                                       |
| URL avec données sensibles (ex: `?email=xxx`)       | Données fuitent dans Referer, logs serveurs                          |

---

## 16 — Accessibilité (a11y)

### 16.1 — Conformité visée

**WCAG 2.2 niveau AA strict** sur tous les composants — c'est une page transactionnelle, donc l'accessibilité est **obligatoire légalement** et critique éthiquement.

**Niveau AAA** visé sur :
- Contraste de tous les champs et boutons
- Navigation clavier complète (chaque champ, chaque option, chaque CTA atteignables)
- Annonces dynamiques (aria-live) pour validations et changements d'état
- Labels explicites sur tous les champs
- Messages d'erreur clairs, programmes accessibles

### 16.2 — Contraste — vérifications

| Combinaison                                        | Ratio   | Niveau WCAG   |
| :------------------------------------------------- | :------ | :------------ |
| Encre `#2C2A28` sur Crème `#FBF8F1`                | 14.2:1  | AAA           |
| Encre claire `#4A4844` sur Crème                   | 9.1:1   | AAA           |
| Brume `#6B6863` sur Crème                          | 5.6:1   | AA            |
| Encre sur Crème pure `#FFFFFF` (champs)            | 14.6:1  | AAA           |
| Encre sur Crème teintée `#F5F0E5` (récap)          | 12.4:1  | AAA           |
| Sauge dark `#A8C4A6` sur Crème (focus, filets)     | 2.8:1   | (graphique non textuel — OK pour focus ring ≥ 3px) |
| Crème pure sur Encre (CTA Continuer / Confirmer)   | 14.2:1  | AAA           |
| Brume claire `#A8A8A6` sur Crème (placeholder)     | 3.9:1   | AA Large only — placeholder uniquement |
| Rouge feutré `#9C5B5B` sur Crème (erreurs)         | 5.2:1   | AA            |

### 16.3 — Navigation clavier — séquence Tab

#### Étape 1 — Informations

| Ordre | Élément                                              |
| :---- | :--------------------------------------------------- |
| 1     | Skip links (« Aller au formulaire »)                  |
| 2     | Wordmark (header)                                     |
| 3     | Lien « Retour au panier »                              |
| 4     | Numéro étape 1 (cliquable si étape complétée)         |
| 5     | Numéro étape 2 (idem)                                  |
| 6     | Numéro étape 3 (idem)                                  |
| 7     | Champ Email                                           |
| 8     | Checkbox newsletter                                   |
| 9     | Checkbox création de compte                            |
| 10    | (Si compte coché) Champ Mot de passe + bouton show    |
| 11    | Bouton « Continuer →»                                  |
| 12    | Liens du footer (Mentions, CGV, Confidentialité, Contact) |

#### Étape 2 — Livraison

| Ordre | Élément                                              |
| :---- | :--------------------------------------------------- |
| 1-6   | (Identique à étape 1 pour header + barre)             |
| 7     | Champ Prénom                                          |
| 8     | Champ Nom                                             |
| 9     | Sélecteur indicatif téléphone                          |
| 10    | Champ Téléphone                                       |
| 11    | Champ Adresse ligne 1                                  |
| 12    | Champ Complément (optionnel)                          |
| 13    | Champ Quartier (optionnel)                            |
| 14    | Select Ville                                          |
| 15    | Radio Standard                                        |
| 16    | Radio Express                                         |
| 17    | Bouton « Continuer →»                                  |
| 18    | (Si récap mobile) Toggle accordéon récap              |
| 19    | Liens du footer                                       |

#### Étape 3 — Paiement

| Ordre | Élément                                              |
| :---- | :--------------------------------------------------- |
| 1-6   | (Identique aux étapes 1-2)                            |
| 7     | Radio « Carte bancaire »                               |
| 8     | Radio « Paiement à la livraison »                      |
| 9     | (Si carte) Champ Numéro de carte                       |
| 10    | (Si carte) Champ Expiration                            |
| 11    | (Si carte) Champ CVV + icône d'aide                    |
| 12    | (Si carte) Champ Titulaire                             |
| 13    | (Si compte créé étape 1) Checkbox « Mémoriser carte »  |
| 14    | (Si récap desktop) Lien « Modifier » dans le récap     |
| 15    | Toggle « Avez-vous un code promo ? »                  |
| 16    | (Si ouvert) Champ code promo                           |
| 17    | (Si ouvert) Bouton « Appliquer »                       |
| 18    | Bouton « Confirmer la commande · 540 MAD »             |
| 19    | Liens du footer                                       |

### 16.4 — Focus ring

| Propriété     | Valeur                                          |
| :------------ | :---------------------------------------------- |
| Couleur       | `#A8C4A6` (Sauge dark)                          |
| Épaisseur     | 2px                                             |
| Offset        | 4px                                             |
| Border-radius | Hérite de l'élément (0)                          |
| Outline-style | `solid`                                         |
| Visible       | Sur focus clavier uniquement (`:focus-visible`) |
| Skip          | Pas de focus ring sur clic souris                |

### 16.5 — ARIA labels & landmarks

```html
<header role="banner" aria-label="En-tête de checkout sécurisé">
  <a href="/" aria-label="Retour à l'accueil FemiGlow (modal de confirmation)">FemiGlow</a>
  <span aria-label="Commande sécurisée par chiffrement">🔒 Commande sécurisée</span>
  <a href="/panier" aria-label="Retour au panier">← Retour au panier</a>
</header>

<main role="main" aria-label="Tunnel de commande FemiGlow">

  <nav aria-label="Étapes du checkout" class="progress-bar">
    <ol>
      <li aria-current="step"><a href="?step=1">① Informations</a></li>
      <li><a href="?step=2" aria-disabled="true">② Livraison</a></li>
      <li><a href="?step=3" aria-disabled="true">③ Paiement</a></li>
    </ol>
  </nav>

  <form aria-labelledby="step1-title" novalidate>
    <h1 id="step1-title">Vos informations</h1>
    <p>Nous avons besoin de votre email pour vous envoyer la confirmation de commande et le suivi de livraison.</p>

    <div class="form-group">
      <label for="email">Email</label>
      <input
        type="email"
        id="email"
        name="email"
        autocomplete="email"
        inputmode="email"
        required
        aria-required="true"
        aria-describedby="email-help email-error">
      <span id="email-help" class="visually-hidden">Format attendu : votre@email.com</span>
      <span id="email-error" role="alert" aria-live="polite" class="error-message"></span>
    </div>

    <div class="form-group">
      <input
        type="checkbox"
        id="optin-newsletter"
        name="optinNewsletter"
        aria-describedby="newsletter-desc">
      <label for="optin-newsletter">Recevoir le journal de la maison</label>
      <span id="newsletter-desc" class="sub-label">Un texte tous les quinze jours. Désinscription en un clic.</span>
    </div>

    <button type="submit" aria-label="Continuer vers l'étape Livraison">
      Continuer <span aria-hidden="true">→</span>
    </button>
  </form>

  <aside aria-label="Récapitulatif de votre commande" class="order-recap">
    <h2>Votre commande</h2>
    <!-- Contenu récap -->
  </aside>
</main>

<footer role="contentinfo" aria-label="Pied de page checkout">
  <!-- ... -->
</footer>
```

### 16.6 — Annonces dynamiques (aria-live)

Le checkout est **plein d'événements dynamiques** qui doivent être annoncés aux lecteurs d'écran :

#### 1. Validation inline d'un champ

```html
<span id="email-error" role="alert" aria-live="polite">
  Cet email semble incomplet.
</span>
```

| `role="alert"`        | Annonce immédiate                                  |
| :-------------------- | :------------------------------------------------- |
| `aria-live="polite"`  | Annonce sans interrompre la lecture en cours       |

> Les **erreurs** sont en `role="alert"` (interruption) ; les **succès** en `aria-live="polite"` (non-interruption).

#### 2. Changement d'étape

À la transition étape 1 → étape 2 :

```html
<div role="status" aria-live="assertive" class="visually-hidden">
  Étape 2 sur 3 : Livraison. Veuillez remplir les champs ci-dessous.
</div>
```

L'utilisateur lecteur d'écran entend immédiatement : *« Étape 2 sur 3 : Livraison. Veuillez remplir les champs ci-dessous. »*

#### 3. Mise à jour du récap

À chaque recalcul (changement de ville, mode livraison, code promo) :

```html
<div aria-live="polite" class="visually-hidden">
  Total mis à jour : 540 dirhams marocains.
</div>
```

#### 4. État du paiement

Sur la page intermédiaire de chargement :

```html
<div role="status" aria-live="assertive">
  Préparation de votre paiement. Vous allez être redirigée vers votre banque.
</div>
```

### 16.7 — Labels & associations

#### Tous les inputs ont un label associé

```html
<!-- Bon -->
<label for="firstname">Prénom</label>
<input type="text" id="firstname" name="firstName">

<!-- Mauvais -->
<input type="text" placeholder="Prénom" name="firstName">
```

> **Pas de placeholder en remplacement du label.** Les placeholders disparaissent au focus, ce qui empêche les utilisateurs lecteurs d'écran de savoir quel champ ils remplissent.

#### Fieldset + legend pour les groupes radio

```html
<fieldset>
  <legend>Mode de livraison</legend>

  <div>
    <input type="radio" id="standard" name="shipping" value="standard">
    <label for="standard">
      <span class="name">Standard</span>
      <span class="desc">Livraison en 3 à 5 jours · Gratuit</span>
    </label>
  </div>

  <div>
    <input type="radio" id="express" name="shipping" value="express">
    <label for="express">
      <span class="name">Express</span>
      <span class="desc">Livraison en 24 à 48h · 50 MAD</span>
    </label>
  </div>
</fieldset>
```

> Pareil pour les méthodes de paiement (Carte / COD).

#### Le legend peut être visuellement caché

Le `<legend>` est requis sémantiquement, même si visuellement il est remplacé par un titre Inter Medium 11pt :

```html
<fieldset class="payment-methods">
  <legend class="visually-hidden">Méthode de paiement</legend>
  <h3 aria-hidden="true">Méthode de paiement</h3>
  <!-- options -->
</fieldset>
```

### 16.8 — Skip links

```html
<a href="#main" class="skip-link">Aller au formulaire</a>
<a href="#order-recap" class="skip-link">Aller au récapitulatif</a>
<a href="#checkout-controls" class="skip-link">Aller au bouton de validation</a>
```

> Trois skip links — utiles pour les utilisateurs lecteurs d'écran qui veulent atteindre rapidement le bouton de validation ou le récap.

### 16.9 — Réduction du mouvement

```css
@media (prefers-reduced-motion: reduce) {
  /* Toutes animations désactivées */
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }

  /* Transitions entre étapes : saut direct */
  .step-transition {
    opacity: 1 !important;
    transform: none !important;
  }

  /* Spinner page paiement : conservé mais ralenti */
  .loading-spinner {
    animation-duration: 2s !important; /* au lieu de 1s */
  }

  /* Toggle accordéon récap : pas d'animation */
  .recap-accordion-body {
    transition: none !important;
  }

  /* Update montant récap : pas de fade */
  .order-amount {
    transition: none !important;
  }
}
```

### 16.10 — Messages d'erreur accessibles

#### Bonnes pratiques

| Pratique                          | Implémentation                                             |
| :-------------------------------- | :--------------------------------------------------------- |
| Erreur identifiée par couleur ET texte | Rouge feutré + message texte (pas que la couleur)     |
| Erreur associée au champ          | `aria-describedby="error-id"`                              |
| Erreur annoncée immédiatement     | `role="alert"` + `aria-live="assertive"`                   |
| Champ marqué comme invalide        | `aria-invalid="true"` quand erreur                         |
| Erreur effacée au refocus + saisie  | `aria-invalid="false"` + `aria-describedby` cleared       |

#### Exemple complet

```html
<div class="form-group">
  <label for="email">Email</label>
  <input
    type="email"
    id="email"
    name="email"
    required
    aria-required="true"
    aria-invalid="true"
    aria-describedby="email-error">
  <span id="email-error" role="alert" aria-live="assertive">
    Cet email semble incomplet. Vérifiez le format : votre@email.com
  </span>
</div>
```

### 16.11 — Test d'accessibilité — checklist

| Outil                | Usage                                                       |
| :------------------- | :---------------------------------------------------------- |
| **axe DevTools**     | Audit automatique sur chaque déploiement                     |
| **WAVE**             | Audit visuel en complément                                  |
| **Lighthouse**       | Score d'accessibilité ≥ 95/100                              |
| **NVDA + Firefox**   | Test lecteur d'écran Windows                                |
| **VoiceOver + Safari**  | Test lecteur d'écran macOS/iOS                            |
| **TalkBack**         | Test lecteur d'écran Android                                |
| **Keyboard only test** | Compléter une commande complète sans souris               |
| **Color contrast**   | WebAIM Contrast Checker                                      |
| **Form a11y test**   | Soumettre formulaire avec erreurs → vérifier annonces        |
| **Payment flow test**| Tester paiement complet en navigation clavier + lecteur d'écran |

> **Test critique** : compléter une commande **complète** (3 étapes + 3D Secure + succès) en utilisant **uniquement** un lecteur d'écran et le clavier. Si possible avec un utilisateur réel (panel a11y).

---

## 17 — Microcopy & états

### 17.1 — Principe directeur

> Le checkout est plein **d'états dynamiques** : champs valides/invalides, boutons en chargement, paiements réussis/échoués, codes promo applicables ou non. Chaque état nécessite un **microcopy soigné** qui respecte la voix éditoriale tout en étant **fonctionnellement précis**.

Tonalité globale : **paisible, clair, jamais alarmiste, jamais commercial.**

### 17.2 — États des champs (inline validation)

#### Champ Email — étape 1

| État                          | Microcopy                                          |
| :---------------------------- | :------------------------------------------------- |
| Vide (au focus)               | (aucun message)                                     |
| Saisie en cours               | (aucun message — pas de validation onChange)        |
| Blur, valide                  | (aucun message — juste icône ✓ discrète)           |
| Blur, invalide format         | « Cet email semble incomplet. »                     |
| Blur, vide après tentative submit | « Nous avons besoin de votre email pour vous envoyer la confirmation. » |
| Blur, déjà utilisé (compte existant) | « Un compte existe déjà avec cet email. [Se connecter] » |

#### Champ Mot de passe — étape 1

| État                          | Microcopy                                          |
| :---------------------------- | :------------------------------------------------- |
| Vide                          | (aucun message)                                     |
| Saisie < 8 caractères          | (aucun message — patience)                          |
| Blur < 8 caractères            | « Au moins 8 caractères. »                          |

#### Champs Prénom / Nom — étape 2

| État                          | Microcopy                                          |
| :---------------------------- | :------------------------------------------------- |
| Vide                          | (aucun message)                                     |
| Blur, valide                  | (aucun message — succès silencieux)                 |
| Blur, vide                    | « Ce champ est nécessaire pour la livraison. »      |

#### Champ Téléphone — étape 2

| État                          | Microcopy                                          |
| :---------------------------- | :------------------------------------------------- |
| Vide                          | (aucun message)                                     |
| Blur, format invalide          | « Le numéro doit commencer par 6 ou 7 et contenir 9 chiffres. » |
| Blur, indicatif étranger valide | (pas de validation forte, accepter les formats internationaux raisonnables) |

#### Champ Adresse — étape 2

| État                          | Microcopy                                          |
| :---------------------------- | :------------------------------------------------- |
| Vide                          | (aucun message)                                     |
| Blur, < 5 caractères           | « Cette adresse semble incomplète. »                |
| Blur, valide                  | (aucun message — succès silencieux)                 |

#### Select Ville — étape 2

| État                          | Microcopy                                          |
| :---------------------------- | :------------------------------------------------- |
| Non sélectionnée              | (aucun message)                                     |
| Tentative submit sans choix    | « Sélectionnez votre ville pour calculer la livraison. » |

#### Champ Numéro de carte — étape 3

| État                          | Microcopy                                          |
| :---------------------------- | :------------------------------------------------- |
| Vide                          | (aucun message)                                     |
| Saisie < 13 chiffres           | (aucun message — patience)                          |
| Blur, échec algorithme Luhn    | « Ce numéro de carte semble invalide. »             |
| Blur, valide                  | Logo type carte apparaît à droite (Visa, MC, etc.)  |

#### Champ Expiration — étape 3

| État                          | Microcopy                                          |
| :---------------------------- | :------------------------------------------------- |
| Vide                          | (aucun message)                                     |
| Blur, format invalide          | « Format attendu : MM / AA »                        |
| Blur, date passée              | « Cette carte a expiré. »                           |
| Blur, date trop lointaine (>10 ans) | « Vérifiez l'année d'expiration. »            |

#### Champ CVV — étape 3

| État                          | Microcopy                                          |
| :---------------------------- | :------------------------------------------------- |
| Vide                          | (aucun message)                                     |
| Blur, < 3 chiffres             | « 3 chiffres au dos de la carte. »                  |

#### Champ Titulaire — étape 3

| État                          | Microcopy                                          |
| :---------------------------- | :------------------------------------------------- |
| Vide                          | (aucun message)                                     |
| Blur, < 3 caractères           | « Nom du titulaire requis. »                        |

### 17.3 — États du formulaire global

| État                          | Microcopy + comportement                                          |
| :---------------------------- | :--------------------------------------------------------------- |
| Tentative submit avec champs invalides | Scroll automatique vers le **premier** champ invalide + focus sur lui + message d'erreur visible |
| Submit en cours (network)     | Bouton désactivé + spinner + texte « Préparation... »            |
| Submit succès étape 1 → 2     | Animation transition + annonce ARIA « Étape 2 sur 3 : Livraison » |
| Submit succès étape 2 → 3     | Animation transition + annonce ARIA « Étape 3 sur 3 : Paiement »  |
| Submit échec serveur           | Message d'erreur en haut du formulaire : « Une erreur est survenue. Veuillez réessayer. » |
| Submit échec validation serveur | Message du serveur affiché (champ concerné + détail)             |

### 17.4 — États du bouton « Continuer / Confirmer »

| État                          | Apparence + microcopy                                          |
| :---------------------------- | :------------------------------------------------------------- |
| **Repos**                     | Fond Encre, texte « Continuer → » (étapes 1-2) ou « Confirmer la commande · 540 MAD » (étape 3) |
| **Hover**                     | Fond Encre claire, flèche se déplace de 4px à droite           |
| **Active (clic)**             | Scale 0.97 (feedback tactile)                                   |
| **Disabled** (champs invalides) | Fond Brume claire, cursor `not-allowed`, texte inchangé      |
| **Loading** (post-clic)       | Fond Encre, spinner 16×16px à gauche du texte, texte « Préparation... » |
| **Loading paiement étape 3**  | Page intermédiaire de chargement (section 10)                    |

### 17.5 — États du paiement (post-confirmation)

#### Initiation du paiement

```
Préparation de votre paiement.
Vous allez être redirigée vers votre banque.
```

#### Pendant 3D Secure

La cliente est sur la page de la banque (hors site). Au retour :

#### Succès

Redirection automatique vers `/merci?order=FG-2026-XXXXX` (page suivante, hors scope de ce document).

#### Échec — carte refusée

```
┌──────────────────────────────────────────────────┐
│  ⚠ Le paiement n'a pas pu aboutir.                │
│                                                  │
│  Votre banque a refusé la transaction.           │
│  Aucun montant n'a été débité.                   │
│                                                  │
│  Vous pouvez :                                    │
│  • Vérifier que votre carte est active            │
│  • Essayer une autre carte                        │
│  • Choisir le paiement à la livraison             │
│                                                  │
│   ┌──────────────────┐                           │
│   │  Réessayer       │                           │
│   └──────────────────┘                           │
└──────────────────────────────────────────────────┘
```

| Élément              | Spécifications                                                |
| :------------------- | :------------------------------------------------------------ |
| Container            | Fond `#FBE5E5` (rouge feutré très pâle), padding 24px          |
| Border-left          | 3px solid `#9C5B5B` (rouge feutré)                            |
| Icône ⚠               | Couleur `#9C5B5B`, 18×18px                                     |
| Titre                | Inter Medium 14pt, couleur `#9C5B5B`                          |
| Description          | Cormorant Regular 14pt, couleur Encre claire                   |
| Liste options        | Cormorant Regular 13pt, line-height 1.6                       |
| Bouton « Réessayer » | Identique au bouton primary mais en rouge feutré              |
| Position             | En haut du formulaire, scroll automatique                      |

> **Phrase clé** : « **Aucun montant n'a été débité.** » — apparaît systématiquement en cas d'erreur de paiement. Tactique de réassurance critique.

#### Échec — timeout réseau

```
La connexion a été interrompue.
Aucun montant n'a été débité. Vérifiez votre internet et réessayez.
```

#### Échec — 3D Secure refusé

```
La validation de votre banque a échoué.
Aucun montant n'a été débité. Essayez à nouveau ou contactez votre banque.
```

#### Échec — montant insuffisant

```
Votre carte ne permet pas cette transaction.
Aucun montant n'a été débité. Essayez une autre carte ou le paiement à la livraison.
```

#### Échec — CVV incorrect

```
Le code de sécurité ne correspond pas.
Vérifiez les 3 chiffres au dos de votre carte.
```

> **Note** : ce message **n'apparaît que si CMI le retourne explicitement**. Sinon, message générique « refusée par la banque » (pour ne pas faciliter les attaques par force brute).

#### Échec — date d'expiration passée

```
Cette carte a expiré.
Veuillez utiliser une carte valide.
```

### 17.6 — États du code promo

| État                          | Microcopy                                          |
| :---------------------------- | :------------------------------------------------- |
| Vide                          | Bouton désactivé                                    |
| Saisie en cours               | Bouton activé                                       |
| Click Appliquer + valide       | Animation succès : ligne ajoutée au récap « Code MAISON10 · -50 MAD » couleur sauge dark + filet de séparation |
| Click Appliquer + code inexistant | « Ce code n'est pas reconnu. »                  |
| Click Appliquer + code expiré  | « Ce code n'est plus valide. »                      |
| Click Appliquer + code déjà utilisé | « Ce code a déjà été utilisé. »                |
| Click Appliquer + minimum non atteint | « Ce code est valable à partir de 800 MAD d'achat. » |

### 17.7 — États du modal de confirmation (clic wordmark)

```
┌────────────────────────────────────────────────────┐
│                                                    │
│  Quitter le checkout ?                              │
│                                                    │
│  Votre panier sera conservé. Vous pourrez          │
│  reprendre votre commande à tout moment.           │
│                                                    │
│   ┌──────────────────┐   ┌──────────────────┐     │
│   │  Continuer       │   │  Quitter         │     │
│   │  ma commande     │   │                  │     │
│   └──────────────────┘   └──────────────────┘     │
│                                                    │
└────────────────────────────────────────────────────┘
```

| Élément              | Spécifications                                                |
| :------------------- | :------------------------------------------------------------ |
| Titre                | « Quitter le checkout ? » Cormorant Light 22pt                |
| Description          | « Votre panier sera conservé. Vous pourrez reprendre votre commande à tout moment. » |
| CTA primaire         | « Continuer ma commande » (encre plein, focus par défaut)     |
| CTA secondaire       | « Quitter » (outline encre)                                    |

### 17.8 — Modal de recovery — retour sur le checkout sous 24h

```
┌────────────────────────────────────────────────────┐
│                                                    │
│  Reprendre votre commande ?                         │
│                                                    │
│  Vous avez commencé une commande il y a            │
│  [2 heures et 30 minutes]. Votre panier et vos     │
│  informations sont conservés.                       │
│                                                    │
│   ┌──────────────────┐   ┌──────────────────┐     │
│   │  Reprendre       │   │  Recommencer    │     │
│   └──────────────────┘   └──────────────────┘     │
│                                                    │
└────────────────────────────────────────────────────┘
```

> **Calcul du temps écoulé** : « il y a [X heures et Y minutes] », arrondi de manière humaine (« il y a 30 minutes », « il y a 2 heures », « hier » au-delà de 24h, mais alors le state est expiré).

### 17.9 — Mobile keyboard — microcopy contextuel

Sur mobile, certains champs ont des instructions contextuelles juste sous l'input pour aider la cliente :

| Champ          | Texte d'aide mobile                                          |
| :------------- | :----------------------------------------------------------- |
| Email          | (rien — clavier email auto-géré)                             |
| Téléphone      | « Format : 6 12 34 56 78 »                                   |
| Numéro carte   | (rien — clavier numérique + autoformat suffit)                |
| Expiration     | (rien — placeholder MM / AA suffit)                           |

### 17.10 — Tonalité globale — règles éditoriales

**Toujours paisible. Toujours précis. Jamais alarmiste.** Le checkout reste dans la voix de la maison.

| À éviter                                 | À préférer                                              |
| :--------------------------------------- | :------------------------------------------------------ |
| « Erreur ! Champ invalide. »             | « Cet email semble incomplet. »                          |
| « Veuillez remplir ce champ. »           | « Ce champ est nécessaire pour la livraison. »           |
| « Tous les champs sont obligatoires. »   | (justifier pourquoi chaque champ — Sugarman)             |
| « Carte invalide ! »                     | « Ce numéro de carte semble invalide. »                  |
| « Échec du paiement. »                   | « Le paiement n'a pas pu aboutir. »                      |
| « Saisissez votre adresse de facturation »| (ne pas demander si non nécessaire)                     |
| « Inscrivez-vous pour gagner du temps ! »| (pas de pression — opt-in compte non pré-coché)          |
| « Code promo invalide. »                  | « Ce code n'est pas reconnu. »                            |
| « Connection failed »                     | « La connexion a été interrompue. »                       |
| « Order cannot be placed »                | « Une erreur est survenue. Veuillez réessayer. »          |

### 17.11 — Mentions légales et microcopy

#### Sous le bouton « Confirmer la commande »

```
🔒 Paiement sécurisé via CMI · Vos données sont chiffrées
En confirmant, vous acceptez nos CGV et notre politique de confidentialité.
```

| Propriété          | Valeur                                                          |
| :----------------- | :-------------------------------------------------------------- |
| Police             | Inter Regular 11pt                                                |
| Couleur            | `#6B6863` (Brume)                                                |
| Lignes             | 2 lignes (sécurité + acceptation CGV)                            |
| Liens              | « CGV » et « politique de confidentialité » underlinés sauge dark |
| Action liens       | Ouverture nouvel onglet                                           |

> **Acceptation tacite des CGV** : autorisée légalement en France/Maroc si le texte est **clair, visible, juste avant le paiement**, et avec **lien actif** vers les CGV.

### 17.12 — État 404 spécifique au checkout

Si une cliente arrive sur `/commander/etape-4` ou autre URL invalide du checkout :

```
┌────────────────────────────────────────────────────┐
│                                                    │
│      Cette commande s'est égarée.                   │
│                                                    │
│   Mais votre panier vous attend.                    │
│                                                    │
│   ┌──────────────────────┐                         │
│   │  Retour au panier →  │                         │
│   └──────────────────────┘                         │
│                                                    │
└────────────────────────────────────────────────────┘
```

### 17.13 — Emails transactionnels (déclenchés depuis le checkout)

#### Email 1 — Confirmation de commande (succès paiement carte)

**Sujet** : `Votre commande FemiGlow #FG-2026-XXXXX`

**Corps** :
```
Bonjour [Prénom],

Votre commande est confirmée.

Numéro : FG-2026-XXXXX
Total payé : [montant] MAD

Vous recevrez un email de suivi dès l'expédition de votre kit.
Livraison estimée : entre le [date1] et le [date2].

Pour toute question, écrivez-nous : contact@femiglow.ma

[Détail de commande dans un tableau]

Avec soin,
La maison FemiGlow
```

#### Email 2 — Confirmation de commande (paiement à la livraison)

**Sujet** : `Votre commande FemiGlow #FG-2026-XXXXX — Paiement à la livraison`

**Corps** : identique à Email 1, avec mention :
```
Mode de paiement : Paiement à la livraison.
Le livreur vous appellera pour confirmer le rendez-vous.
Préparez la somme exacte ou un mode de paiement carte sans contact.
```

#### Email 3 — Échec de paiement (relance)

**Sujet** : `Votre commande FemiGlow vous attend`

**Corps** :
```
Bonjour [Prénom],

Nous avons remarqué que votre dernière tentative de paiement
n'a pas abouti. Votre panier est sauvegardé — vous pouvez
reprendre où vous vous étiez arrêtée.

[Bouton : Reprendre ma commande]

Pour toute aide, écrivez-nous : contact@femiglow.ma

Avec soin,
La maison FemiGlow
```

> **Trigger** : envoyé 1 heure après l'échec si la cliente n'est pas revenue.

#### Email 4 — Recovery panier abandonné

**Sujet** : `Votre kit vous attend toujours`

**Corps** :
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

> **Trigger** : 24 heures après abandon panier (pas avant — laisser le temps de revenir spontanément).

> **Tonalité** : douce, pas pressante. « Si vous avez changé d'avis, c'est normal. » désamorce l'idée de manipulation marketing.

### 17.14 — Cookies banner

Identique aux autres pages :

```
┌────────────────────────────────────────────────────────────────┐
│  Nous utilisons des cookies pour comprendre votre visite       │
│  et améliorer votre expérience. Aucun partage commercial.      │
│                                                                │
│  [Tout accepter]  [Personnaliser]  Refuser                     │
└────────────────────────────────────────────────────────────────┘
```

> **Sur le checkout** : si la cliente refuse les cookies, le checkout fonctionne **sans tracking**. Pas de blocage UX.

---

## 18 — Sécurité & confidentialité

### 18.1 — Cadre réglementaire

Le checkout `/commander` est soumis à **deux cadres réglementaires majeurs** :

| Cadre               | Périmètre                                                      |
| :------------------ | :------------------------------------------------------------- |
| **RGPD** (UE) + Loi 09-08 (Maroc)| Protection des données personnelles            |
| **PCI-DSS niveau SAQ-A**| Sécurité des paiements par carte bancaire                |

Plus, indirectement :
- **Code de la consommation** (Maroc) — droit de rétractation, CGV
- **Loi 31-08** (Maroc) — protection du consommateur
- **CMI compliance** — règles spécifiques au gateway marocain

### 18.2 — RGPD — données personnelles minimum nécessaire

#### Données collectées sur `/commander`

| Donnée                  | Justification                                | Catégorie       |
| :---------------------- | :------------------------------------------- | :-------------- |
| Email                   | Confirmation + suivi de commande              | Identification   |
| Prénom + Nom            | Étiquette de livraison + facturation          | Identification   |
| Téléphone               | Appel du livreur                              | Contact         |
| Adresse complète         | Livraison physique                            | Contact         |
| Mode de livraison       | Calcul des frais, planning logistique          | Transactionnelle |
| Mode de paiement choisi  | Routing vers gateway approprié                 | Transactionnelle |
| Données carte (numéro/CVV)| **Tokenisées via CMI**, jamais stockées       | Bancaires       |
| Mot de passe (si compte)| **Hashé bcrypt côté serveur**, jamais en clair | Auth            |
| IP, User-Agent          | Anti-fraude (logs de session)                  | Technique        |

#### Données NON collectées

- Date de naissance
- Genre
- Profession / revenus
- Centres d'intérêt
- Données biométriques

> **Principe de minimisation** : on demande **uniquement** ce qui est nécessaire à la livraison + facturation + sécurité.

### 18.3 — RGPD — consentements

| Consentement                       | Mode                                                    |
| :--------------------------------- | :------------------------------------------------------ |
| Newsletter (opt-in)                | Checkbox **non pré-cochée**, libellé clair, désinscription en un clic |
| Création de compte                 | Checkbox **non pré-cochée**                              |
| Mémorisation carte (compte créé)    | Checkbox **non pré-cochée**, dans étape 3                |
| CGV / Politique de confidentialité | Acceptation tacite via clic « Confirmer la commande » + texte visible juste avant |
| Cookies analytics + marketing       | Banner au premier accès — consentement granulaire        |

### 18.4 — RGPD — droits des personnes

Tout email de confirmation contient un lien :

```
Vous pouvez accéder à vos données, les corriger ou les supprimer
à tout moment depuis votre espace personnel — ou en nous écrivant
à contact@femiglow.ma
```

Procédure :
- Demande reçue → traitement sous **30 jours** (légal)
- Droit d'accès : export ZIP contenant toutes les données personnelles
- Droit de rectification : modification directe en base + email de confirmation
- Droit à l'oubli : suppression ou anonymisation des données + conservation des données de facturation 10 ans (obligation comptable)

### 18.5 — PCI-DSS — niveau SAQ-A

#### Architecture conforme

| Composant                | Rôle                                                  |
| :----------------------- | :---------------------------------------------------- |
| Frontend `/commander`    | Affichage du formulaire — **pas** de stockage         |
| Backend Maison           | Reçoit numéro carte, l'envoie immédiatement à CMI **sans** persistance |
| CMI Gateway              | Tokenisation + 3D Secure + débit                       |
| Database Maison          | Stocke uniquement le **token** retourné par CMI + 4 derniers chiffres + nom titulaire |

#### Ce que la maison **NE stocke jamais**

- Numéro de carte complet (PAN)
- CVV / CVC
- Track data (bandeaux magnétiques)
- PIN

#### Ce que la maison stocke (post-tokenisation, uniquement si « Mémoriser » coché)

- Token CMI (pseudo-aléatoire)
- 4 derniers chiffres (affichage UI)
- Nom titulaire
- Date d'expiration

### 18.6 — HTTPS obligatoire — HSTS

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

Toute la page `/commander` (et tout le site) **uniquement en HTTPS**. Aucune ressource (CSS, JS, image) chargée en HTTP — sinon avertissement « contenu mixte » dans les navigateurs.

### 18.7 — CSP — Content Security Policy

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'sha256-XXXXX' https://www.cmi.co.ma https://js.stripe.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https://images.femiglow.ma;
  connect-src 'self' https://api.cmi.co.ma https://api.stripe.com;
  frame-src https://3dsecure.cmi.co.ma https://hooks.stripe.com;
  object-src 'none';
  base-uri 'self';
  form-action 'self' https://3dsecure.cmi.co.ma;
  frame-ancestors 'none';
  upgrade-insecure-requests;
```

> **Pourquoi ce CSP ?** Pour empêcher l'exécution de scripts malveillants (XSS) et limiter la fuite de données via des canaux non autorisés. Critique en checkout.

### 18.8 — Anti-CSRF tokens

Chaque formulaire (étapes 1, 2, 3) contient un token CSRF généré côté serveur, vérifié à chaque soumission :

```html
<input type="hidden" name="_csrf" value="[TOKEN_GENERATED_SERVER_SIDE]">
```

> Empêche les attaques CSRF où un site malveillant tenterait de soumettre un paiement depuis l'extérieur.

### 18.9 — Rate limiting

| Endpoint                          | Limite                                          |
| :-------------------------------- | :---------------------------------------------- |
| `POST /api/checkout/initiate`     | 10 / minute / IP                                 |
| `POST /api/checkout/payment`      | 3 / 10 minutes / IP (limite anti-fraude stricte) |
| `POST /api/checkout/promo-code`   | 20 / minute / IP                                 |
| `GET /api/checkout/state`         | 60 / minute / IP                                 |

### 18.10 — Logs anonymisés

Les logs serveurs **ne contiennent jamais** :
- Numéros de carte (même masqués)
- CVV
- Mots de passe (en clair ou hashés)
- Tokens CMI complets

Ils contiennent :
- Timestamp
- IP (anonymisée après 30 jours — derniers chiffres masqués)
- User-Agent
- Endpoint appelé
- Status HTTP
- Durée de la requête
- Numéro de commande (FG-2026-XXXXX) si applicable

### 18.11 — Encryption at rest

| Type de données          | Encryption                                       |
| :----------------------- | :----------------------------------------------- |
| Database (Postgres)      | Encryption AES-256 at rest                        |
| Backups                  | Encryption AES-256 + clés rotées tous les 90 jours |
| Tokens CMI               | Encryption au niveau base + accès restreint       |
| Mots de passe utilisateur| Hash bcrypt (cost factor 12)                      |

### 18.12 — Retention policy

| Donnée                   | Durée de conservation                             |
| :----------------------- | :----------------------------------------------- |
| Données de commande      | 10 ans (obligation comptable Maroc)              |
| Données personnelles actives| Tant que le compte est actif                  |
| Données après suppression compte | Anonymisation immédiate (sauf comptable)  |
| Logs serveurs            | 12 mois                                           |
| Logs sécurité (intrusions)| 36 mois                                           |
| Cookies analytics        | 13 mois maximum (RGPD)                           |
| Tokens CMI mémorisés      | Tant que le compte est actif + carte non expirée |

### 18.13 — Sous-traitants (sub-processors)

Liste publique dans la Politique de confidentialité :

| Sous-traitant              | Rôle                                | Données traitées            | Localisation        |
| :------------------------- | :----------------------------------- | :-------------------------- | :------------------ |
| **CMI** (Maroc)             | Gateway de paiement                  | Données de carte             | Maroc                |
| **Stripe** (irlandais/USA)  | Gateway alternatif (cartes internationales) | Données de carte         | UE + USA (DPF cert.) |
| **Sendgrid / Mailgun**      | Envoi emails transactionnels         | Email + nom                  | UE                   |
| **Mailchimp**               | Newsletter                           | Email + opt-in               | USA (DPF cert.)      |
| **Hotjar**                  | Analytics UX                         | Recordings session anonymisés| UE                   |
| **Google Analytics 4**      | Analytics                            | IP anonymisée + events       | UE + USA (DPF cert.) |
| **Cloudflare**              | CDN + sécurité                       | Trafic HTTP/HTTPS            | Global               |

Tous les sous-traitants ont signé un **accord de traitement des données (DPA)** conforme RGPD.

### 18.14 — Mentions cookies

Détail dans la Politique de confidentialité (lien depuis le footer + cookies banner) :

| Cookie                    | Type           | Finalité                              | Durée      |
| :------------------------ | :------------- | :------------------------------------ | :--------- |
| `femiglow_session`        | Strictement nécessaire | Authentification, panier        | Session    |
| `femiglow_cart`           | Strictement nécessaire | Sauvegarde du panier             | 30 jours   |
| `femiglow_checkout_state` | Strictement nécessaire | Recovery checkout                | 24 heures  |
| `_ga`, `_ga_XXX`          | Analytics      | Google Analytics 4 (avec consentement) | 13 mois  |
| `_hjid`, `_hjSession_XXX` | Analytics      | Hotjar (avec consentement)             | 13 mois  |

### 18.15 — Procédure de violation de données

En cas de breach :

1. **Détection** → équipe sécurité alertée immédiatement
2. **Containment** → isolation des systèmes compromis
3. **Investigation** → identification des données touchées
4. **Notification** → CNDP (Maroc) sous **72 heures** + utilisateurs concernés sous **délai raisonnable**
5. **Remediation** → patch + audit + post-mortem public

> **Transparence en cas de breach** : la maison s'engage à informer les utilisateurs **même au-delà des obligations légales** si une violation matérielle a impacté leurs données.

### 18.16 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| Stocker le numéro de carte complet                   | Violation PCI-DSS, illégal                                          |
| Logger les CVV                                      | Violation PCI-DSS                                                    |
| Mots de passe en clair                              | Violation RGPD + sécurité catastrophique                            |
| Pas d'HTTPS sur certaines pages                      | Faille immédiate                                                     |
| Cookies tracking avant consentement                  | Violation RGPD                                                       |
| Données partagées avec tiers non listés              | Violation RGPD                                                       |
| Pas de CSP                                          | Vulnérabilité XSS exposée                                            |
| Acceptation CGV pré-cochée                          | Pratique illégale en UE/Maroc                                        |
| Conservation infinie des données                     | Violation RGPD (limitation de finalité)                              |

---

## 19 — Synthèse — checklist de validation

Avant mise en production, vérifier que chaque élément ci-dessous est validé. **C'est l'audit final de la page la plus critique du site**.

### 19.1 — Identité de marque & voix éditoriale (checkout simplifié)

- [ ] Wordmark Pinyon Script présent en header (clic = modal de confirmation)
- [ ] Aucune navigation distractrice dans le header (tunnel without escape — Baymard +5-12%)
- [ ] Mention « Commande sécurisée 🔒 » centrée dans le header
- [ ] Lien « ← Retour au panier » à droite du header
- [ ] Footer simplifié (4 liens légaux ouverts en nouvel onglet)
- [ ] Palette signature respectée (encre + crème + sauge dark, sans champagne — pas de page noble ici)
- [ ] **Pas de Champagne** sur cette page (réservé aux pages éditoriales)
- [ ] Pas d'emoji sauf cadenas 🔒 (trust signal)
- [ ] Pas de countdown, pas d'urgency, pas de FOMO
- [ ] Pas d'upsell de dernière minute
- [ ] Pas de pop-up promotion ou newsletter en checkout
- [ ] Pas de social proof (« 234 personnes commandent en ce moment »)

### 19.2 — Copy & ton (paisible même en formulaire)

- [ ] Étape 1 titre : « Vos informations. »
- [ ] Étape 1 phrase explicative : justification de l'email (Sugarman)
- [ ] Étape 1 opt-ins **non pré-cochés** : newsletter + création de compte
- [ ] Étape 2 titre : « Livraison. »
- [ ] Étape 2 phrase explicative : « Une seule adresse, un seul livreur, et un appel avant de venir. »
- [ ] Étape 2 téléphone justifié : « Pour que le livreur puisse vous appeler. »
- [ ] Étape 2 modes livraison : Standard / Express avec frais transparents
- [ ] Étape 3 titre : « Paiement. »
- [ ] Étape 3 phrase explicative : « Vos données bancaires ne sont jamais stockées chez nous. »
- [ ] Étape 3 méthodes : Carte bancaire (par défaut) / Paiement à la livraison (+20 MAD justifié)
- [ ] Bouton « Confirmer la commande · 540 MAD » avec total inclus
- [ ] Mention finale : « 🔒 Paiement sécurisé via CMI · Vos données sont chiffrées »
- [ ] Tonalité paisible partout : « Cette adresse semble incomplète » vs « Erreur invalide »
- [ ] Apostrophes typographiques courbes ' partout
- [ ] Microcopy d'erreur : toujours « semble » ou conditionnel, jamais alarmiste
- [ ] Page de chargement paiement : « Préparation de votre paiement »
- [ ] Mention critique « Aucun montant n'a été débité » sur tous les échecs

### 19.3 — Tactiques Kolenda — minimum 4 par section

- [ ] **Header simplifié** : `TUNNEL WITHOUT ESCAPE (+5-12% Baymard)` `TRUST SIGNAL SUBTLE (Cialdini)` `REVERSIBILITY PRESERVED` `MODAL FILTER WORDMARK`
- [ ] **Étape 1 Informations** : `SINGLE COLUMN FORM (+15.4% Bachiega)` `JUSTIFICATION EMAIL (Sugarman)` `GUEST CHECKOUT DEFAULT (+24% Baymard)` `OPT-INS NON-PRECOCHES (RGPD)` `CONTINUE > SUBMIT`
- [ ] **Étape 2 Livraison** : `JUSTIFICATION TELEPHONE (Sugarman)` `OPTIONNEL MARQUE EXPLICITEMENT` `HEURISTIQUE DISPONIBILITE VILLES (Tversky)` `GRATUIT CASABLANCA (Ariely)` `DEFAULT STANDARD`
- [ ] **Étape 3 Paiement** : `TRUST SIGNALS x3 (Cialdini)` `DEFAULT BIAS CARTE (Thaler)` `SURCOUT COD = NUDGE SUBTIL` `NO REMEMBER WITHOUT ACCOUNT` `TOTAL DANS BOUTON (Tversky-Kahneman ancrage)`
- [ ] **Récap commande** : `TRANSPARENCE TOTALE` `STICKY SIDEBAR (réassurance constante)` `CODE PROMO COLLAPSE (anti-FOMO inverse)` `MISE A JOUR DYNAMIQUE`
- [ ] **État chargement paiement** : `REDUCE UNCERTAINTY (Norman 1988)` `ANNONCE REDIRECTION` `AUCUN DEBIT` `WARNING DIRECT`

### 19.4 — Performance (cibles strictes)

- [ ] **LCP < 1.8s** sur 4G simulé Maroc
- [ ] **CLS < 0.05** (très strict)
- [ ] **INP < 150ms** (très strict)
- [ ] FCP < 1.0s (header + barre progression visibles vite)
- [ ] TBT < 200ms
- [ ] Page weight initiale (étape 1) < 240 KB
- [ ] Page weight après step 3 chargé < 320 KB
- [ ] JS paiement (CMI/Stripe SDK) lazy-chargé à l'étape 3 uniquement
- [ ] Photo kit récap preloadée avec `fetchpriority="high"`
- [ ] Polices critiques preloaded (Inter Regular/Medium/SemiBold + Cormorant Light + Pinyon)
- [ ] CSS critique inline (header + barre progression + étape 1 + récap)
- [ ] CDN configuré + cache strict (HTML `no-store`, assets immutable)
- [ ] **SSR recommandé** (Next.js, Remix, Astro avec adapter SSR)
- [ ] HTTP `Cache-Control: no-store` sur le HTML (sécurité)

### 19.5 — Mécaniques dynamiques

- [ ] **State management centralisé** TypeScript (3 étapes + cart + ui)
- [ ] **Recovery localStorage 24h** (hors données carte/CVV/password)
- [ ] Modal de recovery au retour : « Reprendre votre commande ? »
- [ ] Synchronisation URL ↔ étape (`?step=1/2/3`)
- [ ] Garde-fou : redirection auto si saut d'étape
- [ ] Deep linking depuis email recovery (token validation backend)
- [ ] **Validation côté serveur** au moment du paiement (anti-tampering)
- [ ] Anti-fraude : reCAPTCHA invisible V3 + velocity check (3/10min/IP)
- [ ] Auto-save throttled (500ms max)
- [ ] Auto-format téléphone marocain (6 12 34 56 78)
- [ ] Auto-format numéro carte (1234 5678 9012 3456)
- [ ] Algorithme de Luhn validation côté client
- [ ] Détection type carte (Visa, Mastercard, etc.)
- [ ] Désactivation bouton pendant traitement (anti double-click)

### 19.6 — Responsive (mobile-first 65%)

- [ ] Mobile 375px, 390px, 414px testés
- [ ] Tablet 768px, 1024px testés
- [ ] Desktop 1280px, 1440px, 1920px testés
- [ ] **Passage 2 colonnes à 1024px** (vs 1280px autres pages)
- [ ] Aucun débordement horizontal à aucune taille
- [ ] **Touch targets ≥ 44×44px** sur tout élément interactif
- [ ] **Texte des inputs ≥ 16px** (anti-zoom iOS)
- [ ] `inputmode` configuré sur tous les champs (email, tel, numeric)
- [ ] Autocomplete HTML5 standard sur tous les champs
- [ ] Récap : sidebar desktop ≥ 1024px / accordéon mobile (fermé par défaut)
- [ ] Total toujours visible dans header accordéon mobile (même fermé)
- [ ] Barre de progression mobile compactée (numéros sans labels < 480px)
- [ ] Prénom/Nom empilés sur mobile, côte à côte desktop
- [ ] Quartier/Ville empilés sur mobile, côte à côte desktop
- [ ] Expiration/CVV côte à côte même en mobile (exception au single column)

### 19.7 — SEO (noindex strict)

- [ ] **Meta robots `noindex, nofollow, noarchive, nosnippet, noimageindex`**
- [ ] HTTP header `X-Robots-Tag: noindex, nofollow`
- [ ] Robots.txt : `Disallow: /commander`
- [ ] **Pas d'Open Graph image** (volontaire — éviter previews attractifs)
- [ ] Title minimal : « Commander · FemiGlow »
- [ ] Meta description courte
- [ ] **Pas de Schema.org** sur cette page
- [ ] Pas dans le sitemap.xml
- [ ] Liens internes vers `/commander` avec `rel="nofollow"`
- [ ] Tracking GA4 + funnel events configuré
- [ ] Aucun tracking actif avant consentement cookies

### 19.8 — Accessibilité (WCAG 2.2 AA strict)

- [ ] WCAG 2.2 AA validé via axe-core
- [ ] Lighthouse Accessibility score ≥ 95/100
- [ ] Contrastes vérifiés (textes critiques en AAA)
- [ ] Navigation clavier complète (séquence Tab cohérente par étape)
- [ ] Focus ring visible (sauge dark 2px offset 4px)
- [ ] **ARIA landmarks** : banner / main / aside / contentinfo
- [ ] **ARIA live regions** pour annonces dynamiques :
  - [ ] Validation inline (`role="alert"` sur erreurs)
  - [ ] Changements d'étape (`role="status" aria-live="assertive"`)
  - [ ] Mise à jour montant récap (`aria-live="polite"`)
  - [ ] État du paiement (`role="status" aria-live="assertive"`)
- [ ] Labels associés à tous les inputs (`for`/`id`)
- [ ] **Fieldset + legend** pour groupes radio (modes livraison, méthodes paiement)
- [ ] `aria-required="true"` sur champs obligatoires
- [ ] `aria-invalid="true"` quand erreur, cleared au refocus
- [ ] `aria-describedby` liant erreurs et help text aux inputs
- [ ] **3 skip links** : main / récap / checkout-controls
- [ ] `prefers-reduced-motion` respecté (animations + transitions + spinner conservé essentiel)
- [ ] Test NVDA, VoiceOver, TalkBack
- [ ] **Test critique** : compléter une commande complète au clavier + lecteur d'écran

### 19.9 — Sécurité & confidentialité

- [ ] **HTTPS uniquement** + HSTS (`max-age=63072000; includeSubDomains; preload`)
- [ ] CSP strict configuré (script-src, frame-src, form-action)
- [ ] Anti-CSRF tokens sur tous les formulaires
- [ ] Rate limiting (3 paiements / 10min / IP)
- [ ] **PCI-DSS niveau SAQ-A** : pas de stockage carte chez la maison
- [ ] Tokenisation CMI activée
- [ ] **3D Secure 2.0 obligatoire** sur cartes
- [ ] Mots de passe bcrypt (cost factor 12)
- [ ] Encryption AES-256 at rest (database + backups)
- [ ] Logs anonymisés (pas de données carte, pas de CVV)
- [ ] **RGPD strict** :
  - [ ] Consentements explicites (opt-ins non pré-cochés)
  - [ ] Politique de confidentialité accessible depuis footer
  - [ ] Droits accès / rectification / suppression documentés
  - [ ] Liste des sous-traitants publique
  - [ ] DPA signé avec chaque sous-traitant
- [ ] Cookies banner avant tout tracking
- [ ] Procédure de violation de données documentée (notification CNDP < 72h)

---

> *« Un checkout qui s'efface devant la cliente. Pas un formulaire qui demande, mais une maison qui accompagne. Trois étapes, zéro friction inutile, total transparent — et la voix de la maison qui ne se rompt pas même quand il faut taper une adresse. »*

**FIN · FemiGlow · Spécification de la page Commander v1.0 · Mai 2026**

*Prochaines spécifications (B2C) à produire : `/merci` (post-achat — confirmation, suivi, partage), `/panier` (panier intermédiaire), `/journal/[slug]` (page article — TOC, scroll-spy, partage).*

*B2B à venir : `/partenaires`, `/programme`, `/echantillon ★`, `/espace-pro`.*
