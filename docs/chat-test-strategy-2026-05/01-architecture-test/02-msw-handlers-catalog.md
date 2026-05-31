# MSW handlers — catalogue complet

Mock Service Worker (MSW v2) couvre tous les appels HTTP externes + internes pour
**isoler** les tests du réseau réel.

## 1. Structure générale

```typescript
// src/test/msw/server.ts
import { setupServer } from 'msw/node';
import { openaiHandlers } from './handlers/openai';
import { anthropicHandlers } from './handlers/anthropic';
import { geminiHandlers } from './handlers/gemini';
import { slackHandlers } from './handlers/slack-webhook';
import { leadWebhookHandlers } from './handlers/lead-webhook';
import { trackingHandlers } from './handlers/tracking';
import { chatInternalHandlers } from './handlers/chat-internal';

export const server = setupServer(
  ...openaiHandlers,
  ...anthropicHandlers,
  ...geminiHandlers,
  ...slackHandlers,
  ...leadWebhookHandlers,
  ...trackingHandlers,
  ...chatInternalHandlers,
);
```

## 2. Handlers — OpenAI

```typescript
// src/test/msw/handlers/openai.ts
import { http, HttpResponse } from 'msw';
import { makeSseStream } from '../helpers/make-sse-stream';

export const openaiHandlers = [
  // Chat completions — SSE stream
  http.post('https://api.openai.com/v1/chat/completions', async ({ request }) => {
    const body = await request.json() as any;

    // Mode stream
    if (body.stream) {
      const chunks = ['Bonjour, ', 'comment ', 'puis-je ', 'vous ', 'aider ?'];
      return new HttpResponse(makeSseStream(chunks), {
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }

    return HttpResponse.json({
      id: 'chatcmpl-test',
      choices: [{ message: { role: 'assistant', content: 'Bonjour' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    });
  }),

  // Embeddings
  http.post('https://api.openai.com/v1/embeddings', async ({ request }) => {
    const body = await request.json() as any;
    const inputs = Array.isArray(body.input) ? body.input : [body.input];
    return HttpResponse.json({
      data: inputs.map((_: any, i: number) => ({
        object: 'embedding',
        index: i,
        embedding: Array.from({ length: 1536 }, () => Math.random()),
      })),
      model: body.model,
      usage: { prompt_tokens: 5, total_tokens: 5 },
    });
  }),

  // Moderation
  http.post('https://api.openai.com/v1/moderations', async ({ request }) => {
    const body = await request.json() as any;
    const flagged = /\b(kill|hate|n[i1]gg|fag)\w*/i.test(JSON.stringify(body.input));
    return HttpResponse.json({
      id: 'modr-test',
      model: 'text-moderation-latest',
      results: [{ flagged, categories: { hate: flagged, harassment: false }, category_scores: {} }],
    });
  }),
];
```

### 2.1 Variantes d'erreur

```typescript
// helpers/openai-error-responses.ts
export const openaiServerError = http.post(
  'https://api.openai.com/v1/chat/completions',
  () => new HttpResponse(null, { status: 500, statusText: 'Internal Server Error' }),
);
export const openaiRateLimit = http.post(
  'https://api.openai.com/v1/chat/completions',
  () => new HttpResponse(JSON.stringify({ error: { type: 'rate_limit_exceeded' } }), {
    status: 429, headers: { 'retry-after': '60' },
  }),
);
export const openaiTimeout = http.post(
  'https://api.openai.com/v1/chat/completions',
  async () => {
    await new Promise((r) => setTimeout(r, 30_000));
    return new HttpResponse(null, { status: 504 });
  },
);
```

Usage : `server.use(openaiServerError);` au début d'un test pour overrider.

## 3. Handlers — Anthropic / Gemini / autres

Structure identique. Notable :

- Anthropic stream → `data: {"type":"message_delta", ...}` format
- Gemini stream → `data: {"candidates": [{"content": {"parts": [{"text": "…"}]}}]}` format
- Mistral, Qwen, DeepSeek, Zhipu → similaire OpenAI (SDK compatible)
- Ollama → format `http://localhost:11434/api/chat` avec NDJSON stream

## 4. Handler — webhooks lead

```typescript
// src/test/msw/handlers/lead-webhook.ts
import { http, HttpResponse } from 'msw';

let webhookCalls: Array<{ url: string; body: any; timestamp: number }> = [];

export const leadWebhookHandlers = [
  http.post('http://localhost:3001/test/webhook-sink', async ({ request }) => {
    const body = await request.json();
    webhookCalls.push({ url: request.url, body, timestamp: Date.now() });
    return HttpResponse.json({ ok: true });
  }),
];

export const getWebhookCalls = () => [...webhookCalls];
export const resetWebhookCalls = () => { webhookCalls = []; };
```

Tests :

```typescript
import { resetWebhookCalls, getWebhookCalls } from '@/test/msw/handlers/lead-webhook';

beforeEach(() => resetWebhookCalls());

it('dispatches webhook on lead capture', async () => {
  await captureLead({ /* ... */ });
  const calls = getWebhookCalls();
  expect(calls).toHaveLength(1);
  expect(calls[0].body).toMatchObject({ event: 'lead.captured' });
});
```

## 5. Handler — Slack notify

Similar :

