# Service Layer -- Knowledge Edit

**Fichiers** :
- `apps/web/src/lib/ai-engine/knowledge/collections.ts` (updateCollection, getDocumentById)
- `apps/web/src/lib/ai-engine/knowledge/ingestion.ts` (updateDocument)
- `apps/web/src/lib/ai-engine/knowledge/index.ts` (barrel exports)

---

## 1. updateCollection()

### 1.1 Signature

```typescript
export interface UpdateCollectionData {
  name?: string;
  description?: string | null;
  category?: string;
}

export async function updateCollection(
  id: string,
  data: UpdateCollectionData,
): Promise<CollectionRow>
```

### 1.2 Localisation

Fichier : `collections.ts`, apres la fonction `deleteCollection()`.

### 1.3 Logique detaillee

```
ENTREE : id (UUID de la collection), data (champs a mettre a jour)
SORTIE : CollectionRow mise a jour

1. Obtenir la connexion Drizzle via db()
   - Si null -> throw Error('Database connection required')

2. Construire l'objet de mise a jour :
   setFields = { updatedAt: new Date() }
   - Si data.name !== undefined -> setFields.name = data.name
   - Si data.description !== undefined -> setFields.description = data.description
   - Si data.category !== undefined -> setFields.category = data.category

3. Executer la requete UPDATE :
   rows = await drizzle
     .update(aiEngineKnowledgeCollections)
     .set(setFields)
     .where(eq(aiEngineKnowledgeCollections.id, id))
     .returning()

4. Verifier le resultat :
   - Si rows.length === 0 -> throw Error('Collection not found')
   - Sinon -> row = rows[0]

5. Logger : log.info('Collection updated', { id, fields: Object.keys(data) })

6. Retourner mapRow(row)
```

### 1.4 Code complet

```typescript
export async function updateCollection(
  id: string,
  data: UpdateCollectionData,
): Promise<CollectionRow> {
  const drizzle = db();
  if (!drizzle) {
    throw new Error('Database connection required for knowledge collections');
  }

  const setFields: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (data.name !== undefined) {
    setFields.name = data.name;
  }
  if (data.description !== undefined) {
    setFields.description = data.description;
  }
  if (data.category !== undefined) {
    setFields.category = data.category;
  }

  const rows = await drizzle
    .update(aiEngineKnowledgeCollections)
    .set(setFields)
    .where(eq(aiEngineKnowledgeCollections.id, id))
    .returning();

  if (rows.length === 0) {
    throw new Error(`Collection ${id} not found`);
  }

  log.info('Collection updated', { id, fields: Object.keys(data) });
  return mapRow(rows[0]!);
}
```

### 1.5 Mise a jour de mapRow

La fonction `mapRow` existante doit inclure le nouveau champ `updatedAt` :

```typescript
function mapRow(row: typeof aiEngineKnowledgeCollections.$inferSelect): CollectionRow {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    category: row.category,
    documentCount: row.documentCount,
    chunkCount: row.chunkCount,
    lastIndexedAt: row.lastIndexedAt,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,  // NOUVEAU
  };
}
```

---

## 2. getDocumentById()

### 2.1 Signature

```typescript
export interface DocumentDetail {
  id: string;
  collectionId: string;
  title: string;
  sourceType: string;
  sourceUrl: string | null;
  contentText: string | null;
  metadata: Record<string, unknown> | null;
  chunkCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export async function getDocumentById(
  documentId: string,
  collectionId: string,
): Promise<DocumentDetail | null>
```

### 2.2 Localisation

Fichier : `collections.ts`, apres la fonction `getCollection()`.

### 2.3 Logique detaillee

```
ENTREE : documentId (UUID du document), collectionId (UUID de la collection)
SORTIE : DocumentDetail | null

1. Obtenir la connexion Drizzle via db()
   - Si null -> return null

2. Executer le SELECT :
   rows = await drizzle
     .select()
     .from(aiEngineKnowledgeDocuments)
     .where(
       and(
         eq(aiEngineKnowledgeDocuments.id, documentId),
         eq(aiEngineKnowledgeDocuments.collectionId, collectionId),
       ),
     )
     .limit(1)

3. Si rows.length === 0 -> return null

4. Mapper et retourner :
   return {
     id: row.id,
     collectionId: row.collectionId,
     title: row.title,
     sourceType: row.sourceType,
     sourceUrl: row.sourceUrl,
     contentText: row.contentText,
     metadata: row.metadata as Record<string, unknown> | null,
     chunkCount: row.chunkCount,
     createdAt: row.createdAt,
     updatedAt: row.updatedAt,
   }
```

