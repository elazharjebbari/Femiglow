/**
 * Simple in-memory idempotency store for POST endpoints.
 * Keys expire after 24 hours. Suitable for staging use.
 */

const store = new Map<string, { response: unknown; expiresAt: number }>();
const TTL_MS = 24 * 60 * 60 * 1000;

function cleanup() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt < now) store.delete(key);
  }
}

export function getIdempotencyKey(request: Request): string | null {
  return request.headers.get('Idempotency-Key') || null;
}

export function getExistingResponse(key: string): unknown | null {
  cleanup();
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    store.delete(key);
    return null;
  }
  return entry.response;
}

export function storeIdempotentResponse(key: string, response: unknown): void {
  store.set(key, { response, expiresAt: Date.now() + TTL_MS });
}