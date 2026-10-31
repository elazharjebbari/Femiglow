/**
 * Client HTTP des routes « médias par audience »
 * (`/api/admin/components/[key]/media-sets/**`).
 *
 * Même origine (les mutations exigent `requireSameOrigin`) : `fetch`
 * relatif, cookies de session inclus. Les erreurs `{ error: { code,
 * message, details } }` deviennent des `MediaSetApiError` typées :
 *  - 409 `version_conflict` → `details.current` (état serveur) ;
 *  - 422 `validation_failed` → `details.issues` ;
 *  - 400 `invalid_input` → `details.fieldErrors` (zod flatten).
 *
 * cf. docs/hero-media-par-angle/05-architecture-technique.md §4.7
 */
import type {
  AdminMediaSetJson,
  BulkPublishDryRunResponse,
  BulkPublishFilter,
  BulkPublishResponse,
  MediaSetDraftPayload,
  MediaSetHistoryResponse,
  MediaSetIssueJson,
  MediaSetResolveResponse,
  MediaSetsListResponse,
  MediaSetTuple,
} from './types';

export class MediaSetApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'MediaSetApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** Raison métier d'un 409 `invalid_state` (`bulk.plan_changed`…). */
  get reason(): string | null {
    const d = this.details as { reason?: unknown } | null | undefined;
    return d && typeof d.reason === 'string' ? d.reason : null;
  }

  get isConflict(): boolean {
    return this.status === 409 && this.code === 'version_conflict';
  }

  /** Problèmes de validation (422 métier ou 400 de forme), à afficher en ligne. */
  get issues(): MediaSetIssueJson[] {
    const d = this.details as
      | { issues?: MediaSetIssueJson[]; fieldErrors?: Record<string, string[]>; formErrors?: string[] }
      | null
      | undefined;
    if (!d || typeof d !== 'object') return [];
    if (Array.isArray(d.issues)) return d.issues;
    const out: MediaSetIssueJson[] = [];
    for (const msg of d.formErrors ?? []) out.push({ code: 'invalid_input', path: [], message: msg });
    for (const [field, msgs] of Object.entries(d.fieldErrors ?? {})) {
      for (const msg of msgs) out.push({ code: 'invalid_input', path: [field], message: msg });
    }
    return out;
  }

  /** État serveur renvoyé avec un 409 `version_conflict`. */
  get remote(): { current: AdminMediaSetJson | null; remoteUpdatedAt: string | null } {
    const d = (this.details ?? {}) as {
      current?: AdminMediaSetJson | null;
      remoteUpdatedAt?: string | null;
    };
    return { current: d.current ?? null, remoteUpdatedAt: d.remoteUpdatedAt ?? null };
  }
}

async function request<T>(
  url: string,
  init: RequestInit & { ifMatch?: string | null; ifNoneMatchAny?: boolean } = {},
): Promise<T> {
  const { ifMatch, ifNoneMatchAny, headers, ...rest } = init;
  const h = new Headers(headers);
  if (rest.body !== undefined) h.set('content-type', 'application/json');
  if (ifMatch) h.set('if-match', ifMatch);
  else if (ifNoneMatchAny) h.set('if-none-match', '*');
  let res: Response;
  try {
    res = await fetch(url, { credentials: 'same-origin', ...rest, headers: h });
  } catch {
    throw new MediaSetApiError(0, 'network_error', 'Connexion impossible. Vérifiez le réseau puis réessayez.');
  }
  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }
  if (!res.ok) {
    const err = (json as { error?: { code?: string; message?: string; details?: unknown } } | null)
      ?.error;
    throw new MediaSetApiError(
      res.status,
      err?.code ?? 'http_error',
      err?.message ?? `Erreur ${res.status}`,
      err?.details,
    );
  }
  return json as T;
}

function tupleQuery(tuple: MediaSetTuple): string {
  return new URLSearchParams({
    slot: tuple.slot,
    variantDim: tuple.variantDim,
    variantKey: tuple.variantKey,
    locale: tuple.locale,
  }).toString();
}

