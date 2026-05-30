# Runbook - Integration Higgsfield AI Provider

**Date:** 2026-05-27
**Environnement cible:** FemiGlow Staging (`/var/www/femiglow-staging`)
**Duree estimee:** 7-9 heures
**Prerequis branch:** `feat/ai-engine-langgraph-mvp`

---

## 0. Prerequis

### 0.1 Verification de l'environnement

```bash
# Node.js >= 20
node --version
# Expected: v20.x.x or v22.x.x

# pnpm >= 9
pnpm --version
# Expected: 9.x.x

# Verifier le repertoire de travail
cd /var/www/femiglow-staging
pwd
# Expected: /var/www/femiglow-staging

# Verifier que le build actuel est propre
cd apps/web && pnpm tsc --noEmit 2>&1 | tail -5
# Expected: no output (clean)

# Verifier la base de donnees (optionnel, pour les tests de contrat)
pnpm drizzle-kit check 2>&1 | tail -3
# Expected: No schema changes
```

### 0.2 Creer la branche d'integration

```bash
cd /var/www/femiglow-staging

# S'assurer qu'on est sur la bonne branche source
git checkout feat/ai-engine-langgraph-mvp
git pull origin feat/ai-engine-langgraph-mvp

# Creer la branche d'integration
git checkout -b feat/higgsfield-provider

# Confirmer
git branch --show-current
# Expected: feat/higgsfield-provider
```

### 0.3 Backup rapide

```bash
# Sauvegarder l'etat actuel des fichiers qui seront modifies
mkdir -p /tmp/higgsfield-backup
cp apps/web/src/lib/ai-engine/providers/types.ts /tmp/higgsfield-backup/
cp apps/web/src/lib/env.ts /tmp/higgsfield-backup/
cp apps/web/src/lib/ai-engine/config/engine-config.ts /tmp/higgsfield-backup/
cp apps/web/src/lib/ai-engine/services/api-key-manager.ts /tmp/higgsfield-backup/
cp apps/web/src/lib/ai-engine/services/api-key-validator.ts /tmp/higgsfield-backup/
cp apps/web/src/lib/ai-engine/services/model-discovery.ts /tmp/higgsfield-backup/
cp apps/web/src/lib/ai-engine/providers/selector.ts /tmp/higgsfield-backup/
cp apps/web/src/app/api/admin/ai-engine/config/providers/route.ts /tmp/higgsfield-backup/providers-route.ts
cp apps/web/src/app/api/admin/ai-engine/config/providers/models/route.ts /tmp/higgsfield-backup/models-route.ts
cp apps/web/src/lib/ai-engine/nodes/generate-images.ts /tmp/higgsfield-backup/
cp apps/web/src/lib/ai-engine/nodes/generate-video.ts /tmp/higgsfield-backup/
cp apps/web/src/test/msw/ai-engine-handlers.ts /tmp/higgsfield-backup/

echo "Backup complete: $(ls /tmp/higgsfield-backup/ | wc -l) files"
```

---

## Phase 1 : Type System & Configuration

### 1.1 Modifier `types.ts`

```bash
cd /var/www/femiglow-staging/apps/web

# Ajouter 'higgsfield' au ProviderType enum
# Fichier: src/lib/ai-engine/providers/types.ts
# Ligne 19-27: ajouter 'higgsfield' comme dernier element de z.enum

# Verifier le changement
grep -n "higgsfield" src/lib/ai-engine/providers/types.ts
# Expected: ligne dans le z.enum ProviderType
```

### 1.2 Modifier `env.ts`

```bash
# Fichier: src/lib/env.ts
# 1. Ajouter AI_ENGINE_HIGGSFIELD_API_KEY: z.string().optional() au schema
#    (apres AI_ENGINE_OLLAMA_BASE_URL, ~ligne 138)
# 2. Ajouter 'higgsfield' dans les enums image/video provider
# 3. Ajouter AI_ENGINE_HIGGSFIELD_API_KEY: process.env.AI_ENGINE_HIGGSFIELD_API_KEY au parse()

# Verifier
grep -n "higgsfield\|HIGGSFIELD" src/lib/env.ts
# Expected: 3 occurrences (schema, image enum, video enum, parse)
```

### 1.3 Modifier `engine-config.ts`

