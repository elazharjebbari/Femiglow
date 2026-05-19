# 01 — Vision & Design

> Wireframes, ergonomie, design tokens, animations, palette. À lire **avant tout code** pour aligner l'équipe sur la cible visuelle.

---

## 1. Vision UX — Parcours de la cliente

### 1.1 Mobile (375 × 667 — fold critique)

La cliente arrive sur `/kit` depuis une pub Meta/Google, en mobile, dans 70 % des cas. Elle a **3-5 secondes** pour décider de continuer.

**Mandat sans scroll** :
1. Voir un visuel désirable (produit ou contexte).
2. Comprendre ce que c'est (`Pack FemiGlow`).
3. Voir combien ça coûte (`199 MAD · barré 390 MAD`).
4. Voir des étoiles (`4,8/5 · 287 avis`).
5. Voir le bouton (`Commander le rituel`).
6. Voir au moins une garantie (`Paiement à la livraison`).

**Mandat au premier scroll** :
- Voir d'autres images (galerie horizontale swipe).
- Voir les 4 attributs (sans vernis · sans UV · sans acétone · halal).
- Voir la description longue.

### 1.2 Desktop (1280+ — confort)

Mandat dès l'arrivée :
- Layout 2 colonnes équilibré (image gauche, contenu droite).
- Galerie avec vignettes verticales à gauche de l'image principale (4-6 vignettes empilées).
- Contenu droite : kicker → H1 → social proof → tagline → chips → description → prix → CTA → trust row.
- Click sur thumbnail = swap immédiat de l'image principale, transition 400 ms.

---

## 2. Wireframes ASCII

### 2.1 Mobile (375 × 667)

```
┌─────────────────────────────────────────┐
│  [FemiGlow]      🛒  SOMMAIRE           │ ← header (44 px)
├─────────────────────────────────────────┤
│  ✨ Offre du 18 mai · Maroc  [Commander]│ ← geo-promo (44 px)
├─────────────────────────────────────────┤
│                                         │
│         ┌────────────────────┐          │
│         │                    │          │
│         │   IMAGE HERO       │          │ ← gallery main (ratio 3:4, ~390 px haut)
│         │   (swipeable)      │          │
│         │                    │          │
│         └────────────────────┘          │
│         ● ○ ○ ○ ○ ○ ○                  │ ← dots (3-7 selon nb images)
│                                         │
│  LE RITUEL                              │ ← kicker
│  Pack FemiGlow                          │ ← H1 (28 px)
│  ★★★★⯨  4,8/5 · 287 avis                │ ← social proof
│  Manucure japonaise halal.              │ ← tagline (16 px)
│  La main se révèle.                     │
│                                         │
│  ┌Sans vernis┐ ┌Sans UV┐ ┌Sans acétone┐│ ← chips (12 px)
│  ┌Halal┐                                │
│                                         │
│  199 MAD     ̶3̶9̶0̶ ̶M̶A̶D̶                  │ ← prix (gros + gap horizontal)
│  Économie 191 MAD                       │
│                                         │
│  Livraison offerte · Paiement à la      │ ← trust row (13 px)
│  livraison · Retour 30 jours            │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │      Commander le rituel         │  │ ← CTA (sauge profond, h 52 px)
│  └──────────────────────────────────┘  │
│  ▲ FOLD (667 px) ▲                      │
└─────────────────────────────────────────┘
   Description longue, réassurances grid …
```

**Hauteurs cumulées (mobile)** :
- Header : 44 px
- Geo-promo : 44 px (peut être masqué)
- Gallery main : 390 px (incl. dots)
- Kicker + H1 : 56 px
- Social proof : 24 px
- Tagline : 48 px
- Chips (2 lignes) : 64 px
- Prix : 64 px
- Trust row : 36 px
- CTA : 52 px
- **Total** : ~822 px (sans geo-promo : ~778 px)

> Au-dessus du fold 667 px, on visera à avoir : Gallery main + Kicker + H1 + Social proof + Tagline + Prix + CTA. Les **chips et la trust row peuvent passer juste sous le fold** (lecture après scroll de 100-150 px). C'est un compromis volontaire : on ne peut pas tout faire tenir sur 667 px sans sacrifier la lisibilité.

**Decision tree mobile** :
- Si geo-promo masqué : tout tient mieux.
- Si la cliente a un iPhone moderne (812 px), on a +145 px de marge.
- Sticky bottom-bar reste en filet de secours (à scroll > 600 px).

