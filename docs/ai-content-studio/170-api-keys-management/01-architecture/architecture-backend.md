# Architecture Backend - Gestion des Cles API

> Module : 170 - API Keys Management
> Couche : Backend (Node.js / Next.js API Routes)
> Date : 2026-05-25

---

## 1. Vue d'ensemble architecturale

L'architecture backend de la gestion des cles API s'organise autour de trois couches principales :

```
+------------------------------------------------------------------+
|                     API Routes (Next.js App Router)                |
|  GET/POST /api/admin/ai-engine/config/api-keys                   |
|  DELETE    /api/admin/ai-engine/config/api-keys/[id]              |
|  POST     /api/admin/ai-engine/config/api-keys/test               |
+------------------------------------------------------------------+
                              |
                              v
+------------------------------------------------------------------+
|                     Service Layer                                  |
|  ApiKeyManager     - CRUD, resolution, cache                      |
|  EncryptionService - AES-256-GCM, derivation cle                  |
|  ApiKeyValidator   - Test connectivite par fournisseur             |
+------------------------------------------------------------------+
                              |
                              v
+------------------------------------------------------------------+
|                     Data Layer (Drizzle ORM)                       |
|  ai_engine_api_keys  - Stockage chiffre                           |
|  ai_engine_audit_log - Journalisation (table existante ou nouvelle)|
+------------------------------------------------------------------+
                              |
                              v
+------------------------------------------------------------------+
|                     PostgreSQL                                     |
+------------------------------------------------------------------+
```

---

## 2. Service de chiffrement (EncryptionService)

### 2.1 Localisation
```
apps/web/src/lib/ai-engine/services/encryption-service.ts
```

### 2.2 Algorithme
- **Chiffrement** : AES-256-GCM (Galois/Counter Mode)
- **Derivation de cle** : PBKDF2 avec SHA-512, 100 000 iterations
- **IV** : 12 octets aleatoires (nonce unique par operation)
- **AuthTag** : 16 octets (128 bits) genere automatiquement par GCM
- **Format de stockage** : `base64(iv):base64(authTag):base64(ciphertext)`

### 2.3 Interface publique

```typescript
interface EncryptionService {
  /**
   * Chiffre une cle API en clair.
   * @param plaintext - La cle API en clair
   * @returns Le chiffre au format "iv:authTag:ciphertext" (base64)
   */
  encrypt(plaintext: string): string;

  /**
   * Dechiffre une cle API chiffree.
   * @param encrypted - Le chiffre au format "iv:authTag:ciphertext"
   * @returns La cle API en clair
   * @throws Error si le dechiffrement echoue (cle corrompue, mauvaise cle master)
   */
  decrypt(encrypted: string): string;

  /**
   * Masque une cle API pour affichage frontend.
   * @param plaintext - La cle API en clair
   * @returns La cle masquee (ex: "sk-...AbCd")
   */
  mask(plaintext: string): string;
}
```

### 2.4 Derivation de la cle de chiffrement

La cle de chiffrement AES-256 est derivee au demarrage de l'application :

```typescript
// Pseudo-code de derivation
const masterKey = process.env.AI_ENGINE_ENCRYPTION_KEY; // >= 32 chars
const salt = process.env.AI_ENGINE_ENCRYPTION_SALT;     // >= 16 chars

const derivedKey = crypto.pbkdf2Sync(
  masterKey,
  salt,
  100_000,     // iterations
  32,          // longueur cle (256 bits)
  'sha512'     // algorithme de hachage
);
```

### 2.5 Processus de chiffrement

```
1. Generer un IV aleatoire de 12 octets
2. Creer un cipher AES-256-GCM avec la cle derivee et l'IV
3. Chiffrer le plaintext
4. Recuperer l'authTag (16 octets)
5. Concatener : base64(iv) + ":" + base64(authTag) + ":" + base64(ciphertext)
6. Retourner la chaine concatenee
```

### 2.6 Processus de dechiffrement

