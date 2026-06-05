/**
 * GET /api/admin/emails/leads/autocomplete?q=
 *
 * Recherche de leads par email OU nom (ILIKE `%q%`), pour alimenter le champ
 * « Preview avec contexte » de l'éditeur de templates (UX-TPL-008) et tout autre
 * sélecteur de lead. Plafonné à 20 résultats, triés par date de création
 * décroissante (les leads récents d'abord).
 *
 * Contrat : `{ leads: Array<{ email: string; name: string | null }> }`.
 * Validation Zod sur `q`. Auth admin. DB indisponible → `{ leads: [] }` (200).
 *
 * SÉCURITÉ : `q` est échappé des métacaractères LIKE avant le `%q%`.
 */
import { NextResponse } from 'next/server';
import { desc, ilike, or } from 'drizzle-orm';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/require-admin';
import { db as getDb } from '@/lib/db/client';
import { leads } from '@/lib/db/schema';
import { escapeLikePrefix } from '../../transactional/recipients-autocomplete/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  q: z.string().max(200).optional().default(''),
});

export async function GET(req: Request): Promise<Response> {
  await requireAdmin('/api/admin/emails/leads/autocomplete');

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
  if (!drizzle) return NextResponse.json({ leads: [] });

  const contains = `%${escapeLikePrefix(q)}%`;
  const rows = await drizzle
    .select({ email: leads.email, name: leads.name })
    .from(leads)
    .where(
      q.length > 0
        ? or(ilike(leads.email, contains), ilike(leads.name, contains))
        : undefined,
    )
    .orderBy(desc(leads.createdAt))
    .limit(20);

  return NextResponse.json({ leads: rows });
}
