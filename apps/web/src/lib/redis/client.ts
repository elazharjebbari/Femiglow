/**
 * Client Redis Upstash — abstraction pour externalisation du state.
 *
 * Référence : `docs/live-systems-fix-2026-05/02-vision-architecture.md` § Principe #1
 *
 * Pourquoi un wrapper ?
 * ───────────────────────
 *  - Permettre une migration progressive : code v2 lit `redis.set()`, mais
 *    si `UPSTASH_REDIS_URL` n'est pas configuré → fallback memory store
 *    avec warning (acceptable pour dev local + tests, signalé en prod).
 *  - Centraliser la gestion des erreurs Redis (timeouts, network) pour
 *    fail-soft cohérent sur tous les call-sites.
 *  - Simplifier les mocks vitest (1 seul module à mock).
 *
 * API exposée — sous-ensemble Redis cohérent avec @upstash/redis :
 *  - get(key) → string | null
 *  - set(key, value, opts) → 'OK' | null
 *  - del(key) → number
 *  - incr(key) → number
 *  - expire(key, seconds) → number
 *  - rpush(key, value) / lpop(key, count) — LIST ops pour CAPI batching
 *  - hgetall / hset — HASH ops pour circuit breaker state
 */
import 'server-only';
import { logger } from '@/lib/logging/logger';

// ─────────────────────────────────────────────────────────────────────────────
// Memory fallback (utilisé si Redis URL non configuré OU Redis down)
// ─────────────────────────────────────────────────────────────────────────────

interface MemoryEntry {
  value: string | string[] | Record<string, string>;
  expireAt: number | null; // ms timestamp, null = no expire
}

const memoryStore = new Map<string, MemoryEntry>();

function memoryGet(key: string): string | null {
  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (entry.expireAt !== null && entry.expireAt < Date.now()) {
    memoryStore.delete(key);
    return null;
  }
  return typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value);
}

function memorySet(
  key: string,
  value: string,
  opts: { ex?: number; nx?: boolean } = {},
): 'OK' | null {
  if (opts.nx) {
    const existing = memoryStore.get(key);
    if (existing && (existing.expireAt === null || existing.expireAt >= Date.now())) {
      return null; // already exists, NX fail
    }
  }
  memoryStore.set(key, {
    value,
    expireAt: opts.ex ? Date.now() + opts.ex * 1000 : null,
  });
  return 'OK';
}

function memoryDel(key: string): number {
  return memoryStore.delete(key) ? 1 : 0;
}

function memoryIncr(key: string): number {
  const current = memoryGet(key);
  const next = (current ? parseInt(current, 10) : 0) + 1;
  memoryStore.set(key, { value: String(next), expireAt: null });
  return next;
}

function memoryExpire(key: string, seconds: number): number {
  const entry = memoryStore.get(key);
  if (!entry) return 0;
  entry.expireAt = Date.now() + seconds * 1000;
  return 1;
}

function memoryRpush(key: string, ...values: string[]): number {
  const entry = memoryStore.get(key);
  const list = (Array.isArray(entry?.value) ? entry!.value : []) as string[];
  const newList = [...list, ...values];
  memoryStore.set(key, { value: newList, expireAt: entry?.expireAt ?? null });
  return newList.length;
}

function memoryLpop(key: string, count = 1): string[] | null {
  const entry = memoryStore.get(key);
  if (!entry || !Array.isArray(entry.value) || entry.value.length === 0) {
    return null;
  }
  const popped: string[] = [];
  const list = entry.value as string[];
  for (let i = 0; i < count && list.length > 0; i++) {
    popped.push(list.shift()!);
  }
  if (list.length === 0) {
    memoryStore.delete(key);
  }
  return popped;
}

function memoryLlen(key: string): number {
  const entry = memoryStore.get(key);
  return Array.isArray(entry?.value) ? (entry!.value as string[]).length : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Upstash client (chargé lazy, optionnel)
// ─────────────────────────────────────────────────────────────────────────────

interface UpstashClient {
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    opts?: { ex?: number; nx?: boolean },
  ): Promise<'OK' | null>;
  del(key: string): Promise<number>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  rpush(key: string, ...values: string[]): Promise<number>;
  lpop(key: string, count?: number): Promise<string[] | string | null>;
  llen(key: string): Promise<number>;
}

let upstashClient: UpstashClient | null = null;
let upstashInitialized = false;

