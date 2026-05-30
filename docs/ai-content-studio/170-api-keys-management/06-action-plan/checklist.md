# Checklist d'Implementation - Gestion des Cles API

> Module : 170 - API Keys Management
> Date : 2026-05-25
> Utilisation : Cocher chaque item au fur et a mesure de l'implementation.
> Convention : [x] = fait, [ ] = a faire, [~] = en cours, [!] = bloque

---

## 1. Pre-vol securite (Security Pre-flight)

> A completer AVANT tout code. Si un item est manquant, ne pas commencer le developpement.

- [ ] `AI_ENGINE_ENCRYPTION_KEY` generee avec `openssl rand -base64 32` (>= 32 caracteres)
- [ ] `AI_ENGINE_ENCRYPTION_SALT` generee avec `openssl rand -base64 16` (>= 16 caracteres)
- [ ] Variables ajoutees dans `.env.local` (developpement)
- [ ] Variables ajoutees dans `.env.test` avec des **valeurs de test uniquement**
- [ ] Variables ajoutees dans `.env.example` avec des **placeholders** (jamais de vraies valeurs)
- [ ] Variables configurees dans le pipeline CI/CD (staging)
- [ ] Variables configurees dans le pipeline CI/CD (production) -- a faire avant le deploiement prod
- [ ] Permissions fichier `.env*` verifiees (0600 sur le serveur)
- [ ] Verification : l'application demarre sans les variables (mode degradation gracieuse)

---

## 2. Backend - Base de donnees

- [ ] Schema Drizzle `aiEngineApiKeys` ajoute dans `schema-ai-engine.ts`
  - [ ] Table `ai_engine_api_key` avec tous les champs (id, providerType, encryptedKey, maskedKey, ...)
  - [ ] Index `ai_ak_provider_type_idx` (provider_type, is_active)
  - [ ] Index `ai_ak_active_idx` (is_active, priority)
  - [ ] Index unique partiel `ai_ak_unique_active_provider` (provider_type WHERE is_active = true)
- [ ] Schema Drizzle `aiEngineAuditLog` ajoute (si pas deja existant)
  - [ ] Index `ai_audit_action_idx` (action, created_at)
  - [ ] Index `ai_audit_entity_idx` (entity_type, entity_id)
  - [ ] Index `ai_audit_actor_idx` (actor_email, created_at)
- [ ] Migration SQL generee avec `drizzle-kit generate:pg`
- [ ] Migration SQL revue manuellement (pas de DROP, pas de donnees sensibles)
- [ ] Migration appliquee en local avec `drizzle-kit push:pg`
- [ ] Tables et index verifies en base (`\dt`, `\di`)
- [ ] Script de rollback prepare (`DROP TABLE IF EXISTS ai_engine_api_key`)

---

## 3. Backend - Service de chiffrement (EncryptionService)