```
1. Decouvrir la chaine stockee en 3 parties (split sur ":")
2. Decoder base64 chaque partie : iv, authTag, ciphertext
3. Creer un decipher AES-256-GCM avec la cle derivee et l'IV
4. Setter l'authTag sur le decipher
5. Dechiffrer le ciphertext
6. Retourner le plaintext
7. Si l'authTag ne correspond pas -> lever une erreur (integrite compromise)
```

### 2.7 Fonction de masquage

```typescript
function mask(plaintext: string): string {
  if (plaintext.length <= 8) {
    return '****' + plaintext.slice(-4);
  }
  // Detecter le prefixe du fournisseur
  const prefixes = ['sk-', 'sk-proj-', 'sk-ant-', 'AIza', 'gsk_'];
  const prefix = prefixes.find(p => plaintext.startsWith(p));
  if (prefix) {
    return prefix + '...' + plaintext.slice(-4);
  }
  return plaintext.slice(0, 4) + '...' + plaintext.slice(-4);
}
```

---

## 3. Schema de stockage (Drizzle)

### 3.1 Table `ai_engine_api_keys`

```typescript
export const aiEngineApiKeys = pgTable(
  'ai_engine_api_key',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
    providerType: text('provider_type').notNull(),
    label: text('label'),
    encryptedKey: text('encrypted_key').notNull(),
    maskedKey: text('masked_key').notNull(),
    keyPrefix: text('key_prefix'),
    isActive: boolean('is_active').notNull().default(true),
    priority: integer('priority').notNull().default(10),
    lastTestedAt: timestamp('last_tested_at', { withTimezone: true }),
    lastTestResult: text('last_test_result'),
    lastTestError: text('last_test_error'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    metadata: jsonb('metadata'),
    createdBy: text('created_by').notNull(),
    updatedBy: text('updated_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    providerTypeIdx: index('ai_ak_provider_type_idx').on(t.providerType, t.isActive),
    activeIdx: index('ai_ak_active_idx').on(t.isActive, t.priority),
    uniqueActiveProvider: uniqueIndex('ai_ak_unique_active_provider')
      .on(t.providerType)
      .where(sql`is_active = true`),
  }),
);
```

### 3.2 Table `ai_engine_audit_log`

```typescript
export const aiEngineAuditLog = pgTable(
  'ai_engine_audit_log',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    actorEmail: text('actor_email').notNull(),
    details: jsonb('details'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    actionIdx: index('ai_audit_action_idx').on(t.action, t.createdAt),
    entityIdx: index('ai_audit_entity_idx').on(t.entityType, t.entityId),
    actorIdx: index('ai_audit_actor_idx').on(t.actorEmail, t.createdAt),
  }),
);
```

---

## 4. Chaine de resolution des cles (Key Resolution Chain)

### 4.1 Ordre de priorite (par defaut)

```
1. Cle stockee en base de donnees (ai_engine_api_keys, is_active = true)
2. Variables d'environnement (chaine existante dans engine-config.ts)
3. null (fournisseur non configure)
```

### 4.2 Modification de `getEngineConfig()`

Le fichier `apps/web/src/lib/ai-engine/config/engine-config.ts` sera modifie pour integrer la resolution depuis la base de donnees :

```typescript
// Nouvelle interface
interface KeyResolutionResult {
  key: string | undefined;
  source: 'database' | 'env' | 'none';
  maskedKey?: string;
}

// Nouvelle methode dans ApiKeyManager
async function resolveApiKey(providerType: string): Promise<KeyResolutionResult> {
  // 1. Chercher en DB
  const dbKey = await getActiveKeyForProvider(providerType);
  if (dbKey) {
    const decrypted = encryptionService.decrypt(dbKey.encryptedKey);
    return {
      key: decrypted,
      source: 'database',
      maskedKey: dbKey.maskedKey,
    };
  }

  // 2. Fallback sur env vars
  const envKey = getEnvVarKey(providerType);
  if (envKey) {
    return {
      key: envKey,
      source: 'env',
      maskedKey: encryptionService.mask(envKey),
    };
  }

  // 3. Non configure
  return { key: undefined, source: 'none' };
}
```

### 4.3 Cache des cles resolues

Pour eviter de dechiffrer les cles a chaque requete :

