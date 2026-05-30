# F11 -- Generation Progress

## Feature ID
F11

## Source File
`apps/web/src/components/admin/content-studio-v2/ai-engine/GenerationProgress.tsx`

## Description

The GenerationProgress component renders a vertical pipeline visualization that
shows the operator each step of the LangGraph content generation process in real
time. It is displayed during the `generating` phase of the Create page (F10) and
transitions to either the result or review phase upon completion.

## Exported Types

### StepStatus
```typescript
type StepStatus = 'pending' | 'running' | 'done' | 'error';
```

### PipelineStep
```typescript
interface PipelineStep {
  id: string;
  label: string;
  status: StepStatus;
  durationMs?: number;
}
```

### PIPELINE_STEPS (default steps)
| id | label |
|---|---|
| `parse_brief` | Analyse du brief |
| `enrich_knowledge` | Enrichissement contextuel |
| `generate_script` | Redaction du script |
| `generate_images` | Generation des visuels |
| `quality_check` | Controle qualite |
| `done` | Termine |

## Component Props

```typescript
interface GenerationProgressProps {
  steps: PipelineStep[];
  totalCost?: number;  // in centimes
}
```

## Visual Layout

### Pipeline Steps Column

The component renders a vertical list of steps. Each step row contains:

1. **Status icon** (left column, centered vertically):
   - `pending`: Circle icon (gray, `--cs-fg-muted`)
   - `running`: Loader2 icon with `cs-spin` animation (blue/accent, `--cs-accent`)
   - `done`: CheckCircle2 icon (green, `--cs-success`)
   - `error`: XCircle icon (red, `--cs-danger`)

2. **Connector line** (between consecutive steps):
   - Width: 1.5px
   - Min height: 20px
   - Color: `--cs-success` (green) if previous step is done, `--cs-border` (gray) otherwise
   - Transition: `background var(--cs-motion-base) var(--cs-easing)`

3. **Step label** (right column):
   - Font weight: 600 if running, 400 otherwise
   - Color: `--cs-fg-muted` if pending, `--cs-fg-primary` otherwise

4. **Duration badge** (right-aligned, optional):
   - Only shown when `step.durationMs` is defined
   - Formatted: `<1000ms` shows as "XXXms", `>=1000ms` shows as "X.Xs"
   - Font: monospace (`cs-mono`), `--cs-text-xs`, `--cs-fg-muted`

### Header Row

- **Title**: "Pipeline de generation" (`cs-display`, `--cs-text-lg`, weight 500)
- **Elapsed timer**: Only visible when `isRunning` is true (at least one step has
  `status === 'running'`). Shows elapsed time since component mount. Updated every
  200ms via `setInterval`. Formatted with the same `formatDuration()` helper.

### Cost Footer

- Only rendered when `totalCost` prop is defined (`totalCost != null`)
- Separator: top border `1px solid --cs-border-hair`
- Left: "Cout estime" label
- Right: cost formatted as `(totalCost / 100).toFixed(2) + " MAD"` in monospace

## Timing Behavior

The elapsed timer starts from component mount (`Date.now()` captured in `startRef`).
It only ticks while at least one step has `status === 'running'`. The interval clears
when no steps are running (via the `useEffect` cleanup function).

## CSS Animation

The component defines and uses a `cs-spin` keyframe animation:
```css
@keyframes cs-spin { to { transform: rotate(360deg); } }
.cs-spin { animation: cs-spin 0.8s linear infinite; }
```

## Container Styling

- Background: `--cs-bg-elevated`
- Border: `1px solid --cs-border-hair`
- Border radius: `--cs-radius-md`
- Padding: `24px 28px`
- Box shadow: `--cs-shadow-sm`

## Integration with Create Page

The parent (F10 Create page) drives step progression via `simulateProgress()`:
- Each step transitions from `pending` -> `running` -> `done`
- Duration per step: `800ms + Math.random() * 2200ms`
- Steps advance sequentially
- On completion, parent calls the callback which transitions to the next phase

## Dependencies

- lucide-react icons: Circle, Loader2, CheckCircle2, XCircle
- React hooks: useState, useEffect, useRef
