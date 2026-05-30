# Batterie de Tests Globale -- Knowledge Edit + API Keys Management

> **Framework de tests** : Vitest 2.1.x + jsdom (unit/integration), Playwright 1.48 (E2E), MSW 2.x (mocks API)
> **Branche** : `feat/ai-engine-langgraph-mvp`
> **Baseline existante** : 622 tests unitaires + 27 tests E2E, 0 echecs
> **Date de reference** : 2026-05-25

---

## 1. Pyramide de Tests

```
                    /\
                   /  \
                  / E2E \          6 specs  (~5%)
                 /--------\
                /Integration\      8 suites (~15%)
               /--------------\
              /   Unit Tests    \  16 suites (~80%)
             /-------------------\
```

### Repartition cible

| Niveau | Type | Framework | Quantite estimee | Couverture cible |
|--------|------|-----------|-----------------|-----------------|
| Unit | Services, utilitaires, logique metier | Vitest + jsdom | ~60 tests | >= 85% par fichier |
| Integration | Contrats API, MSW handlers | Vitest + MSW | ~30 tests | >= 80% par route |
| E2E | Flux utilisateur complet | Playwright | ~12 tests | Scenarios critiques |
| Securite | Chiffrement, masquage, audit | Vitest | ~10 tests | 100% securite |
| Accessibilite | Navigation clavier, ARIA | Playwright | ~4 tests | WCAG 2.1 AA |
| Performance | Temps de reponse, re-indexation | Vitest + Playwright | ~4 tests | Baselines |

---

## 2. Registre MSW Handlers

### 2.1 Handlers existants (`ai-engine-handlers.ts`)

Les handlers MSW existants dans `/var/www/femiglow-staging/apps/web/src/test/msw/ai-engine-handlers.ts` couvrent deja :

- `GET /api/admin/ai-engine/knowledge` -- Liste des collections
- `POST /api/admin/ai-engine/knowledge` -- Creation de collection
- `DELETE /api/admin/ai-engine/knowledge/:slug` -- Suppression de collection
- `GET /api/admin/ai-engine/knowledge/:slug/documents` -- Documents d'une collection
- `POST /api/admin/ai-engine/knowledge/:slug/documents` -- Ingestion de document
- `DELETE /api/admin/ai-engine/knowledge/:slug/documents/:docId` -- Suppression de document
- `POST /api/admin/ai-engine/knowledge/embed` -- Generation d'embeddings
- `GET /api/admin/ai-engine/config/providers` -- Liste des providers
- `POST /api/admin/ai-engine/config/providers` -- Mise a jour provider
- `GET /api/admin/ai-engine/config/workflows` -- Liste des workflows
- `GET /api/admin/ai-engine/config/prompts` -- Liste des prompts

### 2.2 Nouveaux handlers a ajouter

