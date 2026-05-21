import type { SocialPublishErrorCode, SocialPublishFailure } from './contracts';

const SENSITIVE_KEY_PATTERN = /token|secret|password|authorization|api[-_]?key|access[-_]?key|refresh/i;

export class SocialPublishingError extends Error {
  readonly code: SocialPublishErrorCode;
  readonly retryable: boolean;
  readonly status?: number;
  readonly details?: unknown;

  constructor(input: {
    code: SocialPublishErrorCode;
    message: string;
    retryable?: boolean;
    status?: number;
    details?: unknown;
  }) {
    super(input.message);
    this.name = 'SocialPublishingError';
    this.code = input.code;
    this.retryable = input.retryable ?? isRetryableCode(input.code);
    this.status = input.status;
    this.details = input.details;
  }
}

export function isRetryableCode(code: SocialPublishErrorCode): boolean {
  return code === 'provider_rate_limited' || code === 'provider_unavailable';
}

export function toPublishFailure(err: unknown): SocialPublishFailure {
  if (err instanceof SocialPublishingError) {
    return {
      ok: false,
      status: 'failed',
      error: {
        code: err.code,
        message: err.message,
        retryable: err.retryable,
        status: err.status,
        details: err.details,
      },
    };
  }
  return {
    ok: false,
    status: 'failed',
    error: {
      code: 'unknown_provider_error',
      message: err instanceof Error ? err.message : 'Unknown social publishing error',
      retryable: false,
    },
  };
}

export function redactProviderPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => redactProviderPayload(item));
  if (!value || typeof value !== 'object') return value;

  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    output[key] = SENSITIVE_KEY_PATTERN.test(key) ? '[redacted]' : redactProviderPayload(child);
  }
  return output;
}

export function errorFromHttpStatus(status: number, message?: string): SocialPublishingError {
  if (status === 401) {
    return new SocialPublishingError({ code: 'token_expired', message: message ?? 'Social token expired', status });
  }
  if (status === 403) {
    return new SocialPublishingError({ code: 'permission_denied', message: message ?? 'Permission denied by provider', status });
  }
  if (status === 408 || status === 425 || status === 429) {
    return new SocialPublishingError({ code: 'provider_rate_limited', message: message ?? 'Provider rate limited the request', status });
  }
  if (status === 409) {
    return new SocialPublishingError({ code: 'duplicate_external_post', message: message ?? 'Provider rejected the request as a duplicate', status });
  }
  if (status >= 500) {
    return new SocialPublishingError({ code: 'provider_unavailable', message: message ?? 'Provider unavailable', status });
  }
  return new SocialPublishingError({ code: 'unknown_provider_error', message: message ?? `Provider returned HTTP ${status}`, status });
}