```bash
# Fichier: src/lib/ai-engine/config/engine-config.ts
# 1. Ajouter 'higgsfield' aux types image et video dans l'interface EngineConfig
# 2. Ajouter higgsfield?: string dans apiKeys
# 3. Ajouter la resolution dans getEngineConfig()

# Verifier
grep -n "higgsfield" src/lib/ai-engine/config/engine-config.ts
# Expected: 3-4 occurrences
```

### 1.4 Verification Phase 1

```bash
cd /var/www/femiglow-staging/apps/web

# Build check TypeScript
pnpm tsc --noEmit 2>&1 | head -20
# Expected: no errors

# Si des erreurs apparaissent, les corriger avant de continuer
# Erreurs courantes:
# - Type mismatch: verifier que les unions de type sont correctes
# - Import manquant: ne devrait pas arriver dans cette phase

echo "=== Phase 1 PASS ==="
```

### 1.5 Commit Phase 1

```bash
cd /var/www/femiglow-staging
git add apps/web/src/lib/ai-engine/providers/types.ts \
        apps/web/src/lib/env.ts \
        apps/web/src/lib/ai-engine/config/engine-config.ts

git commit -m "feat(ai-engine): add higgsfield to type system and configuration

- Add 'higgsfield' to ProviderType enum (types.ts)
- Add AI_ENGINE_HIGGSFIELD_API_KEY env var (env.ts)
- Add 'higgsfield' to image/video provider enums (env.ts, engine-config.ts)
- Add higgsfield to apiKeys in EngineConfig"
```

---

## Phase 2 : API Key Management

### 2.1 Modifier `api-key-manager.ts`

```bash
# Fichier: src/lib/ai-engine/services/api-key-manager.ts
# 1. PROVIDER_NAMES: ajouter higgsfield: 'Higgsfield AI'
# 2. ENV_KEY_MAP: ajouter higgsfield: ['AI_ENGINE_HIGGSFIELD_API_KEY']
# 3. providers array dans listApiKeys(): ajouter 'higgsfield'

grep -n "higgsfield\|Higgsfield" src/lib/ai-engine/services/api-key-manager.ts
# Expected: 3 occurrences
```

### 2.2 Modifier `api-key-validator.ts`

```bash
# Fichier: src/lib/ai-engine/services/api-key-validator.ts
# 1. Ajouter case 'higgsfield' dans le switch
# 2. Implementer testHiggsfield() function

grep -n "higgsfield\|Higgsfield" src/lib/ai-engine/services/api-key-validator.ts
# Expected: 2+ occurrences (case + function)
```

### 2.3 Verification Phase 2

```bash
cd /var/www/femiglow-staging/apps/web

# TypeScript check
pnpm tsc --noEmit 2>&1 | head -20
# Expected: no errors

# Run existing api-key tests to check for regressions
pnpm vitest run src/lib/ai-engine/services/ --reporter=verbose 2>&1 | tail -20
# Expected: all existing tests pass

echo "=== Phase 2 PASS ==="
```

### 2.4 Commit Phase 2

```bash
cd /var/www/femiglow-staging
git add apps/web/src/lib/ai-engine/services/api-key-manager.ts \
        apps/web/src/lib/ai-engine/services/api-key-validator.ts

git commit -m "feat(ai-engine): add Higgsfield to API key management

- Add PROVIDER_NAMES and ENV_KEY_MAP entries for higgsfield
- Add higgsfield to listApiKeys() provider list
- Implement testHiggsfield() validator (GET /v1/models with Bearer auth)"
```

---

## Phase 3 : Model Discovery

### 3.1 Modifier `model-discovery.ts`

```bash
# Fichier: src/lib/ai-engine/services/model-discovery.ts
# 1. Ajouter 'higgsfield' a DiscoverableProvider type
# 2. Ajouter 'video' a ModelEntry.role
# 3. Ajouter FALLBACK_MODELS.higgsfield
# 4. Ajouter fetchHiggsfield() function
# 5. Ajouter case 'higgsfield' dans callFetcher()

grep -n "higgsfield\|Higgsfield" src/lib/ai-engine/services/model-discovery.ts
# Expected: 5+ occurrences
```

### 3.2 Verification Phase 3

