export type ErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'invalid_input'
  | 'invalid_state'
  | 'rate_limited'
  | 'conflict'
  | 'upstream_failed'
  | 'internal_error'
  // Components-CMS
  | 'validation_failed'
  | 'version_conflict'
  | 'field_removed'
  | 'schedule_in_past'
  // Event mappings
  | 'cannot_edit_default'
  | 'cannot_delete_default'
  | 'cannot_delete_active'
  | 'version_deleted';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  invalid_input: 400,
  invalid_state: 409,
  rate_limited: 429,
  conflict: 409,
  upstream_failed: 502,
  internal_error: 500,
  validation_failed: 422,
  version_conflict: 409,
  field_removed: 409,
  schedule_in_past: 400,
  cannot_edit_default: 403,
  cannot_delete_default: 403,
  cannot_delete_active: 403,
  version_deleted: 409,
};

export class HttpError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
  }
}

export function formatErrorResponse(err: unknown): {
  status: number;
  body: { error: { code: ErrorCode; message: string; details?: unknown } };
} {
  if (err instanceof HttpError) {
    return {
      status: err.status,
      body: { error: { code: err.code, message: err.message, details: err.details } },
    };
  }
  return {
    status: 500,
    body: { error: { code: 'internal_error', message: 'Erreur interne' } },
  };
}
