/**
 * Typed HTTP client for Listmonk's admin API.
 *
 * All calls go to LISTMONK_INTERNAL_URL (loopback). Auth is Basic
 * (LISTMONK_API_USER:LISTMONK_API_TOKEN).
 *
 * Résilience (R-014) : Listmonk est sur la loopback mais peut se figer
 * (verrou DB, import en cours, redémarrage). Sans garde, un cron ou l'UI
 * suspendrait indéfiniment. Le transport applique donc :
 *   - un **timeout par requête** (`AbortSignal.timeout`, LISTMONK_TIMEOUT_MS) —
 *     un hang déterministe en `ListmonkTimeoutError` plutôt qu'un blocage infini ;
 *   - un **retry borné** (LISTMONK_MAX_RETRIES) avec backoff court sur les
 *     erreurs *transitoires* uniquement (5xx, réseau, timeout). PAS de retry sur
 *     4xx (auth/validation = erreur déterministe, inutile de réessayer) ;
 *   - le respect de `Retry-After` sur **429**.
 *
 * Cf. docs/emailing/03-backend-integration.md §7
 *     https://listmonk.app/docs/apis/apis/
 */
import 'server-only';
import { env } from '@/lib/env';

/**
 * Délai max par requête avant abort (ms). Exporté comme constante pour que les
 * tests (et le code appelant) raisonnent sur la même borne. Un Listmonk loopback
 * sain répond en quelques ms ; 10 s laisse de la marge à un import lourd tout en
 * garantissant qu'un hang ne suspend pas un cron/une page.
 */
export const LISTMONK_TIMEOUT_MS = 10_000;

/**
 * Nombre de *retries* (tentatives supplémentaires) sur erreur transitoire.
 * Borne basse délibérée : Listmonk est local, on veut absorber un blip
 * (redémarrage, verrou bref) sans amplifier une panne durable.
 */
export const LISTMONK_MAX_RETRIES = 2;

/** Base du backoff exponentiel (ms) : 100ms, 200ms, … (+ jitter). */
export const LISTMONK_RETRY_BASE_MS = 100;

/** Plafond d'attente honorée sur un `Retry-After` (ms) — anti-DoS du cron. */
export const LISTMONK_RETRY_AFTER_CAP_MS = 5_000;

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

/**
 * Levée quand une requête dépasse `LISTMONK_TIMEOUT_MS` (abort interne) ou
 * échoue au niveau réseau de façon répétée. Type dédié pour que l'appelant
 * (cron) distingue « Listmonk lent/injoignable » d'une erreur HTTP métier.
 */
export class ListmonkTimeoutError extends Error {
  readonly code = 'LISTMONK_TIMEOUT';
  constructor(public path: string, cause?: unknown) {
    super(`Listmonk request timed out/unreachable on ${path}`, { cause });
    this.name = 'ListmonkTimeoutError';
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

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Backoff exponentiel + jitter (±50%) pour la n-ième retry (0-based). */
function backoffMs(attempt: number): number {
  const base = LISTMONK_RETRY_BASE_MS * 2 ** attempt;
  const jitter = base * (Math.random() - 0.5); // ±50%
  return Math.max(0, Math.round(base + jitter));
}

/** Parse `Retry-After` (secondes ou date HTTP) → ms, plafonné. */
function retryAfterMs(header: string | null): number {
  if (!header) return 0;
  const asNum = Number(header);
  let ms: number;
  if (Number.isFinite(asNum)) {
    ms = asNum * 1000;
  } else {
    const when = Date.parse(header);
    ms = Number.isNaN(when) ? 0 : when - Date.now();
  }
  return Math.min(Math.max(0, ms), LISTMONK_RETRY_AFTER_CAP_MS);
}

/** `true` si l'erreur fetch correspond à un abort de timeout. */
function isAbortError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === 'AbortError' || err.name === 'TimeoutError')
  );
}