- [ ] Fichier cree : `apps/web/src/lib/ai-engine/services/encryption-service.ts`
- [ ] Classe `EncryptionService` implementee :
  - [ ] Constructeur avec derivation PBKDF2 (SHA-512, 100 000 iterations, 32 octets)
  - [ ] `isAvailable()` : retourne `true` si la cle derivee est disponible
  - [ ] `encrypt(plaintext)` : AES-256-GCM, IV aleatoire 12 octets, format `base64(iv):base64(authTag):base64(cipher)`
  - [ ] `decrypt(encrypted)` : parsing, verification authTag, dechiffrement
  - [ ] `mask(plaintext)` : detection des prefixes (sk-proj-, sk-ant-api03-, sk-ant-, sk-, AIza, gsk_, http://, https://), 4 derniers caracteres
- [ ] Singleton `getEncryptionService()` implemente
- [ ] `resetEncryptionService()` implemente (pour les tests)
- [ ] **SECURITE** : la cle derivee est `private` et n'est jamais exposee
- [ ] **SECURITE** : les erreurs de dechiffrement ne contiennent pas le plaintext

---

## 4. Backend - Gestionnaire de cles (ApiKeyManager)

- [ ] Fichier cree : `apps/web/src/lib/ai-engine/services/api-key-manager.ts`
- [ ] Classe `ApiKeyManager` implementee :
  - [ ] `listAll()` : retourne les 5 fournisseurs avec cles masquees
  - [ ] `createOrUpdate(providerType, apiKey, session, options)` : chiffre, desactive l'ancienne, insere
  - [ ] `deleteKey(keyId, session)` : supprime, retourne info fallback
  - [ ] `resolveApiKey(providerType)` : chaine DB > env > none
  - [ ] `testKey(providerType, session, apiKey?, baseUrl?)` : delegue a ApiKeyValidator
  - [ ] `invalidateCache(providerType?)` : vide le cache
- [ ] Cache en memoire implemente (Map, TTL 5 minutes)
- [ ] Cache invalide automatiquement apres create/update/delete
- [ ] Audit log appele pour chaque operation (create, update, delete, test, decryption_failed)
- [ ] Singleton `getApiKeyManager()` implemente
- [ ] `resetApiKeyManager()` implemente (pour les tests)
- [ ] **SECURITE** : `listAll()` ne retourne jamais `encryptedKey` ni `apiKey`
- [ ] **SECURITE** : l'audit log ne contient jamais la cle en clair

---

## 5. Backend - Validateur de cles (ApiKeyValidator)

- [ ] Fichier cree : `apps/web/src/lib/ai-engine/services/api-key-validator.ts`
- [ ] Validation par fournisseur implementee :
  - [ ] OpenAI : GET /v1/models
  - [ ] Anthropic : POST /v1/messages (minimal, max_tokens=1)
  - [ ] Google AI : GET /v1/models?key=
  - [ ] ElevenLabs : GET /v1/user
  - [ ] Ollama : GET {baseUrl}/api/tags
- [ ] Timeout global 10 secondes (AbortController)
- [ ] Mapping erreurs HTTP -> messages utilisateur (401, 403, 429, 5xx, timeout)
- [ ] Classe `HttpProviderError` creee

---

## 6. Backend - Routes API

- [ ] Route GET + POST creee : `api-keys/route.ts`
  - [ ] GET : `requireAdminApi()`, appel `listAll()`, headers anti-cache
  - [ ] POST : `requireAdminApi()`, validation Zod, appel `createOrUpdate()`, headers anti-cache
- [ ] Route DELETE creee : `api-keys/[id]/route.ts`
  - [ ] DELETE : `requireAdminApi()`, appel `deleteKey()`
- [ ] Route POST test creee : `api-keys/test/route.ts`
  - [ ] POST : `requireAdminApi()`, rate limiting (5/min), appel `testKey()`
- [ ] `export const runtime = 'nodejs'` sur chaque fichier route
- [ ] `export const dynamic = 'force-dynamic'` sur chaque fichier route
- [ ] Schemas Zod de validation definis (providerType enum, apiKey string min 1, etc.)
- [ ] Gestion d'erreurs avec codes specifiques (ENCRYPTION_KEY_MISSING, VALIDATION_FAILED, etc.)
- [ ] **SECURITE** : toutes les routes commencent par `requireAdminApi()`
- [ ] **SECURITE** : aucune reponse ne contient `encryptedKey` ou `apiKey` en clair
- [ ] **SECURITE** : headers `Cache-Control: no-store` et `Pragma: no-cache` sur toutes les reponses

---

## 7. Backend - Integration engine-config.ts

- [ ] `engine-config.ts` modifie pour utiliser `ApiKeyManager.resolveApiKey()`
- [ ] Compatibilite ascendante maintenue (fonctionne sans `AI_ENGINE_ENCRYPTION_KEY`)
- [ ] Health check modifie pour inclure `keySource` (database/env/none)
- [ ] Health check modifie pour inclure `lastTestResult` et `lastTestAt`

---

## 8. Frontend - MSW Handlers

- [ ] Handlers MSW ajoutes dans `test/msw/ai-engine-handlers.ts`
  - [ ] GET /api-keys : retourne MOCK_API_KEYS (5 fournisseurs)
  - [ ] POST /api-keys : simule creation avec masquage
  - [ ] DELETE /api-keys/:id : simule suppression avec fallback
  - [ ] POST /api-keys/test : simule validation (succes/echec)
- [ ] Handlers d'erreur crees :
  - [ ] 401 : session expiree (toutes les routes)
  - [ ] 400 : validation Zod echouee
  - [ ] 409 : conflit (cle existante)
  - [ ] 429 : rate limit depasse
  - [ ] 500 : chiffrement non configure
  - [ ] 503 : DB indisponible
- [ ] Fixtures de donnees creees (`MOCK_API_KEYS`, `MOCK_META`)
- [ ] **SECURITE** : aucun handler ne retourne de cle en clair

---

## 9. Frontend - Composants UI

- [ ] Type `Tab` modifie : ajout de `'api-keys'`
- [ ] Onglet "Cles API" ajoute dans la navigation (icone `Key`)
- [ ] Stat card "Cles configurees" ajoutee
- [ ] Composant `ApiKeysTabContent` implemente (grille + formulaire conditionnel)
- [ ] Composant `ApiKeyCard` implemente :
  - [ ] Barre de statut coloree (3px)
  - [ ] Icone fournisseur + nom + label
  - [ ] `KeyMaskDisplay` avec badge source
  - [ ] `ApiKeyStatusIndicator` (valide/invalide/testing/none)
  - [ ] Boutons d'action (Tester/Editer/Supprimer/Configurer)
  - [ ] Rendu conditionnel selon `source` (none/env/database)
- [ ] Composant `ApiKeyForm` implemente :
  - [ ] Select fournisseur (filtre en mode create, desactive en mode edit)
  - [ ] Input `type="password"` avec `autoComplete="off"`
  - [ ] Toggle visibilite (oeil) avec auto-masquage 5 secondes
  - [ ] Validation en temps reel du format de cle
  - [ ] Champ label optionnel
  - [ ] Champ baseUrl (Ollama uniquement)
  - [ ] Boutons Sauvegarder et Annuler
- [ ] Data-testid ajoutes sur tous les elements interactifs
- [ ] Navigation clavier fonctionnelle (Tab, Enter, Escape)
- [ ] **SECURITE** : `useEffect` cleanup qui vide `apiKey` du state a la fermeture du formulaire

---

## 10. Frontend - State Management et integration

- [ ] States ajoutes dans `AIEngineConfigPage` :
  - [ ] `apiKeys: ApiKeyData[]`
  - [ ] `loadingKeys: boolean`
  - [ ] `keysError: string | null`
  - [ ] `showApiKeyForm: boolean`
  - [ ] `apiKeyFormMode: 'create' | 'edit'`
  - [ ] `apiKeyFormProvider: string | null`
  - [ ] `savingApiKey: boolean`
  - [ ] `testingApiKeyProvider: string | null`
  - [ ] `deletingApiKeyId: string | null`
- [ ] Callbacks `useCallback` implementes :
  - [ ] `fetchApiKeys()` : GET /api-keys
  - [ ] `handleSaveApiKey()` : POST /api-keys + toast + refetch
  - [ ] `handleDeleteApiKey()` : confirm + DELETE + toast + refetch
  - [ ] `handleTestApiKey()` : POST /test + refetch
- [ ] Chargement paresseux : fetch uniquement quand `tab === 'api-keys'`
- [ ] Squelettes de chargement (5 cartes shimmer)
- [ ] Etat vide (EmptyState avec CTA "Ajouter une cle")
- [ ] Gestion des erreurs : toast.error pour 401, 422, 429, 500

---

## 11. Validation securite

- [ ] Grep dans les sources : aucune cle API reelle dans le code
  ```bash
  grep -rn "sk-proj-[^t]\|sk-ant-[^t]" apps/web/src/ --include="*.ts" --include="*.tsx" | grep -v test
  ```
- [ ] Grep dans les reponses serialisees : aucun champ `encryptedKey` dans les types de reponse
- [ ] Verification DOM : aucune cle en clair dans le HTML rendu (test E2E-AK-14)
- [ ] Verification localStorage/sessionStorage : aucune cle stockee (test E2E-AK-16)
- [ ] Verification reponses reseau : aucune cle en clair (test E2E-AK-17)
- [ ] Verification audit log : aucune cle en clair dans les entrees d'audit (test T-SEC-02)
- [ ] Verification base de donnees : colonne `encrypted_key` contient du format `base64:base64:base64`
- [ ] Headers de securite verifies : `Cache-Control: no-store`, `Pragma: no-cache`

---

## 12. Tests

### 12.1 Tests unitaires (Vitest)

- [ ] `encryption-service.test.ts` : 12 tests
  - [ ] Round-trip pour chaque fournisseur
  - [ ] IV unicite
  - [ ] Tamper detection (ciphertext + authTag)
  - [ ] Cle master differente
  - [ ] Salt different
  - [ ] Format invalide
  - [ ] Service indisponible
  - [ ] Format de stockage valide
  - [ ] Masquage (tous les prefixes)
- [ ] `api-key-manager.test.ts` : 10 tests
- [ ] `api-key-validator.test.ts` : 4 tests
- [ ] `route.test.ts` : 7 tests (GET + POST)
- [ ] `route-delete.test.ts` : 3 tests
- [ ] `route-test.test.ts` : 4 tests
- [ ] `api-keys-security.test.ts` : 6 tests de securite transverse
- [ ] `api-key-card.test.tsx` : 5 tests RTL
- [ ] `api-key-form.test.tsx` : 6 tests RTL
- [ ] `key-mask-display.test.tsx` : 3 tests RTL

### 12.2 Tests E2E (Playwright)

- [ ] `api-keys-crud.spec.ts` : 8 scenarios
- [ ] `api-keys-ux.spec.ts` : 6 scenarios (dont mobile + clavier)
- [ ] `api-keys-security.spec.ts` : 4 scenarios (DOM, storage, network)

### 12.3 Couverture

- [ ] `encryption-service.ts` : >= 95%
- [ ] `api-key-manager.ts` : >= 90%
- [ ] Routes API (`api-keys/**`) : >= 85%
- [ ] Globale : >= 88%

### 12.4 Execution CI

- [ ] Tous les tests Vitest passent (exit code 0)
- [ ] Tous les tests Playwright passent (exit code 0)
- [ ] Rapport de couverture genere et conforme aux seuils

---

## 13. Post-implementation

- [ ] Revue de code securite effectuee par un pair
- [ ] Variables d'environnement configurees en production
- [ ] Migration de base de donnees appliquee en staging
- [ ] Verification manuelle sur staging (CRUD complet + test + masquage)
- [ ] Documentation de la procedure de rotation de la cle master (lien vers `07-runbook/runbook.md`)
- [ ] Backup de `AI_ENGINE_ENCRYPTION_KEY` dans un endroit securise hors serveur
- [ ] Monitoring / alertes configurees pour `api_key.decryption_failed` dans l'audit log

---

## 14. Resume des compteurs

| Categorie | Items | Fait |
|-----------|-------|------|
| Pre-vol securite | 9 | 0 |
| Base de donnees | 8 | 0 |
| EncryptionService | 10 | 0 |
| ApiKeyManager | 13 | 0 |
| ApiKeyValidator | 7 | 0 |
| Routes API | 12 | 0 |
| Integration engine-config | 4 | 0 |
| MSW Handlers | 11 | 0 |
| Composants UI | 19 | 0 |
| State Management | 13 | 0 |
| Validation securite | 8 | 0 |
| Tests | 17 | 0 |
| Post-implementation | 7 | 0 |
| **Total** | **138** | **0** |