```typescript
// ============================================================
// Knowledge Edit Handlers
// ============================================================

// GET /api/admin/ai-engine/knowledge/:slug
// Retourne une collection specifique par slug
http.get('/api/admin/ai-engine/knowledge/:slug', ({ params }) => {
  const { slug } = params;
  const collection = mockCollections.find(c => c.slug === slug && c.isActive);
  if (!collection) {
    return HttpResponse.json(
      { error: { code: 'not_found', message: `Collection "${slug}" not found` } },
      { status: 404 }
    );
  }
  return HttpResponse.json({ collection });
});

// PUT /api/admin/ai-engine/knowledge/:slug
// Met a jour une collection
http.put('/api/admin/ai-engine/knowledge/:slug', async ({ params, request }) => {
  const { slug } = params;
  const body = await request.json();
  const collection = mockCollections.find(c => c.slug === slug && c.isActive);
  if (!collection) {
    return HttpResponse.json(
      { error: { code: 'not_found', message: `Collection "${slug}" not found` } },
      { status: 404 }
    );
  }
  // Verifier unicite du slug si modifie
  if (body.slug && body.slug !== slug) {
    const existing = mockCollections.find(c => c.slug === body.slug && c.isActive);
    if (existing) {
      return HttpResponse.json(
        { error: 'Slug already exists' },
        { status: 409 }
      );
    }
  }
  const updated = { ...collection, ...body, updatedAt: new Date().toISOString() };
  return HttpResponse.json({ collection: updated });
});

// GET /api/admin/ai-engine/knowledge/:slug/documents/:docId
// Retourne un document specifique
http.get('/api/admin/ai-engine/knowledge/:slug/documents/:docId', ({ params }) => {
  const { slug, docId } = params;
  const doc = mockDocuments[slug]?.find(d => d.id === docId);
  if (!doc) {
    return HttpResponse.json(
      { error: { code: 'not_found', message: `Document "${docId}" not found` } },
      { status: 404 }
    );
  }
  return HttpResponse.json({ document: doc });
});

// PUT /api/admin/ai-engine/knowledge/:slug/documents/:docId
// Met a jour un document
http.put('/api/admin/ai-engine/knowledge/:slug/documents/:docId', async ({ params, request }) => {
  const { slug, docId } = params;
  const body = await request.json();
  const doc = mockDocuments[slug]?.find(d => d.id === docId);
  if (!doc) {
    return HttpResponse.json(
      { error: { code: 'not_found', message: `Document "${docId}" not found` } },
      { status: 404 }
    );
  }
  const updated = { ...doc, ...body, updatedAt: new Date().toISOString() };
  if (body.contentText) {
    updated.reindexed = true;
  }
  return HttpResponse.json({ document: updated });
});

// ============================================================
// API Keys Management Handlers
// ============================================================

// GET /api/admin/ai-engine/config/providers/:id/api-key
http.get('/api/admin/ai-engine/config/providers/:id/api-key', ({ params }) => {
  const { id } = params;
  const hasKey = mockApiKeys[id] !== undefined;
  return HttpResponse.json({
    hasApiKey: hasKey,
    masked: hasKey ? maskKey(mockApiKeys[id]) : null,
    setAt: hasKey ? '2026-05-25T10:00:00Z' : null,
    source: hasKey ? 'database' : (mockEnvKeys[id] ? 'environment' : null),
  });
});

// PUT /api/admin/ai-engine/config/providers/:id/api-key
http.put('/api/admin/ai-engine/config/providers/:id/api-key', async ({ params, request }) => {
  const { id } = params;
  const body = await request.json();
  if (!body.apiKey || typeof body.apiKey !== 'string' || body.apiKey.length < 10) {
    return HttpResponse.json(
      { error: 'API key must be at least 10 characters' },
      { status: 400 }
    );
  }
  mockApiKeys[id] = body.apiKey;
  return HttpResponse.json({
    masked: maskKey(body.apiKey),
    setAt: new Date().toISOString(),
  });
});

// DELETE /api/admin/ai-engine/config/providers/:id/api-key
http.delete('/api/admin/ai-engine/config/providers/:id/api-key', ({ params, request }) => {
  const { id } = params;
  const confirm = request.headers.get('X-Confirm-Delete');
  if (confirm !== 'true') {
    return HttpResponse.json(
      { error: 'Confirmation required (X-Confirm-Delete: true)' },
      { status: 400 }
    );
  }
  delete mockApiKeys[id];
  return HttpResponse.json({ success: true });
});

// POST /api/admin/ai-engine/config/providers/:id/api-key/test
http.post('/api/admin/ai-engine/config/providers/:id/api-key/test', async ({ params, request }) => {
  const { id } = params;
  const body = await request.json().catch(() => ({}));
  const key = body.apiKey || mockApiKeys[id];
  if (!key) {
    return HttpResponse.json(
      { error: 'No API key provided or stored' },
      { status: 400 }
    );
  }
  // Simuler un test de connexion
  const isValid = key.startsWith('sk-') || key.startsWith('AI');
  return HttpResponse.json({
    valid: isValid,
    error: isValid ? undefined : 'Invalid API key format',
    latencyMs: Math.floor(Math.random() * 500) + 100,
  });
});
```

### 2.3 Utilitaires de mock partages

```typescript
// Donnees de mock partagees
const mockCollections = [
  {
    id: 'col-1',
    name: 'Neuromarketing',
    slug: 'neuromarketing',
    description: 'Biais cognitifs et neuroscience',
    category: 'science',
    documentCount: 3,
    chunkCount: 45,
    lastIndexedAt: '2026-05-20T10:00:00Z',
    isActive: true,
    createdAt: '2026-01-15T08:00:00Z',
    updatedAt: '2026-05-20T10:00:00Z',
  },
  // ... autres collections
];

const mockDocuments: Record<string, Array<{
  id: string;
  title: string;
  sourceType: string;
  contentText: string;
  sourceUrl: string | null;
  chunkCount: number;
  createdAt: string;
}>> = {
  neuromarketing: [
    {
      id: 'doc-1',
      title: 'Guide des biais cognitifs',
      sourceType: 'text',
      contentText: 'Contenu du guide...',
      sourceUrl: null,
      chunkCount: 15,
      createdAt: '2026-03-10T10:00:00Z',
    },
  ],
};

const mockApiKeys: Record<string, string> = {};
const mockEnvKeys: Record<string, boolean> = {
  'default-openai': true,
  'default-anthropic': true,
};

function maskKey(key: string): string {
  if (key.length <= 8) return '****';
  return key.substring(0, 4) + '...' + key.substring(key.length - 4);
}
```

---

## 3. Specification des Tests Unitaires