export interface MediaSetsApi {
  list(): Promise<MediaSetsListResponse>;
  saveDraft(payload: MediaSetDraftPayload, ifMatch: string | null): Promise<{ set: AdminMediaSetJson }>;
  publish(setId: string, ifMatch: string | null): Promise<{ set: AdminMediaSetJson }>;
  schedule(setId: string, scheduledAt: string, ifMatch: string | null): Promise<{ set: AdminMediaSetJson }>;
  cancelSchedule(setId: string, ifMatch: string | null): Promise<{ set: AdminMediaSetJson }>;
  unpublish(setId: string, ifMatch: string | null): Promise<{ set: AdminMediaSetJson }>;
  discard(setId: string, ifMatch: string | null): Promise<{ set: AdminMediaSetJson }>;
  history(tuple: MediaSetTuple, limit?: number): Promise<MediaSetHistoryResponse>;
  restore(historyId: string, ifMatch: string | null): Promise<{ set: AdminMediaSetJson; restoredFromVersion: number }>;
  bulkPublishDryRun(filter: BulkPublishFilter): Promise<BulkPublishDryRunResponse>;
  /** `expected` : plan revu de l'essai à blanc (409 `bulk.plan_changed` s'il a changé). */
  bulkPublish(
    filter: BulkPublishFilter,
    expected: Array<{ setId: string; updatedAt: string }>,
  ): Promise<BulkPublishResponse>;
  resolve(params: { locale: string; variants: Record<string, string>; draft: boolean }): Promise<MediaSetResolveResponse>;
}

export function mediaSetsApi(componentKey: string): MediaSetsApi {
  const base = `/api/admin/components/${encodeURIComponent(componentKey)}/media-sets`;
  const setUrl = (setId: string, action?: string) =>
    `${base}/${encodeURIComponent(setId)}${action ? `/${action}` : ''}`;
  const post = <T>(url: string, body: unknown, ifMatch: string | null) =>
    request<T>(url, { method: 'POST', body: JSON.stringify(body), ifMatch });

  return {
    list: () => request<MediaSetsListResponse>(base, { cache: 'no-store' }),
    // Sans brouillon connu : `If-None-Match: *` (409 si un brouillon est apparu).
    saveDraft: (payload, ifMatch) =>
      request(`${base}/draft`, {
        method: 'PUT',
        body: JSON.stringify(payload),
        ifMatch,
        ifNoneMatchAny: !ifMatch,
      }),
    publish: (setId, ifMatch) => post(setUrl(setId, 'publish'), {}, ifMatch),
    schedule: (setId, scheduledAt, ifMatch) =>
      post(setUrl(setId, 'schedule'), { scheduledAt }, ifMatch),
    cancelSchedule: (setId, ifMatch) => post(setUrl(setId, 'cancel-schedule'), {}, ifMatch),
    unpublish: (setId, ifMatch) => post(setUrl(setId, 'unpublish'), {}, ifMatch),
    discard: (setId, ifMatch) =>
      request(setUrl(setId), { method: 'DELETE', body: JSON.stringify({}), ifMatch }),
    history: (tuple, limit = 20) =>
      request(`${base}/history?${tupleQuery(tuple)}&limit=${limit}`, { cache: 'no-store' }),
    restore: (historyId, ifMatch) =>
      request(`${base}/restore`, {
        method: 'POST',
        body: JSON.stringify({ historyId }),
        ifMatch,
        ifNoneMatchAny: !ifMatch,
      }),
    bulkPublishDryRun: (filter) => post(`${base}/bulk-publish`, { filter, dryRun: true }, null),
    bulkPublish: (filter, expected) =>
      post(`${base}/bulk-publish`, { filter, dryRun: false, expected }, null),
    resolve: ({ locale, variants, draft }) => {
      const qs = new URLSearchParams({ locale });
      for (const [dim, key] of Object.entries(variants)) qs.set(dim, key);
      if (draft) qs.set('draft', '1');
      return request(`${base}/resolve?${qs.toString()}`, { cache: 'no-store' });
    },
  };
}
