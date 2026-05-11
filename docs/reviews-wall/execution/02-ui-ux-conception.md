# 02 — UI / UX conception : design system spécifique au wall

Ce document définit le **vocabulaire visuel** et les **règles d'interaction** propres au composant « Rituels partagés ». Il complète le design system global du projet (`docs/audit/04-charte-architecture.md`) en spécifiant ce qui est ajouté ou précisé pour le wall.

## 1. Posture esthétique

Le wall est **un cahier ouvert**, pas un panneau d'évaluation. Chaque carte est une page d'un cahier que la maison tient. Trois lignes directrices :

1. **Lisibilité avant ornement** — les citations sont l'élément principal ; tout le reste les sert.
2. **Sérénité avant intensité** — pas de couleurs vives, pas d'icônes saturées, pas de mouvement répété.
3. **Densité maîtrisée** — beaucoup d'air autour de chaque carte ; jamais d'effet « mur de briques ».

## 2. Identité visuelle des éléments

### 2.1 Carte de témoignage

```
┌──────────────────────────────────────────────────┐
│                                                  │
│    ┌────────┐                                    │  ← padding 20 px
│    │        │   « Trois mois et l'ongle a        │
│    │ photo  │     retrouvé sa nervure.           │
│    │  80×80 │     J'ai cessé de le forcer. »     │  ← Cormorant Italic 17 pt
│    │        │                                    │
│    └────────┘                                    │
│                                                  │
│    — Amal, Rabat                                 │  ← Inter 12 pt brume
│    Initiée depuis février 2026                   │
│                                                  │
│    ongles plus lisses · plus de casse            │  ← Inter 12 pt sauge-dark
│                                                  │
│                                    Reviendrait   │  ← Inter SemiBold 9 pt
│                                    ─────         │     kicker, sauge-dark
└──────────────────────────────────────────────────┘
   fond crème pur · bordure 1,5 px sauge-pale · radius 0
```

### 2.2 Chip de filtre

```
       8 px               8 px
     ┌──┐               ┌──┐
     │  │               │  │
     │  ●  Tous         │  │   Avec photos
     │  │               │  │
     └──┘               └──┘
   sauge fond         crème fond
   sauge-dark         sauge-pale
   bordure 1,5 px     bordure 1,5 px
   texte encre        texte encre
```

Hauteur : 32 px nominal. Touch-target via padding clic 44 × 44 px.

### 2.3 Fleuron

Variante A (signature, en haut du drawer) :

```
   ╌╌╌╌◆╌╌╌╌
```

- Filets 1 px champagne `#C8A876`.
- Largeur 80–96 px.
- Hauteur 12–14 px.
- Margin top/bottom 24 px.

Variante B (séparateur dans la synthèse) :

```
   ●
```

Point central 3 × 3 px champagne entre deux filets de 24 px.

### 2.4 Bouton CTA primaire

```
┌──────────────────────────────────────────────────┐
│                                                  │
│           Recevoir le pack — 199 dh              │  ← Inter Medium 13 pt
│                                                  │     texte crème sur fond encre
└──────────────────────────────────────────────────┘
         Livraison offerte au Maroc                 ← Inter Regular 12 pt brume
```

- Pleine largeur du drawer footer.
- Hauteur 56 px.
- Padding interne 12 × 24 px.
- Radius 0 (cohérent charte).
- Hover : fond encre-claire (`#4A4844`).
- Active : `transform: scale(0.98)` 100 ms.

### 2.5 Bouton secondaire (lien texte)

```
Partager mon rituel →
```

- Inter Medium 13 pt encre.
- Underline subtle on hover : `box-shadow: 0 1px 0 currentColor`.
- Pas de fond.
- Padding click 44 × 44 px via line-height + padding vertical.

## 3. Hiérarchie typographique du wall

```
KICKER                              ← Inter SemiBold 9 pt, tracking 0.15em, uppercase, sauge-dark
Titre du wall                       ← Cormorant Light 28 pt, encre
─────                               ← Fleuron champagne
Synthèse première ligne             ← Cormorant Italic 18 pt, encre
Synthèse seconde ligne              ← Cormorant Italic 18 pt, encre
tag1 · tag2 · tag3                  ← Inter Regular 12 pt, brume
─────
Chip                                ← Inter Medium 13 pt, encre
─────
« Citation »                        ← Cormorant Italic 17 pt, encre, line-height 1.6
— Signature                         ← Inter Regular 12 pt, brume
Initiée depuis [date]               ← Inter Regular 12 pt, brume
tag · tag                           ← Inter Regular 12 pt, sauge-dark
RAGE                                ← (jamais !)
```

## 4. États visuels par composant

### 4.1 Carte témoignage — 6 états

