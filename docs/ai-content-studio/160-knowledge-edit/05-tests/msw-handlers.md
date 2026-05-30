# Handlers MSW 2.x -- Knowledge Edit

**Framework** : MSW 2.x (Mock Service Worker)  
**Fichier** : `apps/web/src/test/msw/handlers/ai-engine-knowledge-edit.handlers.ts`  
**Utilisation** : Tests Vitest des composants UI (knowledge-page-edit.test.tsx)

---

## 1. Vue d'ensemble

Les handlers MSW interceptent les requetes HTTP du composant `KnowledgeBasePage` pendant les tests unitaires front-end. Chaque handler simule le comportement de l'API backend sans base de donnees ni serveur.

### 1.1 Architecture des handlers

```
handlers/
  ai-engine-knowledge-edit.handlers.ts   <-- NOUVEAU
  ai-engine-knowledge.handlers.ts        (existant, pour GET/POST/DELETE)
  index.ts                               (re-export tous les handlers)
```

### 1.2 Endpoints couverts

| Methode | Path | Handler |
|---------|------|---------|
| PATCH | `/api/admin/ai-engine/knowledge/:slug` | `patchCollectionHandler` |
| GET | `/api/admin/ai-engine/knowledge/:slug/documents/:docId` | `getDocumentHandler` |
| PATCH | `/api/admin/ai-engine/knowledge/:slug/documents/:docId` | `patchDocumentHandler` |

---

## 2. Imports et types

```typescript
import { http, HttpResponse, delay } from 'msw';

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

interface CollectionRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  documentCount: number;
  chunkCount: number;
  lastIndexedAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

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

interface UpdateCollectionRequest {
  name?: string;
  description?: string | null;
  category?: string;
}

interface UpdateDocumentRequest {
  title?: string;
  content?: string;
}

interface UpdateDocumentResponse {
  success: boolean;
  chunkCount: number;
  reChunked: boolean;
}

interface ErrorResponse {
  error: string | { code: string; message: string };
  details?: Array<{ code: string; message: string; path: string[] }>;
  detail?: string;
}
```

---

## 3. Donnees de test (fixtures)

```typescript
// -----------------------------------------------------------------
// Fixtures
// -----------------------------------------------------------------

const MOCK_COLLECTION: CollectionRow = {
  id: 'col-msw-001',
  name: 'Brand FemiGlow',
  slug: 'brand-femiglow',
  description: 'Identite de marque FemiGlow',
  category: 'brand',
  documentCount: 3,
  chunkCount: 25,
  lastIndexedAt: '2026-05-20T10:00:00.000Z',
  isActive: true,
  createdAt: '2026-04-01T10:00:00.000Z',
  updatedAt: '2026-05-20T10:00:00.000Z',
};

const MOCK_DOCUMENT: DocumentDetail = {
  id: 'doc-msw-001',
  collectionId: 'col-msw-001',
  title: 'Guide des ingredients japonais',
  sourceType: 'text',
  sourceUrl: null,
  contentText:
    'Le Tsubaki (Camellia japonica) est une huile precieuse extraite des graines du camellia japonais. ' +
    'Utilisee depuis des siecles dans les rituels de beaute japonais, elle nourrit et protege les cheveux et la peau. ' +
    'Proprietes : riche en acide oleique (85%), penetre rapidement sans residus gras, protection UV naturelle.',
  metadata: null,
  chunkCount: 15,
  createdAt: '2026-05-01T08:00:00.000Z',
  updatedAt: '2026-05-20T14:00:00.000Z',
};

const MOCK_DOCUMENT_URL: DocumentDetail = {
  id: 'doc-msw-002',
  collectionId: 'col-msw-001',
  title: 'Article Instagram Algo 2026',
  sourceType: 'url',
  sourceUrl: 'https://example.com/instagram-algo',
  contentText: 'Contenu extrait de la page web sur les algorithmes Instagram 2026.',
  metadata: { sourceUrl: 'https://example.com/instagram-algo', sourceType: 'url' },
  chunkCount: 8,
  createdAt: '2026-05-10T12:00:00.000Z',
  updatedAt: '2026-05-10T12:00:00.000Z',
};
```

---

## 4. Handler : PATCH Collection

### 4.1 Handler de succes

