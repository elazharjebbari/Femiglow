/**
 * Client HTTP pour /api/admin/tracking/plans/* — utilisable côté client
 * et côté server (Server Components / Server Actions).
 *
 * - Erreurs typées : ApiError contient code/status/details.
 * - PATCH gère automatiquement le header If-Match (optimistic concurrency).
 */
import type {
  AuditEntry,
  EnvName,
  ExportResult,
  TrackingPlan,
  TrackingPlanInput,
  ValidationResult,
} from '../types';
import type { ChangeSet } from '../differ';

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;
  constructor(status: number, body: ApiErrorBody) {
    super(body.error.message);
    this.name = 'ApiError';
    this.code = body.error.code;
    this.status = status;
    this.details = body.error.details;
  }
}

async function parse<T>(res: Response): Promise<T> {
  if (res.ok) return (await res.json()) as T;
  let body: ApiErrorBody;
  try {
    body = (await res.json()) as ApiErrorBody;
  } catch {
    throw new ApiError(res.status, {
      error: { code: 'internal_error', message: 'Erreur inattendue' },
    });
  }
  throw new ApiError(res.status, body);
}

const BASE = '/api/admin/tracking/plans';

export const trackingPlanApi = {
  async list(filter: { status?: string; search?: string } = {}): Promise<{
    data: TrackingPlan[];
    total: number;
  }> {
    const params = new URLSearchParams();
    if (filter.status) params.set('status', filter.status);
    if (filter.search) params.set('search', filter.search);
    const qs = params.toString();
    const res = await fetch(`${BASE}${qs ? `?${qs}` : ''}`, { cache: 'no-store' });
    return parse(res);
  },

  async get(id: string): Promise<TrackingPlan> {
    const res = await fetch(`${BASE}/${id}`, { cache: 'no-store' });
    return parse(res);
  },

  async create(input: TrackingPlanInput): Promise<TrackingPlan> {
    const res = await fetch(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return parse(res);
  },

  async seedDefault(options: { name?: string; includeServerOnly?: boolean } = {}): Promise<TrackingPlan> {
    const res = await fetch(`${BASE}/seed-default`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    });
    return parse(res);
  },

  async update(
    id: string,
    patch: Partial<TrackingPlanInput>,
    expectedVersion: number,
  ): Promise<TrackingPlan> {
    const res = await fetch(`${BASE}/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'If-Match': String(expectedVersion),
      },
      body: JSON.stringify(patch),
    });
    return parse(res);
  },

  async activate(id: string): Promise<TrackingPlan> {
    const res = await fetch(`${BASE}/${id}/activate`, { method: 'POST' });
    return parse(res);
  },

  async archive(id: string): Promise<TrackingPlan> {
    const res = await fetch(`${BASE}/${id}/archive`, { method: 'POST' });
    return parse(res);
  },

  async delete(id: string): Promise<void> {
    const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      let body: ApiErrorBody;
      try {
        body = (await res.json()) as ApiErrorBody;
      } catch {
        throw new ApiError(res.status, {
          error: { code: 'internal_error', message: 'Erreur inattendue' },
        });
      }
      throw new ApiError(res.status, body);
    }
  },

  async restore(id: string): Promise<TrackingPlan> {
    const res = await fetch(`${BASE}/${id}/restore`, { method: 'POST' });
    return parse(res);
  },

  async validate(id: string): Promise<ValidationResult> {
    const res = await fetch(`${BASE}/${id}/validate`, { cache: 'no-store' });
    return parse(res);
  },

  async export(id: string, env: EnvName): Promise<ExportResult> {
    const res = await fetch(`${BASE}/${id}/export?env=${env}`, { cache: 'no-store' });
    return parse(res);
  },

  async audit(planId?: string): Promise<{ data: AuditEntry[]; total: number }> {
    const url = planId ? `${BASE}/audit?planId=${planId}` : `${BASE}/audit`;
    const res = await fetch(url, { cache: 'no-store' });
    return parse(res);
  },

  async defaults(): Promise<{ data: Record<string, string> }> {
    const res = await fetch(`${BASE}/defaults`, { cache: 'no-store' });
    return parse(res);
  },

  async diff(a: string, b: string): Promise<ChangeSet> {
    const res = await fetch(`${BASE}/diff?a=${a}&b=${b}`, { cache: 'no-store' });
    return parse(res);
  },
};
