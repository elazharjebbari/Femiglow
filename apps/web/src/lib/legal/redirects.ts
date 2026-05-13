/**
 * Lookup + CRUD des slugs renommés. Utilisé par le middleware Next.js et la
 * route /legal/[slug] côté serveur pour répondre en 301 si le slug
 * demandé a été remplacé.
 *
 * On lit via `db()` direct (sans cache `unstable_cache` pour la V1 :
 * la table est petite, les redirects sont rares ; on pourra wrapper
 * plus tard avec un tag dédié).
 */
import { desc, eq } from 'drizzle-orm';

import { db, schema } from '@/lib/db/client';
import type { LegalSlugRedirectRow } from '@/lib/db/schema';

export async function lookupSlugRedirect(oldSlug: string): Promise<string | null> {
  const conn = db();
  if (!conn) return null;
  try {
    const rows = await conn
      .select({ newSlug: schema.legalSlugRedirects.newSlug })
      .from(schema.legalSlugRedirects)
      .where(eq(schema.legalSlugRedirects.oldSlug, oldSlug))
      .limit(1);
    return rows[0]?.newSlug ?? null;
  } catch {
    // Table peut ne pas exister en dev sans migration : ne pas crash.
    return null;
  }
}

export async function listSlugRedirects(): Promise<LegalSlugRedirectRow[]> {
  const conn = db();
  if (!conn) return [];
  try {
    return await conn
      .select()
      .from(schema.legalSlugRedirects)
      .orderBy(desc(schema.legalSlugRedirects.createdAt));
  } catch {
    return [];
  }
}

export interface CreateRedirectInput {
  oldSlug: string;
  newSlug: string;
  actorId: string | null;
}

export type CreateRedirectOutcome =
  | { ok: true; row: LegalSlugRedirectRow }
  | { ok: false; reason: 'identical' | 'duplicate' | 'db_error' };

export async function createSlugRedirect(
  input: CreateRedirectInput,
): Promise<CreateRedirectOutcome> {
  if (input.oldSlug === input.newSlug) {
    return { ok: false, reason: 'identical' };
  }
  const conn = db();
  if (!conn) return { ok: false, reason: 'db_error' };
  try {
    const [row] = await conn
      .insert(schema.legalSlugRedirects)
      .values({
        oldSlug: input.oldSlug,
        newSlug: input.newSlug,
        createdBy: input.actorId,
      })
      .returning();
    if (!row) return { ok: false, reason: 'db_error' };
    return { ok: true, row };
  } catch (err) {
    // FK constraint, unique violation
    const msg = (err as Error).message ?? '';
    if (msg.includes('duplicate') || msg.includes('unique')) {
      return { ok: false, reason: 'duplicate' };
    }
    return { ok: false, reason: 'db_error' };
  }
}

export async function deleteSlugRedirect(oldSlug: string): Promise<boolean> {
  const conn = db();
  if (!conn) return false;
  try {
    const result = await conn
      .delete(schema.legalSlugRedirects)
      .where(eq(schema.legalSlugRedirects.oldSlug, oldSlug));
    return (result as { rowCount?: number }).rowCount !== 0;
  } catch {
    return false;
  }
}
