import { env } from '@/lib/env';

export interface PostizIntegration {
  id: string;
  provider?: string;
  identifier?: string;
  name?: string;
  disabled?: boolean;
  profile?: Record<string, unknown>;
}

export type PostizPostType = 'draft' | 'now' | 'schedule';

export interface PostizPostInput {
  integrationId: string;
  platform: 'instagram' | 'facebook';
  format: 'post' | 'story' | 'reel' | 'carousel';
  content: string;
  scheduledAt?: Date | string | null;
  tags?: Array<{ value: string; label: string }>;
  image?: { id: string; path: string } | null;
  /**
   * Postiz post lifecycle:
   *  - `draft`   : created as a draft, never published (legacy behaviour, kept for compat).
   *  - `now`     : published immediately (`date` is informational; Postiz will publish ASAP).
   *  - `schedule`: queued for the given `date` (must be in the future).
   * Defaults to `draft` for backwards compatibility with `createDraftInPostiz`.
   */
  type?: PostizPostType;
}

export interface PostizUploadedMedia {
  id: string;
  name?: string | null;
  originalName?: string | null;
  path: string;
  thumbnail?: string | null;
  alt?: string | null;
}

export interface PostizResult {
  ok: boolean;
  status: number;
  body: Record<string, unknown>;
}

export interface PostizListedPost {
  id: string;
  content?: string;
  publishDate?: string;
  releaseURL?: string;
  state?: string;
  integration?: {
    id?: string;
    providerIdentifier?: string;
    name?: string;
    picture?: string;
  };
}

export interface PostizListPostsResult {
  ok: boolean;
  status: number;
  posts: PostizListedPost[];
  body: unknown;
}

export interface PostizAnalyticsResult {
  ok: boolean;
  status: number;
  body: unknown;
}

interface RetryOptions {
  attempts?: number;
  delaysMs?: number[];
}

function baseUrl(): string {
  if (!env.POSTIZ_BASE_URL) throw new Error('POSTIZ_BASE_URL manquant');
  return env.POSTIZ_BASE_URL.replace(/\/$/, '');
}

function headers(): HeadersInit {
  if (!env.POSTIZ_API_KEY) throw new Error('POSTIZ_API_KEY manquant');
  return {
    authorization: env.POSTIZ_API_KEY,
    'content-type': 'application/json',
  };
}

function authHeaders(): HeadersInit {
  if (!env.POSTIZ_API_KEY) throw new Error('POSTIZ_API_KEY manquant');
  return { authorization: env.POSTIZ_API_KEY };
}

export async function listPostizIntegrations(): Promise<PostizIntegration[]> {
  const res = await fetch(`${baseUrl()}/api/public/v1/integrations`, {
    headers: headers(),
  });
  const json = (await res.json().catch(() => ({}))) as
    | { integrations?: PostizIntegration[] }
    | PostizIntegration[];
  if (!res.ok) throw new Error(`Postiz integrations failed: ${res.status}`);
  return Array.isArray(json) ? json : json.integrations ?? [];
}

export async function listPostizPosts(input: {
  startDate: Date | string;
  endDate: Date | string;
}): Promise<PostizListPostsResult> {
  const url = new URL(`${baseUrl()}/api/public/v1/posts`);
  url.searchParams.set('startDate', postizDate(input.startDate));
  url.searchParams.set('endDate', postizDate(input.endDate));
  const res = await fetch(url, { headers: authHeaders() });
  const body = (await res.json().catch(async () => ({ raw: await res.text().catch(() => '') }))) as
    unknown;
  const posts = parsePostizPosts(body);
  return { ok: res.ok, status: res.status, posts, body };
}

export async function getPostizPostAnalytics(input: {
  postId: string;
  days?: number;
}): Promise<PostizAnalyticsResult> {
  const url = new URL(`${baseUrl()}/api/public/v1/analytics/post/${encodeURIComponent(input.postId)}`);
  url.searchParams.set('date', String(input.days ?? 7));
  const res = await fetch(url, { headers: authHeaders() });
  const body = (await res.json().catch(async () => ({ raw: await res.text().catch(() => '') }))) as
    unknown;
  return { ok: res.ok, status: res.status, body };
}

export function buildPostizDraftPayload(input: PostizPostInput): Record<string, unknown> {
  const mediaValue = input.image
    ? {
        content: input.content,
        image: [input.image],
      }
    : { content: input.content, image: [] };

  return {
    type: input.type ?? 'draft',
    shortLink: false,
    date: postizDate(input.scheduledAt),
    tags: input.tags ?? [{ value: 'femiglow', label: 'FemiGlow' }],
    posts: [
      {
        integration: { id: input.integrationId },
        value: [mediaValue],
        settings: {
          __type: input.platform,
          post_type: input.format === 'carousel' ? 'post' : input.format,
        },
      },
    ],
  };
}

function postizDate(value: Date | string | null | undefined): string {
  if (!value) return new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return new Date(Date.now() + 60 * 60 * 1000).toISOString();
  return date.toISOString();
}

