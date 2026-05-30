# Specifications Vitest -- Knowledge Edit

**Framework** : Vitest 2.1.x + jsdom  
**Fichiers de test** :
- `apps/web/src/lib/ai-engine/knowledge/collections.test.ts` (ajout de describe)
- `apps/web/src/lib/ai-engine/knowledge/ingestion.test.ts` (ajout de describe)
- `apps/web/src/test/api-contracts/ai-engine-knowledge-edit.contract.test.ts` (nouveau)
- `apps/web/src/app/admin/content-studio-v2/ai-engine/knowledge/__tests__/knowledge-page-edit.test.tsx` (nouveau)

---

## 1. Configuration des mocks

### 1.1 Mocks globaux pour le service layer

```typescript
// --- collections.test.ts (section ajoutee) ---

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { updateCollection, getDocumentById } from './collections';

// Mock de la connexion DB
const mockReturning = vi.fn();
const mockWhere = vi.fn(() => ({ returning: mockReturning }));
const mockSet = vi.fn(() => ({ where: mockWhere }));
const mockUpdate = vi.fn(() => ({ set: mockSet }));

const mockLimit = vi.fn();
const mockSelectWhere = vi.fn(() => ({ limit: mockLimit }));
const mockSelectFrom = vi.fn(() => ({ where: mockSelectWhere }));
const mockSelect = vi.fn(() => ({ from: mockSelectFrom }));

const mockDrizzle = {
  update: mockUpdate,
  select: mockSelect,
};

vi.mock('@/lib/db/client', () => ({
  db: vi.fn(() => mockDrizzle),
}));

vi.mock('@/lib/db/schema-ai-engine', () => ({
  aiEngineKnowledgeCollections: { id: 'id' },
  aiEngineKnowledgeDocuments: {
    id: 'id',
    collectionId: 'collectionId',
    chunkCount: 'chunkCount',
  },
  aiEngineKnowledgeChunks: { documentId: 'documentId' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ col, val })),
  and: vi.fn((...conditions) => conditions),
}));
```

### 1.2 Mocks pour ingestion.test.ts

```typescript
// --- ingestion.test.ts (section ajoutee) ---

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateDocument } from './ingestion';

const mockDelete = vi.fn();
const mockInsert = vi.fn();
const mockTxUpdate = vi.fn();
const mockTransaction = vi.fn(async (cb) => {
  return cb({
    delete: mockDelete,
    insert: mockInsert,
    update: mockTxUpdate,
  });
});

const mockDrizzle = {
  transaction: mockTransaction,
  update: vi.fn(),
  select: vi.fn(),
};

vi.mock('@/lib/db/client', () => ({
  db: vi.fn(() => mockDrizzle),
}));

const mockEmbedDocuments = vi.fn();
vi.mock('@langchain/openai', () => ({
  OpenAIEmbeddings: vi.fn().mockImplementation(() => ({
    embedDocuments: mockEmbedDocuments,
  })),
}));

const mockSplitText = vi.fn();
vi.mock('@langchain/textsplitters', () => ({
  RecursiveCharacterTextSplitter: vi.fn().mockImplementation(() => ({
    splitText: mockSplitText,
  })),
}));

vi.mock('./collections', () => ({
  updateCollectionCounts: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../config', () => ({
  getEngineConfig: vi.fn().mockReturnValue({ openaiApiKey: 'sk-test-key' }),
}));
```

### 1.3 Mocks pour les tests de composants UI

```typescript
// --- knowledge-page-edit.test.tsx ---

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import KnowledgeBasePage from '../page';

// Mock fetch global
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock du router Next.js
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/admin/content-studio-v2/ai-engine/knowledge',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock window.confirm
vi.spyOn(window, 'confirm').mockImplementation(() => true);
```

### 1.4 Fixtures partagees

```typescript
// --- fixtures/knowledge-edit.fixtures.ts ---

export const MOCK_COLLECTION = {
  id: 'col-test-001',
  name: 'Test Collection',
  slug: 'test-collection',
  description: 'Description de test',
  category: 'brand',
  documentCount: 3,
  chunkCount: 25,
  lastIndexedAt: '2026-05-20T10:00:00.000Z',
  isActive: true,
  createdAt: '2026-04-01T10:00:00.000Z',
  updatedAt: '2026-05-20T10:00:00.000Z',
};

export const MOCK_COLLECTION_ROW_DB = {
  id: 'col-test-001',
  name: 'Test Collection',
  slug: 'test-collection',
  description: 'Description de test',
  category: 'brand',
  documentCount: 3,
  chunkCount: 25,
  lastIndexedAt: new Date('2026-05-20T10:00:00.000Z'),
  isActive: true,
  createdAt: new Date('2026-04-01T10:00:00.000Z'),
  updatedAt: new Date('2026-05-20T10:00:00.000Z'),
};

export const MOCK_DOCUMENT_DETAIL = {
  id: 'doc-test-001',
  collectionId: 'col-test-001',
  title: 'Guide des ingredients japonais',
  sourceType: 'text',
  sourceUrl: null,
  contentText: 'Le Tsubaki (Camellia japonica) est une huile precieuse extraite des graines du camellia. Utilisee depuis des siecles dans la beaute japonaise.',
  metadata: null,
  chunkCount: 15,
  createdAt: '2026-05-01T08:00:00.000Z',
  updatedAt: '2026-05-20T14:00:00.000Z',
};

export const MOCK_DOCUMENT_URL = {
  id: 'doc-test-002',
  collectionId: 'col-test-001',
  title: 'Article Instagram Algo 2026',
  sourceType: 'url',
  sourceUrl: 'https://example.com/instagram-algo',
  contentText: 'Contenu extrait de la page web...',
  metadata: { sourceUrl: 'https://example.com/instagram-algo', sourceType: 'url' },
  chunkCount: 8,
  createdAt: '2026-05-10T12:00:00.000Z',
  updatedAt: '2026-05-10T12:00:00.000Z',
};

export const MOCK_COLLECTIONS_LIST = [
  MOCK_COLLECTION,
  {
    id: 'col-test-002',
    name: 'Neuromarketing',
    slug: 'neuromarketing',
    description: null,
    category: 'science',
    documentCount: 7,
    chunkCount: 58,
    lastIndexedAt: '2026-05-18T16:00:00.000Z',
    isActive: true,
    createdAt: '2026-03-15T08:00:00.000Z',
    updatedAt: '2026-05-18T16:00:00.000Z',
  },
];

export const MOCK_DOCUMENTS_LIST = [
  {
    id: 'doc-test-001',
    title: 'Guide des ingredients japonais',
    sourceType: 'text',
    chunkCount: 15,
    createdAt: '2026-05-01T08:00:00.000Z',
  },
  {
    id: 'doc-test-002',
    title: 'Article Instagram Algo 2026',
    sourceType: 'url',
    chunkCount: 8,
    createdAt: '2026-05-10T12:00:00.000Z',
  },
];
```

