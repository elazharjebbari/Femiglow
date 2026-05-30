# Runbook Global -- Knowledge Edit + API Keys Management

> **Branche** : `feat/ai-engine-langgraph-mvp`
> **Port staging** : 8012
> **Repertoire racine** : `/var/www/femiglow-staging`
> **Date de reference** : 2026-05-25

---

## Table des matieres

1. [Pre-requis](#1-pre-requis)
2. [Execution Phase 1 -- Fondations Backend](#2-execution-phase-1----fondations-backend)
3. [Gate de Verification 1](#3-gate-de-verification-1)
4. [Execution Phase 2 -- Routes API](#4-execution-phase-2----routes-api)
5. [Gate de Verification 2](#5-gate-de-verification-2)
6. [Execution Phase 3 -- Composants Frontend](#6-execution-phase-3----composants-frontend)
7. [Gate de Verification 3](#7-gate-de-verification-3)
8. [Execution Phase 4 -- Integration](#8-execution-phase-4----integration)
9. [Gate de Verification 4](#9-gate-de-verification-4)
10. [Execution Phase 5 -- Tests](#10-execution-phase-5----tests)
11. [Gate de Verification 5](#11-gate-de-verification-5)
12. [Execution Phase 6 -- Boucle de Correction](#12-execution-phase-6----boucle-de-correction)
13. [Execution Phase 7 -- Deploiement](#13-execution-phase-7----deploiement)
14. [Procedure de Rollback](#14-procedure-de-rollback)
15. [Verification Post-Deploiement](#15-verification-post-deploiement)
16. [Plan de Monitoring](#16-plan-de-monitoring)

---

## 1. Pre-requis

### 1.1 Verification de l'environnement

```bash
# Verifier la branche courante
cd /var/www/femiglow-staging
git branch --show-current
# Attendu : feat/ai-engine-langgraph-mvp

# Verifier que le working tree est propre
git status
# Attendu : nothing to commit, working tree clean

# Verifier la version de Node.js (>= 18.x requis)
node --version
# Attendu : v18.x.x ou v20.x.x ou v22.x.x

# Verifier pnpm
pnpm --version
# Attendu : >= 8.x

# Verifier que les dependances sont installees
pnpm install --frozen-lockfile
```

### 1.2 Verification de la base de donnees

```bash
# Verifier la connexion PostgreSQL
# La variable DATABASE_URL doit etre definie dans .env
grep DATABASE_URL apps/web/.env 2>/dev/null || echo "ATTENTION: DATABASE_URL non trouvee dans .env"

# Tester la connexion (depuis le repertoire de l'app web)
cd /var/www/femiglow-staging/apps/web
npx drizzle-kit check 2>/dev/null || echo "Drizzle check a echoue -- verifier la configuration"
```

### 1.3 Verification des variables d'environnement

```bash
# Variables existantes requises
echo "--- Verification des env vars AI Engine ---"
for var in AI_ENGINE_ENABLED AI_ENGINE_OPENAI_API_KEY AI_ENGINE_ANTHROPIC_API_KEY AI_ENGINE_GOOGLE_API_KEY; do
  if grep -q "$var" apps/web/.env 2>/dev/null; then
    echo "[OK] $var est defini"
  else
    echo "[WARN] $var n'est PAS defini"
  fi
done

# Nouvelle variable requise pour Feature 2 (API Keys Management)
if grep -q "AI_ENGINE_ENCRYPTION_KEY" apps/web/.env 2>/dev/null; then
  echo "[OK] AI_ENGINE_ENCRYPTION_KEY est defini"
else
  echo "[ACTION REQUISE] AI_ENGINE_ENCRYPTION_KEY doit etre genere et ajoute a .env"
  echo "Commande de generation :"
  echo '  node -e "console.log(require(\"crypto\").randomBytes(32).toString(\"base64\"))"'
fi
```

### 1.4 Verification des outils de test

```bash
cd /var/www/femiglow-staging

# Vitest
pnpm exec vitest --version
# Attendu : vitest/2.1.x

# Playwright
pnpm exec playwright --version
# Attendu : Version 1.48.x

# Verifier que les navigateurs Playwright sont installes
pnpm exec playwright install --check 2>/dev/null || echo "Installer les navigateurs : pnpm exec playwright install"
```

### 1.5 Etat de reference des tests existants

```bash
# Executer les tests existants pour etablir la baseline
cd /var/www/femiglow-staging

# Tests unitaires (comptage)
pnpm exec vitest run --reporter=verbose 2>&1 | tail -5
# Attendu : ~622 tests, 0 echecs

# Tests E2E (comptage)
pnpm exec playwright test --list 2>&1 | tail -3
# Attendu : ~27 tests

echo "--- BASELINE ETABLIE ---"
echo "Sauvegarder ces chiffres pour comparaison post-implementation"
```

### 1.6 Checkpoint de securite

```bash
# Generer la cle de chiffrement (si pas encore fait)
AI_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
echo "AI_ENGINE_ENCRYPTION_KEY=$AI_ENCRYPTION_KEY"
echo "STOCKER CETTE CLE DE MANIERE SECURISEE (vault, secrets manager)"

# Ajouter au .env (NE PAS COMMITTER ce fichier)
echo "AI_ENGINE_ENCRYPTION_KEY=$AI_ENCRYPTION_KEY" >> apps/web/.env

# Verifier que .env est dans .gitignore
grep -q ".env" .gitignore && echo "[OK] .env est dans .gitignore" || echo "[ATTENTION] Ajouter .env a .gitignore !"
```

---

## 2. Execution Phase 1 -- Fondations Backend

### 2.1 Knowledge Edit -- Schema et Services

#### T1.1.1 : Ajouter `updatedAt` aux tables Knowledge

```bash
# Fichier a modifier :
# /var/www/femiglow-staging/apps/web/src/lib/db/schema-ai-engine.ts

# Ajouter dans aiEngineKnowledgeCollections :
#   updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),

# Ajouter dans aiEngineKnowledgeDocuments :
#   updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
```

**Verification** :
```bash
cd /var/www/femiglow-staging/apps/web
# Verifier que le fichier compile
npx tsc --noEmit src/lib/db/schema-ai-engine.ts 2>&1 | head -10
```

#### T1.1.2 : Implementer `updateCollection()`

```bash
# Fichier a modifier :
# /var/www/femiglow-staging/apps/web/src/lib/ai-engine/knowledge/collections.ts

# Ajouter la fonction :
# export async function updateCollection(
#   id: string,
#   updates: { name?: string; slug?: string; description?: string | null; category?: string }
# ): Promise<CollectionRow>
```

**Verification** :
```bash
# Verifier que la fonction est exportee
grep -n "updateCollection" apps/web/src/lib/ai-engine/knowledge/collections.ts
```

#### T1.1.3 -- T1.1.6 : Autres services Knowledge

```bash
# Fichiers a creer/modifier :
# - apps/web/src/lib/ai-engine/knowledge/documents.ts (nouveau)
# - apps/web/src/lib/ai-engine/knowledge/ingestion.ts (modifier)
# - apps/web/src/lib/ai-engine/knowledge/index.ts (re-exporter)

# Verification de la compilation globale apres toutes les modifications :
cd /var/www/femiglow-staging
pnpm exec tsc --noEmit --project apps/web/tsconfig.json 2>&1 | head -20
```

### 2.2 API Keys Management -- Schema et Services

#### T1.2.1 : Ajouter champs au schema provider

```bash
# Fichier a modifier :
# /var/www/femiglow-staging/apps/web/src/lib/db/schema-ai-engine.ts

# Dans aiEngineProviderConfigs, ajouter :
#   encryptedApiKey: text('encrypted_api_key'),
#   apiKeySetAt: timestamp('api_key_set_at', { withTimezone: true }),
```

#### T1.2.2 : Service de chiffrement

```bash
# Fichier a creer :
# /var/www/femiglow-staging/apps/web/src/lib/ai-engine/security/encryption.ts

# Structure du fichier :
# - import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
# - const ALGORITHM = 'aes-256-gcm';
# - export function encrypt(plaintext: string): string
# - export function decrypt(ciphertext: string): string
# - export function maskApiKey(key: string): string

# Verification :
node -e "
const { encrypt, decrypt } = require('./apps/web/src/lib/ai-engine/security/encryption');
const original = 'sk-test-1234567890';
const encrypted = encrypt(original);
const decrypted = decrypt(encrypted);
console.log('Original:', original);
console.log('Encrypted:', encrypted.substring(0, 20) + '...');
console.log('Decrypted:', decrypted);
console.log('Match:', original === decrypted ? 'OK' : 'ECHEC');
" 2>/dev/null || echo "Verification manuelle necessaire (ES modules)"
```

#### T1.2.3 -- T1.2.7 : Autres services AKM

```bash
# Fichiers a creer :
# - apps/web/src/lib/ai-engine/providers/api-key-service.ts
# - apps/web/src/lib/ai-engine/security/audit.ts

# Fichier a modifier :
# - apps/web/src/lib/ai-engine/config/engine-config.ts

# Verification globale :
cd /var/www/femiglow-staging
pnpm exec tsc --noEmit --project apps/web/tsconfig.json 2>&1 | head -20
echo "TypeScript compile sans erreur : $([ $? -eq 0 ] && echo OUI || echo NON)"
```

### 2.3 Migration Drizzle

```bash
cd /var/www/femiglow-staging/apps/web

# Generer la migration
npx drizzle-kit generate 2>&1

# Verifier le contenu SQL genere
ls -la drizzle/migrations/ | tail -3
cat drizzle/migrations/*_*.sql | head -30

# Appliquer la migration en dev
npx drizzle-kit migrate 2>&1

# Verifier que les colonnes existent
# (necessite un client psql ou un script de verification)
echo "Verification manuelle : SELECT column_name FROM information_schema.columns WHERE table_name = 'ai_engine_provider_config' AND column_name IN ('encrypted_api_key', 'api_key_set_at');"
```

---

## 3. Gate de Verification 1

```bash
cd /var/www/femiglow-staging

echo "=== GATE 1 : Fondations Backend ==="

# 1. Compilation TypeScript
pnpm exec tsc --noEmit --project apps/web/tsconfig.json 2>&1 | tail -3
echo "Critere 1 (TypeScript) : $([ $? -eq 0 ] && echo PASSE || echo ECHEC)"

# 2. Tests unitaires existants ne regressen pas
pnpm exec vitest run --reporter=verbose 2>&1 | tail -5
echo "Critere 2 (Tests existants) : verifier 0 echec"

# 3. Nouvelles fonctions exportees
echo "--- Verification des exports ---"
grep -c "updateCollection" apps/web/src/lib/ai-engine/knowledge/collections.ts
grep -c "updateDocument" apps/web/src/lib/ai-engine/knowledge/documents.ts 2>/dev/null || echo "documents.ts non trouve"
grep -c "encrypt" apps/web/src/lib/ai-engine/security/encryption.ts 2>/dev/null || echo "encryption.ts non trouve"
grep -c "setApiKey" apps/web/src/lib/ai-engine/providers/api-key-service.ts 2>/dev/null || echo "api-key-service.ts non trouve"

# 4. Migration generee
ls apps/web/drizzle/migrations/ 2>/dev/null | tail -3 || echo "Pas de migrations trouvees"

echo "=== FIN GATE 1 ==="
echo "DECISION : GO / NO-GO ?"
```

**Criteres de passage** :
- [ ] TypeScript compile sans erreur
- [ ] 0 regression sur les tests existants
- [ ] Toutes les fonctions metier sont implementees et exportees
- [ ] Migration SQL generee et coherente

---

## 4. Execution Phase 2 -- Routes API

### 4.1 Knowledge Edit -- Routes

#### T2.1.1 : GET /knowledge/[slug]

```bash
# Fichier a modifier :
# /var/www/femiglow-staging/apps/web/src/app/api/admin/ai-engine/knowledge/[slug]/route.ts

# Ajouter le handler GET a cote du DELETE existant

# Verification avec curl (le serveur doit tourner) :
# curl -s http://localhost:8012/api/admin/ai-engine/knowledge/neuromarketing \
#   -H "Cookie: <session_cookie>" | jq .
```

#### T2.1.2 : PUT /knowledge/[slug]

```bash
# Meme fichier que T2.1.1

# Verification :
# curl -s -X PUT http://localhost:8012/api/admin/ai-engine/knowledge/neuromarketing \
#   -H "Content-Type: application/json" \
#   -H "Cookie: <session_cookie>" \
#   -d '{"name": "Neuromarketing Updated", "description": "Description modifiee"}' | jq .
```

#### T2.1.3 -- T2.1.4 : GET et PUT /knowledge/[slug]/documents/[docId]

```bash
# Fichier a modifier :
# /var/www/femiglow-staging/apps/web/src/app/api/admin/ai-engine/knowledge/[slug]/documents/[docId]/route.ts

# Ajouter GET et PUT a cote du DELETE existant
```

### 4.2 API Keys Management -- Routes

#### T2.2.1 -- T2.2.4 : Routes API Keys

```bash
# Fichiers a creer :
mkdir -p apps/web/src/app/api/admin/ai-engine/config/providers/\[id\]/api-key/test

# Creer :
# - apps/web/src/app/api/admin/ai-engine/config/providers/[id]/api-key/route.ts (GET, PUT, DELETE)
# - apps/web/src/app/api/admin/ai-engine/config/providers/[id]/api-key/test/route.ts (POST)

# Verification de la structure :
find apps/web/src/app/api/admin/ai-engine/config/providers -type f | sort
```

#### T2.2.5 : Enrichir GET /config/providers

```bash
# Fichier a modifier :
# /var/www/femiglow-staging/apps/web/src/app/api/admin/ai-engine/config/providers/route.ts

# Ajouter les champs hasApiKey, apiKeyMasked, apiKeySetAt dans la reponse

# Verification :
# curl -s http://localhost:8012/api/admin/ai-engine/config/providers \
#   -H "Cookie: <session_cookie>" | jq '.providers[0] | {id, name, hasApiKey, apiKeyMasked}'
```

---

## 5. Gate de Verification 2

```bash
cd /var/www/femiglow-staging

echo "=== GATE 2 : Routes API ==="

# Demarrer le serveur en mode dev (si pas deja fait)
# pnpm dev &
# sleep 10

# 1. Knowledge Edit API
echo "--- Knowledge Edit ---"

# GET collection
echo "GET /knowledge/neuromarketing :"
curl -s -o /dev/null -w "%{http_code}" http://localhost:8012/api/admin/ai-engine/knowledge/neuromarketing
echo ""

# PUT collection (avec cookie d'admin valide)
echo "PUT /knowledge/neuromarketing :"
curl -s -o /dev/null -w "%{http_code}" -X PUT http://localhost:8012/api/admin/ai-engine/knowledge/neuromarketing \
  -H "Content-Type: application/json" \
  -d '{"description": "Test update"}'
echo ""

# 2. API Keys Management API
echo "--- API Keys ---"

# GET api key status
echo "GET /providers/default-openai/api-key :"
curl -s -o /dev/null -w "%{http_code}" http://localhost:8012/api/admin/ai-engine/config/providers/default-openai/api-key
echo ""

# 3. TypeScript check
pnpm exec tsc --noEmit --project apps/web/tsconfig.json 2>&1 | tail -3
echo "Critere 3 (TypeScript) : $([ $? -eq 0 ] && echo PASSE || echo ECHEC)"

# 4. Tests existants
pnpm exec vitest run --reporter=verbose 2>&1 | tail -5

echo "=== FIN GATE 2 ==="
echo "DECISION : GO / NO-GO ?"
```

**Criteres de passage** :
- [ ] Tous les endpoints retournent les codes HTTP attendus (200, 201, 400, 401, 404)
- [ ] Les schemas Zod rejettent les payloads invalides (verifier avec un payload vide)
- [ ] `requireAdminApi()` est appele sur chaque endpoint
- [ ] Les cles API ne sont jamais retournees en clair
- [ ] TypeScript compile sans erreur
- [ ] 0 regression

---

## 6. Execution Phase 3 -- Composants Frontend

### 6.1 Knowledge Edit -- UI

```bash
# Fichier principal a modifier :
# /var/www/femiglow-staging/apps/web/src/app/admin/content-studio-v2/ai-engine/knowledge/page.tsx

# Modifications a apporter (en ordre) :

# 1. Ajouter les etats d'edition
#    const [editingColId, setEditingColId] = useState<string | null>(null);
#    const [editColName, setEditColName] = useState('');
#    const [editColSlug, setEditColSlug] = useState('');
#    const [editColDesc, setEditColDesc] = useState('');
#    const [editColCategory, setEditColCategory] = useState('');
#    const [updatingCol, setUpdatingCol] = useState(false);
#    const [editingDocId, setEditingDocId] = useState<string | null>(null);
#    const [editDocTitle, setEditDocTitle] = useState('');
#    const [editDocContent, setEditDocContent] = useState('');
#    const [editDocSourceType, setEditDocSourceType] = useState<'text' | 'url'>('text');
#    const [editDocUrl, setEditDocUrl] = useState('');
#    const [updatingDoc, setUpdatingDoc] = useState(false);

# 2. Ajouter les handlers handleUpdateCollection() et handleUpdateDocument()

# 3. Ajouter le bouton Editer sur chaque collection (a cote du bouton Supprimer)

# 4. Ajouter le formulaire inline d'edition de collection

# 5. Ajouter le bouton Editer sur chaque document

# 6. Ajouter le formulaire inline d'edition de document
```

**Verification visuelle** :
```bash
# Demarrer le serveur dev
cd /var/www/femiglow-staging
pnpm dev &

# Ouvrir dans le navigateur :
echo "http://localhost:8012/admin/content-studio-v2/ai-engine/knowledge"
echo "Verifier :"
echo "  1. Bouton 'Editer' visible sur chaque collection"
echo "  2. Cliquer 'Editer' ouvre un formulaire inline pre-rempli"
echo "  3. Le formulaire a les memes champs que la creation"
echo "  4. Bouton 'Sauvegarder' et 'Annuler' fonctionnent"
echo "  5. Le spinner apparait pendant la sauvegarde"
```

### 6.2 API Keys Management -- UI

```bash
# Fichiers a creer/modifier :
# 1. Nouveau composant (optionnel, peut etre inline) :
#    /var/www/femiglow-staging/apps/web/src/components/admin/content-studio-v2/ai-engine/ApiKeyManager.tsx

# 2. Modifier le ProviderCard dans :
#    /var/www/femiglow-staging/apps/web/src/app/admin/content-studio-v2/ai-engine/config/page.tsx

# Le composant ApiKeyManager doit contenir :
# - Un champ input type="password" pour la cle
# - Un bouton toggle visibilite (Eye / EyeOff)
# - Un bouton "Sauvegarder la cle"
# - Un bouton "Tester la connexion"
# - Un bouton "Supprimer la cle" (avec confirmation)
# - Un indicateur de statut (badge vert/rouge)
# - L'information "Source: Variable d'environnement" ou "Source: Base de donnees"
```

**Verification visuelle** :
```bash
echo "http://localhost:8012/admin/content-studio-v2/ai-engine/config"
echo "Verifier :"
echo "  1. Chaque ProviderCard a un lien/bouton 'Gerer la cle API'"
echo "  2. Cliquer ouvre le formulaire ApiKeyManager"
echo "  3. Le champ cle est masque par defaut"
echo "  4. Le bouton oeil toggle la visibilite"
echo "  5. Le bouton 'Tester' lance un test avec spinner"
echo "  6. Le resultat du test est affiche en badge (vert/rouge)"
echo "  7. La suppression demande confirmation"
```

---

## 7. Gate de Verification 3

```bash
cd /var/www/femiglow-staging

echo "=== GATE 3 : Composants Frontend ==="

# 1. TypeScript strict check
pnpm exec tsc --noEmit --project apps/web/tsconfig.json 2>&1 | tail -5
echo "Critere 1 (TypeScript) : $([ $? -eq 0 ] && echo PASSE || echo ECHEC)"

# 2. Linter
pnpm exec eslint apps/web/src/app/admin/content-studio-v2/ai-engine/knowledge/page.tsx 2>&1 | tail -3
pnpm exec eslint apps/web/src/app/admin/content-studio-v2/ai-engine/config/page.tsx 2>&1 | tail -3

# 3. Tests existants
pnpm exec vitest run --reporter=verbose 2>&1 | tail -5

# 4. Verification que les primitives CS v2 sont utilisees
echo "--- Verification primitives ---"
grep -c "from '@/components/admin/content-studio-v2/primitives'" \
  apps/web/src/app/admin/content-studio-v2/ai-engine/knowledge/page.tsx
grep -c "from '@/components/admin/content-studio-v2/primitives'" \
  apps/web/src/app/admin/content-studio-v2/ai-engine/config/page.tsx

echo "=== FIN GATE 3 ==="
```

**Criteres de passage** :
- [ ] TypeScript compile sans erreur
- [ ] ESLint ne signale pas d'erreur
- [ ] Les primitives CS v2 sont utilisees (pas de composants bruts HTML pour boutons/inputs)
- [ ] Les design tokens `--cs-*` sont respectes
- [ ] Les etats de chargement (spinner) sont implementes
- [ ] Les etats d'erreur sont affiches
- [ ] 0 regression

---

## 8. Execution Phase 4 -- Integration

### 8.1 Test d'integration manuelle KE

```bash
# Scenario 1 : Edition de collection
echo "=== Scenario KE-1 : Edition collection ==="
echo "1. Naviguer vers /admin/content-studio-v2/ai-engine/knowledge"
echo "2. Expander la collection 'Neuromarketing'"
echo "3. Cliquer 'Editer' sur la collection"
echo "4. Modifier le nom en 'Neuromarketing v2'"
echo "5. Cliquer 'Sauvegarder'"
echo "6. Verifier que le nom est mis a jour dans la liste"
echo "7. Rafraichir la page (F5) et verifier la persistance"

# Scenario 2 : Edition de document
echo "=== Scenario KE-2 : Edition document ==="
echo "1. Expander une collection qui a des documents"
echo "2. Cliquer 'Editer' sur un document"
echo "3. Modifier le titre et le contenu"
echo "4. Cliquer 'Sauvegarder'"
echo "5. Verifier que le document est mis a jour"
echo "6. Verifier que le nombre de chunks a pu changer (re-indexation)"

# Scenario 3 : Cas d'erreur
echo "=== Scenario KE-3 : Erreur slug duplique ==="
echo "1. Editer une collection"
echo "2. Changer le slug pour un slug qui existe deja"
echo "3. Cliquer 'Sauvegarder'"
echo "4. Verifier le message d'erreur (toast ou inline)"
echo "5. Annuler l'edition"
```

### 8.2 Test d'integration manuelle AKM

```bash
# Scenario 1 : Ajout de cle API
echo "=== Scenario AKM-1 : Ajout cle ==="
echo "1. Naviguer vers /admin/content-studio-v2/ai-engine/config"
echo "2. Onglet 'Fournisseurs'"
echo "3. Trouver le provider OpenAI"
echo "4. Cliquer 'Gerer la cle API'"
echo "5. Saisir une cle API valide"
echo "6. Cliquer 'Sauvegarder'"
echo "7. Verifier que le badge passe a 'Configuree'"
echo "8. Verifier que la cle est masquee (sk-...xxxx)"

# Scenario 2 : Test de cle
echo "=== Scenario AKM-2 : Test connexion ==="
echo "1. Avec une cle sauvegardee, cliquer 'Tester'"
echo "2. Verifier le spinner pendant le test"
echo "3. Verifier le resultat (badge vert + latence)"

# Scenario 3 : Suppression de cle
echo "=== Scenario AKM-3 : Suppression ==="
echo "1. Cliquer 'Supprimer la cle'"
echo "2. Confirmer dans le dialogue"
echo "3. Verifier que le badge passe a 'Non configuree'"
echo "4. Verifier que le fallback env var reprend (si defini)"

# Scenario 4 : Priorite DB vs env var
echo "=== Scenario AKM-4 : Priorite ==="
echo "1. Definir une cle via l'UI (DB)"
echo "2. Verifier que cette cle est utilisee (pas l'env var)"
echo "3. Supprimer la cle DB"
echo "4. Verifier que l'env var reprend automatiquement"
```

---

## 9. Gate de Verification 4

```bash
cd /var/www/femiglow-staging

echo "=== GATE 4 : Integration ==="

# 1. Compilation
pnpm exec tsc --noEmit --project apps/web/tsconfig.json 2>&1 | tail -3

# 2. Tests existants
pnpm exec vitest run 2>&1 | tail -5

# 3. Verification de l'absence de fuites de cles dans les logs
echo "--- Verification securite ---"
# Rechercher les patterns de cles API dans le code source
grep -rn "console.log.*apiKey\|console.log.*api_key\|console.log.*API_KEY" \
  apps/web/src/lib/ai-engine/ 2>/dev/null | grep -v "test\|spec\|mock" || echo "[OK] Aucune fuite de cle detectee"

# Rechercher les cles en dur
grep -rn "sk-[a-zA-Z0-9]\{10,\}\|sk-ant-[a-zA-Z0-9]\{10,\}" \
  apps/web/src/lib/ai-engine/ 2>/dev/null | grep -v "test\|spec\|mock\|example\|placeholder" || echo "[OK] Aucune cle en dur"

echo "=== FIN GATE 4 ==="
```

**Criteres de passage** :
- [ ] Les 4 scenarios KE fonctionnent de bout en bout
- [ ] Les 4 scenarios AKM fonctionnent de bout en bout
- [ ] Aucune fuite de cle API dans les logs
- [ ] Aucune cle en dur dans le code source
- [ ] Les cas d'erreur affichent des messages comprehensibles
- [ ] 0 regression

---

## 10. Execution Phase 5 -- Tests

### 10.1 Tests unitaires

```bash
cd /var/www/femiglow-staging

# Executer uniquement les nouveaux tests unitaires
echo "=== Tests unitaires Knowledge Edit ==="
pnpm exec vitest run \
  apps/web/src/lib/ai-engine/knowledge/collections.test.ts \
  apps/web/src/lib/ai-engine/knowledge/documents.test.ts \
  apps/web/src/lib/ai-engine/knowledge/ingestion.test.ts \
  --reporter=verbose 2>&1

echo "=== Tests unitaires API Keys Management ==="
pnpm exec vitest run \
  apps/web/src/lib/ai-engine/security/encryption.test.ts \
  apps/web/src/lib/ai-engine/providers/api-key-service.test.ts \
  apps/web/src/lib/ai-engine/config/engine-config.test.ts \
  --reporter=verbose 2>&1

# Executer TOUS les tests unitaires (regression)
echo "=== Suite complete ==="
pnpm exec vitest run --reporter=verbose 2>&1 | tail -10
```

### 10.2 Tests de contrats API

```bash
cd /var/www/femiglow-staging

# Nouveaux tests de contrats
echo "=== Tests contrats Knowledge Edit ==="
pnpm exec vitest run \
  apps/web/src/test/api-contracts/ai-engine-knowledge-edit.contract.test.ts \
  --reporter=verbose 2>&1

echo "=== Tests contrats API Keys ==="
pnpm exec vitest run \
  apps/web/src/test/api-contracts/ai-engine-api-keys.contract.test.ts \
  --reporter=verbose 2>&1

# Suite complete des contrats
echo "=== Tous les contrats ==="
pnpm exec vitest run \
  apps/web/src/test/api-contracts/ \
  --reporter=verbose 2>&1 | tail -10
```

### 10.3 Tests E2E

```bash
cd /var/www/femiglow-staging

# S'assurer que le serveur dev tourne
# pnpm dev &
# sleep 15

# Nouveaux tests E2E
echo "=== E2E Knowledge Edit ==="
pnpm exec playwright test \
  e2e/content-studio-v2/ai-engine-knowledge-edit.spec.ts \
  --reporter=list 2>&1

echo "=== E2E API Keys ==="
pnpm exec playwright test \
  e2e/content-studio-v2/ai-engine-api-keys.spec.ts \
  --reporter=list 2>&1

# Suite complete E2E
echo "=== Suite E2E complete ==="
pnpm exec playwright test \
  e2e/content-studio-v2/ \
  --reporter=list 2>&1 | tail -10
```

### 10.4 Couverture de code

```bash
cd /var/www/femiglow-staging

# Generer le rapport de couverture
pnpm exec vitest run --coverage --reporter=verbose 2>&1

# Verifier la couverture des nouveaux fichiers
echo "=== Couverture nouveaux fichiers ==="
# Les fichiers doivent avoir >= 80% de couverture :
# - knowledge/collections.ts
# - knowledge/documents.ts
# - knowledge/ingestion.ts
# - security/encryption.ts
# - providers/api-key-service.ts
# - config/engine-config.ts
```

---

## 11. Gate de Verification 5

```bash
cd /var/www/femiglow-staging

echo "=== GATE 5 : Tests ==="

# 1. Tests unitaires
UNIT_RESULT=$(pnpm exec vitest run 2>&1 | tail -1)
echo "Tests unitaires : $UNIT_RESULT"

# 2. Tests E2E
E2E_RESULT=$(pnpm exec playwright test 2>&1 | tail -1)
echo "Tests E2E : $E2E_RESULT"

# 3. Comparer avec la baseline
echo "--- Comparaison baseline ---"
echo "Baseline : 622 unit + 27 E2E"
echo "Verifier que le nombre total a AUGMENTE (pas diminue)"

# 4. Verifier 0 echec
echo "--- Zero echec ---"
pnpm exec vitest run 2>&1 | grep -i "fail\|error" | head -5
pnpm exec playwright test 2>&1 | grep -i "fail\|error" | head -5

echo "=== FIN GATE 5 ==="
```

**Criteres de passage** :
- [ ] 0 echec sur les tests unitaires (existants + nouveaux)
- [ ] 0 echec sur les tests E2E (existants + nouveaux)
- [ ] Couverture >= 80% sur les nouveaux fichiers
- [ ] Nombre total de tests a augmente par rapport a la baseline
- [ ] Les MSW handlers couvrent tous les nouveaux endpoints

---

## 12. Execution Phase 6 -- Boucle de Correction

Se referer au document `correction-loop.md` pour la procedure detaillee.

```bash
cd /var/www/femiglow-staging

echo "=== BOUCLE DE CORRECTION ==="

# Etape 1 : Collecte des echecs
pnpm exec vitest run 2>&1 > /tmp/vitest-results.txt
pnpm exec playwright test 2>&1 > /tmp/playwright-results.txt

# Etape 2 : Compter les echecs
UNIT_FAILS=$(grep -c "FAIL" /tmp/vitest-results.txt || echo "0")
E2E_FAILS=$(grep -c "failed" /tmp/playwright-results.txt || echo "0")
echo "Echecs unitaires : $UNIT_FAILS"
echo "Echecs E2E : $E2E_FAILS"

# Etape 3 : Classifier
echo "--- Classification ---"
echo "Critiques (bloquants) :"
grep "FAIL" /tmp/vitest-results.txt | head -5
echo ""
echo "E2E echoues :"
grep "failed" /tmp/playwright-results.txt | head -5

# Etape 4 : Corriger un par un
# Pour chaque echec :
# 1. Lire le message d'erreur
# 2. Identifier le fichier source
# 3. Corriger
# 4. Re-tester uniquement le fichier concerne :
#    pnpm exec vitest run <fichier_test> --reporter=verbose
# 5. Si passe, continuer au suivant
# 6. Si echec, analyser plus profondement

# Etape 5 : Re-tester la suite complete apres corrections
pnpm exec vitest run 2>&1 | tail -5
pnpm exec playwright test 2>&1 | tail -5

echo "=== FIN BOUCLE DE CORRECTION ==="
```

**Boucle iterative** :
```
Tant que (echecs > 0) :
  1. Prendre le premier echec critique
  2. Corriger
  3. Re-tester le fichier concerne
  4. Si le fichier passe, re-tester la suite complete
  5. Si regression detectee, revenir en arriere et analyser
```

---

## 13. Execution Phase 7 -- Deploiement

### 13.1 Pre-deploiement

```bash
cd /var/www/femiglow-staging

echo "=== PRE-DEPLOIEMENT ==="

# 1. Verifier que tous les tests passent
pnpm exec vitest run 2>&1 | tail -3
pnpm exec playwright test 2>&1 | tail -3

# 2. Verifier que la branche est a jour
git fetch origin
git log --oneline HEAD..origin/feat/ai-engine-langgraph-mvp | head -5
echo "Si des commits distants apparaissent : git pull --rebase"

# 3. Revue de securite rapide
echo "--- Revue securite ---"
# Pas de cle en clair dans le code
grep -rn "sk-[a-zA-Z0-9]\{20,\}" apps/web/src/ 2>/dev/null | grep -v test | grep -v mock | grep -v example
echo "Resultat : $([ $? -ne 0 ] && echo OK || echo ALERTE)"

# Pas de console.log de donnees sensibles
grep -rn "console\.\(log\|info\|debug\).*\(key\|secret\|password\|token\)" \
  apps/web/src/lib/ai-engine/ 2>/dev/null | grep -v test || echo "[OK]"

# 4. Lister les fichiers modifies
git diff --stat origin/master..HEAD | tail -5
echo "Total fichiers modifies : $(git diff --stat origin/master..HEAD | tail -1)"
```

### 13.2 Migration en staging

```bash
cd /var/www/femiglow-staging/apps/web

echo "=== MIGRATION STAGING ==="

# 1. Backup de la base (si possible)
echo "CONSEIL : Faire un pg_dump avant la migration"
# pg_dump -U <user> -d <dbname> > /tmp/backup-pre-migration-$(date +%Y%m%d%H%M).sql

# 2. Appliquer la migration
npx drizzle-kit migrate 2>&1
echo "Migration : $([ $? -eq 0 ] && echo SUCCES || echo ECHEC)"

# 3. Verifier les nouvelles colonnes
echo "Verifier : SELECT column_name FROM information_schema.columns WHERE table_name = 'ai_engine_provider_config' ORDER BY ordinal_position;"
echo "Verifier : SELECT column_name FROM information_schema.columns WHERE table_name = 'ai_engine_knowledge_collection' ORDER BY ordinal_position;"
```

### 13.3 Variables d'environnement

```bash
echo "=== VARIABLES D'ENVIRONNEMENT ==="

# Verifier que AI_ENGINE_ENCRYPTION_KEY est defini en staging
if grep -q "AI_ENGINE_ENCRYPTION_KEY" apps/web/.env 2>/dev/null; then
  echo "[OK] AI_ENGINE_ENCRYPTION_KEY est defini"
  # Verifier la longueur (doit etre 44 chars en base64 = 32 bytes)
  KEY_LEN=$(grep "AI_ENGINE_ENCRYPTION_KEY" apps/web/.env | cut -d= -f2 | tr -d '"' | wc -c)
  echo "Longueur de la cle : $KEY_LEN caracteres (attendu : ~44)"
else
  echo "[ECHEC] AI_ENGINE_ENCRYPTION_KEY manquant !"
  echo "Generer avec : node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
fi
```

### 13.4 Deploiement

```bash
cd /var/www/femiglow-staging

echo "=== DEPLOIEMENT ==="

# 1. Build
pnpm build 2>&1 | tail -10
echo "Build : $([ $? -eq 0 ] && echo SUCCES || echo ECHEC)"

# 2. Redemarrer le serveur (adapter selon le setup)
# Option A : PM2
# pm2 restart femiglow-staging

# Option B : Systemd
# sudo systemctl restart femiglow-staging

# Option C : Docker
# docker compose -f docker-compose.staging.yml up -d --build

# 3. Attendre que le serveur soit pret
echo "Attendre 15 secondes pour le demarrage..."
sleep 15

# 4. Health check
curl -s -o /dev/null -w "%{http_code}" http://localhost:8012/api/admin/ai-engine/health
echo ""
echo "Health check : $([ $? -eq 0 ] && echo OK || echo ECHEC)"
```

---

## 14. Procedure de Rollback

### 14.1 Rollback rapide (sans perte de donnees)

```bash
cd /var/www/femiglow-staging

echo "=== ROLLBACK RAPIDE ==="

# 1. Identifier le commit precedent
PREVIOUS_COMMIT=$(git log --oneline -2 | tail -1 | cut -d' ' -f1)
echo "Commit actuel : $(git rev-parse --short HEAD)"
echo "Commit precedent : $PREVIOUS_COMMIT"

# 2. Creer une branche de sauvegarde
git branch backup-before-rollback-$(date +%Y%m%d%H%M)

# 3. Revenir au commit precedent
# ATTENTION : ceci est destructif, utiliser avec precaution
# git revert HEAD --no-edit

# 4. Rebuild
pnpm build 2>&1 | tail -5

# 5. Redemarrer
# pm2 restart femiglow-staging
```

### 14.2 Rollback de migration

```bash
echo "=== ROLLBACK MIGRATION ==="

# Les colonnes ajoutees sont nullables, donc le rollback de migration
# n'est pas strictement necessaire. L'ancien code les ignorera.

# Si necessaire, supprimer les colonnes manuellement :
echo "SQL de rollback :"
echo "ALTER TABLE ai_engine_provider_config DROP COLUMN IF EXISTS encrypted_api_key;"
echo "ALTER TABLE ai_engine_provider_config DROP COLUMN IF EXISTS api_key_set_at;"
echo "ALTER TABLE ai_engine_knowledge_collection DROP COLUMN IF EXISTS updated_at;"
echo "ALTER TABLE ai_engine_knowledge_document DROP COLUMN IF EXISTS updated_at;"

# Executer via psql :
# psql -U <user> -d <dbname> -c "ALTER TABLE ..."
```

### 14.3 Rollback des cles API

```bash
echo "=== ROLLBACK CLES API ==="

# Si des cles ont ete stockees en base et doivent etre supprimees :
echo "SQL de nettoyage :"
echo "UPDATE ai_engine_provider_config SET encrypted_api_key = NULL, api_key_set_at = NULL;"

# Les env vars continuent de fonctionner comme fallback
```

---

## 15. Verification Post-Deploiement

```bash
cd /var/www/femiglow-staging

echo "=== VERIFICATION POST-DEPLOIEMENT ==="

# 1. Health check API
echo "--- Health check ---"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8012/api/admin/ai-engine/health)
echo "Health: $HTTP_CODE (attendu: 200)"

# 2. Knowledge Edit - API fonctionnelle
echo "--- Knowledge Edit ---"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8012/api/admin/ai-engine/knowledge)
echo "GET /knowledge: $HTTP_CODE (attendu: 200 ou 401)"

# 3. API Keys - API fonctionnelle
echo "--- API Keys ---"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8012/api/admin/ai-engine/config/providers)
echo "GET /providers: $HTTP_CODE (attendu: 200 ou 401)"

# 4. Pages UI accessibles
echo "--- Pages UI ---"
for page in knowledge config; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8012/admin/content-studio-v2/ai-engine/$page)
  echo "Page $page: $HTTP_CODE"
done

# 5. Verification des logs
echo "--- Logs (dernieres 20 lignes) ---"
# Adapter selon le setup de logging
# tail -20 /var/log/femiglow/staging.log 2>/dev/null || echo "Logs non accessibles"
# pm2 logs femiglow-staging --lines 20 2>/dev/null || echo "PM2 logs non disponibles"

# 6. Verification securite post-deploy
echo "--- Securite ---"
# Verifier qu'aucune cle n'apparait dans les logs
# grep -i "sk-\|api.key\|secret" /var/log/femiglow/staging.log | head -5 || echo "[OK] Pas de fuite"

echo "=== FIN VERIFICATION ==="
```

### Checklist post-deploiement

- [ ] Health check API retourne 200
- [ ] La page Knowledge se charge sans erreur
- [ ] La page Config se charge sans erreur
- [ ] L'edition d'une collection fonctionne
- [ ] L'edition d'un document fonctionne
- [ ] La gestion des cles API fonctionne (ajout/test/suppression)
- [ ] Les logs ne contiennent pas de cle API en clair
- [ ] Les tests existants passent toujours (smoke test)
- [ ] La latence des pages n'a pas significativement augmente

---

## 16. Plan de Monitoring

### 16.1 Metriques a surveiller

| Metrique | Seuil d'alerte | Outil |
|----------|---------------|-------|
| Temps de reponse API Knowledge Edit | > 2000ms | Logs applicatifs |
| Temps de reponse API Key operations | > 3000ms | Logs applicatifs |
| Taux d'erreur 5xx sur les nouveaux endpoints | > 1% | Logs applicatifs |
| Echec de chiffrement/dechiffrement | > 0 | Logs (niveau ERROR) |
| Tentatives d'acces non authentifie | > 10/min | Logs (niveau WARN) |
| Taille de la base de connaissances (chunks) | > 100 000 | Requete DB periodique |
| Nombre de cles API configurees | Baseline | Dashboard admin |

### 16.2 Commandes de monitoring

```bash
# Surveiller les erreurs en temps reel
# tail -f /var/log/femiglow/staging.log | grep -i "error\|fail\|exception"

# Compter les requetes par endpoint (derniere heure)
# grep "ai-engine" /var/log/femiglow/staging.log | grep "$(date +%Y-%m-%d)" | \
#   awk '{print $NF}' | sort | uniq -c | sort -rn | head -10

# Verifier la sante des providers
curl -s http://localhost:8012/api/admin/ai-engine/health | python3 -m json.tool 2>/dev/null

# Verifier les collections knowledge
curl -s http://localhost:8012/api/admin/ai-engine/knowledge | python3 -m json.tool 2>/dev/null | head -20
```

### 16.3 Alertes recommandees

1. **Alerte critique** : Echec de dechiffrement de cle API (indique une possible corruption ou rotation de cle de chiffrement)
2. **Alerte elevee** : Taux d'erreur 5xx > 5% sur les endpoints Knowledge ou API Keys
3. **Alerte moyenne** : Latence > 5s sur les operations d'edition (potentiel probleme DB)
4. **Alerte faible** : Nombre de collections desactivees > 50% du total (nettoyage necessaire)

### 16.4 Revue periodique

| Frequence | Action |
|-----------|--------|
| Quotidien | Verifier les logs pour erreurs liees aux cles API |
| Hebdomadaire | Verifier la taille de la base de connaissances et la latence |
| Mensuel | Rotation de la cle de chiffrement (recommande) |
| Trimestriel | Audit de securite des cles API stockees |
