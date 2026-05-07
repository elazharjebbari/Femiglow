import { describe, it, expect, beforeEach } from 'vitest';
import { resetMemoryStore } from '@/lib/db/client';
import { checkRateLimit } from './check';

beforeEach(() => {
  resetMemoryStore();
});

describe('checkRateLimit', () => {
  it('autorise jusqu’à la limite puis bloque', async () => {
    for (let i = 0; i < 3; i += 1) {
      const r = await checkRateLimit({ key: 'k', limit: 3, windowMs: 60_000 });
      expect(r.ok).toBe(true);
      expect(r.remaining).toBe(2 - i);
    }
    const blocked = await checkRateLimit({ key: 'k', limit: 3, windowMs: 60_000 });
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it('réinitialise le compteur après la fenêtre', async () => {
    const t0 = 1_000_000;
    await checkRateLimit({ key: 'k', limit: 1, windowMs: 1_000, now: t0 });
    const blocked = await checkRateLimit({ key: 'k', limit: 1, windowMs: 1_000, now: t0 + 500 });
    expect(blocked.ok).toBe(false);
    const after = await checkRateLimit({ key: 'k', limit: 1, windowMs: 1_000, now: t0 + 1_500 });
    expect(after.ok).toBe(true);
  });

  it('isole les clés', async () => {
    await checkRateLimit({ key: 'a', limit: 1, windowMs: 60_000 });
    const b = await checkRateLimit({ key: 'b', limit: 1, windowMs: 60_000 });
    expect(b.ok).toBe(true);
  });
});
