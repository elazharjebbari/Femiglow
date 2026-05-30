# Composants UI -- Knowledge Edit

**Design System** : CS v2  
**Framework** : React 18 (Next.js 14 App Router, 'use client')  
**Icones** : lucide-react

---

## 1. Vue d'ensemble des composants

```
KnowledgeBasePage (page existante)
  |
  |-- CollectionEditDialog    [NOUVEAU] - Modale d'edition de collection
  |-- DocumentViewDialog      [NOUVEAU] - Modale de visualisation de document
  |-- DocumentEditDialog      [NOUVEAU] - Modale d'edition de document
  |-- ConfirmReChunkDialog    [NOUVEAU] - Dialogue de confirmation re-chunking
  |
  |-- (dans la liste de collections, modifications des lignes)
  |   |-- EditCollectionButton  [NOUVEAU] - Bouton edition collection
  |   |-- ViewDocumentButton    [NOUVEAU] - Bouton visualisation document
  |   |-- EditDocumentButton    [NOUVEAU] - Bouton edition document
```

Tous les nouveaux composants sont definis **inline** dans `page.tsx` (coherent avec le pattern existant de la page qui ne separe pas les sous-composants en fichiers).

---

## 2. CollectionEditDialog

### 2.1 Description

Modale permettant de modifier le nom, la description et la categorie d'une collection existante. Le slug est affiche en lecture seule.

### 2.2 Props / Dependencies (via state parent)

Le composant est inline dans KnowledgeBasePage et accede directement aux etats suivants :

```typescript
// Lecture
editingCollection: Collection | null   // null = modale fermee
editColName: string
editColDesc: string
editColCategory: string
savingCol: boolean
editColError: string | null

// Ecriture
setEditColName: (v: string) => void
setEditColDesc: (v: string) => void
setEditColCategory: (v: string) => void
setEditingCollection: (v: Collection | null) => void

// Actions
handleSaveCollection: () => Promise<void>
handleCloseEditCollection: () => void
```

### 2.3 Structure JSX

```tsx
{editingCollection && (
  <Dialog
    open={!!editingCollection}
    onClose={handleCloseEditCollection}
    title="Modifier la collection"
  >
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Slug en lecture seule */}
      <div className="cs-input-field flex flex-col gap-1.5 w-full">
        <label className="cs-eyebrow" style={{ fontSize: 'var(--cs-text-xs)' }}>
          Slug (non modifiable)
        </label>
        <div
          style={{
            padding: '8px 12px',
            fontSize: 'var(--cs-text-sm)',
            fontFamily: 'var(--cs-font-mono)',
            background: 'var(--cs-bg-sunken)',
            border: '1px solid var(--cs-border)',
            borderRadius: 'var(--cs-radius-sm)',
            color: 'var(--cs-fg-muted)',
            cursor: 'not-allowed',
          }}
          aria-readonly="true"
          aria-label="Slug de la collection (non modifiable)"
        >
          {editingCollection.slug}
        </div>
      </div>

      {/* Nom */}
      <Input
        label="Nom *"
        value={editColName}
        onChange={(e) => setEditColName(e.target.value)}
        placeholder="Nom de la collection"
        maxLength={200}
        disabled={savingCol}
        aria-invalid={editColName.trim() === ''}
      />
      <span
        style={{
          fontSize: 'var(--cs-text-xs)',
          color: 'var(--cs-fg-muted)',
          marginTop: -12,
        }}
        aria-live="polite"
      >
        {editColName.length}/200 caracteres
      </span>

      {/* Description */}
      <Input
        label="Description"
        value={editColDesc}
        onChange={(e) => setEditColDesc(e.target.value)}
        placeholder="Description de la collection (optionnel)"
        maxLength={500}
        disabled={savingCol}
      />
      <span
        style={{
          fontSize: 'var(--cs-text-xs)',
          color: 'var(--cs-fg-muted)',
          marginTop: -12,
        }}
      >
        {editColDesc.length}/500 caracteres
      </span>

      {/* Categorie */}
      <div className="cs-input-field flex flex-col gap-1.5 w-full">
        <label className="cs-eyebrow" style={{ fontSize: 'var(--cs-text-xs)' }}>
          Categorie *
        </label>
        <select
          value={editColCategory}
          onChange={(e) => setEditColCategory(e.target.value)}
          disabled={savingCol}
          style={{
            width: '100%',
            padding: '8px 12px',
            fontSize: 'var(--cs-text-sm)',
            border: '1px solid var(--cs-border)',
            borderRadius: 'var(--cs-radius-sm)',
            background: 'var(--cs-bg-elevated)',
            color: 'var(--cs-fg-primary)',
            fontFamily: 'inherit',
          }}
        >
          {COLLECTION_CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>{cat.label}</option>
          ))}
        </select>
      </div>

      {/* Erreur */}
      {editColError && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            background: 'var(--cs-danger-bg)',
            borderRadius: 'var(--cs-radius-sm)',
            fontSize: 'var(--cs-text-xs)',
            color: 'var(--cs-danger)',
          }}
        >
          <AlertTriangle size={12} />
          {editColError}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCloseEditCollection}
          disabled={savingCol}
        >
          Annuler
        </Button>
        <Button
          size="sm"
          onClick={handleSaveCollection}
          loading={savingCol}
          disabled={!editColName.trim() || !isCollectionDirty}
        >
          Enregistrer
        </Button>
      </div>
    </div>
  </Dialog>
)}
```