---

## 2. Tests du service layer : updateCollection

**Fichier** : `collections.test.ts`  
**Describe** : `describe('updateCollection()')`

```typescript
describe('updateCollection()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ------------------------------------------------------------------
  // TC-SVC-UC-01 : Mise a jour du nom uniquement
  // ------------------------------------------------------------------
  it('devrait mettre a jour le nom de la collection et retourner la ligne mappee', async () => {
    const updatedRow = {
      ...MOCK_COLLECTION_ROW_DB,
      name: 'Nouveau Nom',
      updatedAt: expect.any(Date),
    };
    mockReturning.mockResolvedValue([updatedRow]);

    const result = await updateCollection('col-test-001', { name: 'Nouveau Nom' });

    expect(mockUpdate).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Nouveau Nom',
        updatedAt: expect.any(Date),
      }),
    );
    expect(result.name).toBe('Nouveau Nom');
    expect(result.id).toBe('col-test-001');
  });

  // ------------------------------------------------------------------
  // TC-SVC-UC-02 : Mise a jour de la description (string -> null)
  // ------------------------------------------------------------------
  it('devrait accepter description = null pour effacer la description', async () => {
    const updatedRow = {
      ...MOCK_COLLECTION_ROW_DB,
      description: null,
      updatedAt: expect.any(Date),
    };
    mockReturning.mockResolvedValue([updatedRow]);

    const result = await updateCollection('col-test-001', { description: null });

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ description: null }),
    );
    expect(result.description).toBeNull();
  });

  // ------------------------------------------------------------------
  // TC-SVC-UC-03 : Mise a jour de la categorie
  // ------------------------------------------------------------------
  it('devrait mettre a jour la categorie', async () => {
    const updatedRow = {
      ...MOCK_COLLECTION_ROW_DB,
      category: 'science',
      updatedAt: expect.any(Date),
    };
    mockReturning.mockResolvedValue([updatedRow]);

    const result = await updateCollection('col-test-001', { category: 'science' });

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'science' }),
    );
    expect(result.category).toBe('science');
  });

  // ------------------------------------------------------------------
  // TC-SVC-UC-04 : Mise a jour de tous les champs simultanement
  // ------------------------------------------------------------------
  it('devrait mettre a jour name, description et category en une seule requete', async () => {
    const updatedRow = {
      ...MOCK_COLLECTION_ROW_DB,
      name: 'Nouveau Nom',
      description: 'Nouvelle description',
      category: 'psychology',
      updatedAt: expect.any(Date),
    };
    mockReturning.mockResolvedValue([updatedRow]);

    const result = await updateCollection('col-test-001', {
      name: 'Nouveau Nom',
      description: 'Nouvelle description',
      category: 'psychology',
    });

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Nouveau Nom',
        description: 'Nouvelle description',
        category: 'psychology',
        updatedAt: expect.any(Date),
      }),
    );
    expect(result.name).toBe('Nouveau Nom');
    expect(result.description).toBe('Nouvelle description');
    expect(result.category).toBe('psychology');
  });

  // ------------------------------------------------------------------
  // TC-SVC-UC-05 : Collection inexistante (returning vide)
  // ------------------------------------------------------------------
  it('devrait lever une erreur si la collection n\'existe pas (rows vide)', async () => {
    mockReturning.mockResolvedValue([]);

    await expect(
      updateCollection('col-inexistant', { name: 'Test' }),
    ).rejects.toThrow('Collection col-inexistant not found');
  });

  // ------------------------------------------------------------------
  // TC-SVC-UC-06 : Connexion DB indisponible
  // ------------------------------------------------------------------
  it('devrait lever une erreur si la connexion DB est null', async () => {
    const { db } = await import('@/lib/db/client');
    vi.mocked(db).mockReturnValueOnce(null);

    await expect(
      updateCollection('col-test-001', { name: 'Test' }),
    ).rejects.toThrow('Database connection required');
  });

  // ------------------------------------------------------------------
  // TC-SVC-UC-07 : updatedAt est toujours inclus dans le SET
  // ------------------------------------------------------------------
  it('devrait toujours inclure updatedAt dans les champs de mise a jour', async () => {
    mockReturning.mockResolvedValue([MOCK_COLLECTION_ROW_DB]);

    await updateCollection('col-test-001', { name: 'Test' });

    const setArg = mockSet.mock.calls[0][0];
    expect(setArg).toHaveProperty('updatedAt');
    expect(setArg.updatedAt).toBeInstanceOf(Date);
  });

  // ------------------------------------------------------------------
  // TC-SVC-UC-08 : Les champs non fournis ne sont pas inclus dans SET
  // ------------------------------------------------------------------
  it('ne devrait pas inclure les champs non fournis dans le SET', async () => {
    mockReturning.mockResolvedValue([MOCK_COLLECTION_ROW_DB]);

    await updateCollection('col-test-001', { name: 'Nouveau Nom' });

    const setArg = mockSet.mock.calls[0][0];
    expect(setArg).toHaveProperty('name');
    expect(setArg).toHaveProperty('updatedAt');
    expect(setArg).not.toHaveProperty('description');
    expect(setArg).not.toHaveProperty('category');
  });
});
```

