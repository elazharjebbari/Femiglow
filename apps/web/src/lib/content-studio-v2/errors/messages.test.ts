import { describe, expect, it } from 'vitest';
import { formatError, ERROR_MESSAGES } from './messages';

describe('content-studio-v2/errors/messages', () => {
  it('maps known code to human message', () => {
    expect(formatError({ code: 'budget_exceeded' })).toBe(ERROR_MESSAGES.budget_exceeded);
  });

  it('maps brand_review_blocked', () => {
    expect(formatError({ code: 'brand_review_blocked' })).toMatch(/brand/i);
  });

  it('falls back to message when code is unknown', () => {
    expect(formatError({ code: 'foo_bar', message: 'Custom server message' })).toBe(
      'Custom server message',
    );
  });

  it('falls back to bare code when neither known nor message present', () => {
    expect(formatError({ code: 'unknown_thing' })).toMatch(/unknown_thing/);
  });

  it('handles Error instances', () => {
    expect(formatError(new Error('boom'))).toBe('boom');
  });

  it('handles raw strings', () => {
    expect(formatError('plain string')).toBe('plain string');
  });

  it('handles non-object truthy values gracefully', () => {
    expect(formatError(undefined)).toBe('Une erreur est survenue.');
    expect(formatError(null)).toBe('Une erreur est survenue.');
    expect(formatError(0)).toBe('Une erreur est survenue.');
  });

  it('falls back to message when no code is set', () => {
    expect(formatError({ message: 'Just message' })).toBe('Just message');
  });
});