async function getUpstashClient(): Promise<UpstashClient | null> {
  if (upstashInitialized) return upstashClient;
  upstashInitialized = true;

  const url = process.env.UPSTASH_REDIS_URL;
  const token = process.env.UPSTASH_REDIS_TOKEN;
  if (!url || !token) {
    logger.warn('redis.client.not_configured', {
      reason: 'UPSTASH_REDIS_URL or UPSTASH_REDIS_TOKEN missing',
      fallback: 'memory_store',
    });
    return null;
  }

  try {
    // Dynamic import masqué pour ne pas casser le build si le package
    // n'est pas installé (acceptable en dev local + tests vitest).
    // Vite analyse statiquement les `import('literal')` → on passe par
    // une variable pour échapper à l'analyse.
    const modulePath = '@upstash/redis';
    const mod = (await import(/* @vite-ignore */ modulePath)) as {
      Redis: new (config: { url: string; token: string }) => UpstashClient;
    };
    upstashClient = new mod.Redis({ url, token });
    logger.info('redis.client.initialized', { url: maskUrl(url) });
    return upstashClient;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('redis.client.init_failed', { error: message, fallback: 'memory_store' });
    return null;
  }
}

function maskUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return '***';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// API publique
// ─────────────────────────────────────────────────────────────────────────────

export interface SetOptions {
  /** Expire en secondes. */
  ex?: number;
  /** Set only if Not eXists (true → no overwrite). */
  nx?: boolean;
}

export const redis = {
  async get(key: string): Promise<string | null> {
    const client = await getUpstashClient();
    if (!client) return memoryGet(key);
    try {
      return await client.get(key);
    } catch (err) {
      logger.warn('redis.get.failed', { key, error: (err as Error).message });
      return memoryGet(key);
    }
  },

  async set(key: string, value: string, opts?: SetOptions): Promise<'OK' | null> {
    const client = await getUpstashClient();
    if (!client) return memorySet(key, value, opts);
    try {
      return await client.set(key, value, opts);
    } catch (err) {
      logger.warn('redis.set.failed', { key, error: (err as Error).message });
      return memorySet(key, value, opts);
    }
  },

  async del(key: string): Promise<number> {
    const client = await getUpstashClient();
    if (!client) return memoryDel(key);
    try {
      return await client.del(key);
    } catch (err) {
      logger.warn('redis.del.failed', { key, error: (err as Error).message });
      return memoryDel(key);
    }
  },

  async incr(key: string): Promise<number> {
    const client = await getUpstashClient();
    if (!client) return memoryIncr(key);
    try {
      return await client.incr(key);
    } catch (err) {
      logger.warn('redis.incr.failed', { key, error: (err as Error).message });
      return memoryIncr(key);
    }
  },

  async expire(key: string, seconds: number): Promise<number> {
    const client = await getUpstashClient();
    if (!client) return memoryExpire(key, seconds);
    try {
      return await client.expire(key, seconds);
    } catch (err) {
      logger.warn('redis.expire.failed', { key, error: (err as Error).message });
      return memoryExpire(key, seconds);
    }
  },

  async rpush(key: string, ...values: string[]): Promise<number> {
    const client = await getUpstashClient();
    if (!client) return memoryRpush(key, ...values);
    try {
      return await client.rpush(key, ...values);
    } catch (err) {
      logger.warn('redis.rpush.failed', { key, error: (err as Error).message });
      return memoryRpush(key, ...values);
    }
  },

  async lpop(key: string, count = 1): Promise<string[]> {
    const client = await getUpstashClient();
    if (!client) return memoryLpop(key, count) ?? [];
    try {
      const result = await client.lpop(key, count);
      if (result === null) return [];
      return Array.isArray(result) ? result : [result];
    } catch (err) {
      logger.warn('redis.lpop.failed', { key, error: (err as Error).message });
      return memoryLpop(key, count) ?? [];
    }
  },

  async llen(key: string): Promise<number> {
    const client = await getUpstashClient();
    if (!client) return memoryLlen(key);
    try {
      return await client.llen(key);
    } catch (err) {
      logger.warn('redis.llen.failed', { key, error: (err as Error).message });
      return memoryLlen(key);
    }
  },

  /**
   * Reset complet du memoryStore — testing only.
   * NE PAS UTILISER en prod.
   */
  __resetMemoryStore(): void {
    if (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'development') {
      throw new Error('redis.__resetMemoryStore can only be called in test/dev');
    }
    memoryStore.clear();
  },
};