```typescript
/**
 * Handler PATCH /api/admin/ai-engine/knowledge/:slug
 *
 * Simule la mise a jour partielle d'une collection.
 * - Fusionne les champs fournis avec la collection existante
 * - Met a jour le champ updatedAt
 * - Retourne la collection mise a jour
 */
export const patchCollectionHandler = http.patch<
  { slug: string },
  UpdateCollectionRequest
>(
  '/api/admin/ai-engine/knowledge/:slug',
  async ({ params, request }) => {
    const { slug } = params;

    // Simuler la verification d'authentification
    // (en test, la session est toujours valide)

    // Verifier que la collection existe
    if (slug !== 'brand-femiglow' && slug !== 'test-collection') {
      return HttpResponse.json(
        {
          error: {
            code: 'not_found',
            message: `Collection "${slug}" not found`,
          },
        },
        { status: 404 },
      );
    }

    const body = (await request.json()) as UpdateCollectionRequest;

    // Validation : au moins un champ requis
    if (
      body.name === undefined &&
      body.description === undefined &&
      body.category === undefined
    ) {
      return HttpResponse.json(
        {
          error: 'Validation error',
          details: [
            {
              code: 'custom',
              message: 'Au moins un champ doit etre fourni',
              path: [],
            },
          ],
        },
        { status: 400 },
      );
    }

    // Validation : nom non vide
    if (body.name !== undefined && body.name.trim() === '') {
      return HttpResponse.json(
        {
          error: 'Validation error',
          details: [
            {
              code: 'too_small',
              message: 'Le nom est obligatoire',
              path: ['name'],
            },
          ],
        },
        { status: 400 },
      );
    }

    // Validation : nom <= 200 caracteres
    if (body.name !== undefined && body.name.length > 200) {
      return HttpResponse.json(
        {
          error: 'Validation error',
          details: [
            {
              code: 'too_big',
              message: 'Le nom ne peut pas depasser 200 caracteres',
              path: ['name'],
            },
          ],
        },
        { status: 400 },
      );
    }

    // Fusionner les champs
    const updatedCollection: CollectionRow = {
      ...MOCK_COLLECTION,
      name: body.name ?? MOCK_COLLECTION.name,
      description:
        body.description !== undefined
          ? body.description
          : MOCK_COLLECTION.description,
      category: body.category ?? MOCK_COLLECTION.category,
      updatedAt: new Date().toISOString(),
    };

    return HttpResponse.json({ collection: updatedCollection });
  },
);
```

### 4.2 Handler factory pour variants d'erreur

```typescript
/**
 * Factory : cree un handler PATCH collection qui retourne une erreur specifique.
 */
export function createPatchCollectionErrorHandler(
  statusCode: number,
  errorBody: ErrorResponse,
) {
  return http.patch(
    '/api/admin/ai-engine/knowledge/:slug',
    async () => {
      return HttpResponse.json(errorBody, { status: statusCode });
    },
  );
}

// --- Variants pre-construits ---

/** Erreur 500 : erreur interne */
export const patchCollectionServerErrorHandler =
  createPatchCollectionErrorHandler(500, {
    error: { code: 'internal_error', message: 'Database connection lost' },
  });

/** Erreur 401 : non authentifie */
export const patchCollectionUnauthorizedHandler =
  createPatchCollectionErrorHandler(401, {
    error: { code: 'unauthorized', message: 'Session expired' },
  });

/** Erreur 409 : conflit (edition concurrente) */
export const patchCollectionConflictHandler =
  createPatchCollectionErrorHandler(409, {
    error: {
      code: 'conflict',
      message: 'La collection a ete modifiee par un autre utilisateur',
    },
  });
```

---

## 5. Handler : GET Document

### 5.1 Handler de succes

