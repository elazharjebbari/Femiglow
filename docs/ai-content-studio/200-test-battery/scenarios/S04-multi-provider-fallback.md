# S04 -- Multi-Provider Fallback: Key Resolution Chain

## Scenario ID
S04

## Priority
P1

## Type
Unit + Integration

## Description

This scenario tests the API key resolution chain for each of the 5 supported
providers. The system resolves keys in priority order:
1. Database (encrypted) -- highest priority
2. Environment variable -- fallback
3. Undefined / not configured -- lowest priority

This test verifies that the key resolution logic, the API keys management UI,
and the provider health status correctly reflect the resolution chain state.

## Preconditions

1. Operator authenticated with admin role
2. API Keys management page accessible
3. MSW handlers configured for `/api/admin/ai-engine/config/api-keys`

## Provider Configuration Matrix

| Provider | DB Key | Env Var | Expected Source | Expected Status |
|---|---|---|---|---|
| OpenAI | sk-proj-****abc1 | OPENAI_API_KEY set | database | active (green) |
| Anthropic | (none) | AI_ENGINE_ANTHROPIC_API_KEY set | env | active (amber) |
| Google | (none) | (not set) | none | inactive (gray) |
| ElevenLabs | (none) | (not set) | none | inactive (gray) |
| Ollama | (none) | (not set) | none | inactive (gray) |

## Step Sequence

### Phase 1: Verify API Keys Listing

#### Step 1: Navigate to API Keys Page
- **Action**: Navigate to `/admin/content-studio-v2/ai-engine/config` and access API Keys tab
- **Expected**: API keys listing loads
- **Assertions**:
  - 5 provider rows visible (openai, anthropic, google, elevenlabs, ollama)
- **MSW Handler**: `http.get('/api/admin/ai-engine/config/api-keys')` returns MOCK_API_KEYS

#### Step 2: Verify OpenAI (Database Source)
- **Assertions**:
  - OpenAI row shows source "database"
  - Masked key: "sk-proj-****abc1"
  - Status: active (green indicator)
  - Label: "Production key"
  - Last tested date shown
  - Delete button available (can remove DB key)
- **Expected**: DB-sourced key correctly displayed

#### Step 3: Verify Anthropic (Environment Variable Source)
- **Assertions**:
  - Anthropic row shows source "env"
  - Masked key: "sk-ant-****ef23"
  - Status: active
  - Label: "Variable d'environnement"
  - No delete button (cannot delete env vars from UI)
  - Note: env keys cannot be modified, only overridden by adding DB key
- **Expected**: Env-sourced key correctly displayed

#### Step 4: Verify Google (Not Configured)
- **Assertions**:
  - Google row shows source "none"
  - Masked key: empty
  - Status: inactive (gray indicator)
  - Label: "Non configure"
  - "Ajouter" or configure button available
- **Expected**: Missing key state clearly indicated

#### Step 5: Verify ElevenLabs (Not Configured)
- **Assertions**: Same pattern as Google -- source "none", inactive
- **Expected**: Consistent empty state display

#### Step 6: Verify Ollama (Not Configured)
- **Assertions**: Same pattern -- source "none", inactive
- **Expected**: Consistent empty state display

### Phase 2: Key Resolution Priority Test

#### Step 7: Add Database Key for Anthropic (Override Env)
- **Action**: Click add/configure button for Anthropic provider
- **Data**: Enter new API key "sk-ant-api03-new-key-value"
- **MSW Handler**:
  ```typescript
  http.post('/api/admin/ai-engine/config/api-keys', () =>
    HttpResponse.json({
      apiKey: {
        id: 'ak-new-anthro',
        providerType: 'anthropic',
        source: 'database',
        masked: 'sk-ant-****alue',
        isActive: true,
      }
    }, { status: 201 }))
  ```
- **Expected**: Key saved successfully
- **Assertions**:
  - Success feedback shown
  - Anthropic row now shows source "database" (overriding env)
  - Masked key updated to new value
- **Expected**: DB key takes priority over env var

