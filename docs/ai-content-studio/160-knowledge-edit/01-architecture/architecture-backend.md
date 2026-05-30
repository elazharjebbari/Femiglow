# Architecture Backend -- Knowledge Edit

**Module** : AI Engine / Knowledge Base  
**Fichiers concernes** :
- `apps/web/src/lib/ai-engine/knowledge/collections.ts`
- `apps/web/src/lib/ai-engine/knowledge/ingestion.ts`
- `apps/web/src/lib/ai-engine/knowledge/index.ts`
- `apps/web/src/app/api/admin/ai-engine/knowledge/[slug]/route.ts`
- `apps/web/src/app/api/admin/ai-engine/knowledge/[slug]/documents/[docId]/route.ts`
- `apps/web/src/lib/db/schema-ai-engine.ts`

---

## 1. Vue d'ensemble de l'architecture backend

```
  UI (PATCH request)
       |
       v
  +-----------------------------+
  |  API Route (Next.js)        |
  |  - requireAdminApi()        |
  |  - Zod validation           |
  |  - Route vers service       |
  +-----------------------------+
       |
       v
  +-----------------------------+
  |  Service Layer              |
  |  - updateCollection()       |
  |  - updateDocument()         |
  |  - getDocumentById()        |
  +-----------------------------+
       |
       v
  +-----------------------------+
  |  Drizzle ORM                |
  |  - Transaction wrapping     |
  |  - UPDATE / DELETE / INSERT |
  +-----------------------------+
       |
       v
  +-----------------------------+
  |  PostgreSQL + pgvector      |
  |  - Tables knowledge_*       |
  |  - Vecteurs 1536 dims       |
  +-----------------------------+
```

---

## 2. Migration du schema

### 2.1 Nouvelles colonnes

Deux colonnes `updated_at` doivent etre ajoutees aux tables existantes pour tracer la date de derniere modification.

**Table `ai_engine_knowledge_collection`** :

```typescript
// Dans schema-ai-engine.ts, ajouter dans aiEngineKnowledgeCollections :
updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
```

**Table `ai_engine_knowledge_document`** :

```typescript
// Dans schema-ai-engine.ts, ajouter dans aiEngineKnowledgeDocuments :
updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
```

### 2.2 Migration Drizzle

Fichier de migration a generer via `npx drizzle-kit generate:pg` :

```sql
-- Migration : add updated_at to knowledge tables
ALTER TABLE ai_engine_knowledge_collection
  ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();

ALTER TABLE ai_engine_knowledge_document
  ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();

-- Initialiser les valeurs existantes avec created_at
UPDATE ai_engine_knowledge_collection SET updated_at = created_at;
UPDATE ai_engine_knowledge_document SET updated_at = created_at;
```

### 2.3 Impact sur les interfaces existantes

L'interface `CollectionRow` dans `collections.ts` doit etre etendue :

```typescript
export interface CollectionRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  documentCount: number;
  chunkCount: number;
  lastIndexedAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;  // NOUVEAU
}
```

La fonction `mapRow` doit etre mise a jour pour inclure `updatedAt`.

---

## 3. Service Layer -- Nouvelles fonctions

### 3.1 updateCollection(id, data)

**Fichier** : `apps/web/src/lib/ai-engine/knowledge/collections.ts`

**Signature** :

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

**Logique** :

1. Verifier la connexion DB (`db()`)
2. Construire l'objet `set` dynamiquement a partir des champs fournis
3. Toujours inclure `updatedAt: new Date()` dans le `set`
4. Executer `drizzle.update().set().where().returning()`
5. Verifier qu'une ligne a ete retournee (sinon le document n'existe pas)
6. Logger l'operation
7. Retourner la ligne mappee

**Implementation detaillee** :