```bash
cd /var/www/femiglow-staging/apps/web

# TypeScript check
pnpm tsc --noEmit 2>&1 | head -20
# Expected: no errors

# Run model-discovery tests
pnpm vitest run src/lib/ai-engine/services/ --reporter=verbose 2>&1 | tail -20
# Expected: all pass

# Quick verification of FALLBACK_MODELS
pnpm tsx -e "
  const { FALLBACK_MODELS } = require('./src/lib/ai-engine/services/model-discovery');
  const hf = FALLBACK_MODELS.higgsfield;
  console.log('Higgsfield fallback models:', hf?.length ?? 'MISSING');
  console.log('Has image:', hf?.some(m => m.role === 'image'));
  console.log('Has video:', hf?.some(m => m.role === 'video'));
" 2>&1
# Expected:
# Higgsfield fallback models: 4
# Has image: true
# Has video: true

echo "=== Phase 3 PASS ==="
```

### 3.3 Commit Phase 3

```bash
cd /var/www/femiglow-staging
git add apps/web/src/lib/ai-engine/services/model-discovery.ts

git commit -m "feat(ai-engine): add Higgsfield model discovery

- Add 'higgsfield' to DiscoverableProvider type
- Add 'video' to ModelEntry role type
- Add 4 fallback models (2 image + 2 video)
- Implement fetchHiggsfield() live fetcher
- Wire callFetcher() for higgsfield provider"
```

---

## Phase 4 : Adapter Implementation

### 4.1 Creer `higgsfield.ts`

```bash
# Creer le fichier adapter
# Fichier: src/lib/ai-engine/providers/adapters/higgsfield.ts

# Verifier que le fichier est bien cree
ls -la src/lib/ai-engine/providers/adapters/higgsfield.ts
# Expected: fichier present

# Verifier l'export
grep "export class HiggsFieldAdapter" src/lib/ai-engine/providers/adapters/higgsfield.ts
# Expected: export class HiggsFieldAdapter extends ProviderAdapter
```

### 4.2 Verification Phase 4

```bash
cd /var/www/femiglow-staging/apps/web

# TypeScript check
pnpm tsc --noEmit 2>&1 | head -20
# Expected: no errors

# Verifier que l'adapter peut etre importe
pnpm tsx -e "
  const { HiggsFieldAdapter } = require('./src/lib/ai-engine/providers/adapters/higgsfield');
  console.log('HiggsFieldAdapter:', typeof HiggsFieldAdapter === 'function' ? 'OK' : 'FAIL');
  const adapter = new HiggsFieldAdapter({
    id: 'test',
    type: 'higgsfield',
    name: 'Test',
    apiKeyEnvVar: 'TEST',
    capabilities: ['image', 'video'],
    models: [],
    rateLimitRpm: 60,
    dailyBudgetCents: 100,
    circuitBreaker: { failureThreshold: 5, resetTimeoutMs: 60000, halfOpenMaxCalls: 1 },
    priority: 15,
    isFallback: false,
    isEnabled: true,
    healthStatus: 'healthy',
  });
  console.log('Capabilities:', adapter.capabilities.join(', '));
  console.log('Name:', adapter.name);
" 2>&1
# Expected:
# HiggsFieldAdapter: OK
# Capabilities: image, video
# Name: Test

# Verify NotImplementedError on text/embedding
pnpm tsx -e "
  const { HiggsFieldAdapter } = require('./src/lib/ai-engine/providers/adapters/higgsfield');
  const adapter = new HiggsFieldAdapter({
    id: 'test', type: 'higgsfield', name: 'Test', apiKeyEnvVar: 'TEST',
    capabilities: ['image', 'video'], models: [], rateLimitRpm: 60,
    dailyBudgetCents: 100, priority: 15, isFallback: false, isEnabled: true,
    healthStatus: 'healthy',
    circuitBreaker: { failureThreshold: 5, resetTimeoutMs: 60000, halfOpenMaxCalls: 1 },
  });
  adapter.generateText({ model: 'x', messages: [] }).catch(e => console.log('generateText:', e.name));
  adapter.generateEmbedding({ model: 'x', input: 'y' }).catch(e => console.log('generateEmbedding:', e.name));
" 2>&1
# Expected:
# generateText: NotImplementedError
# generateEmbedding: NotImplementedError

echo "=== Phase 4 PASS ==="
```

### 4.3 Commit Phase 4