#### Step 8: Delete Database Key for OpenAI
- **Action**: Click delete button on OpenAI DB key
- **MSW Handler**:
  ```typescript
  http.delete('/api/admin/ai-engine/config/api-keys/:id', () =>
    HttpResponse.json({ success: true, fallbackToEnv: true }))
  ```
- **Expected**: Key deleted, falls back to env
- **Assertions**:
  - OpenAI row now shows source "env" (if OPENAI_API_KEY env var exists)
  - OR shows source "none" (if no env var)
  - Status updates accordingly
- **Expected**: Deletion causes fallback in resolution chain

#### Step 9: Test Key Validity
- **Action**: Click "Tester" button for OpenAI
- **MSW Handler**:
  ```typescript
  http.post('/api/admin/ai-engine/config/api-keys/test', () =>
    HttpResponse.json({ result: { valid: true, provider: 'openai', latencyMs: 150 } }))
  ```
- **Expected**: Test result displayed
- **Assertions**:
  - "Valide" status shown
  - Latency displayed (150ms)
  - Last tested timestamp updated

#### Step 10: Test Invalid Key
- **Action**: Test a key that fails validation
- **MSW Handler**:
  ```typescript
  http.post('/api/admin/ai-engine/config/api-keys/test', () =>
    HttpResponse.json({ result: { valid: false, provider: 'google', latencyMs: 200, error: 'Invalid API key' } }))
  ```
- **Expected**: Invalid result displayed
- **Assertions**:
  - "Invalide" status shown
  - Error message "Invalid API key" visible
- **Expected**: Failed test clearly communicated

### Phase 3: Provider Health Correlation

#### Step 11: Check Provider Health on Dashboard
- **Action**: Navigate to AI Engine dashboard or health endpoint
- **MSW Handler**: Health endpoint reflecting current key state
- **Assertions**:
  - Providers with active keys show "configured: true"
  - Providers without keys show "configured: false"
  - Health status correlates with key availability
- **Expected**: Dashboard accurately reflects key configuration

### Phase 4: Error Scenarios

#### Step 12: Encryption Service Unavailable
- **Action**: Attempt to save a new key when encryption service is down
- **MSW Handler**:
  ```typescript
  http.post('/api/admin/ai-engine/config/api-keys', () =>
    HttpResponse.json({ error: "Le chiffrement n'est pas configure." }, { status: 503 }))
  ```
- **Expected**: Error displayed
- **Assertions**:
  - Error message about encryption visible
  - Key not saved
  - Existing keys unaffected

#### Step 13: Rate Limited Key Test
- **Action**: Rapidly test keys
- **MSW Handler**:
  ```typescript
  http.post('/api/admin/ai-engine/config/api-keys/test', () =>
    HttpResponse.json({ error: 'Trop de tentatives.' }, { status: 429 }))
  ```
- **Expected**: Rate limit error displayed
- **Assertions**:
  - "Trop de tentatives" message visible
  - Test button temporarily disabled or shows cooldown

#### Step 14: Delete Non-Existent Key
- **Action**: Attempt to delete a key that was already removed
- **MSW Handler**:
  ```typescript
  http.delete('/api/admin/ai-engine/config/api-keys/:id', () =>
    HttpResponse.json({ error: 'Cle API introuvable' }, { status: 404 }))
  ```
- **Expected**: 404 error displayed
- **Assertions**:
  - Error message visible
  - UI state refreshed

## MSW Handlers Required

```typescript
const keyResolutionHandlers = [
  ...apiKeysHandlers,           // Standard CRUD handlers
  ...apiKeysErrorHandlers,      // Error variant handlers
];
```

## Cleanup

- Reset MSW handlers between phases
- If real API: restore original key state

## Key Verification Points

1. **Resolution order**: DB > env > none is enforced
2. **Source display**: UI correctly shows where each key comes from
3. **Override behavior**: Adding DB key overrides env var display
4. **Fallback behavior**: Deleting DB key falls back to env var
5. **Test functionality**: Key validation works and displays results
6. **Error handling**: Encryption down, rate limits, 404s all handled
7. **Masked display**: Keys never shown in full, always masked
8. **Security**: No key values exposed in UI or network requests
