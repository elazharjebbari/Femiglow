# Plan de Tests -- Knowledge Edit

**Frameworks** : Vitest 2.1.x (jsdom), Playwright 1.48, MSW 2.x  
**Objectif de couverture** : > 90% sur les nouvelles fonctions  
**Fichiers de test existants** :
- `apps/web/src/lib/ai-engine/knowledge/collections.test.ts`
- `apps/web/src/lib/ai-engine/knowledge/ingestion.test.ts`
- `apps/web/src/test/api-contracts/ai-engine-knowledge.contract.test.ts`
- `apps/web/src/test/api-contracts/ai-engine-knowledge-deep.contract.test.ts`
- `apps/web/src/app/admin/content-studio-v2/ai-engine/knowledge/__tests__/knowledge-page.test.tsx`
- `apps/web/e2e/content-studio-v2/ai-engine-knowledge.spec.ts`
- `apps/web/e2e/content-studio-v2/ai-engine-knowledge-flow.spec.ts`

---

## 1. Strategie de test

### 1.1 Pyramide de tests

```
                 /\
                /  \
               / E2E \          15+ scenarios Playwright
              /  (UI)  \        Flux utilisateur complets
             /----------\
            / Integration \     10+ cas de contrats API
           / (API routes)  \    Validation Zod, auth, routing
          /----------------\
         /    Unitaires      \  30+ cas Vitest
        / (service layer +    \ Logique metier isolee
       /   composants)         \
      /________________________\
```

### 1.2 Principes

1. **Isolation** : Chaque test est independant, pas de dependance a l'ordre d'execution
2. **Mocking** : La base de donnees, l'API OpenAI et l'authentification sont mockes
3. **Determinisme** : Pas de dependance a des services externes
4. **Lisibilite** : Les descriptions de test sont en francais
5. **Maintenance** : Les fixtures et helpers sont reutilisables

---

## 2. Categories de tests

### 2.1 Tests unitaires (Vitest + jsdom)

| Categorie | Fichier | Nombre de cas |
|-----------|---------|---------------|
| Service: updateCollection | `collections.test.ts` | 6 cas |
| Service: getDocumentById | `collections.test.ts` | 4 cas |
| Service: updateDocument | `ingestion.test.ts` | 8 cas |
| API: PATCH collection | `ai-engine-knowledge-edit.contract.test.ts` | 6 cas |
| API: GET document | `ai-engine-knowledge-edit.contract.test.ts` | 4 cas |
| API: PATCH document | `ai-engine-knowledge-edit.contract.test.ts` | 6 cas |
| UI: KnowledgeBasePage (edit) | `knowledge-page-edit.test.tsx` | 8 cas |
| **TOTAL** | | **42 cas** |

### 2.2 Tests E2E (Playwright)

| Categorie | Fichier | Nombre de scenarios |
|-----------|---------|---------------------|
| Flux edition collection | `ai-engine-knowledge-edit.spec.ts` | 5 scenarios |
| Flux visualisation document | `ai-engine-knowledge-edit.spec.ts` | 4 scenarios |
| Flux edition document | `ai-engine-knowledge-edit.spec.ts` | 4 scenarios |
| Flux re-chunking | `ai-engine-knowledge-edit.spec.ts` | 3 scenarios |
| **TOTAL** | | **16 scenarios** |

---

## 3. Couverture ciblee

### 3.1 Fonctions critiques (couverture > 95%)

| Fonction | Scenarios couverts |
|----------|-------------------|
| `updateCollection()` | Succes, champs partiels, DB indisponible, collection inexistante |
| `updateDocument()` | Titre seul, contenu (re-chunk), embeddings indisponibles, erreur transaction |
| `getDocumentById()` | Succes, inexistant, mauvaise collection, DB null |
| Route PATCH collection | Succes, validation, auth, 404 |
| Route GET document | Succes, auth, 404 collection, 404 document |
| Route PATCH document | Succes titre, succes contenu, validation, auth, 404, 500 |

### 3.2 Composants UI (couverture > 80%)

| Composant | Interactions testees |
|-----------|---------------------|
| Bouton "Modifier" (collection) | Rendu, clic -> modale |
| Bouton "Voir" (document) | Rendu, clic -> modale |
| Bouton "Modifier" (document) | Rendu, clic -> modale |
| CollectionEditDialog | Pre-remplissage, validation, soumission, erreur, annulation |
| DocumentViewDialog | Chargement, contenu, erreur, transition vers edit |
| DocumentEditDialog | Pre-remplissage, modification, avertissement re-chunk, soumission |
| ConfirmReChunkDialog | Affichage, confirmation, annulation |

