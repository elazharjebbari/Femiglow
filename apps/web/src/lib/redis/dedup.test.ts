import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isDuplicateEvent, resetDedupEvent } from './dedup';
import { redis } from './client';

beforeEach(() => {
  redis.__resetMemoryStore();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('isDuplicateEvent', () => {
  it('première fois → false (pas duplicate)', async () => {
    expect(await isDuplicateEvent('evt_1')).toBe(false);
  });

  it('deuxième fois en TTL → true', async () => {
    await isDuplicateEvent('evt_2');
    expect(await isDuplicateEvent('evt_2')).toBe(true);
  });

  it('triple call → 1ère false, 2ème + 3ème true', async () => {
    expect(await isDuplicateEvent('evt_3')).toBe(false);
    expect(await isDuplicateEvent('evt_3')).toBe(true);
    expect(await isDuplicateEvent('evt_3')).toBe(true);
  });

  it('eventIds différents → indépendants', async () => {
    await isDuplicateEvent('evt_a');
    await isDuplicateEvent('evt_b');
    expect(await isDuplicateEvent('evt_a')).toBe(true);
    expect(await isDuplicateEvent('evt_b')).toBe(true);
    expect(await isDuplicateEvent('evt_c')).toBe(false);
  });

  it('eventId vide → false (no-op)', async () => {
    expect(await isDuplicateEvent('')).toBe(false);
  });

  it('TTL custom → expiration respectée', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-24T10:00:00Z'));
    await isDuplicateEvent('evt_ttl', 10);
    vi.setSystemTime(new Date('2026-05-24T10:00:05Z'));
    expect(await isDuplicateEvent('evt_ttl', 10)).toBe(true);
    // Après TTL
    vi.setSystemTime(new Date('2026-05-24T10:00:20Z'));
    expect(await isDuplicateEvent('evt_ttl', 10)).toBe(false);
  });
});

describe('resetDedupEvent', () => {
  it('reset → next call retourne false', async () => {
    await isDuplicateEvent('evt_reset');
    expect(await isDuplicateEvent('evt_reset')).toBe(true);
    await resetDedupEvent('evt_reset');
    expect(await isDuplicateEvent('evt_reset')).toBe(false);
  });
});
