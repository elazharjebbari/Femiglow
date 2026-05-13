# 50.2 — Design tokens

Cohérence visuelle avec l'admin FemiGlow existant (palette `stone`, accent `[#A8C4A6]`).

## Couleurs

| Token | Hex | Usage |
|---|---|---|
| `--fg-active` | `#3F5B41` (vert FemiGlow) | Badge "ACTIVE", bouton primaire |
| `--fg-active-bg` | `#A8C4A6/15` | Background subtil de la zone active |
| `--fg-draft` | `#2563eb` (bleu) | Badge "DRAFT" |
| `--fg-archived` | `#78716c` (stone-500) | Badge "archived" |
| `--fg-deleted` | `#dc2626` (red-600) | Badge "supprimée" |
| `--fg-default` | `#ca8a04` (yellow-600) | Badge "DEFAULT" (gold) |
| `--fg-success` | `#16a34a` | Toast success, diff +ajout |
| `--fg-warning` | `#d97706` | Toast warning, diff modifié |
| `--fg-danger` | `#dc2626` | Toast erreur, diff supprimé, bouton destructif |
| `--fg-info` | `#0ea5e9` | Toast info, bandeau info |
| `--fg-text` | `#1c1917` (stone-900) | Texte principal |
| `--fg-text-secondary` | `#57534e` (stone-600) | Texte secondaire |
| `--fg-text-tertiary` | `#a8a29e` (stone-400) | Hints, placeholders |
| `--fg-border` | `#e7e5e4` (stone-200) | Borders |
| `--fg-bg` | `#fafaf9` (stone-50) | Background pages |
| `--fg-bg-elev1` | `#ffffff` | Background cards, modales |

## Typographie

| Token | Valeur | Usage |
|---|---|---|
| `--fg-font-sans` | system-ui, sans-serif | Tout |
| `--fg-font-mono` | "JetBrains Mono", monospace | mappedName, sha256, JSON preview |
| `--fg-text-xs` | 11px | Notes, hints, badges |
| `--fg-text-sm` | 13-14px | Body |
| `--fg-text-base` | 14-15px | Inputs |
| `--fg-text-lg` | 18px | Titres de section |
| `--fg-text-xl` | 20-22px | Title de page |
| `--fg-leading-tight` | 1.3 | Titres |
| `--fg-leading-normal` | 1.5 | Body |

## Espacement

| Token | Valeur | Usage |
|---|---|---|
| `--fg-spacing-1` | 4px | Padding tight cellule |
| `--fg-spacing-2` | 8px | Gap entre éléments inline |
| `--fg-spacing-3` | 12px | Padding boutons |
| `--fg-spacing-4` | 16px | Padding cards |
| `--fg-spacing-6` | 24px | Padding modales |
| `--fg-spacing-8` | 32px | Section gaps |

## Bordures et radius

| Token | Valeur | Usage |
|---|---|---|
| `--fg-radius-sm` | 4px | Pastilles, badges |
| `--fg-radius-md` | 6-8px | Buttons, inputs, cards |
| `--fg-radius-lg` | 12px | Modales |
| `--fg-shadow-sm` | `0 1px 2px rgb(0 0 0 / 0.05)` | Cards subtils |
| `--fg-shadow-md` | `0 4px 6px -1px rgb(0 0 0 / 0.1)` | Modales |

## Spécifique au module

### Matrice — couleurs cellules

| State | Background | Border |
|---|---|---|
| Default (rempli, enabled) | `--fg-bg-elev1` | `--fg-border` |
| Empty (mappedName=null) | `#fafaf9` | dashed `--fg-border` |
| Disabled (isEnabled=false) | `#f5f5f4` | `--fg-border` opaque 50% |
| Custom badge | `--fg-warning` 15% bg + `--fg-warning` text |  |
| Highlighted (diff) | `--fg-warning` 25% (yellow) | `--fg-warning` 2px |
| Read-only (default version) | `#fff8e1` | `--fg-default` dotted |
| Cell focus (clavier) | bg-stone-100 + ring-stone-900 |  |
| Cell error (validation) | bg-red-50 + ring-red-600 |  |

### Status badges

| Status | bg | text |
|---|---|---|
| `active` | `--fg-active` 10% | `--fg-active` |
| `draft` | `--fg-draft` 10% | `--fg-draft` |
| `archived` | `--fg-archived` 10% | `--fg-archived` |
| `deleted` | `--fg-deleted` 10% | `--fg-deleted` |
| `default` | `--fg-default` 10% | `--fg-default` |

## Iconographie

- Lucide-react ou icônes inline SVG (consistance avec FemiGlow tracking-improvement `GtmIcons.tsx`)
- Tailles : 12px (inline badge), 16px (boutons), 20px (cards), 24px (modales)
- Style : `stroke-width: 1.5`, outline (pas filled sauf statut)
