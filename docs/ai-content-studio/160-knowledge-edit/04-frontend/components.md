# Composants Frontend -- Knowledge Edit (Specifications detaillees)

**Fichier** : `apps/web/src/app/admin/content-studio-v2/ai-engine/knowledge/page.tsx`  
**Pattern** : Tous les composants sont definis inline dans le composant page (coherent avec l'existant)

---

## 1. Modifications du composant existant KnowledgeBasePage

### 1.1 Nouveaux imports

```typescript
import {
  // Existants
  BookOpen, ChevronDown, ChevronRight, FileText, Loader2,
  Plus, Sparkles, AlertTriangle, CheckCircle2, ArrowLeft,
  Database, Hash, Trash2, Link as LinkIcon, Type,
  // Nouveaux
  Pencil, Eye, AlertCircle, RefreshCw, X,
} from 'lucide-react';

// Nouveau primitif
import { Dialog } from '@/components/admin/content-studio-v2/primitives';
import { Skeleton } from '@/components/admin/content-studio-v2/primitives';
```

### 1.2 Nouveau type DocumentDetail

```typescript
interface DocumentDetail {
  id: string;
  collectionId: string;
  title: string;
  sourceType: string;
  sourceUrl: string | null;
  contentText: string | null;
  metadata: Record<string, unknown> | null;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
}
```

### 1.3 Nouveaux useState

A ajouter dans le composant `KnowledgeBasePage`, apres les useState existants :

```typescript
// === EDITION COLLECTION ===
const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
const [editColName, setEditColName] = useState('');
const [editColDesc, setEditColDesc] = useState('');
const [editColCategory, setEditColCategory] = useState('');
const [savingCol, setSavingCol] = useState(false);
const [editColError, setEditColError] = useState<string | null>(null);

// === VISUALISATION DOCUMENT ===
const [viewingDoc, setViewingDoc] = useState<{
  slug: string; docId: string; title: string
} | null>(null);
const [viewDocData, setViewDocData] = useState<DocumentDetail | null>(null);
const [loadingDocView, setLoadingDocView] = useState(false);
const [viewDocError, setViewDocError] = useState<string | null>(null);

// === EDITION DOCUMENT ===
const [editingDoc, setEditingDoc] = useState<{
  slug: string; docId: string; collectionId: string
} | null>(null);
const [editDocTitle, setEditDocTitle] = useState('');
const [editDocContent, setEditDocContent] = useState('');
const [editDocOriginalContent, setEditDocOriginalContent] = useState('');
const [loadingDocEdit, setLoadingDocEdit] = useState(false);
const [savingDoc, setSavingDoc] = useState(false);
const [editDocError, setEditDocError] = useState<string | null>(null);

// === CONFIRMATION RE-CHUNK ===
const [confirmReChunk, setConfirmReChunk] = useState(false);
```

### 1.4 Valeurs derivees (computed)

```typescript
// Dirty checking pour la collection
const isCollectionDirty = editingCollection
  ? (
    editColName.trim() !== editingCollection.name ||
    (editColDesc.trim() || null) !== editingCollection.description ||
    editColCategory !== editingCollection.category
  )
  : false;

// Dirty checking pour le document
const isDocumentDirty =
  editDocTitle.trim() !== '' &&
  (editDocTitle !== editDocOriginalContent || editDocContent !== editDocOriginalContent);

// Detection de modification du contenu (declencheur de re-chunk)
const isDocumentContentDirty = editDocContent !== editDocOriginalContent;
```

---

## 2. Structure des nouvelles fonctions handlers

### 2.1 openEditCollection

```typescript
function openEditCollection(col: Collection) {
  setEditingCollection(col);
  setEditColName(col.name);
  setEditColDesc(col.description ?? '');
  setEditColCategory(col.category);
  setEditColError(null);
}
```

### 2.2 handleCloseEditCollection

```typescript
function handleCloseEditCollection() {
  if (isCollectionDirty && !window.confirm('Abandonner les modifications non sauvegardees ?')) {
    return;
  }
  setEditingCollection(null);
  setEditColError(null);
}
```

### 2.3 handleSaveCollection

```typescript
async function handleSaveCollection() {
  if (!editingCollection || !editColName.trim()) return;

  const body: Record<string, unknown> = {};
  if (editColName.trim() !== editingCollection.name) body.name = editColName.trim();
  const desc = editColDesc.trim() || null;
  if (desc !== editingCollection.description) body.description = desc;
  if (editColCategory !== editingCollection.category) body.category = editColCategory;

  if (Object.keys(body).length === 0) {
    setEditingCollection(null);
    return;
  }

  setSavingCol(true);
  setEditColError(null);
  try {
    const res = await fetch(
      `/api/admin/ai-engine/knowledge/${editingCollection.slug}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(
        data?.error?.message ?? data?.error ?? data?.details?.[0]?.message ?? `Erreur ${res.status}`,
      );
    }
    setEditingCollection(null);
    setIngestSuccess(`Collection "${editColName.trim()}" mise a jour`);
    await fetchCollections();
  } catch (e: unknown) {
    setEditColError(e instanceof Error ? e.message : 'Erreur inconnue');
  } finally {
    setSavingCol(false);
  }
}
```

### 2.4 handleViewDocument

```typescript
async function handleViewDocument(slug: string, docId: string, title: string) {
  setViewingDoc({ slug, docId, title });
  setLoadingDocView(true);
  setViewDocError(null);
  setViewDocData(null);
  try {
    const res = await fetch(`/api/admin/ai-engine/knowledge/${slug}/documents/${docId}`);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error?.message ?? `Erreur ${res.status}`);
    }
    const data = await res.json();
    setViewDocData(data.document);
  } catch (e: unknown) {
    setViewDocError(e instanceof Error ? e.message : 'Erreur inconnue');
  } finally {
    setLoadingDocView(false);
  }
}
```

### 2.5 openEditDocument

```typescript
async function openEditDocument(slug: string, docId: string, collectionId: string) {
  setEditingDoc({ slug, docId, collectionId });
  setLoadingDocEdit(true);
  setSavingDoc(false);
  setEditDocError(null);
  setConfirmReChunk(false);
  try {
    const res = await fetch(`/api/admin/ai-engine/knowledge/${slug}/documents/${docId}`);
    if (!res.ok) throw new Error(`Erreur ${res.status}`);
    const data = await res.json();
    const doc = data.document;
    setEditDocTitle(doc.title);
    setEditDocContent(doc.contentText ?? '');
    setEditDocOriginalContent(doc.contentText ?? '');
  } catch (e: unknown) {
    setEditDocError(e instanceof Error ? e.message : 'Erreur au chargement du document');
  } finally {
    setLoadingDocEdit(false);
  }
}
```

### 2.6 handleCloseEditDocument

```typescript
function handleCloseEditDocument() {
  const dirty = editDocTitle !== '' || editDocContent !== editDocOriginalContent;
  if (dirty && !window.confirm('Abandonner les modifications non sauvegardees ?')) {
    return;
  }
  setEditingDoc(null);
  setEditDocError(null);
  setConfirmReChunk(false);
}
```

### 2.7 handleSaveDocument

```typescript
async function handleSaveDocument() {
  if (!editingDoc) return;

  const contentChanged = editDocContent !== editDocOriginalContent;

  // Si contenu modifie et pas encore confirme -> afficher la confirmation
  if (contentChanged && !confirmReChunk) {
    setConfirmReChunk(true);
    return;
  }

  setSavingDoc(true);
  setEditDocError(null);
  setConfirmReChunk(false);

  try {
    const body: Record<string, string> = {};
    if (editDocTitle.trim()) body.title = editDocTitle.trim();
    if (contentChanged) body.content = editDocContent;

    if (Object.keys(body).length === 0) {
      setEditingDoc(null);
      return;
    }

    const res = await fetch(
      `/api/admin/ai-engine/knowledge/${editingDoc.slug}/documents/${editingDoc.docId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(
        data?.error?.message ?? data?.detail ?? data?.error ?? `Erreur ${res.status}`,
      );
    }
    const result = await res.json();
    setEditingDoc(null);
    setIngestSuccess(
      result.reChunked
        ? `Document mis a jour avec ${result.chunkCount} chunks re-generes`
        : 'Titre du document mis a jour',
    );
    await fetchDocuments(editingDoc.slug);
    await fetchCollections();
  } catch (e: unknown) {
    setEditDocError(e instanceof Error ? e.message : 'Erreur inconnue');
  } finally {
    setSavingDoc(false);
  }
}
```

---

## 3. Modifications dans le JSX existant

### 3.1 Ajout des boutons sur les lignes de document

Dans la boucle `docs.map((doc) => ...)`, ajouter avant le bouton Trash2 existant :

```tsx
{/* Bouton Voir */}
<button
  onClick={(e) => {
    e.stopPropagation();
    handleViewDocument(col.slug, doc.id, doc.title);
  }}
  title={`Voir le contenu de ${doc.title}`}
  aria-label={`Voir le contenu de ${doc.title}`}
  style={{
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderRadius: 'var(--cs-radius-sm)',
    border: 'none',
    background: 'transparent',
    color: 'var(--cs-fg-muted)',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'all var(--cs-motion-fast) var(--cs-easing)',
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.background = 'var(--cs-accent-bg)';
    e.currentTarget.style.color = 'var(--cs-accent)';
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.background = 'transparent';
    e.currentTarget.style.color = 'var(--cs-fg-muted)';
  }}
>
  <Eye size={13} />
</button>

{/* Bouton Modifier */}
<button
  onClick={(e) => {
    e.stopPropagation();
    openEditDocument(col.slug, doc.id, col.id);
  }}
  title={`Modifier le document ${doc.title}`}
  aria-label={`Modifier le document ${doc.title}`}
  style={{
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderRadius: 'var(--cs-radius-sm)',
    border: 'none',
    background: 'transparent',
    color: 'var(--cs-fg-muted)',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'all var(--cs-motion-fast) var(--cs-easing)',
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.background = 'var(--cs-accent-bg)';
    e.currentTarget.style.color = 'var(--cs-accent)';
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.background = 'transparent';
    e.currentTarget.style.color = 'var(--cs-fg-muted)';
  }}
>
  <Pencil size={13} />
</button>
```

### 3.2 Ajout du bouton "Modifier" dans la zone d'actions de collection

Dans la zone `CollectionActions` (en bas du panneau expand), ajouter avant le bouton "Supprimer la collection" :

```tsx
<Button
  variant="ghost"
  size="sm"
  leftIcon={<Pencil size={12} />}
  onClick={() => openEditCollection(col)}
  aria-label={`Modifier la collection ${col.name}`}
>
  Modifier
</Button>
```

### 3.3 Placement des modales dans le JSX

Les modales sont placees a la fin du composant, juste avant la balise fermante `</div>` du return principal :

```tsx
return (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
    {/* ... contenu existant ... */}

    {/* === MODALES === */}

    {/* Collection Edit Dialog */}
    {editingCollection && (
      <Dialog ...> ... </Dialog>
    )}

    {/* Document View Dialog */}
    {viewingDoc && (
      <Dialog ...> ... </Dialog>
    )}

    {/* Document Edit Dialog */}
    {editingDoc && !confirmReChunk && (
      <Dialog ...> ... </Dialog>
    )}

    {/* Confirm Re-Chunk Dialog */}
    {confirmReChunk && (
      <Dialog ...> ... </Dialog>
    )}
  </div>
);
```

---

## 4. Code structure du fichier final

```
page.tsx
  |
  |-- Imports (lucide, primitives, etc.)
  |-- Interfaces (Collection, Document, DocumentDetail, EmbedResult)
  |-- Constants (CATEGORY_BADGE, COLLECTION_CATEGORIES)
  |-- Helpers (slugify, formatDate)
  |
  |-- KnowledgeBasePage()
  |   |-- State existant (collections, loading, error, expanded, documents, ...)
  |   |-- State nouveau (editingCollection, viewingDoc, editingDoc, ...)
  |   |-- Computed (isCollectionDirty, isDocumentContentDirty)
  |   |
  |   |-- Handlers existants (fetchCollections, fetchDocuments, handleIngest, ...)
  |   |-- Handlers nouveaux :
  |   |   |-- openEditCollection()
  |   |   |-- handleCloseEditCollection()
  |   |   |-- handleSaveCollection()
  |   |   |-- handleViewDocument()
  |   |   |-- openEditDocument()
  |   |   |-- handleCloseEditDocument()
  |   |   |-- handleSaveDocument()
  |   |
  |   |-- JSX Return :
  |       |-- Header (existant)
  |       |-- Alert banners (existant)
  |       |-- Confirm delete dialogs (existant)
  |       |-- New collection form (existant)
  |       |-- Stats cards (existant)
  |       |-- Collection list (modifie : ajout boutons edit/view/edit sur les lignes)
  |       |-- Empty state (existant)
  |       |-- CollectionEditDialog (NOUVEAU)
  |       |-- DocumentViewDialog (NOUVEAU)
  |       |-- DocumentEditDialog (NOUVEAU)
  |       |-- ConfirmReChunkDialog (NOUVEAU)
  |
  |-- StatCard() (existant, inchange)
```

---

## 5. Taille estimee des ajouts

| Element | Lignes estimees | Description |
|---------|----------------|-------------|
| Nouveaux useState | ~25 lignes | 15 nouveaux etats |
| Computed values | ~10 lignes | Dirty checking |
| Handlers | ~120 lignes | 7 nouvelles fonctions |
| Boutons dans les listes | ~60 lignes | Eye, Pencil sur les lignes |
| CollectionEditDialog | ~100 lignes | JSX de la modale |
| DocumentViewDialog | ~110 lignes | JSX de la modale |
| DocumentEditDialog | ~120 lignes | JSX de la modale |
| ConfirmReChunkDialog | ~50 lignes | JSX du dialogue |
| **TOTAL** | **~595 lignes** | Ajoutees aux ~1170 existantes |

Le fichier final aura environ **1765 lignes**. C'est consequent mais coherent avec le pattern existant d'un composant page monolithique. Si le fichier devient trop volumineux, une refactorisation en sous-composants pourra etre envisagee dans un sprint ulterieur.