### 2.4 Code complet

```typescript
export async function getDocumentById(
  documentId: string,
  collectionId: string,
): Promise<DocumentDetail | null> {
  const drizzle = db();
  if (!drizzle) return null;

  const rows = await drizzle
    .select()
    .from(aiEngineKnowledgeDocuments)
    .where(
      and(
        eq(aiEngineKnowledgeDocuments.id, documentId),
        eq(aiEngineKnowledgeDocuments.collectionId, collectionId),
      ),
    )
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0]!;
  return {
    id: row.id,
    collectionId: row.collectionId,
    title: row.title,
    sourceType: row.sourceType,
    sourceUrl: row.sourceUrl,
    contentText: row.contentText,
    metadata: row.metadata as Record<string, unknown> | null,
    chunkCount: row.chunkCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
```

### 2.5 Pourquoi la double verification documentId + collectionId ?

La requete filtre sur `documentId` ET `collectionId` pour :

1. **Securite** : Empecher l'acces a un document d'une autre collection via manipulation de l'URL
2. **Coherence** : Garantir que le document appartient bien a la collection referencee par le slug
3. **Convention** : Identique au pattern utilise dans le handler DELETE existant

---

## 3. updateDocument()

### 3.1 Signature

```typescript
export interface UpdateDocumentData {
  title?: string;
  content?: string;
}

export interface UpdateDocumentResult {
  success: boolean;
  chunkCount: number;
  reChunked: boolean;
  error?: string;
}

export async function updateDocument(
  documentId: string,
  collectionId: string,
  data: UpdateDocumentData,
): Promise<UpdateDocumentResult>
```

### 3.2 Localisation

Fichier : `ingestion.ts`, apres la fonction `ingestUrl()`.

### 3.3 Logique detaillee -- Cas 1 : Contenu modifie (re-chunking)

```
PRECONDITION : data.content !== undefined

1. Obtenir la connexion Drizzle via db()
   - Si null -> return { success: false, error: 'No database connection' }

2. Obtenir l'instance OpenAI Embeddings via getEmbeddings()
   - Si null -> return { success: false, error: 'OpenAI API key not configured' }

3. Enregistrer le timestamp de debut (startTime = Date.now())

4. OUVRIR UNE TRANSACTION (drizzle.transaction) :

   4a. SUPPRIMER les anciens chunks :
       DELETE FROM ai_engine_knowledge_chunk
       WHERE document_id = '{documentId}'
       
       Note : ON DELETE CASCADE est configure sur le FK,
       mais on supprime explicitement pour le controle
       dans la transaction.

   4b. METTRE A JOUR le document :
       UPDATE ai_engine_knowledge_document
       SET content_text = data.content,
           title = data.title (si fourni),
           updated_at = NOW()
       WHERE id = '{documentId}'

   4c. RE-DECOUPER le nouveau contenu :
       splitter = new RecursiveCharacterTextSplitter({
         chunkSize: 1000,
         chunkOverlap: 200,
       })
       chunks = await splitter.splitText(data.content)

   4d. GENERER les embeddings par batch :
       Pour chaque batch de 100 chunks :
         vectors = await embeddings.embedDocuments(batch)
         Construire les lignes de chunks :
           { collectionId, documentId, content, metadata, embedding }
         INSERT INTO ai_engine_knowledge_chunk VALUES (...)

   4e. METTRE A JOUR le compteur de chunks :
       UPDATE ai_engine_knowledge_document
       SET chunk_count = totalChunks
       WHERE id = '{documentId}'

   4f. RETOURNER totalChunks

5. FERMER LA TRANSACTION (COMMIT automatique si pas d'erreur)

6. METTRE A JOUR les compteurs de la collection :
   await updateCollectionCounts(collectionId)
   (Hors transaction : ne compromet pas l'integrite si echoue)

7. Logger la duree :
   log.info('Document updated with re-chunking', {
     documentId, chunkCount: result, durationMs
   })

8. Retourner { success: true, chunkCount: result, reChunked: true }
```