| État | Trigger | Style |
| --- | --- | --- |
| `default` | Affichage normal | Fond crème pure, bordure 1,5 px sauge-pale |
| `hover` | Souris au-dessus (desktop only) | translateY -3 px, shadow `0 1px 2px rgba(44,42,40,0.06)`, 200 ms `out-soft` |
| `focus-visible` | Focus clavier | Outline 2 px encre, offset 4 px |
| `active` | Click en cours | Pas de changement (focus prend le relais) |
| `loaded-image` | Photo en cours de chargement | Skeleton sauge-pale `#E8EFE7` aux dimensions exactes |
| `error-image` | Photo en erreur 404 | Photo retirée, carte rendue sans photo (graceful degradation) |

### 4.2 Chip filtre — 4 états

| État | Style |
| --- | --- |
| `default` | Fond crème pure, bordure 1,5 px sauge-pale, texte encre |
| `hover` | Fond sauge-pale, bordure sauge-dark, 150 ms |
| `active` (`aria-pressed="true"`) | Fond sauge, bordure sauge-dark, texte encre |
| `disabled` | Opacity 0.4, cursor not-allowed, pas de hover |

### 4.3 Bouton CTA primaire — 4 états

| État | Style |
| --- | --- |
| `default` | Fond encre `#2C2A28`, texte crème |
| `hover` | Fond encre-claire `#4A4844`, 200 ms |
| `active` | scale(0.98), 100 ms |
| `disabled` (rare) | Opacity 0.4 |

### 4.4 Drawer — 5 états

| État | Comportement |
| --- | --- |
| `closed` | DOM démonté (dynamic import non chargé tant que pas cliqué) |
| `opening` | Animation translateX/Y, overlay opacity, 220 ms |
| `open` | Contenu visible, focus trap actif, `inert` sur `<main>` |
| `loading` | Skeleton liste 12 cartes |
| `closing` | Animation reverse, 180 ms |

## 5. Microinteractions (catalogue)

### 5.1 Apparition de la liste

Au chargement initial du drawer, **toutes les cartes apparaissent simultanément** (pas de stagger) après le skeleton — économie de motion, lecture immédiate.

Au chargement « load more », **les 12 nouvelles cartes apparaissent avec stagger 50 ms** (séquentiel doux). Cela attire l'œil sur les nouveautés.

### 5.2 Bascule de filtre

```
[State A : Tous]                         [State B : Avec photos]
       │                                          ▲
       │       1. Click chip « Avec photos »       │
       │       2. List fade out 200 ms             │
       │       3. Skeleton 200 ms                  │
       │       4. List fade in 200 ms              │
       └──────────────────────────────────────────┘
```

Pas de translation horizontale — fade seulement. Évite la désorientation.

### 5.3 Hover de la photo dans le module compact

Sur desktop, hover photo :

- Image : `scale(1.02)` 400 ms `out-soft`.
- Card : translateY -3 px (cf. state hover).

Effet « la photo respire un peu », assumé.

### 5.4 Hover sur le badge « Reviendrait »

Aucun effet hover. Le badge est passif, pas interactif.

### 5.5 Wizard — entrée d'une étape

```
[Étape précédente sort]                   [Nouvelle étape entre]
  │                                              ▲
  │ opacity 1 → 0                                │ opacity 0 → 1
  │ translateX 0 → -16 px                        │ translateX 16 px → 0
  │ 180 ms in-quiet                              │ 280 ms in-out-silk
  │                                              │ delay 100 ms
  └──────────────────────────────────────────────┘
```

Lors d'un retour (← Retour), la direction du translateX est inversée.

### 5.6 Confirmation finale du wizard

Cf. `↗ 13-animations-motion.md § 7.3`. Séquence lente assumée de ~2,4 sec — la confirmation est une **fin de lettre**, pas un toast.

## 6. Comportement responsive

### 6.1 Mobile (< 768 px)

- **Module compact** : grille 1 colonne, swipe horizontal sur les 3 cards (snap-x), indicateurs 3 points en bas.
- **Drawer** : bottom-sheet avec drag handle, snap points 60 vh et 92 vh.
- **Chips filtres** : scroll horizontal avec mask gradient suggérant la suite.
- **Wizard** : plein écran (drawer en mode wizard).
- **Lightbox** : plein écran avec swipe pour naviguer.

### 6.2 Tablet (768–1279 px)

- **Module compact** : grille 2 colonnes, 3ᵉ carte en pleine largeur dessous.
- **Drawer** : 420 px largeur, ancré à droite.
- **Wizard** : à l'intérieur du drawer.

### 6.3 Desktop (≥ 1280 px)

- **Module compact** : grille 3 colonnes, gap 24 px.
- **Drawer** : 480 px largeur, ancré à droite.
- **Wizard** : à l'intérieur du drawer.

### 6.4 Desktop large (≥ 1920 px)

- **Drawer** : 520 px largeur max.

## 7. Iconographie — règles strictes

Le wall **n'utilise aucune icône traditionnelle** (pas d'étoile, pas de cœur, pas de bulle de chat, pas de pouce levé, pas d'emoji).

Les seuls éléments graphiques permis :

