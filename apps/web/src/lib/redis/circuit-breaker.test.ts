import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CircuitBreaker } from './circuit-breaker';
import { redis } from './client';

beforeEach(() => {
  redis.__resetMemoryStore();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CircuitBreaker — state transitions', () => {
  it('CLOSED par défaut (jamais de failure)', async () => {
    const cb = new CircuitBreaker('test_default');
    expect(await cb.state()).toBe('CLOSED');
    expect(await cb.isAllowed()).toBe(true);
  });

  it('CLOSED → reste CLOSED après 1 failure', async () => {
    const cb = new CircuitBreaker('test_one_fail');
    await cb.recordFailure();
    expect(await cb.state()).toBe('CLOSED');
  });

  it('CLOSED → OPEN après threshold failures', async () => {
    const cb = new CircuitBreaker('test_threshold', { threshold: 3 });
    await cb.recordFailure();
    await cb.recordFailure();
    expect(await cb.state()).toBe('CLOSED');
    await cb.recordFailure();
    expect(await cb.state()).toBe('OPEN');
    expect(await cb.isAllowed()).toBe(false);
  });

  it('OPEN → HALF_OPEN après openDurationMs écoulé', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-24T10:00:00Z'));

    const cb = new CircuitBreaker('test_half_open', {
      threshold: 2,
      openDurationMs: 30_000, // 30s
    });
    await cb.recordFailure();
    await cb.recordFailure();
    expect(await cb.state()).toBe('OPEN');

    // Avancer 29s → toujours OPEN
    vi.setSystemTime(new Date('2026-05-24T10:00:29Z'));
    expect(await cb.state()).toBe('OPEN');

    // Avancer 31s → HALF_OPEN
    vi.setSystemTime(new Date('2026-05-24T10:00:31Z'));
    expect(await cb.state()).toBe('HALF_OPEN');
    expect(await cb.isAllowed()).toBe(true);
  });

  it('HALF_OPEN + recordSuccess → CLOSED', async () => {
    const cb = new CircuitBreaker('test_recovery', {
      threshold: 2,
      openDurationMs: 100,
    });
    await cb.recordFailure();
    await cb.recordFailure();
    await new Promise((r) => setTimeout(r, 150));

    expect(await cb.state()).toBe('HALF_OPEN');
    await cb.recordSuccess();
    expect(await cb.state()).toBe('CLOSED');
  });

  it('recordSuccess depuis CLOSED → reste CLOSED', async () => {
    const cb = new CircuitBreaker('test_success_noop');
    await cb.recordSuccess();
    expect(await cb.state()).toBe('CLOSED');
  });

  it('recordSuccess reset le compteur failures', async () => {
    const cb = new CircuitBreaker('test_reset_counter', { threshold: 3 });
    await cb.recordFailure();
    await cb.recordFailure();
    await cb.recordSuccess();
    // Maintenant on peut accumuler 3 nouvelles failures avant ouverture
    await cb.recordFailure();
    await cb.recordFailure();
    expect(await cb.state()).toBe('CLOSED'); // 2 failures < threshold 3
    await cb.recordFailure();
    expect(await cb.state()).toBe('OPEN');
  });

  it('reset() manuel → état CLOSED', async () => {
    const cb = new CircuitBreaker('test_manual_reset', { threshold: 2 });
    await cb.recordFailure();
    await cb.recordFailure();
    expect(await cb.state()).toBe('OPEN');
    await cb.reset();
    expect(await cb.state()).toBe('CLOSED');
  });
});

describe('CircuitBreaker — recordFailure return value', () => {
  it('retourne CLOSED tant qu\'on est sous le seuil', async () => {
    const cb = new CircuitBreaker('test_return_closed', { threshold: 3 });
    expect(await cb.recordFailure()).toBe('CLOSED');
    expect(await cb.recordFailure()).toBe('CLOSED');
  });

  it('retourne OPEN quand on atteint le seuil', async () => {
    const cb = new CircuitBreaker('test_return_open', { threshold: 2 });
    await cb.recordFailure();
    expect(await cb.recordFailure()).toBe('OPEN');
  });
});

describe('CircuitBreaker — isolation', () => {
  it('breakers différents → indépendants', async () => {
    const cb1 = new CircuitBreaker('chat_openai', { threshold: 2 });
    const cb2 = new CircuitBreaker('chat_anthropic', { threshold: 2 });

    await cb1.recordFailure();
    await cb1.recordFailure();
    expect(await cb1.state()).toBe('OPEN');
    expect(await cb2.state()).toBe('CLOSED');
  });
});
