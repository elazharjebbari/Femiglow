/**
 * Idempotency store for POST endpoints.
 * DB-backed when DATABASE_URL is set, in-memory fallback otherwise.
 * Keys expire after 24 hours.
 */

import { db } from '@/lib/db/client';
import { contentIdempotencyKeys } from '@/lib/db/schema-content-studio';
import { eq, lt } from 'drizzle-orm';
import { createId } from '@/lib/ids';

const TTL_MS = 24 * 60 * 60 * 1000;

interface MemoryEntry {
  response: unknown;
  expiresAt: number;
}

const memoryStore = new Map<string, MemoryEntry>();

function cleanMemory() {
  const now = Date.now();
  for (const [key, entry] of memoryStore) {
    if (entry.expiresAt < now) memoryStore.delete(key);
  }
}

export function getIdempotencyKey(request: Request): string | null {
  return request.headers.get('Idempotency-Key') || null;
}

export async function getExistingResponse(key: string): Promise<unknown | null> {
  cleanMemory();
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(contentIdempotencyKeys)
      .where(eq(contentIdempotencyKeys.key, key))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    if (new Date(row.expiresAt).getTime() < Date.now()) {
      await drizzle.delete(contentIdempotencyKeys).where(eq(contentIdempotencyKeys.id, row.id));
      return null;
    }
    return row.response;
  }
  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    memoryStore.delete(key);
    return null;
  }
  return entry.response;
}

export async function storeIdempotentResponse(key: string, response: unknown): Promise<void> {
  const expiresAt = new Date(Date.now() + TTL_MS);
  const drizzle = db();
  if (drizzle) {
    await drizzle.insert(contentIdempotencyKeys).values({
      id: createId('idk'),
      key,
      response: response as Record<string, unknown>,
      expiresAt,
    });
    return;
  }
  memoryStore.set(key, { response, expiresAt: expiresAt.getTime() });
}

export async function cleanExpiredIdempotencyKeys(): Promise<number> {
  const now = new Date();
  const drizzle = db();
  if (drizzle) {
    const result = await drizzle
      .delete(contentIdempotencyKeys)
      .where(lt(contentIdempotencyKeys.expiresAt, now))
      .returning({ id: contentIdempotencyKeys.id });
    return result.length;
  }
  let count = 0;
  for (const [key, entry] of memoryStore) {
    if (entry.expiresAt < Date.now()) {
      memoryStore.delete(key);
      count++;
    }
  }
  return count;
}