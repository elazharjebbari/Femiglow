# 06 — Fiche système : Chat live OpenAI

## Périmètre

Widget conversationnel sur le site (`/`, `/kit`, etc.) qui :
- Répond aux questions visiteurs en temps réel (streaming SSE)
- Capture les leads via formulaire embarqué
- Filtre les messages hors-charte (heuristique actuelle)
- Indexe la FAQ via RAG vectoriel

## Fichiers clés

| Path | Rôle |
|---|---|
| `lib/chat/orchestrator.ts` | Pipeline principal (refactor cible) |
| `lib/chat/providers/openai.ts` | Adapter OpenAI (gpt-4o-mini + Moderation) |
| `lib/chat/providers/anthropic.ts` | ⭐ NOUVEAU adapter fallback |
| `lib/chat/services/provider-router.ts` | Circuit breaker actuel (in-memory) |
| `lib/chat/moderation.ts` | ⭐ NOUVEAU wrapper Moderation |
| `lib/chat/services/charter-filter.ts` | Filtre heuristique existant |
| `lib/chat/services/rag.ts` | FAQ vector search |
| `lib/chat/services/lead-capture.ts` | Form inline lead |
| `app/api/chat/message/route.ts` | Endpoint SSE (cible `maxDuration=30`) |
| `app/api/chat/start/route.ts` | Création session |
| `components/chat/ChatWidget.tsx` | UI client streaming |

## Risques actuels (audit)

| # | Risque | Sévérité | Phase fix |
|---|---|---|---|
| C-1 | Moderation API jamais appelée | 🔴 P0 | QW2 |
| C-2 | Circuit breaker in-memory (cassé multi-lambda) | 🟡 P1 | S1 |
| C-3 | Pas de fallback provider (OpenAI down → crash) | 🟡 P1 | R1 |
| C-4 | Pas de `maxDuration` SSE (coupure silencieuse) | 🟡 P1 | QW3 |
| C-5 | Pas de monitoring streaming health | 🟢 P2 | R2 |

## Architecture cible

```
┌─────────────────────────────────────────────────────────────┐
│  ChatWidget (client) — POST /api/chat/message              │
└──────────────────────┬──────────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Orchestrator                                                │
│  ─────────────                                               │
│  Étape 1 : charterFilter (heuristique 30 keywords)          │
│           ↓ pass                                             │
│  Étape 2 : ⭐ openaiModerate(userMessage)                   │
│           ├─ flagged → message scripté + log + alerte       │
│           └─ ok → continue                                  │
│           ↓                                                  │
│  Étape 3 : provider-router                                  │
│           ├─ primary OpenAI                                 │
│           │  ├─ ⭐ circuit breaker Redis cb:chat:openai    │
│           │  ├─ if OPEN → goto fallback                    │
│           │  └─ chat() avec tools + RAG                    │
│           ├─ ⭐ fallback Anthropic claude-3-haiku          │
│           └─ ⭐ ultimate : message scripté dégradé         │
│           ↓                                                  │
│  Étape 4 : SSE stream vers client                           │
│           (instrumenté ⭐ chunk latency, drops)             │
│           ↓                                                  │
│  Étape 5 : ⭐ openaiModerate(fullResponse)                  │
│           ├─ flagged → tronquer + log + admin notif         │
│           └─ ok → fin                                       │
│           ↓                                                  │
│  Étape 6 : Persist message + audit + tracking event         │
└─────────────────────────────────────────────────────────────┘
```

## Détails par phase

### QW2 — OpenAI Moderation (½ j)

**Objectif** : appeler `openai.moderations.create()` sur input + output.

**Fichier nouveau** : `lib/chat/moderation.ts`

```ts
import { logger } from '@/lib/logging/logger';
import { LIVE_CHAT_MODERATION } from '@/lib/feature-flags/live-systems';
import { openai } from './providers/openai';

export interface ModerationResult {
  flagged: boolean;
  categories: string[];
  scores: Record<string, number>;
  source: 'openai' | 'heuristic_fallback' | 'disabled';
}

const HEURISTIC_FALLBACK: ModerationResult = {
  flagged: false,
  categories: [],
  scores: {},
  source: 'heuristic_fallback',
};

export async function moderateText(text: string): Promise<ModerationResult> {
  if (LIVE_CHAT_MODERATION !== 'on') {
    return { ...HEURISTIC_FALLBACK, source: 'disabled' };
  }
  if (!text || text.trim().length === 0) {
    return { ...HEURISTIC_FALLBACK };
  }
  try {
    const result = await openai.moderations.create({
      input: text,
      model: 'text-moderation-latest',
    });
    const r = result.results[0]!;
    return {
      flagged: r.flagged,
      categories: Object.entries(r.categories)
        .filter(([, v]) => v)
        .map(([k]) => k),
      scores: r.category_scores ?? {},
      source: 'openai',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('chat.moderation.failed', { error: message });
    return HEURISTIC_FALLBACK;
  }
}
```

