# Runbook d'execution -- Knowledge Edit

**Feature** : AI Engine / Knowledge Base / UPDATE  
**Branche** : `feat/knowledge-edit`  
**Prerequis** : Node.js 20+, PostgreSQL 15+ avec pgvector, pnpm 9+

---

## 1. Prerequisites et verification de l'environnement

### 1.1 Verification de l'environnement

```bash
# Verifier Node.js (>= 20.x requis)
node --version
# Attendu : v20.x.x ou superieur

# Verifier pnpm
pnpm --version
# Attendu : 9.x.x

# Verifier PostgreSQL
psql --version
# Attendu : psql (PostgreSQL) 15.x ou superieur

# Verifier que les variables d'environnement sont configurees
cd /var/www/femiglow-staging/apps/web
cat .env.local | grep -E "DATABASE_URL|OPENAI_API_KEY" | sed 's/=.*/=***/'
# Attendu :
# DATABASE_URL=***
# OPENAI_API_KEY=***
```

### 1.2 Verification de l'etat initial

```bash
cd /var/www/femiglow-staging

# Verifier la branche
git branch --show-current
# Attendu : feat/knowledge-edit (ou master si nouvelle branche a creer)

# Etat propre du working tree
git status
# Attendu : nothing to commit, working tree clean

# Installer les dependances
pnpm install

# Verification TypeScript (etat initial propre)
cd apps/web
npx tsc --noEmit
echo "Exit code: $?"
# Attendu : Exit code: 0

# Verification des tests existants
npx vitest run --reporter=dot 2>&1 | tail -5
# Attendu : Tests ... passed ... (0 failed)

# Verification de la connexion DB
npx drizzle-kit studio
# Si l'interface Drizzle Studio s'ouvre -> DB accessible
# Ctrl+C pour fermer
```

### 1.3 Creation de la branche (si necessaire)

```bash
cd /var/www/femiglow-staging
git checkout master
git pull origin master
git checkout -b feat/knowledge-edit
```

---

## 2. Phase 1 : Schema et migration DB

### 2.1 Modifier le schema Drizzle

**Fichier** : `apps/web/src/lib/db/schema-ai-engine.ts`

Ajouter `updatedAt` dans les deux tables knowledge :

```bash
cd /var/www/femiglow-staging/apps/web

# Verifier le fichier actuel
grep -n "updatedAt" src/lib/db/schema-ai-engine.ts
# Si aucun resultat -> le champ n'existe pas encore, on peut continuer
```

Ajouter dans `aiEngineKnowledgeCollections` (apres `createdAt`) :
```typescript
updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
```

Ajouter dans `aiEngineKnowledgeDocuments` (apres `createdAt`) :
```typescript
updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
```

### 2.2 Generer et appliquer la migration

```bash
cd /var/www/femiglow-staging/apps/web

# Generer la migration
npx drizzle-kit generate:pg
# Verifier le fichier genere dans drizzle/migrations/

# Appliquer la migration
npx drizzle-kit push:pg

# Initialiser les valeurs existantes
psql "$DATABASE_URL" -c "
  UPDATE ai_engine_knowledge_collection SET updated_at = created_at WHERE updated_at = NOW();
  UPDATE ai_engine_knowledge_document SET updated_at = created_at WHERE updated_at = NOW();
"
```

### 2.3 Gate de verification -- Phase 1

```bash
cd /var/www/femiglow-staging/apps/web

# TypeScript compile
npx tsc --noEmit
echo "TSC: $?"
# Attendu : 0

# Verifier que la colonne existe
psql "$DATABASE_URL" -c "
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_name = 'ai_engine_knowledge_collection'
    AND column_name = 'updated_at';
"
# Attendu : 1 row (updated_at | timestamp with time zone)

# Les tests existants passent encore
npx vitest run --reporter=dot 2>&1 | tail -5
# Attendu : 0 failed
```

---

## 3. Phase 2 : Service Layer

### 3.1 Implementer updateCollection et getDocumentById

**Fichier** : `apps/web/src/lib/ai-engine/knowledge/collections.ts`

