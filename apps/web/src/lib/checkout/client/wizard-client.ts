/**
 * CHA-230 — Client HTTP du wizard (fetch wrappers typés).
 *
 * Centralise tous les appels `/api/checkout/*`. Chaque méthode :
 *   1. Génère ou récupère une `Idempotency-Key` adaptée au scope
 *   2. POSTe en JSON avec headers idiomatiques
 *   3. Parse la réponse en erreur typée (`api-errors.ts`) si HTTP != 2xx
 *   4. Retourne le body décodé (typé via les schemas Zod serveur)
 *
 * Pas de retry implicite ici — la couche state (`use-wizard-mutations.ts`)
 * gère le retry sur les erreurs `isRetryableApiError`. Garder ce module
 * pur facilite les tests et permet d'avoir des fetch fakes sans mocking
 * complexe.
 *
 * Pas de dépendance React : ce module est consommable depuis n'importe
 * quel contexte (hooks, server actions, scripts de migration, tests).
 */
import {
  ApiError,
  NetworkApiError,
  parseApiError,
  ValidationApiError,
} from '@/lib/checkout/client/api-errors';
import {
  consumeIdempotencyKey,
  getOrCreateIdempotencyKey,
  type IdempotencyScope,
} from '@/lib/checkout/client/idempotency-key';
import type { CreateLeadInput, CreateLeadResponse } from '@/lib/checkout/schemas/lead';
import type {
  PatchLeadAddressInput,
  PatchLeadAddressResponse,
  PatchLeadPaymentInput,
} from '@/lib/checkout/schemas/lead';
import type { CreateOrderInput, CreateOrderResponse } from '@/lib/checkout/schemas/order';
import type { OptInEmailInput, OptInEmailResponse } from '@/lib/checkout/schemas/lead';
import type { GetStockResponse } from '@/lib/checkout/schemas/stock';
import type { FormConfigJson } from '@/lib/checkout/form-config/schema';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface WizardClientOptions {
  /** Base URL (ex. '/api/checkout'). Vide par défaut → relative à origin. */
  baseUrl?: string;
  /** Fetch override (tests). */
  fetchImpl?: typeof fetch;
  /** AbortSignal optionnel pour annuler la requête (ex. unmount React). */
  signal?: AbortSignal;
}

const DEFAULT_BASE = '/api/checkout';