```typescript
// Cache en memoire avec TTL de 5 minutes
const keyCache = new Map<string, { key: string; expiresAt: number }>();
const KEY_CACHE_TTL_MS = 5 * 60 * 1000;

function getCachedKey(providerType: string): string | null {
  const cached = keyCache.get(providerType);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.key;
  }
  keyCache.delete(providerType);
  return null;
}

function setCachedKey(providerType: string, key: string): void {
  keyCache.set(providerType, {
    key,
    expiresAt: Date.now() + KEY_CACHE_TTL_MS,
  });
}

function invalidateKeyCache(providerType?: string): void {
  if (providerType) {
    keyCache.delete(providerType);
  } else {
    keyCache.clear();
  }
}
```

---

## 5. Integration avec le Health Check

### 5.1 Etat actuel

Le endpoint `/api/admin/ai-engine/health` verifie deja si les providers sont configures en utilisant `getEngineConfig().apiKeys`.

### 5.2 Modifications

Le health check sera modifie pour :
1. Utiliser la nouvelle chaine de resolution (DB > env)
2. Inclure l'information de source de la cle (DB vs env)
3. Inclure le resultat du dernier test de validite

```typescript
// Nouveau format de reponse health
interface ProviderHealthDetail {
  configured: boolean;
  keySource: 'database' | 'env' | 'none';
  lastTestResult: 'success' | 'failure' | 'untested';
  lastTestAt: string | null;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy';
}
```

---

## 6. Validation des cles par fournisseur (ApiKeyValidator)

### 6.1 Localisation
```
apps/web/src/lib/ai-engine/services/api-key-validator.ts
```

### 6.2 Strategie de validation par fournisseur

| Fournisseur | Endpoint de test | Methode | Description |
|-------------|-----------------|---------|-------------|
| OpenAI | `https://api.openai.com/v1/models` | GET | Liste les modeles disponibles |
| Anthropic | `https://api.anthropic.com/v1/messages` | POST (dry-run) | Message minimal avec max_tokens=1 |
| Google AI | `https://generativelanguage.googleapis.com/v1/models` | GET | Liste les modeles Gemini |
| ElevenLabs | `https://api.elevenlabs.io/v1/user` | GET | Recupere les infos utilisateur |
| Ollama | `{baseUrl}/api/tags` | GET | Liste les modeles locaux |

### 6.3 Interface

```typescript
interface ValidationResult {
  valid: boolean;
  provider: string;
  latencyMs: number;
  error?: string;
  details?: {
    modelsAvailable?: number;
    quotaRemaining?: number;
    planType?: string;
  };
}

interface ApiKeyValidator {
  validate(providerType: string, apiKey: string, baseUrl?: string): Promise<ValidationResult>;
}
```

### 6.4 Timeout et gestion d'erreurs

- Timeout global : 10 secondes
- Retry : 0 (pas de retry pour les tests de validite)
- Erreurs HTTP mappees :
  - 401 -> "Cle API invalide ou expiree"
  - 403 -> "Cle API sans les permissions necessaires"
  - 429 -> "Limite de taux atteinte, reessayez dans quelques instants"
  - 5xx -> "Le service du fournisseur est temporairement indisponible"

---

## 7. Audit Logging

### 7.1 Evenements journalises

| Action | entity_type | Details |
|--------|------------|---------|
| `api_key.created` | `api_key` | `{ providerType, maskedKey, source: 'ui' }` |
| `api_key.updated` | `api_key` | `{ providerType, maskedKey, previousMaskedKey }` |
| `api_key.deleted` | `api_key` | `{ providerType, maskedKey, reason }` |
| `api_key.tested` | `api_key` | `{ providerType, result, latencyMs, error? }` |
| `api_key.resolved` | `api_key` | `{ providerType, source }` (uniquement en mode debug) |
| `api_key.decryption_failed` | `api_key` | `{ providerType, error }` (alerte securite) |

### 7.2 Politique de retention

- Les logs d'audit sont conserves 365 jours
- Les logs de type `decryption_failed` declenchent une alerte immediatement
- Pas de purge automatique dans le MVP (manuelle via SQL)

---

## 8. Rate Limiting

### 8.1 Endpoint de test (`/api/admin/ai-engine/config/api-keys/test`)

