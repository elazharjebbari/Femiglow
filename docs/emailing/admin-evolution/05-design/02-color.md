# Color system

## Philosophie

Palette sobre, restreinte. Pas de couleurs vives sauf signaling
(success/warning/danger).

L'accent principal de FemiGlow est un vert sauge (sage), apaisant et
B2C-cohérent.

## Palette

### Neutrals (stone)

```
stone-50   #FAFAF9   bg canvas
stone-100  #F5F5F4   surface alt, code bg
stone-200  #E7E5E4   borders
stone-300  #D6D3D1   borders forts, dividers
stone-400  #A8A29E   text disabled
stone-500  #78716C   text muted
stone-600  #57534E   ?
stone-700  #44403C   text secondaire
stone-800  #292524   ?
stone-900  #1C1917   text primaire
```

### Accent (sage — extension Tailwind)

```
sage-50    #F2F5F2
sage-100   #E2E9E5   soft bg (chips actifs)
sage-200   #C4D3CB
sage-300   #9FB6AC
sage-400   #7C9A8A
sage-500   #5F7F71   focus ring
sage-600   #4D6A5E   accent default (buttons primaires, liens)
sage-700   #3F564C   hover state
sage-800   #34453E
sage-900   #2C3934
```

### Semantic

```
emerald-600 (#059669)   success — text + icon
emerald-50  (#ECFDF5)   soft bg

amber-500 (#F59E0B)     warning
amber-50  (#FFFBEB)     soft bg

red-600 (#DC2626)       danger
red-50  (#FEF2F2)       soft bg

sky-600 (#0284C7)       info
sky-50  (#F0F9FF)       soft bg
```

## Usage par contexte

### Boutons

| Type | Background | Text | Hover bg |
|---|---|---|---|
| Primary | sage-600 | white | sage-700 |
| Secondary | white | stone-700 | stone-50 (border stone-300) |
| Danger | red-600 | white | red-700 |
| Ghost | transparent | stone-700 | stone-100 |

### Badges (status)

| Status | bg | text |
|---|---|---|
| pending | stone-100 | stone-700 |
| sending | sky-50 | sky-700 |
| sent | sky-50 | sky-800 |
| delivered | emerald-50 | emerald-700 |
| failed | red-50 | red-700 |
| bounced_soft | amber-50 | amber-700 |
| bounced_hard | red-50 | red-700 |
| suppressed | stone-100 (strikethrough) | stone-500 |
| active (auto) | emerald-50 | emerald-700 |
| draft | stone-100 | stone-700 |
| running | sky-50 | sky-700 |

### Borders

| Cas | Couleur |
|---|---|
| Default | stone-200 |
| Hover/focus | sage-500 |
| Error | red-500 |
| Strong (divider section) | stone-300 |

### Focus ring

```css
:focus-visible {
  outline: 2px solid sage-500;
  outline-offset: 2px;
}
```

## Combinaisons à éviter

- ✗ Texte stone-500 sur stone-100 (contraste 3.6:1 — sous AA)
- ✗ sage-300 ou plus clair pour du texte body
- ✗ Plus de 3 couleurs accents sur un même écran

## Combinaisons éprouvées

- ✓ Card : white bg + stone-200 border + stone-900 text
- ✓ Badge active : emerald-50 bg + emerald-700 text
- ✓ KPI alert : red-50 bg + red-700 text + red-600 border

## Dark mode ?

Pas en V1. Si V2, suivre la map :
- Inverse stone-* : stone-50 ↔ stone-900, etc.
- Garder l'accent sage à équivalent
- Tester contraste sur les badges

## Contraste WCAG

Vérifier toutes les combos avec :
- https://webaim.org/resources/contrastchecker/
- ou axe-core en CI

Minimum AA :
- Body : 4.5:1
- Large (≥18px) : 3:1
- Bordures focus : 3:1 vs bg
