# Proposition n°3 — *Le Sommaire saisonnier*

> **Philosophie :** un menu éditorial à deux étages, comme l'ours d'une revue.
> En haut, une bande très fine qui dit la saison, le lieu et le panier ; en
> dessous, le sceau et 5 entrées en petites capitales Cormorant. Au survol
> d'une entrée, un mega-panel descend, nommé, illustré, sous-naviguable.
> Référence implicite : *The Gentlewoman*, *Le Monde Style*, *Vogue Living*.

---

## 1. Concept en une phrase

Un **double-strata header** où la marque se présente en éditrice : strate
supérieure micro-typo (saison, lieu, panier), strate principale logo + 5
liens, et **mega-panel** sur hover qui révèle pour chaque entrée une
description, 2-3 sous-liens et une vignette image saisonnière. Sur mobile, le
mega-panel devient un **bottom-sheet** glissant en accordéon.

## 2. Charte appliquée

| Élément | Token / valeur |
|---|---|
| Strate haute | hauteur 28 px, fond `bg-encre`, texte `text-creme/85` |
| Texte strate haute | `font-body` (Inter), 10 px, `tracking-[0.22em]`, uppercase |
| Strate principale | hauteur 80 px, fond `bg-creme`, bordure 1 px `encre/8` en bas |
| Sceau logo | `font-script` (Pinyon), 26 px |
| Texte liens principaux | `font-display` (Cormorant) **small caps**, 14 px, `tracking-[0.12em]` |
| Mega-panel | hauteur 280 px, fond `bg-creme`, bordure haute 1 px `encre/8`, ombre `shadow-[0_20px_40px_rgba(0,0,0,0.06)]` |
| Texte panel description | `font-body` (Inter), 14 px, `text-encre/70`, lh 1.6 |
| Sous-liens panel | `font-display` (Cormorant) italique, 18 px |
| Vignette panel | 200 × 200 px, `rounded-[2px]`, `object-cover`, `grayscale-[8%]` |
| Bottom-sheet mobile | fond `creme`, 80 vh, drag-handle haut 36 × 4 px `bg-encre/20` |

## 3. Desktop — anatomie

### State 1 — repos (deux strates visibles)

```
┌────────────────────────────────────────────────────────────────────────┐
│ SAISON DU PRINTEMPS — CASABLANCA, MAR 2026             ⌶ PANIER · 2   │  28 px
├────────────────────────────────────────────────────────────────────────┤
│  FemiGlow      Le Rituel   Le Kit   Journal   Maison   Contact         │  80 px
└────────────────────────────────────────────────────────────────────────┘
```

- **Strate haute** (28 px) : texte centré-justifié, à gauche le contexte
  saisonnier `SAISON DU PRINTEMPS — CASABLANCA, MAR 2026`, à droite l'accès
  panier en uppercase avec compteur. Fond `encre`, texte `creme/85`.
- **Strate principale** (80 px) : sceau Pinyon à gauche, 5 liens centrés-droite
  en Cormorant small caps 14 px, espacés `gap-10`.
- L'item *Le Rituel* prend l'article — c'est éditorial, pas commercial.
- Au scroll > 60 px : **la strate haute disparaît** (translate-Y vers le haut,
  220 ms), seule la strate principale reste sticky, sa hauteur passe à 64 px.

### State 2 — mega-panel ouvert (hover « Le Rituel »)

```
┌────────────────────────────────────────────────────────────────────────┐
│ SAISON DU PRINTEMPS — CASABLANCA, MAR 2026             ⌶ PANIER · 2   │
├────────────────────────────────────────────────────────────────────────┤
│  FemiGlow      [Le Rituel]   Le Kit   Journal   Maison   Contact       │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   Le rituel en 4 gestes, quatre minutes,                  ┌─────────┐  │
│   matin et soir. Conçu pour les ongles                    │         │  │
│   fragilisés par les saisons sèches.                      │ image   │  │
│                                                           │ rituel  │  │
│   ↳ Voir le rituel complet                                │         │  │
│   ↳ Acheter le kit                                        │         │  │
│   ↳ Lire l'article fondateur                              └─────────┘  │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
                                                                   280 px
```

- Le panel s'**aligne sous la strate principale**, occupe toute la largeur du
  viewport mais le contenu reste contenu dans `Container width="page"`.
- Le contenu s'organise en **deux colonnes** : 60 % texte + sous-liens à
  gauche, 40 % vignette image saisonnière à droite (avec un léger débord en
  bas pour signaler la « page derrière »).
