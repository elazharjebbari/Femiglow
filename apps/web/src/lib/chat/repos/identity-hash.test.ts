import { describe, expect, it } from 'vitest';

import { computeIdentityHash } from './identity-hash';

describe('computeIdentityHash', () => {
  it('produces a stable 64-char hex string', () => {
    const hash = computeIdentityHash('+212612345678', 'Ahmed');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic: same input produces same hash', () => {
    const a = computeIdentityHash('+212612345678', 'Ahmed');
    const b = computeIdentityHash('+212612345678', 'Ahmed');
    expect(a).toBe(b);
  });

  it('is case-insensitive for first name', () => {
    const a = computeIdentityHash('+212612345678', 'Ahmed');
    const b = computeIdentityHash('+212612345678', 'ahmed');
    const c = computeIdentityHash('+212612345678', 'AHMED');
    expect(a).toBe(b);
    expect(a).toBe(c);
  });

  it('trims whitespace from both phone and name', () => {
    const a = computeIdentityHash('+212612345678', 'Fatima');
    const b = computeIdentityHash('  +212612345678  ', '  Fatima  ');
    expect(a).toBe(b);
  });

  it('produces different hashes for different phones', () => {
    const a = computeIdentityHash('+212612345678', 'Ahmed');
    const b = computeIdentityHash('+212698765432', 'Ahmed');
    expect(a).not.toBe(b);
  });

  it('produces different hashes for different names', () => {
    const a = computeIdentityHash('+212612345678', 'Ahmed');
    const b = computeIdentityHash('+212612345678', 'Fatima');
    expect(a).not.toBe(b);
  });

  it('uses pipe separator to prevent field ambiguity', () => {
    // "+212612345678|ahmed" should not collide with "+21261234567|8ahmed"
    const a = computeIdentityHash('+212612345678', 'ahmed');
    const b = computeIdentityHash('+21261234567', '8ahmed');
    expect(a).not.toBe(b);
  });
});