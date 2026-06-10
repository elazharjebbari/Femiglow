/**
 * GET /api/admin/emails/audiences/click-urls/autocomplete?q=
 *
 * Liste les URLs de clic DISTINCTES vues dans `email_event` (type='clicked',
 * colonne `link_url`), pour alimenter le champ `urlPattern` de la règle
 * `email_clicked` du builder d'audiences (UX-AUD-004 / manque d'autocomplétion
 * recensé). Avant : champ absent → ciblage « a cliqué un lien vers /promo »
 * impossible. Maintenant : combobox d'URLs réellement tracées.
 *
 * Contrat : `{ urls: Array<{ url: string; count: number }> }` (les plus
 * fréquentes d'abord). Validation Zod sur `q`. Auth admin. DB indisponible →
 * `{ urls: [] }` (200, dégradation propre).
 *
 * SÉCURITÉ : `q` est échappé des métacaractères LIKE avant le `%q%` (même
 * convention que les autres routes autocomplete).
 */
import { NextResponse } from 'next/server';
import { and, desc, eq, ilike, isNotNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getAdminSession } from '@/lib/auth/require-admin';
import { db as getDb } from '@/lib/db/client';
import { emailEvent } from '@/lib/db/schema-emails';
import { escapeLikePrefix } from '../../../transactional/recipients-autocomplete/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  q: z.string().max(500).optional().default(''),
});

export async function GET(req: Request): Promise<Response> {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

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
  if (!drizzle) return NextResponse.json({ urls: [] });

  const contains = `%${escapeLikePrefix(q)}%`;
  const whereClause = and(
    eq(emailEvent.type, 'clicked'),
    isNotNull(emailEvent.linkUrl),
    q.length > 0 ? ilike(emailEvent.linkUrl, contains) : undefined,
  );

  const rows = await drizzle
    .select({
      url: emailEvent.linkUrl,
      count: sql<number>`count(*)::int`,
    })
    .from(emailEvent)
    .where(whereClause)
    .groupBy(emailEvent.linkUrl)
    .orderBy(desc(sql`count(*)`))
    .limit(20);

  return NextResponse.json({
    urls: rows
      .filter((r): r is { url: string; count: number } => Boolean(r.url))
      .map((r) => ({ url: r.url, count: r.count })),
  });
}