export function parsePostizUploadedMedia(body: Record<string, unknown>): PostizUploadedMedia | null {
  const id = body.id;
  const path = body.path;
  if (typeof id !== 'string' || typeof path !== 'string') return null;
  return {
    id,
    path,
    name: typeof body.name === 'string' ? body.name : null,
    originalName: typeof body.originalName === 'string' ? body.originalName : null,
    thumbnail: typeof body.thumbnail === 'string' ? body.thumbnail : null,
    alt: typeof body.alt === 'string' ? body.alt : null,
  };
}

export function extractPostizPostId(body: unknown): string | null {
  const seen = new Set<unknown>();
  const stack: unknown[] = [body];
  const idKeys = new Set(['id', 'postId', 'post_id', 'publicationId']);
  const containerKeys = new Set(['post', 'posts', 'data', 'result', 'results', 'item', 'items', 'publication']);

  while (stack.length > 0) {
    const value = stack.shift();
    if (!value || seen.has(value)) continue;
    seen.add(value);

    if (Array.isArray(value)) {
      stack.push(...value);
      continue;
    }
    if (typeof value !== 'object') continue;

    const row = value as Record<string, unknown>;
    for (const key of idKeys) {
      const candidate = row[key];
      if (typeof candidate === 'string' && candidate.trim().length > 0) return candidate;
    }
    for (const key of containerKeys) {
      if (key in row) stack.push(row[key]);
    }
  }

  return null;
}

export async function uploadPostizMediaFromUrl(input: {
  url: string;
  filename: string;
  retry?: RetryOptions;
}): Promise<PostizResult> {
  const retry = normalizeRetry(input.retry);
  const mediaRes = await fetchWithRetry(input.url, { retry });
  if (!mediaRes.ok) {
    return {
      ok: false,
      status: mediaRes.status,
      body: { stage: 'fetch_source_media', url: input.url, attempts: retry.attempts },
    };
  }
  const blob = await mediaRes.blob();
  const res = await fetchWithRetry(`${baseUrl()}/api/public/v1/upload`, {
    retry,
    init: () => {
      const form = new FormData();
      form.append('file', blob, input.filename);
      return {
        method: 'POST',
        headers: authHeaders(),
        body: form,
      };
    },
  });
  const body = (await res.json().catch(async () => ({ raw: await res.text().catch(() => '') }))) as
    Record<string, unknown>;
  return { ok: res.ok, status: res.status, body };
}

export async function createPostizDraft(
  input: PostizPostInput,
  retryOptions?: RetryOptions,
): Promise<PostizResult> {
  const retry = normalizeRetry(retryOptions);
  const payload = buildPostizDraftPayload(input);
  const res = await fetchWithRetry(`${baseUrl()}/api/public/v1/posts`, {
    retry,
    init: {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(payload),
    },
  });
  const body = (await res.json().catch(async () => ({ raw: await res.text().catch(() => '') }))) as
    Record<string, unknown>;
  return { ok: res.ok, status: res.status, body };
}

function normalizeRetry(input?: RetryOptions): Required<RetryOptions> {
  const attempts = Math.max(1, Math.min(input?.attempts ?? 3, 5));
  const delaysMs = input?.delaysMs?.length ? input.delaysMs : [250, 750, 1500, 3000];
  return { attempts, delaysMs };
}

async function fetchWithRetry(
  url: string,
  options: { init?: RequestInit | (() => RequestInit); retry: Required<RetryOptions> },
): Promise<Response> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= options.retry.attempts; attempt += 1) {
    try {
      const init = typeof options.init === 'function' ? options.init() : options.init;
      const response = await fetch(url, init);
      if (!isTransientStatus(response.status) || attempt === options.retry.attempts) return response;
    } catch (err) {
      lastError = err;
      if (attempt === options.retry.attempts) throw err;
    }
    await sleep(options.retry.delaysMs[Math.min(attempt - 1, options.retry.delaysMs.length - 1)] ?? 250);
  }
  throw lastError instanceof Error ? lastError : new Error('Postiz request failed');
}

function isTransientStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parsePostizPosts(body: unknown): PostizListedPost[] {
  const rawPosts =
    typeof body === 'object' && body !== null && 'posts' in body
      ? (body as { posts?: unknown }).posts
      : body;
  if (!Array.isArray(rawPosts)) return [];
  return rawPosts.flatMap((post) => {
    if (!post || typeof post !== 'object') return [];
    const row = post as Record<string, unknown>;
    const id = row.id;
    if (typeof id !== 'string') return [];
    const integration =
      row.integration && typeof row.integration === 'object'
        ? (row.integration as PostizListedPost['integration'])
        : undefined;
    return [
      {
        id,
        content: typeof row.content === 'string' ? row.content : undefined,
        publishDate: typeof row.publishDate === 'string' ? row.publishDate : undefined,
        releaseURL: typeof row.releaseURL === 'string' ? row.releaseURL : undefined,
        state: typeof row.state === 'string' ? row.state : undefined,
        integration,
      },
    ];
  });
}
