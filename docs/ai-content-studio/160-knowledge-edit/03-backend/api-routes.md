# API Routes -- Knowledge Edit

**Base path** : `/api/admin/ai-engine/knowledge`  
**Authentification** : `requireAdminApi()` (cookie de session admin)  
**Validation** : Zod 3.x  
**Runtime** : Node.js (App Router)

---

## 1. Vue d'ensemble des endpoints

### 1.1 Endpoints existants (rappel)

| Methode | Path | Description |
|---------|------|-------------|
| GET | `/api/admin/ai-engine/knowledge` | Lister toutes les collections |
| POST | `/api/admin/ai-engine/knowledge` | Creer une collection |
| DELETE | `/api/admin/ai-engine/knowledge/[slug]` | Supprimer une collection (soft-delete) |
| GET | `/api/admin/ai-engine/knowledge/[slug]/documents` | Lister les documents d'une collection |
| POST | `/api/admin/ai-engine/knowledge/[slug]/documents` | Ingerer un document (text/url) |
| DELETE | `/api/admin/ai-engine/knowledge/[slug]/documents/[docId]` | Supprimer un document |

### 1.2 Nouveaux endpoints

| Methode | Path | Description |
|---------|------|-------------|
| **PATCH** | `/api/admin/ai-engine/knowledge/[slug]` | Mettre a jour une collection |
| **GET** | `/api/admin/ai-engine/knowledge/[slug]/documents/[docId]` | Recuperer un document complet |
| **PATCH** | `/api/admin/ai-engine/knowledge/[slug]/documents/[docId]` | Mettre a jour un document |

---

## 2. PATCH /api/admin/ai-engine/knowledge/[slug]

### 2.1 Description

Met a jour partiellement une collection existante. Permet de modifier le nom, la description et/ou la categorie. Le slug n'est pas modifiable.

### 2.2 Fichier

`apps/web/src/app/api/admin/ai-engine/knowledge/[slug]/route.ts`

Ce fichier contient deja le handler `DELETE`. Le handler `PATCH` est ajoute dans le meme fichier.

### 2.3 Requete

**Methode** : PATCH  
**Content-Type** : application/json  
**Path Parameters** :

| Parametre | Type | Description | Exemple |
|-----------|------|-------------|---------|
| `slug` | string | Slug unique de la collection | `brand-femiglow` |

**Body (JSON)** :

| Champ | Type | Requis | Validation | Description |
|-------|------|--------|-----------|-------------|
| `name` | string | Non | min 1, max 200 | Nouveau nom |
| `description` | string \| null | Non | max 500 | Nouvelle description (null pour effacer) |
| `category` | string | Non | min 1, max 50 | Nouvelle categorie |

**Contrainte** : Au moins un champ parmi `name`, `description`, `category` doit etre fourni.

### 2.4 Schema Zod

```typescript
const updateCollectionSchema = z.object({
  name: z.string().min(1, 'Le nom est obligatoire').max(200, 'Le nom ne peut pas depasser 200 caracteres').optional(),
  description: z.string().max(500, 'La description ne peut pas depasser 500 caracteres').nullable().optional(),
  category: z.string().min(1).max(50).optional(),
}).refine(
  (data) => data.name !== undefined || data.description !== undefined || data.category !== undefined,
  { message: 'Au moins un champ doit etre fourni' },
);
```

### 2.5 Reponses

**200 OK** -- Mise a jour reussie :

```json
{
  "collection": {
    "id": "abc-123",
    "name": "Brand Guidelines FemiGlow (v2)",
    "slug": "brand-femiglow",
    "description": "Identite de marque mise a jour 2026",
    "category": "brand",
    "documentCount": 5,
    "chunkCount": 42,
    "lastIndexedAt": "2026-05-24T14:30:00.000Z",
    "isActive": true,
    "createdAt": "2026-04-01T10:00:00.000Z",
    "updatedAt": "2026-05-25T09:15:00.000Z"
  }
}
```

**400 Bad Request** -- Validation echouee :

```json
{
  "error": "Validation error",
  "details": [
    {
      "code": "too_small",
      "minimum": 1,
      "type": "string",
      "inclusive": true,
      "exact": false,
      "message": "Le nom est obligatoire",
      "path": ["name"]
    }
  ]
}
```

**400 Bad Request** -- Aucun champ fourni :

