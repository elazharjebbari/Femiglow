'use client';

/**
 * Client API typé pour les routes admin event-mappings.
 * cf. docs/event-mappings/40-frontend/api-client.md
 */
import type {
  MappingProviderKind,
  Mappings,
  MappingVersion,
  MappingVersionListItem,
} from '@/lib/tracking/mappings/types';

export class MappingApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public details: unknown,
    public httpStatus: number,
  ) {
    super(message);
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string; details?: unknown } };
    throw new MappingApiError(
      body?.error?.code ?? 'unknown',
      body?.error?.message ?? `HTTP ${res.status}`,
      body?.error?.details,
      res.status,
    );
  }
  return res.json() as Promise<T>;
}

const BASE = '/api/admin/tracking/events/mappings';

export const mappingsClient = {
  async list(opts: { status?: string[] } = {}) {
    const params = new URLSearchParams();
    if (opts.status?.length) params.set('status', opts.status.join(','));
    const res = await fetch(`${BASE}?${params}`, { cache: 'no-store' });
    return handle<{ versions: MappingVersionListItem[]; activeId: string | null; defaultId: string }>(res);
  },
  async get(id: string) {
    const res = await fetch(`${BASE}/${encodeURIComponent(id)}`, { cache: 'no-store' });
    return handle<MappingVersion>(res);
  },
  async create(input: {
    name: string;
    notes?: string | null;
    source: { kind: 'default' } | { kind: 'clone'; sourceId: string } | { kind: 'import'; mappings: Mappings };
  }) {
    const res = await fetch(BASE, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
    return handle<MappingVersion>(res);
  },
  async update(id: string, input: { mappings: Mappings; name?: string; notes?: string | null }) {
    const res = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
    return handle<MappingVersion>(res);
  },
  async softDelete(id: string) {
    const res = await fetch(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return handle<{ ok: true }>(res);
  },
  async activate(id: string) {
    const res = await fetch(`${BASE}/${encodeURIComponent(id)}/activate`, { method: 'POST' });
    return handle<MappingVersion>(res);
  },
  async test(id: string, eventName: string, params: Record<string, unknown> = {}) {
    const res = await fetch(`${BASE}/${encodeURIComponent(id)}/test`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ eventName, params }),
    });
    return handle<{ results: Record<MappingProviderKind, { wouldDispatch: boolean; mappedName: string | null; isCustom: boolean; skipReason: string | null }> }>(res);
  },
  async exportGtm(id: string, env: 'production' | 'stage' | 'preview' | 'dev' = 'production') {
    const res = await fetch(`${BASE}/${encodeURIComponent(id)}/export-gtm`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ env }),
    });
    return handle<{ containerJson: object; meta: { sha256: string; eventsCount: number; tagsCount: number; env: string } }>(res);
  },
  async resetToDefault() {
    const res = await fetch(`${BASE}/reset-default`, { method: 'POST' });
    return handle<MappingVersion>(res);
  },
  async diff(a: string, b: string) {
    const res = await fetch(`${BASE}/${encodeURIComponent(a)}/diff/${encodeURIComponent(b)}`);
    return handle<{ added: unknown[]; removed: unknown[]; changed: unknown[] }>(res);
  },
};
