/**
 * Typed HTTP client for Listmonk's admin API.
 *
 * All calls go to LISTMONK_INTERNAL_URL (loopback). Auth is Basic
 * (LISTMONK_API_USER:LISTMONK_API_TOKEN). No retries — Listmonk is local
 * so failures are deterministic.
 *
 * Cf. docs/emailing/03-backend-integration.md §7
 *     https://listmonk.app/docs/apis/apis/
 */
import 'server-only';
import { env } from '@/lib/env';

export class ListmonkConfigError extends Error {
  readonly code = 'LISTMONK_NOT_CONFIGURED';
  constructor(missing: string[]) {
    super(`Listmonk not configured (missing env : ${missing.join(', ')})`);
    this.name = 'ListmonkConfigError';
  }
}

export class ListmonkApiError extends Error {
  readonly code = 'LISTMONK_API_ERROR';
  constructor(public status: number, public path: string, public body: string) {
    super(`Listmonk ${status} on ${path} : ${body.slice(0, 200)}`);
    this.name = 'ListmonkApiError';
  }
}

function authHeader(): string {
  const missing: string[] = [];
  if (!env.LISTMONK_API_USER) missing.push('LISTMONK_API_USER');
  if (!env.LISTMONK_API_TOKEN) missing.push('LISTMONK_API_TOKEN');
  if (missing.length > 0) throw new ListmonkConfigError(missing);
  const raw = `${env.LISTMONK_API_USER}:${env.LISTMONK_API_TOKEN}`;
  return `Basic ${Buffer.from(raw).toString('base64')}`;
}

async function lm<T>(
  path: string,
  init: { method?: string; body?: unknown; query?: Record<string, string | number> } = {},
): Promise<T> {
  const url = new URL(`${env.LISTMONK_INTERNAL_URL}${path}`);
  if (init.query) {
    for (const [k, v] of Object.entries(init.query)) {
      url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ListmonkApiError(res.status, path, text);
  }
  return (await res.json()) as T;
}

// ─── Types ────────────────────────────────────────────────────────────────

export type ListmonkResponse<T> = { data: T };

export type List = {
  id: number;
  uuid: string;
  name: string;
  type: 'public' | 'private' | 'temporary';
  optin: 'single' | 'double';
  subscriber_count: number;
  created_at: string;
  updated_at: string;
};

export type Subscriber = {
  id: number;
  uuid: string;
  email: string;
  name: string;
  status: 'enabled' | 'disabled' | 'blocklisted';
  attribs: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type Template = {
  id: number;
  name: string;
  type: 'campaign' | 'tx';
  subject: string;
  body: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type CampaignStatus =
  | 'draft'
  | 'running'
  | 'scheduled'
  | 'paused'
  | 'cancelled'
  | 'finished';

export type Campaign = {
  id: number;
  uuid: string;
  name: string;
  subject: string;
  status: CampaignStatus;
  type: 'regular' | 'optin';
  to_send: number;
  sent: number;
  views: number;
  clicks: number;
  bounces: number;
  send_at: string | null;
  created_at: string;
  updated_at: string;
};

// ─── Public API ───────────────────────────────────────────────────────────

export const listmonk = {
  lists: {
    list: () => lm<ListmonkResponse<{ results: List[]; total: number }>>('/api/lists', { query: { per_page: 'all' as unknown as number } }),
    get: (id: number) => lm<ListmonkResponse<List>>(`/api/lists/${id}`),
    create: (input: { name: string; type: List['type']; optin: List['optin'] }) =>
      lm<ListmonkResponse<List>>('/api/lists', { method: 'POST', body: input }),
  },
  subscribers: {
    list: (q?: { list_id?: number; query?: string; per_page?: number }) =>
      lm<ListmonkResponse<{ results: Subscriber[]; total: number }>>('/api/subscribers', {
        query: { ...(q ?? {}), per_page: q?.per_page ?? 50 } as Record<string, string | number>,
      }),
    get: (id: number) => lm<ListmonkResponse<Subscriber>>(`/api/subscribers/${id}`),
    upsert: (input: { email: string; name?: string; status?: Subscriber['status']; lists?: number[]; attribs?: Record<string, unknown> }) =>
      lm<ListmonkResponse<Subscriber>>('/api/subscribers', { method: 'POST', body: input }),
    blocklist: (emails: string[]) =>
      lm<ListmonkResponse<{ count: number }>>('/api/subscribers/blocklist', {
        method: 'PUT',
        body: { ids: emails },
      }),
  },
  templates: {
    list: () => lm<ListmonkResponse<Template[]>>('/api/templates'),
    get: (id: number) => lm<ListmonkResponse<Template>>(`/api/templates/${id}`),
    create: (input: { name: string; type: Template['type']; subject: string; body: string }) =>
      lm<ListmonkResponse<Template>>('/api/templates', { method: 'POST', body: input }),
    update: (id: number, input: Partial<Pick<Template, 'name' | 'subject' | 'body'>>) =>
      lm<ListmonkResponse<Template>>(`/api/templates/${id}`, { method: 'PUT', body: input }),
  },
  campaigns: {
    list: (q?: { status?: CampaignStatus; per_page?: number }) =>
      lm<ListmonkResponse<{ results: Campaign[]; total: number }>>('/api/campaigns', {
        query: { ...(q ?? {}), per_page: q?.per_page ?? 50 } as Record<string, string | number>,
      }),
    get: (id: number) => lm<ListmonkResponse<Campaign>>(`/api/campaigns/${id}`),
    create: (input: {
      name: string;
      subject: string;
      lists: number[];
      from_email: string;
      body: string;
      content_type?: 'richtext' | 'html' | 'plain';
      type?: 'regular' | 'optin';
      send_at?: string | null;
      template_id?: number;
    }) => lm<ListmonkResponse<Campaign>>('/api/campaigns', { method: 'POST', body: input }),
    updateStatus: (id: number, status: 'scheduled' | 'running' | 'paused' | 'cancelled') =>
      lm<ListmonkResponse<{ status: CampaignStatus }>>(`/api/campaigns/${id}/status`, {
        method: 'PUT',
        body: { status },
      }),
  },
  transactional: {
    send: (input: { subscriber_email: string; template_id: number; data?: Record<string, unknown> }) =>
      lm<ListmonkResponse<{ message: string }>>('/api/tx', { method: 'POST', body: input }),
  },
  meta: {
    serverInfo: () => lm<ListmonkResponse<{ version: string }>>('/api/health').catch(() => null),
  },
};
