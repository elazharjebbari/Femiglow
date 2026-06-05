/**
 * GET /api/admin/leads/sources/autocomplete
 *
 * Liste des `source` distinctes présentes dans `leads`, classées par fréquence
 * décroissante. Utilisé par l'éditeur d'automation (step update_lead, champ
 * source) pour proposer des valeurs réelles plutôt qu'un texte libre
 * (UX-AUT — manque d'autocomplétion recensé sur StepEditor:204).
 *
 * Renvoie `{ sources: string[] }`.
 */
import { NextResponse } from 'next/server';
import { isNotNull, sql } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth/require-admin';
import { db as getDb } from '@/lib/db/client';
import { leads } from '@/lib/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  await requireAdmin('/api/admin/leads/sources/autocomplete');
  const drizzle = getDb();
  if (!drizzle) return NextResponse.json({ sources: [] });

  const rows = await drizzle
    .select({ source: leads.source, count: sql<number>`count(*)::int` })
    .from(leads)
    .where(isNotNull(leads.source))
    .groupBy(leads.source)
    .orderBy(sql`count(*) desc`)
    .limit(200);

  const sources = rows
    .map((r) => r.source)
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0);

  return NextResponse.json({ sources });
}