### 3.1 Feature: Knowledge Edit

#### Suite TU-KE-01 : `collections.test.ts`

```
Fichier : apps/web/src/lib/ai-engine/knowledge/collections.test.ts

describe('updateCollection')
  it('doit mettre a jour le nom d une collection')
  it('doit mettre a jour le slug d une collection')
  it('doit mettre a jour la description d une collection')
  it('doit mettre a jour la categorie d une collection')
  it('doit mettre a jour plusieurs champs simultanement')
  it('doit rejeter si la collection n existe pas')
  it('doit rejeter si le nouveau slug est deja utilise')
  it('doit mettre a jour le champ updatedAt')
  it('doit retourner la collection mise a jour')
  it('ne doit pas modifier les champs non fournis')

describe('getCollectionById')
  it('doit retourner une collection par son ID')
  it('doit retourner null si l ID n existe pas')
  it('doit retourner null si la collection est desactivee')
```

#### Suite TU-KE-02 : `documents.test.ts`

```
Fichier : apps/web/src/lib/ai-engine/knowledge/documents.test.ts

describe('updateDocument')
  it('doit mettre a jour le titre d un document')
  it('doit mettre a jour le contenu textuel d un document')
  it('doit mettre a jour le sourceType d un document')
  it('doit mettre a jour le sourceUrl d un document')
  it('doit mettre a jour les metadata d un document')
  it('doit rejeter si le document n existe pas')
  it('doit rejeter si le collectionId ne correspond pas')
  it('doit mettre a jour le champ updatedAt')
  it('doit retourner le document mis a jour')

describe('getDocumentById')
  it('doit retourner un document par son ID')
  it('doit retourner null si l ID n existe pas')
  it('doit inclure le contenu textuel dans la reponse')
```

#### Suite TU-KE-03 : `ingestion.test.ts` (nouvelles fonctions)

```
Fichier : apps/web/src/lib/ai-engine/knowledge/ingestion.test.ts

describe('reindexDocument')
  it('doit supprimer les anciens chunks du document')
  it('doit re-chunker le contenu textuel')
  it('doit generer de nouveaux embeddings pour chaque chunk')
  it('doit mettre a jour les compteurs de la collection')
  it('doit gerer les erreurs d embedding gracieusement')
  it('doit retourner le nombre de chunks crees')
  it('ne doit pas laisser de chunks orphelins en cas d erreur')
  it('doit utiliser une transaction pour l atomicite')
```

### 3.2 Feature: API Keys Management

#### Suite TU-AKM-01 : `encryption.test.ts`

```
Fichier : apps/web/src/lib/ai-engine/security/encryption.test.ts

describe('encrypt')
  it('doit produire une chaine differente du plaintext')
  it('doit produire des sorties differentes pour le meme input (IV unique)')
  it('doit gerer les chaines vides')
  it('doit gerer les chaines tres longues (10000+ chars)')
  it('doit gerer les caracteres speciaux et unicode')
  it('doit lever une erreur si AI_ENGINE_ENCRYPTION_KEY n est pas defini')

describe('decrypt')
  it('doit retrouver le plaintext original')
  it('doit echouer avec une cle de chiffrement differente')
  it('doit echouer avec un ciphertext corrompu')
  it('doit echouer avec un ciphertext vide')
  it('doit echouer avec un format invalide')

describe('encrypt + decrypt (roundtrip)')
  it('doit etre bijectif pour une cle OpenAI standard')
  it('doit etre bijectif pour une cle Anthropic')
  it('doit etre bijectif pour une cle Google')
  it('doit etre bijectif pour une cle ElevenLabs')
  it('doit etre bijectif pour une URL Ollama')

describe('maskApiKey')
  it('doit masquer une cle OpenAI (sk-...xxxx)')
  it('doit masquer une cle Anthropic (sk-a...xxxx)')
  it('doit masquer une cle Google')
  it('doit gerer une cle courte (< 8 chars)')
  it('doit gerer une cle vide')
  it('ne doit jamais retourner la cle complete')
```

#### Suite TU-AKM-02 : `api-key-service.test.ts`

