# Rapport d'audit approfondi — Gaps de tests

> **Date** : 2026-05-26  
> **Branche** : `feat/ai-engine-langgraph-mvp`  
> **Commit** : `c46e9b2`  
> **Scope** : Feature 1 (Knowledge Edit) + Feature 2 (API Keys Management)  
> **Juge** : Claude Opus 4.7 (1M context) — evaluation mode `deep`  
> **Methode** : Audit exhaustif source vs tests, 3 agents paralleles (backend, routes, frontend)

---

## Vue d'ensemble

| Couche | Scenarios identifies | Testes | **Non testes** | Taux de couverture |
|--------|---------------------|--------|----------------|-------------------|
| Backend Services | 138 | 47 | **91** | 34% |
| API Routes | 82 | 0 | **82** | 0% |
| Frontend UI (operateur) | ~94 | 30 | **~64** | 32% |
| **TOTAL** | **~314** | **77** | **~237** | **25%** |

### Repartition par severite des gaps

| Severite | Nombre de gaps | Description |
|----------|---------------|-------------|
| P0 — Critique | ~45 | Securite, integrite des donnees, failles exploitables |
| P1 — Majeur | ~85 | Logique metier, flux utilisateur complets, validations |
| P2 — Modere | ~70 | Edge cases, etats UI, feedback visuel |
| P3 — Mineur | ~37 | Polish, micro-interactions, cas limites rares |

---

## 1. TROUS CRITIQUES (P0) — Securite & Integrite des donnees

### 1.1 `api-key-manager.ts` — 41 scenarios, 0 testes

**Fichier** : `apps/web/src/lib/ai-engine/services/api-key-manager.ts` (298 lignes)  
**Verdict** : Le fichier le plus critique du systeme n'a **AUCUN** test.

#### `resolveEnvKey()` — Resolution des variables d'environnement

| # | Scenario | Teste ? | Prio | Lignes |
|---|----------|---------|------|--------|
| 1 | Itere `ENV_KEY_MAP`, retourne le premier match | NON | P0 | L26-32 |
| 2 | Aucune env var definie → retourne undefined | NON | P1 | L26-32 |
| 3 | Provider inconnu → tableau vide, retourne undefined | NON | P1 | L28 |
| 4 | Ordre de priorite (AI_ENGINE_ avant CHAT_ avant generique) | NON | P0 | L18-24 |

**Risque** : L'ordre de priorite des env vars determine quelle cle API est utilisee. Un bug ici peut silencieusement utiliser la mauvaise cle (ex: cle de chat au lieu de la cle AI Engine).

#### `listApiKeys()` — Listing des 5 providers

| # | Scenario | Teste ? | Prio | Lignes |
|---|----------|---------|------|--------|
| 5 | Happy path avec cles DB | NON | P0 | L55-130 |
| 6 | Provider trouve en DB (source='database') | NON | P0 | L75-91 |
| 7 | Provider trouve en env uniquement (source='env') | NON | P0 | L92-110 |
| 8 | Provider non configure (source='none') | NON | P1 | L111-128 |
| 9 | DB est null (fallback env-only) | NON | P1 | L64 |
| 10 | Ollama: prefix=8 premiers chars, baseUrl=envKey | NON | P1 | L93, L105 |
| 11 | Format de masquage different DB vs env | NON | P1 | L83, L96 |

**Risque** : `listApiKeys()` ne doit JAMAIS retourner `encryptedKey` ni la cle en clair. Ce contrat de securite est non verifie.

#### `saveApiKey()` — Sauvegarde chiffree

| # | Scenario | Teste ? | Prio | Lignes |
|---|----------|---------|------|--------|
| 12 | Happy path (encrypt, deactivate old, insert new) | NON | P0 | L137-193 |
| 13 | Desactive l'ancienne cle du meme provider | NON | P0 | L149-158 |
| 14 | No DB → throws | NON | P1 | L141 |
| 15 | No encryption service → throws | NON | P0 | L144 |
| 16 | Utilise `encryption.encrypt()` et `encryption.mask()` | NON | P0 | L146-147 |
| 17 | Invalide le cache apres sauvegarde | NON | P0 | L174 |
| 18 | Label par defaut quand non fourni | NON | P2 | L165 |
| 19 | baseUrl defaut null | NON | P2 | L168 |

**Risque** : La chaine encrypt → deactivate → insert → invalidate doit etre atomique. Un echec entre deactivate et insert laisse le provider sans cle.

#### `deleteApiKey()` — Suppression avec detection fallback

| # | Scenario | Teste ? | Prio | Lignes |
|---|----------|---------|------|--------|
| 20 | Happy path (delete + invalidate cache) | NON | P0 | L196-213 |
| 21 | Cle non trouvee → throws | NON | P1 | L205 |
| 22 | No DB → throws | NON | P1 | L199 |
| 23 | fallbackToEnv=true quand env var existe | NON | P1 | L209-212 |
| 24 | fallbackToEnv=false quand pas d'env var | NON | P1 | L209-212 |
| 25 | Invalide le cache du provider supprime | NON | P0 | L208 |

#### `testApiKey()` — Test de validite

| # | Scenario | Teste ? | Prio | Lignes |
|---|----------|---------|------|--------|
| 26 | Avec apiKey explicite en parametre | NON | P0 | L216-247 |
| 27 | Sans apiKey (resolves from DB/env) | NON | P0 | L222-226 |
| 28 | Aucune cle disponible → retourne erreur | NON | P1 | L225 |
| 29 | Met a jour DB avec resultat du test (quand cle DB) | NON | P1 | L232-247 |
| 30 | Ne met PAS a jour DB quand cle passee explicitement | NON | P1 | L233 |
| 31 | Stocke 'valid' ou le message d'erreur | NON | P1 | L239 |

#### `resolveApiKey()` — Resolution DB > env avec cache

| # | Scenario | Teste ? | Prio | Lignes |
|---|----------|---------|------|--------|
| 32 | Retourne depuis le cache (non expire) | NON | P0 | L254-255 |
| 33 | Cache expire → re-fetch | NON | P0 | L254-255 |
| 34 | Dechiffre la cle DB avec succes | NON | P0 | L274-278 |
| 35 | **Echec decrypt → fallback silencieux vers env** | NON | P0 | L279-281 |
| 36 | Pas de DB/encryption → fallback env | NON | P1 | L261 |
| 37 | Env fallback + mise en cache | NON | P1 | L287-289 |
| 38 | Aucune cle nulle part → retourne undefined | NON | P1 | fin de fonction |

