# Design Tokens — Content Studio v2

> Tokens CSS utilisés dans toute la page. Définis dans `app/admin/content-studio-v2/*.css` et `globals.css`.

## Espacement

| Token | Valeur | Usage |
|-------|--------|-------|
| `--cs-space-1` | 4px | gap fin |
| `--cs-space-2` | 8px | padding inputs |
| `--cs-space-3` | 12px | gap moyen |
| `--cs-space-4` | 16px | padding sections |
| `--cs-space-5` | 24px | gap grand |
| `--cs-space-6` | 32px | sections distinctes |

## Rayons

| Token | Valeur |
|-------|--------|
| `--cs-radius-sm` | 6px |
| `--cs-radius-md` | 10px |
| `--cs-radius-lg` | 16px |
| `--cs-radius-full` | 9999px |

## Typo

| Token | Valeur | Usage |
|-------|--------|-------|
| `--cs-font-display` | "Cormorant Garamond" | Titres |
| `--cs-font-body` | "Inter" | Corps |
| `--cs-font-mono` | "JetBrains Mono" | Scores, IDs |
| `--cs-text-xs` | 11px | Labels |
| `--cs-text-sm` | 13px | Body small |
| `--cs-text-base` | 15px | Body |
| `--cs-text-lg` | 18px | Titres composants |
| `--cs-text-xl` | 24px | Titres principaux |

## Couleurs (light)

| Token | Hex | Usage |
|-------|-----|-------|
| `--cs-bg-base` | #FFF8F1 | Fond global |
| `--cs-bg-elevated` | #FFFFFF | Cards, panels |
| `--cs-bg-sunken` | #F7EFE4 | Backgrounds plus profonds |
| `--cs-fg-primary` | #1F1B16 | Texte principal |
| `--cs-fg-secondary` | #4A413A | Texte secondaire |
| `--cs-fg-muted` | #7C7066 | Labels, helpers |
| `--cs-accent` | #6B5BFF | Indigo FemiGlow |
| `--cs-accent-bg` | #EDEAFF | Fond accent doux |
| `--cs-success` | #2F8B5C | Vert validation |
| `--cs-warning` | #C18A1F | Orange |
| `--cs-warning-bg` | #FBF1DD | Fond warning doux |
| `--cs-danger` | #C13E3E | Rouge |
| `--cs-danger-bg` | #FBDFDF | Fond danger doux |
| `--cs-border` | #E2D6C6 | Bordures normales |
| `--cs-border-hair` | #ECE2D2 | Bordures fines |
| `--cs-fg-on-accent` | #FFFFFF | Texte sur fond accent |

## Couleurs (dark)

| Token | Hex |
|-------|-----|
| `--cs-bg-base` | #1A1614 |
| `--cs-bg-elevated` | #25201D |
| `--cs-bg-sunken` | #15110F |
| `--cs-fg-primary` | #F1ECE3 |
| `--cs-fg-secondary` | #BAB0A4 |
| `--cs-fg-muted` | #7C7066 |
| `--cs-accent` | #9B8EFF |
| `--cs-accent-bg` | #2D2840 |
| ... | ... |

## Animation

| Token | Valeur |
|-------|--------|
| `--cs-motion-fast` | 150ms |
| `--cs-motion-normal` | 250ms |
| `--cs-motion-slow` | 400ms |
| `--cs-easing` | cubic-bezier(0.4, 0, 0.2, 1) |
| `--cs-easing-bouncy` | cubic-bezier(0.34, 1.56, 0.64, 1) |

## Shadows

| Token | Valeur |
|-------|--------|
| `--cs-shadow-sm` | 0 1px 2px rgba(0,0,0,0.04) |
| `--cs-shadow-md` | 0 4px 12px rgba(0,0,0,0.08) |
| `--cs-shadow-lg` | 0 10px 30px rgba(0,0,0,0.12) |

## Tokens manquants à ajouter (Phase 1)

- `--cs-radius-pill` (= `--cs-radius-full`, pour les badges/chips) — déjà OK
- `--cs-fg-on-warning` : #1F1B16 sur fond warning
- `--cs-shadow-focus` : 0 0 0 3px var(--cs-accent-bg) pour focus visible

## Contrast ratio

Tous les pairs FG/BG doivent respecter WCAG AA :
- text normal ≥ 4.5:1
- text large ≥ 3:1
- UI components ≥ 3:1

Vérification automatique via axe-core en E2E.