---

## 3. Tests du service layer : getDocumentById

**Fichier** : `collections.test.ts`  
**Describe** : `describe('getDocumentById()')`

```typescript
describe('getDocumentById()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ------------------------------------------------------------------
  // TC-SVC-GD-01 : Recuperation reussie
  // ------------------------------------------------------------------
  it('devrait retourner le document complet avec contentText', async () => {
    const dbRow = {
      id: 'doc-test-001',
      collectionId: 'col-test-001',
      title: 'Guide des ingredients japonais',
      sourceType: 'text',
      sourceUrl: null,
      contentText: 'Le Tsubaki...',
      metadata: null,
      chunkCount: 15,
      createdAt: new Date('2026-05-01'),
      updatedAt: new Date('2026-05-20'),
    };
    mockLimit.mockResolvedValue([dbRow]);

    const result = await getDocumentById('doc-test-001', 'col-test-001');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('doc-test-001');
    expect(result!.contentText).toBe('Le Tsubaki...');
    expect(result!.chunkCount).toBe(15);
  });

  // ------------------------------------------------------------------
  // TC-SVC-GD-02 : Document inexistant
  // ------------------------------------------------------------------
  it('devrait retourner null si le document n\'existe pas', async () => {
    mockLimit.mockResolvedValue([]);

    const result = await getDocumentById('doc-inexistant', 'col-test-001');

    expect(result).toBeNull();
  });

  // ------------------------------------------------------------------
  // TC-SVC-GD-03 : Document existant mais mauvaise collection
  // ------------------------------------------------------------------
  it('devrait retourner null si le document n\'appartient pas a la collection', async () => {
    mockLimit.mockResolvedValue([]);

    const result = await getDocumentById('doc-test-001', 'col-autre-001');

    expect(result).toBeNull();
    expect(mockSelectWhere).toHaveBeenCalled();
  });

  // ------------------------------------------------------------------
  // TC-SVC-GD-04 : Connexion DB indisponible
  // ------------------------------------------------------------------
  it('devrait retourner null si la connexion DB est null', async () => {
    const { db } = await import('@/lib/db/client');
    vi.mocked(db).mockReturnValueOnce(null);

    const result = await getDocumentById('doc-test-001', 'col-test-001');

    expect(result).toBeNull();
  });
});
```

---

## 4. Tests du service layer : updateDocument

**Fichier** : `ingestion.test.ts`  
**Describe** : `describe('updateDocument()')`

