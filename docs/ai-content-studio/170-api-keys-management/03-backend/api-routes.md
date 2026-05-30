# Routes API - Gestion des Cles API

> Module : 170 - API Keys Management
> Framework : Next.js 14 App Router (Route Handlers)
> Date : 2026-05-25

---

## 1. Vue d'ensemble des routes

| Methode | Route | Description | Auth |
|---------|-------|-------------|------|
| GET | `/api/admin/ai-engine/config/api-keys` | Lister les cles (masquees) | `requireAdminApi()` |
| POST | `/api/admin/ai-engine/config/api-keys` | Creer ou mettre a jour une cle | `requireAdminApi()` |
| DELETE | `/api/admin/ai-engine/config/api-keys/[id]` | Supprimer une cle | `requireAdminApi()` |
| POST | `/api/admin/ai-engine/config/api-keys/test` | Tester la validite d'une cle | `requireAdminApi()` + rate limit |

### 1.1 Localisation des fichiers

```
apps/web/src/app/api/admin/ai-engine/config/
  api-keys/
    route.ts          # GET + POST
    [id]/
      route.ts        # DELETE
    test/
      route.ts        # POST (test validite)
```

### 1.2 Configuration commune

```typescript
// Chaque fichier route.ts inclut :
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
```

---

## 2. GET /api/admin/ai-engine/config/api-keys

### 2.1 Description

Liste toutes les cles API configurees pour les 5 fournisseurs. Pour chaque fournisseur, retourne la cle active (DB ou env var) avec les informations masquees. Les fournisseurs sans cle sont retournes avec `source: 'none'`.

### 2.2 Requete

```
GET /api/admin/ai-engine/config/api-keys
Authorization: Session cookie (iron-session)
```

Aucun parametre de requete.

### 2.3 Schema de reponse

```typescript
// Reponse 200 OK
interface ListApiKeysResponse {
  keys: ApiKeySummary[];
  meta: {
    total: number;           // Nombre total de fournisseurs (toujours 5)
    configuredCount: number; // Nombre de fournisseurs avec une cle
    dbKeyCount: number;      // Nombre de cles stockees en DB
    envKeyCount: number;     // Nombre de cles venant des env vars
  };
}

interface ApiKeySummary {
  id: string | null;           // null si source === 'env' ou 'none'
  providerType: string;        // 'openai' | 'anthropic' | 'google' | 'elevenlabs' | 'ollama'
  providerName: string;        // 'OpenAI' | 'Anthropic' | 'Google AI (Gemini)' | 'ElevenLabs' | 'Ollama (local)'
  label: string | null;
  maskedKey: string | null;    // null si source === 'none'
  keyPrefix: string | null;
  source: 'database' | 'env' | 'none';
  isActive: boolean;
  lastTestedAt: string | null;      // ISO 8601
  lastTestResult: 'success' | 'failure' | 'untested';
  lastTestError: string | null;
  expiresAt: string | null;         // ISO 8601
  envVarName: string | null;        // Nom de l'env var si source === 'env'
  createdAt: string | null;         // ISO 8601, null si pas en DB
  updatedAt: string | null;         // ISO 8601, null si pas en DB
}
```

### 2.4 Logique de construction de la reponse

```typescript
async function GET(): Promise<Response> {
  const session = await requireAdminApi();
  const config = getEngineConfig();

  // 1. Recuperer les cles DB actives
  const dbKeys = await database
    .select()
    .from(aiEngineApiKeys)
    .where(eq(aiEngineApiKeys.isActive, true));

  // 2. Pour chaque fournisseur, construire le resume
  const PROVIDERS = ['openai', 'anthropic', 'google', 'elevenlabs', 'ollama'];
  const keys: ApiKeySummary[] = PROVIDERS.map(providerType => {
    const dbKey = dbKeys.find(k => k.providerType === providerType);
    if (dbKey) {
      return buildDbKeySummary(dbKey, providerType);
    }
    const envKey = getEnvVarKeyForProvider(providerType, config);
    if (envKey) {
      return buildEnvKeySummary(envKey, providerType, config);
    }
    return buildNoneKeySummary(providerType);
  });

  // 3. Construire les meta
  const configuredCount = keys.filter(k => k.source !== 'none').length;
  const dbKeyCount = keys.filter(k => k.source === 'database').length;
  const envKeyCount = keys.filter(k => k.source === 'env').length;

  return NextResponse.json({
    keys,
    meta: { total: PROVIDERS.length, configuredCount, dbKeyCount, envKeyCount },
  });
}
```