```json
{
  "error": "Validation error",
  "details": [
    {
      "code": "custom",
      "message": "Au moins un champ doit etre fourni",
      "path": []
    }
  ]
}
```

**401 Unauthorized** -- Session invalide :

```json
{
  "error": {
    "code": "unauthorized",
    "message": "Session expired"
  }
}
```

**404 Not Found** -- Collection introuvable :

```json
{
  "error": {
    "code": "not_found",
    "message": "Collection \"xyz\" not found"
  }
}
```

### 2.6 Exemples curl

```bash
# Modifier le nom et la description
curl -X PATCH \
  http://localhost:3000/api/admin/ai-engine/knowledge/brand-femiglow \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{"name": "Brand Guidelines FemiGlow (v2)", "description": "Identite de marque 2026"}'

# Modifier uniquement la categorie
curl -X PATCH \
  http://localhost:3000/api/admin/ai-engine/knowledge/neuromarketing \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{"category": "psychology"}'

# Supprimer la description (mettre a null)
curl -X PATCH \
  http://localhost:3000/api/admin/ai-engine/knowledge/brand-femiglow \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{"description": null}'
```

### 2.7 Implementation

```typescript
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

---

## 3. GET /api/admin/ai-engine/knowledge/[slug]/documents/[docId]

### 3.1 Description

Recupere le detail complet d'un document, incluant le contenu textuel (`contentText`). Ce champ n'est pas retourne dans la liste des documents (GET documents) pour des raisons de performance.

### 3.2 Fichier

`apps/web/src/app/api/admin/ai-engine/knowledge/[slug]/documents/[docId]/route.ts`

Ce fichier contient deja le handler `DELETE`. Le handler `GET` est ajoute.

### 3.3 Requete

**Methode** : GET  
**Path Parameters** :

| Parametre | Type | Description | Exemple |
|-----------|------|-------------|---------|
| `slug` | string | Slug de la collection | `brand-femiglow` |
| `docId` | string | ID UUID du document | `doc-456-uuid` |

### 3.4 Reponse

**200 OK** :

```json
{
  "document": {
    "id": "doc-456-uuid",
    "collectionId": "col-123-uuid",
    "title": "Guide des ingredients japonais",
    "sourceType": "text",
    "sourceUrl": null,
    "contentText": "Le Tsubaki (Camellia japonica) est une huile precieuse...",
    "metadata": null,
    "chunkCount": 15,
    "createdAt": "2026-05-01T08:00:00.000Z",
    "updatedAt": "2026-05-20T14:00:00.000Z"
  }
}
```

**401 Unauthorized** :

```json
{
  "error": {
    "code": "unauthorized",
    "message": "Session expired"
  }
}
```

**404 Not Found** -- Collection introuvable :

```json
{
  "error": {
    "code": "not_found",
    "message": "Collection \"xyz\" not found"
  }
}
```

**404 Not Found** -- Document introuvable ou n'appartient pas a la collection :

```json
{
  "error": {
    "code": "not_found",
    "message": "Document \"doc-999\" not found"
  }
}
```

### 3.5 Exemple curl

```bash
curl -X GET \
  http://localhost:3000/api/admin/ai-engine/knowledge/brand-femiglow/documents/doc-456-uuid \
  -H "Cookie: session=..."