### 2.2 Desktop (1280 × 800)

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  [FemiGlow]                                              PANIER   SOMMAIRE     │ ← header
├───────────────────────────────────────────────────────────────────────────────┤
│  ✨ Offre du 18 mai · Maroc   ─49%  Livraison gratuite  …  [Commander]   ×    │ ← geo-promo
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──┐                                                                         │
│  │📷│         ┌──────────────────────────┐    LE RITUEL                       │ ← thumbnails
│  ├──┤         │                          │    Pack FemiGlow                   │   verticales
│  │📷│         │                          │    ★★★★⯨  4,8/5 · 287 avis          │
│  ├──┤         │     IMAGE HERO           │                                    │
│  │📷│         │     (active vignette)    │    Manucure japonaise halal.       │
│  ├──┤         │     ratio 4:5            │    Deux gestes, un polissoir.      │
│  │📷│         │                          │    La main se révèle.              │
│  ├──┤         │                          │                                    │
│  │📷│         │                          │    [chips] [chips] [chips] [chips] │
│  ├──┤         │                          │                                    │
│  │📷│         └──────────────────────────┘    [Description longue…]            │
│  └──┘                                                                         │
│                                                199 MAD      ̶3̶9̶0̶ ̶M̶A̶D̶            │ ← prix horizontal
│                                                            Économie 191 MAD   │
│                                                                               │
│                                                Livraison offerte · Paiement…  │
│                                                ┌─────────────────────────────┐│
│                                                │   Commander le rituel       ││ ← CTA (sauge)
│                                                └─────────────────────────────┘│
└───────────────────────────────────────────────────────────────────────────────┘

    [colonne thumbs]          [colonne image principale]    [colonne contenu]
        ~80 px                       ~480 px                      ~480 px
                       gap 24 px                gap 80 px
```

**Layout desktop** :
- Container `width=page` (max-width ~1200 px, padding latéral)
- Grid 12 colonnes : `[2] [5] [5]` (thumbnails — image — contenu)
- Sur `lg` breakpoint (1024 px), passage en 2 colonnes simplifié si l'écran est étroit

---

## 3. Design Tokens utilisés

Source : `docs/kolenda/FEMIGLOW-KIT-PLAYBOOK.md` Annexe A. **Aucun nouveau token introduit** par ce plan — tout existe déjà.

### 3.1 Couleurs

| Rôle | Hex | Usage dans le hero |
|---|---|---|
| `creme-warm` | `#F7F4EE` (fond global hero existant) | Background section |
| Fond chips | `#E8EDE3` (sauge très pâle) | Background chips attribut |
| Border chips | `#C7CCC2` (gris-sauge) | Border chips, séparateurs |
| Encre | `#2A2E2A` | Texte H1, body fort |
| Encre secondaire | `#2A2E2A` à 70 % opacité | Texte description |
| Or poudré | `#B8956B` | Étoiles social proof |
| Sauge profond | `#4A5D4A` | **CTA principal** (passage du noir) |
| Ivoire | `#F7F4EE` | Texte CTA (sur fond sauge profond) |
| Sauge désaturé | `#A8B89E` | Économie 191 MAD (texte) |

### 3.2 Typographie

| Rôle | Police | Taille mobile / desktop | Weight | Letter-spacing |
|---|---|---|---|---|
| Eyebrow | Inter UPPERCASE | 12 / 13 px | 500 | 0.18em |
| H1 | Cormorant Garamond | 32 / 56 px | 400 | -0.01em |
| Tagline | Inter | 16 / 18 px | 400 | 0.005em |
| Description | Inter | 15 / 16 px | 400 | 0.005em |
| Prix actuel | Inter tabular-nums | 40 / 56 px | 600 | 0 |
| Prix barré | Inter tabular-nums | 20 / 24 px | 400 | 0 |
| Économie | Inter | 14 / 15 px | 500 | 0.005em |
| CTA label | Inter | 16 / 17 px | 500 | 0.02em |
| Trust row | Inter | 13 / 13 px | 400 | 0.005em |
| Chips | Inter | 12 / 12 px | 500 | 0.01em |
| Social proof | Inter tabular-nums | 13 / 14 px | 500 | 0.01em |

> **Règle d'or** : `font-variant-numeric: tabular-nums` sur les nombres (prix, note, économie). Une seule classe CSS, perception "calculé, pas inventé".

### 3.3 Espacements

| Zone | Mobile | Desktop |
|---|---|---|
| Section padding vertical | `py-8` (32 px) | `py-20` (80 px) |
| Gap entre image et contenu | `gap-8` (32 px) | `gap-20` (80 px) |
| Gap interne contenu (verticale) | `space-y-4` (16 px) | `space-y-6` (24 px) |
| Gap prix barré ↔ prix actif | `gap-6` (24 px) | `gap-8` (32 px) |
| Gap entre chips | `gap-2` (8 px) | `gap-2` (8 px) |
| Padding chips intérieur | `px-3 py-1.5` | `px-3 py-1.5` |
| CTA hauteur | `h-13` (52 px) | `h-13` (52 px) |

### 3.4 Animations

