# Plan d'Action - Gestion des Cles API

> Module : 170 - API Keys Management
> Estimation totale : 5-7 jours de developpement
> Date de creation : 2026-05-25
> Pre-requis : Acces au repository, PostgreSQL running, variables d'env configurees

---

## 1. Resume du plan

Le plan d'action se decompose en **18 etapes** organisees en 6 phases :

```
Phase 1 : Securite & Infrastructure (Etapes 1-3)     ~0.5 jour
Phase 2 : Backend - Services (Etapes 4-7)             ~1.5 jours
Phase 3 : Backend - Routes API (Etapes 8-9)           ~1 jour
Phase 4 : Frontend - UI (Etapes 10-12)                ~1 jour
Phase 5 : Tests & Securite (Etapes 13-16)             ~1.5 jours
Phase 6 : Validation & Deploiement (Etapes 17-18)     ~0.5 jour
```

---

## 2. Phase 1 : Securite & Infrastructure

### Etape 1 : Configuration des variables d'environnement de chiffrement

**Duree estimee** : 15 minutes
**Pre-requis** : Acces aux fichiers d'environnement

**Actions** :
1. Generer la cle master de chiffrement :
   ```bash
   openssl rand -base64 32
   ```
2. Generer le salt PBKDF2 :
   ```bash
   openssl rand -base64 16
   ```
3. Ajouter les variables dans `.env.local` (developpement) :
   ```env
   AI_ENGINE_ENCRYPTION_KEY=<valeur-generee>
   AI_ENGINE_ENCRYPTION_SALT=<valeur-generee>
   ```
4. Ajouter les variables dans `.env.test` (tests) :
   ```env
   AI_ENGINE_ENCRYPTION_KEY=test-master-key-for-unit-tests-only-32chars!
   AI_ENGINE_ENCRYPTION_SALT=test-salt-16chars!
   ```
5. Documenter les variables dans le `.env.example`
6. Configurer les variables dans le CI/CD (staging et production)

**Verification** : Les variables sont accessibles via `process.env` dans un script Node.js minimal.

**Livrable** : Variables d'environnement configurees sur tous les environnements.

---

### Etape 2 : Migration de base de donnees (table ai_engine_api_key)

**Duree estimee** : 30 minutes
**Pre-requis** : Etape 1 terminee, PostgreSQL accessible

**Actions** :
1. Ajouter le schema Drizzle dans `apps/web/src/lib/db/schema-ai-engine.ts` :
   - Table `ai_engine_api_key` (voir `01-architecture/architecture-backend.md` section 3.1)
   - Table `ai_engine_audit_log` si elle n'existe pas deja (section 3.2)
2. Generer la migration SQL :
   ```bash
   cd apps/web && npx drizzle-kit generate:pg
   ```
3. Reviser le fichier SQL genere
4. Appliquer la migration en local :
   ```bash
   npx drizzle-kit push:pg
   ```
5. Verifier la creation des tables et index :
   ```sql
   \dt ai_engine_api_key
   \di ai_ak_*
   ```

**Verification** : La table `ai_engine_api_key` existe avec tous les index (provider_type_idx, active_idx, unique_active_provider).

**Livrable** : Migration SQL creee et appliquee.

---

### Etape 3 : Ajout des variables d'environnement au schema de configuration

**Duree estimee** : 15 minutes
**Pre-requis** : Etape 1 terminee

**Actions** :
1. Ajouter la validation Zod des nouvelles variables dans le fichier de configuration applicatif
2. Ajouter les checks de sante pour `AI_ENGINE_ENCRYPTION_KEY` et `AI_ENGINE_ENCRYPTION_SALT`
3. Verifier que l'application demarre correctement sans ces variables (mode degradation gracieuse : seules les env vars fonctionnent)

**Verification** : L'application demarre avec et sans les variables de chiffrement.

**Livrable** : Schema de configuration mis a jour.

---

## 3. Phase 2 : Backend - Services

### Etape 4 : Service de chiffrement (EncryptionService)

**Duree estimee** : 2 heures
**Pre-requis** : Etapes 1-3 terminees

