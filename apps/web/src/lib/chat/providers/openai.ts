/**
 * CHA-021 — Adapter OpenAI (et OpenAI-compatible : Qwen, DeepSeek, Zhipu, Azure).
 *
 * Implémentation 100 % `fetch` natif (Node 18+ / Edge) → pas de dépendance
 * `@langchain/openai`. Plus léger, plus stable côté types, plus testable
 * via MSW. Le contrat `ChatProvider` reste identique.
 *
 * - Streaming : Server-Sent Events `/v1/chat/completions` avec `stream: true`
 *   et `stream_options: { include_usage: true }` pour récupérer
 *   `usage.prompt_tokens` / `usage.completion_tokens` dans le dernier chunk.
 * - Embeddings : POST `/v1/embeddings` (non-stream).
 * - Moderation : POST `/v1/moderations`.
 * - Ping : POST `/v1/chat/completions` avec `max_tokens: 1`.
 */
import { estimateCostEur, estimateEmbedCostEur } from './pricing';
import {
  ProviderError,
  type ChatProvider,
  type ChatProviderConfig,
  type ChatStreamRequest,
  type ChatStreamChunk,
  type ChatStreamResult,
  type EmbeddingRequest,
  type EmbeddingResult,
  type ModerationRequest,
  type ModerationResult,
} from './types';

const DEFAULT_CHAT_MODEL = 'gpt-4o-mini';
const DEFAULT_EMBED_MODEL = 'text-embedding-3-small';

interface OpenAILikeOptions {
  /** `openai`, `qwen`, `deepseek`, `zhipu`, `azure-openai`. */
  kind: ChatProviderConfig['kind'];
  /** apiBase override (ex. `https://api.deepseek.com/v1`). */
  defaultApiBase?: string;
}

export function createOpenAIAdapter(
  config: ChatProviderConfig,
  opts: OpenAILikeOptions = { kind: 'openai' },
): ChatProvider {
  const apiBase = (config.apiBase ?? opts.defaultApiBase ?? 'https://api.openai.com/v1').replace(
    /\/$/,
    '',
  );
  const timeoutMs = config.parameters?.timeoutMs ?? 30_000;

  function authHeaders(): Record<string, string> {
    const h: Record<string, string> = {
      'content-type': 'application/json',
      ...(config.headers ?? {}),
    };
    if (config.apiKey) h.authorization = `Bearer ${config.apiKey}`;
    return h;
  }

  function withTimeout(signal?: AbortSignal): { signal: AbortSignal; cleanup: () => void } {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(new Error('timeout')), timeoutMs);
    if (signal) {
      if (signal.aborted) ctrl.abort(signal.reason);
      else signal.addEventListener('abort', () => ctrl.abort(signal.reason), { once: true });
    }
    return { signal: ctrl.signal, cleanup: () => clearTimeout(timer) };
  }

  return {
    id: config.id,
    kind: opts.kind,
    label: config.label,

    async streamChat(req: ChatStreamRequest) {
      const model = req.model ?? config.chatModel ?? DEFAULT_CHAT_MODEL;
      const { signal, cleanup } = withTimeout(req.signal);

      const body = {
        model,
        messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: req.temperature ?? config.parameters?.temperature ?? 0.7,
        top_p: req.topP ?? config.parameters?.topP,
        max_tokens: req.maxTokens ?? config.parameters?.maxTokens,
        stream: true,
        stream_options: { include_usage: true },
      };

      let res: Response;
      try {
        res = await fetch(`${apiBase}/chat/completions`, {
          method: 'POST',
          signal,
          headers: authHeaders(),
          body: JSON.stringify(body),
        });
      } catch (err) {
        cleanup();
        throw mapError(err, config.id);
      }

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => '');
        cleanup();
        throw mapHttpError(res.status, text, config.id);
      }

      let aggregated = '';
      let tokensIn: number | null = null;
      let tokensOut: number | null = null;
      let finishReason: ChatStreamChunk['finishReason'] | undefined;

      const stream = (async function* (): AsyncIterable<ChatStreamChunk> {
        try {
          for await (const evt of parseSSE(res.body!)) {
            if (evt === '[DONE]') break;
            let payload: SSEDelta;
            try {
              payload = JSON.parse(evt) as SSEDelta;
            } catch {
              continue;
            }
            const choice = payload.choices?.[0];
            const delta = choice?.delta?.content ?? '';
            if (delta) {
              aggregated += delta;
              yield { delta };
            }
            if (choice?.finish_reason) {
              finishReason = mapFinishReason(choice.finish_reason);
            }
            if (payload.usage) {
              tokensIn = payload.usage.prompt_tokens ?? tokensIn;
              tokensOut = payload.usage.completion_tokens ?? tokensOut;
            }
          }
          yield { delta: '', finishReason: finishReason ?? 'stop' };
        } catch (err) {
          throw mapError(err, config.id);
        } finally {
          cleanup();
        }
      })();

      const final = async (): Promise<ChatStreamResult> => {
        const costEur =
          tokensIn != null && tokensOut != null
            ? estimateCostEur(model, tokensIn, tokensOut)
            : null;
        return { text: aggregated, tokensIn, tokensOut, costEur, modelName: model };
      };

      return { stream, final };
    },

    async embed(req: EmbeddingRequest): Promise<EmbeddingResult> {
      const model = req.model ?? config.embeddingModel ?? DEFAULT_EMBED_MODEL;
      const { signal, cleanup } = withTimeout(req.signal);
      try {
        const res = await fetch(`${apiBase}/embeddings`, {
          method: 'POST',
          signal,
          headers: authHeaders(),
          body: JSON.stringify({ model, input: req.inputs }),
        });
        if (!res.ok) {
          throw mapHttpError(res.status, await res.text(), config.id);
        }
        const data = (await res.json()) as {
          data: Array<{ embedding: number[] }>;
          usage?: { prompt_tokens?: number };
        };
        const vectors = data.data.map((d) => d.embedding);
        const dim = vectors[0]?.length ?? 0;
        const tokensIn =
          data.usage?.prompt_tokens ??
          req.inputs.reduce((acc, s) => acc + Math.ceil(s.length / 4), 0);
        return {
          vectors,
          dim,
          tokensIn,
          costEur: estimateEmbedCostEur(model, tokensIn),
          modelName: model,
        };
      } catch (err) {
        throw mapError(err, config.id);
      } finally {
        cleanup();
      }
    },

    async moderate(req: ModerationRequest): Promise<ModerationResult> {
      const { signal, cleanup } = withTimeout(req.signal);
      try {
        const res = await fetch(`${apiBase}/moderations`, {
          method: 'POST',
          signal,
          headers: authHeaders(),
          body: JSON.stringify({
            model: config.moderationModel ?? 'omni-moderation-latest',
            input: req.text,
          }),
        });
        if (!res.ok) throw mapHttpError(res.status, await res.text(), config.id);
        const data = (await res.json()) as {
          results: Array<{
            flagged: boolean;
            categories: Record<string, boolean>;
            category_scores: Record<string, number>;
          }>;
        };
        const r = data.results[0];
        return {
          flagged: !!r?.flagged,
          categories: r ? Object.entries(r.categories).filter(([, v]) => v).map(([k]) => k) : [],
          scores: r?.category_scores,
        };
      } catch (err) {
        throw mapError(err, config.id);
      } finally {
        cleanup();
      }
    },

    async ping() {
      const t0 = Date.now();
      const model = config.chatModel ?? DEFAULT_CHAT_MODEL;
      const { signal, cleanup } = withTimeout();
      try {
        const res = await fetch(`${apiBase}/chat/completions`, {
          method: 'POST',
          signal,
          headers: authHeaders(),
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 1,
          }),
        });
        if (!res.ok) throw mapHttpError(res.status, await res.text(), config.id);
        return { ok: true, latencyMs: Date.now() - t0, modelName: model };
      } catch (err) {
        throw mapError(err, config.id);
      } finally {
        cleanup();
      }
    },
  };
}

