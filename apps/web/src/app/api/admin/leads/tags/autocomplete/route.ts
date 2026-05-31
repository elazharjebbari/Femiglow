/**
 * GET /api/admin/leads/tags/autocomplete
 *
 * Liste des tags distincts présents dans lead_tag, classés par fréquence
 * décroissante. Utilisé par l'audience builder pour le critère `has_tag`.
 */
import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth/require-admin';
import { db as getDb } from '@/lib/db/client';
import { leadTag } from '@/lib/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  await requireAdmin('/api/admin/leads/tags/autocomplete');
  const drizzle = getDb();
  if (!drizzle) return NextResponse.json({ tags: [] });

  const rows = await drizzle
    .select({
      tag: leadTag.tag,
      count: sql<number>`count(*)::int`,
    })
    .from(leadTag)
    .groupBy(leadTag.tag)
    .orderBy(sql`count(*) desc`)
    .limit(200);

  return NextResponse.json({ tags: rows });
}