---

## 4. Donnees de test (fixtures)

### 4.1 Collections

```typescript
const MOCK_COLLECTION = {
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
```

### 4.2 Documents

```typescript
const MOCK_DOCUMENT_DETAIL = {
  id: 'doc-test-001',
  collectionId: 'col-test-001',
  title: 'Guide des ingredients japonais',
  sourceType: 'text',
  sourceUrl: null,
  contentText: 'Le Tsubaki (Camellia japonica) est une huile precieuse...',
  metadata: null,
  chunkCount: 15,
  createdAt: '2026-05-01T08:00:00.000Z',
  updatedAt: '2026-05-20T14:00:00.000Z',
};

const MOCK_DOCUMENT_URL = {
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
```

---

## 5. Matrice de risque

| Zone | Risque | Priorite | Couverte par |
|------|--------|----------|-------------|
| Transaction re-chunking | Rollback en cas d'erreur | P0 | Unit + Integration |
| Validation Zod | Requetes invalides acceptees | P0 | Unit |
| Authentification | Acces non autorise | P0 | Integration |
| Pre-remplissage formulaire | Donnees incorrectes | P1 | UI + E2E |
| Dirty checking | Faux positif (confirmation inutile) | P2 | UI |
| Compteurs collection | Desynchronisation | P1 | Unit |
| Chargement contenu document | Erreur non geree | P1 | UI + E2E |
| Re-chunking long | Timeout / UX degradee | P2 | E2E |

---

## 6. Strategie de mocking

### 6.1 Backend (Vitest)

| Dependance | Mock | Raison |
|------------|------|--------|
| `db()` (Drizzle) | `vi.mock('@/lib/db/client')` | Pas de DB en test |
| `requireAdminApi()` | `vi.mock('@/lib/content-studio/auth')` | Pas de session en test |
| `OpenAIEmbeddings` | `vi.mock('@langchain/openai')` | Pas d'API OpenAI en test |
| `RecursiveCharacterTextSplitter` | `vi.mock('@langchain/textsplitters')` | Controle du chunking |
| `getEngineConfig()` | `vi.mock('../config')` | Retourne des cles factices |

### 6.2 Frontend (Vitest + jsdom)

| Dependance | Mock | Raison |
|------------|------|--------|
| `fetch` | `global.fetch = vi.fn()` | Pas de serveur en test |
| `window.confirm` | `vi.spyOn(window, 'confirm')` | Controle des dialogues natifs |

### 6.3 E2E (Playwright)

| Dependance | Mock | Raison |
|------------|------|--------|
| API Knowledge | `page.route('**/api/admin/ai-engine/knowledge/**')` | Determinisme |
| Auth session | Cookie de session pre-configure via `storageState` | Pas de login en test |

---

## 7. Execution des tests

### 7.1 Commandes

```bash
# Tests unitaires uniquement (knowledge edit)
cd apps/web
npx vitest run --reporter=verbose \
  src/lib/ai-engine/knowledge/collections.test.ts \
  src/lib/ai-engine/knowledge/ingestion.test.ts \
  src/test/api-contracts/ai-engine-knowledge-edit.contract.test.ts \
  src/app/admin/content-studio-v2/ai-engine/knowledge/__tests__/knowledge-page-edit.test.tsx

# Tests E2E uniquement (knowledge edit)
npx playwright test e2e/content-studio-v2/ai-engine-knowledge-edit.spec.ts

# Tous les tests knowledge (existants + nouveaux)
npx vitest run --reporter=verbose src/lib/ai-engine/knowledge/
npx playwright test e2e/content-studio-v2/ai-engine-knowledge

# Coverage
npx vitest run --coverage src/lib/ai-engine/knowledge/
```

### 7.2 CI/CD

Les tests sont executes automatiquement dans la CI :

1. **Vitest** : Via la commande `pnpm test` dans le workflow GitHub Actions
2. **Playwright** : Via la commande `pnpm e2e` avec le navigateur Chromium headless
3. **Seuil de couverture** : Le build echoue si la couverture des nouvelles fonctions < 90%

---

## 8. Criteres d'acceptation des tests

| Critere | Condition |
|---------|-----------|
| Tous les tests passent | 0 failures |
| Couverture > 90% sur les nouvelles fonctions | Vitest coverage report |
| Aucun test flaky detecte | 3 runs consecutifs sans echec |
| Temps d'execution unit < 30s | `vitest run` |
| Temps d'execution E2E < 120s | `playwright test` |
| Aucune regression sur les tests existants | Tests existants non modifies passent |
