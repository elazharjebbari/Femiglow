/**
 * CHA-230 Phase 2 — Tests du runnable `respond-stream`.
 *
 * Pas de MSW ici — on utilise des `ChatProvider` fakes parce qu'on teste
 * la LOGIQUE de retry/fallback, pas les détails du transport HTTP (qui
 * sont déjà couverts par `providers/openai.test.ts` et
 * `providers/anthropic.test.ts`).
 *
 * Couverture :
 *  - Mode flag-off (retryFallbackEnabled=false) → byte-identique à un
 *    appel direct du provider primaire.
 *  - Happy path → 1 tentative, servedBy = primary.
 *  - Retryable error → 1 retry sur primary → succès → 2 tentatives.
 *  - Retry échoue → fallback réussit → 3 tentatives, servedBy = fallback.
 *  - Erreur non-retryable (auth) → throw direct, pas de retry/fallback.
 *  - Toutes les tentatives échouent → throw l'erreur du fallback.
 *  - Pas de fallback configuré → throw après retry.
 *  - Signal aborted entre tentatives → arrête immédiatement.
 *
 * cf. docs/chat-assistant/20-langchain-robustness-plan.md §2.5
 */
import { describe, expect, it, vi } from 'vitest';

import {
  ProviderError,
  type ChatProvider,
  type ChatStreamChunk,
  type ChatStreamRequest,
  type ChatStreamResult,
} from '../providers/types';
import { respondStreamRunnable } from './respond-stream.runnable';

// ---------------------------------------------------------------------------
// Helpers : faux providers programmables
// ---------------------------------------------------------------------------

interface FakeProviderBehavior {
  /** Erreurs à throw, dans l'ordre. `null` = succès. */
  outcomes: Array<ProviderError | Error | null>;
  /** Texte renvoyé en cas de succès. */
  text?: string;
}

function makeFakeProvider(
  id: string,
  kind: 'openai' | 'anthropic' | 'mistral',
  behavior: FakeProviderBehavior,
): ChatProvider & { calls: number } {
  let call = 0;
  const provider: ChatProvider & { calls: number } = {
    id,
    kind,
    label: `fake-${id}`,
    calls: 0,
    async streamChat(_req: ChatStreamRequest) {
      const outcome = behavior.outcomes[call] ?? null;
      provider.calls = ++call;
      if (outcome instanceof Error) {
        throw outcome;
      }
      const text = behavior.text ?? `served by ${id}`;
      const stream = (async function* (): AsyncIterable<ChatStreamChunk> {
        yield { delta: text };
        yield { delta: '', finishReason: 'stop' };
      })();
      const final: () => Promise<ChatStreamResult> = async () => ({
        text,
        tokensIn: 10,
        tokensOut: 5,
        costEur: 0,
        modelName: `fake-${kind}`,
      });
      return { stream, final };
    },
    async ping() {
      return { ok: true, latencyMs: 0, modelName: 'fake' };
    },
  };
  return provider;
}

const baseRequest: ChatStreamRequest = {
  messages: [{ role: 'user', content: 'hi' }],
  language: 'fr',
};

describe('respondStreamRunnable — flag off', () => {
  it("retryFallbackEnabled=false → 1 seul appel, pas de retry même si retryable", async () => {
    const primary = makeFakeProvider('p1', 'openai', {
      outcomes: [
        new ProviderError('rate-limit', 'rl', { providerId: 'p1', retryable: true }),
      ],
    });
    const fallback = makeFakeProvider('f1', 'anthropic', { outcomes: [null] });

    await expect(
      respondStreamRunnable({
        primaryProvider: primary,
        fallbackProvider: fallback,
        request: baseRequest,
        retryFallbackEnabled: false,
      }),
    ).rejects.toMatchObject({ code: 'rate-limit' });

    expect(primary.calls).toBe(1);
    expect(fallback.calls).toBe(0);
  });

  it("retryFallbackEnabled=false → succès direct, 1 attempt = 'ok'", async () => {
    const primary = makeFakeProvider('p1', 'openai', { outcomes: [null] });
    const fallback = makeFakeProvider('f1', 'anthropic', { outcomes: [null] });

    const out = await respondStreamRunnable({
      primaryProvider: primary,
      fallbackProvider: fallback,
      request: baseRequest,
      retryFallbackEnabled: false,
    });
    expect(out.servedBy.providerId).toBe('p1');
    expect(out.attempts).toHaveLength(1);
    expect(out.attempts[0]?.outcome).toBe('ok');
    expect(fallback.calls).toBe(0);
  });
});