**Câblage orchestrator** :

```ts
// avant LLM call
const inputMod = await moderateText(userMessage);
if (inputMod.flagged) {
  logger.info('chat.input_moderated', {
    sessionId,
    categories: inputMod.categories,
  });
  await sendModeratedResponse(sessionId, REFUSED_INPUT_MESSAGE);
  return; // skip LLM
}

// après stream complet
const outputMod = await moderateText(fullResponse);
if (outputMod.flagged) {
  logger.warn('chat.output_moderated', {
    sessionId,
    categories: outputMod.categories,
  });
  await sendModeratedResponse(sessionId, REFUSED_OUTPUT_MESSAGE);
  await alertAdmin('Output flagged', { sessionId, categories: outputMod.categories });
}
```

**Tests** : 10 vitest + 2 integration MSW.

### S1 — Circuit breaker Redis (1-2 j)

**Avant** :
```ts
// lib/chat/services/provider-router.ts
const failures = new Map<string, number>(); // ❌ in-memory
```

**Après** :
```ts
// lib/redis/circuit-breaker.ts
export class CircuitBreaker {
  constructor(private key: string, private threshold = 5, private resetMs = 30_000) {}

  async state(): Promise<'CLOSED' | 'OPEN' | 'HALF_OPEN'> { ... }

  async recordSuccess(): Promise<void> {
    await redis.del(this.key);
  }

  async recordFailure(): Promise<void> {
    const failures = await redis.incr(`${this.key}:failures`);
    if (failures >= this.threshold) {
      await redis.set(`${this.key}:opened_at`, Date.now(), { ex: this.resetMs / 1000 });
    }
  }
}
```

Tests : 15 vitest.

### R1 — Multi-provider fallback (2 j)

**Nouveau** : `lib/chat/providers/anthropic.ts`

Implémente l'interface `ChatProvider` (compatible avec OpenAI) :
- `chat(messages, options)` → AsyncIterable<ChatChunk>
- Streaming via `@anthropic-ai/sdk` SDK
- Compatibility layer pour `tools` (Anthropic tool use → OpenAI function format)

**provider-router** :
```ts
async function chatWithFallback(messages, options) {
  const openaiBreaker = new CircuitBreaker('cb:chat:openai');
  if (await openaiBreaker.state() === 'CLOSED') {
    try {
      return await openaiProvider.chat(messages, options);
    } catch (err) {
      await openaiBreaker.recordFailure();
      logger.warn('chat.openai.failed_fallback_anthropic', { error: err.message });
    }
  }
  const anthropicBreaker = new CircuitBreaker('cb:chat:anthropic');
  if (await anthropicBreaker.state() === 'CLOSED') {
    try {
      return await anthropicProvider.chat(messages, options);
    } catch (err) {
      await anthropicBreaker.recordFailure();
    }
  }
  // Ultimate fallback
  return scriptedDegradedResponse();
}
```

**Tests** : 12 vitest + 3 integration MSW.

### R2 — Streaming health monitoring (1 j)

Instrumentation dans la route SSE :

```ts
let chunkCount = 0;
let firstChunkAt: number | null = null;
let lastChunkAt: number | null = null;
const interChunkLatencies: number[] = [];

for await (const chunk of stream) {
  const now = Date.now();
  chunkCount++;
  if (firstChunkAt === null) firstChunkAt = now;
  if (lastChunkAt !== null) interChunkLatencies.push(now - lastChunkAt);
  lastChunkAt = now;
  // ... write chunk
}

// Au end of stream
await trackStreamingHealth({
  sessionId,
  chunkCount,
  firstChunkLatencyMs: firstChunkAt! - startTime,
  totalLatencyMs: lastChunkAt! - startTime,
  avgInterChunkMs: average(interChunkLatencies),
  p95InterChunkMs: percentile(interChunkLatencies, 95),
});
```

Stocke en Redis `chat:stream:metrics:<minute_bucket>` pour agrégation.

## Tests existants — couverture & trous

Existant :
- `lib/chat/__tests__/orchestrator.test.ts` (couverture pipeline)
- `lib/chat/providers/openai.test.ts` (adapter)
- `lib/chat/services/charter-filter.test.ts`
- `lib/chat/services/rag.test.ts`
- `e2e/chat-visitor.spec.ts`
- `e2e/chat-live-openai.spec.ts`

**Trous à combler** :
- ❌ Moderation jamais testée
- ❌ Fallback provider (chat-live-openai existe mais teste primary only)
- ❌ Streaming health monitoring
- ❌ Tests E2E avec OpenAI mocké via MSW (actuellement tests live → flaky)

## Top 3 améliorations recommandées (priorité)

1. **QW2 Moderation** (½ j) — débloque P0 légal/réputation
2. **R1 Fallback Anthropic** (2 j) — résilience long-terme, élimine crash OpenAI down
3. **R2 Streaming health** (1 j) — observabilité production, ajuste alerts
