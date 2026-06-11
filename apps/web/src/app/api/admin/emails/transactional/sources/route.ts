/**
 * GET /api/admin/emails/transactional/sources?q=
 *
 * Liste des `source` DISTINCTES présentes dans `email_outbox` (ex. `api.contact`,
 * `import`, `app`). Set fermé connu côté backend mais non exposé : sert au
 * typeahead `source:` du cockpit. Filtrable par préfixe optionnel `q` (ILIKE
 * `q%`), plafonné à 20, trié alphabétiquement.
 *
 * Contrat : `{ sources: string[] }`. Validation Zod sur `q`. Auth admin. DB
 * indisponible → `{ sources: [] }` (200).
 */
import { NextResponse } from 'next/server';
import { and, asc, ilike, isNotNull } from 'drizzle-orm';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/require-admin';
import { db as getDb } from '@/lib/db/client';
import { emailOutbox } from '@/lib/db/schema-emails';
import { escapeLikePrefix } from '@/lib/mail/escape-like-prefix';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  q: z.string().max(200).optional().default(''),
});

export async function GET(req: Request): Promise<Response> {
  await requireAdmin('/api/admin/emails/transactional/sources');

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({ q: url.searchParams.get('q') ?? '' });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation échouée', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }
  const q = parsed.data.q.trim();

  const drizzle = getDb();
  if (!drizzle) return NextResponse.json({ sources: [] });

  const pattern = `${escapeLikePrefix(q)}%`;
  const rows = await drizzle
    .selectDistinct({ source: emailOutbox.source })
    .from(emailOutbox)
    .where(
      q.length > 0
        ? and(isNotNull(emailOutbox.source), ilike(emailOutbox.source, pattern))
        : isNotNull(emailOutbox.source),
    )
    .orderBy(asc(emailOutbox.source))
    .limit(20);

  const sources = rows.map((r) => r.source).filter((s): s is string => !!s);
  return NextResponse.json({ sources });
}