describe('respondStreamRunnable — happy path', () => {
  it('appelle le primaire une seule fois si tout va bien', async () => {
    const primary = makeFakeProvider('p1', 'openai', { outcomes: [null] });
    const fallback = makeFakeProvider('f1', 'anthropic', { outcomes: [null] });

    const out = await respondStreamRunnable({
      primaryProvider: primary,
      fallbackProvider: fallback,
      request: baseRequest,
      retryFallbackEnabled: true,
    });
    expect(out.servedBy.providerId).toBe('p1');
    expect(out.attempts).toHaveLength(1);
    expect(primary.calls).toBe(1);
    expect(fallback.calls).toBe(0);
  });
});

describe('respondStreamRunnable — retry', () => {
  it("retry une fois sur primary après une erreur retryable, succès au 2e essai", async () => {
    const primary = makeFakeProvider('p1', 'openai', {
      outcomes: [
        new ProviderError('rate-limit', 'rl', { providerId: 'p1', retryable: true }),
        null, // 2e appel = succès
      ],
    });
    const fallback = makeFakeProvider('f1', 'anthropic', { outcomes: [null] });

    const out = await respondStreamRunnable({
      primaryProvider: primary,
      fallbackProvider: fallback,
      request: baseRequest,
      retryFallbackEnabled: true,
    });
    expect(out.servedBy.providerId).toBe('p1');
    expect(primary.calls).toBe(2);
    expect(fallback.calls).toBe(0);
    expect(out.attempts).toHaveLength(2);
    expect(out.attempts[0]?.outcome).toBe('retried');
    expect(out.attempts[1]?.outcome).toBe('ok');
  });

  it('throw direct sur erreur NON retryable (auth) — pas de retry, pas de fallback', async () => {
    const primary = makeFakeProvider('p1', 'openai', {
      outcomes: [
        new ProviderError('auth', 'invalid key', { providerId: 'p1' }),
      ],
    });
    const fallback = makeFakeProvider('f1', 'anthropic', { outcomes: [null] });

    await expect(
      respondStreamRunnable({
        primaryProvider: primary,
        fallbackProvider: fallback,
        request: baseRequest,
        retryFallbackEnabled: true,
      }),
    ).rejects.toMatchObject({ code: 'auth' });
    expect(primary.calls).toBe(1);
    expect(fallback.calls).toBe(0);
  });
});

describe('respondStreamRunnable — fallback', () => {
  it("primary échoue 2 fois retryable → fallback est utilisé, servedBy = fallback", async () => {
    const primary = makeFakeProvider('p1', 'openai', {
      outcomes: [
        new ProviderError('network', '5xx', { providerId: 'p1', retryable: true }),
        new ProviderError('network', '5xx again', { providerId: 'p1', retryable: true }),
      ],
    });
    const fallback = makeFakeProvider('f1', 'anthropic', {
      outcomes: [null],
      text: 'fallback response',
    });

    const out = await respondStreamRunnable({
      primaryProvider: primary,
      fallbackProvider: fallback,
      request: baseRequest,
      retryFallbackEnabled: true,
    });
    expect(out.servedBy.providerId).toBe('f1');
    expect(out.servedBy.kind).toBe('anthropic');
    expect(primary.calls).toBe(2);
    expect(fallback.calls).toBe(1);
    expect(out.attempts).toHaveLength(3);
    expect(out.attempts.map((a) => a.outcome)).toEqual([
      'retried',
      'failed',
      'ok',
    ]);

    // Vérifie que le stream du fallback est bien transmis
    const chunks: string[] = [];
    for await (const c of out.stream) if (c.delta) chunks.push(c.delta);
    expect(chunks.join('')).toBe('fallback response');
  });

  it('toutes les tentatives échouent → throw la dernière erreur (du fallback)', async () => {
    const primary = makeFakeProvider('p1', 'openai', {
      outcomes: [
        new ProviderError('network', 'p1 5xx', { providerId: 'p1', retryable: true }),
        new ProviderError('network', 'p1 5xx', { providerId: 'p1', retryable: true }),
      ],
    });
    const fallback = makeFakeProvider('f1', 'anthropic', {
      outcomes: [
        new ProviderError('network', 'f1 5xx', { providerId: 'f1', retryable: true }),
      ],
    });

    let caught: ProviderError | null = null;
    try {
      await respondStreamRunnable({
        primaryProvider: primary,
        fallbackProvider: fallback,
        request: baseRequest,
        retryFallbackEnabled: true,
      });
    } catch (e) {
      caught = e as ProviderError;
    }
    expect(caught).not.toBeNull();
    expect(caught!.providerId).toBe('f1');
    expect(caught!.message).toContain('f1 5xx');
    expect(primary.calls).toBe(2);
    expect(fallback.calls).toBe(1);
  });

  it("pas de fallback configuré → throw après retry du primary", async () => {
    const primary = makeFakeProvider('p1', 'openai', {
      outcomes: [
        new ProviderError('network', '5xx', { providerId: 'p1', retryable: true }),
        new ProviderError('network', '5xx', { providerId: 'p1', retryable: true }),
      ],
    });

    await expect(
      respondStreamRunnable({
        primaryProvider: primary,
        fallbackProvider: null,
        request: baseRequest,
        retryFallbackEnabled: true,
      }),
    ).rejects.toMatchObject({ code: 'network' });
    expect(primary.calls).toBe(2);
  });
});

