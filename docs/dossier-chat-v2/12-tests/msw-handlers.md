# MSW handlers — Mocks providers LLM + webhooks

> Mock Service Worker (MSW) intercepte les requêtes HTTP au niveau réseau. Une seule source de vérité pour les mocks, partagée entre unit/integration/E2E. Jamais d'appel internet réel en test.

## Architecture MSW

```
tests/mocks/
├── server.ts              # setupServer pour Node (unit/integration/E2E)
├── browser.ts             # setupWorker pour browser (Storybook, dev)
├── handlers/
│   ├── openai.ts
│   ├── anthropic.ts
│   ├── mistral.ts
│   ├── gemini.ts
│   ├── webhooks.ts
│   ├── sendit.ts          # V7
│   └── index.ts           # export all
└── fixtures/
    ├── openai-streaming.json
    ├── anthropic-streaming.json
    └── ...
```

## Handler OpenAI Chat Completions

```typescript
// tests/mocks/handlers/openai.ts
import { rest } from 'msw';

export const openaiHandlers = [
  // ---- Success streaming ----
  rest.post('https://api.openai.com/v1/chat/completions', async (req, res, ctx) => {
    const body = await req.json();

    // Detect stream mode
    if (body.stream) {
      return res(
        ctx.status(200),
        ctx.set('Content-Type', 'text/event-stream'),
        ctx.set('Cache-Control', 'no-cache'),
        ctx.body(buildStreamResponse(body))
      );
    }

    // Non-stream fallback
    return res(
      ctx.status(200),
      ctx.json({
        id: 'chatcmpl-test',
        object: 'chat.completion',
        created: Date.now(),
        model: body.model,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: getCannedResponseForPrompt(body.messages.at(-1).content)
          },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
      })
    );
  }),

  // ---- Embeddings ----
  rest.post('https://api.openai.com/v1/embeddings', async (req, res, ctx) => {
    const body = await req.json();
    const input = Array.isArray(body.input) ? body.input : [body.input];
    return res(
      ctx.status(200),
      ctx.json({
        object: 'list',
        data: input.map((_: string, idx: number) => ({
          object: 'embedding',
          embedding: deterministicEmbedding(input[idx], 1536),
          index: idx
        })),
        model: 'text-embedding-3-small',
        usage: { prompt_tokens: 10, total_tokens: 10 }
      })
    );
  })
];

function buildStreamResponse(body: any): string {
  const content = getCannedResponseForPrompt(body.messages.at(-1).content);
  const tokens = content.split(' ');
  const events = tokens.map(token => ({
    id: 'chatcmpl-test',
    object: 'chat.completion.chunk',
    created: Date.now(),
    model: body.model,
    choices: [{
      index: 0,
      delta: { content: token + ' ' },
      finish_reason: null
    }]
  }));

  events.push({
    id: 'chatcmpl-test',
    object: 'chat.completion.chunk',
    created: Date.now(),
    model: body.model,
    choices: [{ index: 0, delta: {}, finish_reason: 'stop' }]
  });

  return events.map(e => `data: ${JSON.stringify(e)}\n\n`).join('') + 'data: [DONE]\n\n';
}

function getCannedResponseForPrompt(prompt: string): string {
  // Réponses déterministes par mot-clé
  if (/prix|combien|coute/i.test(prompt)) return 'Le pack FemiGlow est à 199 dh.';
  if (/livraison/i.test(prompt)) return 'Livraison gratuite partout au Maroc.';
  if (/ingrédient/i.test(prompt)) return 'Le pack contient des ingrédients naturels.';
  return 'Bonjour, je suis là pour vous aider.';
}

function deterministicEmbedding(text: string, dim: number): number[] {
  // Hash simple pour reproductibilité
  let seed = 0;
  for (const c of text) seed = (seed * 31 + c.charCodeAt(0)) % 2147483647;
  const rng = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  return Array.from({ length: dim }, () => rng() * 2 - 1);
}
```

## Handler Anthropic