**Actions** :
1. Creer le fichier `apps/web/src/lib/ai-engine/services/encryption-service.ts`
2. Implementer la classe `EncryptionService` selon les specifications de `03-backend/service-layer.md` section 2 :
   - Constructeur avec derivation PBKDF2 (SHA-512, 100 000 iterations)
   - Methode `encrypt(plaintext)` : AES-256-GCM avec IV aleatoire 12 octets
   - Methode `decrypt(encrypted)` : parsing format `iv:authTag:ciphertext`, verification integrite
   - Methode `mask(plaintext)` : detection de prefixe + 4 derniers caracteres
   - Methode `isAvailable()` : verification cle derivee
3. Implementer le pattern singleton `getEncryptionService()` et `resetEncryptionService()`
4. Ajouter les exports dans l'index du module

**Verification de securite** :
- [ ] La cle derivee n'est jamais exposee en dehors de la classe
- [ ] Les IV sont generes avec `crypto.randomBytes()` (CSPRNG)
- [ ] Les erreurs de dechiffrement ne fuient pas d'information sensible
- [ ] `resetEncryptionService()` met a null la reference au singleton

**Livrable** : `encryption-service.ts` complet et pret pour les tests.

---

### Etape 5 : Gestionnaire de cles (ApiKeyManager)

**Duree estimee** : 3 heures
**Pre-requis** : Etape 4 terminee

**Actions** :
1. Creer le fichier `apps/web/src/lib/ai-engine/services/api-key-manager.ts`
2. Implementer la classe `ApiKeyManager` selon `03-backend/service-layer.md` section 3 :
   - `listAll()` : liste les 5 fournisseurs (DB + env + none)
   - `createOrUpdate(providerType, apiKey, session, options)` : chiffre, desactive l'ancienne, insere la nouvelle
   - `deleteKey(keyId, session)` : supprime, verifie fallback env var
   - `resolveApiKey(providerType)` : chaine DB > env > none avec cache
   - `testKey(providerType, session, apiKey?, baseUrl?)` : delegue a ApiKeyValidator
   - `invalidateCache(providerType?)` : vide le cache en memoire
3. Implementer le cache en memoire (Map, TTL 5 minutes)
4. Implementer le logging d'audit (`insertAuditLog`)
5. Implementer le singleton `getApiKeyManager()` et `resetApiKeyManager()`

**Verification de securite** :
- [ ] `listAll()` ne retourne jamais `encryptedKey` ni `apiKey` en clair
- [ ] `createOrUpdate()` chiffre la cle AVANT le stockage
- [ ] `deleteKey()` ne retourne pas la cle supprimee
- [ ] `resolveApiKey()` log une alerte securite si le dechiffrement echoue
- [ ] L'audit log ne contient jamais de cle en clair

**Livrable** : `api-key-manager.ts` complet.

---

### Etape 6 : Validateur de cles (ApiKeyValidator)

**Duree estimee** : 1.5 heures
**Pre-requis** : Aucun (independant)

**Actions** :
1. Creer le fichier `apps/web/src/lib/ai-engine/services/api-key-validator.ts`
2. Implementer selon `03-backend/service-layer.md` section 4 :
   - `validate(providerType, apiKey, baseUrl?)` : appel minimal au fournisseur
   - `testOpenAI()` : GET /v1/models
   - `testAnthropic()` : POST /v1/messages (minimal)
   - `testGoogle()` : GET /v1/models?key=
   - `testElevenLabs()` : GET /v1/user
   - `testOllama()` : GET {baseUrl}/api/tags
3. Implementer le timeout global (10 secondes, AbortController)
4. Implementer le mapping d'erreurs HTTP -> messages utilisateur
5. Creer la classe `HttpProviderError`

**Verification de securite** :
- [ ] La cle API n'est jamais logguee meme en cas d'erreur
- [ ] Le timeout empeche les attaques de type slow-loris

**Livrable** : `api-key-validator.ts` complet.

---

### Etape 7 : Integration avec engine-config.ts (resolution DB)

**Duree estimee** : 1 heure
**Pre-requis** : Etapes 4-5 terminees

**Actions** :
1. Modifier `apps/web/src/lib/ai-engine/config/engine-config.ts`
2. Remplacer les lectures directes de `process.env` par des appels a `ApiKeyManager.resolveApiKey()`
3. Maintenir la compatibilite ascendante :
   - Si `AI_ENGINE_ENCRYPTION_KEY` est absente, le comportement est identique a l'existant
   - Si aucune cle DB n'existe, les env vars sont utilisees
