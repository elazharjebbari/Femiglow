# Provider System — Detailed Description

**Module** : `src/lib/ai-engine/providers/`  
**Version** : 1.0.0-mvp  
**Date** : 2026-05-25

---

## 1. Provider Hub Architecture

The Provider Hub is the abstraction layer between the AI Engine pipeline nodes and the external AI service providers (OpenAI, Anthropic, Google, ElevenLabs, etc.). It provides a unified interface for all AI capabilities while handling resilience, cost control, and provider selection transparently.

### Core Components

| Component | File | Responsibility |
|---|---|---|
| **ProviderAdapter** (abstract) | `adapters/base.ts` | Base class exposing `generateText`, `generateImage`, `generateEmbedding`, `generateVideo`, `generateTts`, `generateMusic`. Each adapter wraps a circuit breaker and retry policy. |
| **OpenAIAdapter** | `adapters/openai.ts` | OpenAI GPT-4/DALL-E/Whisper/TTS integration via `@langchain/openai`. |
| **AnthropicAdapter** | `adapters/anthropic.ts` | Anthropic Claude integration via `@langchain/anthropic`. Text-only capability. |
| **GoogleAdapter** | `adapters/google.ts` | Google Gemini integration via `@langchain/google-genai`. Text + image + video. |
| **ProviderSelector** | `selector.ts` | Selects the best available provider for a given capability, considering health, budget, and circuit breaker state. |
| **CircuitBreaker** | `circuit-breaker.ts` | Per-provider circuit breaker implementing the CLOSED/OPEN/HALF_OPEN state machine. |
| **RetryPolicy** | `retry.ts` | Exponential backoff with jitter for transient failures. |
| **CostTracker** | `cost-tracker.ts` | In-memory daily cost tracking per tenant. |
| **Types** | `types.ts` | Zod schemas for `ProviderConfig`, `ProviderCapability`, `ModelConfig`, error classes. |

### Data Flow

```
Pipeline Node (e.g. generateScript)
  -> ProviderSelector.selectProvider('generateScript', 'text')
    -> filters by: isEnabled, capability match, healthStatus != unhealthy,
       circuit breaker != OPEN, daily budget not exceeded
    -> sorts by priority
    -> returns ProviderAdapter
  -> adapter.generateText(params)
    -> CircuitBreaker.execute(fn)
      -> RetryPolicy.execute(fn)
        -> LangChain SDK call (ChatOpenAI / ChatAnthropic / ChatGoogleGenerativeAI)
```

---

## 2. Circuit Breaker States and Transitions

The circuit breaker follows the standard three-state pattern to prevent cascading failures when a provider is experiencing issues.

### States

| State | Description | Behavior |
|---|---|---|
| **CLOSED** | Normal operation | All requests pass through. Failures are counted. |
| **OPEN** | Provider is considered unavailable | All requests are immediately rejected with `ProviderError`. |
| **HALF_OPEN** | Testing if provider has recovered | A limited number of requests are allowed through (default: 1). |

### Transitions

```
CLOSED --[failureCount >= failureThreshold]--> OPEN
OPEN --[resetTimeoutMs elapsed]--> HALF_OPEN
HALF_OPEN --[success]--> CLOSED (reset counters)
HALF_OPEN --[failure]--> OPEN (restart timeout)
```

### Configuration

Defined in `CircuitBreakerConfig` (Zod schema):

| Parameter | Default | Description |
|---|---|---|
| `failureThreshold` | 5 | Consecutive failures before opening |
| `resetTimeoutMs` | 60000 (1 min) | Time before transitioning OPEN -> HALF_OPEN |
| `halfOpenMaxCalls` | 1 | Number of test calls allowed in HALF_OPEN |

---

## 3. Retry Policy Behavior

The `RetryPolicy` class implements exponential backoff with jitter for transient errors.

### Algorithm

```
delay(attempt) = min(baseDelayMs * exponentialBase^attempt, maxDelayMs) * random(0.5, 1.0)
```

### Configuration

| Parameter | Default | Description |
|---|---|---|
| `maxRetries` | 3 | Maximum number of retry attempts |
| `baseDelayMs` | 1000 | Base delay between retries |
| `maxDelayMs` | 60000 | Maximum cap on delay |
| `exponentialBase` | 2 | Exponential multiplier |

### Non-Retryable Errors

The following HTTP status codes are considered non-retryable and will fail immediately:

- **400** Bad Request
- **401** Unauthorized
- **403** Forbidden
- **404** Not Found
- **422** Unprocessable Entity

Additionally, any `ProviderError` with `retryable: false` is not retried.

### Retry Sequence Example

```
Attempt 0: immediate call
  -> fails (500)
Attempt 1: wait ~1000ms (jittered)
  -> fails (500)
Attempt 2: wait ~2000ms (jittered)
  -> fails (500)
Attempt 3: wait ~4000ms (jittered)
  -> fails (500) -> throw (maxRetries exceeded)
```

---

## 4. Provider Selection Algorithm

The `ProviderSelector.selectProvider(node, capability, budgetRemainingCents?)` method applies the following filters in order:

1. **isEnabled** -- provider must be enabled in config
2. **capability match** -- provider must advertise the requested capability (text, image, video, tts, embedding, music, moderation, vision, stt)
3. **healthStatus** -- provider must not be `unhealthy`
4. **circuit breaker** -- circuit breaker state must not be `OPEN`
5. **job budget** -- if `budgetRemainingCents` is provided, it must be > 0
6. **daily budget** -- `globalCostTracker.getDailySpend(tenantId)` must be < provider's `dailyBudgetCents`

Surviving candidates are sorted by `priority` (ascending, lower = higher priority). The first candidate is returned.

### Fallback Selection

`selectFallback(node, capability, excludeProvider)` applies the same filters but:
- Excludes the specified provider (the one that just failed)
- Sorts by `isFallback` first (fallback providers preferred), then by `priority`

If no candidate remains, a `NoProviderAvailableError` is thrown.

---

## 5. Cost Tracking Mechanism

### In-Memory Tracker (`CostTracker`)

The `CostTracker` class maintains a `Map<string, CostEntry[]>` keyed by `{tenantId}:{date}`.

| Method | Description |
|---|---|
| `recordCost(tenantId, provider, model, node, inputTokens, outputTokens, costCents)` | Appends a cost entry for the current day |
| `getDailySpend(tenantId)` | Sums all `costCents` entries for today |
| `getRemainingBudget(tenantId, dailyBudgetCents)` | Returns `max(0, dailyBudgetCents - getDailySpend)` |

The tracker auto-resets when the date changes (midnight rollover).

### Per-Job Cost Tracking

Each LangGraph pipeline state carries a `costTracking` object:

```typescript
costTracking: {
  totalCents: number;
  breakdown: Record<string, number>;   // by node
  tokensUsed: Record<string, number>;  // by provider
  budgetRemainingCents: number;
}
```

Each node updates this after provider calls. The orchestrator reads `budgetRemainingCents` to enforce the per-job budget limit (`config.budget.maxPerJobCents`).

### Persistent Cost Tracking

The `jobs/repository.ts` module writes cost data to the `ai_engine_cost_ledger` and `ai_engine_generation_jobs` tables for historical reporting and analytics.

---

## 6. Fallback Chains

Fallback chains are implicit, driven by provider configuration. When the primary provider fails (after retries + circuit breaker opens), the pipeline node calls `ProviderSelector.selectFallback()` to find an alternative.

### Example Chain for Text Generation

```
Primary:   OpenAI GPT-4 (priority: 1)
Fallback1: Anthropic Claude (priority: 2, isFallback: true)
Fallback2: Google Gemini (priority: 3, isFallback: true)
```

### Example Chain for Image Generation

```
Primary:   OpenAI DALL-E 3 (priority: 1)
Fallback1: Google Imagen (priority: 2, isFallback: true)
Fallback2: Mock provider (priority: 99, for dev/staging)
```

---

## 7. Provider Adapters — Capabilities Matrix

### 7.1 OpenAI Adapter (`adapters/openai.ts`)

| Capability | Model | Notes |
|---|---|---|
| **text** | GPT-4, GPT-4o, GPT-4o-mini | Structured output support via LangChain `withStructuredOutput` |
| **image** | DALL-E 3 | HD quality, custom sizes |
| **embedding** | text-embedding-3-small | 1536 dimensions |
| **tts** | tts-1, tts-1-hd | Multiple voices (alloy, echo, fable, onyx, nova, shimmer) |
| **vision** | GPT-4o | Image analysis from URL |
| **moderation** | omni-moderation-latest | Content safety scoring |

**Key implementation details:**
- Messages built from `TextGenParams.messages` array with `HumanMessage`, `SystemMessage`, `AIMessage` from LangChain
- Structured output via `withStructuredOutput(zodSchema)` when `params.structuredOutput` is provided
- Token usage extracted from LLM response metadata
- Cost computed from `ModelConfig.costPer1MInput` and `costPer1MOutput`

### 7.2 Anthropic Adapter (`adapters/anthropic.ts`)

| Capability | Model | Notes |
|---|---|---|
| **text** | Claude 3.5 Sonnet, Claude 3 Opus | `maxTokens` defaults to 4096 |

**Key implementation details:**
- Uses `ChatAnthropic` from `@langchain/anthropic`
- `stopSequences` maps from `params.stop`
- Image generation and embedding throw `NotImplementedError`
- TTS and video not supported

### 7.3 Google Adapter (`adapters/google.ts`)

| Capability | Model | Notes |
|---|---|---|
| **text** | Gemini 1.5 Pro, Gemini 1.5 Flash | `maxOutputTokens` maps from `params.maxTokens` |
| **image** | Imagen 3 | Via Google AI API |
| **video** | Veo | Experimental |

**Key implementation details:**
- Uses `ChatGoogleGenerativeAI` from `@langchain/google-genai`
- `stopSequences` maps from `params.stop`
- Embedding throws `NotImplementedError` (use OpenAI adapter instead)

### Summary Capabilities Matrix

| Capability | OpenAI | Anthropic | Google | ElevenLabs | Mock |
|---|---|---|---|---|---|
| text | x | x | x | | x |
| image | x | | x | | x |
| video | | | x | | x |
| tts | x | | | x | x |
| embedding | x | | | | x |
| music | | | | | x |
| moderation | x | | | | x |
| vision | x | | x | | |
| stt | x | | | | |