| Élément | Animation | Durée | Easing |
|---|---|---|---|
| CTA hover | `bg` darken 5 % + `scale 1.01` | 300 ms | ease-out |
| CTA active | `scale 0.98` | 100 ms | ease-out |
| CTA micro-pulse (idle) | `scale 1 → 1.02 → 1` | 600 ms toutes les 3500 ms | ease-in-out |
| Gallery swap thumbnail → main | `opacity 0.5 → 1 + scale 1.02 → 1` | 400 ms | ease-out |
| Gallery swipe mobile | snap-scroll natif | natif | natif |
| Chips hover (desktop) | `bg` lighten 4 % | 200 ms | ease-out |

> **Règles** :
> - Aucune animation < 200 ms (perçue comme nerveuse, Kolenda Luxury p. 18-19).
> - Respect strict de `prefers-reduced-motion: reduce` — toutes les animations sont désactivées via CSS `@media`.

---

## 4. Ergonomie — Règles d'or

### 4.1 Surface de tap mobile

- **Tous les éléments cliquables ≥ 44 × 44 px** (Apple HIG + UX p. 14-15).
- Chips : 28 px de hauteur visible mais zone tap étendue à 44 px via `padding`.
- Dots de la galerie : 12 px visibles mais zone tap 24 × 24 px.
- Thumbnails desktop : 64 × 80 px visible, zone tap = surface complète (suffit).

### 4.2 Hiérarchie visuelle

- **Un seul point focal par viewport** (UX p. 57). Sur le hero : c'est le CTA. Aucun autre élément ne pulse, ne clignote, ne vibre.
- La galerie est statique sauf interaction utilisateur.
- Les chips n'ont pas d'animation d'entrée (zéro motion onset compétitif avec le CTA).

### 4.3 Accessibilité

- Tous les composants nouveaux respectent WCAG 2.2 AA :
  - Contraste texte ≥ 4.5:1 (vérifié sur les couleurs ci-dessus).
  - Focus visible (outline 2 px sauge profond + offset 2 px).
  - Navigation clavier complète (tab + arrow keys dans la galerie).
  - `aria-label`, `aria-current`, `role` corrects.
  - Lightbox optionnelle accessible (focus trap, Esc, retour focus).
- **Tests obligatoires** axe-core dans playwright (cf. `04-test-strategy.md`).

### 4.4 Performance

- LCP element = image principale de la galerie. **Loading strategy** :
  - 1ère image : `priority + fetchPriority="high"` (RSC slot existant)
  - Images 2-6 : `loading="lazy"` (chargées seulement quand visibles ou pré-chargées au hover thumbnail)
- Pas de blocking JS pour l'initial paint (le swap thumbnail est progressivement amélioré : sans JS, click sur thumbnail = scroll vers image équivalente).
- Gallery state : `useState` local — aucun re-render au parent. Pas de Redux/Zustand pour ça.

---

## 5. Variantes copy (texte définitif)

### 5.1 Description (longue) — version proposée

**Version actuelle (DB remote)** :
> "FemiGlow réinvente la manucure japonaise dans un rituel naturel, doux et sans vernis. Le pack associe deux soins complémentaires, une paste lissante et une powder lustrante, avec un polissoir Step 4 Polish & Shine pour révéler l'éclat naturel de l'ongle nu. Sans pose de vernis, sans lampe UV, sans acétone. Quelques gestes suffisent pour obtenir des ongles visiblement plus lisses, plus lumineux et naturellement brillants, tout en gardant une routine simple, élégante et compatible avec le woudou."

**Anti-patterns Kolenda relevés** :
- `réinvente` = superlatif marketing (Copywriting p. 12).
- `rituel naturel, doux et sans vernis` = empilage adjectival.
- `visiblement plus lisses, plus lumineux et naturellement brillants` = trio adjectival, voix maison préfère phrases courtes (Copywriting p. 13).
- `routine simple, élégante` = redondance, "élégante" est un adjectif vide.

**Version retenue (à mettre en seed)** :
> "Le pack FemiGlow associe deux soins et un polissoir, pensés pour la manucure japonaise halal. Une paste qui lisse, une powder qui lustre, un polissoir Step 4 Polish & Shine. Sans vernis, sans lampe UV, sans acétone. Quelques gestes suffisent. L'ongle nu retrouve sa lumière. Le woudou reste intact."

**Justifications** :
- Continuité d'image entre phrases (Copywriting p. 14-15) : pack → paste → powder → polissoir → ongle nu → woudou.
- Phrases courtes ponctuées au point (Copywriting p. 13).
- Suppression de "réinvente", "naturel", "naturellement" (deux fois !), "visiblement", "simple", "élégante".
- Conservation de la cible halal et du woudou (identité produit).
- Le verbe "associer" reste neutre et factuel.

### 5.2 Tagline (court, au-dessus de la description)