- Description : 2-3 phrases courtes, ton éditorial, en Inter 14 px.
- Sous-liens : 2-3 maxi, en Cormorant italique 18 px, précédés du caractère
  `↳` (8 px de marge), trait sous le mot au hover.
- Vignette : image carrée 200 × 200 px ; pour *Le Rituel*, c'est le poster
  vidéo ; pour *Le Kit*, le packshot du kit ; pour *Journal*, la couverture
  de l'article-vedette ; pour *Maison*, l'atelier ; pour *Contact*, une
  photo de la baie de Casablanca.
- Le panel reste ouvert tant que la souris reste sur l'item OU sur le panel
  (zone de tolérance « pyramide » pour éviter la fermeture accidentelle).
- Délai d'ouverture : 80 ms après hover (anti-tremblement). Délai de
  fermeture : 220 ms après sortie.

### Anatomie « contact » (cas spécial sans sous-liens)

```
│   Une question, une commande spéciale ?                   ┌─────────┐  │
│   Écrivez-nous, nous répondons en 48 h.                   │ baie    │  │
│                                                           │ casa    │  │
│   ↳ Formulaire                                            │         │  │
│   ↳ contact@femiglow.ma                                   └─────────┘  │
```

## 4. Mobile — anatomie

### Repos

```
┌─────────────────────────────────────┐
│ PRINTEMPS · CASA              ⌶ 2  │  24 px (strate haute condensée)
├─────────────────────────────────────┤
│  FemiGlow                  ☰        │  56 px
└─────────────────────────────────────┘
```

- Strate haute condensée à 24 px, contenu raccourci (`PRINTEMPS · CASA`).
- Strate principale 56 px, sceau Pinyon 22 px à gauche, icône menu custom
  (deux traits 1.5 px) à droite. Pas de panier visible — il bascule dans le
  bottom-sheet pour gagner de la place.
- Bordure inférieure permanente 1 px `encre/8`.

### Bottom-sheet ouvert (tap sur ☰)

```
┌─────────────────────────────────────┐
│              ▬▬                     │  drag handle 36 × 4 px
├─────────────────────────────────────┤
│                                     │
│   Le Rituel                    ⌃    │  accordéon fermé
│   Le Kit                       ⌃    │
│   Journal                      ⌃    │
│   Maison                       ⌃    │
│   Contact                      ⌃    │
│                                     │
│   ─────────                         │
│   Panier (2)                        │
│                                     │
│   Casablanca, saison du printemps   │
└─────────────────────────────────────┘
                                  80 vh
```

- Le bottom-sheet glisse depuis le bas, occupe **80 vh**, fond `creme`,
  bordure haute douce, drag-handle 36 × 4 px en haut.
- Liens principaux en **Cormorant 28 px**, alignés à gauche, `px-8`,
  `gap-y-5`. Chacun a un chevron `⌃` à droite indiquant l'accordéon.
- **Tap sur un item** : l'item s'agrandit, déploie en dessous : description
  Inter 13 px + sous-liens Cormorant italique 18 px (avec `↳`) + vignette
  carrée 120 × 120 px à droite. Animation 280 ms ease-out, hauteur auto.
- Un seul item peut être ouvert à la fois (les autres se ferment).
- En bas : trait fin, lien panier (compteur entre parenthèses) Cormorant
  20 px, signature `Casablanca, saison du printemps.` en Pinyon 14 px.
- **Fermeture** : tap sur la handle, swipe vers le bas, tap sur l'overlay
  (`bg-encre/40 backdrop-blur-md`), bouton Esc clavier externe.

### Bottom-sheet ouvert + accordéon Le Rituel

```
│   Le Rituel                    ⌄    │
│   ┌─────────────────────────────┐   │
│   │ 4 gestes, 4 minutes,    ┌──┐│   │
│   │ matin et soir.          │imᵍ││   │
│   │                         └──┘│   │
│   │ ↳ Voir le rituel            │   │
│   │ ↳ Acheter le kit            │   │
│   │ ↳ Article fondateur         │   │
│   └─────────────────────────────┘   │
│                                     │
│   Le Kit                       ⌃    │
│   ...                               │
```

## 5. Animations

