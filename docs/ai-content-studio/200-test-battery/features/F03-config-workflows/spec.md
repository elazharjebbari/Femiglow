# F03 -- Config > Workflows

## Feature ID
F03-config-workflows

## Description
The Workflows tab on the AI Engine Configuration page lets operators view, create, edit, and delete content-generation workflow configurations. Each workflow defines a pipeline (nodes/edges), quality threshold, budget, platform/format targeting, retry policy, and HITL/auto-publish toggles. Workflows have versioning; default workflows (id starts with `default-`) cannot be edited or deleted.

## UI Location
- **Page path**: `/admin/content-studio-v2/ai-engine/config`
- **Tab**: Workflows (second tab, `tab === 'workflows'`)
- **Section**: Workflow list below tab bar, inline form above list

## Components Involved
| Component | Path |
|---|---|
| `AIEngineConfigPage` | `apps/web/src/app/admin/content-studio-v2/ai-engine/config/page.tsx` |
| `WorkflowCard` | Same file, internal sub-component |
| `WorkflowForm` | Same file, internal sub-component |
| `EmptyState` | Same file, internal sub-component |
| `Toggle` | Same file, internal sub-component |

## API Routes
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/admin/ai-engine/config/workflows` | List all workflows |
| POST | `/api/admin/ai-engine/config/workflows` | Create or update a workflow |
| DELETE | `/api/admin/ai-engine/config/workflows/[id]` | Delete a workflow |

## Data Flow
1. Page mount: `fetchData()` calls GET `/config/workflows` among parallel fetches
2. Response: `{ workflows: WorkflowData[] }`
3. Workflows tab: list rendered as `WorkflowCard` components
4. Create: "Creer un workflow" button -> sets `showWorkflowForm=true` with `EMPTY_WORKFLOW_FORM`
5. Edit: card "Editer" button -> populates `workflowFormData` from existing workflow, shows form
6. Save: POST `/config/workflows` with payload, toast success/error, `fetchData()` refresh
7. Delete: card "Supprimer" button -> `window.confirm()` -> DELETE `/config/workflows/{id}` -> toast -> refresh

## WorkflowData Shape
```typescript
{
  id: string;
  name: string;
  description: string | null;
  platform: string | null;     // instagram, tiktok, facebook, youtube, linkedin, pinterest
  format: string | null;       // post, story, reel, carousel
  graphConfig: { nodes?: string[]; edges?: string[][] };
  defaultTone: string;
  defaultLanguage: string;
  qualityThreshold: string;    // "0.70" decimal
  maxRetries: number;
  maxBudgetCents: number;
  humanReviewRequired: boolean;
  autoPublish: boolean;
  providerOverrides: unknown;
  version: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

## States
| State | Condition | Visual |
|---|---|---|
| Empty (no workflows) | `workflows.length === 0 && !showWorkflowForm` | EmptyState with GitBranch icon, dashed border, CTA button |
| List | `workflows.length > 0` | Stacked WorkflowCard components |
| Create form visible | `showWorkflowForm && !workflowFormData.id` | Inline form titled "Creer un workflow" |
| Edit form visible | `showWorkflowForm && workflowFormData.id` | Inline form titled "Editer le workflow" |
| Saving | `savingWorkflow === true` | Form button loading, inputs disabled |
| Deleting | `deletingWorkflowId === workflow.id` | Supprimer button shows Loader2 spinner |

## WorkflowCard Details
- **Name and description**: displayed at top
- **Badges**: "Actif"/"Inactif" (success/neutral), version badge "v{N}" (accent)
- **Platform/format labels**: from PLATFORM_LABELS map
- **Quality**: displayed as `>= {pct}%` (qualityThreshold * 100)
- **Budget**: `{cents/100} MAD`
- **Retries**: count
- **Pipeline visualization**: nodes as pill badges with ArrowRight separators, using NODE_LABELS
- **HITL**: "Requis" or "Auto"
- **Auto-publish**: "Auto" or "Manuelle"
- **Default protection**: workflows with `id.startsWith('default-')` hide Edit/Delete buttons

## WorkflowForm Fields
| Field | Type | Options/Constraints |
|---|---|---|
| Nom | text | Required (`!form.name.trim()` disables save) |
| Description | text | Optional |
| Plateforme | select | Toutes, Instagram, Facebook, TikTok, YouTube, LinkedIn, Pinterest |
| Format | select | Tous, Post, Story, Reel, Carousel |
| Seuil qualite (%) | number | min=0, max=100, clamped |
| Budget max (MAD) | number | min=0 |
| Retries max | number | min=1, max=5, clamped |
| Review humaine | toggle | boolean |
| Auto-publication | toggle | boolean |

## Validation Rules
- Name is required: save button disabled when `!form.name.trim()`
- Quality threshold clamped to [0, 100]
- Max retries clamped to [1, 5]
- Budget clamped to >= 0
- Delete requires `window.confirm()` confirmation

## Design Tokens
| Token | Usage |
|---|---|
| `--cs-bg-elevated` | Card background |
| `--cs-border-hair` | Card border |
| `--cs-radius-md` | Card border radius |
| `--cs-shadow-sm` | Card shadow |
| `--cs-fg-primary` | Workflow name |
| `--cs-fg-muted` | Description, meta info |
| `--cs-bg-sunken` | Pipeline node badges |

## Accessibility
- Cards are `<div>` containers (not interactive)
- Form inputs are native `<input>`, `<select>`, `<textarea>` elements
- Toggle: `<button role="switch" aria-checked={checked}>` inside a `<label>`
- Delete: relies on `window.confirm()` dialog (native browser dialog)
- Empty state: descriptive text explains what to do

## Edge Cases
- Default workflows: cannot be edited or deleted (buttons hidden)
- Workflow with empty nodes array: no pipeline visualization section
- Workflow with null platform: platform label not shown
- Workflow with null format: format label not shown
- Quality threshold stored as decimal "0.70", displayed as "70%", form uses integer input
- Save sends `qualityThreshold` as `(value / 100).toFixed(2)` string
- Edit populates form with `Math.round(parseFloat(w.qualityThreshold) * 100)`
- Concurrent delete: deletingWorkflowId prevents double-click
- Toast messages: "Workflow cree" / "Workflow mis a jour" / "Workflow supprime"