**RISQUE SECURITE CRITIQUE (scenario 35)** : Si le dechiffrement echoue (cle corrompue, rotation de master key), le systeme tombe silencieusement sur la variable d'environnement. L'operateur n'est pas averti que la cle DB est inutilisable. Un log `error` est emis mais aucune alerte n'est remontee a l'UI.

#### `invalidateCache()` — Invalidation du cache

| # | Scenario | Teste ? | Prio | Lignes |
|---|----------|---------|------|--------|
| 39 | Invalidation d'un seul provider | NON | P0 | L295 |
| 40 | Invalidation de tout le cache (sans argument) | NON | P0 | L297 |
| 41 | Idempotent (invalider une cle inexistante) | NON | P2 | edge case |

---

### 1.2 `api-key-validator.ts` — 28 scenarios, 0 testes

**Fichier** : `apps/web/src/lib/ai-engine/services/api-key-validator.ts` (95 lignes)  
**Verdict** : Toutes les fonctions de validation par provider sont non testees.

#### `validateApiKey()` — Dispatch principal

| # | Scenario | Teste ? | Prio | Lignes |
|---|----------|---------|------|--------|
| 1 | Switch case: openai | NON | P0 | L26 |
| 2 | Switch case: anthropic | NON | P0 | L28 |
| 3 | Switch case: google | NON | P0 | L30 |
| 4 | Switch case: elevenlabs | NON | P0 | L32 |
| 5 | Switch case: ollama | NON | P0 | L34 |
| 6 | Ollama avec baseUrl custom | NON | P1 | L34 |
| 7 | Ollama avec baseUrl par defaut (localhost:11434) | NON | P1 | L34 |
| 8 | Provider inconnu (default case) | NON | P1 | L36 |
| 9 | Catch: Error thrown | NON | P1 | L39 |
| 10 | Catch: non-Error thrown ('Unknown error' fallback) | NON | P2 | L39 |
| 11 | latencyMs calcule correctement | NON | P2 | Date.now() - start |

#### `testOpenAI()` — GET /v1/models

| # | Scenario | Teste ? | Prio | Lignes |
|---|----------|---------|------|--------|
| 12 | 200 OK → valid | NON | P0 | L48 |
| 13 | Non-OK → error avec body tronque (200 chars) | NON | P1 | L49-50 |
| 14 | Body read echoue (`.catch(() => '')`) | NON | P1 | L49 |
| 15 | Timeout (AbortSignal.timeout 10s) | NON | P1 | L46 |

#### `testAnthropic()` — POST /v1/messages

| # | Scenario | Teste ? | Prio | Lignes |
|---|----------|---------|------|--------|
| 16 | 200 OK → valid | NON | P0 | L64 |
| 17 | 401 → "Invalid API key" | NON | P0 | L65 |
| 18 | 400 → valid (bad request = cle bonne) | NON | P1 | L67 |
| 19 | 429 → valid (rate limited = cle bonne) | NON | P1 | L67 |
| 20 | Autre status (500) → invalid | NON | P1 | L68 |

**Note design** : La logique Anthropic traite 400 et 429 comme "cle valide" car une erreur de requete ou un rate limit prouvent que la cle est reconnue par le serveur. C'est un choix delibere qui doit etre teste pour eviter les regressions.

#### `testGoogle()` — GET /v1/models?key=...

| # | Scenario | Teste ? | Prio | Lignes |
|---|----------|---------|------|--------|
| 21 | OK → valid | NON | P0 | L75 |
| 22 | Non-OK → error | NON | P1 | L76 |
| 23 | **Cle API dans le query param URL** | NON | P0 | L72 |

**Note securite** : La cle Google est passee en query parameter (`?key=...`). Cela signifie qu'elle peut apparaitre dans les logs de proxy/CDN/serveur. C'est le comportement standard de l'API Google mais c'est a documenter.

#### `testElevenLabs()` — GET /v1/user

| # | Scenario | Teste ? | Prio | Lignes |
|---|----------|---------|------|--------|
| 24 | OK → valid | NON | P0 | L84 |
| 25 | Non-OK → error | NON | P1 | L85 |

#### `testOllama()` — GET {baseUrl}/api/tags

| # | Scenario | Teste ? | Prio | Lignes |
|---|----------|---------|------|--------|
| 26 | OK → valid | NON | P0 | L92 |
| 27 | Non-OK → error | NON | P1 | L93 |
| 28 | Base URL custom | NON | P1 | parametre |

---

### 1.3 `updateDocument()` dans `ingestion.ts` — 10 scenarios P0, 0 testes

**Fichier** : `apps/web/src/lib/ai-engine/knowledge/ingestion.ts`  
**Fonction** : `updateDocument()` (lignes 153-262)  
**Verdict** : La fonction n'est meme pas importee dans le fichier de test.

| # | Scenario | Teste ? | Prio | Lignes |
|---|----------|---------|------|--------|
| 1 | **Title-only update (sans re-chunking)** | NON | P0 | L180-193 |
| 2 | **Content update avec re-chunking transactionnel** | NON | P0 | L195-256 |
| 3 | **Document non trouve** | NON | P0 | L177 |
| 4 | Pas de connexion DB | NON | P1 | L159-161 |
| 5 | Pas de cle API (embeddings indisponibles) | NON | P1 | L197-199 |
| 6 | Title + content update simultanement | NON | P1 | L244 |
| 7 | **Catch block (erreur pendant re-chunking → rollback)** | NON | P1 | L258-261 |
| 8 | **Contenu vide apres re-chunk (0 chunks, skip insert)** | NON | P1 | L224-235 |
| 9 | **Batch insert dans la transaction (>100 chunks)** | NON | P0 | L233-235 |
| 10 | Collection counts mises a jour apres re-chunk | NON | P1 | L251 |

**Risque integrite** : Le re-chunking transactionnel fait :
1. DELETE tous les anciens chunks
2. INSERT les nouveaux chunks (en batches)
3. UPDATE le document (contentText, chunkCount)

Si l'etape 2 echoue apres l'etape 1, les anciens chunks sont perdus. La transaction Drizzle garantit le rollback, mais ce comportement n'est jamais verifie par un test.

