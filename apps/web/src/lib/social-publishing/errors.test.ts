import { describe, expect, it } from 'vitest';
import { errorFromHttpStatus, redactProviderPayload, SocialPublishingError, toPublishFailure } from './errors';

describe('social publishing errors', () => {
  it('mappe les statuts HTTP provider', () => {
    expect(errorFromHttpStatus(401).code).toBe('token_expired');
    expect(errorFromHttpStatus(403).code).toBe('permission_denied');
    expect(errorFromHttpStatus(429).code).toBe('provider_rate_limited');
    expect(errorFromHttpStatus(503).code).toBe('provider_unavailable');
  });

  it('redacte les secrets récursivement', () => {
    expect(redactProviderPayload({ token: 'x', nested: { access_token: 'y', ok: true } })).toEqual({
      token: '[redacted]',
      nested: { access_token: '[redacted]', ok: true },
    });
  });

  it('normalise une SocialPublishingError en failure', () => {
    const failure = toPublishFailure(new SocialPublishingError({ code: 'permission_denied', message: 'No scope' }));
    expect(failure).toMatchObject({ ok: false, error: { code: 'permission_denied', retryable: false } });
  });
});
