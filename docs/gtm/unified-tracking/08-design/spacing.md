# Spacing system

## 1. Échelle de base

Échelle 4pt (rythme `0.25rem` = 4px), alignée Tailwind.

| Token | rem | px | Usage |
|---|---|---|---|
| `space-0` | 0 | 0 | Reset |
| `space-1` | 0.25 | 4 | Gap minimal, padding micro |
| `space-2` | 0.5 | 8 | Gap entre éléments inline |
| `space-3` | 0.75 | 12 | Padding compact |
| `space-4` | 1 | 16 | Padding standard, gap entre champs |
| `space-5` | 1.25 | 20 | (rare) |
| `space-6` | 1.5 | 24 | Padding cards, gap sections |
| `space-8` | 2 | 32 | Gap sections principales |
| `space-10` | 2.5 | 40 | Gap blocks aérés |
| `space-12` | 3 | 48 | Gap entre H1 et contenu |
| `space-16` | 4 | 64 | Gap entre pages logiques |

## 2. Densité de l'interface

3 modes de densité :

| Mode | Cible | Compact | Comfortable |
|---|---|---|---|
| **Standard** | Amal (wizard) | Card padding `p-6`, row gap `gap-4` | Per défaut |
| **Compact** | Younes (expert) | Card padding `p-4`, row gap `gap-2` | Plus d'info à l'écran |
| **Comfortable** | Aïcha (lecture) | Card padding `p-8`, row gap `gap-6` | Aéré, lecture confort |

Toggle entre Standard / Compact dispo via menu utilisateur (préf stockée localStorage). Comfortable est en réflexion (pas en MVP).

## 3. Paddings standards

| Composant | Padding |
|---|---|
| `Button (h-10)` | `px-4` (icon-only) / `px-6` (avec label) |
| `Button (h-9)` | `px-3` (ghost) |
| `Input (h-10)` | `px-3 py-2` |
| `Card` | `p-6` (standard), `p-4` (compact) |
| `Section header` | `pb-4 border-b` |
| `Modal` | `p-8` (header `pb-6`, body `py-4`, footer `pt-6`) |
| `Toast` | `px-4 py-3` |
| `Table cell` | `px-4 py-3` (standard) / `px-3 py-2` (compact) |
| `Badge` | `px-2 py-0.5` (text-xs) / `px-3 py-1` (text-sm) |
| `Wizard step content` | `p-8` (centré, max-width `max-w-2xl`) |

## 4. Gaps standards

| Contexte | Gap |
|---|---|
| Champs d'un même groupe (label + input + helper) | `gap-1` |
| Champs entre eux dans une form | `gap-4` |
| Cards entre elles dans une grille | `gap-6` |
| Sections principales d'une page | `gap-8` |
| Boutons dans un footer modal | `gap-3` |
| Items dans une liste verticale | `gap-2` |
| Icone + label dans un bouton | `gap-2` |
| Stepper steps | `gap-2` (avec ligne de connexion) |

## 5. Breakpoints

| Token | Largeur | Cible |
|---|---|---|
| `sm` | 640px | Tablette portrait (rare en admin) |
| `md` | 768px | Tablette landscape, petit laptop |
| `lg` | 1024px | Laptop standard (cible primaire admin) |
| `xl` | 1280px | Desktop |
| `2xl` | 1536px | Grand écran |

Layout admin tracking :
- **< md** : layout fallback 1 colonne (rare, mais doit fonctionner).
- **md–lg** : layout 2 colonnes maximum (sidebar + main).
- **lg–xl** : layout cible (sidebar 240px + main + optionnel preview 320px).
- **≥ xl** : layout expert 3 colonnes (sidebar 240px + main + preview 380px).

## 6. Largeurs max

| Contexte | Max-width |
|---|---|
| Page admin (sans sidebar) | `max-w-7xl` (1280px) |
| Wizard step content | `max-w-2xl` (672px) |
| Modal standard | `max-w-md` (448px) |
| Modal large (preview JSON) | `max-w-4xl` (896px) |
| Toast | `max-w-sm` (384px) |
| Helper text sous un input | Largeur de l'input |
| Tooltip | `max-w-xs` (320px) |

## 7. Hauteurs standards

| Composant | Hauteur |
|---|---|
| `Button primary/secondary` | `h-10` (40px) |
| `Button ghost / icon-only` | `h-9` (36px) |
| `Button compact (table actions)` | `h-8` (32px) |
| `Input text/number/email` | `h-10` |
| `Input compact` | `h-9` |
| `Select` | `h-10` |
| `Textarea` | min `h-24` (96px), auto-grow |
| `Card` | auto (contenu) |
| `Page header (titre + actions)` | `h-16` (64px) |
| `Toast` | `h-auto` (1–3 lignes max) |
| `Modal max height` | `max-h-[90vh]` |

## 8. Cohérence avec FemiGlow public

Les paddings/gaps tracking respectent l'échelle 4pt du public-facing, mais sont **plus denses** (admin = densité info, public = respiration marketing). Exemple :
- Public hero : `py-24`
- Admin page header : `py-6`

Cette différence est volontaire et documentée.

## 9. Spacing dans les diagrammes ASCII (documentation)

Les diagrammes ASCII de cette documentation utilisent :
- 2 espaces pour indentation logique
- 4 espaces pour séparer colonnes
- Bordures box-drawing : `┌ ─ ┐ │ └ ┘ ├ ┤ ┬ ┴ ┼`

Sont vérifiés visuellement en font mono uniquement.