---

### 1.4 `encryption-service.ts` — Gap securite critique

**Fichier** : `apps/web/src/lib/ai-engine/services/encryption-service.ts`  
**Tests existants** : 35 (bon) — mais 8 gaps identifies

| # | Scenario | Teste ? | Prio | Description |
|---|----------|---------|------|-------------|
| 1 | **Dechiffrage cross-key (master A chiffre, master B dechiffre → doit echouer)** | NON | P0 | Propriete de securite fondamentale |
| 2 | IV tampere → dechiffrage echoue | NON | P1 | Seul le ciphertext tampering est teste |
| 3 | Auth tag tampere → dechiffrage echoue | NON | P1 | Pas teste separement |
| 4 | Prefix `sk-` (plain, pas sk-proj- ni sk-ant-) | NON | P1 | Branche L57 jamais atteinte |
| 5 | Cle tres courte (< 4 chars) → `Math.max(0, ...)` guard | NON | P1 | L61 |
| 6 | Seulement masterKey defini (salt manquant) → null | NON | P1 | L72 |
| 7 | Seulement salt defini (masterKey manquant) → null | NON | P1 | L72 |
| 8 | `encrypt()`/`decrypt()` quand derivedKey est null | NON | P0 | L23, L35 — guard defensif |

---

### 1.5 Autres gaps backend (collections.ts, ingestion.ts)

#### `collections.ts` — 8 gaps sur 29 scenarios

| # | Scenario | Teste ? | Prio |
|---|----------|---------|------|
| 1 | `createCollection()` quand `db()` retourne null → throws | NON | P1 |
| 2 | `listCollections()` quand `db()` retourne null → [] | NON | P2 |
| 3 | `getCollection()` quand `db()` retourne null → null | NON | P2 |
| 4 | `deleteCollection()` quand `db()` retourne null → void | NON | P2 |
| 5 | `updateCollectionCounts()` quand `db()` retourne null | NON | P2 |
| 6 | `updateCollectionCounts()` docResult undefined → `?? 0` fallback | NON | P1 |
| 7 | `updateCollectionCounts()` chunkResult undefined → `?? 0` fallback | NON | P1 |
| 8 | `updateCollection()` avec multiple champs simultanes (name + category + desc) | NON | P2 |

#### `ingestion.ts` — 13 gaps supplementaires (hors updateDocument)

| # | Scenario | Teste ? | Prio |
|---|----------|---------|------|
| 1 | `ingestText()` batch processing >100 chunks (boucle BATCH_SIZE) | NON | P0 |
| 2 | `ingestText()` catch block avec non-Error thrown | NON | P2 |
| 3 | `ingestText()` catch block DB insert failure | NON | P1 |
| 4 | `ingestText()` metadata passthrough vers les chunks | NON | P1 |
| 5 | `ingestText()` mise a jour du chunkCount sur le document | NON | P1 |
| 6 | `ingestUrl()` HTTP non-OK (ex: 404) | NON | P1 |
| 7 | `ingestUrl()` title extraction fallback vers hostname | NON | P1 |
| 8 | `ingestUrl()` non-Error thrown dans catch | NON | P2 |
| 9 | `extractTextFromHtml()` strips scripts | NON | P1 |
| 10 | `extractTextFromHtml()` strips styles | NON | P1 |
| 11 | `extractTextFromHtml()` strips nav/footer/header | NON | P1 |
| 12 | `extractTextFromHtml()` decode HTML entities | NON | P2 |
| 13 | `extractTitleFromHtml()` retourne null quand pas de <title> | NON | P1 |

---

## 2. API Routes — 82 scenarios, 0 contract tests

Aucun test de contrat n'existe pour les 5 nouvelles routes. Les E2E mockent les reponses au niveau Playwright (browser-side), donc ils ne testent PAS la logique du route handler (auth, validation, status codes, headers).

### 2.1 `knowledge/[slug]/route.ts` — PATCH + DELETE (19 scenarios)

**Fichier** : `apps/web/src/app/api/admin/ai-engine/knowledge/[slug]/route.ts`

#### PATCH `/api/admin/ai-engine/knowledge/:slug`

| # | Scenario | Status code | Teste ? | Prio |
|---|----------|-------------|---------|------|
| 1 | Auth: `requireAdminApi()` rejete (session expiree, pas de cookie) | 401 | NON | P0 |
| 2 | Collection non trouvee (`getCollection` retourne null) | 404 | NON | P0 |
| 3 | Zod: body vide `{}` — refine "at least one field" echoue | 400 | NON | P0 |
| 4 | Zod: `name` est chaine vide (min 1 echoue) | 400 | NON | P1 |
| 5 | Zod: `name` depasse 200 caracteres | 400 | NON | P2 |
| 6 | Zod: `description` depasse 2000 caracteres | 400 | NON | P2 |
| 7 | Zod: `category` est chaine vide | 400 | NON | P1 |
| 8 | Zod: `category` depasse 50 caracteres | 400 | NON | P2 |
| 9 | Zod: champs inconnus (strips par defaut) | 200 | NON | P3 |
| 10 | Succes: update uniquement `name` | 200 | NON | P0 |
| 11 | Succes: update uniquement `description` (incluant null pour vider) | 200 | NON | P1 |
| 12 | Succes: update uniquement `category` | 200 | NON | P1 |
| 13 | Succes: update les trois champs | 200 | NON | P1 |
| 14 | `updateCollection()` throws generic Error (DB failure) | 500 | NON | P1 |
| 15 | `request.json()` throws (JSON malformed) | 500 | NON | P2 |

#### DELETE `/api/admin/ai-engine/knowledge/:slug`

| # | Scenario | Status code | Teste ? | Prio |
|---|----------|-------------|---------|------|
| 16 | Auth: `requireAdminApi()` rejete | 401 | NON | P0 |
| 17 | Collection non trouvee | 404 | NON | P0 |
| 18 | Succes: collection trouvee, supprimee | 200 | NON | P0 |
| 19 | `deleteCollection()` throws (DB failure) | 500 | NON | P1 |

---

### 2.2 `knowledge/[slug]/documents/[docId]/route.ts` — GET + PATCH + DELETE (25 scenarios)

**Fichier** : `apps/web/src/app/api/admin/ai-engine/knowledge/[slug]/documents/[docId]/route.ts`