```bash
# Verifier les fonctions existantes
grep -n "export async function" src/lib/ai-engine/knowledge/collections.ts
# Liste des fonctions existantes

# Verifier l'interface CollectionRow
grep -A 15 "export interface CollectionRow" src/lib/ai-engine/knowledge/collections.ts
```

Implementer dans l'ordre :
1. Ajouter `updatedAt: Date` a l'interface `CollectionRow`
2. Mettre a jour `mapRow()` pour inclure `updatedAt`
3. Ajouter l'interface `UpdateCollectionData`
4. Implementer `updateCollection()`
5. Ajouter l'interface `DocumentDetail`
6. Implementer `getDocumentById()`

### 3.2 Implementer updateDocument

**Fichier** : `apps/web/src/lib/ai-engine/knowledge/ingestion.ts`

```bash
# Verifier les fonctions existantes
grep -n "export async function" src/lib/ai-engine/knowledge/ingestion.ts
```

Implementer :
1. Ajouter les interfaces `UpdateDocumentData` et `UpdateDocumentResult`
2. Implementer `updateDocument()` (cf. service-layer.md section 3.6)

### 3.3 Gate de verification -- Phase 2

```bash
cd /var/www/femiglow-staging/apps/web

# TypeScript compile
npx tsc --noEmit
echo "TSC: $?"
# Attendu : 0

# Les tests existants passent
npx vitest run src/lib/ai-engine/knowledge/ --reporter=dot 2>&1 | tail -5
# NOTE : Les tests existants peuvent echouer a cause de updatedAt manquant dans les mocks
# Si c'est le cas, ajouter updatedAt dans les mocks existants
```

---

## 4. Phase 3 : API Routes

### 4.1 Ajouter le PATCH sur la route collection

**Fichier** : `apps/web/src/app/api/admin/ai-engine/knowledge/[slug]/route.ts`

```bash
# Verifier les handlers existants
grep -n "export async function" src/app/api/admin/ai-engine/knowledge/\[slug\]/route.ts
# Attendu : DELETE (existant)
```

Ajouter le handler `PATCH` (cf. api-routes.md section 2.7).

### 4.2 Ajouter le GET et PATCH sur la route document

**Fichier** : `apps/web/src/app/api/admin/ai-engine/knowledge/[slug]/documents/[docId]/route.ts`

```bash
# Verifier les handlers existants
grep -n "export async function" src/app/api/admin/ai-engine/knowledge/\[slug\]/documents/\[docId\]/route.ts
# Attendu : DELETE (existant)
```

Ajouter les handlers `GET` et `PATCH` (cf. api-routes.md sections 3.6 et 4.7).
Ajouter `export const maxDuration = 120;` au debut du fichier.

### 4.3 Mettre a jour le barrel index

**Fichier** : `apps/web/src/lib/ai-engine/knowledge/index.ts`

```bash
# Verifier les exports existants
grep "export" src/lib/ai-engine/knowledge/index.ts
```

Ajouter les nouveaux exports (cf. architecture-backend.md section 8).

### 4.4 Gate de verification -- Phase 3

```bash
cd /var/www/femiglow-staging/apps/web

# TypeScript compile
npx tsc --noEmit
echo "TSC: $?"
# Attendu : 0

# Demarrer le serveur de dev
npm run dev &
DEV_PID=$!
sleep 10

# Test PATCH collection (200)
curl -s -o /dev/null -w "%{http_code}" \
  -X PATCH http://localhost:3000/api/admin/ai-engine/knowledge/brand-femiglow \
  -H "Content-Type: application/json" \
  -H "Cookie: session=$(cat .session-cookie 2>/dev/null || echo 'test')" \
  -d '{"name": "Test Knowledge Edit"}'
# Attendu : 200 (ou 401 si pas de session)
echo ""

# Test PATCH collection sans champ (400)
curl -s -o /dev/null -w "%{http_code}" \
  -X PATCH http://localhost:3000/api/admin/ai-engine/knowledge/brand-femiglow \
  -H "Content-Type: application/json" \
  -H "Cookie: session=test" \
  -d '{}'
# Attendu : 400
echo ""

# Test collection inexistante (404)
curl -s -o /dev/null -w "%{http_code}" \
  -X PATCH http://localhost:3000/api/admin/ai-engine/knowledge/slug-inexistant \
  -H "Content-Type: application/json" \
  -H "Cookie: session=test" \
  -d '{"name": "Test"}'
# Attendu : 404 (ou 401)
echo ""

# Test GET document
curl -s -o /dev/null -w "%{http_code}" \
  http://localhost:3000/api/admin/ai-engine/knowledge/brand-femiglow/documents/doc-001 \
  -H "Cookie: session=test"
# Attendu : 200 ou 404 (selon les donnees en base)
echo ""

# Arreter le serveur de dev
kill $DEV_PID 2>/dev/null
```

