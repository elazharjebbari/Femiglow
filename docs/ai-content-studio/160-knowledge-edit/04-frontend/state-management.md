# State Management -- Knowledge Edit

**Pattern** : useState local (pas de store externe)  
**Framework** : React 18, Next.js 14 App Router, 'use client'

---

## 1. Philosophie de gestion d'etat

Le composant `KnowledgeBasePage` utilise exclusivement `useState` pour gerer l'etat local. Ce choix est coherent avec le pattern existant et se justifie par :

1. **Pas de partage d'etat** : La page est autonome, aucun autre composant n'a besoin d'acceder a ces etats
2. **Simplicite** : Pas de store Redux/Zustand, pas de context provider
3. **Colocation** : L'etat est proche du JSX qui l'utilise
4. **Performance** : Les re-renders sont limites au composant page

---

## 2. Inventaire complet des etats

### 2.1 Etats existants (rappel, non modifies)

| Variable | Type | Default | Utilisation |
|----------|------|---------|-------------|
| `collections` | `Collection[]` | `[]` | Liste des collections |
| `loading` | `boolean` | `true` | Chargement initial |
| `error` | `string \| null` | `null` | Erreur de chargement |
| `expandedId` | `string \| null` | `null` | Collection expandee |
| `documents` | `Record<string, Document[]>` | `{}` | Documents par slug |
| `loadingDocs` | `string \| null` | `null` | Slug en cours de chargement |
| `showForm` | `string \| null` | `null` | Slug du formulaire d'ingestion |
| `formTitle` | `string` | `''` | Titre du formulaire d'ingestion |
| `formContent` | `string` | `''` | Contenu du formulaire d'ingestion |
| `formSourceType` | `'text' \| 'url'` | `'text'` | Type de source |
| `formUrl` | `string` | `''` | URL du formulaire |
| `ingesting` | `boolean` | `false` | Ingestion en cours |
| `ingestError` | `string \| null` | `null` | Erreur d'ingestion |
| `ingestSuccess` | `string \| null` | `null` | Message de succes |
| `embedding` | `boolean` | `false` | Embedding en cours |
| `embedResult` | `EmbedResult \| null` | `null` | Resultat embedding |
| `embedError` | `string \| null` | `null` | Erreur embedding |
| `confirmDeleteDoc` | `{...} \| null` | `null` | Confirmation suppression doc |
| `deletingDoc` | `boolean` | `false` | Suppression doc en cours |
| `confirmDeleteCol` | `{...} \| null` | `null` | Confirmation suppression col |
| `deletingCol` | `boolean` | `false` | Suppression col en cours |
| `showNewCollection` | `boolean` | `false` | Formulaire nouvelle collection |
| `newColName` | `string` | `''` | Nom nouvelle collection |
| `newColSlug` | `string` | `''` | Slug nouvelle collection |
| `newColDesc` | `string` | `''` | Description nouvelle collection |
| `newColCategory` | `string` | `'brand'` | Categorie nouvelle collection |
| `creatingCol` | `boolean` | `false` | Creation collection en cours |
| `createColError` | `string \| null` | `null` | Erreur creation collection |

### 2.2 Nouveaux etats (Knowledge Edit)

| Variable | Type | Default | Groupe | Utilisation |
|----------|------|---------|--------|-------------|
| `editingCollection` | `Collection \| null` | `null` | Edition col. | Collection en cours d'edition (null = modale fermee) |
| `editColName` | `string` | `''` | Edition col. | Valeur du champ nom |
| `editColDesc` | `string` | `''` | Edition col. | Valeur du champ description |
| `editColCategory` | `string` | `''` | Edition col. | Valeur du champ categorie |
| `savingCol` | `boolean` | `false` | Edition col. | PATCH en cours |
| `editColError` | `string \| null` | `null` | Edition col. | Erreur de sauvegarde |
| `viewingDoc` | `{slug, docId, title} \| null` | `null` | Vue doc. | Document en visualisation (null = modale fermee) |
| `viewDocData` | `DocumentDetail \| null` | `null` | Vue doc. | Donnees completes du document |
| `loadingDocView` | `boolean` | `false` | Vue doc. | GET en cours |
| `viewDocError` | `string \| null` | `null` | Vue doc. | Erreur de chargement |
| `editingDoc` | `{slug, docId, collectionId} \| null` | `null` | Edition doc. | Document en edition (null = modale fermee) |
| `editDocTitle` | `string` | `''` | Edition doc. | Valeur du champ titre |
| `editDocContent` | `string` | `''` | Edition doc. | Valeur du champ contenu |
| `editDocOriginalContent` | `string` | `''` | Edition doc. | Contenu original (pour dirty check) |
| `loadingDocEdit` | `boolean` | `false` | Edition doc. | GET en cours (chargement initial) |
| `savingDoc` | `boolean` | `false` | Edition doc. | PATCH en cours |
| `editDocError` | `string \| null` | `null` | Edition doc. | Erreur de sauvegarde |
| `confirmReChunk` | `boolean` | `false` | Confirmation | Dialogue de confirmation re-chunk affiche |