```bash
cd /var/www/femiglow-staging
git add apps/web/src/lib/ai-engine/providers/adapters/higgsfield.ts

git commit -m "feat(ai-engine): implement HiggsFieldAdapter for image + video

- Extend ProviderAdapter with generateImage() and generateVideo()
- Image: POST /v1/images/generate with Bearer auth
- Video: async job submission + polling (max 6 min timeout)
- Circuit breaker + retry policy wrapping all API calls
- Cost tracking via ModelConfig.costPerUnit
- NotImplementedError for text and embedding"
```

---

## Phase 5 : Provider Registration & Routing

### 5.1 Modifier `selector.ts`

```bash
# Fichier: src/lib/ai-engine/providers/selector.ts
# 1. Ajouter import HiggsFieldAdapter
# 2. Ajouter case 'higgsfield' dans createAdapter()

grep -n "higgsfield\|HiggsField" src/lib/ai-engine/providers/selector.ts
# Expected: 2 occurrences (import + case)
```

### 5.2 Modifier `providers/route.ts`

```bash
# Fichier: src/app/api/admin/ai-engine/config/providers/route.ts
# 1. Ajouter l'entree Higgsfield dans getDefaultProviders()
# 2. Ajouter AI_ENGINE_HIGGSFIELD_API_KEY dans envKeyMap

grep -n "higgsfield\|Higgsfield\|HIGGSFIELD" src/app/api/admin/ai-engine/config/providers/route.ts
# Expected: 5+ occurrences
```

### 5.3 Modifier `providers/models/route.ts`

```bash
# Fichier: src/app/api/admin/ai-engine/config/providers/models/route.ts
# 1. Ajouter 'higgsfield' a VALID_PROVIDERS
# 2. Ajouter mapping PROVIDER_TO_DISCOVERY
# 3. Ajouter POPULAR_MODELS

grep -n "higgsfield\|Higgsfield" src/app/api/admin/ai-engine/config/providers/models/route.ts
# Expected: 3+ occurrences
```

### 5.4 Verification Phase 5

```bash
cd /var/www/femiglow-staging/apps/web

# TypeScript check
pnpm tsc --noEmit 2>&1 | head -20
# Expected: no errors

# Verify selector creates the right adapter
pnpm tsx -e "
  const { ProviderSelector } = require('./src/lib/ai-engine/providers/selector');
  const config = {
    id: 'test-hf', type: 'higgsfield', name: 'Higgsfield AI',
    apiKeyEnvVar: 'AI_ENGINE_HIGGSFIELD_API_KEY',
    capabilities: ['image', 'video'], models: [],
    rateLimitRpm: 60, dailyBudgetCents: 100,
    circuitBreaker: { failureThreshold: 5, resetTimeoutMs: 60000, halfOpenMaxCalls: 1 },
    priority: 15, isFallback: false, isEnabled: true, healthStatus: 'healthy',
  };
  const selector = new ProviderSelector([config]);
  const adapter = selector.selectProvider('test', 'image');
  console.log('Adapter type:', adapter.constructor.name);
  console.log('Provider name:', adapter.name);
" 2>&1
# Expected:
# Adapter type: HiggsFieldAdapter
# Provider name: Higgsfield AI

echo "=== Phase 5 PASS ==="
```

### 5.5 Commit Phase 5

```bash
cd /var/www/femiglow-staging
git add apps/web/src/lib/ai-engine/providers/selector.ts \
        apps/web/src/app/api/admin/ai-engine/config/providers/route.ts \
        apps/web/src/app/api/admin/ai-engine/config/providers/models/route.ts

git commit -m "feat(ai-engine): register Higgsfield in selector and API routes

- Add HiggsFieldAdapter to createAdapter() switch (selector.ts)
- Add default-higgsfield provider config (providers/route.ts)
- Add higgsfield to VALID_PROVIDERS, PROVIDER_TO_DISCOVERY, POPULAR_MODELS (models/route.ts)
- Higgsfield appears in config UI automatically (provider-agnostic frontend)"
```

---

## Phase 6 : Node Integration

### 6.1 Modifier `generate-images.ts`

```bash
# Fichier: src/lib/ai-engine/nodes/generate-images.ts
# Refactoriser pour utiliser ProviderSelector au lieu d'appel direct OpenAI
# Conserver le fallback mock et la gestion d'erreur

grep -n "ProviderSelector\|selectProvider" src/lib/ai-engine/nodes/generate-images.ts
# Expected: 2+ occurrences apres modification
```

### 6.2 Modifier `generate-video.ts`