function resolveFetch(opts?: WizardClientOptions): typeof fetch {
  if (opts?.fetchImpl) return opts.fetchImpl;
  if (typeof globalThis.fetch !== 'undefined') return globalThis.fetch.bind(globalThis);
  throw new Error('fetch indisponible — fournir fetchImpl via WizardClientOptions.');
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper interne
// ─────────────────────────────────────────────────────────────────────────────

interface RequestOpts {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  idempotency?: {
    scope: IdempotencyScope;
    resourceId?: string | null;
    /** Si `true`, la clé est purgée après succès (mutation finalisée). */
    consumeOnSuccess?: boolean;
  };
  options?: WizardClientOptions;
}

async function request<T>(opts: RequestOpts, attempt = 0): Promise<T> {
  const fetchFn = resolveFetch(opts.options);
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

  let idemKey: string | null = null;
  if (opts.idempotency) {
    idemKey = getOrCreateIdempotencyKey(
      opts.idempotency.scope,
      opts.idempotency.resourceId ?? null,
    );
    headers['Idempotency-Key'] = idemKey;
  }

  const base = opts.options?.baseUrl ?? DEFAULT_BASE;
  const url = `${base}${opts.path}`;

  let res: Response;
  try {
    res = await fetchFn(url, {
      method: opts.method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.options?.signal,
      // Évite le cache navigateur pour les mutations (sans empêcher Next
      // de gérer ses propres caches côté server).
      cache: opts.method === 'GET' ? 'default' : 'no-store',
    });
  } catch (err) {
    throw new NetworkApiError(err);
  }

  if (!res.ok) {
    const apiErr = await parseApiError(res);
    // Si la clé idempotency a déjà été utilisée avec un payload DIFFÉRENT
    // (l'utilisateur a corrigé un champ et re-submit), on purge la clé
    // côté client et on retente UNE fois avec une clé fraîche. Sans cela,
    // l'utilisateur reste bloqué sur 409 jusqu'à fermer l'onglet.
    if (
      apiErr instanceof ApiError &&
      apiErr.code === 'idempotency_conflict' &&
      opts.idempotency &&
      attempt === 0
    ) {
      consumeIdempotencyKey(
        opts.idempotency.scope,
        opts.idempotency.resourceId ?? null,
      );
      return request<T>(opts, attempt + 1);
    }
    throw apiErr;
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new ApiError(
      'internal_error',
      'Réponse serveur invalide.',
      res.status,
    );
  }

  // Sur succès, on consomme la clé si la mutation est "finale" (le retry
  // n'a plus de sens sémantique — ex. order créé).
  if (opts.idempotency?.consumeOnSuccess && idemKey) {
    consumeIdempotencyKey(
      opts.idempotency.scope,
      opts.idempotency.resourceId ?? null,
    );
  }

  return body as T;
}

// ─────────────────────────────────────────────────────────────────────────────
// API publique du client
// ─────────────────────────────────────────────────────────────────────────────

export const wizardClient = {
  // ── Step 1 — POST /lead ────────────────────────────────────────────────
  async createLead(
    input: CreateLeadInput,
    options?: WizardClientOptions,
  ): Promise<CreateLeadResponse> {
    return request<CreateLeadResponse>({
      method: 'POST',
      path: '/lead',
      body: input,
      idempotency: {
        scope: 'lead_create',
        resourceId: null,
        // On NE consomme PAS la clé — si l'utilisateur recharge la page
        // et re-soumet, on veut le même leadId.
        consumeOnSuccess: false,
      },
      options,
    });
  },

  // ── Step 2 — PATCH /lead/[id]/address ─────────────────────────────────
  async patchAddress(
    leadId: string,
    input: PatchLeadAddressInput,
    options?: WizardClientOptions,
  ): Promise<PatchLeadAddressResponse> {
    return request<PatchLeadAddressResponse>({
      method: 'PATCH',
      path: `/lead/${encodeURIComponent(leadId)}/address`,
      body: input,
      idempotency: {
        scope: 'address_update',
        resourceId: leadId,
        consumeOnSuccess: false,
      },
      options,
    });
  },

  // ── Step 3 — PATCH /lead/[id]/payment ─────────────────────────────────
  async patchPayment(
    leadId: string,
    input: PatchLeadPaymentInput,
    options?: WizardClientOptions,
  ): Promise<{ leadId: string; status: 'payment_selected'; nextStep: 'thank_you' }> {
    return request<{ leadId: string; status: 'payment_selected'; nextStep: 'thank_you' }>({
      method: 'PATCH',
      path: `/lead/${encodeURIComponent(leadId)}/payment`,
      body: input,
      idempotency: {
        scope: 'payment_select',
        resourceId: leadId,
        consumeOnSuccess: false,
      },
      options,
    });
  },

  // ── Finalisation — POST /order ────────────────────────────────────────
  async createOrder(
    input: CreateOrderInput,
    options?: WizardClientOptions,
  ): Promise<CreateOrderResponse> {
    return request<CreateOrderResponse>({
      method: 'POST',
      path: '/order',
      body: input,
      idempotency: {
        scope: 'order_create',
        resourceId: input.leadId,
        // Une fois l'order créé, la clé n'est plus utile.
        consumeOnSuccess: true,
      },
      options,
    });
  },

  // ── Step 4 — PATCH /order/[id]/email ──────────────────────────────────
  async optInEmail(
    orderId: string,
    input: OptInEmailInput,
    options?: WizardClientOptions,
  ): Promise<OptInEmailResponse> {
    return request<OptInEmailResponse>({
      method: 'PATCH',
      path: `/order/${encodeURIComponent(orderId)}/email`,
      body: input,
      idempotency: {
        scope: 'email_optin',
        resourceId: orderId,
        consumeOnSuccess: true,
      },
      options,
    });
  },

  // ── Stock indicator — GET /stock/[id] ─────────────────────────────────
  async getStock(
    variantId: string,
    options?: WizardClientOptions,
  ): Promise<GetStockResponse> {
    return request<GetStockResponse>({
      method: 'GET',
      path: `/stock/${encodeURIComponent(variantId)}`,
      options,
    });
  },

  // ── Form config — GET /form-config/[key] ──────────────────────────────
  async getFormConfig(
    key: string,
    options?: WizardClientOptions,
  ): Promise<{ key: string; version: number; config: FormConfigJson; updatedAt: string }> {
    return request<{ key: string; version: number; config: FormConfigJson; updatedAt: string }>({
      method: 'GET',
      path: `/form-config/${encodeURIComponent(key)}`,
      options,
    });
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Re-exports utiles
// ─────────────────────────────────────────────────────────────────────────────

export { ApiError, NetworkApiError, ValidationApiError } from '@/lib/checkout/client/api-errors';