### 2.5 Reponses d'erreur

| HTTP Status | Condition | Corps |
|-------------|-----------|-------|
| 401 | Session invalide ou absente | `{ error: "Session expiree" }` |
| 500 | Erreur interne | `{ error: "Erreur serveur" }` |

---

## 3. POST /api/admin/ai-engine/config/api-keys

### 3.1 Description

Cree une nouvelle cle API ou met a jour la cle existante pour un fournisseur. La cle est chiffree avec AES-256-GCM avant stockage. Par defaut, la cle est testee avant sauvegarde (desactivable via `skipValidation`).

### 3.2 Schema de requete (Zod)

```typescript
const createApiKeySchema = z.object({
  providerType: z.enum(['openai', 'anthropic', 'google', 'elevenlabs', 'ollama']),
  apiKey: z.string().min(1, 'La cle API est requise'),
  label: z.string().max(100).optional(),
  baseUrl: z.string().url().optional(),
  skipValidation: z.boolean().default(false),
});
```

### 3.3 Requete

```
POST /api/admin/ai-engine/config/api-keys
Content-Type: application/json
Authorization: Session cookie (iron-session)

{
  "providerType": "openai",
  "apiKey": "sk-proj-abc123...",
  "label": "Compte production",
  "skipValidation": false
}
```

### 3.4 Schema de reponse

```typescript
// Reponse 200 OK (creation ou mise a jour reussie)
interface CreateApiKeyResponse {
  key: ApiKeySummary;
  validation: {
    valid: boolean;
    latencyMs: number;
    error: string | null;
    details: {
      modelsAvailable?: number;
      quotaRemaining?: number;
      planType?: string;
    } | null;
  } | null;  // null si skipValidation === true
}
```

### 3.5 Logique de traitement

```typescript
async function POST(request: Request): Promise<Response> {
  const session = await requireAdminApi();
  const body = await request.json();
  const parsed = createApiKeySchema.parse(body);

  // 1. Verifier que le service de chiffrement est disponible
  if (!isEncryptionAvailable()) {
    return NextResponse.json(
      { error: 'Chiffrement non configure', code: 'ENCRYPTION_KEY_MISSING' },
      { status: 500 },
    );
  }

  // 2. Valider la cle (sauf si skipValidation)
  let validationResult = null;
  if (!parsed.skipValidation) {
    validationResult = await apiKeyValidator.validate(
      parsed.providerType,
      parsed.apiKey,
      parsed.baseUrl,
    );
    if (!validationResult.valid) {
      return NextResponse.json(
        {
          error: 'La cle API n\'est pas valide',
          code: 'VALIDATION_FAILED',
          details: { validationError: validationResult.error },
        },
        { status: 422 },
      );
    }
  }

  // 3. Chiffrer la cle
  const encryptedKey = encryptionService.encrypt(parsed.apiKey);
  const maskedKey = encryptionService.mask(parsed.apiKey);
  const keyPrefix = extractKeyPrefix(parsed.apiKey);

  // 4. Desactiver les cles existantes pour ce fournisseur
  await database
    .update(aiEngineApiKeys)
    .set({ isActive: false, updatedAt: new Date(), updatedBy: session.email })
    .where(
      and(
        eq(aiEngineApiKeys.providerType, parsed.providerType),
        eq(aiEngineApiKeys.isActive, true),
      ),
    );

  // 5. Inserer la nouvelle cle
  const [newKey] = await database
    .insert(aiEngineApiKeys)
    .values({
      providerType: parsed.providerType,
      label: parsed.label ?? null,
      encryptedKey,
      maskedKey,
      keyPrefix,
      isActive: true,
      lastTestedAt: validationResult ? new Date() : null,
      lastTestResult: validationResult?.valid ? 'success' : null,
      createdBy: session.email,
    })
    .returning();

  // 6. Invalider le cache
  invalidateKeyCache(parsed.providerType);

  // 7. Audit log
  await insertAuditLog({
    action: 'api_key.created',
    entityType: 'api_key',
    entityId: newKey.id,
    actorEmail: session.email,
    details: { providerType: parsed.providerType, maskedKey },
    ipAddress: getClientIp(request),
    userAgent: request.headers.get('user-agent'),
  });

  // 8. Reponse
  return NextResponse.json({
    key: buildDbKeySummary(newKey, parsed.providerType),
    validation: validationResult,
  });
}
```

### 3.6 Reponses d'erreur