```bash
# Fichier: src/lib/ai-engine/nodes/generate-video.ts
# Remplacer le placeholder "not yet implemented" par un appel via ProviderSelector

grep -n "ProviderSelector\|selectProvider\|not yet implemented" src/lib/ai-engine/nodes/generate-video.ts
# Expected: ProviderSelector present, "not yet implemented" supprime
```

### 6.3 Verification Phase 6

```bash
cd /var/www/femiglow-staging/apps/web

# TypeScript check
pnpm tsc --noEmit 2>&1 | head -20
# Expected: no errors

# Run node tests
pnpm vitest run src/lib/ai-engine/nodes/ --reporter=verbose 2>&1 | tail -30
# Expected: all pass (generate-images.test.ts, generate-video.test.ts)

# Verify mock path still works
pnpm tsx -e "
  process.env.AI_ENGINE_ENABLED = 'false';
  process.env.AI_ENGINE_DEFAULT_IMAGE_PROVIDER = 'mock';
  process.env.AI_ENGINE_DEFAULT_VIDEO_PROVIDER = 'mock';
  const { generateImagesNode } = require('./src/lib/ai-engine/nodes/generate-images');
  generateImagesNode({
    jobId: 'test-001',
    platform: 'instagram',
    format: 'post',
    script: null,
    brandGuidelines: 'FemiGlow',
  }).then(result => {
    console.log('Images count:', result.images?.length);
    console.log('Provider:', result.images?.[0]?.provider);
    console.log('Cost:', result.costTracking?.totalCents);
  }).catch(e => console.error('ERROR:', e.message));
" 2>&1
# Expected:
# Images count: 1
# Provider: mock
# Cost: 0

echo "=== Phase 6 PASS ==="
```

### 6.4 Commit Phase 6

```bash
cd /var/www/femiglow-staging
git add apps/web/src/lib/ai-engine/nodes/generate-images.ts \
        apps/web/src/lib/ai-engine/nodes/generate-video.ts

# Also add provider-config-builder.ts if created
# git add apps/web/src/lib/ai-engine/config/provider-config-builder.ts

git commit -m "feat(ai-engine): refactor image/video nodes to use ProviderSelector

- generate-images: replace direct OpenAI call with ProviderSelector pattern
- generate-video: replace 'not yet implemented' placeholder with ProviderSelector
- Both nodes: Higgsfield selected when configured as default image/video provider
- Mock path preserved for development/testing
- Fallback to mock on any provider failure"
```

---

## Phase 7 : Tests & Verification

### 7.1 Ajouter les MSW handlers

```bash
# Fichier: src/test/msw/ai-engine-handlers.ts
# Ajouter mock data et handlers pour Higgsfield

grep -n "higgsfield\|Higgsfield\|HIGGSFIELD" src/test/msw/ai-engine-handlers.ts
# Expected: 10+ occurrences
```

### 7.2 Creer les tests unitaires adapter

```bash
# Creer: src/lib/ai-engine/providers/adapters/__tests__/higgsfield.test.ts

# Run
pnpm vitest run src/lib/ai-engine/providers/adapters/__tests__/higgsfield.test.ts --reporter=verbose 2>&1
# Expected: all pass (12+ tests)
```

### 7.3 Creer les tests unitaires validator + discovery

```bash
# Creer: src/lib/ai-engine/services/__tests__/api-key-validator-higgsfield.test.ts
# Creer: src/lib/ai-engine/services/__tests__/model-discovery-higgsfield.test.ts

# Run
pnpm vitest run src/lib/ai-engine/services/__tests__/ --reporter=verbose 2>&1
# Expected: all pass
```

### 7.4 Creer les tests de contrat

```bash
# Creer: src/test/api-contracts/ai-engine-higgsfield.contract.test.ts

# Run
pnpm vitest run src/test/api-contracts/ai-engine-higgsfield.contract.test.ts --reporter=verbose 2>&1
# Expected: all pass (6+ tests)
```

### 7.5 Creer les tests E2E

```bash
# Creer: e2e/content-studio-v2/ai-engine-higgsfield.spec.ts

# Run (requires dev server or playwright test runner)
pnpm playwright test e2e/content-studio-v2/ai-engine-higgsfield.spec.ts --reporter=list 2>&1
# Expected: all pass (6+ tests)
```

### 7.6 Verification finale globale

