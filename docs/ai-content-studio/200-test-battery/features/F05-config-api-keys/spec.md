# F05 -- Config > API Keys

## Feature ID
F05-config-api-keys

## Description
The API Keys tab on the AI Engine Configuration page manages authentication credentials for each AI provider. It displays 5 provider cards (OpenAI, Anthropic, Google/Gemini, ElevenLabs, Ollama) with their key source (database, env var, or none), masked key display, test functionality with rate limiting (429), add/delete operations, and a stat card showing configured count. Keys stored in database are encrypted. Ollama uses base URL instead of API key.

## UI Location
- **Page path**: `/admin/content-studio-v2/ai-engine/config`
- **Tab**: Cles API (fourth tab, `tab === 'api-keys'`)
- **Section**: Key grid below tab bar, add form inline

## Components Involved
| Component | Path |
|---|---|
| `AIEngineConfigPage` | `apps/web/src/app/admin/content-studio-v2/ai-engine/config/page.tsx` |
| `StatCard` | Same file (header stats) |

## API Routes
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/admin/ai-engine/config/api-keys` | List all provider key info |
| POST | `/api/admin/ai-engine/config/api-keys` | Save a new API key |
| DELETE | `/api/admin/ai-engine/config/api-keys/[id]` | Delete a DB-stored key |
| POST | `/api/admin/ai-engine/config/api-keys/test` | Test a key validity |

### API Key Test Rate Limiting
- Max 5 requests per 60-second window per session
- Returns 429 with `Retry-After` header when exceeded
- Client displays: "Trop de tentatives. Reessayez dans 1 minute."

### POST Create Schema (Zod)
```typescript
{
  providerType: z.enum(['openai', 'anthropic', 'google', 'elevenlabs', 'ollama']),
  apiKey: z.string().min(1).max(500),
  label: z.string().min(1).max(100).optional(),
  baseUrl: z.string().url().optional(),
}
```

## Data Flow
1. Tab activation (`tab === 'api-keys'` && not yet fetched): `fetchApiKeysOnce()` calls GET
2. Response: `{ apiKeys: ApiKeyInfo[] }` -- one entry per provider
3. Cards rendered in grid `minmax(340px, 1fr)`, keyed by `providerType`
4. Add: "Ajouter une cle" button opens inline form with provider select, key input, label input
5. Ollama mode: key input changes to URL input, extra optional key field shown
6. Test: "Tester" button on configured keys -> POST `/test` with `{ providerType }`
7. Delete: only for `source === 'database'` keys -> confirm dialog -> DELETE `/api-keys/{id}`

## ApiKeyInfo Shape
```typescript
{
  id: string | null;
  providerType: string;
  providerName: string;
  label: string;
  source: 'database' | 'env' | 'none';
  masked: string;               // "sk-...abc1"
  keyPrefix: string;
  keyLastFour: string;
  isActive: boolean;
  baseUrl: string | null;
  lastTestedAt: string | null;
  lastTestResult: string | null; // "valid" | "invalid"
  createdAt: string | null;
  updatedAt: string | null;
}
```

## States
| State | Condition | Visual |
|---|---|---|
| Loading keys | `loadingKeys === true` | Loader2 spinner + "Chargement..." |
| Keys error | `keysError !== null` | Red error banner |
| Keys loaded | Data available | Card grid |
| Source: database | `source === 'database'` | Badge "Base de donnees" (accent tone), delete button visible |
| Source: env | `source === 'env'` | Badge "Env var" (sage tone), no delete button |
| Source: none | `source === 'none'` | Badge "Non configure" (neutral tone), card opacity 0.7 |
| Masked key visible | `source !== 'none'` | Code element with masked string |
| Test result valid | `lastTestResult === 'valid'` | Badge "Valide" (success) |
| Test result invalid | `lastTestResult === 'invalid'` | Badge "Invalide" (warning) |
| Testing in progress | `testingKeyProvider === providerType` | Button loading spinner |
| Add form visible | `showApiKeyForm === true` | Inline form with accent border |
| Saving key | `savingApiKey === true` | Form button loading, inputs disabled |
| Confirm delete | `confirmDeleteKey !== null` | Red confirm banner with name |
| Deleting key | `deletingKeyId !== null` | Delete button loading |

## Validation Rules
- Add form: save disabled when key is empty (`!apiKeyFormValue.trim()`) for non-Ollama
- Add form for Ollama: save disabled when base URL is empty (`!apiKeyFormBaseUrl.trim()`)
- Provider select: 5 options (openai, anthropic, google, elevenlabs, ollama)
- API key field: `type="password"`, `autoComplete="off"` for non-Ollama
- Ollama base URL: `type="url"`
- Delete: only visible for `source === 'database' && key.id` is not null
- Test: disabled when `source === 'none'` or another test is already running
- Rate limit: 429 response triggers specific toast message

## Design Tokens
| Token | Usage |
|---|---|
| `--cs-bg-elevated` | Key card background, form background |
| `--cs-border-hair` | Card border (configured) |
| `--cs-border` | Card border (unconfigured), form border |
| `--cs-accent` | Form border (add form), database badge |
| `--cs-bg-sunken` | Masked key code background |
| `--cs-danger` | Delete button color, confirm banner, error banner |
| `--cs-danger-bg` | Confirm banner background, error background |
| `--cs-success` | Valid test result badge |
| `--cs-warning` | Invalid test result badge |

## Accessibility
- Provider select: native `<select>` element
- Key input: `type="password"` with `autoComplete="off"` (prevents browser autofill)
- Test/Delete buttons: `<Button>` components with disabled states
- Confirm delete: inline banner with cancel/confirm actions
- Masked key: displayed in `<code>` element

## Edge Cases
- Keys are fetched only once (lazy-load on first tab activation)
- `fetchApiKeysOnce` uses `keysFetched` flag to prevent re-fetch
- Stat card in header shows count of keys where `source !== 'none'`
- Stat card accent color: green if >= 3 configured, saffron if < 3
- Ollama provider: key input switches to URL input, shows extra optional key field
- Delete success with `fallbackToEnv: true`: toast says "Cle supprimee -- fallback sur variable d'env"
- Delete success without fallback: toast says "Cle supprimee"
- Test success: toast shows provider name, "Cle valide" with latency in ms
- Test failure: toast shows provider name and error message
- Rate limit 429: specific toast message, no infinite retry loop
- POST 503 when encryption not configured: specific error message about missing env vars
- Concurrent test: `testingKeyProvider` disables all other test buttons while one is running
- Last tested date: formatted as French locale date