4. Modifier le health check pour inclure la source de la cle

**Verification** :
- [ ] L'application fonctionne identiquement si aucune cle DB n'est configuree
- [ ] La cle DB est utilisee en priorite si elle existe
- [ ] Le health check affiche la source correcte

**Livrable** : `engine-config.ts` modifie avec resolution DB > env.

---

## 4. Phase 3 : Backend - Routes API

### Etape 8 : Routes CRUD (GET, POST, DELETE)

**Duree estimee** : 2 heures
**Pre-requis** : Etapes 4-6 terminees

**Actions** :
1. Creer `apps/web/src/app/api/admin/ai-engine/config/api-keys/route.ts` :
   - `GET` : appelle `ApiKeyManager.listAll()`
   - `POST` : appelle `ApiKeyManager.createOrUpdate()` avec validation Zod
2. Creer `apps/web/src/app/api/admin/ai-engine/config/api-keys/[id]/route.ts` :
   - `DELETE` : appelle `ApiKeyManager.deleteKey()`
3. Ajouter `requireAdminApi()` sur chaque handler
4. Ajouter les schemas Zod de validation (selon `03-backend/api-routes.md`)
5. Ajouter les headers de securite (`Cache-Control: no-store`, `Pragma: no-cache`)
6. Implementer la gestion d'erreurs avec codes specifiques

**Verification de securite** :
- [ ] Toutes les routes commencent par `const session = await requireAdminApi()`
- [ ] Aucune reponse ne contient `encryptedKey` ou `apiKey` en clair
- [ ] Les erreurs Zod ne fuient pas d'information sensible
- [ ] Les headers anti-cache sont presents

**Livrable** : 3 fichiers route.ts fonctionnels.

---

### Etape 9 : Route de test de validite + rate limiting

**Duree estimee** : 1 heure
**Pre-requis** : Etapes 6 et 8 terminees

**Actions** :
1. Creer `apps/web/src/app/api/admin/ai-engine/config/api-keys/test/route.ts` :
   - `POST` : validation Zod, rate limiting, appel a `ApiKeyValidator.validate()`
2. Implementer le rate limiter (5 requetes/minute par session)
3. Mettre a jour le `lastTestedAt` et `lastTestResult` en base apres test
4. Ajouter l'entree d'audit log

**Verification** :
- [ ] Le rate limit fonctionne (5 requetes OK, 6e rejetee avec 429)
- [ ] La cle testee n'apparait pas dans la reponse
- [ ] L'audit log contient le resultat du test mais pas la cle

**Livrable** : Route POST /test fonctionnelle avec rate limiting.

---

## 5. Phase 4 : Frontend - UI

### Etape 10 : Handlers MSW pour les tests frontend

**Duree estimee** : 45 minutes
**Pre-requis** : Etape 8 terminee (contrats API definis)

**Actions** :
1. Modifier `apps/web/test/msw/ai-engine-handlers.ts`
2. Ajouter les handlers nominaux (GET, POST, DELETE, POST /test) selon `05-tests/msw-handlers.md`
3. Ajouter les handlers d'erreur (401, 400, 409, 429, 500, 503)
4. Creer les fixtures de donnees mockees (`MOCK_API_KEYS`)
5. Verifier que les handlers ne retournent jamais de cle en clair

**Livrable** : Handlers MSW complets et exportes.

---

### Etape 11 : Onglet Cles API et composants UI

**Duree estimee** : 3 heures
**Pre-requis** : Etapes 8 et 10 terminees

**Actions** :
1. Modifier `apps/web/src/app/admin/content-studio-v2/ai-engine/config/page.tsx` :
   - Ajouter `'api-keys'` au type `Tab`
   - Ajouter l'onglet dans la navigation (icone `Key`)
   - Ajouter la stat card "Cles configurees"
2. Implementer les composants inline (selon `04-frontend/components.md`) :
   - `ApiKeysTabContent` : orchestration, grille de cartes
   - `ApiKeyCard` : carte par fournisseur avec statut et actions
   - `ApiKeyForm` : formulaire d'ajout/edition securise
   - `ApiKeyStatusIndicator` : badge de statut (valide/invalide/testing/none)
   - `KeyMaskDisplay` : affichage masque + badge source
