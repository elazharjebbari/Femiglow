# Checklist d'implementation -- Knowledge Edit

**Feature** : AI Engine / Knowledge Base / UPDATE  
**Branche** : `feat/knowledge-edit`

---

## 1. Pre-flight (avant de commencer)

- [ ] La branche `feat/knowledge-edit` est creee a partir de `master`
- [ ] `npm install` / `pnpm install` executee sans erreur
- [ ] `npx tsc --noEmit` passe sans erreur (etat initial propre)
- [ ] `npx vitest run` passe sans erreur (tous les tests existants verts)
- [ ] `npx playwright test` passe sans erreur (tous les E2E existants verts)
- [ ] La base de donnees de dev est accessible (`psql` ou `drizzle studio`)
- [ ] La cle API OpenAI est configuree dans `.env.local` (pour les tests manuels)
- [ ] Les fichiers de documentation `01-architecture/` a `05-tests/` sont lus et compris

---

## 2. Schema et migration (Etape 1)

- [ ] Colonne `updatedAt` ajoutee dans `aiEngineKnowledgeCollections` (schema-ai-engine.ts)
- [ ] Colonne `updatedAt` ajoutee dans `aiEngineKnowledgeDocuments` (schema-ai-engine.ts)
- [ ] Type : `timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()`
- [ ] Migration Drizzle generee : `npx drizzle-kit generate:pg`
- [ ] Migration appliquee : `npx drizzle-kit push:pg`
- [ ] Donnees existantes initialisees : `updated_at = created_at`
- [ ] `npx tsc --noEmit` passe apres modification

---

## 3. Backend -- Service Layer (Etapes 2 et 3)

### 3.1 collections.ts

- [ ] Interface `CollectionRow` mise a jour avec `updatedAt: Date`
- [ ] Fonction `mapRow()` mise a jour pour inclure `updatedAt`
- [ ] Interface `UpdateCollectionData` creee (`name?`, `description?`, `category?`)
- [ ] Fonction `updateCollection(id, data)` implementee
  - [ ] Construction dynamique du SET (seuls les champs fournis)
  - [ ] `updatedAt: new Date()` toujours inclus dans le SET
  - [ ] Utilisation de `.returning()` pour eviter un SELECT supplementaire
  - [ ] Erreur levee si `rows.length === 0`
  - [ ] Log de l'operation
- [ ] Interface `DocumentDetail` creee (avec `contentText`)
- [ ] Fonction `getDocumentById(documentId, collectionId)` implementee
  - [ ] Double filtre `id = documentId AND collectionId = collectionId`
  - [ ] Retourne `null` si aucun resultat
  - [ ] Retourne `null` si DB indisponible
- [ ] `npx tsc --noEmit` passe

### 3.2 ingestion.ts

- [ ] Interface `UpdateDocumentData` creee (`title?`, `content?`)
- [ ] Interface `UpdateDocumentResult` creee (`success`, `chunkCount`, `reChunked`, `error?`)
- [ ] Fonction `updateDocument(documentId, collectionId, data)` implementee
  - [ ] **Cas 1 : content fourni** (re-chunking)
    - [ ] Verification de `getEmbeddings()` (retourne erreur si null)
    - [ ] Transaction ouverte avec `drizzle.transaction()`
    - [ ] Suppression des anciens chunks (`DELETE FROM chunks WHERE document_id = ?`)
    - [ ] Mise a jour du document (`UPDATE SET contentText, title, updatedAt`)
    - [ ] Re-decoupage avec `RecursiveCharacterTextSplitter` (1000/200)
    - [ ] Generation des embeddings par batch (100)
    - [ ] Insertion des nouveaux chunks
    - [ ] Mise a jour du `chunkCount` du document
    - [ ] Transaction commitee
    - [ ] `updateCollectionCounts()` appele hors transaction
    - [ ] Log avec duree
  - [ ] **Cas 2 : title seul** (sans re-chunking)
    - [ ] Mise a jour directe (`UPDATE SET title, updatedAt`)
    - [ ] Recuperation du `chunkCount` actuel
    - [ ] Log
  - [ ] Gestion des erreurs avec try/catch
    - [ ] Rollback automatique de la transaction si erreur
    - [ ] Retour de `{ success: false, error: message }`
- [ ] `npx tsc --noEmit` passe

---

## 4. Backend -- API Routes (Etape 4)

### 4.1 PATCH /api/admin/ai-engine/knowledge/[slug]

