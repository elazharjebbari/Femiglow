# P6 -- Stepper Visuel de Progression

## Composant

**Nom:** `CreateStepper`
**Fichier:** `apps/web/src/components/admin/content-studio-v2/ai-engine/CreateStepper.tsx`
**But:** Afficher un stepper horizontal 4 etapes pour que l'operateur sache ou il en est dans le parcours de creation.

---

## Props Interface

```typescript
type Phase = 'brief' | 'generating' | 'review' | 'reviewing' | 'result' | 'error';

interface StepDef {
  number: number;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
}

type StepVisualState = 'active' | 'completed' | 'future' | 'error';

interface CreateStepperProps {
  currentPhase: Phase;
  completedPhases: Phase[];
  hasError?: boolean;
}
```

---

## Etapes

| # | Label         | Icone (lucide) | Phases associees              |
|---|---------------|----------------|-------------------------------|
| 1 | Brief         | FileText       | `brief`                       |
| 2 | Generation    | Sparkles       | `generating`                  |
| 3 | Review        | Eye            | `review`, `reviewing`         |
| 4 | Publication   | Send           | `result`                      |

---

## Mapping Phase -> Step Actif

```typescript
const PHASE_TO_STEP: Record<Phase, number> = {
  brief: 1,
  generating: 2,
  review: 3,
  reviewing: 3,
  result: 4,
  error: -1, // reste sur le dernier step connu
};
```

Quand `phase === 'error'`, le stepper conserve la derniere position connue. Le step courant affiche l'etat `error` (bordure rouge).

---

## Etats Visuels par Step

| Etat       | Cercle                                            | Ligne suivante        | Label             |
|------------|---------------------------------------------------|-----------------------|-------------------|
| `active`   | bg `var(--cs-accent)`, number blanc, ombre douce  | grise pointillee      | fg-primary, bold  |
| `completed`| bg `var(--cs-success)`, icone Check blanche        | verte pleine          | fg-secondary      |
| `future`   | border grise, number `var(--cs-fg-muted)`          | grise pointillee      | fg-muted          |
| `error`    | border `var(--cs-danger)`, icone AlertTriangle rouge| -                     | fg-primary, rouge |

---

## Design Visuel -- ASCII Mockup

```
  Etat initial (phase=brief):

  [1]-----(2)-----(3)-----(4)
 Brief  Generation Review Publication
  ^active  future   future   future


  Apres generation (phase=review):

  [V]=====[ 2 ]=====[ 3 ]-----(4)
 Brief   Generation Review  Publication
 done     done      ^active   future


  Erreur en generation:

  [V]=====[!]-----(3)-----(4)
 Brief   Generation Review Publication
 done    ^error    future   future


  Fin de parcours (phase=result):

  [V]=====[V]=====[V]=====[ 4 ]
 Brief   Generation Review  Publication
 done     done     done     ^active
```

Legende: `[V]` = completed (check), `[N]` = active, `(N)` = future, `[!]` = error

---

## Layout et Dimensions

- **Positionnement:** Rendu juste apres le `<header>` dans `AIEngineCreatePage`, avant le contenu de la phase.
- **Hauteur:** 60px (incluant labels)
- **Largeur:** 100% du conteneur parent (max-width: 880px)
- **Direction:** Horizontale, `display: flex`, `align-items: center`, `justify-content: space-between`
- **Cercles:** 32px x 32px, `border-radius: 50%`
- **Lignes:** `height: 2px`, `flex: 1`, connectent les cercles
- **Gap cercle-ligne:** 0 (les lignes touchent les cercles)

---

## Responsive

- **Desktop (>= 640px):** Cercles + labels en dessous + lignes
- **Mobile (< 640px):** Cercles + icones seulement, labels masques (`display: none`)
- Implementation: `@media (max-width: 639px)` cache les labels

---

## Etat Interne

Le composant est **stateless** (pur). Il calcule l'etat visuel de chaque step a partir des props.

```typescript
function getStepState(
  stepNumber: number,
  currentStep: number,
  completedPhases: Phase[],
  hasError: boolean
): StepVisualState {
  if (hasError && stepNumber === currentStep) return 'error';
  if (stepNumber < currentStep) return 'completed';
  if (stepNumber === currentStep) return 'active';
  return 'future';
}
```

---

## CSS Tokens Utilises

```
--cs-accent          (cercle actif bg)
--cs-accent-bg       (hover subtle)
--cs-success         (cercle completed, ligne completed)
--cs-danger          (cercle error border)
--cs-danger-bg       (cercle error bg subtle)
--cs-fg-primary      (label actif)
--cs-fg-secondary    (label completed)
--cs-fg-muted        (label future, number future)
--cs-border          (cercle future border, ligne future)
--cs-bg-elevated     (fond du conteneur stepper)
--cs-bg-base         (fond cercle future)
--cs-border-hair     (bordure conteneur)
--cs-radius-md       (rayon conteneur)
--cs-radius-full     (cercle: 50%)
--cs-shadow-sm       (ombre conteneur)
--cs-text-xs         (labels)
--cs-text-sm         (numbers dans les cercles)
--cs-font-display    (labels)
--cs-motion-fast     (transitions)
--cs-easing          (courbe de transition)
```

---

## Data Flow

1. `AIEngineCreatePage` maintient `phase` et `completedPhases[]` dans son state
2. A chaque transition de phase, la phase precedente est ajoutee a `completedPhases`
3. `<CreateStepper currentPhase={phase} completedPhases={completedPhases} hasError={phase === 'error'} />` est rendu entre `<header>` et le contenu de la phase
4. Le stepper ne declenche aucune action -- il est purement informatif

---

## Modifications du Fichier Page

**Fichier:** `apps/web/src/app/admin/content-studio-v2/ai-engine/create/page.tsx`

1. Ajouter `const [completedPhases, setCompletedPhases] = useState<Phase[]>([])` au state
2. Creer un helper `transitionTo(newPhase: Phase)` qui appelle `setCompletedPhases(prev => [...prev, phase])` puis `setPhase(newPhase)`
3. Remplacer tous les `setPhase(...)` par `transitionTo(...)`
4. Rendre `<CreateStepper>` juste apres `</header>` dans le JSX retourne
5. Dans `handleReset`, remettre `completedPhases` a `[]`

---

## Accessibilite

- Le conteneur a `role="navigation"` et `aria-label="Progression de la creation"`
- Chaque etape a `aria-current="step"` quand active
- Les etapes completees ont `aria-label="Etape N: Label (terminee)"`
- Les etapes futures ont `aria-disabled="true"`
- Navigation clavier non requise (stepper non-interactif)

---

## Edge Cases

| Cas                                  | Comportement attendu                                    |
|--------------------------------------|---------------------------------------------------------|
| Phase `error` sans phase precedente  | Step 1 en etat error                                    |
| Phase `error` apres `generating`     | Step 2 en etat error, step 1 completed                  |
| Transition rapide brief -> generating| Animation fluide, pas de flickering                      |
| Phase `reviewing` (sub-phase)        | Stepper reste sur step 3 (meme que `review`)            |
| `handleReset` appele                 | Retour a step 1, completedPhases vide                   |
| Plusieurs retries                    | completedPhases se cumule, steps 1-2 restent completed  |

---

## Fichiers Impactes

| Fichier | Modification |
|---------|-------------|
| `components/admin/content-studio-v2/ai-engine/CreateStepper.tsx` | Nouveau composant |
| `app/admin/content-studio-v2/ai-engine/create/page.tsx` | Import + state + rendu |
