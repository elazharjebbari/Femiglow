# F02 -- Config > Providers

## Feature ID
F02-config-providers

## Description
The Providers tab on the AI Engine Configuration page displays a responsive card grid of all AI providers (OpenAI, Anthropic, Google, ElevenLabs, Ollama). Each ProviderCard shows provider health status, capability badges, model list (max 3 visible), budget/rate info, and supports inline editing (priority, budget, rate limit, enabled/fallback toggles, model selection via ModelSelector, Ollama baseUrl) with save feedback and connection testing.

## UI Location
- **Page path**: `/admin/content-studio-v2/ai-engine/config`
- **Tab**: Providers (first tab, `tab === 'providers'`)
- **Section**: Card grid below stat summary and tab navigation

## Components Involved
| Component | Path |
|---|---|
| `AIEngineConfigPage` | `apps/web/src/app/admin/content-studio-v2/ai-engine/config/page.tsx` |
| `ProviderCard` | Same file, internal sub-component |
| `StatCard` | Same file, internal sub-component |
| `Toggle` | Same file, internal sub-component |
| `ModelSelector` | `apps/web/src/components/admin/content-studio-v2/ai-engine/ModelSelector.tsx` |
| `Button` | `apps/web/src/components/admin/content-studio-v2/primitives` |
| `Badge` | Same primitives module |
| `Input` | Same primitives module |

## API Routes
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/admin/ai-engine/config/providers` | List all providers |
| POST | `/api/admin/ai-engine/config/providers` | Update a provider's settings |
| GET | `/api/admin/ai-engine/health` | Test connection to a provider |

## Data Flow
1. On mount, `fetchData()` calls GET `/config/providers` (plus workflows, prompts in parallel)
2. Response `{ providers: ProviderData[] }` stored in state
3. Provider grid rendered with `providers.map(p => <ProviderCard />)`
4. Edit: user clicks "Editer" -> inline form opens with current values pre-populated
5. Save: POST `/config/providers` with `{ id, priority, dailyBudgetCents, rateLimitRpm, isEnabled, isFallback, models, baseUrl }`
6. On success: feedback banner "Configuration sauvegardee" (1.2s auto-dismiss), `fetchData()` refreshes
7. On error: feedback banner "Erreur lors de la sauvegarde"
8. Test connection: calls GET `/health`, shows spinner for 1.2s

## States
| State | Condition | Visual |
|---|---|---|
| Loading | `loading === true` | Skeleton placeholders (3 divs) |
| Error | `error !== null` | Red error section with retry button |
| Success | Data loaded, providers array populated | Card grid rendered |
| Provider active | `provider.isEnabled === true` | Full opacity |
| Provider disabled | `provider.isEnabled === false` | `opacity: 0.55` |
| Provider configured | `provider.configured === true` | Green status dot, "Actif" badge, colored health bar |
| Provider unconfigured | `provider.configured === false` | Muted dot, "Inactif" badge, gray health bar |
| Health bar healthy | `healthStatus === 'healthy'` | `var(--cs-success)` green bar |
| Health bar degraded | `healthStatus === 'degraded'` | `var(--cs-warning)` yellow bar |
| Health bar unhealthy | `healthStatus === 'unhealthy'` | `var(--cs-danger)` red bar |
| Health bar unconfigured | `configured === false` | `var(--cs-border)` gray bar |
| Edit mode | `editing === true` | Inline form below card body |
| Edit saving | `saving === true` | Save button loading, inputs disabled |
| Edit feedback success | Save returned true | Green "Configuration sauvegardee" banner |
| Edit feedback error | Save returned false | Red "Erreur lors de la sauvegarde" banner |
| Testing connection | `testingProvider === provider.id` | Spinner on Tester button |

## Validation Rules
- Priority: `min=1, max=100`, type=number
- Budget: `min=0`, stored in cents (display divides by 100)
- Rate limit: `min=1, max=10000`, req/min
- Enabled and Fallback: checkbox toggles
- Ollama baseUrl field: shown only when `provider.providerType === 'ollama'`, type=url
- Test button disabled when `testing || !provider.configured`
- Edit button disabled when already editing

## Design Tokens
| Token | Usage |
|---|---|
| `--cs-success` | Healthy health bar, configured dot |
| `--cs-warning` | Degraded health bar |
| `--cs-danger` | Unhealthy health bar, error feedback |
| `--cs-border` / `--cs-border-hair` | Card borders |
| `--cs-bg-elevated` | Card background |
| `--cs-bg-base` | Edit form background |
| `--cs-accent` | Capability badge colors per CAPABILITY_COLORS map |
| `--cs-saffron` | Image capability badge |
| `--cs-violet` | Video/Vision capability badge |
| `--cs-sage` | TTS/STT capability badge |
| `--cs-clay` | Embedding capability badge |

## Accessibility
- Cards are non-interactive containers (no role needed)
- Toggle uses `<button role="switch" aria-checked={checked}>`
- Edit/Test buttons are `<Button>` components
- Form inputs have labels via `<Input label="...">` prop
- Disabled state: inputs and buttons have `disabled` attribute

## Edge Cases
- Provider with 0 models: no model list section rendered
- Provider with exactly 3 models: all shown, no "+ N autres modeles" text
- Provider with > 3 models: first 3 shown, `+ {hiddenCount} autres modeles` text
- Model cost display: uses `costPerUnit` if present, else `costPer1MInput`, else "---"
- Save feedback auto-dismisses after 1200ms
- Budget display: `dailyBudgetCents / 100` formatted as MAD/j, only shown if > 0
- Rate limit display: `{rpm}/min`, only shown if non-null
- Ollama provider: shows extra baseUrl field in edit form
- ModelSelector integration: `editModels` is synced to ModelSelector's `selectedModels`
- Concurrent edit: only one card can be in edit mode at a time per card instance (each has own state)