```typescript
/**
 * Handler GET /api/admin/ai-engine/knowledge/:slug/documents/:docId
 *
 * Retourne le detail complet d'un document, incluant contentText.
 */
export const getDocumentHandler = http.get<{
  slug: string;
  docId: string;
}>(
  '/api/admin/ai-engine/knowledge/:slug/documents/:docId',
  async ({ params }) => {
    const { slug, docId } = params;

    // Collection introuvable
    if (slug !== 'brand-femiglow' && slug !== 'test-collection') {
      return HttpResponse.json(
        {
          error: {
            code: 'not_found',
            message: `Collection "${slug}" not found`,
          },
        },
        { status: 404 },
      );
    }

    // Document introuvable
    const documents: Record<string, DocumentDetail> = {
      'doc-msw-001': MOCK_DOCUMENT,
      'doc-msw-002': MOCK_DOCUMENT_URL,
      'doc-test-001': MOCK_DOCUMENT,
    };

    const doc = documents[docId];
    if (!doc) {
      return HttpResponse.json(
        {
          error: {
            code: 'not_found',
            message: `Document "${docId}" not found`,
          },
        },
        { status: 404 },
      );
    }

    return HttpResponse.json({ document: doc });
  },
);
```

### 5.2 Handler avec delai (simulation latence reseau)

```typescript
/**
 * Handler GET document avec un delai configurable.
 * Utile pour tester l'affichage du skeleton de chargement.
 */
export function createGetDocumentDelayedHandler(delayMs: number) {
  return http.get<{ slug: string; docId: string }>(
    '/api/admin/ai-engine/knowledge/:slug/documents/:docId',
    async ({ params }) => {
      await delay(delayMs);

      const { docId } = params;
      const doc = docId === 'doc-msw-002' ? MOCK_DOCUMENT_URL : MOCK_DOCUMENT;

      return HttpResponse.json({ document: doc });
    },
  );
}

/** Handler avec delai de 2 secondes */
export const getDocumentSlowHandler = createGetDocumentDelayedHandler(2000);
```

### 5.3 Handler d'erreur GET document

```typescript
/**
 * Handler GET document qui retourne une erreur 500.
 */
export const getDocumentServerErrorHandler = http.get(
  '/api/admin/ai-engine/knowledge/:slug/documents/:docId',
  async () => {
    return HttpResponse.json(
      {
        error: {
          code: 'internal_error',
          message: 'Erreur lors de la lecture du document',
        },
      },
      { status: 500 },
    );
  },
);
```

---

## 6. Handler : PATCH Document

### 6.1 Handler de succes

```typescript
/**
 * Handler PATCH /api/admin/ai-engine/knowledge/:slug/documents/:docId
 *
 * Simule la mise a jour d'un document :
 * - Si content est fourni : simule le re-chunking (delai + nouveau chunkCount)
 * - Si title seul : reponse immediate (reChunked: false)
 */
export const patchDocumentHandler = http.patch<
  { slug: string; docId: string },
  UpdateDocumentRequest
>(
  '/api/admin/ai-engine/knowledge/:slug/documents/:docId',
  async ({ params, request }) => {
    const { slug, docId } = params;

    // Collection introuvable
    if (slug !== 'brand-femiglow' && slug !== 'test-collection') {
      return HttpResponse.json(
        {
          error: { code: 'not_found', message: `Collection "${slug}" not found` },
        },
        { status: 404 },
      );
    }

    const body = (await request.json()) as UpdateDocumentRequest;

    // Validation : au moins un champ requis
    if (body.title === undefined && body.content === undefined) {
      return HttpResponse.json(
        {
          error: 'Validation error',
          details: [
            {
              code: 'custom',
              message: 'Au moins un champ doit etre fourni',
              path: [],
            },
          ],
        },
        { status: 400 },
      );
    }

    // Validation : titre non vide
    if (body.title !== undefined && body.title.trim() === '') {
      return HttpResponse.json(
        {
          error: 'Validation error',
          details: [
            {
              code: 'too_small',
              message: 'Le titre est obligatoire',
              path: ['title'],
            },
          ],
        },
        { status: 400 },
      );
    }

    // Validation : titre <= 500 caracteres
    if (body.title !== undefined && body.title.length > 500) {
      return HttpResponse.json(
        {
          error: 'Validation error',
          details: [
            {
              code: 'too_big',
              message: 'Le titre ne peut pas depasser 500 caracteres',
              path: ['title'],
            },
          ],
        },
        { status: 400 },
      );
    }

    const needsReChunk = body.content !== undefined;

    if (needsReChunk) {
      // Simuler le delai de re-chunking (100ms en test)
      await delay(100);

      // Calculer un nombre de chunks approximatif
      const estimatedChunks = Math.max(1, Math.ceil((body.content!.length) / 1000));

      const response: UpdateDocumentResponse = {
        success: true,
        chunkCount: estimatedChunks,
        reChunked: true,
      };

      return HttpResponse.json(response);
    }

    // Titre seul : pas de re-chunking
    const response: UpdateDocumentResponse = {
      success: true,
      chunkCount: MOCK_DOCUMENT.chunkCount, // inchange
      reChunked: false,
    };

    return HttpResponse.json(response);
  },
);
```