| HTTP Status | Code | Condition | Corps |
|-------------|------|-----------|-------|
| 400 | `VALIDATION_ERROR` | Schema Zod invalide | `{ error, details: zodErrors }` |
| 401 | - | Session invalide | `{ error: "Session expiree" }` |
| 422 | `VALIDATION_FAILED` | Cle API invalide (test echoue) | `{ error, code, details }` |
| 500 | `ENCRYPTION_KEY_MISSING` | Variable de chiffrement absente | `{ error, code }` |
| 503 | `DB_UNAVAILABLE` | Base de donnees non disponible | `{ error, code }` |

---

## 4. DELETE /api/admin/ai-engine/config/api-keys/[id]

### 4.1 Description

Supprime une cle API stockee en base de donnees. Apres suppression, le systeme tente de resoudre la cle depuis les variables d'environnement (fallback).

### 4.2 Requete

```
DELETE /api/admin/ai-engine/config/api-keys/{id}
Authorization: Session cookie (iron-session)
```

Parametre de chemin : `id` (UUID de la cle)

### 4.3 Schema de reponse

```typescript
// Reponse 200 OK
interface DeleteApiKeyResponse {
  deleted: boolean;
  fallbackAvailable: boolean;
  fallbackSource: string | null;  // Nom de l'env var de fallback
}
```

### 4.4 Logique de traitement

```typescript
async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  const session = await requireAdminApi();

  // 1. Recuperer la cle avant suppression (pour l'audit)
  const existing = await database
    .select()
    .from(aiEngineApiKeys)
    .where(eq(aiEngineApiKeys.id, params.id))
    .then(rows => rows[0]);

  if (!existing) {
    return NextResponse.json(
      { error: 'Cle introuvable', code: 'PROVIDER_NOT_FOUND' },
      { status: 404 },
    );
  }

  // 2. Supprimer la cle
  await database
    .delete(aiEngineApiKeys)
    .where(eq(aiEngineApiKeys.id, params.id));

  // 3. Verifier le fallback env var
  const envKey = getEnvVarKeyForProvider(existing.providerType, getEngineConfig());
  const envVarName = getEnvVarNameForProvider(existing.providerType);

  // 4. Invalider le cache
  invalidateKeyCache(existing.providerType);

  // 5. Audit log
  await insertAuditLog({
    action: 'api_key.deleted',
    entityType: 'api_key',
    entityId: params.id,
    actorEmail: session.email,
    details: {
      providerType: existing.providerType,
      maskedKey: existing.maskedKey,
      fallbackAvailable: !!envKey,
    },
    ipAddress: getClientIp(request),
    userAgent: request.headers.get('user-agent'),
  });

  return NextResponse.json({
    deleted: true,
    fallbackAvailable: !!envKey,
    fallbackSource: envKey ? envVarName : null,
  });
}
```

### 4.5 Reponses d'erreur

| HTTP Status | Code | Condition |
|-------------|------|-----------|
| 401 | - | Session invalide |
| 404 | `PROVIDER_NOT_FOUND` | ID de cle invalide |
| 503 | `DB_UNAVAILABLE` | Base de donnees non disponible |

---

## 5. POST /api/admin/ai-engine/config/api-keys/test

### 5.1 Description

Teste la validite d'une cle API en effectuant un appel minimal au fournisseur. Peut tester soit une cle fournie en parametre, soit la cle active resolue pour un fournisseur.

### 5.2 Schema de requete (Zod)

```typescript
const testApiKeySchema = z.object({
  providerType: z.enum(['openai', 'anthropic', 'google', 'elevenlabs', 'ollama']),
  apiKey: z.string().optional(),   // Si absent, teste la cle active resolue
  baseUrl: z.string().url().optional(),
});
```

### 5.3 Requete

```
POST /api/admin/ai-engine/config/api-keys/test
Content-Type: application/json
Authorization: Session cookie (iron-session)

{
  "providerType": "openai"
}
```

Ou avec une cle specifique :
```json
{
  "providerType": "openai",
  "apiKey": "sk-proj-abc123..."
}
```

### 5.4 Schema de reponse

```typescript
// Reponse 200 OK
interface TestApiKeyResponse {
  valid: boolean;
  provider: string;
  latencyMs: number;
  error: string | null;
  details: {
    modelsAvailable?: number;
    quotaRemaining?: number;
    planType?: string;
  } | null;
}
```

### 5.5 Logique de traitement

