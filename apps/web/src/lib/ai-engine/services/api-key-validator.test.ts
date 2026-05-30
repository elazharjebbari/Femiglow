import { describe, expect, it, vi, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import { server, http, HttpResponse } from '@/test/msw/server';
import { validateApiKey } from './api-key-validator';

vi.mock('../utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Endpoints (ARC-004 — interception réseau MSW au lieu de stubber globalThis.fetch)
// ---------------------------------------------------------------------------

const OPENAI_URL = 'https://api.openai.com/v1/models';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const GOOGLE_URL = 'https://generativelanguage.googleapis.com/v1/models';
const ELEVENLABS_URL = 'https://api.elevenlabs.io/v1/user';
const HIGGSFIELD_URL = 'https://api.higgsfield.ai/v1/models';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('api-key-validator', () => {
  // ---------------------------------------------------------------------------
  // validateApiKey dispatch
  // ---------------------------------------------------------------------------
  describe('validateApiKey dispatch', () => {
    it('routes to testOpenAI for openai provider', async () => {
      let capturedUrl = '';
      let capturedAuth: string | null = null;
      let capturedSignal: AbortSignal | null = null;
      server.use(
        http.get(OPENAI_URL, ({ request }) => {
          capturedUrl = request.url;
          capturedAuth = request.headers.get('Authorization');
          capturedSignal = request.signal;
          return HttpResponse.json({}, { status: 200 });
        }),
      );

      const result = await validateApiKey('openai', 'sk-test');

      expect(capturedUrl).toBe('https://api.openai.com/v1/models');
      expect(capturedAuth).toBe('Bearer sk-test');
      expect(capturedSignal).toBeInstanceOf(AbortSignal);
      expect(result.provider).toBe('openai');
    });

    it('routes to testAnthropic for anthropic provider', async () => {
      let capturedMethod = '';
      let capturedApiKey: string | null = null;
      server.use(
        http.post(ANTHROPIC_URL, ({ request }) => {
          capturedMethod = request.method;
          capturedApiKey = request.headers.get('x-api-key');
          return HttpResponse.json({}, { status: 200 });
        }),
      );

      const result = await validateApiKey('anthropic', 'sk-ant-test');

      expect(capturedMethod).toBe('POST');
      expect(capturedApiKey).toBe('sk-ant-test');
      expect(result.provider).toBe('anthropic');
    });

    it('routes to testGoogle for google provider', async () => {
      let capturedUrl = '';
      let capturedSignal: AbortSignal | null = null;
      server.use(
        http.get(GOOGLE_URL, ({ request }) => {
          capturedUrl = request.url;
          capturedSignal = request.signal;
          return HttpResponse.json({}, { status: 200 });
        }),
      );

      const result = await validateApiKey('google', 'AIzaSyTest');

      expect(capturedUrl).toBe('https://generativelanguage.googleapis.com/v1/models?key=AIzaSyTest');
      expect(capturedSignal).toBeInstanceOf(AbortSignal);
      expect(result.provider).toBe('google');
    });

    it('routes to testElevenLabs for elevenlabs provider', async () => {
      let capturedUrl = '';
      let capturedApiKey: string | null = null;
      server.use(
        http.get(ELEVENLABS_URL, ({ request }) => {
          capturedUrl = request.url;
          capturedApiKey = request.headers.get('xi-api-key');
          return HttpResponse.json({}, { status: 200 });
        }),
      );

      const result = await validateApiKey('elevenlabs', 'el-test');

      expect(capturedUrl).toBe('https://api.elevenlabs.io/v1/user');
      expect(capturedApiKey).toBe('el-test');
      expect(result.provider).toBe('elevenlabs');
    });

    it('routes to testOllama for ollama provider with no auth header when key is empty', async () => {
      let capturedUrl = '';
      let capturedAuth: string | null = null;
      let capturedSignal: AbortSignal | null = null;
      server.use(
        http.get('http://localhost:11434/api/tags', ({ request }) => {
          capturedUrl = request.url;
          capturedAuth = request.headers.get('Authorization');
          capturedSignal = request.signal;
          return HttpResponse.json({}, { status: 200 });
        }),
      );

      const result = await validateApiKey('ollama', '');

      expect(capturedUrl).toBe('http://localhost:11434/api/tags');
      expect(capturedAuth).toBeNull();
      expect(capturedSignal).toBeInstanceOf(AbortSignal);
      expect(result.provider).toBe('ollama');
    });

    it('routes to testOllama with Bearer header when apiKey is a token', async () => {
      let capturedUrl = '';
      let capturedAuth: string | null = null;
      let capturedSignal: AbortSignal | null = null;
      server.use(
        http.get('http://localhost:11434/api/tags', ({ request }) => {
          capturedUrl = request.url;
          capturedAuth = request.headers.get('Authorization');
          capturedSignal = request.signal;
          return HttpResponse.json({}, { status: 200 });
        }),
      );

      const result = await validateApiKey('ollama', 'my-secret-token');

      expect(capturedUrl).toBe('http://localhost:11434/api/tags');
      expect(capturedAuth).toBe('Bearer my-secret-token');
      expect(capturedSignal).toBeInstanceOf(AbortSignal);
      expect(result.valid).toBe(true);
    });

    it('does not set Bearer header when apiKey looks like a URL', async () => {
      let capturedUrl = '';
      let capturedAuth: string | null = null;
      server.use(
        http.get('http://localhost:11434/api/tags', ({ request }) => {
          capturedUrl = request.url;
          capturedAuth = request.headers.get('Authorization');
          return HttpResponse.json({}, { status: 200 });
        }),
      );

      await validateApiKey('ollama', 'http://my-ollama:8080');

      expect(capturedUrl).toBe('http://localhost:11434/api/tags');
      expect(capturedAuth).toBeNull();
    });

    it('returns valid:false with error for unknown provider', async () => {
      let callCount = 0;
      // Any HTTP call would be unexpected; count requests across all hosts.
      server.use(
        http.all('*', () => {
          callCount += 1;
          return HttpResponse.json({}, { status: 200 });
        }),
      );

      const result = await validateApiKey('xyz', 'key');

      expect(result).toMatchObject({
        valid: false,
        provider: 'xyz',
        error: 'Unknown provider: xyz',
      });
      expect(callCount).toBe(0);
    });

    it('ollama uses custom baseUrl when provided', async () => {
      let capturedUrl = '';
      let capturedAuth: string | null = null;
      let capturedSignal: AbortSignal | null = null;
      server.use(
        http.get('http://my-ollama:8080/api/tags', ({ request }) => {
          capturedUrl = request.url;
          capturedAuth = request.headers.get('Authorization');
          capturedSignal = request.signal;
          return HttpResponse.json({}, { status: 200 });
        }),
      );

      await validateApiKey('ollama', 'my-token', 'http://my-ollama:8080');

      expect(capturedUrl).toBe('http://my-ollama:8080/api/tags');
      expect(capturedAuth).toBe('Bearer my-token');
      expect(capturedSignal).toBeInstanceOf(AbortSignal);
    });

    it('ollama falls back to localhost:11434 when no baseUrl', async () => {
      let capturedUrl = '';
      server.use(
        http.get('http://localhost:11434/api/tags', ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json({}, { status: 200 });
        }),
      );

      await validateApiKey('ollama', '');

      expect(capturedUrl).toBe('http://localhost:11434/api/tags');
    });
  });

  // ---------------------------------------------------------------------------
  // testOpenAI
  // ---------------------------------------------------------------------------
  describe('testOpenAI', () => {
    it('returns valid:true on 200 OK', async () => {
      server.use(
        http.get(OPENAI_URL, () => HttpResponse.json({ data: [] }, { status: 200 })),
      );
      const result = await validateApiKey('openai', 'sk-valid');
      expect(result.valid).toBe(true);
      expect(result.provider).toBe('openai');
    });

    it('returns valid:false with body snippet on 401', async () => {
      server.use(
        http.get(OPENAI_URL, () =>
          new HttpResponse('Incorrect API key provided', { status: 401 }),
        ),
      );
      const result = await validateApiKey('openai', 'sk-bad');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('401');
      expect(result.error).toContain('Incorrect API key provided');
    });
  });

  // ---------------------------------------------------------------------------
  // testAnthropic (nuanced logic)
  // ---------------------------------------------------------------------------
  describe('testAnthropic', () => {
    it('returns valid:true on 200', async () => {
      server.use(
        http.post(ANTHROPIC_URL, () => HttpResponse.json({}, { status: 200 })),
      );
      const result = await validateApiKey('anthropic', 'sk-ant-valid');
      expect(result.valid).toBe(true);
      expect(result.provider).toBe('anthropic');
    });

    it('returns valid:false with "Invalid API key" on 401', async () => {
      server.use(
        http.post(ANTHROPIC_URL, () =>
          new HttpResponse('authentication_error', { status: 401 }),
        ),
      );
      const result = await validateApiKey('anthropic', 'sk-ant-bad');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid API key');
    });

    it('returns valid:true on 400 (bad request means key is recognized)', async () => {
      server.use(
        http.post(ANTHROPIC_URL, () =>
          new HttpResponse('invalid_request_error', { status: 400 }),
        ),
      );
      const result = await validateApiKey('anthropic', 'sk-ant-valid');
      expect(result.valid).toBe(true);
      expect(result.provider).toBe('anthropic');
    });

    it('returns valid:true on 429 (rate limited means key is recognized)', async () => {
      server.use(
        http.post(ANTHROPIC_URL, () =>
          new HttpResponse('rate_limit_error', { status: 429 }),
        ),
      );
      const result = await validateApiKey('anthropic', 'sk-ant-valid');
      expect(result.valid).toBe(true);
      expect(result.provider).toBe('anthropic');
    });

    it('returns valid:false on 500 server error', async () => {
      server.use(
        http.post(ANTHROPIC_URL, () =>
          new HttpResponse('internal_server_error', { status: 500 }),
        ),
      );
      const result = await validateApiKey('anthropic', 'sk-ant-valid');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('500');
    });
  });

  // ---------------------------------------------------------------------------
  // testGoogle
  // ---------------------------------------------------------------------------
  describe('testGoogle', () => {
    it('returns valid:true on 200', async () => {
      server.use(
        http.get(GOOGLE_URL, () => HttpResponse.json({ models: [] }, { status: 200 })),
      );
      const result = await validateApiKey('google', 'AIzaSyValid');
      expect(result.valid).toBe(true);
      expect(result.provider).toBe('google');
    });

    it('returns valid:false on non-OK response', async () => {
      server.use(
        http.get(GOOGLE_URL, () => new HttpResponse('forbidden', { status: 403 })),
      );
      const result = await validateApiKey('google', 'bad-key');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('403');
    });
  });

  // ---------------------------------------------------------------------------
  // testElevenLabs
  // ---------------------------------------------------------------------------
  describe('testElevenLabs', () => {
    it('returns valid:true on 200', async () => {
      server.use(
        http.get(ELEVENLABS_URL, () =>
          HttpResponse.json({ subscription: {} }, { status: 200 }),
        ),
      );
      const result = await validateApiKey('elevenlabs', 'el-valid');
      expect(result.valid).toBe(true);
      expect(result.provider).toBe('elevenlabs');
    });

    it('returns valid:false on non-OK response', async () => {
      server.use(
        http.get(ELEVENLABS_URL, () => new HttpResponse('unauthorized', { status: 401 })),
      );
      const result = await validateApiKey('elevenlabs', 'el-bad');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('401');
    });
  });

  // ---------------------------------------------------------------------------
  // testOllama
  // ---------------------------------------------------------------------------
  describe('testOllama', () => {
    it('returns valid:true on 200', async () => {
      server.use(
        http.get('http://localhost:11434/api/tags', () =>
          HttpResponse.json({ models: [] }, { status: 200 }),
        ),
      );
      const result = await validateApiKey('ollama', '');
      expect(result.valid).toBe(true);
      expect(result.provider).toBe('ollama');
    });

    it('returns valid:false on non-OK response', async () => {
      server.use(
        http.get('http://localhost:11434/api/tags', () =>
          new HttpResponse('service unavailable', { status: 503 }),
        ),
      );
      const result = await validateApiKey('ollama', '');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('503');
    });
  });

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------
  describe('error handling', () => {
    it('returns valid:false with error message when fetch throws a network error', async () => {
      server.use(
        http.get(OPENAI_URL, () => HttpResponse.error()),
      );
      const result = await validateApiKey('openai', 'sk-test');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.provider).toBe('openai');
    });

    it('latencyMs is always a positive number', async () => {
      server.use(
        http.get(OPENAI_URL, () => HttpResponse.json({}, { status: 200 })),
      );
      const result = await validateApiKey('openai', 'sk-test');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.latencyMs).toBe('number');
    });
  });

  // ---------------------------------------------------------------------------
  // Fetch is called with AbortSignal
  // ---------------------------------------------------------------------------
  describe('abort signal', () => {
    it('passes an AbortSignal to fetch', async () => {
      let capturedSignal: AbortSignal | null = null;
      server.use(
        http.get(OPENAI_URL, ({ request }) => {
          capturedSignal = request.signal;
          return HttpResponse.json({}, { status: 200 });
        }),
      );
      await validateApiKey('openai', 'sk-test');
      expect(capturedSignal).toBeInstanceOf(AbortSignal);
    });
  });
});