### 2.4 Evenements

| Evenement | Declencheur | Effet |
|-----------|-------------|-------|
| `onClose` | Clic overlay, Escape, bouton X | `handleCloseEditCollection()` (confirmation si dirty) |
| `onChange` (nom) | Saisie clavier | `setEditColName(value)` |
| `onChange` (desc) | Saisie clavier | `setEditColDesc(value)` |
| `onChange` (cat) | Selection menu | `setEditColCategory(value)` |
| `onSubmit` | Clic "Enregistrer" | `handleSaveCollection()` |

---

## 3. DocumentViewDialog

### 3.1 Description

Modale affichant le contenu complet d'un document en lecture seule, avec ses metadonnees. Propose un bouton pour basculer vers l'edition.

### 3.2 Props / Dependencies (via state parent)

```typescript
// Lecture
viewingDoc: { slug: string; docId: string; title: string } | null
viewDocData: DocumentDetail | null
loadingDocView: boolean
viewDocError: string | null

// Actions
setViewingDoc: (v: null) => void
openEditDocument: (slug: string, docId: string, collectionId: string) => void
handleViewDocument: (slug: string, docId: string, title: string) => void
```

### 3.3 Structure JSX

```tsx
{viewingDoc && (
  <Dialog
    open={!!viewingDoc}
    onClose={() => setViewingDoc(null)}
    title={viewingDoc.title}
  >
    {loadingDocView ? (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Skeleton height={40} />
        <Skeleton height={14} width="100%" />
        <Skeleton height={14} width="90%" />
        <Skeleton height={14} width="95%" />
        <Skeleton height={14} width="85%" />
        <Skeleton height={14} width="88%" />
      </div>
    ) : viewDocError ? (
      <div style={{ textAlign: 'center', padding: 32 }}>
        <AlertTriangle
          size={24}
          style={{ color: 'var(--cs-danger)', marginBottom: 8 }}
        />
        <p style={{ color: 'var(--cs-danger)', fontSize: 'var(--cs-text-sm)' }}>
          {viewDocError}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleViewDocument(
            viewingDoc.slug,
            viewingDoc.docId,
            viewingDoc.title,
          )}
        >
          Reessayer
        </Button>
      </div>
    ) : viewDocData ? (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Metadonnees */}
        <div
          style={{
            background: 'var(--cs-bg-sunken)',
            borderRadius: 'var(--cs-radius-sm)',
            padding: '12px 16px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 8,
            fontSize: 'var(--cs-text-xs)',
            color: 'var(--cs-fg-secondary)',
          }}
        >
          <div>
            <strong>Type :</strong> {viewDocData.sourceType}
          </div>
          <div>
            <strong>Chunks :</strong> {viewDocData.chunkCount}
          </div>
          <div>
            <strong>Cree :</strong> {formatDate(viewDocData.createdAt)}
          </div>
          <div>
            <strong>Modifie :</strong> {formatDate(viewDocData.updatedAt)}
          </div>
          {viewDocData.sourceUrl && (
            <div style={{ gridColumn: '1 / -1' }}>
              <strong>URL :</strong>{' '}
              <a
                href={viewDocData.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--cs-accent)' }}
              >
                {viewDocData.sourceUrl}
              </a>
            </div>
          )}
        </div>

        {/* Contenu */}
        <div>
          <label
            className="cs-eyebrow"
            style={{
              fontSize: 'var(--cs-text-xs)',
              marginBottom: 6,
              display: 'block',
            }}
          >
            Contenu
          </label>
          <div
            style={{
              background: 'var(--cs-bg-elevated)',
              border: '1px solid var(--cs-border)',
              borderRadius: 'var(--cs-radius-sm)',
              padding: 16,
              fontFamily: 'var(--cs-font-body)',
              fontSize: 'var(--cs-text-sm)',
              lineHeight: 1.6,
              color: 'var(--cs-fg-primary)',
              maxHeight: 400,
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {viewDocData.contentText ?? (
              <span style={{ color: 'var(--cs-fg-muted)', fontStyle: 'italic' }}>
                Contenu non disponible
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Pencil size={12} />}
            onClick={() => {
              setViewingDoc(null);
              openEditDocument(
                viewingDoc.slug,
                viewingDoc.docId,
                viewDocData.collectionId,
              );
            }}
          >
            Modifier
          </Button>
          <Button
            size="sm"
            onClick={() => setViewingDoc(null)}
          >
            Fermer
          </Button>
        </div>
      </div>
    ) : null}
  </Dialog>
)}
```

