# F04 -- Config > Prompts

## Feature ID
F04-config-prompts

## Description
The Prompts tab on the AI Engine Configuration page allows operators to view, create, edit (as new versions), and delete prompt templates used by the LangGraph pipeline nodes. Each prompt has a system prompt, user prompt template with variable placeholders, versioning history, quality score, and usage count. Editing an existing prompt creates a new version rather than modifying in-place.

## UI Location
- **Page path**: `/admin/content-studio-v2/ai-engine/config`
- **Tab**: Prompts (third tab, `tab === 'prompts'`)
- **Section**: Card grid below tab bar, inline form above grid

## Components Involved
| Component | Path |
|---|---|
| `AIEngineConfigPage` | `apps/web/src/app/admin/content-studio-v2/ai-engine/config/page.tsx` |
| `PromptCard` | Same file, internal sub-component |
| `PromptForm` | Same file, internal sub-component |
| `EmptyState` | Same file, internal sub-component |

## API Routes
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/admin/ai-engine/config/prompts` | List all prompts |
| POST | `/api/admin/ai-engine/config/prompts` | Create or version a prompt |
| DELETE | `/api/admin/ai-engine/config/prompts/[id]` | Deactivate a prompt |

## Data Flow
1. Page mount: GET `/config/prompts` fetched in parallel
2. Response: `{ prompts: PromptData[] }`
3. Prompts tab: cards in responsive grid `minmax(380px, 1fr)`
4. Create: "Creer un prompt" button -> `EMPTY_PROMPT_FORM` with default nodeName `parse_brief`
5. Edit: card "Editer" button -> populates form with existing data, variables joined by comma
6. Save: POST with `{ nodeName, name, systemPrompt, userPromptTemplate, variables[] }` + optional `id`
7. Save with id: creates NEW VERSION, toast says "Nouvelle version du prompt creee"
8. Save without id: creates new prompt, toast says "Prompt cree"
9. Delete: `window.confirm()` -> DELETE `/config/prompts/{id}` -> toast "Prompt desactive"

## PromptData Shape
```typescript
{
  id: string;
  nodeName: string;         // parse_brief, enrich_knowledge, generate_script, etc.
  name: string;
  systemPrompt: string;
  userPromptTemplate: string;
  variables: string[];
  version: number;
  isActive: boolean;
  parentId: string | null;
  avgQualityScore: string | null;  // decimal "0.85"
  usageCount: number;
  createdAt: string;
}
```

## States
| State | Condition | Visual |
|---|---|---|
| Empty (no prompts) | `prompts.length === 0 && !showPromptForm` | EmptyState with FileText icon |
| List | `prompts.length > 0` | Card grid |
| Create form | `showPromptForm && !promptFormData.id` | Form titled "Creer un prompt" |
| Edit form | `showPromptForm && promptFormData.id` | Form titled "Editer le prompt", save button says "Creer nouvelle version" |
| Saving | `savingPrompt === true` | Button loading, inputs disabled |
| Deleting | `deletingPromptId === prompt.id` | Supprimer button shows Loader2 spinner |

## PromptCard Details
- **Name**: displayed in display font
- **Node name**: mono font below name
- **Badges**: "Active"/"Inactive" (success/neutral), version "v{N}" (accent)
- **System prompt preview**: truncated to 200 chars with ellipsis, shown in mono font in sunken box with gradient fade overlay (maxHeight 80px)
- **Variable pills**: first 5 variables shown as saffron-colored pills in `{variable}` format; if > 5, shows "+N" count
- **Quality score**: star icon + percentage (qualityPct = avgQualityScore * 100), only shown if non-null
- **Usage count**: lightning icon + "N utilisations"
- **Default protection**: prompts with `id.startsWith('default-')` hide Edit/Delete buttons

## PromptForm Fields
| Field | Type | Options/Constraints |
|---|---|---|
| Nom | text | Required (save disabled if empty) |
| Noeud | select | 9 node options from PROMPT_NODE_OPTIONS |
| System prompt | textarea, 6 rows | Required (save disabled if empty) |
| User prompt template | textarea, 4 rows | Optional |
| Variables | text (comma-separated) | Parsed by splitting on comma, trimming, filtering empty |

### PROMPT_NODE_OPTIONS
| Value | Label |
|---|---|
| parse_brief | Parse brief |
| enrich_knowledge | Enrich knowledge |
| enrich_trends | Enrich trends |
| generate_script | Generate script |
| generate_caption | Generate caption |
| generate_images | Generate images |
| quality_check | Quality check |
| moderate | Moderate |
| generate_variants | Generate variants |

## Validation Rules
- Name required: save disabled when `!form.name.trim()`
- System prompt required: save disabled when `!form.systemPrompt.trim()`
- Variables parsing: `data.variables.split(',').map(v => v.trim()).filter(Boolean)`
- Delete requires `window.confirm()` confirmation

## Design Tokens
| Token | Usage |
|---|---|
| `--cs-bg-sunken` | System prompt preview background |
| `--cs-warning-bg` | Variable pill background |
| `--cs-saffron` | Variable pill text color, quality star |
| `--cs-fg-secondary` | Prompt preview text |
| `--cs-font-mono` | Node name, system prompt preview, variable pills |

## Accessibility
- Prompt cards are `<div>` containers
- Form uses native `<input>`, `<select>`, `<textarea>` elements
- Delete: `window.confirm()` native dialog
- Variable pills are decorative spans (not interactive)
- System prompt preview has `overflow: hidden` and gradient overlay

## Edge Cases
- Prompt with empty variables array: no variable pills rendered
- Prompt with exactly 5 variables: all 5 shown, no "+N" overflow
- Prompt with > 5 variables: first 5 pills + "+{N}" count
- Prompt with null avgQualityScore: quality section not rendered
- Prompt with very long systemPrompt (> 200 chars): truncated with ellipsis
- System prompt preview box has maxHeight 80px with gradient fade-out
- Edit populates `variables` as comma-joined string
- Save sends variables as array (split, trim, filter)
- Editing a prompt with an `id` creates a NEW version (not in-place edit)
- Save button text changes: "Sauvegarder" for create, "Creer nouvelle version" for edit
- Delete toast says "Prompt desactive" (soft delete)
- Default prompts: `id.startsWith('default-')` prevents edit/delete