```
Fichier : apps/web/src/lib/ai-engine/providers/api-key-service.test.ts

describe('setApiKey')
  it('doit chiffrer et stocker la cle en base')
  it('doit mettre a jour apiKeySetAt')
  it('doit ecraser une cle existante')
  it('doit rejeter une cle vide')
  it('doit rejeter un providerId inexistant')
  it('doit appeler le service d audit')

describe('getApiKey')
  it('doit retourner la cle dechiffree pour un provider avec cle')
  it('doit retourner null pour un provider sans cle')
  it('doit gerer les erreurs de dechiffrement')

describe('deleteApiKey')
  it('doit supprimer la cle chiffree')
  it('doit mettre apiKeySetAt a null')
  it('doit appeler le service d audit')
  it('doit etre idempotent (supprimer une cle inexistante)')

describe('hasApiKey')
  it('doit retourner true si une cle existe en base')
  it('doit retourner false si aucune cle en base')

describe('testApiKey')
  it('doit valider une cle OpenAI valide via GET /models')
  it('doit detecter une cle OpenAI invalide')
  it('doit valider une cle Anthropic valide via POST /messages')
  it('doit detecter une cle Anthropic invalide')
  it('doit valider une cle Google valide via GET models')
  it('doit gerer un timeout de connexion')
  it('doit gerer un provider inconnu')
  it('doit retourner la latence du test')
```

#### Suite TU-AKM-03 : `engine-config.test.ts` (nouvelles fonctions)

```
Fichier : apps/web/src/lib/ai-engine/config/engine-config.test.ts

describe('getEngineConfigAsync')
  it('doit prioriser les cles de la base de donnees')
  it('doit fallback sur les env vars si pas de cle en base')
  it('doit gerer l absence de connexion DB')
  it('doit mettre en cache le resultat')
  it('doit invalider le cache apres resetEngineConfig()')
  it('doit gerer les erreurs de dechiffrement sans planter')
```

#### Suite TU-AKM-04 : `audit.test.ts`

```
Fichier : apps/web/src/lib/ai-engine/security/audit.test.ts

describe('logApiKeyChange')
  it('doit enregistrer une action SET')
  it('doit enregistrer une action DELETE')
  it('doit inclure le providerId et l adminId')
  it('doit inclure un timestamp')
  it('ne doit JAMAIS inclure la cle en clair')
```

### 3.3 Tests de composants UI

#### Suite TU-UI-KE : Tests composants Knowledge Edit

```
Fichier : apps/web/src/app/admin/content-studio-v2/ai-engine/knowledge/__tests__/knowledge-edit.test.tsx

describe('KnowledgeBasePage - Edition de collection')
  it('doit afficher un bouton Editer sur chaque collection')
  it('doit ouvrir le formulaire inline en cliquant Editer')
  it('doit pre-remplir les champs avec les valeurs actuelles')
  it('doit fermer le formulaire en cliquant Annuler')
  it('doit desactiver le bouton Sauvegarder si rien n a change')
  it('doit afficher un spinner pendant la sauvegarde')
  it('doit mettre a jour la liste apres sauvegarde reussie')
  it('doit afficher un message d erreur en cas d echec')
  it('ne doit permettre l edition que d une seule collection a la fois')

describe('KnowledgeBasePage - Edition de document')
  it('doit afficher un bouton Editer sur chaque document')
  it('doit ouvrir le formulaire inline d edition de document')
  it('doit pre-remplir titre et contenu')
  it('doit permettre le basculement texte/url')
  it('doit afficher un spinner pendant la mise a jour')
  it('doit rafraichir les documents apres sauvegarde')
  it('ne doit permettre l edition que d un seul document a la fois')
```

#### Suite TU-UI-AKM : Tests composants API Keys

```
Fichier : apps/web/src/app/admin/content-studio-v2/ai-engine/config/__tests__/api-key-manager.test.tsx
  ou
  apps/web/src/components/admin/content-studio-v2/ai-engine/ApiKeyManager.test.tsx

describe('ApiKeyManager')
  it('doit afficher le champ de cle masque par defaut')
  it('doit toggle la visibilite avec le bouton oeil')
  it('doit afficher le statut actuel (configuree/non configuree)')
  it('doit afficher la source (env var / base de donnees)')
  it('doit afficher la cle masquee apres sauvegarde')
  it('doit desactiver le bouton Sauvegarder si le champ est vide')
  it('doit afficher un spinner pendant le test de connexion')
  it('doit afficher le resultat du test (valide/invalide + latence)')
  it('doit demander confirmation avant suppression')
  it('doit rafraichir le statut apres suppression')
  it('doit gerer les erreurs reseau')
```

---

## 4. Specification des Tests d'Integration

### 4.1 Knowledge Edit -- Contrats API