| Élément | Usage |
| --- | --- |
| Fleuron champagne | Séparateur signature, en-tête de section éditoriale |
| Filet 1 px sauge-pale | Bordures de cartes, chips |
| Flèche `→` typographique | Liens (Inter caractère `→` U+2192), pas SVG |
| Croix de fermeture | SVG simple 1 px stroke encre, 24 × 24 px |
| Chevrons lightbox `←` `→` | Idem, SVG 1 px stroke crème sur fond noir |
| Drag handle bottom-sheet | Rectangle 36 × 4 px crème-pure radius 2 px |

Pas d'icône Material Design, Heroicons, Phosphor, etc. — sauf éventuellement croix et chevrons en SVG inline custom.

## 8. Photographie — direction artistique

Cf. `↗ docs/images/values/reviews/` pour les 12 images de référence.

| Élément | Règle |
| --- | --- |
| Sujet principal | Mains, ongles nus, geste, table de soin, pots du pack |
| Visage | Jamais frontal, partiel acceptable (sourire, lèvres, menton, hijab) |
| Cadrage | Carré 1:1 ou portrait 4:5, jamais paysage |
| Fond | Marbre cream, table en bois, tissu cosy, salle de bain claire |
| Lumière | Naturelle, douce, latérale (jamais flash direct, jamais contre-jour dur) |
| Couleurs dominantes | Crème, sauge, rose poudré, bleu ciel polissoir |
| Bijoux | Discrets (collier fin, bracelet fin) |
| Diversité | Carnations variées + hijab représenté |

Les photos uploadées par les initiées via le wizard doivent **s'aligner sur cette direction**. La vision ML faces + la modération humaine garantissent l'absence de visages frontaux.

## 9. Voix appliquée au wall

| Composant | Voix attendue |
| --- | --- |
| Synthèse du wall | Factuelle, lente : « 26 initiées ont partagé. 24 reprendraient le rituel. » |
| Carte citation | Préservée telle quelle (l'initiée écrit) |
| Footer wall | Suggestif : « Maintenant que vous savez. » |
| Wizard étape 1 placeholder | Invitant : « Décrivez ce que vous avez remarqué. Cinquante mots suffisent. » |
| Toast emoji retiré | Doux : « Les émoticônes ne sont pas dans notre grammaire. » |
| Confirmation | Maternelle : « La maison reçoit votre rituel. » |
| Erreur soumission | Hospitalière : « La maison n'a pas pu recevoir. Essayez à nouveau ou écrivez à info@femiglow-maroc.com. » |
| Empty state | Invitante : « La maison écoute. Soyez la première à partager. » |
| Admin queue | Fonctionnelle : « 3 témoignages en attente. » |

Catalogue exhaustif : `↗ 12-microcopy-voix.md`.

## 10. Tokens de design appliqués au wall

Cf. `↗ annexes/decisions-design-tokens.md` pour le catalogue complet. Rappel des tokens les plus critiques :

```css
--ritual-card-bg: var(--color-creme-pure);
--ritual-card-border: 1.5px solid var(--color-sauge-pale);
--ritual-chip-bg-active: var(--color-sauge);
--ritual-drawer-overlay: rgba(44, 42, 40, 0.30);
--ritual-lightbox-overlay: rgba(0, 0, 0, 0.95);
--ritual-ease-out-soft: cubic-bezier(0.16, 1, 0.3, 1);
```

## 11. Storybook coverage

Stories à créer dans `apps/web/src/components/sections/rituals/__stories__/` :

| Story | Variantes |
| --- | --- |
| `RitualCard` | compact / default, avec/sans photo, anonyme, signal oui/hesite/non |
| `RitualsModule` | 3 featured, fallback récents, empty state |
| `RitualsWallDrawer` | desktop, mobile bottom sheet, loading, empty, error |
| `RitualsWallFilters` | tous chips, chip actif différent |
| `RitualsWallLoadMore` | états default / loading / end / error |
| `RitualPhotoLightbox` | une photo, plusieurs photos avec nav |
| `RitualsWizard` | étape 1 / 2 / 3 / confirmation, avec brouillon repris |

Chaque story rend en isolation avec `@storybook/test-runner` qui exécute axe-core en background.

## 12. Synthèse — règles d'or UI/UX

1. **Un seul accent par écran** : la sauge active sur la chip courante, jamais deux choses qui « crient » en même temps.
2. **Pas de couleur sémantique** : pas de vert succès, pas de rouge erreur — utiliser les variations sauge / encre / rouge-feutre sobres.
3. **Cormorant Italic pour les citations**, Inter pour les métadonnées, jamais l'inverse.
4. **Bordure 1,5 px sauge-pale** (corrigée pour contraste WCAG) sur tous les éléments tabulés.
5. **Touch target 44 px partout**, même si visuellement plus petit (via padding).
6. **Fleuron champagne réservé aux séparateurs éditoriaux**, pas comme décoration libre.
7. **Aucun mouvement répété** : pas de pulse, pas de blink, pas de shake.
8. **`prefers-reduced-motion` respecté absolument** : toutes les durées ≤ 80 ms si activé.
9. **Pas d'icône standard** : seuls fleuron, filets, croix, chevrons, drag handle, flèche `→` typographique.
10. **La photo n'est jamais obligatoire** mais toujours valorisée par la maquette.
