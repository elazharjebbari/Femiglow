/**
 * CHA-230 Phase 2 — Tests unitaires de l'adapter Anthropic.
 *
 * Toutes les requêtes HTTP sont mockées via MSW — aucun appel réel.
 *
 * cf. docs/chat-assistant/20-langchain-robustness-plan.md §2.4
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { server } from '@/test/msw/server';
import {
  anthropicAuthErrorHandler,
  anthropicHappyPathHandlers,
  anthropicRateLimitHandler,
  anthropicServerErrorHandler,
  captureMessagesBody,
} from '@/test/msw/anthropic-handlers';

import { createAnthropicAdapter } from './anthropic';
import { ProviderError } from './types';

const baseConfig = {
  id: 'cp_anthropic_test',
  kind: 'anthropic' as const,
  label: 'Test Anthropic',
  apiKey: 'sk-ant-test',
  chatModel: 'claude-3-5-haiku-latest',
};

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('createAnthropicAdapter — streamChat', () => {
  it('streame des deltas et concatène le texte final', async () => {
    server.use(...anthropicHappyPathHandlers);
    const adapter = createAnthropicAdapter(baseConfig);
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
    expect(deltas).toEqual(['Bonjour', ' Femi']);
    expect(finishReason).toBe('stop');

    const result = await final();
    expect(result.text).toBe('Bonjour Femi');
    expect(result.tokensIn).toBe(18);
    expect(result.tokensOut).toBe(4);
    expect(result.modelName).toBe('claude-3-5-haiku-latest');
  });

  it("envoie un body bien formé (system extrait, messages user/assistant, max_tokens)", async () => {
    const { handler, getLastBody, getLastHeaders } = captureMessagesBody();
    server.use(handler);
    const adapter = createAnthropicAdapter(baseConfig);
    const { stream, final } = await adapter.streamChat({
      messages: [
        { role: 'system', content: 'Tu es FemiGlow.' },
        { role: 'user', content: 'Bonjour' },
        { role: 'assistant', content: 'Salam' },
        { role: 'user', content: 'commander' },
      ],
      language: 'fr',
      temperature: 0.42,
      maxTokens: 256,
    });
    for await (const _ of stream) void _;
    await final();

    const body = (await getLastBody()) as {
      model: string;
      system?: string;
      messages: Array<{ role: string; content: string }>;
      stream: boolean;
      temperature: number;
      max_tokens: number;
    };
    expect(body.model).toBe('claude-3-5-haiku-latest');
    expect(body.stream).toBe(true);
    expect(body.system).toBe('Tu es FemiGlow.');
    expect(body.messages).toEqual([
      { role: 'user', content: 'Bonjour' },
      { role: 'assistant', content: 'Salam' },
      { role: 'user', content: 'commander' },
    ]);
    expect(body.temperature).toBe(0.42);
    expect(body.max_tokens).toBe(256);

    const headers = getLastHeaders()!;
    expect(headers['x-api-key']).toBe('sk-ant-test');
    expect(headers['anthropic-version']).toBe('2023-06-01');
  });

  it('mappe 401 en ProviderError("auth", retryable=false)', async () => {
    server.use(anthropicAuthErrorHandler);
    const adapter = createAnthropicAdapter(baseConfig);
    await expect(async () => {
      await adapter.streamChat({
        messages: [{ role: 'user', content: 'hi' }],
        language: 'fr',
      });
    }).rejects.toMatchObject({
      name: 'ProviderError',
      code: 'auth',
      retryable: false,
    });
  });

  it('mappe 429 en ProviderError("rate-limit", retryable=true)', async () => {
    server.use(anthropicRateLimitHandler);
    const adapter = createAnthropicAdapter(baseConfig);
    let caught: ProviderError | null = null;
    try {
      await adapter.streamChat({
        messages: [{ role: 'user', content: 'hi' }],
        language: 'fr',
      });
    } catch (err) {
      caught = err as ProviderError;
    }
    expect(caught).not.toBeNull();
    expect(caught!.code).toBe('rate-limit');
    expect(caught!.retryable).toBe(true);
  });

  it('mappe 5xx en ProviderError("network", retryable=true)', async () => {
    server.use(anthropicServerErrorHandler);
    const adapter = createAnthropicAdapter(baseConfig);
    let caught: ProviderError | null = null;
    try {
      await adapter.streamChat({
        messages: [{ role: 'user', content: 'hi' }],
        language: 'fr',
      });
    } catch (err) {
      caught = err as ProviderError;
    }
    expect(caught!.code).toBe('network');
    expect(caught!.retryable).toBe(true);
  });

  it("expose ping() qui réussit en 200", async () => {
    server.use(...anthropicHappyPathHandlers);
    const adapter = createAnthropicAdapter(baseConfig);
    const r = await adapter.ping();
    expect(r.ok).toBe(true);
    expect(r.modelName).toBe('claude-3-5-haiku-latest');
    expect(typeof r.latencyMs).toBe('number');
  });

  it("ne définit ni embed ni moderate (Anthropic n'a pas ces endpoints)", () => {
    const adapter = createAnthropicAdapter(baseConfig);
    expect(adapter.embed).toBeUndefined();
    expect(adapter.moderate).toBeUndefined();
  });
});