- [ ] Schema Zod `updateCollectionSchema` defini avec `.refine()` (au moins un champ)
- [ ] Handler `PATCH` exporte dans route.ts
- [ ] `requireAdminApi()` appele en premier
- [ ] `getCollection(params.slug)` pour verifier l'existence (404 si null)
- [ ] Validation Zod du body (`parse()`)
- [ ] Appel `updateCollection(collection.id, parsed)`
- [ ] Retour JSON `{ collection: updated }` avec status 200
- [ ] Gestion des erreurs Zod (400) et HttpError (404, 401)

### 4.2 GET /api/admin/ai-engine/knowledge/[slug]/documents/[docId]

- [ ] Handler `GET` exporte dans route.ts
- [ ] `requireAdminApi()` appele
- [ ] `getCollection(params.slug)` verification (404)
- [ ] `getDocumentById(params.docId, collection.id)` verification (404)
- [ ] Retour JSON `{ document }` avec status 200

### 4.3 PATCH /api/admin/ai-engine/knowledge/[slug]/documents/[docId]

- [ ] Schema Zod `updateDocumentSchema` defini avec `.refine()`
- [ ] Handler `PATCH` exporte dans route.ts
- [ ] `requireAdminApi()` appele
- [ ] `getCollection(params.slug)` verification (404)
- [ ] Validation Zod du body
- [ ] Appel `updateDocument(params.docId, collection.id, parsed)`
- [ ] Si `result.success === false` : retour 500 avec `{ error, detail }`
- [ ] Si succes : retour 200 avec `{ success, chunkCount, reChunked }`
- [ ] `export const maxDuration = 120` au niveau du fichier

### 4.4 Barrel Index

- [ ] `updateCollection` exporte depuis `index.ts`
- [ ] `getDocumentById` exporte depuis `index.ts`
- [ ] `updateDocument` exporte depuis `index.ts`
- [ ] Types `UpdateCollectionData`, `DocumentDetail`, `UpdateDocumentData`, `UpdateDocumentResult` exportes
- [ ] `npx tsc --noEmit` passe

---

## 5. Frontend -- Handlers MSW (Etape 6)

- [ ] Fichier `ai-engine-knowledge-edit.handlers.ts` cree
- [ ] Handler `patchCollectionHandler` (succes + validation)
- [ ] Handler `getDocumentHandler` (succes + 404)
- [ ] Handler `patchDocumentHandler` (succes + validation + delai re-chunk)
- [ ] Handlers d'erreur pre-construits (500, 401, 404, 409)
- [ ] Factories `createPatchCollectionErrorHandler()` et `createPatchDocumentErrorHandler()`
- [ ] Handler avec delai `createGetDocumentDelayedHandler()` et `createPatchDocumentSlowReChunkHandler()`
- [ ] Export `knowledgeEditHandlers` (array des handlers nominaux)
- [ ] Re-export dans `handlers/index.ts`
- [ ] `npx tsc --noEmit` passe

---

## 6. Frontend -- Composants UI (Etape 7)

### 6.1 Imports et types

- [ ] Imports Lucide ajoutes : `Pencil`, `Eye`, `AlertCircle`, `RefreshCw`, `X`
- [ ] Imports primitives ajoutes : `Dialog`, `Skeleton`
- [ ] Interface `DocumentDetail` definie dans le composant

### 6.2 Etats (useState)

- [ ] `editingCollection` / `setEditingCollection`
- [ ] `editColName` / `setEditColName`
- [ ] `editColDesc` / `setEditColDesc`
- [ ] `editColCategory` / `setEditColCategory`
- [ ] `savingCol` / `setSavingCol`
- [ ] `editColError` / `setEditColError`
- [ ] `viewingDoc` / `setViewingDoc`
- [ ] `viewDocData` / `setViewDocData`
- [ ] `loadingDocView` / `setLoadingDocView`
- [ ] `viewDocError` / `setViewDocError`
- [ ] `editingDoc` / `setEditingDoc`
- [ ] `editDocTitle` / `setEditDocTitle`
- [ ] `editDocContent` / `setEditDocContent`
- [ ] `editDocOriginalContent` / `setEditDocOriginalContent`
- [ ] `savingDoc` / `setSavingDoc`
- [ ] `editDocError` / `setEditDocError`
- [ ] `confirmReChunk` / `setConfirmReChunk`

### 6.3 Fonctions handlers

- [ ] `openEditCollection(col)` -- pre-remplit les champs
- [ ] `handleSaveCollection()` -- PATCH, ferme modale, rafraichit
- [ ] `handleCloseEditCollection()` -- confirmation si dirty
- [ ] `handleViewDocument(slug, docId, title)` -- GET, affiche viewer
- [ ] `openEditDocument(slug, docId, collectionId)` -- GET, pre-remplit
- [ ] `handleSaveDocument()` -- PATCH avec confirmation re-chunk conditionnelle
- [ ] `handleCloseEditDocument()` -- confirmation si dirty

