# Raccourcis clavier

> Référence canonique. Affichée à l'utilisateur via `?` cheat sheet.

## Globaux

| Touche | Action |
|---|---|
| `⌘K` / `Ctrl+K` | Ouvrir command palette |
| `?` | Afficher la cheat sheet |
| `Esc` | Fermer modale/drawer/palette |
| `g` puis `e` | Aller à `/admin/emails` (dashboard) |
| `g` puis `t` | `/admin/emails/transactional` |
| `g` puis `a` | `/admin/emails/audiences` |
| `g` puis `c` | `/admin/emails/campaigns` |
| `g` puis `o` | `/admin/emails/automation` (o = automation) |

## Navigation dans listes (tableaux)

| Touche | Action |
|---|---|
| `j` | Ligne suivante |
| `k` | Ligne précédente |
| `Enter` | Ouvrir la ligne sélectionnée |
| `x` | Toggle selection ligne courante |
| `Shift+X` | Range selection depuis dernière |
| `⌘A` | Select all visible |
| `Esc` | Clear selection |

## Édition

| Touche | Action |
|---|---|
| `e` | Éditer (depuis liste) |
| `n` | Nouveau (audience, automation…) |
| `⌘S` | Sauvegarder (dans wizard) |
| `⌘Enter` | Submit final wizard step |

## Cockpit transactionnel

| Touche | Action |
|---|---|
| `/` | Focus search input |
| `f` | Filter status:failed |
| `b` | Filter status:bounced_hard |
| `r` | Retry sur ligne sélectionnée |
| `s` | Save current view |

## Cheat sheet UI

Quand l'admin presse `?` :

```
┌──────────────────────────────────────────────────────────┐
│ Raccourcis clavier                                  [✕] │
├──────────────────────────────────────────────────────────┤
│  Globaux                                                 │
│   ⌘K     Command palette                                 │
│   ?      Cette aide                                      │
│   Esc    Fermer                                          │
│                                                          │
│  Navigation                                              │
│   g e    Dashboard emails                                │
│   g t    Transactional                                   │
│   g a    Audiences                                       │
│   g c    Campagnes                                       │
│   g o    Automation                                      │
│                                                          │
│  Liste                                                   │
│   j / k  Ligne suivante / précédente                     │
│   Enter  Ouvrir                                          │
│   x      Sélectionner                                    │
│   ⌘A     Tout sélectionner                              │
│                                                          │
│  Actions                                                 │
│   n      Nouveau                                         │
│   e      Éditer                                          │
│   r      Retry (transactional)                           │
│   ⌘S     Enregistrer                                     │
└──────────────────────────────────────────────────────────┘
```

## Implémentation (hotkey lib)

Utiliser `react-hotkeys-hook` ou équivalent :

```typescript
useHotkeys('cmd+k, ctrl+k', () => openPalette());
useHotkeys('?', () => setCheatSheetOpen(true));
useHotkeys('g e', () => router.push('/admin/emails'));
// ...
```

Convention `g X` : 2-stroke sequence. La lib gère le timing.

## Hooks d'aide

```typescript
// /hooks/useKbdShortcuts.ts
export function useKbdShortcuts(scope: 'global' | 'transactional' | ...) {
  useHotkeys(...);
}
```

## Indicateurs visuels

- Boutons avec raccourci : afficher la touche entre crochets, ex
  `[Retry  R]`
- Tooltips : "Save view  ⌘S"

## Conflits navigateur

- `⌘P` (print), `⌘F` (find) restent natifs
- `⌘K` = on override (utilisé par cmdk lib)
- `⌘S` dans un wizard : preventDefault
