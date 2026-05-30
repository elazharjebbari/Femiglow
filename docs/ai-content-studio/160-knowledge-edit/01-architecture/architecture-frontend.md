# Architecture Frontend -- Knowledge Edit

**Module** : AI Engine / Knowledge Base / Page UI  
**Fichier principal** : `apps/web/src/app/admin/content-studio-v2/ai-engine/knowledge/page.tsx`  
**Design System** : CS v2 (ivory + terracotta palette)

---

## 1. Vue d'ensemble

L'architecture frontend de la feature Knowledge Edit s'integre dans la page existante `KnowledgeBasePage` en ajoutant trois composants modaux et les hooks de gestion d'etat associes.

### 1.1 Arbre de composants actuel

```
KnowledgeBasePage
  |-- Header (titre + boutons)
  |-- AlertBanners (succes, erreur, embed)
  |-- ConfirmDeleteDoc (section inline)
  |-- ConfirmDeleteCol (section inline)
  |-- NewCollectionForm (section inline)
  |-- StatCards (4x StatCard)
  |-- CollectionList
  |   |-- CollectionRow (button expandable)
  |   |   |-- Badge (categorie)
  |   |   |-- Counts (docs, chunks, indexe)
  |   |-- ExpandedPanel
  |       |-- DocumentRow[]
  |       |   |-- Badge (indexe/non indexe)
  |       |   |-- DeleteButton
  |       |-- IngestForm (text/url)
  |       |-- CollectionActions (ajouter doc, supprimer col)
  |-- EmptyState
```

### 1.2 Arbre de composants apres ajout

```
KnowledgeBasePage
  |-- (existant, identique)
  |-- CollectionEditDialog  <-- NOUVEAU
  |-- DocumentViewDialog    <-- NOUVEAU
  |-- DocumentEditDialog    <-- NOUVEAU
  |-- ConfirmReChunkDialog  <-- NOUVEAU
  |
  |-- CollectionList
  |   |-- CollectionRow
  |   |   |-- EditButton (crayon) <-- NOUVEAU
  |   |-- ExpandedPanel
  |       |-- DocumentRow[]
  |       |   |-- ViewButton (oeil)   <-- NOUVEAU
  |       |   |-- EditButton (crayon) <-- NOUVEAU
  |       |   |-- DeleteButton (existant)
```

---

## 2. Gestion de l'etat

### 2.1 Nouveaux etats dans KnowledgeBasePage

Le composant `KnowledgeBasePage` est un composant "use client" qui gere tout l'etat localement via `useState`. Les nouveaux etats s'ajoutent aux etats existants :

```typescript
// --- EDITION COLLECTION ---
const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
const [editColName, setEditColName] = useState('');
const [editColDesc, setEditColDesc] = useState('');
const [editColCategory, setEditColCategory] = useState('');
const [savingCol, setSavingCol] = useState(false);
const [editColError, setEditColError] = useState<string | null>(null);

// --- VISUALISATION DOCUMENT ---
const [viewingDoc, setViewingDoc] = useState<{
  slug: string;
  docId: string;
  title: string;
} | null>(null);
const [viewDocData, setViewDocData] = useState<DocumentDetail | null>(null);
const [loadingDocView, setLoadingDocView] = useState(false);
const [viewDocError, setViewDocError] = useState<string | null>(null);

// --- EDITION DOCUMENT ---
const [editingDoc, setEditingDoc] = useState<{
  slug: string;
  docId: string;
  collectionId: string;
} | null>(null);
const [editDocTitle, setEditDocTitle] = useState('');
const [editDocContent, setEditDocContent] = useState('');
const [editDocOriginalContent, setEditDocOriginalContent] = useState('');
const [savingDoc, setSavingDoc] = useState(false);
const [editDocError, setEditDocError] = useState<string | null>(null);

// --- CONFIRMATION RE-CHUNK ---
const [confirmReChunk, setConfirmReChunk] = useState(false);
const [reChunkChunkCount, setReChunkChunkCount] = useState(0);
```

### 2.2 Interface DocumentDetail (nouveau type frontend)

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

---

## 3. Fonctions handlers

### 3.1 handleEditCollection -- Ouverture du formulaire

```typescript
function openEditCollection(col: Collection) {
  setEditingCollection(col);
  setEditColName(col.name);
  setEditColDesc(col.description ?? '');
  setEditColCategory(col.category);
  setEditColError(null);
}
```

### 3.2 handleSaveCollection -- Sauvegarde

