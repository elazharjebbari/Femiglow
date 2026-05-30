# Couche Service - Gestion des Cles API

> Module : 170 - API Keys Management
> Couche : Services (business logic)
> Date : 2026-05-25

---

## 1. Vue d'ensemble des services

```
+------------------------+     +------------------------+     +------------------------+
|   EncryptionService    |     |    ApiKeyManager       |     |   ApiKeyValidator      |
+------------------------+     +------------------------+     +------------------------+
| - derivedKey           |     | - encryptionService    |     | - httpClient           |
|                        |     | - db                   |     | - timeoutMs            |
| + encrypt(plain)       |     | - keyCache             |     |                        |
| + decrypt(cipher)      |     |                        |     | + validate(provider,   |
| + mask(plain)          |     | + createOrUpdate(...)  |     |     key, baseUrl?)     |
| + isAvailable()        |     | + delete(id, session)  |     +------------------------+
+------------------------+     | + resolve(provider)    |
                               | + list()               |
                               | + test(provider, key?) |
                               | + invalidateCache()    |
                               +------------------------+
```

---

## 2. EncryptionService

### 2.1 Localisation
```
apps/web/src/lib/ai-engine/services/encryption-service.ts
```

### 2.2 Implementation detaillee

```typescript
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;          // 96 bits, recommande NIST pour GCM
const AUTH_TAG_LENGTH = 16;    // 128 bits
const PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH = 32;         // 256 bits
const PBKDF2_DIGEST = 'sha512';
const SEPARATOR = ':';

export class EncryptionService {
  private derivedKey: Buffer | null = null;

  constructor(
    private masterKey?: string,
    private salt?: string,
  ) {
    if (masterKey && salt) {
      this.derivedKey = this.deriveKey(masterKey, salt);
    }
  }

  /**
   * Verifie si le service de chiffrement est disponible.
   */
  isAvailable(): boolean {
    return this.derivedKey !== null;
  }

  /**
   * Derive la cle AES-256 a partir de la cle master et du salt.
   */
  private deriveKey(masterKey: string, salt: string): Buffer {
    return crypto.pbkdf2Sync(
      masterKey,
      salt,
      PBKDF2_ITERATIONS,
      KEY_LENGTH,
      PBKDF2_DIGEST,
    );
  }

  /**
   * Chiffre une cle API en clair.
   *
   * @param plaintext - La cle API en clair
   * @returns Le chiffre au format "base64(iv):base64(authTag):base64(ciphertext)"
   * @throws Error si le service n'est pas disponible
   */
  encrypt(plaintext: string): string {
    if (!this.derivedKey) {
      throw new Error('EncryptionService: cle de chiffrement non configuree');
    }

    // 1. Generer un IV aleatoire
    const iv = crypto.randomBytes(IV_LENGTH);

    // 2. Creer le cipher
    const cipher = crypto.createCipheriv(ALGORITHM, this.derivedKey, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    // 3. Chiffrer
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    // 4. Recuperer l'authTag
    const authTag = cipher.getAuthTag();

    // 5. Concatener en format stockable
    return [
      iv.toString('base64'),
      authTag.toString('base64'),
      encrypted.toString('base64'),
    ].join(SEPARATOR);
  }

  /**
   * Dechiffre une cle API chiffree.
   *
   * @param encryptedString - Le chiffre au format "iv:authTag:ciphertext" (base64)
   * @returns La cle API en clair
   * @throws Error si le dechiffrement echoue
   */
  decrypt(encryptedString: string): string {
    if (!this.derivedKey) {
      throw new Error('EncryptionService: cle de chiffrement non configuree');
    }

    const parts = encryptedString.split(SEPARATOR);
    if (parts.length !== 3) {
      throw new Error('EncryptionService: format de chiffre invalide');
    }

    const [ivB64, authTagB64, ciphertextB64] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const ciphertext = Buffer.from(ciphertextB64, 'base64');

    // Validation des tailles
    if (iv.length !== IV_LENGTH) {
      throw new Error('EncryptionService: taille IV invalide');
    }
    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error('EncryptionService: taille authTag invalide');
    }

    // Creer le decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, this.derivedKey, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    // Dechiffrer
    try {
      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);
      return decrypted.toString('utf8');
    } catch (error) {
      throw new Error(
        'EncryptionService: dechiffrement echoue (cle corrompue ou cle master differente)',
      );
    }
  }

  /**
   * Masque une cle API pour affichage frontend.
   *
   * @param plaintext - La cle API en clair
   * @returns La cle masquee (ex: "sk-proj-...AbCd")
   */
  mask(plaintext: string): string {
    if (!plaintext || plaintext.length < 4) {
      return '****';
    }

    const last4 = plaintext.slice(-4);

    // Detecter les prefixes connus
    const prefixes = [
      'sk-proj-',
      'sk-ant-api03-',
      'sk-ant-',
      'sk-',
      'AIza',
      'gsk_',
      'http://',
      'https://',
    ];

    for (const prefix of prefixes) {
      if (plaintext.startsWith(prefix)) {
        return `${prefix}...${last4}`;
      }
    }

    // Fallback : 4 premiers + ... + 4 derniers
    if (plaintext.length > 8) {
      return `${plaintext.slice(0, 4)}...${last4}`;
    }
    return `****${last4}`;
  }
}

// Singleton
let _instance: EncryptionService | null = null;

export function getEncryptionService(): EncryptionService {
  if (!_instance) {
    _instance = new EncryptionService(
      process.env.AI_ENGINE_ENCRYPTION_KEY,
      process.env.AI_ENGINE_ENCRYPTION_SALT,
    );
  }
  return _instance;
}

export function resetEncryptionService(): void {
  _instance = null;
}
```