```typescript
async function POST(request: Request): Promise<Response> {
  const session = await requireAdminApi();

  // 1. Rate limiting
  if (!checkTestRateLimit(session.email)) {
    return NextResponse.json(
      { error: 'Limite de taux depassee. Reessayez dans 1 minute.', code: 'RATE_LIMIT_EXCEEDED' },
      { status: 429 },
    );
  }

  const body = await request.json();
  const parsed = testApiKeySchema.parse(body);

  // 2. Resoudre la cle a tester
  let keyToTest: string;
  let baseUrl = parsed.baseUrl;

  if (parsed.apiKey) {
    // Cle fournie directement
    keyToTest = parsed.apiKey;
  } else {
    // Resoudre depuis DB ou env
    const resolved = await resolveApiKey(parsed.providerType);
    if (!resolved.key) {
      return NextResponse.json(
        { error: 'Aucune cle configuree pour ce fournisseur', code: 'PROVIDER_NOT_FOUND' },
        { status: 404 },
      );
    }
    keyToTest = resolved.key;
  }

  // 3. Tester la cle
  const result = await apiKeyValidator.validate(parsed.providerType, keyToTest, baseUrl);

  // 4. Mettre a jour le statut en DB (si la cle testee est la cle active en DB)
  if (!parsed.apiKey) {
    const dbKey = await getActiveDbKeyForProvider(parsed.providerType);
    if (dbKey) {
      await database
        .update(aiEngineApiKeys)
        .set({
          lastTestedAt: new Date(),
          lastTestResult: result.valid ? 'success' : 'failure',
          lastTestError: result.error ?? null,
          updatedAt: new Date(),
        })
        .where(eq(aiEngineApiKeys.id, dbKey.id));
    }
  }

  // 5. Audit log
  await insertAuditLog({
    action: 'api_key.tested',
    entityType: 'api_key',
    actorEmail: session.email,
    details: {
      providerType: parsed.providerType,
      result: result.valid ? 'success' : 'failure',
      latencyMs: result.latencyMs,
      error: result.error,
      source: parsed.apiKey ? 'manual' : 'resolved',
    },
    ipAddress: getClientIp(request),
    userAgent: request.headers.get('user-agent'),
  });

  return NextResponse.json({
    valid: result.valid,
    provider: parsed.providerType,
    latencyMs: result.latencyMs,
    error: result.error ?? null,
    details: result.details ?? null,
  });
}
```

### 5.6 Reponses d'erreur

| HTTP Status | Code | Condition |
|-------------|------|-----------|
| 400 | `VALIDATION_ERROR` | Schema Zod invalide |
| 401 | - | Session invalide |
| 404 | `PROVIDER_NOT_FOUND` | Aucune cle configuree |
| 429 | `RATE_LIMIT_EXCEEDED` | Plus de 5 tests/minute |

---

## 6. Fonctions utilitaires partagees

### 6.1 Mapping fournisseur -> nom d'affichage

```typescript
const PROVIDER_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google AI (Gemini)',
  elevenlabs: 'ElevenLabs',
  ollama: 'Ollama (local)',
};
```

### 6.2 Mapping fournisseur -> variable d'environnement

```typescript
const PROVIDER_ENV_VARS: Record<string, string[]> = {
  openai: ['AI_ENGINE_OPENAI_API_KEY', 'CONTENT_STUDIO_OPENAI_API_KEY', 'CHAT_OPENAI_API_KEY', 'OPENAI_API_KEY'],
  anthropic: ['AI_ENGINE_ANTHROPIC_API_KEY', 'CHAT_ANTHROPIC_API_KEY'],
  google: ['AI_ENGINE_GOOGLE_API_KEY', 'CHAT_GEMINI_API_KEY'],
  elevenlabs: ['AI_ENGINE_ELEVENLABS_API_KEY'],
  ollama: ['AI_ENGINE_OLLAMA_BASE_URL', 'CHAT_OLLAMA_BASE_URL'],
};
```

### 6.3 Extraction du prefixe de cle

```typescript
function extractKeyPrefix(apiKey: string): string | null {
  const prefixes = [
    'sk-proj-', 'sk-ant-api03-', 'sk-ant-', 'sk-',
    'AIza', 'gsk_',
  ];
  for (const prefix of prefixes) {
    if (apiKey.startsWith(prefix)) {
      return prefix;
    }
  }
  return null;
}
```

### 6.4 Obtenir l'IP du client

```typescript
function getClientIp(request: Request): string | null {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    null
  );
}
```