### 3.4 Logique detaillee -- Cas 2 : Titre seul modifie (sans re-chunking)

```
PRECONDITION : data.content === undefined, data.title !== undefined

1. Obtenir la connexion Drizzle via db()

2. METTRE A JOUR le document :
   UPDATE ai_engine_knowledge_document
   SET title = data.title,
       updated_at = NOW()
   WHERE id = '{documentId}'

3. RECUPERER le chunkCount actuel :
   SELECT chunk_count FROM ai_engine_knowledge_document
   WHERE id = '{documentId}'

4. Logger :
   log.info('Document title updated (no re-chunking)', { documentId })

5. Retourner { success: true, chunkCount, reChunked: false }
```

### 3.5 Gestion des erreurs

```
SI une exception survient a n'importe quelle etape :
  - La transaction est automatiquement ROLLBACK par Drizzle
  - Le message d'erreur est capture :
    const message = err instanceof Error ? err.message : 'Unknown error'
  - Logger :
    log.error('Document update failed', { documentId, error: message })
  - Retourner : { success: false, chunkCount: 0, reChunked: false, error: message }
```

### 3.6 Code complet

```typescript
export async function updateDocument(
  documentId: string,
  collectionId: string,
  data: UpdateDocumentData,
): Promise<UpdateDocumentResult> {
  const drizzle = db();
  if (!drizzle) {
    return {
      success: false,
      chunkCount: 0,
      reChunked: false,
      error: 'No database connection',
    };
  }

  const needsReChunk = data.content !== undefined;

  try {
    const startTime = Date.now();

    if (needsReChunk) {
      const embeddings = getEmbeddings();
      if (!embeddings) {
        return {
          success: false,
          chunkCount: 0,
          reChunked: false,
          error: 'OpenAI API key not configured',
        };
      }

      const result = await drizzle.transaction(async (tx) => {
        // 1. Supprimer les anciens chunks
        await tx
          .delete(aiEngineKnowledgeChunks)
          .where(eq(aiEngineKnowledgeChunks.documentId, documentId));

        // 2. Mettre a jour le document
        const updateFields: Record<string, unknown> = {
          contentText: data.content,
          updatedAt: new Date(),
        };
        if (data.title !== undefined) {
          updateFields.title = data.title;
        }

        await tx
          .update(aiEngineKnowledgeDocuments)
          .set(updateFields)
          .where(eq(aiEngineKnowledgeDocuments.id, documentId));

        // 3. Re-decouper le nouveau contenu
        const splitter = new RecursiveCharacterTextSplitter({
          chunkSize: CHUNK_SIZE,
          chunkOverlap: CHUNK_OVERLAP,
        });
        const chunks = await splitter.splitText(data.content!);

        // 4. Generer les embeddings et inserer les chunks
        let totalChunks = 0;
        for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
          const batch = chunks.slice(i, i + BATCH_SIZE);
          const vectors = await embeddings.embedDocuments(batch);

          const chunkRows = batch.map((chunkContent, idx) => ({
            collectionId,
            documentId,
            content: chunkContent,
            metadata: {
              chunkIndex: i + idx,
              totalChunks: chunks.length,
            } as Record<string, unknown>,
            embedding: vectors[idx]!,
          }));

          await tx.insert(aiEngineKnowledgeChunks).values(chunkRows);
          totalChunks += batch.length;
        }

        // 5. Mettre a jour le compteur
        await tx
          .update(aiEngineKnowledgeDocuments)
          .set({ chunkCount: totalChunks })
          .where(eq(aiEngineKnowledgeDocuments.id, documentId));

        return totalChunks;
      });

      // 6. Mettre a jour les compteurs de la collection
      await updateCollectionCounts(collectionId);

      const durationMs = Date.now() - startTime;
      log.info('Document updated with re-chunking', {
        documentId,
        chunkCount: result,
        durationMs,
      });

      return { success: true, chunkCount: result, reChunked: true };
    } else {
      // Cas 2 : titre seul
      const updateFields: Record<string, unknown> = {
        updatedAt: new Date(),
      };
      if (data.title !== undefined) {
        updateFields.title = data.title;
      }

      await drizzle
        .update(aiEngineKnowledgeDocuments)
        .set(updateFields)
        .where(eq(aiEngineKnowledgeDocuments.id, documentId));

      log.info('Document title updated (no re-chunking)', { documentId });

      const [doc] = await drizzle
        .select({ chunkCount: aiEngineKnowledgeDocuments.chunkCount })
        .from(aiEngineKnowledgeDocuments)
        .where(eq(aiEngineKnowledgeDocuments.id, documentId));

      return {
        success: true,
        chunkCount: doc?.chunkCount ?? 0,
        reChunked: false,
      };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    log.error('Document update failed', { documentId, error: message });
    return {
      success: false,
      chunkCount: 0,
      reChunked: false,
      error: message,
    };
  }
}
```