3. Ajouter les data-testid pour les tests E2E
4. Implementer la navigation clavier (Tab, Enter, Escape)

**Verification de securite** :
- [ ] Le champ de saisie est `type="password"` avec `autoComplete="off"`
- [ ] Le state `apiKey` est nettoye a la fermeture du formulaire (`useEffect` cleanup)
- [ ] Le toggle de visibilite a un auto-masquage apres 5 secondes

**Livrable** : Onglet "Cles API" fonctionnel dans l'interface.

---

### Etape 12 : Integration state management et appels API

**Duree estimee** : 1.5 heures
**Pre-requis** : Etape 11 terminee

**Actions** :
1. Ajouter les states de gestion des cles dans `AIEngineConfigPage` (selon `04-frontend/state-management.md`) :
   - `apiKeys`, `loadingKeys`, `keysError`
   - `showApiKeyForm`, `apiKeyFormMode`, `apiKeyFormProvider`
   - `savingApiKey`, `testingApiKeyProvider`, `deletingApiKeyId`
2. Implementer les callbacks `useCallback` :
   - `fetchApiKeys()` : GET /api-keys
   - `handleSaveApiKey()` : POST /api-keys
   - `handleDeleteApiKey()` : DELETE /api-keys/:id
   - `handleTestApiKey()` : POST /api-keys/test
