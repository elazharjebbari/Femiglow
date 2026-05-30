# F08 -- Knowledge Documents

## Feature ID
F08-knowledge-documents

## Description
Within an expanded knowledge collection, operators can view the document list, add new documents (via text or URL), view document content in a modal overlay, edit documents (title and content with re-chunking warning), and delete documents with confirmation. Each document shows its title, chunk count badge, source type, creation date, and action buttons (view, edit, delete).

## UI Location
- **Page path**: `/admin/content-studio-v2/ai-engine/knowledge`
- **Section**: Expanded panel inside a collection section
- **Modals**: View modal (overlay), Edit modal (overlay)

## Components Involved
| Component | Path |
|---|---|
| `KnowledgeBasePage` | `apps/web/src/app/admin/content-studio-v2/ai-engine/knowledge/page.tsx` |

## API Routes
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/admin/ai-engine/knowledge/[slug]/documents` | List documents in collection |
| POST | `/api/admin/ai-engine/knowledge/[slug]/documents` | Add a document (text or URL) |
| GET | `/api/admin/ai-engine/knowledge/[slug]/documents/[docId]` | Get full document content |
| PATCH | `/api/admin/ai-engine/knowledge/[slug]/documents/[docId]` | Update title/content |
| DELETE | `/api/admin/ai-engine/knowledge/[slug]/documents/[docId]` | Delete a document |

## Data Flow

### Document List
1. Collection expanded -> `fetchDocuments(slug)` called (first time)
2. Response: `{ documents: Document[] }`
3. Documents stored in `documents[slug]` state map
4. Each document rendered as a row with icon, title, badge, source type, date, action buttons

### Add Document
1. "Ajouter un document" button -> `setShowForm(col.slug)`
2. Source type toggle: Text or URL (segmented control)
3. Text mode: title + content textarea
4. URL mode: URL input field
5. Submit: POST `/knowledge/{slug}/documents` with `{ sourceType, title, content }` or `{ sourceType, url }`
6. Success: green banner "Document ingere avec N chunks", form resets, documents + collections refresh

### View Document
1. Eye button -> `openViewDocument(slug, doc)`
2. Fetches full content via GET `/knowledge/{slug}/documents/{docId}`
3. Modal overlay with title, metadata, content in `<pre>` tag

### Edit Document
1. Pencil button -> `openEditDocument(slug, doc)`
2. Fetches full content, populates title and content fields
3. Modal overlay with title input, content textarea, character count
4. Re-chunking warning: shown when content has been modified (yellow banner)
5. Save: PATCH with changed fields; if content changed, re-chunking occurs

### Delete Document
1. Trash button -> sets `confirmDeleteDoc` state
2. Red confirm banner with document title
3. Confirm: DELETE `/knowledge/{slug}/documents/{docId}`
4. Success: green banner "Document X supprime"

## Document Shape
```typescript
{
  id: string;
  title: string;
  sourceType: string;  // "text" | "url"
  chunkCount: number;
  createdAt: string;
}
```

## States
| State | Condition | Visual |
|---|---|---|
| Loading docs | `loadingDocs === collection.slug` | Loader2 spinner + "Chargement des documents..." |
| Documents loaded | `docs.length > 0` | Document rows |
| No documents | `docs.length === 0` | Text "Aucun document dans cette collection." |
| Add form visible | `showForm === collection.slug` | Inline form with source type toggle |
| Ingesting | `ingesting === true` | Submit button loading, inputs disabled |
| Ingest error | `ingestError !== null` | Red error inline in form |
| Ingest success | `ingestSuccess !== null` | Green success banner |
| View modal | `viewingDoc !== null` | Fixed overlay with content |
| View loading | `loadingDocContent === true` | Spinner in modal |
| Edit modal | `editingDoc !== null` | Fixed overlay with form |
| Edit saving | `savingDoc === true` | Enregistrer button loading |
| Edit error | `editDocError !== null` | Red error inline in modal |
| Re-chunk warning | Content changed from original | Yellow warning banner |
| Confirm delete | `confirmDeleteDoc !== null` | Red confirm banner |
| Deleting | `deletingDoc === true` | Confirm button loading |

## Document Row Details
- FileText icon
- Title: mono font, ellipsis overflow
- Chunk badge: green "N chunks" (success) if > 0, yellow "Non indexe" (warning) if 0
- Source type: mono font, muted
- Date: French locale format
- Action buttons: View (Eye), Edit (Pencil), Delete (Trash2) -- all 28x28px icon buttons with hover effects

## Add Form -- Source Type Toggle
- Segmented control: "Texte" (Type icon) and "URL" (Link icon)
- Active segment: accent background + color, bold weight
- Inactive segment: transparent background, muted color
- Text mode: Title input + Content textarea (6 rows)
- URL mode: URL input with LinkIcon left addon
- Validation: text mode disabled if `!formTitle.trim() || !formContent.trim()`; URL mode disabled if `!formUrl.trim()`

## View Modal
- Fixed overlay: `rgba(0,0,0,0.5)`, click overlay to close
- Modal panel: max-width 700px, max-height 80vh
- Header: title, metadata (type, chunks, created), close button (X)
- Content: `<pre>` with `whiteSpace: pre-wrap`
- Loading: spinner during content fetch
- No content: "Aucun contenu disponible."

## Edit Modal
- Fixed overlay: click overlay closes (unless saving)
- Modal panel: max-width 700px, max-height 85vh
- Header: "Modifier le document", close button
- Fields: Title input, Content textarea (14 rows) with character count
- Re-chunk warning: yellow banner with RefreshCw icon, shown when `editDocContent !== editDocOrigContent && editDocOrigContent !== ''`
- Warning text: "Le contenu a ete modifie. L'enregistrement declenchera un re-chunking..."
- Save: PATCH sends only changed fields
- Response with `reChunked: true`: success message includes chunk count

## Validation Rules
- Add text: both title and content required
- Add URL: URL required
- Edit: title required (`!editDocTitle.trim()` disables save)
- Edit: content changes trigger re-chunk warning
- Delete: confirm banner required

## Design Tokens
| Token | Usage |
|---|---|
| `--cs-bg-base` | Expanded panel background |
| `--cs-bg-elevated` | Document row, modal, form background |
| `--cs-border` | Document row border, form border |
| `--cs-accent` | Active source toggle segment |
| `--cs-accent-bg` | Active segment background, view button hover |
| `--cs-danger` | Delete button hover, confirm banner |
| `--cs-warning` | Non-indexed badge, re-chunk warning |
| `--cs-warning-bg` | Re-chunk warning background |
| `--cs-success` | Indexed badge, success banner |

## Accessibility
- Document action buttons: `title` attributes for tooltip (e.g., "Voir le contenu", "Modifier ce document", "Supprimer ce document")
- Modal overlay: click-to-close on background
- Modal close button: X icon button
- Edit modal: click-to-close disabled while saving
- Source toggle: `<button>` elements (not radio inputs)

## Edge Cases
- Document with 0 chunks: badge shows "Non indexe" in warning tone
- View modal with null content: shows "Aucun contenu disponible."
- Edit modal: content fetch happens asynchronously after modal opens (may show empty initially)
- Edit with no changes: `Object.keys(body).length === 0` -> closes modal without API call
- Edit with only title change: no re-chunk, PATCH sends only `{ title }`
- Edit with content change: PATCH sends `{ content }`, response `reChunked: true` with new chunk count
- Delete success: refreshes both documents and collections (to update counts)
- Ingest success: refreshes both documents and collections
- Multiple action states: `confirmDeleteDoc`, `viewingDoc`, `editingDoc` are mutually managed by user interaction
- Hover effects on action buttons: background and color change on mouseEnter/mouseLeave (inline event handlers)