### 6.2 Handler avec delai de re-chunking (simulation longue)

```typescript
/**
 * Simule un re-chunking long (5 secondes) pour tester
 * l'indicateur de progression "Re-indexation en cours..."
 */
export function createPatchDocumentSlowReChunkHandler(delayMs: number = 5000) {
  return http.patch<{ slug: string; docId: string }, UpdateDocumentRequest>(
    '/api/admin/ai-engine/knowledge/:slug/documents/:docId',
    async ({ request }) => {
      const body = (await request.json()) as UpdateDocumentRequest;
      const needsReChunk = body.content !== undefined;

      if (needsReChunk) {
        await delay(delayMs);
      }

      return HttpResponse.json({
        success: true,
        chunkCount: needsReChunk ? 22 : 15,
        reChunked: needsReChunk,
      });
    },
  );
}

/** Handler avec 5 secondes de delai pour le re-chunking */
export const patchDocumentSlowReChunkHandler =
  createPatchDocumentSlowReChunkHandler(5000);
```

### 6.3 Handlers d'erreur PATCH document

```typescript
/**
 * Factory : cree un handler PATCH document qui retourne une erreur.
 */
export function createPatchDocumentErrorHandler(
  statusCode: number,
  errorBody: ErrorResponse,
) {
  return http.patch(
    '/api/admin/ai-engine/knowledge/:slug/documents/:docId',
    async () => {
      return HttpResponse.json(errorBody, { status: statusCode });
    },
  );
}

/** Erreur 500 : echec de l'embedding OpenAI */
export const patchDocumentEmbeddingErrorHandler =
  createPatchDocumentErrorHandler(500, {
    error: 'Update failed',
    detail: 'OpenAI API rate limit exceeded',
  });

/** Erreur 500 : erreur de base de donnees */
export const patchDocumentDbErrorHandler =
  createPatchDocumentErrorHandler(500, {
    error: 'Update failed',
    detail: 'Connection to database lost during transaction',
  });

/** Erreur 400 : validation echouee */
export const patchDocumentValidationErrorHandler =
  createPatchDocumentErrorHandler(400, {
    error: 'Validation error',
    details: [
      {
        code: 'too_small',
        message: 'Le titre est obligatoire',
        path: ['title'],
      },
    ],
  });

/** Erreur 401 : non authentifie */
export const patchDocumentUnauthorizedHandler =
  createPatchDocumentErrorHandler(401, {
    error: { code: 'unauthorized', message: 'Session expired' },
  });

/** Erreur 404 : document introuvable */
export const patchDocumentNotFoundHandler =
  createPatchDocumentErrorHandler(404, {
    error: { code: 'not_found', message: 'Document "doc-999" not found' },
  });
```

---

## 7. Export des handlers par defaut

```typescript
// -----------------------------------------------------------------
// Export : handlers par defaut (scenario nominal)
// -----------------------------------------------------------------

/**
 * Ensemble de handlers pour le scenario nominal de la feature Knowledge Edit.
 * A utiliser avec setupServer() de MSW.
 */
export const knowledgeEditHandlers = [
  patchCollectionHandler,
  getDocumentHandler,
  patchDocumentHandler,
];
```

---

## 8. Utilisation dans les tests

### 8.1 Setup du serveur MSW dans Vitest

```typescript
// --- knowledge-page-edit.test.tsx ---

import { setupServer } from 'msw/node';
import {
  knowledgeEditHandlers,
  patchCollectionServerErrorHandler,
  patchDocumentSlowReChunkHandler,
  getDocumentSlowHandler,
} from '@/test/msw/handlers/ai-engine-knowledge-edit.handlers';
import { knowledgeHandlers } from '@/test/msw/handlers/ai-engine-knowledge.handlers';

const server = setupServer(
  ...knowledgeHandlers,      // GET collections, GET documents, POST, DELETE
  ...knowledgeEditHandlers,  // PATCH collection, GET document, PATCH document
);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());
```

