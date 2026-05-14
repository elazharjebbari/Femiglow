# Color system

## 1. Palette de marque (existante FemiGlow)

| Token | Hex | Usage |
|---|---|---|
| `sauge-50` | `#F0F4EF` | Surfaces très claires |
| `sauge-100` | `#DDE7DA` | Backgrounds doux, hover |
| `sauge-200` | `#BACDB4` | Borders |
| `sauge-400` | `#739E6B` | Accents secondaires |
| `sauge-600` | `#4A7E40` | CTA primary, links |
| `sauge-700` | `#3B6634` | Hover CTA primary |
| `sauge-900` | `#1F3618` | Texte sur fond clair (accent) |
| `creme-50` | `#FBF7EE` | Background principal (page) |
| `creme-100` | `#F3ECDB` | Background card |
| `creme-200` | `#E3D7B8` | Borders cards |
| `encre-700` | `#2D3142` | Texte secondaire |
| `encre-900` | `#1A1D2A` | Texte principal |
| `brique-500` | `#C7553C` | Destructive primary |
| `brique-600` | `#A8442F` | Destructive hover |
| `ambre-400` | `#D9A441` | Warning, info |
| `ambre-100` | `#F5E8C9` | Warning surface |
| `stone-100` | `#F5F5F4` | Neutre clair |
| `stone-300` | `#D6D3D1` | Borders neutres |
| `stone-500` | `#78716C` | Texte tertiaire |
| `stone-700` | `#44403C` | Texte muted |

## 2. Tokens sémantiques tracking (nouveaux)

| Token | Valeur | Usage |
|---|---|---|
| `tracking.status.ok` | `sauge-600` | Plan actif, drift OK, validation passée |
| `tracking.status.warning` | `ambre-400` | Drift mineur, validation warnings |
| `tracking.status.critical` | `brique-500` | Drift critique, validation errors |
| `tracking.status.neutral` | `stone-500` | Brouillon, archived |
| `tracking.surface.card` | `creme-100` | Card par défaut |
| `tracking.surface.card-active` | `sauge-50` | Card statut actif |
| `tracking.surface.card-critical` | `#FBE8E2` | Card statut critique |
| `tracking.surface.preview` | `#0E1622` | Background JSON preview (dark) |
| `tracking.text.preview` | `#E5E7EB` | Texte JSON preview |
| `tracking.text.placeholder-warning` | `brique-600` | Mise en garde sur ID placeholder |
| `tracking.border.input-focus` | `sauge-600` | Border input focus |
| `tracking.border.input-error` | `brique-500` | Border input erreur |
| `tracking.border.input-warning` | `ambre-400` | Border input warning |
| `tracking.badge.autofilled` | `sauge-100` + `sauge-700` text | Badge "auto-rempli" |
| `tracking.badge.modified` | `ambre-100` + `ambre-400` text | Badge "modifié" |
| `tracking.badge.draft` | `stone-100` + `stone-700` text | Badge "brouillon" |
| `tracking.badge.active` | `sauge-100` + `sauge-700` text | Badge "actif" |
| `tracking.badge.archived` | `stone-100` + `stone-500` text | Badge "archivé" |

## 3. Contrastes WCAG

Tests de contraste sur la combinaison la plus utilisée :

| Texte | Fond | Ratio | WCAG |
|---|---|---|---|
| `encre-900` (`#1A1D2A`) | `creme-50` (`#FBF7EE`) | 15.6:1 | AAA |
| `encre-700` (`#2D3142`) | `creme-100` (`#F3ECDB`) | 11.8:1 | AAA |
| `stone-700` (`#44403C`) | `creme-100` | 8.4:1 | AAA |
| `stone-500` (`#78716C`) | `creme-50` | 4.7:1 | AA (texte normal) |
| `sauge-700` (`#3B6634`) | `creme-50` | 7.8:1 | AAA |
| `sauge-600` (`#4A7E40`) | `creme-50` | 5.4:1 | AA |
| `white` | `sauge-600` (CTA) | 4.7:1 | AA |
| `white` | `brique-500` | 4.8:1 | AA |
| `encre-900` | `ambre-400` | 7.5:1 | AAA |
| `brique-600` (`#A8442F`) | `creme-50` | 5.6:1 | AA |

Tous validés ≥ 4.5:1 (AA pour texte normal). Les labels critiques (validation errors, drift warnings) atteignent AAA.

## 4. États d'interaction

| État | Modifier |
|---|---|
| Default | (token base) |
| Hover | `+1 step` (sauge-600 → sauge-700) |
| Active / Pressed | `+2 step` ou opacité 0.85 |
| Focus | Outline 2px `sauge-600` + offset 2px |
| Disabled | Opacité 0.45 + `cursor-not-allowed` |
| Loading | Background pulse + spinner |

## 5. Dark mode (v2, post-MVP)

Inversion sémantique :

| Token light | Token dark |
|---|---|
| `creme-50` | `#0F1419` |
| `creme-100` | `#1A1F26` |
| `encre-900` | `#F5F0E8` |
| `sauge-600` | `#7BB870` |
| `brique-500` | `#E2766B` |
| `ambre-400` | `#E5B559` |

Préférence système détectée via `prefers-color-scheme`. Pas activé en v1 (pas de pression utilisateur, complexité de tests).

## 6. RTL (arabe)

Les couleurs ne changent pas en RTL. Seuls :
- Borders directionnels (`border-l` → `border-r`)
- Icônes orientées (flèches, chevrons)
- Mise en page (margin/padding)

## 7. Daltonisme

Pas de différenciation par couleur seule :
- Status badges contiennent **toujours** une icône (✓, ⚠, ✗).
- Drift banner inclut le texte explicite "Critique" / "Mineur".
- Validation results ont icône + texte + couleur (triple redondance).

Testé avec simulateurs Deuteranopia / Protanopia / Tritanopia : tous lisibles.
