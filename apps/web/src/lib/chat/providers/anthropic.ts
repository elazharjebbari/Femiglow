/**
 * CHA-230 Phase 2 — Adapter Anthropic Claude (Messages API).
 *
 * Implémentation 100 % `fetch` natif (Node 18+ / Edge), sans dépendance
 * `@langchain/anthropic` au runtime. Cohérent avec `openai.ts` :
 *   - testable facilement via MSW,
 *   - typage stable (pas de surface API LangChain),
 *   - dependency surface minimale.
 *
 * LangChain reste utilisée seulement dans les Runnables (intent classifier
 * tool-calling, OutputFixingParser) où elle apporte une vraie valeur.
 *
 * Stream :
 *   POST /v1/messages avec `stream: true` → SSE :
 *     - `event: message_start` { message: { id, usage.input_tokens, ... } }
 *     - `event: content_block_start` { content_block: { type: 'text', text: '' } }
 *     - `event: content_block_delta` { delta: { type: 'text_delta', text: '...' } }
 *     - `event: content_block_stop`
 *     - `event: message_delta` { delta: { stop_reason }, usage: { output_tokens } }
 *     - `event: message_stop`
 *
 * cf. https://docs.anthropic.com/en/api/messages-streaming
 *     docs/chat-assistant/20-langchain-robustness-plan.md §2.4
 */
import { estimateCostEur } from './pricing';
import {
  ProviderError,
  type ChatProvider,
  type ChatProviderConfig,
  type ChatStreamRequest,
  type ChatStreamChunk,
  type ChatStreamResult,
} from './types';

const DEFAULT_CHAT_MODEL = 'claude-3-5-haiku-latest';
const DEFAULT_API_BASE = 'https://api.anthropic.com/v1';
const DEFAULT_API_VERSION = '2023-06-01';

export function createAnthropicAdapter(config: ChatProviderConfig): ChatProvider {
  const apiBase = (config.apiBase ?? DEFAULT_API_BASE).replace(/\/$/, '');
  const timeoutMs = config.parameters?.timeoutMs ?? 30_000;

  function authHeaders(): Record<string, string> {
    const h: Record<string, string> = {
      'content-type': 'application/json',
      'anthropic-version': DEFAULT_API_VERSION,
      ...(config.headers ?? {}),
    };
    if (config.apiKey) h['x-api-key'] = config.apiKey;
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
    kind: 'anthropic',
    label: config.label,

    async streamChat(req: ChatStreamRequest) {
      const model = req.model ?? config.chatModel ?? DEFAULT_CHAT_MODEL;
      const { signal, cleanup } = withTimeout(req.signal);

      // Anthropic separates `system` (top-level string) from `messages`.
      // On extrait le 1er message system pour l'API ; les autres restent dans
      // `messages` (rare mais légal de cumuler).
      const systemMessages = req.messages
        .filter((m) => m.role === 'system')
        .map((m) => m.content)
        .join('\n\n');
      const dialogue = req.messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

      const body = {
        model,
        system: systemMessages || undefined,
        messages: dialogue,
        temperature: req.temperature ?? config.parameters?.temperature ?? 0.7,
        top_p: req.topP ?? config.parameters?.topP,
        max_tokens: req.maxTokens ?? config.parameters?.maxTokens ?? 1024,
        stream: true,
      };

      let res: Response;
      try {
        res = await fetch(`${apiBase}/messages`, {
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
          for await (const evt of parseAnthropicSSE(res.body!)) {
            switch (evt.type) {
              case 'message_start': {
                tokensIn = evt.message?.usage?.input_tokens ?? tokensIn;
                break;
              }
              case 'content_block_delta': {
                const delta = evt.delta?.text ?? '';
                if (delta) {
                  aggregated += delta;
                  yield { delta };
                }
                break;
              }
              case 'message_delta': {
                tokensOut = evt.usage?.output_tokens ?? tokensOut;
                if (evt.delta?.stop_reason) {
                  finishReason = mapFinishReason(evt.delta.stop_reason);
                }
                break;
              }
              case 'message_stop':
                // fin de stream, rien à faire ici (cleanup est géré dans finally).
                break;
              case 'error': {
                throw new ProviderError(
                  'invalid-response',
                  evt.error?.message ?? 'anthropic stream error',
                  { providerId: config.id, retryable: true },
                );
              }
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

    // Anthropic n'a ni endpoint embeddings ni endpoint moderation publics.
    // On laisse `embed` et `moderate` `undefined` — l'orchestrator route ces
    // rôles vers d'autres providers (OpenAI moderation, etc.).

    async ping() {
      const t0 = Date.now();
      const model = config.chatModel ?? DEFAULT_CHAT_MODEL;
      const { signal, cleanup } = withTimeout();
      try {
        const res = await fetch(`${apiBase}/messages`, {
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
// SSE parser Anthropic : événements typés (event: name + data: {...})
// ---------------------------------------------------------------------------

interface AnthropicSSEEvent {
  type:
    | 'message_start'
    | 'content_block_start'
    | 'content_block_delta'
    | 'content_block_stop'
    | 'message_delta'
    | 'message_stop'
    | 'ping'
    | 'error';
  message?: {
    id?: string;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  delta?: {
    type?: string;
    text?: string;
    stop_reason?: string;
  };
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { type?: string; message?: string };
}

async function* parseAnthropicSSE(
  body: ReadableStream<Uint8Array>,
): AsyncIterable<AnthropicSSEEvent> {
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
        const evtBlock = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const parsed = parseSSEBlock(evtBlock);
        if (parsed) yield parsed;
      }
    }
    if (buffer.trim()) {
      const parsed = parseSSEBlock(buffer);
      if (parsed) yield parsed;
    }
  } finally {
    reader.releaseLock();
  }
}

function parseSSEBlock(block: string): AnthropicSSEEvent | null {
  let eventName: string | undefined;
  let dataLine: string | undefined;
  for (const rawLine of block.split('\n')) {
    const line = rawLine.trim();
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      // Anthropic n'envoie qu'une ligne data: par event ; pas besoin de concat.
      dataLine = line.slice(5).trim();
    }
  }
  if (!dataLine) return null;
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(dataLine);
  } catch {
    return null;
  }
  // Anthropic met le type dans `data.type` ; `event:` est redondant. On garde
  // celui de data si présent (canonique), sinon on retombe sur `event:`.
  const type = (parsed.type as string | undefined) ?? eventName;
  if (!type) return null;
  return { ...(parsed as object), type } as AnthropicSSEEvent;
}

function mapFinishReason(r: string | null | undefined): ChatStreamChunk['finishReason'] {
  switch (r) {
    case 'end_turn':
      return 'stop';
    case 'max_tokens':
      return 'length';
    case 'stop_sequence':
      return 'stop';
    case 'tool_use':
      return 'tool_calls';
    default:
      return undefined;
  }
}

function mapError(err: unknown, providerId: string): ProviderError {
  if (err instanceof ProviderError) return err;
  const e = err as { status?: number; message?: string; code?: string; name?: string };
  const status = e.status;
  if (
    e.name === 'AbortError' ||
    e.message === 'timeout' ||
    e.code === 'ETIMEDOUT' ||
    status === 408
  ) {
    return new ProviderError('timeout', e.message ?? 'timeout', {
      providerId,
      status,
      retryable: true,
    });
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
