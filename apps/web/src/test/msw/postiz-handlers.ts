/**
 * MSW handlers pour l'API Postiz (`lib/content-studio/postiz.ts`).
 *
 * Couvre :
 * - POST /api/public/v1/posts (création draft/now/schedule)
 * - POST /api/public/v1/upload (upload média)
 * - GET  /api/public/v1/analytics/post/:id (insights snapshot)
 *
 * Pour utiliser en test :
 * ```ts
 * import { server } from '@/test/msw/server';
 * import { postizPostsHandler, postizUploadHandler } from '@/test/msw/postiz-handlers';
 * beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
 * beforeEach(() => server.use(postizPostsHandler(), postizUploadHandler()));
 * afterEach(() => server.resetHandlers());
 * afterAll(() => server.close());
 * ```
 *
 * Les handlers acceptent un base URL custom — pratique en CI où
 * `POSTIZ_BASE_URL` peut différer.
 */
import { http, HttpResponse } from 'msw';

export interface PostizPostsHandlerOptions {
  baseUrl?: string;
  /** Called with the parsed request body — assert on the wire format here. */
  onRequest?: (body: { type?: string; posts?: unknown[] }) => void;
  /** Override the response body. */
  responseBody?: Record<string, unknown>;
  /** Override the HTTP status (default 200). */
  status?: number;
}

export function postizPostsHandler(options: PostizPostsHandlerOptions = {}) {
  const base = options.baseUrl ?? 'https://postiz.example.test';
  return http.post(`${base}/api/public/v1/posts`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as {
      type?: string;
      posts?: unknown[];
    };
    options.onRequest?.(body);
    return HttpResponse.json(
      options.responseBody ?? { id: 'pz_msw_draft_1', state: 'DRAFT' },
      { status: options.status ?? 200 },
    );
  });
}

export interface PostizUploadHandlerOptions {
  baseUrl?: string;
  responseBody?: Record<string, unknown>;
  status?: number;
}

export function postizUploadHandler(options: PostizUploadHandlerOptions = {}) {
  const base = options.baseUrl ?? 'https://postiz.example.test';
  return http.post(`${base}/api/public/v1/upload`, () =>
    HttpResponse.json(
      options.responseBody ?? {
        id: 'media_msw_1',
        path: 'https://postiz.example.test/media/msw_1.jpg',
      },
      { status: options.status ?? 200 },
    ),
  );
}

export interface PostizMediaSourceHandlerOptions {
  url: string;
  status?: number;
}

/** Stub the public media URL the uploader fetches before pushing to Postiz. */
export function postizMediaSourceHandler(options: PostizMediaSourceHandlerOptions) {
  return http.get(options.url, () => {
    // 4 bytes — the PNG magic header is enough to convince Blob handling.
    const body = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    return new HttpResponse(body, {
      status: options.status ?? 200,
      headers: { 'content-type': 'image/png' },
    });
  });
}