```
Fichier : apps/web/src/test/api-contracts/ai-engine-knowledge-edit.contract.test.ts

describe('GET /api/admin/ai-engine/knowledge/:slug')
  it('doit retourner 200 avec la collection pour un slug valide')
  it('doit retourner 404 pour un slug inexistant')
  it('doit retourner 401 sans authentification admin')
  it('doit inclure tous les champs de la collection')

describe('PUT /api/admin/ai-engine/knowledge/:slug')
  it('doit retourner 200 avec la collection mise a jour')
  it('doit accepter une mise a jour partielle (nom seul)')
  it('doit accepter une mise a jour partielle (description seule)')
  it('doit accepter une mise a jour du slug')
  it('doit retourner 409 pour un slug duplique')
  it('doit retourner 400 pour un slug invalide (caracteres speciaux)')
  it('doit retourner 400 pour un nom vide')
  it('doit retourner 404 pour un slug inexistant')
  it('doit retourner 401 sans authentification admin')
  it('doit mettre a jour updatedAt')

describe('GET /api/admin/ai-engine/knowledge/:slug/documents/:docId')
  it('doit retourner 200 avec le document pour un docId valide')
  it('doit retourner 404 pour un docId inexistant')
  it('doit retourner 404 si le document n appartient pas a la collection')
  it('doit inclure contentText dans la reponse')

describe('PUT /api/admin/ai-engine/knowledge/:slug/documents/:docId')
  it('doit retourner 200 avec le document mis a jour')
  it('doit accepter une mise a jour du titre seul')
  it('doit declencher la re-indexation si contentText est modifie')
  it('doit retourner 400 pour un titre vide')
  it('doit retourner 400 pour un contentText depassant la limite')
  it('doit retourner 404 pour un docId inexistant')
  it('doit retourner 401 sans authentification admin')
```

### 4.2 API Keys Management -- Contrats API

```
Fichier : apps/web/src/test/api-contracts/ai-engine-api-keys.contract.test.ts

describe('GET /api/admin/ai-engine/config/providers/:id/api-key')
  it('doit retourner 200 avec hasApiKey=false si pas de cle')
  it('doit retourner 200 avec hasApiKey=true et masked si cle existe')
  it('doit inclure la source (database/environment)')
  it('doit retourner 401 sans authentification admin')
  it('ne doit JAMAIS retourner la cle en clair')

describe('PUT /api/admin/ai-engine/config/providers/:id/api-key')
  it('doit retourner 200 avec masked et setAt')
  it('doit chiffrer la cle en base (verifier en DB)')
  it('doit retourner 400 pour une cle trop courte')
  it('doit retourner 400 pour une cle vide')
  it('doit retourner 404 pour un provider inexistant')
  it('doit retourner 401 sans authentification admin')

describe('DELETE /api/admin/ai-engine/config/providers/:id/api-key')
  it('doit retourner 200 avec success=true')
  it('doit retourner 400 sans header X-Confirm-Delete')
  it('doit supprimer la cle chiffree de la base')
  it('doit etre idempotent')
  it('doit retourner 401 sans authentification admin')

describe('POST /api/admin/ai-engine/config/providers/:id/api-key/test')
  it('doit retourner valid=true pour une cle valide')
  it('doit retourner valid=false pour une cle invalide')
  it('doit inclure latencyMs dans la reponse')
  it('doit utiliser la cle en base si aucune fournie')
  it('doit retourner 400 si aucune cle disponible')
  it('doit gerer un timeout de connexion au provider')

describe('GET /api/admin/ai-engine/config/providers (enrichi)')
  it('doit inclure hasApiKey pour chaque provider')
  it('doit inclure apiKeyMasked pour les providers avec cle')
  it('doit inclure apiKeySetAt pour les providers avec cle')
  it('doit differencier source=database et source=environment')
```

---

## 5. Specification des Tests E2E

### 5.1 Knowledge Edit -- E2E

```
Fichier : apps/web/e2e/content-studio-v2/ai-engine-knowledge-edit.spec.ts

describe('Knowledge Edit - Edition de collection')
  test('doit permettre d editer le nom d une collection', async ({ page }) => {
    // 1. Naviguer vers /admin/content-studio-v2/ai-engine/knowledge
    // 2. Attendre le chargement des collections
    // 3. Cliquer sur le chevron pour expander une collection
    // 4. Cliquer sur le bouton "Editer" de la collection
    // 5. Verifier que le formulaire inline est visible
    // 6. Effacer et saisir un nouveau nom
    // 7. Cliquer "Sauvegarder"
    // 8. Attendre la disparition du spinner
    // 9. Verifier que le nom est mis a jour dans la liste
    // 10. Rafraichir la page et verifier la persistance
  })

  test('doit afficher une erreur pour un slug duplique', async ({ page }) => {
    // 1. Editer une collection
    // 2. Changer le slug pour un slug existant
    // 3. Sauvegarder
    // 4. Verifier le message d'erreur
    // 5. Verifier que le formulaire reste ouvert
  })

  test('doit permettre d annuler une edition', async ({ page }) => {
    // 1. Ouvrir le formulaire d'edition
    // 2. Modifier des champs
    // 3. Cliquer "Annuler"
    // 4. Verifier que les valeurs originales sont restaurees
  })

describe('Knowledge Edit - Edition de document')
  test('doit permettre d editer le titre et le contenu d un document', async ({ page }) => {
    // 1. Expander une collection avec documents
    // 2. Cliquer "Editer" sur un document
    // 3. Modifier le titre
    // 4. Modifier le contenu
    // 5. Sauvegarder
    // 6. Verifier la mise a jour
  })

  test('doit declencher la re-indexation apres modification du contenu', async ({ page }) => {
    // 1. Editer un document
    // 2. Modifier le contenu
    // 3. Sauvegarder
    // 4. Verifier que le nombre de chunks a potentiellement change
    // 5. Verifier le message de succes mentionne la re-indexation
  })
```