```typescript
export async function updateCollection(
  id: string,
  data: UpdateCollectionData,
): Promise<CollectionRow> {
  const drizzle = db();
  if (!drizzle) {
    throw new Error('Database connection required');
  }

  // Construire dynamiquement l'objet de mise a jour
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

**Points d'attention** :

- Le slug n'est JAMAIS modifie (identifiant permanent)
- La mise a jour est partielle (PATCH) : seuls les champs fournis sont modifies
- La colonne `updatedAt` est toujours mise a jour
- La clause `returning()` evite un SELECT supplementaire

### 3.2 getDocumentById(documentId, collectionId)

**Fichier** : `apps/web/src/lib/ai-engine/knowledge/collections.ts`

**Signature** :

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

**Logique** :

1. Verifier la connexion DB
2. Executer un SELECT avec les conditions `id = documentId AND collectionId = collectionId`
3. Retourner null si aucun resultat
4. Mapper et retourner le resultat

**Implementation** :

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

### 3.3 updateDocument(documentId, collectionId, data)

**Fichier** : `apps/web/src/lib/ai-engine/knowledge/ingestion.ts`

**Signature** :

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

**Logique detaillee** :

```
1. Verifier la connexion DB
2. SI data.content est fourni :
   2a. Verifier la disponibilite de l'API OpenAI (getEmbeddings())
   2b. Ouvrir une TRANSACTION :
       - Supprimer tous les chunks existants du document
         DELETE FROM ai_engine_knowledge_chunk WHERE document_id = ?
       - Mettre a jour le document (title + contentText + updatedAt)
         UPDATE ai_engine_knowledge_document SET ... WHERE id = ?
       - Re-decouper le contenu (RecursiveCharacterTextSplitter)
       - Generer les embeddings (OpenAIEmbeddings.embedDocuments)
       - Inserer les nouveaux chunks
         INSERT INTO ai_engine_knowledge_chunk VALUES (...)
       - Mettre a jour le chunkCount du document
         UPDATE ai_engine_knowledge_document SET chunk_count = ?
   2c. Mettre a jour les compteurs de la collection
       updateCollectionCounts(collectionId)
3. SI seul title est fourni (pas de content) :
   3a. Mise a jour simple sans re-chunking
       UPDATE ai_engine_knowledge_document SET title = ?, updated_at = NOW()
       WHERE id = ?
4. Logger l'operation et retourner le resultat
```

**Implementation detaillee** :

```typescript
export async function updateDocument(
  documentId: string,
  collectionId: string,
  data: UpdateDocumentData,
): Promise<UpdateDocumentResult> {
  const drizzle = db();
  if (!drizzle) {
    return { success: false, chunkCount: 0, reChunked: false, error: 'No database connection' };
  }

  const needsReChunk = data.content !== undefined;

  try {
    const startTime = Date.now();

    if (needsReChunk) {
      // --- Cas 1 : Le contenu est modifie -> re-chunking + re-embedding ---

      const embeddings = getEmbeddings();
      if (!embeddings) {
        return {
          success: false,
          chunkCount: 0,
          reChunked: false,
          error: 'OpenAI API key not configured',
        };
      }

      // Tout dans une transaction pour garantir l'atomicite
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

        // 4. Generer les embeddings par batch
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

          // 5. Inserer les nouveaux chunks
          await tx.insert(aiEngineKnowledgeChunks).values(chunkRows);
          totalChunks += batch.length;
        }

        // 6. Mettre a jour le compteur de chunks du document
        await tx
          .update(aiEngineKnowledgeDocuments)
          .set({ chunkCount: totalChunks })
          .where(eq(aiEngineKnowledgeDocuments.id, documentId));

        return totalChunks;
      });

      // 7. Mettre a jour les compteurs de la collection (hors transaction)
      await updateCollectionCounts(collectionId);

      const durationMs = Date.now() - startTime;
      log.info('Document updated with re-chunking', {
        documentId,
        chunkCount: result,
        durationMs,
      });

      return { success: true, chunkCount: result, reChunked: true };

    } else {
      // --- Cas 2 : Seul le titre est modifie -> pas de re-chunking ---

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

      // Recuperer le chunkCount actuel
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
    return { success: false, chunkCount: 0, reChunked: false, error: message };
  }
}
```

---

## 4. Strategie de re-chunking

### 4.1 Pourquoi "delete-all + re-create" ?

Trois strategies ont ete evaluees :

| Strategie | Description | Avantages | Inconvenients |
|-----------|-------------|-----------|---------------|
| **Delete-all + re-create** | Supprimer tous les chunks puis re-decouper et re-embedder | Simplicite, coherence garantie, pas de chunks orphelins | Cout embedding (negligeable), temps de traitement |
| **Diff + update partiel** | Comparer les anciens et nouveaux chunks, ne re-embedder que les differents | Economie d'embeddings | Complexite elevee, detection de diff sur des chunks chevauchants, risque d'incoherence |
| **Append-only + tombstone** | Marquer les anciens chunks comme obsoletes, ajouter les nouveaux | Historique | Fragmentation de la table, requetes de recherche plus complexes |

**Choix : Delete-all + re-create** pour les raisons suivantes :

1. **Simplicite** : Le code est lineaire et facile a tester
2. **Coherence** : Aucun risque de chunks orphelins ou obsoletes
3. **Cout negligeable** : Pour un document typique (5000 caracteres = ~5 chunks), le cout d'embedding est < $0.001
4. **Atomicite** : La transaction Drizzle garantit que les anciens chunks sont supprimes et les nouveaux inseres dans la meme operation

### 4.2 Diagramme du processus de re-chunking

```
                     TRANSACTION BEGIN
                           |
                    +------v------+
                    | DELETE FROM |
                    | chunks      |
                    | WHERE       |
                    | document_id |
                    +------+------+
                           |
                    +------v------+
                    | UPDATE      |
                    | document    |
                    | SET content |
                    | + updatedAt |
                    +------+------+
                           |
                    +------v------+
                    | SPLIT TEXT  |
                    | Recursive   |
                    | Splitter    |
                    | 1000/200    |
                    +------+------+
                           |
                    +------v------+
                    | EMBED       |
                    | OpenAI API  |
                    | batch=100   |
                    +------+------+
                           |
                    +------v------+
                    | INSERT      |
                    | new chunks  |
                    | with vectors|
                    +------+------+
                           |
                    +------v------+
                    | UPDATE doc  |
                    | SET         |
                    | chunk_count |
                    +------+------+
                           |
                    TRANSACTION COMMIT
                           |
                    +------v------+
                    | UPDATE      |
                    | collection  |
                    | counts      |
                    +------+------+