---

## 3. ApiKeyManager

### 3.1 Localisation
```
apps/web/src/lib/ai-engine/services/api-key-manager.ts
```

### 3.2 Interface publique

```typescript
interface KeyResolutionResult {
  key: string | undefined;
  source: 'database' | 'env' | 'none';
  maskedKey?: string;
  keyId?: string;
}

interface CreateOrUpdateResult {
  key: ApiKeySummary;
  validation: ValidationResult | null;
}

interface DeleteResult {
  deleted: boolean;
  fallbackAvailable: boolean;
  fallbackSource: string | null;
}

export class ApiKeyManager {
  constructor(
    private encryptionService: EncryptionService,
    private database: ReturnType<typeof db>,
  ) {}

  /**
   * Liste toutes les cles API (masquees) pour tous les fournisseurs.
   */
  async listAll(): Promise<{
    keys: ApiKeySummary[];
    meta: { total: number; configuredCount: number; dbKeyCount: number; envKeyCount: number };
  }>;

  /**
   * Cree ou met a jour une cle API pour un fournisseur.
   * Desactive automatiquement l'ancienne cle.
   */
  async createOrUpdate(
    providerType: string,
    apiKey: string,
    session: AdminSession,
    options?: {
      label?: string;
      baseUrl?: string;
      skipValidation?: boolean;
    },
  ): Promise<CreateOrUpdateResult>;

  /**
   * Supprime une cle API.
   */
  async deleteKey(
    keyId: string,
    session: AdminSession,
  ): Promise<DeleteResult>;

  /**
   * Resout la cle API a utiliser pour un fournisseur.
   * Ordre : DB (active) > env vars > null.
   */
  async resolveApiKey(providerType: string): Promise<KeyResolutionResult>;

  /**
   * Teste la validite d'une cle (existante ou fournie).
   */
  async testKey(
    providerType: string,
    session: AdminSession,
    apiKey?: string,
    baseUrl?: string,
  ): Promise<ValidationResult>;

  /**
   * Invalide le cache pour un fournisseur ou tous les fournisseurs.
   */
  invalidateCache(providerType?: string): void;
}
```

### 3.3 Cache en memoire

```typescript
private keyCache = new Map<string, { key: string; expiresAt: number }>();
private static readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

private getCachedKey(providerType: string): string | null {
  const entry = this.keyCache.get(providerType);
  if (entry && entry.expiresAt > Date.now()) {
    return entry.key;
  }
  this.keyCache.delete(providerType);
  return null;
}

private setCachedKey(providerType: string, key: string): void {
  this.keyCache.set(providerType, {
    key,
    expiresAt: Date.now() + ApiKeyManager.CACHE_TTL_MS,
  });
}

invalidateCache(providerType?: string): void {
  if (providerType) {
    this.keyCache.delete(providerType);
  } else {
    this.keyCache.clear();
  }
}
```

### 3.4 Resolution des cles (detail)

