import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

beforeAll(() => {
  process.env.MAIL_UNSUB_TOKEN_SECRET = 'a'.repeat(40);
  vi.resetModules();
});

afterAll(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.resetModules();
});

describe('unsub-token', () => {
  it('round-trips a token for the same email', async () => {
    const mod = await import('../unsub-token');
    const token = mod.generateUnsubToken('user@example.com');
    expect(mod.verifyUnsubToken(token)).toBe('user@example.com');
  });

  it('rejects tampered signature', async () => {
    const mod = await import('../unsub-token');
    const token = mod.generateUnsubToken('user@example.com');
    const [sig, payload] = token.split('.');
    const tampered = `${sig.slice(0, -2)}XX.${payload}`;
    expect(mod.verifyUnsubToken(tampered)).toBeNull();
  });

  it('rejects tampered payload (different email)', async () => {
    const mod = await import('../unsub-token');
    const token = mod.generateUnsubToken('user@example.com');
    const [sig] = token.split('.');
    const fakePayload = Buffer.from('attacker@example.com|9999999999').toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    const tampered = `${sig}.${fakePayload}`;
    expect(mod.verifyUnsubToken(tampered)).toBeNull();
  });

  it('rejects expired token', async () => {
    const mod = await import('../unsub-token');
    const fiveDaysFuture = Date.now() + 5 * 24 * 60 * 60 * 1000;
    const token = mod.generateUnsubToken('user@example.com');
    // Move "now" 100 days into the future → expired
    expect(mod.verifyUnsubToken(token, Date.now() + 100 * 24 * 60 * 60 * 1000)).toBeNull();
  });

  it('rejects malformed token', async () => {
    const mod = await import('../unsub-token');
    expect(mod.verifyUnsubToken('not-a-token')).toBeNull();
    expect(mod.verifyUnsubToken('')).toBeNull();
    expect(mod.verifyUnsubToken('foo.bar.baz')).toBeNull();
  });

  it('unsubscribeUrl includes the base URL and token', async () => {
    const mod = await import('../unsub-token');
    const url = mod.unsubscribeUrl('user@example.com', 'https://femiglow-maroc.com');
    expect(url).toMatch(/^https:\/\/femiglow-maroc\.com\/api\/mail\/unsubscribe\?t=/);
  });
});
