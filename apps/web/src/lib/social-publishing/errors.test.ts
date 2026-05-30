/**
 * Errors tests — F18 / F19 / F42 / F43.
 *
 * Table-driven mapping HTTP code → app code + redaction + isRetryableCode +
 * toPublishFailure normalization.
 */
import { describe, expect, it } from 'vitest';
import {
  errorFromHttpStatus,
  isRetryableCode,
  redactProviderPayload,
  SocialPublishingError,
  toPublishFailure,
} from './errors';
import type { SocialPublishErrorCode } from './contracts';

describe('social publishing errors', () => {
  describe('errorFromHttpStatus mapping', () => {
    it('401 → token_expired', () => {
      expect(errorFromHttpStatus(401).code).toBe('token_expired');
    });

    it('403 → permission_denied', () => {
      expect(errorFromHttpStatus(403).code).toBe('permission_denied');
    });

    it('408 → provider_rate_limited (treated as transient)', () => {
      expect(errorFromHttpStatus(408).code).toBe('provider_rate_limited');
    });

    it('425 → provider_rate_limited', () => {
      expect(errorFromHttpStatus(425).code).toBe('provider_rate_limited');
    });

    it('429 → provider_rate_limited', () => {
      expect(errorFromHttpStatus(429).code).toBe('provider_rate_limited');
    });

    it('409 → duplicate_external_post', () => {
      expect(errorFromHttpStatus(409).code).toBe('duplicate_external_post');
    });

    it('500 → provider_unavailable', () => {
      expect(errorFromHttpStatus(500).code).toBe('provider_unavailable');
    });

    it('502 → provider_unavailable', () => {
      expect(errorFromHttpStatus(502).code).toBe('provider_unavailable');
    });

    it('503 → provider_unavailable', () => {
      expect(errorFromHttpStatus(503).code).toBe('provider_unavailable');
    });

    it('400 → unknown_provider_error (unmapped 4xx)', () => {
      expect(errorFromHttpStatus(400).code).toBe('unknown_provider_error');
    });

    it('uses custom message when provided', () => {
      const err = errorFromHttpStatus(401, 'Custom auth message');
      expect(err.message).toBe('Custom auth message');
    });

    it('falls back to default message', () => {
      const err = errorFromHttpStatus(401);
      expect(err.message).toBe('Social token expired');
    });

    it('preserves HTTP status code on error', () => {
      const err = errorFromHttpStatus(429);
      expect(err.status).toBe(429);
    });
  });

  describe('isRetryableCode', () => {
    it.each<SocialPublishErrorCode>(['provider_rate_limited', 'provider_unavailable'])(
      '%s est retryable',
      (code) => {
        expect(isRetryableCode(code)).toBe(true);
      },
    );

    it.each<SocialPublishErrorCode>([
      'token_expired',
      'permission_denied',
      'media_not_public',
      'unsupported_format',
      'invalid_request',
      'duplicate_external_post',
      'unknown_provider_error',
    ])('%s n est PAS retryable', (code) => {
      expect(isRetryableCode(code)).toBe(false);
    });
  });

  describe('redactProviderPayload', () => {
    it('redacte les clés sensibles top-level', () => {
      expect(redactProviderPayload({ token: 'x', name: 'ok' })).toEqual({
        token: '[redacted]',
        name: 'ok',
      });
    });

    it('redacte récursivement', () => {
      expect(
        redactProviderPayload({ token: 'x', nested: { access_token: 'y', ok: true } }),
      ).toEqual({
        token: '[redacted]',
        nested: { access_token: '[redacted]', ok: true },
      });
    });

    it('redacte plusieurs patterns (token, secret, password, authorization, api_key, access_key, refresh)', () => {
      expect(
        redactProviderPayload({
          authorization: 'a',
          secret: 'b',
          password: 'c',
          api_key: 'd',
          'access-key': 'e',
          refresh_token: 'f',
          public_name: 'g',
        }),
      ).toEqual({
        authorization: '[redacted]',
        secret: '[redacted]',
        password: '[redacted]',
        api_key: '[redacted]',
        'access-key': '[redacted]',
        refresh_token: '[redacted]',
        public_name: 'g',
      });
    });

    it('redacte dans les arrays', () => {
      expect(redactProviderPayload([{ token: 'x' }, { ok: true }])).toEqual([
        { token: '[redacted]' },
        { ok: true },
      ]);
    });

    it('laisse passer primitives', () => {
      expect(redactProviderPayload('hello')).toBe('hello');
      expect(redactProviderPayload(42)).toBe(42);
      expect(redactProviderPayload(null)).toBe(null);
      expect(redactProviderPayload(undefined)).toBe(undefined);
    });
  });

  describe('toPublishFailure', () => {
    it('normalise une SocialPublishingError en failure', () => {
      const failure = toPublishFailure(
        new SocialPublishingError({ code: 'permission_denied', message: 'No scope' }),
      );
      expect(failure).toMatchObject({
        ok: false,
        error: { code: 'permission_denied', retryable: false },
      });
    });

    it('preserve status + details', () => {
      const failure = toPublishFailure(
        new SocialPublishingError({
          code: 'token_expired',
          message: 'expired',
          status: 401,
          details: { hint: 'reconnect' },
        }),
      );
      expect(failure.error.status).toBe(401);
      expect(failure.error.details).toEqual({ hint: 'reconnect' });
    });

    it('wrap une Error générique en unknown_provider_error', () => {
      const failure = toPublishFailure(new Error('boom'));
      expect(failure.error.code).toBe('unknown_provider_error');
      expect(failure.error.message).toBe('boom');
      expect(failure.error.retryable).toBe(false);
    });

    it('wrap une valeur non-error', () => {
      const failure = toPublishFailure('plain string');
      expect(failure.error.code).toBe('unknown_provider_error');
      expect(failure.error.message).toBe('Unknown social publishing error');
    });

    it('explicit retryable overrides default', () => {
      const failure = toPublishFailure(
        new SocialPublishingError({
          code: 'provider_rate_limited',
          message: 'x',
          retryable: false,
        }),
      );
      expect(failure.error.retryable).toBe(false);
    });

    it('SocialPublishingError use isRetryableCode by default', () => {
      const err = new SocialPublishingError({
        code: 'provider_rate_limited',
        message: 'rate',
      });
      expect(err.retryable).toBe(true);
    });

    it('SocialPublishingError use isRetryableCode for non-retryable codes', () => {
      const err = new SocialPublishingError({ code: 'token_expired', message: 'x' });
      expect(err.retryable).toBe(false);
    });
  });
});
