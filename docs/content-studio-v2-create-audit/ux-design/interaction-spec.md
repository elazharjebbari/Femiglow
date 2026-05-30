# UX Interaction Spec — Content Studio v2 Create

## Tonalité

- **Confiance + clarté** : l'opérateur doit comprendre ce qu'il fait et pourquoi.
- **Pas de jargon** : "Modèle de génération" plutôt que "LLM".
- **Économie cognitive** : suggestion intelligente par défaut, override possible.
- **Honnêteté du mock** : badge omniprésent quand mock activé.

## Patterns d'interaction

### Loading states

| Action | Trigger | Visible | Cancelable |
|--------|---------|---------|------------|
| Submit IntentionForm | Click bouton | Spinner sur bouton + désactivation | non |
| Generate variants | Auto post idea | Section variants → "Génération en cours…" + barre estimée | non |
| Generate visual | Click bouton | Progressbar (useGenerationEstimator) | non |
| Autosave caption | Debounce 1500ms | AutosaveIndicator status | yes (flush + cancel timer) |
| Approve | Click bouton | Spinner inline + disable | non |
| Publish | Click confirm | Spinner inline | non |

### Validation states

- **Inline** : aria-invalid sur les inputs invalides
- **Banner** : pour les erreurs server qui empêchent la suite (budget, conflict, blocked)
- **Toast** : pour les succès et les erreurs non-bloquantes (sonner)

### Toasts

- **Position** : top-right
- **Durée** :
  - succès : 3s
  - erreur : 6s
  - persistant (session expired) : sticky avec close manuel
- **Action button** : pour retry / open link

### Empty states

- **PreviewPane vide** : "Décrivez votre intention pour démarrer"
- **Variants vide** : "Lance la génération pour voir 3 variantes ici."
- **Media vide** : "Aucun média encore"
- Tous accompagnés d'une icône large + couleur muted

### Focus management

- À l'ouverture d'un Dialog : focus sur premier élément interactif
- Esc ferme le Dialog
- Tab cycle reste dans le Dialog (focus trap)
- À la sélection d'une variante : focus vers MediaStudio (auto-scroll)
- Au click "Valider" : focus vers PublishActionGroup

### Keyboard shortcuts (Phase 7+)

| Touche | Action |
|--------|--------|
| Cmd/Ctrl + S | Flush autosave |
| Cmd/Ctrl + Enter (dans Caption) | Trigger Approve si conditions OK |
| Cmd/Ctrl + K | Ouvre ModelPicker en cours (optionnel) |
| Esc | Ferme Dialog ouvert |
| Tab | Navigation séquentielle |
| Shift+Tab | Navigation arrière |

## Hiérarchie visuelle

```
┌────────────────────────────────────────────────────┐
│ AppShell : Sidebar + main                          │
│  ┌──────────────────────────────────────────────┐  │
│  │ Stepper [Mode mock badge]                    │  │
│  ├──────────────────────────────────────────────┤  │
│  │ ┌──────────┐ ┌──────────────┐ ┌───────────┐ │  │
│  │ │Intention │ │Variants      │ │Preview    │ │  │
│  │ │Form      │ │Compare       │ │Pane       │ │  │
│  │ │ + Model  │ │              │ │           │ │  │
│  │ │ Picker   │ │              │ │           │ │  │
│  │ │          │ │              │ │           │ │  │
│  │ │          │ │MediaStudio   │ │           │ │  │
│  │ │          │ │ + Toggle     │ │           │ │  │
│  │ │          │ │ + ModelPick  │ │ [Valider] │ │  │
│  │ │          │ │              │ │   btn     │ │  │
│  │ │          │ │CaptionEditor │ │           │ │  │
│  │ └──────────┘ └──────────────┘ └───────────┘ │  │
│  ├──────────────────────────────────────────────┤  │
│  │ AutosaveIndicator     [Publier ▼]            │  │
│  └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
```

## Animations

- **Stepper** : transition de step → fade entre couleurs (200ms)
- **Variants** : apparition stagger (50ms delay entre cartes)
- **Toast** : slide in from top (300ms)
- **Dialog** : fade in + scale 0.95→1 (200ms)
- **Loader** : pulse subtle, pas de spinner agressif

## Couleurs sémantiques (via tokens `var(--cs-*)`)

| Sémantique | Token | Usage |
|------------|-------|-------|
| accent | `--cs-accent` | Active, primary CTA |
| accent-bg | `--cs-accent-bg` | Selected card |
| success | `--cs-success` | Done step, success toast |
| warning | `--cs-warning` | Mock badge, low budget, warnings |
| danger | `--cs-danger` | Blocked, errors |
| muted | `--cs-fg-muted` | Descriptions, secondary text |

## Responsive

| Viewport | Layout |
|----------|--------|
| ≥ 1280px | 3 colonnes (intention / center / preview) |
| 1024-1280px | 2 colonnes (intention + center / preview en pile sous le footer) |
| < 1024px | 1 colonne, ordre : Stepper → Intention → Variants → Media → Caption → Preview → Publish |
| < 640px | idem mais Stepper en mode compact (numéros seulement, pas de labels) |

## A11y baseline

- Tous les boutons : aria-label si pas de texte
- Inputs : `<label>` associé via `htmlFor`
- Combobox (ModelPicker) : `role="combobox"`, `aria-expanded`, `aria-controls`
- Dialogs : `role="dialog"`, `aria-labelledby`, `aria-describedby`, focus trap
- Statuts : `role="status"` pour autosave + toasts
- Live regions : `aria-live="polite"` pour les changements de statut autosave