---

## 5. Phase 4 : MSW Handlers

### 5.1 Creer le fichier de handlers

```bash
cd /var/www/femiglow-staging/apps/web

# Verifier le dossier MSW existant
ls src/test/msw/handlers/
# Attendu : liste des handlers existants

# Creer le fichier
touch src/test/msw/handlers/ai-engine-knowledge-edit.handlers.ts
```

Implementer les handlers (cf. msw-handlers.md).

### 5.2 Gate de verification -- Phase 4

```bash
cd /var/www/femiglow-staging/apps/web

npx tsc --noEmit
echo "TSC: $?"
# Attendu : 0
```

---

## 6. Phase 5 : Composants UI

### 6.1 Modifier la page Knowledge

**Fichier** : `apps/web/src/app/admin/content-studio-v2/ai-engine/knowledge/page.tsx`

```bash
# Compter les lignes actuelles
wc -l src/app/admin/content-studio-v2/ai-engine/knowledge/page.tsx
# Prendre note de la taille actuelle

# Verifier les imports existants
head -30 src/app/admin/content-studio-v2/ai-engine/knowledge/page.tsx
```

Ajouter dans l'ordre :
1. Nouveaux imports (Lucide, Dialog, Skeleton)
2. Interface `DocumentDetail`
3. 17 nouveaux `useState` dans le composant
4. Variables derivees (`isCollectionDirty`, `isDocumentDirty`, `isDocumentContentDirty`)
5. Fonctions handlers (7 fonctions)
6. Boutons d'action (3 composants inline)
7. Modales (4 blocs JSX)

### 6.2 Gate de verification -- Phase 5

```bash
cd /var/www/femiglow-staging/apps/web

# TypeScript compile
npx tsc --noEmit
echo "TSC: $?"
# Attendu : 0

# Verification visuelle
npm run dev &
DEV_PID=$!
sleep 10

echo "Ouvrir http://localhost:3000/admin/content-studio-v2/ai-engine/knowledge"
echo "Verifications manuelles :"
echo "  1. Le bouton Modifier apparait sur les collections"
echo "  2. Les boutons Voir et Modifier apparaissent sur les documents"
echo "  3. La modale d'edition de collection s'ouvre et se ferme"
echo "  4. La modale de visualisation affiche le contenu"
echo "  5. La modale d'edition de document fonctionne"
echo ""
echo "Appuyer sur Ctrl+C quand la verification est terminee"

wait $DEV_PID 2>/dev/null
```

---

## 7. Phase 6 : Tests

### 7.1 Tests unitaires Vitest

```bash
cd /var/www/femiglow-staging/apps/web

# Ajouter les tests dans les fichiers existants
# collections.test.ts : describe('updateCollection()'), describe('getDocumentById()')
# ingestion.test.ts : describe('updateDocument()')

# Creer les nouveaux fichiers de test
touch src/test/api-contracts/ai-engine-knowledge-edit.contract.test.ts
mkdir -p src/app/admin/content-studio-v2/ai-engine/knowledge/__tests__/
touch src/app/admin/content-studio-v2/ai-engine/knowledge/__tests__/knowledge-page-edit.test.tsx
```

Implementer les tests (cf. vitest-specs.md).