```bash
cd /var/www/femiglow-staging/apps/web

echo "========================================="
echo "  VERIFICATION FINALE - HIGGSFIELD"
echo "========================================="

# 1. TypeScript compilation
echo -e "\n--- TypeScript Check ---"
pnpm tsc --noEmit 2>&1 | tail -5
# Expected: no output (clean)

# 2. Full test suite
echo -e "\n--- Unit Tests ---"
pnpm vitest run --reporter=verbose 2>&1 | tail -20
# Expected: Tests: X passed, 0 failed

# 3. Build
echo -e "\n--- Next.js Build ---"
pnpm build 2>&1 | tail -10
# Expected: Compiled successfully

# 4. E2E tests (si le serveur de dev tourne)
echo -e "\n--- E2E Tests ---"
pnpm playwright test e2e/content-studio-v2/ai-engine-higgsfield.spec.ts --reporter=list 2>&1 | tail -10
# Expected: X passed, 0 failed

echo -e "\n========================================="
echo "  VERIFICATION COMPLETE"
echo "========================================="
```

### 7.7 Commit Phase 7

```bash
cd /var/www/femiglow-staging

git add apps/web/src/test/msw/ai-engine-handlers.ts
git add apps/web/src/lib/ai-engine/providers/adapters/__tests__/higgsfield.test.ts
git add apps/web/src/lib/ai-engine/services/__tests__/api-key-validator-higgsfield.test.ts
git add apps/web/src/lib/ai-engine/services/__tests__/model-discovery-higgsfield.test.ts
git add apps/web/src/test/api-contracts/ai-engine-higgsfield.contract.test.ts
git add apps/web/e2e/content-studio-v2/ai-engine-higgsfield.spec.ts

git commit -m "test(ai-engine): comprehensive Higgsfield integration test suite

- MSW handlers for Higgsfield API (image gen, video gen, model discovery)
- Unit tests: adapter (12), validator (5), discovery (5)
- Contract tests: providers route, models route, api-keys route (6)
- E2E tests: config UI, model selector, key management (6)
- All tests pass, 0 regressions"
```

---

## Mise a jour `.env.example`

```bash
cd /var/www/femiglow-staging/apps/web

# Ajouter la variable d'environnement dans .env.example
# Apres AI_ENGINE_OLLAMA_BASE_URL=
# Ajouter:
# AI_ENGINE_HIGGSFIELD_API_KEY=

grep "HIGGSFIELD" .env.example
# Expected: AI_ENGINE_HIGGSFIELD_API_KEY=

git add .env.example
git commit -m "docs: add AI_ENGINE_HIGGSFIELD_API_KEY to .env.example"
```

---

## Procedure de correction (en cas d'echec)

### Boucle de correction standard

A chaque phase, si la verification echoue :

```
1. IDENTIFIER l'erreur
   - Lire le message d'erreur complet
   - Identifier le fichier et la ligne

2. DIAGNOSTIQUER
   - TypeScript error: verifier les types, imports, enums
   - Test failure: verifier le mock, le setup, le expected
   - Build error: verifier les imports cycliques, les exports

3. CORRIGER
   - Modifier le fichier concerne
   - Ne PAS toucher aux fichiers des phases suivantes

4. RE-VERIFIER
   - Relancer la commande de verification de la phase
   - Si OK: continuer
   - Si KO: repeter a l'etape 1

5. ABANDON (apres 3 tentatives)
   - Revert la phase entiere
   - Analyser le probleme plus en profondeur
   - Consulter l'audit pour clarification
```

### Erreurs courantes et solutions

| Erreur | Cause probable | Solution |
|--------|---------------|----------|
| `Type '"higgsfield"' is not assignable` | Enum pas mis a jour partout | Verifier types.ts, env.ts, engine-config.ts |
| `Cannot find module './adapters/higgsfield'` | Fichier non cree ou mauvais chemin | `ls src/lib/ai-engine/providers/adapters/` |
| `Property 'higgsfield' does not exist on type` | Interface pas mise a jour | Verifier EngineConfig.apiKeys |
| `No provider available for capability "image"` | ProviderConfig mal construit | Verifier buildProviderConfigs() |
| `Circuit breaker is open` | Trop d'echecs dans les tests | `circuitBreaker.reset()` ou nouveau adapter |
| `FALLBACK_MODELS.higgsfield is undefined` | Pas ajoute dans model-discovery.ts | Ajouter l'entree dans FALLBACK_MODELS |
| Test timeout (>5s) | Polling dans les tests | S'assurer que MSW intercepte les polls |