---

## 3. Diagramme de transitions d'etat

### 3.1 Edition de collection

```
IDLE                    EDITING                  SAVING
editingCollection=null  editingCollection={...}  savingCol=true
                        editColName=...          editColError=null
                        editColDesc=...
                        editColCategory=...
                        editColError=null

  |--- openEditCollection(col) --->|
  |                                |--- handleSaveCollection() --->|
  |<---- handleCloseEditCollection -----|                          |
  |                                |<------- erreur + retry -------|
  |<------------------------------------------ succes ------------|
```

### 3.2 Visualisation de document

```
IDLE                 LOADING              LOADED
viewingDoc=null      viewingDoc={...}     viewDocData={...}
                     loadingDocView=true  loadingDocView=false

  |--- handleViewDocument() --->|
  |                              |--- GET reponse OK --->|
  |<---- setViewingDoc(null) ----|                       |
  |                              |<-- GET erreur ------->| (viewDocError=...)
  |<-------- setViewingDoc(null) -------------------------|
```

### 3.3 Edition de document

```
IDLE          LOADING            EDITING            CONFIRMING        SAVING
editingDoc    loadingDocEdit     editDocTitle=...    confirmReChunk    savingDoc
 =null         =true            editDocContent=...    =true            =true
                                editDocOriginal...

  |--- openEditDocument() --->|
  |                            |--- GET OK --->|
  |                                            |--- handleSaveDocument() (content dirty) --->|
  |                                            |                                              |--- confirm --->|
  |                                            |<--- annuler ----------------------------------|                |
  |                                            |--- handleSaveDocument() (title only) -------->|--- PATCH ----->|
  |<--- handleCloseEditDocument() -------------|                                                                |
  |<--- succes ------------------------------------------------------------------------------------------------|
  |                                            |<--- erreur (editDocError=...) --------------------------------|
```

---

## 4. Validation des formulaires

### 4.1 Regles de validation (cote client)

| Champ | Regle | Variable d'etat verifiee | Impact UI |
|-------|-------|-------------------------|----------|
| Collection: nom | Non vide | `editColName.trim() === ''` | Bouton "Enregistrer" desactive |
| Collection: nom | Max 200 chars | `maxLength={200}` sur Input | Saisie bloquee au-dela |
| Collection: desc | Max 500 chars | `maxLength={500}` sur Input | Saisie bloquee au-dela |
| Collection: categorie | Toujours valide | Pre-rempli par le select | N/A |
| Document: titre | Non vide | `editDocTitle.trim() === ''` | Bouton "Enregistrer" desactive |
| Document: titre | Max 500 chars | `maxLength={500}` sur Input | Saisie bloquee au-dela |
| Document: contenu | Non vide | `editDocContent.trim() === ''` | Bouton "Enregistrer" desactive |

### 4.2 Dirty checking

Le dirty checking compare les valeurs actuelles avec les valeurs originales pour :

1. **Desactiver le bouton "Enregistrer"** si rien n'a change
2. **Demander confirmation** avant de fermer la modale si des modifications sont en cours
3. **Decider du re-chunking** : si `editDocContent !== editDocOriginalContent`

```typescript
// Collection dirty
const isCollectionDirty = editingCollection !== null && (
  editColName.trim() !== editingCollection.name ||
  (editColDesc.trim() || null) !== editingCollection.description ||
  editColCategory !== editingCollection.category
);

// Document content dirty (declencheur de re-chunk)
const isDocumentContentDirty = editDocContent !== editDocOriginalContent;

// Document dirty (tout changement)
const isDocumentDirty = editingDoc !== null && (
  editDocTitle.trim() !== '' && (
    isDocumentContentDirty ||
    editDocTitle.trim() !== (viewDocData?.title ?? '')
  )
);
```

---

## 5. Etats de chargement et indicateurs

### 5.1 Matrice des etats de chargement

| Etat | Indicateur visuel | Champs desactives | Boutons desactives |
|------|------------------|------------------|-------------------|
| `savingCol = true` | Spinner dans "Enregistrer" | Tous les champs du formulaire | Annuler, Enregistrer |
| `loadingDocView = true` | Skeletons a la place du contenu | N/A | Modifier, Fermer |
| `loadingDocEdit = true` | Skeletons dans le formulaire | Titre, Contenu | Annuler, Enregistrer |
| `savingDoc = true` | Spinner "Re-indexation en cours..." | Titre, Contenu | Annuler, Enregistrer |

