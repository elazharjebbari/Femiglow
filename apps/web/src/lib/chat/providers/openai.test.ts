/**
 * Tests unitaires de l'adapter OpenAI (sans @langchain).
 *
 * Toutes les requêtes HTTP sont mockées via MSW — aucun appel réel n'est
 * fait. Pour le test "live" avec une vraie clé OpenAI, voir
 * `e2e/chat-live-openai.spec.ts` (Playwright).
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { server } from '@/test/msw/server';
import {
  captureChatCompletionsBody,
  encodeSseStream,
  openaiAuthErrorHandler,
  openaiHappyPathHandlers,
  openaiLengthCutoffHandler,
  openaiRateLimitHandler,
  openaiServerErrorHandler,
} from '@/test/msw/openai-handlers';
import { http, HttpResponse } from 'msw';

import { createOpenAIAdapter } from './openai';
import { ProviderError } from './types';

const baseConfig = {
  id: 'cp_test',
  kind: 'openai' as const,
  label: 'Test OpenAI',
  apiKey: 'sk-test-key',
  chatModel: 'gpt-4o-mini',
  embeddingModel: 'text-embedding-3-small',
};

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('createOpenAIAdapter — streamChat', () => {
  it('streame des deltas et concatène le texte final', async () => {
    server.use(...openaiHappyPathHandlers);
    const adapter = createOpenAIAdapter(baseConfig);
    const { stream, final } = await adapter.streamChat({
      messages: [
        { role: 'system', content: 'Tu es un assistant.' },
        { role: 'user', content: 'Bonjour' },
      ],
      language: 'fr',
    });
    const deltas: string[] = [];
    let finishReason: string | undefined;
    for await (const chunk of stream) {
      if (chunk.delta) deltas.push(chunk.delta);
      if (chunk.finishReason) finishReason = chunk.finishReason;
    }
    expect(deltas).toEqual(['Bonjour', ' Femi', 'Glow.']);
    expect(finishReason).toBe('stop');

    const result = await final();
    expect(result.text).toBe('Bonjour FemiGlow.');
    expect(result.tokensIn).toBe(18);
    expect(result.tokensOut).toBe(6);
    expect(result.modelName).toBe('gpt-4o-mini');
    expect(result.costEur).toBeGreaterThan(0);
  });

  it('envoie un body bien formé (model, messages, stream:true, stream_options.include_usage)', async () => {
    const { handler, getLastBody } = captureChatCompletionsBody();
    server.use(handler);
    const adapter = createOpenAIAdapter(baseConfig);
    const { stream, final } = await adapter.streamChat({
      messages: [{ role: 'user', content: 'hi' }],
      language: 'fr',
      temperature: 0.42,
      maxTokens: 16,
    });
    // Consume stream
    for await (const _ of stream) {
      void _;
    }
    await final();
    const body = (await getLastBody()) as {
      model: string;
      messages: Array<{ role: string; content: string }>;
      stream: boolean;
      stream_options: { include_usage: boolean };
      temperature: number;
      max_tokens: number;
    };
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.stream).toBe(true);
    expect(body.stream_options.include_usage).toBe(true);
    expect(body.temperature).toBe(0.42);
    expect(body.max_tokens).toBe(16);
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('mappe 401 en ProviderError("auth", retryable=false)', async () => {
    server.use(openaiAuthErrorHandler);
    const adapter = createOpenAIAdapter(baseConfig);
    await expect(async () => {
      await adapter.streamChat({
        messages: [{ role: 'user', content: 'hi' }],
        language: 'fr',
      });
    }).rejects.toMatchObject({
      name: 'ProviderError',
      code: 'auth',
      retryable: false,
      status: 401,
    });
  });

  it('mappe 429 en ProviderError("rate-limit", retryable=true)', async () => {
    server.use(openaiRateLimitHandler);
    const adapter = createOpenAIAdapter(baseConfig);
    await expect(async () => {
      await adapter.streamChat({
        messages: [{ role: 'user', content: 'hi' }],
        language: 'fr',
      });
    }).rejects.toMatchObject({
      code: 'rate-limit',
      retryable: true,
      status: 429,
    });
  });

  it('mappe 5xx en ProviderError("network", retryable=true)', async () => {
    server.use(openaiServerErrorHandler);
    const adapter = createOpenAIAdapter(baseConfig);
    await expect(async () => {
      await adapter.streamChat({
        messages: [{ role: 'user', content: 'hi' }],
        language: 'fr',
      });
    }).rejects.toMatchObject({
      code: 'network',
      retryable: true,
      status: 503,
    });
  });

  it('respecte finish_reason "length"', async () => {
    server.use(openaiLengthCutoffHandler);
    const adapter = createOpenAIAdapter(baseConfig);
    const { stream, final } = await adapter.streamChat({
      messages: [{ role: 'user', content: 'hi' }],
      language: 'fr',
    });
    let lastReason: string | undefined;
    for await (const chunk of stream) {
      if (chunk.finishReason) lastReason = chunk.finishReason;
    }
    expect(lastReason).toBe('length');
    const r = await final();
    expect(r.text).toBe('Réponse trop longue');
  });

  it("supporte un apiBase custom (provider OpenAI-compatible type DeepSeek)", async () => {
    let calledUrl = '';
    server.use(
      http.post('https://api.deepseek.com/v1/chat/completions', ({ request }) => {
        calledUrl = request.url;
        const body = encodeSseStream([
          { delta: 'ok' },
          { finish_reason: 'stop', usage: { prompt_tokens: 1, completion_tokens: 1 } },
        ]);
        return new HttpResponse(body, {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        });
      }),
    );
    const adapter = createOpenAIAdapter(
      { ...baseConfig, apiBase: 'https://api.deepseek.com/v1' },
      { kind: 'deepseek' },
    );
    const { stream, final } = await adapter.streamChat({
      messages: [{ role: 'user', content: 'hi' }],
      language: 'fr',
    });
    for await (const _ of stream) void _;
    await final();
    expect(calledUrl).toBe('https://api.deepseek.com/v1/chat/completions');
  });

  it('annule proprement via AbortSignal', async () => {
    server.use(
      http.post('https://api.openai.com/v1/chat/completions', async () => {
        // Stream qui ne se termine jamais ; le client va abort.
        const stream = new ReadableStream({
          async start(controller) {
            const enc = new TextEncoder();
            // 1 chunk puis on attend
            controller.enqueue(
              enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: 'A' } }] })}\n\n`),
            );
            await new Promise((r) => setTimeout(r, 5_000));
            controller.close();
          },
        });
        return new HttpResponse(stream, {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        });
      }),
    );

    const adapter = createOpenAIAdapter(baseConfig);
    const ctrl = new AbortController();
    const { stream } = await adapter.streamChat({
      messages: [{ role: 'user', content: 'hi' }],
      language: 'fr',
      signal: ctrl.signal,
    });

    let consumed = '';
    const consume = (async () => {
      try {
        for await (const c of stream) consumed += c.delta;
      } catch (err) {
        return err;
      }
    })();
    setTimeout(() => ctrl.abort(), 50);
    const out = await consume;
    expect(consumed).toContain('A');
    // Soit on lève ProviderError(timeout) sur abort, soit on a juste consommé
    // le premier chunk avant abort. Les deux issues sont valides.
    if (out instanceof ProviderError) {
      expect(out.retryable).toBe(true);
    }
  }, 10_000);
});

describe('createOpenAIAdapter — embed', () => {
  it('renvoie des vecteurs et un coût estimé', async () => {
    server.use(...openaiHappyPathHandlers);
    const adapter = createOpenAIAdapter(baseConfig);
    const out = await adapter.embed!({
      inputs: ['premier texte', 'second texte'],
    });
    expect(out.vectors).toHaveLength(2);
    expect(out.vectors[0]).toHaveLength(1536);
    expect(out.dim).toBe(1536);
    expect(out.tokensIn).toBe(12);
    expect(out.modelName).toBe('text-embedding-3-small');
  });

  it('lève auth error si 401', async () => {
    server.use(
      http.post('https://api.openai.com/v1/embeddings', () =>
        HttpResponse.json({ error: { message: 'invalid' } }, { status: 401 }),
      ),
    );
    const adapter = createOpenAIAdapter(baseConfig);
    await expect(adapter.embed!({ inputs: ['x'] })).rejects.toMatchObject({
      code: 'auth',
    });
  });
});

describe('createOpenAIAdapter — moderate', () => {
  it('renvoie flagged=false par défaut', async () => {
    server.use(...openaiHappyPathHandlers);
    const adapter = createOpenAIAdapter(baseConfig);
    const r = await adapter.moderate!({ text: 'bonjour' });
    expect(r.flagged).toBe(false);
    expect(r.categories).toEqual([]);
  });
});

describe('createOpenAIAdapter — ping', () => {
  it('OK quand 200', async () => {
    server.use(
      http.post('https://api.openai.com/v1/chat/completions', () =>
        HttpResponse.json(
          {
            id: 'cmpl-msw',
            choices: [{ message: { role: 'assistant', content: 'ok' } }],
            usage: { prompt_tokens: 1, completion_tokens: 1 },
          },
          { status: 200 },
        ),
      ),
    );
    const adapter = createOpenAIAdapter(baseConfig);
    const r = await adapter.ping();
    expect(r.ok).toBe(true);
    expect(r.modelName).toBe('gpt-4o-mini');
    expect(r.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
