# Micro-interactions et feedback

## 1. Feedback temporel

| Action | Délai feedback | Type |
|---|---|---|
| Saisie champ | Immédiat (validation locale) | Border color + helper text |
| Clic CTA primaire | < 100ms | Pressed state + loading spinner |
| Save background | Indicateur discret | "Sauvegardé il y a 2s" en haut droite |
| Activation | 1-3s | Modal + spinner + texte progression |
| Drift refresh | < 500ms | Optimistic update + retry si fail |

## 2. Saisie de champs ID

### IdInput comportement

```
État initial          : [G-5VHP17SDZM        ] [auto-rempli]
                        ↑ pré-rempli depuis defaults

User modifie 1 char   : [G-5VHP17SDZN        ] [↺ revert]
                        ↑ badge disparaît, revert apparaît

User clic revert      : [G-5VHP17SDZM        ] [auto-rempli]
                        ↑ retour valeur initiale

User saisit invalide  : [INVALID             ]
                        ⚠ Format attendu : G-XXXXXXXXX
                        ↑ helper text rouge

User saisit placeholder: [G-PROD0000          ]
                         ⚠ Ressemble à une valeur de démo
                         ↑ warning rouge
```

### Debounce et validation

- Validation Zod locale : à chaque keystroke (< 1ms).
- Validation server (rule métier) : debounce 300ms après stop typing.
- Affichage warnings/errors : pendant la frappe (instant feedback).

## 3. Stepper wizard

### Click sur step

```
État steps  : 1 (visité, OK) → 2 (visité, OK) → ●3 (courant) → 4 (futur) → 5 (futur)

Click 1     : Va à 1 directement (sauve auto avant)
Click 2     : Idem
Click 3     : N/A (déjà là)
Click 4     : ❌ Bloqué — visual shake + tooltip "Terminez d'abord cette étape"
Click 5     : Idem
```

### Indicateur de step

- Cercle plein sauge : visité, OK.
- Cercle plein ambre : visité, warnings.
- Cercle plein rouge : visité, errors → l'admin doit y revenir.
- Cercle vide encre : courant (avec border).
- Cercle vide stone-300 : futur.

## 4. Boutons primaires vs. secondaires

### Hiérarchie visuelle

| Type | Couleur | Taille | Position | Usage |
|---|---|---|---|---|
| Primary | Sauge `bg-sauge-600` | `h-10 px-6` | Bottom-right | Action principale (Continuer, Activer) |
| Secondary | Stone outlined | `h-10 px-4` | À gauche du primary | Action alternative (Retour, Brouillon) |
| Ghost | Transparent + hover | `h-9 px-3` | Inline | Actions secondaires (Revert, Copy) |
| Destructive | Brique `bg-brique-600` | `h-10 px-6` | Après confirmation | Archiver, Supprimer |

### Loading states

```
Bouton normal      : [ Activer ]
Bouton clicked     : [ ⟳ Activation... ] (disabled, spinner)
Bouton success     : [ ✓ Activé ] (vert 1s puis disparaît avec redirect)
Bouton error       : [ ✗ Erreur — Réessayer ] (rouge + retry inline)
```

## 5. Toasts

| Type | Couleur | Durée | Action |
|---|---|---|---|
| Success | Vert sauge | 3s | Aucune (auto-dismiss) |
| Info | Bleu doux | 5s | Aucune |
| Warning | Ambre | 6s | Bouton "Détails" |
| Error | Rouge brique | 8s | Bouton "Retry" + auto-retry après 10s |

Toasts en bas-droite, max 3 empilés. Pile descendante (le plus récent en bas).

## 6. Modales de confirmation

### Activation
```
┌──────────────────────────────────────────────┐
│  Activer le plan "Test campagne mai 2026" ?  │
│                                              │
│  Ce plan deviendra le plan actif et          │
│  Production v8 sera archivé.                 │
│                                              │
│  ⚠ Vous devrez télécharger le nouveau JSON   │
│    et l'importer dans GTM pour propager      │
│    les changements au client.                │
│                                              │
│         [Annuler]    [Activer]               │
└──────────────────────────────────────────────┘
```

### Archive (destructive)
```
┌──────────────────────────────────────────────┐
│  ⚠ Archiver le plan "Production v6" ?        │
│                                              │
│  Le plan ne sera plus modifiable.            │
│  Il restera en historique 90 jours.          │
│                                              │
│  Tapez "Production v6" pour confirmer :       │
│  [                                          ]│
│                                              │
│         [Annuler]    [Archiver]              │
└──────────────────────────────────────────────┘
```

(Confirmation par saisie pour actions destructives.)

## 7. Drift status banner

### États

```
OK     : (pas de banner)

Warning: ┌────────────────────────────────────────────────────────────┐
         │ ⚠ Drift mineur détecté — derniers pings inconsistents      │
         │   depuis 14:21. Pas de risque immédiat. [Détails →]        │
         └────────────────────────────────────────────────────────────┘

Critical:┌────────────────────────────────────────────────────────────┐
         │ ✗ Le tracking client diverge de la version active depuis   │
         │   14:32. Les conversions peuvent ne pas remonter.          │
         │   [Comprendre]  [Re-télécharger JSON]                      │
         └────────────────────────────────────────────────────────────┘
```

Bandeau persistant (pas dismissable). Disparaît automatiquement quand status passe à OK.

## 8. Empty states

### Aucun plan
```
        ┌──────────────────────────┐
        │      [illustration]      │
        │                          │
        │  Aucun plan de tracking  │
        │      encore créé.        │
        │                          │
        │  [+ Créer mon premier    │
        │      plan]               │
        └──────────────────────────┘
```

### Aucun event activé
```
        Aucun événement n'est activé pour le moment.
        Cochez les événements à envoyer aux outils
        dans la matrice ci-dessous.
```

## 9. Keyboard shortcuts (mode expert)

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + S` | Sauvegarder draft |
| `Cmd/Ctrl + Enter` | Activer (avec confirmation) |
| `Cmd/Ctrl + K` | Ouvrir command palette (jump to section) |
| `Cmd/Ctrl + /` | Toggle preview JSON |
| `Esc` | Fermer modale / quitter section |
| `Tab` | Navigation séquentielle des champs |
| `Shift + Tab` | Retour arrière |

Wizard : Tab + Enter suffisent (pas de raccourcis spéciaux pour ne pas surcharger Amal).