#### GET `/api/admin/ai-engine/knowledge/:slug/documents/:docId`

| # | Scenario | Status code | Teste ? | Prio |
|---|----------|-------------|---------|------|
| 1 | Auth: `requireAdminApi()` rejete | 401 | NON | P0 |
| 2 | Collection non trouvee | 404 | NON | P0 |
| 3 | Document non trouve | 404 | NON | P0 |
| 4 | Succes: retourne `{ document }` | 200 | NON | P0 |
| 5 | `getDocumentById()` throws | 500 | NON | P2 |

#### PATCH `/api/admin/ai-engine/knowledge/:slug/documents/:docId`

| # | Scenario | Status code | Teste ? | Prio |
|---|----------|-------------|---------|------|
| 6 | Auth: `requireAdminApi()` rejete | 401 | NON | P0 |
| 7 | Collection non trouvee | 404 | NON | P0 |
| 8 | Zod: body vide `{}` — refine "at least one field" | 400 | NON | P0 |
| 9 | Zod: `title` chaine vide (min 1) | 400 | NON | P1 |
| 10 | Zod: `title` depasse 500 chars | 400 | NON | P2 |
| 11 | Zod: `content` chaine vide (min 1) | 400 | NON | P1 |
| 12 | Zod: `content` depasse 500 000 chars | 400 | NON | P2 |
| 13 | Document non trouve (updateDocument retourne error) | 404 | NON | P0 |
| 14 | updateDocument retourne error "No database connection" | 500 | NON | P1 |
| 15 | updateDocument retourne error "OpenAI API key not configured" | 500 | NON | P1 |
| 16 | Succes: title-only (reChunked=false) | 200 | NON | P0 |
| 17 | Succes: content update (reChunked=true, chunkCount) | 200 | NON | P0 |
| 18 | Succes: title + content | 200 | NON | P1 |
| 19 | JSON malformed | 500 | NON | P2 |

#### DELETE `/api/admin/ai-engine/knowledge/:slug/documents/:docId`

| # | Scenario | Status code | Teste ? | Prio |
|---|----------|-------------|---------|------|
| 20 | Auth: `requireAdminApi()` rejete | 401 | NON | P0 |
| 21 | Collection non trouvee | 404 | NON | P0 |
| 22 | `db()` retourne null — "Database non disponible" | 503 | NON | P0 |
| 23 | Document non trouve (query retourne vide) | 404 | NON | P0 |
| 24 | Succes: chunks supprimes, doc supprime, counts mis a jour | 200 | NON | P0 |
| 25 | Drizzle delete throws (DB failure) | 500 | NON | P1 |

**Note** : `maxDuration = 120` est exporte mais jamais verifie dans un test.

---

### 2.3 `config/api-keys/route.ts` — GET + POST (16 scenarios)

**Fichier** : `apps/web/src/app/api/admin/ai-engine/config/api-keys/route.ts`

#### GET `/api/admin/ai-engine/config/api-keys`

| # | Scenario | Status code | Teste ? | Prio |
|---|----------|-------------|---------|------|
| 1 | Auth: `requireAdminApi()` rejete | 401 | NON | P0 |
| 2 | Succes: retourne `{ apiKeys }` avec Cache-Control: no-store | 200 | NON | P0 |
| 3 | **Headers securite**: `Cache-Control: no-store`, `Pragma: no-cache` | 200 | NON | P0 |
| 4 | `listApiKeys()` throws (DB failure) | 500 | NON | P1 |

#### POST `/api/admin/ai-engine/config/api-keys`