3. Implementer le chargement paresseux (charge uniquement quand l'onglet est actif)
4. Implementer les toasts de feedback (sonner)
5. Implementer la gestion des erreurs (toast.error pour 422, 429, 500)

**Verification** :
- [ ] Le state `apiKey` n'est jamais dans le composant parent
- [ ] Les toasts n'affichent pas de cle en clair
- [ ] Le re-fetch est declenche apres chaque operation CRUD

**Livrable** : Integration complete frontend-backend.

---

## 6. Phase 5 : Tests & Securite

### Etape 13 : Tests unitaires EncryptionService

**Duree estimee** : 1 heure
**Pre-requis** : Etape 4 terminee

**Actions** :
1. Creer `encryption-service.test.ts` avec les 12 cas de test decrits dans `05-tests/vitest-specs.md`
2. Verifier la couverture >= 95%
3. Executer et corriger jusqu'a 100% des tests passes

**Livrable** : 12 tests passes, couverture >= 95%.

---

### Etape 14 : Tests unitaires ApiKeyManager + Routes API

**Duree estimee** : 2 heures
**Pre-requis** : Etapes 5, 8, 9 terminees

**Actions** :
1. Creer `api-key-manager.test.ts` avec les 10 cas de test
2. Creer `route.test.ts` avec les 7 cas de test (GET + POST)
3. Creer `route-delete.test.ts` avec les 3 cas de test
4. Creer `route-test.test.ts` avec les 4 cas de test
5. Creer `api-key-validator.test.ts` avec les 4 cas de test
6. Verifier la couverture >= 85% sur les routes
7. Executer et corriger

**Livrable** : 28 tests passes, couverture routes >= 85%.

---

### Etape 15 : Tests de securite + composants + E2E

**Duree estimee** : 2.5 heures
**Pre-requis** : Etapes 11-12 terminees

**Actions** :
1. Creer `api-keys-security.test.ts` avec les 6 cas de test de securite transverse
2. Creer les tests RTL : `api-key-card.test.tsx` (5 tests), `api-key-form.test.tsx` (6 tests), `key-mask-display.test.tsx` (3 tests)
3. Creer les tests E2E Playwright :
   - `api-keys-crud.spec.ts` (8 scenarios)
   - `api-keys-ux.spec.ts` (6 scenarios)
   - `api-keys-security.spec.ts` (4 scenarios)
4. Executer et corriger

**Livrable** : 20 tests Vitest + 17 tests E2E passes.

---

### Etape 16 : Audit de securite et tests de penetration

**Duree estimee** : 1.5 heures
**Pre-requis** : Toutes les etapes 1-15 terminees

**Actions** :
1. Grep pour les fuites de cles :
   ```bash
   grep -rn "sk-proj\|sk-ant\|AIzaSy\|encryptedKey" apps/web/src/ --include="*.ts" --include="*.tsx" | grep -v test | grep -v __tests__ | grep -v mock
   ```
2. Verifier les reponses HTTP brutes :
   - Demarrer l'application en local
   - Utiliser curl ou un proxy HTTP pour inspecter les reponses
   - Verifier qu'aucune cle en clair n'est presente
3. Inspecter le DOM dans le navigateur :
   - Ouvrir les DevTools
   - Chercher des cles dans le HTML rendu
   - Verifier que les React DevTools ne montrent pas de cle dans le state parent
4. Verifier les logs applicatifs :
   ```bash
   grep -i "apikey\|api_key\|encryptedKey\|sk-proj\|sk-ant" logs/*.log
   ```
5. Verifier la base de donnees :
   ```sql
   SELECT encrypted_key FROM ai_engine_api_key LIMIT 5;
   -- Doit retourner des chaines au format base64:base64:base64, jamais du texte lisible
   ```
6. Verifier les headers de securite :
   ```bash
   curl -I https://localhost:3000/api/admin/ai-engine/config/api-keys
   # Doit contenir Cache-Control: no-store
   ```

**Livrable** : Rapport de securite OK / liste des issues a corriger.

---

## 7. Phase 6 : Validation & Deploiement

### Etape 17 : Boucle de correction

**Duree estimee** : 1-2 heures (variable)
**Pre-requis** : Etape 16 terminee

**Actions** :
1. Corriger toutes les issues identifiees lors de l'audit de securite
2. Re-executer les tests apres chaque correction
3. Verifier que la couverture reste >= aux seuils
4. Mettre a jour les tests si necessaire
5. Faire une revue de code focalisee securite

**Livrable** : Zero issue de securite ouverte, tous les tests passes.

---

### Etape 18 : Deploiement staging et verification

**Duree estimee** : 30 minutes
**Pre-requis** : Etape 17 terminee, variables d'env configurees en staging

**Actions** :
1. Verifier que les variables d'environnement sont configurees sur staging :
   ```bash
   # Sur le serveur staging
   echo $AI_ENGINE_ENCRYPTION_KEY | wc -c  # Doit etre >= 32
   echo $AI_ENGINE_ENCRYPTION_SALT | wc -c  # Doit etre >= 16
   ```
2. Deployer sur staging
3. Executer la migration de base de donnees
4. Verifier manuellement :
   - Naviguer vers l'onglet "Cles API"
   - Ajouter une cle de test
   - Verifier l'affichage masque
   - Tester la cle
   - Supprimer la cle
5. Verifier les logs pour absence de cle en clair
6. Verifier la base de donnees pour confirmer le chiffrement

**Livrable** : Fonctionnalite deployee et verifiee sur staging.

---

## 8. Diagramme de Gantt simplifie

```
Jour 1 : |=== Phase 1 (E1-E3) ===|=== Phase 2 (E4-E5) ================|
Jour 2 : |=== Phase 2 (E5-E6) ==============|=== Phase 2 (E7) ========|
Jour 3 : |=== Phase 3 (E8-E9) ====================================== |
Jour 4 : |=== Phase 4 (E10-E12) ====================================|
Jour 5 : |=== Phase 5 (E13-E14) ====================================|
Jour 6 : |=== Phase 5 (E15-E16) ====================================|
Jour 7 : |=== Phase 6 (E17-E18) ==============|  DONE
```

---

## 9. Criteres de completion (Definition of Done)

- [ ] Les 18 etapes sont completees
- [ ] 60 tests Vitest passes (0 echecs)
- [ ] 17 tests E2E Playwright passes (0 echecs)
- [ ] Couverture >= 95% sur `encryption-service.ts`
- [ ] Couverture >= 90% sur `api-key-manager.ts`
- [ ] Couverture >= 85% sur les routes API
- [ ] Audit de securite : 0 fuite de cle en clair
- [ ] Grep sur le code : 0 cle reelle dans les sources
- [ ] Variables d'environnement configurees en staging et production
- [ ] Migration de base de donnees appliquee
- [ ] Deploiement staging verifie manuellement
