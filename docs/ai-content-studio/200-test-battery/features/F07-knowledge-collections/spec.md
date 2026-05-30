# F07 -- Knowledge Collections

## Feature ID
F07-knowledge-collections

## Description
The Knowledge Base page displays a list of knowledge collections with expand/collapse behavior, category badges, document/chunk counters, and supports creating, editing, and deleting collections. A stats dashboard at the top shows aggregate counts (collections, documents, chunks, pending). Collections can be expanded to reveal their documents (covered in F08).

## UI Location
- **Page path**: `/admin/content-studio-v2/ai-engine/knowledge`
- **Section**: Collection list below stats dashboard and action header

## Components Involved
| Component | Path |
|---|---|
| `KnowledgeBasePage` | `apps/web/src/app/admin/content-studio-v2/ai-engine/knowledge/page.tsx` |
| `StatCard` | Same file, internal sub-component |

## API Routes
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/admin/ai-engine/knowledge` | List all collections |
| POST | `/api/admin/ai-engine/knowledge` | Create a new collection |
| PATCH | `/api/admin/ai-engine/knowledge/[slug]` | Update a collection |
| DELETE | `/api/admin/ai-engine/knowledge/[slug]` | Delete a collection |

## Data Flow
1. On mount: `fetchCollections()` calls GET `/knowledge`
2. Response: `{ collections: Collection[] }`
3. Collections rendered as expandable sections
4. Expand: click toggles `expandedId`, triggers `fetchDocuments(slug)` on first expand
5. Create: "Nouvelle collection" button -> inline form
6. Edit: "Modifier" button in expanded section -> edit form with pre-populated values
7. Delete: "Supprimer la collection" button -> confirm dialog -> DELETE
8. All mutations refresh collections via `fetchCollections()`

## Collection Shape
```typescript
{
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  documentCount: number;
  chunkCount: number;
  lastIndexedAt: string | null;
  isActive: boolean;
}
```

## States
| State | Condition | Visual |
|---|---|---|
| Loading | `loading === true` | 4 skeleton placeholder divs |
| Error | `error !== null` | Red error section with AlertTriangle |
| Empty | `collections.length === 0` | Centered empty state with BookOpen icon, "Aucune collection" |
| List | `collections.length > 0` | Stacked expandable sections |
| Collapsed | `expandedId !== collection.id` | ChevronRight icon, summary stats |
| Expanded | `expandedId === collection.id` | ChevronDown icon, documents panel below |
| New collection form | `showNewCollection === true` | Inline form above collection list |
| Creating | `creatingCol === true` | Form button loading, inputs disabled |
| Create error | `createColError !== null` | Red error inline in form |
| Edit form | `editingCol !== null` | Inline edit form with accent border |
| Saving edit | `savingCol === true` | Form button loading, inputs disabled |
| Edit error | `editColError !== null` | Red error inline in form |
| Confirm delete | `confirmDeleteCol !== null` | Red confirm banner |
| Deleting | `deletingCol === true` | Confirm button loading |
| Success feedback | `ingestSuccess !== null` | Green success banner |

## Category Badges
| Category | Label | Tone |
|---|---|---|
| science | Science | accent |
| platform | Plateforme | violet |
| strategy | Strategie | saffron |
| operations | Operations | clay |
| trends | Tendances | warning |
| brand | Marque | sage |
| craft | Craft | neutral |

## Create Collection Form Fields
| Field | Type | Constraints |
|---|---|---|
| Nom | text | Required (`!newColName.trim()` disables save) |
| Slug | text | Required, auto-generated from name via `slugify()`, restricted to `[a-z0-9-]` |
| Description | text | Optional |
| Categorie | select | 7 options: Marque, Psychologie, Plateforme, Tendances, Produit, Viral, Production |

### Slug Auto-generation
- `slugify(text)`: lowercase, NFD normalize, strip diacritics, replace non-alphanumeric with hyphens, trim leading/trailing hyphens
- Auto-sync: slug updates when name changes AND slug matches the previous auto-generated value
- Manual override: if user edits slug directly, auto-sync stops

## Edit Collection Form Fields
| Field | Type | Constraints |
|---|---|---|
| Nom | text | Pre-populated from collection |
| Categorie | select | Pre-populated from collection |
| Description | text | Pre-populated from collection |
- Slug displayed as read-only label (not editable)
- PATCH only sends changed fields; if no changes, form closes without API call

## Stats Dashboard
| Stat | Value | Icon |
|---|---|---|
| Collections | `collections.length` | BookOpen |
| Documents | `sum(c.documentCount)` | FileText |
| Chunks | `sum(c.chunkCount)` | Hash |
| En attente | `collections with docs > 0 && chunks === 0` | Database |

- "En attente" stat uses warning tone when > 0, success tone when 0

## Design Tokens
| Token | Usage |
|---|---|
| `--cs-bg-elevated` | Collection card, form, stat card background |
| `--cs-border-hair` | Collection card border |
| `--cs-accent` | Edit form border, badge tone |
| `--cs-danger` | Delete button color, confirm banner |
| `--cs-fg-primary` | Collection name |
| `--cs-fg-muted` | Description, stats, chevron |

## Accessibility
- Collection headers are `<button>` elements (clickable to expand/collapse)
- Buttons have `cursor: pointer` and full width
- Delete/edit actions are `<Button>` components
- Forms use `<Input>` and native `<select>` elements
- Success/error banners include icon + text

## Edge Cases
- Empty collection list: centered empty state, no stats dashboard interaction
- Expanding same collection twice: toggles closed
- First expand: fetches documents; subsequent expands: uses cached documents from state
- Slug auto-sync: only updates if user has not manually edited the slug
- Edit with no changes: `Object.keys(body).length === 0` -> closes form silently
- Collection with 0 documents: expanded section shows "Aucun document dans cette collection."
- Delete confirm: red banner with collection name bolded
- Success messages: "Collection X creee", "Collection mise a jour", "Collection X supprimee"
- Date formatting: `lastIndexedAt` shown in French locale "1 dec. 2025, 10:30" or "Jamais"