### 5.2 API Keys Management -- E2E

```
Fichier : apps/web/e2e/content-studio-v2/ai-engine-api-keys.spec.ts

describe('API Keys Management')
  test('doit permettre d ajouter une cle API a un provider', async ({ page }) => {
    // 1. Naviguer vers /admin/content-studio-v2/ai-engine/config
    // 2. Onglet "Fournisseurs"
    // 3. Trouver un ProviderCard
    // 4. Cliquer "Gerer la cle API"
    // 5. Saisir une cle dans le champ masque
    // 6. Cliquer "Sauvegarder"
    // 7. Verifier que la cle est masquee (sk-...xxxx)
    // 8. Verifier que le badge indique "Configuree"
  })

  test('doit permettre de tester une cle API', async ({ page }) => {
    // 1. Avec un provider qui a une cle configuree
    // 2. Cliquer "Tester la connexion"
    // 3. Attendre le resultat
    // 4. Verifier le badge de resultat (vert/rouge)
    // 5. Verifier que la latence est affichee
  })

  test('doit permettre de supprimer une cle API', async ({ page }) => {
    // 1. Avec un provider qui a une cle configuree
    // 2. Cliquer "Supprimer la cle"
    // 3. Confirmer dans le dialogue
    // 4. Verifier que le badge passe a "Non configuree"
    // 5. Verifier que le champ est vide
  })

  test('doit masquer la cle par defaut et la reveler au clic', async ({ page }) => {
    // 1. Ouvrir le formulaire de cle API
    // 2. Saisir une cle
    // 3. Verifier que le type est "password"
    // 4. Cliquer le bouton oeil
    // 5. Verifier que le type est "text"
    // 6. Re-cliquer pour re-masquer
  })

  test('ne doit jamais afficher la cle complete apres sauvegarde', async ({ page }) => {
    // 1. Sauvegarder une cle
    // 2. Fermer et re-ouvrir le formulaire
    // 3. Verifier que seule la version masquee est affichee
    // 4. Verifier dans le DOM qu'aucun element ne contient la cle complete
  })

  test('doit afficher la source de la cle (env var vs base)', async ({ page }) => {
    // 1. Pour un provider avec cle env var, verifier "Source: Variable d'environnement"
    // 2. Ajouter une cle via l'UI, verifier "Source: Base de donnees"
    // 3. Supprimer la cle DB, verifier retour a "Source: Variable d'environnement"
  })
```

---

## 6. Ordre d'Execution des Tests

### 6.1 Ordre recommande

```
1. Tests unitaires de securite (chiffrement) -- validation critique
   pnpm exec vitest run apps/web/src/lib/ai-engine/security/

2. Tests unitaires metier (services knowledge + api-key)
   pnpm exec vitest run apps/web/src/lib/ai-engine/knowledge/
   pnpm exec vitest run apps/web/src/lib/ai-engine/providers/api-key-service.test.ts
   pnpm exec vitest run apps/web/src/lib/ai-engine/config/engine-config.test.ts

3. Tests de contrats API
   pnpm exec vitest run apps/web/src/test/api-contracts/ai-engine-knowledge-edit.contract.test.ts
   pnpm exec vitest run apps/web/src/test/api-contracts/ai-engine-api-keys.contract.test.ts

4. Tests de composants UI
   pnpm exec vitest run apps/web/src/app/admin/content-studio-v2/ai-engine/knowledge/__tests__/
   pnpm exec vitest run apps/web/src/app/admin/content-studio-v2/ai-engine/config/__tests__/

5. Tests E2E
   pnpm exec playwright test e2e/content-studio-v2/ai-engine-knowledge-edit.spec.ts
   pnpm exec playwright test e2e/content-studio-v2/ai-engine-api-keys.spec.ts

6. Suite de regression complete
   pnpm exec vitest run
   pnpm exec playwright test
```

### 6.2 Commande globale

