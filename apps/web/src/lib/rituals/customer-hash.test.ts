import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { hashCustomerEmail } from './customer-hash';

beforeEach(() => {
  process.env.RITUAL_PEPPER = 'test-pepper';
});

afterEach(() => {
  delete process.env.RITUAL_PEPPER;
});

describe('hashCustomerEmail', () => {
  it('déterministe pour même email', () => {
    expect(hashCustomerEmail('test@example.com')).toBe(
      hashCustomerEmail('test@example.com'),
    );
  });

  it('insensible à la casse', () => {
    expect(hashCustomerEmail('Test@Example.com')).toBe(
      hashCustomerEmail('test@example.com'),
    );
  });

  it('trim les espaces', () => {
    expect(hashCustomerEmail(' test@example.com ')).toBe(
      hashCustomerEmail('test@example.com'),
    );
  });

  it('hash SHA-256 hex 64 chars', () => {
    expect(hashCustomerEmail('a@b.com')).toMatch(/^[a-f0-9]{64}$/);
  });

  it('hash diffère pour emails différents', () => {
    expect(hashCustomerEmail('a@b.com')).not.toBe(hashCustomerEmail('c@d.com'));
  });

  it('hash diffère selon pepper', () => {
    const h1 = hashCustomerEmail('a@b.com');
    process.env.RITUAL_PEPPER = 'autre-pepper';
    const h2 = hashCustomerEmail('a@b.com');
    expect(h1).not.toBe(h2);
  });
});