```

### 4.3 Parametres de chunking (inchanges)

| Parametre | Valeur | Justification |
|-----------|--------|---------------|
| `chunkSize` | 1000 | Identique a l'ingestion initiale pour coherence |
| `chunkOverlap` | 200 | 20% de chevauchement, identique |
| `batchSize` | 100 | Limite de batch pour l'API OpenAI |

---

## 5. Securite des transactions

### 5.1 Transaction Drizzle

Le re-chunking complet est encapsule dans une transaction Drizzle :

```typescript
const result = await drizzle.transaction(async (tx) => {
  // Toutes les operations DELETE/INSERT/UPDATE utilisent `tx`
  // Si une erreur survient, ROLLBACK automatique
});
```

**Garanties :**

- **Atomicite** : Soit toutes les operations reussissent, soit aucune
- **Isolation** : Les requetes de recherche en vol ne voient pas l'etat intermediaire
- **Durabilite** : Apres COMMIT, les donnees sont persistees

### 5.2 Scenarios d'erreur et rollback

| Scenario | Comportement | Etat final |
|----------|-------------|------------|
| Erreur API OpenAI pendant l'embedding | ROLLBACK de la transaction | Anciens chunks preserves, contenu original intact |
| Erreur de connexion DB pendant l'INSERT | ROLLBACK automatique | Anciens chunks preserves |
| Timeout de la requete (120s) | ROLLBACK via connexion fermee | Anciens chunks preserves |
| Contenu vide apres validation | Rejete avant la transaction | Aucun changement |

### 5.3 Note sur updateCollectionCounts

L'appel `updateCollectionCounts(collectionId)` est effectue APRES la transaction, car il s'agit d'une mise a jour de compteurs caches qui peut echouer sans compromettre l'integrite des donnees. En cas d'echec, les compteurs seront recalcules lors de la prochaine operation sur la collection.

---

## 6. API Routes -- Implementation

### 6.1 PATCH /api/admin/ai-engine/knowledge/[slug]

**Fichier** : `apps/web/src/app/api/admin/ai-engine/knowledge/[slug]/route.ts`

L'endpoint PATCH est ajoute au fichier qui contient deja DELETE.

```typescript
import { z } from 'zod';
import { getCollection, updateCollection } from '@/lib/ai-engine/knowledge';

const updateCollectionSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).nullable().optional(),
  category: z.string().min(1).max(50).optional(),
}).refine(
  (data) => data.name !== undefined || data.description !== undefined || data.category !== undefined,
  { message: 'At least one field must be provided' },
);

export async function PATCH(
  request: Request,
  { params }: { params: { slug: string } },
): Promise<Response> {
  try {
    await requireAdminApi();

    const collection = await getCollection(params.slug);
    if (!collection) {
      throw new HttpError('not_found', `Collection "${params.slug}" not found`);
    }

    const body = await request.json();
    const parsed = updateCollectionSchema.parse(body);

    const updated = await updateCollection(collection.id, parsed);

    return NextResponse.json({ collection: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: err.errors },
        { status: 400 },
      );
    }
    const errRes = formatErrorResponse(err);
    return NextResponse.json(errRes.body, { status: errRes.status });
  }
}
```

### 6.2 GET + PATCH /api/admin/ai-engine/knowledge/[slug]/documents/[docId]

**Fichier** : `apps/web/src/app/api/admin/ai-engine/knowledge/[slug]/documents/[docId]/route.ts`

Le fichier contient deja DELETE. On ajoute GET et PATCH.

```typescript
import { z } from 'zod';
import {
  getCollection,
  getDocumentById,
  updateCollectionCounts,
} from '@/lib/ai-engine/knowledge';
import { updateDocument } from '@/lib/ai-engine/knowledge';

const updateDocumentSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().min(1).optional(),
}).refine(
  (data) => data.title !== undefined || data.content !== undefined,
  { message: 'At least one field must be provided' },
);

