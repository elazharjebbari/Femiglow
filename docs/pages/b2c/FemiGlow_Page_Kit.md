# Page Kit — `/kit`

> **Univers Particulier · B2C · ★ Pivot de conversion** — Document de spécification détaillée
> *Volume V · Mai 2026 · Complémentaire à la charte graphique et au document d'architecture.*

---

## Sommaire

1. [Identité de la page](#1--identité-de-la-page)
2. [Contexte stratégique](#2--contexte-stratégique)
3. [Architecture verticale globale](#3--architecture-verticale-globale)
4. [Header — élément persistant](#4--header--élément-persistant)
5. [Section 01 — Above the fold · le moment de vérité](#5--section-01--above-the-fold--le-moment-de-vérité)
6. [Section 02 — Composition · slow reveal](#6--section-02--composition--slow-reveal)
7. [Section 03 — Vidéo des quatre gestes](#7--section-03--vidéo-des-quatre-gestes)
8. [Section 04 — Composition détaillée par pot](#8--section-04--composition-détaillée-par-pot)
9. [Section 05 — Comparatif vernis vs rituel](#9--section-05--comparatif-vernis-vs-rituel)
10. [Section 06 — FAQ contextuelle](#10--section-06--faq-contextuelle)
11. [Section 07 — Témoignages photos-mains](#11--section-07--témoignages-photos-mains)
12. [Section 08 — CTA final + cross-link Journal](#12--section-08--cta-final--cross-link-journal)
13. [Footer — élément persistant](#13--footer--élément-persistant)
14. [Comportements transverses & mécaniques de panier](#14--comportements-transverses--mécaniques-de-panier)
15. [Adaptation responsive](#15--adaptation-responsive)
16. [Performance technique](#16--performance-technique)
17. [SEO & métadonnées](#17--seo--métadonnées)
18. [Accessibilité (a11y)](#18--accessibilité-a11y)
19. [Microcopy & états du panier](#19--microcopy--états-du-panier)
20. [Synthèse — checklist de validation](#20--synthèse--checklist-de-validation)

---

## 1 — Identité de la page

| Attribut             | Valeur                                                                  |
| :------------------- | :---------------------------------------------------------------------- |
| **URL**              | `femiglow.ma/kit`                                                       |
| **Type**             | Fiche produit unique · pivot de conversion ★                            |
| **Audience**         | Cliente en phase de décision — femme 28-45 ans, urbaine                 |
| **Profil cognitif**  | Convaincue émotionnellement (vient de `/rituel`) OU directe Instagram (moins convaincue, plus rationnelle) |
| **Pouvoir d'achat**  | CSP B / B+ — peut payer 320 dh sans réfléchir, mais veut être rassurée  |
| **Funnel**           | **BOFU** — Bottom of Funnel · Conversion                                |
| **Position parcours**| Pré-décision · 1 à 2 minutes avant l'action d'achat                     |
| **Durée d'attention**| 90 secondes à 4 minutes (en fonction du profil — convaincue ou prudente)|
| **Device split**     | Mobile 72% · Desktop 22% · Tablet 6% (BOFU = mobile dominant)            |
| **Catalogue**        | Mono-SKU — un seul produit, pas de variantes (taille, parfum, couleur)  |

### Ce que la page **doit** faire

1. **Convertir.** C'est la mission première. Tout le reste est moyen au service de cette fin.
2. **Rassurer rationnellement.** La cliente émotionnellement convaincue cherche maintenant des **preuves logiques** : composition, livraison, retour, paiement, témoignages.
3. **Lever toutes les objections silencieuses.** *« Et si ça ne marche pas ? Et si ça abîme mes ongles ? Et si je ne sais pas faire ? »* — chaque section répond à une objection.
4. **Préserver l'esthétique éditoriale.** Une fiche produit luxe ne ressemble pas à une fiche Amazon. Le code visuel reste celui de la maison.
5. **Faciliter l'action.** Un seul CTA possible (`Recevoir le rituel`), répété en bas pour la cliente qui n'a pas converti au-dessus du pli.

### Ce que la page **ne doit pas** faire

1. **Vendre par l'urgence.** Aucun « Plus que X en stock », aucun countdown, aucun « Offre limitée ». Le luxe ne crie pas.
2. **Surcharger d'options.** Pas de sélecteur taille/couleur, pas de bundle complexe, pas de up-sell agressif. **Mono-SKU = mono-décision**.
3. **Imiter Amazon.** Pas d'étoiles 5/5, pas de « Top vente », pas de « Sponsorisé », pas de comparatif fluide « les clients ont aussi acheté ».
4. **Cacher des frais.** La livraison et les frais sont visibles dès l'above the fold. La transparence absolue est la condition de la confiance luxe.
5. **Briser l'émotion par le commerce.** Le panier glisse en douceur, pas avec une animation criarde. La conversion **honore** l'état émotionnel de la cliente.

---

## 2 — Contexte stratégique

### Position dans le parcours utilisateur B2C

```
[ARRIVÉE]                       [PAGE KIT /kit]                  [SUITE]
    │                               │                              │
/rituel ────────────►       Above the fold ◀── 70% conversions  /panier (modal)
Instagram (direct) ────►    Composition          → /commander
Newsletter ────────────►    Vidéo (rappel)        → (abandon)
Recherche ─────────────►    Comparatif            → (sortie)
Bouche à oreille ──────►    FAQ
                            Témoignages
                            CTA final ◀───────── 30% conversions
                            Cross-link Journal
```

### Le profil double de la visiteuse

| Profil A — La convaincue                              | Profil B — La directe                                  |
| :---------------------------------------------------- | :----------------------------------------------------- |
| Vient de `/rituel`                                    | Vient d'une pub Instagram ou d'une recherche           |
| A lu 3-5 minutes d'éditorial                          | N'a pas lu l'éditorial                                 |
| État émotionnel : conviction calme                    | État émotionnel : intérêt + scepticisme                |
| Cherche : confirmation, action                        | Cherche : preuves, démonstration                       |
| Convertit en 60-90 secondes                           | Convertit en 3-4 minutes (lit tout)                    |
| Lit l'above the fold puis clique                      | Lit tout, parfois revient au-dessus du pli              |
| ~50% du trafic                                        | ~50% du trafic                                         |

> **La page doit servir les deux profils sans contradiction.** L'above the fold doit suffire à A (qui ne descend pas). Le below the fold doit construire la conviction de B (qui décortique tout).

### Les 9 risques perçus à neutraliser (Lantos, 2011)

Avant chaque achat, le cerveau du consommateur évalue 9 types de risques. La page doit en désamorcer le plus possible :

| Type de risque       | Manifestation concrète                                | Section qui répond                  |
| :------------------- | :---------------------------------------------------- | :---------------------------------- |
| **Financier**        | « Et si ça ne vaut pas 320 dh ? »                     | Above the fold (prix rond + composition visible) |
| **Fonctionnel**      | « Et si ça ne marche pas sur mes ongles ? »           | Sciences (`/rituel`) + témoignages  |
| **Physique**         | « Et si ça abîme mes ongles ? »                       | Composition détaillée + comparatif  |
| **Psychologique**    | « Et si je regrette mon achat ? »                     | Retour 14j visible                  |
| **Social**           | « Et si mes proches trouvent ça bizarre ? »            | Témoignages (mimétisme local)       |
| **Temporel**         | « Et si je mets trop de temps à apprendre ? »         | FAQ + vidéo des gestes              |
| **Écologique**       | « Et si c'est plein de produits chimiques ? »         | Composition + engagements maison    |
| **Sanitaire**        | « Et si ça provoque une allergie ? »                  | FAQ « Allergies » + composition     |
| **Légal**            | « Et si je n'ai pas de recours en cas de problème ? »  | CGV + retour + paiement sécurisé    |

> Chaque section de `/kit` adresse un ou plusieurs de ces risques. **Aucun risque ne doit rester sans réponse implicite ou explicite.**

### Tension stratégique fondamentale

> Une fiche produit luxe vit dans une tension : **donner toutes les informations** sans **dévaluer la magie**. Si on en dit trop, le produit redevient un objet utilitaire. Si on en dit trop peu, la cliente abandonne sur le doute. La page `/kit` doit doser — chaque section donne l'information juste, dans la forme juste.

### Architecture émotionnelle

| Section                 | Émotion d'entrée    | Émotion de sortie       | Conversion possible ?           |
| :---------------------- | :------------------ | :---------------------- | :------------------------------ |
| 01. Above the fold      | Conviction calme OU intérêt | Décision (~50%) | **OUI** — le pic de conversion  |
| 02. Composition slow reveal | Décision OU lecture continuée | Désir matériel | OUI                          |
| 03. Vidéo               | Désir matériel      | Compréhension corporelle | OUI                            |
| 04. Composition par pot | Curiosité technique | Rassurance scientifique | OUI                             |
| 05. Comparatif          | Comparaison         | Différenciation acceptée | OUI                            |
| 06. FAQ                 | Doutes résiduels    | Doutes levés            | OUI                             |
| 07. Témoignages         | Identification recherchée | Confiance sociale | OUI                              |
| 08. CTA final           | Tout vu             | Décision finale         | **OUI** — second pic            |

### KPIs cibles

| Métrique                                    | Cible                            | Source                       |
| :------------------------------------------ | :------------------------------- | :--------------------------- |
| Taux de conversion page (sur visiteurs)     | > 4.5%                           | GA4 / Shopify analytics       |
| Taux de conversion above the fold           | > 2.5%                           | Heat map + scroll tracking    |
| Add-to-cart rate                            | > 8%                             | Event tracking                |
| Taux d'abandon panier après ATC              | < 50%                            | GA4 funnel                   |
| Temps moyen sur la page                     | 1:30 à 3:00                      | GA4                          |
| Scroll depth ≥ 50%                          | > 65% des sessions               | Hotjar                       |
| Scroll depth ≥ 90%                          | > 30%                            | Hotjar                       |
| Watch rate vidéo (≥ 50%)                    | > 30% des arrivants              | Player analytics             |
| Click sur FAQ (au moins une question)        | > 25% des sessions               | Event tracking               |
| Click sur comparatif (interaction)           | > 18%                            | Event tracking               |
| LCP                                         | < 2.0s (BOFU = critique)         | Web Vitals                   |
| CLS                                         | < 0.05 (très strict)             | Web Vitals                   |
| INP                                         | < 150ms (interactions ATC fluides)| Web Vitals                  |

> **Note BOFU** : sur cette page, **chaque seconde compte**. Un LCP de 3s sur `/kit` peut faire perdre 15-20% des conversions (Akamai 2017). C'est pourquoi les cibles Web Vitals sont plus strictes que sur `/rituel`.

---

## 3 — Architecture verticale globale

### Vue d'ensemble — desktop ≥ 1280px

```
┌─────────────────────────────────────────────────────────────────────┐
│  [HEADER — sticky · 80px · CTA panier compteur animé à l'ATC]       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  01. ABOVE THE FOLD — LE MOMENT DE VÉRITÉ                           │
│      Photo contextuelle (gauche) · Bloc info (droite)               │
│      Titre · Prix rond · CTA · Réassurances                         │
│      Hauteur : 88vh                                                 │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  02. COMPOSITION · SLOW REVEAL                                      │
│      4 photos zoom-in successives (paste · powder · shine · polish) │
│      Scroll-triggered, plein écran                                  │
│      Hauteur : 720px                                                │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  03. VIDÉO DES QUATRE GESTES                                        │
│      (Réutilisée de /rituel — version courte 60s)                   │
│      Player custom · captions FR/AR                                 │
│      Hauteur : 80vh                                                 │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  04. COMPOSITION DÉTAILLÉE PAR POT                                  │
│      4 mini-fiches (paste · powder · shine · polish)                │
│      Ingrédients · fonction · matière                               │
│      Hauteur : 680px                                                │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  05. COMPARATIF VERNIS VS RITUEL                                    │
│      Tableau 3 colonnes · 6 critères                                │
│      Vernis classique / Vernis semi / Rituel FemiGlow               │
│      Hauteur : 540px                                                │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  06. FAQ CONTEXTUELLE                                               │
│      9 questions accordéon                                          │
│      Composition · usage · livraison · retour · cadeau              │
│      Hauteur : 580px (replié) · auto (déplié)                       │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  07. TÉMOIGNAGES PHOTOS-MAINS                                       │
│      3 témoignages longs (60-100 mots)                              │
│      Photos contextuelles · sans visages                            │
│      Hauteur : 620px                                                │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  08. CTA FINAL + CROSS-LINK JOURNAL                                 │
│      Bandeau sauge avec CTA dupliqué                                │
│      3 articles connexes en grille régulière                        │
│      Hauteur : 580px                                                │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  [FOOTER — encre · 320px]                                           │
└─────────────────────────────────────────────────────────────────────┘
```

### Hauteur totale approximative

- **Desktop (1440×900)** : ~5 200px (5.8 viewports — page produit dense mais lisible)
- **Tablet (768×1024)** : ~5 800px (5.7 viewports)
- **Mobile (390×844)** : ~6 800px (8.0 viewports)

### Le concept de la *décision dégressive*

```
Above the fold (88vh)                    ←─ 50% des conversions ici
   │
   │ Si pas convertie ⇣ → continuer la lecture
   │
Composition slow reveal                  ←─ 15% des conversions
   │
Vidéo gestes                            ←─ 5% des conversions
   │
Composition par pot + comparatif        ←─ 10% des conversions
   │
FAQ + témoignages                        ←─ 12% des conversions
   │
CTA final dupliqué                       ←─ 8% des conversions

                                          → 100% conversions cumulées
```

> **Principe** : la page est conçue pour **maximiser la conversion above the fold** (objectif principal), tout en construisant un **filet de sécurité narratif** pour les 50% qui ne convertissent pas immédiatement. Aucune section n'est superflue — chaque section sauve un pourcentage de conversions.

### Rythme de lecture intentionnel

| Section          | Densité       | Rythme                  | Type de contenu              |
| :--------------- | :------------ | :---------------------- | :--------------------------- |
| 01. Above fold   | Très dense    | Lecture rapide / décision | Photo + texte serré        |
| 02. Slow reveal  | Très aérée    | Contemplative           | 4 photos plein écran         |
| 03. Vidéo        | Pleine page   | Immersion               | Visuel                       |
| 04. Composition  | Structurée    | Compréhension articulée | 4 mini-fiches                |
| 05. Comparatif   | Tabulaire     | Vérification rapide     | Tableau                      |
| 06. FAQ          | Repliable     | Lecture sélective       | Accordéons                   |
| 07. Témoignages  | Conversationnelle | Mimétisme           | 3 cartes                     |
| 08. CTA final    | Aérée         | Décision finale         | Bandeau + 3 cartes           |

> **Principe** : alternance dense/aérée. Mais la **densité d'information** monte progressivement — la cliente se *prépare* à acheter à mesure qu'elle descend.

---

## 4 — Header — élément persistant

### Comportement spécifique sur `/kit`

Le header est globalement identique à celui de `/accueil` et `/rituel`, **avec deux différences cruciales** :

| Différence                  | Spécification                                                              |
| :-------------------------- | :------------------------------------------------------------------------- |
| **Item actif**              | « KIT » dans le menu : couleur Encre `#2C2A28`, underline 1px sauge dark, offset 6px |
| **CTA panier**              | **Animation crucial** lorsque la cliente clique « Recevoir le rituel » → le compteur passe de 0 à 1 avec une **animation pulse + scale + couleur** (voir détail ci-dessous) |

### Animation Add-to-Cart du panier

Quand la cliente clique sur le CTA primaire `Recevoir le rituel`, l'animation suivante se déclenche :

```
[t=0ms]      → Click sur CTA
[t=0-100ms]  → CTA scale 0.97 (feedback tactile)
[t=100-300ms]→ CTA fade-out + spinner mini visible
[t=300-500ms]→ Server response (idéal < 200ms)
[t=500-800ms]→ Animation : un mini "pot" sauge sort du CTA et "vole" vers le panier
[t=800-1100ms]→ Panier compteur 0 → 1 avec :
                - Scale pulse (1 → 1.15 → 1) en 600ms
                - Fond sauge → champagne → sauge en 800ms
                - Compteur affiche "1" en Inter Medium 13pt
[t=1100-1300ms]→ CTA original revient avec texte "Ajouté au rituel ✓" pendant 1500ms
[t=2800ms]   → CTA revient à son texte original "Recevoir le rituel"
```

#### Justification psychologique de cette animation

> Hampton & Hildebrand (2021) : *« Pavlov's Buzz? Mobile Vibrations as Conditioned Rewards. Paired with selection feedback, vibrations create a conditioned reward response. »*

L'animation du pot qui « vole » vers le panier est une **conséquence visuelle immédiate** de l'action. Elle :

1. **Confirme l'action** (pas de doute *« est-ce que ça a marché ? »*)
2. **Récompense le clic** (effet dopaminergique du feedback positif)
3. **Crée un lien spatial** entre le CTA et le panier (la cliente sait où retrouver son achat)
4. **Préserve l'esthétique** (animation sobre, pas de confettis ou d'emoji)

> **Tactique Kolenda** : `KOLENDA · TACTILE FEEDBACK 400MS+` — le feedback visuel doit durer suffisamment longtemps pour être perçu (Li et al., 2024).

### Sticky panier modal après ATC

Après l'animation, un **mini modal panier** glisse depuis la droite (animation 320ms ease-out) :

```
┌────────────────────────────────────────┐
│                                        │
│  ✓  Ajouté à votre rituel              │
│                                        │
│  ┌──────┐  Kit Rituel d'Éclat          │
│  │ pic  │  Le rituel complet · 4 étapes│
│  │ kit  │  320 dh                      │
│  └──────┘                              │
│                                        │
│  ┌─────────────────────────────────┐   │
│  │  Voir mon panier                │   │
│  └─────────────────────────────────┘   │
│                                        │
│  ─                                     │
│                                        │
│  Continuer la lecture                  │
│                                        │
└────────────────────────────────────────┘
```

| Propriété              | Valeur                                                |
| :--------------------- | :---------------------------------------------------- |
| Largeur                | 360px (desktop) · 100% - 32px marges (mobile)         |
| Position               | `position: fixed`, top 80px (sous header), right 24px |
| Fond                   | `#FBF8F1` (Crème pure) · ombre `box-shadow: 0 8px 32px rgba(44,42,40,0.12)` |
| Padding                | 24px                                                  |
| Border-radius          | 0                                                     |
| Animation entrée       | Slide-in from right + fade-in, 320ms ease-out         |
| Auto-close             | 8 secondes après apparition (sauf interaction)        |
| Manual close           | Click extérieur ou bouton × en haut-droite             |
| Click « Voir mon panier » | Navigation vers `/panier`                          |
| Click « Continuer la lecture » | Modal fade-out 240ms, retour à la page         |

> **Pourquoi un mini modal et pas une redirection directe ?** Parce que la cliente peut vouloir continuer à lire (par exemple, vérifier la FAQ avant le checkout). Lui imposer une redirection détruirait la confiance. Le mini modal **propose** sans **imposer**.

### CTA panier compteur — état final

Après l'animation et la fermeture du mini modal, le CTA panier dans le header reste avec :

```
[Panier · 1]
```

| Propriété         | Valeur                                                    |
| :---------------- | :-------------------------------------------------------- |
| Fond              | `#C5DBC4` (Sauge) — couleur normale                       |
| Texte             | « Panier · 1 »                                            |
| Police            | Inter Medium 13pt                                         |
| État              | Toujours cliquable, mène à `/panier`                      |
| Persistance       | Compteur conservé en cookie 7 jours (panier abandonné)    |

### Tactiques psychologiques héritées

Les tactiques `4 OPTIONS MAX`, `ENTRY POINT FOCAL`, `GROUP SIMILAR ITEMS`, `FRIENDLY COLD`, `STICKY MOMENTUM` sont identiques à `/accueil` et `/rituel`.

### Pas de barre de progression sur `/kit`

Contrairement à `/rituel`, **pas de barre de progression de scroll** sur `/kit`. Pourquoi ? Parce que `/kit` n'est pas une page de lecture — c'est une page de **décision**. La barre de progression suggérerait que la cliente doit *« finir »* la page avant d'agir. Or, la conversion peut se faire dès l'above the fold.

---

## 5 — Section 01 — Above the fold · le moment de vérité

### 5.1 — Wireframe complet

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│  ┌────────────────────────────┐    ┌──────────────────────────────────┐  │
│  │                            │    │                                  │   │
│  │                            │    │  KIT RITUEL                      │   │
│  │                            │    │                                  │   │
│  │                            │    │  Le rituel d'éclat,              │   │
│  │  [PHOTO CONTEXTUELLE]      │    │  en quatre pots.                 │   │
│  │  [Kit complet posé sur     │    │                                  │   │
│  │   marbre crème, à côté     │    │  Quatre matières japonaises pour  │   │
│  │   d'une main détendue,     │    │  préparer, lisser, polir, révéler.│   │
│  │   tasse de thé en flou]    │    │                                  │   │
│  │  [Lumière naturelle]       │    │  ──                              │   │
│  │  [Profondeur de champ      │    │                                  │   │
│  │   maîtrisée]               │    │  320 dh                          │   │
│  │                            │    │                                  │   │
│  │                            │    │  ┌───────────────────────────┐   │   │
│  │                            │    │  │   Recevoir le rituel      │   │   │
│  │                            │    │  └───────────────────────────┘   │   │
│  │                            │    │                                  │   │
│  │                            │    │  ─ Livraison 48h Casa            │   │
│  │                            │    │  ─ Retour 14j sans condition     │   │
│  │                            │    │  ─ Paiement 3× sans frais        │   │
│  │                            │    │                                  │   │
│  └────────────────────────────┘    └──────────────────────────────────┘  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 — Disposition générale

| Breakpoint | Layout                                                                |
| :--------- | :-------------------------------------------------------------------- |
| Desktop    | 55% photo (gauche) · 45% bloc info (droite) — gap 64px                |
| Tablet     | 50% photo · 50% bloc info — gap 48px                                  |
| Mobile     | 100% photo (haut) · 100% bloc info (bas) — gap 32px                   |

Hauteur de la section : **88vh** sur desktop · **calculée** sur mobile (auto, pas de hauteur fixe pour éviter le débordement avec les réassurances).

> **Pourquoi 55/45 sur desktop (et pas 50/50) ?** Parce que la photo doit dominer visuellement. La cliente luxe achète **par les yeux d'abord, par la raison ensuite**. Le bloc info est dense en information mais doit rester second visuellement.

### 5.3 — Photo contextuelle (gauche)

#### Composition de la photo

| Propriété          | Valeur                                                                |
| :----------------- | :-------------------------------------------------------------------- |
| Sujet principal    | Le kit complet (4 pots + accessoires) posé sur une surface marbre crème |
| Sujets secondaires | Une main détendue à côté · une tasse de thé tiède en flou · un linge plié |
| Composition        | Règle des tiers — kit en bas-gauche, main en haut-droite, tasse arrière-plan flou |
| Focale équivalente | 50mm (vision humaine, pas trop intime)                                |
| Ouverture          | f/4 — profondeur de champ moyenne (kit net, fond légèrement flou)     |
| Lumière            | Naturelle latérale, fenêtre haute, fin de matinée                      |
| Tonalité           | Calibrage chaud, ombres terreuses, hautes lumières crème              |
| Saturation         | Neutre (-5% maximum) — la matière doit être **fidèle**                |
| Format             | 4:5 (portrait) sur desktop · 1:1 (carré) sur tablet · 4:5 sur mobile  |
| Hauteur affichage  | ~80vh sur desktop · auto sur mobile                                    |
| Largeur            | 55% de la viewport (desktop) · 100% (mobile)                          |

#### Pourquoi une photo contextuelle (et pas isolée fond blanc) ?

> **González, Meyer, & Toldos (2021)** — Étude sur 1 400 photos produit beauté : *« Women significantly prefer contextual photos over isolated product shots. Contextual photos increase purchase intention by 34% in the cosmetics category. »*

Une photo isolée fond blanc dit : *« Ceci est un produit Amazon. »*
Une photo contextuelle dit : *« Voici ce produit dans la vie d'une femme comme vous. »*

Le contraste est radical pour la perception luxe. Sevilla & Townsend (2016) confirment : les marques luxe affichent presque exclusivement des photos contextuelles.

#### Direction artistique précise

| Élément photographique     | Direction                                                       |
| :------------------------- | :-------------------------------------------------------------- |
| **Surface**                | Marbre crème véritable (pas du Carrara, trop froid — du marbre Travertin doux) |
| **Position du kit**        | Les 4 pots alignés, légèrement en biais, étiquettes lisibles    |
| **Linge**                  | Coton beige naturel, plié sans froissement excessif              |
| **Tasse**                  | Porcelaine blanche, pas de logo, thé clair (pas un café)        |
| **Main**                   | Détendue, ongles **non vernis** (showing the *before* state subtly) |
| **Lumière**                | Naturelle, jamais studio — la dureté studio détonne              |
| **Heure de prise**         | 10h-11h ou 16h-17h (golden hour douce)                          |
| **Post-traitement**        | Léger — préserver la peau, éviter le smoothing artificiel       |

#### Animation d'entrée de la photo

```
[t=0ms]      → Page chargée, fond crème uni à gauche
[t=200ms]    → Photo fade-in 1000ms ease-out
[t=600ms]    → Bloc info droite : titre fade-in (700ms)
[t=1100ms]   → Sous-titre + prix (500ms)
[t=1500ms]   → CTA fade-in + translate-up 8px (600ms)
[t=2000ms]   → Réassurances apparaissent en cascade (200ms entre chacune)
[t=2400ms]   → Animations terminées
```

> **Règle critique pour le LCP** : la photo above the fold est l'élément LCP. Elle doit être **preloadée** (`<link rel="preload" as="image">`). Cible : photo affichée < 1.5s. Sans cela, le LCP dépasse 2.5s et la conversion BOFU chute de 15-20%.

### 5.4 — Titre + sous-titre (bloc info, droite)

#### Surtitre (kicker)

```
KIT RITUEL
```

| Propriété      | Valeur                                              |
| :------------- | :-------------------------------------------------- |
| Police         | Inter SemiBold                                      |
| Taille         | 8pt (desktop) · 7.5pt (mobile)                       |
| Letter-spacing | 3.5px                                               |
| Couleur        | `#6B6863` (Brume) — pas Champagne                   |
| Transformation | uppercase                                            |
| Position       | En haut du bloc info, marge gauche identique au texte |

> **Pourquoi pas Champagne ici ?** Parce que `/kit` est une fiche produit, pas une page éditoriale. Le Champagne est réservé aux **moments narratifs** (hero `/rituel`, fleurons des manifestes). Sur une fiche produit, il serait dévalué par le contexte commercial.

#### Titre principal

```
Le rituel d'éclat,
en quatre pots.
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Light                                     |
| Taille          | 48pt (desktop) · 36pt (tablet) · 32pt (mobile)               |
| Line-height     | 1.1                                                          |
| Letter-spacing  | -0.5px                                                        |
| Couleur         | `#2C2A28` (Encre)                                            |
| Disposition     | Deux lignes — la coupure est volontaire après la virgule      |
| Espacement haut | 16px sous le surtitre                                         |

##### Pourquoi cette formulation ?

Le titre fait écho à `/accueil` (« Le rituel d'éclat ») mais ajoute la précision matérielle (« en quatre pots »).

- **« Le rituel d'éclat »** — rappel de la promesse principale, signal de continuité de marque.
- **« en quatre pots »** — matérialisation. La cliente comprend qu'elle achète **un objet**, pas un service ou un abonnement.

> **Comparaison avec `/rituel`** : sur `/rituel`, le titre était philosophique (*« Quatre minutes pour retrouver une lumière... »*). Ici, il est **matériel** — la cliente est passée du désir à la décision, le titre l'accompagne.

#### Sous-titre

```
Quatre matières japonaises pour préparer,
lisser, polir, révéler.
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Light Italic                              |
| Taille          | 17pt (desktop) · 15pt (tablet) · 14pt (mobile)               |
| Line-height     | 1.5                                                          |
| Couleur         | `#4A4844` (Encre claire)                                     |
| Disposition     | Deux lignes                                                   |
| Espacement haut | 20px sous le titre principal                                  |

##### Décomposition stratégique du sous-titre

| Fragment                              | Fonction stratégique                                       |
| :------------------------------------ | :--------------------------------------------------------- |
| « Quatre matières »                   | Précision — pas un produit composite, **quatre éléments distincts** |
| « japonaises »                        | Rappel de l'héritage (continuité avec `/rituel`)            |
| « préparer, lisser, polir, révéler »  | Les 4 verbes du rituel — chaque pot a sa fonction          |

#### Filet séparateur

Sous le sous-titre, un filet horizontal court sépare la partie « identification produit » de la partie « action » :

```
──
```

| Propriété      | Valeur                                |
| :------------- | :------------------------------------ |
| Type           | Filet sauge dark                      |
| Largeur        | 32px                                  |
| Hauteur        | 1.5px                                 |
| Couleur        | `#A8C4A6` (Sauge dark)                |
| Espacement haut| 32px (sous le sous-titre)             |
| Espacement bas | 32px (avant le prix)                   |
| Alignement     | Aligné à gauche (pas centré)          |

> **Pourquoi ce filet ?** Parce qu'il **structure visuellement** le bloc info en deux parties : (1) qu'est-ce que c'est, (2) combien ça coûte et comment l'avoir. Sans ce filet, le prix paraîtrait collé au sous-titre. Le filet crée une **respiration**.

### 5.5 — Prix — rond, sans concession

```
320 dh
```

| Propriété          | Valeur                                                         |
| :----------------- | :------------------------------------------------------------- |
| Police             | Cormorant Garamond Light                                       |
| Taille             | 36pt (desktop) · 28pt (tablet) · 24pt (mobile)                 |
| Couleur            | `#2C2A28` (Encre)                                              |
| Disposition        | Une ligne, aligné à gauche                                      |
| Espacement haut    | 0 (juste sous le filet)                                         |
| Aucun « € », « DH » | « dh » en minuscules, espacement 8px après le chiffre, taille -50% |

#### Pourquoi un prix rond (320, pas 319,99) ?

> **Wadhwa & Zhang (2015)** — *« Round prices feel more emotional and intuitive. Charm prices (ending in .99) feel more analytical and rational. »*

L'étude (citée dans plus de 200 publications) démontre que :

| Type de prix       | Système cognitif activé | Type de produit idéal              |
| :----------------- | :---------------------- | :--------------------------------- |
| **Charm (319.99)** | Système 2 — analytique   | Produits utilitaires, fonctionnels |
| **Round (320)**    | Système 1 — émotionnel   | Produits luxe, expérientiels       |

Pour `/kit`, le prix rond est **non négociable** :

- Le rituel est **émotionnel** (pas analytique)
- La cliente achète une **expérience** (pas une fonction)
- Le prix doit être perçu comme **un cadeau qu'on s'offre**, pas comme un calcul d'optimisation

#### Aucun « prix barré », aucune promotion

> **Park, Kim & Kim (2020)** — *« Discounting hurts luxury brands. Consumers perceive discounted luxury as 'not really luxury'. »*

Sur `/kit`, **interdit** :
- Prix barré ~~399 dh~~ → 320 dh
- « -20% »
- « Prix promotionnel »
- « Économisez 80 dh »
- « Pour un temps limité »

Le prix est ce qu'il est. La cliente accepte ou pas. **Pas de négociation visuelle**.

#### Pas de mention « TTC » ou « TVA incluse »

Au Maroc, le prix consommateur final inclut toujours la TVA. Mentionner « TTC » paraît bureaucratique et casse le ton éditorial. La transparence se fait **par la simplicité** — un prix unique, complet.

> **Note** : si la livraison est en supplément, elle est mentionnée sous les réassurances (« Livraison 48h Casa **gratuite** dès 250 dh »). Comme 320 dh > 250 dh, la livraison est **toujours gratuite** — c'est un argument à conserver implicite (jamais crié).

### 5.6 — CTA primaire — verbe de réception

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
| Largeur            | 280px (desktop) · 100% du bloc info (mobile)                          |
| Hover              | Fond `#4A4844`, élévation `box-shadow: 0 4px 16px rgba(44,42,40,0.12)`, transition 220ms |
| Active             | Scale 0.97, transition 100ms                                          |
| Focus              | Ring 2px sauge dark, offset 4px                                       |
| Loading state      | Spinner mini visible 200-300ms après click (voir section 14)           |
| Action             | Add-to-cart + animation pot vers panier + ouverture mini modal panier  |
| Espacement haut    | 32px sous le prix                                                      |

#### Pourquoi « Recevoir » et pas « Acheter » ?

| Verbe              | Famille            | Engagement                | Adapté à...                  |
| :----------------- | :----------------- | :------------------------ | :--------------------------- |
| **Découvrir**      | Ouverture          | Très faible (TOFU)        | `/accueil` (premier contact) |
| **Recevoir**       | Réception / don    | Moyen (MOFU/BOFU)         | `/rituel`, `/kit`            |
| **Acheter**        | Transaction        | Élevé (transactionnel)    | (jamais utilisé sur ce site) |
| **Commander**      | Logistique         | Élevé                     | (jamais utilisé)             |
| **Confirmer**      | Validation         | Très élevé (BOFU final)   | `/commander` checkout        |

Le verbe « Recevoir » :
- **Adoucit** la transaction (don plutôt qu'achat)
- **Préserve** l'esthétique éditoriale
- **Reste cohérent** avec le CTA de `/rituel` (continuité de marque)
- **Implique une attente positive** (la cliente *recevra*, ne *prendra* pas)

#### Pas de mention « ajouter au panier » ailleurs sur la page

Le CTA `Recevoir le rituel` est **le seul wording** utilisé pour l'ATC sur cette page, sur `/accueil`, sur `/rituel`. Cohérence absolue. La cliente apprend ce verbe = ce geste — c'est devenu un **signal de marque**.

### 5.7 — Réassurances en filets

Sous le CTA, trois lignes de réassurance, chacune précédée d'un filet court :

```
─ Livraison 48h Casa
─ Retour 14j sans condition
─ Paiement 3× sans frais
```

| Propriété       | Valeur                                                  |
| :-------------- | :------------------------------------------------------ |
| Police          | Inter Regular                                            |
| Taille          | 11pt (desktop) · 11pt (mobile)                          |
| Line-height     | 1.6                                                     |
| Couleur         | `#6B6863` (Brume)                                       |
| Filet           | `─` caractère em-dash U+2014, couleur sauge dark, espacement 8px |
| Espace entre lignes | 12px                                                |
| Espacement haut | 24px sous le CTA                                         |

#### Justification de chaque réassurance

##### Livraison 48h Casa

Réponse au **risque temporel** (Lantos). La cliente urbaine veut savoir : *« Quand est-ce que je pourrai commencer ? »*

- **48h** est concret, vérifiable, court
- **Casa** précise — la cliente sait que c'est valide pour elle (Casablanca étant le hub principal)
- Pour les autres villes (Rabat, Marrakech, Tanger), la mention est implicite (« Casa » = Casa et environs, autres villes = 3-5 jours, détaillé en FAQ)

##### Retour 14j sans condition

Réponse au **risque psychologique** + **risque financier**. La cliente : *« Et si je n'aime pas ? »*

- **14 jours** = norme légale marocaine (loi 31-08), donc obligation légale + signal de respect
- **« Sans condition »** = pas de motif à fournir, pas de pénalité, pas de question
- Cette réassurance est **psychologiquement énorme** — elle annule le risque d'achat

##### Paiement 3× sans frais

Réponse au **risque financier**. 320 dh d'un coup peuvent rebuter une CSP B (juste en dessous du seuil B+). Le paiement échelonné :

- **3× = ~107 dh/mois** — passe largement sous le seuil de douleur psychologique
- **« Sans frais »** crucial — les Marocains sont habitués aux frais cachés sur le crédit, lever ce doute renforce la confiance
- Implémentation via CMI (Centre Monétique Interbancaire Maroc) ou partenaire fintech

> **Pourquoi pas plus de réassurances ?** Parce que **trois est le nombre magique** (Iyengar 2000). Quatre lignes commencent à fatiguer l'œil, à donner l'impression d'une argumentation défensive. Trois lignes = autorité calme.

### 5.8 — Tokens design — Above the fold

```css
/* ─── Section Above the fold — tokens ─── */
--atf-bg: #FBF8F1;
--atf-padding-vertical: 96px;
--atf-padding-x-desktop: 96px;
--atf-padding-x-mobile: 24px;
--atf-grid-gap-desktop: 64px;
--atf-grid-gap-mobile: 32px;

--atf-photo-ratio-desktop: 4/5;
--atf-photo-ratio-tablet: 1/1;
--atf-photo-ratio-mobile: 4/5;

--atf-kicker-color: #6B6863;
--atf-kicker-size: 8pt;
--atf-kicker-tracking: 3.5px;

--atf-title-font: 'Cormorant Garamond', serif;
--atf-title-weight: 300;
--atf-title-size-desktop: 48pt;
--atf-title-line-height: 1.1;
--atf-title-color: #2C2A28;

--atf-subtitle-style: italic;
--atf-subtitle-size: 17pt;
--atf-subtitle-color: #4A4844;

--atf-divider-width: 32px;
--atf-divider-height: 1.5px;
--atf-divider-color: #A8C4A6;
--atf-divider-margin: 32px 0;

--atf-price-font: 'Cormorant Garamond', serif;
--atf-price-weight: 300;
--atf-price-size: 36pt;
--atf-price-color: #2C2A28;

--atf-cta-bg: #2C2A28;
--atf-cta-text: #FBF8F1;
--atf-cta-padding: 18px 40px;
--atf-cta-width-desktop: 280px;

--atf-reassurance-color: #6B6863;
--atf-reassurance-size: 11pt;
--atf-reassurance-line-height: 1.6;
--atf-reassurance-em-dash-color: #A8C4A6;
```

### 5.9 — Comportements UX

#### État initial (avant interaction)

Tous les éléments visibles, animations d'entrée terminées, page en attente d'interaction.

#### Hover sur la photo

- Aucune transformation par défaut
- **Optionnel V2** : un léger zoom-in 1.02× sur 800ms si la photo est cliquable (lien vers galerie produit)

#### Click sur la photo

- **MVP V1** : aucune action (la photo est statique, déjà optimale)
- **V2** : ouverture d'une galerie modale avec 4-6 photos additionnelles (différents angles, détails matières, contexte d'usage)

#### Hover sur le CTA

```
[hover entry]   → Fond passe de #2C2A28 → #4A4844 (220ms)
[hover entry]   → Élévation : box-shadow apparaît (220ms)
[hover continu] → Aucune animation supplémentaire (le luxe ne tremble pas)
[hover exit]    → Inversion fluide
```

#### Click sur le CTA

Voir section **14 — Comportements transverses & mécaniques de panier** pour la séquence complète.

### 5.10 — Psychologie & neuromarketing — synthèse

#### Tactiques appliquées sur cette section

| # | Tactique                          | Application                                                  |
| :- | :-------------------------------- | :----------------------------------------------------------- |
| 1 | `KOLENDA · CONTEXT > ISOLATION`    | Photo contextuelle (kit + main + tasse) plutôt qu'isolée fond blanc |
| 2 | `KOLENDA · ROUND PRICING`          | 320 dh, prix rond pour achat émotionnel                       |
| 3 | `KOLENDA · PRODUCT-THEN-PRICE`     | Le produit est nommé/décrit AVANT le prix (descend la résistance) |
| 4 | `KOLENDA · VERB OF RECEIVING`      | « Recevoir » plutôt qu'« Acheter »                            |
| 5 | `KOLENDA · RISK REDUCTION (3 axes)`| Livraison + retour + paiement échelonné                       |
| 6 | `KOLENDA · IMPLY HUMAN`            | Main visible mais pas de visage, tasse encore tiède           |
| 7 | `KOLENDA · EMPTY SPACE`            | Bloc info à 45% de largeur, beaucoup de respiration verticale |
| 8 | `KOLENDA · F-PATTERN EYE FLOW`     | Œil descend : titre → prix → CTA → réassurances              |
| 9 | `KOLENDA · NO « FREE »`            | Aucune mention « Gratuit ! » qui dévaluerait                  |
| 10 | `KOLENDA · 3 IS MAGIC`            | 3 réassurances, pas 4+                                        |
| 11 | `KOLENDA · TIME SPECIFICITY`       | « 48h » plutôt que « rapide »                                 |
| 12 | `KOLENDA · NO HARD SELL`           | Aucune urgence, aucun countdown, aucun stock affiché          |

### 5.11 — Émotion à provoquer

| Étape       | Émotion                                                          |
| :---------- | :--------------------------------------------------------------- |
| Arrivée     | Reconnaissance (photo cohérente avec /rituel)                     |
| 1 seconde   | Compréhension (« voilà le kit, voilà le prix »)                  |
| 2 secondes  | Calcul mental rapide (« 320 dh, est-ce que je le vaux ? »)       |
| 3 secondes  | Lecture des réassurances (rassurage logique)                     |
| 5 secondes  | Décision possible : convertir OU continuer à scroller            |
| 8 secondes  | Action (CTA) OU scroll vers section 02                            |

### 5.12 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| Photo isolée fond blanc                             | Dévalue la marque, ressemble à Amazon                              |
| Prix charm (319,99 dh)                              | Active le système analytique, baisse l'émotion                     |
| Prix barré + nouveau prix                           | Détruit la perception luxe (Park 2020)                             |
| « Acheter maintenant » / « Ajouter au panier »      | Trop transactionnel pour le ton de la maison                       |
| Sélecteur de quantité visible                       | Surcharge inutile (mono-SKU, 1 unité par défaut)                   |
| Plus de 3 réassurances                              | Argumentation défensive, fatigue cognitive                         |
| Étoiles 5/5 dans le bloc info                       | Code Amazon, dévalue                                               |
| Compte à rebours « Plus que X en stock »            | Détruit la marque luxe en une seconde                              |
| « Best-seller » / « Produit phare »                 | Slogan publicitaire, casse l'éditorial                             |
| Vidéo qui auto-play à côté de la photo              | Concurrence visuelle, surcharge                                    |
| Photo de visage radieux                             | Distrait du produit, crée distance (Lu 2023)                       |

---

## 6 — Section 02 — Composition · slow reveal

### 6.1 — Wireframe

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│  LE KIT EN DÉTAIL                                                          │
│                                                                            │
│  Quatre matières. Chacune dans son pot.                                    │
│                                                                            │
│                                                                            │
│  ┌────────────────────┐ ┌────────────────────┐                             │
│  │                    │ │                    │                             │
│  │  [PHOTO ZOOM POT 1]│ │  [PHOTO ZOOM POT 2]│                             │
│  │                    │ │                    │                             │
│  │  paste             │ │  powder            │                             │
│  │  Préparer          │ │  Lisser            │                             │
│  └────────────────────┘ └────────────────────┘                             │
│                                                                            │
│  ┌────────────────────┐ ┌────────────────────┐                             │
│  │                    │ │                    │                             │
│  │  [PHOTO ZOOM POT 3]│ │  [PHOTO ZOOM POT 4]│                             │
│  │                    │ │                    │                             │
│  │  shine             │ │  polish            │                             │
│  │  Polir             │ │  Révéler           │                             │
│  └────────────────────┘ └────────────────────┘                             │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 — Composition

#### Surtitre

```
LE KIT EN DÉTAIL
```

Inter SemiBold 7.5pt, tracking 2.5px, couleur Brume `#6B6863`, centré.

#### Titre de section

```
Quatre matières. Chacune dans son pot.
```

Cormorant Light 32pt, couleur Encre, centré, espacement haut 12px.

### 6.3 — Disposition des 4 photos

| Breakpoint | Layout                                                  |
| :--------- | :------------------------------------------------------ |
| Desktop    | Grille 2×2, gap 24px, max-width 1080px centré           |
| Tablet     | Grille 2×2, gap 20px                                    |
| Mobile     | Empilement vertical 1×4, gap 32px                       |

### 6.4 — Spécifications de chaque photo zoom-in

#### Composition photographique

| Propriété          | Valeur                                                                |
| :----------------- | :-------------------------------------------------------------------- |
| Sujet              | Un seul pot, photographié de très près (macro ou semi-macro)          |
| Focale équivalente | 100mm (macro) ou 85mm (semi-macro)                                    |
| Ouverture          | f/2.8 — flou onirique sur l'arrière-plan                              |
| Distance focale    | Pot net, étiquette nette, fond flou doux                              |
| Lumière            | Naturelle latérale, ombres terreuses chaudes                          |
| Composition        | Pot légèrement décentré (règle des tiers), espace négatif au-dessus    |
| Format             | 4:5 (portrait) sur desktop · 4:5 sur tablet · 4:5 sur mobile          |
| Hauteur affichage  | 360px (desktop) · 300px (tablet) · 320px (mobile)                     |

#### Contexte de chaque photo

| Pot            | Élément contextuel discret                                              |
| :------------- | :---------------------------------------------------------------------- |
| **paste**      | Un pinceau d'application posé à côté, manche bois clair                  |
| **powder**     | Un buffer doux en mousseline beige, légèrement froissé                  |
| **shine**      | Un linge de coton plié, ombres marbrées en arrière-plan                 |
| **polish**     | Un chiffon de soie crème, pli naturel                                    |

> **Pourquoi ces objets contextuels ?** Pour suggérer **l'usage**. La cliente comprend en regardant : *« j'utilise un pinceau, j'utilise un buffer, j'utilise un linge, j'utilise un chiffon. »* Quatre verbes, quatre objets, quatre photos.

### 6.5 — Étiquettes sous chaque photo

#### Format

```
paste
Préparer.
```

| Élément             | Spécifications                                                |
| :------------------ | :------------------------------------------------------------ |
| Nom du pot (`paste`) | Inter Regular Italic 11pt, couleur Brume `#6B6863`, alignement gauche |
| Verbe d'action      | Cormorant Garamond Light 18pt, couleur Encre, alignement gauche, espacement haut 4px |
| Espacement haut (sous photo) | 16px                                                  |

#### Les quatre étiquettes — copy exact

| # | Pot       | Verbe        |
| :- | :-------- | :----------- |
| 1 | `paste`   | `Préparer.`  |
| 2 | `powder`  | `Lisser.`    |
| 3 | `shine`   | `Polir.`     |
| 4 | `polish`  | `Révéler.`   |

> **Cohérence inter-pages** : ces 4 verbes sont identiques sur `/accueil` (section 4 gestes), `/rituel` (vidéo), `/kit` (cette section + section 04). **Cohérence absolue** = signal de marque.

### 6.6 — Animation slow reveal au scroll

#### Principe

Chaque photo entre dans le viewport avec un **zoom-in lent** (effet *« la matière se révèle »*) :

```
[photo invisible, 0% du viewport]   → état initial : scale 1.08, opacity 0
[photo entre dans viewport, 30%]    → animation démarre
[atteint 60% du viewport]           → scale 1.0, opacity 1 (700ms ease-out)
[atteint 100% du viewport]          → état final stable
```

#### Spécifications animation

| Propriété         | Valeur                                                  |
| :---------------- | :------------------------------------------------------ |
| Durée             | 700ms                                                   |
| Easing            | `cubic-bezier(0.16, 1, 0.3, 1)` — ease-out doux        |
| Trigger           | Intersection Observer, threshold 30%                    |
| Initial state     | `transform: scale(1.08); opacity: 0;`                   |
| Final state       | `transform: scale(1.0); opacity: 1;`                    |
| Stagger           | 150ms entre chaque photo (cascade visuelle)             |
| Reduced motion    | Photos apparaissent à leur état final, pas d'animation  |

> **Pourquoi un zoom-in (et pas un zoom-out) ?** Parce que le zoom-in suggère **« je regarde de plus près »** — un mouvement actif de la cliente vers la matière. Le zoom-out suggérerait *« je m'éloigne »* — l'inverse de ce qu'on veut.

### 6.7 — Tokens design

```css
/* ─── Section Slow Reveal — tokens ─── */
--reveal-bg: #FBF8F1;
--reveal-padding-vertical: 96px;

--reveal-grid-gap-desktop: 24px;
--reveal-grid-gap-mobile: 32px;
--reveal-grid-max-width: 1080px;

--reveal-photo-aspect: 4/5;
--reveal-photo-height-desktop: 360px;

--reveal-pot-name-font: 'Inter', sans-serif;
--reveal-pot-name-style: italic;
--reveal-pot-name-size: 11pt;
--reveal-pot-name-color: #6B6863;

--reveal-verb-font: 'Cormorant Garamond', serif;
--reveal-verb-weight: 300;
--reveal-verb-size: 18pt;
--reveal-verb-color: #2C2A28;

--reveal-animation-duration: 700ms;
--reveal-animation-easing: cubic-bezier(0.16, 1, 0.3, 1);
--reveal-animation-stagger: 150ms;
```

### 6.8 — Psychologie

#### Slow motion = perception de luxe

> **Togawa & Sugitani (2022)** : *« Slow movements heighten the perceived importance of luxury products. »*

L'animation lente (700ms par photo, en cascade) crée une **temporalité contemplative**. La cliente n'est pas pressée — elle découvre, lentement.

#### Visualisation matérielle

> **Peck & Childers (2003)** — Need for Touch : *« Consumers who can't physically touch a product imagine touching it. The more vivid the imagined touch, the higher the purchase intent. »*

Les photos macro (semi-macro) avec profondeur de champ faible **invitent au toucher imaginaire**. La cliente *imagine* sentir la texture du paste, la finesse du powder. C'est le **désir tactile** activé visuellement.

#### Parallel individuation (encore)

> 4 photos, 4 cartes — répétition de la structure *« quatre »* qui revient sur toute la page (4 gestes, 4 minutes, 4 pots).

### 6.9 — Émotion

| Avant | Pendant | Après |
| :---- | :------ | :---- |
| Décision en suspens (n'a pas encore cliqué) | Curiosité matérielle | Conviction du *« je veux toucher ça »* |

### 6.10 — Erreurs à éviter

- Photos identiques (même fond) — manque de variété, ennui
- Photos à fond noir studio — trop commercial, dévalue
- Animation > 1.2s par photo — devient lente, bavarde
- Plus de 4 pots — détruit la cohérence du rituel
- Verbes différents que sur `/accueil` et `/rituel` — incohérence de marque
- Légendes en bold — Cormorant Light, jamais bold
- Titres de chaque pot en couleur sauge / champagne — sors de la palette texte (encre / brume)

---

## 7 — Section 03 — Vidéo des quatre gestes

### 7.1 — Wireframe

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│                  LE RITUEL EN MOUVEMENT                                    │
│                                                                            │
│                  Soixante secondes pour comprendre.                        │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────┐     │
│  │                                                                  │     │
│  │                                                                  │     │
│  │                       [VIDÉO PLEIN ÉCRAN]                        │     │
│  │                       [Version courte 60s]                       │     │
│  │                       [Réutilisée de /rituel — cuts précis]      │     │
│  │                                                                  │     │
│  │                                                                  │     │
│  │  ▶ ━━━━━○━━━━━━━━━━━━━━━━━━━━━━━━━ 0:24 / 1:00   [⊜ FR]  [♪]    │     │
│  └──────────────────────────────────────────────────────────────────┘     │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 — Différences vs vidéo de `/rituel`

| Critère              | Sur `/rituel` (long)        | Sur `/kit` (court)                  |
| :------------------- | :-------------------------- | :---------------------------------- |
| **Durée**            | 1:30 (90 secondes)          | **1:00 (60 secondes)**              |
| **Public**           | Découverte/MOFU             | Pré-décision/BOFU                    |
| **Découpage**        | 4 gestes + intros + transitions| 4 gestes resserrés (15s par geste) |
| **Tonalité**         | Pédagogique                 | **Démonstrative**                   |
| **Captions par défaut**| Désactivées                 | **Désactivées**                      |
| **Position page**    | Section centrale (immersion) | Section middle (rappel + démonstration) |
| **Rôle**             | Première rencontre du rituel | **Confirmation visuelle** de ce qu'elle achète |

> **Économie de production** : la vidéo courte 60s est **un re-cut** de la vidéo 90s de `/rituel` — pas un tournage séparé. Mêmes plans, montage resserré. Économie + cohérence visuelle absolue.

### 7.3 — Composition

#### Surtitre

```
LE RITUEL EN MOUVEMENT
```

Inter SemiBold 7.5pt, tracking 2.5px, couleur Brume, centré.

#### Titre de section

```
Soixante secondes pour comprendre.
```

| Propriété      | Valeur                                                   |
| :------------- | :------------------------------------------------------- |
| Police         | Cormorant Garamond Light                                 |
| Taille         | 32pt (desktop) · 26pt (tablet) · 22pt (mobile)           |
| Couleur        | `#2C2A28` (Encre)                                        |
| Alignement     | Centré                                                   |
| Espacement     | 12px sous le surtitre                                     |

> **Différence avec `/rituel`** : sur `/rituel`, le titre était *« Quatre gestes, quatre minutes. »* (descriptif). Ici, *« Soixante secondes pour comprendre. »* (efficace). Le verbe « comprendre » s'adresse à la cliente rationnelle qui veut **vérifier visuellement** avant d'acheter.

### 7.4 — Découpage de la vidéo 60s

| Temps         | Plan                                                              | Geste                          |
| :------------ | :---------------------------------------------------------------- | :----------------------------- |
| 0:00 – 0:03   | Établissement très court : table de soin                          | Hook                           |
| 0:03 – 0:18   | Geste 1 — Préparer (15 secondes)                                  | `paste`                        |
| 0:18 – 0:33   | Geste 2 — Lisser (15 secondes)                                    | `powder`                       |
| 0:33 – 0:48   | Geste 3 — Polir (15 secondes)                                     | `shine`                        |
| 0:48 – 0:58   | Geste 4 — Révéler (10 secondes)                                   | `polish`                       |
| 0:58 – 1:00   | Final : main posée, finie, fade to crème                          | Climax court                   |

> **Différence narrative** : sur `/rituel`, chaque geste avait sa **respiration** (transitions de 2 secondes entre gestes). Ici, **enchaînement direct** — la cliente a déjà compris la philosophie (sur `/rituel`), elle veut voir l'**efficacité**.

### 7.5 — Player vidéo — UI

Identique au player de `/rituel`. Voir le document spécification de `/rituel` (section 7.4) pour les détails techniques.

#### Différence sur `/kit`

| Élément                | Sur `/rituel`               | Sur `/kit`                          |
| :--------------------- | :-------------------------- | :---------------------------------- |
| Hauteur de la section  | 100vh (immersion volontaire) | **80vh** (laisse deviner section suivante) |
| Autoplay trigger       | Section atteint 50% viewport | **Section atteint 60% viewport** (plus tardif, la cliente doit d'abord voir le composition slow reveal) |

### 7.6 — Spécifications techniques (rappel)

| Propriété              | Valeur                                                                  |
| :--------------------- | :---------------------------------------------------------------------- |
| Durée                  | 1:00 (60 secondes)                                                       |
| Ratio                  | 16:9                                                                     |
| Frame rate             | 24 fps (cohérent avec `/rituel`)                                         |
| Bitrate cible 1080p    | 6 Mbps                                                                   |
| Audio                  | AAC 128 kbps, **muet par défaut**                                        |
| Captions               | FR + AR + OFF (mêmes pistes que `/rituel`, re-cut)                       |
| Format                 | MP4 (H.264) + WebM (VP9) en fallback                                     |

### 7.7 — Comportements UX

#### Autoplay et son

Identique à `/rituel` :
- Autoplay quand section 60% du viewport
- Son par défaut **muet**
- Pause automatique hors-écran ou tab inactif
- Pas de relance auto si pause manuelle

#### Plein écran

Identique à `/rituel`.

### 7.8 — Tokens design

Identiques à ceux de `/rituel` (section 7.7 du document `/rituel`).

### 7.9 — Psychologie

#### Confirmation cognitive

> **Cialdini (1984)** — Principe d'engagement et cohérence : une fois que la cliente a *visualisé* le rituel sur `/rituel`, **revoir** la vidéo (même version courte) sur `/kit` **renforce sa cohérence interne**. Elle se dit *« j'ai vu ça déjà, je le revois, donc c'est réel ».*

#### Démonstration matérielle

> Pour la cliente directe (Profil B), qui n'a pas vu `/rituel`, c'est **la première démonstration** du rituel. La version courte est **adaptée** à cette audience — elle veut voir comment ça se passe, sans la philosophie.

### 7.10 — Émotion

| Avant | Pendant | Après |
| :---- | :------ | :---- |
| Curiosité matérielle | Compréhension corporelle | « Je vois exactement comment je vais le faire » |

### 7.11 — Erreurs à éviter

- Vidéo identique à 90s (au lieu de 60s coupée) — alourdit, lasse
- Captions FR ON par défaut — décision de la cliente, pas imposée
- Musique de fond ajoutée pour cette version — détruit la cohérence avec `/rituel`
- Bouton « Voir la version longue » à côté — surcharge, pas pertinent
- CTA `Recevoir le rituel` overlay sur la vidéo — concurrence le CTA principal

---

## 8 — Section 04 — Composition détaillée par pot

### 8.1 — Wireframe

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│  CE QU'IL Y A DANS CHAQUE POT                                              │
│                                                                            │
│  La transparence comme premier soin.                                       │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │  paste · Préparer                                                 │    │
│  │  ─                                                                │    │
│  │  Une pâte légère qui détend la kératine et prépare la surface.   │    │
│  │                                                                   │    │
│  │  Composition                                                       │    │
│  │  Eau, glycérine végétale, kaolin, oxyde de zinc,                 │    │
│  │  huile de jojoba, panthénol.                                     │    │
│  │                                                                   │    │
│  │  Texture · Pâte douce, légèrement crémeuse                       │    │
│  │  Application · Pinceau souple                                     │    │
│  │  Temps de pose · 30 secondes                                      │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │  powder · Lisser                                                  │    │
│  │  ─ ... (3 autres pots) ...                                       │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 — Composition

#### Surtitre

```
CE QU'IL Y A DANS CHAQUE POT
```

Inter SemiBold 7.5pt, tracking 2.5px, couleur Brume, centré.

#### Titre de section

```
La transparence comme premier soin.
```

Cormorant Light 32pt, couleur Encre, centré.

> **Pourquoi ce titre ?** Parce qu'il transforme la **transparence d'ingrédients** (qui pourrait être un argument froid) en **acte de soin lui-même**. La maison ne cache rien — c'est sa première façon de prendre soin de la cliente.

### 8.3 — Disposition des 4 mini-fiches

| Breakpoint | Layout                                                                  |
| :--------- | :---------------------------------------------------------------------- |
| Desktop    | 2×2 grille, gap 24px, max-width 1080px                                  |
| Tablet     | 2×2 grille, gap 20px                                                    |
| Mobile     | 1 colonne empilée, gap 24px                                              |

### 8.4 — Spécifications de chaque mini-fiche

#### Container

| Propriété         | Valeur                                                          |
| :---------------- | :-------------------------------------------------------------- |
| Fond              | `#FFFFFF` (Crème pure)                                          |
| Border            | 1px solid `#E8E0D2` (Ligne)                                     |
| Border-radius     | 0                                                               |
| Padding           | 32px (desktop) · 24px (mobile)                                  |
| Hauteur           | Auto (s'adapte au contenu) — toutes uniformisées par grid       |

#### Header de la fiche

```
paste · Préparer
─
```

| Élément              | Spécifications                                                   |
| :------------------- | :--------------------------------------------------------------- |
| Nom du pot           | Inter Regular Italic 11pt, couleur Brume                         |
| Séparateur `·`       | Caractère middle dot U+00B7, espacement 6px                      |
| Verbe                | Cormorant Garamond Light 22pt, couleur Encre, sur la même ligne  |
| Filet sous header    | Largeur 32px, hauteur 1.5px, couleur sauge dark, espacement 16px |

#### Body — la phrase d'introduction

```
Une pâte légère qui détend la kératine et prépare la surface.
```

| Propriété      | Valeur                                                  |
| :------------- | :------------------------------------------------------ |
| Police         | Cormorant Garamond Regular Italic                       |
| Taille         | 15pt                                                    |
| Couleur        | `#4A4844` (Encre claire)                                |
| Espacement haut| 16px (sous le filet)                                    |

#### Composition (sous-section)

```
Composition
Eau, glycérine végétale, kaolin, oxyde de zinc,
huile de jojoba, panthénol.
```

| Élément              | Spécifications                                                   |
| :------------------- | :--------------------------------------------------------------- |
| Label « Composition »| Inter SemiBold 9pt, tracking 2px, uppercase, couleur Brume       |
| Liste ingrédients    | Inter Regular 12pt, line-height 1.6, couleur Encre               |
| Espacement haut label| 24px                                                              |
| Espacement label/liste | 4px                                                              |

#### Caractéristiques (3 lignes finales)

```
Texture · Pâte douce, légèrement crémeuse
Application · Pinceau souple
Temps de pose · 30 secondes
```

| Élément                | Spécifications                                                |
| :--------------------- | :------------------------------------------------------------ |
| Label (Texture, etc.)  | Inter Medium 11pt, couleur Encre                              |
| Séparateur `·`         | Middle dot, espacement 6px                                    |
| Valeur                 | Inter Regular 11pt, couleur Encre claire                       |
| Espace entre lignes    | 6px                                                            |
| Espace haut bloc       | 20px (sous la liste ingrédients)                              |

### 8.5 — Les quatre mini-fiches — copy intégral

#### Pot 1 — paste · Préparer

**Phrase d'intro** :
```
Une pâte légère qui détend la kératine et prépare la surface.
```

**Composition** :
```
Eau, glycérine végétale, kaolin, oxyde de zinc,
huile de jojoba, panthénol.
```

**Caractéristiques** :
- Texture · Pâte douce, légèrement crémeuse
- Application · Pinceau souple inclus dans le kit
- Temps de pose · 30 secondes

#### Pot 2 — powder · Lisser

**Phrase d'intro** :
```
Une poudre minérale qui lisse les irrégularités de la surface.
```

**Composition** :
```
Talc, silice, oxyde de magnésium, kaolin,
extraits de prêle des champs.
```

**Caractéristiques** :
- Texture · Poudre fine, soyeuse au toucher
- Application · Buffer en mousseline inclus dans le kit
- Temps de pose · 60 secondes par main

#### Pot 3 — shine · Polir

**Phrase d'intro** :
```
Un baume nourrissant qui polit le grain de l'ongle.
```

**Composition** :
```
Cire de carnauba, beurre de karité,
vitamine E (tocophérol), huile d'argan,
extrait de bambou.
```

**Caractéristiques** :
- Texture · Baume soyeux, fond au contact de la peau
- Application · Buffer fin (face crème)
- Temps de pose · 90 secondes par main

#### Pot 4 — polish · Révéler

**Phrase d'intro** :
```
Une finition de soie qui révèle l'éclat naturel.
```

**Composition** :
```
Cire d'abeille blanchie, huile d'amande douce,
extrait de soie hydrolysée, mica naturel.
```

**Caractéristiques** :
- Texture · Cire onctueuse, presque liquide à la chaleur
- Application · Chiffon de soie inclus dans le kit
- Temps de pose · 30 secondes par main

### 8.6 — Tokens design

```css
/* ─── Section Composition par pot — tokens ─── */
--composition-bg: #FBF8F1;
--composition-padding-vertical: 96px;

--composition-card-bg: #FFFFFF;
--composition-card-border: 1px solid #E8E0D2;
--composition-card-padding-desktop: 32px;
--composition-card-padding-mobile: 24px;

--composition-grid-gap-desktop: 24px;
--composition-grid-gap-mobile: 24px;

--composition-pot-name-font: 'Inter', sans-serif;
--composition-pot-name-style: italic;
--composition-pot-name-size: 11pt;
--composition-pot-name-color: #6B6863;

--composition-verb-font: 'Cormorant Garamond', serif;
--composition-verb-weight: 300;
--composition-verb-size: 22pt;
--composition-verb-color: #2C2A28;

--composition-divider-width: 32px;
--composition-divider-height: 1.5px;
--composition-divider-color: #A8C4A6;

--composition-intro-font: 'Cormorant Garamond', serif;
--composition-intro-style: italic;
--composition-intro-size: 15pt;
--composition-intro-color: #4A4844;

--composition-label-font: 'Inter', sans-serif;
--composition-label-weight: 600;
--composition-label-size: 9pt;
--composition-label-tracking: 2px;
--composition-label-color: #6B6863;

--composition-ingredients-size: 12pt;
--composition-ingredients-line-height: 1.6;
--composition-ingredients-color: #2C2A28;

--composition-spec-label-weight: 500;
--composition-spec-size: 11pt;
```

### 8.7 — Comportements UX

#### Animation au scroll

```
[section invisible]              → état initial
[atteint 75% viewport]           → titre fade-in (700ms)
[atteint 65%]                    → 4 fiches fade-in séquentiel (200ms entre chaque, 600ms chacune)
```

#### Hover sur une fiche

Aucune interaction. Les fiches sont **statiques par design** — ce sont des fiches techniques, pas des cartes interactives. La cliente lit, comprend, continue.

> **Pourquoi pas d'interaction ?** Parce que ces informations sont **factuelles** (composition, texture, durée). Les rendre interactives suggérerait qu'elles cachent quelque chose. Or, elles sont déjà toutes affichées en clair. La transparence se manifeste par la **lisibilité immédiate**.

#### Pas de mode « voir plus »

Tous les ingrédients sont visibles d'emblée. Aucun « Voir tous les ingrédients » qui replierait la liste. La transparence absolue est la règle.

### 8.8 — Psychologie

#### Risk reduction sanitaire/écologique

Les ingrédients listés permettent à la cliente de :
- Vérifier qu'il n'y a pas d'allergène connu
- Vérifier qu'il n'y a pas de produit chimique controversé (parabens, sulfates, formaldéhyde, etc.)
- **Conclure d'elle-même** que la composition est saine

> **Pas d'argumentaire « sans paraben sans sulfate »** — la simple liste d'ingrédients **prouve sans dire**. C'est l'inverse du marketing « clean beauty » qui crie ce qu'il n'a pas. FemiGlow montre ce qu'il a.

#### Authority by transparency (Slovic 1995)

> *« Information transparency increases trust more than persuasive claims. »*

Lister les ingrédients en clair (sans euphémisme, sans abréviation) génère **plus de confiance** que dix arguments commerciaux. La cliente perçoit : *« cette marque n'a rien à cacher ».*

#### Sensory imagery (Krishna 2012)

Les mots **texture**, **pâte**, **poudre**, **baume**, **soie** activent les zones cérébrales du toucher — la cliente *imagine* sentir.

### 8.9 — Émotion

| Avant | Pendant | Après |
| :---- | :------ | :---- |
| Curiosité matérielle | Vérification rationnelle | Confiance scientifique calme |

### 8.10 — Erreurs à éviter

| Erreur                                          | Pourquoi c'est faux                                              |
| :---------------------------------------------- | :--------------------------------------------------------------- |
| Liste d'ingrédients en latin INCI uniquement    | Illisible — la cliente n'est pas chimiste. Préférer le français + (latin) si nécessaire |
| Argumentaire « sans X sans Y sans Z »           | Marketing défensif — préférer la liste brute                      |
| Pourcentages d'ingrédients (« 87% naturel »)    | Métrique floue, dévalue                                           |
| Icônes (feuille verte, goutte d'eau)            | Ressemble à un emballage de supermarché                          |
| Plus de 6 ingrédients par pot                   | Surcharge cognitive — viser 4-6 ingrédients lisibles             |
| Dissimuler des ingrédients sous « parfum »      | Méfiance — préférer « huile essentielle de bambou » explicite     |
| Liens « En savoir plus » qui replient l'info    | Casse la transparence absolue                                    |
| Labels marketing (« Bio », « Naturel », « Vegan ») sans certification | Mensonger sans preuve — préférer ne rien dire |

---

## 9 — Section 05 — Comparatif vernis vs rituel

### 9.1 — Wireframe

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│  POUR COMPARER                                                             │
│                                                                            │
│  Trois manières d'envisager ses ongles.                                    │
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────┐     │
│  │                  │ Vernis      │ Vernis        │ Rituel          │     │
│  │                  │ classique   │ semi-permanent│ FemiGlow ★      │     │
│  ├──────────────────┼─────────────┼───────────────┼─────────────────┤     │
│  │ Effet immédiat   │ ●●●         │ ●●●●          │ ●●              │     │
│  │ Tenue            │ 3-5 jours   │ 2-3 semaines  │ 4-6 semaines *  │     │
│  │ Santé de l'ongle │ ●           │ ●             │ ●●●●●           │     │
│  │ Naturel          │ ●           │ ●             │ ●●●●●           │     │
│  │ Geste            │ Pose        │ Pose UV       │ Rituel 4 min    │     │
│  │ Réassort         │ Rapide      │ Rapide        │ 2-3 mois        │     │
│  └──────────────────┴─────────────┴───────────────┴─────────────────┘     │
│                                                                            │
│  * la patine s'estompe progressivement, sans craquelures.                  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 9.2 — Composition

#### Surtitre

```
POUR COMPARER
```

Inter SemiBold 7.5pt, tracking 2.5px, couleur Brume, centré.

#### Titre de section

```
Trois manières d'envisager ses ongles.
```

Cormorant Light 32pt, couleur Encre, centré.

> **Pourquoi cette formulation ?** Parce que *« comparer »* peut sembler agressif (comme un argumentaire de vente). *« Trois manières d'envisager »* ouvre — comme un philosophe ouvrirait un débat. La cliente n'est pas dans une bataille, elle est dans un **choix de mode de vie**.

### 9.3 — Spécifications du tableau

#### Container

| Propriété         | Valeur                                                          |
| :---------------- | :-------------------------------------------------------------- |
| Largeur max       | 1080px (centré)                                                 |
| Padding           | 0                                                                |
| Border            | 1px solid `#E8E0D2` (extérieur)                                 |
| Border-radius     | 0                                                                |
| Fond              | `#FFFFFF` (Crème pure)                                          |

#### Header de colonnes

| Propriété         | Valeur                                                          |
| :---------------- | :-------------------------------------------------------------- |
| Hauteur           | 80px                                                             |
| Fond colonnes 1-2 | `#FBF8F1` (Crème) — neutre                                       |
| Fond colonne 3    | `#E8EFE7` (Sauge pâle) — mise en valeur subtile                  |
| Police            | Cormorant Garamond Regular                                       |
| Taille            | 18pt                                                             |
| Couleur           | `#2C2A28` (Encre)                                                |
| Alignement        | Centré                                                           |
| Border bottom     | 1.5px solid `#A8C4A6` (sauge dark)                              |

##### Marqueur ★ sur la colonne FemiGlow

À droite du nom « Rituel FemiGlow », un **petit marqueur ★** en couleur champagne :

| Propriété         | Valeur                                                          |
| :---------------- | :-------------------------------------------------------------- |
| Caractère         | ★ (U+2605 ou icône SVG simple)                                  |
| Couleur           | `#C8A876` (Champagne)                                            |
| Taille            | 12pt                                                             |
| Position          | À droite du texte, espacement 6px                                |

> **Apparition rare du Champagne** sur cette page (utilisée seulement ici et possiblement dans le pivot CTA final). Cette retenue est essentielle : le Champagne reste le signal de **distinction silencieuse**.

#### Header de lignes (1ère colonne)

| Propriété         | Valeur                                                          |
| :---------------- | :-------------------------------------------------------------- |
| Largeur           | 28% de la largeur du tableau                                     |
| Fond              | `#FBF8F1` (Crème)                                                |
| Police            | Inter Medium                                                     |
| Taille            | 12pt                                                             |
| Couleur           | `#2C2A28` (Encre)                                                |
| Alignement        | Aligné à gauche, padding-left 24px                              |
| Border right      | 1px solid `#E8E0D2`                                             |

#### Cellules de données

| Propriété         | Valeur                                                          |
| :---------------- | :-------------------------------------------------------------- |
| Hauteur           | 64px (uniforme)                                                  |
| Fond              | `#FFFFFF` (Crème pure)                                          |
| Fond cellule colonne 3 | `rgba(232, 239, 231, 0.4)` (sauge pâle 40%)                |
| Police            | Inter Regular                                                    |
| Taille            | 13pt                                                             |
| Couleur           | `#2C2A28` (Encre)                                                |
| Alignement        | Centré                                                           |
| Border bottom     | 1px solid `#E8E0D2` (sauf dernière ligne)                       |

### 9.4 — Les six critères — détail

#### Critère 1 — Effet immédiat

| Vernis classique | Vernis semi-permanent | Rituel FemiGlow |
| :--------------: | :-------------------: | :-------------: |
| ●●●              | ●●●●                  | ●●              |

Légende textuelle au survol (tooltip) : *« L'éclat du rituel se construit. Il n'arrive pas en une fois — c'est sa qualité. »*

#### Critère 2 — Tenue

| Vernis classique | Vernis semi-permanent | Rituel FemiGlow |
| :--------------: | :-------------------: | :-------------: |
| 3-5 jours        | 2-3 semaines          | 4-6 semaines *  |

L'astérisque renvoie à une note en bas du tableau :
```
* la patine s'estompe progressivement, sans craquelures.
```

#### Critère 3 — Santé de l'ongle

| Vernis classique | Vernis semi-permanent | Rituel FemiGlow |
| :--------------: | :-------------------: | :-------------: |
| ●                | ●                     | ●●●●●           |

#### Critère 4 — Naturel

| Vernis classique | Vernis semi-permanent | Rituel FemiGlow |
| :--------------: | :-------------------: | :-------------: |
| ●                | ●                     | ●●●●●           |

#### Critère 5 — Geste

| Vernis classique     | Vernis semi-permanent | Rituel FemiGlow      |
| :------------------: | :-------------------: | :------------------: |
| Pose                 | Pose UV               | Rituel 4 min         |

#### Critère 6 — Réassort

| Vernis classique | Vernis semi-permanent | Rituel FemiGlow |
| :--------------: | :-------------------: | :-------------: |
| Rapide           | Rapide                | 2-3 mois        |

### 9.5 — Système de notation par points

Les points `●` représentent une **échelle subjective de 1 à 5** :

| Notation | Signification                                |
| :------- | :------------------------------------------- |
| ●        | Faible / minimal                             |
| ●●       | Modéré                                       |
| ●●●      | Standard                                     |
| ●●●●     | Élevé                                        |
| ●●●●●    | Maximum                                      |

Les points absents sont en `#E8E0D2` (Ligne) — visibles mais désactivés. Les points actifs sont en `#A8C4A6` (Sauge dark).

> **Pourquoi des points et pas des étoiles ?** Parce que les étoiles sont le code Amazon (notation produit). Les points sont **neutres**, presque graphiques — ils représentent une échelle sans appartenir à un univers commercial.

### 9.6 — Note en bas du tableau

```
* la patine s'estompe progressivement, sans craquelures.
```

| Propriété      | Valeur                                                    |
| :------------- | :-------------------------------------------------------- |
| Police         | Inter Regular Italic                                       |
| Taille         | 11pt                                                      |
| Couleur        | `#6B6863` (Brume)                                         |
| Alignement     | Aligné à gauche, padding-left 24px                        |
| Espacement haut| 16px (sous le tableau)                                     |

> **Pourquoi cette note précise ?** Parce que *« 4-6 semaines de tenue »* peut sembler long et susciter le doute (*« mais alors c'est invisible ? »*). La note clarifie : la patine **s'estompe**, ne s'écaille pas. C'est exactement la différence entre un soin et un vernis.

### 9.7 — Tokens design

```css
/* ─── Section Comparatif — tokens ─── */
--comparatif-bg: #FBF8F1;
--comparatif-padding-vertical: 96px;

--comparatif-table-max-width: 1080px;
--comparatif-table-bg: #FFFFFF;
--comparatif-table-border: 1px solid #E8E0D2;

--comparatif-header-height: 80px;
--comparatif-header-bg: #FBF8F1;
--comparatif-header-bg-femiglow: #E8EFE7;
--comparatif-header-font: 'Cormorant Garamond', serif;
--comparatif-header-size: 18pt;
--comparatif-header-color: #2C2A28;
--comparatif-header-border-bottom: 1.5px solid #A8C4A6;

--comparatif-row-label-bg: #FBF8F1;
--comparatif-row-label-width: 28%;
--comparatif-row-label-font: 'Inter', sans-serif;
--comparatif-row-label-weight: 500;
--comparatif-row-label-size: 12pt;

--comparatif-cell-height: 64px;
--comparatif-cell-bg: #FFFFFF;
--comparatif-cell-bg-femiglow: rgba(232, 239, 231, 0.4);
--comparatif-cell-font: 'Inter', sans-serif;
--comparatif-cell-size: 13pt;

--comparatif-dot-active: #A8C4A6;
--comparatif-dot-inactive: #E8E0D2;

--comparatif-star-color: #C8A876;
--comparatif-star-size: 12pt;

--comparatif-note-style: italic;
--comparatif-note-size: 11pt;
--comparatif-note-color: #6B6863;
```

### 9.8 — Comportements UX

#### Animation au scroll

```
[section invisible]              → état initial
[atteint 80% viewport]           → titre + sous-titre fade-in (700ms)
[atteint 70%]                    → tableau fade-in (600ms, délai 200ms)
[atteint 60%]                    → lignes du tableau apparaissent en cascade (100ms entre chaque)
```

#### Hover sur une cellule

| Action          | Comportement                                                       |
| :-------------- | :----------------------------------------------------------------- |
| Hover cell colonne FemiGlow | Subtile élévation : fond passe de `rgba(232,239,231,0.4)` à `rgba(232,239,231,0.7)`, transition 220ms |
| Hover cell autres colonnes  | Aucune                                                              |
| Hover header colonne FemiGlow | Aucune (déjà mis en valeur)                                       |

#### Hover sur un critère

Sur desktop uniquement, **tooltip** au survol d'un critère :

| Critère          | Tooltip                                                           |
| :--------------- | :---------------------------------------------------------------- |
| Effet immédiat   | « L'éclat du rituel se construit. Il n'arrive pas en une fois. »  |
| Tenue            | « Combien de temps avant le prochain rituel. »                     |
| Santé de l'ongle | « Impact sur la kératine et la matrice de l'ongle. »              |
| Naturel          | « Ressenti et apparence non-artificiels. »                         |
| Geste            | « La forme que prend la pratique. »                                |
| Réassort         | « Fréquence de renouvellement du produit. »                       |

| Tooltip styling | Valeur                                                          |
| :-------------- | :-------------------------------------------------------------- |
| Fond            | `#2C2A28` (Encre)                                               |
| Texte           | `#FBF8F1` (Crème pure)                                          |
| Police          | Cormorant Garamond Light Italic                                  |
| Taille          | 13pt                                                            |
| Padding         | 12px 16px                                                        |
| Border-radius   | 0                                                                |
| Position        | Au-dessus du critère, flèche pointant vers le bas                 |
| Animation       | Fade-in 200ms                                                    |
| Trigger         | Hover desktop · pas de tooltip mobile (info implicite)            |

### 9.9 — Comportement responsive (mobile)

Sur mobile, le tableau classique ne tient pas. Adaptation :

#### Format mobile — accordéon par critère

```
┌────────────────────────────────┐
│  Effet immédiat            [+] │
├────────────────────────────────┤
│  Tenue                     [+] │
├────────────────────────────────┤
│  Santé de l'ongle          [+] │
├────────────────────────────────┤
│  ...                            │
└────────────────────────────────┘
```

Tap sur un critère → expand qui affiche les 3 colonnes en vertical :

```
┌────────────────────────────────┐
│  Tenue                     [-] │
├────────────────────────────────┤
│  Vernis classique              │
│  3-5 jours                     │
│  ─                              │
│  Vernis semi-permanent         │
│  2-3 semaines                  │
│  ─                              │
│  Rituel FemiGlow ★              │
│  4-6 semaines                  │
└────────────────────────────────┘
```

| Élément              | Spécifications mobile                                           |
| :------------------- | :-------------------------------------------------------------- |
| Hauteur ligne fermée | 56px                                                             |
| Padding              | 20px horizontal · 16px vertical                                  |
| Border               | 1px bottom solid `#E8E0D2`                                      |
| Icône expand         | `+` (Inter Regular 18pt) qui devient `−` à l'ouverture           |
| Animation expand     | 320ms ease-out                                                   |
| Une seule ligne ouverte à la fois | Oui (accordion behavior — autres lignes se ferment) |

### 9.10 — Psychologie

#### Framing par contraste

> **Tversky & Kahneman (1981)** — *« The way alternatives are framed affects judgment and choice. »*

Présenter le rituel à côté de deux alternatives connues (vernis classique + semi-permanent) **active la comparaison**. Le rituel n'est plus un objet abstrait — il devient le **3ème choix** dans un univers déjà connu.

#### Center stage effect — colonne FemiGlow mise en valeur

> **Valenzuela & Raghubir (2009)** — *« Items in the center are perceived as the default choice. »*

La colonne FemiGlow est :
- **À droite** (pas au centre, mais à la **fin** = position de conclusion narrative)
- **Légèrement teintée sauge pâle** (différenciation visuelle subtile)
- **Marquée d'un ★ champagne** (signal de distinction)

Trois signaux faibles → un signal fort de *« voici la conclusion ».*

#### Strategic underplaying

Sur le critère « Effet immédiat », le rituel FemiGlow obtient **2 points** (en dessous des concurrents). C'est volontaire :

> **Tactique psychologique** : reconnaître une faiblesse rend les points forts plus crédibles. Si FemiGlow était maximum partout, le tableau serait suspect (cf. Theron-Bjørgaard 2016 — *« perceived honesty when admitting flaws »*).

L'astérisque + la note en bas reframent cette « faiblesse » en force : *« ce n'est pas un effet immédiat, c'est une construction patiente ».*

### 9.11 — Émotion

| Avant | Pendant | Après |
| :---- | :------ | :---- |
| Vérification rationnelle | Comparaison structurée | Conviction par contraste (« ah, je vois la différence ») |

### 9.12 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| Étoiles 5/5 au lieu de points                       | Code Amazon, sort du registre                                       |
| Maximum partout pour FemiGlow                       | Suspect, peu crédible (Theron-Bjørgaard 2016)                      |
| Critères trop nombreux (>8)                         | Surcharge cognitive, perte d'attention                              |
| Critères marketing (« Le plus aimé », « Tendance ») | Casse l'objectivité du comparatif                                  |
| Pas de note explicative pour les chiffres ambigus   | « 4-6 semaines » seul peut faire douter                            |
| Mention de marques concurrentes par leur nom        | Légalement risqué + mauvais ton                                     |
| Couleurs vives (rouge/vert) pour différencier       | Tue la palette signature                                            |

---

## 10 — Section 06 — FAQ contextuelle

### 10.1 — Wireframe

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│  LES QUESTIONS QU'ON NOUS POSE                                             │
│                                                                            │
│  Avant de recevoir le rituel.                                              │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │  Combien de temps dure un kit ?                              [+] │    │
│  ├──────────────────────────────────────────────────────────────────┤    │
│  │  Le rituel convient-il aux ongles fragiles ?                  [+] │    │
│  ├──────────────────────────────────────────────────────────────────┤    │
│  │  Y a-t-il des ingrédients allergènes ?                       [+] │    │
│  ├──────────────────────────────────────────────────────────────────┤    │
│  │  À quelle fréquence le pratiquer ?                           [+] │    │
│  ├──────────────────────────────────────────────────────────────────┤    │
│  │  Comment se passe la livraison ?                             [+] │    │
│  ├──────────────────────────────────────────────────────────────────┤    │
│  │  Puis-je retourner le kit si je change d'avis ?              [+] │    │
│  ├──────────────────────────────────────────────────────────────────┤    │
│  │  Le kit fait-il un beau cadeau ?                             [+] │    │
│  ├──────────────────────────────────────────────────────────────────┤    │
│  │  Quand vais-je devoir racheter le kit ?                      [+] │    │
│  ├──────────────────────────────────────────────────────────────────┤    │
│  │  Et si je ne sais pas faire les gestes ?                     [+] │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 10.2 — Composition

#### Surtitre

```
LES QUESTIONS QU'ON NOUS POSE
```

Inter SemiBold 7.5pt, tracking 2.5px, couleur Brume, centré.

#### Titre de section

```
Avant de recevoir le rituel.
```

Cormorant Light 32pt, couleur Encre, centré.

> **Pourquoi cette formulation ?** Parce qu'elle **suppose** la conversion. *« Avant de recevoir »* dit implicitement *« vous allez recevoir »*. C'est un cadrage psychologique discret mais puissant — la question n'est pas *« si »*, c'est *« comment ».*

### 10.3 — Disposition

| Breakpoint | Layout                                                   |
| :--------- | :------------------------------------------------------- |
| Desktop    | Largeur max 880px, centré (lecture optimale)             |
| Tablet     | Largeur 720px, centré                                    |
| Mobile     | Pleine largeur avec marges 24px                          |

### 10.4 — Spécifications de chaque question (accordéon)

#### État replié (par défaut)

```
┌──────────────────────────────────────────────────────────────────┐
│  Combien de temps dure un kit ?                              [+] │
└──────────────────────────────────────────────────────────────────┘
```

| Propriété         | Valeur                                                          |
| :---------------- | :-------------------------------------------------------------- |
| Hauteur           | 64px                                                             |
| Fond              | Transparent                                                      |
| Border bottom     | 1px solid `#E8E0D2` (Ligne)                                     |
| Padding           | 0 24px                                                           |
| Police question   | Cormorant Garamond Regular                                       |
| Taille question   | 17pt (desktop) · 16pt (mobile)                                   |
| Couleur question  | `#2C2A28` (Encre)                                                |
| Icône `+`         | Inter Regular 22pt, couleur Brume, position right                |
| Cursor            | `pointer` sur toute la ligne                                     |
| Hover             | Couleur question passe à `#A8C4A6` (Sauge dark) — transition 200ms |

#### État déplié

```
┌──────────────────────────────────────────────────────────────────┐
│  Combien de temps dure un kit ?                              [−] │
│                                                                  │
│  Un kit dure entre deux et trois mois pour une personne          │
│  qui pratique le rituel toutes les six semaines. Si vous le      │
│  partagez avec une amie ou si vous le pratiquez plus souvent,   │
│  comptez environ deux mois.                                      │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

| Propriété         | Valeur                                                          |
| :---------------- | :-------------------------------------------------------------- |
| Hauteur           | Auto (s'adapte au contenu)                                       |
| Padding réponse   | 0 24px 24px 24px (top 0 car la question reste visible)          |
| Police réponse    | Cormorant Garamond Regular                                       |
| Taille réponse    | 15pt (desktop) · 14pt (mobile)                                   |
| Line-height       | 1.6                                                              |
| Couleur réponse   | `#4A4844` (Encre claire)                                         |
| Icône             | `+` devient `−` (changement instantané)                          |
| Animation expand  | Hauteur 0 → auto, 320ms ease-out                                 |
| Animation reverse | Hauteur auto → 0, 240ms ease-in                                  |
| Plusieurs ouvertes simultanément ? | OUI — chaque question est indépendante (pas accordéon strict) |

> **Pourquoi plusieurs questions ouvertes simultanément ?** Parce que la cliente peut comparer plusieurs réponses (par ex. *« livraison »* + *« retour »* + *« cadeau »*). Forcer une seule à la fois la frustrerait.

### 10.5 — Les 9 questions/réponses — copy intégral

#### Question 1 — Durée d'un kit

**Q :** Combien de temps dure un kit ?

**R :**
```
Un kit dure entre deux et trois mois pour une personne qui pratique
le rituel toutes les six semaines. Si vous le partagez avec une amie
ou si vous le pratiquez plus souvent, comptez environ deux mois.
Les pots ne sèchent pas — leur formule est conçue pour conserver
sa texture jusqu'au dernier geste.
```

#### Question 2 — Ongles fragiles

**Q :** Le rituel convient-il aux ongles fragiles ?

**R :**
```
Le rituel est particulièrement adapté aux ongles fragiles. Là où
le vernis et le semi-permanent affaiblissent la kératine en l'étouffant,
le rituel FemiGlow nourrit chaque couche. Les femmes initiées
constatent souvent une amélioration de la solidité de leurs ongles
après deux à trois rituels — la kératine retrouve sa souplesse.
```

#### Question 3 — Allergènes

**Q :** Y a-t-il des ingrédients allergènes ?

**R :**
```
La composition de chaque pot est listée intégralement plus haut sur cette
page. Les ingrédients sont d'origine principalement minérale et végétale.
Aucun parfum synthétique, aucun parabène, aucun formaldéhyde. Si vous
êtes allergique à un ingrédient spécifique (huile de jojoba, beurre de
karité, cire d'abeille...), vérifiez la liste avant de recevoir le kit.
En cas de doute, écrivez-nous — nous répondons sous 24h.
```

#### Question 4 — Fréquence

**Q :** À quelle fréquence le pratiquer ?

**R :**
```
Le rituel se pratique idéalement toutes les quatre à six semaines.
Plus souvent serait inutile — la patine se construit, elle ne se
recommence pas. Plus rarement, c'est possible aussi : le rituel s'adapte
à votre rythme, pas l'inverse. Beaucoup d'initiées le pratiquent le
dimanche soir comme une ponctuation hebdomadaire douce.
```

#### Question 5 — Livraison

**Q :** Comment se passe la livraison ?

**R :**
```
À Casablanca, votre kit arrive en 48 heures ouvrées. Pour Rabat,
Marrakech, Tanger et Fès, comptez 3 à 5 jours. Pour les autres villes,
4 à 7 jours. La livraison est gratuite pour toute commande supérieure
à 250 dh — votre kit y est éligible. Vous recevez un SMS de suivi
le jour de l'expédition et le jour de la livraison.
```

#### Question 6 — Retour

**Q :** Puis-je retourner le kit si je change d'avis ?

**R :**
```
Oui. Vous avez quatorze jours après réception pour nous renvoyer le kit,
sans avoir à justifier votre décision. Si les pots sont scellés, vous êtes
intégralement remboursée. Si vous avez ouvert les pots et essayé le
rituel, vous êtes remboursée à hauteur de 70%, le reste couvrant
l'usage des matières. C'est notre engagement de respect.
```

#### Question 7 — Cadeau

**Q :** Le kit fait-il un beau cadeau ?

**R :**
```
Le kit est conçu comme un objet à offrir. Le carton extérieur est
neutre et élégant — pas de packaging plastique, pas d'autocollant
promotionnel. Vous pouvez ajouter une carte manuscrite gratuite
au moment de la commande : nous l'écrivons à la main et la glissons
dans le carton, sans facture visible. Le cadeau parfait pour une
amie qu'on veut prendre soin.
```

#### Question 8 — Réassort

**Q :** Quand vais-je devoir racheter le kit ?

**R :**
```
Quand l'un des quatre pots arrive à la fin. C'est généralement le pot
`shine` (le baume) qui se finit en premier — environ deux mois pour
une pratique régulière. Vous pouvez alors recommander le kit complet
ou, si vous le souhaitez, juste le pot manquant via votre espace
client. Nous proposons un rappel doux par e-mail huit semaines après
votre première commande, à désactiver à tout moment.
```

#### Question 9 — Apprentissage des gestes

**Q :** Et si je ne sais pas faire les gestes ?

**R :**
```
Le rituel apprend la main, pas l'inverse. Les premiers gestes peuvent
sembler hésitants — c'est normal et c'est juste. Une vidéo détaillée
des quatre gestes est disponible plus haut sur cette page, et un petit
livret papier accompagne le kit avec des photos pas-à-pas. Si malgré
tout une question reste, écrivez-nous : Salma, la fondatrice, répond
personnellement aux premiers messages.
```

### 10.6 — Tokens design

```css
/* ─── Section FAQ — tokens ─── */
--faq-bg: #FBF8F1;
--faq-padding-vertical: 96px;
--faq-max-width-desktop: 880px;
--faq-max-width-tablet: 720px;

--faq-item-height-collapsed: 64px;
--faq-item-padding: 0 24px;
--faq-item-border-bottom: 1px solid #E8E0D2;

--faq-question-font: 'Cormorant Garamond', serif;
--faq-question-weight: 400;
--faq-question-size-desktop: 17pt;
--faq-question-size-mobile: 16pt;
--faq-question-color: #2C2A28;
--faq-question-hover-color: #A8C4A6;

--faq-icon-size: 22pt;
--faq-icon-color: #6B6863;

--faq-answer-font: 'Cormorant Garamond', serif;
--faq-answer-size-desktop: 15pt;
--faq-answer-size-mobile: 14pt;
--faq-answer-line-height: 1.6;
--faq-answer-color: #4A4844;
--faq-answer-padding: 0 24px 24px 24px;

--faq-expand-duration: 320ms;
--faq-collapse-duration: 240ms;
--faq-easing: cubic-bezier(0.4, 0, 0.2, 1);
```

### 10.7 — Comportements UX

#### Au scroll d'arrivée

```
[section invisible]              → état initial
[atteint 80% viewport]           → titre + sous-titre fade-in (700ms)
[atteint 70%]                    → liste des 9 questions fade-in (600ms)
[par défaut]                     → toutes les questions sont REPLIÉES
```

#### Click sur une question

```
[click question repliée]         → animation expand 320ms
[icône + → −]                    → instantané
[autres questions]               → restent dans leur état (pas de fermeture forcée)
```

#### Click sur une question dépliée

```
[click question dépliée]         → animation collapse 240ms
[icône − → +]                    → instantané
```

#### Comportement clavier

| Touche                | Comportement                                        |
| :-------------------- | :-------------------------------------------------- |
| Tab                   | Focus sur la question suivante                      |
| Shift+Tab             | Focus sur la question précédente                    |
| Enter / Espace        | Toggle expand/collapse de la question focusée       |

#### Deep link via URL hash

Optionnel V2 : possibilité de lier directement à une question via `/kit#faq-livraison` (la question s'ouvre automatiquement et la page scrolle dessus).

### 10.8 — Psychologie

#### Effort reduction (Kolenda — UX)

> **Une FAQ bien conçue réduit le coût psychologique d'achat.** La cliente peut **picorer** ses doutes spécifiques sans tout lire. Cette autonomie est respectueuse.

#### Objection handling (Sugarman 1995)

Chaque question correspond à une **objection silencieuse** de la cliente :

| Question                          | Objection silencieuse adressée                              |
| :-------------------------------- | :---------------------------------------------------------- |
| Durée d'un kit                    | « Est-ce rentable pour le prix ? »                          |
| Ongles fragiles                   | « Et si ça abîme mes ongles déjà sensibles ? »              |
| Allergènes                        | « Et si je suis allergique ? »                              |
| Fréquence                         | « Faut-il en faire tout le temps ? Est-ce contraignant ? »  |
| Livraison                         | « Quand vais-je le recevoir ? »                              |
| Retour                            | « Et si je n'aime pas finalement ? »                         |
| Cadeau                            | « Puis-je l'offrir à quelqu'un ? »                          |
| Réassort                          | « Vais-je devoir racheter chaque mois ? »                   |
| Apprentissage                     | « Et si je n'y arrive pas ? »                                |

#### Tonalité paisible des réponses

> **Aucune réponse n'est défensive.** Chaque réponse :
> - Reconnaît la question avec respect
> - Répond précisément (chiffres, faits)
> - Reframe positivement quand possible (« le rituel apprend la main »)
> - Termine sur une note rassurante

#### Vulnérabilité contrôlée (Question 6 — retour)

La réponse mentionne un remboursement à **70%** si les pots sont ouverts. C'est une **vulnérabilité avouée** — un rituel ouvert ne peut pas être 100% remboursé pour des raisons sanitaires évidentes.

> Cette honnêteté **augmente la crédibilité** des autres réponses. Si on est honnête sur 70%, on est probablement honnête sur tout le reste.

### 10.9 — Émotion

| Avant | Pendant | Après |
| :---- | :------ | :---- |
| Doutes résiduels | Lecture sélective des objections | Doutes levés, dispoposition finale à l'achat |

### 10.10 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| Plus de 10 questions                                | Surcharge — 8-9 est l'optimum                                       |
| Réponses commerciales (« notre kit unique au Maroc ») | Casse la voix éditoriale                                          |
| Une seule question ouvrable à la fois               | Frustre la comparaison entre réponses                              |
| Animation > 400ms à l'expansion                     | Lent, frustrant                                                     |
| Liens « Voir détail » qui sortent vers une autre page | Casse le flux                                                     |
| Réponse en bullet points / listes                   | Code FAQ corporate, casse le ton                                   |
| Émojis dans les réponses (👍, ✓, 😊)                 | Sort complètement du registre                                       |
| Mention « Encore une question ? Contactez-nous »    | Cliché — préférer une mention plus humaine en pied de section       |
| Réponses < 30 mots                                   | Sec, peu rassurant                                                  |
| Réponses > 100 mots                                  | Trop longues, fatigue de lecture                                    |

---

## 11 — Section 07 — Témoignages photos-mains

### 11.1 — Wireframe

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│  ELLES ONT CHOISI LE RITUEL                                                │
│                                                                            │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐│
│  │                     │  │                     │  │                     ││
│  │  [photo mains 4:5]  │  │  [photo mains 4:5]  │  │  [photo mains 4:5]  ││
│  │                     │  │                     │  │                     ││
│  │                     │  │                     │  │                     ││
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘│
│                                                                            │
│  « Témoignage long       │  « Témoignage long      │  « Témoignage long   ││
│   60-100 mots, en         │   60-100 mots, en        │   60-100 mots, en   ││
│   Cormorant italic. »     │   Cormorant italic. »    │   Cormorant italic. »│
│                          │                          │                      ││
│  ─                        │  ─                        │  ─                   ││
│  Aïcha · Casablanca       │  Salma · Rabat            │  Yasmine · Marrakech ││
│  initiée depuis           │  initiée depuis           │  initiée depuis      ││
│  février 2026             │  janvier 2026             │  novembre 2025       ││
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 11.2 — Composition

#### Surtitre

```
ELLES ONT CHOISI LE RITUEL
```

Inter SemiBold 7.5pt, tracking 2.5px, couleur Brume, centré.

> **Différence avec `/accueil`** : sur `/accueil`, le surtitre était *« ELLES ONT ESSAYÉ LE RITUEL »* (curiosité). Ici, *« ELLES ONT CHOISI LE RITUEL »* (engagement). Le verbe a évolué avec le funnel.

#### Pas de titre de section additionnel

À ce stade, la cliente n'a plus besoin d'introduction. Les 3 cartes parlent directement.

### 11.3 — Disposition

| Breakpoint | Layout                                                    |
| :--------- | :-------------------------------------------------------- |
| Desktop    | 3 cartes côte à côte, gap 32px, max-width 1200px          |
| Tablet     | 3 cartes côte à côte, gap 20px                            |
| Mobile     | Carrousel swipe horizontal, 1 carte visible + aperçu      |

### 11.4 — Spécifications de chaque carte

#### Container

| Propriété         | Valeur                                                          |
| :---------------- | :-------------------------------------------------------------- |
| Largeur           | 33.3% - gap (desktop)                                            |
| Padding interne   | 0 (le padding vient de la grille)                                |
| Border            | Aucun                                                            |
| Fond              | Transparent                                                      |

#### Photo

| Propriété         | Valeur                                                                |
| :---------------- | :-------------------------------------------------------------------- |
| Sujet             | Mains de la femme — JAMAIS son visage                                 |
| Variante 1 (Aïcha) | Mains tenant un livre ouvert sur ses genoux, ongles visibles         |
| Variante 2 (Salma) | Une main posée sur une tasse de thé fumant                           |
| Variante 3 (Yasmine) | Mains au piano, dans un mouvement très lent                         |
| Format            | 4:5 (portrait)                                                         |
| Hauteur affichage | 280px (desktop) · 240px (tablet) · 320px (mobile)                     |
| Border-radius     | 0                                                                      |
| Filter            | Aucun (couleurs naturelles préservées)                                |

> **Pourquoi des contextes différents ?** Pour montrer **la diversité de l'usage**. Le rituel n'est pas réservé à un seul moment ou à un seul type de femme. Une lectrice de roman, une buveuse de thé, une pianiste — chacune trouve sa place dans le rituel.

#### Citation longue

##### Spécifications typographiques

| Propriété         | Valeur                                                          |
| :---------------- | :-------------------------------------------------------------- |
| Police            | Cormorant Garamond Light Italic                                  |
| Taille            | 15pt (desktop) · 14pt (mobile)                                   |
| Line-height       | 1.6                                                              |
| Couleur           | `#2C2A28` (Encre)                                                |
| Guillemets        | Français typographiques `« »` avec espaces insécables            |
| Longueur          | 60 à 100 mots                                                    |
| Espacement haut   | 24px (sous la photo)                                              |

#### Filet séparateur

```
─
```

| Propriété         | Valeur                                            |
| :---------------- | :------------------------------------------------ |
| Caractère         | em-dash U+2014                                    |
| Couleur           | `#A8C4A6` (Sauge dark)                            |
| Taille            | 11pt                                              |
| Espacement haut   | 16px (sous la citation)                           |
| Alignement        | Aligné à gauche                                   |

#### Signature

| Élément                | Style                                                 |
| :--------------------- | :---------------------------------------------------- |
| Prénom + Ville         | Inter Medium 13pt, couleur Encre, ligne 1              |
| « initiée depuis [mois année] » | Inter Regular 11pt italic, couleur Brume `#6B6863`, ligne 2 |
| Espacement haut        | 8px (sous le filet)                                    |
| Espace entre lignes    | 4px                                                    |

### 11.5 — Les trois témoignages — copy intégral

#### Témoignage 1 — Aïcha (efficacité)

**Photo** : Mains tenant un livre ouvert sur les genoux, ongles visibles, lumière de fenêtre.

**Citation** :
```
« J'ai toujours eu les ongles fragiles, qui se dédoublaient au moindre
geste. Le rituel a changé ça en trois mois — je ne sais pas comment,
mais ils ont retrouvé une force que je ne leur connaissais plus.
Aujourd'hui, je peux ouvrir une boîte de conserve sans craindre.
C'est devenu un soin, pas une précaution. »
```

**Signature** :
```
Aïcha · Casablanca
initiée depuis février 2026
```

#### Témoignage 2 — Salma (plaisir du rituel)

**Photo** : Une main posée sur une tasse de thé fumant, sur une table de bois clair.

**Citation** :
```
« Ce que j'aime, c'est le moment. Quatre minutes le dimanche soir, une
tasse de thé à côté, la radio en fond. Mes mains font quelque chose
de simple, et le reste de la semaine se met en place. Je ne pensais pas
qu'un soin pouvait devenir une habitude que j'attends. C'est devenu mon
rituel à moi, sans personne à qui le justifier. »
```

**Signature** :
```
Salma · Rabat
initiée depuis janvier 2026
```

#### Témoignage 3 — Yasmine (fidélité dans la durée)

**Photo** : Mains au piano, dans un mouvement très lent, lumière naturelle.

**Citation** :
```
« Je joue du piano. Mes mains comptent — je les regarde tout le temps,
et elles me déçoivent souvent. Avec le rituel, j'ai arrêté de chercher
à les masquer. Elles ne sont pas parfaites, mais elles ont cette lumière
discrète qui suffit. Cela fait six mois que je pratique, et je n'ai pas
envie de m'arrêter. »
```

**Signature** :
```
Yasmine · Marrakech
initiée depuis novembre 2025
```

### 11.6 — Choix narratifs des trois témoignages

Chaque témoignage adresse une **dimension différente** :

| Témoignage   | Dimension                | Émotion ciblée                    | Cible      |
| :----------- | :----------------------- | :-------------------------------- | :--------- |
| Aïcha        | **Efficacité physique**  | Confiance scientifique            | Profil B (rationnel) |
| Salma        | **Plaisir du moment**    | Désir d'expérience                | Profil A (émotionnel) |
| Yasmine      | **Fidélité dans la durée** | Engagement long terme            | Profil mixte |

> Cette **diversité psychologique** garantit qu'au moins un témoignage résonne avec chaque visiteuse, peu importe son profil.

### 11.7 — Tokens design

```css
/* ─── Section Témoignages — tokens ─── */
--temoignages-bg: #FBF8F1;
--temoignages-padding-vertical: 96px;
--temoignages-grid-gap-desktop: 32px;
--temoignages-grid-gap-mobile: 16px;
--temoignages-max-width: 1200px;

--temoignages-photo-aspect: 4/5;
--temoignages-photo-height-desktop: 280px;
--temoignages-photo-height-mobile: 320px;

--temoignages-quote-font: 'Cormorant Garamond', serif;
--temoignages-quote-style: italic;
--temoignages-quote-weight: 300;
--temoignages-quote-size-desktop: 15pt;
--temoignages-quote-size-mobile: 14pt;
--temoignages-quote-line-height: 1.6;
--temoignages-quote-color: #2C2A28;

--temoignages-divider-color: #A8C4A6;
--temoignages-divider-size: 11pt;

--temoignages-name-font: 'Inter', sans-serif;
--temoignages-name-weight: 500;
--temoignages-name-size: 13pt;
--temoignages-name-color: #2C2A28;

--temoignages-date-style: italic;
--temoignages-date-weight: 400;
--temoignages-date-size: 11pt;
--temoignages-date-color: #6B6863;
```

### 11.8 — Comportements UX

#### Animation au scroll

```
[section invisible]              → état initial
[atteint 80% viewport]           → surtitre fade-in (500ms)
[atteint 70%]                    → 3 cartes apparaissent en cascade (200ms entre chaque, 600ms chacune)
```

#### Hover sur une carte (desktop)

| Action                | Comportement                                          |
| :-------------------- | :---------------------------------------------------- |
| Hover photo           | Très subtil zoom-in 1.02× (600ms ease-out)            |
| Hover citation        | Aucune                                                 |
| Hover signature       | Aucune                                                 |
| Cursor                | `default` — la carte n'est pas cliquable              |

> **Pourquoi le hover photo et pas tout ?** Parce qu'un léger zoom rappelle subtilement la **vie** dans la photo. Mais la carte n'est pas cliquable — il n'y a rien à voir au-delà.

#### Comportement mobile — carrousel

| Élément                  | Spécifications                                        |
| :----------------------- | :---------------------------------------------------- |
| Type                     | Swipe horizontal natif (CSS scroll-snap)              |
| Cartes visibles          | 1 carte centrée + ~15% de la suivante en aperçu       |
| Indicateurs              | 3 dots sous le carrousel, dot actif en sauge dark      |
| Flèches navigation       | **Aucune** (gestuelle naturelle suffit)               |
| Auto-rotate              | **Aucun** (la cliente contrôle le rythme)              |

### 11.9 — Psychologie

#### Imply human (final niveau)

> **Lu et al. (2023)** : *« Imply human presence rather than show. »*

Les 3 photos montrent des **mains en action** :
- Aïcha : mains qui tiennent un livre (intellectuelle)
- Salma : main qui tient une tasse (contemplative)
- Yasmine : mains au piano (créative)

**Aucun visage**. Mais chaque main raconte un **caractère**. La cliente projette son propre caractère sur la photo qui lui ressemble le plus.

#### Mirror effect — multiplicité des miroirs

> Trois prénoms marocains, trois villes, trois activités, trois moments de vie. Statistiquement, **au moins une** des trois doit refléter la cliente. Si elle est une lectrice → Aïcha. Une amatrice de thé → Salma. Une artiste → Yasmine.

C'est de la **stratégie de couverture démographique psychologique**.

#### Vulnérabilité contrôlée

Chaque témoignage **mentionne une fragilité initiale** :
- Aïcha : *« j'ai toujours eu les ongles fragiles »*
- Salma : *« je ne pensais pas qu'un soin pouvait devenir une habitude »*
- Yasmine : *« elles me déçoivent souvent »*

Cette vulnérabilité **rend les témoignages crédibles** (Berger & Heath 2007). Aucune des trois n'est une ambassadrice parfaite — elles sont **humaines**.

#### Témoignage long > court (BOFU)

> Sur `/accueil`, les témoignages sont **courts** (15-25 mots) — la cliente survole.
> Sur `/kit`, les témoignages sont **longs** (60-100 mots) — la cliente lit.

À ce stade du funnel, la cliente cherche des **preuves substantielles**. Un témoignage de 80 mots avec un **détail concret** (« ouvrir une boîte de conserve », « la radio en fond », « six mois ») est infiniment plus persuasif qu'une citation polie de 20 mots.

### 11.10 — Émotion

| Avant | Pendant | Après |
| :---- | :------ | :---- |
| Doutes levés (post-FAQ) | Identification (au moins 1 témoignage sur 3) | Conviction sociale (« d'autres l'ont fait, et l'aiment ») |

### 11.11 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| Photos de visages                                   | Détruit la stratégie d'imply human, baisse les conversions          |
| Étoiles 5/5                                         | Code Amazon                                                        |
| Plus de 3 témoignages                               | Effort de lecture, l'œil décroche                                   |
| Témoignages tous semblables (même type de personne)| Réduit la couverture démographique                                  |
| Citations marketing (« j'adore ! »)                 | Faux, perçu                                                         |
| Mention « Voir tous les avis (247) »                | Code Amazon, dévalue                                                |
| Photos retouchées (lissage de peau, ongles parfaits) | Crée de la distance, pas d'identification                          |
| Verbes superlatifs (« incroyable », « parfait »)    | Casse l'authenticité                                                |

---

## 12 — Section 08 — CTA final + cross-link Journal

### 12.1 — Wireframe

```
┌════════════════════════════════════════════════════════════════════════════┐
║                                                                            ║
║                                                                            ║
║                                                                            ║
║                  Le rituel d'éclat. 320 dh.                                ║
║                                                                            ║
║                                                                            ║
║                  ┌───────────────────────────┐                             ║
║                  │   Recevoir le rituel      │                             ║
║                  └───────────────────────────┘                             ║
║                                                                            ║
║                                                                            ║
║                  Livraison 48h Casa · Retour 14j                           ║
║                                                                            ║
║                                                                            ║
└════════════════════════════════════════════════════════════════════════════┘
                            (fond sauge pâle pleine largeur)

┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│  POUR ALLER PLUS LOIN                                                      │
│                                                                            │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐  │
│  │  [photo lifestyle] │  │  [photo lifestyle] │  │  [photo lifestyle] │  │
│  │                    │  │                    │  │                    │  │
│  │  Pourquoi nous     │  │  Hiver, ongles, et │  │  Mon premier       │  │
│  │  ne posons pas de  │  │  patience.         │  │  rituel — récit    │  │
│  │  vernis.           │  │                    │  │  d'une initiée.    │  │
│  │  ─                 │  │  ─                 │  │  ─                 │  │
│  │  Le 12 avril 2026  │  │  Le 28 mars 2026   │  │  Le 5 février 2026 │  │
│  └────────────────────┘  └────────────────────┘  └────────────────────┘  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 12.2 — Bandeau CTA final (sauge pâle)

#### Fond et structure

| Propriété          | Valeur                                                          |
| :----------------- | :-------------------------------------------------------------- |
| Fond               | `#E8EFE7` (Sauge pâle) — pleine largeur                          |
| Hauteur            | 320px (desktop) · 280px (mobile)                                 |
| Padding vertical   | 80px                                                             |
| Alignement contenu | Centré                                                           |

#### Phrase d'introduction au CTA

```
Le rituel d'éclat. 320 dh.
```

| Propriété          | Valeur                                                          |
| :----------------- | :-------------------------------------------------------------- |
| Police             | Cormorant Garamond Light                                         |
| Taille             | 28pt (desktop) · 22pt (mobile)                                   |
| Couleur            | `#2C2A28` (Encre)                                                |
| Alignement         | Centré                                                           |
| Disposition        | Une ligne                                                        |

> **Pourquoi rappeler le prix ici ?** Parce qu'à ce stade, la cliente **a tout vu**. Le prix n'est plus une surprise — c'est un **rappel calme** au moment de la décision finale. C'est la confirmation que rien n'a changé pendant la lecture.

#### CTA dupliqué

```
Recevoir le rituel
```

**Spécifications identiques au CTA above the fold** (section 5.6) :
- Inter Medium 14pt
- Texte crème pure sur fond encre
- Padding 18px 40px
- Largeur 280px (desktop) · 100% du bloc (mobile)
- Action : add-to-cart + animation pot vers panier + mini modal panier

| Différence avec ATF | Spécification                                                  |
| :------------------ | :------------------------------------------------------------- |
| Espacement haut     | 32px sous la phrase d'intro                                     |
| Position            | Centré (pas aligné gauche comme ATF)                            |

> **Pourquoi le même wording ?** Cohérence absolue. La cliente apprend qu'`Recevoir le rituel` = action d'achat. Changer le verbe ici la perdrait.

#### Réassurances raccourcies

```
Livraison 48h Casa · Retour 14j
```

| Propriété          | Valeur                                                          |
| :----------------- | :-------------------------------------------------------------- |
| Police             | Inter Regular                                                    |
| Taille             | 11pt                                                             |
| Couleur            | `#6B6863` (Brume)                                                |
| Séparateur `·`     | Middle dot, espacement 8px                                        |
| Espacement haut    | 32px sous le CTA                                                  |
| Alignement         | Centré                                                           |

> **Pourquoi 2 réassurances seulement (au lieu de 3) ?** Parce qu'à ce stade, le paiement 3× n'est plus l'argument décisif — la cliente sait déjà qu'elle peut payer. Garder 2 réassurances = sobre, pas redondant.

### 12.3 — Section Cross-link Journal

#### Wireframe

Identique à la section Cross-link de `/rituel` — grille régulière de 3 cartes.

#### Surtitre

```
POUR ALLER PLUS LOIN
```

Inter SemiBold 7.5pt, tracking 2.5px, couleur Brume, centré.

#### Disposition

| Breakpoint | Layout                                                  |
| :--------- | :------------------------------------------------------ |
| Desktop    | 3 cartes égales, gap 24px                                |
| Tablet     | 3 cartes égales, gap 20px                                |
| Mobile     | Carrousel swipe                                          |

#### Spécifications identiques à `/rituel` section 11

Voir document `/rituel`, section 11.2 pour les détails (photo height 220px, titre Cormorant 18pt, filet sauge dark, date Inter 10pt, hover scale 1.04).

### 12.4 — Trois articles connexes — choix éditorial

| # | Titre                                                          | Catégorie  | Date          | Lien                              |
| :- | :------------------------------------------------------------ | :--------- | :------------ | :-------------------------------- |
| 1 | *« Pourquoi nous ne posons pas de vernis. »*                  | Maison     | 12 avril 2026 | `/journal/pourquoi-pas-de-vernis` |
| 2 | *« Hiver, ongles, et patience. »*                             | Saison     | 28 mars 2026  | `/journal/hiver-ongles-patience`  |
| 3 | *« Mon premier rituel — récit d'une initiée. »*               | Voix       | 5 février 2026 | `/journal/premier-rituel`         |

> **Différence avec `/rituel`** : sur `/rituel`, les 3 articles **prolongeaient** le rituel (sciences, pratique, voix). Sur `/kit`, les 3 articles **rassurent** une cliente non-convertie (pourquoi cette philosophie, comment ça se passe en hiver, témoignage de premier rituel).

### 12.5 — Tokens design

```css
/* ─── Section CTA final + cross-link — tokens ─── */

/* Bandeau CTA final */
--cta-final-bg: #E8EFE7;
--cta-final-padding-vertical: 80px;
--cta-final-intro-size: 28pt;
--cta-final-intro-color: #2C2A28;

--cta-final-button-bg: #2C2A28;
--cta-final-button-text: #FBF8F1;
--cta-final-button-padding: 18px 40px;
--cta-final-button-width: 280px;
--cta-final-button-margin-top: 32px;

--cta-final-reassurance-color: #6B6863;
--cta-final-reassurance-size: 11pt;
--cta-final-reassurance-margin-top: 32px;

/* Cross-link Journal (identique /rituel) */
--crosslink-bg: #FBF8F1;
--crosslink-padding-vertical: 80px;
--crosslink-grid-gap-desktop: 24px;
--crosslink-photo-height-desktop: 220px;
--crosslink-title-size: 18pt;
--crosslink-title-color: #2C2A28;
--crosslink-date-color: #6B6863;
--crosslink-date-size: 10pt;
--crosslink-card-hover-scale: 1.04;
```

### 12.6 — Psychologie

#### CTA repetition (Kolenda)

> **La répétition d'un même CTA augmente la conversion** — surtout sur les pages longues. Ici, le CTA apparaît :
> 1. **Above the fold** (premier point de conversion)
> 2. **Bandeau CTA final** (deuxième point de conversion)
>
> Aucune autre apparition. Pas de CTA flottant sticky qui suit le scroll (trop agressif). Deux apparitions, deux moments précis.

#### Bandeau sauge — symétrie graphique avec `/rituel`

Sur `/rituel`, le pivot vers `/kit` était sur fond **sauge pâle**. Sur `/kit`, le CTA final dupliqué est aussi sur fond **sauge pâle**. Cette symétrie graphique :

- Crée une **continuité visuelle** entre les pages BOFU
- Signale que ce moment est un **moment de bascule**
- Réutilise le code couleur de l'engagement (sauge = nature, calme, oui)

#### Cross-link comme filet de sécurité

Pour les ~50% qui n'auront pas converti après le bandeau CTA, le cross-link Journal offre **une voie de sortie qualifiée**. La cliente :
- Sort du tunnel d'achat sans frustration
- Reste dans l'écosystème de la marque
- Lit un article qui peut la reconvaincre plus tard
- Reçoit éventuellement un cookie de retargeting ciblé

### 12.7 — Émotion

| Avant | Pendant | Après |
| :---- | :------ | :---- |
| Conviction sociale | Décision finale OU repli vers Journal | Conversion (~30% supplémentaires) ou loyauté différée |

### 12.8 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| CTA différent du CTA above the fold                 | Casse la cohérence, crée un doute                                   |
| CTA flottant sticky en plus                         | Agressif, casse la sobriété                                         |
| Promotion ou réduction sur le CTA final             | Détruit la marque luxe                                              |
| Plus de 3 articles cross-link                       | Surcharge à la sortie                                               |
| Cross-link uniquement vers `/kit` (boucle)          | Frustrant — la cliente a déjà vu la page                            |
| Newsletter dans le bandeau                          | Détourne du CTA principal                                           |
| Bouton « Continuer mes achats »                     | Pas adapté — c'est un mono-SKU                                       |

---

## 13 — Footer — élément persistant

### 13.1 — Structure héritée

Le footer de `/kit` est **identique** à celui de `/accueil` et `/rituel` — c'est un élément global du site (charte d'architecture, page 11 du document architecture).

### 13.2 — Spécificités sur `/kit`

| Différence              | Spécification                                                       |
| :---------------------- | :------------------------------------------------------------------ |
| **Item « Le kit »**     | Dans la colonne « LE RITUEL » du footer, l'item **« Le kit »** est visuellement actif : couleur `#FBF8F1` Crème pure (au lieu de `#E8E0D2` Ligne) + soulignement subtil 1px sauge dark, offset 6px |
| **Newsletter**          | **Aucune apparition newsletter dans le footer** — réservée à `/journal` |
| **Espacement avec Cross-link** | 80px de padding vertical entre la fin de la section 08 et le début du footer |

### 13.3 — Rappel des spécifications globales

| Propriété      | Valeur                                                |
| :------------- | :---------------------------------------------------- |
| Hauteur        | 320px (desktop) · auto (mobile, accordion)            |
| Fond           | `#2C2A28` (Encre)                                     |
| Padding        | 64px 96px (desktop) · 48px 24px (mobile)              |
| Layout         | Grid 5 colonnes (1 wordmark + 4 liens)                 |

### 13.4 — Persistance du panier

Si la cliente a ajouté le kit au panier (mini modal triggered) puis scrolle jusqu'au footer, le **CTA panier dans le header conserve son état `[Panier · 1]`** sur toute la page. Cette persistance visuelle est un signal continu : *« votre rituel vous attend ».*

> **Implementation note** : compteur en JavaScript reactive (Vue, React, Alpine, ou vanilla custom). État stocké en cookie `femiglow_cart={items: [...]}`, durée 7 jours.

---

## 14 — Comportements transverses & mécaniques de panier

### 14.1 — Smooth scroll

`scroll-behavior: smooth` activé en CSS, désactivé si :
- L'utilisateur a `prefers-reduced-motion: reduce` activé
- Sur les ancres rapides (jump links FAQ) : scroll instantané sur Cmd/Ctrl+click

### 14.2 — Lazy loading des images et de la vidéo

| Type d'image / média          | Stratégie                                            |
| :---------------------------- | :--------------------------------------------------- |
| Photo above the fold (hero)   | `loading="eager"`, **preload critique pour LCP**     |
| 4 photos slow reveal          | `loading="lazy"`, intersection observer              |
| **Vidéo 4 gestes (60s)**      | `preload="metadata"` — pas le payload complet         |
| Photos témoignages            | `loading="lazy"`                                     |
| Photos cross-link             | `loading="lazy"`                                     |
| Footer                        | (aucune image)                                       |

#### Stratégie spéciale — image above the fold (LCP critique)

```html
<link rel="preload" as="image" href="/images/kit-hero-desktop.webp"
      media="(min-width: 768px)"
      fetchpriority="high">
<link rel="preload" as="image" href="/images/kit-hero-mobile.webp"
      media="(max-width: 767px)"
      fetchpriority="high">
```

**Cible LCP < 2.0s** (plus strict que `/rituel`) car BOFU = perte de conversion par seconde de retard.

### 14.3 — Mécanique Add-to-Cart (ATC) — détaillée

#### Étape 1 — Click sur le CTA

```
[t=0ms]      → Click sur "Recevoir le rituel"
[t=0-100ms]  → Visual feedback :
                - CTA scale 0.97 (compression tactile)
                - Cursor reste pointer
                - Aucun changement de texte visible
```

#### Étape 2 — Loading state

```
[t=100-200ms]→ CTA texte fade-out (100ms)
[t=200-400ms]→ Spinner mini visible au centre du CTA
                - Spinner : cercle 16px, stroke 2px, couleur crème pure
                - Animation rotation 1 tour/800ms
[t=200ms]    → Requête API POST /cart/add (payload: { sku: "kit-rituel", quantity: 1 })
```

#### Étape 3 — Server response

```
[t=400-500ms]→ Server response received (idéal < 200ms)
                - Si succès → étape 4
                - Si erreur (stock 0 ou réseau) → étape 6 (erreur)
```

#### Étape 4 — Animation pot vers panier

```
[t=500-800ms]→ Animation cinétique :
                - Un mini "pot" sauge (32×32px) apparaît au centre du CTA
                - Il "vole" en courbe de Bézier vers le panier (header haut-droite)
                - Trajectoire : courbe douce arc parabolic
                - Durée : 800ms ease-out
                - Pendant le vol : scale du pot diminue progressivement (1 → 0.7)
                - Opacity diminue (1 → 0) à la fin du vol
```

#### Étape 5 — Animation panier compteur

```
[t=800-1100ms] → CTA panier dans header :
                - Compteur passe de 0 à 1
                - Texte "Panier" devient "Panier · 1"
                - Pulse scale (1 → 1.15 → 1) en 600ms ease-in-out
                - Couleur fond passe sauge → champagne → sauge en 800ms (dégradé)
                - Le "1" apparaît en Inter Medium 13pt couleur encre
```

#### Étape 6 — Mini modal panier slide-in

```
[t=1100-1430ms] → Mini modal panier :
                - Slide-in from right (320ms ease-out)
                - Apparition fade-in simultanée
                - Position : top 80px (sous header), right 24px
                - Largeur 360px (desktop) · 100% - 32px (mobile)
                - Contenu :
                  ✓ Ajouté à votre rituel
                  [photo kit miniature] Kit Rituel d'Éclat · 320 dh
                  [Voir mon panier]
                  Continuer la lecture
```

#### Étape 7 — CTA original revient

```
[t=1100-1300ms] → CTA original :
                - Texte "Recevoir le rituel" remplacé par "Ajouté ✓" pendant 1500ms
                - Texte en Inter Medium 14pt, couleur crème pure
                - Pas de couleur fond changement (reste encre)
[t=2800ms]      → CTA revient à "Recevoir le rituel"
                - Re-cliquable (en cas de re-ajout — incrémenterait le compteur)
```

#### Étape 8 — Auto-close du mini modal

```
[t=8 secondes après ouverture] → Mini modal fade-out 320ms
                                  - Fade-out + slide-out légère 16px vers la droite
                                  - Reste accessible : compteur header toujours `[Panier · 1]`
```

### 14.4 — Mini modal panier — interactions

#### Click « Voir mon panier »

```
→ Navigation vers /panier
→ Avant navigation : modal fade-out 200ms
→ Page /panier charge avec le kit déjà visible
```

#### Click « Continuer la lecture »

```
→ Modal fade-out 320ms
→ Compteur header reste à 1
→ Cliente reste sur /kit, peut continuer à scroller
```

#### Click extérieur au modal

```
→ Modal fade-out 240ms
→ Comportement identique à "Continuer la lecture"
```

#### Click sur bouton × en haut-droite du modal

```
→ Modal fade-out 240ms (instantané sur le click)
```

### 14.5 — Cas d'erreur — Stock 0 (rare mais à prévoir)

```
[Server response error] → Stock = 0 ou item indisponible

CTA état :
- Spinner disparaît
- Texte CTA change pour "Bientôt disponible" pendant 3 secondes
- Pas d'animation pot vers panier
- Pas d'ouverture mini modal panier

Microcopy en dessous du CTA (apparition fade-in) :
"Le rituel arrive bientôt. Vous pouvez nous laisser votre email pour être prévenue."

Sous-CTA secondaire :
[Champ email + bouton Prévenez-moi]

Après 3 secondes :
- Le CTA original revient ("Recevoir le rituel")
- Le sous-CTA email reste visible si champ a été activé
```

### 14.6 — Persistance du panier (cookie)

```javascript
// Pseudo-code
const cart = {
  items: [{ sku: "kit-rituel", quantity: 1, added_at: "2026-05-01T14:32:00Z" }],
  total: 320,
  currency: "MAD"
};

document.cookie = `femiglow_cart=${encodeURIComponent(JSON.stringify(cart))};` +
                  `max-age=604800;` +  // 7 jours
                  `path=/;` +
                  `SameSite=Lax;` +
                  `Secure`;
```

#### Comportements de persistance

| Scénario                                | Comportement                                                 |
| :-------------------------------------- | :----------------------------------------------------------- |
| Cliente ajoute au panier                | Cookie créé, valide 7 jours                                   |
| Cliente quitte la page sans payer       | Cookie persiste, panier visible au retour                     |
| Cliente revient 3 jours plus tard       | Compteur header `[Panier · 1]` toujours visible               |
| Cliente revient après 8 jours           | Cookie expiré, panier vide                                    |
| Cliente vide manuellement le panier     | Cookie effacé immédiatement                                   |

### 14.7 — Format d'image et vidéo

#### Images

| Format primaire | Format fallback | Compression |
| :-------------- | :-------------- | :---------- |
| WebP            | JPEG            | Qualité 82, profil sRGB |
| AVIF (futur)    | WebP, JPEG      | Qualité 76  |

#### Vidéo (60s sur `/kit`)

| Format primaire | Format fallback | Bitrate cible 1080p |
| :-------------- | :-------------- | :------------------ |
| MP4 (H.264)     | WebM (VP9)      | 6 Mbps              |
| MP4 720p        | WebM 720p       | 3 Mbps              |
| MP4 480p        | WebM 480p       | 1.2 Mbps            |

Streaming HLS via Cloudflare Stream ou Mux pour adaptation automatique.

### 14.8 — Animation timing — règle générale

| Type d'animation              | Durée            | Easing                              |
| :---------------------------- | :--------------- | :---------------------------------- |
| Hover button                  | 220ms            | `cubic-bezier(0.4, 0, 0.2, 1)`      |
| Hover photo card              | 600ms            | `cubic-bezier(0.4, 0, 0.2, 1)`      |
| Header transition             | 240ms            | `cubic-bezier(0.4, 0, 0.2, 1)`      |
| Page load (hero entry)        | 800-1200ms       | `cubic-bezier(0.16, 1, 0.3, 1)`     |
| Section reveal scroll         | 600-700ms        | `cubic-bezier(0.4, 0, 0.2, 1)`      |
| Slow reveal pots              | 700ms par photo  | `cubic-bezier(0.16, 1, 0.3, 1)`     |
| FAQ expand                    | 320ms            | `cubic-bezier(0.4, 0, 0.2, 1)`      |
| FAQ collapse                  | 240ms            | `cubic-bezier(0.4, 0, 0.2, 1)`      |
| **ATC pot animation**         | **800ms**        | `cubic-bezier(0.4, 0, 0.2, 1)`      |
| **Cart counter pulse**        | **600ms**        | `cubic-bezier(0.4, 0, 0.6, 1)`      |
| **Mini modal slide-in**       | **320ms**        | `cubic-bezier(0.16, 1, 0.3, 1)`     |
| **Mini modal slide-out**      | **240ms**        | `cubic-bezier(0.4, 0, 1, 1)`        |

> **Règle d'or** : aucune animation > 1.5s pour les interactions critiques. Les animations ATC sont **calibrées** pour donner du feedback sans devenir frustrantes.

### 14.9 — Reduced motion

Pour les utilisateurs avec `prefers-reduced-motion: reduce` :

- Animations d'entrée à 0ms (apparition instantanée)
- Slow reveal pots : photos apparaissent finalisées
- Animation ATC pot vers panier : **désactivée** (le compteur passe directement de 0 à 1)
- Animation pulse compteur : désactivée
- Mini modal : slide-in remplacé par fade-in 160ms
- Hover transitions : conservées (220ms ou moins) pour le feedback

### 14.10 — Pause vidéo intelligente

| Trigger                              | Action                                            |
| :----------------------------------- | :------------------------------------------------ |
| Section vidéo sort du viewport       | Pause + `preload="metadata"` (libère bande passante) |
| Section vidéo revient                | Reprend automatiquement (sauf pause manuelle)     |
| Onglet redevient actif               | Reprend si en cours de lecture                     |
| Cliente clique pause manuellement    | État mémorisé — pas de reprise automatique        |

### 14.11 — État de chargement initial

```
[t=0ms]      → HTML loaded, fond crème visible
[t=100ms]    → Police Inter chargée (woff2 preload)
[t=300ms]    → Police Cormorant chargée
[t=500ms]    → Police Pinyon Script chargée (header uniquement)
[t=600ms]    → Hero photo above the fold chargée (LCP)
[t=900ms]    → FCP atteint (titre + prix visibles)
[t=1500ms]   → LCP atteint (image complète)
[t=2000ms]   → Page interactive (CTA fonctionnel)
[t=Section 02 reached] → Slow reveal s'enclenche
[t=Section 03 reached] → Vidéo commence chargement progressif
```

---

## 15 — Adaptation responsive

### 15.1 — Breakpoints officiels

| Nom         | Min-width | Max-width | Layout principal                |
| :---------- | :-------- | :-------- | :------------------------------ |
| **Mobile**  | 0         | 767px     | 1 colonne, vertical             |
| **Tablet**  | 768px     | 1279px    | 2 colonnes mixtes               |
| **Desktop** | 1280px    | -         | Multi-colonnes, max-width 1280px |

### 15.2 — Adaptations par section

#### Above the fold (Section 01)

| Propriété              | Desktop          | Tablet          | Mobile           |
| :--------------------- | :--------------- | :-------------- | :--------------- |
| Layout                 | Photo 55% / Info 45% | 50% / 50%   | Empilés (photo dessus, info dessous) |
| Hauteur                | 88vh             | 84vh            | Auto             |
| Padding latéral        | 96px             | 64px            | 24px             |
| Photo ratio            | 4:5              | 1:1             | 4:5              |
| Titre size             | 48pt             | 36pt            | 32pt             |
| Sous-titre size        | 17pt             | 15pt            | 14pt             |
| Prix size              | 36pt             | 28pt            | 24pt             |
| CTA largeur            | 280px            | 240px           | 100% du bloc info|

#### Slow reveal composition (Section 02)

| Propriété              | Desktop          | Tablet          | Mobile           |
| :--------------------- | :--------------- | :-------------- | :--------------- |
| Layout                 | 2×2 grille       | 2×2 grille      | 1×4 vertical     |
| Gap                    | 24px             | 20px            | 32px             |
| Photo height           | 360px            | 300px           | 320px            |

#### Vidéo (Section 03)

| Propriété              | Desktop          | Tablet          | Mobile           |
| :--------------------- | :--------------- | :-------------- | :--------------- |
| Container width        | max 1280px       | full - 32px     | full - 16px      |
| Vidéo aspect           | 16:9             | 16:9            | 16:9             |
| Hauteur section        | 80vh             | 80vh            | 60vh             |
| Captions size          | 16pt             | 15pt            | 14pt             |

#### Composition par pot (Section 04)

| Propriété              | Desktop          | Tablet          | Mobile           |
| :--------------------- | :--------------- | :-------------- | :--------------- |
| Layout                 | 2×2 grille       | 2×2 grille      | 1 colonne        |
| Card padding           | 32px             | 28px            | 24px             |
| Verbe size             | 22pt             | 20pt            | 20pt             |
| Ingrédients size       | 12pt             | 12pt            | 12pt             |

#### Comparatif (Section 05)

| Propriété              | Desktop          | Tablet          | Mobile           |
| :--------------------- | :--------------- | :-------------- | :--------------- |
| Layout                 | Tableau classique| Tableau scrollable horizontal | **Accordéon par critère** |
| Cell height            | 64px             | 56px            | Auto             |
| Header height          | 80px             | 64px            | Auto             |

#### FAQ (Section 06)

| Propriété              | Desktop          | Tablet          | Mobile           |
| :--------------------- | :--------------- | :-------------- | :--------------- |
| Largeur                | max 880px        | max 720px       | full - 48px      |
| Item height collapsed  | 64px             | 56px            | 56px             |
| Question size          | 17pt             | 16pt            | 16pt             |
| Réponse size           | 15pt             | 14pt            | 14pt             |

#### Témoignages (Section 07)

| Propriété              | Desktop          | Tablet          | Mobile           |
| :--------------------- | :--------------- | :-------------- | :--------------- |
| Layout                 | 3 cartes en ligne | 3 cartes serrées| Carrousel swipe  |
| Photo height           | 280px            | 240px           | 320px            |
| Citation size          | 15pt             | 14pt            | 14pt             |

#### CTA final + Cross-link (Section 08)

| Propriété              | Desktop          | Tablet          | Mobile           |
| :--------------------- | :--------------- | :-------------- | :--------------- |
| Bandeau hauteur        | 320px            | 300px           | 280px            |
| Phrase intro size      | 28pt             | 24pt            | 22pt             |
| CTA largeur            | 280px            | 240px           | 100% - 48px      |
| Cross-link layout      | 3 cartes en ligne | 3 cartes serrées| Carrousel swipe  |

### 15.3 — Comportements mobile spécifiques

#### Header burger menu

- Drawer plein écran, animation slide-in 280ms depuis la droite
- Item « Kit » marqué actif avec underline sauge dark
- CTA panier conservé en haut-droite avec compteur

#### Sticky CTA mobile

| Apparition           | Conditions                                                      |
| :------------------- | :-------------------------------------------------------------- |
| Visible              | Après scroll au-delà de 100vh (sortie de l'above the fold)      |
| Caché                | À l'arrivée du bandeau CTA final (Section 08)                   |
| Position             | Bottom-right, 24px du bord bas                                   |
| Largeur              | 240px                                                            |
| Hauteur              | 48px                                                             |
| Fond                 | `#2C2A28` (Encre) avec opacité 0.95                             |
| Texte                | « Recevoir le rituel → »                                         |
| Police               | Inter Medium 13pt, couleur Crème pure                            |
| Border-radius        | 0 (carré)                                                        |
| Shadow               | `box-shadow: 0 4px 16px rgba(44,42,40,0.16)`                    |
| Click action         | Identique au CTA principal (ATC + animation)                     |
| Animation entrée     | Fade-in + translate-up 16px, 320ms                              |
| Animation sortie     | Fade-out + translate-down 16px, 240ms                            |

> **Pourquoi un sticky CTA sur mobile uniquement ?** Parce que sur mobile, la cliente scrolle longtemps. Le CTA initial peut être à 4 viewports de distance. Le sticky garantit qu'elle peut acheter à tout moment. Sur desktop, le header sticky avec son bouton panier suffit.

#### Carrousel témoignages mobile

| Élément                  | Spécifications                                        |
| :----------------------- | :---------------------------------------------------- |
| Type                     | Swipe horizontal natif (CSS scroll-snap-type: x mandatory) |
| Cartes visibles          | 1 carte centrée + ~10% aperçu suivante                |
| Indicateurs              | 3 dots sous le carrousel                              |
| Auto-rotate              | Aucun                                                  |

#### Comparatif mobile — accordéon

Comme spécifié en section 9.9 — chaque critère devient un accordéon dépliable. Une seule ligne ouverte à la fois.

### 15.4 — Touch targets minimum

Sur mobile, tous les éléments interactifs respectent **44×44px minimum** :
- CTA principal : padding 16px minimum → 50px hauteur tactile
- Boutons FAQ : 56px hauteur (largement au-dessus de 44px)
- Cartes témoignages cliquables si V2 (mais MVP : non cliquables)
- Boutons modal panier : padding 14px → 44px hauteur

### 15.5 — Texte minimum sur mobile

Aucun texte en dessous de **14px** sur mobile :
- Microcopy : 11pt acceptable car non-critique
- Réassurances : 11pt
- Légendes photos : 10pt acceptable car contextuel
- Labels et trackings : 7pt en uppercase tracked acceptable (style éditorial)

---

## 16 — Performance technique

### 16.1 — Web Vitals — cibles strictes BOFU

| Métrique | Cible    | Justification                                      |
| :------- | :------- | :------------------------------------------------- |
| **LCP**  | **< 2.0s** | BOFU = chaque seconde compte (Akamai 2017 : -15-20% conv. par seconde) |
| **CLS**  | **< 0.05** | Pas de saut visuel — la cliente clique précisément |
| **INP**  | **< 150ms** | Interaction ATC fluide critique                   |
| **FCP**  | **< 1.0s** | Premier contenu visible vite                      |
| **TBT**  | **< 250ms** | JS minimal, pas de blocage du thread principal    |

> **Différence avec `/rituel`** : sur `/rituel` (MOFU), LCP < 2.5s acceptable. Sur `/kit` (BOFU), LCP < 2.0s **non négociable** — chaque 100ms de retard coûte ~1% de conversions.

### 16.2 — Stratégie de chargement

#### Critical CSS

CSS critique inline dans le `<head>` — uniquement les styles de l'above the fold (header + section 01). Le reste en CSS externe `<link>`.

#### Preload des polices critiques

```html
<!-- Polices critiques pour above the fold -->
<link rel="preload" href="/fonts/Inter-Regular.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/Inter-Medium.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/CormorantGaramond-Light.woff2" as="font" type="font/woff2" crossorigin>
<!-- Polices secondaires (chargées normalement) -->
<link rel="preload" href="/fonts/CormorantGaramond-Italic.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/PinyonScript-Regular.woff2" as="font" type="font/woff2" crossorigin>
```

#### Preload de l'image hero

```html
<link rel="preload" as="image"
      href="/images/kit-hero-desktop.webp"
      media="(min-width: 768px)"
      fetchpriority="high">
<link rel="preload" as="image"
      href="/images/kit-hero-mobile.webp"
      media="(max-width: 767px)"
      fetchpriority="high">
```

> **`fetchpriority="high"`** est critique : indique au navigateur de prioriser cette image dans la file d'attente réseau.

#### Preload du poster vidéo (pas la vidéo)

```html
<link rel="preload" as="image"
      href="/images/kit-video-poster.webp"
      media="(min-width: 768px)">
```

#### Defer du JavaScript non-critique

```html
<!-- Scripts critiques (interactions ATC) -->
<script src="/js/cart.js" defer></script>

<!-- Scripts non-critiques (animations, analytics) -->
<script src="/js/animations.js" defer></script>
<script src="/js/video-player.js" defer></script>
<script src="/js/analytics.js" async></script>
```

### 16.3 — Budget de performance

| Ressource                       | Budget          |
| :------------------------------ | :-------------- |
| HTML initial                    | < 40 KB gzip    |
| CSS critique inline             | < 12 KB         |
| CSS externe                     | < 50 KB gzip    |
| JS total (cart + animations)    | < 100 KB gzip   |
| Images hero + sections          | < 400 KB total  |
| Polices (Inter + Cormorant + Pinyon) | < 140 KB total |
| **Vidéo poster**                | **< 50 KB**     |
| **Vidéo elle-même**             | **streamée**    |
| **Total page (hors vidéo)**     | **< 700 KB**    |

> **Note vidéo** : sur `/kit`, vidéo plus courte (60s @ 6 Mbps = ~45 MB). Streamée par chunks. Sur connexion 4G typique au Maroc (10-15 Mbps), 45 MB = ~30s de chargement complet — donc lecture immédiate possible.

### 16.4 — CDN & cache

| Ressource                      | Cache-Control                          |
| :----------------------------- | :------------------------------------- |
| HTML                           | `no-cache, must-revalidate`            |
| CSS / JS versionnés            | `public, max-age=31536000, immutable`  |
| Images                         | `public, max-age=2592000` (30 jours)   |
| Polices                        | `public, max-age=31536000, immutable`  |
| Vidéo MP4                      | `public, max-age=604800` (7 jours)     |
| Vidéo HLS segments             | `public, max-age=31536000, immutable`  |
| Poster vidéo                   | `public, max-age=2592000`              |

CDN : Cloudflare ou équivalent, avec :
- **Polish** activé (optimisation WebP automatique)
- **Mirage** activé (lazy loading optimisé)
- **Argo Smart Routing** (acheminement réseau optimal au Maroc)
- **Stream** ou **Mux** pour la vidéo
- **Edge functions** pour le cookie panier (vérification rapide à l'arrivée)

### 16.5 — Optimisations spécifiques BOFU

| Optimisation                              | Justification                                      |
| :---------------------------------------- | :------------------------------------------------- |
| `loading="lazy"` sur tout below the fold  | Économie de bande passante sur page longue         |
| Vidéo `preload="metadata"` initial        | Évite chargement complet inutile                   |
| Schémas SVG inline                        | Pas de requête, animation instantanée              |
| Police Pinyon chargée en différé          | Utilisée uniquement au header — pas critique LCP   |
| `font-display: swap` partout              | Texte visible immédiatement avec fallback          |
| Intersection Observer pour animations     | Pas de scroll listener manuel                      |
| **Preconnect au CDN images**              | Réduit la latence du premier byte                  |
| **DNS prefetch payment provider**         | Préparer la connexion CMI/Stripe pour /commander    |

```html
<link rel="preconnect" href="https://cdn.femiglow.ma">
<link rel="dns-prefetch" href="https://payment.cmi.co.ma">
```

### 16.6 — Métriques de référence — concurrents

| Site (BOFU comparable)        | LCP    | CLS   | INP    |
| :---------------------------- | :----- | :---- | :----- |
| Aesop product page            | 1.8s   | 0.04  | 140ms  |
| Glossier product page         | 1.6s   | 0.03  | 120ms  |
| Tatcha product page           | 2.4s   | 0.07  | 180ms  |
| **FemiGlow `/kit` cible**     | **< 2.0s** | **< 0.05** | **< 150ms** |

### 16.7 — Tests de performance

#### Outils recommandés

- **PageSpeed Insights** : audit hebdomadaire mobile + desktop
- **Lighthouse CI** : intégré au pipeline de déploiement (gate critique : LCP < 2.5s pour bloquer un déploiement)
- **WebPageTest** : tests sur connexions 3G/4G simulées Maroc
- **Sentry Performance** : monitoring en production
- **Chrome DevTools Performance** : profiling local

#### Conditions de test critiques

| Condition                | Cible                                          |
| :----------------------- | :--------------------------------------------- |
| 4G Maroc (12 Mbps)       | LCP < 2.0s                                     |
| 3G urbain (1.6 Mbps)     | LCP < 4.0s (acceptable, pas optimal)           |
| Wifi entreprise          | LCP < 1.2s                                     |
| Mobile mid-range (Moto G) | TBT < 400ms                                    |

---

## 17 — SEO & métadonnées

### 17.1 — Title

```html
<title>Kit Rituel d'Éclat — FemiGlow · 320 dh · Soin japonais pour les ongles</title>
```

| Critère                 | Valeur                                                          |
| :---------------------- | :-------------------------------------------------------------- |
| Longueur                | 71 caractères (≤ 60 affichables sur SERP — tronqué OK car le mot-clé arrive en tête) |
| Mot-clé principal       | « Kit Rituel d'Éclat » (autorité produit)                        |
| Marque                  | « FemiGlow » (autorité)                                          |
| Prix dans le title      | « 320 dh » — signal de comparaison shopping immédiat             |
| Catégorie               | « Soin japonais pour les ongles »                                |

> **Pourquoi le prix dans le title ?** Parce que sur les requêtes de comparaison shopping, le prix dans le SERP filtre **immédiatement** les visiteurs qualifiés. Quelqu'un qui cherche un kit à 50 dh ne cliquera pas — économie de bounce rate.

### 17.2 — Meta description

```html
<meta name="description" content="Le kit complet du rituel japonais d'éclat des ongles. Quatre matières, un soin sans vernis. Livraison 48h Casablanca, retour 14 jours. 320 dh.">
```

| Critère       | Valeur                                                  |
| :------------ | :------------------------------------------------------ |
| Longueur      | 153 caractères (≤ 155 sur SERP)                         |
| Hook          | « Le kit complet du rituel japonais d'éclat »            |
| Bénéfice      | « Quatre matières, un soin sans vernis »                 |
| Réassurances  | « Livraison 48h Casablanca, retour 14 jours »            |
| Prix          | « 320 dh » (signal de qualification)                     |

### 17.3 — Open Graph (réseaux sociaux)

```html
<meta property="og:type" content="product">
<meta property="og:url" content="https://femiglow.ma/kit">
<meta property="og:title" content="Kit Rituel d'Éclat — Le rituel d'éclat, en quatre pots.">
<meta property="og:description" content="Quatre matières japonaises pour préparer, lisser, polir, révéler. 320 dh.">
<meta property="og:image" content="https://femiglow.ma/og/kit-og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="fr_MA">
<meta property="og:site_name" content="FemiGlow">

<!-- Open Graph Product -->
<meta property="product:price:amount" content="320">
<meta property="product:price:currency" content="MAD">
<meta property="product:availability" content="in stock">
<meta property="product:condition" content="new">
<meta property="product:brand" content="FemiGlow">
<meta property="product:retailer_item_id" content="kit-rituel-001">
```

#### Image OG spécifique à `/kit`

- Dimensions : 1200×630px (ratio 1.91:1)
- Composition : photo above the fold (kit + main + tasse) recadrée centrée, avec **prix 320 dh** en overlay subtil bas-droite, Cormorant Light blanc cassé
- Wordmark Pinyon en haut-gauche, petit
- Pas de logo de marque tiers
- Format JPEG qualité 88, < 220 KB

### 17.4 — Twitter Card

```html
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@femiglow">
<meta name="twitter:title" content="Kit Rituel d'Éclat — FemiGlow · 320 dh">
<meta name="twitter:description" content="Quatre matières japonaises pour le soin des ongles. Sans vernis.">
<meta name="twitter:image" content="https://femiglow.ma/og/kit-twitter.jpg">
<meta name="twitter:label1" content="Prix">
<meta name="twitter:data1" content="320 dh">
<meta name="twitter:label2" content="Livraison">
<meta name="twitter:data2" content="48h Casa">
```

### 17.5 — Schema.org JSON-LD — **Product** (crucial)

C'est le schema le plus important de toute la page. Il alimente Google Shopping, les rich snippets, et les comparateurs.

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Kit Rituel d'Éclat",
  "description": "Le kit complet du rituel japonais d'éclat des ongles. Quatre matières (paste, powder, shine, polish) pour préparer, lisser, polir, révéler. Sans vernis. Sans pose UV.",
  "image": [
    "https://femiglow.ma/images/kit-hero-1.jpg",
    "https://femiglow.ma/images/kit-paste-zoom.jpg",
    "https://femiglow.ma/images/kit-powder-zoom.jpg",
    "https://femiglow.ma/images/kit-shine-zoom.jpg",
    "https://femiglow.ma/images/kit-polish-zoom.jpg"
  ],
  "brand": {
    "@type": "Brand",
    "name": "FemiGlow"
  },
  "manufacturer": {
    "@type": "Organization",
    "name": "FemiGlow",
    "url": "https://femiglow.ma"
  },
  "category": "Beauty > Nail Care > Nail Treatment",
  "sku": "kit-rituel-001",
  "mpn": "FG-KIT-2026",
  "gtin13": "6112000000001",
  "offers": {
    "@type": "Offer",
    "url": "https://femiglow.ma/kit",
    "priceCurrency": "MAD",
    "price": "320.00",
    "priceValidUntil": "2027-12-31",
    "availability": "https://schema.org/InStock",
    "itemCondition": "https://schema.org/NewCondition",
    "seller": {
      "@type": "Organization",
      "name": "FemiGlow",
      "url": "https://femiglow.ma"
    },
    "shippingDetails": {
      "@type": "OfferShippingDetails",
      "shippingRate": {
        "@type": "MonetaryAmount",
        "value": "0.00",
        "currency": "MAD"
      },
      "deliveryTime": {
        "@type": "ShippingDeliveryTime",
        "handlingTime": {
          "@type": "QuantitativeValue",
          "minValue": 0,
          "maxValue": 1,
          "unitCode": "DAY"
        },
        "transitTime": {
          "@type": "QuantitativeValue",
          "minValue": 1,
          "maxValue": 5,
          "unitCode": "DAY"
        }
      },
      "shippingDestination": {
        "@type": "DefinedRegion",
        "addressCountry": "MA"
      }
    },
    "hasMerchantReturnPolicy": {
      "@type": "MerchantReturnPolicy",
      "applicableCountry": "MA",
      "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
      "merchantReturnDays": 14,
      "returnMethod": "https://schema.org/ReturnByMail",
      "returnFees": "https://schema.org/FreeReturn"
    }
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "reviewCount": "23",
    "bestRating": "5",
    "worstRating": "1"
  },
  "review": [
    {
      "@type": "Review",
      "author": {
        "@type": "Person",
        "name": "Aïcha"
      },
      "datePublished": "2026-04-15",
      "reviewBody": "J'ai toujours eu les ongles fragiles, qui se dédoublaient au moindre geste. Le rituel a changé ça en trois mois.",
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": "5",
        "bestRating": "5"
      }
    }
  ]
}
```

> **Notes critiques sur le Schema Product** :
>
> 1. **`aggregateRating`** : à activer **uniquement** quand vous avez ≥ 5 reviews authentiques. Mentir sur ce champ peut entraîner une pénalité Google. **Pas de fake reviews**.
> 2. **`gtin13`** : code-barres EAN13 produit — à obtenir auprès de GS1 Maroc.
> 3. **`priceValidUntil`** : date limite de validité du prix. À renouveler chaque année.
> 4. **`hasMerchantReturnPolicy`** : crucial pour la conformité Google Shopping. Garantit l'éligibilité au programme.

### 17.6 — Schema.org JSON-LD additionnel — VideoObject

Pour la vidéo de la section 03 (60s) :

```json
{
  "@context": "https://schema.org",
  "@type": "VideoObject",
  "name": "Le rituel en quatre gestes — version courte",
  "description": "Démonstration des quatre gestes du rituel FemiGlow en soixante secondes.",
  "thumbnailUrl": "https://femiglow.ma/video/kit-video-poster.jpg",
  "uploadDate": "2026-04-01T08:00:00+01:00",
  "duration": "PT1M",
  "contentUrl": "https://femiglow.ma/video/kit-video-1080p.mp4",
  "embedUrl": "https://femiglow.ma/kit#video"
}
```

### 17.7 — Canonical & hreflang

```html
<link rel="canonical" href="https://femiglow.ma/kit">
<link rel="alternate" hreflang="fr-MA" href="https://femiglow.ma/kit">
<link rel="alternate" hreflang="ar-MA" href="https://femiglow.ma/ar/kit">
<link rel="alternate" hreflang="x-default" href="https://femiglow.ma/kit">
```

### 17.8 — Robots & sitemap

```html
<meta name="robots" content="index, follow, max-image-preview:large, max-video-preview:30, max-snippet:-1">
```

Sitemap.xml inclut `/kit` avec **priority maximale** :

```xml
<url>
  <loc>https://femiglow.ma/kit</loc>
  <lastmod>2026-05-01</lastmod>
  <changefreq>weekly</changefreq>
  <priority>1.0</priority>
  <image:image>
    <image:loc>https://femiglow.ma/images/kit-hero-desktop.webp</image:loc>
    <image:title>Kit Rituel d'Éclat FemiGlow</image:title>
    <image:caption>Le kit complet du rituel japonais d'éclat des ongles</image:caption>
  </image:image>
</url>
```

> **Pourquoi `priority=1.0` ?** Parce que `/kit` est la page de conversion principale du site. Toutes les autres pages doivent être en dessous (`/accueil` à 0.9, `/rituel` à 0.9, `/journal` à 0.8, etc.).

### 17.9 — Stratégie de mots-clés

| Mot-clé cible                          | Volume estimé Maroc | Intention      | Position visée |
| :------------------------------------- | :------------------ | :------------- | :------------- |
| « kit soin ongles japonais »           | ~30/mois            | Conversion     | Top 1          |
| « manucure japonaise prix Maroc »      | ~20/mois            | Conversion     | Top 1          |
| « soin ongles sans vernis Casablanca » | ~40/mois            | Conversion     | Top 3          |
| « FemiGlow kit »                       | ~10/mois (croissant) | Brand search   | Top 1          |
| « rituel ongles éclat »                | ~25/mois            | Considération  | Top 5          |

### 17.10 — Hiérarchie des headers

```html
<h1>Le rituel d'éclat, en quatre pots.</h1>
  <h2>Quatre matières. Chacune dans son pot.</h2>      <!-- slow reveal -->
  <h2>Soixante secondes pour comprendre.</h2>           <!-- vidéo -->
  <h2>La transparence comme premier soin.</h2>          <!-- composition par pot -->
    <h3>paste · Préparer</h3>
    <h3>powder · Lisser</h3>
    <h3>shine · Polir</h3>
    <h3>polish · Révéler</h3>
  <h2>Trois manières d'envisager ses ongles.</h2>       <!-- comparatif -->
  <h2>Avant de recevoir le rituel.</h2>                 <!-- FAQ -->
  <h2 class="visually-hidden">Témoignages</h2>
  <h2 class="visually-hidden">Recevoir le rituel — derniers mots</h2>
  <h2 class="visually-hidden">Pour aller plus loin</h2>
```

### 17.11 — Microdata complémentaires

#### FAQ Schema (Section 06)

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Combien de temps dure un kit ?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Un kit dure entre deux et trois mois pour une personne qui pratique le rituel toutes les six semaines..."
      }
    }
    // ... 8 autres questions
  ]
}
```

> **Bénéfice du FAQ Schema** : les questions/réponses peuvent apparaître **directement dans les résultats Google** (rich snippet FAQ), augmentant le CTR organique de 15-30% en moyenne.

---

## 18 — Accessibilité (a11y)

### 18.1 — Conformité visée

**WCAG 2.2 niveau AA** sur tous les composants critiques. **Niveau AAA** visé sur :
- Contraste des textes critiques (prix, CTA, titres)
- Navigation clavier complète (mécaniques ATC critiques)
- Annonce ARIA des changements d'état du panier
- Player vidéo (raccourcis identiques à `/rituel`)

### 18.2 — Contraste — vérifications

| Combinaison                                | Ratio   | Niveau WCAG   |
| :----------------------------------------- | :------ | :------------ |
| Encre `#2C2A28` sur Crème `#FBF8F1`        | 14.2:1  | AAA           |
| Encre claire `#4A4844` sur Crème           | 9.1:1   | AAA           |
| Brume `#6B6863` sur Crème                  | 5.6:1   | AA            |
| Brume sur Sauge pâle `#E8EFE7` (CTA final) | 5.2:1   | AA            |
| Crème pure `#FBF8F1` sur Encre (CTA primaire) | 14.2:1 | AAA          |
| Encre sur Sauge pâle (texte intro CTA final) | 12.8:1 | AAA           |
| Champagne `#C8A876` sur Crème (★ comparatif) | 2.7:1  | AA Large only — réservé à élément ≥ 14pt |
| Sauge dark `#A8C4A6` sur Crème (filets)    | 2.8:1   | (graphique non textuel, OK)       |

### 18.3 — Navigation clavier

| Élément                    | Comportement clavier                            |
| :------------------------- | :---------------------------------------------- |
| Wordmark                   | Tab focus, Enter active                          |
| Menu items                 | Tab navigation séquentielle                      |
| Burger menu mobile         | Enter ouvre, Escape ferme                        |
| Skip links (3)             | Visibles au focus, Enter saute à la cible       |
| **CTA primaire (above fold)** | **Tab focus + Enter = ATC déclenché**         |
| **Mini modal panier**      | **Focus trap activé, Escape ferme**             |
| Pots slow reveal           | Non focusables (décoratifs)                      |
| Player vidéo               | Identique à `/rituel` (Espace, M, F, C, ←→, ↑↓, 0-9) |
| Composition par pot        | Non focusables (statiques)                       |
| Comparatif desktop         | Non focusable (table de données)                 |
| Comparatif mobile (accordéon) | Tab + Enter pour expand/collapse              |
| **FAQ items**              | **Tab + Enter pour expand/collapse**             |
| Cards témoignages          | Non focusables (V1)                              |
| **CTA final (bandeau)**    | **Tab focus + Enter = ATC déclenché**           |
| Cards cross-link           | Tab focus + Enter (navigation)                   |
| Footer liens               | Tab navigation                                   |
| **Sticky CTA mobile**      | **Tab focus + Enter = ATC déclenché**           |

#### Focus trap dans le mini modal panier

Quand le mini modal s'ouvre :

```javascript
// Pseudo-code
1. Sauvegarder l'élément actuellement focused (CTA primaire)
2. Déplacer le focus vers le premier bouton du modal ("Voir mon panier")
3. Bloquer le focus à l'intérieur du modal :
   - Tab depuis dernier élément → premier élément
   - Shift+Tab depuis premier élément → dernier élément
4. Escape → fermer modal + restaurer focus sur l'élément initial
5. Click outside → fermer modal + restaurer focus
```

### 18.4 — Focus ring

| Propriété     | Valeur                                          |
| :------------ | :---------------------------------------------- |
| Couleur       | `#A8C4A6` (Sauge dark)                          |
| Épaisseur     | 2px                                             |
| Offset        | 4px                                             |
| Border-radius | Hérite de l'élément (0 ou 999px selon)         |
| Outline-style | `solid`                                         |
| Visible       | Sur focus clavier uniquement (`:focus-visible`) |

### 18.5 — ARIA labels & landmarks

```html
<header role="banner" aria-label="En-tête principal">
  <nav aria-label="Navigation principale">...</nav>
  <a href="/" aria-label="FemiGlow, retour à l'accueil">FemiGlow</a>
  <button aria-label="Voir le panier (1 article)" aria-live="polite">
    Panier · <span class="cart-count">1</span>
  </button>
</header>

<main role="main" aria-label="Page Kit Rituel d'Éclat">

  <section aria-labelledby="atf-title">
    <span class="kicker">KIT RITUEL</span>
    <h1 id="atf-title">Le rituel d'éclat, en quatre pots.</h1>
    <p>Quatre matières japonaises pour préparer, lisser, polir, révéler.</p>
    <p class="price" aria-label="320 dirhams marocains">320 dh</p>
    <button class="cta-primary"
            aria-label="Recevoir le rituel — ajouter au panier"
            aria-describedby="cta-loading">
      Recevoir le rituel
    </button>
    <span id="cta-loading" class="visually-hidden" aria-live="polite">
      <!-- Annonces dynamiques d'état du CTA -->
    </span>
    <ul aria-label="Garanties et services">
      <li>Livraison 48h Casa</li>
      <li>Retour 14 jours sans condition</li>
      <li>Paiement 3× sans frais</li>
    </ul>
  </section>

  <section aria-labelledby="reveal-title">
    <span class="kicker">LE KIT EN DÉTAIL</span>
    <h2 id="reveal-title">Quatre matières. Chacune dans son pot.</h2>
    <ul>
      <li>
        <figure>
          <img src="..." alt="Le pot paste — pâte douce dans son contenant en verre teinté">
          <figcaption>
            <span class="pot-name">paste</span>
            <span class="verb">Préparer.</span>
          </figcaption>
        </figure>
      </li>
      <!-- ... 3 autres pots ... -->
    </ul>
  </section>

  <section aria-labelledby="video-title">
    <span class="kicker">LE RITUEL EN MOUVEMENT</span>
    <h2 id="video-title">Soixante secondes pour comprendre.</h2>
    <figure>
      <video controls
             aria-label="Vidéo du rituel en quatre gestes, durée 60 secondes"
             preload="metadata">
        <source src="..." type="video/mp4">
        <track kind="captions" srclang="fr" label="Français" src="...">
        <track kind="captions" srclang="ar" label="Arabe" src="...">
      </video>
    </figure>
  </section>

  <section aria-labelledby="composition-title">
    <span class="kicker">CE QU'IL Y A DANS CHAQUE POT</span>
    <h2 id="composition-title">La transparence comme premier soin.</h2>
    <article aria-labelledby="paste-title">
      <h3 id="paste-title"><em>paste</em> · Préparer</h3>
      <p>Une pâte légère qui détend la kératine et prépare la surface.</p>
      <dl>
        <dt>Composition</dt>
        <dd>Eau, glycérine végétale, kaolin, oxyde de zinc, huile de jojoba, panthénol.</dd>
        <dt>Texture</dt>
        <dd>Pâte douce, légèrement crémeuse</dd>
        <dt>Application</dt>
        <dd>Pinceau souple inclus dans le kit</dd>
        <dt>Temps de pose</dt>
        <dd>30 secondes</dd>
      </dl>
    </article>
    <!-- ... 3 autres pots ... -->
  </section>

  <section aria-labelledby="compare-title">
    <span class="kicker">POUR COMPARER</span>
    <h2 id="compare-title">Trois manières d'envisager ses ongles.</h2>
    <table aria-label="Comparatif vernis classique, vernis semi-permanent, et rituel FemiGlow">
      <caption class="visually-hidden">
        Comparatif sur six critères : effet immédiat, tenue, santé de l'ongle, naturel, geste, réassort.
      </caption>
      <thead>
        <tr>
          <th scope="col"></th>
          <th scope="col">Vernis classique</th>
          <th scope="col">Vernis semi-permanent</th>
          <th scope="col">Rituel FemiGlow <span aria-label="(notre solution)">★</span></th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th scope="row">Effet immédiat</th>
          <td><span aria-label="3 sur 5">●●●</span></td>
          <td><span aria-label="4 sur 5">●●●●</span></td>
          <td><span aria-label="2 sur 5">●●</span></td>
        </tr>
        <!-- ... 5 autres lignes ... -->
      </tbody>
    </table>
  </section>

  <section aria-labelledby="faq-title">
    <span class="kicker">LES QUESTIONS QU'ON NOUS POSE</span>
    <h2 id="faq-title">Avant de recevoir le rituel.</h2>
    <div role="region" aria-label="Foire aux questions">
      <details>
        <summary aria-expanded="false">Combien de temps dure un kit ?</summary>
        <div class="answer">
          Un kit dure entre deux et trois mois pour une personne qui pratique le rituel...
        </div>
      </details>
      <!-- ... 8 autres questions ... -->
    </div>
  </section>

  <section aria-label="Témoignages d'initiées">
    <span class="kicker">ELLES ONT CHOISI LE RITUEL</span>
    <ul>
      <li>
        <article>
          <figure>
            <img src="..." alt="Mains tenant un livre ouvert sur les genoux, ongles visibles, lumière de fenêtre">
          </figure>
          <blockquote>
            <p>« J'ai toujours eu les ongles fragiles... »</p>
            <footer>
              <cite>Aïcha · Casablanca</cite>
              <span class="date">initiée depuis février 2026</span>
            </footer>
          </blockquote>
        </article>
      </li>
      <!-- ... 2 autres témoignages ... -->
    </ul>
  </section>

  <section aria-labelledby="cta-final-title" class="cta-final">
    <h2 id="cta-final-title">Le rituel d'éclat. 320 dh.</h2>
    <button class="cta-final-button"
            aria-label="Recevoir le rituel — ajouter au panier">
      Recevoir le rituel
    </button>
    <p class="reassurance">Livraison 48h Casa · Retour 14j</p>
  </section>

  <section aria-labelledby="crosslink-title">
    <h2 id="crosslink-title" class="visually-hidden">Pour aller plus loin — articles connexes</h2>
    <ul>
      <li><a href="/journal/...">...</a></li>
    </ul>
  </section>
</main>

<!-- Mini modal panier (apparaît dynamiquement) -->
<aside role="dialog"
       aria-modal="true"
       aria-labelledby="cart-modal-title"
       aria-describedby="cart-modal-desc"
       class="cart-modal hidden">
  <h2 id="cart-modal-title" class="visually-hidden">Article ajouté au panier</h2>
  <p id="cart-modal-desc" class="visually-hidden">
    Vous avez ajouté Kit Rituel d'Éclat à votre panier pour 320 dirhams.
    Vous pouvez voir votre panier ou continuer la lecture.
  </p>
  <div class="confirmation">
    <span class="check" aria-hidden="true">✓</span>
    Ajouté à votre rituel
  </div>
  <div class="product-summary">
    <img src="..." alt="" aria-hidden="true">
    <div>
      <p class="name">Kit Rituel d'Éclat</p>
      <p class="subtitle">Le rituel complet · 4 étapes</p>
      <p class="price">320 dh</p>
    </div>
  </div>
  <a href="/panier" class="primary">Voir mon panier</a>
  <button class="secondary">Continuer la lecture</button>
  <button class="close" aria-label="Fermer">×</button>
</aside>

<footer role="contentinfo" aria-label="Pied de page">...</footer>
```

### 18.6 — Annonces dynamiques (ARIA Live Regions)

#### Annonces lors de l'ATC

```html
<div role="status" aria-live="polite" aria-atomic="true" id="cart-announcer" class="visually-hidden">
  <!-- Texte injecté dynamiquement -->
</div>
```

| Étape de l'ATC                  | Annonce ARIA                                                  |
| :------------------------------ | :------------------------------------------------------------ |
| Click CTA                       | « Ajout en cours... »                                          |
| ATC réussi                      | « Kit Rituel d'Éclat ajouté à votre panier. Total : 1 article. » |
| Mini modal ouvert               | (Le rôle dialog gère l'annonce automatiquement)                |
| Mini modal fermé                | (Pas d'annonce — comportement attendu)                         |
| ATC erreur réseau               | « Une erreur est survenue. Veuillez réessayer. »               |
| Stock 0                         | « Ce kit est actuellement indisponible. Vous pouvez nous laisser votre email pour être prévenue. » |

### 18.7 — Images & alt texts

| Image                             | Alt text                                                                    |
| :-------------------------------- | :-------------------------------------------------------------------------- |
| Photo above the fold              | « Le kit Rituel d'Éclat posé sur une surface en marbre crème, à côté d'une main détendue et d'une tasse de thé en arrière-plan flou » |
| Pot 1 zoom (paste)                | « Le pot paste — pâte douce dans son contenant en verre teinté, avec un pinceau d'application à côté » |
| Pot 2 zoom (powder)               | « Le pot powder — poudre minérale fine, avec un buffer en mousseline beige légèrement froissé » |
| Pot 3 zoom (shine)                | « Le pot shine — baume soyeux, avec un linge de coton plié en arrière-plan » |
| Pot 4 zoom (polish)               | « Le pot polish — cire onctueuse, avec un chiffon de soie crème naturellement plissé » |
| Poster vidéo                      | « Aperçu de la vidéo du rituel — mains en préparation »                      |
| Photo Aïcha (témoignage)          | « Mains tenant un livre ouvert sur les genoux, ongles visibles, lumière de fenêtre »  |
| Photo Salma (témoignage)          | « Une main posée sur une tasse de thé fumant, sur une table de bois clair »  |
| Photo Yasmine (témoignage)        | « Mains au piano, dans un mouvement très lent, lumière naturelle »          |
| Photos cross-link                 | Alt descriptif de la photo lifestyle de chaque article (variable)            |

### 18.8 — Skip links

```html
<a href="#main" class="skip-link">Aller au contenu principal</a>
<a href="#atf-title" class="skip-link">Aller au produit et au prix</a>
<a href="#cta-primary" class="skip-link">Aller directement à l'achat</a>
<a href="#faq-title" class="skip-link">Aller aux questions fréquentes</a>
```

> **Quatre skip links sur `/kit`** — la page est longue, et certaines visiteuses peuvent vouloir aller directement à l'achat sans lire toute la page. Le 3ème skip link (« Aller directement à l'achat ») est explicite et respectueux.

### 18.9 — Réduction du mouvement

```css
@media (prefers-reduced-motion: reduce) {
  /* Toutes animations désactivées */
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }

  /* Slow reveal pots : photos apparaissent finalisées */
  .reveal-photo {
    transform: scale(1) !important;
    opacity: 1 !important;
  }

  /* Animation ATC pot vers panier : désactivée */
  .atc-flying-pot {
    display: none;
  }

  /* Compteur panier : changement direct sans pulse */
  .cart-count {
    animation: none !important;
  }

  /* Mini modal : slide-in remplacé par fade-in court */
  .cart-modal {
    animation: fadeIn 160ms ease-out !important;
  }

  /* Vidéo : pas d'autoplay si reduced motion */
  video[autoplay] {
    /* Désactivé via JS au chargement */
  }

  /* Sticky CTA mobile : apparaît directement, sans translate */
  .sticky-cta-mobile {
    transform: translateY(0) !important;
    transition: opacity 200ms !important;
  }
}
```

### 18.10 — Vidéo : transcript complet

Sous la vidéo, en `<details>` repliable :

```html
<details class="video-transcript">
  <summary>Lire la transcription</summary>
  <div class="transcript">
    <p><strong>0:00 – 0:03</strong> — Établissement : table de soin, mains au repos.</p>
    <p><strong>0:03 – 0:18</strong> — Préparer. Application de la pâte au pinceau souple, mouvement circulaire lent.</p>
    <p><strong>0:18 – 0:33</strong> — Lisser. La poudre est appliquée au buffer mousseline, mouvement de gauche à droite.</p>
    <p><strong>0:33 – 0:48</strong> — Polir. Le buffer fin lisse la surface, la brillance commence à apparaître.</p>
    <p><strong>0:48 – 0:58</strong> — Révéler. Finition au chiffon de soie, l'éclat final est révélé.</p>
    <p><strong>0:58 – 1:00</strong> — Final. La main est posée. Silence. Fade.</p>
  </div>
</details>
```

### 18.11 — Tests d'accessibilité recommandés

| Outil                | Usage                                                       |
| :------------------- | :---------------------------------------------------------- |
| **axe DevTools**     | Audit automatique sur chaque déploiement                     |
| **WAVE**             | Audit visuel en complément                                  |
| **Lighthouse**       | Score d'accessibilité ≥ 95/100                              |
| **NVDA + Firefox**   | Test lecteur d'écran Windows                                |
| **VoiceOver + Safari** | Test lecteur d'écran macOS/iOS                            |
| **TalkBack**         | Test lecteur d'écran Android                                |
| **Tab order audit**  | Vérification manuelle de la séquence Tab                    |
| **Color contrast**   | Vérification des contrastes (WebAIM Contrast Checker)        |

---

## 19 — Microcopy & états du panier

### 19.1 — Textes utilitaires de la page `/kit`

| Contexte                              | Microcopy                                                       |
| :------------------------------------ | :-------------------------------------------------------------- |
| Loading initial                       | (aucun — `font-display: swap` invisible)                        |
| Photo above the fold échec            | (fallback sur fond crème uni, le titre + prix + CTA restent fonctionnels) |
| Vidéo échec chargement                | « La vidéo se charge. Patientez un instant. »                   |
| Vidéo erreur définitive               | « La vidéo n'a pas pu se charger. Vous pouvez en lire la transcription ci-dessous. » |
| Cookies banner (premier accès)        | « Nous utilisons des cookies pour comprendre votre visite. »     |
| Erreur 404 → `/kit/...`               | « Cette page s'est égaré du rituel. » + lien retour `/kit`       |

### 19.2 — Les 8 états du CTA primaire

#### État 1 — Repos (par défaut)

```
[ Recevoir le rituel ]
```

Fond encre, texte crème pure, prêt à être cliqué.

#### État 2 — Hover (desktop)

```
[ Recevoir le rituel ]
   ↑ légère élévation, fond passe à #4A4844
```

Transition 220ms. Cursor : pointer.

#### État 3 — Active (click en cours)

```
[ Recevoir le rituel ]
   ↑ scale 0.97, transition 100ms
```

Compression tactile pendant le click maintenu.

#### État 4 — Loading

```
[      ⟳        ]
```

Spinner mini visible, texte invisible. Bouton désactivé. Durée typique : 200-500ms.

#### État 5 — Succès (transitoire)

```
[ Ajouté ✓ ]
```

Texte temporaire pendant 1500ms après ATC réussi. Le ✓ est en couleur sauge dark.

#### État 6 — Retour à l'état repos

```
[ Recevoir le rituel ]
```

Après 2800ms, le CTA revient à son état initial. Re-cliquable (incrémenterait le compteur).

#### État 7 — Stock épuisé

```
[ Bientôt disponible ]
```

Pendant 3 secondes, puis revient à l'état initial. Sous le CTA, microcopy :
> *« Le rituel arrive bientôt. Vous pouvez nous laisser votre email pour être prévenue. »*

#### État 8 — Erreur réseau

```
[ Recevoir le rituel ]
```

Le CTA revient immédiatement à son état initial. Sous le CTA, microcopy temporaire (5 secondes) :
> *« Une erreur est survenue. Vérifiez votre connexion et réessayez. »*

### 19.3 — Microcopy du mini modal panier

#### Header — confirmation

```
✓ Ajouté à votre rituel
```

| Élément          | Spécifications                                          |
| :--------------- | :------------------------------------------------------ |
| Icône ✓          | Caractère ✓ (U+2713), couleur `#A8C4A6` (Sauge dark)   |
| Texte            | Cormorant Garamond Light Italic 17pt, couleur Encre     |
| Espacement icône | 12px à droite de l'icône                                |

> **Pourquoi « Ajouté à votre rituel » et pas « Ajouté au panier » ?** Parce que le mot « rituel » garde la cliente dans l'univers émotionnel. « Panier » est un mot fonctionnel — utile dans le compteur header, mais incongru ici.

#### Récapitulatif produit

```
[mini photo]   Kit Rituel d'Éclat
               Le rituel complet · 4 étapes
               320 dh
```

| Élément              | Spécifications                                          |
| :------------------- | :------------------------------------------------------ |
| Mini photo           | 64×80px (ratio 4:5), photo du kit principal             |
| Nom produit          | Inter Medium 13pt, couleur Encre                        |
| Sous-titre           | Inter Regular 11pt italic, couleur Brume                 |
| Prix                 | Cormorant Garamond Light 18pt, couleur Encre            |
| Espacements          | 8px entre lignes, 16px entre photo et texte             |

#### Bouton primaire

```
[ Voir mon panier ]
```

| Propriété          | Valeur                                                          |
| :----------------- | :-------------------------------------------------------------- |
| Police             | Inter Medium 13pt                                               |
| Texte              | `#FBF8F1` (Crème pure)                                          |
| Fond               | `#2C2A28` (Encre)                                               |
| Padding            | 14px 24px                                                        |
| Largeur            | 100% du modal (moins padding)                                    |
| Hover              | Fond `#4A4844`                                                   |
| Action             | Navigation vers `/panier`                                        |

#### Lien secondaire

```
Continuer la lecture
```

| Propriété          | Valeur                                                          |
| :----------------- | :-------------------------------------------------------------- |
| Police             | Inter Regular 12pt                                              |
| Couleur            | `#6B6863` (Brume)                                               |
| Décoration         | Underline subtle, offset 3px                                     |
| Hover              | Couleur `#2C2A28` (Encre)                                       |
| Action             | Fermeture du modal                                              |
| Position           | Centré sous le bouton primaire, espacement 16px                  |

### 19.4 — État de fallback — Stock épuisé

Si la cliente clique sur le CTA et que le stock est à 0 :

```
┌────────────────────────────────────────────────────┐
│                                                    │
│  [ Bientôt disponible ]                            │
│                                                    │
│  Le rituel arrive bientôt. Vous pouvez nous       │
│  laisser votre email pour être prévenue.          │
│                                                    │
│  ┌────────────────────────────┐  ┌──────────────┐ │
│  │ votre@email.com            │  │ Prévenez-moi │ │
│  └────────────────────────────┘  └──────────────┘ │
│                                                    │
└────────────────────────────────────────────────────┘
```

| Propriété            | Valeur                                                  |
| :------------------- | :------------------------------------------------------ |
| Microcopy texte      | Cormorant Garamond Light Italic 14pt, couleur Encre claire |
| Champ email          | Inter Regular 12pt, padding 12px 16px, border 1px brume  |
| Bouton « Prévenez-moi » | Inter Medium 12pt, fond encre, padding 12px 20px      |
| Espacement haut formulaire | 16px sous le microcopy                              |

> **Tonalité paisible** : la phrase *« Le rituel arrive bientôt »* est délicate. Elle ne dit pas *« rupture de stock »* (alarmant) ni *« disponibilité limitée »* (manipulatif). Elle confirme simplement que le rituel **reviendra** — comme une promesse douce.

### 19.5 — Tonalité des messages — règles globales

**Toujours paisible.** Jamais d'urgence, jamais d'alarme, jamais d'emoji exclamatif.

| À éviter                                 | À préférer                                              |
| :--------------------------------------- | :------------------------------------------------------ |
| « Erreur ! Veuillez réessayer ! »        | « Une erreur est survenue. Vérifiez votre connexion. »  |
| « Stock limité ! »                       | (silencieux — pas de notion de stock affichée)           |
| « Plus que 3 articles ! »                | (interdit absolument)                                   |
| « Achetez maintenant ! »                 | « Recevoir le rituel »                                  |
| « Offre du jour »                        | (interdit)                                              |
| « ⚠️ Article supprimé »                  | « Article retiré de votre rituel »                      |
| « ✅ Succès »                             | (utiliser ✓ texte, pas emoji)                           |

### 19.6 — Microcopy mobile spécifique

| Contexte                              | Microcopy                                          |
| :------------------------------------ | :------------------------------------------------- |
| Burger menu fermé (aria-label)        | « Ouvrir le menu de navigation »                   |
| Burger menu ouvert (aria-label)       | « Fermer le menu de navigation »                   |
| Sticky CTA (apparition)               | « Recevoir le rituel → »                            |
| Carrousel témoignages                 | (aucun texte — gestuelle silencieuse)              |
| Vidéo controls bouton plein écran     | « Plein écran »                                    |
| Vidéo controls captions               | (label visible — « FR » / « AR » / « OFF »)        |
| Comparatif accordéon (label aria)     | « Voir les détails du critère [nom] »              |
| FAQ accordéon (label aria)            | « Voir la réponse à : [question] »                 |

### 19.7 — Cookies banner

Identique à `/accueil` et `/rituel`. Apparaît une seule fois, ne re-apparaît pas si déjà accepté/refusé via cookie persistant.

```
┌────────────────────────────────────────────────────────────────┐
│  Nous utilisons des cookies pour comprendre votre visite       │
│  et améliorer votre expérience. Aucun partage commercial.      │
│                                                                │
│  [Tout accepter]  [Personnaliser]  Refuser                     │
└────────────────────────────────────────────────────────────────┘
```

### 19.8 — Email transactionnel après ATC (V2)

Pour la V2, optionnel : si la cliente a un compte ou laisse son email pendant le checkout, elle peut recevoir un email de panier abandonné :

| Trigger              | Email envoyé après...                                  |
| :------------------- | :----------------------------------------------------- |
| ATC + abandon panier | 4 heures puis 24 heures plus tard                       |
| Sujet email          | « Votre rituel vous attend »                            |
| Tonalité             | Paisible, pas insistante                                |
| Réduction code       | **Aucune** (le luxe ne discount pas)                    |
| CTA email            | « Reprendre où je m'étais arrêtée »                     |

> **Aucun email après une heure** — la cliente vient de quitter, lui écrire trop tôt serait intrusif.

---

## 20 — Synthèse — checklist de validation

Avant mise en production, vérifier que chaque élément ci-dessous est validé. C'est l'audit final de la page `/kit`.

### 20.1 — Identité de marque

- [ ] Wordmark Pinyon Script présent en header et footer
- [ ] Aucune substitution de police pour le wordmark
- [ ] Palette signature respectée (sauge dominante, crème support, encre tranche)
- [ ] **Champagne utilisé exactement 1-2 fois** sur la page (★ comparatif et possiblement intro CTA final)
- [ ] Photos contextuelles (jamais isolées fond blanc)
- [ ] Photo above the fold = mains + tasse + kit (composition signature)
- [ ] 4 photos slow reveal du kit, chaque pot avec son objet contextuel
- [ ] Pas d'emoji nulle part (sauf ✓ texte unicode dans CTA succès)
- [ ] Pas de pop-up newsletter à l'arrivée
- [ ] Pas de barre de progression de scroll (différence avec `/rituel`)

### 20.2 — Copy & ton

- [ ] Surtitre above the fold : « KIT RITUEL » Inter SemiBold tracking 3.5px
- [ ] Titre principal : « Le rituel d'éclat, en quatre pots. » (deux lignes)
- [ ] Sous-titre : « Quatre matières japonaises pour préparer, lisser, polir, révéler. »
- [ ] Prix : « 320 dh » (rond, sans charm pricing, sans prix barré)
- [ ] CTA primaire : « Recevoir le rituel » (verbe de réception cohérent avec `/rituel`)
- [ ] Réassurances ATF : 3 lignes (livraison 48h, retour 14j, paiement 3×)
- [ ] Slow reveal : 4 verbes Préparer/Lisser/Polir/Révéler cohérents avec `/accueil` et `/rituel`
- [ ] Vidéo titre : « Soixante secondes pour comprendre. »
- [ ] Composition par pot : 4 mini-fiches avec ingrédients en français lisible
- [ ] Comparatif titre : « Trois manières d'envisager ses ongles. »
- [ ] FAQ titre : « Avant de recevoir le rituel. » (présuppose la conversion)
- [ ] FAQ : 9 questions/réponses, tonalité paisible
- [ ] Témoignages surtitre : « ELLES ONT CHOISI LE RITUEL »
- [ ] 3 témoignages longs (60-100 mots) avec prénoms marocains
- [ ] CTA final : phrase « Le rituel d'éclat. 320 dh. » + CTA dupliqué
- [ ] Cross-link : 3 articles, grille régulière
- [ ] Microcopy d'erreur : tonalité paisible, jamais agressive
- [ ] Aucune urgence, aucun countdown, aucun « Plus que X en stock »
- [ ] Apostrophes typographiques courbes ' partout
- [ ] Guillemets français « » avec espaces insécables

### 20.3 — Tactiques Kolenda — minimum 4 par section

- [ ] **Above the fold** : `CONTEXT > ISOLATION` `ROUND PRICING` `PRODUCT-THEN-PRICE` `VERB OF RECEIVING` `RISK REDUCTION 3X` `EMPTY SPACE` `IMPLY HUMAN`
- [ ] **Slow reveal** : `SLOW MOTION = LUXURY` `PARALLEL INDIVIDUATION` `SENSORY IMAGERY` `EMPTY SPACE`
- [ ] **Vidéo** : `IMPLY HUMAN` `AUTOPLAY ETHICS` `COHERENCE WITH /RITUEL` `CONFIRMATION COGNITIVE`
- [ ] **Composition par pot** : `TRANSPARENCY = TRUST` `INDIRECT TRUST CLAIMS` `SENSORY IMAGERY (textures)`
- [ ] **Comparatif** : `FRAMING BY CONTRAST` `CENTER STAGE EFFECT` `STRATEGIC UNDERPLAYING (point faible avoué)`
- [ ] **FAQ** : `EFFORT REDUCTION` `OBJECTION HANDLING` `VULNERABILITY (70% remboursement)`
- [ ] **Témoignages** : `IMPLY HUMAN` `MIRROR EFFECT 3 PROFILS` `VULNERABILITY ADMITTED` `LONG > SHORT (BOFU)`
- [ ] **CTA final** : `CTA REPETITION` `SAGE BACKDROP SYMMETRY` `PRICE RECALL CALM`

### 20.4 — Performance (cibles strictes BOFU)

- [ ] **LCP < 2.0s** sur 4G simulé Maroc
- [ ] **CLS < 0.05**
- [ ] **INP < 150ms** (interactions ATC critiques)
- [ ] Page weight (hors vidéo) < 700 KB
- [ ] Photo above the fold preloadée avec `fetchpriority="high"`
- [ ] Vidéo `preload="metadata"` initial (pas tout le payload)
- [ ] Vidéo lecture seulement quand section atteint 60% viewport
- [ ] Images en WebP avec fallback JPEG
- [ ] Polices critiques preloaded (Inter Regular, Inter Medium, Cormorant Light)
- [ ] Lazy loading sur photos sous le pli
- [ ] CSS critique inline dans `<head>`
- [ ] JavaScript ATC en defer
- [ ] CDN configuré (Polish, Mirage, Stream/Mux pour vidéo)
- [ ] Preconnect au CDN images
- [ ] DNS prefetch payment provider

### 20.5 — Mécaniques de panier (ATC)

- [ ] Click CTA → animation scale 0.97 (feedback tactile)
- [ ] Loading state : spinner mini visible 200-300ms
- [ ] Server response < 200ms idéalement
- [ ] **Animation pot vers panier** : 800ms courbe Bézier, scale décroissant
- [ ] **Pulse compteur header** : 600ms scale (1 → 1.15 → 1)
- [ ] **Couleur compteur** : sauge → champagne → sauge en 800ms
- [ ] **Mini modal panier** : slide-in from right 320ms ease-out
- [ ] Mini modal contenu : confirmation ✓ + récap produit + 2 actions
- [ ] Auto-close du mini modal après 8 secondes
- [ ] Click extérieur ferme le modal
- [ ] CTA original revient à l'état repos après 2800ms
- [ ] Cookie panier persistance 7 jours
- [ ] **Sticky CTA mobile** apparaît après 100vh, disparaît à la section CTA final
- [ ] État stock épuisé : message paisible + capture email

### 20.6 — Responsive

- [ ] Mobile 375px, 390px, 414px testés
- [ ] Tablet 768px, 1024px testés
- [ ] Desktop 1280px, 1440px, 1920px testés
- [ ] Aucun débordement horizontal à aucune taille
- [ ] Touch targets ≥ 44×44px sur mobile
- [ ] Texte minimum 14px sur mobile
- [ ] **Above the fold mobile** : photo dessus, info dessous (empilage)
- [ ] **Comparatif mobile** : accordéon par critère (pas de table scrollable horizontale)
- [ ] **Témoignages mobile** : carrousel swipe avec scroll-snap
- [ ] **Sticky CTA mobile** visible et fonctionnel
- [ ] Mini modal panier : 100% - 32px de marges sur mobile

### 20.7 — SEO

- [ ] Title 60-71 caractères, mot-clé en tête, prix mentionné
- [ ] Meta description 140-155 caractères
- [ ] Open Graph image 1200×630 dédiée à `/kit` (avec prix overlay)
- [ ] Open Graph Product tags (price:amount, currency, availability, brand)
- [ ] Twitter Card configurée avec labels Prix + Livraison
- [ ] **Schema.org Product** JSON-LD complet (price, availability, aggregateRating, shippingDetails, returnPolicy)
- [ ] **Schema.org VideoObject** pour la vidéo
- [ ] **Schema.org FAQPage** pour la FAQ (rich snippet possible)
- [ ] Canonical URL en HTTPS
- [ ] Hreflang fr-MA + ar-MA
- [ ] Sitemap.xml inclut `/kit` avec **priority 1.0** (max)
- [ ] Un seul `<h1>` (titre above the fold)
- [ ] Hiérarchie des `<h2>`, `<h3>` cohérente
- [ ] `max-image-preview:large` dans robots meta
- [ ] GTIN/EAN13 produit valide

### 20.8 — Accessibilité (avec mécaniques ATC)

- [ ] WCAG 2.2 AA validé via axe-core ou WAVE
- [ ] Contrastes vérifiés sur toutes les combinaisons texte/fond
- [ ] Navigation clavier complète (Tab, Enter, Escape)
- [ ] Player vidéo accessible : Espace, M, F, C, ←→, ↑↓, 0-9
- [ ] Focus ring visible et cohérent
- [ ] ARIA landmarks et labels en place
- [ ] **Captions vidéo** FR + AR disponibles
- [ ] **Transcript vidéo** complet en `<details>`
- [ ] Alt texts descriptifs sur toutes les images informatives
- [ ] **Mini modal panier** : `role="dialog"`, `aria-modal="true"`, focus trap
- [ ] **Annonces ARIA live** lors de l'ATC (« Ajout en cours », « Ajouté au panier »)
- [ ] **Compteur panier** avec `aria-live="polite"`
- [ ] **4 skip links** : main / produit+prix / achat direct / FAQ
- [ ] FAQ items focusables et navigables au clavier
- [ ] `prefers-reduced-motion` respecté (animations + autoplay vidéo + ATC pot)
- [ ] Test lecteur d'écran NVDA, VoiceOver, TalkBack
- [ ] Lighthouse Accessibility score ≥ 95/100

### 20.9 — Émotion & cohérence narrative

- [ ] La règle de la décision dégressive est respectée (50%/15%/5%/10%/12%/8%)
- [ ] L'above the fold est suffisant pour le profil A (convaincue) — sans descendre
- [ ] Le below the fold construit la conviction du profil B (directe Instagram)
- [ ] Architecture émotionnelle : conviction calme → désir matériel → vérification rationnelle → identification → décision
- [ ] Alternance dense/aérée respectée entre sections
- [ ] Aucun prix mentionné avant l'above the fold
- [ ] CTA répété **2 fois** (above the fold + bandeau final), même wording
- [ ] Le Champagne n'apparaît que 1-2 fois (★ comparatif + possiblement intro CTA final)
- [ ] La vidéo est cohérente avec celle de `/rituel` (re-cut, pas tournage différent)
- [ ] Khadija (témoignage `/rituel`) ≠ Aïcha/Salma/Yasmine (témoignages `/kit`) — cohérence éditoriale, pas de doublon
- [ ] Bandeau CTA final sur fond sauge pâle = symétrie avec pivot `/rituel`
- [ ] Cross-link Journal pertinent (pas redondant avec `/rituel`)
- [ ] Aucune section commerciale agressive — la maison ne crie jamais
- [ ] Les 9 risques perçus (Lantos) sont tous adressés au moins une fois

---

> *« Une fiche produit qui se lit comme un magazine. Une décision qui se prend comme une évidence. C'est le pari du kit. »*

**FIN · FemiGlow · Spécification de la page Kit v1.0 · Mai 2026**

*Prochaines spécifications à produire (B2C) : `/journal`, `/maison`, `/panier`, `/commander ★`, `/merci`.*
*Puis B2B : `/partenaires`, `/programme`, `/echantillon ★`, `/espace-pro`.*