```bash
# Executer les tests
npx vitest run --reporter=verbose \
  src/lib/ai-engine/knowledge/collections.test.ts \
  src/lib/ai-engine/knowledge/ingestion.test.ts \
  src/test/api-contracts/ai-engine-knowledge-edit.contract.test.ts \
  src/app/admin/content-studio-v2/ai-engine/knowledge/__tests__/knowledge-page-edit.test.tsx

echo "Exit code: $?"
# Attendu : 0

# Couverture
npx vitest run --coverage src/lib/ai-engine/knowledge/
# Attendu : > 90% sur les nouvelles fonctions
```

### 7.2 Tests E2E Playwright

```bash
cd /var/www/femiglow-staging/apps/web

# Creer le fichier E2E
touch e2e/content-studio-v2/ai-engine-knowledge-edit.spec.ts
```

Implementer les scenarios (cf. playwright-specs.md).

```bash
# Executer les tests E2E
npx playwright test e2e/content-studio-v2/ai-engine-knowledge-edit.spec.ts --reporter=list

echo "Exit code: $?"
# Attendu : 0

# Verification de stabilite (3 runs)
FAILURES=0
for i in 1 2 3; do
  echo "=== Run $i ==="
  npx playwright test e2e/content-studio-v2/ai-engine-knowledge-edit.spec.ts --reporter=dot
  if [ $? -ne 0 ]; then
    FAILURES=$((FAILURES + 1))
  fi
done
echo "Flaky runs: $FAILURES / 3"
# Attendu : Flaky runs: 0 / 3
```

### 7.3 Gate de verification -- Phase 6

```bash
cd /var/www/femiglow-staging/apps/web

# TOUS les tests (existants + nouveaux)
echo "=== Vitest (tous) ==="
npx vitest run --reporter=dot
echo "Vitest exit: $?"

echo "=== Playwright (tous) ==="
npx playwright test --reporter=dot
echo "Playwright exit: $?"

echo "=== TypeScript ==="
npx tsc --noEmit
echo "TSC exit: $?"
```

---

## 8. Phase 7 : Verification finale

### 8.1 Verification complete

```bash
cd /var/www/femiglow-staging/apps/web

echo "========================================="
echo "   VERIFICATION FINALE -- Knowledge Edit"
echo "========================================="

# 1. TypeScript
echo ""
echo "[1/6] TypeScript compilation..."
npx tsc --noEmit
TSC_EXIT=$?
echo "TSC: $TSC_EXIT"

# 2. Vitest (tous)
echo ""
echo "[2/6] Vitest (tous les tests)..."
npx vitest run --reporter=dot 2>&1 | tail -5
VITEST_EXIT=$?
echo "Vitest: $VITEST_EXIT"

# 3. Vitest (couverture nouvelles fonctions)
echo ""
echo "[3/6] Couverture Vitest..."
npx vitest run --coverage src/lib/ai-engine/knowledge/ 2>&1 | grep -E "collections|ingestion|All files"
COVERAGE_EXIT=$?

# 4. Playwright (tous)
echo ""
echo "[4/6] Playwright (tous les E2E)..."
npx playwright test --reporter=dot 2>&1 | tail -5
PW_EXIT=$?
echo "Playwright: $PW_EXIT"

# 5. Lint + format
echo ""
echo "[5/6] Lint et format..."
npx eslint src/lib/ai-engine/knowledge/ --quiet 2>&1 | tail -3
npx prettier --check src/lib/ai-engine/knowledge/ 2>&1 | tail -3

# 6. Git diff
echo ""
echo "[6/6] Git diff (resume)..."
cd /var/www/femiglow-staging
git diff --stat HEAD
git diff --name-only HEAD | grep -E "\.env|credentials|secret" && echo "ATTENTION: fichiers sensibles detectes!" || echo "Aucun fichier sensible."

echo ""
echo "========================================="
echo "   RESULTATS"
echo "========================================="
echo "TypeScript : $([ $TSC_EXIT -eq 0 ] && echo 'PASS' || echo 'FAIL')"
echo "Vitest     : $([ $VITEST_EXIT -eq 0 ] && echo 'PASS' || echo 'FAIL')"
echo "Playwright : $([ $PW_EXIT -eq 0 ] && echo 'PASS' || echo 'FAIL')"
echo "========================================="
```

