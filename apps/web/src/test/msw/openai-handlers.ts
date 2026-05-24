/**
 * MSW handlers pour l'API OpenAI utilisée par `lib/chat/providers/openai.ts`.
 *
 * Couvre :
 * - POST /v1/chat/completions (streaming SSE + non-stream)
 * - POST /v1/embeddings
 * - POST /v1/moderations
 * - GET  /v1/models (utilisé par /api/admin/chat/providers/models)
 *
 * Comportement par défaut : succès. Pour simuler des erreurs (401, 429,
 * 500, timeout), surcharger ponctuellement avec `server.use(...)` dans
 * le test.
 */
import { http, HttpResponse, type DefaultBodyType, type StrictRequest } from 'msw';

// ---------------------------------------------------------------------------
// Helpers : produit une ReadableStream SSE-OpenAI à partir de tokens.
// ---------------------------------------------------------------------------

export interface SsePart {
  delta?: string;
  finish_reason?: 'stop' | 'length' | 'content_filter' | null;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

/**
 * Encode une suite de chunks au format SSE `data: {...}\n\n` exactement
 * comme l'API OpenAI le ferait. Ajoute `data: [DONE]` à la fin.
 */
export function encodeSseStream(parts: SsePart[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const p of parts) {
        const payload = {
          id: 'chatcmpl-msw',
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: 'gpt-4o-mini',
          choices: p.delta !== undefined || p.finish_reason !== undefined
            ? [
                {
                  index: 0,
                  delta: p.delta !== undefined ? { content: p.delta } : {},
                  finish_reason: p.finish_reason ?? null,
                },
              ]
            : [],
          usage: p.usage,
        };
        controller.enqueue(enc.encode(`data: ${JSON.stringify(payload)}\n\n`));
        // Petit yield pour que l'AsyncIterable côté client puisse interleaver.
        await new Promise((r) => setTimeout(r, 0));
      }
      controller.enqueue(enc.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/** Renvoie un stream qui dit "Bonjour FemiGlow." en 4 chunks + usage. */
export const openaiHappyPathHandlers = [
  http.post('https://api.openai.com/v1/chat/completions', async () => {
    const body = encodeSseStream([
      { delta: 'Bonjour' },
      { delta: ' Femi' },
      { delta: 'Glow.' },
      {
        finish_reason: 'stop',
        usage: { prompt_tokens: 18, completion_tokens: 6 },
      },
    ]);
    return new HttpResponse(body, {
      status: 200,
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
      },
    });
  }),

  http.post('https://api.openai.com/v1/embeddings', async ({ request }) => {
    const json = (await request.json()) as { input: string[] };
    const inputs = Array.isArray(json.input) ? json.input : [String(json.input)];
    return HttpResponse.json({
      object: 'list',
      data: inputs.map((_, i) => ({
        object: 'embedding',
        index: i,
        embedding: Array.from({ length: 1536 }, (_, j) => ((i + 1) * (j + 1)) / 1e6),
      })),
      model: 'text-embedding-3-small',
      usage: { prompt_tokens: 12, total_tokens: 12 },
    });
  }),

  http.post('https://api.openai.com/v1/moderations', async () => {
    return HttpResponse.json({
      id: 'modr-msw',
      model: 'omni-moderation-latest',
      results: [
        {
          flagged: false,
          categories: { hate: false, violence: false, sexual: false },
          category_scores: { hate: 0.001, violence: 0.001, sexual: 0.001 },
        },
      ],
    });
  }),

  http.get('https://api.openai.com/v1/models', () =>
    HttpResponse.json({
      object: 'list',
      data: [
        { id: 'gpt-4o-mini', object: 'model' },
        { id: 'gpt-4o', object: 'model' },
        { id: 'text-embedding-3-small', object: 'model' },
      ],
    }),
  ),
];

// ---------------------------------------------------------------------------
// Variantes (à composer via `server.use(...)`)
// ---------------------------------------------------------------------------

export const openaiAuthErrorHandler = http.post(
  'https://api.openai.com/v1/chat/completions',
  () =>
    HttpResponse.json(
      { error: { message: 'Invalid API key', type: 'invalid_request_error', code: 'invalid_api_key' } },
      { status: 401 },
    ),
);

export const openaiRateLimitHandler = http.post(
  'https://api.openai.com/v1/chat/completions',
  () =>
    HttpResponse.json(
      { error: { message: 'Rate limit exceeded', type: 'rate_limit', code: 'rate_limit_exceeded' } },
      { status: 429, headers: { 'retry-after': '1' } },
    ),
);

export const openaiServerErrorHandler = http.post(
  'https://api.openai.com/v1/chat/completions',
  () => HttpResponse.json({ error: { message: 'upstream error' } }, { status: 503 }),
);

/** Stream qui finit par `length` (truncation). */
export const openaiLengthCutoffHandler = http.post(
  'https://api.openai.com/v1/chat/completions',
  async () => {
    const body = encodeSseStream([
      { delta: 'Réponse trop' },
      { delta: ' longue' },
      { finish_reason: 'length', usage: { prompt_tokens: 10, completion_tokens: 4096 } },
    ]);
    return new HttpResponse(body, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    });
  },
);

/** Body modéré (flagged). */
export const openaiModerationFlaggedHandler = http.post(
  'https://api.openai.com/v1/moderations',
  () =>
    HttpResponse.json({
      id: 'modr-msw',
      model: 'omni-moderation-latest',
      results: [
        {
          flagged: true,
          categories: { hate: true, violence: false, sexual: false },
          category_scores: { hate: 0.92, violence: 0.01, sexual: 0.01 },
        },
      ],
    }),
);

/** Capture le body du dernier appel chat completions pour assertions. */
export function captureChatCompletionsBody(): {
  handler: ReturnType<typeof http.post>;
  getLastBody: () => Promise<unknown> | null;
} {
  let captured: Promise<unknown> | null = null;
  const handler = http.post(
    'https://api.openai.com/v1/chat/completions',
    async ({ request }: { request: StrictRequest<DefaultBodyType> }) => {
      captured = request.clone().json();
      const body = encodeSseStream([
        { delta: 'ok' },
        { finish_reason: 'stop', usage: { prompt_tokens: 1, completion_tokens: 1 } },
      ]);
      return new HttpResponse(body, {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      });
    },
  );
  return { handler, getLastBody: () => captured };
}

// ---------------------------------------------------------------------------
// Image generation handlers (used by content-studio visual generation)
// ---------------------------------------------------------------------------

/** Happy-path: returns a tiny 1x1 white PNG as b64. */
export const openaiImageGenerationHandler = http.post(
  'https://api.openai.com/v1/images/generations',
  async () => {
    // 1x1 white PNG in base64
    const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
    return HttpResponse.json({
      created: Math.floor(Date.now() / 1000),
      data: [{ b64_json: b64, revised_prompt: 'A FemiGlow product mock image' }],
    });
  },
);

/** Content policy violation (DALL-E refuses the prompt). */
export const openaiImagePolicyViolationHandler = http.post(
  'https://api.openai.com/v1/images/generations',
  () =>
    HttpResponse.json(
      { error: { message: 'Your request was rejected as a result of our safety system.', type: 'invalid_request_error', code: 'content_policy_violation' } },
      { status: 400 },
    ),
);

/** Rate limit on image generation. */
export const openaiImageRateLimitHandler = http.post(
  'https://api.openai.com/v1/images/generations',
  () =>
    HttpResponse.json(
      { error: { message: 'Rate limit exceeded for images', type: 'rate_limit', code: 'rate_limit_exceeded' } },
      { status: 429, headers: { 'retry-after': '60' } },
    ),
);
