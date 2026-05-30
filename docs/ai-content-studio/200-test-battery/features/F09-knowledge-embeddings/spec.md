# F09 -- Knowledge Embeddings

## Feature ID
F09-knowledge-embeddings

## Description
The embedding generation feature allows operators to trigger vector embedding computation for all pending (un-indexed) knowledge documents. The "Generer les embeddings" button in the Knowledge page header uses OpenAI's text-embedding-3-small model to chunk documents, compute embeddings, and store them for RAG retrieval. The UI provides feedback via success/error banners and warns when pending documents exist via the stats dashboard.

## UI Location
- **Page path**: `/admin/content-studio-v2/ai-engine/knowledge`
- **Section**: Header action area (top-right), banners below header, stats dashboard "En attente" card

## Components Involved
| Component | Path |
|---|---|
| `KnowledgeBasePage` | `apps/web/src/app/admin/content-studio-v2/ai-engine/knowledge/page.tsx` |
| `StatCard` | Same file, internal sub-component |

## API Routes
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/admin/ai-engine/knowledge/embed` | Trigger embedding generation |

### Embed Route Details
- `runtime: 'nodejs'`, `maxDuration: 300` (5 minutes)
- Requires admin auth
- Checks DB availability (503 if unavailable)
- Checks OpenAI API key (400 if not configured)
- Finds all documents with `chunkCount === 0` and non-empty `contentText`
- Uses `RecursiveCharacterTextSplitter`: chunkSize=1000, chunkOverlap=200
- Embeds in batches of 100 chunks
- Updates document `chunkCount` and collection counts after processing
- Returns partial success (207) if some documents errored

### Embed Response Shape
```typescript
{
  documentsProcessed: number;
  chunksCreated: number;
  errors?: string[];    // Present when some docs failed
  message?: string;     // Present when no pending docs
}
```

## Data Flow
1. User clicks "Generer les embeddings" button
2. `handleEmbed()` sets `embedding=true`, clears previous results
3. POST `/knowledge/embed` with empty body
4. On success: `embedResult` set, collections refreshed
5. On error: `embedError` set with error message
6. Finally: `embedding=false`

## States
| State | Condition | Visual |
|---|---|---|
| Idle | `!embedding && !embedResult && !embedError` | Button with Sparkles icon, enabled |
| Loading/Processing | `embedding === true` | Button in loading state (spinner), "Generer les embeddings" text |
| Success | `embedResult !== null` | Green banner with CheckCircle2 icon |
| Success with message | `embedResult.message` is set | Green banner with custom message (e.g., "Aucun document en attente") |
| Success with stats | `!embedResult.message` | Green banner with "N documents traites, M chunks crees" |
| Success with errors | `embedResult.errors.length > 0` | Green banner + red error list below |
| Error | `embedError !== null` | Red banner with AlertTriangle icon |
| Pending warning | `pendingDocs > 0` (stat card) | "En attente" stat card in warning tone |
| No pending | `pendingDocs === 0` | "En attente" stat card in success tone |

## Button Details
- Component: `<Button>` with `loading={embedding}` and `leftIcon={<Sparkles size={14} />}`
- Text: "Generer les embeddings"
- Position: Header right, next to "Nouvelle collection" button
- Loading state: shows spinner, text preserved

## Success Banner
- Background: `var(--cs-success-bg)`
- Border: `1px solid var(--cs-success)`
- Icon: CheckCircle2 in success color
- Content:
  - If `embedResult.message`: displays the message directly
  - Otherwise: "N document(s) traite(s), **M** chunks crees" (with pluralization)
  - If `embedResult.errors`: unordered list of errors in danger color below stats

## Error Banner
- Background: `var(--cs-danger-bg)`
- Border: `1px solid var(--cs-danger)`
- Icon: AlertTriangle in danger color
- Content: error message text

## Pending Documents Detection
```typescript
const pendingDocs = collections.filter(
  (c) => c.documentCount > 0 && c.chunkCount === 0
).length;
```
- Counts collections that have documents but no chunks
- Displayed in "En attente" stat card
- Warning tone (yellow) when > 0, success tone (green) when 0

## Design Tokens
| Token | Usage |
|---|---|
| `--cs-success` | Success banner border and icon |
| `--cs-success-bg` | Success banner background, stat card (0 pending) |
| `--cs-danger` | Error banner border and icon, error list |
| `--cs-danger-bg` | Error banner background |
| `--cs-warning` | Pending stat card icon color |
| `--cs-warning-bg` | Pending stat card icon background |
| `--cs-accent` | Sparkles icon default color |

## Accessibility
- Button: standard `<Button>` component with loading state
- Banners: include icon + text for non-color-only indication
- Error list: `<ul>` with `<li>` items
- Pluralization: correct French grammar for documents/chunks counts

## Edge Cases
- No pending documents: API returns `{ documentsProcessed: 0, chunksCreated: 0, message: "Aucun document en attente d'indexation" }`
- Banner shows the message text directly
- Partial failure: 207 status, `errors` array present alongside successful stats
- Error list renders below success stats in the same banner
- DB unavailable: 503 with "Base de donnees indisponible"
- No OpenAI key: 400 with "Cle API OpenAI non configuree"
- Very large batch: maxDuration 300s (5 min) protects against timeout
- Batch processing: 100 chunks per embedding API call
- Multiple clicks: button loading state prevents double-trigger
- Previous result cleared on new click: `setEmbedResult(null)`, `setEmbedError(null)`
- Collections refresh after successful embed: updates chunk counts in UI
- Pluralization: "1 document traite" vs "2 documents traites"