### 8.2 Commit et PR

```bash
cd /var/www/femiglow-staging

# Ajouter les fichiers modifies
git add apps/web/src/lib/db/schema-ai-engine.ts
git add apps/web/src/lib/ai-engine/knowledge/collections.ts
git add apps/web/src/lib/ai-engine/knowledge/ingestion.ts
git add apps/web/src/lib/ai-engine/knowledge/index.ts
git add apps/web/src/app/api/admin/ai-engine/knowledge/
git add apps/web/src/app/admin/content-studio-v2/ai-engine/knowledge/page.tsx
git add apps/web/src/test/msw/handlers/ai-engine-knowledge-edit.handlers.ts
git add apps/web/src/test/msw/handlers/index.ts
git add apps/web/src/test/api-contracts/ai-engine-knowledge-edit.contract.test.ts
git add apps/web/src/app/admin/content-studio-v2/ai-engine/knowledge/__tests__/
git add apps/web/e2e/content-studio-v2/ai-engine-knowledge-edit.spec.ts
git add apps/web/src/lib/ai-engine/knowledge/collections.test.ts
git add apps/web/src/lib/ai-engine/knowledge/ingestion.test.ts
git add drizzle/

# Verifier ce qui sera commite
git diff --cached --stat

# Commiter
git commit -m "feat(knowledge): add UPDATE capability for collections and documents

- Add PATCH /knowledge/[slug] for collection name/description/category
- Add GET /knowledge/[slug]/documents/[docId] for full document content
- Add PATCH /knowledge/[slug]/documents/[docId] with conditional re-chunking
- Add CollectionEditDialog, DocumentViewDialog, DocumentEditDialog UI
- Add re-chunking confirmation flow with ConfirmReChunkDialog
- Add updated_at column to collection and document tables
- Add 48 Vitest unit tests + 16 Playwright E2E scenarios
- Add MSW 2.x handlers for all new endpoints"

# Pousser
git push origin feat/knowledge-edit
```

---

## 9. Procedure de rollback

### 9.1 Rollback de la migration DB

```bash
# Si la migration doit etre annulee :
psql "$DATABASE_URL" -c "
  ALTER TABLE ai_engine_knowledge_collection DROP COLUMN IF EXISTS updated_at;
  ALTER TABLE ai_engine_knowledge_document DROP COLUMN IF EXISTS updated_at;
"

# Regenerer le schema Drizzle
cd /var/www/femiglow-staging/apps/web
npx drizzle-kit push:pg
```

### 9.2 Rollback du code

```bash
cd /var/www/femiglow-staging

# Revenir au dernier commit avant la feature
git log --oneline -5
# Identifier le hash du commit avant la feature

# Option 1 : Revert du dernier commit
git revert HEAD

# Option 2 : Reset a un commit specifique (DESTRUCTIF)
# git reset --hard <hash>
```

### 9.3 Rollback partiel (garder la migration, rollback le code)

```bash
# Si la migration est en production mais le code pose probleme :
# Les anciennes fonctions ignorent updated_at (elles ne le lisent pas)
# -> Le rollback du code est safe meme si la colonne existe

git checkout master -- apps/web/src/lib/ai-engine/knowledge/
git checkout master -- apps/web/src/app/api/admin/ai-engine/knowledge/
git checkout master -- apps/web/src/app/admin/content-studio-v2/ai-engine/knowledge/page.tsx
```

---

## 10. Guide de depannage

### Probleme 1 : `npx tsc --noEmit` echoue apres ajout de `updatedAt`

**Symptome** : Erreur TypeScript `Property 'updatedAt' is missing in type ...`

**Cause** : Les mocks ou les interfaces existants ne contiennent pas le champ `updatedAt`.

**Solution** :
```bash
# Trouver tous les fichiers qui referencent CollectionRow ou les mocks
grep -rn "CollectionRow\|MOCK_COLLECTION\|mockCollection" apps/web/src/ --include="*.ts" --include="*.tsx"

# Ajouter updatedAt dans chaque mock
# updatedAt: new Date() (pour les interfaces Date)
# updatedAt: '2026-05-20T10:00:00.000Z' (pour les mocks JSON)
```