```

### 3.6 Implementation

```typescript
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
```

---

## 4. PATCH /api/admin/ai-engine/knowledge/[slug]/documents/[docId]

### 4.1 Description

Met a jour un document existant. Si le champ `content` est fourni, les chunks existants sont supprimes et le nouveau contenu est re-decoupe et re-embedde. Si seul le `title` est fourni, la mise a jour est immediate sans re-chunking.

### 4.2 Fichier

`apps/web/src/app/api/admin/ai-engine/knowledge/[slug]/documents/[docId]/route.ts`

### 4.3 Requete

**Methode** : PATCH  
**Content-Type** : application/json  
**Max Duration** : 120 secondes (pour le re-embedding)

**Path Parameters** :

| Parametre | Type | Description | Exemple |
|-----------|------|-------------|---------|
| `slug` | string | Slug de la collection | `brand-femiglow` |
| `docId` | string | ID UUID du document | `doc-456-uuid` |

**Body (JSON)** :

| Champ | Type | Requis | Validation | Description |
|-------|------|--------|-----------|-------------|
| `title` | string | Non | min 1, max 500 | Nouveau titre |
| `content` | string | Non | min 1 | Nouveau contenu (declenche re-chunking) |

**Contrainte** : Au moins un champ parmi `title`, `content` doit etre fourni.

### 4.4 Schema Zod

```typescript
const updateDocumentSchema = z.object({
  title: z.string()
    .min(1, 'Le titre est obligatoire')
    .max(500, 'Le titre ne peut pas depasser 500 caracteres')
    .optional(),
  content: z.string()
    .min(1, 'Le contenu ne peut pas etre vide')
    .optional(),
}).refine(
  (data) => data.title !== undefined || data.content !== undefined,
  { message: 'Au moins un champ doit etre fourni' },
);
```

### 4.5 Reponses

**200 OK** -- Mise a jour sans re-chunking (titre seul) :

```json
{
  "success": true,
  "chunkCount": 15,
  "reChunked": false
}
```

**200 OK** -- Mise a jour avec re-chunking :

```json
{
  "success": true,
  "chunkCount": 18,
  "reChunked": true
}
```

**400 Bad Request** -- Validation echouee :

```json
{
  "error": "Validation error",
  "details": [
    {
      "code": "too_small",
      "minimum": 1,
      "type": "string",
      "inclusive": true,
      "exact": false,
      "message": "Le titre est obligatoire",
      "path": ["title"]
    }
  ]
}
```

**401 Unauthorized** :

```json
{
  "error": {
    "code": "unauthorized",
    "message": "Session expired"
  }
}
```

**404 Not Found** :

```json
{
  "error": {
    "code": "not_found",
    "message": "Collection \"xyz\" not found"
  }
}
```

**500 Internal Server Error** -- Echec de l'embedding :

```json
{
  "error": "Update failed",
  "detail": "OpenAI API rate limit exceeded"
}
```

### 4.6 Exemples curl

```bash
# Modifier uniquement le titre (pas de re-chunking)
curl -X PATCH \
  http://localhost:3000/api/admin/ai-engine/knowledge/brand-femiglow/documents/doc-456 \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{"title": "Guide des ingredients japonais (Edition 2026)"}'

# Modifier le contenu (declenche re-chunking + re-embedding)
curl -X PATCH \
  http://localhost:3000/api/admin/ai-engine/knowledge/brand-femiglow/documents/doc-456 \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{"content": "Nouveau contenu complet du document..."}'

# Modifier titre ET contenu
curl -X PATCH \
  http://localhost:3000/api/admin/ai-engine/knowledge/brand-femiglow/documents/doc-456 \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{"title": "Nouveau titre", "content": "Nouveau contenu..."}'
```

### 4.7 Implementation

```typescript
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

## 5. Tableau recapitulatif des codes HTTP

| Code | Signification | Endpoints concernes |
|------|-------------|-------------------|
| 200 | Succes | PATCH collection, GET document, PATCH document |
| 400 | Validation echouee (Zod) | PATCH collection, PATCH document |
| 401 | Non authentifie | Tous |
| 404 | Ressource introuvable | Tous |
| 500 | Erreur interne (embedding, DB) | PATCH document |
| 503 | Base de donnees indisponible | Tous (via db() = null) |

---

## 6. Notes sur la compatibilite

### 6.1 Coexistence avec les handlers existants

Les handlers PATCH et GET sont ajoutes dans les memes fichiers de route que les handlers DELETE existants. Next.js App Router supporte l'export de plusieurs fonctions HTTP par fichier :

```typescript
// route.ts exporte : DELETE (existant) + PATCH (nouveau) + GET (nouveau)
export async function DELETE(...) { ... }
export async function PATCH(...) { ... }
export async function GET(...) { ... }
```

### 6.2 Imports mis a jour

Le fichier `route.ts` du [docId] devra ajouter les imports :

```typescript
import { z } from 'zod';
import {
  getCollection,
  getDocumentById,        // NOUVEAU
  updateCollectionCounts,
} from '@/lib/ai-engine/knowledge';
import { updateDocument } from '@/lib/ai-engine/knowledge'; // NOUVEAU
```

### 6.3 maxDuration

Le handler PATCH pour les documents doit avoir `maxDuration = 120` (identique au POST d'ingestion) pour supporter les re-embeddings de gros documents :

```typescript
export const maxDuration = 120;
```

Ce export est au niveau du fichier et s'applique a tous les handlers du fichier.