---

## Procedure de rollback complet

Si l'integration doit etre annulee apres avoir commence :

```bash
cd /var/www/femiglow-staging

# Option A: Revert tous les commits de la branche
git log --oneline feat/ai-engine-langgraph-mvp..HEAD
# Copier le nombre de commits

git reset --soft feat/ai-engine-langgraph-mvp
git checkout -- .
git clean -fd

# Option B: Restaurer depuis le backup
cp /tmp/higgsfield-backup/types.ts apps/web/src/lib/ai-engine/providers/types.ts
cp /tmp/higgsfield-backup/env.ts apps/web/src/lib/env.ts
cp /tmp/higgsfield-backup/engine-config.ts apps/web/src/lib/ai-engine/config/engine-config.ts
cp /tmp/higgsfield-backup/api-key-manager.ts apps/web/src/lib/ai-engine/services/api-key-manager.ts
cp /tmp/higgsfield-backup/api-key-validator.ts apps/web/src/lib/ai-engine/services/api-key-validator.ts
cp /tmp/higgsfield-backup/model-discovery.ts apps/web/src/lib/ai-engine/services/model-discovery.ts
cp /tmp/higgsfield-backup/selector.ts apps/web/src/lib/ai-engine/providers/selector.ts
cp /tmp/higgsfield-backup/providers-route.ts apps/web/src/app/api/admin/ai-engine/config/providers/route.ts
cp /tmp/higgsfield-backup/models-route.ts apps/web/src/app/api/admin/ai-engine/config/providers/models/route.ts
cp /tmp/higgsfield-backup/generate-images.ts apps/web/src/lib/ai-engine/nodes/generate-images.ts
cp /tmp/higgsfield-backup/generate-video.ts apps/web/src/lib/ai-engine/nodes/generate-video.ts
cp /tmp/higgsfield-backup/ai-engine-handlers.ts apps/web/src/test/msw/ai-engine-handlers.ts

# Supprimer le nouveau fichier
rm -f apps/web/src/lib/ai-engine/providers/adapters/higgsfield.ts
rm -f apps/web/src/lib/ai-engine/providers/adapters/__tests__/higgsfield.test.ts
rm -f apps/web/src/lib/ai-engine/services/__tests__/api-key-validator-higgsfield.test.ts
rm -f apps/web/src/lib/ai-engine/services/__tests__/model-discovery-higgsfield.test.ts
rm -f apps/web/src/test/api-contracts/ai-engine-higgsfield.contract.test.ts
rm -f apps/web/e2e/content-studio-v2/ai-engine-higgsfield.spec.ts

# Option C: Supprimer la branche
git checkout feat/ai-engine-langgraph-mvp
git branch -D feat/higgsfield-provider

# Verifier
cd apps/web && pnpm tsc --noEmit && pnpm vitest run
# Expected: clean build, all tests pass
```

---

## Post-integration : Deploiement staging

```bash
# 1. Push la branche
git push origin feat/higgsfield-provider

# 2. Creer une PR vers feat/ai-engine-langgraph-mvp
gh pr create \
  --title "feat: integrate Higgsfield AI as image/video provider" \
  --base feat/ai-engine-langgraph-mvp \
  --body "## Summary
- Add Higgsfield AI as primary image/video provider (priority 15)
- New adapter with image gen + async video gen (polling)
- Refactor generate-images/generate-video nodes to use ProviderSelector
- Full test suite: unit, contract, E2E

## Test plan
- [ ] TypeScript compilation: 0 errors
- [ ] Unit tests: all pass
- [ ] Contract tests: all pass
- [ ] E2E tests: all pass
- [ ] Build: success
- [ ] Manual: Higgsfield visible in config UI"

# 3. Configurer la cle API sur staging
# ssh staging
# echo 'AI_ENGINE_HIGGSFIELD_API_KEY=hf_sk_...' >> /var/www/femiglow-staging/apps/web/.env

# 4. Restart le serveur staging
# pm2 restart femiglow-web

# 5. Verifier manuellement
# - Ouvrir https://staging.femiglow-maroc.com/admin/content-studio-v2/ai-engine/config
# - Verifier que la carte Higgsfield est visible
# - Verifier que les modeles sont dans le selecteur
# - Tester une generation image avec Higgsfield
```