| Moment | Détail |
|---|---|
| Mount | Strate haute fade-in 240 ms ease-out, strate principale 320 ms ease-out, sceau et liens en cascade `stagger 60ms` |
| Scroll > 60 px | Strate haute s'élève (`translate-y -28px`, 220 ms ease-out), strate principale rétrécit 80 → 64 px |
| Hover lien | Trait sous le mot se dessine 200 ms (gauche → droite), opacité 0.85 → 1 |
| Ouverture panel | Hauteur 0 → 280 px, 280 ms `cubic-bezier(0.32,0.72,0,1)` ; le contenu (texte, vignette) en cascade `stagger 60 ms`, fade-up 12 px, 320 ms ease-out |
| Fermeture panel | Hauteur 280 → 0 px, 220 ms ease-in, contenu fade-out 160 ms |
| Bascule entre items | Le panel ne se ferme pas, son **contenu seul** crossfade 200 ms vers le nouveau |
| Tap mobile menu | Bottom-sheet `translate-y 100% → 0`, 360 ms `cubic-bezier(0.32,0.72,0,1)`, overlay fade 240 ms |
| Tap accordéon mobile | Chevron rotation 0° → 180° (220 ms), contenu height auto (CSS `grid-template-rows: 1fr`) 280 ms ease-out |
| Drag-to-close | Suit le doigt avec damping 0.7, snap retour ou fermeture > 30 % |
| `prefers-reduced-motion` | Strate haute reste figée, panel apparaît en simple fade 200 ms, accordéon en fade 160 ms |

## 6. Accessibilité

- **Mega-panel desktop** : `<div role="region" aria-labelledby="trigger-rituel">`,
  ouvre sur hover ET sur focus clavier (`Tab` puis flèche bas pour entrer
  dans le panel). `Esc` referme le panel et restaure le focus sur l'item.
- L'ouverture sur hover seule serait inaccessible — la version clavier est
  obligatoire.
- **Bottom-sheet mobile** : `<dialog>` natif modal, focus trap, `Esc` ferme.
  L'accordéon utilise `<details>`/`<summary>` natif (sémantique gratuite),
  stylisé custom.
- `aria-expanded` sur chaque trigger d'accordéon, `aria-controls` pointe
  vers l'id du panneau.
- Lien actif (page courante) : `aria-current="page"`, soulignement permanent
  sous le mot.
- Skip link déjà présent (`SkipLink.tsx`) → cible `#main`, traverse les
  deux strates.
- Vignettes images : `<img alt="">` (décoratives, contexte donné par le
  texte adjacent).
- Cibles tactiles : 44 × 44 px minimum sur mobile (les lignes accordéon font
  56 px de haut au repos).
- Contraste : `creme/85` sur `encre` strate haute = 11.2:1 ; `encre` sur
  `creme` ailleurs = 12.6:1. AAA partout.
- **Hover-only trap** évité : un délai d'ouverture de 80 ms et une zone
  pyramidale de tolérance évitent les fermetures involontaires.

## 7. Cohérence avec la marque

- **Très forte.** Le double-strata évoque l'ours d'une revue — exactement
  l'ADN éditorial de la marque.
- La saison + le lieu rappelés en permanence (`SAISON DU PRINTEMPS —
  CASABLANCA`) ancrent la marque dans son temps et son territoire à chaque
  page vue. C'est unique.
- Le mega-panel donne une **profondeur de discours** que les deux autres
  propositions n'offrent pas : chaque section est introduite, contextualisée,
  illustrée.
- Les vignettes saisonnières peuvent **changer chaque saison** (printemps,
  été, automne, hiver) — c'est un crochet de fidélisation visuel.
- Risque : c'est la proposition la plus dense. Si le contenu n'est pas tenu
  à jour saisonnièrement, l'effet retombe.

## 8. Forces / faiblesses synthétiques

**Forces**
- Profondeur éditoriale unique : chaque entrée est *présentée*, pas juste
  listée.
- Le contexte saisonnier en haut crée un crochet revenant à chaque visite.
- Les vignettes images réutilisent l'investissement photo de la marque,
  excellente synergie.
- Mobile riche — l'accordéon fait du menu un mini-sommaire interactif.
- Sous-liens raccourcissent les parcours de 2 clics à 1 clic
  (notamment `Acheter le kit` directement depuis le panel *Rituel*).
- Ergonomie clavier complète, même avec le hover-pattern.

**Faiblesses**
- Densité informationnelle élevée — risque de paraître chargé sur un site
  qui revendique la lenteur.
- Coût d'implémentation le plus élevé des trois (hover intention, focus
  trap, accordéon mobile, vignettes saisonnières à maintenir).
- Performance : 5 vignettes images en plus à charger (LCP impact si mal
  géré ; doit être lazy au-delà du premier hover).
- Le saisonnier impose une **gouvernance éditoriale** : qui change la
  date / la saison ? Si oublié, le menu mentira sur la marque.
- Le mega-panel fonctionne mal en navigation tactile sur tablette (entre
  hover desktop et bottom-sheet mobile) — il faut décider d'un breakpoint
  bascule à `lg:` (1024 px).