```typescript
async resolveApiKey(providerType: string): Promise<KeyResolutionResult> {
  // 1. Verifier le cache
  const cached = this.getCachedKey(providerType);
  if (cached) {
    return { key: cached, source: 'database' };
  }

  // 2. Chercher en DB
  if (this.database) {
    const [dbKey] = await this.database
      .select()
      .from(aiEngineApiKeys)
      .where(
        and(
          eq(aiEngineApiKeys.providerType, providerType),
          eq(aiEngineApiKeys.isActive, true),
        ),
      )
      .limit(1);

    if (dbKey) {
      try {
        const decrypted = this.encryptionService.decrypt(dbKey.encryptedKey);
        this.setCachedKey(providerType, decrypted);
        return {
          key: decrypted,
          source: 'database',
          maskedKey: dbKey.maskedKey,
          keyId: dbKey.id,
        };
      } catch (error) {
        // Erreur de dechiffrement - logger l'alerte securite
        console.error(`[SECURITY ALERT] Decryption failed for ${providerType}:`, error);
        await this.logAuditEvent({
          action: 'api_key.decryption_failed',
          entityType: 'api_key',
          entityId: dbKey.id,
          actorEmail: 'system',
          details: { providerType, error: String(error) },
        });
        // Fallback sur env vars
      }
    }
  }

  // 3. Fallback sur les env vars
  const config = getEngineConfig();
  const envKeyMap: Record<string, string | undefined> = {
    openai: config.apiKeys.openai,
    anthropic: config.apiKeys.anthropic,
    google: config.apiKeys.google,
    elevenlabs: config.apiKeys.elevenlabs,
    ollama: config.apiKeys.ollamaBaseUrl,
  };

  const envKey = envKeyMap[providerType];
  if (envKey) {
    return {
      key: envKey,
      source: 'env',
      maskedKey: this.encryptionService.isAvailable()
        ? this.encryptionService.mask(envKey)
        : '****',
    };
  }

  // 4. Non configure
  return { key: undefined, source: 'none' };
}
```

### 3.5 Mapping env var par fournisseur

```typescript
private getEnvVarNameForProvider(providerType: string): string {
  const map: Record<string, string> = {
    openai: 'AI_ENGINE_OPENAI_API_KEY',
    anthropic: 'AI_ENGINE_ANTHROPIC_API_KEY',
    google: 'AI_ENGINE_GOOGLE_API_KEY',
    elevenlabs: 'AI_ENGINE_ELEVENLABS_API_KEY',
    ollama: 'AI_ENGINE_OLLAMA_BASE_URL',
  };
  return map[providerType] ?? `AI_ENGINE_${providerType.toUpperCase()}_API_KEY`;
}
```

---

## 4. ApiKeyValidator

### 4.1 Localisation
```
apps/web/src/lib/ai-engine/services/api-key-validator.ts
```

### 4.2 Implementation detaillee

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

const VALIDATION_TIMEOUT_MS = 10_000; // 10 secondes

export class ApiKeyValidator {
  /**
   * Teste la validite d'une cle API en effectuant un appel minimal au fournisseur.
   */
  async validate(
    providerType: string,
    apiKey: string,
    baseUrl?: string,
  ): Promise<ValidationResult> {
    const start = Date.now();
    try {
      const result = await this.callProvider(providerType, apiKey, baseUrl);
      return {
        valid: true,
        provider: providerType,
        latencyMs: Date.now() - start,
        details: result,
      };
    } catch (error) {
      return {
        valid: false,
        provider: providerType,
        latencyMs: Date.now() - start,
        error: this.formatError(error),
      };
    }
  }