```typescript
// Rate limiter simple base sur IP + session
const testRateLimiter = new Map<string, { count: number; resetAt: number }>();
const TEST_RATE_LIMIT = 5;          // 5 requetes
const TEST_RATE_WINDOW_MS = 60_000; // par minute

function checkTestRateLimit(sessionEmail: string): boolean {
  const now = Date.now();
  const entry = testRateLimiter.get(sessionEmail);
  if (!entry || entry.resetAt < now) {
    testRateLimiter.set(sessionEmail, { count: 1, resetAt: now + TEST_RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= TEST_RATE_LIMIT) {
    return false;
  }
  entry.count++;
  return true;
}
```

### 8.2 Endpoints CRUD

Les endpoints CRUD n'ont pas de rate limiting specifique au-dela de la protection `requireAdminApi()`, car seuls les administrateurs y ont acces et les operations sont peu frequentes.

---

## 9. Gestion des erreurs

### 9.1 Codes d'erreur specifiques

| Code | HTTP Status | Message | Contexte |
|------|-------------|---------|----------|
| `ENCRYPTION_KEY_MISSING` | 500 | "Cle de chiffrement non configuree" | `AI_ENGINE_ENCRYPTION_KEY` absente |
| `DECRYPTION_FAILED` | 500 | "Impossible de dechiffrer la cle API" | Cle corrompue ou cle master modifiee |
| `PROVIDER_NOT_FOUND` | 404 | "Fournisseur introuvable" | ID de cle invalide |
| `PROVIDER_ALREADY_EXISTS` | 409 | "Une cle active existe deja pour ce fournisseur" | Duplication |
| `VALIDATION_FAILED` | 422 | "La cle API n'est pas valide" | Test de connectivite echoue |
| `RATE_LIMIT_EXCEEDED` | 429 | "Limite de taux depassee" | Trop de tests |
| `DB_UNAVAILABLE` | 503 | "Base de donnees non disponible" | Mode memoire |

### 9.2 Format de reponse d'erreur

```typescript
interface ApiKeyErrorResponse {
  error: string;
  code: string;
  details?: Record<string, unknown>;
}
```

---

## 10. Considerations de deploiement

### 10.1 Variables d'environnement nouvelles

```env
# OBLIGATOIRE - Cle de chiffrement principale (>= 32 caracteres)
AI_ENGINE_ENCRYPTION_KEY=<generer-avec-openssl-rand-base64-32>

# OBLIGATOIRE - Salt pour PBKDF2 (>= 16 caracteres)
AI_ENGINE_ENCRYPTION_SALT=<generer-avec-openssl-rand-base64-16>
```

### 10.2 Migration de base de donnees

```sql
-- Migration : Creer la table ai_engine_api_key
CREATE TABLE IF NOT EXISTS ai_engine_api_key (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  provider_type TEXT NOT NULL,
  label TEXT,
  encrypted_key TEXT NOT NULL,
  masked_key TEXT NOT NULL,
  key_prefix TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 10,
  last_tested_at TIMESTAMPTZ,
  last_test_result TEXT,
  last_test_error TEXT,
  expires_at TIMESTAMPTZ,
  metadata JSONB,
  created_by TEXT NOT NULL,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ai_ak_provider_type_idx ON ai_engine_api_key (provider_type, is_active);
CREATE INDEX ai_ak_active_idx ON ai_engine_api_key (is_active, priority);
CREATE UNIQUE INDEX ai_ak_unique_active_provider ON ai_engine_api_key (provider_type) WHERE is_active = true;
```

### 10.3 Rollback

```sql
-- Rollback : Supprimer la table ai_engine_api_key
DROP TABLE IF EXISTS ai_engine_api_key;
```

### 10.4 Compatibilite ascendante

Le systeme est concu pour etre **100% retrocompatible** :
- Si aucune cle n'est stockee en DB, le comportement est identique a l'existant (env vars)
- Si `AI_ENGINE_ENCRYPTION_KEY` n'est pas configuree, seul le stockage DB est desactive, les env vars continuent de fonctionner
- La migration est additive (aucune modification des tables existantes)