describe('respondStreamRunnable — abort signal', () => {
  it('abort entre primary-retry et fallback → arrête sans appeler le fallback', async () => {
    const ctrl = new AbortController();
    let callCount = 0;
    const primary: ChatProvider & { calls: number } = {
      id: 'p1',
      kind: 'openai',
      label: 'p1',
      calls: 0,
      async streamChat() {
        callCount += 1;
        primary.calls = callCount;
        // 1er appel : erreur retryable. Avant le 2e, on abort.
        if (callCount === 1) {
          throw new ProviderError('network', 'first', {
            providerId: 'p1',
            retryable: true,
          });
        }
        // 2e appel : on abort juste avant de throw, et on throw retryable
        // pour simuler un échec qui aurait pu déclencher fallback.
        ctrl.abort();
        throw new ProviderError('network', 'second', {
          providerId: 'p1',
          retryable: true,
        });
      },
      async ping() {
        return { ok: true, latencyMs: 0 };
      },
    };
    const fallback = makeFakeProvider('f1', 'anthropic', { outcomes: [null] });

    await expect(
      respondStreamRunnable({
        primaryProvider: primary,
        fallbackProvider: fallback,
        request: { ...baseRequest, signal: ctrl.signal },
        retryFallbackEnabled: true,
      }),
    ).rejects.toMatchObject({ message: 'second' });
    expect(primary.calls).toBe(2);
    expect(fallback.calls).toBe(0);
  });
});

describe('respondStreamRunnable — final()', () => {
  it("final() du provider servant est correctement transmis", async () => {
    const primary = makeFakeProvider('p1', 'openai', {
      outcomes: [null],
      text: 'hello',
    });

    const out = await respondStreamRunnable({
      primaryProvider: primary,
      fallbackProvider: null,
      request: baseRequest,
      retryFallbackEnabled: true,
    });
    // Drain stream
    for await (const _ of out.stream) void _;
    const result = await out.final();
    expect(result.text).toBe('hello');
    expect(result.tokensIn).toBe(10);
    expect(result.modelName).toBe('fake-openai');
  });
});

describe('respondStreamRunnable — erreur générique non-ProviderError', () => {
  it("traite une erreur non-typée comme non-retryable → throw direct", async () => {
    const primary = makeFakeProvider('p1', 'openai', {
      outcomes: [new Error('boom')],
    });
    const fallback = makeFakeProvider('f1', 'anthropic', { outcomes: [null] });

    await expect(
      respondStreamRunnable({
        primaryProvider: primary,
        fallbackProvider: fallback,
        request: baseRequest,
        retryFallbackEnabled: true,
      }),
    ).rejects.toThrow('boom');
    expect(fallback.calls).toBe(0);
  });
});

describe('respondStreamRunnable — typage du callback', () => {
  it('expose les attempts pour la télémétrie', async () => {
    const primary = makeFakeProvider('p1', 'openai', {
      outcomes: [
        new ProviderError('timeout', 'slow', { providerId: 'p1', retryable: true }),
        null,
      ],
    });

    const out = await respondStreamRunnable({
      primaryProvider: primary,
      fallbackProvider: null,
      request: baseRequest,
      retryFallbackEnabled: true,
    });

    expect(out.attempts).toHaveLength(2);
    expect(out.attempts[0]?.error?.code).toBe('timeout');
    expect(out.attempts[0]?.outcome).toBe('retried');
    expect(out.attempts[1]?.error).toBeUndefined();
    expect(typeof out.attempts[0]?.durationMs).toBe('number');

    // satisfait `vi` pour pas casser le linter
    vi.useRealTimers();
  });
});