---

## 4. Logique de re-chunking -- Details techniques

### 4.1 Pourquoi supprimer TOUS les chunks ?

Meme si seule une partie du contenu a change, on supprime tous les chunks car :

1. **Le chevauchement (overlap)** fait que chaque chunk depend de ses voisins
2. **L'index des chunks** (chunkIndex, totalChunks dans metadata) doit etre coherent
3. **Les embeddings** ne sont pas incrementaux : modifier un caractere change le vecteur entier
4. **La simplicite** : evite la complexite d'un diff semantique

### 4.2 Parametres de re-chunking

Les parametres sont identiques a l'ingestion initiale (constantes du module) :

```typescript
const CHUNK_SIZE = 1000;      // Taille maximale d'un chunk en caracteres
const CHUNK_OVERLAP = 200;     // Chevauchement entre chunks consecutifs
const BATCH_SIZE = 100;        // Taille de batch pour l'API d'embedding
```

### 4.3 Metadata des chunks re-generes

Chaque chunk re-genere recoit les metadata minimales :

```typescript
{
  chunkIndex: i + idx,          // Index du chunk dans le document
  totalChunks: chunks.length,   // Nombre total de chunks
}
```

Les metadata supplementaires du document original (sourceUrl, sourceType) ne sont PAS incluses dans les chunks individuels lors du re-chunking, car elles sont accessibles via la jointure avec le document parent. Cela differe legerement de l'ingestion initiale ou des metadata custom pouvaient etre ajoutees.

---

## 5. Mise a jour des compteurs

### 5.1 Apres updateDocument()

L'appel `updateCollectionCounts(collectionId)` est effectue apres la transaction pour :

1. Recalculer `documentCount` (SELECT COUNT(*) FROM documents WHERE collection_id = ?)
2. Recalculer `chunkCount` (SELECT COUNT(*) FROM chunks WHERE collection_id = ?)
3. Mettre a jour `lastIndexedAt` a NOW()

### 5.2 Apres updateCollection()

Aucune mise a jour de compteurs n'est necessaire lors d'un update de collection (les compteurs ne changent pas).

---

## 6. Barrel export mis a jour

Le fichier `index.ts` doit exporter les nouvelles fonctions et types :

```typescript
// Ajouts dans les exports de './collections'
export {
  // ... existants ...
  updateCollection,          // NOUVEAU
  getDocumentById,           // NOUVEAU
  type UpdateCollectionData, // NOUVEAU
  type DocumentDetail,       // NOUVEAU
} from './collections';

// Ajouts dans les exports de './ingestion'
export {
  // ... existants ...
  updateDocument,            // NOUVEAU
  type UpdateDocumentData,   // NOUVEAU
  type UpdateDocumentResult, // NOUVEAU
} from './ingestion';
```

---

## 7. Impact sur les fonctions existantes

### 7.1 Fonctions non modifiees

| Fonction | Raison |
|----------|--------|
| `createCollection()` | Aucun changement |
| `listCollections()` | Le champ updatedAt est mapppe automatiquement par mapRow |
| `getCollection()` | Idem |
| `deleteCollection()` | Aucun changement |
| `updateCollectionCounts()` | Aucun changement |
| `ingestText()` | Aucun changement |
| `ingestUrl()` | Aucun changement |
| `searchKnowledge()` | Aucun changement |

### 7.2 Fonctions modifiees

| Fonction | Modification |
|----------|-------------|
| `mapRow()` | Ajout du champ `updatedAt` |
| Interface `CollectionRow` | Ajout du champ `updatedAt: Date` |

### 7.3 Impact sur les tests existants

Les tests existants dans `collections.test.ts` et `ingestion.test.ts` pourraient etre impactes par l'ajout du champ `updatedAt` dans les mocks. Les mocks devront etre mis a jour pour inclure ce champ.
