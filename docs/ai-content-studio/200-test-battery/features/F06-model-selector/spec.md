# F06 -- ModelSelector

## Feature ID
F06-model-selector

## Description
The ModelSelector is a reusable popover component built on Radix Popover and cmdk (Command Menu). It allows operators to search, select, and deselect AI models for a given provider. Models are fetched from the API on popover open, cached client-side per provider:capability key, and support manual entry of custom model identifiers. Each model shows a role badge and checkmark for selected state. A footer displays the data source indicator (live/cache/fallback) and a refresh button.

## UI Location
- **Used inside**: ProviderCard edit form on Config page
- **Trigger**: Multi-select button styled as an input with selected model badges
- **Popover**: Floating panel with search, model list, footer

## Components Involved
| Component | Path |
|---|---|
| `ModelSelector` | `apps/web/src/components/admin/content-studio-v2/ai-engine/ModelSelector.tsx` |
| `Popover` | `@radix-ui/react-popover` (external) |
| `Command` | `cmdk` (external) |

## API Routes
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/admin/ai-engine/config/providers/models?provider={type}&capability={cap}` | Fetch available models |

## Data Flow
1. User clicks trigger button -> `setOpen(true)` -> `useEffect` fires `fetchModels(false)`
2. Cache check: if `cacheRef.current.has(cacheKey)`, uses cached result (source='cache')
3. No cache: GET `/config/providers/models?provider={providerType}` (+ optional `capability`)
4. Response parsed: `{ models: ModelEntry[], source?: 'fallback' }` or plain array
5. Models stored in state, cached in `cacheRef` with source promoted to 'cache' for next access
6. User types in search -> cmdk filters list
7. User clicks model item -> `toggleModel()` adds/removes from `selectedModels`
8. Custom entry: if search text does not match any model and is not already selected, "Ajouter" option appears
9. Refresh button: `cacheRef.current.delete(cacheKey)`, re-fetches with `bypassCache=true`
10. Parent reads changes via `onModelsChange` callback

## ModelEntry Shape
```typescript
{
  id: string;    // "gpt-4o", "text-embedding-3-small", etc.
  role: string;  // "chat", "embedding", "tts", "image"
}
```

## Props
| Prop | Type | Default | Description |
|---|---|---|---|
| `providerType` | string | required | Provider key for API query |
| `selectedModels` | string[] | required | Currently selected model IDs |
| `onModelsChange` | (models: string[]) => void | required | Callback when selection changes |
| `capabilityFilter` | string | undefined | Optional capability filter |
| `disabled` | boolean | false | Disables trigger and prevents interaction |

## States
| State | Condition | Visual |
|---|---|---|
| Closed, no selection | `!open && selectedModels.length === 0` | Trigger shows "Selectionner des modeles" placeholder |
| Closed, with selection | `!open && selectedModels.length > 0` | Trigger shows model badges with X remove buttons |
| Open, loading | `open && loading` | Command.Loading with spinning border element |
| Open, error | `open && error` | Red error text "Erreur : {message}" |
| Open, models loaded | `open && models.length > 0` | List of Command.Item elements |
| Open, no results | `open && search with no matches` | Command.Empty "Aucun modele trouve" |
| Open, custom entry | `search text not in list and not selected` | "Ajouter {search}" option |
| Disabled | `disabled === true` | Trigger opacity 0.5, pointer-events none |
| Source live | `source === 'live'` | Green dot in footer |
| Source cache | `source === 'cache'` | Blue dot in footer |
| Source fallback | `source === 'fallback'` | Yellow dot in footer, text "Statique" |

## Trigger Details
- Styled as flex-wrap button with `aria-haspopup="listbox"` and `aria-expanded={open}`
- Selected models shown as badges with `var(--cs-accent-bg)` background, mono font
- Each badge has an X button with `role="button"`, `tabIndex={0}`, `aria-label="Retirer {model}"`
- ChevronDown icon at far right, auto-margin-left

## Popover Details
- minWidth: 340, maxHeight: 400
- Contains `<Command>` with `shouldFilter={true}`
- `onOpenAutoFocus` prevents default to let cmdk manage focus
- Search input: auto-focused, styled with no border

## Model Item Details
- Displays checkmark (accent color when selected, transparent when not)
- Model ID in mono font with ellipsis overflow
- Role badge: uppercase, color from ROLE_COLORS map

## Role Badge Colors
| Role | Background | Foreground |
|---|---|---|
| chat | `var(--cs-accent-bg)` | `var(--cs-accent)` |
| embedding | green-tinted | `#6b8f71` |
| tts | gold-tinted | `#c4a035` |
| image | purple-tinted | `#8b5cf6` |

## Source Indicator Colors
| Source | Color |
|---|---|
| live | `#22c55e` (green) |
| cache | `#3b82f6` (blue) |
| fallback | `#f59e0b` (amber) |

## Cache Behavior
- Key format: `"{providerType}:{capabilityFilter}"` (empty string if no filter)
- Stored in `useRef<Map<string, CachedResult>>()`
- Live fetch result stored with `source: 'cache'` for subsequent access
- Fallback results stored as `source: 'fallback'`
- Refresh button deletes cache key and calls `fetchModels(true)`
- Cache persists for component lifetime (not across unmount/remount)

## Accessibility
- Trigger: `aria-haspopup="listbox"`, `aria-expanded`
- Remove badge: `role="button"`, `tabIndex={0}`, `aria-label="Retirer {model}"`
- Refresh button: `aria-label="Rafraichir la liste des modeles"`
- cmdk Command: `label="Rechercher un modele"`
- Keyboard: Enter/Space on badge removes model, cmdk handles arrow keys and Enter for selection

## Edge Cases
- API returns plain array (no `models` key): handled by fallback parsing
- API returns `source: 'fallback'`: shown as fallback in UI
- Custom model entry: `trimmedSearch.length > 0 && !models.some(m => m.id === trimmedSearch) && !selectedModels.includes(trimmedSearch)`
- Adding custom model clears search input
- Removing a model via badge X: uses `stopPropagation` and `preventDefault` to avoid opening popover
- Search reset on open: `setSearch('')` in useEffect
- Error state: sets source to 'fallback', models to empty array
- Disabled state: `opacity: 0.5`, `pointerEvents: 'none'`
