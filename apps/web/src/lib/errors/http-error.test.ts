import { describe, it, expect } from 'vitest';
import { HttpError, formatErrorResponse } from './http-error';

describe('HttpError', () => {
  it('mappe les codes vers les bons statuts HTTP', () => {
    expect(new HttpError('unauthorized', 'x').status).toBe(401);
    expect(new HttpError('forbidden', 'x').status).toBe(403);
    expect(new HttpError('not_found', 'x').status).toBe(404);
    expect(new HttpError('invalid_input', 'x').status).toBe(400);
    expect(new HttpError('invalid_state', 'x').status).toBe(409);
    expect(new HttpError('rate_limited', 'x').status).toBe(429);
    expect(new HttpError('upstream_failed', 'x').status).toBe(502);
    expect(new HttpError('internal_error', 'x').status).toBe(500);
  });

  it('expose details', () => {
    const err = new HttpError('invalid_input', 'oops', { field: 'email' });
    expect(err.details).toEqual({ field: 'email' });
  });
});

describe('formatErrorResponse', () => {
  it('formate une HttpError', () => {
    const out = formatErrorResponse(new HttpError('not_found', 'absent'));
    expect(out.status).toBe(404);
    expect(out.body.error.code).toBe('not_found');
    expect(out.body.error.message).toBe('absent');
  });

  it('mappe les erreurs inconnues en 500 internal_error', () => {
    const out = formatErrorResponse(new Error('boom'));
    expect(out.status).toBe(500);
    expect(out.body.error.code).toBe('internal_error');
  });
});