```bash
cd /var/www/femiglow-staging

# Batterie complete en une commande
echo "=== BATTERIE DE TESTS GLOBALE ==="
echo "Debut : $(date)"

# Phase 1 : Unit tests
echo "--- Phase 1 : Tests unitaires ---"
pnpm exec vitest run --reporter=verbose 2>&1 | tee /tmp/unit-results.txt
UNIT_EXIT=$?

# Phase 2 : E2E (necessite serveur dev)
echo "--- Phase 2 : Tests E2E ---"
pnpm exec playwright test --reporter=list 2>&1 | tee /tmp/e2e-results.txt
E2E_EXIT=$?

# Resume
echo "=== RESUME ==="
echo "Tests unitaires : $([ $UNIT_EXIT -eq 0 ] && echo PASSE || echo ECHEC)"
echo "Tests E2E : $([ $E2E_EXIT -eq 0 ] && echo PASSE || echo ECHEC)"
echo "Fin : $(date)"
```

---

## 7. Couverture Cible par Feature

### 7.1 Knowledge Edit

| Fichier | Lignes | Branches | Fonctions | Cible |
|---------|--------|----------|-----------|-------|
| `knowledge/collections.ts` | >= 90% | >= 85% | 100% | Critique |
| `knowledge/documents.ts` | >= 90% | >= 85% | 100% | Critique |
| `knowledge/ingestion.ts` | >= 80% | >= 75% | 100% | Eleve |
| `knowledge/page.tsx` | >= 70% | >= 65% | >= 80% | Moyen |
| `knowledge/[slug]/route.ts` | >= 85% | >= 80% | 100% | Critique |
| `knowledge/[slug]/documents/[docId]/route.ts` | >= 85% | >= 80% | 100% | Critique |

### 7.2 API Keys Management

| Fichier | Lignes | Branches | Fonctions | Cible |
|---------|--------|----------|-----------|-------|
| `security/encryption.ts` | >= 95% | >= 90% | 100% | Critique |
| `security/audit.ts` | >= 90% | >= 85% | 100% | Eleve |
| `providers/api-key-service.ts` | >= 90% | >= 85% | 100% | Critique |
| `config/engine-config.ts` | >= 85% | >= 80% | 100% | Critique |
| `providers/[id]/api-key/route.ts` | >= 85% | >= 80% | 100% | Critique |
| `config/page.tsx` | >= 65% | >= 60% | >= 75% | Moyen |

---

## 8. Tests de Regression

### 8.1 Perimetre de regression

Les tests suivants doivent passer sans modification apres l'implementation :

```bash
# Tests existants Knowledge (ne doivent pas regressionner)
pnpm exec vitest run apps/web/src/test/api-contracts/ai-engine-knowledge.contract.test.ts
pnpm exec vitest run apps/web/src/test/api-contracts/ai-engine-knowledge-deep.contract.test.ts
pnpm exec vitest run apps/web/src/app/admin/content-studio-v2/ai-engine/knowledge/__tests__/knowledge-page.test.tsx
pnpm exec playwright test e2e/content-studio-v2/ai-engine-knowledge.spec.ts
pnpm exec playwright test e2e/content-studio-v2/ai-engine-knowledge-flow.spec.ts

# Tests existants Config (ne doivent pas regressionner)
pnpm exec vitest run apps/web/src/test/api-contracts/ai-engine-config.contract.test.ts
pnpm exec vitest run apps/web/src/app/admin/content-studio-v2/ai-engine/config/__tests__/config-page.test.tsx
pnpm exec playwright test e2e/content-studio-v2/ai-engine-config.spec.ts

# Tests de navigation et layout (ne doivent pas regressionner)
pnpm exec playwright test e2e/content-studio-v2/ai-engine-navigation.spec.ts
pnpm exec playwright test e2e/content-studio-v2/ai-engine-sidebar-subnav.spec.ts
pnpm exec playwright test e2e/content-studio-v2/ai-engine-dashboard.spec.ts
```

### 8.2 Commande de regression rapide

```bash
# Regression rapide (~2 min)
pnpm exec vitest run \
  apps/web/src/test/api-contracts/ai-engine-knowledge.contract.test.ts \
  apps/web/src/test/api-contracts/ai-engine-config.contract.test.ts \
  apps/web/src/app/admin/content-studio-v2/ai-engine/knowledge/__tests__/ \
  apps/web/src/app/admin/content-studio-v2/ai-engine/config/__tests__/ \
  --reporter=verbose
```

---

## 9. Tests de Performance

### 9.1 Baselines

| Operation | Baseline acceptable | Seuil d'alerte |
|-----------|-------------------|---------------|
| GET /knowledge (liste) | < 200ms | > 500ms |
| PUT /knowledge/:slug (update) | < 300ms | > 800ms |
| PUT /knowledge/:slug/documents/:docId (update + re-index) | < 5000ms | > 10000ms |
| PUT /providers/:id/api-key (chiffrement + stockage) | < 200ms | > 500ms |
| POST /providers/:id/api-key/test | < 10000ms | > 15000ms |
| getEngineConfigAsync() (avec DB lookup) | < 100ms | > 300ms |