```typescript
// tests/mocks/handlers/anthropic.ts
import { rest } from 'msw';

export const anthropicHandlers = [
  rest.post('https://api.anthropic.com/v1/messages', async (req, res, ctx) => {
    const body = await req.json();

    if (body.stream) {
      return res(
        ctx.status(200),
        ctx.set('Content-Type', 'text/event-stream'),
        ctx.body(buildAnthropicStream(body))
      );
    }

    return res(
      ctx.status(200),
      ctx.json({
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        model: body.model,
        content: [{ type: 'text', text: getCannedResponseForPrompt(body.messages.at(-1).content) }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 }
      })
    );
  })
];

function buildAnthropicStream(body: any): string {
  const content = getCannedResponseForPrompt(body.messages.at(-1).content);
  const events: string[] = [];

  events.push(`event: message_start\ndata: ${JSON.stringify({ type: 'message_start', message: { id: 'msg_test', role: 'assistant' } })}\n\n`);
  events.push(`event: content_block_start\ndata: ${JSON.stringify({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } })}\n\n`);

  for (const token of content.split(' ')) {
    events.push(`event: content_block_delta\ndata: ${JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: token + ' ' } })}\n\n`);
  }

  events.push(`event: content_block_stop\ndata: ${JSON.stringify({ type: 'content_block_stop', index: 0 })}\n\n`);
  events.push(`event: message_stop\ndata: ${JSON.stringify({ type: 'message_stop' })}\n\n`);

  return events.join('');
}
```

## Handler Mistral

```typescript
// tests/mocks/handlers/mistral.ts
import { rest } from 'msw';

export const mistralHandlers = [
  rest.post('https://api.mistral.ai/v1/chat/completions', async (req, res, ctx) => {
    const body = await req.json();
    // Format similaire OpenAI
    return openaiHandlers[0].resolver(req, res, ctx);
  })
];
```

## Handler Gemini

```typescript
// tests/mocks/handlers/gemini.ts
import { rest } from 'msw';

export const geminiHandlers = [
  rest.post('https://generativelanguage.googleapis.com/v1beta/models/*:streamGenerateContent', async (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.set('Content-Type', 'application/json'),
      ctx.body(JSON.stringify({
        candidates: [{
          content: { parts: [{ text: 'Réponse Gemini test' }], role: 'model' },
          finishReason: 'STOP'
        }]
      }))
    );
  })
];
```

## Handler webhooks n8n

```typescript
// tests/mocks/handlers/webhooks.ts
import { rest } from 'msw';

export const webhookHandlers = [
  // n8n webhook simulé
  rest.post('https://n8n.femiglow.com/webhook/lead', async (req, res, ctx) => {
    const signature = req.headers.get('X-Signature-V1');
    if (!signature) return res(ctx.status(401));

    const body = await req.json();
    return res(
      ctx.status(200),
      ctx.json({ accepted: true, leadId: body.leadId })
    );
  })
];
```

## Scénarios MSW pour chaos engineering

### Scénario : provider 50% down

```typescript
// tests/mocks/scenarios/chaos-provider-50.ts
import { rest } from 'msw';
import { mswServer } from '../server';

export function setupProviderChaos50() {
  mswServer.use(
    rest.post('https://api.openai.com/v1/chat/completions', (req, res, ctx) => {
      if (Math.random() < 0.5) {
        return res(ctx.status(503), ctx.json({ error: { message: 'Service unavailable' } }));
      }
      return res(ctx.status(200), ctx.json(/* ... */));
    })
  );
}
```

### Scénario : rate limit hit

```typescript
export function setupProviderRateLimit() {
  mswServer.use(
    rest.post('https://api.openai.com/*', (_, res, ctx) =>
      res(
        ctx.status(429),
        ctx.set('Retry-After', '60'),
        ctx.json({ error: { message: 'Rate limit exceeded', type: 'rate_limit_error' } })
      )
    )
  );
}
```

### Scénario : slow response (5s latency)

```typescript
export function setupProviderSlow(latencyMs = 5000) {
  mswServer.use(
    rest.post('https://api.openai.com/*', async (req, res, ctx) => {
      await new Promise(r => setTimeout(r, latencyMs));
      return res(ctx.status(200), ctx.json(/* ... */));
    })
  );
}
```

### Scénario : partial stream (coupe avant [DONE])

```typescript
export function setupProviderPartialStream() {
  mswServer.use(
    rest.post('https://api.openai.com/v1/chat/completions', (req, res, ctx) => {
      // Stream 3 chunks puis ferme
      return res(
        ctx.status(200),
        ctx.set('Content-Type', 'text/event-stream'),
        ctx.body(
          'data: {"choices":[{"delta":{"content":"Bon"}}]}\n\n' +
          'data: {"choices":[{"delta":{"content":"jour"}}]}\n\n' +
          'data: {"choices":[{"delta":{"content":" je"}}]}\n\n'
          // PAS de [DONE]
        )
      );
    })
  );
}
```

### Scénario : malformed JSON dans stream