export async function GET(
  _request: Request,
  { params }: { params: { slug: string; docId: string } },
): Promise<Response> {
  try {
    await requireAdminApi();

    const collection = await getCollection(params.slug);
    if (!collection) {
      throw new HttpError('not_found', `Collection "${params.slug}" not found`);
    }

    const document = await getDocumentById(params.docId, collection.id);
    if (!document) {
      throw new HttpError('not_found', `Document "${params.docId}" not found`);
    }

    return NextResponse.json({ document });
  } catch (err) {
    const errRes = formatErrorResponse(err);
    return NextResponse.json(errRes.body, { status: errRes.status });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { slug: string; docId: string } },
): Promise<Response> {
  try {
    await requireAdminApi();

    const collection = await getCollection(params.slug);
    if (!collection) {
      throw new HttpError('not_found', `Collection "${params.slug}" not found`);
    }

    const body = await request.json();
    const parsed = updateDocumentSchema.parse(body);

    const result = await updateDocument(params.docId, collection.id, parsed);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Update failed', detail: result.error },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      chunkCount: result.chunkCount,
      reChunked: result.reChunked,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: err.errors },
        { status: 400 },
      );
    }
    const errRes = formatErrorResponse(err);
    return NextResponse.json(errRes.body, { status: errRes.status });
  }
}
```

---

## 7. Gestion des erreurs

### 7.1 Codes d'erreur HTTP

| Code | Situation | Exemple |
|------|-----------|---------|
| 200 | Mise a jour reussie | PATCH collection ou document |
| 400 | Donnees invalides (Zod) | Nom vide, categorie manquante |
| 401 | Authentification echouee | Session expiree |
| 404 | Ressource introuvable | Collection ou document inexistant |
| 500 | Erreur interne | Echec de l'embedding, erreur DB |
| 503 | Base de donnees indisponible | Connexion DB null |

### 7.2 Format de reponse d'erreur

Le format est identique aux endpoints existants, utilisant `HttpError` et `formatErrorResponse` :

```json
{
  "error": {
    "code": "not_found",
    "message": "Collection \"xyz\" not found"
  }
}
```

Pour les erreurs de validation Zod :

```json
{
  "error": "Validation error",
  "details": [
    {
      "code": "too_small",
      "minimum": 1,
      "type": "string",
      "inclusive": true,
      "message": "String must contain at least 1 character(s)",
      "path": ["name"]
    }
  ]
}
```

### 7.3 Logging

Chaque operation est tracee via le logger existant (`createLogger`) :

```typescript
log.info('Collection updated', { id, fields: Object.keys(data) });
log.info('Document updated with re-chunking', { documentId, chunkCount, durationMs });
log.info('Document title updated (no re-chunking)', { documentId });
log.error('Document update failed', { documentId, error: message });
```

---

## 8. Export depuis le barrel index

Le fichier `apps/web/src/lib/ai-engine/knowledge/index.ts` doit etre mis a jour pour exporter les nouvelles fonctions :

```typescript
export {
  createCollection,
  listCollections,
  getCollection,
  deleteCollection,
  updateCollection,          // NOUVEAU
  updateCollectionCounts,
  getDocumentById,           // NOUVEAU
  seedDefaultCollections,
  type CollectionRow,
  type UpdateCollectionData, // NOUVEAU
  type DocumentDetail,       // NOUVEAU
} from './collections';

export {
  ingestText,
  ingestUrl,
  updateDocument,            // NOUVEAU
  type IngestResult,
  type UpdateDocumentData,   // NOUVEAU
  type UpdateDocumentResult, // NOUVEAU
} from './ingestion';

export {
  searchKnowledge,
  searchByCollections,
  type SearchOptions,
  type SearchResult,
} from './retrieval';

export { seedKnowledgeBase } from './seed-data';
```

---

## 9. Performance et limites

### 9.1 Benchmarks estimes

| Operation | Taille contenu | Temps estime | Facteur limitant |
|-----------|---------------|-------------|-----------------|
| PATCH collection (metadonnees) | - | < 100ms | Latence DB |
| PATCH document (titre seul) | - | < 100ms | Latence DB |
| PATCH document (re-chunk, 1000 chars) | 1 chunk | ~1s | API OpenAI |
| PATCH document (re-chunk, 5000 chars) | ~5 chunks | ~3s | API OpenAI |
| PATCH document (re-chunk, 50000 chars) | ~50 chunks | ~15s | API OpenAI batch |

### 9.2 Timeout de la route

Le timeout de la route est configure a 120 secondes (identique a l'ingestion) :

```typescript
export const maxDuration = 120;
```

### 9.3 Limites

- Pas de retry automatique en cas d'echec partiel de l'embedding
- Le re-embedding est synchrone (pas de worker/queue)
- La taille maximale du contenu depend de la limite du body parser de Next.js (par defaut 1MB)