async function lm<T>(
  path: string,
  init: { method?: string; body?: unknown; query?: Record<string, string | number> } = {},
): Promise<T> {
  // authHeader() peut lever ListmonkConfigError — AVANT toute requête réseau et
  // sans retry : un défaut de config n'est pas transitoire.
  const authorization = authHeader();
  const url = new URL(`${env.LISTMONK_INTERNAL_URL}${path}`);
  if (init.query) {
    for (const [k, v] of Object.entries(init.query)) {
      url.searchParams.set(k, String(v));
    }
  }
  const method = init.method ?? 'GET';
  const requestInit: RequestInit = {
    method,
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  };

  let lastTransient: unknown;
  // total attempts = 1 (initial) + LISTMONK_MAX_RETRIES
  for (let attempt = 0; attempt <= LISTMONK_MAX_RETRIES; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        ...requestInit,
        // AbortSignal.timeout() arme un abort déterministe : un Listmonk figé
        // (delay infini) rejette en ~timeout au lieu de suspendre le cron.
        signal: AbortSignal.timeout(LISTMONK_TIMEOUT_MS),
      });
    } catch (err) {
      // Réseau KO ou abort de timeout → transitoire : on retente (borné).
      lastTransient = err;
      if (attempt < LISTMONK_MAX_RETRIES) {
        await sleep(backoffMs(attempt));
        continue;
      }
      throw new ListmonkTimeoutError(path, err);
    }

    if (res.ok) {
      return (await res.json()) as T;
    }

    // 429 : back-pressure explicite → respecter Retry-After puis retenter.
    if (res.status === 429 && attempt < LISTMONK_MAX_RETRIES) {
      const wait = retryAfterMs(res.headers.get('retry-after')) || backoffMs(attempt);
      await sleep(wait);
      continue;
    }

    // 5xx : panne serveur transitoire → retenter (borné).
    if (res.status >= 500 && attempt < LISTMONK_MAX_RETRIES) {
      lastTransient = res.status;
      await sleep(backoffMs(attempt));
      continue;
    }

    // 4xx (hors 429 épuisé) ou erreur transitoire épuisée → erreur typée, pas de retry.
    const text = await res.text().catch(() => '');
    throw new ListmonkApiError(res.status, path, text);
  }

  // Inatteignable en théorie (la boucle throw/return), garde-fou de typage.
  throw new ListmonkTimeoutError(path, lastTransient);
}

export { isAbortError as __isAbortError };

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
    list: (q?: { list_id?: number; query?: string; per_page?: number; page?: number }) =>
      lm<ListmonkResponse<{ results: Subscriber[]; total: number }>>('/api/subscribers', {
        query: { ...(q ?? {}), per_page: q?.per_page ?? 50 } as Record<string, string | number>,
      }),
    /**
     * Pagination COMPLÈTE (L-PAGE) : itère `page`/`per_page` jusqu'à épuiser
     * `total`. Remplace l'ancien cap silencieux à 50 — un `list()` brut ne
     * ramenait que la 1re page, tronquant tout au-delà de `per_page` (fuite de
     * destinataires sur une grosse liste). Retourne TOUS les abonnés.
     */
    listAll: async (
      q?: { list_id?: number; query?: string; per_page?: number },
    ): Promise<Subscriber[]> => {
      const perPage = q?.per_page ?? 100;
      const all: Subscriber[] = [];
      for (let page = 1; ; page++) {
        const res = await lm<ListmonkResponse<{ results: Subscriber[]; total: number }>>(
          '/api/subscribers',
          {
            query: {
              ...(q?.list_id != null ? { list_id: q.list_id } : {}),
              ...(q?.query != null ? { query: q.query } : {}),
              per_page: perPage,
              page,
            } as Record<string, string | number>,
          },
        );
        const { results, total } = res.data;
        all.push(...results);
        // Arrêt : page vide (sécurité anti-boucle) OU total atteint.
        if (results.length === 0 || all.length >= total) break;
      }
      return all;
    },
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