```typescript
describe('updateDocument()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSplitText.mockResolvedValue(['chunk1', 'chunk2', 'chunk3']);
    mockEmbedDocuments.mockResolvedValue([
      [0.1, 0.2, /* ... 1536 dims */],
      [0.3, 0.4],
      [0.5, 0.6],
    ]);
  });

  // ------------------------------------------------------------------
  // TC-SVC-UD-01 : Mise a jour du titre uniquement (sans re-chunking)
  // ------------------------------------------------------------------
  it('devrait mettre a jour le titre sans declencher de re-chunking', async () => {
    mockDrizzle.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    mockDrizzle.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ chunkCount: 15 }]),
      }),
    });

    const result = await updateDocument('doc-001', 'col-001', {
      title: 'Nouveau titre',
    });

    expect(result.success).toBe(true);
    expect(result.reChunked).toBe(false);
    expect(result.chunkCount).toBe(15);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  // ------------------------------------------------------------------
  // TC-SVC-UD-02 : Mise a jour du contenu (avec re-chunking)
  // ------------------------------------------------------------------
  it('devrait supprimer les anciens chunks, re-decouper et re-embedder', async () => {
    const mockTx = {
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      }),
    };
    mockTransaction.mockImplementation(async (cb) => cb(mockTx));

    const result = await updateDocument('doc-001', 'col-001', {
      content: 'Nouveau contenu avec du texte.',
    });

    expect(result.success).toBe(true);
    expect(result.reChunked).toBe(true);
    expect(result.chunkCount).toBe(3);
    expect(mockTx.delete).toHaveBeenCalled();
    expect(mockSplitText).toHaveBeenCalledWith('Nouveau contenu avec du texte.');
    expect(mockEmbedDocuments).toHaveBeenCalled();
  });

  // ------------------------------------------------------------------
  // TC-SVC-UD-03 : Mise a jour titre + contenu simultanement
  // ------------------------------------------------------------------
  it('devrait mettre a jour le titre ET re-chunker si content est fourni', async () => {
    const txUpdateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const mockTx = {
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
      update: vi.fn().mockReturnValue({ set: txUpdateSet }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      }),
    };
    mockTransaction.mockImplementation(async (cb) => cb(mockTx));

    const result = await updateDocument('doc-001', 'col-001', {
      title: 'Nouveau titre',
      content: 'Nouveau contenu',
    });

    expect(result.success).toBe(true);
    expect(result.reChunked).toBe(true);
    // Le title est inclus dans le SET de la transaction
    expect(txUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Nouveau titre' }),
    );
  });

  // ------------------------------------------------------------------
  // TC-SVC-UD-04 : Verification du nombre de chunks apres re-chunking
  // ------------------------------------------------------------------
  it('devrait retourner le nombre correct de chunks apres re-chunking', async () => {
    mockSplitText.mockResolvedValue(['a', 'b', 'c', 'd', 'e']);
    mockEmbedDocuments.mockResolvedValue([[0.1], [0.2], [0.3], [0.4], [0.5]]);
    const mockTx = {
      delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      }),
      insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
    };
    mockTransaction.mockImplementation(async (cb) => cb(mockTx));

    const result = await updateDocument('doc-001', 'col-001', {
      content: 'Contenu qui genere 5 chunks',
    });

    expect(result.chunkCount).toBe(5);
  });

  // ------------------------------------------------------------------
  // TC-SVC-UD-05 : Erreur API OpenAI pendant l'embedding
  // ------------------------------------------------------------------
  it('devrait retourner une erreur si l\'API OpenAI echoue pendant l\'embedding', async () => {
    mockEmbedDocuments.mockRejectedValue(new Error('Rate limit exceeded'));
    mockTransaction.mockImplementation(async (cb) => {
      const mockTx = {
        delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
        }),
        insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
      };
      return cb(mockTx);
    });

    const result = await updateDocument('doc-001', 'col-001', {
      content: 'Contenu quelconque',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Rate limit exceeded');
    expect(result.reChunked).toBe(false);
  });

  // ------------------------------------------------------------------
  // TC-SVC-UD-06 : Cle API OpenAI non configuree
  // ------------------------------------------------------------------
  it('devrait retourner une erreur si getEmbeddings() retourne null', async () => {
    vi.mocked(getEngineConfig).mockReturnValueOnce({ openaiApiKey: '' });

    const result = await updateDocument('doc-001', 'col-001', {
      content: 'Contenu',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('OpenAI API key not configured');
  });

  // ------------------------------------------------------------------
  // TC-SVC-UD-07 : Connexion DB indisponible
  // ------------------------------------------------------------------
  it('devrait retourner une erreur si la connexion DB est null', async () => {
    const { db } = await import('@/lib/db/client');
    vi.mocked(db).mockReturnValueOnce(null);

    const result = await updateDocument('doc-001', 'col-001', {
      title: 'Test',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('No database connection');
  });

  // ------------------------------------------------------------------
  // TC-SVC-UD-08 : updateCollectionCounts est appele apres re-chunking
  // ------------------------------------------------------------------
  it('devrait appeler updateCollectionCounts apres un re-chunking reussi', async () => {
    const { updateCollectionCounts } = await import('./collections');
    const mockTx = {
      delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      }),
      insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
    };
    mockTransaction.mockImplementation(async (cb) => cb(mockTx));

    await updateDocument('doc-001', 'col-001', { content: 'Contenu' });

    expect(updateCollectionCounts).toHaveBeenCalledWith('col-001');
  });

  // ------------------------------------------------------------------
  // TC-SVC-UD-09 : updateCollectionCounts n'est PAS appele si titre seul
  // ------------------------------------------------------------------
  it('ne devrait pas appeler updateCollectionCounts pour un update de titre seul', async () => {
    const { updateCollectionCounts } = await import('./collections');
    mockDrizzle.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    mockDrizzle.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ chunkCount: 15 }]),
      }),
    });

    await updateDocument('doc-001', 'col-001', { title: 'Nouveau' });

    expect(updateCollectionCounts).not.toHaveBeenCalled();
  });

  // ------------------------------------------------------------------
  // TC-SVC-UD-10 : Erreur de transaction DB (rollback)
  // ------------------------------------------------------------------
  it('devrait retourner une erreur si la transaction echoue (rollback implicite)', async () => {
    mockTransaction.mockRejectedValue(new Error('Connection lost'));

    const result = await updateDocument('doc-001', 'col-001', {
      content: 'Contenu',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Connection lost');
  });
});
```

---

## 5. Tests des routes API : PATCH /knowledge/[slug]

**Fichier** : `ai-engine-knowledge-edit.contract.test.ts`  
**Describe** : `describe('PATCH /api/admin/ai-engine/knowledge/[slug]')`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PATCH } from '@/app/api/admin/ai-engine/knowledge/[slug]/route';

vi.mock('@/lib/content-studio/auth', () => ({
  requireAdminApi: vi.fn().mockResolvedValue({ id: 'admin-001' }),
}));

vi.mock('@/lib/ai-engine/knowledge', () => ({
  getCollection: vi.fn(),
  updateCollection: vi.fn(),
}));

const { getCollection, updateCollection } = await import('@/lib/ai-engine/knowledge');