```typescript
export function setupProviderMalformed() {
  mswServer.use(
    rest.post('https://api.openai.com/v1/chat/completions', (req, res, ctx) => {
      return res(
        ctx.status(200),
        ctx.set('Content-Type', 'text/event-stream'),
        ctx.body(
          'data: {"choices": [{"delta": {"content": "Bon"}}\n\n' +  // missing closing
          'data: not even json\n\n' +
          'data: [DONE]\n\n'
        )
      );
    })
  );
}
```

### Scénario : webhook 5xx persistant

```typescript
export function setupWebhookFailed() {
  let calls = 0;
  mswServer.use(
    rest.post('https://n8n.femiglow.com/webhook/lead', (_, res, ctx) => {
      calls++;
      return res(ctx.status(500), ctx.json({ error: 'Internal server error' }));
    })
  );
  return () => calls;
}
```

### Scénario : webhook 503 puis success (test retries)

```typescript
export function setupWebhookEventualSuccess() {
  let attempt = 0;
  mswServer.use(
    rest.post('https://n8n.femiglow.com/webhook/lead', (_, res, ctx) => {
      attempt++;
      if (attempt < 3) {
        return res(ctx.status(503));
      }
      return res(ctx.status(200), ctx.json({ accepted: true }));
    })
  );
  return () => attempt;
}
```

## Fixtures de référence

### OpenAI streaming complete (success)

```json
// tests/mocks/fixtures/openai-streaming.json
{
  "events": [
    { "data": "data: {\"choices\":[{\"delta\":{\"content\":\"Bon\"}}]}\n\n" },
    { "data": "data: {\"choices\":[{\"delta\":{\"content\":\"jour\"}}]}\n\n" },
    { "data": "data: {\"choices\":[{\"delta\":{\"content\":\" Soukaina\"}}]}\n\n" },
    { "data": "data: {\"choices\":[{\"delta\":{},\"finish_reason\":\"stop\"}]}\n\n" },
    { "data": "data: [DONE]\n\n" }
  ]
}
```

### Tool call response (function calling)

```json
// tests/mocks/fixtures/openai-tool-call.json
{
  "id": "chatcmpl-tool",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": null,
      "tool_calls": [{
        "id": "call_abc123",
        "type": "function",
        "function": {
          "name": "get_product",
          "arguments": "{\"productId\":\"kit-femiglow\"}"
        }
      }]
    },
    "finish_reason": "tool_calls"
  }]
}
```

## Setup global pour tests

```typescript
// vitest.setup.ts
import { beforeAll, afterAll, afterEach } from 'vitest';
import { mswServer } from './tests/mocks/server';

beforeAll(() => mswServer.listen({ onUnhandledRequest: 'error' }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());
```

## Sanity tests pour MSW (méta-tests)

```typescript
// tests/mocks/__tests__/sanity.test.ts
test('msw intercepts openai chat completion', async () => {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    body: JSON.stringify({ model: 'gpt-4', messages: [{ role: 'user', content: 'salut' }] })
  });
  expect(res.ok).toBe(true);
  const data = await res.json();
  expect(data.choices[0].message.role).toBe('assistant');
});

test('msw intercepts anthropic messages', async () => { /* ... */ });
test('msw intercepts mistral chat', async () => { /* ... */ });
test('msw intercepts webhook n8n', async () => { /* ... */ });
```

## Coverage des scénarios mock

| Scénario | OpenAI | Anthropic | Mistral | Gemini | Webhook n8n |
|---|---|---|---|---|---|
| Success non-stream | ✅ | ✅ | ✅ | ✅ | ✅ |
| Success streaming | ✅ | ✅ | ✅ | ✅ | — |
| Tool call | ✅ | ✅ | ✅ | — | — |
| 5xx error | ✅ | ✅ | ✅ | ✅ | ✅ |
| 4xx rate limit | ✅ | ✅ | ✅ | ✅ | ✅ |
| Slow response | ✅ | ✅ | ✅ | ✅ | ✅ |
| Partial stream | ✅ | ✅ | ✅ | ✅ | — |
| Malformed | ✅ | ✅ | ✅ | ✅ | — |
| Eventual success retry | ✅ | ✅ | ✅ | ✅ | ✅ |

## Anti-patterns MSW

- ❌ Appel internet réel "juste pour ce test" — flaky garanti.
- ❌ Mock inline dans chaque test — duplication, maintenance enfer.
- ❌ Mock qui ne reflète pas le schema réel du provider (test passe, prod casse).
- ❌ Pas de reset entre tests (handlers fuite).
- ❌ Pas de scénarios chaos (on teste seulement les happy path).
- ❌ Ignorer `onUnhandledRequest` warnings (signal d'absence de mock).