### 3.4 Evenements

| Evenement | Declencheur | Effet |
|-----------|-------------|-------|
| `onClose` | Clic overlay, Escape, bouton X | `setViewingDoc(null)` |
| Clic "Modifier" | Bouton dans le footer | Ferme le viewer, ouvre l'editeur |
| Clic "Fermer" | Bouton dans le footer | `setViewingDoc(null)` |
| Clic "Reessayer" | Bouton d'erreur | `handleViewDocument()` relance le GET |

---

## 4. DocumentEditDialog

### 4.1 Description

Modale d'edition d'un document. Charge le contenu complet via GET puis permet la modification du titre et du contenu. Si le contenu est modifie, un avertissement previent de la re-indexation.

### 4.2 Props / Dependencies (via state parent)

```typescript
// Lecture
editingDoc: { slug: string; docId: string; collectionId: string } | null
editDocTitle: string
editDocContent: string
editDocOriginalContent: string
savingDoc: boolean
editDocError: string | null
confirmReChunk: boolean

// Ecriture
setEditDocTitle: (v: string) => void
setEditDocContent: (v: string) => void

// Actions
handleSaveDocument: () => Promise<void>
handleCloseEditDocument: () => void
setConfirmReChunk: (v: boolean) => void
```

### 4.3 Structure JSX (simplifiee)

```tsx
{editingDoc && (
  <Dialog
    open={!!editingDoc}
    onClose={handleCloseEditDocument}
    title="Modifier le document"
  >
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Titre */}
      <Input
        label="Titre *"
        value={editDocTitle}
        onChange={(e) => setEditDocTitle(e.target.value)}
        placeholder="Titre du document"
        maxLength={500}
        disabled={savingDoc}
      />
      <span style={{ fontSize: 'var(--cs-text-xs)', color: 'var(--cs-fg-muted)', marginTop: -12 }}>
        {editDocTitle.length}/500 caracteres
      </span>

      {/* Contenu */}
      <div className="cs-input-field flex flex-col gap-1.5 w-full">
        <label className="cs-eyebrow" style={{ fontSize: 'var(--cs-text-xs)' }}>
          Contenu *
        </label>
        <textarea
          value={editDocContent}
          onChange={(e) => setEditDocContent(e.target.value)}
          disabled={savingDoc}
          rows={12}
          style={{
            width: '100%',
            resize: 'vertical',
            border: '1px solid var(--cs-border)',
            borderRadius: 'var(--cs-radius-sm)',
            background: 'var(--cs-bg-elevated)',
            fontFamily: 'inherit',
            fontSize: 'var(--cs-text-sm)',
            padding: '8px 12px',
            lineHeight: 1.6,
          }}
          className="focus:outline-none"
        />
        <span style={{ fontSize: 'var(--cs-text-xs)', color: 'var(--cs-fg-muted)' }}>
          {editDocContent.length.toLocaleString('fr-FR')} caracteres
        </span>
      </div>

      {/* Avertissement re-chunking */}
      {isDocumentContentDirty && (
        <div
          style={{
            background: 'var(--cs-warning-bg)',
            border: '1px solid var(--cs-warning)',
            borderRadius: 'var(--cs-radius-sm)',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            fontSize: 'var(--cs-text-xs)',
          }}
        >
          <AlertCircle size={14} style={{ color: 'var(--cs-warning)', flexShrink: 0, marginTop: 1 }} />
          <span>
            La modification du contenu entrainera la suppression des chunks existants
            et la generation de nouveaux embeddings. Cette operation peut prendre
            quelques secondes.
          </span>
        </div>
      )}

      {/* Erreur */}
      {editDocError && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            background: 'var(--cs-danger-bg)',
            borderRadius: 'var(--cs-radius-sm)',
            fontSize: 'var(--cs-text-xs)',
            color: 'var(--cs-danger)',
          }}
        >
          <AlertTriangle size={12} />
          {editDocError}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCloseEditDocument}
          disabled={savingDoc}
        >
          Annuler
        </Button>
        <Button
          size="sm"
          onClick={handleSaveDocument}
          loading={savingDoc}
          disabled={!editDocTitle.trim() || !isDocumentDirty}
        >
          {savingDoc
            ? (isDocumentContentDirty ? 'Re-indexation en cours...' : 'Enregistrement...')
            : 'Enregistrer'
          }
        </Button>
      </div>
    </div>
  </Dialog>
)}
```