  private async callProvider(
    providerType: string,
    apiKey: string,
    baseUrl?: string,
  ): Promise<{ modelsAvailable?: number; quotaRemaining?: number; planType?: string }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), VALIDATION_TIMEOUT_MS);

    try {
      switch (providerType) {
        case 'openai':
          return await this.testOpenAI(apiKey, controller.signal);
        case 'anthropic':
          return await this.testAnthropic(apiKey, controller.signal);
        case 'google':
          return await this.testGoogle(apiKey, controller.signal);
        case 'elevenlabs':
          return await this.testElevenLabs(apiKey, controller.signal);
        case 'ollama':
          return await this.testOllama(baseUrl ?? 'http://localhost:11434', controller.signal);
        default:
          throw new Error(`Fournisseur inconnu : ${providerType}`);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  private async testOpenAI(
    apiKey: string,
    signal: AbortSignal,
  ): Promise<{ modelsAvailable: number }> {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal,
    });
    if (!res.ok) {
      throw new HttpProviderError(res.status, await res.text());
    }
    const data = await res.json();
    return { modelsAvailable: data.data?.length ?? 0 };
  }

  private async testAnthropic(
    apiKey: string,
    signal: AbortSignal,
  ): Promise<{ modelsAvailable: number }> {
    // Anthropic n'a pas d'endpoint /models, on fait un appel messages minimal
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-20250514',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      }),
      signal,
    });
    // 200 = cle valide, 401 = cle invalide, 400 = cle valide mais requete invalide
    if (res.status === 401 || res.status === 403) {
      throw new HttpProviderError(res.status, await res.text());
    }
    return { modelsAvailable: 2 }; // Claude Sonnet 4 + Haiku 4
  }

  private async testGoogle(
    apiKey: string,
    signal: AbortSignal,
  ): Promise<{ modelsAvailable: number }> {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`,
      { signal },
    );
    if (!res.ok) {
      throw new HttpProviderError(res.status, await res.text());
    }
    const data = await res.json();
    return { modelsAvailable: data.models?.length ?? 0 };
  }

  private async testElevenLabs(
    apiKey: string,
    signal: AbortSignal,
  ): Promise<{ quotaRemaining?: number }> {
    const res = await fetch('https://api.elevenlabs.io/v1/user', {
      headers: { 'xi-api-key': apiKey },
      signal,
    });
    if (!res.ok) {
      throw new HttpProviderError(res.status, await res.text());
    }
    const data = await res.json();
    return {
      quotaRemaining: data.subscription?.character_limit
        ? data.subscription.character_limit - (data.subscription.character_count ?? 0)
        : undefined,
    };
  }

  private async testOllama(
    baseUrl: string,
    signal: AbortSignal,
  ): Promise<{ modelsAvailable: number }> {
    const res = await fetch(`${baseUrl}/api/tags`, { signal });
    if (!res.ok) {
      throw new HttpProviderError(res.status, await res.text());
    }
    const data = await res.json();
    return { modelsAvailable: data.models?.length ?? 0 };
  }

  private formatError(error: unknown): string {
    if (error instanceof HttpProviderError) {
      switch (error.status) {
        case 401: return 'Cle API invalide ou expiree';
        case 403: return 'Cle API sans les permissions necessaires';
        case 429: return 'Limite de taux atteinte, reessayez plus tard';
        default:
          if (error.status >= 500) return 'Le service du fournisseur est temporairement indisponible';
          return `Erreur HTTP ${error.status}`;
      }
    }
    if (error instanceof Error) {
      if (error.name === 'AbortError') return 'Le fournisseur ne repond pas (timeout 10s)';
      if (error.message.includes('fetch failed')) return 'Impossible de contacter le fournisseur';
      return error.message;
    }
    return 'Erreur inconnue';
  }
}

class HttpProviderError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`HTTP ${status}`);
    this.name = 'HttpProviderError';
  }
}
```

---

## 5. Integration avec le Health Check

### 5.1 Modification proposee

Le endpoint `/api/admin/ai-engine/health` existant sera modifie pour utiliser `ApiKeyManager.resolveApiKey()` au lieu de lire directement `getEngineConfig().apiKeys`.

```typescript
// Avant (dans health route)
const config = getEngineConfig();
const configured = !!config.apiKeys.openai;

// Apres
const keyManager = getApiKeyManager();
const resolved = await keyManager.resolveApiKey('openai');
const configured = resolved.source !== 'none';
const keySource = resolved.source;
```

### 5.2 Enrichissement de la reponse health

```typescript
// Avant
providers: {
  text: { configured: true, provider: 'openai' },
}

// Apres
providers: {
  text: {
    configured: true,
    provider: 'openai',
    keySource: 'database',        // NOUVEAU
    lastTestResult: 'success',    // NOUVEAU
    lastTestAt: '2026-05-25...',  // NOUVEAU
  },
}
```

---

## 6. Singleton et initialisation

### 6.1 Pattern singleton

```typescript
// apps/web/src/lib/ai-engine/services/api-key-manager.ts

let _managerInstance: ApiKeyManager | null = null;

export function getApiKeyManager(): ApiKeyManager {
  if (!_managerInstance) {
    const encryption = getEncryptionService();
    const database = db();
    _managerInstance = new ApiKeyManager(encryption, database);
  }
  return _managerInstance;
}

export function resetApiKeyManager(): void {
  _managerInstance = null;
}
```

### 6.2 Injection de dependances pour les tests

```typescript
// Pour les tests, les services sont injectables via le constructeur
const mockEncryption = new MockEncryptionService();
const mockDb = createMockDb();
const manager = new ApiKeyManager(mockEncryption, mockDb);
```

---

## 7. Audit Log Service

### 7.1 Fonction utilitaire

```typescript
interface AuditLogEntry {
  action: string;
  entityType: string;
  entityId?: string;
  actorEmail: string;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

async function insertAuditLog(entry: AuditLogEntry): Promise<void> {
  const database = db();
  if (!database) {
    console.warn('[audit] DB non disponible, log perdu:', entry.action);
    return;
  }

  try {
    await database.insert(aiEngineAuditLog).values({
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      actorEmail: entry.actorEmail,
      details: entry.details ?? null,
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
    });
  } catch (error) {
    // L'audit log ne doit jamais bloquer l'operation principale
    console.error('[audit] Erreur insertion audit log:', error);
  }
}
```

### 7.2 Principe de non-blocage

L'insertion de l'audit log ne doit **jamais** bloquer ou faire echouer l'operation principale. Si l'insertion echoue (DB indisponible, erreur de contrainte), l'erreur est logguee dans la console mais l'operation continue.