### 9.2 Tests de performance

```
Fichier : apps/web/src/test/performance/ai-engine-perf.test.ts

describe('Performance Knowledge Edit')
  it('updateCollection doit s executer en moins de 300ms')
  it('updateDocument doit s executer en moins de 500ms')
  it('reindexDocument doit s executer en moins de 5000ms pour un document de 10000 chars')

describe('Performance API Keys')
  it('encrypt doit s executer en moins de 5ms')
  it('decrypt doit s executer en moins de 5ms')
  it('setApiKey doit s executer en moins de 200ms')
  it('getEngineConfigAsync doit s executer en moins de 100ms')
```

---

## 10. Tests de Securite

### 10.1 Checklist de securite

```
Fichier : apps/web/src/test/security/ai-engine-security.test.ts

describe('Securite - Chiffrement des cles API')
  it('les cles chiffrees ne contiennent pas le plaintext')
  it('le meme plaintext produit des ciphertexts differents (IV unique)')
  it('un ciphertext corrompu leve une erreur et ne retourne pas de donnees partielles')
  it('la cle de chiffrement n est jamais exposee dans les reponses API')

describe('Securite - Masquage')
  it('la reponse PUT /api-key ne contient pas la cle en clair')
  it('la reponse GET /api-key ne contient pas la cle en clair')
  it('la reponse GET /providers ne contient pas de cle en clair')
  it('les logs ne contiennent pas de cle en clair')

describe('Securite - Authentification')
  it('GET /knowledge/:slug retourne 401 sans session admin')
  it('PUT /knowledge/:slug retourne 401 sans session admin')
  it('PUT /providers/:id/api-key retourne 401 sans session admin')
  it('DELETE /providers/:id/api-key retourne 401 sans session admin')

describe('Securite - Validation des entrees')
  it('PUT /knowledge/:slug rejette les slugs avec injection SQL')
  it('PUT /knowledge/:slug rejette les noms avec scripts XSS')
  it('PUT /providers/:id/api-key rejette les payloads > 10Ko')
  it('DELETE /providers/:id/api-key requiert le header X-Confirm-Delete')

describe('Securite - Audit')
  it('chaque modification de cle API est journalisee')
  it('les logs d audit incluent l identifiant admin')
  it('les logs d audit n incluent pas la cle en clair')
```

---

## 11. Tests d'Accessibilite

### 11.1 Checklist WCAG 2.1 AA

```
Fichier : apps/web/e2e/content-studio-v2/ai-engine-knowledge-edit-a11y.spec.ts
  et
  apps/web/e2e/content-studio-v2/ai-engine-api-keys-a11y.spec.ts

describe('Accessibilite - Knowledge Edit')
  test('le formulaire d edition de collection est navigable au clavier')
  test('le bouton Editer a un aria-label descriptif')
  test('le formulaire d edition a un focus trap correct')
  test('les messages d erreur sont annonces par les lecteurs d ecran (aria-live)')

describe('Accessibilite - API Keys Management')
  test('le champ de cle API a un label associe')
  test('le toggle visibilite a un aria-label descriptif')
  test('le resultat du test est annonce (aria-live)')
  test('la confirmation de suppression est navigable au clavier')
```

---

## 12. Commandes de Reference Rapide

```bash
# === Tests unitaires ===
# Tous les tests
pnpm exec vitest run

# Tests Knowledge Edit seulement
pnpm exec vitest run --testPathPattern="knowledge"

# Tests API Keys seulement
pnpm exec vitest run --testPathPattern="(encryption|api-key|engine-config)"

# Tests avec couverture
pnpm exec vitest run --coverage

# Tests en mode watch (developpement)
pnpm exec vitest --watch

# Un seul fichier
pnpm exec vitest run apps/web/src/lib/ai-engine/security/encryption.test.ts

# === Tests E2E ===
# Tous les E2E
pnpm exec playwright test

# Knowledge Edit E2E seulement
pnpm exec playwright test e2e/content-studio-v2/ai-engine-knowledge-edit.spec.ts

# API Keys E2E seulement
pnpm exec playwright test e2e/content-studio-v2/ai-engine-api-keys.spec.ts

# E2E avec trace (debug)
pnpm exec playwright test --trace on

# E2E en mode headed (voir le navigateur)
pnpm exec playwright test --headed

# E2E avec rapport HTML
pnpm exec playwright test --reporter=html
pnpm exec playwright show-report

# === Regression rapide ===
pnpm exec vitest run --testPathPattern="ai-engine" && pnpm exec playwright test e2e/content-studio-v2/

# === Batterie complete ===
pnpm exec vitest run && pnpm exec playwright test
```