describe('PATCH /api/admin/ai-engine/knowledge/[slug]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ------------------------------------------------------------------
  // TC-API-PC-01 : Mise a jour valide du nom
  // ------------------------------------------------------------------
  it('devrait retourner 200 avec la collection mise a jour', async () => {
    vi.mocked(getCollection).mockResolvedValue(MOCK_COLLECTION);
    vi.mocked(updateCollection).mockResolvedValue({
      ...MOCK_COLLECTION,
      name: 'Nouveau Nom',
    });

    const request = new Request('http://localhost/api/admin/ai-engine/knowledge/test-collection', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Nouveau Nom' }),
    });

    const response = await PATCH(request, { params: { slug: 'test-collection' } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.collection.name).toBe('Nouveau Nom');
  });

  // ------------------------------------------------------------------
  // TC-API-PC-02 : Body vide (aucun champ fourni)
  // ------------------------------------------------------------------
  it('devrait retourner 400 si aucun champ n\'est fourni', async () => {
    vi.mocked(getCollection).mockResolvedValue(MOCK_COLLECTION);

    const request = new Request('http://localhost/api/admin/ai-engine/knowledge/test-collection', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await PATCH(request, { params: { slug: 'test-collection' } });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Validation error');
  });

  // ------------------------------------------------------------------
  // TC-API-PC-03 : Nom vide (string vide)
  // ------------------------------------------------------------------
  it('devrait retourner 400 si le nom est une chaine vide', async () => {
    vi.mocked(getCollection).mockResolvedValue(MOCK_COLLECTION);

    const request = new Request('http://localhost/api/admin/ai-engine/knowledge/test-collection', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    });

    const response = await PATCH(request, { params: { slug: 'test-collection' } });

    expect(response.status).toBe(400);
  });

  // ------------------------------------------------------------------
  // TC-API-PC-04 : Nom trop long (> 200 caracteres)
  // ------------------------------------------------------------------
  it('devrait retourner 400 si le nom depasse 200 caracteres', async () => {
    vi.mocked(getCollection).mockResolvedValue(MOCK_COLLECTION);

    const request = new Request('http://localhost/api/admin/ai-engine/knowledge/test-collection', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'X'.repeat(201) }),
    });

    const response = await PATCH(request, { params: { slug: 'test-collection' } });

    expect(response.status).toBe(400);
  });

  // ------------------------------------------------------------------
  // TC-API-PC-05 : Collection introuvable (404)
  // ------------------------------------------------------------------
  it('devrait retourner 404 si la collection n\'existe pas', async () => {
    vi.mocked(getCollection).mockResolvedValue(null);

    const request = new Request('http://localhost/api/admin/ai-engine/knowledge/inexistant', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test' }),
    });

    const response = await PATCH(request, { params: { slug: 'inexistant' } });

    expect(response.status).toBe(404);
  });

  // ------------------------------------------------------------------
  // TC-API-PC-06 : Non authentifie (401)
  // ------------------------------------------------------------------
  it('devrait retourner 401 si la session est invalide', async () => {
    const { requireAdminApi } = await import('@/lib/content-studio/auth');
    vi.mocked(requireAdminApi).mockRejectedValueOnce(
      new HttpError('unauthorized', 'Session expired'),
    );

    const request = new Request('http://localhost/api/admin/ai-engine/knowledge/test-collection', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test' }),
    });

    const response = await PATCH(request, { params: { slug: 'test-collection' } });

    expect(response.status).toBe(401);
  });
});
```

---

## 6. Tests des routes API : PATCH /knowledge/[slug]/documents/[docId]

**Fichier** : `ai-engine-knowledge-edit.contract.test.ts`  
**Describe** : `describe('PATCH /api/admin/ai-engine/knowledge/[slug]/documents/[docId]')`

```typescript
vi.mock('@/lib/ai-engine/knowledge', () => ({
  getCollection: vi.fn(),
  updateDocument: vi.fn(),
  getDocumentById: vi.fn(),
}));