```typescript
let slackCalls: any[] = [];

export const slackHandlers = [
  http.post(/.*hooks\.slack\.com.*/, async ({ request }) => {
    slackCalls.push(await request.json());
    return new HttpResponse('ok', { status: 200 });
  }),
];

export const getSlackCalls = () => [...slackCalls];
export const resetSlackCalls = () => { slackCalls = []; };
```

## 6. Handler — internal `/api/chat/*`

Pour les tests **component** qui rendent `<ChatWidget />` et veulent simuler les
réponses API sans monter tout le backend :

```typescript
// src/test/msw/handlers/chat-internal.ts
import { http, HttpResponse } from 'msw';

export const chatInternalHandlers = [
  http.post('/api/chat/session', async () => HttpResponse.json({
    sessionId: 'cs_test_session',
    visitorId: 'vis_test',
    language: 'fr-MA',
  })),

  http.post('/api/chat/message', async ({ request }) => {
    // Renvoie un SSE stream simulé
    const chunks = ['Bonjour ', 'à vous!'];
    return new HttpResponse(makeSseStream([
      { event: 'start', data: { messageId: 'msg_1' } },
      ...chunks.map((c) => ({ event: 'chunk', data: { text: c } })),
      { event: 'end', data: { messageId: 'msg_1', usage: { tokensIn: 10, tokensOut: 5 } } },
    ]), {
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }),

  http.post('/api/chat/feedback', () => HttpResponse.json({ ok: true })),
  http.post('/api/chat/event', () => HttpResponse.json({ ok: true })),
  http.post('/api/chat/lead/contact', () => HttpResponse.json({ ok: true, leadId: 'ld_test' })),
];
```

## 7. Helper — `makeSseStream`

```typescript
// src/test/msw/helpers/make-sse-stream.ts
export function makeSseStream(events: Array<string | { event: string; data: unknown }>): ReadableStream {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const e of events) {
        if (typeof e === 'string') {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: e })}\n\n`));
        } else {
          controller.enqueue(encoder.encode(`event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`));
        }
      }
      controller.close();
    },
  });
}
```

## 8. Catalogue MSW exhaustif

| Handler | Endpoint | Cas couverts | Variantes erreur |
|---------|----------|--------------|------------------|
| `openai-chat` | POST `/v1/chat/completions` | F32, F27 | 500, 429, timeout, malformed JSON |
| `openai-embed` | POST `/v1/embeddings` | F25, F28, F29 | 500, 429, empty input |
| `openai-moderation` | POST `/v1/moderations` | F27 | flagged true / false |
| `anthropic-chat` | POST `/v1/messages` | F32, F58 | 500, 429, overloaded |
| `gemini-chat` | POST `/v1beta/models/.../generateContent` | F32, F58 | 500, 400 |
| `mistral-chat` | POST `/v1/chat/completions` | F58 | 500, 429 |
| `ollama-chat` | POST `localhost:11434/api/chat` | F58 | connect refused |
| `slack-webhook` | POST `hooks.slack.com/*` | F55, F56 | 200, 500 |
| `lead-webhook` | POST `test/webhook-sink` | F22, F55 | 200, 500, slow |
| `internal-session` | POST `/api/chat/session` | F14 | 200, 503 |
| `internal-message` | POST `/api/chat/message` | F15 | SSE complete, error mid-stream, abort |
| `internal-feedback` | POST `/api/chat/feedback` | F18 | 200, 422 |
| `internal-event` | POST `/api/chat/event` | F19 | 200 |
| `internal-lead` | POST `/api/chat/lead/contact` | F22 | 200, 422 (validation) |

## 9. Patterns d'usage

### 9.1 Override par test

```typescript
import { server } from '@/test/msw/server';
import { openaiServerError } from '@/test/msw/handlers/openai-errors';

it('falls back to secondary when primary returns 500', async () => {
  server.use(openaiServerError);
  const result = await orchestrator.handle({ /* ... */ });
  expect(result.provider).toBe('anthropic');
});
// L'override est reset automatiquement par msw.setup.ts:afterEach(server.resetHandlers)
```

### 9.2 Capture / inspection

```typescript
const requests: Request[] = [];
server.events.on('request:start', (event) => {
  requests.push(event.request);
});
```

### 9.3 Bypass intentionnel

```typescript
// Pour appeler le vrai serveur (rare, déconseillé)
server.use(http.post('https://...', ({ request }) => HttpResponse.passthrough()));
```

## 10. Best practices

- **Toujours `onUnhandledRequest: 'error'`** dans `msw.setup.ts` : ça fait échouer le test
  si on tape un endpoint non mocké → évite les surprises
- **Resetter** les handlers entre les tests (`afterEach(server.resetHandlers)`)
- **Resetter les états capturés** (webhookCalls, slackCalls) en `beforeEach`
- **MSW dans CI** : `pnpm exec msw init public/` (déjà fait normalement) puis `pnpm exec msw status`
- **Inspecter les requests non match** : `server.events.on('request:unhandled', ...)` pour debug

## 11. Cross-référence avec features

Chaque feature P0/P1 a un fichier `msw-handlers.md` listant les handlers spécifiques requis.
Cf. par exemple [02-functional-areas/F15-api-message/msw-handlers.md](../02-functional-areas/F15-api-message/msw-handlers.md).
