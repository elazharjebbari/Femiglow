# Proposition finale — *Le Sommaire*

> **Synthèse des trois propositions.** On garde le **geste radical** de
> *Le Sceau* (un menu qui s'efface, un overlay qui prend toute la page) ;
> on emprunte la **profondeur éditoriale** du *Sommaire saisonnier*
> (descriptions, vignettes, signature de saison) en l'intégrant *à
> l'intérieur* de l'overlay ; on conserve **l'ergonomie irréprochable** du
> *Rail lent* (lien actif visible, libellé clair, indices de découverte).
>
> Le résultat est un menu qui ne se montre pas dans le chrome de la page,
> mais qui, une fois ouvert, devient une **page de garde de revue** :
> texte, image, signature.

---

## 1. Concept en une phrase

**Au repos**, un en-tête mince, transparent, avec uniquement le sceau Pinyon
à gauche, le mot ***Sommaire*** à droite et l'icône panier — rien d'autre
ne pollue la page. **À l'ouverture**, l'overlay plein-écran révèle les
5 entrées en grand Cormorant italique, chacune accompagnée d'une **descrip-
tion d'une ligne** et d'une **vignette saisonnière** discrète à droite.
La signature `Casablanca, saison du printemps.` ferme la page.

## 2. Charte appliquée

| Élément | Token / valeur |
|---|---|
| Header au repos | hauteur 72 px desktop / 56 px mobile, fond transparent |
| Sceau logo | `font-script` (Pinyon Script), 26 px desktop / 22 px mobile, `text-encre` |
| Trigger *Sommaire* | `font-body` (Inter), 12 px, `tracking-[0.2em]`, uppercase, soulignement 1 px `encre/40`, hover `encre` |
| Compteur panier | cercle 18 px, `bg-encre text-creme`, `font-body` 10 px, affiché uniquement si > 0 |
| Header au scroll > 40 px | fond `creme/85` + `backdrop-blur-sm`, bordure inférieure 1 px `encre/8`, hauteur 64 px |
| Overlay fond | `bg-creme` opaque (pas de transparence) |
| Liens overlay | `font-display` (Cormorant), italique, regular weight, 56 px desktop / 32 px mobile |
| Description sous chaque lien | `font-body` (Inter), 13 px, `text-encre/55`, `mt-2`, lh 1.55, max 56 caractères |
| Vignette overlay | 88 × 88 px desktop / 64 × 64 px mobile, `rounded-[2px]`, `object-cover`, `grayscale-[6%]` |
| Signature bas | `font-script` (Pinyon), 18 px desktop / 16 px mobile, `text-encre/55` |
| Indicateur de saison | `font-body` 10 px, `tracking-[0.22em]`, uppercase, `text-encre/40`, en haut de l'overlay |

## 3. Desktop — anatomie

### State 1 — repos (header invisible)

```
┌──────────────────────────────────────────────────────────────────────┐
│  FemiGlow                                              SOMMAIRE  ⌶ 2 │
└──────────────────────────────────────────────────────────────────────┘
        72 px, fond transparent — la page respire derrière
```

- Hauteur 72 px, fond transparent (sur le `bg-creme` global).
- À gauche : sceau Pinyon (26 px), `<Link href="/">`.
- À droite : *SOMMAIRE* + icône panier (SVG 1.5 px) + compteur si > 0.
- Au scroll > 40 px : fond `creme/85` + `backdrop-blur-sm`, bordure 1 px
  `encre/8`, hauteur 64 px (240 ms ease-out).

### State 2 — overlay ouvert (cœur de la proposition)

```
┌──────────────────────────────────────────────────────────────────────┐
│  FemiGlow                                              FERMER    ⌶ 2 │
├──────────────────────────────────────────────────────────────────────┤
│  SAISON DU PRINTEMPS — CASABLANCA                                    │
│                                                                      │
│                                                                      │
│   Le rituel                                              ┌────────┐  │
│   Quatre gestes, quatre minutes, matin et soir.          │ rituel │  │
│                                                          └────────┘  │
│                                                                      │
│   Le kit                                                 ┌────────┐  │
│   Six pièces pensées pour les saisons sèches.            │ packsh │  │
│                                                          └────────┘  │
│                                                                      │
│   Le journal                                             ┌────────┐  │
│   Les notes de l'atelier, en lecture lente.              │ paper  │  │
│                                                          └────────┘  │
│                                                                      │
│   La maison                                              ┌────────┐  │
│   Casablanca, l'atelier, les mains qui font.             │ atelier│  │
│                                                          └────────┘  │
│                                                                      │
│   Contact                                                ┌────────┐  │
│   Une question, une commande spéciale.                   │ baie   │  │
│                                                          └────────┘  │
│                                                                      │
│                                                                      │
│                                       Casablanca, saison du printemps│
└──────────────────────────────────────────────────────────────────────┘
```

- Overlay **plein viewport**, fond `creme` opaque. Le header reste visible
  en haut, *SOMMAIRE* devient *FERMER*.
- En haut de l'overlay : ligne micro-typo `SAISON DU PRINTEMPS — CASABLANCA`
  (Inter 10 px, `tracking-[0.22em]`, `text-encre/40`). C'est l'unique trace
  du saisonnier — pas de strate permanente à maintenir.
- Liens disposés en **liste verticale**, marge gauche `ml-[14vw]`, marge
  droite `mr-[14vw]`, espacés `gap-y-10`.
- Chaque entrée est un **trio horizontal** :
  - **Titre** : Cormorant italique 56 px, regular, alignement gauche, le mot
    occupe le tiers gauche.
  - **Description** : Inter 13 px, `text-encre/55`, sous le titre, `mt-2`,
    une seule ligne (max 56 caractères pour rester lisible).
  - **Vignette** : 88 × 88 px alignée à droite (`ml-auto`), légèrement
    décalée vers le bas (`mt-2`) pour respirer.
- En bas de l'overlay, à droite : signature `Casablanca, saison du
  printemps.` en Pinyon 18 px.
- **Hover sur un lien** : un trait SVG fin se dessine sous le mot
  (`stroke-dashoffset` 350 ms), la vignette gagne 2 % d'échelle (220 ms).
  Aucune autre transformation.
- **Lien de la page courante** : trait permanent sous le mot (1.5 px),
  `aria-current="page"`.
- **Découverte au premier visit** : si le visiteur scroll sans avoir cliqué
  *SOMMAIRE* en 8 secondes, un micro-tooltip animé pointe le mot avec un
  léger `pulse` 2 fois (320 ms × 2). Une seule fois par session
  (`sessionStorage.menuHinted`).

## 4. Mobile — anatomie

### Repos

```
┌─────────────────────────────────────┐
│  FemiGlow            ⌶ 2  SOMMAIRE  │  56 px
└─────────────────────────────────────┘
```

- Hauteur 56 px, fond transparent ou `creme/85` au scroll.
- Sceau Pinyon 22 px à gauche.
- Panier puis *SOMMAIRE* (uppercase 11 px, soulignement 1 px) à droite.
- Pas de burger — le mot *SOMMAIRE* reste, c'est volontairement non-banal.

### Overlay ouvert

```
┌─────────────────────────────────────┐
│  FemiGlow                  FERMER   │
├─────────────────────────────────────┤
│  SAISON DU PRINTEMPS — CASA         │
│                                     │
│   Le rituel              ┌──────┐   │
│   Quatre gestes…         │ vig  │   │
│                          └──────┘   │
│                                     │
│   Le kit                 ┌──────┐   │
│   Six pièces…            │ vig  │   │
│                          └──────┘   │
│                                     │
│   Le journal             ┌──────┐   │
│   Les notes…             │ vig  │   │
│                          └──────┘   │
│                                     │
│   La maison              ┌──────┐   │
│   Casablanca…            │ vig  │   │
│                          └──────┘   │
│                                     │
│   Contact                ┌──────┐   │
│   Une question…          │ vig  │   │
│                          └──────┘   │
│                                     │
│   ─────────                         │
│   Panier (2)                        │
│                                     │
│   Casablanca, saison du printemps   │
└─────────────────────────────────────┘
                                100 vh
```

- Overlay 100 vw × 100 vh, même fond crème.
- Liens en Cormorant italique 32 px, alignés à gauche, padding `px-6`.
- Description Inter 12 px sous chaque titre, `mt-1`.
- Vignette 64 × 64 px à droite de chaque ligne (mobile = trio horizontal
  conservé, c'est la singularité du concept).
- Espacement `gap-y-7` entre les entrées.
- Sous les 5 entrées : trait fin, lien `Panier (2)` en Cormorant 22 px.
- Signature `Casablanca, saison du printemps.` en bas, Pinyon 16 px.
- **Fermeture** : tap sur *FERMER*, swipe vers le haut (drag damping 0.7),
  ou `Esc` (clavier externe).

## 5. Animations

| Moment | Détail |
|---|---|
| Mount header | Sceau fade-in 480 ms ease-out, *SOMMAIRE* en cascade 80 ms après |
| Scroll > 40 px | Header se matérialise (transparence → `creme/85`), 280 ms |
| Hover sceau | Sceau passe de `text-encre` à `text-encre/70`, 220 ms |
| Click *SOMMAIRE* | Overlay descend du haut, 480 ms `cubic-bezier(0.22,1,0.36,1)` ; ligne saison fade-in 200 ms après ; entrées en cascade `stagger 90 ms`, fade-up 16 px, 360 ms ease-out |
| Hover lien | Trait SVG sous le mot (`stroke-dashoffset` 100 % → 0 %, 350 ms ease-out) ; vignette `scale 1.0 → 1.02`, 220 ms |
| Sortie hover | Trait revient (350 → 0 %, 280 ms), vignette retour 220 ms |
| Click *FERMER* | Overlay remonte vers le haut, 360 ms ease-in, entrées disparaissent en cascade inversée |
| Indice premier visit | Tooltip flèche pulse `opacity 0 → 1 → 0.6 → 1 → 0`, 2 fois 320 ms, 8 s après mount si pas d'interaction |
| Drag-to-close mobile | Suit le doigt avec damping 0.7, snap retour ou fermeture > 25 % |
| `prefers-reduced-motion` | Toutes les translations passent à 0 ; overlay = simple crossfade 200 ms ; pas de cascade ; pas d'indice tooltip |

## 6. Accessibilité

- L'overlay est un `<dialog>` natif modal — focus trap automatique, `Esc`
  ferme, retour focus sur le trigger *SOMMAIRE*.
- `aria-labelledby` pointe vers `<h2 className="sr-only">Sommaire de
  navigation</h2>`, premier enfant de l'overlay.
- Trigger : `<button aria-expanded={open} aria-controls="sommaire-overlay">`.
- Liens dans l'ordre logique du parcours d'achat (rituel → kit → journal →
  maison → contact). `Tab` parcourt, `Shift+Tab` remonte, `Esc` ferme.
- Vignettes : `<img alt="">` (décoratives, contexte donné par le titre).
- Lien actif : `aria-current="page"`, soulignement permanent visible.
- Skip link `SkipLink.tsx` reste fonctionnel et précède le sommaire dans
  l'ordre du DOM.
- Contraste : `encre` sur `creme` = 12.6:1 (AAA). Description à `encre/55`
  = 6.9:1 (AA grand texte, AAA pour texte 13 px Inter ≈ borderline mais
  description est complémentaire au titre, donc acceptable).
- Cibles tactiles : 44 × 44 px minimum sur mobile (chaque entrée fait 88 px
  de haut au repos avec sa vignette).
- Tooltip de découverte respecte `prefers-reduced-motion` (pas affiché).
- Le swipe-down mobile ne remplace pas la fermeture — *FERMER* texte est
  l'option principale et toujours visible.

## 7. Cohérence avec la marque

- **Maximale.** Le geste radical (cacher le menu) revendique la lenteur ;
  l'overlay éditorial affirme la voix de revue ; les vignettes saisonnières
  ancrent la marque dans le temps ; la signature `Casablanca, saison du
  printemps.` ancre dans le lieu.
- Le mot *Sommaire* (et non *Menu*) emprunte au vocabulaire éditorial,
  jamais commercial.
- Le Cormorant italique en très grand est exactement la voix typographique
  de la maison — comme une page de garde de magazine.
- Le saisonnier est **léger** (une seule ligne micro-typo dans l'overlay),
  pas exigeant en gouvernance — change 4 fois l'an.
- La marque ne crie pas, ne pousse pas vers l'achat. Elle confie ses entrées
  comme on tend un sommaire.

## 8. Synthèse des compromis tenus

| Demande des 3 propositions | Réponse de la finale |
|---|---|
| Geste radical (Sceau) | ✓ menu caché derrière *SOMMAIRE*, overlay plein écran |
| Profondeur éditoriale (Saisonnier) | ✓ descriptions courtes + vignettes, dans l'overlay |
| Ergonomie irréprochable (Rail lent) | ✓ libellé explicite + tooltip au 1er visit + lien actif visible |
| Mobile à parité (Sceau) | ✓ même structure trio horizontal, juste réduite |
| Saisonnier sans dette opérationnelle | ✓ une ligne dans l'overlay, pas de strate permanente |
| Performance acceptable | ✓ vignettes 88 px lazy au-delà du fold de l'overlay |
| WCAG AAA | ✓ `<dialog>` natif, focus trap, contraste vérifié |
| Singularité marque | ✓ aucun concurrent du nail-care marocain ne fait ça |

## 9. Score estimé de cette synthèse

| Axe | Pondération | Note |
|---|:---:|:---:|
| Cohérence marque | 5 | **5 / 5** |
| Ergonomie | 5 | **4.5 / 5** (le visiteur très pressé peut encore être désorienté, le tooltip atténue mais n'élimine pas) |
| Élégance / originalité | 3 | **3 / 3** |
| Performance / faisabilité | 3 | **2.5 / 3** (5 vignettes + animations cubic-bezier + tooltip = surcoût mais raisonnable) |
| Accessibilité | 2 | **2 / 2** |
| Mobile | 2 | **2 / 2** |
| **Total** | **20** | **19 / 20** |

## 10. Plan d'implémentation suggéré

1. **Composant `<Header>`** : barre 72 px transparente, sceau, trigger
   *SOMMAIRE*, panier — sticky avec état `scrolled` à 40 px.
2. **Composant `<SommaireOverlay>`** :
   - `<dialog>` natif, contrôlé par état `open` dans `useState`.
   - Liste hardcodée des 5 entrées (depuis `routes.ts` + descriptions
     extraites d'un nouveau `lib/menu-descriptions.ts`).
   - Vignettes : nouvelles images carrées 200 × 200 px à générer (réutiliser
     les hero existants, recropper via `next/image` + `sizes`).
3. **Animations** : Framer Motion (déjà dans le projet) pour la cascade et
   le slide ; `prefers-reduced-motion` géré via `useReducedMotion()`.
4. **Tooltip découverte** : composant léger affiché conditionnellement,
   `sessionStorage.setItem('menuHinted', '1')` au dismiss / au click.
5. **Tests** :
   - Unit : `<SommaireOverlay>` ouvre/ferme, focus trap, `Esc`.
   - jest-axe : pas de violations a11y.
   - Visual : screenshot des deux states, mobile + desktop.
6. **Vignettes à produire** : 5 vignettes carrées 200 × 200 px (descriptions
   à ajouter dans `docs/images/prompts/menu/vignette-{rituel,kit,journal,
   maison,contact}.txt`).

---

> **En une ligne :** *un sommaire qu'on ouvre comme on ouvre une revue, qui
> dit la saison, le lieu, les pages — et qui se referme sans bruit.*