// ---------------------------------------------------------------------------
// SSE parser : lit `data: {...}` (séparateur \n\n)
// ---------------------------------------------------------------------------

interface SSEDelta {
  choices?: Array<{
    delta?: { content?: string };
    finish_reason?: string | null;
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

async function* parseSSE(body: ReadableStream<Uint8Array>): AsyncIterable<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const evt = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        for (const line of evt.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          yield trimmed.slice(5).trim();
        }
      }
    }
    // Flush
    if (buffer.trim()) {
      for (const line of buffer.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data:')) yield trimmed.slice(5).trim();
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function mapFinishReason(r: string | null | undefined): ChatStreamChunk['finishReason'] {
  switch (r) {
    case 'stop':
      return 'stop';
    case 'length':
      return 'length';
    case 'content_filter':
      return 'content_filter';
    case 'tool_calls':
      return 'tool_calls';
    default:
      return undefined;
  }
}

function mapError(err: unknown, providerId: string): ProviderError {
  if (err instanceof ProviderError) return err;
  const e = err as { status?: number; message?: string; code?: string; name?: string };
  const status = e.status;
  if (e.name === 'AbortError' || e.message === 'timeout' || e.code === 'ETIMEDOUT' || status === 408) {
    return new ProviderError('timeout', e.message ?? 'timeout', { providerId, status, retryable: true });
  }
  if (status === 401 || status === 403) {
    return new ProviderError('auth', e.message ?? 'auth error', { providerId, status });
  }
  if (status === 429) {
    return new ProviderError('rate-limit', e.message ?? 'rate limit', {
      providerId,
      status,
      retryable: true,
    });
  }
  if (status === 413) {
    return new ProviderError('context-too-large', e.message ?? 'context too large', {
      providerId,
      status,
    });
  }
  if (typeof status === 'number' && status >= 500) {
    return new ProviderError('network', e.message ?? 'upstream error', {
      providerId,
      status,
      retryable: true,
    });
  }
  return new ProviderError('unknown', e.message ?? 'unknown error', { providerId, status });
}

function mapHttpError(status: number, body: string, providerId: string): ProviderError {
  return mapError({ status, message: body || `HTTP ${status}` }, providerId);
}