```typescript
async function handleSaveCollection() {
  if (!editingCollection || !editColName.trim()) return;
  setSavingCol(true);
  setEditColError(null);
  try {
    const body: Record<string, unknown> = {};
    if (editColName.trim() !== editingCollection.name) {
      body.name = editColName.trim();
    }
    const newDesc = editColDesc.trim() || null;
    if (newDesc !== editingCollection.description) {
      body.description = newDesc;
    }
    if (editColCategory !== editingCollection.category) {
      body.category = editColCategory;
    }

    if (Object.keys(body).length === 0) {
      // Aucun changement
      setEditingCollection(null);
      return;
    }

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
      throw new Error(data?.error?.message ?? data?.error ?? `Erreur ${res.status}`);
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

### 3.3 handleViewDocument -- Chargement du contenu

```typescript
async function handleViewDocument(slug: string, docId: string, title: string) {
  setViewingDoc({ slug, docId, title });
  setLoadingDocView(true);
  setViewDocError(null);
  setViewDocData(null);
  try {
    const res = await fetch(
      `/api/admin/ai-engine/knowledge/${slug}/documents/${docId}`,
    );
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

### 3.4 handleEditDocument -- Ouverture du formulaire d'edition

```typescript
async function openEditDocument(slug: string, docId: string, collectionId: string) {
  setEditingDoc({ slug, docId, collectionId });
  setSavingDoc(false);
  setEditDocError(null);

  // Charger le document complet si pas deja en cache
  try {
    const res = await fetch(
      `/api/admin/ai-engine/knowledge/${slug}/documents/${docId}`,
    );
    if (!res.ok) throw new Error(`Erreur ${res.status}`);
    const data = await res.json();
    setEditDocTitle(data.document.title);
    setEditDocContent(data.document.contentText ?? '');
    setEditDocOriginalContent(data.document.contentText ?? '');
  } catch (e: unknown) {
    setEditDocError(e instanceof Error ? e.message : 'Erreur au chargement');
  }
}
```

### 3.5 handleSaveDocument -- Sauvegarde avec re-chunking conditionnel

```typescript
async function handleSaveDocument() {
  if (!editingDoc) return;

  const titleChanged = editDocTitle.trim() !== '';
  const contentChanged = editDocContent !== editDocOriginalContent;

  // Si le contenu a change, demander confirmation
  if (contentChanged && !confirmReChunk) {
    setConfirmReChunk(true);
    return;
  }

  setSavingDoc(true);
  setEditDocError(null);
  setConfirmReChunk(false);
  try {
    const body: Record<string, string> = {};
    if (titleChanged) body.title = editDocTitle.trim();
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
      throw new Error(data?.error?.message ?? data?.detail ?? `Erreur ${res.status}`);
    }

    const result = await res.json();
    setEditingDoc(null);
    setIngestSuccess(
      result.reChunked
        ? `Document mis a jour avec ${result.chunkCount} chunks re-generes`
        : 'Document mis a jour',
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

## 4. Mises a jour optimistes

### 4.1 Strategie choisie : Optimisme leger

La strategie d'update optimiste choisie est un **optimisme leger** :

1. **Pendant la requete** : un indicateur de chargement est affiche (spinner dans le bouton)
2. **Apres succes** : la liste est rechargee depuis le serveur (`fetchCollections()`)
3. **Pas de mise a jour locale du state** avant la confirmation serveur

**Justification** : La simplicite est privilegiee car :
- Les operations de mise a jour sont peu frequentes (quelques fois par jour)
- Le temps de reponse pour un PATCH collection est < 500ms
- Le rechargement complet de la liste est rapide (< 200ms)
- Un optimisme total (mise a jour locale immediate) ajouterait de la complexite pour gerer le rollback en cas d'erreur

### 4.2 Exception : re-chunking

Pour le re-chunking (qui peut prendre 5-15 secondes) :
- Un indicateur de progression persiste tant que la requete est en cours
- Le bouton de soumission affiche "Re-indexation en cours..."
- La modale reste ouverte jusqu'a la reponse du serveur
- L'utilisateur ne peut pas fermer la modale pendant le traitement

---

## 5. Validation des formulaires

### 5.1 CollectionEditDialog

| Champ | Regle | Message |
|-------|-------|---------|
| `name` | Obligatoire, 1-200 caracteres | "Le nom est obligatoire" / "Le nom ne peut pas depasser 200 caracteres" |
| `description` | Optionnel, max 500 caracteres | "La description ne peut pas depasser 500 caracteres" |
| `category` | Obligatoire, valeur du menu deroulant | Toujours valide (menu pre-rempli) |

**Validation cote client** : Le bouton "Enregistrer" est desactive si `name` est vide.

### 5.2 DocumentEditDialog

| Champ | Regle | Message |
|-------|-------|---------|
| `title` | Obligatoire, 1-500 caracteres | "Le titre est obligatoire" / "Le titre ne peut pas depasser 500 caracteres" |
| `content` | Obligatoire si le document est de type "text" | "Le contenu est obligatoire" |

**Validation cote client** : Le bouton "Enregistrer" est desactive si `title` est vide ou `content` est vide.

### 5.3 Detection de modifications (dirty checking)

```typescript
const isCollectionDirty =
  editColName.trim() !== editingCollection?.name ||
  (editColDesc.trim() || null) !== editingCollection?.description ||
  editColCategory !== editingCollection?.category;

const isDocumentDirty =
  editDocTitle.trim() !== viewDocData?.title ||
  editDocContent !== editDocOriginalContent;

const isDocumentContentDirty =
  editDocContent !== editDocOriginalContent;
```

Si l'utilisateur tente de fermer une modale avec des modifications non sauvegardees, une confirmation est demandee :

```typescript
function handleCloseEditCollection() {
  if (isCollectionDirty && !window.confirm('Abandonner les modifications ?')) {
    return;
  }
  setEditingCollection(null);
}
```

---

## 6. Composants primitives utilises

Les composants existants du design system CS v2 sont reutilises :

| Composant | Import | Utilisation |
|-----------|--------|-------------|
| `Button` | `@/components/admin/content-studio-v2/primitives` | Boutons d'action (Enregistrer, Annuler, Modifier) |
| `Input` | idem | Champs de saisie (nom, titre) |
| `Badge` | idem | Affichage de la categorie |
| `Dialog` | idem | Modales d'edition et de visualisation |
| `Skeleton` | idem | Chargement du contenu du document |

### 6.1 Icones Lucide ajoutees

| Icone | Utilisation |
|-------|------------|
| `Pencil` | Bouton d'edition (collection, document) |
| `Eye` | Bouton de visualisation (document) |
| `Save` | Bouton de sauvegarde (dans la modale) |
| `X` | Bouton de fermeture (modale) |
| `AlertCircle` | Avertissement re-chunking |
| `RefreshCw` | Indicateur de re-indexation |

---

## 7. Flux de donnees

### 7.1 Edition de collection

```
User clique "Modifier" sur une collection
  |
  v
openEditCollection(col)
  -> setEditingCollection(col)
  -> Pre-remplir editColName, editColDesc, editColCategory
  |
  v
CollectionEditDialog s'affiche (Dialog)
  |
  v
User modifie les champs
  -> setEditColName(), setEditColDesc(), setEditColCategory()
  |
  v
User clique "Enregistrer"
  |
  v
handleSaveCollection()
  -> setSavingCol(true)
  -> PATCH /api/admin/ai-engine/knowledge/[slug]
  -> Si 200 : setEditingCollection(null) + fetchCollections()
  -> Si erreur : setEditColError(message)
  -> setSavingCol(false)
```

### 7.2 Visualisation de document

```
User clique "Voir" sur un document
  |
  v
handleViewDocument(slug, docId, title)
  -> setViewingDoc({ slug, docId, title })
  -> setLoadingDocView(true)
  -> GET /api/admin/ai-engine/knowledge/[slug]/documents/[docId]
  -> setViewDocData(data.document)
  -> setLoadingDocView(false)
  |
  v
DocumentViewDialog s'affiche (Dialog)
  |
  v
User peut :
  a) Cliquer "Modifier" -> openEditDocument(slug, docId, collectionId)
  b) Cliquer "Fermer"   -> setViewingDoc(null)
