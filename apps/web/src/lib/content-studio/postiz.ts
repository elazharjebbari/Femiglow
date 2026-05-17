import { env } from '@/lib/env';

export interface PostizIntegration {
  id: string;
  provider?: string;
  identifier?: string;
  name?: string;
  disabled?: boolean;
  profile?: Record<string, unknown>;
}

export interface PostizPostInput {
  integrationId: string;
  platform: 'instagram' | 'facebook';
  format: 'post' | 'story' | 'reel' | 'carousel';
  content: string;
  scheduledAt?: Date | string | null;
  tags?: Array<{ value: string; label: string }>;
  image?: { id: string; path: string } | null;
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
    : { content: input.content };

  return {
    type: 'draft',
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

export async function uploadPostizMediaFromUrl(input: {
  url: string;
  filename: string;
}): Promise<PostizResult> {
  const mediaRes = await fetch(input.url);
  if (!mediaRes.ok) {
    return {
      ok: false,
      status: mediaRes.status,
      body: { stage: 'fetch_source_media', url: input.url },
    };
  }
  const blob = await mediaRes.blob();
  const form = new FormData();
  form.append('file', blob, input.filename);
  const res = await fetch(`${baseUrl()}/api/public/v1/upload`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  });
  const body = (await res.json().catch(async () => ({ raw: await res.text().catch(() => '') }))) as
    Record<string, unknown>;
  return { ok: res.ok, status: res.status, body };
}

export async function createPostizDraft(
  input: PostizPostInput,
): Promise<PostizResult> {
  const payload = buildPostizDraftPayload(input);
  const res = await fetch(`${baseUrl()}/api/public/v1/posts`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(async () => ({ raw: await res.text().catch(() => '') }))) as
    Record<string, unknown>;
  return { ok: res.ok, status: res.status, body };
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
