/**
 * CHA-230 — Erreurs typées côté client wizard.
 *
 * Le serveur (`lib/checkout/api/response.ts`) renvoie systématiquement une
 * shape `{ error: { code, message, details? } }` ou `{ error: <string>,
 * issues: [...] }` (Zod). Ce module les convertit en classes JS pour
 * permettre du `instanceof` dans la couche state/UI :
 *
 *   ```ts
 *   try {
 *     await wizardClient.createLead(input);
 *   } catch (e) {
 *     if (e instanceof IdempotencyConflictApiError) { ... }
 *     if (e instanceof ValidationApiError) { ... }
 *   }
 *   ```
 *
 * Avantages :
 *   - typage strict des codes (`'price_mismatch' | 'stock_insufficient' | …`)
 *   - granularité fine (un type par scénario UX, ex. stock_out déclenche un
 *     waitlist modal, price_mismatch déclenche un refresh prix)
 *   - retry logic possible via `isRetryableApiError(e)`
 */

/** Codes serveur connus (cf. response.ts CheckoutErrorCode). */
export type ApiErrorCode =
  | 'invalid_json'
  | 'invalid_input'
  | 'invalid_state'
  | 'not_found'
  | 'price_mismatch'
  | 'stock_insufficient'
  | 'idempotency_conflict'
  | 'idempotency_invalid_key'
  | 'rate_limited'
  | 'db_unavailable'
  | 'internal_error';

export class ApiError extends Error {
  readonly code: ApiErrorCode | 'unknown';
  readonly httpStatus: number;
  readonly details: unknown;

  constructor(
    code: ApiErrorCode | 'unknown',
    message: string,
    httpStatus: number,
    details: unknown = null,
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
  }
}

export class ValidationApiError extends ApiError {
  /** Issues Zod plates (`{path, message}[]`). */
  readonly issues: Array<{ path: string; message: string }>;
  constructor(
    message: string,
    httpStatus: number,
    issues: Array<{ path: string; message: string }>,
  ) {
    super('invalid_input', message, httpStatus, issues);
    this.name = 'ValidationApiError';
    this.issues = issues;
  }
}

export class PriceMismatchApiError extends ApiError {
  constructor(message: string, details: unknown) {
    super('price_mismatch', message, 422, details);
    this.name = 'PriceMismatchApiError';
  }
}

export class StockInsufficientApiError extends ApiError {
  /** Détails serveur : `{ shortages: [{sku, available, requested}] }` ou similaire. */
  constructor(message: string, details: unknown) {
    super('stock_insufficient', message, 409, details);
    this.name = 'StockInsufficientApiError';
  }
}

export class IdempotencyConflictApiError extends ApiError {
  constructor(message = 'Conflit d\'idempotence.') {
    super('idempotency_conflict', message, 409);
    this.name = 'IdempotencyConflictApiError';
  }
}

export class NotFoundApiError extends ApiError {
  constructor(message: string) {
    super('not_found', message, 404);
    this.name = 'NotFoundApiError';
  }
}

export class InvalidStateApiError extends ApiError {
  constructor(message: string) {
    super('invalid_state', message, 409);
    this.name = 'InvalidStateApiError';
  }
}

export class NetworkApiError extends ApiError {
  constructor(cause?: unknown) {
    super(
      'internal_error',
      'Connexion impossible. Vérifiez votre réseau.',
      0,
      cause,
    );
    this.name = 'NetworkApiError';
  }
}

/**
 * Convertit une réponse HTTP en erreur typée. Tente plusieurs shapes :
 *   - `{ error: { code, message, details } }`  (idiomatic)
 *   - `{ error: <string>, issues: [...] }`     (Zod validation)
 *   - `{ error: <string>, message: string }`   (legacy)
 */
export async function parseApiError(res: Response): Promise<ApiError> {
  const status = res.status;
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    return new ApiError('unknown', `HTTP ${status}`, status);
  }

  // Shape 1 — `{ error: { code, message, details } }`
  if (
    body &&
    typeof body === 'object' &&
    'error' in body &&
    typeof (body as { error: unknown }).error === 'object' &&
    (body as { error: { code?: unknown } }).error !== null
  ) {
    const err = (body as { error: { code?: string; message?: string; details?: unknown } })
      .error;
    const code = (err.code as ApiErrorCode) ?? 'unknown';
    const message = err.message ?? `HTTP ${status}`;
    switch (code) {
      case 'price_mismatch':
        return new PriceMismatchApiError(message, err.details);
      case 'stock_insufficient':
        return new StockInsufficientApiError(message, err.details);
      case 'idempotency_conflict':
        return new IdempotencyConflictApiError(message);
      case 'not_found':
        return new NotFoundApiError(message);
      case 'invalid_state':
        return new InvalidStateApiError(message);
      case 'invalid_input':
        return new ValidationApiError(
          message,
          status,
          Array.isArray(err.details) ? (err.details as Array<{ path: string; message: string }>) : [],
        );
      default:
        return new ApiError(code, message, status, err.details);
    }
  }

  // Shape 2 — `{ error: 'invalid-input', issues: [...] }`
  if (
    body &&
    typeof body === 'object' &&
    'error' in body &&
    typeof (body as { error: unknown }).error === 'string'
  ) {
    const errorCode = (body as { error: string }).error;
    const issues = (body as { issues?: Array<{ path?: unknown; message?: unknown }> })
      .issues;
    if (errorCode === 'invalid-input' || errorCode === 'invalid_input') {
      const normalized = (issues ?? []).map((i) => ({
        path: typeof i.path === 'string' ? i.path : Array.isArray(i.path) ? (i.path as unknown[]).join('.') : '',
        message: typeof i.message === 'string' ? i.message : 'Champ invalide',
      }));
      return new ValidationApiError('Champs invalides.', status, normalized);
    }
    return new ApiError(
      (errorCode as ApiErrorCode) ?? 'unknown',
      (body as { message?: string }).message ?? `HTTP ${status}`,
      status,
    );
  }

  return new ApiError('unknown', `HTTP ${status}`, status, body);
}

/**
 * Indique si une erreur est retryable côté client (idempotency-key réutilisable).
 *
 *  - Network / 5xx : oui (transient)
 *  - 4xx (sauf 409 idempotency_conflict) : non (le payload est en cause)
 */
export function isRetryableApiError(err: unknown): boolean {
  if (err instanceof NetworkApiError) return true;
  if (err instanceof ApiError) {
    if (err.code === 'db_unavailable') return true;
    if (err.httpStatus >= 500) return true;
    return false;
  }
  return false;
}