---

### Probleme 2 : Les tests Vitest echouent avec `Cannot find module`

**Symptome** : `Error: Cannot find module '@/lib/ai-engine/knowledge'`

**Cause** : Les path aliases ne sont pas resolus dans l'environnement de test.

**Solution** :
```bash
# Verifier la configuration Vitest
cat apps/web/vitest.config.ts | grep -A 5 "alias"

# S'assurer que le resolve alias est configure :
# resolve: { alias: { '@': path.resolve(__dirname, './src') } }
```

---

### Probleme 3 : Le handler MSW ne capture pas les requetes

**Symptome** : `[MSW] Warning: captured a request without a matching request handler`

**Cause** : Le path du handler ne correspond pas exactement au path appele par le composant.

**Solution** :
```bash
# Verifier le path exact appele par le composant
grep -n "fetch.*knowledge" apps/web/src/app/admin/content-studio-v2/ai-engine/knowledge/page.tsx

# Le handler MSW doit utiliser le meme pattern :
# http.patch('/api/admin/ai-engine/knowledge/:slug', ...)
# PAS : http.patch('http://localhost:3000/api/...', ...)
```

---

### Probleme 4 : Les tests Playwright echouent en CI avec timeout

**Symptome** : `Timeout 30000ms exceeded waiting for selector`

**Cause** : Le serveur de dev n'a pas demarre ou les routes API ne sont pas interceptees.

**Solution** :
```bash
# Verifier que playwright.config.ts configure le webServer :
grep -A 10 "webServer" apps/web/playwright.config.ts

# Augmenter le timeout si necessaire :
# webServer: { ... timeout: 60 * 1000 }

# Verifier les routes interceptees dans le test :
# Les page.route() doivent etre configures AVANT le goto()
```

---

### Probleme 5 : Le re-chunking echoue avec `Rate limit exceeded`

**Symptome** : PATCH document retourne 500 avec `OpenAI API rate limit exceeded`

**Cause** : L'API OpenAI est en surcharge ou la cle API a atteint sa limite.

**Solution** :
```bash
# En dev : verifier la cle API
echo $OPENAI_API_KEY | head -c 8
# Attendu : sk-proj-... ou sk-...

# En test : les embeddings sont mockes, ce probleme ne devrait pas survenir
# Verifier que le mock est en place :
grep -n "OpenAIEmbeddings\|getEmbeddings" apps/web/src/lib/ai-engine/knowledge/ingestion.test.ts
```

---

### Probleme 6 : La modale ne se ferme pas apres le PATCH

**Symptome** : La modale reste ouverte meme apres un PATCH reussi (200).

**Cause** : Le `setEditingCollection(null)` n'est pas appele, ou le state n'est pas reset.

**Solution** :
```bash
# Verifier le code de handleSaveCollection :
grep -A 20 "async function handleSaveCollection" apps/web/src/app/admin/content-studio-v2/ai-engine/knowledge/page.tsx

# S'assurer que :
# 1. setEditingCollection(null) est appele dans le bloc try APRES le fetch reussi
# 2. Le finally {} contient setSavingCol(false)
# 3. Le catch {} ne ferme PAS la modale (laisse l'erreur visible)
```

---

### Probleme 7 : Le dirty check declenche une confirmation non souhaitee

**Symptome** : `window.confirm('Abandonner les modifications ?')` apparait meme sans modification.

**Cause** : Le dirty check compare des valeurs avec des espaces ou des types differents.

**Solution** :
```bash
# Verifier les comparaisons de dirty check :
grep -n "isCollectionDirty\|isDocumentDirty" apps/web/src/app/admin/content-studio-v2/ai-engine/knowledge/page.tsx

# S'assurer que :
# - Les comparaisons utilisent .trim() sur les strings
# - La description null est comparee correctement : (editColDesc.trim() || null) !== collection.description
# - Le contenu original est stocke au chargement : setEditDocOriginalContent(data.contentText ?? '')
```