| # | Scenario | Status code | Teste ? | Prio |
|---|----------|-------------|---------|------|
| 5 | Auth: `requireAdminApi()` rejete | 401 | NON | P0 |
| 6 | Zod: `providerType` manquant | 400 | NON | P0 |
| 7 | Zod: `providerType` invalide (pas dans l'enum) | 400 | NON | P0 |
| 8 | Zod: `apiKey` manquant | 400 | NON | P0 |
| 9 | Zod: `apiKey` chaine vide (min 1) | 400 | NON | P1 |
| 10 | Zod: `apiKey` depasse 500 chars | 400 | NON | P2 |
| 11 | Zod: `label` chaine vide (min 1) | 400 | NON | P2 |
| 12 | Zod: `label` depasse 100 chars | 400 | NON | P2 |
| 13 | Zod: `baseUrl` n'est pas une URL valide | 400 | NON | P1 |
| 14 | **503: chiffrement non configure** (message "Encryption service not available") | 503 | NON | P0 |
| 15 | Succes: payload valide, retourne 201 avec `{ apiKey }`, headers | 201 | NON | P0 |
| 16 | **Securite: la valeur de la cle API n'apparait PAS dans la reponse** | 201 | NON | P0 |

---

### 2.4 `config/api-keys/[id]/route.ts` — DELETE (7 scenarios)

**Fichier** : `apps/web/src/app/api/admin/ai-engine/config/api-keys/[id]/route.ts`

| # | Scenario | Status code | Teste ? | Prio |
|---|----------|-------------|---------|------|
| 1 | Auth: `requireAdminApi()` rejete | 401 | NON | P0 |
| 2 | Cle non trouvee ("API key not found") | 404 | NON | P0 |
| 3 | Succes: cle supprimee, pas de fallback env | 200 | NON | P0 |
| 4 | Succes: cle supprimee, fallback env existe | 200 | NON | P0 |
| 5 | Headers securite: `Cache-Control: no-store`, `Pragma: no-cache` | 200 | NON | P1 |
| 6 | DB connection fails | 500 | NON | P1 |
| 7 | `deleteApiKey()` throws erreur inattendue | 500 | NON | P2 |

---

### 2.5 `config/api-keys/test/route.ts` — POST avec rate limiting (15 scenarios)

**Fichier** : `apps/web/src/app/api/admin/ai-engine/config/api-keys/test/route.ts`

| # | Scenario | Status code | Teste ? | Prio |
|---|----------|-------------|---------|------|
| 1 | Auth: `requireAdminApi()` rejete | 401 | NON | P0 |
| 2 | **Rate limit depasse (>5 req en 60s)** avec header `Retry-After` | 429 | NON | P0 |
| 3 | Rate limit: compteur incremente dans la fenetre, sous la limite | 200 | NON | P1 |
| 4 | Rate limit: fenetre expire, compteur reset | 200 | NON | P1 |
| 5 | Rate limit: utilise session email comme cle; fallback 'anonymous' | - | NON | P1 |
| 6 | Zod: `providerType` manquant | 400 | NON | P0 |
| 7 | Zod: `providerType` invalide | 400 | NON | P0 |
| 8 | Zod: `apiKey` depasse 500 chars | 400 | NON | P2 |
| 9 | Zod: `baseUrl` n'est pas une URL valide | 400 | NON | P1 |
| 10 | Succes: test avec `apiKey` explicite dans le body | 200 | NON | P0 |
| 11 | Succes: test sans `apiKey` (utilise cle stockee/env) | 200 | NON | P0 |
| 12 | Succes: test retourne `{ valid: false }` (cle invalide) | 200 | NON | P1 |
| 13 | Headers securite: `Cache-Control: no-store` | 200 | NON | P1 |
| 14 | `testApiKey()` throws erreur inattendue | 500 | NON | P2 |
| 15 | JSON malformed | 500 | NON | P2 |

---

## 3. Frontend — Point de vue operateur

### 3.1 Knowledge Edit — 34 actions non testees sur ~60

**Fichier** : `apps/web/src/app/admin/content-studio-v2/ai-engine/knowledge/page.tsx` (1557 lignes)

#### A. Chargement initial et etats

| # | Action operateur | Teste ? | Prio |
|---|-----------------|---------|------|
| A1 | Page affiche skeleton de chargement au mount | OUI (unit) | -- |
| A2 | Titre "Base de connaissances" affiche | OUI (unit + E2E) | -- |
| A3 | Stats cards (Collections, Documents, Chunks, En attente) | OUI (unit + E2E) | -- |
| A4 | Stats avec valeurs aggregees correctes | OUI (unit) | -- |
| A5 | **Etat erreur quand le fetch initial echoue** | NON | P1 |
| A6 | **Etat vide (0 collections → "Aucune collection")** | NON | P1 |
| A7 | Lien retour vers /ai-engine | OUI (E2E) | -- |
| A8 | "En attente" affiche tone warning quand pendingDocs > 0 | NON | P3 |

#### B. Liste des collections / Expand-collapse

| # | Action operateur | Teste ? | Prio |
|---|-----------------|---------|------|
| B1 | Lignes de collection avec nom, badge categorie, compteurs | OUI (unit + E2E) | -- |
| B2 | Clic sur collection → expand/affiche documents | OUI (unit + E2E) | -- |
| B3 | Re-clic pour collapse | OUI (E2E) | -- |
| B4 | Expand declenche le fetch des documents | OUI (unit) | -- |
| B5 | **Spinner pendant le chargement des documents** | NON | P2 |
| B6 | **Message "Aucun document" quand collection vide** | NON | P2 |
| B7 | Ligne document : titre, badge chunks, sourceType, date | OUI (E2E) | -- |
| B8 | **Badge "Non indexe" (warning) quand chunkCount === 0** | NON | P2 |
| B9 | Mapping categorie correct (science→Science, brand→Marque) | OUI (unit) | -- |
| B10 | "Indexe : Jamais" quand lastIndexedAt est null | OUI (unit) | -- |
| B11 | **Un seul panel etendu a la fois (expandedId logic)** | NON | P2 |
| B12 | **Documents mis en cache au 2e expand (pas de re-fetch)** | NON | P3 |

#### C. Creer une collection (FLUX ENTIER NON TESTE)

| # | Action operateur | Teste ? | Prio |
|---|-----------------|---------|------|
| C1 | **Bouton "Nouvelle collection" ouvre le formulaire** | NON | P1 |
| C2 | **Le champ Nom auto-genere le slug via slugify()** | NON | P1 |
| C3 | **Le champ Slug accepte uniquement lowercase + chiffres + tirets** | NON | P2 |
| C4 | **Dropdown categorie avec 7 options** | NON | P2 |
| C5 | **Bouton "Creer" desactive quand nom ou slug vide** | NON | P1 |
| C6 | **Soumission appelle POST /api/admin/ai-engine/knowledge** | NON | P1 |
| C7 | **Succes: form reset, banner, refresh collections** | NON | P1 |
| C8 | **Erreur: createColError affiche inline** | NON | P2 |
| C9 | **"Annuler" ferme le formulaire et clear l'erreur** | NON | P2 |
| C10 | **Inputs desactives pendant la creation (creatingCol)** | NON | P3 |
| C11 | **Bouton "Nouvelle collection" desactive si form deja ouvert** | NON | P3 |

#### D. Editer une collection

| # | Action operateur | Teste ? | Prio |
|---|-----------------|---------|------|
| D1 | Bouton "Modifier" visible sur collection etendue | OUI (E2E) | -- |
| D2 | **Clic "Modifier" ouvre le form pre-rempli (name, desc, category)** | NON | P1 |
| D3 | **Form affiche "slug: {slug}" en lecture seule** | NON | P3 |
| D4 | **Save sans changement → ferme juste le form (early return)** | NON | P2 |
| D5 | Save appelle PATCH /knowledge/{slug} | OUI (E2E mock) | -- |
| D6 | **Succes: "Collection mise a jour" banner, form ferme, list refresh** | NON | P2 |
| D7 | **Erreur: editColError affiche inline** | NON | P2 |
| D8 | **"Annuler" ferme le form (desactive pendant save)** | NON | P3 |

#### E. Supprimer une collection (FLUX ENTIER NON TESTE)

| # | Action operateur | Teste ? | Prio |
|---|-----------------|---------|------|
| E1 | **Bouton "Supprimer la collection" visible sur panel etendu** | NON | P1 |
| E2 | **Clic affiche confirm dialog avec nom de la collection** | NON | P1 |
| E3 | **"Annuler" dans le confirm dialog le ferme** | NON | P2 |
| E4 | **"Supprimer" appelle DELETE /knowledge/{slug}** | NON | P1 |
| E5 | **Succes: banner, refresh collections, expandedId cleared** | NON | P2 |
| E6 | **Erreur: ingestError banner affiche** | NON | P2 |
| E7 | **Boutons desactives pendant suppression (deletingCol)** | NON | P3 |

#### F. Ingestion texte

| # | Action operateur | Teste ? | Prio |
|---|-----------------|---------|------|
| F1 | Bouton "Ajouter un document" sur collection etendue | OUI (unit + E2E) | -- |
| F2 | Clic ouvre form avec toggle text/URL, defaut "Texte" | OUI (unit) | -- |
| F3 | Champs titre et contenu presents | OUI (unit) | -- |
| F4 | Remplir titre + contenu + clic "Ingerer" → POST | OUI (unit + E2E) | -- |
| F5 | Succes: form reset, banner, documents refresh | OUI (E2E) | -- |
| F6 | **Erreur: ingestError affiche inline dans le form** | NON | P2 |
| F7 | **"Annuler" reset les champs et ferme** | NON | P3 |
| F8 | **"Ingerer" desactive quand titre ou contenu vide** | NON | P2 |
| F9 | **Inputs desactives pendant ingestion (ingesting state)** | NON | P3 |

#### G. Ingestion URL (FLUX ENTIER NON TESTE)

| # | Action operateur | Teste ? | Prio |
|---|-----------------|---------|------|
| G1 | **Clic "URL" toggle bascule vers le mode URL** | NON | P1 |
| G2 | **Input URL apparait avec placeholder et icone lien** | NON | P2 |
| G3 | **"Ingerer" desactive quand URL vide** | NON | P2 |
| G4 | **Soumission envoie `{ sourceType: 'url', url: '...' }`** | NON | P1 |
| G5 | **Toggle text↔URL pas de contamination des champs** | NON | P3 |
| G6 | **Toggle desactive pendant ingestion** | NON | P3 |

#### H. Modale visualisation document

| # | Action operateur | Teste ? | Prio |
|---|-----------------|---------|------|
| H1 | Icone oeil visible sur chaque document | OUI (E2E) | -- |
| H2 | Clic ouvre modale avec titre, sourceType, chunks, date | OUI (E2E) | -- |
| H3 | Modale affiche spinner puis contenu | OUI (E2E) | -- |
| H4 | **Modale affiche "Aucun contenu disponible" si content null** | NON | P2 |
| H5 | **Bouton X ferme la modale** | NON | P2 |
| H6 | **Clic sur le backdrop ferme la modale** | NON | P2 |
| H7 | Touche Escape ferme la modale | OUI (E2E, assertion faible) | -- |
| H8 | **Clic a l'interieur de la modale ne la ferme PAS (stopPropagation)** | NON | P3 |

#### I. Modale edition document

| # | Action operateur | Teste ? | Prio |
|---|-----------------|---------|------|
| I1 | Icone crayon visible sur chaque document | OUI (E2E) | -- |
| I2 | Clic ouvre modale "Modifier le document" | OUI (E2E) | -- |
| I3 | **Champ titre pre-rempli avec le titre du document** | NON | P2 |
| I4 | **Textarea charge le contenu complet depuis l'API** | NON | P2 |
| I5 | **Compteur de caracteres a cote de "Contenu"** | NON | P3 |
| I6 | Changement de contenu affiche warning re-chunking | OUI (E2E) | -- |
| I7 | **"Enregistrer" appelle PATCH avec uniquement les champs modifies** | NON | P1 |
| I8 | **"Enregistrer" desactive quand titre vide** | NON | P2 |
| I9 | **Succes: message "Document mis a jour" ou "X chunks re-generes"** | NON | P1 |
| I10 | **Erreur: editDocError affiche inline** | NON | P2 |
| I11 | **"Annuler" ferme la modale (desactive pendant save)** | NON | P3 |
| I12 | **Bouton X ferme la modale (desactive pendant save)** | NON | P3 |
| I13 | **Clic backdrop ferme la modale (sauf pendant save)** | NON | P3 |
| I14 | **Save sans changement → ferme la modale (early return)** | NON | P3 |

#### J. Supprimer un document (FLUX ENTIER NON TESTE)

| # | Action operateur | Teste ? | Prio |
|---|-----------------|---------|------|
| J1 | **Icone poubelle visible sur chaque document** | NON | P2 |
| J2 | **Clic affiche confirm dialog avec titre du document** | NON | P1 |
| J3 | **"Annuler" ferme le dialog** | NON | P2 |
| J4 | **"Supprimer" appelle DELETE /.../{slug}/documents/{docId}** | NON | P1 |
| J5 | **Succes: banner, documents refresh, collections refresh** | NON | P2 |
| J6 | **Erreur: ingestError banner affiche** | NON | P2 |
| J7 | **Boutons desactives pendant suppression (deletingDoc)** | NON | P3 |

#### K. Generer les embeddings

| # | Action operateur | Teste ? | Prio |
|---|-----------------|---------|------|
| K1 | Bouton "Generer les embeddings" visible | OUI (unit + E2E) | -- |
| K2 | Clic appelle POST /knowledge/embed | OUI (unit) | -- |
| K3 | Banner succes avec docs traites et chunks crees | OUI (unit) | -- |
| K4 | **Resultat avec errors[] non vide (succes partiel)** | NON | P2 |
| K5 | Banner erreur en cas d'echec | OUI (unit) | -- |
| K6 | **Bouton en loading state (spinner)** | NON | P3 |
| K7 | **Collections refresh apres embed reussi** | NON | P3 |
| K8 | **Resultat affiche `message` quand present** | NON | P3 |

---

### 3.2 API Keys Tab — 25 actions non testees sur ~34

**Fichier** : `apps/web/src/app/admin/content-studio-v2/ai-engine/config/page.tsx` (lignes 1519-2043)

#### L. Navigation et chargement

| # | Action operateur | Teste ? | Prio |
|---|-----------------|---------|------|
| L1 | Onglet "Cles API" visible dans la barre | OUI (E2E) | -- |
| L2 | Clic sur l'onglet charge la liste des cles | OUI (E2E) | -- |
| L3 | **Badge compteur de cles configurees** | NON | P3 |
| L4 | **Cles fetchees en lazy (uniquement quand l'onglet est actif)** | NON | P2 |
| L5 | **Spinner pendant le chargement** | NON | P2 |
| L6 | **Banner d'erreur si le fetch echoue** | NON | P2 |
| L7 | **Titre "Cles d'acces API" affiche** | NON | P3 |
| L8 | **Stat card "Cles configurees" dans la section stats** | NON | P3 |

#### M. Cartes des providers

| # | Action operateur | Teste ? | Prio |
|---|-----------------|---------|------|
| M1 | Chaque provider affiche une carte (providerName, label) | OUI (E2E) | -- |
| M2 | Badges source : "Base de donnees", "Env var", "Non configure" | OUI (E2E) | -- |
| M3 | Valeur masquee affichee pour les cles configurees | OUI (E2E) | -- |
| M4 | **Badge resultat de test ("Valide"/"Invalide") quand lastTestResult existe** | NON | P2 |
| M5 | **Date du dernier test affichee** | NON | P3 |
| M6 | Cles non configurees ont opacite reduite (0.7) | OUI (E2E) | -- |
| M7 | Bouton "Tester" visible pour cles configurees (source !== 'none') | OUI (E2E) | -- |
| M8 | Bouton "Supprimer" uniquement pour cles database avec id | OUI (E2E) | -- |
| M9 | **Bouton "Tester" desactive pendant un test en cours** | NON | P2 |

#### N. Formulaire ajout de cle (FLUX DE SOUMISSION NON TESTE)

| # | Action operateur | Teste ? | Prio |
|---|-----------------|---------|------|
| N1 | Bouton "Ajouter une cle" ouvre le formulaire | OUI (E2E) | -- |
| N2 | Dropdown provider (5 options) | OUI (E2E) | -- |
| N3 | **Champ label (optionnel)** | NON | P3 |
| N4 | Input cle utilise type="password" pour non-Ollama | OUI (E2E) | -- |
| N5 | **Mode Ollama: bascule vers input URL pour baseUrl** | NON | P1 |
| N6 | **Mode Ollama: champ API key optionnel supplementaire** | NON | P2 |
| N7 | **"Enregistrer" desactive quand la valeur de cle est vide** | NON | P1 |
| N8 | **"Enregistrer" desactive pour Ollama quand baseUrl vide** | NON | P2 |
| N9 | **Soumission appelle POST /api/admin/ai-engine/config/api-keys** | NON | P1 |
| N10 | **Succes: toast "Cle API enregistree", form reset, keys refresh** | NON | P1 |
| N11 | **Erreur: toast avec message d'erreur** | NON | P2 |
| N12 | **"Annuler" ferme le form et clear la valeur de cle** | NON | P2 |
| N13 | **Inputs desactives pendant la sauvegarde (savingApiKey)** | NON | P3 |
| N14 | **`autoComplete="off"` sur l'input cle** | NON | P3 |

#### O. Tester une cle (FLUX ENTIER NON TESTE)

| # | Action operateur | Teste ? | Prio |
|---|-----------------|---------|------|
| O1 | **Clic "Tester" declenche le test** | NON | P1 |
| O2 | **POST /api/admin/ai-engine/config/api-keys/test avec providerType** | NON | P1 |
| O3 | **Succes: toast "providerType — Cle valide (Xms)"** | NON | P1 |
| O4 | **Cle invalide: toast "providerType — Cle invalide"** | NON | P2 |
| O5 | **Rate limited (429): toast "Trop de tentatives"** | NON | P1 |
| O6 | **Loading state: spinner sur le bouton "Tester"** | NON | P3 |
| O7 | **Tous les boutons "Tester" desactives pendant un test** | NON | P2 |
| O8 | **Liste des cles rafraichie apres le test** | NON | P3 |

#### P. Supprimer une cle (FLUX ENTIER NON TESTE)

| # | Action operateur | Teste ? | Prio |
|---|-----------------|---------|------|
| P1 | **Clic "Supprimer" ouvre le confirm dialog** | NON | P1 |
| P2 | **Confirm dialog affiche le nom du provider** | NON | P2 |
| P3 | **"Annuler" dans le confirm dialog le ferme** | NON | P2 |
| P4 | **"Supprimer" dans le confirm appelle DELETE /api-keys/{id}** | NON | P1 |
| P5 | **Succes: toast "Cle supprimee" ou "fallback sur variable d'env"** | NON | P1 |
| P6 | **Erreur: toast avec message d'erreur** | NON | P2 |
| P7 | **Boutons desactives pendant suppression (deletingKeyId)** | NON | P3 |

#### Q. Interactions cross-tab

| # | Action operateur | Teste ? | Prio |
|---|-----------------|---------|------|
| Q1 | **Quitter l'onglet api-keys et revenir → donnees preservees** | NON | P2 |
| Q2 | **Le test unitaire existant (config-page.test.tsx) ne verifie que 3 onglets, manque "Cles API"** | NON | P2 |

---

### 3.3 Handlers MSW — Couverture

| Endpoint | Handler defini ? | Utilise par un test ? |
|----------|-----------------|----------------------|
| Knowledge GET collections | OUI | OUI (unit + E2E) |
| Knowledge POST collection | **NON** | NON |
| Knowledge PATCH collection | OUI (knowledgeEditHandlers) | OUI (E2E mock) |
| Knowledge DELETE collection | **NON** | NON |
| Knowledge GET documents | **NON** (dans main handlers) | E2E: page.route() |
| Knowledge POST document (ingest) | **NON** | NON |
| Knowledge DELETE document | **NON** | NON |
| Knowledge GET document detail | OUI (knowledgeEditHandlers) | OUI (E2E mock) |
| Knowledge PATCH document | OUI (knowledgeEditHandlers) | OUI (E2E mock) |
| Knowledge POST embed | OUI | OUI (unit) |
| API Keys GET | OUI (apiKeysHandlers) | OUI (E2E mock) |
| API Keys POST (add) | OUI (apiKeysHandlers) | NON (handler existe mais aucun test l'exerce) |
| API Keys DELETE | OUI (apiKeysHandlers) | NON |
| API Keys POST test | OUI (apiKeysHandlers) | NON |
| API Keys error: encryption 503 | OUI (apiKeysErrorHandlers) | **NON** |
| API Keys error: rate limited 429 | OUI (apiKeysErrorHandlers) | **NON** |
| API Keys error: not found 404 | OUI (apiKeysErrorHandlers) | **NON** |
| API Keys error: invalid test | OUI (apiKeysErrorHandlers) | **NON** |

**Constat** : 5 endpoints n'ont pas de handler MSW du tout. 4 error handlers sont definis mais jamais cables dans aucun test.

---

## 4. Recommandations — Tests a ecrire (par priorite)

### P0 — Critique (a faire avant merge)

| # | Fichier a creer/modifier | Nombre de tests | Description |
|---|--------------------------|-----------------|-------------|
| 1 | `api-key-manager.test.ts` **(CREER)** | ~25 | resolveApiKey (cache hit/miss/expired/decrypt fail), saveApiKey (encrypt+deactivate+insert+cache), deleteApiKey (delete+cache+fallback), listApiKeys (3 sources: DB/env/none), invalidateCache (single/all), testApiKey (explicit key/resolved key/update DB) |
| 2 | `api-key-validator.test.ts` **(CREER)** | ~15 | 5 providers x (OK + error), provider inconnu, timeout AbortSignal, Anthropic 400/429=valid logic, Google key-in-URL, Ollama custom baseUrl |
| 3 | `ingestion.test.ts` **(MODIFIER)** | ~10 | updateDocument: title-only (no re-chunk), content re-chunk (transactionnel), document not found, no DB, no API key, error rollback, empty content (0 chunks), batch >100 chunks, title+content simultane, collection counts update |
| 4 | `encryption-service.test.ts` **(MODIFIER)** | +5 | cross-key decrypt fail (master A vs master B), IV tampering, auth tag tampering, sk- prefix (plain), short key (<4 chars), partial env vars (key sans salt, salt sans key) |

### P1 — Majeur (a faire avant deploy staging)

| # | Fichier a creer/modifier | Nombre de tests | Description |
|---|--------------------------|-----------------|-------------|
| 5 | `ai-engine-knowledge-edit.contract.test.ts` **(CREER)** | ~15 | PATCH collection (auth 401, Zod 400 empty/invalid, 404 not found, success 200 single+multi field), DELETE collection (auth, 404, success) |
| 6 | `ai-engine-api-keys.contract.test.ts` **(CREER)** | ~20 | GET api-keys (auth, success+headers), POST api-keys (auth, Zod validation 6 cas, 503 encryption, success 201+headers+no-plaintext), DELETE api-keys (auth, 404, success with/without fallback), POST test (auth, rate limit 429+Retry-After, Zod, success valid/invalid) |
| 7 | `knowledge-page-edit.test.tsx` **(CREER)** | ~20 | RTL: edit collection form (pre-populated, save, cancel, error), view document modal (open, content, close X/backdrop/Escape, null content), edit document modal (pre-populated, title+content change, re-chunking warning, save success message, error), delete collection (confirm dialog, API call, success), delete document (confirm, API, success), URL ingestion (toggle, input, submit payload), empty state (0 collections), error state (fetch fail), create collection (form, slug auto-gen, submit, disabled states) |
| 8 | `ai-engine-api-keys.spec.ts` **(ENRICHIR)** | +10 | E2E: test key flow (click Tester → toast valid/invalid), delete key flow (click Supprimer → confirm → toast with fallback info), add key full flow (fill form → submit → success toast → list refresh), Ollama mode (URL input switch), rate limit handling (429 toast), error handlers exercised (encryptionUnavailable, keyNotFound, testInvalid) |
| 9 | `ai-engine-knowledge-edit.spec.ts` **(ENRICHIR)** | +8 | E2E: create collection (open form → fill → submit → success), delete collection (expand → click Supprimer → confirm → success), delete document (click trash → confirm → success), edit document save (modify title → save → message "Document mis a jour"), edit document re-chunking save (modify content → save → message "X chunks re-generes"), URL ingestion (toggle → fill URL → submit), edit collection form pre-populated check, edit with no changes → closes without API call |

### P2/P3 — Modere et mineur (backlog)

| # | Description | Nombre | Prio |
|---|-------------|--------|------|
| 10 | Loading states (spinners, boutons disabled) pour toutes les operations | ~15 | P2 |
| 11 | Single-expand enforcement (un seul panel a la fois) | 1 | P2 |
| 12 | Document cache (pas de re-fetch au 2e expand) | 1 | P3 |
| 13 | Keyboard navigation (Escape ferme modales, Tab order) | ~5 | P2 |
| 14 | collections.ts: tous les `db() === null` guards | 5 | P2 |
| 15 | ingestion.ts: extractTextFromHtml / extractTitleFromHtml | 7 | P2 |
| 16 | Double-click protection (debounce sur soumission) | ~4 | P3 |
| 17 | Cross-tab state persistence (quitter api-keys et revenir) | 1 | P2 |
| 18 | config-page.test.tsx: ajouter verification du 4e onglet "Cles API" | 1 | P2 |

---

## 5. Synthese des risques

### Risques securite non couverts par les tests

| Risque | Fichier | Ligne(s) | Severite |
|--------|---------|----------|----------|
| Fallback silencieux decrypt → env | api-key-manager.ts | 279-281 | CRITIQUE |
| Cle API jamais retournee en clair dans les reponses | api-keys/route.ts | POST handler | CRITIQUE |
| Headers Cache-Control: no-store sur toutes les routes API keys | 4 fichiers route | tous | MAJEUR |
| Rate limiting effectif (5 req/min, Retry-After) | api-keys/test/route.ts | 26-40 | MAJEUR |
| Cle Google dans query param URL (visible dans logs proxy) | api-key-validator.ts | 72 | OBSERVATION |
| Chaine encrypt → deactivate → insert non atomique | api-key-manager.ts | 149-172 | MAJEUR |

### Estimation de l'effort de remediation

| Priorite | Tests a ecrire | Effort estime |
|----------|---------------|---------------|
| P0 | ~55 tests | 8-10h |
| P1 | ~73 tests | 10-14h |
| P2/P3 | ~35 tests | 4-6h |
| **TOTAL** | **~163 tests** | **22-30h** |

---

## 6. Checklist pre-merge

- [ ] `api-key-manager.test.ts` cree avec >= 25 tests (P0)
- [ ] `api-key-validator.test.ts` cree avec >= 15 tests (P0)
- [ ] `updateDocument()` teste dans ingestion.test.ts avec >= 10 tests (P0)
- [ ] Cross-key decryption test ajoute a encryption-service.test.ts (P0)
- [ ] Contract tests pour les 5 nouvelles routes (P1)
- [ ] Tests RTL pour les composants frontend (P1)
- [ ] E2E enrichis pour les flux complets (P1)
- [ ] `npx tsc --noEmit` : 0 nouvelles erreurs
- [ ] `npx vitest run` : 0 failures (incluant nouveaux tests)
- [ ] Grep securite : 0 cle en clair dans les sources
- [ ] Tous les handlers MSW d'erreur exerces par au moins un test
