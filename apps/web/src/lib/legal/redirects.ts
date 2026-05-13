/**
 * Lookup des slugs renommés. Utilisé par le middleware Next.js et la
 * route /legal/[slug] côté serveur pour répondre en 301 si le slug
 * demandé a été remplacé.
 *
 * On lit via `db()` direct (sans cache `unstable_cache` pour la V1 :
 * la table est petite, les redirects sont rares ; on pourra wrapper
 * plus tard avec un tag dédié).
 */
import { eq } from 'drizzle-orm';

import { db, schema } from '@/lib/db/client';

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
