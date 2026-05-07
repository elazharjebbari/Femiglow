/**
 * Client DB pour le module chat.
 *
 * Réutilise le wrapper `db()` existant en y ajoutant le schéma chat.
 * Le module chat a besoin d'opérations SQL avancées (pgvector,
 * tsvector full-text) qui ne se prêtent pas au store mémoire :
 * `chatDb()` retourne `null` si DATABASE_URL est absent et l'appelant
 * doit lever une erreur claire.
 *
 * Dual driver :
 *  - URL contenant `neon.tech` ou `pooler.neon` → `@neondatabase/serverless` (HTTP).
 *  - Sinon (Postgres local / standard) → `postgres-js` via `drizzle-orm/postgres-js`.
 */
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import { neon } from '@neondatabase/serverless';
import postgres from 'postgres';

import * as coreSchema from '@/lib/db/schema';

import * as chatSchema from './schema';

export const schema = { ...coreSchema, ...chatSchema };

type ChatDb =
  | ReturnType<typeof drizzleNeon<typeof schema>>
  | ReturnType<typeof drizzlePg<typeof schema>>;

const cache = globalThis as typeof globalThis & { __femiglowChatDb?: ChatDb | null };

function isNeonUrl(url: string): boolean {
  return /neon\.tech|neon\.build/i.test(url);
}

export function chatDb(): ChatDb | null {
  if (cache.__femiglowChatDb !== undefined) return cache.__femiglowChatDb;
  const url = process.env.DATABASE_URL;
  if (!url) {
    cache.__femiglowChatDb = null;
    return null;
  }
  if (isNeonUrl(url)) {
    const sql = neon(url);
    cache.__femiglowChatDb = drizzleNeon(sql, { schema }) as ChatDb;
  } else {
    const client = postgres(url, { prepare: false, max: 5 });
    cache.__femiglowChatDb = drizzlePg(client, { schema }) as ChatDb;
  }
  return cache.__femiglowChatDb;
}

export class ChatDbUnavailableError extends Error {
  constructor() {
    super('chat module requires DATABASE_URL — pgvector / full-text search are SQL-only');
    this.name = 'ChatDbUnavailableError';
  }
}

export function requireChatDb(): ChatDb {
  const db = chatDb();
  if (!db) throw new ChatDbUnavailableError();
  return db;
}
