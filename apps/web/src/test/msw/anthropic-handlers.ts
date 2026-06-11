/**
 * CHA-230 Phase 2 — MSW handlers pour l'API Anthropic Messages.
 *
 * Couvre POST /v1/messages (stream SSE) — c'est le seul endpoint utilisé
 * par `providers/anthropic.ts` (pas d'embeddings ni de moderation côté
 * Anthropic).
 *
 * Comportement par défaut : succès. Pour simuler des erreurs, surcharger
 * via `server.use(...)` dans le test.
 *
 * Format SSE Anthropic :
 *   event: message_start
 *   data: {"type":"message_start", "message": {"id":"...", "usage":{"input_tokens":N}}}
 *
 *   event: content_block_start
 *   data: {"type":"content_block_start", "index":0, "content_block":{"type":"text","text":""}}
 *
 *   event: content_block_delta
 *   data: {"type":"content_block_delta", "index":0, "delta":{"type":"text_delta","text":"Bonjour"}}
 *
 *   event: content_block_stop
 *   data: {"type":"content_block_stop", "index":0}
 *
 *   event: message_delta
 *   data: {"type":"message_delta", "delta":{"stop_reason":"end_turn"}, "usage":{"output_tokens":N}}
 *
 *   event: message_stop
 *   data: {"type":"message_stop"}
 *
 * cf. https://docs.anthropic.com/en/api/messages-streaming
 */
import {
  http,
  HttpResponse,
  type DefaultBodyType,
  type StrictRequest,
} from 'msw';

// ---------------------------------------------------------------------------
// Helpers : encode une suite d'événements en stream SSE Anthropic.
// ---------------------------------------------------------------------------

export interface AnthropicSseEvent {
  type:
    | 'message_start'
    | 'content_block_start'
    | 'content_block_delta'
    | 'content_block_stop'
    | 'message_delta'
    | 'message_stop'
    | 'ping';
  /** Délégué au type d'event ; on garde un objet libre pour souplesse. */
  payload?: Record<string, unknown>;
}

export function encodeAnthropicSseStream(
  events: AnthropicSseEvent[],
): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const e of events) {
        const data = JSON.stringify({ type: e.type, ...(e.payload ?? {}) });
        controller.enqueue(enc.encode(`event: ${e.type}\ndata: ${data}\n\n`));
        await new Promise((r) => setTimeout(r, 0));
      }
      controller.close();
    },
  });
}

/**
 * Stream « happy path » qui dit "Bonjour Femi" en 2 chunks et termine proprement,
 * avec usage 18 in / 4 out.
 */
export const anthropicHappyPathHandlers = [
  http.post('https://api.anthropic.com/v1/messages', async () => {
    const body = encodeAnthropicSseStream([
      {
        type: 'message_start',
        payload: {
          message: {
            id: 'msg_test',
            type: 'message',
            role: 'assistant',
            content: [],
            model: 'claude-3-5-haiku-20241022',
            stop_reason: null,
            usage: { input_tokens: 18, output_tokens: 0 },
          },
        },
      },
      {
        type: 'content_block_start',
        payload: { index: 0, content_block: { type: 'text', text: '' } },
      },
      {
        type: 'content_block_delta',
        payload: { index: 0, delta: { type: 'text_delta', text: 'Bonjour' } },
      },
      {
        type: 'content_block_delta',
        payload: { index: 0, delta: { type: 'text_delta', text: ' Femi' } },
      },
      { type: 'content_block_stop', payload: { index: 0 } },
      {
        type: 'message_delta',
        payload: {
          delta: { stop_reason: 'end_turn', stop_sequence: null },
          usage: { output_tokens: 4 },
        },
      },
      { type: 'message_stop' },
    ]);
    return new HttpResponse(body, {
      status: 200,
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
      },
    });
  }),
];

export const anthropicAuthErrorHandler = http.post(
  'https://api.anthropic.com/v1/messages',
  () =>
    HttpResponse.json(
      {
        type: 'error',
        error: { type: 'authentication_error', message: 'invalid x-api-key' },
      },
      { status: 401 },
    ),
);

export const anthropicRateLimitHandler = http.post(
  'https://api.anthropic.com/v1/messages',
  () =>
    HttpResponse.json(
      {
        type: 'error',
        error: { type: 'rate_limit_error', message: 'rate limit exceeded' },
      },
      { status: 429 },
    ),
);

export const anthropicServerErrorHandler = http.post(
  'https://api.anthropic.com/v1/messages',
  () => new HttpResponse('upstream error', { status: 502 }),
);

// ---------------------------------------------------------------------------
// Capture du body — pour vérifier que le payload est bien formé.
// ---------------------------------------------------------------------------

export function captureMessagesBody() {
  let lastBody: DefaultBodyType | null = null;
  let lastHeaders: Record<string, string> | null = null;
  const handler = http.post(
    'https://api.anthropic.com/v1/messages',
    async ({ request }: { request: StrictRequest<DefaultBodyType> }) => {
      lastBody = (await request.json()) as DefaultBodyType;
      lastHeaders = Object.fromEntries(request.headers.entries());
      // Renvoie un mini stream valide pour que le test n'échoue pas après capture.
      const body = encodeAnthropicSseStream([
        {
          type: 'message_start',
          payload: {
            message: {
              id: 'msg_test',
              usage: { input_tokens: 1, output_tokens: 0 },
            },
          },
        },
        {
          type: 'content_block_delta',
          payload: { index: 0, delta: { type: 'text_delta', text: 'ok' } },
        },
        {
          type: 'message_delta',
          payload: {
            delta: { stop_reason: 'end_turn' },
            usage: { output_tokens: 1 },
          },
        },
        { type: 'message_stop' },
      ]);
      return new HttpResponse(body, {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      });
    },
  );
  return { handler, getLastBody: async () => lastBody, getLastHeaders: () => lastHeaders };
}