### 8.2 Override dynamique d'un handler pour un test specifique

```typescript
it('devrait afficher une erreur si le PATCH collection echoue', async () => {
  // Remplacer le handler nominal par un handler d'erreur pour CE test
  server.use(patchCollectionServerErrorHandler);

  render(<KnowledgeBasePage />);
  // ... interagir avec le composant ...
  // Le composant affichera l'erreur "Database connection lost"
});

it('devrait afficher "Re-indexation en cours..." pendant un re-chunk long', async () => {
  server.use(patchDocumentSlowReChunkHandler);

  render(<KnowledgeBasePage />);
  // ... modifier le contenu, soumettre ...
  // Le bouton affichera "Re-indexation en cours..." pendant 5 secondes
});

it('devrait afficher un skeleton pendant le chargement lent', async () => {
  server.use(getDocumentSlowHandler);

  render(<KnowledgeBasePage />);
  // ... cliquer "Voir" ...
  // Le skeleton sera visible pendant 2 secondes
});
```

### 8.3 Handler ad hoc dans un test

```typescript
it('devrait gerer une erreur reseau (timeout)', async () => {
  server.use(
    http.patch(
      '/api/admin/ai-engine/knowledge/:slug',
      async () => {
        // Simuler un timeout en ne repondant jamais
        await delay('infinite');
      },
    ),
  );

  // Le test utilisera un AbortController avec timeout
  // pour verifier le comportement de l'UI lors d'un timeout
});
```

---

## 9. Ajout au barrel index

```typescript
// --- handlers/index.ts ---

export { knowledgeHandlers } from './ai-engine-knowledge.handlers';
export {
  knowledgeEditHandlers,
  patchCollectionHandler,
  patchCollectionServerErrorHandler,
  patchCollectionUnauthorizedHandler,
  patchCollectionConflictHandler,
  getDocumentHandler,
  getDocumentSlowHandler,
  getDocumentServerErrorHandler,
  patchDocumentHandler,
  patchDocumentSlowReChunkHandler,
  patchDocumentEmbeddingErrorHandler,
  patchDocumentDbErrorHandler,
  patchDocumentValidationErrorHandler,
  patchDocumentUnauthorizedHandler,
  patchDocumentNotFoundHandler,
  createPatchCollectionErrorHandler,
  createPatchDocumentErrorHandler,
  createGetDocumentDelayedHandler,
  createPatchDocumentSlowReChunkHandler,
} from './ai-engine-knowledge-edit.handlers';
```

---

## 10. Recapitulatif des handlers

| Handler | Type | Methode | Status | Utilisation |
|---------|------|---------|--------|-------------|
| `patchCollectionHandler` | Nominal | PATCH | 200/400/404 | Tests de succes et validation |
| `patchCollectionServerErrorHandler` | Erreur | PATCH | 500 | Test erreur serveur |
| `patchCollectionUnauthorizedHandler` | Erreur | PATCH | 401 | Test auth echouee |
| `patchCollectionConflictHandler` | Erreur | PATCH | 409 | Test edition concurrente |
| `getDocumentHandler` | Nominal | GET | 200/404 | Tests de visualisation |
| `getDocumentSlowHandler` | Latence | GET | 200 | Test skeleton |
| `getDocumentServerErrorHandler` | Erreur | GET | 500 | Test erreur GET |
| `patchDocumentHandler` | Nominal | PATCH | 200/400/404 | Tests de succes |
| `patchDocumentSlowReChunkHandler` | Latence | PATCH | 200 | Test indicateur progression |
| `patchDocumentEmbeddingErrorHandler` | Erreur | PATCH | 500 | Test echec OpenAI |
| `patchDocumentDbErrorHandler` | Erreur | PATCH | 500 | Test echec DB |
| `patchDocumentValidationErrorHandler` | Erreur | PATCH | 400 | Test validation |
| `patchDocumentUnauthorizedHandler` | Erreur | PATCH | 401 | Test auth echouee |
| `patchDocumentNotFoundHandler` | Erreur | PATCH | 404 | Test document 404 |