### 4.4 Evenements

| Evenement | Declencheur | Effet |
|-----------|-------------|-------|
| `onClose` | Clic overlay, Escape, bouton X | `handleCloseEditDocument()` (confirmation si dirty) |
| `onChange` (titre) | Saisie clavier | `setEditDocTitle(value)` |
| `onChange` (contenu) | Saisie clavier | `setEditDocContent(value)` |
| `onSubmit` | Clic "Enregistrer" | `handleSaveDocument()` (avec confirmation si content dirty) |

---

## 5. ConfirmReChunkDialog

### 5.1 Description

Petit dialogue de confirmation qui s'affiche lorsque l'utilisateur tente d'enregistrer un document dont le contenu a ete modifie. Informe du cout et du temps estime.

### 5.2 Structure JSX

```tsx
{confirmReChunk && (
  <Dialog
    open={confirmReChunk}
    onClose={() => setConfirmReChunk(false)}
    title="Confirmer la re-indexation"
    size="sm"
  >
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          fontSize: 'var(--cs-text-sm)',
          lineHeight: 1.6,
          color: 'var(--cs-fg-secondary)',
        }}
      >
        <AlertCircle
          size={20}
          style={{ color: 'var(--cs-warning)', flexShrink: 0, marginTop: 2 }}
        />
        <div>
          <p style={{ margin: '0 0 8px' }}>
            Les chunks existants seront supprimes et le nouveau contenu sera
            re-decoupe et re-embedde.
          </p>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 'var(--cs-text-xs)' }}>
            <li>Utilise l'API OpenAI (cout negligeable)</li>
            <li>Peut prendre 5-15 secondes</li>
            <li>Irreversible une fois confirmee</li>
          </ul>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirmReChunk(false)}
        >
          Annuler
        </Button>
        <Button
          size="sm"
          onClick={handleSaveDocument}
        >
          Confirmer et re-indexer
        </Button>
      </div>
    </div>
  </Dialog>
)}
```

---

## 6. Boutons d'action sur les lignes

### 6.1 EditCollectionButton

Place dans la zone d'action du panneau expand, a cote de "Supprimer la collection" :

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

### 6.2 ViewDocumentButton

Place sur chaque ligne de document, avant les autres boutons d'action :

```tsx
<button
  onClick={() => handleViewDocument(col.slug, doc.id, doc.title)}
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
```

### 6.3 EditDocumentButton

Place a cote du bouton "Voir", avant le bouton "Supprimer" :

```tsx
<button
  onClick={() => openEditDocument(col.slug, doc.id, col.id)}
  title={`Modifier le document ${doc.title}`}
  aria-label={`Modifier le document ${doc.title}`}
  style={{
    /* identique a ViewDocumentButton */
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

---

## 7. Tableau recapitulatif des composants

| Composant | Type | Declencheur | Donnees requises | Actions exposees |
|-----------|------|------------|-----------------|-----------------|
| CollectionEditDialog | Dialog | Clic "Modifier" (collection) | Collection courante | PATCH collection |
| DocumentViewDialog | Dialog | Clic "Voir" (document) | GET document complet | Fermer, basculer vers edit |
| DocumentEditDialog | Dialog | Clic "Modifier" (document) | GET document complet | PATCH document |
| ConfirmReChunkDialog | Dialog | Soumission doc avec contenu modifie | Nombre de chunks actuels | Confirmer/Annuler re-chunk |
| EditCollectionButton | Button ghost | - | Collection courante | Ouvre CollectionEditDialog |
| ViewDocumentButton | button inline | - | slug, docId, titre | Ouvre DocumentViewDialog |
| EditDocumentButton | button inline | - | slug, docId, collectionId | Ouvre DocumentEditDialog |