### 5.2 Texte dynamique du bouton de sauvegarde (document)

```typescript
const saveDocButtonText = savingDoc
  ? (isDocumentContentDirty ? 'Re-indexation en cours...' : 'Enregistrement...')
  : 'Enregistrer';
```

---

## 6. Etats d'erreur

### 6.1 Sources d'erreur

| Variable | Source | Affichage |
|----------|--------|----------|
| `editColError` | Reponse API PATCH collection | Bandeau rouge dans la modale |
| `viewDocError` | Reponse API GET document | Message centre avec "Reessayer" |
| `editDocError` | Reponse API PATCH document ou GET initial | Bandeau rouge dans la modale |

### 6.2 Reset des erreurs

Les erreurs sont reinitalisees dans les situations suivantes :

```
editColError -> reset quand :
  - openEditCollection() est appele
  - handleSaveCollection() commence
  - handleCloseEditCollection() est appele

viewDocError -> reset quand :
  - handleViewDocument() est appele

editDocError -> reset quand :
  - openEditDocument() est appele
  - handleSaveDocument() commence
  - handleCloseEditDocument() est appele
```

---

## 7. Message de succes

Les messages de succes reutilisent l'etat `ingestSuccess` existant, qui est affiche en haut de la page dans un bandeau vert.

### 7.1 Messages par operation

| Operation | Message |
|-----------|---------|
| PATCH collection | `Collection "{nom}" mise a jour` |
| PATCH document (titre) | `Titre du document mis a jour` |
| PATCH document (contenu) | `Document mis a jour avec {N} chunks re-generes` |

### 7.2 Duree d'affichage

Le bandeau de succes reste affiche jusqu'a ce que l'utilisateur effectue une autre action (pas d'auto-dismiss). C'est le comportement existant qui est conserve.

---

## 8. Gestion de la memoire et cleanup

### 8.1 Pas d'effet de nettoyage necessaire

Les nouveaux etats sont des valeurs simples (strings, booleans, objets) qui ne necessitent pas de cleanup dans un `useEffect`. Les requetes fetch sont "fire and forget" avec des try/catch.

### 8.2 Annulation de requete en vol

Actuellement, les requetes ne sont pas annulees si l'utilisateur ferme la modale pendant le chargement. Cela est acceptable car :

1. Les requetes GET sont idempotentes et n'ont pas d'effet de bord
2. Les requetes PATCH sont protegees par le flag `savingDoc/savingCol` qui empeche une double soumission
3. L'ajout d'`AbortController` pourrait etre envisage dans une iteration future si necessaire

### 8.3 Race conditions

Le pattern `setLoadingDocView(true) -> fetch -> setViewDocData(data) -> setLoadingDocView(false)` peut theoriquement souffrir de race conditions si l'utilisateur ouvre/ferme rapidement la modale. En pratique :

- Le fetch est rapide (< 200ms pour un GET)
- Le state `viewingDoc` sert de guard : si l'utilisateur ferme la modale, le state est null et les donnees chargees sont simplement ignorees au prochain render
- Pour le PATCH, le bouton est desactive pendant le traitement, empechant les soumissions multiples

---

## 9. Tableau recapitulatif des flux d'etat

| Action utilisateur | Etats modifies | Appel API |
|-------------------|----------------|-----------|
| Clic "Modifier" (collection) | editingCollection, editColName, editColDesc, editColCategory | - |
| Clic "Enregistrer" (collection) | savingCol, editColError | PATCH /knowledge/[slug] |
| Clic "Annuler" (collection) | editingCollection=null | - |
| Clic "Voir" (document) | viewingDoc, loadingDocView, viewDocData, viewDocError | GET /knowledge/[slug]/documents/[docId] |
| Clic "Fermer" (viewer) | viewingDoc=null | - |
| Clic "Modifier" (document) | editingDoc, loadingDocEdit, editDocTitle, editDocContent, editDocOriginalContent | GET /knowledge/[slug]/documents/[docId] |
| Modification du contenu (document) | editDocContent | - |
| Clic "Enregistrer" (document, contenu modifie) | confirmReChunk=true | - |
| Clic "Confirmer et re-indexer" | savingDoc, editDocError, confirmReChunk=false | PATCH /knowledge/[slug]/documents/[docId] |
| Clic "Annuler" (confirmation) | confirmReChunk=false | - |
| Clic "Enregistrer" (document, titre seul) | savingDoc, editDocError | PATCH /knowledge/[slug]/documents/[docId] |
| Clic "Annuler" (document) | editingDoc=null | - |