describe('PATCH /api/admin/ai-engine/knowledge/[slug]/documents/[docId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCollection).mockResolvedValue(MOCK_COLLECTION);
  });

  // ------------------------------------------------------------------
  // TC-API-PD-01 : Mise a jour du titre seul (pas de re-chunking)
  // ------------------------------------------------------------------
  it('devrait retourner 200 avec reChunked=false pour un update de titre', async () => {
    vi.mocked(updateDocument).mockResolvedValue({
      success: true,
      chunkCount: 15,
      reChunked: false,
    });

    const request = new Request('http://localhost/api/...', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Nouveau titre' }),
    });

    const response = await PATCH(request, {
      params: { slug: 'test-collection', docId: 'doc-001' },
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.reChunked).toBe(false);
    expect(data.chunkCount).toBe(15);
  });

  // ------------------------------------------------------------------
  // TC-API-PD-02 : Mise a jour du contenu (avec re-chunking)
  // ------------------------------------------------------------------
  it('devrait retourner 200 avec reChunked=true pour un update de contenu', async () => {
    vi.mocked(updateDocument).mockResolvedValue({
      success: true,
      chunkCount: 8,
      reChunked: true,
    });

    const request = new Request('http://localhost/api/...', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Nouveau contenu complet' }),
    });

    const response = await PATCH(request, {
      params: { slug: 'test-collection', docId: 'doc-001' },
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.reChunked).toBe(true);
    expect(data.chunkCount).toBe(8);
  });

  // ------------------------------------------------------------------
  // TC-API-PD-03 : Echec du service updateDocument (500)
  // ------------------------------------------------------------------
  it('devrait retourner 500 si updateDocument echoue', async () => {
    vi.mocked(updateDocument).mockResolvedValue({
      success: false,
      chunkCount: 0,
      reChunked: false,
      error: 'OpenAI API rate limit exceeded',
    });

    const request = new Request('http://localhost/api/...', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Contenu' }),
    });

    const response = await PATCH(request, {
      params: { slug: 'test-collection', docId: 'doc-001' },
    });

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Update failed');
    expect(data.detail).toContain('rate limit');
  });

  // ------------------------------------------------------------------
  // TC-API-PD-04 : Collection introuvable (404)
  // ------------------------------------------------------------------
  it('devrait retourner 404 si la collection n\'existe pas', async () => {
    vi.mocked(getCollection).mockResolvedValue(null);

    const request = new Request('http://localhost/api/...', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test' }),
    });

    const response = await PATCH(request, {
      params: { slug: 'inexistant', docId: 'doc-001' },
    });

    expect(response.status).toBe(404);
  });

  // ------------------------------------------------------------------
  // TC-API-PD-05 : Validation echouee (body vide)
  // ------------------------------------------------------------------
  it('devrait retourner 400 si aucun champ n\'est fourni', async () => {
    const request = new Request('http://localhost/api/...', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await PATCH(request, {
      params: { slug: 'test-collection', docId: 'doc-001' },
    });

    expect(response.status).toBe(400);
  });

  // ------------------------------------------------------------------
  // TC-API-PD-06 : Titre trop long (> 500 caracteres)
  // ------------------------------------------------------------------
  it('devrait retourner 400 si le titre depasse 500 caracteres', async () => {
    const request = new Request('http://localhost/api/...', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'T'.repeat(501) }),
    });

    const response = await PATCH(request, {
      params: { slug: 'test-collection', docId: 'doc-001' },
    });

    expect(response.status).toBe(400);
  });
});
```

---

## 7. Tests des routes API : GET /knowledge/[slug]/documents/[docId]

**Fichier** : `ai-engine-knowledge-edit.contract.test.ts`  
**Describe** : `describe('GET /api/admin/ai-engine/knowledge/[slug]/documents/[docId]')`

```typescript
describe('GET /api/admin/ai-engine/knowledge/[slug]/documents/[docId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCollection).mockResolvedValue(MOCK_COLLECTION);
  });

  // ------------------------------------------------------------------
  // TC-API-GD-01 : Recuperation reussie
  // ------------------------------------------------------------------
  it('devrait retourner 200 avec le document complet', async () => {
    vi.mocked(getDocumentById).mockResolvedValue(MOCK_DOCUMENT_DETAIL);

    const request = new Request('http://localhost/api/...');
    const response = await GET(request, {
      params: { slug: 'test-collection', docId: 'doc-test-001' },
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.document.id).toBe('doc-test-001');
    expect(data.document.contentText).toBeTruthy();
  });

  // ------------------------------------------------------------------
  // TC-API-GD-02 : Document introuvable (404)
  // ------------------------------------------------------------------
  it('devrait retourner 404 si le document n\'existe pas', async () => {
    vi.mocked(getDocumentById).mockResolvedValue(null);

    const request = new Request('http://localhost/api/...');
    const response = await GET(request, {
      params: { slug: 'test-collection', docId: 'doc-inexistant' },
    });

    expect(response.status).toBe(404);
  });

  // ------------------------------------------------------------------
  // TC-API-GD-03 : Collection introuvable (404)
  // ------------------------------------------------------------------
  it('devrait retourner 404 si la collection n\'existe pas', async () => {
    vi.mocked(getCollection).mockResolvedValue(null);

    const request = new Request('http://localhost/api/...');
    const response = await GET(request, {
      params: { slug: 'inexistant', docId: 'doc-test-001' },
    });

    expect(response.status).toBe(404);
  });

  // ------------------------------------------------------------------
  // TC-API-GD-04 : Non authentifie (401)
  // ------------------------------------------------------------------
  it('devrait retourner 401 si la session est invalide', async () => {
    vi.mocked(requireAdminApi).mockRejectedValueOnce(
      new HttpError('unauthorized', 'Session expired'),
    );

    const request = new Request('http://localhost/api/...');
    const response = await GET(request, {
      params: { slug: 'test-collection', docId: 'doc-test-001' },
    });

    expect(response.status).toBe(401);
  });
});
```

---

## 8. Tests des composants UI (React Testing Library)

**Fichier** : `knowledge-page-edit.test.tsx`  
**Describe** : `describe('KnowledgeBasePage -- Edition')`

```typescript
describe('KnowledgeBasePage -- Edition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock du fetch initial : liste des collections
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/admin/ai-engine/knowledge') && !url.includes('/documents')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ collections: MOCK_COLLECTIONS_LIST }),
        });
      }
      if (url.includes('/documents') && !url.includes('doc-')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ documents: MOCK_DOCUMENTS_LIST }),
        });
      }
      if (url.includes('/documents/doc-test-001')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ document: MOCK_DOCUMENT_DETAIL }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  // ------------------------------------------------------------------
  // TC-UI-CE-01 : Le CollectionEditForm s'affiche avec les champs pre-remplis
  // ------------------------------------------------------------------
  it('devrait afficher la modale d\'edition avec les champs pre-remplis au clic sur Modifier', async () => {
    render(<KnowledgeBasePage />);

    await waitFor(() => {
      expect(screen.getByText('Test Collection')).toBeInTheDocument();
    });

    // Expandre la collection
    await userEvent.click(screen.getByText('Test Collection'));

    // Cliquer sur "Modifier" (collection)
    const editButton = screen.getByRole('button', { name: /modifier la collection/i });
    await userEvent.click(editButton);

    // Verifier les champs pre-remplis
    expect(screen.getByDisplayValue('Test Collection')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Description de test')).toBeInTheDocument();
    expect(screen.getByText('Slug (non modifiable)')).toBeInTheDocument();
    expect(screen.getByText('test-collection')).toBeInTheDocument();
  });

  // ------------------------------------------------------------------
  // TC-UI-CE-02 : Validation du nom vide dans CollectionEditForm
  // ------------------------------------------------------------------
  it('devrait desactiver le bouton Enregistrer si le nom est vide', async () => {
    render(<KnowledgeBasePage />);

    await waitFor(() => expect(screen.getByText('Test Collection')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Test Collection'));
    await userEvent.click(screen.getByRole('button', { name: /modifier la collection/i }));

    const nameInput = screen.getByDisplayValue('Test Collection');
    await userEvent.clear(nameInput);

    const saveButton = screen.getByRole('button', { name: /enregistrer/i });
    expect(saveButton).toBeDisabled();
  });

  // ------------------------------------------------------------------
  // TC-UI-CE-03 : Soumission du formulaire de collection avec succes
  // ------------------------------------------------------------------
  it('devrait fermer la modale et rafraichir la liste apres un PATCH reussi', async () => {
    render(<KnowledgeBasePage />);

    await waitFor(() => expect(screen.getByText('Test Collection')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Test Collection'));
    await userEvent.click(screen.getByRole('button', { name: /modifier la collection/i }));

    const nameInput = screen.getByDisplayValue('Test Collection');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Collection Renommee');

    // Mock du PATCH
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        collection: { ...MOCK_COLLECTION, name: 'Collection Renommee' },
      }),
    });

    await userEvent.click(screen.getByRole('button', { name: /enregistrer/i }));

    await waitFor(() => {
      expect(screen.queryByText('Modifier la collection')).not.toBeInTheDocument();
    });
  });

  // ------------------------------------------------------------------
  // TC-UI-CE-04 : Annulation de l'edition de collection
  // ------------------------------------------------------------------
  it('devrait fermer la modale sans envoyer de requete au clic sur Annuler', async () => {
    render(<KnowledgeBasePage />);

    await waitFor(() => expect(screen.getByText('Test Collection')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Test Collection'));
    await userEvent.click(screen.getByRole('button', { name: /modifier la collection/i }));

    await userEvent.click(screen.getByRole('button', { name: /annuler/i }));

    await waitFor(() => {
      expect(screen.queryByText('Modifier la collection')).not.toBeInTheDocument();
    });

    // Verifier qu'aucun PATCH n'a ete envoye
    const patchCalls = mockFetch.mock.calls.filter(
      (call) => call[1]?.method === 'PATCH',
    );
    expect(patchCalls).toHaveLength(0);
  });

  // ------------------------------------------------------------------
  // TC-UI-DE-01 : Le DocumentEditForm s'affiche avec le contenu charge
  // ------------------------------------------------------------------
  it('devrait charger et afficher le contenu du document dans le formulaire d\'edition', async () => {
    render(<KnowledgeBasePage />);

    await waitFor(() => expect(screen.getByText('Test Collection')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Test Collection'));

    await waitFor(() => {
      expect(screen.getByText('Guide des ingredients japonais')).toBeInTheDocument();
    });

    const editDocBtn = screen.getByRole('button', {
      name: /modifier le document guide des ingredients/i,
    });
    await userEvent.click(editDocBtn);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Guide des ingredients japonais')).toBeInTheDocument();
      expect(screen.getByText(/Le Tsubaki/)).toBeInTheDocument();
    });
  });

  // ------------------------------------------------------------------
  // TC-UI-DE-02 : Le textarea du contenu est redimensionnable
  // ------------------------------------------------------------------
  it('devrait afficher un textarea avec resize:vertical pour le contenu', async () => {
    render(<KnowledgeBasePage />);

    await waitFor(() => expect(screen.getByText('Test Collection')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Test Collection'));
    await waitFor(() => expect(screen.getByText('Guide des ingredients japonais')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /modifier le document/i }));

    await waitFor(() => {
      const textarea = screen.getByRole('textbox', { name: /contenu/i });
      expect(textarea.tagName).toBe('TEXTAREA');
      expect(textarea.style.resize).toBe('vertical');
    });
  });

  // ------------------------------------------------------------------
  // TC-UI-DE-03 : Soumission du document avec re-chunking affiche la confirmation
  // ------------------------------------------------------------------
  it('devrait afficher la boite de confirmation si le contenu est modifie', async () => {
    render(<KnowledgeBasePage />);

    await waitFor(() => expect(screen.getByText('Test Collection')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Test Collection'));
    await waitFor(() => expect(screen.getByText('Guide des ingredients japonais')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /modifier le document/i }));

    await waitFor(() => expect(screen.getByDisplayValue('Guide des ingredients japonais')).toBeInTheDocument());

    // Modifier le contenu
    const textarea = screen.getByRole('textbox', { name: /contenu/i });
    await userEvent.clear(textarea);
    await userEvent.type(textarea, 'Nouveau contenu modifie');

    // Cliquer Enregistrer
    await userEvent.click(screen.getByRole('button', { name: /enregistrer/i }));

    // La modale de confirmation apparait
    await waitFor(() => {
      expect(screen.getByText(/confirmer la re-indexation/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /confirmer et re-indexer/i })).toBeInTheDocument();
    });
  });

  // ------------------------------------------------------------------
  // TC-UI-DV-01 : Le DocumentViewer affiche le contenu complet
  // ------------------------------------------------------------------
  it('devrait afficher le contenu complet du document dans la modale de visualisation', async () => {
    render(<KnowledgeBasePage />);

    await waitFor(() => expect(screen.getByText('Test Collection')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Test Collection'));
    await waitFor(() => expect(screen.getByText('Guide des ingredients japonais')).toBeInTheDocument());

    const viewBtn = screen.getByRole('button', {
      name: /voir le contenu de guide des ingredients/i,
    });
    await userEvent.click(viewBtn);

    await waitFor(() => {
      expect(screen.getByText(/Le Tsubaki.*Camellia japonica/)).toBeInTheDocument();
      expect(screen.getByText(/Type.*text/)).toBeInTheDocument();
      expect(screen.getByText(/Chunks.*15/)).toBeInTheDocument();
    });
  });

  // ------------------------------------------------------------------
  // TC-UI-DV-02 : Le bouton Modifier dans le viewer ouvre l'editeur
  // ------------------------------------------------------------------
  it('devrait basculer vers le formulaire d\'edition depuis le viewer', async () => {
    render(<KnowledgeBasePage />);

    await waitFor(() => expect(screen.getByText('Test Collection')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Test Collection'));
    await waitFor(() => expect(screen.getByText('Guide des ingredients japonais')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /voir le contenu/i }));

    await waitFor(() => expect(screen.getByText(/Le Tsubaki/)).toBeInTheDocument());

    // Cliquer "Modifier" dans le viewer
    await userEvent.click(screen.getByRole('button', { name: /modifier/i }));

    // Le formulaire d'edition s'ouvre
    await waitFor(() => {
      expect(screen.getByText('Modifier le document')).toBeInTheDocument();
    });
  });

  // ------------------------------------------------------------------
  // TC-UI-ERR-01 : Affichage de l'erreur API dans la modale
  // ------------------------------------------------------------------
  it('devrait afficher l\'erreur serveur dans la modale sans la fermer', async () => {
    render(<KnowledgeBasePage />);

    await waitFor(() => expect(screen.getByText('Test Collection')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Test Collection'));
    await userEvent.click(screen.getByRole('button', { name: /modifier la collection/i }));

    const nameInput = screen.getByDisplayValue('Test Collection');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Nom mis a jour');

    // Mock du PATCH en erreur
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: { message: 'Internal server error' } }),
    });

    await userEvent.click(screen.getByRole('button', { name: /enregistrer/i }));

    await waitFor(() => {
      expect(screen.getByText(/internal server error/i)).toBeInTheDocument();
      // La modale est toujours ouverte
      expect(screen.getByText('Modifier la collection')).toBeInTheDocument();
    });
  });
});
```

---

## 9. Recapitulatif des cas de test

| ID | Describe | It | Priorite |
|----|----------|----|----------|
| TC-SVC-UC-01 | updateCollection | Mise a jour du nom | P0 |
| TC-SVC-UC-02 | updateCollection | Description null | P1 |
| TC-SVC-UC-03 | updateCollection | Categorie | P1 |
| TC-SVC-UC-04 | updateCollection | Tous les champs | P0 |
| TC-SVC-UC-05 | updateCollection | Collection inexistante | P0 |
| TC-SVC-UC-06 | updateCollection | DB indisponible | P0 |
| TC-SVC-UC-07 | updateCollection | updatedAt toujours inclus | P1 |
| TC-SVC-UC-08 | updateCollection | Champs non fournis exclus | P1 |
| TC-SVC-GD-01 | getDocumentById | Recuperation reussie | P0 |
| TC-SVC-GD-02 | getDocumentById | Document inexistant | P0 |
| TC-SVC-GD-03 | getDocumentById | Mauvaise collection | P0 |
| TC-SVC-GD-04 | getDocumentById | DB indisponible | P1 |
| TC-SVC-UD-01 | updateDocument | Titre seul (sans re-chunk) | P0 |
| TC-SVC-UD-02 | updateDocument | Contenu (avec re-chunk) | P0 |
| TC-SVC-UD-03 | updateDocument | Titre + contenu | P0 |
| TC-SVC-UD-04 | updateDocument | Nombre de chunks correct | P0 |
| TC-SVC-UD-05 | updateDocument | Erreur API OpenAI | P0 |
| TC-SVC-UD-06 | updateDocument | Cle API absente | P1 |
| TC-SVC-UD-07 | updateDocument | DB indisponible | P1 |
| TC-SVC-UD-08 | updateDocument | updateCollectionCounts appele | P1 |
| TC-SVC-UD-09 | updateDocument | Counts pas appele si titre seul | P2 |
| TC-SVC-UD-10 | updateDocument | Erreur transaction (rollback) | P0 |
| TC-API-PC-01 | PATCH collection | Mise a jour valide | P0 |
| TC-API-PC-02 | PATCH collection | Body vide (400) | P0 |
| TC-API-PC-03 | PATCH collection | Nom vide (400) | P0 |
| TC-API-PC-04 | PATCH collection | Nom trop long (400) | P1 |
| TC-API-PC-05 | PATCH collection | Collection 404 | P0 |
| TC-API-PC-06 | PATCH collection | Non authentifie (401) | P0 |
| TC-API-PD-01 | PATCH document | Titre seul | P0 |
| TC-API-PD-02 | PATCH document | Contenu (re-chunk) | P0 |
| TC-API-PD-03 | PATCH document | Echec service (500) | P0 |
| TC-API-PD-04 | PATCH document | Collection 404 | P0 |
| TC-API-PD-05 | PATCH document | Body vide (400) | P0 |
| TC-API-PD-06 | PATCH document | Titre trop long (400) | P1 |
| TC-API-GD-01 | GET document | Recuperation reussie | P0 |
| TC-API-GD-02 | GET document | Document 404 | P0 |
| TC-API-GD-03 | GET document | Collection 404 | P0 |
| TC-API-GD-04 | GET document | Non authentifie (401) | P0 |
| TC-UI-CE-01 | CollectionEditForm | Champs pre-remplis | P0 |
| TC-UI-CE-02 | CollectionEditForm | Validation nom vide | P0 |
| TC-UI-CE-03 | CollectionEditForm | Soumission reussie | P0 |
| TC-UI-CE-04 | CollectionEditForm | Annulation | P1 |
| TC-UI-DE-01 | DocumentEditForm | Contenu charge | P0 |
| TC-UI-DE-02 | DocumentEditForm | Textarea resize | P2 |
| TC-UI-DE-03 | DocumentEditForm | Confirmation re-chunk | P0 |
| TC-UI-DV-01 | DocumentViewer | Contenu complet | P0 |
| TC-UI-DV-02 | DocumentViewer | Transition vers edit | P1 |
| TC-UI-ERR-01 | Erreur API | Affichage dans modale | P0 |

**Total : 48 cas de test**

---

## 10. Commandes d'execution

```bash
# Executer uniquement les tests de la feature Knowledge Edit
cd apps/web
npx vitest run --reporter=verbose \
  src/lib/ai-engine/knowledge/collections.test.ts \
  src/lib/ai-engine/knowledge/ingestion.test.ts \
  src/test/api-contracts/ai-engine-knowledge-edit.contract.test.ts \
  src/app/admin/content-studio-v2/ai-engine/knowledge/__tests__/knowledge-page-edit.test.tsx

# Avec couverture
npx vitest run --coverage \
  src/lib/ai-engine/knowledge/collections.test.ts \
  src/lib/ai-engine/knowledge/ingestion.test.ts
```