### 6.4 Composants JSX

- [ ] `CollectionEditDialog` : slug readonly, nom, description, categorie, compteurs, erreur, actions
- [ ] `DocumentViewDialog` : metadonnees, contenu scrollable, boutons Modifier/Fermer, skeleton, erreur
- [ ] `DocumentEditDialog` : titre, textarea contenu, compteur, avertissement re-chunk, erreur, actions
- [ ] `ConfirmReChunkDialog` : message, liste d'impacts, boutons Annuler/Confirmer

### 6.5 Boutons d'action

- [ ] Bouton "Modifier" (crayon) sur chaque collection (zone actions expand)
- [ ] Bouton "Voir" (oeil) sur chaque ligne de document
- [ ] Bouton "Modifier" (crayon) sur chaque ligne de document
- [ ] Hover : background `var(--cs-accent-bg)`, couleur `var(--cs-accent)`
- [ ] `aria-label` sur chaque bouton

### 6.6 Verification finale UI

- [ ] Le slug n'est pas editable
- [ ] Le bouton "Enregistrer" est desactive si nom vide ou aucun changement
- [ ] Le compteur de caracteres se met a jour en temps reel
- [ ] L'avertissement re-chunk apparait uniquement si contenu modifie
- [ ] Le texte du bouton change : "Re-indexation en cours..." pendant le re-chunk
- [ ] La modale reste ouverte en cas d'erreur
- [ ] La confirmation est demandee avant fermeture si dirty
- [ ] `npx tsc --noEmit` passe

---

## 7. Tests (Etapes 9 et 10)

### 7.1 Tests unitaires Vitest

- [ ] `describe('updateCollection()')` : 8 cas dans `collections.test.ts`
- [ ] `describe('getDocumentById()')` : 4 cas dans `collections.test.ts`
- [ ] `describe('updateDocument()')` : 10 cas dans `ingestion.test.ts`
- [ ] `describe('PATCH collection')` : 6 cas dans `ai-engine-knowledge-edit.contract.test.ts`
- [ ] `describe('GET document')` : 4 cas dans `ai-engine-knowledge-edit.contract.test.ts`
- [ ] `describe('PATCH document')` : 6 cas dans `ai-engine-knowledge-edit.contract.test.ts`
- [ ] `describe('KnowledgeBasePage -- Edition')` : 10 cas dans `knowledge-page-edit.test.tsx`
- [ ] Total : 48+ cas de test
- [ ] `npx vitest run --reporter=verbose` : 0 failures
- [ ] Couverture > 90% sur les nouvelles fonctions

### 7.2 Tests E2E Playwright

- [ ] E2E-01 : Modifier le nom d'une collection
- [ ] E2E-02 : Modifier description + categorie
- [ ] E2E-03 : Modifier le titre d'un document
- [ ] E2E-04 : Modifier le contenu (re-chunking + confirmation)
- [ ] E2E-05 : Visualiser le contenu complet
- [ ] E2E-06 : Annuler l'edition
- [ ] E2E-07 : Validation nom vide / trop long
- [ ] E2E-08 : Edition concurrente (409)
- [ ] E2E-09 : Chunks mis a jour apres re-chunk
- [ ] E2E-10 : Navigation liste <-> edition
- [ ] E2E-11 : Navigation clavier
- [ ] E2E-12 : Responsive mobile/tablette
- [ ] E2E-13 : Erreur API + reessai
- [ ] E2E-14 : Rollback mise a jour optimiste
- [ ] E2E-15 : Viewer -> Editeur
- [ ] E2E-16 : Skeleton de chargement
- [ ] `npx playwright test --reporter=list` : 0 failures
- [ ] 3 runs consecutifs sans flaky test

---

## 8. Post-implementation

- [ ] `npx tsc --noEmit` : 0 erreurs (verification finale)
- [ ] `npx vitest run` : TOUS les tests passent (existants + nouveaux)
- [ ] `npx playwright test` : TOUS les tests passent (existants + nouveaux)
- [ ] `npx vitest run --coverage` : couverture > 90% sur les nouvelles fonctions
- [ ] Les mocks existants mis a jour pour inclure `updatedAt` (si necessaire)
- [ ] Aucun fichier `.env`, `credentials` ou `node_modules` dans le diff
- [ ] La migration DB est documentee et reversible
- [ ] Le code est formate (`prettier`) et linte (`eslint`)
- [ ] Le PR est cree avec la description, les user stories et la checklist de test
- [ ] Le PR passe la CI GitHub Actions
- [ ] Les screenshots des nouvelles modales sont prises pour documentation