```

### 7.3 Edition de document

```
User clique "Modifier" (depuis la liste ou depuis le viewer)
  |
  v
openEditDocument(slug, docId, collectionId)
  -> setEditingDoc({ slug, docId, collectionId })
  -> GET /api/admin/ai-engine/knowledge/[slug]/documents/[docId]
  -> setEditDocTitle(title), setEditDocContent(contentText)
  -> setEditDocOriginalContent(contentText)
  |
  v
DocumentEditDialog s'affiche (Dialog)
  |
  v
User modifie les champs
  -> setEditDocTitle(), setEditDocContent()
  |
  v
User clique "Enregistrer"
  |
  v
handleSaveDocument()
  |
  +-- SI contenu modifie ET pas encore confirme :
  |     setConfirmReChunk(true)
  |     -> ConfirmReChunkDialog s'affiche
  |     -> User confirme : handleSaveDocument() appele a nouveau
  |
  +-- Envoi PATCH :
        setSavingDoc(true)
        PATCH /api/admin/ai-engine/knowledge/[slug]/documents/[docId]
        -> Si 200 : setEditingDoc(null) + fetchDocuments() + fetchCollections()
        -> Si erreur : setEditDocError(message)
        setSavingDoc(false)
```

---

## 8. Accessibilite (a11y)

### 8.1 Modales

- Les modales utilisent le composant `Dialog` existant qui gere :
  - `role="dialog"` + `aria-modal="true"`
  - Focus trap (le focus ne quitte pas la modale)
  - Fermeture par `Escape`
  - Retour du focus au bouton declencheur a la fermeture

### 8.2 Formulaires

- Chaque champ a un `<label>` associe via `htmlFor`
- Les erreurs de validation sont annoncees via `aria-describedby`
- Les boutons desactives ont `aria-disabled="true"`
- Les indicateurs de chargement ont `aria-busy="true"`

### 8.3 Navigation clavier

- `Tab` : navigation entre les champs du formulaire
- `Enter` : soumission du formulaire (si le focus est sur un champ)
- `Escape` : fermeture de la modale
- Les boutons d'edition dans la liste de documents sont focusables et activables par `Enter` ou `Space`

---

## 9. Responsive

La page Knowledge Base utilise des styles inline avec des breakpoints implicites via `minmax()` dans les grids. Les modales s'adaptent via :

- **Desktop (>= 768px)** : Modale centree, largeur max 600px
- **Mobile (< 768px)** : Modale plein ecran avec padding reduit
- Le textarea du contenu occupe toute la largeur disponible
- Les boutons d'action sont empiles verticalement sur mobile
