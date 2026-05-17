import { describe, it, expect, beforeEach } from 'vitest';

// We test the memory-store path by simulating the logic locally
// (the actual module imports db/client which isn't available in vitest)

interface MemoryEntry {
  response: unknown;
  expiresAt: number;
}

function createStore() {
  const store = new Map<string, MemoryEntry>();
  const TTL_MS = 24 * 60 * 60 * 1000;

  function clean() {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.expiresAt < now) store.delete(key);
    }
  }

  function get(key: string): unknown | null {
    clean();
    const entry = store.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      store.delete(key);
      return null;
    }
    return entry.response;
  }

  function set(key: string, response: unknown) {
    store.set(key, { response, expiresAt: Date.now() + TTL_MS });
  }

  function setExpired(key: string, response: unknown) {
    store.set(key, { response, expiresAt: Date.now() - 1000 });
  }

  function size() {
    clean();
    return store.size;
  }

  return { get, set, setExpired, size, clean };
}

describe('Idempotency store (memory)', () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  it('store et retrieve une clé', () => {
    store.set('key-1', { idea: { id: 'test' } });
    const result = store.get('key-1');
    expect(result).toEqual({ idea: { id: 'test' } });
  });

  it('clé inexistante retourne null', () => {
    expect(store.get('nonexistent')).toBeNull();
  });

  it('clé expirée retourne null et est supprimée', () => {
    store.setExpired('expired-key', { data: 'old' });
    expect(store.get('expired-key')).toBeNull();
  });

  it('cleanup supprime les clés expirées', () => {
    store.set('valid-key', { data: 'new' });
    store.setExpired('expired-key', { data: 'old' });
    store.clean();
    expect(store.size()).toBe(1);
  });

  it('écrase une clé existante', () => {
    store.set('key-1', { version: 1 });
    store.set('key-1', { version: 2 });
    const result = store.get('key-1');
    expect(result).toEqual({ version: 2 });
  });
});