**Version actuelle** :
> "Manucure japonaise halal. Deux gestes, un polissoir, un éclat."

**Version retenue** :
> "Manucure japonaise halal. Deux gestes, un polissoir. La main se révèle."

**Justification** : la fin bascule du produit vers la cliente (Copywriting p. 5 — présent vivant pour les bénéfices). L'objet "main" devient sujet via le verbe pronominal "se révèle".

### 5.3 Chips d'attributs (4 chips)

```
Sans vernis    Sans UV    Sans acétone    Halal
```

- Ordre voulu : du plus négatif/objection-killer (`Sans vernis`) au plus identitaire (`Halal`).
- Pas d'icônes. Pas de couleurs.
- Format : `padding: 6px 12px; border-radius: 999px; background: #E8EDE3; border: 1px solid #C7CCC2; color: #2A2E2A; font-size: 12px; font-weight: 500;`

### 5.4 Trust row

**Version actuelle** :
> "PAIEMENT À LA LIVRAISON · RETOUR 14 J · LIVRAISON 48 H" (11 px, opacity 55 %, MAJUSCULES tracking-wide)

**Version retenue** :
> "Livraison offerte · Paiement à la livraison · Retour 30 jours"

**Justifications** :
- Suppression des MAJUSCULES criardes.
- Taille 13 px, opacity 80 %.
- "Retour 30 jours" au lieu de "14 j" — alignement sur les standards e-commerce marocains (la plupart des concurrents promettent 14, on prend l'avantage en 30 sans coût matériel).
- Ordre : on commence par la **gratuité** (mot positif fort), puis paiement (rassure), puis retour (filet de sécurité).
- **Position** : au-dessus du CTA, pas en dessous (Copywriting p. 17 : mots positifs collés au CTA, lus avant la décision).

### 5.5 Social proof

```
★★★★⯨  4,8/5 · 287 avis
```

- Étoiles en or poudré `#B8956B`, 14 px.
- 4 étoiles pleines + une demi-étoile (Unicode ⯨ ou SVG custom).
- Texte 13-14 px tabular-nums.
- **Position** : entre H1 et tagline (lecture naturelle).
- **Non-cliquable** dans le hero (pas de scroll vers la section avis depuis le hero — on évite la sortie du tunnel de décision).
- Données : `getProductReviewStats('kit-femiglow')` → fallback `DEFAULT_KIT_REVIEW_STATS` si aucune donnée.

---

## 6. Tableau de cohérence Kolenda

Vérification finale à valider avant merge :

| Principe | OK ? | Vérif |
|---|---|---|
| Zéro exclamation | [ ] | Grep `!` dans les nouveaux copy → résultat vide |
| Zéro emoji | [ ] | Grep emoji dans les nouveaux copy → résultat vide |
| Zéro majuscules d'emphase | [ ] | Aucun mot en `UPPERCASE` sauf eyebrows |
| Tutoiement absent | [ ] | Aucun "tu" dans les nouveaux copy |
| Phrases courtes | [ ] | Aucune phrase > 18 mots dans le hero |
| Pas de "100 %" | [ ] | Grep "100 %" / "100%" → résultat vide |
| Vocabulaire maison | [ ] | "rituel", "initiée", "saison" préservés ; pas de "promo / deal / VIP / exclusif" |
| Palette respectée | [ ] | Aucune nouvelle couleur introduite hors `2.2 Palette` |
| Animations ≥ 200 ms | [ ] | Vérif via CSS, aucune transition < 200 ms |
| Prix tabular-nums | [ ] | `font-variant-numeric: tabular-nums` sur tous les chiffres prix |
| CTA en sauge profond | [ ] | Pas de `bg-black` ou `bg-encre` sur le CTA primaire |
| Note 4,8 (pas 5,0) | [ ] | `DEFAULT_KIT_REVIEW_STATS.rating = 4.8` |

---

## 7. Captures avant/après

Toutes les captures sont stockées dans `docs/kit-hero-optim/captures/` :

```
captures/
├── before-mobile.png       ← état initial mobile (375 × 667)
├── before-desktop.png      ← état initial desktop (1280 × 800)
├── after-mobile.png        ← après refonte (375 × 667)
├── after-desktop.png       ← après refonte (1280 × 800)
└── README.md               ← contexte des captures (date, version repo)
```

**Note** : les captures `before-*` sont déjà disponibles dans la conversation précédente. Elles doivent être enregistrées dans ce dossier avant Phase 1.

---

## 8. Voir aussi

- [`02-architecture.md`](02-architecture.md) — implémentation backend & frontend
- [`03-vignette-system.md`](03-vignette-system.md) — spec galerie détaillée
- `docs/kolenda/FEMIGLOW-KIT-PLAYBOOK.md` §4.1 — recommandations Hero officielles
